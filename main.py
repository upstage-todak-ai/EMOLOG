from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.api.routes import diary, stats, log, calendar
# extractor, report는 langgraph가 필요하므로 일단 주석 처리
# from app.api.routes import extractor, report
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

# 정적 파일 서빙 설정 (React 빌드 결과물)
frontend_dist = Path(__file__).parent / "frontend" / "dist"
if frontend_dist.exists():
    # 정적 파일 (CSS, JS, 이미지 등) 서빙
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
    
    # SPA 라우팅을 위한 catch-all 라우트
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """
        SPA 라우팅 지원
        API 경로가 아닌 모든 요청은 React 앱의 index.html을 반환
        """
        # API 경로는 제외
        if full_path.startswith("api/") or full_path == "health":
            return {"message": "Not found"}
        
        # index.html 반환
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend not built. Run 'cd frontend && npm run build'"}
else:
    # 프론트엔드가 빌드되지 않은 경우
    @app.get("/")
    def read_root():
        """
        루트 경로 (/) 접속 시 보여줄 메시지
        프론트엔드가 빌드되지 않은 경우 표시
        """
        return {
            "message": "EmoLog Backend is running!",
            "note": "Frontend not built. Run 'cd frontend && npm run build' to serve the frontend."
        }

@app.get("/health")
def health_check():
    """
    헬스 체크 엔드포인트
    서버가 정상 작동하는지 확인하는 용도
    """
    return {"status": "healthy"}
