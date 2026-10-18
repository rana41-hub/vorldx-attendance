import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'PRESENT':
      case 'APPROVED':
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          text: '#065F46',
          label: normalized === 'PRESENT' ? 'Present' : 'Approved',
        };
      case 'LATE':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          text: '#92400E',
          label: 'Late',
        };
      case 'HALF_DAY':
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#1E40AF',
          label: 'Half Day',
        };
      case 'IN_PROGRESS':
        return {
          bg: '#EEF2FF',
          border: '#C7D2FE',
          text: '#4338CA',
          label: 'In Progress',
        };
      case 'INCOMPLETE':
        return {
          bg: '#FEF3C7',
          border: '#FDE68A',
          text: '#B45309',
          label: 'Incomplete',
        };
      case 'PENDING':
        return {
          bg: '#FEF3C7',
          border: '#FDE68A',
          text: '#B45309',
          label: 'Pending',
        };
      case 'REJECTED':
      case 'ABSENT':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          text: '#991B1B',
          label: normalized === 'REJECTED' ? 'Rejected' : 'Absent',
        };
      default:
        return {
          bg: '#F3F4F6',
          border: '#E5E7EB',
          text: '#374151',
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
