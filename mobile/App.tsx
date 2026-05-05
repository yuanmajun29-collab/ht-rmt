import React, { useState, useEffect, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { fetchProfile } from './src/api/auth';
import LoginScreen from './src/screens/LoginScreen';
import IpListScreen from './src/screens/IpListScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import DeviceDetailScreen from './src/screens/DeviceDetailScreen';
import BroadcastScreen from './src/screens/BroadcastScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { User, DeviceStackParamList } from './src/types';

export type AuthContextType = {
  user: User | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null, signIn: () => {}, signOut: () => {},
});

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const DeviceStack = createNativeStackNavigator<DeviceStackParamList>();

function DeviceNavigator() {
  return (
    <DeviceStack.Navigator>
      <DeviceStack.Screen name="DeviceList" component={DevicesScreen} options={{ title: '设备管理' }} />
      <DeviceStack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: '设备详情' }} />
    </DeviceStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#4f46e5', tabBarInactiveTintColor: '#9ca3af' }}>
      <Tab.Screen name="音柱" component={IpListScreen} options={{ tabBarLabel: '音柱列表' }} />
      <Tab.Screen name="设备管理" component={DeviceNavigator} options={{ headerShown: false, tabBarLabel: '设备管理' }} />
      <Tab.Screen name="广播" component={BroadcastScreen} options={{ tabBarLabel: '广播' }} />
      <Tab.Screen name="计划" component={ScheduleScreen} options={{ tabBarLabel: '定时计划' }} />
      <Tab.Screen name="设置" component={SettingsScreen} options={{ tabBarLabel: '设置' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('ht_rmt_token');
      if (token) {
        try {
          const { user: u } = await fetchProfile();
          if (u) setUser(u);
          else await SecureStore.deleteItemAsync('ht_rmt_token');
        } catch {
          await SecureStore.deleteItemAsync('ht_rmt_token');
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return null;

  const signIn = (token: string, u: User) => {
    SecureStore.setItemAsync('ht_rmt_token', token);
    setUser(u);
  };

  const signOut = () => {
    SecureStore.deleteItemAsync('ht_rmt_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      <StatusBar style="auto" />
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <RootStack.Screen name="Main" component={MainTabs} />
          ) : (
            <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: 'HT-RMT 远程配置' }} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
