"""
테스트 데이터 삽입 스크립트
user_id '1'에 메모와 캘린더 데이터를 삽입합니다.
"""
import sys
import os
from datetime import datetime

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repository.diary_repository import get_diary_repository
from app.models.schemas import DiaryEntryCreate, Emotion

# 테스트 데이터
MEMO_DATA = [
    {"Memo_Title": "새해다짐", "Memo_date": "2026-01-01", "Memo_text": "새해 첫날부터 독서실에 왔다. 다들 놀러 갔는지 사람이 별로 없어서 오히려 집중이 잘 된다. 올해는 진짜 끝내고 싶다. 부모님께 손 벌리는 것도 이제 한계고, 내 자존감도 바닥이다. 교육학 개념 정리를 이번 달 안에 무조건 끝내야 한다. 지수야, 정신 차리자."},
    {"Memo_Title": "자괴감", "Memo_date": "2026-01-04", "Memo_text": "어제 너무 늦게 자서 오전 공부를 통으로 날렸다. 나는 왜 이럴까. 겨우 의지 하나 조절 못 하면서 아이들을 가르치겠다고.. 독서실 옆자리 사람이 바뀌었는데 필기 소리가 너무 커서 신경 쓰인다. 내가 예민한 거겠지. 그냥 내가 문제다."},
    {"Memo_Title": "택배", "Memo_date": "2026-01-08", "Memo_text": "엄마가 반찬이랑 비타민을 보내주셨다. 박스 열자마자 집 냄새가 나서 눈물이 핑 돌았다. 전화하고 싶었지만 목소리 들으면 무너질 것 같아서 카톡으로만 고맙다고 했다. 합격해서 효도해야지. 진짜 꼭 붙어야 한다."},
    {"Memo_Title": "슬럼프", "Memo_date": "2026-01-12", "Memo_text": "글자가 눈에 안 들어온다. 읽고는 있는데 뇌를 거치지 않고 그냥 흘러나가는 기분. 하루 종일 앉아는 있는데 머릿속은 딴생각뿐이다. 이대로 가다간 망할 게 뻔한데 몸이 안 움직인다. 너무 무섭다. 내 미래가 그냥 이대로 끝날까 봐."},
    {"Memo_Title": "기분전환", "Memo_date": "2026-01-15", "Memo_text": "도저히 안 되겠다 싶어서 오늘은 코인 노래방에 다녀왔다. 혼자 노래 부르고 나니까 좀 살 것 같다. 저녁엔 맛있는 거 먹고 다시 힘내야지. 내일부터는 다시 8시 기상 지키자."},
    {"Memo_Title": "암기법", "Memo_date": "2026-01-20", "Memo_text": "피아제 발달 단계가 자꾸 헷갈려서 나만의 암기법을 만들었다. 이렇게 하니까 좀 외워지네. 역시 무식하게 외우는 것보다 이해가 먼저다. 오늘 순공 시간 10시간 채웠다. 뿌듯하다."},
    {"Memo_Title": "비교", "Memo_date": "2026-01-25", "Memo_text": "인스타 앱을 아예 지워버려야겠다. 친구들 취업해서 첫 월급 받았다고 오마카세 간 사진 보니까 내가 너무 초라하다. 걔네는 앞서가는데 나만 22살에 멈춰있는 기분이다. 남이랑 비교하지 말자고 다짐해도 잘 안 된다."},
    {"Memo_Title": "설날", "Memo_date": "2026-01-29", "Memo_text": "이번 설에는 집에 안 갔다. 친척들 만나서 '공부는 잘되니' 소리 들을 자신도 없고 공부 시간 뺏기는 것도 싫다. 혼자 편의점 도시락 먹으면서 인강 듣는데 좀 서럽긴 하네. 내년 설에는 당당하게 가야지."},
    {"Memo_Title": "반성", "Memo_date": "2026-02-02", "Memo_text": "벌써 2월이다. 시간이 너무 빠르다. 1월에 계획했던 분량의 70%밖에 못 했다. 2월은 진짜 죽었다 생각하고 달려야 한다. 주말에도 쉬지 말고 문제 풀이 들어가자."},
    {"Memo_Title": "밤공기", "Memo_date": "2026-02-06", "Memo_text": "공부 마치고 집 걸어가는데 달이 너무 예쁘다. 이런 날 누군가랑 같이 걷고 싶다. 연애는 사치겠지? 합격하면 다 할 수 있다. 조금만 더 참자."},
    {"Memo_Title": "건강관리", "Memo_date": "2026-02-10", "Memo_text": "요즘 허리가 너무 아프다. 하루 종일 앉아있으니까 몸이 망가지는 게 느껴진다. 스트레칭이라도 자주 해줘야겠다. 아프면 공부도 못 하니까 건강 챙기자."},
    {"Memo_Title": "기출풀이", "Memo_date": "2026-02-15", "Memo_text": "작년 기출 풀어봤는데 점수가 생각보다 잘 나왔다! 할 수 있다는 희망이 보인다. 부족한 부분만 보완하면 충분히 승산 있다. 지수야 기죽지 마!"},
    {"Memo_Title": "날씨", "Memo_date": "2026-02-20", "Memo_text": "낮에 잠깐 나갔는데 공기가 벌써 봄 냄새가 난다. 계절 바뀌는 게 이렇게 무서울 줄이야. 시험이 그만큼 다가온다는 뜻이니까. 꽃 피기 전까지 기본서 회독 끝내자."},
    {"Memo_Title": "불안감", "Memo_date": "2026-02-24", "Memo_text": "갑자기 가슴이 두근거려서 공부를 멈췄다. 혹시라도 떨어지면? 내년에도 이러고 있으면? 꼬리에 꼬리를 무는 생각들 때문에 미치겠다. 따뜻한 차 마시면서 마음 좀 가라앉히자."},
    {"Memo_Title": "마무리", "Memo_date": "2026-02-28", "Memo_text": "2월 마지막 날. 이번 달은 1월보다 훨씬 열심히 살았다. 나 자신에게 칭찬 한마디 해주고 싶다. 3월부터는 본격적인 문제 풀이 시즌이다. 지금의 텐션 유지해서 합격까지 달리자."}
]

CAL_DATA = [
    {"Cal_date": "2026-01-14", "Cal_text": "독서실 재결제일"},
    {"Cal_date": "2026-02-01", "Cal_text": "모의고사 접수 시작"},
    {"Cal_date": "2026-02-28", "Cal_text": "스터디 카페 이용권 만료"}
]

USER_ID = "1"

def insert_memo_data():
    """메모 데이터 삽입"""
    repository = get_diary_repository()
    
    for memo in MEMO_DATA:
        date_str = memo["Memo_date"]
        date_obj = datetime.strptime(f"{date_str}T00:00:00", "%Y-%m-%dT%H:%M:%S")
        
        diary = DiaryEntryCreate(
            user_id=USER_ID,
            date=date_obj,
            content=memo["Memo_text"],
            emotion=Emotion.CALM,  # 기본값, 나중에 추출될 것
            topic=None  # 추출될 것
        )
        
        try:
            created = repository.create(diary)
            print(f"✅ 메모 삽입 완료: {memo['Memo_Title']} ({date_str})")
        except Exception as e:
            print(f"❌ 메모 삽입 실패: {memo['Memo_Title']} - {e}")

def insert_cal_data():
    """캘린더 데이터 삽입"""
    from app.repository.calendar_repository import get_calendar_repository
    from app.models.schemas import CalendarEventCreate, CalendarEventType
    
    repository = get_calendar_repository()
    
    for cal in CAL_DATA:
        date_str = cal["Cal_date"]
        date_obj = datetime.strptime(f"{date_str}T00:00:00", "%Y-%m-%dT%H:%M:%S")
        
        event = CalendarEventCreate(
            user_id=USER_ID,
            title=cal["Cal_text"],
            start_date=date_obj,
            end_date=date_obj,
            type=CalendarEventType.ROUTINE  # 기본값
        )
        
        try:
            created = repository.create(event)
            print(f"✅ 캘린더 삽입 완료: {cal['Cal_text']} ({date_str})")
        except Exception as e:
            print(f"❌ 캘린더 삽입 실패: {cal['Cal_text']} - {e}")

if __name__ == "__main__":
    print(f"📝 user_id '{USER_ID}'에 테스트 데이터 삽입 시작...\n")
    
    print("=" * 50)
    print("메모 데이터 삽입 중...")
    print("=" * 50)
    insert_memo_data()
    
    print("\n" + "=" * 50)
    print("캘린더 데이터 삽입 중...")
    print("=" * 50)
    insert_cal_data()
    
    print("\n✅ 모든 데이터 삽입 완료!")
