import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { ApiService } from '../services/api';
import type { WFHRequest, WFHStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const WFHScreen: React.FC = () => {
  const { currentEmployee, user, showToast } = useApp();
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<WFHRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<WFHRequest[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | WFHStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal form state
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const fetchWFH = useCallback(async () => {
    if (!currentEmployee) {
      setRequests([]);
      setFilteredRequests([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await ApiService.getWFHRequests(currentEmployee.id);
      setRequests(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error loading WFH requests', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentEmployee, showToast]);

  useEffect(() => {
    fetchWFH();
  }, [fetchWFH]);

  // Foreground sync: reload WFH requests when returning to app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        fetchWFH();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [fetchWFH]);

  useEffect(() => {
    if (selectedFilter === 'ALL') {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter((r) => r.status === selectedFilter));
    }
  }, [requests, selectedFilter]);

  const openModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(tomorrow);
    setReason('');
    setModalVisible(true);
  };

  const setPresetDays = (days: number) => {
    const start = new Date();
    const end = new Date(Date.now() + days * 86400000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!currentEmployee) return;
    if (!startDate || !endDate || !reason.trim()) {
      showToast('Please specify start date, end date, and reason', 'error');
      return;
    }

    if (reason.trim().length < 3) {
      showToast('Reason must be at least 3 characters', 'error');
      return;
    }

    if (endDate < startDate) {
      showToast('End date cannot be earlier than start date', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ApiService.submitWFHRequest({
        employee_id: currentEmployee.id,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        reason: reason.trim(),
      });
      showToast('Work-from-Home request submitted successfully!', 'success');
      setModalVisible(false);
      fetchWFH();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: WFHRequest }) => (
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
        <View style={styles.periodRow}>
          <Ionicons name="home-outline" size={16} color={isDark ? colors.accentCyan : '#0D9488'} />
          <Text style={[styles.periodText, { color: colors.textPrimary }]}>
            {item.start_date} → {item.end_date}
          </Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{item.reason}</Text>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.footerDateCol}>
          <Text style={[styles.footerDate, { color: colors.textMuted }]}>
            Submitted {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.reviewed_at && (
            <Text style={[styles.decisionDate, { color: isDark ? colors.accentCyan : colors.success }]}>
              Decision: {item.status.charAt(0) + item.status.slice(1).toLowerCase()} on {new Date(item.reviewed_at).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Text style={[styles.reqId, { color: colors.textMuted }]}>WFH #{item.id}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Banner & Apply Action */}
      <View style={styles.topInfo}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Work from Home</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Remote work applications and approval history</Text>
        </View>
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: colors.primary }]}
          onPress={openModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.applyBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* Policy & Eligibility Card */}
      <View
        style={[
          styles.eligibilityCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.borderSubtle : '#CCFBF1',
            shadowColor: isDark ? colors.accentCyan : '#0D9488',
          },
        ]}
      >
        <View style={styles.eligibilityHeader}>
          <View style={styles.policyRow}>
            <Ionicons name="shield-checkmark" size={16} color={isDark ? colors.accentCyan : '#0D9488'} />
            <Text style={[styles.eligibilityTitle, { color: isDark ? colors.accentCyan : '#0F766E' }]}>
              Remote Work Policy & Status
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              user?.is_active !== false && currentEmployee
                ? { backgroundColor: colors.successBg }
                : { backgroundColor: colors.dangerBg },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: user?.is_active !== false && currentEmployee ? colors.success : colors.danger },
              ]}
            >
              {user?.is_active !== false && currentEmployee ? 'Eligible' : 'Ineligible'}
            </Text>
          </View>
        </View>

        <Text style={[styles.eligibilityDescription, { color: colors.textSecondary }]}>
          Active employees are eligible for remote work authorization. Approved requests authorize remote status; daily check-in is still required through the app.
        </Text>

        <View
          style={[
            styles.statCounters,
            { backgroundColor: colors.secondaryBackground },
          ]}
        >
          <View style={styles.counterItem}>
            <Text style={[styles.counterVal, { color: colors.success }]}>
              {requests.filter((r) => r.status === 'APPROVED').length}
            </Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.counterDivider, { backgroundColor: colors.border }]} />
          <View style={styles.counterItem}>
            <Text style={[styles.counterVal, { color: colors.warning }]}>
              {requests.filter((r) => r.status === 'PENDING').length}
            </Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.counterDivider, { backgroundColor: colors.border }]} />
          <View style={styles.counterItem}>
            <Text style={[styles.counterVal, { color: colors.danger }]}>
              {requests.filter((r) => r.status === 'REJECTED').length}
            </Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>Rejected</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => {
          const isActive = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondaryBackground }]}>
            <Ionicons name="desktop-outline" size={36} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No WFH Requests Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {selectedFilter === 'ALL'
              ? 'Tap "Request" above to submit a new Work-from-Home application.'
              : `You have no ${selectedFilter.toLowerCase()} WFH requests.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchWFH();
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Keyboard-Aware Apply WFH Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Request Remote Work</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Date Presets Row */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isDark ? colors.surfaceElevated : '#CCFBF1',
                      borderColor: colors.border,
                      borderWidth: isDark ? 1 : 0,
                    },
                  ]}
                  onPress={() => setPresetDays(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, { color: isDark ? colors.accentCyan : '#0F766E' }]}>Tomorrow (1d)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isDark ? colors.surfaceElevated : '#CCFBF1',
                      borderColor: colors.border,
                      borderWidth: isDark ? 1 : 0,
                    },
                  ]}
                  onPress={() => setPresetDays(2)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, { color: isDark ? colors.accentCyan : '#0F766E' }]}>2 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isDark ? colors.surfaceElevated : '#CCFBF1',
                      borderColor: colors.border,
                      borderWidth: isDark ? 1 : 0,
                    },
                  ]}
                  onPress={() => setPresetDays(5)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, { color: isDark ? colors.accentCyan : '#0F766E' }]}>Full Week (5d)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-10-16"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-10-17"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Reason / Project Focus</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Describe your remote focus or reason (e.g. Focus sprint, architecture design)..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.secondaryBackground }]}
                  onPress={() => setModalVisible(false)}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    { backgroundColor: colors.primary },
                    isSubmitting && styles.btnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit WFH Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
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
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  eligibilityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eligibilityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeEligible: {
    backgroundColor: '#D1FAE5',
  },
  badgeIneligible: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextEligible: {
    color: '#065F46',
  },
  badgeTextIneligible: {
    color: '#991B1B',
  },
  eligibilityDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 12,
  },
  statCounters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  counterItem: {
    alignItems: 'center',
    flex: 1,
  },
  counterVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F766E',
  },
  counterLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  counterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CCFBF1',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#115E59',
    lineHeight: 16,
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    paddingTop: 4,
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
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  reasonText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 6,
  },
  footerDateCol: {
    flexDirection: 'column',
    gap: 2,
  },
  footerDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  decisionDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  reqId: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: '#CCFBF1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
