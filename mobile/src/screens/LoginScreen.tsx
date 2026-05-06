import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from '../../App';
import { login, register } from '../api/auth';
import { SERVER_KEY, DEFAULT_SERVER } from '../api/client';

export default function LoginScreen() {
  const { signIn } = useContext(AuthContext);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [showServer, setShowServer] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const saveServerAndSubmit = async () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    await SecureStore.setItemAsync(SERVER_KEY, url);
    setLoading(true);
    try {
      const fn = tab === 'login' ? login : register;
      const { user, token } = await fn(username.trim(), password.trim());
      signIn(token, user);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '请求失败';
      Alert.alert('错误', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>HT-RMT</Text>
        <Text style={styles.subtitle}>IP 音柱远程配置平台</Text>

        <View style={styles.serverRow}>
          <TouchableOpacity onPress={() => setShowServer(v => !v)}>
            <Text style={styles.serverToggle}>⚙ 服务器地址 {showServer ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
        {showServer && (
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.x.x:3000"
            autoCapitalize="none"
            keyboardType="url"
          />
        )}

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'login' && styles.tabActive]} onPress={() => setTab('login')}>
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'register' && styles.tabActive]} onPress={() => setTab('register')}>
            <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>注册</Text>
          </TouchableOpacity>
        </View>

        <TextInput style={styles.input} placeholder="用户名" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.btn} onPress={saveServerAndSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{tab === 'login' ? '登录' : '注册'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: '#1a1a2e', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32 },
  serverRow: { alignItems: 'center', marginBottom: 8 },
  serverToggle: { color: '#4f46e5', fontSize: 13 },
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#4f46e5' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#4f46e5' },
  tabText: { color: '#4f46e5', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  input: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#ddd' },
  btn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
