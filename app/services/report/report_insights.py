"""
인사이트 추출 모듈
"""
import json
from app.services.report.report_models import ReportGenerationState
from app.services.report.report_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


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
        chat = get_chat_llm()
        
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
