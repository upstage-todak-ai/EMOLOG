"""
알림 판단 API 라우터
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import time

from app.repository.diary_repository import get_diary_repository
from app.repository.calendar_repository import get_calendar_repository
from app.services.notification.notification_service import should_send_notification
from app.core.logging import get_logger, log_api_request

router = APIRouter(prefix="/api/notification", tags=["notification"])

logger = get_logger(__name__)


@router.post("/test")
def test_notification(user_id: str, current_time: Optional[str] = None):
    """
    알림 판단 테스트 API
    
    사용자의 최신 일기, 과거 일기 목록, 캘린더 이벤트를 가져와서
    알림 전송 여부를 판단합니다.
    
    - **user_id**: 사용자 ID
    - **current_time**: 현재 시간 (선택, 형식: "YYYY-MM-DD HH:MM:SS", 기본값: 현재 시간)
    """
    start_time = time.time()
    try:
        # Repository 가져오기
        diary_repo = get_diary_repository()
        calendar_repo = get_calendar_repository()
        
        # 사용자의 모든 일기 가져오기
        all_diaries = diary_repo.get_by_user_id(user_id)
        if not all_diaries:
            return {
                "should_send": False,
                "send_time": None,
                "message": None,
                "reason": "일기 데이터가 없습니다.",
                "evaluation_score": 0.0
            }
        
        # 최신 일기를 새로운 일기로 사용
        latest_diary = all_diaries[0]  # 최신순으로 정렬되어 있음
        
        # 새로운 일기 엔트리 구성 (extractor 분석 결과 포함)
        new_diary_entry = {
            "content": latest_diary.content,
            "datetime": latest_diary.created_at.isoformat() if latest_diary.created_at else latest_diary.date + "T00:00:00",
            "topic": latest_diary.topic or "",
            "emotion": latest_diary.emotion.value if latest_diary.emotion else ""
        }
        
        # 과거 일기 목록 구성 (최신 일기 제외)
        diary_entries = []
        for diary in all_diaries[1:]:  # 최신 일기 제외
            diary_entries.append({
                "date": diary.date,
                "content": diary.content,
                "topic": diary.topic or "",
                "emotion": diary.emotion.value if diary.emotion else ""
            })
        
        # 캘린더 이벤트 가져오기 (최근 30일)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        calendar_events_list = calendar_repo.list_by_user_id(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # 캘린더 이벤트 형식 변환
        calendar_events = []
        for event in calendar_events_list:
            calendar_events.append({
                "date": event.start_date if isinstance(event.start_date, str) else event.start_date.isoformat(),
                "title": event.title,
                "type": event.type
            })
        
        # 메시지 목록 (원본 메시지) - 일기 내용을 메시지로 사용
        messages = []
        for diary in all_diaries[:10]:  # 최근 10개만
            messages.append({
                "content": diary.content,
                "datetime": diary.created_at.isoformat() if diary.created_at else diary.date + "T00:00:00"
            })
        
        # 알림 판단 실행
        test_current_time = current_time if current_time else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result = should_send_notification(
            new_diary_entry=new_diary_entry,
            diary_entries=diary_entries,
            calendar_events=calendar_events,
            messages=messages,
            current_time=test_current_time
        )
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/notification/test",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        
        return result
        
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="POST",
                path="/api/notification/test",
                user_id=user_id,
                status_code=200,
                duration_ms=duration_ms
            )
            return {
                "should_send": False,
                "send_time": None,
                "message": None,
                "reason": "Firebase가 설정되지 않았습니다.",
                "evaluation_score": 0.0
            }
        logger.error(f"알림 판단 테스트 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/notification/test",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=f"알림 판단 테스트에 실패했습니다: {error_msg}")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"알림 판단 테스트 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/notification/test",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="알림 판단 테스트에 실패했습니다.")
