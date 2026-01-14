# 필기체 폰트 설정 가이드

귀여운 한글 필기체 폰트를 적용하기 위한 가이드입니다.

## 1. 폰트 파일 다운로드

무료 한글 필기체 폰트를 다운로드하세요:

### 추천 폰트:
- **나눔손글씨** (Nanum Pen Script)
  - 다운로드: https://fonts.google.com/specimen/Nanum+Pen+Script
  - 또는: https://hangeul.naver.com/2017/nanum 에서 다운로드

- **교보손글씨**
  - 교보문고에서 제공하는 손글씨 폰트

- **카페24 손글씨체**
  - 카페24에서 제공하는 손글씨 폰트

## 2. 폰트 파일 추가

1. `mobile/assets/fonts/` 폴더를 생성하세요
2. 다운로드한 폰트 파일(.ttf 또는 .otf)을 해당 폴더에 복사하세요
3. 파일명을 `NanumPenScript-Regular.ttf`로 변경하세요 (또는 다른 이름으로 변경 후 App.tsx에서 수정)

## 3. App.tsx에서 폰트 로드

폰트 파일을 추가한 후, `App.tsx`에서 폰트를 로드하도록 수정하세요:

```typescript
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    'NanumPen': require('./assets/fonts/NanumPenScript-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // ... 나머지 코드
}
```

## 4. 폰트 적용 확인

폰트가 제대로 적용되면 모든 한글 텍스트가 귀여운 필기체로 표시됩니다.

## 참고

- 폰트 파일이 없어도 앱은 정상 작동합니다 (시스템 폰트 사용)
- 폰트 파일을 추가하면 자동으로 필기체로 변경됩니다
