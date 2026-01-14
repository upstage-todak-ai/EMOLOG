/**
 * API 설정
 * 환경 변수를 통해 API 베이스 URL을 설정합니다.
 * 
 * 사용법:
 * 1. mobile/.env 파일 생성
 * 2. EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 추가
 * 
 * 또는 개발 환경에서는 자동으로 localhost를 사용합니다.
 */

// 환경 변수에서 API URL 가져오기
// Expo는 EXPO_PUBLIC_ 접두사를 사용합니다
const getApiBaseUrl = (): string => {
  // 환경 변수가 설정되어 있으면 사용
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // 개발 환경 감지 (__DEV__는 React Native/Expo에서 제공)
  if (__DEV__) {
    // 시뮬레이터/에뮬레이터에서는 localhost 사용
    // 실제 기기에서는 개발자의 로컬 IP 주소 필요
    // 기본값으로 localhost 사용 (시뮬레이터용)
    return 'http://localhost:8000';
  }

  // 프로덕션 환경
  // TODO: 프로덕션 URL 설정 필요
  return 'https://api.todak-ai.com';
};

export const API_BASE_URL = getApiBaseUrl();

// 개발 모드에서 API URL 로그 출력 (디버깅용)
if (__DEV__) {
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}
