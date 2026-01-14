# Firebase 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `todak-ai`)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

## 2. Firestore 데이터베이스 생성

1. Firebase Console에서 생성한 프로젝트 선택
2. 왼쪽 메뉴에서 "Firestore Database" 클릭
3. "데이터베이스 만들기" 클릭
4. 보안 규칙 선택:
   - **테스트 모드**: 개발 중에는 테스트 모드로 시작 (30일 후 자동 만료)
   - **프로덕션 모드**: 프로덕션 규칙 설정 필요
5. 위치 선택 (가장 가까운 리전 선택, 예: `asia-northeast3` - 서울)
6. "사용 설정" 클릭

## 3. 서비스 계정 키 다운로드

1. Firebase Console에서 프로젝트 설정(⚙️) 클릭
2. "서비스 계정" 탭 선택
3. "새 비공개 키 생성" 버튼 클릭
4. JSON 파일이 자동으로 다운로드됨
5. 다운로드한 JSON 파일을 프로젝트의 `firebase-credentials/` 디렉토리에 복사
   ```bash
   # 예시
   cp ~/Downloads/your-project-firebase-adminsdk-xxxxx.json ./firebase-credentials/firebase-service-account-key.json
   ```

## 4. .env 파일 설정

`.env` 파일을 열고 Firebase 키 파일 경로를 설정:

```env
FIREBASE_CREDENTIALS_PATH=./firebase-credentials/firebase-service-account-key.json
```

또는 JSON 내용을 직접 설정 (한 줄로):

```env
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id",...}
```

## 5. 서버 재시작

Firebase 설정 후 서버를 재시작하면 Firebase가 자동으로 초기화됩니다:

```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버 시작 시 다음과 같은 메시지가 보이면 성공:
```
✅ Firebase 초기화 완료 (파일 경로 사용): ./firebase-credentials/firebase-service-account-key.json
```

## 6. 테스트

Firebase 설정이 완료되면 API 테스트:

```bash
# 일기 생성 테스트
curl -X POST http://localhost:8000/api/diary/ \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "date": "2024-01-15T10:00:00",
    "content": "테스트 일기입니다.",
    "emotion": "JOY"
  }'

# 일기 조회 테스트
curl "http://localhost:8000/api/diary/?user_id=test_user"
```

## 7. Firestore 데이터 확인

Firebase Console에서 데이터 확인:

1. Firestore Database → 데이터 탭
2. `diaries` 컬렉션 확인
3. 생성된 일기 문서 확인

## 문제 해결

### Firebase 초기화 실패
- 키 파일 경로가 정확한지 확인
- 키 파일이 올바른 JSON 형식인지 확인
- `.env` 파일의 경로가 상대 경로인 경우 프로젝트 루트에서 실행하는지 확인

### 503 에러 발생
- Firebase가 제대로 초기화되었는지 서버 로그 확인
- Firestore 데이터베이스가 생성되었는지 확인
- 서비스 계정 키에 Firestore 권한이 있는지 확인

### 권한 오류
- Firebase Console에서 서비스 계정에 Firestore 읽기/쓰기 권한이 있는지 확인
- Firestore 보안 규칙이 올바르게 설정되었는지 확인
