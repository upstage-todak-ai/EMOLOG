"""
로깅 설정 모듈

Python 표준 logging 모듈을 사용한 체계적인 로깅 시스템을 제공합니다.
"""
import logging
import sys
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler
from app.core.config import settings

# 로그 디렉토리 경로
LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "app.log"

# 로그 디렉토리 생성
LOG_DIR.mkdir(exist_ok=True)


def setup_logging():
    """
    로깅 시스템 초기화
    
    환경 변수에 따라 로그 레벨과 출력 방식을 설정합니다.
    """
    # 로그 레벨 설정 (환경 변수 또는 기본값: INFO)
    log_level = getattr(settings, 'LOG_LEVEL', 'INFO').upper()
    log_to_file = getattr(settings, 'LOG_TO_FILE', 'false').lower() == 'true'
    
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))
    
    # 기존 핸들러 제거 (중복 방지)
    root_logger.handlers.clear()
    
    # 콘솔 핸들러 (항상 활성화)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level, logging.INFO))
    
    # 콘솔 포맷터
    console_format = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(name)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    root_logger.addHandler(console_handler)
    
    # 파일 핸들러 (환경 변수로 활성화)
    if log_to_file:
        # 로그 파일 로테이션 (최대 10MB, 백업 5개)
        file_handler = RotatingFileHandler(
            LOG_FILE,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(getattr(logging, log_level, logging.INFO))
        
        # 파일 포맷터 (더 상세한 정보 포함)
        file_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(name)s - %(funcName)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        root_logger.addHandler(file_handler)
    
    # 로깅 설정 완료 로그
    logger = logging.getLogger(__name__)
    logger.info(f"로깅 시스템 초기화 완료 - 레벨: {log_level}, 파일 로깅: {log_to_file}")


def get_logger(name: str) -> logging.Logger:
    """
    로거 인스턴스 가져오기
    
    Args:
        name: 로거 이름 (일반적으로 __name__ 사용)
    
    Returns:
        logging.Logger: 로거 인스턴스
    """
    return logging.getLogger(name)


# 로깅 헬퍼 함수들

def log_db_operation(
    logger: logging.Logger,
    action: str,
    resource_type: str,
    user_id: str,
    resource_id: str = None,
    **kwargs
):
    """
    데이터베이스 작업 로깅 헬퍼
    
    Args:
        logger: 로거 인스턴스
        action: 작업 타입 (create/update/delete/get)
        resource_type: 리소스 타입 (diary/calendar_event)
        user_id: 사용자 ID
        resource_id: 리소스 ID (선택사항)
        **kwargs: 추가 정보 (content_len 등)
    """
    extra_info = ", ".join([f"{k}={v}" for k, v in kwargs.items()])
    resource_id_str = f", resource_id={resource_id}" if resource_id else ""
    logger.info(
        f"{resource_type} {action} - user_id={user_id}{resource_id_str}"
        + (f", {extra_info}" if extra_info else "")
    )


def log_api_request(
    logger: logging.Logger,
    method: str,
    path: str,
    user_id: str = None,
    status_code: int = None,
    duration_ms: float = None,
    **kwargs
):
    """
    API 요청 로깅 헬퍼
    
    Args:
        logger: 로거 인스턴스
        method: HTTP 메서드 (GET/POST/PUT/DELETE)
        path: 요청 경로
        user_id: 사용자 ID (선택사항)
        status_code: HTTP 상태 코드 (선택사항)
        duration_ms: 응답 시간 (밀리초, 선택사항)
        **kwargs: 추가 정보
    """
    parts = [f"API {method} {path}"]
    if user_id:
        parts.append(f"user_id={user_id}")
    if status_code:
        parts.append(f"status={status_code}")
    if duration_ms is not None:
        parts.append(f"duration={duration_ms:.2f}ms")
    if kwargs:
        extra_info = ", ".join([f"{k}={v}" for k, v in kwargs.items()])
        parts.append(extra_info)
    
    logger.info(" - ".join(parts))
