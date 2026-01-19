import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getStats, getReport, generateWeeklyReport, getLatestReport, getPreviousReport, DiaryEntryForReport, Insight } from '../services/api';
import { getUserId } from '../services/userService';
import { getAllJournals } from '../services/journalService';
import { emotionLabelToBackend } from '../utils/journalConverter';
import { saveReport, saveStats, getSavedReports, getSavedStats, SavedReport, SavedStats, hasCurrentMonthStats } from '../services/savedRecordsService';
import { useState, useEffect, useCallback } from 'react';

type Emotion = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type StatsScreenProps = {
  onBack: () => void;
};

// 감정 설정
const EMOTIONS: Emotion[] = [
  { label: '기쁨', icon: 'sunny', color: '#fcd34d' },
  { label: '평온', icon: 'leaf', color: '#a5b4fc' },
  { label: '슬픔', icon: 'rainy', color: '#93c5fd' },
  { label: '화남', icon: 'flame', color: '#fca5a5' },
  { label: '불안', icon: 'alert-circle', color: '#fdba74' },
  { label: '지침', icon: 'moon', color: '#a78bfa' },
];

// 주제 설정
type Topic = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const TOPICS: Topic[] = [
  { label: '학업', icon: 'book', color: '#3B82F6' },
  { label: '대인관계', icon: 'people', color: '#10B981' },
  { label: '건강', icon: 'heart', color: '#F59E0B' },
  { label: '취미', icon: 'musical-notes', color: '#8B5CF6' },
  { label: '일상', icon: 'calendar', color: '#64748b' },
];

export default function StatsScreen({ onBack }: StatsScreenProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'records'>('current'); // 탭 상태
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week'); // 통계 기간 선택 (7일/30일)
  const [stats, setStats] = useState<{
    emotion_stats: Array<{ emotion: string; count: number }>;
    topic_stats: Array<{ topic: string; count: number }>;
    total_count: number;
  } | null>(null);
  const [report, setReport] = useState<{ title: string; content: string; insights?: Insight[]; created_at?: string; period_start?: string; period_end?: string } | null>(null);
  const [isLatestReport, setIsLatestReport] = useState(true); // 현재 리포트가 최신인지 여부
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [selectedEvidenceDate, setSelectedEvidenceDate] = useState<string | null>(null);
  const [evidenceJournal, setEvidenceJournal] = useState<{ date: string; content: string } | null>(null);
  // 기록 페이지 관련 상태
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [savedStats, setSavedStats] = useState<SavedStats[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{ type: 'report' | 'stats'; data: SavedReport | SavedStats } | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) {
        console.error('[통계 로드] user_id가 설정되지 않았습니다.');
        throw new Error('user_id가 설정되지 않았습니다.');
      }
      
      console.log(`[통계 로드] 시작 - userId: ${userId}, period: ${selectedPeriod}`);
      
      // 통계와 리포트 병렬 로드
      const [statsData, latestReport] = await Promise.all([
        getStats(userId, selectedPeriod).catch((error) => {
          console.error('[통계 로드] getStats 실패:', error);
          return null;
        }),
        getLatestReport(userId).catch((error) => {
          console.error('[통계 로드] getLatestReport 실패:', error);
          return null;
        }),
      ]);
      
      console.log(`[통계 로드] 결과 - statsData:`, statsData ? `total_count=${statsData.total_count}` : 'null');
      console.log(`[통계 로드] 결과 - latestReport:`, latestReport ? '있음' : 'null');
      
      // 통계 설정
      if (statsData) {
        const emotionMap: Record<string, string> = {
          'JOY': '기쁨',
          'CALM': '평온',
          'SADNESS': '슬픔',
          'ANGER': '화남',
          'ANXIETY': '불안',
          'EXHAUSTED': '지침',
        };
        
        const convertedEmotionStats = statsData.emotion_stats.map(stat => ({
          emotion: emotionMap[stat.emotion] || stat.emotion,
          count: stat.count,
        }));
        
        setStats({
          emotion_stats: convertedEmotionStats,
          topic_stats: statsData.topic_stats,
          total_count: statsData.total_count,
        });

        // 통계 자동 저장 (한달 간격)
        try {
          const hasCurrentStats = await hasCurrentMonthStats();
          if (!hasCurrentStats && statsData.total_count > 0) {
            // 현재 월 통계가 없고 데이터가 있으면 자동 저장
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const periodStart = new Date(year, month, 1).toISOString().split('T')[0];
            const periodEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

            await saveStats({
              emotion_stats: convertedEmotionStats,
              topic_stats: statsData.topic_stats,
              total_count: statsData.total_count,
              period_start: periodStart,
              period_end: periodEnd,
            });
            console.log('[통계 자동 저장] 현재 월 통계 저장 완료');
          }
        } catch (error) {
          console.error('[통계 자동 저장] 실패:', error);
          // 에러가 나도 통계는 계속 표시
        }
      } else {
        setStats({
          emotion_stats: [],
          topic_stats: [],
          total_count: 0,
        });
      }
      
      // 리포트 설정 (있으면 표시)
      if (latestReport) {
        setReport({
          title: '감정 레포트',
          content: latestReport.report || '',
          insights: latestReport.insights || [],
          created_at: latestReport.created_at,
          period_start: latestReport.period_start,
          period_end: latestReport.period_end,
        });
        setIsLatestReport(true); // 최신 리포트 로드 시
      } else {
        setReport(null);
        setIsLatestReport(true);
      }
    } catch (error) {
      console.error('통계/리포트 로드 실패:', error);
      setStats({
        emotion_stats: [],
        topic_stats: [],
        total_count: 0,
      });
      // 리포트는 null로 두고, 있으면 표시되도록 함
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords();
    }
  }, [activeTab]);

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('오류', 'user_id가 설정되지 않았습니다.');
        return;
      }

      // 모든 일기 가져오기
      const allJournals = await getAllJournals();
      
      console.log(`[리포트 생성] 전체 일기 수: ${allJournals.length}개`);
      
      // 리포트 생성 시 최근 90일 데이터 사용 (더 넓은 범위)
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - 90);

      const filteredJournals = allJournals.filter(journal => {
        const journalDate = new Date(journal.date + 'T00:00:00');
        return journalDate >= cutoffDate;
      });

      console.log(`[리포트 생성] 필터링 후 일기 수: ${filteredJournals.length}개 (최근 90일)`);

      if (filteredJournals.length === 0) {
        // 90일 이내 데이터가 없으면 전체 데이터 사용
        console.log(`[리포트 생성] 최근 90일 데이터가 없어 전체 데이터 사용`);
        if (allJournals.length === 0) {
          Alert.alert('알림', '리포트를 생성할 일기 데이터가 없습니다.');
          return;
        }
        // 전체 데이터 사용
        filteredJournals.push(...allJournals);
      }

      // 리포트 생성 요청 형식으로 변환
      const diaryEntriesForReport: DiaryEntryForReport[] = filteredJournals.map(journal => ({
        date: journal.date,
        content: journal.content,
        topic: journal.topic || null,
        emotion: journal.emotion ? emotionLabelToBackend(journal.emotion.label) : null,
      }));

      // 리포트 생성 API 호출
      const result = await generateWeeklyReport({
        user_id: userId,
        diary_entries: diaryEntriesForReport,
      });

      // 리포트 업데이트
      setReport({
        title: '감정 레포트',
        content: result.report || '리포트 생성에 실패했습니다.',
        insights: result.insights || [],
        created_at: result.created_at,
        period_start: result.period_start,
        period_end: result.period_end,
      });
      setIsLatestReport(true); // 새로 생성된 리포트는 최신
      
      // DB에서 최신 리포트 다시 조회 (화면 갱신)
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // DB 저장 대기
        const latestReport = await getLatestReport(userId);
        if (latestReport) {
          setReport({
            title: '감정 레포트',
            content: latestReport.report || '',
            insights: latestReport.insights || [],
            created_at: latestReport.created_at,
            period_start: latestReport.period_start,
            period_end: latestReport.period_end,
          });
          setIsLatestReport(true);
        }
      } catch (error) {
        console.error('[리포트 생성] 재조회 실패:', error);
        // 무시 (이미 리포트는 표시됨)
      }

      Alert.alert('성공', '리포트가 생성되었습니다.');
    } catch (error) {
      console.error('리포트 생성 실패:', error);
      let errorMessage = '리포트 생성에 실패했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 중첩된 에러 메시지 정리
        if (errorMessage.includes('리포트 생성 실패:')) {
          errorMessage = errorMessage.replace('리포트 생성 실패:', '').trim();
        }
        
        // [object Object] 패턴 제거
        if (errorMessage.includes('[object Object]')) {
          errorMessage = '서버에서 리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
        
        // JSON 형식의 에러 메시지에서 detail 추출 시도
        if (errorMessage.startsWith('{') || errorMessage.startsWith('[')) {
          try {
            const errorJson = JSON.parse(errorMessage);
            if (Array.isArray(errorJson)) {
              errorMessage = errorJson
                .map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (typeof item === 'object' && item !== null) {
                    return item.msg || item.message || '오류가 발생했습니다.';
                  }
                  return String(item);
                })
                .join(', ');
            } else if (errorJson.detail) {
              errorMessage = String(errorJson.detail);
            } else if (errorJson.message) {
              errorMessage = String(errorJson.message);
            }
          } catch {
            // JSON 파싱 실패 시 기본 메시지 사용
            errorMessage = '서버에서 리포트 생성 중 오류가 발생했습니다.';
          }
        }
      } else {
        // Error 객체가 아닌 경우
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = '알 수 없는 오류가 발생했습니다.';
        }
      }
      
      // 에러 메시지가 너무 길면 자르기
      if (errorMessage.length > 150) {
        errorMessage = errorMessage.substring(0, 150) + '...';
      }
      
      Alert.alert('오류', errorMessage);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSaveReport = async () => {
    if (!report) {
      Alert.alert('알림', '저장할 레포트가 없습니다.');
      return;
    }

    try {
      await saveReport({
        title: report.title || '감정 레포트',
        content: report.content,
        insights: report.insights || [],
        period_start: report.period_start || '',
        period_end: report.period_end || '',
      });
      Alert.alert('성공', '레포트가 기록 페이지에 저장되었습니다.');
    } catch (error) {
      console.error('레포트 저장 실패:', error);
      Alert.alert('오류', `레포트 저장에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const loadRecords = async () => {
    try {
      setLoadingRecords(true);
      const [reports, stats] = await Promise.all([
        getSavedReports(),
        getSavedStats(),
      ]);
      setSavedReports(reports);
      setSavedStats(stats);
    } catch (error) {
      console.error('기록 로드 실패:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  const totalCount = stats?.total_count || 0;
  const topicData = stats?.topic_stats.filter(item => item.count > 0) || [];
  const emotionData = stats?.emotion_stats.filter(item => item.count > 0) || [];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F3E8FF', '#FCE7F3']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>통계 및 리포트</Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === 'current' 
                ? (selectedPeriod === 'week' ? '최근 7일' : '최근 30일')
                : '저장된 기록'}
            </Text>
          </View>
        </View>
      </View>

      {/* 탭 UI */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            현재 통계/리포트
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'records' && styles.tabActive]}
          onPress={() => setActiveTab('records')}
        >
          <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>
            기록
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'records' ? (
          /* 기록 페이지 */
          loadingRecords ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : savedReports.length === 0 && savedStats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>저장된 기록이 없어요</Text>
              <Text style={styles.emptySubtitle}>
                레포트를 생성하고 저장하거나{'\n'}
                통계가 자동으로 저장될 때까지 기다려주세요
              </Text>
            </View>
          ) : (
            <>
              {/* 저장된 레포트 섹션 */}
              {savedReports.length > 0 && (
                <View style={styles.recordsSection}>
                  <Text style={styles.recordsSectionTitle}>저장된 레포트</Text>
                  {savedReports.map((savedReport) => (
                    <TouchableOpacity
                      key={savedReport.id}
                      style={styles.recordCard}
                      onPress={() => setSelectedRecord({ type: 'report', data: savedReport })}
                    >
                      <View style={styles.recordCardHeader}>
                        <Text style={styles.recordCardTitle}>{savedReport.title}</Text>
                        <Text style={styles.recordCardDate}>
                          {new Date(savedReport.saved_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.recordCardPeriod}>
                        {new Date(savedReport.period_start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~{' '}
                        {new Date(savedReport.period_end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </Text>
                      <Text style={styles.recordCardPreview} numberOfLines={2}>
                        {savedReport.content}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 저장된 통계 섹션 */}
              {savedStats.length > 0 && (
                <View style={styles.recordsSection}>
                  <Text style={styles.recordsSectionTitle}>저장된 통계</Text>
                  {savedStats.map((savedStat) => (
                    <TouchableOpacity
                      key={savedStat.id}
                      style={styles.recordCard}
                      onPress={() => setSelectedRecord({ type: 'stats', data: savedStat })}
                    >
                      <View style={styles.recordCardHeader}>
                        <Text style={styles.recordCardTitle}>
                          {new Date(savedStat.period_start).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                          })} 통계
                        </Text>
                        <Text style={styles.recordCardDate}>
                          {new Date(savedStat.saved_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.recordCardPeriod}>
                        {new Date(savedStat.period_start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~{' '}
                        {new Date(savedStat.period_end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </Text>
                      <Text style={styles.recordCardPreview}>
                        총 {savedStat.total_count}개의 기록 • 감정 {savedStat.emotion_stats.length}종 • 주제 {savedStat.topic_stats.length}종
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )
        ) : loading ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          </View>
        ) : totalCount === 0 ? (
          <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
              </View>
            <Text style={styles.emptyTitle}>아직 데이터가 없어요</Text>
            <Text style={styles.emptySubtitle}>
              {selectedPeriod === 'week' 
                ? '최근 7일 동안 작성된 감정 메모가 없습니다.\n기간을 30일로 변경하거나 새로운 메모를 작성해보세요.'
                : '최근 30일 동안 작성된 감정 메모가 없습니다.\n기간을 7일로 변경하거나 새로운 메모를 작성해보세요.'}
            </Text>
          </View>
        ) : (
          <>
            {/* 기간 선택 버튼 - 항상 표시 */}
            <View style={styles.periodSelectorContainer}>
              <TouchableOpacity
                style={[styles.statPeriodButton, selectedPeriod === 'week' && styles.statPeriodButtonActive]}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[styles.statPeriodButtonText, selectedPeriod === 'week' && styles.statPeriodButtonTextActive]}>
                  7일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statPeriodButton, selectedPeriod === 'month' && styles.statPeriodButtonActive]}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[styles.statPeriodButtonText, selectedPeriod === 'month' && styles.statPeriodButtonTextActive]}>
                  30일
                </Text>
              </TouchableOpacity>
            </View>

            {/* 통계 통합 박스 */}
            {(topicData.length > 0 || emotionData.length > 0) && (
              <View style={styles.statCard}>
                {/* 주제별 통계 */}
                {topicData.length > 0 && (
                  <>
                    <Text style={styles.statTitle}>주제별 통계</Text>
                    <View style={styles.statContent}>
                      {topicData.map((item) => {
                        const topicInfo = TOPICS.find(t => t.label === item.topic);
                        return (
                          <View key={item.topic} style={styles.emotionStatItem}>
                            <View style={styles.emotionStatInfo}>
                              <Ionicons name={topicInfo?.icon || 'ellipse'} size={18} color={topicInfo?.color || '#94a3b8'} />
                              <Text style={styles.emotionStatLabel}>{item.topic}</Text>
                            </View>
                            <Text style={styles.emotionStatCount}>{item.count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* 구분선 */}
                {topicData.length > 0 && emotionData.length > 0 && (
                  <View style={styles.statDivider} />
                )}

                {/* 감정별 통계 */}
                {emotionData.length > 0 && (
                  <>
                    <Text style={styles.statTitle}>감정별 통계</Text>
                    <View style={styles.statContent}>
                      {emotionData.map((item) => {
                        const emotionInfo = EMOTIONS.find(e => e.label === item.emotion);
                        return (
                          <View key={item.emotion} style={styles.emotionStatItem}>
                            <View style={styles.emotionStatInfo}>
                              <Ionicons name={emotionInfo?.icon || 'ellipse'} size={18} color={emotionInfo?.color || '#94a3b8'} />
                              <Text style={styles.emotionStatLabel}>{item.emotion}</Text>
                            </View>
                            <Text style={styles.emotionStatCount}>{item.count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* 레포트 섹션 */}
            <View style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>감정 레포트</Text>
                  {report?.period_start && report?.period_end && (
                    <Text style={styles.reportPeriodText}>
                      {new Date(report.period_start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ {new Date(report.period_end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* 이전 리포트 버튼 */}
                  {!isLatestReport && report?.created_at && (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={async () => {
                        try {
                          const userId = await getUserId();
                          if (!userId || !report?.created_at) return;
                          
                          const previousReport = await getPreviousReport(userId, report.created_at);
                          if (previousReport) {
                            setReport({
                              title: '감정 레포트',
                              content: previousReport.report || '',
                              insights: previousReport.insights || [],
                              created_at: previousReport.created_at,
                              period_start: previousReport.period_start,
                              period_end: previousReport.period_end,
                            });
                            setIsLatestReport(false); // 이전 리포트를 보면 더 이상 최신이 아님
                          } else {
                            Alert.alert('알림', '이전 리포트가 없습니다.');
                          }
                        } catch (error) {
                          console.error('이전 리포트 조회 실패:', error);
                          Alert.alert('오류', '이전 리포트를 불러오는데 실패했습니다.');
                        }
                      }}
                    >
                      <Ionicons name="chevron-back" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                  )}
                  {/* 최신 리포트로 돌아가기 버튼 */}
                  {!isLatestReport && (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={async () => {
                        try {
                          const userId = await getUserId();
                          if (!userId) return;
                          
                          const latestReport = await getLatestReport(userId);
                          if (latestReport) {
                            setReport({
                              title: '감정 레포트',
                              content: latestReport.report || '',
                              insights: latestReport.insights || [],
                              created_at: latestReport.created_at,
                              period_start: latestReport.period_start,
                              period_end: latestReport.period_end,
                            });
                            setIsLatestReport(true);
                          } else {
                            Alert.alert('알림', '리포트가 없습니다.');
                            setReport(null);
                            setIsLatestReport(true);
                          }
                        } catch (error) {
                          console.error('최신 리포트 조회 실패:', error);
                        }
                      }}
                    >
                      <Text style={styles.navButtonText}>최신</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.testButton, generatingReport && styles.testButtonDisabled]}
                    onPress={handleGenerateReport}
                    disabled={generatingReport}
                  >
                    {generatingReport ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.testButtonText}>생성</Text>
                    )}
                  </TouchableOpacity>
                  {/* 저장하기 버튼 */}
                  {report?.content && (
                    <TouchableOpacity
                      style={[styles.testButton, { backgroundColor: '#10B981', marginLeft: 8 }]}
                      onPress={handleSaveReport}
                    >
                      <Text style={styles.testButtonText}>저장하기</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <LinearGradient
                colors={['rgba(128, 128, 128, 0.08)', 'rgba(128, 128, 128, 0.05)']}
                style={styles.reportContent}
              >
                {generatingReport ? (
                  <View style={styles.reportLoading}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={styles.reportLoadingText}>리포트 생성 중...</Text>
                  </View>
                ) : report?.content ? (
                  <>
                    {/* 한줄요약 (리포트 첫 줄) */}
                    {(() => {
                      const lines = report.content.split('\n\n');
                      const summary = lines[0] || '';
                      const body = lines.slice(1).join('\n\n');
                      return (
                        <>
                          {summary && (
                            <Text style={styles.reportSummary}>"{summary}"</Text>
                          )}
                          {body && (
                            <Text style={styles.reportContentText}>{body}</Text>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <View style={styles.reportEmpty}>
                    <Text style={styles.reportEmptyText}>리포트가 없습니다.</Text>
                    <Text style={styles.reportEmptySubtext}>'생성' 버튼을 눌러 리포트를 만들어보세요.</Text>
                  </View>
                )}
              </LinearGradient>

              {report?.insights && report.insights.length > 0 && (
                <TouchableOpacity
                  style={styles.insightsButton}
                  onPress={() => setShowInsightsModal(true)}
                >
                  <Ionicons name="information-circle-outline" size={20} color="#64748b" />
                  <Text style={styles.insightsButtonText}>이 메모들을 바탕으로 작성됐어요!</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* 근거보기 모달 */}
      <Modal
        visible={showInsightsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInsightsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>리포트 근거</Text>
              <TouchableOpacity
                onPress={() => setShowInsightsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {report?.insights && report.insights.length > 0 ? (
                <>
                  {report.insights.map((insight, index) => (
                    <View key={index} style={styles.insightItem}>
                      {/* 자연어 1줄 요약과 날짜 버튼을 같은 줄에 배치 */}
                      <View style={styles.insightRow}>
                        <Text style={styles.insightSummary}>
                          {insight.summary || insight.description}
                        </Text>
                        {/* 날짜를 [1] [2] 형태로 텍스트 옆에 표시 */}
                        {insight.date_references && insight.date_references.length > 0 && (
                          <View style={styles.insightDateButtons}>
                            {insight.date_references.map((date, dateIndex) => (
                              <TouchableOpacity
                                key={dateIndex}
                                style={styles.insightDateButton}
                                onPress={async () => {
                                  try {
                                    const journals = await getAllJournals();
                                    const journal = journals.find(j => j.date === date);
                                    if (journal && journal.content) {
                                      Alert.alert(
                                        date,
                                        journal.content,
                                        [{ text: '확인', style: 'default' }]
                                      );
                                    } else {
                                      Alert.alert('알림', '해당 날짜의 메모를 찾을 수 없습니다.');
                                    }
                                  } catch (error) {
                                    console.error('메모 가져오기 실패:', error);
                                    Alert.alert('오류', '메모를 불러오는데 실패했습니다.');
                                  }
                                }}
                              >
                                <Text style={styles.insightDateButtonText}>[{dateIndex + 1}]</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.noInsightsText}>근거 데이터가 없습니다.</Text>
              )}
            </ScrollView>
          </View>
          </View>
        </Modal>
        
        {/* 근거 메모 모달 */}
        <Modal
          visible={evidenceJournal !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setEvidenceJournal(null);
            setSelectedEvidenceDate(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>근거 메모</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEvidenceJournal(null);
                    setSelectedEvidenceDate(null);
                  }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {evidenceJournal && (
                  <>
                    <Text style={styles.evidenceDateLabel}>{evidenceJournal.date}</Text>
                    <Text style={styles.evidenceContent}>{evidenceJournal.content}</Text>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 기록 상세 보기 모달 */}
        <Modal
          visible={selectedRecord !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedRecord?.type === 'report' ? '저장된 레포트' : '저장된 통계'}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedRecord(null)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {selectedRecord?.type === 'report' && (
                  <>
                    {(() => {
                      const savedReport = selectedRecord.data as SavedReport;
                      return (
                        <>
                          <View style={styles.recordDetailHeader}>
                            <Text style={styles.recordDetailTitle}>{savedReport.title}</Text>
                            <Text style={styles.recordDetailDate}>
                              저장일: {new Date(savedReport.saved_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </Text>
                            <Text style={styles.recordDetailPeriod}>
                              {new Date(savedReport.period_start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~{' '}
                              {new Date(savedReport.period_end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </Text>
                          </View>
                          <View style={styles.recordDetailContent}>
                            {(() => {
                              const lines = savedReport.content.split('\n\n');
                              const summary = lines[0] || '';
                              const body = lines.slice(1).join('\n\n');
                              return (
                                <>
                                  {summary && (
                                    <Text style={styles.reportSummary}>"{summary}"</Text>
                                  )}
                                  {body && (
                                    <Text style={styles.reportContentText}>{body}</Text>
                                  )}
                                </>
                              );
                            })()}
                          </View>
                        </>
                      );
                    })()}
                  </>
                )}
                {selectedRecord?.type === 'stats' && (
                  <>
                    {(() => {
                      const savedStat = selectedRecord.data as SavedStats;
                      return (
                        <>
                          <View style={styles.recordDetailHeader}>
                            <Text style={styles.recordDetailTitle}>
                              {new Date(savedStat.period_start).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                              })} 통계
                            </Text>
                            <Text style={styles.recordDetailDate}>
                              저장일: {new Date(savedStat.saved_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </Text>
                            <Text style={styles.recordDetailPeriod}>
                              {new Date(savedStat.period_start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~{' '}
                              {new Date(savedStat.period_end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </Text>
                          </View>
                          <View style={styles.recordDetailContent}>
                            {/* 감정별 통계 */}
                            {savedStat.emotion_stats.length > 0 && (
                              <View style={styles.statCard}>
                                <Text style={styles.statTitle}>감정별 통계</Text>
                                <View style={styles.statContent}>
                                  {savedStat.emotion_stats.map((item) => {
                                    const emotionInfo = EMOTIONS.find(e => e.label === item.emotion);
                                    return (
                                      <View key={item.emotion} style={styles.emotionStatItem}>
                                        <View style={styles.emotionStatInfo}>
                                          <Ionicons name={emotionInfo?.icon || 'ellipse'} size={18} color={emotionInfo?.color || '#94a3b8'} />
                                          <Text style={styles.emotionStatLabel}>{item.emotion}</Text>
                                        </View>
                                        <Text style={styles.emotionStatCount}>{item.count}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}

                            {/* 주제별 통계 */}
                            {savedStat.topic_stats.length > 0 && (
                              <View style={styles.statCard}>
                                <Text style={styles.statTitle}>주제별 통계</Text>
                                <View style={styles.statContent}>
                                  {savedStat.topic_stats.map((item) => {
                                    const topicInfo = TOPICS.find(t => t.label === item.topic);
                                    return (
                                      <View key={item.topic} style={styles.emotionStatItem}>
                                        <View style={styles.emotionStatInfo}>
                                          <Ionicons name={topicInfo?.icon || 'ellipse'} size={18} color={topicInfo?.color || '#94a3b8'} />
                                          <Text style={styles.emotionStatLabel}>{item.topic}</Text>
                                        </View>
                                        <Text style={styles.emotionStatCount}>{item.count}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                          </View>
                        </>
                      );
                    })()}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

const getTopicColor = (topic: string) => {
  const colors: Record<string, string> = {
    '학업': '#3B82F6',
    '대인관계': '#10B981',
    '일상': '#8B5CF6',
  };
  return colors[topic] || '#94a3b8';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 10,
  },
  statDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
    marginHorizontal: -14,
  },
  statContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  emotionStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emotionStatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emotionStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  emotionStatCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 2,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  testButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#94a3b8',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  reportPeriodText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  reportEmpty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  reportEmptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  periodButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statPeriodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statPeriodButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  statPeriodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  statPeriodButtonTextActive: {
    color: '#fff',
  },
  reportContent: {
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
  },
  reportLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  reportLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  reportSummary: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    lineHeight: 30,
  },
  reportContentText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  reportHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  insightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  insightsButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    padding: 20,
  },
  insightItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  insightSummary: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
  },
  insightDateButtons: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
  },
  insightDateButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightDateButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTypeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
  },
  insightDescription: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
    marginBottom: 8,
  },
  insightEvidence: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#a78bfa',
  },
  insightDates: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  insightDatesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 8,
  },
  dateTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  dateTagText: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '500',
  },
  noInsightsText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 40,
  },
  evidenceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  evidenceDateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  evidenceDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  evidenceDateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4f46e5',
  },
  evidenceDateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  evidenceContent: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  modalEvidenceSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalEvidenceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalEvidenceDateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalEvidenceDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalEvidenceDateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4f46e5',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  recordsSection: {
    marginBottom: 24,
  },
  recordsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  recordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recordCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  recordCardDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
  },
  recordCardPeriod: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  recordCardPreview: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  recordDetailHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  recordDetailDate: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  recordDetailPeriod: {
    fontSize: 14,
    color: '#64748b',
  },
  recordDetailContent: {
    marginTop: 8,
  },
});
