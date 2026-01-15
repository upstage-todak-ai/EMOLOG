"""
리포트 문장 작성 모듈
"""
import json
from app.services.report.report_models import ReportGenerationState
from app.services.report.report_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


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
        chat = get_chat_llm()
        
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
