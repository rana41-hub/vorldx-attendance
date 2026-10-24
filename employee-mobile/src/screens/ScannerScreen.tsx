import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { ApiService } from '../services/api';
import { formatTime } from '../utils/formatters';

interface ScannerScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface KioskQRPayload {
  type: string;
  token: string;
  office?: string;
}

/**
 * Validate and extract security token from scanned QR data.
 * Supports official JSON payload {"type":"VORLDX_OFFICE_QR","token":"...","office":"..."}
 * and raw cryptographic token strings.
 */
const parseScannedQR = (
  rawData: string
): { valid: boolean; token?: string; error?: string } => {
  const trimmed = rawData.trim();
  if (!trimmed) {
    return { valid: false, error: 'Empty QR code scanned.' };
  }

  // 1. Check for structured JSON payload from official Admin Kiosk Display
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<KioskQRPayload>;
      if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Invalid QR payload structure.' };
      }
      if (parsed.type !== 'VORLDX_OFFICE_QR') {
        return {
          valid: false,
          error: 'Unrecognized QR code. Please scan an official VorldX Office Kiosk display.',
        };
      }
      if (!parsed.token || typeof parsed.token !== 'string' || !parsed.token.trim()) {
        return {
          valid: false,
          error: 'Corrupted QR code: Missing security token.',
        };
      }
      return { valid: true, token: parsed.token.trim() };
    } catch {
      return {
        valid: false,
        error: 'Malformed QR data format. Please scan the official office screen.',
      };
    }
  }

  // 2. Fallback: If it's a raw token string (e.g. from simulator manual input or raw token QR)
  if (trimmed.length >= 20 && !trimmed.includes(' ') && !trimmed.includes('\n')) {
    return { valid: true, token: trimmed };
  }

  return {
    valid: false,
    error: 'Invalid QR code. Please point camera at the official office display.',
  };
};

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onSuccess, onCancel }) => {
  const insets = useSafeAreaInsets();
  const { currentEmployee, todayRecord, refreshTodayStatus, showToast } = useApp();
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Synchronous mutual exclusion refs to prevent camera multi-frame race conditions
  const isProcessingRef = useRef(false);
  const hasSucceededRef = useRef(false);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (isProcessingRef.current || hasSucceededRef.current) return;
    const scannedData = result.data?.trim();
    if (!scannedData) return;

    await processCheckIn(scannedData);
  };

  const processCheckIn = async (scannedRaw: string) => {
    if (isProcessingRef.current || hasSucceededRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    if (!currentEmployee) {
      showToast('Authentication session missing. Please log in again.', 'error');
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    // Pre-check: If employee has already marked attendance for today
    if (todayRecord) {
      if (todayRecord.check_out) {
        showToast(
          `Attendance already finalized for ${currentEmployee.first_name} (${currentEmployee.employee_code}) today.`,
          'info'
        );
      } else {
        showToast(
          `Already checked in at ${formatTime(todayRecord.check_in)} for ${currentEmployee.first_name} (${currentEmployee.employee_code}). Tap "Record Check-Out" on Home when leaving.`,
          'info'
        );
      }
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 2000);
      return;
    }

    // 1. Client-side structural validation of the scanned payload
    const parsed = parseScannedQR(scannedRaw);
    if (!parsed.valid || !parsed.token) {
      showToast(parsed.error || 'Invalid QR code format.', 'error');
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 1500);
      return;
    }

    // 2. Submit to backend with authenticated employee credentials
    try {
      await ApiService.checkIn(currentEmployee.id, 'OFFICE_QR', parsed.token);
      hasSucceededRef.current = true;
      showToast('Check-in verified successfully via Office QR!', 'success');
      await refreshTodayStatus();
      onSuccess();
    } catch (err: unknown) {
      if (hasSucceededRef.current) {
        return;
      }

      const rawMsg = err instanceof Error ? err.message : 'Check-in failed';
      let userFriendlyMsg = rawMsg;

      const lower = rawMsg.toLowerCase();
      if (lower.includes('already exists') || lower.includes('409') || lower.includes('conflict')) {
        userFriendlyMsg = `Attendance record already exists today for ${currentEmployee?.first_name || 'this employee'} (${currentEmployee?.employee_code || ''}).`;
      } else if (lower.includes('expired')) {
        userFriendlyMsg = 'QR code has expired. Please scan the current code on the office display.';
      } else if (lower.includes('rotated') || lower.includes('revoked')) {
        userFriendlyMsg = 'QR code was recently refreshed. Please scan the latest code on the screen.';
      } else if (lower.includes('invalid qr') || lower.includes('invalid') || lower.includes('missing')) {
        userFriendlyMsg = 'Invalid QR code. Please scan the official VorldX office terminal.';
      } else if (
        lower.includes('401') ||
        lower.includes('unauthorized') ||
        lower.includes('authenticated') ||
        lower.includes('session')
      ) {
        userFriendlyMsg = 'Your login session has expired. Please log in again.';
      } else if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
        userFriendlyMsg = 'Network error. Please check your connection to the office server.';
      }

      showToast(userFriendlyMsg, 'error');

      // Re-enable scanning after 1.5s so employee can scan the updated code
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 1500);
    }
  };

  const toggleTorch = () => {
    setEnableTorch((prev) => !prev);
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Render permission request view
  if (!permission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Initializing camera...</Text>
      </View>
    );
  }

  if (!permission.granted || cameraError) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EEF2FF' },
          ]}
        >
          <Ionicons
            name={cameraError ? 'alert-circle-outline' : 'camera-outline'}
            size={48}
            color={cameraError ? colors.danger : colors.primary}
          />
        </View>
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
          {cameraError ? 'Camera Unavailable' : 'Camera Access Required'}
        </Text>
        <Text style={[styles.permissionSubtitle, { color: colors.textSecondary }]}>
          {cameraError
            ? `The camera could not be accessed (${cameraError}). You may use the fallback below to submit your dynamic office token.`
            : 'To verify office presence, scan the dynamic QR code displayed on the official office terminal screen.'}
        </Text>

        {!cameraError && (
          <TouchableOpacity
            style={[styles.grantBtn, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        )}

        {/* Manual Fallback for Simulator / Testing */}
        <View
          style={[
            styles.manualFallbackCard,
            {
              backgroundColor: colors.secondaryBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.fallbackTitle, { color: colors.textSecondary }]}>Simulator / Test Fallback</Text>
          <View style={styles.manualInputRow}>
            <TextInput
              style={[
                styles.manualInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                },
              ]}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Paste QR JSON or raw token"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.manualSubmitBtn, { backgroundColor: colors.primary }]}
              onPress={() => processCheckIn(manualCode)}
              disabled={isProcessing || !manualCode.trim()}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.manualSubmitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cornerColor = isDark ? '#22D3EE' : '#3B82F6';

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={enableTorch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
        onMountError={(error) => setCameraError(error.message)}
      />

      {/* Top Header Overlay */}
      <View style={[styles.topOverlay, { top: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity style={styles.roundBtn} onPress={onCancel} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleBadge}>
          <Text style={styles.titleBadgeText}>Scan Office Kiosk QR</Text>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={[styles.roundBtn, enableTorch && styles.roundBtnActive]}
            onPress={toggleTorch}
            activeOpacity={0.7}
          >
            <Ionicons
              name={enableTorch ? 'flash' : 'flash-outline'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundBtn} onPress={toggleFacing} activeOpacity={0.7}>
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Already Checked-In Status Banner */}
      {todayRecord && (
        <View style={[styles.todayNoticeBanner, { top: Math.max(insets.top, 16) + 64 }]}>
          <Ionicons name="information-circle" size={18} color="#60A5FA" />
          <Text style={styles.todayNoticeText}>
            {todayRecord.check_out
              ? `Attendance completed for ${currentEmployee?.first_name || 'today'} (${currentEmployee?.employee_code || ''}).`
              : `Already checked in at ${formatTime(todayRecord.check_in)} (${currentEmployee?.employee_code || ''}). Shift in progress.`}
          </Text>
        </View>
      )}

      {/* Center Viewfinder Reticle */}
      <View style={styles.reticleContainer}>
        <View style={styles.reticleBox}>
          {/* Top-Left Corner */}
          <View style={[styles.corner, styles.cornerTL, { borderColor: cornerColor }]} />
          {/* Top-Right Corner */}
          <View style={[styles.corner, styles.cornerTR, { borderColor: cornerColor }]} />
          {/* Bottom-Left Corner */}
          <View style={[styles.corner, styles.cornerBL, { borderColor: cornerColor }]} />
          {/* Bottom-Right Corner */}
          <View style={[styles.corner, styles.cornerBR, { borderColor: cornerColor }]} />

          {isProcessing ? (
            <View style={styles.processingBadge}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.processingText}>Verifying Dynamic QR...</Text>
            </View>
          ) : (
            <View
              style={[
                styles.scanLine,
                {
                  backgroundColor: cornerColor,
                  shadowColor: cornerColor,
                },
              ]}
            />
          )}
        </View>
        <Text style={styles.helperText}>
          Align the official Office Kiosk QR code within the frame
        </Text>
      </View>

      {/* Bottom Bar: Manual Input / Status */}
      <View
        style={[
          styles.bottomBar,
          {
            bottom: Math.max(insets.bottom, 16) + 10,
            backgroundColor: isDark ? 'rgba(7, 16, 32, 0.94)' : 'rgba(15, 23, 42, 0.88)',
            borderColor: isDark ? '#164E63' : 'transparent',
            borderWidth: isDark ? 1 : 0,
          },
        ]}
      >
        <View style={styles.bottomInputRow}>
          <TextInput
            style={[
              styles.bottomTextInput,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: isDark ? colors.border : '#E2E8F0',
                color: colors.textPrimary,
              },
            ]}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Paste Kiosk QR JSON or token..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.bottomVerifyBtn, { backgroundColor: colors.primary }]}
            onPress={() => processCheckIn(manualCode)}
            disabled={isProcessing || !manualCode.trim()}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.bottomVerifyText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  grantBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  manualFallbackCard: {
    marginTop: 28,
    width: '100%',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  manualSubmitBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelLink: {
    marginTop: 20,
  },
  cancelLinkText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  topOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  todayNoticeBanner: {
    position: 'absolute',
    top: 106,
    left: 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    zIndex: 10,
  },
  todayNoticeText: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnActive: {
    backgroundColor: '#F59E0B',
  },
  titleBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  titleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reticleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: '72%',
    maxWidth: 250,
    aspectRatio: 1,
    borderRadius: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#4F46E5',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingVertical: 6,
    borderRadius: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    padding: 10,
  },
  bottomInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  bottomVerifyBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomVerifyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
