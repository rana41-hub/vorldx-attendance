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
import type { AttendanceRecord, EmployeeDashboardData } from '../types';

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
    lateDays: 0,
    attendancePercentage: 100.0,
    totalRecords: 0,
    leaveCount: 0,
    wfhCount: 0,
  });
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Keep live time and working duration updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Kolkata',
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Kolkata',
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
    setIsLoadingStats(true);
    try {
      let dashData: EmployeeDashboardData | null = null;
      try {
        dashData = await ApiService.getDashboardData();
      } catch {
        // Fallback to direct records query if dashboard endpoint is unavailable
      }

      const [leavesRes, wfhRes, attFallback] = await Promise.allSettled([
        ApiService.getLeaveRequests(currentEmployee.id),
        ApiService.getWFHRequests(currentEmployee.id),
        dashData ? Promise.resolve([]) : ApiService.getAttendance(currentEmployee.id),
      ]);

      const leaves = leavesRes.status === 'fulfilled' ? leavesRes.value : [];
      const wfh = wfhRes.status === 'fulfilled' ? wfhRes.value : [];

      if (dashData) {
        setStats({
          presentDays: dashData.stats.present_days,
          lateDays: dashData.stats.late_days,
          attendancePercentage: dashData.stats.attendance_percentage,
          totalRecords: dashData.stats.total_records,
          leaveCount: leaves.filter((l) => l.status === 'PENDING').length,
          wfhCount: wfh.filter((w) => w.status === 'PENDING').length,
        });
        setRecentRecords(dashData.recent_records || []);
      } else {
        const att = attFallback.status === 'fulfilled' ? attFallback.value : [];
        const presentCnt = att.filter((r) => r.status === 'PRESENT' && (r.hours_worked ?? 8.0) >= 8.0).length;
        const lateCnt = att.filter((r) => r.status === 'LATE' && (r.hours_worked ?? 8.0) >= 8.0).length;
        const attendedCredits = presentCnt + lateCnt;
        const total = att.length;
        const pct = total > 0 ? Math.round((attendedCredits / total) * 1000) / 10 : 100.0;

        setStats({
          presentDays: presentCnt,
          lateDays: lateCnt,
          attendancePercentage: pct,
          totalRecords: total,
          leaveCount: leaves.filter((l) => l.status === 'PENDING').length,
          wfhCount: wfh.filter((w) => w.status === 'PENDING').length,
        });
        setRecentRecords(att.slice(0, 5));
      }
    } catch {
      // In offline mode or error, keep existing state
    } finally {
      isFetchingStatsRef.current = false;
      setIsLoadingStats(false);
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
            <StatusBadge
              status={
                todayRecord.session_state === 'INCOMPLETE' || (todayRecord.check_out && todayRecord.status === 'HALF_DAY')
                  ? 'INCOMPLETE'
                  : todayRecord.session_state === 'IN_PROGRESS' || !todayRecord.check_out
                  ? 'IN_PROGRESS'
                  : todayRecord.status
              }
            />
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
                  {todayRecord.check_out ? 'Concluded' : 'In Progress'}
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
                  Shift in progress ({liveDuration} elapsed). No full attendance credit until shift completion. Tap above when leaving.
                </Text>
              </View>
            ) : (() => {
              const inMs = new Date(todayRecord.check_in).getTime();
              const outMs = new Date(todayRecord.check_out).getTime();
              const hrsWorked = Math.max(0, (outMs - inMs) / (1000 * 3600));
              const isFullShift = todayRecord.session_state
                ? todayRecord.session_state === 'COMPLETED'
                : (hrsWorked >= 8.0 && todayRecord.status !== 'HALF_DAY');

              return isFullShift ? (
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
                      Both check-in ({formatTime(todayRecord.check_in)}) and check-out ({formatTime(todayRecord.check_out)}) are recorded. Full qualifying shift (8.0+ hrs) satisfied.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.completedContainer}>
                  <View style={[styles.completedNotice, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                    <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
                    <Text style={[styles.completedText, { color: '#B45309' }]}>
                      Incomplete Shift ({formatDuration(todayRecord.check_in, todayRecord.check_out)} total).
                    </Text>
                  </View>

                  {/* Incomplete Shift Banner */}
                  <View style={[styles.finalizedActionBar, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Ionicons name="time" size={16} color="#D97706" />
                    <Text style={[styles.finalizedActionText, { color: '#92400E' }]}>
                      Shift Ended Early ({hrsWorked.toFixed(1)} hrs elapsed)
                    </Text>
                  </View>

                  {/* Explanation text */}
                  <View style={styles.completedExplanation}>
                    <Text style={styles.completedExplanationText}>
                      Recorded check-in ({formatTime(todayRecord.check_in)}) and check-out ({formatTime(todayRecord.check_out)}). Did not satisfy 8.0-hour full attendance requirement (0 credit earned).
                    </Text>
                  </View>
                </View>
              );
            })()}
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
          <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
          </View>
          <Text style={styles.statVal}>{stats.presentDays}</Text>
          <Text style={styles.statTitle}>Present Days</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => onNavigateTab('history')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time-outline" size={18} color="#D97706" />
          </View>
          <Text style={styles.statVal}>{stats.lateDays}</Text>
          <Text style={styles.statTitle}>Late Arrivals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => onNavigateTab('history')}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="pie-chart-outline" size={18} color="#4F46E5" />
          </View>
          <Text style={styles.statVal}>
            {stats.totalRecords > 0 ? `${stats.attendancePercentage}%` : '100%'}
          </Text>
          <Text style={styles.statTitle}>Attendance Rate</Text>
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

      {/* Recent Attendance History (Requirement 8) */}
      <View style={styles.recentHeaderRow}>
        <Text style={styles.recentTitle}>Recent Attendance</Text>
        <TouchableOpacity onPress={() => onNavigateTab('history')} activeOpacity={0.7}>
          <Text style={styles.viewAllLink}>View All History</Text>
        </TouchableOpacity>
      </View>

      {recentRecords.length > 0 ? (
        <View style={styles.recentList}>
          {recentRecords.slice(0, 5).map((record) => (
            <View key={record.id} style={styles.recentCard}>
              <View style={styles.recentCardHeader}>
                <View style={styles.recentDateRow}>
                  <Ionicons name="calendar-outline" size={15} color="#6366F1" />
                  <Text style={styles.recentDateText}>{record.attendance_date}</Text>
                </View>
                <StatusBadge
                  status={
                    record.session_state === 'INCOMPLETE' || (record.check_out && record.status === 'HALF_DAY')
                      ? 'INCOMPLETE'
                      : record.session_state === 'IN_PROGRESS' || !record.check_out
                      ? 'IN_PROGRESS'
                      : record.status
                  }
                  size="sm"
                />
              </View>

              <View style={styles.recentDetailsRow}>
                <View style={styles.recentTimeBlock}>
                  <Ionicons name="time-outline" size={13} color="#64748B" />
                  <Text style={styles.recentTimeText}>
                    {formatTime(record.check_in)} → {record.check_out ? formatTime(record.check_out) : 'In Progress'}
                  </Text>
                </View>

                <View style={styles.recentDurationBadge}>
                  <Text style={styles.recentDurationText}>
                    {formatDuration(record.check_in, record.check_out, false)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyRecentCard}>
          <Ionicons name="document-text-outline" size={28} color="#94A3B8" />
          <Text style={styles.emptyRecentTitle}>No Recent Records Found</Text>
          <Text style={styles.emptyRecentSubtitle}>
            Check in or scan the office QR code to start building your verified presence record.
          </Text>
        </View>
      )}
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
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  recentList: {
    gap: 10,
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  recentDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentTimeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  recentDurationBadge: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  recentDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyRecentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptyRecentSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});
