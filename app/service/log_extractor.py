"""
Log 추출 서비스

LLM을 사용하여 일기 내용에서 주제와 감정을 자동 추출합니다.
"""
import time
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


def extract_topic_and_emotion(content: str) -> tuple[str, Emotion]:
    """
    LLM을 사용하여 일기 내용에서 주제와 감정을 추출합니다.
    
    Args:
        content: 일기 내용
    
    Returns:
        tuple[str, Emotion]: (주제, 감정) 튜플
        주제: "학업", "대인관계", "일상", "취미", "건강", "none"
        감정: Emotion enum 값
    
    Examples:
        >>> extract_topic_and_emotion("오늘 시험이 끝났는데 생각보다 잘 본 것 같아서 후련하다.")
        ("학업", Emotion.CALM)
    """
    if not LANGCHAIN_AVAILABLE:
        # langchain_upstage가 없으면 키워드 기반 추출
        return _extract_by_keyword(content)
    
    if not settings.UPSTAGE_API_KEY:
        # API 키가 없으면 키워드 기반 추출
        logger.warning("UPSTAGE_API_KEY가 설정되지 않아 키워드 기반 추출을 사용합니다.")
        return _extract_by_keyword(content)
    
    llm = ChatUpstage(api_key=settings.UPSTAGE_API_KEY)
    start_time = time.time()
    
    prompt = f"""다음 일기 내용을 분석하여 주제와 감정을 추출해주세요.

일기 내용: {content}

주제 카테고리:
1. 학업: 시험, 공부, 과제, 수업, 학교, 학원 관련
2. 대인관계: 친구, 사람, 관계, 만남, 대화, 소통 관련
3. 건강: 운동, 건강, 병원, 치료, 약 관련
4. 취미: 취미, 게임, 영화, 책, 음악, 여행 관련
5. 일상: 위에 해당하지 않는 일반적인 일상

감정 카테고리:
- JOY: 기쁨, 행복, 즐거움, 만족
- CALM: 평온, 안도, 후련, 차분함
- SADNESS: 슬픔, 우울, 아쉬움, 그리움
- ANGER: 화남, 분노, 짜증, 답답함
- ANXIETY: 불안, 걱정, 긴장, 두려움
- EXHAUSTED: 지침, 피곤, 무기력, 지루함

답변 형식:
주제: [학업|대인관계|건강|취미|일상]
감정: [JOY|CALM|SADNESS|ANGER|ANXIETY|EXHAUSTED]

위 형식으로만 답변해주세요.
"""
    
    try:
        response = llm.invoke(prompt)
        duration_ms = (time.time() - start_time) * 1000
        response_text = response.content.strip()
        
        # 주제와 감정 파싱
        topic = "일상"
        emotion = Emotion.CALM
        
        lines = response_text.split('\n')
        for line in lines:
            if '주제:' in line or 'topic:' in line.lower():
                topic_part = line.split(':')[1].strip() if ':' in line else ""
                if '학업' in topic_part:
                    topic = "학업"
                elif '대인관계' in topic_part:
                    topic = "대인관계"
                elif '건강' in topic_part:
                    topic = "건강"
                elif '취미' in topic_part:
                    topic = "취미"
                elif '일상' in topic_part:
                    topic = "일상"
            elif '감정:' in line or 'emotion:' in line.lower():
                emotion_part = line.split(':')[1].strip().upper() if ':' in line else ""
                try:
                    emotion = Emotion(emotion_part)
                except ValueError:
                    pass
        
        logger.info(
            f"LLM 추출 성공 - content_len={len(content)}, topic={topic}, "
            f"emotion={emotion.value}, duration={duration_ms:.2f}ms"
        )
        return (topic, emotion)
    except Exception as e:
        # LLM 호출 실패 시 키워드 기반 추출
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"LLM 추출 실패: {e}, 키워드 기반 추출 사용 - duration={duration_ms:.2f}ms")
        return _extract_by_keyword(content)


def _extract_by_keyword(content: str) -> tuple[str, Emotion]:
    """
    키워드 기반 주제와 감정 추출 (LLM이 없을 때 fallback)
    """
    content_lower = content.lower()
    
    # 주제 추출
    if any(keyword in content_lower for keyword in ['시험', '공부', '과제', '수업', '학교', '학원']):
        topic = "학업"
    elif any(keyword in content_lower for keyword in ['친구', '사람', '관계', '만남', '대화', '소통']):
        topic = "대인관계"
    elif any(keyword in content_lower for keyword in ['운동', '건강', '병원', '치료', '약']):
        topic = "건강"
    elif any(keyword in content_lower for keyword in ['취미', '게임', '영화', '책', '음악', '여행']):
        topic = "취미"
    else:
        topic = "일상"
    
    # 감정 추출
    if any(keyword in content_lower for keyword in ['기쁘', '행복', '좋', '즐거', '만족', '후련']):
        emotion = Emotion.JOY
    elif any(keyword in content_lower for keyword in ['평온', '안도', '차분', '편안']):
        emotion = Emotion.CALM
    elif any(keyword in content_lower for keyword in ['슬프', '우울', '아쉽', '그리워']):
        emotion = Emotion.SADNESS
    elif any(keyword in content_lower for keyword in ['화나', '분노', '짜증', '답답']):
        emotion = Emotion.ANGER
    elif any(keyword in content_lower for keyword in ['불안', '걱정', '긴장', '두려워']):
        emotion = Emotion.ANXIETY
    elif any(keyword in content_lower for keyword in ['피곤', '지침', '무기력', '지루']):
        emotion = Emotion.EXHAUSTED
    else:
        emotion = Emotion.CALM  # 기본값
    
    return (topic, emotion)
