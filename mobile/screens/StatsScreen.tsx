import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getStats, getReport, generateWeeklyReport, getLatestReport, getPreviousReport, DiaryEntryForReport, Insight } from '../services/api';
import { getUserId } from '../services/userService';
import { getAllJournals } from '../services/journalService';
import { emotionLabelToBackend } from '../utils/journalConverter';
import { useState, useEffect } from 'react';

type Emotion = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type StatsScreenProps = {
  onBack: () => void;
  onNavigateToJournalWrite?: (emotion: Emotion, date: string, journal?: any) => void;
  shouldOpenTransitionModal?: boolean;
  onTransitionModalOpened?: () => void;
  onNavigateToReport?: () => void;
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

export default function StatsScreen({ onBack, onNavigateToJournalWrite, shouldOpenTransitionModal, onTransitionModalOpened, onNavigateToReport }: StatsScreenProps) {
  const [stats, setStats] = useState<{
    emotion_stats: Array<{ emotion: string; count: number }>;
    topic_stats: Array<{ topic: string; count: number }>;
    total_count: number;
  } | null>(null);
  const [report, setReport] = useState<{ title: string; content: string; summary?: string; insights?: Insight[]; created_at?: string; period_start?: string; period_end?: string; pattern_summary?: string } | null>(null);
  const [isLatestReport, setIsLatestReport] = useState(true); // 현재 리포트가 최신인지 여부
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [selectedEvidenceDate, setSelectedEvidenceDate] = useState<string | null>(null);
  const [evidenceJournal, setEvidenceJournal] = useState<{ date: string; content: string } | null>(null);
  const [journals, setJournals] = useState<Array<{ date: string; emotion: Emotion | null; topic?: string; content?: string }>>([]);
  const [allJournalsData, setAllJournalsData] = useState<any[]>([]);
  const [selectedTransitionInsights, setSelectedTransitionInsights] = useState<Insight[]>([]);
  const [showTransitionInsightsModal, setShowTransitionInsightsModal] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<{ from: Emotion; to: Emotion } | null>(null);
  const [showAllEmotionTransitions, setShowAllEmotionTransitions] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);

  useEffect(() => {
    loadStats();
    loadJournals();
  }, []);

  useEffect(() => {
    if (shouldOpenTransitionModal && selectedTransitionInsights.length > 0) {
      setShowTransitionInsightsModal(true);
      if (onTransitionModalOpened) {
        onTransitionModalOpened();
      }
    }
  }, [shouldOpenTransitionModal, selectedTransitionInsights.length, onTransitionModalOpened]);

  const loadJournals = async () => {
    try {
      const allJournals = await getAllJournals();
      setAllJournalsData(allJournals);
      setJournals(allJournals.map(j => ({
        date: j.date,
        emotion: j.emotion ? {
          label: j.emotion.label,
          icon: j.emotion.icon as keyof typeof Ionicons.glyphMap,
          color: j.emotion.color,
        } : null,
        topic: j.topic,
        content: j.content,
      })));
    } catch (error) {
      console.error('일기 데이터 로드 실패:', error);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) {
        throw new Error('user_id가 설정되지 않았습니다.');
      }
      
      // 통계와 리포트 병렬 로드
      const [statsData, latestReport] = await Promise.all([
        getStats(userId, 'month').catch(() => null), // 에러가 나도 null
        getLatestReport(userId), // 에러가 나도 null
      ]);
      
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
          summary: latestReport.summary || '',
          insights: latestReport.insights || [],
          created_at: latestReport.created_at,
          period_start: latestReport.period_start,
          period_end: latestReport.period_end,
          pattern_summary: latestReport.pattern_summary || '',
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
  };

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
      
      // 최근 30일 데이터 사용
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - 30);

      const filteredJournals = allJournals.filter(journal => {
        const journalDate = new Date(journal.date + 'T00:00:00');
        return journalDate >= cutoffDate;
      });

      if (filteredJournals.length === 0) {
        Alert.alert('알림', '리포트를 생성할 일기 데이터가 없습니다.');
        return;
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
        summary: result.summary || '',
        insights: result.insights || [],
        created_at: result.created_at,
        period_start: result.period_start,
        period_end: result.period_end,
        pattern_summary: result.pattern_summary || '',
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
            summary: latestReport.summary || '',
            insights: latestReport.insights || [],
            created_at: latestReport.created_at,
            period_start: latestReport.period_start,
            period_end: latestReport.period_end,
            pattern_summary: latestReport.pattern_summary || '',
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
      Alert.alert('오류', `리포트 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setGeneratingReport(false);
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
            <Text style={styles.headerSubtitle}>최근 1달</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
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
              감정 메모를 작성하면{'\n'}
              통계와 레포트를 확인할 수 있습니다
            </Text>
          </View>
        ) : (
          <>
            {/* 감정 변화 카드 (상위 3개) */}
            {(() => {
              if (!report?.insights || journals.length === 0) return null;

              // 감정 강도 매핑
              const EMOTION_INTENSITY: Record<string, number> = {
                '기쁨': 3,
                '평온': 2,
                '지침': 2,
                '불안': 3,
                '슬픔': 4,
                '화남': 5,
              };

              // 인사이트에서 감정 변화 추출
              const getEmotionTransition = (insight: Insight) => {
                if (!insight.date_references || insight.date_references.length < 2) {
                  return null;
                }

                const sortedDates = [...insight.date_references].sort();
                const emotionList: Array<{ date: string; emotion: Emotion | null }> = [];

                sortedDates.forEach(date => {
                  const journal = journals.find(j => j.date === date);
                  if (journal && journal.emotion) {
                    emotionList.push({ date, emotion: journal.emotion });
                  } else {
                    emotionList.push({ date, emotion: null });
                  }
                });

                const validEmotions = emotionList.filter(item => item.emotion !== null);
                
                if (validEmotions.length < 2) {
                  return null;
                }

                return {
                  from: validEmotions[0].emotion!,
                  to: validEmotions[validEmotions.length - 1].emotion!,
                  dates: sortedDates,
                };
              };

              // 인사이트에서 주제 추출
              const getTopicFromInsight = (insight: Insight): string | null => {
                if (!insight.date_references || insight.date_references.length === 0) {
                  return null;
                }

                for (const date of insight.date_references) {
                  const journal = journals.find(j => j.date === date);
                  if (journal && journal.topic && journal.topic.trim() && journal.topic.toLowerCase() !== 'none') {
                    return journal.topic;
                  }
                }

                return null;
              };

              // 상위 3개 감정 변화 가져오기
              const getTopEmotionTransitions = () => {
                if (!report?.insights) return [];

                const transitionGroups: Record<string, { 
                  from: Emotion; 
                  to: Emotion; 
                  intensityDiff: number;
                  durationBonus: number;
                  totalScore: number;
                  summaries: string[];
                  insights: Insight[];
                }> = {};

                report.insights.forEach((insight) => {
                  const emotionTransition = getEmotionTransition(insight);
                  if (!emotionTransition) return;

                  // from과 to가 같은 변화는 제외
                  if (emotionTransition.from.label === emotionTransition.to.label) {
                    return;
                  }

                  const transitionKey = `${emotionTransition.from.label}->${emotionTransition.to.label}`;
                  
                  if (!transitionGroups[transitionKey]) {
                    const fromIntensity = EMOTION_INTENSITY[emotionTransition.from.label] || 0;
                    const toIntensity = EMOTION_INTENSITY[emotionTransition.to.label] || 0;
                    const intensityDiff = Math.abs(fromIntensity - toIntensity);

                    // 기간 계산 (가장 이른 날짜와 가장 늦은 날짜)
                    const minDate = new Date(Math.min(...emotionTransition.dates.map(date => new Date(date).getTime())));
                    const maxDate = new Date(Math.max(...emotionTransition.dates.map(date => new Date(date).getTime())));
                    const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const durationBonus = diffDays >= 7 ? 1 : 0;

                    transitionGroups[transitionKey] = {
                      from: emotionTransition.from,
                      to: emotionTransition.to,
                      intensityDiff: intensityDiff,
                      durationBonus: durationBonus,
                      totalScore: intensityDiff + durationBonus,
                      summaries: [],
                      insights: [],
                    };
                  }

                  // 인사이트 추가
                  transitionGroups[transitionKey].insights.push(insight);

                  // 인사이트 summary 추가
                  if (insight.summary && insight.summary.trim()) {
                    transitionGroups[transitionKey].summaries.push(insight.summary);
                  } else if (insight.description && insight.description.trim()) {
                    const firstLine = insight.description.split('\n')[0] || insight.description;
                    if (firstLine.length > 50) {
                      transitionGroups[transitionKey].summaries.push(firstLine.substring(0, 50) + '...');
                    } else {
                      transitionGroups[transitionKey].summaries.push(firstLine);
                    }
                  }
                });

                // 점수 기준으로 정렬 (필터링은 나중에)
                return Object.values(transitionGroups)
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .map(transition => {
                    const { summaries, insights, ...rest } = transition;
                    return {
                      ...rest,
                      summary: summaries[0] || '',
                      insights: insights,
                    };
                  });
              };

              const allEmotionTransitions = getTopEmotionTransitions();
              const topEmotionTransitions = showAllEmotionTransitions 
                ? allEmotionTransitions 
                : allEmotionTransitions.slice(0, 3);

              // 디버깅: 감정 변화 개수 확인
              console.log('[StatsScreen] 감정 변화 개수:', allEmotionTransitions.length);

              if (allEmotionTransitions.length === 0) return null;

              return (
                <View style={styles.emotionTransitionCard}>
                  <Text style={styles.emotionTransitionTitle}>주요 감정 변화</Text>
                  {topEmotionTransitions.map((transition, index) => {
                    const fromEmotionInfo = EMOTIONS.find(e => e.label === transition.from.label);
                    const toEmotionInfo = EMOTIONS.find(e => e.label === transition.to.label);
                    
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.emotionTransitionCardItem}
                        onPress={() => {
                          setSelectedTransitionInsights(transition.insights);
                          setSelectedTransition({ from: transition.from, to: transition.to });
                          setShowTransitionInsightsModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.emotionTransitionItem}>
                          {fromEmotionInfo && (
                            <View style={styles.emotionTransitionIcon}>
                              <Ionicons 
                                name={fromEmotionInfo.icon as any} 
                                size={32} 
                                color={fromEmotionInfo.color} 
                              />
                              <Text style={[styles.emotionTransitionLabel, { color: fromEmotionInfo.color }]}>
                                {fromEmotionInfo.label}
                              </Text>
                            </View>
                          )}
                          <Ionicons name="arrow-forward" size={28} color="#64748b" style={styles.arrowIcon} />
                          {toEmotionInfo && (
                            <View style={styles.emotionTransitionIcon}>
                              <Ionicons 
                                name={toEmotionInfo.icon as any} 
                                size={32} 
                                color={toEmotionInfo.color} 
                              />
                              <Text style={[styles.emotionTransitionLabel, { color: toEmotionInfo.color }]}>
                                {toEmotionInfo.label}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        {/* 인사이트 요약 */}
                        {transition.summary && (
                          <Text style={styles.transitionSummary} numberOfLines={2}>
                            {transition.summary}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  
                  {/* 더보기 버튼 */}
                  {allEmotionTransitions.length > 3 && (
                    <TouchableOpacity
                      style={styles.showMoreButton}
                      onPress={() => setShowAllEmotionTransitions(!showAllEmotionTransitions)}
                    >
                      <Text style={styles.showMoreButtonText}>
                        {showAllEmotionTransitions ? '접기' : `더보기 (${allEmotionTransitions.length - 3}개 더)`}
                      </Text>
                      <Ionicons 
                        name={showAllEmotionTransitions ? 'chevron-up' : 'chevron-down'} 
                        size={20} 
                        color="#8B5CF6" 
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {/* 레포트 분석하기 버튼 */}
            <TouchableOpacity
              style={styles.analyzeReportButton}
              onPress={() => {
                if (onNavigateToReport) {
                  onNavigateToReport();
                } else {
                  handleGenerateReport();
                }
              }}
              disabled={generatingReport}
            >
              {generatingReport ? (
                <>
                  <ActivityIndicator size="small" color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={styles.analyzeReportButtonText}>분석 중...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="analytics" size={20} color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={styles.analyzeReportButtonText}>주요 감정 변화를 바탕으로 나에 대해 분석하기</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 주제별 통계 */}
            {topicData.length > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>주제별 통계</Text>
                <View style={styles.statContent}>
                  {topicData.map((item) => {
                    const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                    const topicInfo = TOPICS.find(t => t.label === item.topic);
                    return (
                      <View key={item.topic} style={styles.emotionStatItem}>
                        <View style={styles.emotionStatInfo}>
                          <Ionicons name={topicInfo?.icon || 'ellipse'} size={20} color={topicInfo?.color || '#94a3b8'} />
                          <Text style={styles.emotionStatLabel}>{item.topic}</Text>
                        </View>
                        <View style={styles.barContainer}>
                          <View 
                            style={[
                              styles.bar, 
                              { 
                                width: `${percentage}%`, 
                                backgroundColor: topicInfo?.color || '#94a3b8'
                              }
                            ]} 
                          />
                        </View>
                        <Text style={styles.emotionStatCount}>{item.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

                {/* 감정별 통계 */}
                {emotionData.length > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>감정별 통계</Text>
                <View style={styles.statContent}>
                  {emotionData.map((item) => {
                    const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                    const emotionInfo = EMOTIONS.find(e => e.label === item.emotion);
                    return (
                      <View key={item.emotion} style={styles.emotionStatItem}>
                        <View style={styles.emotionStatInfo}>
                          <Ionicons name={emotionInfo?.icon || 'ellipse'} size={20} color={emotionInfo?.color || '#94a3b8'} />
                          <Text style={styles.emotionStatLabel}>{item.emotion}</Text>
                        </View>
                        <View style={styles.barContainer}>
                          <View 
                            style={[
                              styles.bar, 
                              { 
                                width: `${percentage}%`, 
                                backgroundColor: emotionInfo?.color || '#94a3b8'
                              }
                            ]} 
                          />
                        </View>
                        <Text style={styles.emotionStatCount}>{item.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 감정 변화 근거보기 모달 */}
      <Modal
        visible={showTransitionInsightsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTransitionInsightsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>감정 변화 근거</Text>
              <TouchableOpacity
                onPress={() => setShowTransitionInsightsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {selectedTransition && selectedTransitionInsights && selectedTransitionInsights.length > 0 ? (
                <View style={styles.transitionEvidenceContainer}>
                  {/* 감정 변화 표시 */}
                  <View style={styles.transitionEvidenceHeader}>
                    <View style={styles.transitionEvidenceEmotions}>
                      {(() => {
                        const fromEmotionInfo = EMOTIONS.find(e => e.label === selectedTransition.from.label);
                        const toEmotionInfo = EMOTIONS.find(e => e.label === selectedTransition.to.label);
                        return (
                          <>
                            {fromEmotionInfo && (
                              <View style={styles.transitionEvidenceEmotionItem}>
                                <Ionicons 
                                  name={fromEmotionInfo.icon as any} 
                                  size={32} 
                                  color={fromEmotionInfo.color} 
                                />
                                <Text style={[styles.transitionEvidenceEmotionLabel, { color: fromEmotionInfo.color }]}>
                                  {fromEmotionInfo.label}
                                </Text>
                              </View>
                            )}
                            <Ionicons name="arrow-forward" size={24} color="#64748b" style={styles.transitionEvidenceArrow} />
                            {toEmotionInfo && (
                              <View style={styles.transitionEvidenceEmotionItem}>
                                <Ionicons 
                                  name={toEmotionInfo.icon as any} 
                                  size={32} 
                                  color={toEmotionInfo.color} 
                                />
                                <Text style={[styles.transitionEvidenceEmotionLabel, { color: toEmotionInfo.color }]}>
                                  {toEmotionInfo.label}
                                </Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  </View>

                  {/* 인사이트 요약 */}
                  {selectedTransitionInsights[0]?.summary && (
                    <Text style={styles.transitionEvidenceSummary}>
                      {selectedTransitionInsights[0].summary}
                    </Text>
                  )}

                  {/* 메모 바탕 설명 */}
                  <Text style={styles.transitionEvidenceMemoLabel}>
                    아래 메모를 바탕으로 생각했어요.
                  </Text>

                  {/* 참조 날짜들 */}
                  {(() => {
                    const allDates = new Set<string>();
                    selectedTransitionInsights.forEach(insight => {
                      if (insight.date_references) {
                        insight.date_references.forEach(date => allDates.add(date));
                      }
                    });
                    const sortedDates = Array.from(allDates).sort();
                    
                    return (
                      <View style={styles.transitionEvidenceDates}>
                        {sortedDates.map((date, index) => {
                          const journal = allJournalsData.find(j => j.date === date);
                          const journalContent = journal?.content || '메모가 없습니다.';
                          const journalEmotion = journal?.emotion ? {
                            label: journal.emotion.label,
                            icon: journal.emotion.icon as keyof typeof Ionicons.glyphMap,
                            color: journal.emotion.color,
                          } : null;
                          
                          // JournalEntry의 Emotion을 StatsScreen의 Emotion 타입으로 변환
                          let emotionForNavigation: Emotion | null = null;
                          if (journalEmotion) {
                            const emotionInfo = EMOTIONS.find(e => e.label === journalEmotion.label);
                            if (emotionInfo) {
                              emotionForNavigation = emotionInfo;
                            }
                          }
                          
                          return (
                            <TouchableOpacity
                              key={date}
                              style={styles.transitionEvidenceDateItem}
                              onPress={() => {
                                if (onNavigateToJournalWrite && emotionForNavigation) {
                                  onNavigateToJournalWrite(emotionForNavigation, date, journal || null);
                                } else if (onNavigateToJournalWrite) {
                                  // 감정이 없으면 기본 감정으로
                                  const defaultEmotion = EMOTIONS[0];
                                  onNavigateToJournalWrite(defaultEmotion, date, journal || null);
                                }
                              }}
                            >
                              <View style={styles.transitionEvidenceDateHeader}>
                                <Text style={styles.transitionEvidenceDateLabel}>
                                  {date}
                                </Text>
                              </View>
                              <Text style={styles.transitionEvidenceDateContent} numberOfLines={3}>
                                {journalContent}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <Text style={styles.noInsightsText}>근거 데이터가 없습니다.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  statContent: {
    gap: 12,
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
    gap: 12,
  },
  emotionStatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: 8,
  },
  emotionStatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  emotionStatCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    width: 32,
    textAlign: 'right',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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
    marginBottom: 16,
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
    fontSize: 18,
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
  reportContent: {
    borderRadius: 16,
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
    marginTop: 16,
  },
  patternSummaryContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  patternSummaryText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 12,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  showMoreButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
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
  emotionTransitionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emotionTransitionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  emotionTransitionCardItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  emotionTransitionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  emotionTransitionIcon: {
    alignItems: 'center',
    gap: 4,
  },
  emotionTransitionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  arrowIcon: {
    marginHorizontal: 12,
  },
  transitionSummary: {
    fontSize: 16,
    color: '#334155',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  transitionEvidenceContainer: {
    padding: 20,
  },
  transitionEvidenceHeader: {
    marginBottom: 24,
  },
  transitionEvidenceEmotions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  transitionEvidenceEmotionItem: {
    alignItems: 'center',
    gap: 8,
  },
  transitionEvidenceEmotionLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  transitionEvidenceArrow: {
    marginHorizontal: 8,
  },
  transitionEvidenceSummary: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  transitionEvidenceMemoLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '500',
  },
  transitionEvidenceDates: {
    gap: 12,
  },
  transitionEvidenceDateItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  transitionEvidenceDateHeader: {
    marginBottom: 8,
  },
  transitionEvidenceDateLabel: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 4,
  },
  transitionEvidenceDateContent: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  expandStatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  expandStatsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  collapseStatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  collapseStatsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  analyzeReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  analyzeReportButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
});
