import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 선택한 날짜가 있으면 사용, 없으면 오늘 날짜 사용
  const dateString = selectedDate || (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();
  
  // 날짜 포맷팅
  const date = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${date.toLocaleDateString('ko-KR', { weekday: 'long' })}`;

  // 기존 일기 불러오기
  useEffect(() => {
    loadExistingJournal();
  }, []);

  const loadExistingJournal = async () => {
    try {
      // props로 전달된 기존 일기가 있으면 사용 (수정 모드)
      if (existingJournal) {
        setContent(existingJournal.content);
        return;
      }
      
      // 새로운 메모 작성 모드에서는 기존 일기를 불러오지 않음
      // (같은 날짜에 여러 메모를 작성할 수 있도록)
    } catch (error) {
      console.error('일기 불러오기 실패:', error);
    }
  };

  const handleSave = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // existingJournal prop이 있으면 수정, 없으면 새로 생성
      if (existingJournal) {
        // 수정 모드: props로 전달된 기존 일기를 수정
        await updateJournal(existingJournal.id, {
          content,
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
          content,
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
      >
        <View style={styles.formContainer}>
          <TextInput
            autoFocus
            value={content}
            onChangeText={setContent}
            placeholder="지금 이 순간의 감정을 자유롭게 적어보세요...&#10;&#10;예) 오늘 시험이 끝났는데 생각보다 잘 본 것 같아서 후련하다."
            placeholderTextColor="#cbd5e1"
            multiline
            style={styles.textInput}
            textAlignVertical="top"
          />
          
          <View style={styles.footer}>
            <Text style={styles.footerHint}>
              저장하려면 하단 버튼을 눌러주세요
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onBack}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={!content.trim() || loading}
              >
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>
                    {existingJournal ? '수정' : '저장'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
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
    fontFamily: 'NanumPen',
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
  textInput: {
    minHeight: 256,
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    fontFamily: 'NanumPen',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  footer: {
    marginTop: 24,
  },
  footerHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
    fontFamily: 'NanumPen',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: 'NanumPen',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'NanumPen',
  },
});
