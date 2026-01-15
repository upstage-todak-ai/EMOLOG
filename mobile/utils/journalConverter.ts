/**
 * 백엔드와 프론트엔드 간 일기 데이터 변환 유틸리티
 */
import { JournalEntry, Emotion } from '../types/journal';
import { BackendDiaryEntry, BackendEmotion } from '../services/api';

// 감정 매핑
const emotionMap: Record<BackendEmotion, Emotion> = {
  JOY: { label: '기쁨', icon: 'sunny', color: '#fcd34d' },
  CALM: { label: '평온', icon: 'leaf', color: '#a5b4fc' },
  SADNESS: { label: '슬픔', icon: 'rainy', color: '#93c5fd' },
  ANGER: { label: '화남', icon: 'flame', color: '#fca5a5' },
  ANXIETY: { label: '불안', icon: 'alert-circle', color: '#fdba74' },
  EXHAUSTED: { label: '지침', icon: 'moon', color: '#a78bfa' },
};

const reverseEmotionMap: Record<string, BackendEmotion> = {
  '기쁨': 'JOY',
  '평온': 'CALM',
  '슬픔': 'SADNESS',
  '화남': 'ANGER',
  '불안': 'ANXIETY',
  '지침': 'EXHAUSTED',
};

/**
 * 백엔드 일기 데이터를 프론트엔드 형식으로 변환
 */
export function backendToJournalEntry(backend: BackendDiaryEntry): JournalEntry {
  // date가 datetime 형식이면 YYYY-MM-DD로 변환
  let dateStr = backend.date;
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  return {
    id: String(backend.id || ''),
    date: dateStr,
    emotion: emotionMap[backend.emotion],
    content: backend.content,
    createdAt: backend.created_at || new Date().toISOString(),
    updatedAt: backend.created_at || new Date().toISOString(),
  };
}

/**
 * 프론트엔드 일기 데이터를 백엔드 형식으로 변환
 */
export function journalEntryToBackend(
  journal: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): { user_id: string; date: string; content: string; emotion: BackendEmotion } {
  const backendEmotion = reverseEmotionMap[journal.emotion.label] || 'CALM';
  
  // date를 ISO datetime 형식으로 변환 (백엔드가 datetime을 기대)
  // YYYY-MM-DD 형식을 YYYY-MM-DDTHH:mm:ss 형식으로 변환
  let dateStr = journal.date;
  if (dateStr && !dateStr.includes('T')) {
    // 시간 부분이 없으면 자정(00:00:00)으로 설정
    dateStr = `${dateStr}T00:00:00`;
  }
  
  return {
    user_id: userId,
    date: dateStr,
    content: journal.content,
    emotion: backendEmotion,
  };
}

/**
 * 감정 라벨을 BackendEmotion으로 변환
 */
export function emotionLabelToBackend(label: string): BackendEmotion {
  return reverseEmotionMap[label] || 'CALM';
}
