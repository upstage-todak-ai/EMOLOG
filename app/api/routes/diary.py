from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List
from datetime import datetime
import time
from app.models.schemas import DiaryEntry, DiaryEntryCreate, DiaryEntryUpdate, Emotion
from app.repository.diary_repository import get_diary_repository
from app.service.extractor_service import extract_diary_info
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/diary)
router = APIRouter(prefix="/api/diary", tags=["diary"])

logger = get_logger(__name__)


def _extract_and_update_diary(diary_id: str, diary_content: str, diary_datetime: str):
    """백그라운드에서 일기 정보 추출 및 업데이트"""
    try:
        logger.info(f"[_extract_and_update_diary] 백그라운드 추출 시작 - diary_id={diary_id}")
        
        extracted = extract_diary_info(
            diary_content=diary_content,
            diary_datetime=diary_datetime
        )
        
        logger.info(f"[_extract_and_update_diary] Extractor 반환값: {extracted}")
        
        # 추출된 emotion을 Emotion enum으로 변환
        emotion_str = extracted.get("emotion", "").strip().upper()
        emotion = None
        if emotion_str:
            try:
                emotion = Emotion[emotion_str]
            except (KeyError, AttributeError):
                emotion = None
        
        # topic이 None이거나 빈 문자열이면 None으로 저장 (나중에 빈 문자열로 변환)
        topic = extracted.get("topic", "") or None
        
        # 일기 업데이트 (topic이 None이면 빈 문자열로 저장)
        repository = get_diary_repository()
        updates = DiaryEntryUpdate(
            emotion=emotion,
            topic=topic if topic else "",  # None이면 빈 문자열로 저장
            content=None  # content는 업데이트하지 않음
        )
        
        updated = repository.update(diary_id, updates)
        
        logger.info(f"[_extract_and_update_diary] 추출 및 업데이트 완료 - diary_id={diary_id}, topic={topic}, emotion={emotion.value if emotion else None}")
    except Exception as e:
        logger.error(f"[_extract_and_update_diary] 추출 실패: {e}", exc_info=True)


@router.post("/", response_model=DiaryEntry, status_code=201)
def create_diary(diary: DiaryEntryCreate, background_tasks: BackgroundTasks):
    """
    일기 생성 API
    
    프론트엔드에서 사용자가 일기를 작성하면 이 API로 전송됩니다.
    emotion이 없으면 기본값으로 저장하고, 백그라운드에서 추출하여 업데이트합니다.
    
    - **user_id**: 사용자 ID
    - **date**: 일기 작성 날짜/시간
    - **content**: 일기 내용
    - **emotion**: 감정 타입 (선택사항, 없으면 추출)
    """
    start_time = time.time()
    try:
        # emotion이 없으면 기본값으로 설정하고 백그라운드에서 추출
        if diary.emotion is None:
            logger.info("[create_diary] 빠른 저장 모드 - emotion이 없어서 기본값 CALM으로 저장 후 백그라운드 추출")
            diary.emotion = Emotion.CALM  # 기본값으로 빠르게 저장
            diary.topic = ""  # 추출 중임을 나타내기 위해 빈 값
        
        repository = get_diary_repository()
        new_diary = repository.create(diary)
        
        # emotion이 없었으면 백그라운드에서 추출 작업 추가
        if diary.emotion == Emotion.CALM and not diary.topic:
            diary_datetime = diary.date.strftime("%Y-%m-%d %H:%M:%S") if isinstance(diary.date, datetime) else str(diary.date)
            background_tasks.add_task(
                _extract_and_update_diary,
                str(new_diary.id),
                diary.content,
                diary_datetime
            )
            logger.info(f"[create_diary] 백그라운드 추출 작업 추가됨 - diary_id={new_diary.id}")
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="POST",
            path="/api/diary/",
            user_id=diary.user_id,
            status_code=201,
            duration_ms=duration_ms,
            content_len=len(diary.content)
        )
        return new_diary
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="POST",
                path="/api/diary/",
                user_id=diary.user_id,
                status_code=503,
                duration_ms=duration_ms
            )
            raise HTTPException(
                status_code=503, 
                detail="데이터베이스가 설정되지 않았습니다. Firebase 설정이 필요합니다."
            )
        logger.error(f"일기 생성 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/diary/",
            user_id=diary.user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 생성에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 생성 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="POST",
            path="/api/diary/",
            user_id=diary.user_id if hasattr(diary, 'user_id') else None,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 생성에 실패했습니다.")


@router.get("/", response_model=List[DiaryEntry])
def get_diaries(user_id: str):
    """
    사용자의 일기 목록 조회 API
    
    특정 사용자의 모든 일기를 가져옵니다.
    에이전트가 분석할 때 이 API를 사용합니다.
    
    - **user_id**: 조회할 사용자 ID
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        user_diaries = repository.get_by_user_id(user_id)
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/diary/",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms,
            count=len(user_diaries)
        )
        return user_diaries
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="GET",
                path="/api/diary/",
                user_id=user_id,
                status_code=200,
                duration_ms=duration_ms,
                count=0
            )
            return []  # Firebase 미설정 시 빈 배열 반환
        logger.error(f"일기 목록 조회 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/diary/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 목록 조회에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 목록 조회 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/diary/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 목록 조회에 실패했습니다.")


@router.get("/{diary_id}", response_model=DiaryEntry)
def get_diary(diary_id: str):
    """
    특정 일기 조회 API
    
    일기 ID로 특정 일기를 가져옵니다.
    
    - **diary_id**: 조회할 일기 ID (문자열)
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        diary = repository.get_by_id(diary_id)
        duration_ms = (time.time() - start_time) * 1000
        if not diary:
            log_api_request(
                logger,
                method="GET",
                path=f"/api/diary/{diary_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Diary not found")
        log_api_request(
            logger,
            method="GET",
            path=f"/api/diary/{diary_id}",
            user_id=diary.user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        return diary
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="GET",
                path=f"/api/diary/{diary_id}",
                status_code=503,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=503, detail="데이터베이스가 설정되지 않았습니다.")
        logger.error(f"일기 조회 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 조회에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 조회 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 조회에 실패했습니다.")


@router.put("/{diary_id}", response_model=DiaryEntry)
def update_diary(diary_id: str, updates: DiaryEntryUpdate):
    """
    일기 수정 API
    
    특정 일기의 내용과 감정을 수정합니다.
    
    - **diary_id**: 수정할 일기 ID (문자열)
    - **content**: 수정할 일기 내용 (선택사항)
    - **emotion**: 수정할 감정 타입 (선택사항)
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        updated_diary = repository.update(diary_id, updates)
        duration_ms = (time.time() - start_time) * 1000
        if not updated_diary:
            log_api_request(
                logger,
                method="PUT",
                path=f"/api/diary/{diary_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Diary not found")
        log_api_request(
            logger,
            method="PUT",
            path=f"/api/diary/{diary_id}",
            user_id=updated_diary.user_id,
            status_code=200,
            duration_ms=duration_ms
        )
        return updated_diary
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="PUT",
                path=f"/api/diary/{diary_id}",
                status_code=503,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=503, detail="데이터베이스가 설정되지 않았습니다.")
        logger.error(f"일기 수정 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="PUT",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 수정에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 수정 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="PUT",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 수정에 실패했습니다.")


@router.delete("/{diary_id}", status_code=204)
def delete_diary(diary_id: str):
    """
    일기 삭제 API
    
    특정 일기를 삭제합니다.
    
    - **diary_id**: 삭제할 일기 ID (문자열)
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        # 삭제 전에 일기 정보 가져오기 (로깅용)
        diary = repository.get_by_id(diary_id)
        success = repository.delete(diary_id)
        duration_ms = (time.time() - start_time) * 1000
        if not success:
            log_api_request(
                logger,
                method="DELETE",
                path=f"/api/diary/{diary_id}",
                status_code=404,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=404, detail="Diary not found")
        log_api_request(
            logger,
            method="DELETE",
            path=f"/api/diary/{diary_id}",
            user_id=diary.user_id if diary else None,
            status_code=204,
            duration_ms=duration_ms
        )
        return None
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="DELETE",
                path=f"/api/diary/{diary_id}",
                status_code=503,
                duration_ms=duration_ms
            )
            raise HTTPException(status_code=503, detail="데이터베이스가 설정되지 않았습니다.")
        logger.error(f"일기 삭제 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="DELETE",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 삭제에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"일기 삭제 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="DELETE",
            path=f"/api/diary/{diary_id}",
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="일기 삭제에 실패했습니다.")
