import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, Modal, ScrollView, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchSchedules, createSchedule, deleteSchedule, toggleSchedule } from '../api/broadcast';
import { fetchIps } from '../api/ips';
import type { Schedule, IpItem } from '../types';

const REPEAT_OPTIONS = [
  { value: 'once', label: '单次' },
  { value: 'daily', label: '每天' },
  { value: 'workdays', label: '工作日' },
  { value: 'weekly', label: '每周指定日' },
] as const;

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: '启用', color: '#10b981', bg: '#d1fae5' },
  paused:    { label: '暂停', color: '#f59e0b', bg: '#fef3c7' },
  completed: { label: '已完成', color: '#6b7280', bg: '#f3f4f6' },
};

const REPEAT_LABEL: Record<string, string> = {
  once: '单次', daily: '每天', workdays: '工作日', weekly: '每周',
};

type FormState = {
  name: string;
  ipId: number | null;
  repeatType: string;
  scheduledDate: string;
  scheduledTime: string;
  daysOfWeek: number[];
};

const INIT_FORM: FormState = {
  name: '', ipId: null, repeatType: 'daily',
  scheduledDate: '', scheduledTime: '', daysOfWeek: [],
};

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [ips, setIps] = useState<IpItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(INIT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, i] = await Promise.all([fetchSchedules(), fetchIps()]);
      setSchedules(s);
      setIps(i);
    } catch (err: any) {
      Alert.alert('加载失败', err.response?.data?.error || '请求错误');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = async (s: Schedule) => {
    try {
      const { message } = await toggleSchedule(s.id);
      Alert.alert('', message);
      load();
    } catch (err: any) {
      Alert.alert('失败', err.response?.data?.error || '操作失败');
    }
  };

  const handleDelete = (s: Schedule) => {
    Alert.alert('确认删除', `删除计划「${s.name}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await deleteSchedule(s.id); load(); }
        catch (err: any) { Alert.alert('失败', err.response?.data?.error || '删除失败'); }
      }},
    ]);
  };

  const handleCreate = async () => {
    if (!form.name || !form.scheduledTime) {
      Alert.alert('提示', '计划名称和播放时间为必填项');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(form.scheduledTime)) {
      Alert.alert('提示', '时间格式请填写 HH:MM，如 08:30');
      return;
    }
    setSubmitting(true);
    try {
      const { message } = await createSchedule({
        name: form.name,
        ipId: form.ipId,
        repeatType: form.repeatType,
        scheduledDate: form.repeatType === 'once' ? form.scheduledDate : null,
        scheduledTime: form.scheduledTime,
        daysOfWeek: form.repeatType === 'weekly' ? form.daysOfWeek : [],
      });
      setShowForm(false);
      setForm(INIT_FORM);
      Alert.alert('成功', message);
      load();
    } catch (err: any) {
      Alert.alert('失败', err.response?.data?.error || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter(d => d !== day)
        : [...f.daysOfWeek, day],
    }));
  };

  const renderItem = ({ item: s }: { item: Schedule }) => {
    const meta = STATUS_META[s.status] || STATUS_META.completed;
    const ipName = ips.find(i => i.id === s.ip_id)?.name;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{s.name}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {REPEAT_LABEL[s.repeat_type]} · {s.scheduled_time}
          {s.scheduled_date ? ` · ${s.scheduled_date}` : ''}
          {ipName ? ` · ${ipName}` : ''}
        </Text>
        {s.repeat_type === 'weekly' && JSON.parse(s.days_of_week || '[]').length > 0 && (
          <Text style={styles.meta}>
            每周：{JSON.parse(s.days_of_week).map((d: number) => DAY_LABELS[d]).join('、')}
          </Text>
        )}
        <View style={styles.actions}>
          {s.status !== 'completed' && (
            <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggle(s)}>
              <Text style={styles.toggleBtnText}>{s.status === 'active' ? '暂停' : '启用'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(s)}>
            <Text style={styles.deleteBtnText}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>+ 新建定时计划</Text>
      </TouchableOpacity>

      <FlatList
        data={schedules}
        keyExtractor={s => String(s.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>暂无计划，点击上方按钮新建</Text>}
      />

      <Modal visible={showForm} animationType="slide">
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.formTitle}>新建定时计划</Text>

          <Text style={styles.label}>计划名称 *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="如：早间播报" />

          <Text style={styles.label}>播放音柱</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity style={[styles.chip, !form.ipId && styles.chipActive]} onPress={() => setForm(f => ({ ...f, ipId: null }))}>
              <Text style={[styles.chipText, !form.ipId && styles.chipTextActive]}>不指定</Text>
            </TouchableOpacity>
            {ips.map(ip => (
              <TouchableOpacity key={ip.id} style={[styles.chip, form.ipId === ip.id && styles.chipActive]} onPress={() => setForm(f => ({ ...f, ipId: ip.id }))}>
                <Text style={[styles.chipText, form.ipId === ip.id && styles.chipTextActive]}>{ip.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>重复方式 *</Text>
          <View style={styles.repeatRow}>
            {REPEAT_OPTIONS.map(({ value, label }) => (
              <TouchableOpacity key={value} style={[styles.chip, form.repeatType === value && styles.chipActive]} onPress={() => setForm(f => ({ ...f, repeatType: value }))}>
                <Text style={[styles.chipText, form.repeatType === value && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {form.repeatType === 'once' && (
            <>
              <Text style={styles.label}>日期 (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={form.scheduledDate} onChangeText={v => setForm(f => ({ ...f, scheduledDate: v }))} placeholder="2026-05-10" keyboardType="numeric" />
            </>
          )}

          <Text style={styles.label}>播放时间 * (HH:MM)</Text>
          <TextInput style={styles.input} value={form.scheduledTime} onChangeText={v => setForm(f => ({ ...f, scheduledTime: v }))} placeholder="08:30" keyboardType="numeric" maxLength={5} />

          {form.repeatType === 'weekly' && (
            <>
              <Text style={styles.label}>星期</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity key={i} style={[styles.dayChip, form.daysOfWeek.includes(i) && styles.dayChipActive]} onPress={() => toggleDay(i)}>
                    <Text style={[styles.dayChipText, form.daysOfWeek.includes(i) && styles.dayChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={submitting}>
            <Text style={styles.submitText}>{submitting ? '创建中…' : '确认创建'}</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd' },
  toggleBtnText: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  deleteBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 14 },
  formScroll: { padding: 24 },
  formTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 6 },
  chipActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#4f46e5', fontWeight: '700' },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dayChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  dayChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  dayChipText: { fontSize: 13, color: '#374151' },
  dayChipTextActive: { color: '#fff', fontWeight: '700' },
  submitBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
});
