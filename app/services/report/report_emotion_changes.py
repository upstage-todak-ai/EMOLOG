"""
감정 변화 분석 및 리포트 생성 모듈
"""
import json
from typing import List, Dict, Optional
from app.services.report.report_llm import get_chat_llm
from app.core.logging import get_logger

logger = get_logger(__name__)

# 감정 코드와 이모지 매핑
EMOTION_EMOJI_MAP = {
    "JOY": "😊",
    "CALM": "😌",
    "SADNESS": "😢",
    "ANGER": "😠",
    "ANXIETY": "😰",
    "EXHAUSTED": "😴"
}

# 감정 코드와 한국어 매핑
EMOTION_KOREAN_MAP = {
    "JOY": "기쁨",
    "CALM": "평온",
    "SADNESS": "슬픔",
    "ANGER": "화남",
    "ANXIETY": "불안",
    "EXHAUSTED": "지침"
}


def analyze_emotion_changes(diary_entries: List[dict], insights: List[dict]) -> List[dict]:
    """
    일기 데이터와 인사이트를 분석하여 주요 감정 변화를 추출합니다.
    
    Args:
        diary_entries: 일기 항목 리스트 [{"date": "...", "content": "...", "topic": "...", "emotion": "..."}]
        insights: 추출된 인사이트 리스트
    
    Returns:
        감정 변화 리스트, 각 항목은:
        {
            "start_emotion": "JOY",
            "end_emotion": "SADNESS",
            "start_emotion_emoji": "😊",
            "end_emotion_emoji": "😢",
            "keywords": ["시험 준비", "실망"],
            "date_references": ["2025-12-14", "2025-12-16"],
            "related_insights": [...]  # 관련 인사이트들
        }
    """
    if not diary_entries or not insights:
        logger.warning("[analyze_emotion_changes] 일기 데이터나 인사이트가 없습니다.")
        return []
    
    try:
        chat = get_chat_llm()
        
        # 일기 데이터를 날짜순으로 정렬
        sorted_entries = sorted(diary_entries, key=lambda x: x.get("date", ""))
        
        # 일기 데이터 요약
        entries_summary = "\n".join([
            f"날짜: {entry.get('date', 'N/A')} | 주제: {entry.get('topic', 'N/A')} | 감정: {entry.get('emotion', 'N/A')} | 내용: {entry.get('content', '')[:100]}"
            for entry in sorted_entries
        ])
        
        # 인사이트 요약
        insights_summary = json.dumps(insights, ensure_ascii=False, indent=2)
        
        prompt = f"""당신은 일기 데이터를 분석하여 주요 감정 변화를 추출하는 전문가입니다.

=== 일기 데이터 (날짜순 정렬) ===
{entries_summary}

=== 추출된 인사이트 ===
{insights_summary}

=== 작업 ===
위 일기 데이터와 인사이트를 분석하여, **주요한 감정 변화**만 추출하세요.
- 너무 많은 변화를 나열하지 말고, **가장 의미 있고 중요한 변화 2-4개**만 추출하세요
- 각 감정 변화는 명확한 시작 감정과 끝 감정을 가져야 합니다
- 각 감정 변화와 관련된 주요 키워드(주제)를 2-3개 추출하세요
- 각 감정 변화와 관련된 날짜들을 참조하세요

=== 출력 JSON 형식 ===
{{
  "emotion_changes": [
    {{
      "start_emotion": "JOY" | "CALM" | "SADNESS" | "ANGER" | "ANXIETY" | "EXHAUSTED",
      "end_emotion": "JOY" | "CALM" | "SADNESS" | "ANGER" | "ANXIETY" | "EXHAUSTED",
      "keywords": ["키워드1", "키워드2"],
      "date_references": ["YYYY-MM-DD", "YYYY-MM-DD"],
      "description": "이 감정 변화를 설명하는 짧은 문장"
    }}
  ]
}}

=== 제약 사항 ===
- 감정 변화는 2-4개만 추출하세요 (너무 많지 않게)
- start_emotion과 end_emotion은 반드시 다르아야 합니다
- keywords는 2-3개만 추출하세요
- date_references는 최소 2개 이상이어야 합니다
- description은 한 문장으로 간결하게 작성하세요

=== 예시 ===
{{
  "emotion_changes": [
    {{
      "start_emotion": "JOY",
      "end_emotion": "SADNESS",
      "keywords": ["시험 준비", "실망"],
      "date_references": ["2025-12-14", "2025-12-16"],
      "description": "시험 준비로 기쁨을 느꼈지만 결과에 실망하여 슬픔으로 변화"
    }}
  ]
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
        emotion_changes = result_json.get("emotion_changes", [])
        
        # 이모지 추가 및 검증
        validated_changes = []
        for change in emotion_changes:
            start_emotion = change.get("start_emotion", "")
            end_emotion = change.get("end_emotion", "")
            
            if start_emotion not in EMOTION_EMOJI_MAP or end_emotion not in EMOTION_EMOJI_MAP:
                logger.warning(f"[analyze_emotion_changes] 유효하지 않은 감정 코드: {start_emotion} -> {end_emotion}")
                continue
            
            # 관련 인사이트 찾기 (날짜 참조 기반)
            date_refs = change.get("date_references", [])
            related_insights = [
                insight for insight in insights
                if any(ref_date in insight.get("date_references", []) for ref_date in date_refs)
            ]
            
            validated_changes.append({
                "start_emotion": start_emotion,
                "end_emotion": end_emotion,
                "start_emotion_emoji": EMOTION_EMOJI_MAP[start_emotion],
                "end_emotion_emoji": EMOTION_EMOJI_MAP[end_emotion],
                "start_emotion_korean": EMOTION_KOREAN_MAP[start_emotion],
                "end_emotion_korean": EMOTION_KOREAN_MAP[end_emotion],
                "keywords": change.get("keywords", []),
                "date_references": date_refs,
                "description": change.get("description", ""),
                "related_insights": related_insights
            })
        
        logger.info(f"[analyze_emotion_changes] 감정 변화 {len(validated_changes)}개 추출 완료")
        return validated_changes
        
    except json.JSONDecodeError as e:
        logger.error(f"[analyze_emotion_changes] JSON 파싱 실패: {e}")
        logger.debug(f"[analyze_emotion_changes] 원본 응답: {response.content[:200] if 'response' in locals() else 'N/A'}...")
        return []
    except Exception as e:
        logger.error(f"[analyze_emotion_changes] 감정 변화 분석 실패: {e}", exc_info=True)
        return []


def generate_emotion_change_report(
    emotion_change: dict,
    diary_entries: List[dict],
    period_start: str,
    period_end: str
) -> dict:
    """
    특정 감정 변화에 대한 간략한 리포트를 생성합니다.
    
    Args:
        emotion_change: 감정 변화 정보
        diary_entries: 일기 항목 리스트
        period_start: 리포트 기간 시작일
        period_end: 리포트 기간 종료일
    
    Returns:
        {
            "title": "제목",
            "body": "본론",
            "conclusion": "결론"
        }
    """
    try:
        chat = get_chat_llm()
        
        # 관련 일기 항목 필터링
        date_refs = emotion_change.get("date_references", [])
        related_entries = [
            entry for entry in diary_entries
            if entry.get("date") in date_refs
        ]
        
        # 관련 일기 요약
        entries_summary = "\n".join([
            f"날짜: {entry.get('date', 'N/A')} | 주제: {entry.get('topic', 'N/A')} | 감정: {entry.get('emotion', 'N/A')} | 내용: {entry.get('content', '')[:150]}"
            for entry in related_entries
        ])
        
        # 관련 인사이트 요약
        related_insights = emotion_change.get("related_insights", [])
        insights_summary = json.dumps(related_insights, ensure_ascii=False, indent=2) if related_insights else "없음"
        
        prompt = f"""당신은 특정 감정 변화에 대한 간략하고 읽기 좋은 리포트를 작성하는 전문가입니다.

=== 감정 변화 정보 ===
시작 감정: {emotion_change.get('start_emotion_korean', '')} ({emotion_change.get('start_emotion_emoji', '')})
끝 감정: {emotion_change.get('end_emotion_korean', '')} ({emotion_change.get('end_emotion_emoji', '')})
키워드: {', '.join(emotion_change.get('keywords', []))}
설명: {emotion_change.get('description', '')}

=== 관련 일기 데이터 ===
{entries_summary}

=== 관련 인사이트 ===
{insights_summary}

=== 리포트 기간 ===
시작일: {period_start}
종료일: {period_end}

=== 리포트 구조 (필수) ===
리포트는 반드시 다음 구조를 따라야 합니다:

**1. 제목** (한 줄, 최대 30-40자)
   - 강렬하고 임팩트 있는 문장
   - 감정적 공감을 이끌어내는 표현
   - 예시: "기쁨에서 실망으로", "불안을 극복한 순간들"

**2. 본론** (3-5문장)
   - 감정 변화의 구체적인 맥락 설명
   - 관련 일기 내용을 자연스럽게 연결
   - 날짜를 명시적으로 언급하지 마세요 (대신 "전날", "그 다음날" 같은 표현 사용)

**3. 결론** (2-3문장)
   - 전체적인 해석이나 마무리
   - 따뜻하고 격려하는 톤

=== 작성 지침 ===
1. **간결하게**: 본론과 결론을 각각 짧게 작성하세요 (너무 길지 않게)
2. **구체적으로**: 추상적인 표현보다는 구체적인 관찰을 포함하세요
3. **따뜻하게**: 개인적이고 따뜻한 톤을 유지하세요
4. **날짜 금지**: 절대 날짜(예: "12월 15일")를 포함하지 마세요
5. **개발 용어 금지**: "JOY", "ANXIETY" 같은 영어 코드나 "데이터", "분석" 같은 기술 용어 사용 금지

=== 출력 JSON 형식 ===
{{
  "title": "제목 (최대 30-40자)",
  "body": "본론 (3-5문장)",
  "conclusion": "결론 (2-3문장)"
}}

**중요**: 
- 제목은 반드시 강렬하고 임팩트 있게 (짧고 간결, 최대 30-40자)
- 본론과 결론은 각각 짧게 작성 (너무 길지 않게)
- JSON 내 문자열에서 줄바꿈은 \\n으로 표현하세요
- 절대 개발 용어 사용 금지"""
        
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
        
        import re
        response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
        
        result_json = json.loads(response_text)
        
        return {
            "title": result_json.get("title", ""),
            "body": result_json.get("body", ""),
            "conclusion": result_json.get("conclusion", "")
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"[generate_emotion_change_report] JSON 파싱 실패: {e}")
        return {
            "title": "감정 변화 리포트",
            "body": "리포트 생성에 실패했습니다.",
            "conclusion": ""
        }
    except Exception as e:
        logger.error(f"[generate_emotion_change_report] 리포트 생성 실패: {e}", exc_info=True)
        return {
            "title": "감정 변화 리포트",
            "body": "리포트 생성에 실패했습니다.",
            "conclusion": ""
        }
