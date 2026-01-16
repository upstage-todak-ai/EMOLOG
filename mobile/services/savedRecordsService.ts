/**
 * 저장된 레포트와 통계 관리 서비스
 * 
 * AsyncStorage를 사용하여 레포트와 통계 데이터를 로컬에 저장하고 조회합니다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Insight } from './api';
import { getUserId } from './userService';

/**
 * 저장된 레포트 데이터 구조
 */
export interface SavedReport {
  id: string; // 생성 시간 기반 고유 ID
  title: string;
  content: string;
  insights?: Insight[];
  period_start: string;
  period_end: string;
  saved_at: string; // 저장 일시 (ISO 형식)
}

/**
 * 저장된 통계 데이터 구조
 */
export interface SavedStats {
  id: string; // 월별 고유 ID (예: "2025-01")
  emotion_stats: Array<{ emotion: string; count: number }>;
  topic_stats: Array<{ topic: string; count: number }>;
  total_count: number;
  period_start: string; // 해당 월의 시작일
  period_end: string; // 해당 월의 종료일
  saved_at: string; // 저장 일시 (ISO 형식)
}

const REPORTS_KEY_PREFIX = 'saved_reports:';
const STATS_KEY_PREFIX = 'saved_stats:';

/**
 * 레포트 저장
 */
export const saveReport = async (report: Omit<SavedReport, 'id' | 'saved_at'>): Promise<SavedReport> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('user_id가 설정되지 않았습니다.');
    }

    const savedReport: SavedReport = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      saved_at: new Date().toISOString(),
    };

    const key = `${REPORTS_KEY_PREFIX}${userId}`;
    const existingReportsJson = await AsyncStorage.getItem(key);
    const existingReports: SavedReport[] = existingReportsJson 
      ? JSON.parse(existingReportsJson) 
      : [];

    // 새로운 레포트를 배열 앞에 추가 (최신순)
    const updatedReports = [savedReport, ...existingReports];

    await AsyncStorage.setItem(key, JSON.stringify(updatedReports));

    return savedReport;
  } catch (error) {
    console.error('레포트 저장 실패:', error);
    throw error;
  }
};

/**
 * 통계 저장
 */
export const saveStats = async (stats: Omit<SavedStats, 'id' | 'saved_at'>): Promise<SavedStats> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('user_id가 설정되지 않았습니다.');
    }

    // 월별 ID 생성 (예: "2025-01")
    const date = new Date(stats.period_start);
    const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const savedStats: SavedStats = {
      ...stats,
      id: monthId,
      saved_at: new Date().toISOString(),
    };

    const key = `${STATS_KEY_PREFIX}${userId}`;
    const existingStatsJson = await AsyncStorage.getItem(key);
    const existingStats: SavedStats[] = existingStatsJson 
      ? JSON.parse(existingStatsJson) 
      : [];

    // 같은 월의 통계가 있으면 업데이트, 없으면 추가
    const existingIndex = existingStats.findIndex(s => s.id === monthId);
    if (existingIndex >= 0) {
      existingStats[existingIndex] = savedStats;
    } else {
      // 새로운 통계를 배열 앞에 추가 (최신순)
      existingStats.unshift(savedStats);
    }

    await AsyncStorage.setItem(key, JSON.stringify(existingStats));

    return savedStats;
  } catch (error) {
    console.error('통계 저장 실패:', error);
    throw error;
  }
};

/**
 * 저장된 레포트 목록 조회 (최신순)
 */
export const getSavedReports = async (): Promise<SavedReport[]> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      return [];
    }

    const key = `${REPORTS_KEY_PREFIX}${userId}`;
    const reportsJson = await AsyncStorage.getItem(key);
    
    if (!reportsJson) {
      return [];
    }

    const reports: SavedReport[] = JSON.parse(reportsJson);
    // saved_at 기준 내림차순 정렬 (최신순)
    return reports.sort((a, b) => 
      new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
    );
  } catch (error) {
    console.error('저장된 레포트 조회 실패:', error);
    return [];
  }
};

/**
 * 저장된 통계 목록 조회 (최신순)
 */
export const getSavedStats = async (): Promise<SavedStats[]> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      return [];
    }

    const key = `${STATS_KEY_PREFIX}${userId}`;
    const statsJson = await AsyncStorage.getItem(key);
    
    if (!statsJson) {
      return [];
    }

    const stats: SavedStats[] = JSON.parse(statsJson);
    // saved_at 기준 내림차순 정렬 (최신순)
    return stats.sort((a, b) => 
      new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
    );
  } catch (error) {
    console.error('저장된 통계 조회 실패:', error);
    return [];
  }
};

/**
 * 특정 레포트 조회
 */
export const getSavedReportById = async (id: string): Promise<SavedReport | null> => {
  try {
    const reports = await getSavedReports();
    return reports.find(r => r.id === id) || null;
  } catch (error) {
    console.error('레포트 조회 실패:', error);
    return null;
  }
};

/**
 * 특정 통계 조회 (월별 ID로)
 */
export const getSavedStatsById = async (id: string): Promise<SavedStats | null> => {
  try {
    const stats = await getSavedStats();
    return stats.find(s => s.id === id) || null;
  } catch (error) {
    console.error('통계 조회 실패:', error);
    return null;
  }
};

/**
 * 특정 월의 통계가 이미 저장되어 있는지 확인
 */
export const hasStatsForMonth = async (year: number, month: number): Promise<boolean> => {
  try {
    const monthId = `${year}-${String(month).padStart(2, '0')}`;
    const stats = await getSavedStatsById(monthId);
    return stats !== null;
  } catch (error) {
    console.error('월별 통계 확인 실패:', error);
    return false;
  }
};

/**
 * 현재 월의 통계가 저장되어 있는지 확인
 */
export const hasCurrentMonthStats = async (): Promise<boolean> => {
  try {
    const now = new Date();
    return await hasStatsForMonth(now.getFullYear(), now.getMonth() + 1);
  } catch (error) {
    console.error('현재 월 통계 확인 실패:', error);
    return false;
  }
};
