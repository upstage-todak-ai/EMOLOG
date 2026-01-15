from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import diary, stats, log, calendar, extractor, report, notification
from app.core.firebase import initialize_firebase
from app.core.logging import setup_logging

# 로깅 시스템 초기화 (가장 먼저 실행)
setup_logging()

# FastAPI 앱 생성 (서버의 심장)
app = FastAPI(
    title="EmoLog Backend",
    description="EmoLog 일기 앱 백엔드 API",
    version="0.1.0"
)

# CORS 설정 (프론트엔드와 통신하기 위해 필수)
# CORS = Cross-Origin Resource Sharing (다른 도메인에서 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용: 모든 도메인 허용 (나중에 특정 도메인으로 제한)
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용 (GET, POST, PUT, DELETE 등)
    allow_headers=["*"],  # 모든 헤더 허용
)

# Firebase 초기화 (서버 시작 시)
initialize_firebase()

# API 라우터 등록
app.include_router(diary.router)
app.include_router(stats.router)
app.include_router(log.router)
app.include_router(calendar.router)
app.include_router(extractor.router)
app.include_router(report.router)
app.include_router(notification.router)

@app.get("/")
def read_root():
    """
    루트 경로 (/) 접속 시 보여줄 메시지
    """
    return {
        "message": "EmoLog Backend is running!",
        "version": "0.1.0"
    }

@app.get("/health")
def health_check():
    """
    헬스 체크 엔드포인트
    서버가 정상 작동하는지 확인하는 용도
    """
    return {"status": "healthy"}
