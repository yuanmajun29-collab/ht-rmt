import api from './client';
import type { Schedule, BroadcastLog } from '../types';

// ── 广播 ──────────────────────────────────────────────
export async function sendLiveBroadcast(content: string, deviceIds?: string[]): Promise<{ message: string }> {
  const res = await api.post('/api/broadcast/live', { content, deviceIds: deviceIds || [] });
  return res.data;
}

export async function sendInterruptBroadcast(params: { ipId?: number; content?: string; deviceIds?: string[] }): Promise<{ message: string }> {
  const res = await api.post('/api/broadcast/interrupt', params);
  return res.data;
}

export async function fetchBroadcastLog(limit = 30): Promise<BroadcastLog[]> {
  const res = await api.get(`/api/broadcast/log?limit=${limit}`);
  return res.data.log;
}

// ── 定时计划 ──────────────────────────────────────────
export async function fetchSchedules(): Promise<Schedule[]> {
  const res = await api.get('/api/schedules');
  return res.data.schedules;
}

export async function createSchedule(params: {
  name: string;
  ipId?: number | null;
  repeatType: string;
  scheduledDate?: string | null;
  scheduledTime: string;
  daysOfWeek?: number[];
  deviceIds?: string[];
}): Promise<{ message: string; id: number }> {
  const res = await api.post('/api/schedules', params);
  return res.data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await api.delete(`/api/schedules/${id}`);
}

export async function toggleSchedule(id: number): Promise<{ message: string; status: string }> {
  const res = await api.post(`/api/schedules/${id}/toggle`);
  return res.data;
}
