/**
 * 백엔드 API 호출 함수
 * 
 * 환경 변수를 통해 API 베이스 URL을 설정합니다.
 * mobile/.env 파일에 EXPO_PUBLIC_API_BASE_URL을 설정하거나,
 * 개발 환경에서는 자동으로 localhost를 사용합니다.
 */
import { API_BASE_URL } from '../config/api';

export type BackendEmotion = 'JOY' | 'CALM' | 'SADNESS' | 'ANGER' | 'ANXIETY' | 'EXHAUSTED';

export interface BackendDiaryEntry {
  id?: number | string;
  user_id: string;
  date: string;
  content: string;
  emotion: BackendEmotion | null;  // 추출 실패 시 null
  topic?: string;  // 추출된 주제
  created_at?: string;
}

export interface BackendDiaryCreate {
  user_id: string;
  date: string;
  content: string;
  emotion?: BackendEmotion;  // optional: 없으면 extractor가 자동으로 추출
}

export interface BackendDiaryUpdate {
  content?: string;
  emotion?: BackendEmotion;
  topic?: string;
}

export interface BackendStatsResponse {
  emotion_stats: Array<{
    emotion: BackendEmotion;
    count: number;
  }>;
  topic_stats: Array<{
    topic: string;
    count: number;
  }>;
  total_count: number;
}

export interface BackendReportResponse {
  title: string;
  content: string;
  period: string;
}

export interface BackendLogExtractRequest {
  content: string;
}

export interface BackendLogExtractResponse {
  topic: string | null;
  emotion: BackendEmotion | null;
}

/**
 * 일기 생성
 */
export async function createDiary(diary: BackendDiaryCreate): Promise<BackendDiaryEntry> {
  const response = await fetch(`${API_BASE_URL}/api/diary/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(diary),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('일기 저장 API 에러:', response.status, errorText);
    if (response.status === 503 || errorText.includes('데이터베이스가 설정되지 않았습니다')) {
      throw new Error('데이터베이스가 설정되지 않았습니다. Firebase 설정이 필요합니다.');
    }
    throw new Error(`일기 저장 실패: ${errorText}`);
  }
  return response.json();
}

/**
 * 사용자의 모든 일기 가져오기
 */
export async function getDiaries(userId: string): Promise<BackendDiaryEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/diary?user_id=${userId}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('일기 목록 조회 API 에러:', response.status, errorText);
    if (response.status === 500) {
      // Firebase 미설정 시 빈 배열 반환
      return [];
    }
    throw new Error(`일기 목록을 가져오는데 실패했습니다: ${errorText}`);
  }
  return response.json();
}

/**
 * 특정 일기 가져오기
 */
export async function getDiary(diaryId: string | number): Promise<BackendDiaryEntry> {
  const response = await fetch(`${API_BASE_URL}/api/diary/${diaryId}`);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('특정 일기 조회 API 에러:', response.status, errorText);
    throw new Error('일기를 가져오는데 실패했습니다.');
  }
  return response.json();
}

/**
 * 일기 수정
 */
export async function updateDiary(diaryId: string | number, updates: BackendDiaryUpdate): Promise<BackendDiaryEntry> {
  const response = await fetch(`${API_BASE_URL}/api/diary/${diaryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('일기 수정 API 에러:', response.status, errorText);
    if (response.status === 404) {
      throw new Error('일기를 찾을 수 없습니다.');
    }
    if (response.status === 503 || errorText.includes('데이터베이스가 설정되지 않았습니다')) {
      throw new Error('데이터베이스가 설정되지 않았습니다. Firebase 설정이 필요합니다.');
    }
    throw new Error(`일기 수정 실패: ${errorText}`);
  }
  return response.json();
}

/**
 * 일기 삭제
 */
export async function deleteDiary(diaryId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/diary/${diaryId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('일기 삭제 API 에러:', response.status, errorText);
    throw new Error('일기 삭제에 실패했습니다.');
  }
}

/**
 * 통계 조회
 */
export async function getStats(userId: string, period: 'week' | 'month' = 'week'): Promise<BackendStatsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/stats?user_id=${userId}&period=${period}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('통계 조회 API 에러:', response.status, errorText);
    // Firebase 미설정 시 빈 통계 반환
    if (response.status === 500) {
      return {
        emotion_stats: [],
        topic_stats: [],
        total_count: 0,
      };
    }
    throw new Error(`통계를 가져오는데 실패했습니다: ${errorText}`);
  }
  return response.json();
}

/**
 * 레포트 조회
 */
export async function getReport(userId: string, period: 'week' | 'month' = 'week'): Promise<BackendReportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/stats/report?user_id=${userId}&period=${period}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('레포트 조회 API 에러:', response.status, errorText);
    // Firebase 미설정 시 기본 레포트 반환
    if (response.status === 500) {
      const periodName = period === 'week' ? '지난 주' : '지난 달';
      return {
        title: `${periodName}의 감정 레포트`,
        content: '데이터베이스가 설정되지 않았습니다.',
        period,
      };
    }
    throw new Error(`레포트를 가져오는데 실패했습니다: ${errorText}`);
  }
  return response.json();
}

/**
 * Log 추출 (주제, 감정 추출)
 */
export async function extractLog(content: string): Promise<BackendLogExtractResponse> {
  const response = await fetch(`${API_BASE_URL}/api/log/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Log 추출 API 에러:', response.status, errorText);
    throw new Error(`Log 추출 실패: ${errorText}`);
  }
  return response.json();
}
