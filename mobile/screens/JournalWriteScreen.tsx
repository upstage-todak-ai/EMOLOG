import { useState, useEffect, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createJournal, getJournalByDate, updateJournal } from '../services/journalService';
import { Emotion, JournalEntry } from '../types/journal';

type JournalWriteScreenProps = {
  emotion: Emotion;
  selectedDate?: string; // 선택한 날짜 (YYYY-MM-DD 형식)
  existingJournal?: JournalEntry | null; // 기존 일기 (수정 시)
  onBack: () => void;
  onSave?: () => void; // 저장 후 콜백
};

export default function JournalWriteScreen({ emotion, selectedDate, existingJournal, onBack, onSave }: JournalWriteScreenProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  
  // 선택한 날짜가 있으면 사용, 없으면 오늘 날짜 사용
  const dateString = selectedDate || (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();

  // 기존 일기 불러오기
  useEffect(() => {
    loadExistingJournal();
    
    // 키보드 이벤트 리스너
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const loadExistingJournal = async () => {
    try {
      // props로 전달된 기존 일기가 있으면 사용 (수정 모드)
      if (existingJournal) {
        // content를 제목과 내용으로 분리 (첫 줄이 제목, 나머지가 내용)
        const lines = existingJournal.content.split('\n');
        if (lines.length > 0) {
          setTitle(lines[0]);
          setContent(lines.slice(1).join('\n'));
        } else {
          setContent(existingJournal.content);
        }
        return;
      }
      
      // 새로운 메모 작성 모드에서는 기존 일기를 불러오지 않음
    } catch (error) {
      console.error('일기 불러오기 실패:', error);
    }
  };

  const handleCheckPress = () => {
    // 키보드 닫기
    Keyboard.dismiss();
    setIsKeyboardVisible(false);
  };

  const handleSave = async () => {
    if (loading) return;
    
    // 제목과 내용이 모두 비어있으면 저장 불가
    if (!title.trim() && !content.trim()) {
      Alert.alert('알림', '제목 또는 내용을 입력해주세요.');
      return;
    }
    
    setLoading(true);
    try {
      // 제목과 내용을 합쳐서 저장 (제목\n내용 형식)
      const fullContent = title.trim() ? `${title.trim()}\n${content.trim()}` : content.trim();
      
      // existingJournal prop이 있으면 수정, 없으면 새로 생성
      if (existingJournal) {
        // 수정 모드: props로 전달된 기존 일기를 수정
        await updateJournal(existingJournal.id, {
          content: fullContent,
          emotion,
        });
      } else {
        // 새로 생성 모드: 날짜로 기존 일기를 찾지 않고 항상 새로 생성
        await createJournal({
          date: dateString,
          emotion: {
            label: emotion.label,
            icon: emotion.icon,
            color: emotion.color,
          },
          content: fullContent,
        });
      }
      
      if (onSave) {
        onSave();
      }
      onBack();
    } catch (error) {
      console.error('일기 저장 실패:', error);
      Alert.alert('오류', '일기 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F3E8FF', '#FCE7F3']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingJournal ? '감정 메모 수정' : '감정 메모 작성'}
        </Text>
        <View style={styles.backButton} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* 제목 입력 필드 */}
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={setTitle}
            placeholder=""
            placeholderTextColor="#cbd5e1"
            style={styles.titleInput}
            textAlignVertical="top"
            returnKeyType="next"
            onSubmitEditing={() => {
              contentInputRef.current?.focus();
            }}
          />
          
          {/* 내용 입력 필드 */}
          <TextInput
            ref={contentInputRef}
            value={content}
            onChangeText={setContent}
            placeholder="지금 이 순간의 감정을 자유롭게 적어보세요..."
            placeholderTextColor="#cbd5e1"
            multiline
            style={styles.contentInput}
            textAlignVertical="top"
          />
          
          {/* 체크 버튼 (키보드가 보일 때만 표시) */}
          {isKeyboardVisible && (
            <TouchableOpacity
              style={styles.checkButton}
              onPress={handleCheckPress}
              activeOpacity={0.7}
            >
              <Text style={styles.checkButtonText}>✓</Text>
            </TouchableOpacity>
          )}
          
          {/* 메모 작성 버튼 (키보드가 닫혔을 때만 표시) */}
          {!isKeyboardVisible && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={(!title.trim() && !content.trim()) || loading}
              >
                <LinearGradient
                  colors={(!title.trim() && !content.trim()) || loading ? ['#cbd5e1', '#94a3b8'] : ['#3B82F6', '#8B5CF6']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? '저장 중...' : '메모 작성'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  titleInput: {
    minHeight: 50,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  contentInput: {
    minHeight: 200,
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  checkButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
