"""
리포트 작성 서비스

LangGraph를 사용하여 일주일치 일기 데이터를 분석하여 리포트를 작성하는 서비스
"""
from datetime import datetime, timedelta
from typing import TypedDict, Optional, List
from langgraph.graph import StateGraph, END
import json
from langchain_upstage import ChatUpstage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 전역 변수: 컴파일된 그래프 (한 번만 컴파일)
_report_graph = None
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
        logger.info("Report LLM 초기화 완료")
    return _chat_llm


# State 정의
class ReportGenerationState(TypedDict):
    """리포트 생성 에이전트의 State"""
    diary_entries: List[dict]  # extractor로 분석된 일기 항목들 [{"date": "...", "content": "...", "topic": "...", "emotion": "..."}]
    period_start: str  # 리포트 기간 시작일 "YYYY-MM-DD"
    period_end: str  # 리포트 기간 종료일 "YYYY-MM-DD"
    report: Optional[str]  # 생성된 리포트 내용
    summary: Optional[str]  # 리포트 요약


# 노드 함수 정의
def analyze_diary_data(state: ReportGenerationState) -> ReportGenerationState:
    """일기 데이터 분석 노드 - 일주일치 데이터를 분석"""
    diary_entries = state["diary_entries"]
    period_start = state["period_start"]
    period_end = state["period_end"]
    
    logger.debug(f"[analyze_diary_data] 일기 데이터 분석 중...")
    logger.debug(f"  - 리포트 기간: {period_start} ~ {period_end}")
    logger.debug(f"  - 일기 항목 수: {len(diary_entries)}개")
    
    # 감정별 통계
    emotions = [entry.get("emotion", "") for entry in diary_entries if entry.get("emotion")]
    emotion_counts = {}
    for emotion in emotions:
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
    
    # 주제별 통계
    topics = [entry.get("topic", "") for entry in diary_entries if entry.get("topic")]
    topic_counts = {}
    for topic in topics:
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
    
    logger.debug(f"  - 감정 분포: {emotion_counts}")
    logger.debug(f"  - 주요 주제: {dict(sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:5])}")
    
    return state


def generate_report(state: ReportGenerationState) -> ReportGenerationState:
    """리포트 생성 노드 - LLM을 사용하여 리포트 작성"""
    diary_entries = state["diary_entries"]
    period_start = state["period_start"]
    period_end = state["period_end"]
    
    # 일기 데이터를 날짜순으로 정렬
    sorted_entries = sorted(diary_entries, key=lambda x: x.get("date", ""))
    
    # 일기 데이터 요약 (최대 20개)
    entries_summary = "\n".join([
        f"- {entry.get('date', '')}: [{entry.get('topic', 'N/A')}] [{entry.get('emotion', 'N/A')}] {entry.get('content', '')[:50]}"
        for entry in sorted_entries[-20:]  # 최근 20개
    ]) if sorted_entries else "일기 데이터 없음"
    
    # 감정 통계
    emotions = [entry.get("emotion", "") for entry in diary_entries if entry.get("emotion")]
    emotion_counts = {}
    for emotion in emotions:
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
    
    # 주제 통계
    topics = [entry.get("topic", "") for entry in diary_entries if entry.get("topic")]
    topic_counts = {}
    for topic in topics:
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
    
    # 주요 주제 상위 5개
    top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    try:
        chat = _get_chat_llm()
        
        # LLM 호출을 위한 프롬프트 구성
        prompt = f"""일주일간의 일기 데이터를 분석하여 리포트를 작성하세요.

=== 리포트 기간 ===
시작일: {period_start}
종료일: {period_end}
일기 항목 수: {len(diary_entries)}개

=== 일기 데이터 ===
{entries_summary}

=== 통계 정보 ===
감정 분포: {emotion_counts}
주요 주제 (상위 5개): {top_topics}

=== 리포트 작성 지침 ===
1. 이번 주 동안의 주요 감정 변화와 패턴을 분석
2. 자주 나타난 주제와 그 의미를 설명
3. 전반적인 감정 상태와 웰빙에 대한 통찰 제공
4. 간결하고 읽기 쉬운 형식으로 작성
5. 개인적인 톤으로 작성 (너무 딱딱하지 않게)

JSON 형식:
{{
  "report": "리포트 전체 내용 (3-5 문단)",
  "summary": "한 문장 요약"
}}"""
        
        # LLM 호출
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
        
        # 첫 번째 JSON 객체만 추출
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
        state["report"] = result_json.get("report", "")
        state["summary"] = result_json.get("summary", "")
        
        logger.info(f"[generate_report] 리포트 생성 완료 - summary={state['summary'][:50]}...")
        
    except json.JSONDecodeError as e:
        logger.error(f"[generate_report] JSON 파싱 실패: {e}")
        logger.debug(f"[generate_report] 원본 응답: {response.content[:200] if 'response' in locals() else 'N/A'}...")
        # 기본값 사용
        state["report"] = "리포트 생성 실패"
        state["summary"] = "리포트 생성에 실패했습니다"
    except Exception as e:
        logger.error(f"[generate_report] 리포트 생성 실패: {e}", exc_info=True)
        # 기본값 사용
        state["report"] = "리포트 생성 실패"
        state["summary"] = "리포트 생성에 실패했습니다"
    
    return state


def _get_report_graph():
    """컴파일된 그래프를 가져옵니다 (지연 초기화)"""
    global _report_graph
    if _report_graph is None:
        # StateGraph 생성
        workflow = StateGraph(ReportGenerationState)
        
        # 노드 추가
        workflow.add_node("analyze_diary_data", analyze_diary_data)
        workflow.add_node("generate_report", generate_report)
        
        # 엣지 추가 - 단순 선형 흐름
        workflow.set_entry_point("analyze_diary_data")
        workflow.add_edge("analyze_diary_data", "generate_report")
        workflow.add_edge("generate_report", END)
        
        # 그래프 컴파일
        _report_graph = workflow.compile()
        logger.info("Report 그래프 컴파일 완료")
    
    return _report_graph


def generate_weekly_report(
    diary_entries: List[dict],
    period_start: Optional[str] = None,
    period_end: Optional[str] = None
) -> dict:
    """
    일주일치 일기 데이터로 리포트를 생성하는 서비스 함수
    
    Args:
        diary_entries: extractor로 분석된 일기 항목 리스트
        period_start: 리포트 기간 시작일 (선택, 기본값: 일주일 전)
        period_end: 리포트 기간 종료일 (선택, 기본값: 오늘)
    
    Returns:
        리포트 딕셔너리 (report, summary, period_start, period_end 포함)
    
    Raises:
        ValueError: UPSTAGE_API_KEY가 설정되지 않은 경우
    """
    if period_end is None:
        period_end = datetime.now().strftime("%Y-%m-%d")
    if period_start is None:
        period_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # 그래프 가져오기
    graph = _get_report_graph()
    
    # 초기 state 생성
    initial_state: ReportGenerationState = {
        "diary_entries": diary_entries,
        "period_start": period_start,
        "period_end": period_end,
        "report": None,
        "summary": None
    }
    
    # 그래프 실행
    result = graph.invoke(initial_state)
    
    return {
        "report": result.get("report", ""),
        "summary": result.get("summary", ""),
        "period_start": result.get("period_start", period_start),
        "period_end": result.get("period_end", period_end)
    }
