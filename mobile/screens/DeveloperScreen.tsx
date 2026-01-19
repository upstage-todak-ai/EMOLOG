import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

export default function DeveloperScreen({ onBack }: DeveloperScreenProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [showReportView, setShowReportView] = useState(false);

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

  // 인사이트에서 주제 추출
  const getTopicFromInsight = (insight: Insight): string | null => {
    if (!insight.date_references || insight.date_references.length === 0) {
      return null;
    }

    // 첫 번째 날짜의 주제를 가져옴
    const firstDate = insight.date_references[0];
    const journal = journals.find((j: { date: string }) => j.date === firstDate);
    
    if (journal && journal.topic && journal.topic.trim() && journal.topic.toLowerCase() !== 'none') {
      return journal.topic;
    }

    // 주제가 없으면 다른 날짜들도 확인
    for (const date of insight.date_references) {
      const journal = journals.find((j: { date: string }) => j.date === date);
      if (journal && journal.topic && journal.topic.trim() && journal.topic.toLowerCase() !== 'none') {
        return journal.topic;
      }
    }

    return null;
  };

  // 감정 강도 매핑
  const getEmotionIntensity = (emotionLabel: string): number => {
    const intensityMap: Record<string, number> = {
      '기쁨': 3,
      '평온': 2,
      '지침': 2,
      '불안': 3,
      '슬픔': 4,
      '화남': 5,
    };
    return intensityMap[emotionLabel] || 0;
  };

  // 감정 변화별로 그룹화하고 주제 키워드 수집
  const groupByEmotionTransition = () => {
    const transitionGroups: Record<string, { 
      from: Emotion; 
      to: Emotion; 
      topics: Set<string>;
      dateRanges: Array<{ start: string; end: string }>; // 기간 정보 추가
    }> = {};

    insights.forEach((insight) => {
      const emotionTransition = getEmotionTransition(insight);
      if (!emotionTransition) return;

      // from과 to가 같은 변화는 제외
      if (emotionTransition.from.label === emotionTransition.to.label) return;

      // 감정 변화를 키로 사용 (예: "슬픔->기쁨")
      const transitionKey = `${emotionTransition.from.label}->${emotionTransition.to.label}`;
      
      if (!transitionGroups[transitionKey]) {
        transitionGroups[transitionKey] = {
          from: emotionTransition.from,
          to: emotionTransition.to,
          topics: new Set<string>(),
          dateRanges: [],
        };
      }

      // 해당 인사이트의 주제 추가
      const topic = getTopicFromInsight(insight);
      if (topic) {
        transitionGroups[transitionKey].topics.add(topic);
      }

      // 기간 정보 추가
      if (emotionTransition.dates && emotionTransition.dates.length >= 2) {
        const sortedDates = [...emotionTransition.dates].sort();
        transitionGroups[transitionKey].dateRanges.push({
          start: sortedDates[0],
          end: sortedDates[sortedDates.length - 1],
        });
      }
    });

    return transitionGroups;
  };

  // 감정 강도 기반으로 상위 3개 선택
  const getTopEmotionTransitions = () => {
    const transitionGroups = groupByEmotionTransition();
    const transitions: Array<{
      key: string;
      from: Emotion;
      to: Emotion;
      topics: Set<string>;
      intensityDiff: number;
      bonus: number;
      totalScore: number;
    }> = [];

    Object.keys(transitionGroups).forEach((key) => {
      const group = transitionGroups[key];
      
      // 강도 차이 계산
      const fromIntensity = getEmotionIntensity(group.from.label);
      const toIntensity = getEmotionIntensity(group.to.label);
      const intensityDiff = Math.abs(fromIntensity - toIntensity);

      // 기간이 7일 이상인지 확인 (가산점)
      let bonus = 0;
      if (group.dateRanges.length > 0) {
        const dateRange = group.dateRanges[0];
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 7) {
          bonus = 1;
        }
      }

      const totalScore = intensityDiff + bonus;

      transitions.push({
        key,
        from: group.from,
        to: group.to,
        topics: group.topics,
        intensityDiff,
        bonus,
        totalScore,
      });
    });

    // totalScore 내림차순 정렬 후 상위 3개 선택
    return transitions
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3);
  };

  // 주제별로 인사이트 그룹화
  const groupInsightsByTopic = () => {
    const topicGroups: Record<string, { insights: Insight[]; emotionTransitions: Array<{ from: Emotion; to: Emotion; dates: string[] } | null> }> = {};
    const noTopicInsights: Insight[] = [];

    insights.forEach((insight, index) => {
      const topic = getTopicFromInsight(insight);
      const emotionTransition = getEmotionTransition(insight);

      if (topic) {
        if (!topicGroups[topic]) {
          topicGroups[topic] = { insights: [], emotionTransitions: [] };
        }
        topicGroups[topic].insights.push(insight);
        topicGroups[topic].emotionTransitions.push(emotionTransition);
      } else {
        noTopicInsights.push(insight);
      }
    });

    return { topicGroups, noTopicInsights };
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
            <Text style={styles.headerSubtitle}>
              {showReportView ? '가짜 리포트 보기' : '인사이트 분석'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!showReportView && (
            <TouchableOpacity 
              onPress={() => setShowReportView(true)} 
              style={styles.reportButton}
            >
              <Ionicons name="document-text" size={20} color="#8B5CF6" />
              <Text style={styles.reportButtonText}>가짜 report 보기</Text>
            </TouchableOpacity>
          )}
          {showReportView && (
            <TouchableOpacity 
              onPress={() => setShowReportView(false)} 
              style={styles.backToInsightsButton}
            >
              <Ionicons name="arrow-back" size={20} color="#64748b" />
              <Text style={styles.backToInsightsButtonText}>인사이트로</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={loadInsights} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>
              {showReportView ? '리포트를 불러오는 중...' : '인사이트를 불러오는 중...'}
            </Text>
          </View>
        ) : showReportView ? (
          // 가짜 리포트 보기 - 감정 강도 기반 상위 3개
          insights.length > 0 ? (
            (() => {
              const topTransitions = getTopEmotionTransitions();

              return (
                <>
                  {topTransitions.map((transition, index) => {
                    const topicsArray = Array.from(transition.topics).sort();

                    return (
                      <View key={transition.key} style={styles.emotionTransitionCard}>
                        {/* 순위 표시 */}
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>#{index + 1}</Text>
                        </View>

                        {/* 감정 변화 표시 */}
                        <View style={styles.emotionTransitionContainer}>
                          <View style={styles.emotionTransitionItem}>
                            <Ionicons 
                              name={transition.from.icon as any} 
                              size={32} 
                              color={transition.from.color} 
                            />
                            <Text style={[styles.emotionLabel, { color: transition.from.color }]}>
                              {transition.from.label}
                            </Text>
                            <Text style={styles.intensityText}>
                              (강도: {getEmotionIntensity(transition.from.label)})
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward" size={24} color="#64748b" style={styles.arrowIcon} />
                          <View style={styles.emotionTransitionItem}>
                            <Ionicons 
                              name={transition.to.icon as any} 
                              size={32} 
                              color={transition.to.color} 
                            />
                            <Text style={[styles.emotionLabel, { color: transition.to.color }]}>
                              {transition.to.label}
                            </Text>
                            <Text style={styles.intensityText}>
                              (강도: {getEmotionIntensity(transition.to.label)})
                            </Text>
                          </View>
                        </View>

                        {/* 점수 정보 */}
                        <View style={styles.scoreInfo}>
                          <Text style={styles.scoreText}>
                            강도 차이: {transition.intensityDiff}
                            {transition.bonus > 0 && ` + 가산점: ${transition.bonus}`}
                            {' '}(총점: {transition.totalScore})
                          </Text>
                        </View>

                        {/* 주제 키워드 표시 */}
                        {topicsArray.length > 0 && (
                          <View style={styles.topicsContainer}>
                            {topicsArray.map((topic, topicIndex) => {
                              const topicInfo = TOPICS.find(t => t.label === topic);
                              return (
                                <View 
                                  key={topicIndex} 
                                  style={[
                                    styles.topicChip, 
                                    { backgroundColor: (topicInfo?.color || '#64748b') + '20' }
                                  ]}
                                >
                                  <Ionicons 
                                    name={topicInfo?.icon || 'ellipse'} 
                                    size={16} 
                                    color={topicInfo?.color || '#64748b'} 
                                  />
                                  <Text style={[styles.topicChipText, { color: topicInfo?.color || '#64748b' }]}>
                                    {topic}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              );
            })()
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyTitle}>인사이트가 없습니다</Text>
              <Text style={styles.emptySubtitle}>
                리포트를 생성하면{'\n'}
                감정 변화별 리포트를 확인할 수 있습니다
              </Text>
            </View>
          )
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  backToInsightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backToInsightsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emotionTransitionCard: {
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
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: '600',
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
  topicSection: {
    marginBottom: 24,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topicCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  topicEmotionSummary: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  topicEmotionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emotionLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
  },
  arrowIconSmall: {
    marginHorizontal: 4,
  },
  topicReportSection: {
    marginBottom: 24,
  },
  reportContentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reportText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  rankBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  intensityText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  scoreInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  scoreText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
