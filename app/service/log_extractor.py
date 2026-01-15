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


def extract_topic_and_emotion(content: str) -> tuple[str, Emotion | None]:
    """
    LLM을 사용하여 일기 내용에서 주제와 감정을 추출합니다.
    
    Args:
        content: 일기 내용
    
    Returns:
        tuple[str, Emotion | None]: (주제, 감정) 튜플
        주제: "학업", "대인관계", "일상", "취미", "건강", "none"
        감정: Emotion enum 값 또는 None (파싱 실패 시)
    
    Examples:
        >>> extract_topic_and_emotion("오늘 시험이 끝났는데 생각보다 잘 본 것 같아서 후련하다.")
        ("학업", Emotion.CALM)
    """
    if not LANGCHAIN_AVAILABLE:
        logger.error("langchain_upstage가 설치되지 않아 추출을 수행할 수 없습니다.")
        return ("none", None)
    
    if not settings.UPSTAGE_API_KEY:
        logger.error("UPSTAGE_API_KEY가 설정되지 않아 추출을 수행할 수 없습니다.")
        return ("none", None)
    
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
  "topic": "학업 | 대인관계 | 건강 | 취미 | 일상 | none",
  "emotion": "JOY | CALM | SADNESS | ANGER | ANXIETY | EXHAUSTED"
}}

아무것도 해당되지 않으면 topic을 "none"으로 반환하라.
"""
    
    try:
        response = llm.invoke(prompt)
        duration_ms = (time.time() - start_time) * 1000
        response_text = response.content.strip()
        
        # JSON 파싱
        topic = "none"
        emotion: Emotion | None = None
        
        # JSON 추출 (코드블록이나 불필요한 텍스트 제거)
        json_match = re.search(r'\{[^{}]*"topic"[^{}]*"emotion"[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            json_str = response_text
        
        try:
            result = json.loads(json_str)
            topic = result.get("topic", "none")
            emotion_str = result.get("emotion", "").upper()
            if emotion_str:
                try:
                    emotion = Emotion(emotion_str)
                except ValueError:
                    logger.error(f"유효하지 않은 감정 값: {emotion_str}, response_text: {response_text[:200]}")
                    emotion = None
        except json.JSONDecodeError as e:
            logger.error(f"JSON 파싱 실패 - content_len={len(content)}, response_text: {response_text[:200]}, error: {e}")
            return ("none", None)
        
        logger.info(
            f"LLM 추출 성공 - content_len={len(content)}, topic={topic}, "
            f"emotion={emotion.value if emotion else None}, duration={duration_ms:.2f}ms"
        )
        return (topic, emotion)
    except Exception as e:
        # LLM 호출 실패 시 기본값 반환
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"LLM 추출 실패 - content_len={len(content)}, error: {e}, duration={duration_ms:.2f}ms")
        return ("none", None)
