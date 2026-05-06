import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'ht_rmt_token';
export const SERVER_KEY = 'ht_rmt_server';
// 安卓模拟器用 10.0.2.2 访问宿主机 localhost，真机需填实际 IP
export const DEFAULT_SERVER = 'http://10.0.2.2:3000';

const api = axios.create({ timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const server = (await SecureStore.getItemAsync(SERVER_KEY)) || DEFAULT_SERVER;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  config.baseURL = server;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
