import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { ApiService } from '../services/api';
import type { AttendanceRecord } from '../types';
import { StatusBadge } from '../components/StatusBadge';

import { formatTime, formatDuration } from '../utils/formatters';

export const HistoryScreen: React.FC = () => {
  const { currentEmployee } = useApp();
  const { colors, isDark } = useTheme();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!currentEmployee) {
      setRecords([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await ApiService.getAttendance(currentEmployee.id);
      setRecords(data);
    } catch {
      // Keep previous
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentEmployee]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Foreground sync: reload history when returning to app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        fetchHistory();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.borderSubtle : colors.border,
          shadowColor: isDark ? colors.accentCyan : '#000000',
          shadowOpacity: isDark ? 0.08 : 0.03,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={isDark ? colors.accentCyan : colors.primary} />
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>{item.attendance_date}</Text>
        </View>
        <StatusBadge
          status={
            item.session_state === 'INCOMPLETE' || (item.check_out && item.status === 'HALF_DAY')
              ? 'INCOMPLETE'
              : item.session_state === 'IN_PROGRESS' || !item.check_out
              ? 'IN_PROGRESS'
              : item.status
          }
          size="sm"
        />
      </View>

      <View
        style={[
          styles.timesContainer,
          {
            backgroundColor: colors.secondaryBackground,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.timeCol}>
          <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Check-In</Text>
          <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(item.check_in)}</Text>
        </View>

        <View style={styles.divider}>
          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        </View>

        <View style={styles.timeCol}>
          <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Check-Out</Text>
          <Text style={[styles.timeValue, { color: colors.textPrimary }]}>
            {item.check_out ? formatTime(item.check_out) : 'Pending'}
          </Text>
        </View>

        <View
          style={[
            styles.durationBadge,
            {
              backgroundColor: isDark ? colors.surfaceElevated : colors.primaryLight,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <Text style={[styles.durationLabel, { color: isDark ? colors.accentCyan : colors.primary }]}>Total</Text>
          <Text style={[styles.durationValue, { color: isDark ? colors.accentCyan : colors.primary }]}>
            {formatDuration(item.check_in, item.check_out, false)}
          </Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.sourceText, { color: colors.textSecondary }]}>Source: {item.source || 'OFFICE_QR'}</Text>
        <Text style={[styles.logIdText, { color: colors.textMuted }]}>ID: #{item.id}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topInfo}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Attendance History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Verified timestamps and presence logs for {currentEmployee?.first_name || 'you'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondaryBackground }]}>
            <Ionicons name="documents-outline" size={36} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Attendance Records Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Scan the office QR code or trigger a check-in to generate your first audit log.
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 90,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  timesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 4,
  },
  timeCol: {
    flex: 1,
    minWidth: 55,
  },
  timeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  divider: {
    paddingHorizontal: 2,
  },
  durationBadge: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: 9,
    color: '#4F46E5',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  durationValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  sourceText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  logIdText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
