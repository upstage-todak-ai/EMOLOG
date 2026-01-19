"""
리포트 작성 API 라우터

LangGraph 기반 report 서비스를 호출하는 FastAPI 라우터
"""
from fastapi import APIRouter, HTTPException
import time
from app.models.schemas import ReportRequest, ReportResponse
from app.services.report.report_service import generate_weekly_report
from app.core.logging import get_logger, log_api_request
from app.repository.report_repository import get_report_repository

# 라우터 생성 (prefix: /api/report)
router = APIRouter(prefix="/api/report", tags=["report"])

logger = get_logger(__name__)


@router.get("/latest", response_model=ReportResponse, status_code=200)
def get_latest_report(user_id: str):
    """
    최신 리포트 조회 API
    
    사용자의 최신 리포트를 조회합니다.
    """
    start_time = time.time()
    logger.info(f"[get_latest_report] 리포트 조회 요청 - user_id={user_id}")
    try:
        report_repo = get_report_repository()
        latest_report = report_repo.get_latest_by_user_id(user_id)
        
        if not latest_report:
            logger.warning(f"[get_latest_report] 리포트 없음 - user_id={user_id}")
            raise HTTPException(
                status_code=404,
                detail="리포트를 찾을 수 없습니다."
            )
        
        # 조회된 insights 확인
        insights_from_db = latest_report.get("insights", [])
        logger.info(f"[get_latest_report] DB에서 조회한 insights 개수: {len(insights_from_db)}")
        if insights_from_db:
            for idx, insight in enumerate(insights_from_db, 1):
                logger.info(f"[get_latest_report] 조회된 insight {idx}: type={insight.get('type', 'unknown')}, dates={insight.get('date_references', [])}")
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/report/latest",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        
        return ReportResponse(
            report=latest_report.get("report", ""),
            summary=latest_report.get("summary", ""),
            period_start=latest_report.get("period_start", ""),
            period_end=latest_report.get("period_end", ""),
            insights=latest_report.get("insights", []),
            created_at=latest_report.get("created_at")
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        # Firebase 미설정 등
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"리포트 조회 실패 (Firebase 미설정): {error_msg}")
        log_api_request(
            logger,
            method="GET",
            path="/api/report/latest",
            user_id=user_id,
            status_code=503,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=503,
            detail="데이터베이스가 설정되지 않았습니다."
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_detail = str(e)
        logger.error(f"리포트 조회 실패: {error_detail}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/report/latest",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=500,
            detail=f"리포트 조회에 실패했습니다: {error_detail}"
        )


@router.get("/previous", response_model=ReportResponse, status_code=200)
def get_previous_report(user_id: str, created_at: str):
    """
    이전 리포트 조회 API
    
    특정 리포트보다 오래된 리포트를 조회합니다 (이전 리포트).
    
    - **created_at**: 기준 리포트의 created_at (ISO 형식)
    """
    start_time = time.time()
    try:
        report_repo = get_report_repository()
        previous_report = report_repo.get_older_than(user_id, created_at)
        
        if not previous_report:
            raise HTTPException(
                status_code=404,
                detail="이전 리포트를 찾을 수 없습니다."
            )
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/report/previous",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        
        return ReportResponse(
            report=previous_report.get("report", ""),
            summary=previous_report.get("summary", ""),
            period_start=previous_report.get("period_start", ""),
            period_end=previous_report.get("period_end", ""),
            insights=previous_report.get("insights", []),
            created_at=previous_report.get("created_at")
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"이전 리포트 조회 실패 (Firebase 미설정): {error_msg}")
        log_api_request(
            logger,
            method="GET",
            path="/api/report/previous",
            user_id=user_id,
            status_code=503,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=503,
            detail="데이터베이스가 설정되지 않았습니다."
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_detail = str(e)
        logger.error(f"이전 리포트 조회 실패: {error_detail}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/report/previous",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(
            status_code=500,
            detail=f"이전 리포트 조회에 실패했습니다: {error_detail}"
        )


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
        
        # 리포트를 DB에 저장 (인사이트 요약 포함)
        try:
            insights_to_save = result.get("insights", [])
            report_repo = get_report_repository()
            saved_report = report_repo.create(
                user_id=request.user_id,
                report=result["report"],
                summary=result["summary"],
                period_start=result["period_start"],
                period_end=result["period_end"],
                insights=insights_to_save,
                eval_score=result.get("eval_score", 0.0),
                attempt=result.get("attempt", 0)
            )
            logger.info(f"[create_weekly_report] 리포트 DB 저장 완료 - report_id={saved_report.get('id')}, user_id={request.user_id}, insights_count={len(saved_report.get('insights', []))}")
        except ValueError as e:
            # Firebase 미설정 등으로 저장 실패해도 리포트는 반환 (로그만 남김)
            logger.warning(f"[create_weekly_report] 리포트 DB 저장 실패 (리포트는 반환): {e}")
        except Exception as e:
            logger.warning(f"[create_weekly_report] 리포트 DB 저장 중 오류 (리포트는 반환): {e}", exc_info=True)
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/report/weekly",
            user_id=request.user_id,
            status_code=200,
            duration_ms=duration_ms,
            diary_count=len(request.diary_entries)
        )
        
        # 저장된 리포트에서 created_at 가져오기 (있을 경우)
        created_at = None
        try:
            if saved_report:
                created_at = saved_report.get("created_at")
        except:
            pass
        
        return ReportResponse(
            report=result["report"],
            summary=result["summary"],
            period_start=result["period_start"],
            period_end=result["period_end"],
            insights=result.get("insights", []),
            created_at=created_at
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
