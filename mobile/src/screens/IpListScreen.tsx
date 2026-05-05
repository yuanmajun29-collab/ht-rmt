import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchIps, toggleFavorite, playIp, submitFeedback } from '../api/ips';
import type { IpItem } from '../types';

export default function IpListScreen() {
  const [ips, setIps] = useState<IpItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<IpItem | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setIps(await fetchIps());
    } catch {
      Alert.alert('加载失败', '无法获取音柱列表');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFav = async (ip: IpItem) => {
    try {
      await toggleFavorite(ip.id);
      load();
    } catch (err: any) {
      Alert.alert('错误', err.response?.data?.error || '操作失败');
    }
  };

  const handlePlay = async () => {
    if (!selected) return;
    try {
      const { message } = await playIp(selected.id);
      Alert.alert('播放', message);
    } catch (err: any) {
      Alert.alert('错误', err.response?.data?.error || '播放失败');
    }
  };

  const handleFeedback = async () => {
    if (!selected || !feedback.trim()) return;
    try {
      const { message } = await submitFeedback(selected.id, feedback);
      setFeedback('');
      setShowFeedback(false);
      Alert.alert('成功', message);
    } catch (err: any) {
      Alert.alert('错误', err.response?.data?.error || '提交失败');
    }
  };

  const renderItem = ({ item }: { item: IpItem }) => (
    <TouchableOpacity style={[styles.card, selected?.id === item.id && styles.cardActive]} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        <TouchableOpacity onPress={() => handleToggleFav(item)}>
          <Text style={[styles.favBtn, item.isFavorite && styles.favActive]}>{item.isFavorite ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.cardTone}>频率：{item.audio_tone} Hz</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={ips}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>暂无音柱</Text>}
      />

      {selected && (
        <View style={styles.controlBar}>
          <Text style={styles.controlName} numberOfLines={1}>已选：{selected.name}</Text>
          <View style={styles.controlBtns}>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlay}>
              <Text style={styles.playBtnText}>▶ 播放</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fbBtn} onPress={() => setShowFeedback(true)}>
              <Text style={styles.fbBtnText}>反馈</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showFeedback} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>提交反馈 — {selected?.name}</Text>
            <TextInput
              style={styles.fbInput}
              multiline
              numberOfLines={4}
              placeholder="请填写您的反馈..."
              value={feedback}
              onChangeText={setFeedback}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFeedback(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleFeedback}>
                <Text style={styles.submitText}>提交</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  list: { padding: 12, paddingBottom: 90 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive: { borderColor: '#4f46e5' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  favBtn: { fontSize: 22, color: '#bbb', paddingLeft: 8 },
  favActive: { color: '#f59e0b' },
  cardDesc: { fontSize: 13, color: '#555', marginTop: 4 },
  cardTone: { fontSize: 12, color: '#4f46e5', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 15 },
  controlBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1a1a2e', padding: 12, paddingBottom: 24 },
  controlName: { color: '#ccc', fontSize: 13, marginBottom: 8 },
  controlBtns: { flexDirection: 'row', gap: 10 },
  playBtn: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  playBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fbBtn: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center' },
  fbBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12, color: '#1a1a2e' },
  fbInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#4f46e5' },
  submitText: { color: '#fff', fontWeight: '700' },
});
