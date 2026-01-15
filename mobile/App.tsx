import { useState, useEffect } from 'react';
import { useFonts } from 'expo-font';
import HomeScreen from './screens/HomeScreen';
import JournalWriteScreen from './screens/JournalWriteScreen';
import StatsScreen from './screens/StatsScreen';
import LoginScreen from './screens/LoginScreen';
import SettingsScreen from './screens/SettingsScreen';
import { Emotion, JournalEntry } from './types/journal';
import { getUserId } from './services/userService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'home' | 'journalWrite' | 'stats' | 'settings'>('login');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [existingJournal, setExistingJournal] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 폰트 로드 (ongle_font.ttf)
  const [fontsLoaded] = useFonts({
    'NanumPen': require('./assets/fonts/ongle_font.ttf'),
  });

  // 앱 시작 시 저장된 user_id 확인
  useEffect(() => {
    const checkLogin = async () => {
      if (!fontsLoaded) return;
      
      try {
        const userId = await getUserId();
        if (userId) {
          setCurrentScreen('home');
        } else {
          setCurrentScreen('login');
        }
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
        setCurrentScreen('login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkLogin();
  }, [fontsLoaded]);

  // 폰트가 로드될 때까지 대기
  if (!fontsLoaded || isLoading) {
    return null; // 또는 로딩 화면 표시
  }

  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onLogin={(userId) => {
          setCurrentScreen('home');
        }}
      />
    );
  }

  if (currentScreen === 'stats') {
    return <StatsScreen onBack={() => setCurrentScreen('home')} />;
  }

  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setCurrentScreen('home')}
        onLogout={() => {
          setCurrentScreen('login');
          setRefreshKey(prev => prev + 1);
        }}
      />
    );
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
      onNavigateToSettings={() => setCurrentScreen('settings')}
      onNavigateToJournalWrite={(emotion: Emotion, date?: string, journal?: JournalEntry | null) => {
        setSelectedEmotion(emotion);
        setSelectedDate(date);
        setExistingJournal(journal || null);
        setCurrentScreen('journalWrite');
      }}
    />
  );
}