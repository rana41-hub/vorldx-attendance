import React, { useState } from 'react';
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
import { useApp } from '../context/AppContext';
import { ApiService } from '../services/api';

interface ScannerScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onSuccess, onCancel }) => {
  const { currentEmployee, refreshTodayStatus, showToast } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('OFFICE_QR_MAIN_GATE');

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (isProcessing) return;
    const scannedData = result.data?.trim();
    if (!scannedData) return;

    await processCheckIn(scannedData);
  };

  const processCheckIn = async (sourceTag: string) => {
    if (!currentEmployee) {
      showToast('No active employee session found', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await ApiService.checkIn(currentEmployee.id, sourceTag);
      showToast(`Check-in verified via ${sourceTag}!`, 'success');
      await refreshTodayStatus();
      onSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed', 'error');
      setIsProcessing(false);
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="camera-outline" size={48} color="#4F46E5" />
        </View>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          To verify office presence, scan the physical QR code badge located at the office entrance.
        </Text>

        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>

        {/* Manual Fallback for Simulator / Testing */}
        <View style={styles.manualFallbackCard}>
          <Text style={styles.fallbackTitle}>Simulator / Test Fallback</Text>
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="e.g. OFFICE_QR_GATE"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={styles.manualSubmitBtn}
              onPress={() => processCheckIn(manualCode)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.manualSubmitText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      />

      {/* Top Header Overlay */}
      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.roundBtn} onPress={onCancel} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleBadge}>
          <Text style={styles.titleBadgeText}>Scan Office QR Code</Text>
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

      {/* Center Viewfinder Reticle */}
      <View style={styles.reticleContainer}>
        <View style={styles.reticleBox}>
          {/* Top-Left Corner */}
          <View style={[styles.corner, styles.cornerTL]} />
          {/* Top-Right Corner */}
          <View style={[styles.corner, styles.cornerTR]} />
          {/* Bottom-Left Corner */}
          <View style={[styles.corner, styles.cornerBL]} />
          {/* Bottom-Right Corner */}
          <View style={[styles.corner, styles.cornerBR]} />

          {isProcessing ? (
            <View style={styles.processingBadge}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.processingText}>Verifying QR...</Text>
            </View>
          ) : (
            <View style={styles.scanLine} />
          )}
        </View>
        <Text style={styles.helperText}>
          Align the QR code within the frame to record presence
        </Text>
      </View>

      {/* Bottom Testing Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quickSimRow}>
          <Text style={styles.quickSimLabel}>Quick Test Badges:</Text>
          <TouchableOpacity
            style={styles.quickSimPill}
            onPress={() => processCheckIn('OFFICE_QR_LOBBY')}
            disabled={isProcessing}
          >
            <Text style={styles.quickSimPillText}>Lobby QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickSimPill}
            onPress={() => processCheckIn('OFFICE_QR_DESK')}
            disabled={isProcessing}
          >
            <Text style={styles.quickSimPillText}>Desk QR</Text>
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
    width: 250,
    height: 250,
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    padding: 12,
  },
  quickSimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickSimLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  quickSimPill: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickSimPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
