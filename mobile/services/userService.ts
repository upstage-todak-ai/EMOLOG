/**
 * 사용자 관리 서비스
 * 
 * AsyncStorage에 저장된 user_id를 사용합니다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'user_id';

export const getUserId = async (): Promise<string | null> => {
  try {
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    return userId;
  } catch (error) {
    console.error('user_id 가져오기 실패:', error);
    return null;
  }
};

export const setUserId = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error('user_id 저장 실패:', error);
    throw error;
  }
};

export const clearUserId = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.error('user_id 삭제 실패:', error);
  }
};
