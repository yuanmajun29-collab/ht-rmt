import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sendHeartbeat, deleteDevice } from '../api/devices';
import type { DeviceStackParamList } from '../types';

type Props = NativeStackScreenProps<DeviceStackParamList, 'DeviceDetail'>;

export default function DeviceDetailScreen({ route, navigation }: Props) {
  const { device } = route.params;
  const [beating, setBeating] = useState(false);

  const handleHeartbeat = async () => {
    setBeating(true);
    try {
      await sendHeartbeat(device.id);
      Alert.alert('成功', '心跳已发送');
    } catch {
      Alert.alert('失败', '心跳发送失败');
    } finally {
      setBeating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('确认删除', `删除设备 "${device.name}"？此操作不可恢复。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try {
          await deleteDevice(device.id);
          navigation.goBack();
        } catch (err: any) {
          Alert.alert('错误', err.response?.data?.error || '删除失败');
        }
      }},
    ]);
  };

  const Row = ({ label, value }: { label: string; value?: string | number | null }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );

  const statusColor = device.status === 'online' ? '#10b981' : '#ef4444';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{device.status === 'online' ? '在线' : '离线'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <Row label="设备 ID" value={device.id} />
        <Row label="类型" value={device.device_type} />
        <Row label="型号" value={device.model} />
        <Row label="固件版本" value={device.firmware_version} />
        <Row label="序列号" value={device.serial_number} />
        <Row label="MAC 地址" value={device.mac_address} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>网络信息</Text>
        <Row label="IP 地址" value={device.ip_address} />
        <Row label="端口" value={device.port} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>状态</Text>
        <Row label="最近心跳" value={device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString('zh-CN') : null} />
        <Row label="注册时间" value={new Date(device.registered_at).toLocaleString('zh-CN')} />
        <Row label="租户" value={device.tenant_id} />
      </View>

      {Object.keys(device.capabilities).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备能力</Text>
          {Object.entries(device.capabilities).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.heartbeatBtn} onPress={handleHeartbeat} disabled={beating}>
        {beating ? <ActivityIndicator color="#fff" /> : <Text style={styles.heartbeatText}>发送心跳</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteText}>删除设备</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  deviceName: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  section: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#4f46e5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  rowLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  rowValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '500', flex: 2, textAlign: 'right' },
  heartbeatBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  heartbeatText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  deleteText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
