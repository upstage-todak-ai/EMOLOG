"""
알림 메시지 작성 로직

알림 전송이 결정된 경우, 간단한 1줄 메시지를 작성합니다.
(판단은 이미 judge에서 완료했으므로, 여기서는 메시지만 생성)
"""
from datetime import datetime
import json
import re

from app.services.notification.notification_models import NotificationDecisionState
from app.services.notification.notification_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


def write_notification_message(state: NotificationDecisionState) -> NotificationDecisionState:
    """
    알림 메시지 작성 노드 - 간단한 1줄 메시지 생성
    
    판단(judge)에서 이미 회고할 만한 상황임을 판단했으므로,
    여기서는 "오늘 일정 어땠어요?" 같은 간단한 1줄 질문 메시지만 생성합니다.
    
    Args:
        state: NotificationDecisionState (should_send=True인 경우)
    
    Returns:
        업데이트된 NotificationDecisionState (message 포함)
    """
    if not state.get("should_send", False):
        state["message"] = None
        return state
    
    current_time = datetime.fromisoformat(state["current_time"])
    today = current_time.date()
    
    # 오늘의 달력 이벤트 확인 (간단한 참고용)
    today_events = [
        event for event in state["calendar_events"]
        if datetime.fromisoformat(event["date"]).date() == today
    ]
    
    # 간단한 1줄 메시지 생성
    prompt = f"""사용자에게 오늘 하루를 회고하도록 물어보는 간단한 알림 메시지를 1줄로 작성하세요.

=== 요구사항 ===
1. 반드시 1줄, 20자 이내
2. 친근하고 자연스러운 질문 형식
3. "오늘 일정 어땠어요?", "힘들지는 않았나요?", "오늘 하루 어떠셨어요?" 같은 톤
4. 간결하고 따뜻하게

예시:
- "오늘 일정 어땠어요?"
- "힘들지는 않았나요?"
- "오늘 하루 어떠셨어요?"
- "회고해볼 시간이에요"

JSON 형식:
{{
  "message": "알림 메시지 내용"
}}"""
    
    try:
        chat = get_chat_llm()
        response = chat.invoke(prompt)
        
        # JSON 파싱
        response_text = response.content.strip()
        
        # JSON 부분만 추출
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        if "{" in response_text:
            start_idx = response_text.find("{")
            brace_count = 0
            end_idx = start_idx
            
            for i in range(start_idx, len(response_text)):
                if response_text[i] == "{":
                    brace_count += 1
                elif response_text[i] == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
            
            response_text = response_text[start_idx:end_idx]
        
        # 유효하지 않은 제어 문자 제거
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
        result_json = json.loads(response_text)
        message = result_json.get("message", "오늘 하루 어떠셨어요?")
        
    except Exception as e:
        logger.error(f"[write_notification_message] JSON 파싱 실패: {e}")
        # 기본 메시지 사용
        message = "오늘 하루 어떠셨어요?"
    
    state["message"] = message
    logger.info(f"[write_notification_message] 알림 메시지: {message}")
    
    return state
