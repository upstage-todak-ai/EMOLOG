"""
리포트 생성 관련 모델 및 스키마 정의
"""
from typing import TypedDict, Optional, List


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
