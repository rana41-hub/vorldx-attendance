import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { Header } from './src/components/Header';
import { Toast } from './src/components/Toast';
import { BottomNav, type TabType } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LeaveScreen } from './src/screens/LeaveScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');

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
});
