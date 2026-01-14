import os
from dotenv import load_dotenv

# .env 파일에서 환경 변수 불러오기
load_dotenv()

class Settings:
    """
    애플리케이션 설정 클래스
    환경 변수나 기본값을 저장하는 곳
    """
    # Upstage API 키 (AI 모델 사용을 위해 필요)
    UPSTAGE_API_KEY: str = os.getenv("UPSTAGE_API_KEY", "")
    
    # 데이터베이스 URL (SQLite 사용, 나중에 PostgreSQL로 변경 가능)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./todak.db")
    
    # Firebase 설정
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    FIREBASE_CREDENTIALS_JSON: str = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
    
    # 서버 설정
    HOST: str = os.getenv("HOST", "0.0.0.0")  # 모든 네트워크 인터페이스에서 접근 허용
    PORT: int = int(os.getenv("PORT", "8000"))  # 기본 포트 8000
    
    # 로깅 설정
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")  # DEBUG/INFO/WARNING/ERROR/CRITICAL
    LOG_FILE_PATH: str = os.getenv("LOG_FILE_PATH", "")  # 로그 파일 경로 (선택사항)
    LOG_TO_FILE: str = os.getenv("LOG_TO_FILE", "false")  # 파일 로깅 활성화 여부 (true/false)

# 설정 인스턴스 생성 (다른 파일에서 import해서 사용)
settings = Settings()
