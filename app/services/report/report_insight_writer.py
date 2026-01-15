"""
인사이트 자연어 요약 모듈

인사이트를 자연스러운 1줄 요약으로 변환합니다.
"""
import json
from typing import List, Dict
from app.services.report.report_llm import get_chat_llm
from app.core.logging import get_logger
import re

logger = get_logger(__name__)


def summarize_insights_batch(insights: List[Dict]) -> List[Dict]:
    """
    여러 인사이트를 배치로 자연어 1줄 요약으로 변환
    
    Args:
        insights: 인사이트 리스트 (type, description, date_references, evidence 포함)
    
    Returns:
        인사이트 리스트에 summary 필드가 추가된 리스트
    """
    if not insights:
        return []
    
    try:
        chat = get_chat_llm()
        
        # 모든 인사이트를 한 번에 요약 요청
        insights_json = json.dumps(insights, ensure_ascii=False, indent=2)
        
        prompt = f"""당신은 인사이트를 자연스러운 1줄 요약으로 변환하는 전문가입니다.

=== 인사이트 리스트 ===
{insights_json}

=== 요청 사항 ===
각 인사이트를 읽기 쉬운 자연어 1줄로 요약해주세요.

=== 작성 규칙 ===
1. **1줄 요약**: 최대 50-60자 정도로 간결하게
2. **자연스러운 대화체**: "~이 ~로 변경됐어요.", "~에서 ~했네요.", "~해서 ~했어요." 같은 구어체
3. **변화/패턴을 자연스럽게 표현**: "불안이 평온으로 바뀌었어요", "계획을 세웠다가 다시 망쳤네요" 같은 자연스러운 표현
4. **구체적인 날짜는 생략**: 날짜는 번호로 표시되므로 요약에서는 생략 (예: "12월 15일" 대신 "그때" 또는 생략)
5. **개발 용어 금지**: "time_contrast", "repetition" 같은 기술 용어 사용 금지
6. **감정 변화나 패턴을 명확히**: 무엇이 무엇으로, 어떻게 변화했는지 자연스럽게 표현

=== 출력 JSON 형식 ===
{{
  "insight_summaries": [
    {{
      "index": 0,
      "summary": "불안했던 마음이 평온으로 바뀌었어요."
    }},
    {{
      "index": 1,
      "summary": "중요한 일정 전에는 불안이 계속 나타났네요."
    }},
    {{
      "index": 2,
      "summary": "슬픔에서 기쁨으로 감정이 변화했어요!"
    }}
  ]
}}

각 인사이트의 순서(index)는 입력 순서와 동일해야 합니다."""

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
        
        # 제어 문자 제거
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
        result_json = json.loads(response_text)
        summaries = result_json.get("insight_summaries", [])
        
        # 인사이트에 summary 추가
        success_count = 0
        for summary_item in summaries:
            idx = summary_item.get("index")
            summary_text = summary_item.get("summary", "")
            if 0 <= idx < len(insights) and summary_text:
                insights[idx]["summary"] = summary_text
                success_count += 1
                logger.debug(f"[summarize_insights_batch] 인사이트 {idx} 요약: {summary_text}")
        
        # summary가 없는 인사이트는 description을 사용
        fail_count = 0
        for i, insight in enumerate(insights):
            if "summary" not in insight or not insight["summary"]:
                insight["summary"] = insight.get("description", "인사이트 요약 없음")
                fail_count += 1
                logger.warning(f"[summarize_insights_batch] 인사이트 {i} 요약 실패, description 사용")
        
        total_count = len(insights)
        success_rate = (success_count / total_count * 100) if total_count > 0 else 0
        logger.info(f"[summarize_insights_batch] 인사이트 요약 완료: 총 {total_count}개, 성공 {success_count}개, 실패 {fail_count}개, 성공률 {success_rate:.1f}%")
        return insights
        
    except json.JSONDecodeError as e:
        logger.error(f"[summarize_insights_batch] JSON 파싱 실패: {e}")
        logger.debug(f"[summarize_insights_batch] 원본 응답: {response.content[:200] if 'response' in locals() else 'N/A'}...")
        # 실패 시 description을 summary로 사용
        for insight in insights:
            if "summary" not in insight:
                insight["summary"] = insight.get("description", "인사이트 요약 없음")
        logger.warning(f"[summarize_insights_batch] 전체 배치 실패, 모든 인사이트에 description 사용 (총 {len(insights)}개)")
        return insights
    except Exception as e:
        logger.error(f"[summarize_insights_batch] 인사이트 요약 실패: {e}", exc_info=True)
        # 실패 시 description을 summary로 사용
        for insight in insights:
            if "summary" not in insight:
                insight["summary"] = insight.get("description", "인사이트 요약 없음")
        logger.warning(f"[summarize_insights_batch] 전체 배치 실패, 모든 인사이트에 description 사용 (총 {len(insights)}개)")
        return insights
