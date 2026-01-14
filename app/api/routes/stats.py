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
        # date가 문자열인 경우 datetime으로 변환
        if isinstance(diary.date, str):
            try:
                diary_date = datetime.fromisoformat(diary.date.replace('Z', '+00:00'))
            except:
                diary_date = datetime.fromisoformat(diary.date)
        else:
            diary_date = diary.date
        
        # timezone 정보 제거 후 비교
        if diary_date.replace(tzinfo=None) >= cutoff_date:
            filtered.append(diary)
    
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
            try:
                emotion = Emotion(diary.emotion)
                emotion_counter[emotion] += 1
            except (ValueError, AttributeError):
                # emotion이 문자열인 경우
                try:
                    emotion = Emotion(diary.emotion)
                    emotion_counter[emotion] += 1
                except:
                    pass
        
        emotion_stats = [
            EmotionStats(emotion=emotion, count=count)
            for emotion, count in emotion_counter.items()
        ]
        
        # 주제별 통계
        topic_counter = Counter()
        for diary in filtered_diaries:
            topic = extract_topic_from_content(diary.content)
            topic_counter[topic] += 1
        
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
        logger.error(f"통계 조회 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="통계 조회에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"통계 조회 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="통계 조회에 실패했습니다.")


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
            try:
                emotion = Emotion(diary.emotion)
                emotion_counter[emotion] += 1
            except (ValueError, AttributeError):
                try:
                    emotion = Emotion(diary.emotion)
                    emotion_counter[emotion] += 1
                except:
                    pass
            
            topic = extract_topic_from_content(diary.content)
            topic_counter[topic] += 1
        
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
        logger.error(f"레포트 생성 실패: {error_msg}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/report",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="레포트 생성에 실패했습니다.")
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"레포트 생성 실패: {str(e)}", exc_info=True)
        log_api_request(
            logger,
            method="GET",
            path="/api/stats/report",
            user_id=user_id,
            status_code=500,
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail="레포트 생성에 실패했습니다.")
