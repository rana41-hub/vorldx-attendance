import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile }) => {
  const { currentEmployee, isBackendOnline } = useApp();

  const getInitials = () => {
    if (!currentEmployee) return 'VX';
    return `${currentEmployee.first_name[0] || ''}${currentEmployee.last_name[0] || ''}`.toUpperCase();
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        <View>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Hello, </Text>
            <Text style={styles.name}>
              {currentEmployee ? currentEmployee.first_name : 'Team Member'}
            </Text>
          </View>
          <Text style={styles.department}>
            {currentEmployee
              ? `${currentEmployee.department} • ${currentEmployee.employee_code}`
              : 'Connecting...'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.statusPill}
        onPress={onOpenProfile}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isBackendOnline ? '#10B981' : '#EF4444' },
          ]}
        />
        <Text style={styles.statusText}>
          {isBackendOnline ? 'Live' : 'Offline'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '400',
  },
  name: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },
  department: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
});
