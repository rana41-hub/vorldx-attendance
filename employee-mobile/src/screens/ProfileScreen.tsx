import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export const ProfileScreen: React.FC = () => {
  const {
    currentEmployee,
    user,
    baseUrl,
    updateBaseUrl,
    isBackendOnline,
    showToast,
    logout,
  } = useApp();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const [urlInput, setUrlInput] = useState(baseUrl);

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      await updateBaseUrl(urlInput.trim());
      showToast('Backend URL updated successfully!', 'success');
    } catch {
      showToast('Failed to apply backend URL', 'error');
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your session on this mobile device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!currentEmployee) return 'VX';
    return `${currentEmployee.first_name[0] || ''}${currentEmployee.last_name[0] || ''}`.toUpperCase();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.borderSubtle : colors.border,
            shadowColor: isDark ? colors.accentCyan : '#000000',
            shadowOpacity: isDark ? 0.08 : 0.04,
          },
        ]}
      >
        <View
          style={[
            styles.avatarLarge,
            {
              backgroundColor: colors.primary,
              shadowColor: isDark ? colors.accentCyan : colors.primary,
            },
          ]}
        >
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>

        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {currentEmployee
            ? `${currentEmployee.first_name} ${currentEmployee.last_name}`
            : user?.full_name || 'Employee'}
        </Text>
        <Text style={[styles.designation, { color: colors.textSecondary }]}>
          {currentEmployee?.designation || 'Staff Member'}
        </Text>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.deptBadge,
              {
                backgroundColor: isDark ? colors.surfaceElevated : colors.primaryLight,
                borderColor: colors.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Ionicons name="business-outline" size={12} color={isDark ? colors.accentCyan : colors.primary} />
            <Text style={[styles.deptBadgeText, { color: isDark ? colors.accentCyan : colors.primary }]}>
              {currentEmployee?.department || 'General'}
            </Text>
          </View>
          <View
            style={[
              styles.codeBadge,
              {
                backgroundColor: colors.secondaryBackground,
                borderColor: colors.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Ionicons name="card-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.codeBadgeText, { color: colors.textSecondary }]}>
              {currentEmployee?.employee_code || user?.employee_code || 'VX-0000'}
            </Text>
          </View>
        </View>

        {/* Account Details Box */}
        <View
          style={[
            styles.detailsBox,
            {
              backgroundColor: colors.secondaryBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.detailItem}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Email Address</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {user?.email || 'Not available'}
            </Text>
          </View>
          {currentEmployee?.phone && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Contact Phone</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{currentEmployee.phone}</Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Account Status</Text>
            <View
              style={[
                styles.activePill,
                {
                  backgroundColor: colors.successBg,
                  borderColor: isDark ? 'rgba(52, 211, 153, 0.4)' : '#A7F3D0',
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.activeText, { color: colors.success }]}>Active & Verified</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Theme & Appearance Configuration Card */}
      <View
        style={[
          styles.configCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.borderSubtle : colors.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="color-palette-outline" size={18} color={isDark ? colors.accentCyan : colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Appearance & Theme</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          Choose your preferred interface theme. Deep Cyberpunk features electric-blue and cyan accents.
        </Text>

        <View style={styles.themeSelector}>
          <TouchableOpacity
            style={[
              styles.themeOption,
              {
                backgroundColor: themeMode === 'light' ? (isDark ? colors.surfaceElevated : '#FFFFFF') : colors.secondaryBackground,
                borderColor: themeMode === 'light' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setThemeMode('light')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="sunny-outline"
              size={18}
              color={themeMode === 'light' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.themeOptionText,
                {
                  color: themeMode === 'light' ? colors.primary : colors.textSecondary,
                  fontWeight: themeMode === 'light' ? '800' : '600',
                },
              ]}
            >
              Light
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOption,
              {
                backgroundColor: themeMode === 'dark' ? (isDark ? colors.surfaceElevated : '#FFFFFF') : colors.secondaryBackground,
                borderColor: themeMode === 'dark' ? (isDark ? colors.accentCyan : colors.primary) : colors.border,
              },
            ]}
            onPress={() => setThemeMode('dark')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="moon-outline"
              size={18}
              color={themeMode === 'dark' ? (isDark ? colors.accentCyan : colors.primary) : colors.textMuted}
            />
            <Text
              style={[
                styles.themeOptionText,
                {
                  color: themeMode === 'dark' ? (isDark ? colors.accentCyan : colors.primary) : colors.textSecondary,
                  fontWeight: themeMode === 'dark' ? '800' : '600',
                },
              ]}
            >
              Cyberpunk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOption,
              {
                backgroundColor: themeMode === 'system' ? (isDark ? colors.surfaceElevated : '#FFFFFF') : colors.secondaryBackground,
                borderColor: themeMode === 'system' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setThemeMode('system')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={themeMode === 'system' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.themeOptionText,
                {
                  color: themeMode === 'system' ? colors.primary : colors.textSecondary,
                  fontWeight: themeMode === 'system' ? '800' : '600',
                },
              ]}
            >
              System
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Backend & Server Configuration */}
      <View
        style={[
          styles.configCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.borderSubtle : colors.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="server-outline" size={18} color={isDark ? colors.accentCyan : colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Backend API Configuration</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          Ensure this points to the FastAPI service running on your machine or network.
        </Text>

        <View
          style={[
            styles.statusRow,
            {
              backgroundColor: colors.secondaryBackground,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Server Connection:</Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isBackendOnline ? colors.success : colors.danger },
              ]}
            />
            <Text
              style={[
                styles.statusValue,
                { color: isBackendOnline ? colors.success : colors.danger },
              ]}
            >
              {isBackendOnline ? 'Connected & Healthy' : 'Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Service Base URL</Text>
          <TextInput
            style={[
              styles.urlInput,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              },
            ]}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Quick Presets */}
        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={[
              styles.presetPill,
              {
                backgroundColor: isDark ? colors.surfaceElevated : colors.primaryLight,
                borderWidth: 1,
                borderColor: isDark ? colors.accentCyan : colors.primary,
              },
            ]}
            onPress={() => setUrlInput('http://172.20.10.2:8000')}
          >
            <Text style={[styles.presetText, { color: isDark ? colors.accentCyan : colors.primary, fontWeight: '700' }]}>
              ★ Wi-Fi/Hotspot (172.20.10.2)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetPill, { backgroundColor: colors.secondaryBackground }]}
            onPress={() => setUrlInput('http://127.0.0.1:8000')}
          >
            <Text style={[styles.presetText, { color: colors.textSecondary }]}>Localhost</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetPill, { backgroundColor: colors.secondaryBackground }]}
            onPress={() => setUrlInput('http://10.0.2.2:8000')}
          >
            <Text style={[styles.presetText, { color: colors.textSecondary }]}>Android (10.0.2.2)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSaveUrl}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save & Reconnect</Text>
        </TouchableOpacity>
      </View>

      {/* System Info */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoKey, { color: colors.textSecondary }]}>App Version</Text>
          <Text style={[styles.infoVal, { color: colors.textPrimary }]}>1.0.0 (Expo SDK 57)</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Session Role</Text>
          <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.role || 'EMPLOYEE'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Active Theme</Text>
          <Text style={[styles.infoVal, { color: isDark ? colors.accentCyan : colors.primary }]}>
            {themeMode === 'system' ? `System (${isDark ? 'Dark' : 'Light'})` : themeMode === 'dark' ? 'Deep Cyberpunk' : 'Light'}
          </Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={[
          styles.logoutBtn,
          {
            backgroundColor: colors.dangerBg,
            borderColor: isDark ? 'rgba(251, 113, 133, 0.4)' : '#FECACA',
          },
        ]}
        onPress={handleLogoutPress}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out from Device</Text>
      </TouchableOpacity>
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
    gap: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  designation: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  deptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  statusLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  urlInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  presetText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoKey: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
