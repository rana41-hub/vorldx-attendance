import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [urlInput, setUrlInput] = useState(baseUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const validateUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return 'Backend URL cannot be empty';
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      return 'URL must start with http:// or https://';
    }
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname) {
        return 'URL must include a valid host address or IP';
      }
    } catch {
      return 'Invalid URL format (e.g., http://172.20.10.2:8000)';
    }
    return null;
  };

  const handleSelectPreset = (presetUrl: string) => {
    setUrlInput(presetUrl);
    setUrlError(null);
  };

  const handleSaveUrl = async () => {
    if (isReconnecting) return;

    const validationErr = validateUrl(urlInput);
    if (validationErr) {
      setUrlError(validationErr);
      showToast(validationErr, 'error');
      return;
    }

    setUrlError(null);
    setIsReconnecting(true);
    try {
      const cleanUrl = urlInput.trim().replace(/\/+$/, '');
      await updateBaseUrl(cleanUrl);
      showToast('Backend connection address updated & reconnected!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply backend URL', 'error');
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleLogoutPress = () => {
    if (isLoggingOut) return;
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your attendance session on this mobile device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
            }
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
          Choose your preferred interface theme. Selected theme persists across all application views.
        </Text>

        <View style={styles.themeSelector} accessibilityRole="radiogroup">
          <TouchableOpacity
            style={[
              styles.themeOption,
              {
                backgroundColor:
                  themeMode === 'light'
                    ? isDark
                      ? colors.surfaceElevated
                      : '#FFFFFF'
                    : colors.secondaryBackground,
                borderColor: themeMode === 'light' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setThemeMode('light')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: themeMode === 'light' }}
            accessibilityLabel="Light theme"
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
                backgroundColor:
                  themeMode === 'dark'
                    ? isDark
                      ? colors.surfaceElevated
                      : '#FFFFFF'
                    : colors.secondaryBackground,
                borderColor:
                  themeMode === 'dark' ? (isDark ? colors.accentCyan : colors.primary) : colors.border,
              },
            ]}
            onPress={() => setThemeMode('dark')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: themeMode === 'dark' }}
            accessibilityLabel="Dark Mode theme"
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
                  color:
                    themeMode === 'dark' ? (isDark ? colors.accentCyan : colors.primary) : colors.textSecondary,
                  fontWeight: themeMode === 'dark' ? '800' : '600',
                },
              ]}
            >
              Dark Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOption,
              {
                backgroundColor:
                  themeMode === 'system'
                    ? isDark
                      ? colors.surfaceElevated
                      : '#FFFFFF'
                    : colors.secondaryBackground,
                borderColor: themeMode === 'system' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setThemeMode('system')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: themeMode === 'system' }}
            accessibilityLabel="System theme"
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

      {/* Backend & Connectivity Section — Compact User View */}
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
          <Ionicons name="cloud-done-outline" size={18} color={isDark ? colors.accentCyan : colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Backend Connectivity</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          Connection status for real-time check-ins, attendance sync, and policy calculations.
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
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Service Health:</Text>
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

        {!isBackendOnline && (
          <View
            style={[
              styles.errorNoticeBox,
              {
                backgroundColor: colors.dangerBg,
                borderColor: isDark ? 'rgba(251, 113, 133, 0.4)' : '#FECACA',
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorNoticeText, { color: colors.danger }]}>
              Cannot reach the FastAPI backend server. Ensure the server is running on the local network, or open Advanced Diagnostics below to check the connection address.
            </Text>
          </View>
        )}

        {/* Advanced Diagnostics Entry Point */}
        <TouchableOpacity
          style={[
            styles.diagnosticsToggleBtn,
            {
              backgroundColor: isDark ? colors.surfaceElevated : colors.secondaryBackground,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowDiagnostics((prev) => !prev)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={showDiagnostics ? 'Hide Advanced Diagnostics' : 'Show Advanced Diagnostics'}
        >
          <View style={styles.diagnosticsToggleLeft}>
            <Ionicons
              name={showDiagnostics ? 'code-slash' : 'terminal-outline'}
              size={16}
              color={isDark ? colors.accentCyan : colors.primary}
            />
            <Text style={[styles.diagnosticsToggleText, { color: colors.textPrimary }]}>
              Advanced Diagnostics & Network Settings
            </Text>
          </View>
          <Ionicons
            name={showDiagnostics ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Collapsible Advanced Diagnostics View */}
        {showDiagnostics && (
          <View
            style={[
              styles.diagnosticsContainer,
              {
                backgroundColor: colors.secondaryBackground,
                borderColor: isDark ? colors.borderSubtle : colors.border,
              },
            ]}
          >
            <View style={styles.diagHeader}>
              <Text style={[styles.diagTitle, { color: isDark ? colors.accentCyan : colors.primary }]}>
                Developer Connection Configuration
              </Text>
              <Text style={[styles.diagSub, { color: colors.textSecondary }]}>
                Configure the FastAPI service base URL for local testing and debugging.
              </Text>
            </View>

            {/* Currently Active Endpoint Badge */}
            <View
              style={[
                styles.activeUrlBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.activeUrlKey, { color: colors.textMuted }]}>ACTIVE ENDPOINT:</Text>
              <Text style={[styles.activeUrlVal, { color: isDark ? colors.accentCyan : colors.primary }]}>
                {baseUrl}
              </Text>
            </View>

            {/* Service Base URL Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Service Base URL
              </Text>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: urlError ? colors.danger : colors.inputBorder,
                    color: colors.textPrimary,
                  },
                ]}
                value={urlInput}
                onChangeText={(text) => {
                  setUrlInput(text);
                  if (urlError) setUrlError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://172.20.10.2:8000"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Backend service base URL"
              />
              {urlError && (
                <Text style={[styles.validationErrorText, { color: colors.danger }]}>
                  {urlError}
                </Text>
              )}
            </View>

            {/* Network Address Presets */}
            <Text style={[styles.presetsTitle, { color: colors.textSecondary }]}>
              Supported Connection Presets
            </Text>
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[
                  styles.presetPill,
                  urlInput === 'http://172.20.10.2:8000' && {
                    borderColor: isDark ? colors.accentCyan : colors.primary,
                    borderWidth: 1.5,
                  },
                  {
                    backgroundColor: isDark ? colors.surfaceElevated : colors.primaryLight,
                  },
                ]}
                onPress={() => handleSelectPreset('http://172.20.10.2:8000')}
                activeOpacity={0.8}
                accessibilityLabel="Set Wi-Fi Hotspot preset"
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color: isDark ? colors.accentCyan : colors.primary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  ★ Wi-Fi/Hotspot (172.20.10.2)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetPill,
                  urlInput === 'http://127.0.0.1:8000' && {
                    borderColor: isDark ? colors.accentCyan : colors.primary,
                    borderWidth: 1.5,
                  },
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => handleSelectPreset('http://127.0.0.1:8000')}
                activeOpacity={0.8}
                accessibilityLabel="Set Localhost preset"
              >
                <Text style={[styles.presetText, { color: colors.textSecondary }]}>Localhost</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetPill,
                  urlInput === 'http://10.0.2.2:8000' && {
                    borderColor: isDark ? colors.accentCyan : colors.primary,
                    borderWidth: 1.5,
                  },
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => handleSelectPreset('http://10.0.2.2:8000')}
                activeOpacity={0.8}
                accessibilityLabel="Set Android Emulator preset"
              >
                <Text style={[styles.presetText, { color: colors.textSecondary }]}>
                  Android (10.0.2.2)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Save & Reconnect Action */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: colors.primary },
                isReconnecting && { opacity: 0.6 },
              ]}
              onPress={handleSaveUrl}
              activeOpacity={0.8}
              disabled={isReconnecting}
              accessibilityLabel="Save and reconnect to backend"
            >
              {isReconnecting ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Reconnecting...</Text>
                </View>
              ) : (
                <View style={styles.savingRow}>
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save & Reconnect</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Account & Application Info Card */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: colors.textSecondary }]}>App Version</Text>
          <Text style={[styles.infoVal, { color: colors.textPrimary }]}>1.0.0 (Expo SDK 57)</Text>
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
          isLoggingOut && { opacity: 0.5 },
        ]}
        onPress={handleLogoutPress}
        activeOpacity={0.8}
        disabled={isLoggingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out of attendance session"
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out from Device</Text>
          </>
        )}
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
    paddingBottom: 96,
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
    marginBottom: 12,
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
  errorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    fontWeight: '500',
  },
  diagnosticsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  diagnosticsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  diagnosticsToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diagnosticsContainer: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  diagHeader: {
    gap: 2,
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  diagSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  activeUrlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeUrlKey: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeUrlVal: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
  },
  inputContainer: {
    marginTop: 2,
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
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  validationErrorText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  presetsTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    paddingVertical: 4,
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
