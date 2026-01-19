import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard } from 'react-native';
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
  const contentInputRef = useRef<TextInput>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 선택한 날짜가 있으면 사용, 없으면 오늘 날짜 사용
  const dateString = selectedDate || (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();

  // 자동 저장 함수
  const autoSave = useCallback(async (contentToSave: string) => {
    if (!contentToSave.trim()) {
      return; // 빈 내용이면 저장하지 않음
    }

    try {
      // existingJournal prop이 있으면 수정, 없으면 새로 생성
      if (existingJournal) {
        await updateJournal(existingJournal.id, {
          content: contentToSave.trim(),
          emotion,
        });
      } else {
        await createJournal({
          date: dateString,
          emotion: {
            label: emotion.label,
            icon: emotion.icon,
            color: emotion.color,
          },
          content: contentToSave.trim(),
        });
      }
      
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('자동 저장 실패:', error);
    }
  }, [existingJournal, emotion, dateString, onSave]);

  // 기존 일기 불러오기
  useEffect(() => {
    loadExistingJournal();
  }, []);

  // 컴포넌트 언마운트 시 저장
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // 뒤로가기 시 마지막 내용 저장 (현재 content 값 사용)
      const currentContent = content;
      if (currentContent.trim()) {
        autoSave(currentContent);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 언마운트 시에만 실행

  const loadExistingJournal = async () => {
    try {
      // props로 전달된 기존 일기가 있으면 사용 (수정 모드)
      if (existingJournal) {
        setContent(existingJournal.content);
        return;
      }
      
      // 새로운 메모 작성 모드에서는 기존 일기를 불러오지 않음
    } catch (error) {
      console.error('일기 불러오기 실패:', error);
    }
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    
    // 이전 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 3초 후 자동 저장 (사용자가 입력을 멈춘 후)
    saveTimeoutRef.current = setTimeout(() => {
      if (text.trim()) {
        autoSave(text);
      }
    }, 3000); // 1초에서 3초로 변경
  };

  const handleBack = () => {
    // 뒤로가기 시 즉시 저장
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (content.trim()) {
      autoSave(content);
    }
    onBack();
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9', '#EFF6FF']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerDate}>{formatDate(dateString)}</Text>
        <View style={styles.backButton} />
      </View>
      
      <View style={styles.container}>
        <TextInput
          ref={contentInputRef}
          value={content}
          onChangeText={handleContentChange}
          placeholder="지금 이 순간의 감정을 자유롭게 적어보세요..."
          placeholderTextColor="#cbd5e1"
          multiline
          style={styles.contentInput}
          textAlignVertical="top"
          autoFocus
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
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
  headerDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    padding: 0,
  },
});
