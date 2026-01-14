"""
캘린더 이벤트 데이터 저장소 (Repository Pattern)

Firestore를 사용하여 캘린더 이벤트 데이터를 저장하고 조회합니다.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from google.cloud.firestore_v1.base_query import FieldFilter
from app.core.firebase import get_db
from app.models.schemas import CalendarEvent, CalendarEventCreate, CalendarEventUpdate
from app.core.logging import get_logger, log_db_operation

COLLECTION_NAME = "calendar_events"

logger = get_logger(__name__)


class CalendarRepository:
    """캘린더 이벤트 데이터 저장소 클래스"""

    def __init__(self):
        try:
            self.db = get_db()
            if self.db is None:
                raise ValueError("Firebase가 초기화되지 않았습니다. 환경 변수를 설정해주세요.")
            self.collection = self.db.collection(COLLECTION_NAME)
        except Exception as e:
            raise ValueError(f"Firestore 연결 실패: {str(e)}. Firebase 설정을 확인해주세요.")

    def create(self, event: CalendarEventCreate) -> CalendarEvent:
        """캘린더 이벤트 생성"""
        event_dict = {
            "user_id": event.user_id,
            "title": event.title,
            "start_date": event.start_date.isoformat()
            if isinstance(event.start_date, datetime)
            else event.start_date,
            "end_date": event.end_date.isoformat()
            if isinstance(event.end_date, datetime)
            else event.end_date,
            "type": event.type.value,
            "source_event_id": event.source_event_id,
            "created_at": datetime.now().isoformat(),
        }

        _, doc_ref = self.collection.add(event_dict)
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"캘린더 이벤트 생성 실패 - user_id={event.user_id}, title={event.title}")
            raise ValueError("캘린더 이벤트 생성에 실패했습니다.")
        created_event = self._doc_to_calendar_event(doc)
        log_db_operation(
            logger,
            action="create",
            resource_type="calendar_event",
            user_id=event.user_id,
            resource_id=created_event.id,
            title=event.title,
            type=event.type.value
        )
        return created_event

    def get_by_id(self, event_id: str) -> Optional[CalendarEvent]:
        """ID로 캘린더 이벤트 조회"""
        doc_ref = self.collection.document(event_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"캘린더 이벤트 조회 실패 (존재하지 않음) - event_id={event_id}")
            return None
        event = self._doc_to_calendar_event(doc)
        log_db_operation(
            logger,
            action="get",
            resource_type="calendar_event",
            user_id=event.user_id,
            resource_id=event_id
        )
        return event

    def list_by_user_id(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[CalendarEvent]:
        """사용자 ID로 캘린더 이벤트 목록 조회 (기간 필터는 메모리에서 처리)"""
        query = self.collection.where(filter=FieldFilter("user_id", "==", user_id))
        docs = query.stream()
        events = [self._doc_to_calendar_event(doc) for doc in docs]

        if start_date or end_date:
            filtered: List[CalendarEvent] = []
            for ev in events:
                # start_date는 ISO 문자열로 저장됨
                ev_start = (
                    datetime.fromisoformat(ev.start_date)
                    if isinstance(ev.start_date, str)
                    else ev.start_date
                )
                if start_date and ev_start.replace(tzinfo=None) < start_date.replace(tzinfo=None):
                    continue
                if end_date and ev_start.replace(tzinfo=None) > end_date.replace(tzinfo=None):
                    continue
                filtered.append(ev)
            events = filtered

        # ISO 문자열 비교로 정렬 가능 (오름차순)
        events.sort(key=lambda x: x.start_date)
        log_db_operation(
            logger,
            action="get_list",
            resource_type="calendar_event",
            user_id=user_id,
            count=len(events),
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None
        )
        return events

    def update(self, event_id: str, updates: CalendarEventUpdate) -> Optional[CalendarEvent]:
        """캘린더 이벤트 수정"""
        doc_ref = self.collection.document(event_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"캘린더 이벤트 수정 실패 (존재하지 않음) - event_id={event_id}")
            return None

        existing_event = self._doc_to_calendar_event(doc)
        update_dict = {}
        if updates.title is not None:
            update_dict["title"] = updates.title
        if updates.start_date is not None:
            update_dict["start_date"] = (
                updates.start_date.isoformat()
                if isinstance(updates.start_date, datetime)
                else updates.start_date
            )
        if updates.end_date is not None:
            update_dict["end_date"] = (
                updates.end_date.isoformat()
                if isinstance(updates.end_date, datetime)
                else updates.end_date
            )
        if updates.type is not None:
            update_dict["type"] = updates.type.value

        if not update_dict:
            return existing_event

        update_dict["updated_at"] = datetime.now().isoformat()
        doc_ref.update(update_dict)
        updated_doc = doc_ref.get()
        updated_event = self._doc_to_calendar_event(updated_doc)
        log_db_operation(
            logger,
            action="update",
            resource_type="calendar_event",
            user_id=existing_event.user_id,
            resource_id=event_id,
            title=updates.title if updates.title else None,
            type=updates.type.value if updates.type else None
        )
        return updated_event

    def delete(self, event_id: str) -> bool:
        """캘린더 이벤트 삭제"""
        doc_ref = self.collection.document(event_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"캘린더 이벤트 삭제 실패 (존재하지 않음) - event_id={event_id}")
            return False
        existing_event = self._doc_to_calendar_event(doc)
        doc_ref.delete()
        log_db_operation(
            logger,
            action="delete",
            resource_type="calendar_event",
            user_id=existing_event.user_id,
            resource_id=event_id
        )
        return True

    def _doc_to_calendar_event(self, doc) -> CalendarEvent:
        """Firestore 문서를 CalendarEvent 모델로 변환"""
        data = doc.to_dict()
        return CalendarEvent(
            id=doc.id,
            user_id=data["user_id"],
            title=data["title"],
            start_date=data["start_date"],
            end_date=data["end_date"],
            type=data["type"],
            source_event_id=data.get("source_event_id"),
            created_at=datetime.fromisoformat(data.get("created_at", datetime.now().isoformat())),
            updated_at=datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
            if data.get("updated_at")
            else None,
        )


_calendar_repository: Optional[CalendarRepository] = None


def get_calendar_repository() -> CalendarRepository:
    """캘린더 이벤트 저장소 인스턴스 가져오기 (Lazy initialization)"""
    global _calendar_repository
    if _calendar_repository is None:
        _calendar_repository = CalendarRepository()
    return _calendar_repository

