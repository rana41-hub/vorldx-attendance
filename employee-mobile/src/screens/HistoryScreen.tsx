import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ApiService } from '../services/api';
import type { AttendanceRecord } from '../types';
import { StatusBadge } from '../components/StatusBadge';

import { formatTime, formatDuration } from '../utils/formatters';

export const HistoryScreen: React.FC = () => {
  const { currentEmployee } = useApp();
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color="#6366F1" />
          <Text style={styles.dateText}>{item.attendance_date}</Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.timesContainer}>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>Check-In</Text>
          <Text style={styles.timeValue}>{formatTime(item.check_in)}</Text>
        </View>

        <View style={styles.divider}>
          <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
        </View>

        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>Check-Out</Text>
          <Text style={styles.timeValue}>{item.check_out ? formatTime(item.check_out) : 'Pending'}</Text>
        </View>

        <View style={styles.durationBadge}>
          <Text style={styles.durationLabel}>Total</Text>
          <Text style={styles.durationValue}>
            {formatDuration(item.check_in, item.check_out, false)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.sourceText}>Source: {item.source || 'OFFICE_QR'}</Text>
        <Text style={styles.logIdText}>ID: #{item.id}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>
          Verified timestamps and presence logs for {currentEmployee?.first_name || 'you'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="documents-outline" size={36} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Attendance Records Found</Text>
          <Text style={styles.emptySubtitle}>
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
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
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
    padding: 12,
    marginBottom: 10,
  },
  timeCol: {
    minWidth: 70,
  },
  timeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  divider: {
    paddingHorizontal: 4,
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
