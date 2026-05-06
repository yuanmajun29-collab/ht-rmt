import api from './client';
import type { User } from '../types';

export async function login(username: string, password: string): Promise<{ user: User; token: string }> {
  const res = await api.post('/api/login', { username, password });
  return res.data;
}

export async function register(username: string, password: string): Promise<{ user: User; token: string }> {
  const res = await api.post('/api/register', { username, password });
  return res.data;
}

export async function fetchProfile(): Promise<{ user: User | null }> {
  const res = await api.get('/api/profile');
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/api/logout');
}
