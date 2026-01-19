import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getLatestReport, getPreviousReport, generateWeeklyReport, WeeklyReportResponse, WeeklyReportRequest, DiaryEntryForReport } from '../services/api';
import { getUserId } from '../services/userService';
import { getAllJournals } from '../services/journalService';
import { Insight } from '../services/api';
import { emotionLabelToBackend } from '../utils/journalConverter';
import { Emotion } from '../types/journal';

type ReportScreenProps = {
  onBack: () => void;
};

// 감정 설정
const EMOTIONS = [
  { label: '기쁨', icon: 'sunny', color: '#fcd34d' },
  { label: '평온', icon: 'leaf', color: '#a5b4fc' },
  { label: '슬픔', icon: 'rainy', color: '#93c5fd' },
  { label: '화남', icon: 'flame', color: '#fca5a5' },
  { label: '불안', icon: 'alert-circle', color: '#fdba74' },
  { label: '지침', icon: 'moon', color: '#a78bfa' },
];

export default function ReportScreen({ onBack }: ReportScreenProps) {
  const [report, setReport] = useState<WeeklyReportResponse | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLatestReport, setIsLatestReport] = useState(true);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [journals, setJournals] = useState<any[]>([]);
  const [showFullReport, setShowFullReport] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) {
        setLoading(false);
        return;
      }

      // 리포트 조회 시도
      const latestReport = await getLatestReport(userId);
      if (latestReport) {
        setReport({
          report: latestReport.report || '',
          summary: latestReport.summary || '',
          pattern_summary: latestReport.pattern_summary || '',
          period_start: latestReport.period_start,
          period_end: latestReport.period_end,
          insights: latestReport.insights || [],
          created_at: latestReport.created_at,
        });
        setIsLatestReport(true);
      } else {
        // 리포트가 없으면 자동으로 생성
        await handleGenerateReport();
      }
    } catch (error) {
      console.error('리포트 로드 실패:', error);
      // 에러 발생 시에도 리포트 생성 시도
      await handleGenerateReport();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('오류', '사용자 정보를 불러올 수 없습니다.');
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
      const request: WeeklyReportRequest = {
        user_id: userId,
        diary_entries: diaryEntriesForReport,
      };

      const result = await generateWeeklyReport(request);
      
      setReport({
        report: result.report || '',
        summary: result.summary || '',
        pattern_summary: result.pattern_summary || '',
        period_start: result.period_start,
        period_end: result.period_end,
        insights: result.insights || [],
        created_at: result.created_at,
      });
      setIsLatestReport(true);
      
      // 메모 목록도 로드
      setJournals(allJournals);
      
      Alert.alert('성공', '리포트가 생성되었습니다.');
    } catch (error) {
      console.error('리포트 생성 실패:', error);
      Alert.alert('오류', '리포트 생성에 실패했습니다.');
    } finally {
      setGeneratingReport(false);
    }
  };

  useEffect(() => {
    // 리포트가 로드되면 메모 목록도 가져오기
    if (report) {
      getAllJournals().then(setJournals).catch(console.error);
    }
  }, [report]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>감정 레포트</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>리포트를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>감정 레포트</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                          report: previousReport.report || '',
                          summary: previousReport.summary || '',
                          pattern_summary: previousReport.pattern_summary || '',
                          period_start: previousReport.period_start,
                          period_end: previousReport.period_end,
                          insights: previousReport.insights || [],
                          created_at: previousReport.created_at,
                        });
                        setIsLatestReport(false);
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
                          report: latestReport.report || '',
                          summary: latestReport.summary || '',
                          pattern_summary: latestReport.pattern_summary || '',
                          period_start: latestReport.period_start,
                          period_end: latestReport.period_end,
                          insights: latestReport.insights || [],
                          created_at: latestReport.created_at,
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
            </View>
          </View>

          <View style={styles.reportContent}>
            {generatingReport ? (
              <View style={styles.reportLoading}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.reportLoadingText}>리포트 생성 중...</Text>
              </View>
            ) : report?.report ? (
              <>
                {/* 1줄 요약 (제목) */}
                {report.summary && (
                  <Text style={styles.reportSummary}>"{report.summary}"</Text>
                )}
                
                {/* 패턴 흐름 요약 (티저) - 제목 아래에 표시 */}
                {report.pattern_summary && (
                  <Text style={styles.patternSummaryText}>
                    {report.pattern_summary}
                  </Text>
                )}
                
                {/* 많이 포착된 감정 3개 */}
                {(() => {
                  // 리포트 기간에 해당하는 일기만 필터링
                  const reportStart = report.period_start ? new Date(report.period_start) : null;
                  const reportEnd = report.period_end ? new Date(report.period_end) : null;
                  
                  const filteredJournals = journals.filter(journal => {
                    if (!reportStart || !reportEnd) return true;
                    const journalDate = new Date(journal.date + 'T00:00:00');
                    return journalDate >= reportStart && journalDate <= reportEnd;
                  });
                  
                  // 감정별 카운트
                  const emotionCounts: Record<string, number> = {};
                  filteredJournals.forEach(journal => {
                    if (journal.emotion && journal.emotion.label) {
                      const emotionLabel = journal.emotion.label;
                      emotionCounts[emotionLabel] = (emotionCounts[emotionLabel] || 0) + 1;
                    }
                  });
                  
                  // 상위 3개 감정 정렬
                  const topEmotions = Object.entries(emotionCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([label, count]) => {
                      const emotionInfo = EMOTIONS.find(e => e.label === label);
                      return { label, count, emotionInfo };
                    })
                    .filter(item => item.emotionInfo);
                  
                  if (topEmotions.length === 0) return null;
                  
                  return (
                    <View style={styles.topEmotionsContainer}>
                      <View style={styles.topEmotionsIcons}>
                        {topEmotions.map((item, index) => (
                          <View key={item.label} style={styles.topEmotionIcon}>
                            <Ionicons 
                              name={item.emotionInfo!.icon as any} 
                              size={48} 
                              color={item.emotionInfo!.color} 
                            />
                          </View>
                        ))}
                      </View>
                      <Text style={styles.topEmotionsTitle}>해당 기간동안 이 감정들이 가장 많았어요.</Text>
                    </View>
                  );
                })()}
                
                {/* 자세히 보기 버튼 */}
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullReport(!showFullReport)}
                >
                  <Text style={styles.showMoreButtonText}>
                    {showFullReport ? '간략히 보기' : '자세히 보기'}
                  </Text>
                  <Ionicons 
                    name={showFullReport ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color="#8B5CF6" 
                  />
                </TouchableOpacity>
                
                {/* 본문 내용 (자세히보기 클릭 시 표시) */}
                {showFullReport && (() => {
                  const lines = report.report.split('\n\n');
                  const body = lines.slice(1).join('\n\n');
                  return body ? (
                    <Text style={styles.reportContentText}>{body}</Text>
                  ) : null;
                })()}
              </>
            ) : (
              <View style={styles.reportEmpty}>
                <Text style={styles.reportEmptyText}>리포트가 없습니다.</Text>
                <Text style={styles.reportEmptySubtext}>'생성' 버튼을 눌러 리포트를 만들어보세요.</Text>
              </View>
            )}
          </View>

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
                      <View style={styles.insightRow}>
                        <Text style={styles.insightSummary}>
                          {insight.summary || insight.description}
                        </Text>
                        {insight.date_references && insight.date_references.length > 0 && (
                          <View style={styles.insightDateButtons}>
                            {insight.date_references.map((date, dateIndex) => (
                              <TouchableOpacity
                                key={dateIndex}
                                style={styles.insightDateButton}
                                onPress={async () => {
                                  try {
                                    const journal = journals.find((j: any) => j.date === date);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  reportPeriodText: {
    fontSize: 16,
    color: '#64748b',
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reportContent: {
    borderRadius: 12,
    padding: 20,
    minHeight: 200,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  reportLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  reportLoadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#64748b',
  },
  reportSummary: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    lineHeight: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
  },
  reportContentText: {
    fontSize: 18,
    color: '#334155',
    lineHeight: 28,
  },
  reportEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  reportEmptyText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 8,
  },
  reportEmptySubtext: {
    fontSize: 16,
    color: '#94a3b8',
  },
  insightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  insightsButtonText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 24,
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
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insightSummary: {
    flex: 1,
    fontSize: 18,
    color: '#334155',
    lineHeight: 26,
  },
  insightDateButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  insightDateButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  insightDateButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  noInsightsText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  patternSummaryText: {
    fontSize: 18,
    color: '#334155',
    lineHeight: 26,
    marginTop: 8,
    marginBottom: 16,
    fontWeight: '500',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
  },
  topEmotionsContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  topEmotionsIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  topEmotionsTitle: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '600',
  },
  topEmotionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    marginTop: 8,
  },
  showMoreButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
});
