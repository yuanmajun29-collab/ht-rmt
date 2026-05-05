import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchDevices, deleteDevice, registerDevice } from '../api/devices';
import type { Device, DeviceStackParamList } from '../types';

type Props = { navigation: NativeStackNavigationProp<DeviceStackParamList, 'DeviceList'> };

const INIT_FORM = { name: '', deviceType: 'audio-speaker', model: '', ipAddress: '', port: '8080', macAddress: '', serialNumber: '', firmwareVersion: '1.0.0' };

export default function DevicesScreen({ navigation }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INIT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setDevices(await fetchDevices());
    } catch (err: any) {
      Alert.alert('加载失败', err.response?.data?.error || '无法获取设备列表');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (device: Device) => {
    Alert.alert('确认删除', `删除设备 "${device.name}"？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try {
          await deleteDevice(device.id);
          load();
        } catch (err: any) {
          Alert.alert('错误', err.response?.data?.error || '删除失败');
        }
      }},
    ]);
  };

  const handleRegister = async () => {
    if (!form.name || !form.deviceType) {
      Alert.alert('提示', '设备名称和类型为必填项');
      return;
    }
    setSubmitting(true);
    try {
      await registerDevice({
        name: form.name,
        deviceType: form.deviceType,
        model: form.model || undefined,
        ipAddress: form.ipAddress || undefined,
        port: form.port ? Number(form.port) : undefined,
        macAddress: form.macAddress || undefined,
        serialNumber: form.serialNumber || undefined,
        firmwareVersion: form.firmwareVersion || undefined,
      });
      setShowForm(false);
      setForm(INIT_FORM);
      load();
    } catch (err: any) {
      Alert.alert('注册失败', err.response?.data?.error || '请求错误');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => (s === 'online' ? '#10b981' : '#ef4444');

  const renderItem = ({ item }: { item: Device }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DeviceDetail', { device: item })}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.device_type} · {item.model || '—'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
          <Text style={styles.badgeText}>{item.status === 'online' ? '在线' : '离线'}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>IP: {item.ip_address || '—'}  端口: {item.port}</Text>
      {item.last_heartbeat && <Text style={styles.cardMeta}>最近心跳: {new Date(item.last_heartbeat).toLocaleString('zh-CN')}</Text>}
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>+ 注册新设备</Text>
      </TouchableOpacity>

      <FlatList
        data={devices}
        keyExtractor={d => d.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>暂无设备，点击上方按钮注册</Text>}
      />

      <Modal visible={showForm} animationType="slide">
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.formTitle}>注册新设备</Text>
          {([
            ['name', '设备名称 *', false],
            ['deviceType', '设备类型 *', false],
            ['model', '型号', false],
            ['ipAddress', 'IP 地址', false],
            ['port', '端口', true],
            ['macAddress', 'MAC 地址', false],
            ['serialNumber', '序列号', false],
            ['firmwareVersion', '固件版本', false],
          ] as [keyof typeof form, string, boolean][]).map(([key, label, numeric]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[key]}
                onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                keyboardType={numeric ? 'numeric' : 'default'}
                autoCapitalize="none"
              />
            </View>
          ))}
          <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={submitting}>
            <Text style={styles.submitText}>{submitting ? '注册中…' : '确认注册'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setForm(INIT_FORM); }}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  addBtn: { margin: 12, backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: '#555', marginTop: 2 },
  deleteBtn: { marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fee2e2' },
  deleteBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 14 },
  formScroll: { padding: 24 },
  formTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: '#374151', marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  submitBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
});
