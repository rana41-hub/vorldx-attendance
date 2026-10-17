import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { ApiService } from '../services/api';
import { formatTime, formatDuration } from '../utils/formatters';

interface HomeScreenProps {
  onNavigateTab: (tab: 'home' | 'scanner' | 'history' | 'leave' | 'wfh' | 'profile') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateTab }) => {
  const {
    currentEmployee,
    todayRecord,
    refreshTodayStatus,
    showToast,
    isBackendOnline,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [liveDuration, setLiveDuration] = useState<string>('0m');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    presentDays: 0,
    leaveCount: 0,
    wfhCount: 0,
  });

  // Keep live time and working duration updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDateStr(
        now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      );

      // If checked in and shift is in progress, update duration live
      if (todayRecord && !todayRecord.check_out) {
        setLiveDuration(formatDuration(todayRecord.check_in, null));
      } else if (todayRecord && todayRecord.check_out) {
        setLiveDuration(formatDuration(todayRecord.check_in, todayRecord.check_out));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const isFetchingStatsRef = useRef(false);

  // Fetch real employee stats (attendance days, pending leaves, pending WFH)
  const loadStats = useCallback(async () => {
    if (!currentEmployee || isFetchingStatsRef.current) return;
    isFetchingStatsRef.current = true;
    try {
      const [att, leaves, wfh] = await Promise.all([
        ApiService.getAttendance(currentEmployee.id),
        ApiService.getLeaveRequests(currentEmployee.id),
        ApiService.getWFHRequests(currentEmployee.id),
      ]);
      setStats({
        presentDays: att.length,
        leaveCount: leaves.filter((l) => l.status === 'PENDING').length,
        wfhCount: wfh.filter((w) => w.status === 'PENDING').length,
      });
    } catch {
      // In offline mode or error, keep existing state
    } finally {
      isFetchingStatsRef.current = false;
    }
  }, [currentEmployee]);

  useEffect(() => {
    loadStats();
  }, [loadStats, todayRecord]);

  // Foreground sync: update stats and attendance when user switches back into the app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshTodayStatus();
        loadStats();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [loadStats, refreshTodayStatus]);

  const handleQuickCheckIn = async (source: string = 'OFFICE_STATION') => {
    if (!currentEmployee) {
      showToast('No active employee session found', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.checkIn(currentEmployee.id, source);
      showToast(`Check-in recorded successfully via ${source}!`, 'success');
      await refreshTodayStatus();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentEmployee) return;
    setIsSubmitting(true);
    try {
      await ApiService.checkOut(currentEmployee.id);
      showToast('Check-out logged successfully. Shift completed!', 'success');
      await refreshTodayStatus();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-out failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickScanPress = () => {
    if (!todayRecord) {
      onNavigateTab('scanner');
    } else if (!todayRecord.check_out) {
      showToast('You are already checked in. Tap "Record Check-Out" when leaving.', 'info');
    } else {
      showToast('Your attendance has already been finalized for today.', 'info');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date & Time Widget */}
      <View style={styles.timeCard}>
        <View>
          <Text style={styles.dateLabel}>{currentDateStr}</Text>
          <Text style={styles.timeDisplay}>{currentTime}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            refreshTodayStatus();
            loadStats();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Main Today Attendance Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTag}>
            <Ionicons name="shield-checkmark" size={16} color="#4F46E5" />
            <Text style={styles.heroTagText}>Today's Presence</Text>
          </View>
          {todayRecord ? (
            <StatusBadge status={todayRecord.status} />
          ) : (
            <StatusBadge status="ABSENT" />
          )}
        </View>

        {todayRecord ? (
          <View style={styles.activeRecordBox}>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeBlockLabel}>CHECK IN</Text>
                <Text style={styles.timeBlockValue}>
                  {formatTime(todayRecord.check_in)}
                </Text>
                <Text style={styles.timeBlockSource}>{todayRecord.source}</Text>
              </View>

              <View style={styles.durationDivider}>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <Text style={styles.durationText}>
                  {liveDuration}
                </Text>
                <Text style={styles.durationSubText}>
                  {todayRecord.check_out ? 'Final' : 'Live'}
                </Text>
              </View>

              <View style={styles.timeBlock}>
                <Text style={styles.timeBlockLabel}>CHECK OUT</Text>
                <Text style={styles.timeBlockValue}>
                  {todayRecord.check_out ? formatTime(todayRecord.check_out) : '--:--'}
                </Text>
                <Text style={styles.timeBlockSource}>
                  {todayRecord.check_out ? 'Completed' : 'In Progress'}
                </Text>
              </View>
            </View>

            {/* Attendance Action Button Section */}
            {!todayRecord.check_out ? (
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.checkoutBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleCheckOut}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.checkoutBtnText}>Record Check-Out</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.actionHelperText}>
                  Shift in progress ({liveDuration} elapsed). Tap above when ending your workday.
                </Text>
              </View>
            ) : (
              <View style={styles.completedContainer}>
                <View style={styles.completedNotice}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                  <Text style={styles.completedText}>
                    Office day marked complete for today.
                  </Text>
                </View>

                {/* Finalized Action Banner */}
                <View style={styles.finalizedActionBar}>
                  <Ionicons name="lock-closed" size={16} color="#059669" />
                  <Text style={styles.finalizedActionText}>
                    Shift Finalized ({formatDuration(todayRecord.check_in, todayRecord.check_out)} total)
                  </Text>
                </View>

                {/* Explanation text */}
                <View style={styles.completedExplanation}>
                  <Text style={styles.completedExplanationText}>
                    Both check-in ({formatTime(todayRecord.check_in)}) and check-out ({formatTime(todayRecord.check_out)}) are recorded. Daily shift is complete. Next check-in opens tomorrow.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.unmarkedBox}>
            <Text style={styles.unmarkedTitle}>Not Checked In Today</Text>
            <Text style={styles.unmarkedSubtitle}>
              You have not recorded attendance yet today. Check in using the official QR code or workstation button below.
            </Text>

            {/* Primary Check-In Action Button */}
            <TouchableOpacity
              style={[styles.primaryCheckinBtn, isSubmitting && styles.btnDisabled]}
              onPress={() => onNavigateTab('scanner')}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
              <Text style={styles.primaryCheckinBtnText}>Check In (Scan Office QR)</Text>
            </TouchableOpacity>

            {/* Secondary Instant Station Check-In Button */}
            <TouchableOpacity
              style={[styles.secondaryCheckinBtn, isSubmitting && styles.btnDisabled]}
              onPress={() => handleQuickCheckIn('OFFICE_STATION')}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#4F46E5" size="small" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={16} color="#4F46E5" />
                  <Text style={styles.secondaryCheckinBtnText}>
                    Instant Station Check-In
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Overview Stats (4 Cards) */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => onNavigateTab('history')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="calendar-outline" size={18} color="#4F46E5" />
          </View>
          <Text style={styles.statVal}>{stats.presentDays}</Text>
          <Text style={styles.statTitle}>Days Logged</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => onNavigateTab('leave')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="airplane-outline" size={18} color="#D97706" />
          </View>
          <Text style={styles.statVal}>{stats.leaveCount}</Text>
          <Text style={styles.statTitle}>Pending Leaves</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => onNavigateTab('wfh')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: '#F0FDFA' }]}>
            <Ionicons name="home-outline" size={18} color="#0D9488" />
          </View>
          <Text style={styles.statVal}>{stats.wfhCount}</Text>
          <Text style={styles.statTitle}>Pending WFH</Text>
        </TouchableOpacity>

        <View style={styles.statCard}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: isBackendOnline ? '#ECFDF5' : '#FEF2F2' },
            ]}
          >
            <Ionicons
              name={isBackendOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={18}
              color={isBackendOnline ? '#059669' : '#DC2626'}
            />
          </View>
          <Text style={styles.statVal}>
            {isBackendOnline ? 'Online' : 'Offline'}
          </Text>
          <Text style={styles.statTitle}>Server Sync</Text>
        </View>
      </View>

      {/* Quick Action Shortcuts */}
      <Text style={styles.sectionHeader}>Quick Actions</Text>
      <View style={styles.shortcutsGrid}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleQuickScanPress}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="scan" size={22} color="#4F46E5" />
          </View>
          <Text style={styles.actionLabel}>Scan QR</Text>
          <Text style={styles.actionDesc}>Entrance gate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => onNavigateTab('leave')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="calendar-clear-outline" size={22} color="#D97706" />
          </View>
          <Text style={styles.actionLabel}>Apply Leave</Text>
          <Text style={styles.actionDesc}>Vacation / Sick</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => onNavigateTab('wfh')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#F0FDFA' }]}>
            <Ionicons name="desktop-outline" size={22} color="#0D9488" />
          </View>
          <Text style={styles.actionLabel}>Request WFH</Text>
          <Text style={styles.actionDesc}>Remote work days</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => onNavigateTab('history')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="list-outline" size={22} color="#16A34A" />
          </View>
          <Text style={styles.actionLabel}>Attendance</Text>
          <Text style={styles.actionDesc}>Past records</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 90,
  },
  timeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  timeDisplay: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeRecordBox: {
    marginTop: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  timeBlock: {
    alignItems: 'center',
    minWidth: 80,
  },
  timeBlockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  timeBlockValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeBlockSource: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  durationDivider: {
    alignItems: 'center',
    gap: 2,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  durationSubText: {
    fontSize: 9,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  actionContainer: {
    gap: 8,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  actionHelperText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  completedContainer: {
    gap: 8,
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedText: {
    color: '#065F46',
    fontWeight: '600',
    fontSize: 13,
  },
  finalizedActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  finalizedActionText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  completedExplanation: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  completedExplanationText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  unmarkedBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  unmarkedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  unmarkedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  primaryCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    width: '100%',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 10,
  },
  primaryCheckinBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryCheckinBtnText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
