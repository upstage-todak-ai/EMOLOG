"""
알림 판단 및 생성 오케스트레이션 서비스

새로운 일기 작성 시점에서 알림 전송 여부를 판단하고 메시지를 생성합니다.
"""
from datetime import datetime
from typing import Optional, List, Dict
from langgraph.graph import StateGraph, END

from app.services.notification.notification_models import NotificationDecisionState
from app.services.notification.notification_judge import decide_notification
from app.services.notification.notification_writer import write_notification_message
from app.services.notification.notification_evaluator import evaluate_notification
from app.core.logging import get_logger

logger = get_logger(__name__)


def should_send_notification(
    new_diary_entry: Dict,
    diary_entries: List[Dict],
    calendar_events: List[Dict],
    messages: List[Dict],
    current_time: Optional[str] = None
) -> Dict:
    """
    새로운 일기 작성 시점에서 알림 전송 여부를 판단합니다.
    
    Args:
        new_diary_entry: 방금 작성된 새로운 일기 (extractor로 분석된 결과 포함)
            {"content": "...", "datetime": "...", "topic": "...", "emotion": "..."}
        diary_entries: 과거 일기 항목 리스트 (extractor로 분석된 결과)
            [{"date": "...", "content": "...", "topic": "...", "emotion": "..."}]
        calendar_events: 캘린더 이벤트 리스트
            [{"date": "...", "title": "...", "type": "..."}]
        messages: 사용자가 직접 작성한 원본 메시지 리스트
            [{"content": "...", "datetime": "..."}]
        current_time: 현재 시간 (선택, 기본값: 현재 시간)
    
    Returns:
        {
            "should_send": bool,
            "send_time": str (YYYY-MM-DD HH:MM:SS),
            "message": str (알림 메시지),
            "reason": str (판단 사유),
            "evaluation_score": float (0.0 ~ 1.0)
        }
    """
    if current_time is None:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 초기 State 생성
    initial_state: NotificationDecisionState = {
        "current_time": current_time,
        "calendar_events": calendar_events,
        "diary_entries": diary_entries,
        "messages": messages,
        "new_diary_entry": new_diary_entry,
        "should_send": None,
        "send_time": None,
        "message": None,
        "reason": None,
        "evaluation_score": None
    }
    
    # 그래프 구성
    workflow = StateGraph(NotificationDecisionState)
    
    # 노드 추가
    workflow.add_node("decide_notification", decide_notification)
    workflow.add_node("write_notification", write_notification_message)
    
    # 엣지 추가
    workflow.set_entry_point("decide_notification")
    workflow.add_edge("decide_notification", "write_notification")
    workflow.add_edge("write_notification", END)
    
    # 그래프 컴파일 및 실행
    app = workflow.compile()
    result = app.invoke(initial_state)
    
    # 평가 수행
    evaluation = evaluate_notification(result)
    result["evaluation_score"] = evaluation["score"]
    
    logger.info(f"[should_send_notification] 판단 완료 - 전송: {result['should_send']}, 점수: {evaluation['score']:.2f}")
    
    return {
        "should_send": result["should_send"],
        "send_time": result["send_time"],
        "message": result["message"],
        "reason": result["reason"],
        "evaluation_score": result["evaluation_score"]
    }


def generate_notification_message(
    should_send: bool,
    send_time: str,
    reason: str,
    diary_entries: List[Dict],
    calendar_events: List[Dict]
) -> str:
    """
    알림 메시지를 생성합니다. (별도 호출용)
    
    Args:
        should_send: 알림 전송 여부
        send_time: 전송 시간
        reason: 판단 사유
        diary_entries: 일기 항목 리스트
        calendar_events: 캘린더 이벤트 리스트
    
    Returns:
        알림 메시지 문자열
    """
    if not should_send:
        return None
    
    # State 생성 (최소한의 정보만)
    state: NotificationDecisionState = {
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "calendar_events": calendar_events,
        "diary_entries": diary_entries,
        "messages": [],
        "new_diary_entry": {},
        "should_send": True,
        "send_time": send_time,
        "message": None,
        "reason": reason,
        "evaluation_score": None
    }
    
    # 메시지 작성
    result = write_notification_message(state)
    return result["message"]
