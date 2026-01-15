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
    topic: backend.topic || '',  // 백엔드에서 추출한 topic
    createdAt: backend.created_at || new Date().toISOString(),
    updatedAt: backend.created_at || new Date().toISOString(),
  };
}

/**
 * 프론트엔드 일기 데이터를 백엔드 형식으로 변환
 * 새로 생성할 때는 emotion을 보내지 않아서 extractor가 자동으로 추출하도록 함
 */
export function journalEntryToBackend(
  journal: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  isNew: boolean = true  // 새로 생성하는지 여부
): { user_id: string; date: string; content: string; emotion?: BackendEmotion } {
  // date를 ISO datetime 형식으로 변환 (백엔드가 datetime을 기대)
  // YYYY-MM-DD 형식을 YYYY-MM-DDTHH:mm:ss 형식으로 변환
  let dateStr = journal.date;
  if (dateStr && !dateStr.includes('T')) {
    // 시간 부분이 없으면 자정(00:00:00)으로 설정
    dateStr = `${dateStr}T00:00:00`;
  }
  
  const result: { user_id: string; date: string; content: string; emotion?: BackendEmotion } = {
    user_id: userId,
    date: dateStr,
    content: journal.content,
  };
  
  // 수정할 때만 emotion을 보냄 (새로 생성할 때는 extractor가 추출)
  if (!isNew && journal.emotion) {
    result.emotion = reverseEmotionMap[journal.emotion.label] || 'CALM';
  }
  
  return result;
}

/**
 * 감정 라벨을 BackendEmotion으로 변환
 */
export function emotionLabelToBackend(label: string): BackendEmotion {
  return reverseEmotionMap[label] || 'CALM';
}
