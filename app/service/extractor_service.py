"""
일기 정보 추출 서비스

LangGraph를 사용하여 일기에서 주제와 감정을 추출하는 서비스
"""
from datetime import datetime
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
import json
from langchain_upstage import ChatUpstage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 전역 변수: 컴파일된 그래프 (한 번만 컴파일)
_extractor_graph = None
_chat_llm = None


def _get_chat_llm() -> ChatUpstage:
    """LLM 인스턴스를 가져옵니다 (지연 초기화)"""
    global _chat_llm
    if _chat_llm is None:
        if not settings.UPSTAGE_API_KEY:
            raise ValueError("UPSTAGE_API_KEY가 설정되지 않았습니다.")
        _chat_llm = ChatUpstage(
            model="solar-pro2-251215",
            upstage_api_key=settings.UPSTAGE_API_KEY
        )
        logger.info("Extractor LLM 초기화 완료")
    return _chat_llm


# State 정의
class DiaryExtractionState(TypedDict):
    """일기 정보 추출 에이전트의 State"""
    diary_content: str  # 원본 일기 내용
    datetime: str  # 일기 작성 시간 "YYYY-MM-DD HH:mm:ss"
    topic: Optional[str]  # 추출된 주제 (예: "부장회의", "야식", "친구 약속")
    emotion: Optional[str]  # 추출된 감정 (예: "빡침", "슬픔", "기쁨", "걱정")


# 노드 함수 정의
def extract_info(state: DiaryExtractionState) -> DiaryExtractionState:
    """일기에서 주제, 감정, 키워드 등을 추출하는 노드"""
    diary_content = state["diary_content"]
    diary_datetime = state.get("datetime", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    logger.debug(f"[extract_info] 일기 정보 추출 중...")
    logger.debug(f"  - 일기 내용: {diary_content[:100]}...")
    logger.debug(f"  - 작성 시간: {diary_datetime}")
    
    try:
        chat = _get_chat_llm()
        
        # LLM 호출을 위한 프롬프트 구성 (간단하게 주제와 감정만)
        prompt = f"""사용자가 작성한 짧은 메모에서 주제와 감정만 추출하고 JSON으로 응답하세요.

일기 내용: {diary_content}

=== 추출 항목 ===
1. topic: 주요 주제나 사건 (예: "부장회의", "야식", "친구 약속")
   - 한 단어 또는 짧은 구로 표현
   
2. emotion: 감정 (예: "빡침", "화남", "슬픔", "기쁨", "걱정", "후회")
   - 비속어나 구어체 표현도 그대로 반영 (예: "빡침")

=== 예시 ===
입력: "아 부장 ㅅㅂ 화나네 회의때깨짐"
출력: {{"topic": "부장회의", "emotion": "빡침"}}

입력: "야식 먹어서 살찌겟네 ㅠ"
출력: {{"topic": "야식", "emotion": "후회"}}

JSON 형식:
{{
  "topic": "주제",
  "emotion": "감정"
}}"""
        
        # LLM 호출
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
        
        result_json = json.loads(response_text)
        state["topic"] = result_json.get("topic", "")
        state["emotion"] = result_json.get("emotion", "")
        
        logger.info(f"[extract_info] 추출 완료 - topic={state['topic']}, emotion={state['emotion']}")
        
    except json.JSONDecodeError as e:
        logger.error(f"[extract_info] JSON 파싱 실패: {e}")
        logger.debug(f"[extract_info] 원본 응답: {response.content[:200] if 'response' in locals() else 'N/A'}...")
        # 기본값 사용
        state["topic"] = ""
        state["emotion"] = ""
    except Exception as e:
        logger.error(f"[extract_info] 추출 실패: {e}", exc_info=True)
        # 기본값 사용
        state["topic"] = ""
        state["emotion"] = ""
    
    return state


def _get_extractor_graph():
    """컴파일된 그래프를 가져옵니다 (지연 초기화)"""
    global _extractor_graph
    if _extractor_graph is None:
        # StateGraph 생성
        workflow = StateGraph(DiaryExtractionState)
        
        # 노드 추가
        workflow.add_node("extract_info", extract_info)
        
        # 엣지 추가 - 단순 선형 흐름
        workflow.set_entry_point("extract_info")
        workflow.add_edge("extract_info", END)
        
        # 그래프 컴파일
        _extractor_graph = workflow.compile()
        logger.info("Extractor 그래프 컴파일 완료")
    
    return _extractor_graph


def extract_diary_info(diary_content: str, diary_datetime: Optional[str] = None) -> dict:
    """
    일기 내용에서 주제와 감정을 추출하는 서비스 함수
    
    Args:
        diary_content: 일기 원본 내용
        diary_datetime: 일기 작성 시간 (선택, 기본값: 현재 시간)
    
    Returns:
        추출된 정보 딕셔너리 (topic, emotion, datetime 포함)
    
    Raises:
        ValueError: UPSTAGE_API_KEY가 설정되지 않은 경우
    """
    if diary_datetime is None:
        diary_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 그래프 가져오기
    graph = _get_extractor_graph()
    
    # 초기 state 생성
    initial_state: DiaryExtractionState = {
        "diary_content": diary_content,
        "datetime": diary_datetime,
        "topic": None,
        "emotion": None
    }
    
    # 그래프 실행
    result = graph.invoke(initial_state)
    
    return {
        "topic": result.get("topic", ""),
        "emotion": result.get("emotion", ""),
        "datetime": result.get("datetime", diary_datetime)
    }
