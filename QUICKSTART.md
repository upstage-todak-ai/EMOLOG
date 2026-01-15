# EmoLog 빠른 시작 가이드

## 사전 준비사항

1. **Python 3.12 이상** 설치 확인
2. **uv** 패키지 매니저 설치 확인
3. **Node.js** 및 **npm** 설치 확인
4. **Firebase 프로젝트** 설정 (선택사항 - 백엔드 실행 시 필요)

## 1. 백엔드 서버 실행

### 1-1. 의존성 설치

```bash
# 프로젝트 루트에서 실행
uv sync
```

### 1-2. 환경 변수 설정 (선택사항)

`.env` 파일을 생성하고 필요한 환경 변수를 설정합니다:

```bash
# .env 파일 생성
touch .env
```

`.env` 파일 내용 예시:
```env
# Firebase 설정 (Firebase 사용 시)
FIREBASE_CREDENTIALS_PATH=./firebase-credentials/firebase-service-account-key.json

# Upstage API 키 (AI 기능 사용 시)
UPSTAGE_API_KEY=your-upstage-api-key

# 서버 설정 (선택사항)
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
```

> **참고**: Firebase 설정이 없어도 서버는 실행되지만, 데이터베이스 기능은 사용할 수 없습니다.
> Firebase 설정 방법은 `FIREBASE_SETUP.md` 파일을 참고하세요.

### 1-3. 서버 실행

```bash
# 방법 1: uv를 사용하여 실행
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 방법 2: 가상환경 활성화 후 실행
source .venv/bin/activate  # 또는 uv venv 활성화
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 정상적으로 실행되면:
- API 문서: http://localhost:8000/docs
- 헬스 체크: http://localhost:8000/health
- 루트: http://localhost:8000/

## 2. 모바일 앱 실행

### 2-1. 모바일 앱 디렉토리로 이동

```bash
cd mobile
```

### 2-2. 의존성 설치

```bash
npm install
```

### 2-3. 앱 실행

```bash
# Expo 개발 서버 시작
npm start

# 또는 특정 플랫폼으로 실행
npm run ios      # iOS 시뮬레이터
npm run android  # Android 에뮬레이터
npm run web      # 웹 브라우저
```

### 2-4. 환경 변수 설정 (선택사항)

`mobile/.env` 파일을 생성하여 API URL을 설정할 수 있습니다:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

> **참고**: 
> - iOS 시뮬레이터: `localhost` 사용 가능
> - Android 에뮬레이터: `10.0.2.2` 사용 필요
> - 실제 기기: 개발자의 로컬 IP 주소 필요 (예: `http://192.168.0.100:8000`)

## 3. 전체 실행 순서

1. **터미널 1**: 백엔드 서버 실행
   ```bash
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **터미널 2**: 모바일 앱 실행
   ```bash
   cd mobile
   npm start
   ```

## 문제 해결

### 백엔드 실행 오류

- **의존성 설치 오류**: `uv sync` 재실행
- **포트 충돌**: `.env` 파일에서 `PORT` 변경
- **Firebase 오류**: `FIREBASE_SETUP.md` 참고

### 모바일 앱 실행 오류

- **의존성 설치 오류**: `rm -rf node_modules package-lock.json && npm install`
- **API 연결 오류**: `mobile/config/api.ts`에서 API URL 확인
- **Expo 오류**: `npx expo install --fix` 실행

## 추가 정보

- 코딩 컨벤션: `docs/coding-convention.md`
- Firebase 설정: `FIREBASE_SETUP.md`
- API 구현 상태: `API_IMPLEMENTATION_STATUS.md`
- 버그 수정 내역: `BUGFIXES.md`
