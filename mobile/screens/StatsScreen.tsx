import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getStats, getReport, generateWeeklyReport, DiaryEntryForReport } from '../services/api';
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

export default function StatsScreen({ onBack }: StatsScreenProps) {
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month'>('week');
  const [stats, setStats] = useState<{
    emotion_stats: Array<{ emotion: string; count: number }>;
    topic_stats: Array<{ topic: string; count: number }>;
    total_count: number;
  } | null>(null);
  const [report, setReport] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    loadStats();
  }, [reportPeriod]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) {
        throw new Error('user_id가 설정되지 않았습니다.');
      }
      const [statsData, reportData] = await Promise.all([
        getStats(userId, reportPeriod),
        getReport(userId, reportPeriod),
      ]);
      
      // 백엔드 감정을 프론트엔드 형식으로 변환
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
      setReport({
        title: reportData.title,
        content: reportData.content,
      });
    } catch (error) {
      console.error('통계 로드 실패:', error);
      setStats({
        emotion_stats: [],
        topic_stats: [],
        total_count: 0,
      });
      setReport({
        title: reportPeriod === 'week' ? '지난 주의 감정 레포트' : '지난 달의 감정 레포트',
        content: '통계를 불러오는데 실패했습니다.',
      });
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
      
      // 기간에 따라 필터링
      const now = new Date();
      const cutoffDate = new Date();
      if (reportPeriod === 'week') {
        cutoffDate.setDate(now.getDate() - 7);
      } else {
        cutoffDate.setDate(now.getDate() - 30);
      }

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
        diary_entries: diaryEntriesForReport,
      });

      // 리포트 업데이트
      const periodName = reportPeriod === 'week' ? '지난 주' : '지난 달';
      setReport({
        title: `${periodName}의 감정 레포트`,
        content: result.report || '리포트 생성에 실패했습니다.',
      });

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
          <Text style={styles.headerTitle}>통계 및 리포트</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
            </View>
            <Text style={styles.emptyTitle}>아직 데이터가 없어요</Text>
            <Text style={styles.emptySubtitle}>
              감정 메모를 작성하면{'\n'}
              통계와 레포트를 확인할 수 있습니다
            </Text>
          </View>
        ) : (
          <>
            {/* 주제별 통계 */}
            {topicData.length > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>주제별 통계</Text>
                <View style={styles.statContent}>
                  {topicData.map((item) => (
                    <View key={item.topic} style={styles.statItem}>
                      <View style={styles.statItemLeft}>
                        <View style={[styles.statDot, { backgroundColor: getTopicColor(item.topic) }]} />
                        <Text style={styles.statLabel}>{item.topic}</Text>
                      </View>
                      <Text style={styles.statValue}>{item.count}회</Text>
                    </View>
                  ))}
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

            {/* 레포트 섹션 */}
            <View style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>감정 레포트</Text>
                <View style={styles.reportHeaderRight}>
                  <View style={styles.periodSelector}>
                    <TouchableOpacity
                      style={[styles.periodButton, reportPeriod === 'week' && styles.periodButtonActive]}
                      onPress={() => setReportPeriod('week')}
                    >
                      <Text style={[styles.periodButtonText, reportPeriod === 'week' && styles.periodButtonTextActive]}>
                        1주일
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.periodButton, reportPeriod === 'month' && styles.periodButtonActive]}
                      onPress={() => setReportPeriod('month')}
                    >
                      <Text style={[styles.periodButtonText, reportPeriod === 'month' && styles.periodButtonTextActive]}>
                        1개월
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.testButton, generatingReport && styles.testButtonDisabled]}
                    onPress={handleGenerateReport}
                    disabled={generatingReport}
                  >
                    {generatingReport ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.testButtonText}>테스트</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <LinearGradient
                colors={['#F3E8FF', '#FCE7F3']}
                style={styles.reportContent}
              >
                <View style={styles.reportContentHeader}>
                  <Ionicons name="calendar" size={20} color="#8B5CF6" />
                  <Text style={styles.reportContentTitle}>{report?.title || ''}</Text>
                </View>
                <Text style={styles.reportContentText}>{report?.content || ''}</Text>
              </LinearGradient>

              <Text style={styles.reportHint}>
                💡 레포트는 AI가 당신의 감정 패턴을 분석하여 생성됩니다
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
    fontFamily: 'NanumPen',
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
    fontFamily: 'NanumPen',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'NanumPen',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    fontFamily: 'NanumPen',
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
    fontFamily: 'NanumPen',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    fontFamily: 'NanumPen',
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
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    fontFamily: 'NanumPen',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    width: 32,
    textAlign: 'right',
    fontFamily: 'NanumPen',
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
    backgroundColor: '#8B5CF6',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'NanumPen',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'NanumPen',
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
    fontFamily: 'NanumPen',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  reportContent: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  reportContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'NanumPen',
  },
  reportContentText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontFamily: 'NanumPen',
  },
  reportHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'NanumPen',
  },
});
