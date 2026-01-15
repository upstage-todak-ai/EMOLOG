"""
알림 평가 로직 (하드코딩)

알림 메시지의 품질과 적절성을 평가합니다.
"""
from app.services.notification.notification_models import NotificationDecisionState, NotificationEvaluationResult
from app.core.logging import get_logger

logger = get_logger(__name__)


def evaluate_notification(state: NotificationDecisionState) -> NotificationEvaluationResult:
    """
    알림 평가 함수 (하드코딩)
    
    평가 기준:
    1. 알림 전송 여부의 적절성 (should_send의 타당성)
    2. 메시지 길이 (30자 이내)
    3. 메시지 톤 (친근하고 따뜻한지)
    4. 전송 시간의 적절성 (적절한 시간대인지)
    
    Args:
        state: NotificationDecisionState
    
    Returns:
        NotificationEvaluationResult
    """
    score = 0.0
    criteria = {}
    
    # 1. should_send가 True인 경우에만 메시지가 있어야 함
    should_send = state.get("should_send", False)
    message = state.get("message")
    
    if should_send and message:
        criteria["has_message"] = 1.0
        score += 0.3
    elif not should_send and not message:
        criteria["has_message"] = 1.0
        score += 0.3
    else:
        criteria["has_message"] = 0.0
    
    # 2. 메시지 길이 체크 (30자 이내)
    if message:
        message_length = len(message)
        if message_length <= 30:
            criteria["message_length"] = 1.0
            score += 0.3
        elif message_length <= 50:
            criteria["message_length"] = 0.5
            score += 0.15
        else:
            criteria["message_length"] = 0.0
    else:
        criteria["message_length"] = 1.0 if not should_send else 0.0
    
    # 3. 전송 시간 체크 (9시~22시 사이)
    send_time_str = state.get("send_time")
    if send_time_str:
        from datetime import datetime
        try:
            send_time = datetime.fromisoformat(send_time_str)
            hour = send_time.hour
            if 9 <= hour <= 22:
                criteria["send_time_appropriate"] = 1.0
                score += 0.2
            elif 7 <= hour < 9 or 22 < hour <= 23:
                criteria["send_time_appropriate"] = 0.5
                score += 0.1
            else:
                criteria["send_time_appropriate"] = 0.0
        except Exception:
            criteria["send_time_appropriate"] = 0.5
            score += 0.1
    else:
        criteria["send_time_appropriate"] = 0.5
        score += 0.1
    
    # 4. 판단 사유가 있는지
    reason = state.get("reason", "")
    if reason and len(reason) > 10:
        criteria["has_reason"] = 1.0
        score += 0.2
    else:
        criteria["has_reason"] = 0.0
    
    # 정규화 (최대 1.0)
    score = min(score, 1.0)
    
    # 통과 여부 (0.6 이상)
    passed = score >= 0.6
    
    feedback = f"평가 점수: {score:.2f}/1.0 (기준: {'통과' if passed else '실패'})"
    
    result: NotificationEvaluationResult = {
        "score": score,
        "criteria": criteria,
        "passed": passed,
        "feedback": feedback
    }
    
    logger.info(f"[evaluate_notification] {feedback}")
    logger.debug(f"[evaluate_notification] 세부 기준: {criteria}")
    
    return result
