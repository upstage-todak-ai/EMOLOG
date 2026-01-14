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
  createdAt: string;
  updatedAt: string;
};
