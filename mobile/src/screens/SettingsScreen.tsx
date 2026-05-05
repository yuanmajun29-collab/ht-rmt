import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from '../../App';
import { logout } from '../api/auth';
import { fetchPlatformInfo } from '../api/devices';
import { SERVER_KEY, DEFAULT_SERVER } from '../api/client';

export default function SettingsScreen() {
  const { user, signOut } = useContext(AuthContext);
  const [serverUrl, setServerUrl] = useState('');
  const [platformInfo, setPlatformInfo] = useState<Record<string, unknown> | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SERVER_KEY).then(v => setServerUrl(v || DEFAULT_SERVER));
    loadPlatformInfo();
  }, []);

  const loadPlatformInfo = async () => {
    setLoadingInfo(true);
    try {
      setPlatformInfo(await fetchPlatformInfo());
    } catch {
      setPlatformInfo(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  const saveServer = async () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) {
      Alert.alert('格式错误', '请输入以 http:// 或 https:// 开头的地址');
      return;
    }
    await SecureStore.setItemAsync(SERVER_KEY, url);
    Alert.alert('已保存', '服务器地址已更新，下次请求生效');
    loadPlatformInfo();
  };

  const handleLogout = async () => {
    Alert.alert('退出登录', '确认退出？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: async () => {
        try { await logout(); } catch {}
        await SecureStore.deleteItemAsync('ht_rmt_token');
        signOut();
      }},
    ]);
  };

  const InfoRow = ({ label, value }: { label: string; value: unknown }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value ?? '—')}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前用户</Text>
        <InfoRow label="用户名" value={user?.username} />
        <InfoRow label="角色" value={user?.role === 'admin' ? '管理员' : '普通用户'} />
        <InfoRow label="租户" value={user?.tenant_id} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务器配置</Text>
        <Text style={styles.label}>服务器地址</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.x.x:3000"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.hint}>
          安卓模拟器访问本机请使用 10.0.2.2，iOS 模拟器使用 localhost，真机填写局域网 IP。
        </Text>
        <TouchableOpacity style={styles.saveBtn} onPress={saveServer}>
          <Text style={styles.saveBtnText}>保存地址</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>平台信息</Text>
          <TouchableOpacity onPress={loadPlatformInfo}>
            <Text style={styles.refreshText}>刷新</Text>
          </TouchableOpacity>
        </View>
        {loadingInfo ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 12 }} />
        ) : platformInfo ? (
          Object.entries(platformInfo).map(([k, v]) => <InfoRow key={k} label={k} value={v} />)
        ) : (
          <Text style={styles.hint}>无法连接服务器</Text>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#4f46e5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 16 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  refreshText: { color: '#4f46e5', fontSize: 13, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
