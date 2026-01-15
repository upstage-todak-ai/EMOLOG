import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LoginScreenProps = {
  onLogin: (userId: string) => void;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [userId, setUserId] = useState('');

  const handleLogin = async () => {
    if (!userId.trim()) {
      return;
    }
    
    // AsyncStorage에 user_id 저장
    await AsyncStorage.setItem('user_id', userId.trim());
    onLogin(userId.trim());
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F3E8FF', '#FCE7F3']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>EmoLog</Text>
        <Text style={styles.subtitle}>감정을 기록하고 나를 알아가세요</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="사용자 ID를 입력하세요"
            placeholderTextColor="#94a3b8"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.button, !userId.trim() && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!userId.trim()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={userId.trim() ? ['#3B82F6', '#8B5CF6'] : ['#cbd5e1', '#94a3b8']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>시작하기</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 48,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
