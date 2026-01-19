import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getLatestReport, Insight } from '../services/api';
import { getUserId } from '../services/userService';
import { getAllJournals } from '../services/journalService';
import { Emotion, JournalEntry } from '../types/journal';

type DeveloperScreenProps = {
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

export default function DeveloperScreen({ onBack }: DeveloperScreenProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<JournalEntry[]>([]);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('오류', 'user_id가 설정되지 않았습니다.');
        return;
      }

      // 인사이트와 메모 목록을 동시에 로드
      const [latestReport, allJournals] = await Promise.all([
        getLatestReport(userId),
        getAllJournals(),
      ]);

      if (latestReport && latestReport.insights) {
        setInsights(latestReport.insights);
      } else {
        setInsights([]);
      }

      setJournals(allJournals);
    } catch (error) {
      console.error('인사이트 로드 실패:', error);
      Alert.alert('오류', '인사이트를 불러오는데 실패했습니다.');
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  const getInsightTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'time_contrast': '시간 대비',
      'repetition': '반복 패턴',
      'causal_relation': '인과 관계',
    };
    return labels[type] || type;
  };

  const getInsightTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'time_contrast': '#3B82F6',
      'repetition': '#10B981',
      'causal_relation': '#8B5CF6',
    };
    return colors[type] || '#64748b';
  };

  const handleDatePress = async (date: string) => {
    try {
      const journal = journals.find((j: { date: string }) => j.date === date);
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
  };

  // 인사이트에서 감정 변화 추출
  const getEmotionTransition = (insight: Insight) => {
    if (!insight.date_references || insight.date_references.length < 2) {
      return null;
    }

    // 날짜순으로 정렬
    const sortedDates = [...insight.date_references].sort();
    const emotionList: Array<{ date: string; emotion: Emotion | null }> = [];

    sortedDates.forEach(date => {
      const journal = journals.find((j: { date: string }) => j.date === date);
      if (journal && journal.emotion) {
        emotionList.push({ date, emotion: journal.emotion });
      } else {
        emotionList.push({ date, emotion: null });
      }
    });

    // 감정이 있는 항목만 필터링
    const validEmotions = emotionList.filter(item => item.emotion !== null);
    
    if (validEmotions.length < 2) {
      return null;
    }

    // 첫 번째와 마지막 감정 반환
    return {
      from: validEmotions[0].emotion!,
      to: validEmotions[validEmotions.length - 1].emotion!,
      dates: sortedDates,
    };
  };

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
            <Text style={styles.headerTitle}>개발자 도구</Text>
            <Text style={styles.headerSubtitle}>인사이트 분석</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadInsights} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>인사이트를 불러오는 중...</Text>
          </View>
        ) : insights.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="information-circle-outline" size={64} color="#94a3b8" />
            <Text style={styles.emptyTitle}>인사이트가 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              리포트를 생성하면{'\n'}
              인사이트를 확인할 수 있습니다
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>총 {insights.length}개의 인사이트</Text>
              <Text style={styles.summarySubtitle}>
                {insights.filter(i => i.type === 'time_contrast').length}개 시간 대비 · {' '}
                {insights.filter(i => i.type === 'repetition').length}개 반복 패턴 · {' '}
                {insights.filter(i => i.type === 'causal_relation').length}개 인과 관계
              </Text>
            </View>

            {insights.map((insight, index) => {
              const emotionTransition = getEmotionTransition(insight);
              
              return (
                <View key={index} style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: getInsightTypeColor(insight.type) + '20' }]}>
                      <Text style={[styles.typeText, { color: getInsightTypeColor(insight.type) }]}>
                        {getInsightTypeLabel(insight.type)}
                      </Text>
                    </View>
                    <Text style={styles.insightIndex}>#{index + 1}</Text>
                  </View>

                  {/* 감정 변화 표시 */}
                  {emotionTransition && (
                    <View style={styles.emotionTransitionContainer}>
                      <View style={styles.emotionTransitionItem}>
                        <Ionicons 
                          name={emotionTransition.from.icon as any} 
                          size={32} 
                          color={emotionTransition.from.color} 
                        />
                        <Text style={[styles.emotionLabel, { color: emotionTransition.from.color }]}>
                          {emotionTransition.from.label}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={24} color="#64748b" style={styles.arrowIcon} />
                      <View style={styles.emotionTransitionItem}>
                        <Ionicons 
                          name={emotionTransition.to.icon as any} 
                          size={32} 
                          color={emotionTransition.to.color} 
                        />
                        <Text style={[styles.emotionLabel, { color: emotionTransition.to.color }]}>
                          {emotionTransition.to.label}
                        </Text>
                      </View>
                    </View>
                  )}

                  {insight.summary && (
                    <Text style={styles.insightSummary}>{insight.summary}</Text>
                  )}

                  <Text style={styles.insightDescription}>{insight.description}</Text>

                {insight.evidence && (
                  <View style={styles.evidenceSection}>
                    <Text style={styles.evidenceLabel}>근거:</Text>
                    <Text style={styles.evidenceText}>{insight.evidence}</Text>
                  </View>
                )}

                {insight.date_references && insight.date_references.length > 0 && (
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>참조 날짜:</Text>
                    <View style={styles.dateButtons}>
                      {insight.date_references.map((date, dateIndex) => (
                        <TouchableOpacity
                          key={dateIndex}
                          style={[styles.dateButton, { borderColor: getInsightTypeColor(insight.type) }]}
                          onPress={() => handleDatePress(date)}
                        >
                          <Text style={[styles.dateButtonText, { color: getInsightTypeColor(insight.type) }]}>
                            {date} [{dateIndex + 1}]
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  refreshButton: {
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
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  insightIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  insightSummary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    lineHeight: 24,
  },
  insightDescription: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 12,
  },
  evidenceSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#cbd5e1',
  },
  evidenceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  evidenceText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  dateSection: {
    marginTop: 8,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  dateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emotionTransitionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  emotionTransitionItem: {
    alignItems: 'center',
    gap: 8,
  },
  emotionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
});
