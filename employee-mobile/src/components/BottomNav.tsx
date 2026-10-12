import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TabType = 'home' | 'scanner' | 'history' | 'leave' | 'profile';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('home')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'home' ? 'home' : 'home-outline'}
          size={22}
          color={currentTab === 'home' ? '#4F46E5' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'home' && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('history')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'history' ? 'time' : 'time-outline'}
          size={22}
          color={currentTab === 'history' ? '#4F46E5' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'history' && styles.tabLabelActive]}>
          History
        </Text>
      </TouchableOpacity>

      {/* Floating Center Scanner Button */}
      <TouchableOpacity
        style={styles.floatingCenterBtn}
        onPress={() => onSelectTab('scanner')}
        activeOpacity={0.85}
      >
        <View style={styles.floatingInner}>
          <Ionicons name="qr-code" size={26} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('leave')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'leave' ? 'calendar' : 'calendar-outline'}
          size={22}
          color={currentTab === 'leave' ? '#4F46E5' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'leave' && styles.tabLabelActive]}>
          Leave
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('profile')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'profile' ? 'person' : 'person-outline'}
          size={22}
          color={currentTab === 'profile' ? '#4F46E5' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'profile' && styles.tabLabelActive]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  floatingCenterBtn: {
    top: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
