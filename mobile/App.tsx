import { useState, useEffect, useRef } from 'react';
import { Modal, TouchableOpacity, View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import JournalWriteScreen from './screens/JournalWriteScreen';
import StatsScreen from './screens/StatsScreen';
import LoginScreen from './screens/LoginScreen';
import SettingsScreen from './screens/SettingsScreen';
import DeveloperScreen from './screens/DeveloperScreen';
import { Emotion, JournalEntry } from './types/journal';
import { getUserId } from './services/userService';

// expo-notifications 임포트 (선택적)
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  // 알림 핸들러 설정
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (error) {
  console.warn('[App] expo-notifications not installed:', error);
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'home' | 'journalWrite' | 'stats' | 'settings' | 'developer'>('login');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [existingJournal, setExistingJournal] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 알림 표시 함수 (로컬 + 백그라운드)
  const showNotification = async (message: string, delay: number = 0) => {
    console.log('[App] showNotification called:', message, delay);
    // 기존 타이머 취소
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    
    const showLocalAndPush = async () => {
      // 로컬 알림 표시 (앱이 포그라운드일 때)
      setNotificationMessage(message);
      setNotificationVisible(true);
      
      // 푸시 알림도 발송 (백그라운드에서도 표시)
      if (Notifications) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'EmoLog',
              body: message,
              sound: true,
            },
            trigger: null, // 즉시 발송
          });
          console.log('[App] Push notification scheduled');
        } catch (error) {
          console.error('[App] Failed to schedule push notification:', error);
        }
      }
    };
    
    if (delay > 0) {
      // 딜레이 후 알림 표시
      console.log('[App] Setting timer for', delay, 'ms');
      notificationTimerRef.current = setTimeout(() => {
        console.log('[App] Timer fired, showing notification');
        showLocalAndPush();
      }, delay);
    } else {
      // 즉시 알림 표시
      console.log('[App] Showing notification immediately');
      showLocalAndPush();
    }
  };

  // 알림 애니메이션
  useEffect(() => {
    console.log('[App] notificationVisible changed:', notificationVisible);
    if (notificationVisible) {
      console.log('[App] Starting notification animation');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
      
      // 4초 후 자동으로 닫기
      const timer = setTimeout(() => {
        console.log('[App] Auto-closing notification');
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setNotificationVisible(false);
        });
      }, 4000);
      
      return () => clearTimeout(timer);
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(-100);
    }
  }, [notificationVisible]);

  // 앱 시작 시 저장된 user_id 확인
  useEffect(() => {
    const checkLogin = async () => {
      
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
    
    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // 로딩 대기
  if (isLoading) {
    return null; // 또는 로딩 화면 표시
  }

  // 전역 알림 모달 컴포넌트
  const NotificationModal = () => {
    console.log('[App] NotificationModal render, visible:', notificationVisible, 'message:', notificationMessage);
    return (
      <Modal
        visible={notificationVisible}
        transparent
        animationType="none"
        onRequestClose={() => setNotificationVisible(false)}
      >
        <TouchableOpacity
          style={styles.notificationOverlay}
          activeOpacity={1}
          onPress={() => setNotificationVisible(false)}
        >
          <Animated.View
            style={[
              styles.notificationCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.notificationHeader}>
              <View style={styles.notificationIconContainer}>
                <Ionicons name="notifications" size={20} color="#3B82F6" />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>EmoLog</Text>
                <Text style={styles.notificationTime}>방금 전</Text>
              </View>
            </View>
            <Text style={styles.notificationMessage}>{notificationMessage}</Text>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (currentScreen === 'login') {
    return (
      <>
        <LoginScreen
          onLogin={(userId) => {
            setCurrentScreen('home');
          }}
        />
        <NotificationModal />
      </>
    );
  }

  if (currentScreen === 'stats') {
    return (
      <>
        <StatsScreen onBack={() => setCurrentScreen('home')} />
        <NotificationModal />
      </>
    );
  }

  if (currentScreen === 'settings') {
    return (
      <>
        <SettingsScreen
          onBack={() => setCurrentScreen('home')}
          onLogout={() => {
            setCurrentScreen('login');
            setRefreshKey(prev => prev + 1);
          }}
          onShowNotification={showNotification}
        />
        <NotificationModal />
      </>
    );
  }

  if (currentScreen === 'journalWrite') {
    return (
      <>
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
        <NotificationModal />
      </>
    );
  }

  if (currentScreen === 'developer') {
    return (
      <>
        <DeveloperScreen onBack={() => setCurrentScreen('home')} />
        <NotificationModal />
      </>
    );
  }

  return (
    <>
      <HomeScreen
        key={refreshKey}
        onNavigateToStats={() => setCurrentScreen('stats')}
        onNavigateToSettings={() => setCurrentScreen('settings')}
        onNavigateToDeveloper={() => setCurrentScreen('developer')}
        onNavigateToJournalWrite={(emotion: Emotion, date?: string, journal?: JournalEntry | null) => {
          setSelectedEmotion(emotion);
          setSelectedDate(date);
          setExistingJournal(journal || null);
          setCurrentScreen('journalWrite');
        }}
      />
      <NotificationModal />
    </>
  );
}

const styles = StyleSheet.create({
  notificationOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  notificationTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  notificationMessage: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
});