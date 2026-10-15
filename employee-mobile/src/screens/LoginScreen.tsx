import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const LoginScreen: React.FC = () => {
  const { login, baseUrl, updateBaseUrl, isBackendOnline, showToast } = useApp();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server settings modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [customUrl, setCustomUrl] = useState(baseUrl);

  const handleLogin = async () => {
    setErrorMessage(null);
    const trimmedId = employeeId.trim();

    if (!trimmedId) {
      setErrorMessage('Please enter your unique Employee ID.');
      return;
    }

    if (trimmedId.includes('@')) {
      setErrorMessage('Please enter your Employee ID (e.g. VX-0101), not your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedId, password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setEmployeeId('VX-0101');
    setPassword('Employee@VorldX2026');
    setErrorMessage(null);
    showToast('Loaded Alex Vance (VX-0101) - Shift completed today', 'info');
  };

  const handleFillAlanDemo = () => {
    setEmployeeId('VX-B3FE66');
    setPassword('SecurePassword123');
    setErrorMessage(null);
    showToast('Loaded Alan Kay (VX-B3FE66) - Ready for Check-In', 'info');
  };

  const handleSaveServerUrl = async () => {
    if (!customUrl.trim()) return;
    await updateBaseUrl(customUrl.trim());
    setShowServerModal(false);
    showToast('Backend URL updated', 'success');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Server Connection Banner */}
        <TouchableOpacity
          style={[
            styles.connectionBanner,
            isBackendOnline ? styles.connOnline : styles.connOffline,
          ]}
          onPress={() => {
            setCustomUrl(baseUrl);
            setShowServerModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.connStatusRow}>
            <View style={styles.connBadge}>
              <View
                style={[
                  styles.serverDot,
                  { backgroundColor: isBackendOnline ? '#10B981' : '#EF4444' },
                ]}
              />
              <Text style={[styles.connStatusText, { color: isBackendOnline ? '#065F46' : '#991B1B' }]}>
                {isBackendOnline ? 'Server Online' : 'Server Offline'}
              </Text>
            </View>
            <View style={styles.connUrlBadge}>
              <Text style={styles.connUrlText} numberOfLines={1}>
                {baseUrl.replace(/^https?:\/\//, '')}
              </Text>
              <Ionicons name="settings-outline" size={14} color="#4F46E5" />
            </View>
          </View>
          {!isBackendOnline && (
            <Text style={styles.connHintText}>
              Tap to configure IP or ensure uvicorn runs with --host 0.0.0.0
            </Text>
          )}
        </TouchableOpacity>

        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="finger-print" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>VorldX Attendance</Text>
          <Text style={styles.brandSubtitle}>Employee Mobile Self-Service Portal</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>
            Enter your assigned Employee ID and password to access your attendance records.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Employee ID Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Employee ID</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. VX-0101"
                placeholderTextColor="#94A3B8"
                value={employeeId}
                onChangeText={(text) => {
                  setEmployeeId(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Sign In to Workspace</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Quick Demo Credentials */}
          <View style={styles.demoBox}>
            <View style={styles.demoHeader}>
              <Ionicons name="information-circle-outline" size={16} color="#4F46E5" />
              <Text style={styles.demoTitle}>Developer Test Accounts</Text>
            </View>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={handleFillDemo}
                activeOpacity={0.7}
              >
                <Text style={styles.demoBtnText}>Alex (Shift Done)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoBtn, styles.demoBtnGreen]}
                onPress={handleFillAlanDemo}
                activeOpacity={0.7}
              >
                <Text style={styles.demoBtnText}>Alan (Test Check-In)</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.demoText}>
              • <Text style={styles.demoBold}>Alex Vance (VX-0101)</Text>: Already checked in & out today.{'\n'}
              • <Text style={styles.demoBold}>Alan Kay (VX-B3FE66)</Text>: Not checked in today (tests Check-In).
            </Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Authorized VorldX personnel only. All access is logged and verified against organization attendance policies.
        </Text>
      </ScrollView>

      {/* Backend URL Configuration Modal */}
      <Modal visible={showServerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backend API Configuration</Text>
              <TouchableOpacity onPress={() => setShowServerModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Configure the API base URL to match your development host:
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.inputLabel}>Current Base URL</Text>
              <TextInput
                style={styles.modalInput}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetChip, styles.presetChipHighlight]}
                onPress={() => setCustomUrl('http://172.20.10.2:8000')}
              >
                <Text style={styles.presetChipHighlightText}>
                  ★ 172.20.10.2:8000 (Your Hotspot / Wi-Fi IP)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setCustomUrl('http://127.0.0.1:8000')}
              >
                <Text style={styles.presetChipText}>127.0.0.1:8000 (Localhost / Simulator)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setCustomUrl('http://10.0.2.2:8000')}
              >
                <Text style={styles.presetChipText}>10.0.2.2:8000 (Android Emulator)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveServerUrl}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveBtnText}>Save & Check Connection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 54,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  connectionBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  connOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  connOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  connStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connUrlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  connStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connUrlText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    maxWidth: 130,
  },
  connHintText: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 6,
    fontWeight: '500',
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 50,
    marginTop: 8,
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  demoBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  demoText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  demoBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  demoBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  demoBtnGreen: {
    backgroundColor: '#059669',
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  modalInputGroup: {
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  presetsRow: {
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  presetChipHighlight: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  presetChipHighlightText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  presetChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
