import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sendLiveBroadcast, sendInterruptBroadcast, fetchBroadcastLog } from '../api/broadcast';
import { fetchIps } from '../api/ips';
import type { BroadcastLog, IpItem } from '../types';

const TAB = ['口播', '插播', '记录'] as const;
type Tab = typeof TAB[number];

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  live:      { label: '口播', color: '#3b82f6' },
  interrupt: { label: '插播', color: '#ef4444' },
  scheduled: { label: '定时', color: '#10b981' },
};

export default function BroadcastScreen() {
  const [tab, setTab] = useState<Tab>('口播');
  const [liveContent, setLiveContent] = useState('');
  const [interruptContent, setInterruptContent] = useState('');
  const [selectedIpId, setSelectedIpId] = useState<number | null>(null);
  const [ips, setIps] = useState<IpItem[]>([]);
  const [log, setLog] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logRefreshing, setLogRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchIps().then(setIps).catch(() => {});
    loadLog();
  }, []));

  const loadLog = async () => {
    setLogRefreshing(true);
    try { setLog(await fetchBroadcastLog()); } catch {}
    finally { setLogRefreshing(false); }
  };

  const handleLive = async () => {
    if (!liveContent.trim()) { Alert.alert('提示', '请输入口播内容'); return; }
    setLoading(true);
    try {
      const { message } = await sendLiveBroadcast(liveContent.trim());
      setLiveContent('');
      Alert.alert('成功', message);
      loadLog();
    } catch (err: any) {
      Alert.alert('失败', err.response?.data?.error || '发送失败');
    } finally { setLoading(false); }
  };

  const handleInterrupt = async () => {
    if (!selectedIpId && !interruptContent.trim()) {
      Alert.alert('提示', '请选择音柱或输入插播内容');
      return;
    }
    setLoading(true);
    try {
      const { message } = await sendInterruptBroadcast({
        ipId: selectedIpId || undefined,
        content: interruptContent.trim() || undefined,
      });
      setInterruptContent('');
      setSelectedIpId(null);
      Alert.alert('成功', message);
      loadLog();
    } catch (err: any) {
      Alert.alert('失败', err.response?.data?.error || '发送失败');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      {/* Tab 切换 */}
      <View style={styles.tabs}>
        {TAB.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 口播 */}
      {tab === '口播' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>实时口播</Text>
          <Text style={styles.desc}>文字播报将立即推送至所有在线设备</Text>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={5}
            placeholder="请输入播报内容..."
            placeholderTextColor="#9ca3af"
            value={liveContent}
            onChangeText={setLiveContent}
          />
          <TouchableOpacity style={styles.blueBtn} onPress={handleLive} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>发送口播</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* 插播 */}
      {tab === '插播' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>紧急插播</Text>
          <Text style={styles.desc}>最高优先级，立即中断当前播放</Text>
          <Text style={styles.label}>选择音柱内容</Text>
          <View style={styles.ipList}>
            <TouchableOpacity
              style={[styles.ipChip, !selectedIpId && styles.ipChipActive]}
              onPress={() => setSelectedIpId(null)}
            >
              <Text style={[styles.ipChipText, !selectedIpId && styles.ipChipTextActive]}>不选</Text>
            </TouchableOpacity>
            {ips.map(ip => (
              <TouchableOpacity
                key={ip.id}
                style={[styles.ipChip, selectedIpId === ip.id && styles.ipChipActive]}
                onPress={() => setSelectedIpId(ip.id)}
              >
                <Text style={[styles.ipChipText, selectedIpId === ip.id && styles.ipChipTextActive]}>{ip.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>或输入插播文字</Text>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={3}
            placeholder="紧急播报内容..."
            placeholderTextColor="#9ca3af"
            value={interruptContent}
            onChangeText={setInterruptContent}
          />
          <TouchableOpacity style={styles.redBtn} onPress={handleInterrupt} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>立即插播</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* 记录 */}
      {tab === '记录' && (
        <FlatList
          data={log}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.logList}
          refreshControl={<RefreshControl refreshing={logRefreshing} onRefresh={loadLog} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无播报记录</Text>}
          renderItem={({ item }) => {
            const meta = TYPE_LABEL[item.type] || { label: item.type, color: '#6b7280' };
            const count = JSON.parse(item.device_ids || '[]').length;
            return (
              <View style={styles.logRow}>
                <View style={[styles.logBadge, { backgroundColor: meta.color + '30' }]}>
                  <Text style={[styles.logBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{item.name || item.content || '—'}</Text>
                  <Text style={styles.logMeta}>{count} 台设备 · {new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4f46e5' },
  tabText: { fontSize: 15, color: '#9ca3af', fontWeight: '600' },
  tabTextActive: { color: '#4f46e5' },
  panel: { padding: 16 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  textarea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a2e', textAlignVertical: 'top', minHeight: 100 },
  blueBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  redBtn: { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  ipChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  ipChipActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  ipChipText: { fontSize: 13, color: '#374151' },
  ipChipTextActive: { color: '#4f46e5', fontWeight: '700' },
  logList: { padding: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  logBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, minWidth: 44, alignItems: 'center' },
  logBadgeText: { fontSize: 12, fontWeight: '700' },
  logInfo: { flex: 1 },
  logName: { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  logMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 14 },
});
