# [팀] 프로젝트 핵심 증빙

## 1-1. 서비스 정의 및 기술 스택

### 서비스명/한줄 정의
**EmoLog - 감정 일기 및 회고 유도 서비스**  
캘린더 일정을 분석하여 적절한 타이밍에 감정 메모 작성을 유도하고, 누적된 데이터를 기반으로 패턴을 분석하여 스토리텔링 리포트를 제공하는 서비스

### 핵심 기술 스택
- **백엔드**: FastAPI, LangGraph, Upstage LLM, Firebase Firestore
- **모바일**: React Native (Expo), TypeScript
- **AI/ML**: LangChain, LangGraph (워크플로우 오케스트레이션)
- **인프라**: Firebase (DB), AsyncStorage (로컬 저장)

### 팀원별 역할
*(실제 팀원 정보가 없어 예시 형식으로 작성)*
- 백엔드 설계: LangGraph 워크플로우 설계 및 State 관리
- Repository 레이어: Firebase 연동 및 데이터 영속성 로직
- Service 레이어: Extractor, Report, Notification 서비스 구현
- API Routes: RESTful API 엔드포인트 설계 및 구현
- 모바일 앱: React Native 화면 구성 및 백엔드 연동
- LLM 프롬프트: 감정/주제 추출 및 리포트 생성 프롬프트 최적화

---

## 1-2. 아키텍처 및 워크플로우

### System Architecture

```
app/
├── api/routes/          # REST API 엔드포인트
│   ├── diary.py        # 일기 CRUD
│   ├── stats.py        # 통계 조회
│   ├── report.py       # 리포트 생성
│   └── notification.py # 알림 판단
├── core/               # 핵심 설정
│   ├── config.py       # 환경 변수
│   ├── firebase.py     # Firebase 초기화
│   └── logging.py      # 로깅 시스템
├── models/             # 데이터 모델 (Pydantic)
│   └── schemas.py      # Request/Response 스키마
├── repository/         # 데이터 접근 계층
│   ├── diary_repository.py
│   └── calendar_repository.py
├── service/            # 비즈니스 로직
│   ├── extractor_service.py    # 감정/주제 추출
│   └── calendar_classifier.py  # 캘린더 이벤트 분류
└── services/           # LangGraph 기반 워크플로우
    ├── notification/   # 알림 판단 워크플로우
    └── report/         # 리포트 생성 워크플로우

mobile/
├── screens/            # 화면 컴포넌트
├── services/           # API 호출 로직
└── types/              # TypeScript 타입 정의
```

### Super Graph Workflow

**리포트 생성 워크플로우 (LangGraph)**
```
analyze_diary_data → find_insights → write_report → END
```

**알림 판단 워크플로우 (LangGraph)**
```
decide_notification → write_notification_message → END
```

**감정/주제 추출 워크플로우 (LangGraph)**
```
extract_info → END
```

---

## 1-3. 팀 차원의 종합 KPT

### Keep (우리가 잘했고, 다음에도 유지할 것)

#### [기술]
- **Layered Architecture 엄격히 준수**: API ↔ Repository ↔ Service 계층 분리로 변경 영향 최소화
  - 예: `diary_repository.py`에서 DB 스키마 변경 시 API 라우트(`diary.py`) 수정 불필요
- **Repository Pattern 일관 적용**: Firebase 로직을 Repository에 집중, 다른 저장소로 교체 용이
- **LangGraph로 복잡한 워크플로우 관리**: 리포트 생성/알림 판단의 다단계 로직을 그래프로 명확화
- **Pydantic 모델로 타입 안전성 확보**: Request/Response 스키마 검증 자동화
- **백그라운드 작업 분리**: 일기 저장 후 감정 추출을 `BackgroundTasks`로 처리하여 응답 속도 개선

#### [협업/프로세스]
- **코딩 컨벤션 문서화**: `docs/coding-convention.md`로 코드 스타일 일관성 유지
- **API 구현 상태 문서화**: `API_IMPLEMENTATION_STATUS.md`로 개발 현황 공유
- **모듈별 독립 개발 가능**: Repository/Service/API 분리로 병렬 작업 가능
- **Firebase 설정 가이드 제공**: `FIREBASE_SETUP.md`로 온보딩 시간 단축

### Problem (우리가 겪은 어려움과 개선이 필요한 점)

#### [기술]
- **주제 추출 로직의 이중화**: DB 저장용 추출(`extractor_service.py`)과 통계용 추출(`stats.py`의 `extract_topic_from_content`) 중복
  - 개선: 추출 로직을 Service로 통합하고 API는 호출만 수행
- **통계 로직이 API에 직접 구현**: `stats.py`에 비즈니스 로직이 포함됨
  - 개선: `stats_service.py`로 분리하여 Service 레이어 일관성 확보
- **LLM 응답 파싱 안정성**: JSON 추출 시 다양한 형식(```json, ```, {...}) 처리 부담
  - 개선: 프롬프트 엔지니어링으로 JSON 형식 일관성 확보
- **모바일 캘린더 동기화 미구현**: 백엔드 API는 준비되어 있으나 모바일에서 디바이스 캘린더 읽기 미구현
  - 영향: 알림 판단 시 캘린더 정보 활용 불가

#### [협업/프로세스]
- **프론트엔드-백엔드 통합 테스트 부족**: API 수준 단위 테스트 위주, E2E 테스트 미흡
- **환경 변수 관리 분산**: `.env` 파일 누락 시 에러 메시지로만 디버깅 가능
- **문서와 코드 불일치**: `API_IMPLEMENTATION_STATUS.md`에 캘린더 API 미구현으로 기록했으나 실제 구현됨

### Try (다음 프로젝트에서 시도할 구체적인 액션)

#### [기술]
- **Service 레이어 일관성 확보**: 비즈니스 로직을 API Routes에서 Service로 이동
  - 예: `stats.py`의 통계 계산 로직 → `stats_service.py`로 분리
- **LLM 응답 파싱 안정화**: Pydantic 모델로 LLM 응답 검증 및 구조화
- **LangGraph 시각화 도구 활용**: `app.get_graph().draw_mermaid()`로 워크플로우 문서화
- **캘린더 동기화 기능 구현**: `expo-calendar`로 디바이스 캘린더 읽기 → 백엔드 동기화
- **E2E 테스트 도입**: API + 모바일 통합 테스트로 사용자 시나리오 검증

#### [협업/프로세스]
- **프로젝트 시작 전 Ground Rule 수립**: 레이어 역할, API 스펙 정의, 환경 설정 절차 명문화
- **CI/CD 파이프라인 구축**: API 자동 테스트 및 문서 갱신 워크플로우
- **코드 리뷰 체크리스트**: 레이어 분리 준수, 타입 안전성, 에러 처리 등 확인 사항 명시
- **주기적 아키텍처 리뷰**: 레이어 경계 점검 및 리팩토링 필요성 판단
- **환경별 설정 템플릿 제공**: `.env.example`과 초기 설정 가이드로 온보딩 시간 단축

---

## 추가 자료

### 주요 구현 파일
- `app/services/report/report_service.py` - 리포트 생성 워크플로우
- `app/services/notification/notification_service.py` - 알림 판단 워크플로우
- `app/service/extractor_service.py` - 감정/주제 추출 워크플로우
- `app/api/routes/stats.py` - 통계 API
- `mobile/screens/StatsScreen.tsx` - 통계 화면

### 핵심 성과
- ✅ LangGraph 기반 3개 워크플로우 구현 (Extractor, Report, Notification)
- ✅ Layered Architecture로 유지보수성 확보
- ✅ Pydantic 기반 타입 안전성 확보
- ✅ Firebase Repository 패턴으로 데이터 접근 추상화
