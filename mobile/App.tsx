import { useState } from 'react';
import { useFonts } from 'expo-font';
import HomeScreen from './screens/HomeScreen';
import JournalWriteScreen from './screens/JournalWriteScreen';
import StatsScreen from './screens/StatsScreen';
// LoginScreen import 제거 (더 이상 사용 안 함)
import { Emotion, JournalEntry } from './types/journal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'journalWrite' | 'stats'>('home');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [existingJournal, setExistingJournal] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 폰트 로드 (ongle_font.ttf)
  const [fontsLoaded] = useFonts({
    'NanumPen': require('./assets/fonts/ongle_font.ttf'),
  });

  // 폰트가 로드될 때까지 대기
  if (!fontsLoaded) {
    return null; // 또는 로딩 화면 표시
  }

  if (currentScreen === 'stats') {
    return <StatsScreen onBack={() => setCurrentScreen('home')} />;
  }

  if (currentScreen === 'journalWrite') {
    return (
      <JournalWriteScreen
        emotion={selectedEmotion || { label: '평온', icon: 'leaf', color: '#a5b4fc' }}
        selectedDate={selectedDate}
        existingJournal={existingJournal}
        onBack={() => {
          setCurrentScreen('home');
          setSelectedDate(undefined);
          setSelectedEmotion(null);
          setExistingJournal(null);
          setRefreshKey(prev => prev + 1);
        }}
        onSave={() => {
          setCurrentScreen('home');
          setSelectedDate(undefined);
          setSelectedEmotion(null);
          setExistingJournal(null);
          setRefreshKey(prev => prev + 1);
        }}
      />
    );
  }

  return (
    <HomeScreen
      key={refreshKey}
      onNavigateToStats={() => setCurrentScreen('stats')}
      onNavigateToJournalWrite={(emotion: Emotion, date?: string, journal?: JournalEntry | null) => {
        setSelectedEmotion(emotion);
        setSelectedDate(date);
        setExistingJournal(journal || null);
        setCurrentScreen('journalWrite');
      }}
    />
  );
}