import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (!toastMessage) return null;

  const getTheme = () => {
    switch (toastMessage.type) {
      case 'success':
        return {
          bg: isDark ? '#0C1930' : '#10B981',
          border: isDark ? colors.success : 'transparent',
          textColor: isDark ? colors.textPrimary : '#FFFFFF',
          iconColor: isDark ? colors.success : '#FFFFFF',
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          bg: isDark ? '#0C1930' : '#EF4444',
          border: isDark ? colors.danger : 'transparent',
          textColor: isDark ? colors.textPrimary : '#FFFFFF',
          iconColor: isDark ? colors.danger : '#FFFFFF',
          icon: 'alert-circle' as const,
        };
      default:
        return {
          bg: isDark ? '#0C1930' : '#4F46E5',
          border: isDark ? colors.accentCyan : 'transparent',
          textColor: isDark ? colors.textPrimary : '#FFFFFF',
          iconColor: isDark ? colors.accentCyan : '#FFFFFF',
          icon: 'information-circle' as const,
        };
    }
  };

  const theme = getTheme();
  const topPosition = Math.max(insets.top + 10, 16);

  return (
    <View
      style={[
        styles.container,
        {
          top: topPosition,
          backgroundColor: theme.bg,
          borderColor: theme.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <Ionicons name={theme.icon} size={20} color={theme.iconColor} />
      <Text style={[styles.text, { color: theme.textColor }]} numberOfLines={2}>
        {toastMessage.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 9,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
});

