export type Emotion = {
  label: string;
  icon: string;
  color: string;
};

export type JournalEntry = {
  id: string;
  date: string; // YYYY-MM-DD 형식
  emotion: Emotion | null;  // 감정이 추출되지 않았을 수 있음
  content: string;
  topic?: string;  // 추출된 주제 (백엔드에서 추출)
  createdAt: string;
  updatedAt: string;
};
