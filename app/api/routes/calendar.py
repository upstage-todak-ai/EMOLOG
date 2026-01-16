from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import time

from app.models.schemas import CalendarEvent, CalendarEventCreate, CalendarEventUpdate
from app.repository.calendar_repository import get_calendar_repository
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/calendar)
router = APIRouter(prefix="/api/calendar", tags=["calendar"])

logger = get_logger(__name__)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return datetime.fromisoformat(value)


@router.post("/events/", response_model=CalendarEvent, status_code=201)
def create_calendar_event(event: CalendarEventCreate):
    """캘린더 이벤트 생성 API"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        created_event = repository.create(event)
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/calendar/events/",
            user_id=event.user_id,
            status_code=201,
            duration_ms=duration_ms,
            title=event.title
        )
        return created_event
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="POST",
                path="/api/calendar/events/",
                user_id=event.user_id,
                status_code=503,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=503, detail="데이터베이스가 설정되지 않았습니다. Firebase 설정이 필요합니다.")
        logger.error(f"캘린더 이벤트 생성 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/calendar/events/",
            user_id=event.user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 생성에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 생성 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/calendar/events/",
            user_id=event.user_id if hasattr(event, 'user_id') else None,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 생성에 실패했습니다.")


@router.get("/events/", response_model=List[CalendarEvent])
def list_calendar_events(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """캘린더 이벤트 목록 조회 API (기간 필터 옵션)"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        start_dt = _parse_iso_datetime(start_date)
        end_dt = _parse_iso_datetime(end_date)
        events = repository.list_by_user_id(user_id=user_id, start_date=start_dt, end_date=end_dt)
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/calendar/events/",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms,
            count=len(events)
        )
        return events
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="GET",
                path="/api/calendar/events/",
                user_id=user_id,
                status_code=200,
                duration_ms=duration_ms,
                count=0
            )
            return []
        logger.error(f"캘린더 이벤트 조회 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/calendar/events/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 조회에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 조회 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/calendar/events/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 조회에 실패했습니다.")


@router.get("/events/{event_id}", response_model=CalendarEvent)
def get_calendar_event(event_id: str):
    """특정 캘린더 이벤트 조회 API"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        event = repository.get_by_id(event_id)
        duration_ms = (time.time() - start_time) * 1000
        if not event:
            log_api_request(
                logger,
                method="GET",
                path=f"/api/calendar/events/{event_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Event not found")
        log_api_request(
            logger,
            method="GET",
            path=f"/api/calendar/events/{event_id}",
            user_id=event.user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        return event
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 조회 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path=f"/api/calendar/events/{event_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 조회에 실패했습니다.")


@router.put("/events/{event_id}", response_model=CalendarEvent)
def update_calendar_event(event_id: str, updates: CalendarEventUpdate):
    """캘린더 이벤트 수정 API"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        updated = repository.update(event_id, updates)
        duration_ms = (time.time() - start_time) * 1000
        if not updated:
            log_api_request(
                logger,
                method="PUT",
                path=f"/api/calendar/events/{event_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Event not found")
        log_api_request(
            logger,
            method="PUT",
            path=f"/api/calendar/events/{event_id}",
            user_id=updated.user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 수정 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="PUT",
            path=f"/api/calendar/events/{event_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 수정에 실패했습니다.")


@router.post("/events/batch", response_model=List[CalendarEvent], status_code=201)
def create_calendar_events_batch(events: List[CalendarEventCreate]):
    """캘린더 이벤트 일괄 생성 API"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        created_events = []
        for event in events:
            try:
                created_event = repository.create(event)
                created_events.append(created_event)
            except Exception as e:
                logger.warning(f"캘린더 이벤트 생성 실패 (건너뜀): {event.title} - {str(e)}")
                continue
        
        duration_ms = (time.time() - start_time) * 1000
        user_id = events[0].user_id if events else None
        log_api_request(
            logger,
            method="POST",
            path="/api/calendar/events/batch",
            user_id=user_id,
            status_code=201,
            duration_ms=duration_ms,
            count=len(created_events)
        )
        return created_events
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 일괄 생성 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/calendar/events/batch",
            user_id=events[0].user_id if events else None,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 일괄 생성에 실패했습니다.")


@router.delete("/events/{event_id}", status_code=204)
def delete_calendar_event(event_id: str):
    """캘린더 이벤트 삭제 API"""
    start_time = time.time()
    try:
        repository = get_calendar_repository()
        # 삭제 전에 이벤트 정보 가져오기 (로깅용)
        event = repository.get_by_id(event_id)
        ok = repository.delete(event_id)
        duration_ms = (time.time() - start_time) * 1000
        if not ok:
            log_api_request(
                logger,
                method="DELETE",
                path=f"/api/calendar/events/{event_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Event not found")
        log_api_request(
            logger,
            method="DELETE",
            path=f"/api/calendar/events/{event_id}",
            user_id=event.user_id if event else None,
            status_code=204,
            duration_ms=duration_ms
        )
        return None
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"캘린더 이벤트 삭제 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="DELETE",
            path=f"/api/calendar/events/{event_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="캘린더 이벤트 삭제에 실패했습니다.")

