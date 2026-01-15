import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, TextInput, Modal, Animated } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { clearUserId, getUserId } from '../services/userService';
import { testNotification } from '../services/api';

type SettingsScreenProps = {
  onBack: () => void;
  onLogout: () => void;
  onShowNotification?: (message: string, delay?: number) => void;
};

export default function SettingsScreen({ onBack, onLogout, onShowNotification }: SettingsScreenProps) {
  const [testing, setTesting] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (notificationVisible) {
      // 카카오톡 스타일 - 위에서 아래로 슬라이드
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
      slideAnim.setValue(-100); // 위에서 시작
    }
  }, [notificationVisible]);

  const handleTestNotification = async () => {
    try {
      setTesting(true);
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('오류', '사용자 ID를 찾을 수 없습니다.');
        return;
      }

      // 커스텀 시간이 있으면 사용, 없으면 현재 시간 사용
      const result = await testNotification(userId, customTime || undefined);
      
      if (result.should_send && result.message) {
        // 전역 알림 사용 (백그라운드에서도 표시)
        if (onShowNotification) {
          onShowNotification(result.message, 0);
        } else {
          // 폴백: 로컬 알림
          setNotificationMessage(result.message);
          setNotificationVisible(true);
          
          // 3초 후 자동으로 닫기
          setTimeout(() => {
            setNotificationVisible(false);
          }, 3000);
        }
      } else {
        // 전송하지 않는 경우 결과만 Alert로 표시
        Alert.alert(
          '알림 테스트 결과',
          `전송 여부: 아니오\n\n` +
          `사유: ${result.reason}\n\n` +
          `평가 점수: ${(result.evaluation_score * 100).toFixed(1)}점`,
          [{ text: '확인' }]
        );
      }
    } catch (error: any) {
      console.error('알림 테스트 실패:', error);
      Alert.alert('오류', error.message || '알림 테스트에 실패했습니다.');
    } finally {
      setTesting(false);
    }
  };

  const handleTestNotification2 = () => {
    console.log('[SettingsScreen] handleTestNotification2 called, onShowNotification:', !!onShowNotification);
    // Mock 사진용 - 2초 후 알림 표시 (전역 알림)
    if (onShowNotification) {
      console.log('[SettingsScreen] Calling onShowNotification');
      onShowNotification('오늘 시험보느라 고생 많았어요! 힘들지는 않았나요?', 2000);
    } else {
      console.log('[SettingsScreen] onShowNotification not provided, using fallback');
      // 폴백: 로컬 알림
      setTimeout(() => {
        setNotificationMessage('오늘 시험보느라 고생 많았어요! 힘들지는 않았나요?');
        setNotificationVisible(true);
      }, 2000);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearUserId();
              onLogout();
            } catch (error) {
              console.error('로그아웃 실패:', error);
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F3E8FF', '#FCE7F3']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>설정</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleTestNotification}
          activeOpacity={0.7}
          disabled={testing}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={24} color="#475569" />
            <Text style={styles.menuItemText}>알림 테스트</Text>
            {testing && (
              <ActivityIndicator size="small" color="#475569" style={{ marginLeft: 12 }} />
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemMargin]}
          onPress={handleTestNotification2}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications" size={24} color="#475569" />
            <Text style={styles.menuItemText}>테스트2</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemMargin]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text style={[styles.menuItemText, styles.logoutText]}>로그아웃</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>
      
      {/* 알림 모달 - 카카오톡 스타일 */}
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
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  menuItemMargin: {
    marginTop: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1e293b',
  },
  logoutText: {
    color: '#EF4444',
  },
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
