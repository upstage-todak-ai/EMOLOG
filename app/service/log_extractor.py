"""
Log 추출 서비스

LLM을 사용하여 일기 내용에서 주제와 감정을 자동 추출합니다.
"""
import time
import json
import re
try:
    from langchain_upstage import ChatUpstage  # type: ignore
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

from app.models.schemas import Emotion
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

if not LANGCHAIN_AVAILABLE:
    logger.warning("langchain_upstage가 설치되지 않았습니다. LLM 추출 기능을 사용할 수 없습니다.")


def extract_topic_and_emotion(content: str) -> tuple[str | None, Emotion | None]:
    """
    LLM을 사용하여 일기 내용에서 주제와 감정을 추출합니다.
    
    Args:
        content: 일기 내용
    
    Returns:
        tuple[str | None, Emotion | None]: (주제, 감정) 튜플
        주제: "학업", "대인관계", "일상", "취미", "건강" 또는 None (없을 때)
        감정: Emotion enum 값 또는 None (없을 때)
    
    Examples:
        >>> extract_topic_and_emotion("오늘 시험이 끝났는데 생각보다 잘 본 것 같아서 후련하다.")
        ("학업", Emotion.CALM)
    """
    if not LANGCHAIN_AVAILABLE:
        logger.error("❌ langchain_upstage가 설치되지 않아 추출을 수행할 수 없습니다.")
        logger.error("   설치 방법: pip install langchain-upstage")
        return (None, None)
    
    if not settings.UPSTAGE_API_KEY:
        logger.error("❌ UPSTAGE_API_KEY가 설정되지 않아 추출을 수행할 수 없습니다.")
        logger.error("   .env 파일에 UPSTAGE_API_KEY=your_api_key 형식으로 설정하세요.")
        return (None, None)
    
    logger.info(f"✅ LLM 추출 준비 완료 - API_KEY 존재: {bool(settings.UPSTAGE_API_KEY)}")
    
    llm = ChatUpstage(api_key=settings.UPSTAGE_API_KEY)
    start_time = time.time()
    
    prompt = f"""
너는 일기 분석 시스템이다.
아래 일기 내용을 읽고, 반드시 JSON 형식으로만 응답하라.
설명, 문장, 코드블록, 줄바꿈 없이 JSON만 출력하라.

일기 내용:
{content}

출력 JSON 스키마:
{{
  "topic": "학업 | 대인관계 | 건강 | 취미 | 일상 | null ",
  "emotion": "JOY | CALM | SADNESS | ANGER | ANXIETY | EXHAUSTED | null"
}}

감정 분류 가이드:
- JOY: 기쁨, 행복, 즐거움, 만족, 뿌듯함, 설렘
- CALM: 평온, 차분, 안정, 평범, 무난함 (특별한 감정이 없을 때만)
- SADNESS: 슬픔, 우울, 후회, 아쉬움, 그리움, 외로움
- ANGER: 화남, 분노, 빡침, 짜증, 답답함, 억울함
- ANXIETY: 불안, 걱정, 긴장, 두려움, 초조함, 불편함
- EXHAUSTED: 지침, 피곤, 무기력, 힘듦, 지루함, 권태

중요 규칙:
- 일기 내용을 정확히 분석하여 가장 적합한 감정을 선택하라.
- CALM은 특별한 감정이 없을 때만 사용하라. 다른 감정이 있으면 반드시 해당 감정을 선택하라.
- 해당되는 주제나 감정을 찾으면 해당 값을 출력하라.
- 해당되지 않는 것이 있으면 해당 필드는 null로 반환하라.
- 필드를 제외하지 말고 반드시 topic과 emotion 필드를 모두 포함하여 출력하라.
- topic이 없으면 null, emotion이 없으면 null로 설정하라.

예시:
{{"topic": "학업", "emotion": "JOY"}}  // 둘 다 찾은 경우
{{"topic": null, "emotion": "JOY"}}   // topic 못 찾은 경우
{{"topic": "학업", "emotion": null}}  // emotion 못 찾은 경우
{{"topic": null, "emotion": null}}    // 둘 다 못 찾은 경우
"""
    
    try:
        response = llm.invoke(prompt)
        duration_ms = (time.time() - start_time) * 1000
        response_text = response.content.strip()
        
        # JSON 파싱
        topic: str | None = None
        emotion: Emotion | None = None
        
        # JSON 추출 (코드블록이나 불필요한 텍스트 제거)
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            json_str = response_text
        
        try:
            result = json.loads(json_str)
            # topic 처리: None, null, "none", 빈 문자열 모두 None으로 통일
            topic_value = result.get("topic")
            if topic_value is None:
                topic = None
            elif isinstance(topic_value, str):
                topic_value = topic_value.strip()
                if topic_value and topic_value.lower() != "none":
                    topic = topic_value
                else:
                    topic = None
            else:
                topic = None
            
            # emotion 처리: None, null, 빈 문자열 모두 None으로 통일
            emotion_value = result.get("emotion")
            if emotion_value is None:
                emotion = None
            elif isinstance(emotion_value, str):
                emotion_str = emotion_value.strip().upper()
                if emotion_str:
                    try:
                        emotion = Emotion(emotion_str)
                    except ValueError:
                        logger.error(f"유효하지 않은 감정 값: {emotion_str}, response_text: {response_text[:200]}")
                        emotion = None
                else:
                    emotion = None
            else:
                emotion = None
        except json.JSONDecodeError as e:
            logger.error(f"JSON 파싱 실패 - content_len={len(content)}, response_text: {response_text[:200]}, error: {e}")
            return (None, None)
        
        logger.info(
            f"LLM 추출 성공 - content_len={len(content)}, topic={topic}, "
            f"emotion={emotion.value if emotion else None}, duration={duration_ms:.2f}ms"
        )
        
        # 디버깅: LLM 원본 응답 로그
        logger.info(f"LLM 원본 응답: {response_text[:500]}")
        logger.info(f"파싱된 결과: topic={topic}, emotion={emotion.value if emotion else None}")
        
        return (topic, emotion)
    except Exception as e:
        # LLM 호출 실패 시 기본값 반환
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"❌ LLM 추출 실패 - content_len={len(content)}, error: {e}, duration={duration_ms:.2f}ms", exc_info=True)
        logger.error(f"   에러 타입: {type(e).__name__}")
        logger.error(f"   에러 메시지: {str(e)}")
        return (None, None)
