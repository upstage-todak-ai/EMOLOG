/**
 * API 클라이언트
 * FastAPI 백엔드와 통신하는 HTTP 클라이언트
 */

const API_BASE_URL = '/api';

// 공통 타입 정의
export interface ExtractorRequest {
  content: string;
  datetime?: string;
}

export interface ExtractorResponse {
  topic: string;
  emotion: string;
  datetime: string;
}

export interface DiaryEntryForReport {
  date: string;
  content: string;
  topic: string;
  emotion: string;
}

export interface ReportRequest {
  diary_entries: DiaryEntryForReport[];
  period_start?: string;
  period_end?: string;
}

export interface ReportResponse {
  report: string;
  summary: string;
  period_start: string;
  period_end: string;
}

/**
 * API 요청 헬퍼 함수
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

/**
 * Extractor API
 */
export const extractorApi = {
  /**
   * 일기 정보 추출
   */
  extract: async (request: ExtractorRequest): Promise<ExtractorResponse> => {
    return apiRequest<ExtractorResponse>('/extractor/extract', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

/**
 * Report API
 */
export const reportApi = {
  /**
   * 주간 리포트 생성
   */
  generateWeekly: async (request: ReportRequest): Promise<ReportResponse> => {
    return apiRequest<ReportResponse>('/report/weekly', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
