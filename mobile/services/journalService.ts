/**
 * 일기 서비스
 * 
 * 백엔드 API를 사용하여 일기 데이터를 관리합니다.
 */
import { JournalEntry } from '../types/journal';
import { 
  getDiaries, 
  createDiary, 
  updateDiary, 
  deleteDiary,
  extractLog,
  BackendDiaryUpdate,
  BackendEmotion
} from './api';
import { getUserId } from './userService';
import { backendToJournalEntry, journalEntryToBackend, emotionLabelToBackend } from '../utils/journalConverter';

/**
 * 모든 일기 가져오기
 */
export const getAllJournals = async (): Promise<JournalEntry[]> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('user_id가 설정되지 않았습니다.');
    }
    const backendEntries = await getDiaries(userId);
    return backendEntries.map(backendToJournalEntry);
  } catch (error) {
    console.error('일기 가져오기 실패:', error);
    throw error;
  }
};

/**
 * 특정 날짜의 일기 가져오기
 */
export const getJournalByDate = async (date: string): Promise<JournalEntry | null> => {
  try {
    const journals = await getAllJournals();
    return journals.find(journal => journal.date === date) || null;
  } catch (error) {
    console.error('일기 가져오기 실패:', error);
    return null;
  }
};

/**
 * 일기 생성
 */
export const createJournal = async (
  entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<JournalEntry> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('user_id가 설정되지 않았습니다.');
    }
    // 새로 생성할 때는 emotion을 보내지 않아서 extractor가 자동으로 추출하도록 함
    const backendEntry = journalEntryToBackend(entry, userId, true);
    const created = await createDiary(backendEntry);
    return backendToJournalEntry(created);
  } catch (error) {
    console.error('일기 생성 실패:', error);
    throw error;
  }
};

/**
 * 일기 수정
 */
export const updateJournal = async (
  id: string, 
  updates: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<JournalEntry | null> => {
  try {
    const backendUpdates: BackendDiaryUpdate = {};
    
    if (updates.content !== undefined) {
      backendUpdates.content = updates.content;
    }
    
    if (updates.emotion !== undefined) {
      backendUpdates.emotion = emotionLabelToBackend(updates.emotion.label);
    }
    
    if (updates.topic !== undefined) {
      backendUpdates.topic = updates.topic;
    }
    
    const updated = await updateDiary(id, backendUpdates);
    return backendToJournalEntry(updated);
  } catch (error) {
    console.error('일기 수정 실패:', error);
    throw error;
  }
};

/**
 * 일기 삭제
 */
export const deleteJournal = async (id: string): Promise<boolean> => {
  try {
    await deleteDiary(id);
    return true;
  } catch (error) {
    console.error('일기 삭제 실패:', error);
    return false;
  }
};

/**
 * 특정 날짜의 일기 삭제
 */
export const deleteJournalByDate = async (date: string): Promise<boolean> => {
  try {
    const journal = await getJournalByDate(date);
    if (journal) {
      return await deleteJournal(journal.id);
    }
    return false;
  } catch (error) {
    console.error('일기 삭제 실패:', error);
    return false;
  }
};

/**
 * 빈 감정/주제가 있는 일기들을 배치로 추출
 */
export const batchExtractMissingLogs = async (journals: JournalEntry[]): Promise<number> => {
  let extractedCount = 0;
  
  for (const journal of journals) {
    // topic이나 emotion이 없거나 빈 값이면 추출
    const needsExtraction = 
      !journal.topic || 
      journal.topic.trim() === '' || 
      journal.topic.toLowerCase() === 'none' ||
      !journal.emotion ||
      journal.emotion.label.trim() === '';
    
    if (needsExtraction && journal.content) {
      try {
        console.log(`[batchExtractMissingLogs] 일기 ${journal.id} 추출 시작 - content: ${journal.content.substring(0, 50)}...`);
        const result = await extractLog(journal.content);
        console.log(`[batchExtractMissingLogs] 일기 ${journal.id} 추출 결과 - topic: ${result.topic}, emotion: ${result.emotion}`);
        
        // 업데이트할 내용 준비
        const updates: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>> = {};
        
        if (result.topic) {
          updates.topic = result.topic;
        }
        
        if (result.emotion) {
          // BackendEmotion을 Emotion으로 변환
          const emotionMap: Record<string, Emotion> = {
            'JOY': { label: '기쁨', icon: 'sunny', color: '#fcd34d' },
            'CALM': { label: '평온', icon: 'leaf', color: '#a5b4fc' },
            'SADNESS': { label: '슬픔', icon: 'rainy', color: '#93c5fd' },
            'ANGER': { label: '화남', icon: 'flame', color: '#fca5a5' },
            'ANXIETY': { label: '불안', icon: 'alert-circle', color: '#fdba74' },
            'EXHAUSTED': { label: '지침', icon: 'moon', color: '#a78bfa' },
          };
          updates.emotion = emotionMap[result.emotion] || journal.emotion;
          console.log(`[batchExtractMissingLogs] 일기 ${journal.id} 감정 업데이트 - ${result.emotion} -> ${updates.emotion?.label}`);
        } else {
          console.warn(`[batchExtractMissingLogs] 일기 ${journal.id} 감정 추출 실패 - emotion이 null입니다.`);
        }
        
        await updateJournal(journal.id, updates);
        extractedCount++;
        console.log(`[batchExtractMissingLogs] 일기 ${journal.id} 업데이트 완료`);
      } catch (error) {
        console.error(`[batchExtractMissingLogs] 일기 ${journal.id} 추출 실패:`, error);
      }
    }
  }
  
  return extractedCount;
};
