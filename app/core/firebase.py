"""
Firebase Admin SDK 초기화 모듈

Firebase Firestore를 사용하기 위한 설정 파일입니다.
환경 변수나 파일 경로를 통해 Firebase 서비스 계정 키를 설정할 수 있습니다.
"""
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_firebase_app = None
_db = None


def initialize_firebase():
    """
    Firebase Admin SDK 초기화
    
    환경 변수 또는 파일 경로를 통해 Firebase 서비스 계정 키를 설정합니다.
    - FIREBASE_CREDENTIALS_PATH: 키 파일 경로
    - FIREBASE_CREDENTIALS_JSON: 키 JSON 문자열 (환경 변수)
    
    Returns:
        firebase_admin.App: 초기화된 Firebase 앱 인스턴스
        None: 초기화 실패 시 (서버는 계속 실행됨)
    """
    global _firebase_app, _db
    
    # 이미 초기화되어 있으면 그대로 반환
    if _firebase_app is not None:
        return _firebase_app
    
    try:
        # 방법 1: 파일 경로로 설정
        if hasattr(settings, 'FIREBASE_CREDENTIALS_PATH') and settings.FIREBASE_CREDENTIALS_PATH:
            if os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                _firebase_app = firebase_admin.initialize_app(cred)
                logger.info(f"Firebase 초기화 완료 (파일 경로 사용): {settings.FIREBASE_CREDENTIALS_PATH}")
            else:
                logger.warning(f"Firebase 키 파일을 찾을 수 없습니다: {settings.FIREBASE_CREDENTIALS_PATH}")
                return None
        
        # 방법 2: 환경 변수로 JSON 문자열 설정
        elif hasattr(settings, 'FIREBASE_CREDENTIALS_JSON') and settings.FIREBASE_CREDENTIALS_JSON:
            cred_dict = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase 초기화 완료 (환경 변수 사용)")
        
        # 방법 3: 기본 자격 증명 사용 (GAE, Cloud Run 등)
        else:
            try:
                _firebase_app = firebase_admin.initialize_app()
                logger.info("Firebase 초기화 완료 (기본 자격 증명 사용)")
            except Exception as e:
                logger.warning(f"Firebase 기본 자격 증명 초기화 실패: {e}")
                return None
        
        # Firestore 데이터베이스 인스턴스 생성
        _db = firestore.client()
        return _firebase_app
        
    except Exception as e:
        logger.error(f"Firebase 초기화 실패: {e}", exc_info=True)
        logger.warning("Firebase 없이 서버는 실행되지만 데이터베이스 기능이 동작하지 않습니다.")
        return None


def get_db():
    """
    Firestore 데이터베이스 인스턴스 가져오기
    
    Returns:
        firestore.Client: Firestore 클라이언트 인스턴스
        None: Firebase가 초기화되지 않은 경우
    """
    global _db
    
    if _db is None:
        initialize_firebase()
    
    return _db
