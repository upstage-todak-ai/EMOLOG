"""
리포트 작성 API 라우터

LangGraph 기반 report 서비스를 호출하는 FastAPI 라우터
"""
from fastapi import APIRouter, HTTPException
import time
from app.models.schemas import ReportRequest, ReportResponse
from app.service.report_service import generate_weekly_report
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/report)
router = APIRouter(prefix="/api/report", tags=["report"])

logger = get_logger(__name__)


@router.post("/weekly", response_model=ReportResponse, status_code=200)
def create_weekly_report(request: ReportRequest):
    """
    주간 리포트 생성 API
    
    일주일치 일기 데이터를 분석하여 리포트를 생성합니다.
    
    - **diary_entries**: extractor로 분석된 일기 항목 리스트
    - **period_start**: 리포트 기간 시작일 (선택, 기본값: 일주일 전)
    - **period_end**: 리포트 기간 종료일 (선택, 기본값: 오늘)
    
    Returns:
        ReportResponse: 생성된 리포트, 요약, 기간 정보
    """
    start_time = time.time()
    try:
        # Pydantic 모델을 딕셔너리로 변환
        diary_entries_dict = [
            {
                "date": entry.date,
                "content": entry.content,
                "topic": entry.topic,
                "emotion": entry.emotion
            }
            for entry in request.diary_entries
        ]
        
        # 서비스 함수 호출
        result = generate_weekly_report(
            diary_entries=diary_entries_dict,
            period_start=request.period_start,
            period_end=request.period_end
        )
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/report/weekly",
            status_code=200,
            duration_ms=duration_ms,
            diary_count=len(request.diary_entries)
        )
        
        return ReportResponse(
            report=result["report"],
            summary=result["summary"],
            period_start=result["period_start"],
            period_end=result["period_end"]
        )
        
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"리포트 생성 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/report/weekly",
            status_code=400,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"리포트 생성 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/report/weekly",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=500,
            detail="리포트 생성에 실패했습니다."
        )
