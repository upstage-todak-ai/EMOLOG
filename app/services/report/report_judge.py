"""
리포트 평가 모듈 (LLM as Judge + 규칙 평가)
"""
import json
from langgraph.graph import StateGraph, END
from app.services.report.report_models import ReportEvaluationState
from app.services.report.report_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)

# 전역 변수: 컴파일된 평가 그래프 (한 번만 컴파일)
_eval_graph = None


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
    
    chat = get_chat_llm()
    prompt = f"""생성된 리포트의 유용성과 명확성을 평가하세요.

=== 원본 일기 데이터 (참고) ===
{entries_summary}

=== 평가할 리포트 ===
{report}

=== 리포트 구조 (필수) ===
리포트는 다음 구조를 따라야 합니다:
1. **첫 문장 요약**: 가장 중요한 패턴이나 통찰을 한 문장으로 요약
2. **본론 문단**: 구체적인 관찰과 패턴 설명 (3-5문장)
3. **결론 문단**: 전체적인 맥락에서의 해석이나 마무리 (3-5문장)

=== Quality 평가 기준 ===
1. **구조 준수 (필수)**: 리포트가 "첫 문장 요약 + 본론 + 결론" 구조를 따르는가?
   - 첫 문장이 한 줄로 명확한 요약인가?
   - **첫 문장이 강렬하고 임팩트 있는가?** (짧고 간결, 최대 30-40자, 감정적 공감 유도)
   - 평범한 서술형이 아닌 시적이고 파워풀한 표현인가?
   - 본론과 결론이 각각 하나의 문단으로 구성되어 있는가?
   - 각 문단이 \n\n로 구분되어 있는가?
2. **유용성**: 리포트가 일기 데이터를 제대로 반영하고 있는가? 통찰력이 있는가?
   - 단순 통계 나열이 아닌 패턴과 관계 추론이 있는가?
   - 감정 변화나 시간 흐름이 명확히 드러나는가?
3. **명확성**: 리포트가 읽기 쉽고 이해하기 쉬운가?
   - 문장이 자연스럽고 따뜻한 톤인가?
   - 구체적인 날짜 대신 상대적 표현을 사용하는가?
   - **개발 용어나 기술 용어가 없는가?** (예: "JOY", "ANXIETY", "데이터", "분석" 등 영어 코드나 기술 용어 사용 시 감점)
   - 자연스러운 한국어로 감정을 표현하는가? (예: "기쁨", "불안", "평온함" 등)
4. **완전성**: 필요한 정보가 누락되지 않았는가?

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
        
        # 제어 문자 제거 (JSON 파싱 오류 방지)
        import re
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
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
    
    chat = get_chat_llm()
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
        
        # 제어 문자 제거 (JSON 파싱 오류 방지)
        import re
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
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


def evaluate_report(
    report: str,
    diary_entries: list,
    period_start: str,
    period_end: str
) -> dict:
    """리포트를 평가하는 함수"""
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
