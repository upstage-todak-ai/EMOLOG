"""
캘린더 이벤트 타입 분류 서비스

LLM을 사용하여 캘린더 이벤트 제목을 분석하고 
심리적 성격 기반으로 타입을 자동 분류합니다.
"""
import time
try:
    from langchain_upstage import ChatUpstage  # type: ignore
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

from app.models.schemas import CalendarEventType
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

if not LANGCHAIN_AVAILABLE:
    logger.warning("langchain_upstage가 설치되지 않았습니다. LLM 분류 기능을 사용할 수 없습니다.")


def classify_calendar_event_type(title: str) -> CalendarEventType:
    """
    LLM을 사용하여 캘린더 이벤트 제목을 분석하고 타입을 분류합니다.
    
    Args:
        title: 캘린더 이벤트 제목 (예: "중간고사", "삼성 면접", "친구 생일파티")
    
    Returns:
        CalendarEventType: 분류된 이벤트 타입 (PERFORMANCE, SOCIAL, CELEBRATION, HEALTH, LEISURE, ROUTINE)
    
    Examples:
        >>> classify_calendar_event_type("중간고사")
        CalendarEventType.PERFORMANCE
        
        >>> classify_calendar_event_type("친구 생일파티")
        CalendarEventType.CELEBRATION
        
        >>> classify_calendar_event_type("병원 예약")
        CalendarEventType.HEALTH
    """
    if not LANGCHAIN_AVAILABLE:
        # langchain_upstage가 없으면 기본값으로 ROUTINE 반환
        logger.warning("langchain_upstage가 설치되지 않아 기본값(ROUTINE)을 반환합니다.")
        return CalendarEventType.ROUTINE
    
    if not settings.UPSTAGE_API_KEY:
        # API 키가 없으면 기본값으로 ROUTINE 반환
        logger.warning("UPSTAGE_API_KEY가 설정되지 않아 기본값(ROUTINE)을 반환합니다.")
        return CalendarEventType.ROUTINE
    
    llm = ChatUpstage(api_key=settings.UPSTAGE_API_KEY)
    start_time = time.time()
    
    prompt = f"""다음 캘린더 이벤트 제목을 분석하여 심리적 성격에 따라 타입을 분류해주세요.

제목: {title}

가능한 타입과 예시:
1. PERFORMANCE (평가/성과): 긴장과 스트레스를 유발하는 일
   예: 시험, 면접, 발표, 과제 마감, 오디션, 대회

2. SOCIAL (사회/관계): 사람을 만나고 에너지를 쓰는 일
   예: 회식, 데이트, 동창회, 결혼식 참석, 친구 약속

3. CELEBRATION (기념일): 축하하거나 챙겨야 하는 날
   예: 생일, 기념일, 명절, 크리스마스

4. HEALTH (건강/치료): 신체/정신적 케어가 필요한 일
   예: 병원, 치과, 상담, 운동, 검진

5. LEISURE (휴식/여가): 리프레시를 위한 일
   예: 여행, 호캉스, 휴가, 영화 관람, 콘서트

6. ROUTINE (일상/기타): 특별한 감정 소모가 없는 단순 일정
   예: 알바, 회의, 미용실, 은행, 장보기

위 제목의 심리적 성격을 분석하여 가장 적합한 타입 하나만 답변해주세요.
답변 형식: 타입 이름만 (예: PERFORMANCE, SOCIAL, CELEBRATION, HEALTH, LEISURE, ROUTINE)
"""
    
    try:
        response = llm.invoke(prompt)
        duration_ms = (time.time() - start_time) * 1000
        type_str = response.content.strip().upper()
        
        # Enum으로 변환
        try:
            event_type = CalendarEventType(type_str)
            logger.info(
                f"LLM 분류 성공 - title={title}, type={event_type.value}, "
                f"duration={duration_ms:.2f}ms"
            )
            return event_type
        except ValueError:
            # 잘못된 타입이면 ROUTINE으로 기본값 반환
            logger.warning(f"잘못된 타입 반환: {type_str}, 기본값(ROUTINE) 사용 - duration={duration_ms:.2f}ms")
            return CalendarEventType.ROUTINE
    except Exception as e:
        # LLM 호출 실패 시 기본값 반환
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"LLM 분류 실패: {e}, 기본값(ROUTINE) 사용 - duration={duration_ms:.2f}ms")
        return CalendarEventType.ROUTINE
