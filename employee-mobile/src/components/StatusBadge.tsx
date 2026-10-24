import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { isDark } = useTheme();
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'PRESENT':
      case 'APPROVED':
        return {
          bg: isDark ? 'rgba(52, 211, 153, 0.14)' : '#ECFDF5',
          border: isDark ? 'rgba(52, 211, 153, 0.4)' : '#A7F3D0',
          text: isDark ? '#34D399' : '#065F46',
          label: normalized === 'PRESENT' ? 'Present' : 'Approved',
        };
      case 'LATE':
        return {
          bg: isDark ? 'rgba(251, 191, 36, 0.14)' : '#FFFBEB',
          border: isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A',
          text: isDark ? '#FBBF24' : '#92400E',
          label: 'Late',
        };
      case 'HALF_DAY':
        return {
          bg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
          border: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
          text: isDark ? '#60A5FA' : '#1E40AF',
          label: 'Half Day',
        };
      case 'IN_PROGRESS':
        return {
          bg: isDark ? 'rgba(34, 211, 238, 0.14)' : '#EEF2FF',
          border: isDark ? 'rgba(34, 211, 238, 0.4)' : '#C7D2FE',
          text: isDark ? '#22D3EE' : '#4338CA',
          label: 'In Progress',
        };
      case 'INCOMPLETE':
        return {
          bg: isDark ? 'rgba(251, 191, 36, 0.14)' : '#FEF3C7',
          border: isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A',
          text: isDark ? '#FBBF24' : '#B45309',
          label: 'Incomplete',
        };
      case 'PENDING':
        return {
          bg: isDark ? 'rgba(251, 191, 36, 0.14)' : '#FEF3C7',
          border: isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A',
          text: isDark ? '#FBBF24' : '#B45309',
          label: 'Pending',
        };
      case 'REJECTED':
      case 'ABSENT':
        return {
          bg: isDark ? 'rgba(251, 113, 133, 0.14)' : '#FEF2F2',
          border: isDark ? 'rgba(251, 113, 133, 0.4)' : '#FECACA',
          text: isDark ? '#FB7185' : '#991B1B',
          label: normalized === 'REJECTED' ? 'Rejected' : 'Absent',
        };
      default:
        return {
          bg: isDark ? 'rgba(126, 147, 181, 0.12)' : '#F3F4F6',
          border: isDark ? '#203653' : '#E5E7EB',
          text: isDark ? '#A9BCD8' : '#374151',
          label: status,
        };
    }
  };

  const styleConfig = getStyle();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 10,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: styleConfig.text }]} />
      <Text
        style={[
          styles.text,
          {
            color: styleConfig.text,
            fontSize: isSm ? 10 : 12,
          },
        ]}
      >
        {styleConfig.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
