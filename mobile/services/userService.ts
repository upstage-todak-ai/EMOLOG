/**
 * 사용자 관리 서비스
 * 
 * 현재는 하드코딩된 user_id를 사용합니다.
 * 나중에 인증 시스템이 추가되면 이 파일을 확장할 수 있습니다.
 */

// 임시로 하드코딩된 user_id 사용
// 나중에 인증 시스템 추가 시 AsyncStorage나 인증 토큰에서 가져오도록 변경
export const getUserId = (): string => {
  return 'user_1234';
};
