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

=== 리포트 구조 (필수) ===
리포트는 반드시 다음 구조를 따라야 합니다:

**1. 첫 문장 요약** (한 줄, 최대 30-40자)
   - **강렬하고 임팩트 있는 문장**으로 작성 (평범한 서술 금지)
   - 감정적 공감을 이끌어내는 표현 사용
   - 핵심만 간결하게, 독자의 시선을 단숨에 사로잡아야 함
   - 예시 (좋은 예):
     * "기쁨과 불안이 교차하는 시험 준비의 순간들"
     * "성취 뒤 찾아온 불안, 스스로 균형을 찾는 여정"
     * "두려움 속에서도 자신을 격려하며 성장하는 모습"
   - 예시 (나쁜 예 - 피해야 할 것):
     * "기출 점수 상승으로 기쁨을 느꼈지만, 시험 압박과 계절 변화로 인해 불안이 반복되며..." (너무 길고 평범함)
     * "이번 기간 동안 다양한 감정이 나타났어요." (임팩트 없음)

**2. 본론** (첫 번째 문단)
   - 인사이트를 바탕으로 구체적인 관찰과 패턴 설명
   - 감정 변화, 반복되는 패턴, 시간 흐름 등을 포함

**3. 결론** (두 번째 문단)
   - 전체적인 맥락에서의 해석이나 마무리

=== 작성 지침 ===
1. **구조 준수**: 반드시 "[첫 문장 요약]\n\n[본론 문단]\n\n[결론 문단]" 형식으로 작성
2. **첫 문장은 반드시 강렬하고 임팩트 있게** 작성하세요
   - 짧고 간결하게 (최대 30-40자)
   - 감정적 공감을 이끌어내는 표현
   - 평범한 서술형이나 나열형 절대 금지
   - "~했어요", "~였어요" 같은 평범한 어미보다는 "~의 순간들", "~의 여정" 같은 시적 표현 사용
3. **인사이트를 자연스럽고 따뜻한 문장으로 변환**하세요
3. **구체적 관찰과 패턴을 포함**하세요 (예: "시험 전에는 불안했지만 시험 후에는 평온했다")
4. **날짜를 명시적으로 언급하지 마세요** (예: "12월 15일", "며칠 며칠" 같은 표현 금지)
   - 대신 "전날", "그 다음날", "시험 전후" 같은 상대적 표현 사용
   - 사용자는 "근거 보기" 버튼으로 해당 날짜의 메모를 확인할 수 있습니다
5. **개인적이고 따뜻한 톤**을 유지하세요 ("~했어요", "~드네요" 등)
6. **본론과 결론 각각 3-5문장 정도로 간결하게** 작성하세요
7. **인사이트를 그대로 나열하지 말고**, 자연스러운 이야기 흐름으로 연결하세요
8. **절대 개발 용어나 기술 용어를 사용하지 마세요**
   - ❌ 금지: "JOY", "ANXIETY", "CALM" 같은 영어 감정 코드
   - ❌ 금지: "데이터", "분석", "패턴 추출", "인사이트" 같은 개발 용어
   - ✅ 올바름: "기쁨", "불안", "평온함", "설렘" 같은 자연스러운 한국어
   - ✅ 올바름: "느낌이 들었어요", "마음이 편해졌어요" 같은 일상적 표현

=== 금지 사항 ===
- 단정적 표현: "우울증", "치료 필요" 등 의학적 진단 금지
- 위험한 조언: "약을 먹어야 해", "자살" 등 금지
- 과잉조언: 필요 이상의 조언 금지
- 부정적 감정 과도 강조 금지
- **개발 용어 절대 사용 금지**: 
  - 영어 감정 코드: "JOY", "ANXIETY", "CALM", "SADNESS", "ANGER", "EXHAUSTED" 등
  - 기술 용어: "데이터", "분석 결과", "패턴", "인사이트", "추출", "관측" 등
  - 대신 자연스러운 한국어로 표현: "기쁨", "불안", "평온함", "슬픔", "화남", "지침" 등

=== 출력 JSON 형식 ===
{{
  "report": "[첫 문장 요약]\n\n[본론 문단]\n\n[결론 문단]",
  "summary": "첫 문장 요약 내용 (report의 첫 줄과 동일)"
}}

**중요**: 
- 반드시 3줄 구조: 첫 문장 요약(1줄) + 본론(1문단) + 결론(1문단)
- **첫 문장은 반드시 강렬하고 임팩트 있게** (짧고 간결, 최대 30-40자, 감정적 공감 유도)
- 각 문단은 \n\n로 구분하세요
- 리포트 본문에는 절대 날짜(예: "12월 15일", "며칠 며칠")를 포함하지 마세요
- JSON 내 문자열에서 줄바꿈은 반드시 \\n으로 표현하세요 (제어 문자 사용 금지)
- **절대 개발 용어 사용 금지**: "JOY", "ANXIETY" 같은 영어 코드나 "데이터", "분석" 같은 기술 용어를 사용하면 안 됩니다. 반드시 자연스러운 한국어로 풀어서 작성하세요
- **첫 문장 예시**: "기쁨과 불안이 교차하는 순간들", "두려움 속에서도 성장하는 모습", "균형을 찾아가는 여정" 등 임팩트 있는 표현 사용"""
        
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
        
        # 제어 문자 제거 (JSON 파싱 오류 방지)
        import re
        # 탭, 캐리지 리턴 등 제어 문자를 공백으로 치환 (줄바꿈은 유지)
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
        result_json = json.loads(response_text)
        report_content = result_json.get("report", "")
        summary_content = result_json.get("summary", "")
        
        # 줄바꿈 정규화 (\n\n로 문단 구분)
        report_content = report_content.replace('\r\n', '\n').replace('\r', '\n')
        # 연속된 줄바꿈 정리 (최대 2개까지만)
        report_content = re.sub(r'\n{3,}', '\n\n', report_content)
        
        state["report"] = report_content
        state["summary"] = summary_content
        
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
