"""
리포트 데이터 저장소 (Repository Pattern)

Firestore를 사용하여 리포트 데이터를 저장하고 조회합니다.
"""
from typing import List, Optional
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
from app.core.firebase import get_db
from app.core.logging import get_logger, log_db_operation

COLLECTION_NAME = "reports"

logger = get_logger(__name__)


class ReportRepository:
    """리포트 데이터 저장소 클래스"""
    
    def __init__(self):
        try:
            self.db = get_db()
            if self.db is None:
                raise ValueError("Firebase가 초기화되지 않았습니다. 환경 변수를 설정해주세요.")
            self.collection = self.db.collection(COLLECTION_NAME)
        except Exception as e:
            raise ValueError(f"Firestore 연결 실패: {str(e)}. Firebase 설정을 확인해주세요.")
    
    def create(self, user_id: str, report: str, summary: str, period_start: str, period_end: str, insights: List[dict], eval_score: float, attempt: int, emotion_changes: Optional[List[dict]] = None) -> dict:
        """
        리포트 생성
        
        Args:
            user_id: 사용자 ID
            report: 리포트 내용
            summary: 리포트 요약
            period_start: 리포트 기간 시작일
            period_end: 리포트 기간 종료일
            insights: 인사이트 리스트
            eval_score: 평가 점수
            attempt: 시도 횟수
            emotion_changes: 감정 변화 리스트 (선택)
        
        Returns:
            생성된 리포트 딕셔너리 (id 포함)
        """
        report_dict = {
            "user_id": user_id,
            "report": report,
            "summary": summary,
            "period_start": period_start,
            "period_end": period_end,
            "insights": insights,
            "eval_score": eval_score,
            "attempt": attempt,
            "created_at": datetime.now().isoformat(),
        }
        
        if emotion_changes is not None:
            report_dict["emotion_changes"] = emotion_changes
        
        update_time, doc_ref = self.collection.add(report_dict)
        
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"리포트 생성 실패 - user_id={user_id}")
            raise ValueError("리포트 생성에 실패했습니다.")
        
        report_id = doc.id
        report_dict["id"] = report_id
        
        log_db_operation(
            logger,
            action="create",
            resource_type="report",
            user_id=user_id,
            resource_id=report_id,
            content_len=len(report),
        )
        
        return report_dict
    
    def get_by_id(self, report_id: str) -> Optional[dict]:
        """ID로 리포트 조회"""
        doc_ref = self.collection.document(report_id)
        doc = doc_ref.get()
        if not doc.exists:
            logger.debug(f"리포트 조회 실패 (존재하지 않음) - report_id={report_id}")
            return None
        
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    
    def get_by_user_id(self, user_id: str, limit: Optional[int] = None) -> List[dict]:
        """사용자 ID로 리포트 목록 조회 (최신순)"""
        logger.info(f"[get_by_user_id] 리포트 목록 조회 시작 - user_id={user_id}, limit={limit}")
        try:
            # order_by 없이 먼저 필터링
            query = self.collection.where(
                filter=FieldFilter("user_id", "==", user_id)
            )
            
            if limit:
                query = query.limit(limit)
            
            docs = query.stream()
            reports = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                reports.append(data)
            
            logger.info(f"[get_by_user_id] Firestore 쿼리 결과 - 조회된 리포트 수: {len(reports)}개")
            
            # 메모리에서 정렬 (created_at 기준 내림차순)
            reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            if limit:
                reports = reports[:limit]
            
            log_db_operation(
                logger,
                action="list",
                resource_type="report",
                user_id=user_id,
                resource_id=None,
            )
            
            if len(reports) == 0:
                logger.warning(f"[get_by_user_id] user_id={user_id}에 대한 리포트가 없습니다. Firestore에 해당 user_id로 저장된 리포트가 있는지 확인하세요.")
            
            return reports
        except Exception as e:
            logger.error(f"[get_by_user_id] 리포트 조회 실패: {e}", exc_info=True)
            raise
    
    def get_latest_by_user_id(self, user_id: str) -> Optional[dict]:
        """사용자의 최신 리포트 조회"""
        logger.info(f"[get_latest_by_user_id] 리포트 조회 시작 - user_id={user_id}")
        reports = self.get_by_user_id(user_id, limit=1)
        if reports:
            logger.info(f"[get_latest_by_user_id] 리포트 조회 성공 - user_id={user_id}, report_id={reports[0].get('id', 'unknown')}")
            return reports[0]
        else:
            logger.warning(f"[get_latest_by_user_id] 리포트 없음 - user_id={user_id}에 대한 리포트가 없습니다.")
            return None
    
    def get_older_than(self, user_id: str, created_at: str) -> Optional[dict]:
        """
        특정 created_at보다 오래된 리포트 조회 (이전 리포트)
        
        Args:
            user_id: 사용자 ID
            created_at: 기준 created_at (ISO 형식)
        
        Returns:
            바로 이전 리포트 (없으면 None)
        """
        try:
            # 모든 리포트 가져오기
            reports = self.get_by_user_id(user_id)
            
            # created_at 기준으로 정렬된 상태에서, 기준보다 오래된 것 중 가장 최신 것 찾기
            for report in reports:
                report_created_at = report.get("created_at", "")
                if report_created_at and report_created_at < created_at:
                    return report
            
            return None
        except Exception as e:
            logger.error(f"[get_older_than] 이전 리포트 조회 실패: {e}", exc_info=True)
            raise


# 싱글톤 패턴으로 저장소 인스턴스 관리
_report_repository = None


def get_report_repository():
    """
    리포트 저장소 인스턴스 가져오기 (Lazy initialization)
    
    Firebase가 설정되지 않은 경우에도 서버가 시작되도록 
    lazy initialization을 사용합니다.
    """
    global _report_repository
    if _report_repository is None:
        try:
            _report_repository = ReportRepository()
        except ValueError:
            # Firebase 미설정 시 ValueError 발생
            # 이 경우 None을 반환하지 않고 예외를 그대로 전파
            # 호출하는 쪽에서 처리하도록 함
            raise
    return _report_repository
