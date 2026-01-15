"""
리포트 생성용 LLM 유틸리티
"""
from langchain_upstage import ChatUpstage
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 전역 변수: LLM 인스턴스 (한 번만 초기화)
_chat_llm = None


def get_chat_llm() -> ChatUpstage:
    """LLM 인스턴스를 가져옵니다 (지연 초기화)"""
    global _chat_llm
    if _chat_llm is None:
        if not settings.UPSTAGE_API_KEY:
            raise ValueError("UPSTAGE_API_KEY가 설정되지 않았습니다.")
        _chat_llm = ChatUpstage(
            model="solar-pro2-251215",
            upstage_api_key=settings.UPSTAGE_API_KEY
        )
        logger.info("Report LLM 초기화 완료")
    return _chat_llm
