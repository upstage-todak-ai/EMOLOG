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
    const userId = getUserId();
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
    const userId = getUserId();
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
