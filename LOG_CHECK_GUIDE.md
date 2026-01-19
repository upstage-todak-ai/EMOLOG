# 로그 확인 가이드

## 백엔드 서버 재시작 방법

### 1. 터미널 열기
- 터미널 앱을 실행하거나
- VS Code나 Cursor에서 터미널 탭 열기

### 2. 프로젝트 폴더로 이동
```bash
cd /Users/marine/Desktop/upstage/EMOLOG/EMOLOG
```

### 3. 백엔드 서버 시작
```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 서버가 실행 중인 경우
- 기존 서버 터미널에서 `Ctrl + C`를 눌러 중지
- 위 명령을 다시 실행

### 5. "Address already in use" 에러 발생 시 (포트 충돌)

서버를 시작할 때 `ERROR: [Errno 48] Address already in use` 에러가 발생하면, 포트 8000을 사용하는 프로세스를 종료해야 합니다.

#### 방법 1: 포트를 사용하는 프로세스 찾아서 종료
```bash
# 포트 8000을 사용하는 프로세스 ID 확인
lsof -ti:8000

# 프로세스 종료 (위 명령의 결과로 나온 숫자를 사용)
kill -9 [프로세스ID]

# 또는 한 번에 종료
lsof -ti:8000 | xargs kill -9
```

#### 방법 2: 모든 uvicorn 프로세스 종료
```bash
# 모든 uvicorn 프로세스 강제 종료
pkill -9 uvicorn
```

#### 방법 3: Python 프로세스 확인 후 종료
```bash
# 실행 중인 Python/uvicorn 프로세스 확인
ps aux | grep -E "(uvicorn|python.*main)" | grep -v grep

# 특정 프로세스 ID 종료
kill -9 [프로세스ID]
```

#### 확인: 포트가 비어있는지 확인
```bash
# 포트 8000이 비어있는지 확인 (아무것도 출력되지 않으면 비어있음)
lsof -ti:8000

# 또는
lsof -ti:8000 || echo "포트 8000이 비어있습니다"
```

포트가 비어있으면 서버를 다시 시작할 수 있습니다.

---

## 모바일 앱 재시작 방법

### 1. 새로운 터미널 열기
- 백엔드 서버와 별도의 터미널 필요

### 2. 모바일 폴더로 이동
```bash
cd /Users/marine/Desktop/upstage/EMOLOG/EMOLOG/mobile
```

### 3. 앱 시작
```bash
npm start
```

또는 iOS 시뮬레이터 사용 시:
```bash
npm run ios
```

---

## 로그 확인 방법

### 백엔드 서버 터미널에서 확인할 로그

통계 조회 시 다음과 같은 로그가 나타납니다:

1. **통계 조회 요청**
   ```
   [get_stats] 통계 조회 요청 - user_id=사용자ID, period=week
   ```

2. **데이터베이스 조회**
   ```
   [get_by_user_id] 일기 조회 시작 - user_id=사용자ID
   [get_by_user_id] Firestore 쿼리 결과 - 조회된 일기 수: X개
   ```

3. **기간 필터링**
   ```
   [get_stats] 기간 필터링 시작 - 전체일기=X개, period=week
   [filter_by_period] 필터링 완료 - 입력=X개, 필터링됨=Y개, 스킵됨=Z개
   ```

4. **문제 발생 시 경고 메시지**
   ```
   [get_stats] ⚠️ 경고: 전체 일기 X개가 있지만 기간 필터링 후 0개가 되었습니다.
   ```

### 모바일 앱 터미널에서 확인할 로그

1. **통계 로드 시작**
   ```
   [통계 로드] 시작 - userId: 사용자ID, period: week
   ```

2. **API 호출**
   ```
   [getStats] API 호출 - URL: http://...
   [getStats] 성공 - total_count: X, emotion_stats: Y개, topic_stats: Z개
   ```

3. **에러 발생 시**
   ```
   [통계 로드] getStats 실패: 에러 메시지
   [getStats] API 에러 - status: 500, error: 에러 내용
   ```

---

## 문제 해결 체크리스트

### 통계가 "데이터가 없어요"로 표시되는 경우

1. **백엔드 로그 확인**
   - `[get_by_user_id] Firestore 쿼리 결과 - 조회된 일기 수: 0개` 
     → 데이터베이스에 일기가 없음
   
   - `[get_by_user_id] Firestore 쿼리 결과 - 조회된 일기 수: X개` (X > 0)
     → 일기는 있지만 필터링 후 0개가 됨
   
   - `[filter_by_period] 필터링 완료 - 스킵됨=X개`
     → 날짜 파싱 실패로 일기가 제외됨

2. **모바일 앱 로그 확인**
   - `[getStats] API 에러` 
     → API 호출 실패
   
   - `[getStats] 성공 - total_count: 0`
     → API는 성공했지만 데이터가 0개

3. **해결 방법**
   - 전체 일기는 있지만 필터링 후 0개: 기간을 "30일"로 변경해보기
   - 날짜 파싱 실패: 백엔드 로그의 날짜 형식 확인
   - API 에러: 백엔드 서버가 실행 중인지 확인

---

## 로그 복사 방법

### 터미널에서 로그 복사
1. 마우스로 로그 텍스트 드래그
2. `Cmd + C`로 복사
3. 메모장이나 메시지에 붙여넣기

### 전체 로그 저장
```bash
# 백엔드 서버 로그를 파일로 저장
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1

# 모바일 앱 로그를 파일로 저장
npm start > mobile.log 2>&1
```
