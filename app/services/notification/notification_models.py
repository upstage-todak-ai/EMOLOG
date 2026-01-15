"""
알림 판단 및 생성 관련 모델 정의
"""
from typing import TypedDict, Optional, List
from datetime import datetime


class NotificationDecisionState(TypedDict):
    """알림 판단 에이전트의 State"""
    current_time: str  # "YYYY-MM-DD HH:mm:ss"
    calendar_events: List[dict]  # [{"date": "...", "title": "...", "type": "..."}]
    diary_entries: List[dict]  # extractor로 분석된 일기 항목 [{"date": "...", "content": "...", "topic": "...", "emotion": "..."}]
    messages: List[dict]  # 사용자가 직접 작성한 원본 메시지 [{"content": "...", "datetime": "..."}]
    new_diary_entry: dict  # 방금 작성된 새로운 일기 (extractor로 분석된 결과 포함)
    should_send: Optional[bool]  # 알림 전송 여부
    send_time: Optional[str]  # 알림 전송 시간 "YYYY-MM-DD HH:mm:ss"
    message: Optional[str]  # 알림 메시지
    reason: Optional[str]  # 판단 사유
    evaluation_score: Optional[float]  # 평가 점수 (0.0 ~ 1.0)


class NotificationEvaluationResult(TypedDict):
    """알림 평가 결과"""
    score: float  # 0.0 ~ 1.0
    criteria: dict  # 각 평가 기준별 점수
    passed: bool  # 통과 여부 (임계값 이상)
    feedback: str  # 피드백 메시지
