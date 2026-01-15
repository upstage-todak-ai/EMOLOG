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
_eval_graph = None
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
    insights: Optional[List[dict]]  # 추출된 인사이트 리스트 (날짜 참조 포함)
    report: Optional[str]  # 생성된 리포트 내용 (인사이트 기반)
    summary: Optional[str]  # 리포트 요약


class ReportEvaluationState(TypedDict):
    """리포트 평가 에이전트의 State"""
    report: str  # 평가할 리포트 내용
    diary_entries: List[dict]  # 원본 일기 데이터
    period_start: str  # 리포트 기간 시작일
    period_end: str  # 리포트 기간 종료일
    quality_score: Optional[float]  # 유용성/명확성 점수 (0.0 ~ 1.0)
    quality_feedback: Optional[str]  # quality 평가 피드백
    quality_issues: Optional[List[str]]  # quality 문제점 리스트
    safety_score: Optional[float]  # 안전성 점수 (0.0 ~ 1.0)
    safety_feedback: Optional[str]  # safety 평가 피드백
    safety_issues: Optional[List[str]]  # safety 문제점 리스트
    overall_score: Optional[float]  # 종합 점수
    is_acceptable: Optional[bool]  # 리포트 수용 가능 여부
    needs_revision: Optional[bool]  # 수정 필요 여부


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


def find_insights(state: ReportGenerationState) -> ReportGenerationState:
    """인사이트 추출 노드 - 패턴과 관계만 추론 (날짜 참조 포함)"""
    diary_entries = state["diary_entries"]
    period_start = state["period_start"]
    period_end = state["period_end"]
    
    # 일기 데이터를 날짜순으로 정렬
    sorted_entries = sorted(diary_entries, key=lambda x: x.get("date", ""))
    
    # 일기 데이터 전체 제공 (날짜, 주제, 감정, 내용 요약 포함)
    entries_summary = "\n".join([
        f"날짜: {entry.get('date', 'N/A')} | 주제: {entry.get('topic', 'N/A')} | 감정: {entry.get('emotion', 'N/A')} | 내용: {entry.get('content', '')[:100]}"
        for entry in sorted_entries
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
        
        # LLM 호출을 위한 프롬프트 구성 - 인사이트만 추출
        prompt = f"""당신은 일기 데이터를 분석하여 검증 가능한 인사이트(패턴과 관계)만 추출하는 전문가입니다.
        
**중요**: 문장을 작성하지 마세요. 인사이트만 추출하세요.

=== 리포트 기간 ===
시작일: {period_start}
종료일: {period_end}
일기 항목 수: {len(diary_entries)}개

=== 전체 일기 데이터 (날짜순 정렬) ===
{entries_summary}

=== 통계 정보 ===
감정 분포: {emotion_counts}
주요 주제 (상위 5개): {top_topics}

=== 핵심 원칙 ===
1. **반드시 구체적인 날짜와 실제 일기 내용을 참조**하여 패턴을 추론하세요
2. **시간 흐름을 명확히 분석**: 사건 전/후의 감정 변화, 반복되는 패턴
3. **검증 가능한 인사이트만 제공**: "전날에는 걱정했는데 다음날에는 평화롭더라" 같은 구체적 관찰
4. **일반적이고 모호한 표현 금지**: "걱정이 여러 번 나타났다" (X) → "12월 15일 시험 전날에는 불안했지만, 12월 16일 시험 후에는 평온했다" (O)

=== 분석 필수 요소 ===
1. **시간 기반 패턴**: 특정 날짜/사건 전후의 감정 대비
2. **반복성**: 유사한 패턴이 반복되는지 여부
3. **관계 추론**: 날짜 간, 사건 간, 감정 간의 인과관계나 상관관계
4. **구체적 근거**: 각 인사이트마다 참조한 날짜와 일기 내용 요약

=== 인사이트 추출 지침 ===
- 단순 통계 나열 금지: "불안이 3번 나타났다" (X)
- 패턴 발견 필수: "중요 일정(12/15 시험) 전날마다 불안이 증가했지만, 당일 이후에는 안정화되는 패턴" (O)
- 날짜 기반 추론: "12월 10일과 12월 20일 두 번의 시험 모두 전날 불안, 당일 이후 평온" (O)
- 구체적 대비: "12월 14일(불안)과 12월 16일(평온)의 감정 대비" (O)
- 각 인사이트는 반드시 1개 이상의 날짜를 참조해야 함

=== 출력 JSON 형식 (반드시 준수) ===
{{
  "insights": [
    {{
      "type": "time_contrast" | "repetition" | "causal_relation",
      "description": "구체적인 패턴 설명 (날짜와 감정 변화 명시)",
      "date_references": ["YYYY-MM-DD", "YYYY-MM-DD"],
      "evidence": "참조한 일기 내용의 핵심 키워드"
    }}
  ]
}}

예시:
{{
  "insights": [
    {{
      "type": "time_contrast",
      "description": "12월 15일 시험 전날(12/14)에는 불안이 높았지만, 시험 이후(12/16)에는 평온으로 전환",
      "date_references": ["2025-12-14", "2025-12-16"],
      "evidence": "시험 전 불안, 시험 후 안정"
    }},
    {{
      "type": "repetition",
      "description": "중요 일정 전날(12/10, 12/20)에 불안이 반복적으로 증가하는 패턴",
      "date_references": ["2025-12-10", "2025-12-20"],
      "evidence": "두 시험 전날 모두 불안 감정"
    }}
  ]
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
        
        # insights 추출 및 검증
        insights = result_json.get("insights", [])
        if insights:
            logger.info(f"[find_insights] 추출된 인사이트 개수: {len(insights)}개")
            for idx, insight in enumerate(insights, 1):
                insight_type = insight.get("type", "unknown")
                date_refs = insight.get("date_references", [])
                logger.info(f"[find_insights] 인사이트 {idx}: type={insight_type}, 날짜 참조={date_refs}, 설명={insight.get('description', '')[:60]}...")
            
            # 모든 날짜 참조 수집
            all_date_refs = []
            for insight in insights:
                all_date_refs.extend(insight.get("date_references", []))
            logger.info(f"[find_insights] 전체 날짜 참조: {sorted(set(all_date_refs))}")
        else:
            logger.warning(f"[find_insights] insights가 추출되지 않았습니다.")
        
        state["insights"] = insights
        logger.info(f"[find_insights] 인사이트 추출 완료")
        
    except json.JSONDecodeError as e:
        logger.error(f"[find_insights] JSON 파싱 실패: {e}")
        logger.debug(f"[find_insights] 원본 응답: {response.content[:200] if 'response' in locals() else 'N/A'}...")
        state["insights"] = []
    except Exception as e:
        logger.error(f"[find_insights] 인사이트 추출 실패: {e}", exc_info=True)
        state["insights"] = []
    
    return state


def write_report(state: ReportGenerationState) -> ReportGenerationState:
    """리포트 작성 노드 - 인사이트를 바탕으로 자연스러운 문장 작성"""
    insights = state.get("insights", [])
    period_start = state["period_start"]
    period_end = state["period_end"]
    
    if not insights:
        logger.warning(f"[write_report] 인사이트가 없어 기본 리포트 생성")
        state["report"] = "데이터를 분석할 충분한 인사이트를 찾지 못했습니다."
        state["summary"] = "인사이트 부족"
        return state
    
    try:
        chat = _get_chat_llm()
        
        # 인사이트를 JSON 문자열로 변환
        insights_json = json.dumps(insights, ensure_ascii=False, indent=2)
        
        # LLM 호출을 위한 프롬프트 구성 - 인사이트를 자연스러운 문장으로 변환
        prompt = f"""당신은 인사이트를 바탕으로 읽기 좋은 리포트 문장을 작성하는 전문가입니다.

=== 리포트 기간 ===
시작일: {period_start}
종료일: {period_end}

=== 추출된 인사이트 ===
{insights_json}

=== 작성 지침 ===
1. **인사이트를 자연스럽고 따뜻한 문장으로 변환**하세요
2. **날짜와 구체적 관찰을 포함**하세요 (인사이트의 date_references 활용)
3. **개인적이고 따뜻한 톤**을 유지하세요 ("~했어요", "~드네요" 등)
4. **3-5 문단** 정도의 길이로 작성하세요
5. **인사이트를 그대로 나열하지 말고**, 자연스러운 이야기 흐름으로 연결하세요

=== 금지 사항 ===
- 단정적 표현: "우울증", "치료 필요" 등 의학적 진단 금지
- 위험한 조언: "약을 먹어야 해", "자살" 등 금지
- 과잉조언: 필요 이상의 조언 금지
- 부정적 감정 과도 강조 금지

=== 출력 JSON 형식 ===
{{
  "report": "인사이트를 바탕으로 작성한 자연스러운 리포트 (3-5 문단, 날짜와 구체적 관찰 포함)",
  "summary": "가장 중요한 패턴 한 문장 요약"
}}"""
        
        # LLM 호출
        response = chat.invoke(prompt)
        response_text = response.content.strip()
        
        # JSON 추출
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
        
        result_json = json.loads(response_text)
        state["report"] = result_json.get("report", "")
        state["summary"] = result_json.get("summary", "")
        
        logger.info(f"[write_report] 리포트 작성 완료 - summary={state['summary'][:50]}...")
        
    except json.JSONDecodeError as e:
        logger.error(f"[write_report] JSON 파싱 실패: {e}")
        state["report"] = "리포트 작성 실패"
        state["summary"] = "리포트 작성에 실패했습니다"
    except Exception as e:
        logger.error(f"[write_report] 리포트 작성 실패: {e}", exc_info=True)
        state["report"] = "리포트 작성 실패"
        state["summary"] = "리포트 작성에 실패했습니다"
    
    return state


# ==========================================
# 리포트 평가 노드 함수들 (LLM as Judge)
# ==========================================

def evaluate_quality(state: ReportEvaluationState) -> ReportEvaluationState:
    """Quality 평가 노드 - 유용성과 명확성 평가"""
    report = state["report"]
    diary_entries = state["diary_entries"]
    
    logger.info(f"[evaluate_quality] Quality 평가 중...")
    
    # 일기 데이터 요약 (참고용)
    entries_summary = "\n".join([
        f"- {entry.get('date', '')}: [{entry.get('topic', 'N/A')}] [{entry.get('emotion', 'N/A')}] {entry.get('content', '')[:50]}"
        for entry in diary_entries[-10:]
    ]) if diary_entries else "일기 데이터 없음"
    
    chat = _get_chat_llm()
    prompt = f"""생성된 리포트의 유용성과 명확성을 평가하세요.

=== 원본 일기 데이터 (참고) ===
{entries_summary}

=== 평가할 리포트 ===
{report}

=== Quality 평가 기준 ===
1. 유용성: 리포트가 일기 데이터를 제대로 반영하고 있는가? 통찰력이 있는가?
   - 구체적인 날짜와 감정 변화가 명시되어 있는가?
   - 단순 통계 나열이 아닌 패턴과 관계 추론이 있는가?
   - 검증 가능한 인사이트(날짜 참조 포함)가 있는가?
2. 명확성: 리포트가 읽기 쉽고 이해하기 쉬운가? 구조가 명확한가?
3. 완전성: 필요한 정보가 누락되지 않았는가?

JSON 형식:
{{
  "score": 0.0~1.0,
  "feedback": "평가 피드백",
  "issues": ["문제점1", "문제점2", ...]
}}"""
    
    try:
        response = chat.invoke(prompt)
        response_text = response.content.strip()
        
        # JSON 추출
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
        
        result_json = json.loads(response_text)
        state["quality_score"] = float(result_json.get("score", 0.5))
        state["quality_feedback"] = result_json.get("feedback", "")
        state["quality_issues"] = result_json.get("issues", [])
        
        logger.info(f"[evaluate_quality] Quality 점수: {state['quality_score']:.2f}")
        
    except Exception as e:
        logger.error(f"[evaluate_quality] 평가 실패: {e}", exc_info=True)
        state["quality_score"] = 0.5
        state["quality_feedback"] = "평가 실패"
        state["quality_issues"] = []
    
    return state


def evaluate_safety(state: ReportEvaluationState) -> ReportEvaluationState:
    """Safety 평가 노드 - 단정, 위험, 과잉조언 평가"""
    report = state["report"]
    
    logger.info(f"[evaluate_safety] Safety 평가 중...")
    
    chat = _get_chat_llm()
    prompt = f"""생성된 리포트의 안전성을 평가하세요.

=== 평가할 리포트 ===
{report}

=== Safety 평가 기준 ===
1. 단정적 표현: 확실하지 않은 내용을 확실하다고 단정하지 않는가?
   - 예: "너 우울증같애", "확실히 정신과 치료가 필요해" 등 의학적 진단을 단정하는 표현 금지
   - 의사도 아닌데 질병을 진단하거나 단정하는 표현은 절대 금지
2. 위험한 조언: 건강, 법적, 재정적 등 위험한 조언을 하지 않는가?
   - 예: "약을 먹어야 해", "자살할 수도 있어" 등 위험한 조언 금지
3. 과잉조언: 필요 이상으로 지나치게 조언하지 않는가?
4. 감정적 균형: 부정적 감정을 지나치게 부각시키지 않는가?

JSON 형식:
{{
  "score": 0.0~1.0,
  "feedback": "평가 피드백",
  "issues": ["문제점1", "문제점2", ...]
}}"""
    
    try:
        response = chat.invoke(prompt)
        response_text = response.content.strip()
        
        # JSON 추출
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
        
        result_json = json.loads(response_text)
        state["safety_score"] = float(result_json.get("score", 0.5))
        state["safety_feedback"] = result_json.get("feedback", "")
        state["safety_issues"] = result_json.get("issues", [])
        
        logger.info(f"[evaluate_safety] Safety 점수: {state['safety_score']:.2f}")
        
    except Exception as e:
        logger.error(f"[evaluate_safety] 평가 실패: {e}", exc_info=True)
        state["safety_score"] = 0.5
        state["safety_feedback"] = "평가 실패"
        state["safety_issues"] = []
    
    return state


def finalize_evaluation(state: ReportEvaluationState) -> ReportEvaluationState:
    """종합 평가 노드 - quality와 safety를 종합하여 최종 판단"""
    quality_score = state.get("quality_score", 0.5)
    safety_score = state.get("safety_score", 0.5)
    
    logger.info(f"[finalize_evaluation] 종합 평가 중...")
    
    # 종합 점수 (quality 60%, safety 40%)
    overall_score = (quality_score * 0.6) + (safety_score * 0.4)
    state["overall_score"] = overall_score
    
    # 수용 기준: overall_score >= 0.7 and safety_score >= 0.6
    is_acceptable = overall_score >= 0.7 and safety_score >= 0.6
    state["is_acceptable"] = is_acceptable
    
    # 수정 필요 여부
    needs_revision = not is_acceptable
    state["needs_revision"] = needs_revision
    
    logger.info(f"[finalize_evaluation] 종합 점수: {overall_score:.2f}, 수용 가능: {is_acceptable}, 수정 필요: {needs_revision}")
    
    return state


def _get_eval_graph():
    """컴파일된 평가 그래프를 가져옵니다 (지연 초기화)"""
    global _eval_graph
    if _eval_graph is None:
        workflow = StateGraph(ReportEvaluationState)
        
        workflow.add_node("evaluate_quality", evaluate_quality)
        workflow.add_node("evaluate_safety", evaluate_safety)
        workflow.add_node("finalize", finalize_evaluation)
        
        workflow.set_entry_point("evaluate_quality")
        workflow.add_edge("evaluate_quality", "evaluate_safety")
        workflow.add_edge("evaluate_safety", "finalize")
        workflow.add_edge("finalize", END)
        
        _eval_graph = workflow.compile()
        logger.info("Report 평가 그래프 컴파일 완료")
    
    return _eval_graph


def _evaluate_report(
    report: str,
    diary_entries: List[dict],
    period_start: str,
    period_end: str
) -> dict:
    """리포트를 평가하는 내부 함수"""
    eval_graph = _get_eval_graph()
    
    initial_state: ReportEvaluationState = {
        "report": report,
        "diary_entries": diary_entries,
        "period_start": period_start,
        "period_end": period_end,
        "quality_score": None,
        "quality_feedback": None,
        "quality_issues": None,
        "safety_score": None,
        "safety_feedback": None,
        "safety_issues": None,
        "overall_score": None,
        "is_acceptable": None,
        "needs_revision": None
    }
    
    result = eval_graph.invoke(initial_state)
    
    return {
        "quality_score": result.get("quality_score", 0.0),
        "quality_feedback": result.get("quality_feedback", ""),
        "quality_issues": result.get("quality_issues", []),
        "safety_score": result.get("safety_score", 0.0),
        "safety_feedback": result.get("safety_feedback", ""),
        "safety_issues": result.get("safety_issues", []),
        "overall_score": result.get("overall_score", 0.0),
        "is_acceptable": result.get("is_acceptable", False),
        "needs_revision": result.get("needs_revision", True)
    }


def _get_report_graph():
    """컴파일된 그래프를 가져옵니다 (지연 초기화)"""
    global _report_graph
    if _report_graph is None:
        # StateGraph 생성
        workflow = StateGraph(ReportGenerationState)
        
        # 노드 추가
        workflow.add_node("analyze_diary_data", analyze_diary_data)
        workflow.add_node("find_insights", find_insights)
        workflow.add_node("write_report", write_report)
        
        # 엣지 추가 - 인사이트 추출 → 문장 작성
        workflow.set_entry_point("analyze_diary_data")
        workflow.add_edge("analyze_diary_data", "find_insights")
        workflow.add_edge("find_insights", "write_report")
        workflow.add_edge("write_report", END)
        
        # 그래프 컴파일
        _report_graph = workflow.compile()
        logger.info("Report 그래프 컴파일 완료")
    
    return _report_graph


def generate_weekly_report(
    diary_entries: List[dict],
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    max_retries: int = 2
) -> dict:
    """
    일주일치 일기 데이터로 리포트를 생성하는 서비스 함수 (LLM as Judge 포함)
    
    Args:
        diary_entries: extractor로 분석된 일기 항목 리스트
        period_start: 리포트 기간 시작일 (선택, 기본값: 일주일 전)
        period_end: 리포트 기간 종료일 (선택, 기본값: 오늘)
        max_retries: 최대 재시도 횟수 (기본값: 2)
    
    Returns:
        리포트 딕셔너리 (report, summary, period_start, period_end 포함)
    
    Raises:
        ValueError: UPSTAGE_API_KEY가 설정되지 않은 경우
    """
    if period_end is None:
        period_end = datetime.now().strftime("%Y-%m-%d")
    if period_start is None:
        period_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # 인사이트 추출 (한 번만)
    logger.info(f"[generate_weekly_report] 인사이트 추출 중...")
    analyze_state: ReportGenerationState = {
        "diary_entries": diary_entries,
        "period_start": period_start,
        "period_end": period_end,
        "insights": None,
        "report": None,
        "summary": None
    }
    
    # 인사이트 추출까지 실행
    analyze_graph = StateGraph(ReportGenerationState)
    analyze_graph.add_node("analyze_diary_data", analyze_diary_data)
    analyze_graph.add_node("find_insights", find_insights)
    analyze_graph.set_entry_point("analyze_diary_data")
    analyze_graph.add_edge("analyze_diary_data", "find_insights")
    analyze_graph.add_edge("find_insights", END)
    analyze_graph = analyze_graph.compile()
    
    result = analyze_graph.invoke(analyze_state)
    insights = result.get("insights", [])
    
    if not insights:
        logger.warning(f"[generate_weekly_report] 인사이트 추출 실패, 기본 리포트 반환")
        return {
            "report": "데이터를 분석할 충분한 인사이트를 찾지 못했습니다.",
            "summary": "인사이트 부족",
            "period_start": period_start,
            "period_end": period_end,
            "insights": [],
            "eval_score": 0.0,
            "attempt": 0
        }
    
    logger.info(f"[generate_weekly_report] 인사이트 {len(insights)}개 추출 완료")
    
    # 문장 작성 및 평가 결과 저장
    candidates = []  # [(report, summary, eval_result), ...]
    
    # 문장 작성 단계만 재시도 (최대 1 + max_retries번)
    for attempt in range(1 + max_retries):
        logger.info(f"[generate_weekly_report] 리포트 문장 작성 시도 {attempt + 1}/{1 + max_retries}")
        
        # 인사이트를 바탕으로 문장만 작성
        write_state: ReportGenerationState = {
            "diary_entries": diary_entries,
            "period_start": period_start,
            "period_end": period_end,
            "insights": insights,  # 이미 추출된 인사이트 사용
            "report": None,
            "summary": None
        }
        
        # 문장 작성만 실행
        write_graph = StateGraph(ReportGenerationState)
        write_graph.add_node("write_report", write_report)
        write_graph.set_entry_point("write_report")
        write_graph.add_edge("write_report", END)
        write_graph = write_graph.compile()
        
        result = write_graph.invoke(write_state)
        report = result.get("report", "")
        summary = result.get("summary", "")
        
        if not report:
            logger.warning(f"[generate_weekly_report] 리포트 문장 작성 실패 (시도 {attempt + 1})")
            continue
        
        # 리포트 평가
        logger.info(f"[generate_weekly_report] 리포트 평가 중 (시도 {attempt + 1})...")
        eval_result = _evaluate_report(report, diary_entries, period_start, period_end)
        
        candidates.append({
            "report": report,
            "summary": summary,
            "eval": eval_result,
            "attempt": attempt + 1
        })
        
        logger.info(f"[generate_weekly_report] 시도 {attempt + 1} 평가 결과 - 종합점수: {eval_result['overall_score']:.2f}, 수용가능: {eval_result['is_acceptable']}")
        
        # 수용 가능하면 즉시 반환
        if eval_result["is_acceptable"]:
            logger.info(f"[generate_weekly_report] ✅ 수용 가능한 리포트 생성 완료 (시도 {attempt + 1})")
            return {
                "report": report,
                "summary": summary,
                "period_start": period_start,
                "period_end": period_end,
                "insights": insights,  # 인사이트 포함
                "eval_score": eval_result["overall_score"],
                "attempt": attempt + 1
            }
        
        # 마지막 시도가 아니면 재작성
        if attempt < max_retries:
            logger.info(f"[generate_weekly_report] 리포트 품질 미달 (종합점수: {eval_result['overall_score']:.2f}), 재작성 시도...")
    
    # 모든 시도가 수용 기준을 만족하지 못한 경우, 가장 높은 점수의 리포트 반환
    if candidates:
        best_candidate = max(candidates, key=lambda x: x["eval"]["overall_score"])
        logger.warning(f"[generate_weekly_report] ⚠️ 수용 기준 미달, 최고 점수 리포트 반환 (점수: {best_candidate['eval']['overall_score']:.2f})")
        return {
            "report": best_candidate["report"],
            "summary": best_candidate["summary"],
            "period_start": period_start,
            "period_end": period_end,
            "insights": insights,  # 인사이트 포함
            "eval_score": best_candidate["eval"]["overall_score"],
            "attempt": best_candidate["attempt"]
        }
    
    # 모든 시도 실패
    logger.error(f"[generate_weekly_report] ❌ 모든 리포트 문장 작성 시도 실패")
    return {
        "report": "리포트 작성에 실패했습니다.",
        "summary": "리포트 작성에 실패했습니다",
        "period_start": period_start,
        "period_end": period_end,
        "insights": insights,  # 인사이트는 추출되었으므로 포함
        "eval_score": 0.0,
        "attempt": 1 + max_retries
    }
