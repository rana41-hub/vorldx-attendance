import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export type TabType = 'home' | 'history' | 'wfh' | 'leave' | 'profile' | 'scanner';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);
  const containerHeight = 56 + bottomInset;

  return (
    <View
      style={[
        styles.container,
        {
          height: containerHeight,
          paddingBottom: bottomInset,
          backgroundColor: colors.navBackground,
          borderTopColor: colors.border,
          shadowColor: isDark ? colors.accentCyan : '#000000',
          shadowOpacity: isDark ? 0.08 : 0.04,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('home')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Home tab"
        accessibilityState={{ selected: currentTab === 'home' }}
      >
        <Ionicons
          name={currentTab === 'home' ? 'home' : 'home-outline'}
          size={22}
          color={currentTab === 'home' ? colors.primary : colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: currentTab === 'home' ? colors.primary : colors.textMuted },
            currentTab === 'home' && styles.tabLabelActive,
          ]}
        >
          Home
        </Text>
        {currentTab === 'home' && (
          <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('history')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="History tab"
        accessibilityState={{ selected: currentTab === 'history' }}
      >
        <Ionicons
          name={currentTab === 'history' ? 'time' : 'time-outline'}
          size={22}
          color={currentTab === 'history' ? colors.primary : colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: currentTab === 'history' ? colors.primary : colors.textMuted },
            currentTab === 'history' && styles.tabLabelActive,
          ]}
        >
          History
        </Text>
        {currentTab === 'history' && (
          <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('wfh')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Work From Home tab"
        accessibilityState={{ selected: currentTab === 'wfh' }}
      >
        <Ionicons
          name={currentTab === 'wfh' ? 'desktop' : 'desktop-outline'}
          size={22}
          color={currentTab === 'wfh' ? colors.accentCyan : colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: currentTab === 'wfh' ? colors.accentCyan : colors.textMuted },
            currentTab === 'wfh' && styles.tabLabelActive,
          ]}
        >
          WFH
        </Text>
        {currentTab === 'wfh' && (
          <View style={[styles.activeDot, { backgroundColor: colors.accentCyan }]} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('leave')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Leave management tab"
        accessibilityState={{ selected: currentTab === 'leave' }}
      >
        <Ionicons
          name={currentTab === 'leave' ? 'calendar' : 'calendar-outline'}
          size={22}
          color={currentTab === 'leave' ? colors.warning : colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: currentTab === 'leave' ? colors.warning : colors.textMuted },
            currentTab === 'leave' && styles.tabLabelActive,
          ]}
        >
          Leave
        </Text>
        {currentTab === 'leave' && (
          <View style={[styles.activeDot, { backgroundColor: colors.warning }]} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('profile')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Profile and settings tab"
        accessibilityState={{ selected: currentTab === 'profile' }}
      >
        <Ionicons
          name={currentTab === 'profile' ? 'person' : 'person-outline'}
          size={22}
          color={currentTab === 'profile' ? colors.accentViolet : colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: currentTab === 'profile' ? colors.accentViolet : colors.textMuted },
            currentTab === 'profile' && styles.tabLabelActive,
          ]}
        >
          Profile
        </Text>
        {currentTab === 'profile' && (
          <View style={[styles.activeDot, { backgroundColor: colors.accentViolet }]} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});

