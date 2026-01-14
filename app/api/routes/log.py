from fastapi import APIRouter, HTTPException
import time
from app.models.schemas import LogExtractRequest, LogExtractResponse, Emotion
from app.service.log_extractor import extract_topic_and_emotion
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/log)
router = APIRouter(prefix="/api/log", tags=["log"])

logger = get_logger(__name__)


@router.post("/extract", response_model=LogExtractResponse)
def extract_log(request: LogExtractRequest):
    """
    Log 추출 API
    
    일기 내용에서 주제와 감정을 추출합니다.
    
    - **content**: 일기 내용
    """
    start_time = time.time()
    try:
        if not request.content or not request.content.strip():
            duration_ms = (time.time() - start_time) * 1000
            log_api_request(
                logger,
                method="POST",
                path="/api/log/extract",
                status_code=400,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=400, detail="일기 내용이 비어있습니다.")
        
        topic, emotion = extract_topic_and_emotion(request.content)
        duration_ms = (time.time() - start_time) * 1000
        
        log_api_request(
            logger,
            method="POST",
            path="/api/log/extract",
            status_code=200,
            duration_ms=duration_ms,
            content_len=len(request.content),
            topic=topic,
            emotion=emotion.value
        )
        
        return LogExtractResponse(
            topic=topic,
            emotion=emotion
        )
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"Log 추출 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/log/extract",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="Log 추출에 실패했습니다.")
