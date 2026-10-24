import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile }) => {
  const { currentEmployee, isBackendOnline } = useApp();
  const { colors, isDark } = useTheme();

  const getInitials = () => {
    if (!currentEmployee) return 'VX';
    return `${currentEmployee.first_name[0] || ''}${currentEmployee.last_name[0] || ''}`.toUpperCase();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.navBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.left}
        onPress={onOpenProfile}
        activeOpacity={0.8}
        accessibilityLabel="View Profile"
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.primary,
              shadowColor: isDark ? colors.accentCyan : colors.primary,
            },
          ]}
        >
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>Hello, </Text>
            <Text
              style={[styles.name, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {currentEmployee ? currentEmployee.first_name : 'Team Member'}
            </Text>
          </View>
          <Text
            style={[styles.department, { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {currentEmployee
              ? `${currentEmployee.department} • ${currentEmployee.employee_code}`
              : 'Connecting...'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rightActions}>
        {/* Server Status Pill */}
        <TouchableOpacity
          style={[
            styles.statusPill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenProfile}
          activeOpacity={0.7}
          accessibilityLabel={`Backend Server status: ${isBackendOnline ? 'Online' : 'Offline'}`}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isBackendOnline ? colors.success : colors.danger },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {isBackendOnline ? 'Live' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '400',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  department: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 76,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 14,
    gap: 6,
    minHeight: 32,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

