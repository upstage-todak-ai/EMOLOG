# API 구현 상태 문서

## 화면별 API 목록 및 구현 상태

### 화면 구성 (README 기준)
1. **홈화면**: 메모장 → +버튼으로 메모 추가
2. **Log 화면**: 메모를 토대로 자동으로 주제와 감정을 추출한 log 보기
3. **통계화면**: 감정과 주제에 대한 수치적 통계, 기간별 리포트

---

## 1. 홈화면 (메모) API

### 1.1 일기 목록 조회
- **엔드포인트**: `GET /api/diary?user_id={user_id}`
- **기능**: 사용자의 모든 일기 목록 조회 (최신순)
- **구현 상태**: ✅ 완료
  - **Schema**: `app/models/schemas.py::DiaryEntry` (List)
  - **Repository**: `app/repository/diary_repository.py::DiaryRepository.get_by_user_id()`
  - **Route**: `app/api/routes/diary.py::get_diaries()`
- **구현 파일**:
  - `app/models/schemas.py:37-43` - DiaryEntry 모델
  - `app/repository/diary_repository.py:66-78` - get_by_user_id() 메서드
  - `app/api/routes/diary.py:40-61` - get_diaries() 엔드포인트

### 1.2 일기 생성
- **엔드포인트**: `POST /api/diary/`
- **기능**: 새 일기 작성
- **구현 상태**: ✅ 완료
  - **Schema**: `DiaryEntryCreate` → `DiaryEntry`
  - **Repository**: `DiaryRepository.create()`
  - **Route**: `diary.py::create_diary()`
- **구현 파일**:
  - `app/models/schemas.py:28-30` - DiaryEntryCreate 모델
  - `app/repository/diary_repository.py:29-56` - create() 메서드
  - `app/api/routes/diary.py:11-37` - create_diary() 엔드포인트

### 1.3 일기 수정
- **엔드포인트**: `PUT /api/diary/{diary_id}`
- **기능**: 기존 일기 내용/감정 수정
- **구현 상태**: ✅ 완료
  - **Schema**: `DiaryEntryUpdate` → `DiaryEntry`
  - **Repository**: `DiaryRepository.update()`
  - **Route**: `diary.py::update_diary()`
- **구현 파일**:
  - `app/models/schemas.py:32-35` - DiaryEntryUpdate 모델
  - `app/repository/diary_repository.py:79-101` - update() 메서드
  - `app/api/routes/diary.py:91-117` - update_diary() 엔드포인트

### 1.4 일기 삭제
- **엔드포인트**: `DELETE /api/diary/{diary_id}`
- **기능**: 일기 삭제
- **구현 상태**: ✅ 완료
  - **Repository**: `DiaryRepository.delete()`
  - **Route**: `diary.py::delete_diary()`
- **구현 파일**:
  - `app/repository/diary_repository.py:103-110` - delete() 메서드
  - `app/api/routes/diary.py:120-144` - delete_diary() 엔드포인트

### 1.5 특정 일기 조회
- **엔드포인트**: `GET /api/diary/{diary_id}`
- **기능**: 일기 ID로 특정 일기 조회
- **구현 상태**: ✅ 완료 (현재 프론트엔드에서 미사용)
  - **Repository**: `DiaryRepository.get_by_id()`
  - **Route**: `diary.py::get_diary()`
- **구현 파일**:
  - `app/repository/diary_repository.py:58-64` - get_by_id() 메서드
  - `app/api/routes/diary.py:64-88` - get_diary() 엔드포인트

---

## 2. Log 화면 API

### 2.1 일기 목록 조회
- **엔드포인트**: `GET /api/diary?user_id={user_id}`
- **기능**: 모든 일기 목록 조회 (홈화면과 동일)
- **구현 상태**: ✅ 완료 (1.1과 동일)

### 2.2 Log 추출 (주제/감정)
- **엔드포인트**: `POST /api/log/extract`
- **기능**: 일기 내용에서 주제와 감정 자동 추출
- **구현 상태**: ✅ 완료
  - **Schema**: `LogExtractRequest` → `LogExtractResponse`
  - **Service**: `log_extractor.py::extract_topic_and_emotion()`
  - **Route**: `log.py::extract_log()`
- **구현 파일**:
  - `app/models/schemas.py:127-134` - LogExtractRequest, LogExtractResponse 모델
  - `app/service/log_extractor.py:17-104` - extract_topic_and_emotion() 함수 (LLM 기반)
  - `app/api/routes/log.py:9-31` - extract_log() 엔드포인트
- **참고**: 현재 프론트엔드는 키워드 기반 fallback 사용 중 (`HomeScreen.tsx:129-146`)

---

## 3. 통계화면 API

### 3.1 통계 조회
- **엔드포인트**: `GET /api/stats?user_id={user_id}&period={week|month}`
- **기능**: 감정별/주제별 통계 수치 반환
- **응답 구조**:
  ```json
  {
    "emotion_stats": [{"emotion": "JOY", "count": 5}, ...],
    "topic_stats": [{"topic": "학업", "count": 3}, ...],
    "total_count": 10
  }
  ```
- **구현 상태**: ✅ 완료
  - **Schema**: `StatsResponse` (EmotionStats, TopicStats 포함)
  - **Repository**: `DiaryRepository.get_by_user_id()` (재사용)
  - **Service**: `stats.py::get_stats()` (로직 포함)
  - **Route**: `stats.py::get_stats()`
- **구현 파일**:
  - `app/models/schemas.py:102-116` - StatsResponse, EmotionStats, TopicStats 모델
  - `app/repository/diary_repository.py:66-78` - get_by_user_id() (재사용)
  - `app/api/routes/stats.py:12-28` - extract_topic_from_content() 헬퍼 함수
  - `app/api/routes/stats.py:31-54` - filter_by_period() 헬퍼 함수
  - `app/api/routes/stats.py:57-120` - get_stats() 엔드포인트

### 3.2 리포트 조회
- **엔드포인트**: `GET /api/stats/report?user_id={user_id}&period={week|month}`
- **기능**: 기간별 감정 패턴 분석 스토리텔링 레포트
- **응답 구조**:
  ```json
  {
    "title": "지난 주의 감정 레포트",
    "content": "지난 주 동안 총 10개의 감정을 기록했습니다...",
    "period": "week"
  }
  ```
- **구현 상태**: ✅ 완료
  - **Schema**: `ReportResponse`
  - **Repository**: `DiaryRepository.get_by_user_id()` (재사용)
  - **Service**: `stats.py::get_report()` (로직 포함)
  - **Route**: `stats.py::get_report()`
- **구현 파일**:
  - `app/models/schemas.py:118-122` - ReportResponse 모델
  - `app/repository/diary_repository.py:66-78` - get_by_user_id() (재사용)
  - `app/api/routes/stats.py:123-230` - get_report() 엔드포인트

---

## 구현 레이어별 상세 상태

### Schemas (`app/models/schemas.py`)
✅ **완료된 모델**:
- `Emotion` (Enum) - 감정 타입
- `DiaryEntry`, `DiaryEntryCreate`, `DiaryEntryUpdate` - 일기 관련
- `LogExtractRequest`, `LogExtractResponse` - Log 추출 관련
- `StatsResponse`, `ReportResponse`, `EmotionStats`, `TopicStats` - 통계 관련
- `CalendarEventType`, `CalendarEvent`, `CalendarEventCreate` - 캘린더 관련 (스키마만 존재)
- `AgentRequest`, `AgentResponse` - 에이전트 관련 (스키마만 존재)

### Repository (`app/repository/diary_repository.py`)
✅ **완료된 메서드**:
- `DiaryRepository.__init__()` - Firebase 초기화
- `DiaryRepository.create()` - 일기 생성
- `DiaryRepository.get_by_id()` - ID로 일기 조회
- `DiaryRepository.get_by_user_id()` - 사용자별 일기 목록 조회
- `DiaryRepository.update()` - 일기 수정
- `DiaryRepository.delete()` - 일기 삭제
- `DiaryRepository._doc_to_diary_entry()` - Firestore 문서 변환

⚠️ **미구현**:
- `CalendarRepository` - 캘린더 이벤트 저장소 (스키마만 존재)

### Service (`app/service/`)
✅ **완료된 서비스**:
- `log_extractor.py::extract_topic_and_emotion()` - LLM 기반 주제/감정 추출
- `log_extractor.py::_extract_by_keyword()` - 키워드 기반 fallback
- `calendar_classifier.py::classify_calendar_event_type()` - LLM 기반 캘린더 이벤트 분류

⚠️ **개선 필요**:
- `stats.py`의 통계/레포트 로직이 Route에 직접 구현됨
  - `extract_topic_from_content()` - Service로 이동 권장
  - `filter_by_period()` - Service로 이동 권장
  - 통계 계산 로직 - `stats_service.py`로 분리 권장

### Routes (`app/api/routes/`)
✅ **완료된 라우터**:
- `diary.py` - 일기 CRUD (5개 엔드포인트)
- `log.py` - Log 추출 (1개 엔드포인트)
- `stats.py` - 통계 및 리포트 (2개 엔드포인트)

⚠️ **미구현 라우터**:
- `calendar.py` - 캘린더 이벤트 API (스키마만 존재)

---

## 구현 상태 요약

### 완료된 API (8개)
1. ✅ `GET /api/diary` - 일기 목록 조회
2. ✅ `POST /api/diary/` - 일기 생성
3. ✅ `PUT /api/diary/{diary_id}` - 일기 수정
4. ✅ `DELETE /api/diary/{diary_id}` - 일기 삭제
5. ✅ `GET /api/diary/{diary_id}` - 특정 일기 조회
6. ✅ `POST /api/log/extract` - Log 추출
7. ✅ `GET /api/stats` - 통계 조회
8. ✅ `GET /api/stats/report` - 리포트 조회

### 구현 완료율
- **필수 API**: 8/8 (100%)
- **Schemas**: 완료
- **Repository**: 일기 관련 완료, 캘린더 미구현
- **Service**: Log 추출 완료, 통계 로직은 Route에 포함
- **Routes**: 필수 API 완료, 캘린더 미구현

---

## 개선 제안사항

### 1. Service 레이어 분리 (권장)
**현재 상태**: `stats.py`의 통계/레포트 로직이 Route에 직접 구현됨

**제안**:
- `app/service/stats_service.py` 생성
- `extract_topic_from_content()` → `StatsService.extract_topic()`
- `filter_by_period()` → `StatsService.filter_by_period()`
- 통계 계산 로직 → `StatsService.calculate_stats()`
- 레포트 생성 로직 → `StatsService.generate_report()`

**이점**:
- 비즈니스 로직과 API 레이어 분리
- 테스트 용이성 향상
- 재사용성 향상

### 2. Log 추출 최적화 (선택사항)
**현재 상태**: 프론트엔드에서 일기마다 개별 호출 가능성

**제안**:
- 배치 추출 API 추가: `POST /api/log/extract/batch`
- 요청: `{"contents": ["일기1", "일기2", ...]}`
- 응답: `[{"topic": "...", "emotion": "..."}, ...]`

**이점**:
- 네트워크 요청 수 감소
- LLM API 호출 최적화

### 3. 캘린더 이벤트 API 구현 (미구현)
**현재 상태**: 스키마만 존재, Repository/Route 미구현

**필요한 API**:
- `GET /api/calendar/events?user_id={user_id}&start_date={date}&end_date={date}` - 캘린더 이벤트 조회
- `POST /api/calendar/events` - 캘린더 이벤트 생성
- `PUT /api/calendar/events/{event_id}` - 캘린더 이벤트 수정
- `DELETE /api/calendar/events/{event_id}` - 캘린더 이벤트 삭제

**구현 필요**:
- `app/repository/calendar_repository.py` 생성
- `app/api/routes/calendar.py` 생성
- `main.py`에 라우터 등록

---

## 다음 단계

### 즉시 구현 가능한 개선사항
1. **Service 레이어 분리**: `stats_service.py` 생성 및 로직 이동
2. **캘린더 API 구현**: README의 "캘린더 일정 기반 알림" 기능을 위한 API

### 선택적 개선사항
1. **배치 Log 추출 API**: 성능 최적화를 위한 배치 처리
2. **에러 처리 개선**: 더 구체적인 에러 메시지 및 상태 코드

---

## 참고사항

- 모든 필수 API가 구현되어 있어 현재 화면 기능은 정상 동작 가능
- Service 레이어 분리는 코드 품질 향상을 위한 권장사항
- 캘린더 API는 README에 명시된 기능이지만 현재 미구현 상태
