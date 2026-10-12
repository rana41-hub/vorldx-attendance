import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  const getTheme = () => {
    switch (toastMessage.type) {
      case 'success':
        return {
          bg: '#10B981',
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          bg: '#EF4444',
          icon: 'alert-circle' as const,
        };
      default:
        return {
          bg: '#4F46E5',
          icon: 'information-circle' as const,
        };
    }
  };

  const theme = getTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Ionicons name={theme.icon} size={20} color="#FFFFFF" />
      <Text style={styles.text} numberOfLines={2}>
        {toastMessage.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
});
