import { StatusBar } from 'expo-status-bar';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, AppState, Alert, ActivityIndicator, Animated, LayoutAnimation, UIManager, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAllJournals, getJournalByDate, deleteJournal, batchExtractMissingLogs } from '../services/journalService';
import { JournalEntry, Emotion } from '../types/journal';

type HomeScreenProps = {
  onNavigateToSettings: () => void;
  onNavigateToStats: () => void;
  onNavigateToJournalWrite: (emotion: Emotion, selectedDate?: string, existingJournal?: JournalEntry | null) => void;
};

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeScreen({ onNavigateToSettings, onNavigateToStats, onNavigateToJournalWrite }: HomeScreenProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [isLogView, setIsLogView] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());
  const [selectedMemoForAction, setSelectedMemoForAction] = useState<JournalEntry | null>(null);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  const tagAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const toggleAnimation = useRef(new Animated.Value(0)).current;

  const appState = useRef(AppState.currentState);

  // 일기 목록 불러오기
  useEffect(() => {
    loadJournals();
    // 초기 토글 애니메이션 값 설정
    toggleAnimation.setValue(isLogView ? 1 : 0);
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

  // Log 뷰 토글 시 태그 애니메이션
  useEffect(() => {
    // 레이아웃 애니메이션 설정
    LayoutAnimation.configureNext({
      duration: 500,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.scaleXY,
        springDamping: 0.7,
      },
    });

    if (isLogView) {
      // 모든 애니메이션을 부드럽게 시작
      tagAnimations.current.forEach((animValue, journalId) => {
        const journal = journals.find(j => j.id === journalId);
        if (journal) {
          const { topic, emotion } = getLogData(journal);
          const hasValidTopic = topic && topic.trim() !== '' && topic.toLowerCase() !== 'none';
          const hasValidEmotion = emotion && emotion.trim() !== '' && emotion.toLowerCase() !== 'none';
          const isCurrentlyExtracting = extractingIds.has(journalId);
          const showTags = isCurrentlyExtracting || hasValidTopic || hasValidEmotion;
          
          if (showTags) {
            animValue.setValue(0);
            Animated.timing(animValue, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }
        }
      });
    } else {
      // Log 뷰가 꺼지면 모든 애니메이션 초기화
      tagAnimations.current.forEach((animValue) => {
        Animated.timing(animValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isLogView, journals, extractingIds]);

  const loadJournals = async (checkForExtraction: boolean = false) => {
    try {
      const allJournals = await getAllJournals();
      setJournals(allJournals);
      
      // 추출 체크가 필요한 경우 (Log 뷰로 전환할 때)
      if (checkForExtraction) {
        const needsExtraction = allJournals.filter(journal => {
          const hasTopic = journal.topic && journal.topic.trim() !== '' && journal.topic.toLowerCase() !== 'none';
          const hasEmotion = journal.emotion && journal.emotion.label.trim() !== '';
          return !hasTopic || !hasEmotion;
        });
        
        if (needsExtraction.length > 0) {
          setIsExtracting(true);
          const idsToExtract = new Set(needsExtraction.map(j => j.id));
          setExtractingIds(idsToExtract);
          
          try {
            await batchExtractMissingLogs(needsExtraction);
            // 추출 완료 후 다시 로드
            const updatedJournals = await getAllJournals();
            setJournals(updatedJournals);
          } catch (error) {
            console.error('배치 추출 실패:', error);
          } finally {
            setIsExtracting(false);
            setExtractingIds(new Set());
          }
        }
      }
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
    Alert.alert(
      '일기 삭제',
      '이 일기를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteJournal(journal.id);
              loadJournals();
            } catch (error) {
              console.error('일기 삭제 실패:', error);
              Alert.alert('오류', '일기 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
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

    const dateStr = formatDate(dateString);
    
    if (minutes < 1) return `방금 전 · ${dateStr}`;
    if (minutes < 60) return `${minutes}분 전 · ${dateStr}`;
    if (hours < 24) return `${hours}시간 전 · ${dateStr}`;
    if (days < 7) return `${days}일 전 · ${dateStr}`;

    return dateStr;
  };

  // 일기 목록 정렬 (최신순)
  const sortedJournals = [...journals].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Log 데이터 추출 (백엔드에서 추출한 topic 사용)
  const getLogData = (journal: JournalEntry) => {
    // 백엔드에서 추출한 topic 사용 (없으면 빈 문자열)
    const topic = journal.topic || '';
    // emotion이 null이면 빈 문자열
    const emotion = journal.emotion?.label || '';

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
          {selectedMemoForAction ? (
            <View style={styles.actionBar}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedMemoForAction) {
                    const defaultEmotion: Emotion = { label: '평온', icon: 'leaf', color: '#a5b4fc' };
                    onNavigateToJournalWrite(
                      selectedMemoForAction.emotion || defaultEmotion,
                      selectedMemoForAction.date,
                      selectedMemoForAction
                    );
                  }
                  setSelectedMemoForAction(null);
                }}
                style={styles.actionButton}
              >
                <Ionicons name="create-outline" size={20} color="#3B82F6" />
                <Text style={styles.actionButtonText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selectedMemoForAction) {
                    handleDeleteJournal(selectedMemoForAction);
                  }
                  setSelectedMemoForAction(null);
                }}
                style={styles.actionButton}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedMemoForAction(null)}
                style={styles.actionButton}
              >
                <Ionicons name="close" size={20} color="#64748b" />
                <Text style={styles.actionButtonText}>취소</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={async () => {
                  const newIsLogView = !isLogView;
                  setIsLogView(newIsLogView);
                  // 토글 애니메이션
                  Animated.spring(toggleAnimation, {
                    toValue: newIsLogView ? 1 : 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                  }).start();
                  // Log 뷰로 전환할 때만 추출 실행
                  await loadJournals(newIsLogView);
                }}
                style={styles.toggleContainer}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleTrack, isLogView && styles.toggleTrackActive]}>
                  <Animated.View
                    style={[
                      styles.toggleThumb,
                      {
                        transform: [
                          {
                            translateX: toggleAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 20],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNavigateToStats}
                style={styles.headerButton}
              >
                <Ionicons name="stats-chart" size={24} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNavigateToSettings}
                style={styles.headerButton}
              >
                <Ionicons name="settings" size={24} color="#64748b" />
              </TouchableOpacity>
              {/* <TouchableOpacity
                onPress={() => {
                  console.log('개발자 버튼 클릭');
                  // 개발자 기능 추가 가능
                }}
                style={styles.headerButton}
              >
                <Ionicons name="code" size={24} color="#64748b" />
              </TouchableOpacity> */}
            </View>
          )}
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
            
            {/* 메모 리스트 */}
            <View style={styles.memoList}>
              {sortedJournals.map((journal) => {
                const { topic, emotion } = getLogData(journal);
                const hasValidTopic = topic && topic.trim() !== '' && topic.toLowerCase() !== 'none';
                const hasValidEmotion = emotion && emotion.trim() !== '' && emotion.toLowerCase() !== 'none';
                const isCurrentlyExtracting = extractingIds.has(journal.id);
                const showTags = isLogView && (isCurrentlyExtracting || hasValidTopic || hasValidEmotion);
                
                // 애니메이션 값 가져오기 또는 생성
                if (!tagAnimations.current.has(journal.id)) {
                  tagAnimations.current.set(journal.id, new Animated.Value(0));
                }
                const scaleAnim = tagAnimations.current.get(journal.id)!;
                
                return (
                  <TouchableOpacity
                    key={journal.id}
                    style={[
                      styles.memoCard,
                      selectedMemoForAction?.id === journal.id && styles.memoCardSelected,
                    ]}
                    onPress={() => {
                      if (selectedMemoForAction) {
                        setSelectedMemoForAction(null);
                      } else {
                        setSelectedDate(journal.date);
                        setSelectedJournal(journal);
                        const defaultEmotion: Emotion = { label: '평온', icon: 'leaf', color: '#a5b4fc' };
                        onNavigateToJournalWrite(journal.emotion || defaultEmotion, journal.date, journal);
                      }
                    }}
                    onLongPress={() => {
                      setSelectedMemoForAction(journal);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memoCardContent}>
                      <Text style={styles.memoText} numberOfLines={4}>
                        {journal.content || '내용이 없습니다.'}
                      </Text>
                      <View style={styles.memoFooter}>
                        {/* 태그 칩 (Log 뷰일 때만, 왼쪽에 배치) */}
                        {showTags && (
                          <Animated.View 
                            style={[
                              styles.tagChipContainerLeft,
                              {
                                opacity: scaleAnim,
                              }
                            ]}
                          >
                            {isCurrentlyExtracting ? (
                              <View style={styles.extractingChip}>
                                <ActivityIndicator size="small" color="#64748b" />
                                <Text style={styles.extractingChipText}>추출 중...</Text>
                              </View>
                            ) : (
                              <>
                                {hasValidTopic && (
                                  <View style={styles.tagChip}>
                                    <Text style={styles.tagChipText}>#{topic}</Text>
                                  </View>
                                )}
                                {hasValidEmotion && journal.emotion && (
                                  <View style={[styles.emotionChip, { backgroundColor: journal.emotion.color + '40' }]}>
                                    <Ionicons name={journal.emotion.icon as any} size={20} color={journal.emotion.color} />
                                    <Text style={[styles.emotionChipText, { color: journal.emotion.color }]}>
                                      {emotion}
                                    </Text>
                                  </View>
                                )}
                              </>
                            )}
                          </Animated.View>
                        )}
                        <Text style={styles.memoDate}>{formatRelativeTime(journal.date)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                    {selectedJournal.emotion && (
                      <View style={styles.selectedEmotionContainer}>
                        <Ionicons name={selectedJournal.emotion.icon as any} size={32} color={selectedJournal.emotion.color} />
                        <Text style={styles.selectedEmotionLabel}>{selectedJournal.emotion.label}</Text>
                      </View>
                    )}
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
                      const defaultEmotion: Emotion = { label: '평온', icon: 'leaf', color: '#a5b4fc' };
                      onNavigateToJournalWrite(selectedJournal.emotion || defaultEmotion, selectedDate || undefined, selectedJournal);
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
  toggleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: '#3B82F6',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  memoCardSelected: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#eff6ff',
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
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    marginTop: 20,
  },
  listHeader: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
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
    position: 'relative',
  },
  memoCardTransparent: {
    opacity: 0.3,
  },
  memoCardContent: {
    flex: 1,
    marginRight: 12,
  },
  memoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  tagOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tagChipContainerLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  tagChip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emotionChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  extractingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  extractingChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  memoText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
    marginBottom: 12,
  },
  memoDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 'auto',
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
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  extractingTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 0,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicTag: {
    backgroundColor: '#e2e8f0',
  },
  topicTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  logContent: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    flex: 1,
  },
  logDate: {
    fontSize: 12,
    color: '#cbd5e1',
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
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  },
  journalContentContainer: {
    marginTop: 16,
  },
  journalContent: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
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
  },
});
