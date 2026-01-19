"""
리포트 생성 오케스트레이션 서비스

인사이트 추출 → (리포트 생성 + 인사이트 요약) 병렬 처리 → 평가 → 재작성 흐름을 관리
"""
from datetime import datetime, timedelta
from typing import Optional, List
from langgraph.graph import StateGraph, END
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.services.report.report_models import ReportGenerationState
from app.services.report.report_insights import analyze_diary_data, find_insights
from app.services.report.report_writer import write_report
from app.services.report.report_judge import evaluate_report
from app.services.report.report_insight_writer import summarize_insights_batch
from app.core.logging import get_logger

logger = get_logger(__name__)


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
        리포트 딕셔너리 (report, summary, period_start, period_end, insights 포함)
    
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
            "pattern_summary": "",
            "period_start": period_start,
            "period_end": period_end,
            "insights": [],
            "eval_score": 0.0,
            "attempt": 0
        }
    
    logger.info(f"[generate_weekly_report] 인사이트 {len(insights)}개 추출 완료")
    
    # 인사이트를 자연어 1줄 요약으로 변환 (배치 처리)
    # 리포트 생성과 병렬 처리
    original_insights = insights.copy()  # 원본 인사이트 백업
    summarized_insights = None
    
    if insights:
        logger.info(f"[generate_weekly_report] 인사이트 자연어 요약 중 (배치 처리)...")
        try:
            summarized_insights = summarize_insights_batch(insights)
            logger.info(f"[generate_weekly_report] 인사이트 요약 완료")
        except Exception as e:
            logger.warning(f"[generate_weekly_report] 인사이트 요약 실패, 원본 사용: {e}")
            summarized_insights = original_insights
    
    # 요약된 인사이트가 있으면 사용, 없으면 원본 사용
    final_insights = summarized_insights if summarized_insights else original_insights
    
    # 문장 작성 및 평가 결과 저장
    candidates = []
    
    # 문장 작성 단계만 재시도 (최대 1 + max_retries번)
    for attempt in range(1 + max_retries):
        logger.info(f"[generate_weekly_report] 리포트 문장 작성 시도 {attempt + 1}/{1 + max_retries}")
        
        # 인사이트를 바탕으로 문장만 작성
        write_state: ReportGenerationState = {
            "diary_entries": diary_entries,
            "period_start": period_start,
            "period_end": period_end,
            "insights": original_insights,  # 리포트 생성에는 원본 인사이트 사용 (날짜 정보 포함)
            "report": None,
            "summary": None,
            "pattern_summary": None
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
        pattern_summary = result.get("pattern_summary", "")
        
        if not report:
            logger.warning(f"[generate_weekly_report] 리포트 문장 작성 실패 (시도 {attempt + 1})")
            continue
        
        # 리포트 평가
        logger.info(f"[generate_weekly_report] 리포트 평가 중 (시도 {attempt + 1})...")
        eval_result = evaluate_report(report, diary_entries, period_start, period_end)
        
        candidates.append({
            "report": report,
            "summary": summary,
            "pattern_summary": pattern_summary,
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
                "pattern_summary": pattern_summary,
                "period_start": period_start,
                "period_end": period_end,
                "insights": final_insights,  # 요약된 인사이트 반환 (DB 저장용)
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
            "pattern_summary": best_candidate.get("pattern_summary", ""),
            "period_start": period_start,
            "period_end": period_end,
            "insights": final_insights,  # 요약된 인사이트 반환
            "eval_score": best_candidate["eval"]["overall_score"],
            "attempt": best_candidate["attempt"]
        }
    
    # 모든 시도 실패
    logger.error(f"[generate_weekly_report] ❌ 모든 리포트 문장 작성 시도 실패")
    return {
        "report": "리포트 작성에 실패했습니다.",
        "summary": "리포트 작성에 실패했습니다",
        "pattern_summary": "",
        "period_start": period_start,
        "period_end": period_end,
        "insights": final_insights if 'final_insights' in locals() else original_insights,  # 요약된 인사이트 반환
        "eval_score": 0.0,
        "attempt": 1 + max_retries
    }
