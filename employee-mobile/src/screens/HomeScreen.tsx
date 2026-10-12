import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { ApiService } from '../services/api';

interface HomeScreenProps {
  onNavigateTab: (tab: 'scanner' | 'history' | 'leave' | 'profile') => void;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    presentDays: 0,
    leaveCount: 0,
  });

  // Keep live time updated
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
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch month stats
  useEffect(() => {
    const loadStats = async () => {
      if (!currentEmployee) return;
      try {
        const [att, leaves] = await Promise.all([
          ApiService.getAttendance(currentEmployee.id),
          ApiService.getLeaveRequests(currentEmployee.id),
        ]);
        setStats({
          presentDays: att.length,
          leaveCount: leaves.filter((l) => l.status === 'PENDING').length,
        });
      } catch {
        // Fallback
      }
    };
    loadStats();
  }, [currentEmployee, todayRecord]);

  const handleSimulateCheckIn = async (source: string = 'OFFICE_QR') => {
    if (!currentEmployee) {
      showToast('Select an employee first', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.checkIn(currentEmployee.id, source);
      showToast(`Check-in recorded successfully via ${source}!`, 'success');
      await refreshTodayStatus();
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
      showToast('Check-out logged successfully. Have a great day!', 'success');
      await refreshTodayStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-out failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeOnly = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const computeDuration = (inIso?: string, outIso?: string | null) => {
    if (!inIso) return '0 hrs';
    const start = new Date(inIso).getTime();
    const end = outIso ? new Date(outIso).getTime() : Date.now();
    const diffMin = Math.max(0, Math.floor((end - start) / 60000));
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
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
          onPress={refreshTodayStatus}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Main Today Attendance Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTag}>
            <Ionicons name="shield-checkmark" size={14} color="#4F46E5" />
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
                  {formatTimeOnly(todayRecord.check_in)}
                </Text>
                <Text style={styles.timeBlockSource}>{todayRecord.source}</Text>
              </View>

              <View style={styles.durationDivider}>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <Text style={styles.durationText}>
                  {computeDuration(todayRecord.check_in, todayRecord.check_out)}
                </Text>
              </View>

              <View style={styles.timeBlock}>
                <Text style={styles.timeBlockLabel}>CHECK OUT</Text>
                <Text style={styles.timeBlockValue}>
                  {formatTimeOnly(todayRecord.check_out)}
                </Text>
                <Text style={styles.timeBlockSource}>
                  {todayRecord.check_out ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>

            {!todayRecord.check_out ? (
              <TouchableOpacity
                style={[styles.checkoutBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleCheckOut}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.checkoutBtnText}>Record Check-Out</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.completedNotice}>
                <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                <Text style={styles.completedText}>
                  Office day marked complete for today.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.unmarkedBox}>
            <Text style={styles.unmarkedTitle}>Not Checked In Yet</Text>
            <Text style={styles.unmarkedSubtitle}>
              Scan the official office QR code at the entrance or run an instant check-in.
            </Text>

            <TouchableOpacity
              style={styles.scanHeroBtn}
              onPress={() => onNavigateTab('scanner')}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
              <Text style={styles.scanHeroBtnText}>Open QR Scanner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simulateBtn, isSubmitting && styles.btnDisabled]}
              onPress={() => handleSimulateCheckIn('OFFICE_QR_HQ')}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#4F46E5" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={16} color="#4F46E5" />
                  <Text style={styles.simulateBtnText}>
                    Quick Simulate HQ Check-In
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Overview Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="calendar-outline" size={20} color="#4F46E5" />
          </View>
          <Text style={styles.statVal}>{stats.presentDays}</Text>
          <Text style={styles.statTitle}>Days Logged</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time-outline" size={20} color="#D97706" />
          </View>
          <Text style={styles.statVal}>{stats.leaveCount}</Text>
          <Text style={styles.statTitle}>Pending Leaves</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: isBackendOnline ? '#ECFDF5' : '#FEF2F2' },
            ]}
          >
            <Ionicons
              name={isBackendOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={20}
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
          onPress={() => onNavigateTab('scanner')}
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
            <Ionicons name="document-text-outline" size={22} color="#D97706" />
          </View>
          <Text style={styles.actionLabel}>Apply Leave</Text>
          <Text style={styles.actionDesc}>Vacation / Sick</Text>
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

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => onNavigateTab('profile')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="settings-outline" size={22} color="#9333EA" />
          </View>
          <Text style={styles.actionLabel}>Config</Text>
          <Text style={styles.actionDesc}>API & Profile</Text>
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
    paddingBottom: 40,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
  unmarkedBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  unmarkedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  unmarkedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  scanHeroBtn: {
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
  scanHeroBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  simulateBtn: {
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
  simulateBtnText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
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
