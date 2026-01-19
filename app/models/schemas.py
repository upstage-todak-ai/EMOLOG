from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime
from enum import Enum

# ==========================================
# 감정 타입 정의
# ==========================================
class Emotion(str, Enum):
    """감정 타입 - 기획서의 6가지 핵심 감정"""
    JOY = "JOY"              # 기쁨
    CALM = "CALM"            # 평온
    SADNESS = "SADNESS"      # 슬픔
    ANGER = "ANGER"          # 화남
    ANXIETY = "ANXIETY"      # 불안
    EXHAUSTED = "EXHAUSTED"  # 지침

# ==========================================
# 일기 관련 모델
# ==========================================
class DiaryEntryBase(BaseModel):
    """일기 기본 모델 (입력용)"""
    user_id: str
    date: datetime
    content: str
    emotion: Optional[Emotion] = None  # emotion이 없으면 extractor로 추출
    topic: Optional[str] = None  # 추출된 주제 (선택사항)

class DiaryEntryCreate(DiaryEntryBase):
    """일기 생성 요청 모델 (프론트엔드에서 받을 때)"""
    pass

class DiaryEntryUpdate(BaseModel):
    """일기 수정 요청 모델 (content, emotion, topic 수정 가능)"""
    content: Optional[str] = None
    emotion: Optional[Emotion] = None
    topic: Optional[str] = None

class DiaryEntry(DiaryEntryBase):
    """일기 응답 모델 (저장 후 반환할 때)"""
    id: Optional[Union[int, str]] = None  # Firestore는 문자열 ID를 사용하므로 Union 타입
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ==========================================
# 캘린더 관련 모델
# ==========================================
class CalendarEventType(str, Enum):
    """캘린더 이벤트 타입 - 심리적 성격 기반 분류"""
    PERFORMANCE = "PERFORMANCE"    # 평가/성과: 긴장과 스트레스를 유발하는 일
    SOCIAL = "SOCIAL"              # 사회/관계: 사람을 만나고 에너지를 쓰는 일
    CELEBRATION = "CELEBRATION"    # 기념일: 축하하거나 챙겨야 하는 날
    HEALTH = "HEALTH"              # 건강/치료: 신체/정신적 케어가 필요한 일
    LEISURE = "LEISURE"            # 휴식/여가: 리프레시를 위한 일
    ROUTINE = "ROUTINE"            # 일상/기타: 특별한 감정 소모가 없는 단순 일정

class CalendarEventBase(BaseModel):
    """캘린더 이벤트 기본 모델"""
    user_id: str
    title: str
    start_date: datetime
    end_date: datetime
    type: CalendarEventType
    # 디바이스 캘린더 원본 이벤트 id (옵션) - 중복 저장 방지에 활용 가능
    source_event_id: Optional[str] = None

class CalendarEventCreate(CalendarEventBase):
    """캘린더 이벤트 생성 요청 모델"""
    pass

class CalendarEventUpdate(BaseModel):
    """캘린더 이벤트 수정 요청 모델"""
    title: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    type: Optional[CalendarEventType] = None

class CalendarEvent(CalendarEventBase):
    """캘린더 이벤트 응답 모델"""
    id: Optional[Union[int, str]] = None  # Firestore는 문자열 ID를 사용하므로 Union 타입
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ==========================================
# 에이전트 관련 모델
# ==========================================
class AgentRequest(BaseModel):
    """에이전트 1 요청 모델
    
    context.ipynb의 run_todak_agent 함수가 받는 데이터 구조
    """
    current_time: str  # "YYYY-MM-DD HH:mm:ss"
    notification_setting: str  # "ON" | "OFF"
    calendar_events: List[dict]  # [{"date": "...", "title": "...", "type": "..."}]
    diary_entries: List[dict]  # [{"date": "...", "content": "...", "emotion": "..."}]

class AgentResponse(BaseModel):
    """에이전트 1 응답 모델
    
    context.ipynb의 run_todak_agent 함수가 반환하는 데이터 구조
    """
    should_send: bool
    send_time: str  # "YYYY-MM-DD HH:mm:ss"
    message: Optional[str] = None  # should_send가 false면 null
    reason: str  # 판단 사유 및 맥락 분석 결과

# ==========================================
# 통계 및 레포트 관련 모델
# ==========================================
class EmotionStats(BaseModel):
    """감정별 통계"""
    emotion: Emotion
    count: int

class TopicStats(BaseModel):
    """주제별 통계"""
    topic: str
    count: int

class StatsResponse(BaseModel):
    """통계 응답 모델"""
    emotion_stats: List[EmotionStats]
    topic_stats: List[TopicStats]
    total_count: int

class ReportResponse(BaseModel):
    """레포트 응답 모델"""
    title: str
    content: str
    period: str  # "week" | "month"

# ==========================================
# Log 추출 관련 모델
# ==========================================
class LogExtractRequest(BaseModel):
    """Log 추출 요청 모델"""
    content: str

class LogExtractResponse(BaseModel):
    """Log 추출 응답 모델"""
    topic: Optional[str] = None  # 주제 (학업, 대인관계, 일상, 취미, 건강) 또는 None
    emotion: Optional[Emotion] = None  # 감정 또는 None

# ==========================================
# Extractor 관련 모델 (LangGraph 버전)
# ==========================================
class ExtractorRequest(BaseModel):
    """일기 정보 추출 요청 모델"""
    content: str  # 일기 원본 내용
    datetime: Optional[str] = None  # 일기 작성 시간 "YYYY-MM-DD HH:mm:ss" (선택)

class ExtractorResponse(BaseModel):
    """일기 정보 추출 응답 모델"""
    topic: str  # 추출된 주제
    emotion: str  # 추출된 감정
    datetime: str  # 일기 작성 시간

# ==========================================
# Report 관련 모델 (LangGraph 버전)
# ==========================================
class DiaryEntryForReport(BaseModel):
    """리포트 생성을 위한 일기 항목 모델"""
    date: str  # 날짜 "YYYY-MM-DD"
    content: str  # 일기 내용
    topic: Optional[str] = None  # 주제 (없을 수 있음)
    emotion: Optional[str] = None  # 감정 (없을 수 있음)

class ReportRequest(BaseModel):
    """리포트 생성 요청 모델"""
    user_id: str  # 사용자 ID
    diary_entries: List[DiaryEntryForReport]  # extractor로 분석된 일기 항목 리스트
    period_start: Optional[str] = None  # 리포트 기간 시작일 "YYYY-MM-DD" (선택)
    period_end: Optional[str] = None  # 리포트 기간 종료일 "YYYY-MM-DD" (선택)

class InsightResponse(BaseModel):
    """인사이트 응답 모델"""
    type: str  # 'time_contrast' | 'repetition' | 'causal_relation'
    description: str  # 인사이트 설명
    date_references: List[str]  # 관련 날짜 리스트
    evidence: str  # 근거 설명

class ReportResponse(BaseModel):
    """리포트 생성 응답 모델"""
    report: str  # 생성된 리포트 내용
    summary: str  # 리포트 요약
    period_start: str  # 리포트 기간 시작일
    period_end: str  # 리포트 기간 종료일
    insights: Optional[List[dict]] = []  # 추출된 인사이트 리스트
    created_at: Optional[str] = None  # 리포트 생성 일시 (ISO 형식)
    emotion_changes: Optional[List[dict]] = []  # 감정 변화 리스트 (각 변화에 대한 리포트 포함)