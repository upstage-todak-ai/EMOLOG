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

/**
 * 리포트 생성용 일기 항목
 */
export interface DiaryEntryForReport {
  date: string; // "YYYY-MM-DD"
  content: string;
  topic: string | null;
  emotion: string | null; // BackendEmotion | null
}

/**
 * 리포트 생성 요청
 */
export interface WeeklyReportRequest {
  user_id: string; // 사용자 ID
  diary_entries: DiaryEntryForReport[];
  period_start?: string; // "YYYY-MM-DD" (선택)
  period_end?: string; // "YYYY-MM-DD" (선택)
}

/**
 * 인사이트 타입
 */
export interface Insight {
  type: 'time_contrast' | 'repetition' | 'causal_relation';
  description: string;
  date_references: string[];
  evidence: string;
  summary?: string; // 자연어 1줄 요약
}

/**
 * 리포트 생성 응답
 */
export interface WeeklyReportResponse {
  report: string;
  summary: string;
  period_start: string;
  period_end: string;
  insights: Insight[];
  created_at?: string; // 리포트 생성 일시 (ISO 형식)
}

/**
 * 최신 리포트 조회
 */
export async function getLatestReport(userId: string): Promise<WeeklyReportResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/report/latest?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // 리포트가 없음
      }
      const errorText = await response.text();
      console.error('리포트 조회 API 에러:', response.status, errorText);
      return null; // 에러가 나도 null 반환 (있으면 표시하라는 요청)
    }
    return response.json();
  } catch (error) {
    console.error('리포트 조회 실패:', error);
    return null; // 에러가 나도 null 반환
  }
}

/**
 * 이전 리포트 조회
 */
export async function getPreviousReport(userId: string, created_at: string): Promise<WeeklyReportResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/report/previous?user_id=${userId}&created_at=${encodeURIComponent(created_at)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // 이전 리포트가 없음
      }
      const errorText = await response.text();
      console.error('이전 리포트 조회 API 에러:', response.status, errorText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('이전 리포트 조회 실패:', error);
    return null;
  }
}

/**
 * 주간 리포트 생성 (LangGraph 기반)
 */
export async function generateWeeklyReport(request: WeeklyReportRequest): Promise<WeeklyReportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/report/weekly`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('리포트 생성 API 에러:', response.status, errorText);
    throw new Error(`리포트 생성 실패: ${errorText}`);
  }
  return response.json();
}

/**
 * 알림 테스트 응답
 */
export interface NotificationTestResponse {
  should_send: boolean;
  send_time: string | null;
  message: string | null;
  reason: string;
  evaluation_score: number;
}

/**
 * 알림 테스트
 */
export async function testNotification(userId: string, currentTime?: string): Promise<NotificationTestResponse> {
  let url = `${API_BASE_URL}/api/notification/test?user_id=${userId}`;
  if (currentTime) {
    url += `&current_time=${encodeURIComponent(currentTime)}`;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('알림 테스트 API 에러:', response.status, errorText);
    throw new Error(`알림 테스트 실패: ${errorText}`);
  }
  return response.json();
}
