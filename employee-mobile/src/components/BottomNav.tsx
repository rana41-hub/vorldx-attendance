import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TabType = 'home' | 'history' | 'wfh' | 'leave' | 'profile' | 'scanner';

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

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('wfh')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'wfh' ? 'desktop' : 'desktop-outline'}
          size={22}
          color={currentTab === 'wfh' ? '#0D9488' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'wfh' && styles.tabLabelActiveWFH]}>
          WFH
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('leave')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={currentTab === 'leave' ? 'calendar' : 'calendar-outline'}
          size={22}
          color={currentTab === 'leave' ? '#D97706' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'leave' && styles.tabLabelActiveLeave]}>
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
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
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
    gap: 3,
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
  tabLabelActiveWFH: {
    color: '#0D9488',
    fontWeight: '700',
  },
  tabLabelActiveLeave: {
    color: '#D97706',
    fontWeight: '700',
  },
});
