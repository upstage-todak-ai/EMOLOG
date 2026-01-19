# LangGraph 아키텍처 다이어그램

## 1. Notification Service

```mermaid
graph TD
    Start([새 일기 작성]) --> InitState[초기 State 생성<br/>current_time, diary_entries,<br/>calendar_events, messages]
    InitState --> Decide[decide_notification<br/>LLM으로 전송 여부 판단]
    Decide --> Check{should_send?}
    Check -->|Yes| Write[write_notification<br/>1줄 메시지 생성]
    Check -->|No| End1([END<br/>message=None])
    Write --> Eval[evaluate_notification<br/>하드코딩 평가]
    Eval --> End2([END<br/>알림 메시지 반환])
    
    style Decide fill:#e1f5ff
    style Write fill:#e1f5ff
    style Eval fill:#fff4e1
```

**상세 흐름:**
- `decide_notification`: 일기/캘린더 이벤트를 종합하여 LLM이 알림 전송 여부 판단
- `write_notification`: 전송이 결정되면 친근한 1줄 질문 메시지 생성
- `evaluate_notification`: 메시지 품질 평가 (하드코딩, 그래프 외부)

---

## 2. Report Service

### 2.1 인사이트 추출 그래프

```mermaid
graph TD
    Start([일기 데이터 입력]) --> InitState[초기 State<br/>diary_entries, period]
    InitState --> Analyze[analyze_diary_data<br/>일기 데이터 전처리 및 분석]
    Analyze --> FindInsights[find_insights<br/>패턴/트렌드 인사이트 추출]
    FindInsights --> End1([END<br/>insights 반환])
    
    style Analyze fill:#e1f5ff
    style FindInsights fill:#e1f5ff
```

### 2.2 리포트 생성 및 평가 그래프

```mermaid
graph TD
    Start([인사이트 확보]) --> BatchSum[summarize_insights_batch<br/>인사이트 자연어 1줄 요약<br/>배치 처리]
    BatchSum --> WriteLoop{리포트 작성<br/>최대 3회 시도}
    WriteLoop --> Write[write_report<br/>리포트 문장 생성<br/>요약 + 본론 2문단]
    Write --> EvalGraph[평가 그래프 실행]
    
    subgraph EvalGraph [평가 그래프]
        EvalStart --> Quality[evaluate_quality<br/>유용성/명확성 평가]
        Quality --> Safety[evaluate_safety<br/>안전성/윤리 평가]
        Safety --> Finalize[finalize_evaluation<br/>종합 점수 계산]
        Finalize --> EvalEnd
    end
    
    EvalGraph --> Check{수용 가능?<br/>overall_score >= 0.7}
    Check -->|Yes| Success([✅ 성공<br/>리포트 반환])
    Check -->|No & 재시도 가능| Retry{재시도 횟수<br/>남음?}
    Retry -->|Yes| WriteLoop
    Retry -->|No| BestSelect[최고 점수<br/>리포트 선택]
    BestSelect --> End2([⚠️ 경고<br/>기준 미달 리포트 반환])
    
    style Write fill:#e1f5ff
    style Quality fill:#ffe1f5
    style Safety fill:#ffe1f5
    style Finalize fill:#fff4e1
```

### 2.3 전체 리포트 생성 플로우

```mermaid
graph TD
    Start([일기 데이터 입력]) --> Extract[인사이트 추출 그래프]
    Extract --> Insights{인사이트<br/>있음?}
    Insights -->|No| Fail([❌ 실패<br/>기본 메시지 반환])
    Insights -->|Yes| Parallel[병렬 처리]
    
    subgraph Parallel [병렬 처리]
        SumBatch[summarize_insights_batch<br/>인사이트 요약]
        ReportGen[리포트 생성 및 평가]
    end
    
    Parallel --> Merge[최종 리포트 생성<br/>요약된 insights + report]
    Merge --> Save([DB 저장])
    
    style Extract fill:#e1f5ff
    style SumBatch fill:#e1f5ff
    style ReportGen fill:#e1f5ff
```

---

## 3. 전체 시스템 아키텍처

```mermaid
graph TB
    subgraph Mobile["Mobile App (React Native)"]
        UI[UI Layer]
        API[API Client]
    end
    
    subgraph Backend["Backend (FastAPI)"]
        Routes[API Routes]
        Repo[Repository Layer<br/>Firestore]
    end
    
    subgraph Services["Services (LangGraph)"]
        Notification[Notification Service]
        Report[Report Service]
        Extractor[Extractor Service<br/>Topic/Emotion 추출]
    end
    
    subgraph LLM["LLM (Upstage)"]
        ChatLLM[ChatUpstage<br/>Chat Completion]
    end
    
    UI --> API
    API --> Routes
    Routes --> Repo
    Routes --> Notification
    Routes --> Report
    Routes --> Extractor
    
    Notification --> ChatLLM
    Report --> ChatLLM
    Extractor --> ChatLLM
    
    Repo --> Firestore[(Firestore DB)]
    
    style Notification fill:#e1f5ff
    style Report fill:#e1f5ff
    style Extractor fill:#e1f5ff
    style ChatLLM fill:#fff4e1
```

---

## 4. 주요 State 구조

### NotificationDecisionState
```typescript
{
  current_time: str
  calendar_events: List[Dict]
  diary_entries: List[Dict]
  messages: List[Dict]
  new_diary_entry: Dict
  should_send: Optional[bool]
  send_time: Optional[str]
  message: Optional[str]
  reason: Optional[str]
  evaluation_score: Optional[float]
}
```

### ReportGenerationState
```typescript
{
  diary_entries: List[Dict]
  period_start: str
  period_end: str
  insights: Optional[List[Dict]]
  report: Optional[str]
  summary: Optional[str]
}
```

### ReportEvaluationState
```typescript
{
  report: str
  diary_entries: List[Dict]
  period_start: str
  period_end: str
  quality_score: Optional[float]
  quality_feedback: Optional[str]
  quality_issues: Optional[List[str]]
  safety_score: Optional[float]
  safety_feedback: Optional[str]
  safety_issues: Optional[List[str]]
  overall_score: Optional[float]
  is_acceptable: Optional[bool]
  needs_revision: Optional[bool]
}
```
