from fastapi import APIRouter, HTTPException
from typing import Literal
from datetime import datetime, timedelta
from collections import Counter
import time
from app.models.schemas import StatsResponse, ReportResponse, EmotionStats, TopicStats, Emotion
from app.repository.diary_repository import get_diary_repository
from app.core.logging import get_logger, log_api_request

# 라우터 생성 (prefix: /api/stats)
router = APIRouter(prefix="/api/stats", tags=["stats"])

logger = get_logger(__name__)


def extract_topic_from_content(content: str) -> str:
    """
    일기 내용에서 주제를 추출 (간단한 키워드 기반)
    나중에 LLM으로 대체 가능
    """
    content_lower = content.lower()
    
    if any(keyword in content_lower for keyword in ['시험', '공부', '과제', '수업', '학교', '학원']):
        return '학업'
    elif any(keyword in content_lower for keyword in ['친구', '사람', '관계', '만남', '대화', '소통']):
        return '대인관계'
    elif any(keyword in content_lower for keyword in ['운동', '건강', '병원', '치료', '약']):
        return '건강'
    elif any(keyword in content_lower for keyword in ['취미', '게임', '영화', '책', '음악', '여행']):
        return '취미'
    else:
        return '일상'


def filter_by_period(diaries, period: Literal["week", "month"]):
    """기간별로 일기 필터링"""
    now = datetime.now()
    if period == "week":
        cutoff_date = now - timedelta(days=7)
    else:  # month
        cutoff_date = now - timedelta(days=30)
    
    filtered = []
    for diary in diaries:
        try:
            # date가 이미 datetime 객체인 경우
            if isinstance(diary.date, datetime):
                diary_date = diary.date
            # date가 문자열인 경우 다양한 형식 처리
            elif isinstance(diary.date, str):
                date_str = diary.date.strip()
                
                # 1. ISO 형식 (Z 또는 +00:00 포함)
                if 'Z' in date_str:
                    diary_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                # 2. ISO 형식 (+HH:MM 또는 -HH:MM 포함)
                elif '+' in date_str or (date_str.count('-') >= 3 and 'T' in date_str):
                    diary_date = datetime.fromisoformat(date_str)
                # 3. 단순 날짜 형식 (YYYY-MM-DD)
                elif len(date_str) == 10 and date_str.count('-') == 2:
                    diary_date = datetime.strptime(date_str, '%Y-%m-%d')
                # 4. ISO 형식 (timezone 없음)
                elif 'T' in date_str:
                    diary_date = datetime.fromisoformat(date_str)
                # 5. 기타 형식 시도
                else:
                    # 여러 일반적인 형식 시도
                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d']:
                        try:
                            diary_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        # 모든 형식 실패 시 로그하고 스킵
                        logger.warning(f"일기 {diary.id}의 날짜 형식을 파싱할 수 없습니다: {date_str}")
                        continue
            else:
                # 예상치 못한 타입
                logger.warning(f"일기 {diary.id}의 날짜 타입이 예상과 다릅니다: {type(diary.date)}")
                continue
            
            # timezone 정보 제거 후 비교
            diary_date_naive = diary_date.replace(tzinfo=None) if diary_date.tzinfo else diary_date
            
            if diary_date_naive >= cutoff_date:
                filtered.append(diary)
        except (ValueError, AttributeError, TypeError) as e:
            # 날짜 파싱 실패 시 로그하고 해당 일기는 스킵
            logger.warning(f"일기 {diary.id}의 날짜 처리 실패: {diary.date}, 에러: {e}")
            continue
    
    return filtered


@router.get("/", response_model=StatsResponse)
def get_stats(user_id: str, period: Literal["week", "month"] = "week"):
    """
    통계 API
    
    사용자의 감정 및 주제별 통계를 반환합니다.
    
    - **user_id**: 사용자 ID
    - **period**: 기간 ("week" | "month")
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        all_diaries = repository.get_by_user_id(user_id)
        
        # 기간별 필터링
        filtered_diaries = filter_by_period(all_diaries, period)
        
        # 감정별 통계
        emotion_counter = Counter()
        for diary in filtered_diaries:
            # emotion 처리: 이미 Emotion enum인 경우와 문자열인 경우 모두 처리
            try:
                if isinstance(diary.emotion, Emotion):
                    emotion = diary.emotion
                elif isinstance(diary.emotion, str):
                    emotion = Emotion(diary.emotion)
                else:
                    # emotion이 None이거나 다른 타입인 경우 스킵
                    logger.warning(f"일기 {diary.id}의 emotion이 유효하지 않습니다: {diary.emotion}")
                    continue
                emotion_counter[emotion] += 1
            except (ValueError, AttributeError, TypeError) as e:
                logger.warning(f"일기 {diary.id}의 emotion 변환 실패: {diary.emotion}, 에러: {e}")
                # emotion 변환 실패 시 해당 일기는 스킵하고 계속 진행
                continue
        
        emotion_stats = [
            EmotionStats(emotion=emotion, count=count)
            for emotion, count in emotion_counter.items()
        ]
        
        # 주제별 통계
        topic_counter = Counter()
        for diary in filtered_diaries:
            # topic 추출 (content가 None이거나 빈 문자열일 수 있음)
            try:
                topic = extract_topic_from_content(diary.content or "")
                topic_counter[topic] += 1
            except Exception as e:
                logger.warning(f"일기 {diary.id}의 topic 추출 실패: {e}")
                # topic 추출 실패 시 '일상'으로 기본값 설정
                topic_counter['일상'] += 1
        
        topic_stats = [
            TopicStats(topic=topic, count=count)
            for topic, count in topic_counter.items()
        ]
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms,
            period=period,
            total_count=len(filtered_diaries)
        )
        return StatsResponse(
            emotion_stats=emotion_stats,
            topic_stats=topic_stats,
            total_count=len(filtered_diaries)
        )
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="GET",
                path="/api/stats/",
                user_id=user_id,
                status_code=200,
                duration_ms=duration_ms,
                period=period
            )
            return StatsResponse(
                emotion_stats=[],
                topic_stats=[],
                total_count=0
            )
        logger.error(f"통계 조회 실패 (ValueError): {error_msg}", exc_info=True)
        logger.error(f"  - user_id: {user_id}, period: {period}")
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=f"통계 조회에 실패했습니다: {error_msg}")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"통계 조회 실패 ({error_type}): {error_msg}", exc_info=True)
        logger.error(f"  - user_id: {user_id}, period: {period}")
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=f"통계 조회에 실패했습니다: {error_msg}")


@router.get("/report", response_model=ReportResponse)
def get_report(user_id: str, period: Literal["week", "month"] = "week"):
    """
    레포트 API
    
    사용자의 감정 패턴을 분석한 스토리텔링 레포트를 반환합니다.
    
    - **user_id**: 사용자 ID
    - **period**: 기간 ("week" | "month")
    """
    start_time = time.time()
    try:
        repository = get_diary_repository()
        all_diaries = repository.get_by_user_id(user_id)
        
        # 기간별 필터링
        filtered_diaries = filter_by_period(all_diaries, period)
        
        if len(filtered_diaries) == 0:
            period_name = "지난 주" if period == "week" else "지난 달"
            return ReportResponse(
                title=f"{period_name}의 감정 레포트",
                content="아직 기록된 감정 메모가 없습니다. 오늘부터 감정을 기록해보세요!",
                period=period
            )
        
        # 통계 계산
        emotion_counter = Counter()
        topic_counter = Counter()
        
        for diary in filtered_diaries:
            # emotion 처리: 이미 Emotion enum인 경우와 문자열인 경우 모두 처리
            try:
                if isinstance(diary.emotion, Emotion):
                    emotion = diary.emotion
                elif isinstance(diary.emotion, str):
                    emotion = Emotion(diary.emotion)
                else:
                    # emotion이 None이거나 다른 타입인 경우 스킵
                    logger.warning(f"일기 {diary.id}의 emotion이 유효하지 않습니다: {diary.emotion}")
                    continue
                emotion_counter[emotion] += 1
            except (ValueError, AttributeError, TypeError) as e:
                logger.warning(f"일기 {diary.id}의 emotion 변환 실패: {diary.emotion}, 에러: {e}")
                # emotion 변환 실패 시 해당 일기는 스킵하고 계속 진행
                continue
            
            # topic 추출 (content가 None이거나 빈 문자열일 수 있음)
            try:
                topic = extract_topic_from_content(diary.content or "")
                topic_counter[topic] += 1
            except Exception as e:
                logger.warning(f"일기 {diary.id}의 topic 추출 실패: {e}")
                # topic 추출 실패 시 '일상'으로 기본값 설정
                topic_counter['일상'] += 1
        
        # 가장 많은 감정과 주제 찾기
        top_emotion = emotion_counter.most_common(1)[0] if emotion_counter else None
        top_topic = topic_counter.most_common(1)[0] if topic_counter else None
        
        # 레포트 생성
        period_name = "지난 주" if period == "week" else "지난 달"
        total_count = len(filtered_diaries)
        
        story = f"{period_name} 동안 총 {total_count}개의 감정을 기록했습니다.\n\n"
        
        if top_emotion:
            emotion_name = {
                Emotion.JOY: "기쁨",
                Emotion.CALM: "평온",
                Emotion.SADNESS: "슬픔",
                Emotion.ANGER: "화남",
                Emotion.ANXIETY: "불안",
                Emotion.EXHAUSTED: "지침"
            }.get(top_emotion[0], top_emotion[0].value)
            
            story += f"가장 많이 느낀 감정은 '{emotion_name}'으로, {top_emotion[1]}번 기록되었습니다. "
            
            if top_emotion[0] in [Emotion.ANGER, Emotion.ANXIETY, Emotion.EXHAUSTED]:
                story += "힘든 시간을 보내고 계시는 것 같아요. 잠시 휴식을 취하며 자신을 돌보는 시간을 가져보세요.\n\n"
            elif top_emotion[0] in [Emotion.JOY, Emotion.CALM]:
                story += "긍정적인 에너지가 가득한 한 주를 보내셨네요! 이런 순간들을 소중히 간직하세요.\n\n"
            elif top_emotion[0] == Emotion.SADNESS:
                story += "힘든 감정을 마주하고 있군요. 이런 감정을 기록하는 것만으로도 큰 용기입니다.\n\n"
            else:
                story += "\n\n"
        
        if top_topic:
            story += f"주로 '{top_topic[0]}'에 대해 생각하고 계셨어요. "
            
            if top_topic[0] == '학업':
                story += "학업에 많은 에너지를 쏟고 계시네요. 때로는 완벽하지 않아도 괜찮다는 것을 기억하세요."
            elif top_topic[0] == '대인관계':
                story += "사람들과의 관계에서 많은 감정을 느끼고 계시네요. 좋은 관계는 삶의 큰 힘이 됩니다."
            elif top_topic[0] == '일상':
                story += "일상 속 작은 순간들에 주목하고 계시네요. 평범한 일상이 쌓여 특별한 삶이 됩니다."
            elif top_topic[0] == '건강':
                story += "건강에 관심을 가지고 계시네요. 몸과 마음을 돌보는 것은 매우 중요합니다."
            elif top_topic[0] == '취미':
                story += "취미 활동을 즐기고 계시네요. 자신만의 시간을 갖는 것은 삶의 활력소입니다."
            else:
                story += "다양한 경험을 하고 계시네요."
        
        duration_ms = (time.time() - start_time) * 1000
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/report",
            user_id=user_id,
            status_code=200,
            duration_ms=duration_ms,
            period=period,
            total_count=total_count
        )
        return ReportResponse(
            title=f"{period_name}의 감정 레포트",
            content=story,
            period=period
        )
    except ValueError as e:
        error_msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        if "Firebase" in error_msg or "Firestore" in error_msg:
            logger.warning(f"Firebase 미설정: {error_msg}")
            log_api_request(
                logger,
                method="GET",
                path="/api/stats/report",
                user_id=user_id,
                status_code=200,
                duration_ms=duration_ms,
                period=period
            )
            period_name = "지난 주" if period == "week" else "지난 달"
            return ReportResponse(
                title=f"{period_name}의 감정 레포트",
                content="데이터베이스가 설정되지 않았습니다.",
                period=period
            )
        logger.error(f"레포트 생성 실패 (ValueError): {error_msg}", exc_info=True)
        logger.error(f"  - user_id: {user_id}, period: {period}")
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/report",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=f"레포트 생성에 실패했습니다: {error_msg}")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"레포트 생성 실패 ({error_type}): {error_msg}", exc_info=True)
        logger.error(f"  - user_id: {user_id}, period: {period}")
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/report",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=f"레포트 생성에 실패했습니다: {error_msg}")
