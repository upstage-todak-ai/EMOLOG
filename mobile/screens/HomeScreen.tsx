import { StatusBar } from 'expo-status-bar';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, AppState, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAllJournals, getJournalByDate, deleteJournal } from '../services/journalService';
import { JournalEntry, Emotion } from '../types/journal';

type HomeScreenProps = {
  onNavigateToSettings?: () => void;
  onNavigateToStats: () => void;
  onNavigateToJournalWrite: (emotion: Emotion, selectedDate?: string, existingJournal?: JournalEntry | null) => void;
};

export default function HomeScreen({ onNavigateToSettings, onNavigateToStats, onNavigateToJournalWrite }: HomeScreenProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [isLogView, setIsLogView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const appState = useRef(AppState.currentState);

  // 일기 목록 불러오기
  useEffect(() => {
    loadJournals();
  }, []);

  // 앱이 포그라운드로 돌아올 때 일기 목록 새로고침
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadJournals();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const loadJournals = async () => {
    try {
      const allJournals = await getAllJournals();
      setJournals(allJournals);
    } catch (error) {
      console.error('일기 불러오기 실패:', error);
    }
  };

  const emotions: Emotion[] = [
    { label: '기쁨', icon: 'sunny', color: '#fcd34d' },
    { label: '평온', icon: 'leaf', color: '#a5b4fc' },
    { label: '슬픔', icon: 'rainy', color: '#93c5fd' },
    { label: '화남', icon: 'flame', color: '#fca5a5' },
    { label: '불안', icon: 'alert-circle', color: '#fdba74' },
    { label: '지침', icon: 'moon', color: '#a78bfa' },
  ];

  const handleDayPress = async (day: string) => {
    setSelectedDate(day);
    const journal = await getJournalByDate(day);
    
    if (journal) {
      setSelectedJournal(journal);
      setModalVisible(true);
    } else {
      setSelectedJournal(null);
      setModalVisible(true);
    }
  };


  // 일기 삭제
  const handleDeleteJournal = async (journal: JournalEntry) => {
    if (showDeleteConfirm === journal.id) {
      try {
        await deleteJournal(journal.id);
        loadJournals();
        setShowDeleteConfirm(null);
      } catch (error) {
        console.error('일기 삭제 실패:', error);
        Alert.alert('오류', '일기 삭제에 실패했습니다.');
      }
    } else {
      setShowDeleteConfirm(journal.id);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return formatDate(dateString);
  };

  // 일기 목록 정렬 (최신순)
  const sortedJournals = [...journals].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Log 데이터 추출 (백엔드에서 추출한 topic 사용)
  const getLogData = (journal: JournalEntry) => {
    // 백엔드에서 추출한 topic 사용 (없으면 빈 문자열)
    const topic = journal.topic || '';
    const emotion = journal.emotion.label;

    return { topic, emotion };
  };

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      '기쁨': '#fcd34d',
      '평온': '#a5b4fc',
      '슬픔': '#93c5fd',
      '화남': '#fca5a5',
      '불안': '#fdba74',
      '지침': '#a78bfa',
    };
    return colors[emotion] || '#94a3b8';
  };

  const getTopicColor = (topic: string) => {
    const colors: Record<string, string> = {
      '학업': '#3B82F6',
      '대인관계': '#10B981',
      '일상': '#8B5CF6',
      'none': '#94a3b8',
    };
    return colors[topic] || '#94a3b8';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F3E8FF', '#FCE7F3']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>EmoLog</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => setIsLogView(!isLogView)}
              style={styles.headerButton}
            >
              <Ionicons
                name={isLogView ? 'toggle' : 'toggle-outline'}
                size={24}
                color={isLogView ? '#8B5CF6' : '#64748b'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNavigateToStats}
              style={styles.headerButton}
            >
              <Ionicons name="stats-chart" size={24} color="#64748b" />
            </TouchableOpacity>
            {onNavigateToSettings && (
              <TouchableOpacity
                onPress={onNavigateToSettings}
                style={styles.headerButton}
              >
                <Ionicons name="settings" size={24} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 빈 상태 */}
        {journals.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>💭</Text>
            </View>
            <Text style={styles.emptyTitle}>오늘의 감정을 기록해보세요</Text>
            <Text style={styles.emptySubtitle}>
              쉽고 간단하게 감정을 메모하고{'\n'}
              나만의 감정 패턴을 발견하세요
            </Text>
          </View>
        )}

        {/* 메모 리스트 또는 Log 뷰 */}
        {journals.length > 0 && (
          <View style={styles.listContainer}>
            <Text style={styles.listHeader}>
              {isLogView ? `총 ${journals.length}개의 Log` : `총 ${journals.length}개의 감정 메모`}
            </Text>
            
            {isLogView ? (
              // Log 뷰
              <View style={styles.logList}>
                {sortedJournals.map((journal) => {
                  const { topic, emotion } = getLogData(journal);
                  // topic이 없거나 빈 값이면 추출 중으로 표시
                  const isExtracting = !topic || topic.trim() === '' || topic === 'none';
                  
                  return (
                    <View key={journal.id} style={styles.logCard}>
                      <View style={styles.logTags}>
                        {/* topic이 있고 "none"이 아닐 때만 표시 */}
                        {!isExtracting && topic && topic !== 'none' && topic.trim() !== '' && (
                          <View style={[styles.tag, { backgroundColor: getTopicColor(topic) + '20', borderColor: getTopicColor(topic) + '40' }]}>
                            <Text style={[styles.tagText, { color: getTopicColor(topic) }]}>{topic}</Text>
                          </View>
                        )}
                        {/* 추출 중일 때 표시 */}
                        {isExtracting && (
                          <View style={[styles.tag, { backgroundColor: '#94a3b820', borderColor: '#94a3b840' }]}>
                            <Text style={[styles.tagText, { color: '#94a3b8' }]}>추출 중입니다...</Text>
                          </View>
                        )}
                        {/* emotion이 있고 "none"이 아닐 때만 표시 */}
                        {emotion && emotion !== 'none' && emotion.trim() !== '' && (
                          <View style={[styles.tag, { backgroundColor: getEmotionColor(emotion) + '20', borderColor: getEmotionColor(emotion) + '40' }]}>
                            <Text style={[styles.tagText, { color: getEmotionColor(emotion) }]}>{emotion}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.logContent} numberOfLines={2}>
                        {journal.content || '내용이 없습니다.'}
                      </Text>
                      <Text style={styles.logDate}>{formatDate(journal.date)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              // 메모 리스트
              <View style={styles.memoList}>
                {sortedJournals.map((journal) => (
                  <TouchableOpacity
                    key={journal.id}
                    style={styles.memoCard}
                    onPress={() => {
                      setSelectedDate(journal.date);
                      setSelectedJournal(journal);
                      onNavigateToJournalWrite(journal.emotion, journal.date, journal);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memoCardContent}>
                      <Text style={styles.memoText} numberOfLines={4}>
                        {journal.content || '내용이 없습니다.'}
                      </Text>
                      <Text style={styles.memoDate}>{formatRelativeTime(journal.date)}</Text>
                    </View>
                    <View style={styles.memoActions}>
                      <TouchableOpacity
                        style={styles.memoActionButton}
                        onPress={() => {
                          setSelectedDate(journal.date);
                          setSelectedJournal(journal);
                          onNavigateToJournalWrite(journal.emotion, journal.date, journal);
                        }}
                      >
                        <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.memoActionButton, showDeleteConfirm === journal.id && styles.deleteConfirm]}
                        onPress={() => handleDeleteJournal(journal)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={showDeleteConfirm === journal.id ? '#EF4444' : '#EF4444'}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 플로팅 추가 버튼 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          // 감정 선택 없이 바로 메모 작성 화면으로 이동
          // 기본 감정으로 CALM(평온) 사용
          const defaultEmotion: Emotion = { label: '평온', icon: 'leaf', color: '#a5b4fc' };
          onNavigateToJournalWrite(defaultEmotion);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* 기존 일기 보기 모달 (날짜 클릭 시) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {selectedJournal ? (
                  <>
                    <Text style={styles.modalTitle}>오늘의 감정</Text>
                    <View style={styles.selectedEmotionContainer}>
                      <Ionicons name={selectedJournal.emotion.icon as any} size={32} color={selectedJournal.emotion.color} />
                      <Text style={styles.selectedEmotionLabel}>{selectedJournal.emotion.label}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalTitle}>메모 작성</Text>
                    <Text style={styles.modalSubtitle}>새로운 메모를 작성하세요</Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selectedJournal ? (
              <View style={styles.journalContentContainer}>
                <Text style={styles.journalContent}>{selectedJournal.content || '내용이 없습니다.'}</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setModalVisible(false);
                    requestAnimationFrame(() => {
                      onNavigateToJournalWrite(selectedJournal.emotion, selectedDate || undefined, selectedJournal);
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    style={styles.editButtonGradient}
                  >
                    <Text style={styles.editButtonText}>수정하기</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.journalContentContainer}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setModalVisible(false);
                    const defaultEmotion: Emotion = { label: '평온', icon: 'leaf', color: '#a5b4fc' };
                    requestAnimationFrame(() => {
                      onNavigateToJournalWrite(defaultEmotion, selectedDate || undefined);
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    style={styles.editButtonGradient}
                  >
                    <Text style={styles.editButtonText}>메모 작성하기</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <StatusBar style="auto" />
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
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    fontFamily: 'NanumPen',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
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
    paddingTop: 20,
    paddingBottom: 100,
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
  listContainer: {
    marginTop: 20,
  },
  listHeader: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontFamily: 'NanumPen',
  },
  memoList: {
    gap: 12,
  },
  memoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memoCardContent: {
    flex: 1,
    marginRight: 12,
  },
  memoText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
    fontFamily: 'NanumPen',
    marginBottom: 12,
  },
  memoDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'NanumPen',
  },
  memoActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  memoActionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  deleteConfirm: {
    backgroundColor: '#fee2e2',
  },
  logList: {
    gap: 12,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    height: 112,
    justifyContent: 'space-between',
  },
  logTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'NanumPen',
  },
  logContent: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontFamily: 'NanumPen',
    flex: 1,
  },
  logDate: {
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: 'NanumPen',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  modalHeaderLeft: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    fontFamily: 'NanumPen',
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'NanumPen',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: '30%',
    minWidth: 100,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emojiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    fontFamily: 'NanumPen',
  },
  selectedEmotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  selectedEmotionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    fontFamily: 'NanumPen',
  },
  journalContentContainer: {
    marginTop: 16,
  },
  journalContent: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    fontFamily: 'NanumPen',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
  },
  editButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  editButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'NanumPen',
  },
});
