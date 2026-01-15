"""
일기 정보 추출 API 라우터

LangGraph 기반 extractor 서비스를 호출하는 FastAPI 라우터
"""
from fastapi import APIRouter, HTTPException
import time
from app.models.schemas import ExtractorRequest, ExtractorResponse
from app.service.extractor_service import extract_diary_info
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/extractor)
router = APIRouter(prefix="/api/extractor", tags=["extractor"])

logger = get_logger(__name__)


@router.post("/extract", response_model=ExtractorResponse, status_code=200)
def extract_diary(request: ExtractorRequest):
    """
    일기 정보 추출 API
    
    일기 내용에서 주제와 감정을 추출합니다.
    
    - **content**: 일기 원본 내용
    - **datetime**: 일기 작성 시간 (선택, 기본값: 현재 시간)
    
    Returns:
        ExtractorResponse: 추출된 주제, 감정, 작성 시간
    """
    start_time = time.time()
    try:
        # 서비스 함수 호출
        result = extract_diary_info(
            diary_content=request.content,
            diary_datetime=request.datetime
        )
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/extractor/extract",
            status_code=200,
            duration_ms=duration_ms,
            content_len=len(request.content)
        )
        
        return ExtractorResponse(
            topic=result["topic"],
            emotion=result["emotion"],
            datetime=result["datetime"]
        )
        
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 정보 추출 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/extractor/extract",
            status_code=400,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 정보 추출 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/extractor/extract",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=500,
            detail="일기 정보 추출에 실패했습니다."
        )
