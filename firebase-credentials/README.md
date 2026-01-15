# Firebase 서비스 계정 키 파일 저장 위치

이 디렉토리에 Firebase 서비스 계정 키 JSON 파일을 저장하세요.

## Firebase 프로젝트 설정 방법

1. Firebase Console (https://console.firebase.google.com) 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택
3. Firestore Database 생성 및 활성화
4. 프로젝트 설정 → 서비스 계정 탭으로 이동  
5. "새 비공개 키 생성" 클릭하여 JSON 파일 다운로드
6. 다운로드한 JSON 파일을 이 디렉토리에 복사
   예: `firebase-service-account-key.json`
7. `.env` 파일에 경로 설정:
   ```
   FIREBASE_CREDENTIALS_PATH=./firebase-credentials/firebase-service-account-key.json
   ```

## 보안 주의사항

- 이 디렉토리의 모든 파일은 `.gitignore`에 포함되어 Git에 커밋되지 않습니다.
- 절대로 Firebase 키 파일을 Git에 커밋하지 마세요.
- 키 파일이 유출되면 즉시 Firebase Console에서 키를 삭제하고 새로 생성하세요.
