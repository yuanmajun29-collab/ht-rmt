import api from './client';
import type { IpItem } from '../types';

export async function fetchIps(): Promise<IpItem[]> {
  const res = await api.get('/api/ips');
  return res.data.ips;
}

export async function fetchFavorites(): Promise<IpItem[]> {
  const res = await api.get('/api/favorites');
  return res.data.favorites;
}

export async function toggleFavorite(ipId: number): Promise<{ favorite: boolean; message: string }> {
  const res = await api.post(`/api/favorites/${ipId}`);
  return res.data;
}

export async function playIp(ipId: number): Promise<{ audioTone: number; message: string }> {
  const res = await api.post('/api/play', { ipId });
  return res.data;
}

export async function submitFeedback(ipId: number, feedback: string): Promise<{ message: string }> {
  const res = await api.post('/api/feedback', { ipId, feedback });
  return res.data;
}
