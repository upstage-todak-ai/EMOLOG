export type Emotion = {
  label: string;
  icon: string;
  color: string;
};

export type JournalEntry = {
  id: string;
  date: string; // YYYY-MM-DD 형식
  emotion: Emotion;
  content: string;
  topic?: string;  // 추출된 주제 (백엔드에서 추출)
  createdAt: string;
  updatedAt: string;
};
