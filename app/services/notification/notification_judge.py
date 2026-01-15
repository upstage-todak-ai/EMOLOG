"""
알림 전송 여부 판단 로직

새로운 일기 작성 시점에서 과거 일기, 캘린더 이벤트, 메시지를 종합하여
회고를 유도하기 위한 알림 전송 여부를 판단합니다.
"""
from datetime import datetime, timedelta
from typing import Optional
import json
import re

from app.services.notification.notification_models import NotificationDecisionState
from app.services.notification.notification_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


def decide_notification(state: NotificationDecisionState) -> NotificationDecisionState:
    """
    알림 여부 결정 노드 - 모든 일기/메시지를 종합하여 LLM으로 판단
    
    Args:
        state: NotificationDecisionState
    
    Returns:
        업데이트된 NotificationDecisionState (should_send, send_time, reason 포함)
    """
    current_time = datetime.fromisoformat(state["current_time"])
    
    # 새로운 일기 정보 (extractor로 분석된 결과 포함)
    new_entry = state["new_diary_entry"]
    new_content = new_entry.get("content", "") if isinstance(new_entry, dict) else ""
    new_datetime = new_entry.get("datetime", state["current_time"]) if isinstance(new_entry, dict) else state["current_time"]
    new_entry_time = datetime.fromisoformat(new_datetime) if isinstance(new_datetime, str) else current_time
    new_topic = new_entry.get("topic", "") if isinstance(new_entry, dict) else ""
    new_emotion = new_entry.get("emotion", "") if isinstance(new_entry, dict) else ""
    
    # 오늘의 달력 이벤트
    today = current_time.date()
    today_events = [
        event for event in state["calendar_events"]
        if datetime.fromisoformat(event["date"]).date() == today
    ]
    
    # 과거 메시지들을 요약 (최근 N개만 포함하여 프롬프트 길이 제한)
    recent_messages = state["messages"][-10:] if len(state["messages"]) > 10 else state["messages"]
    past_messages_summary = "\n".join([
        f"- {msg.get('datetime', '')}: {msg.get('content', '')[:80]}"
        for msg in recent_messages
    ]) if recent_messages else "없음"
    
    # 일기 항목 요약 (extractor로 분석된 결과이므로 topic, emotion 포함)
    diary_summary = "\n".join([
        f"- {entry.get('date', '')}: [{entry.get('topic', 'N/A')}] [{entry.get('emotion', 'N/A')}] - {entry.get('content', '')[:50]}"
        for entry in state["diary_entries"][-5:]  # 최근 5개만
    ]) if state["diary_entries"] else "없음"
    
    # LLM 호출을 위한 프롬프트 구성
    prompt = f"""사용자가 새로운 일기를 작성했습니다. 과거의 모든 일기와 메시지를 종합하여 회고를 유도하기 위한 알림 전송 여부를 판단하고 JSON으로 응답하세요.

=== 새로운 일기 (분석 결과 포함) ===
내용: {new_content}
주제: {new_topic}
감정: {new_emotion}
작성 시간: {new_entry_time.strftime('%Y-%m-%d %H:%M:%S')}

=== 현재 상황 ===
현재 시간: {current_time.strftime('%Y-%m-%d %H:%M:%S')}
오늘의 달력 이벤트: {len(today_events)}개
  {chr(10).join([f"- {e.get('title', '')} ({e.get('date', '')})" for e in today_events[:3]])}

=== 과거 원본 메시지 (최근 {len(recent_messages)}개) ===
{past_messages_summary}

=== 분석된 일기 항목 (최근 5개, extractor로 분석됨) ===
{diary_summary}

=== 판단 기준 ===
1. 새로운 일기가 작성된 시점에서 과거 일기들을 종합적으로 고려
2. 회고를 유도할 만한 적절한 타이밍을 생각하세요. 다음 상황에서는 회고 유도가 좋습니다:
   - 불안하거나 스트레스가 많은 이벤트(회의, 발표, 면접 등)가 끝난 직후
   - 힘든 일이 있어서 아무것도 못하고 있을 때 (부정적 감정이 지속되는 경우)
   - 캘린더에 중요한 이벤트가 있었고, 그 이벤트가 끝난 후
   - 과거 일기에서 비슷한 패턴(같은 주제, 같은 감정)이 반복될 때
   - 감정 변화가 큰 시점 (부정적 → 긍정적, 또는 그 반대)
3. 사용자의 감정 상태와 일기 패턴을 고려

JSON 형식:
{{
  "should_send": true/false,
  "send_time": "YYYY-MM-DD HH:MM:SS",
  "reason": "판단 사유 (모든 일기를 종합한 근거 포함)"
}}"""
    
    try:
        # LLM 호출
        chat = get_chat_llm()
        response = chat.invoke(prompt)
        
        # JSON 파싱
        response_text = response.content.strip()
        
        # JSON 부분만 추출 (```json ... ``` 또는 {...} 형식)
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        # 첫 번째 JSON 객체만 추출 (중괄호로 시작하는 부분)
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
        should_send = result_json.get("should_send", False)
        send_time = result_json.get("send_time", current_time.strftime("%Y-%m-%d %H:%M:%S"))
        reason = result_json.get("reason", "판단 완료")
        
    except Exception as e:
        logger.error(f"[decide_notification] JSON 파싱 실패: {e}")
        logger.error(f"[decide_notification] 원본 응답: {response.content[:200]}...")
        # 기본값 사용
        should_send = False
        send_time = (current_time + timedelta(days=1)).replace(hour=9, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
        reason = "JSON 파싱 실패로 인한 기본값"
    
    state["should_send"] = should_send
    state["send_time"] = send_time
    state["reason"] = reason
    
    logger.info(f"[decide_notification] 알림 전송: {should_send}, 전송 시간: {send_time}")
    if should_send:
        logger.info(f"[decide_notification] 사유: {reason}")
    
    return state
