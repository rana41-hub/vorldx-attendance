import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { requireOptionalNativeModule } from 'expo';
import { AppProvider, useApp } from './src/context/AppContext';
import { Header } from './src/components/Header';
import { Toast } from './src/components/Toast';
import { BottomNav, type TabType } from './src/components/BottomNav';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LeaveScreen } from './src/screens/LeaveScreen';
import { WFHScreen } from './src/screens/WFHScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const MainApp: React.FC = () => {
  const { isAuthenticated, isRestoringSession } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  useEffect(() => {
    try {
      const devMenu = requireOptionalNativeModule('DevMenuPreferences') as {
        setPreferencesAsync?: (prefs: { showFloatingActionButton: boolean }) => Promise<void>;
      } | null;
      devMenu?.setPreferencesAsync?.({ showFloatingActionButton: false });
    } catch {
      // Ignored if DevMenuPreferences is unavailable
    }
  }, []);

  if (isRestoringSession) {
    return (
      <SafeAreaView style={styles.splashContainer} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.splashContent}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.splashText}>Restoring VorldX Session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <Toast />
        <LoginScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <Toast />

      {activeTab !== 'scanner' && (
        <Header onOpenProfile={() => setActiveTab('profile')} />
      )}

      <View style={styles.contentContainer}>
        {activeTab === 'home' && (
          <HomeScreen onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'scanner' && (
          <ScannerScreen
            onSuccess={() => setActiveTab('home')}
            onCancel={() => setActiveTab('home')}
          />
        )}
        {activeTab === 'history' && <HistoryScreen />}
        {activeTab === 'wfh' && <WFHScreen />}
        {activeTab === 'leave' && <LeaveScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {activeTab !== 'scanner' && (
        <BottomNav currentTab={activeTab} onSelectTab={setActiveTab} />
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 16,
  },
  splashText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
