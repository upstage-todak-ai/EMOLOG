"""
일기 데이터 저장소 (Repository Pattern)

Firestore를 사용하여 일기 데이터를 저장하고 조회합니다.
"""
from typing import List, Optional
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1 import Query
from app.core.firebase import get_db
from app.models.schemas import DiaryEntry, DiaryEntryCreate, DiaryEntryUpdate
from app.core.logging import get_logger, log_db_operation
from fastapi import HTTPException

COLLECTION_NAME = "diaries"

logger = get_logger(__name__)


class DiaryRepository:
    """일기 데이터 저장소 클래스"""
    
    def __init__(self):
        try:
            self.db = get_db()
            if self.db is None:
                raise ValueError("Firebase가 초기화되지 않았습니다. 환경 변수를 설정해주세요.")
            self.collection = self.db.collection(COLLECTION_NAME)
        except Exception as e:
            raise ValueError(f"Firestore 연결 실패: {str(e)}. Firebase 설정을 확인해주세요.")
    
    def create(self, diary: DiaryEntryCreate) -> DiaryEntry:
        """
        일기 생성
        
        Bug Fix: collection.add() returns (update_time, document_reference)
        NOT (generated_id, document_reference)
        The document ID must be obtained from document_reference.id
        """
        # emotion이 None이면 에러 (extractor에서 추출되어야 함)
        if diary.emotion is None:
            raise ValueError("emotion이 설정되지 않았습니다. extractor로 추출해야 합니다.")
        
        diary_dict = {
            "user_id": diary.user_id,
            "date": diary.date.isoformat() if isinstance(diary.date, datetime) else diary.date,
            "content": diary.content,
            "emotion": diary.emotion.value,
            "topic": diary.topic if diary.topic else "",  # topic 저장
            "created_at": datetime.now().isoformat(),
        }
        
        # ✅ FIXED: collection.add() returns (update_time, document_reference)
        # The update_time is a Timestamp object, not the document ID
        # The document ID must be obtained from document_reference.id
        update_time, doc_ref = self.collection.add(diary_dict)
        
        # Fetch the document to verify it was created and return it
        # The document ID will be extracted in _doc_to_diary_entry() from doc.id
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"일기 생성 실패 - user_id={diary.user_id}")
            raise HTTPException(status_code=500, detail="일기 생성에 실패했습니다.")
        
        created_entry = self._doc_to_diary_entry(doc)
        log_db_operation(
            logger,
            action="create",
            resource_type="diary",
            user_id=diary.user_id,
            resource_id=created_entry.id,
            content_len=len(diary.content),
            emotion=diary.emotion.value
        )
        return created_entry
    
    def get_by_id(self, diary_id: str) -> Optional[DiaryEntry]:
        """ID로 일기 조회"""
        doc_ref = self.collection.document(diary_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"일기 조회 실패 (존재하지 않음) - diary_id={diary_id}")
            return None
        entry = self._doc_to_diary_entry(doc)
        log_db_operation(
            logger,
            action="get",
            resource_type="diary",
            user_id=entry.user_id,
            resource_id=diary_id
        )
        return entry
    
    def get_by_user_id(self, user_id: str) -> List[DiaryEntry]:
        """사용자 ID로 일기 목록 조회"""
        logger.info(f"[get_by_user_id] 일기 조회 시작 - user_id={user_id}")
        # 인덱스 없이도 동작하도록 필터링만 하고, 정렬은 메모리에서 수행
        query = self.collection.where(
            filter=FieldFilter("user_id", "==", user_id)
        )
        docs = query.stream()
        diaries = [self._doc_to_diary_entry(doc) for doc in docs]
        logger.info(f"[get_by_user_id] Firestore 쿼리 결과 - 조회된 일기 수: {len(diaries)}개")
        # 메모리에서 날짜 기준 내림차순 정렬 (최신순)
        # date는 ISO 형식 문자열이므로 문자열 비교로 정렬 가능
        diaries.sort(key=lambda x: x.date, reverse=True)
        log_db_operation(
            logger,
            action="get_list",
            resource_type="diary",
            user_id=user_id,
            count=len(diaries)
        )
        if len(diaries) == 0:
            logger.warning(f"[get_by_user_id] user_id={user_id}에 대한 일기가 없습니다. Firestore에 해당 user_id로 저장된 일기가 있는지 확인하세요.")
        return diaries
    
    def update(self, diary_id: str, updates: DiaryEntryUpdate) -> Optional[DiaryEntry]:
        """일기 수정"""
        doc_ref = self.collection.document(diary_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"일기 수정 실패 (존재하지 않음) - diary_id={diary_id}")
            return None
        
        existing_entry = self._doc_to_diary_entry(doc)
        update_dict = {}
        if updates.content is not None:
            update_dict["content"] = updates.content
        if updates.emotion is not None:
            update_dict["emotion"] = updates.emotion.value
        if updates.topic is not None:
            update_dict["topic"] = updates.topic
        
        if not update_dict:
            # 수정할 내용이 없으면 기존 문서 반환
            return existing_entry
        
        update_dict["updated_at"] = datetime.now().isoformat()
        doc_ref.update(update_dict)
        
        # 업데이트된 문서 가져오기
        updated_doc = doc_ref.get()
        updated_entry = self._doc_to_diary_entry(updated_doc)
        log_db_operation(
            logger,
            action="update",
            resource_type="diary",
            user_id=existing_entry.user_id,
            resource_id=diary_id,
            content_len=len(updates.content) if updates.content else None,
            emotion=updates.emotion.value if updates.emotion else None
        )
        return updated_entry
    
    def delete(self, diary_id: str) -> bool:
        """일기 삭제"""
        doc_ref = self.collection.document(diary_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"일기 삭제 실패 (존재하지 않음) - diary_id={diary_id}")
            return False
        existing_entry = self._doc_to_diary_entry(doc)
        doc_ref.delete()
        log_db_operation(
            logger,
            action="delete",
            resource_type="diary",
            user_id=existing_entry.user_id,
            resource_id=diary_id
        )
        return True
    
    def _doc_to_diary_entry(self, doc) -> DiaryEntry:
        """Firestore 문서를 DiaryEntry 모델로 변환"""
        data = doc.to_dict()
        doc_id = doc.id  # Document ID from Firestore
        return DiaryEntry(
            id=doc_id,
            user_id=data["user_id"],
            date=data["date"],
            content=data["content"],
            emotion=data["emotion"],
            topic=data.get("topic", ""),  # topic 읽기 (기존 데이터 호환성)
            created_at=datetime.fromisoformat(data.get("created_at", datetime.now().isoformat())),
        )


# 싱글톤 패턴으로 저장소 인스턴스 관리
_diary_repository = None


def get_diary_repository():
    """
    일기 저장소 인스턴스 가져오기 (Lazy initialization)
    
    Firebase가 설정되지 않은 경우에도 서버가 시작되도록 
    lazy initialization을 사용합니다.
    """
    global _diary_repository
    if _diary_repository is None:
        try:
            _diary_repository = DiaryRepository()
        except ValueError:
            # Firebase 미설정 시 ValueError 발생
            # 이 경우 None을 반환하지 않고 예외를 그대로 전파
            # 호출하는 쪽에서 처리하도록 함
            raise
    return _diary_repository
