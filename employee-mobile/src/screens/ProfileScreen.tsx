import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import type { Employee } from '../types';

export const ProfileScreen: React.FC = () => {
  const {
    currentEmployee,
    setCurrentEmployee,
    employees,
    baseUrl,
    updateBaseUrl,
    isBackendOnline,
    showToast,
  } = useApp();

  const [urlInput, setUrlInput] = useState(baseUrl);
  const [empModalVisible, setEmpModalVisible] = useState(false);

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      await updateBaseUrl(urlInput.trim());
      showToast('Backend URL updated successfully!', 'success');
    } catch {
      showToast('Failed to apply backend URL', 'error');
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setCurrentEmployee(emp);
    setEmpModalVisible(false);
    showToast(`Switched active profile to ${emp.first_name} ${emp.last_name}`, 'success');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {currentEmployee
              ? `${currentEmployee.first_name[0] || ''}${currentEmployee.last_name[0] || ''}`.toUpperCase()
              : 'VX'}
          </Text>
        </View>

        <Text style={styles.name}>
          {currentEmployee
            ? `${currentEmployee.first_name} ${currentEmployee.last_name}`
            : 'Unassigned'}
        </Text>
        <Text style={styles.designation}>
          {currentEmployee?.designation || 'Staff Member'}
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.deptBadge}>
            <Ionicons name="business-outline" size={12} color="#4F46E5" />
            <Text style={styles.deptBadgeText}>
              {currentEmployee?.department || 'General'}
            </Text>
          </View>
          <View style={styles.codeBadge}>
            <Ionicons name="card-outline" size={12} color="#475569" />
            <Text style={styles.codeBadgeText}>
              {currentEmployee?.employee_code || 'VX-0000'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.switchEmpBtn}
          onPress={() => setEmpModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal" size={16} color="#4F46E5" />
          <Text style={styles.switchEmpBtnText}>Switch Employee Account</Text>
        </TouchableOpacity>
      </View>

      {/* Backend & Server Configuration */}
      <View style={styles.configCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="server-outline" size={18} color="#4F46E5" />
          <Text style={styles.cardTitle}>Backend API Configuration</Text>
        </View>
        <Text style={styles.cardDesc}>
          Ensure this points to the FastAPI service running on your machine.
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Server Status:</Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isBackendOnline ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text
              style={[
                styles.statusValue,
                { color: isBackendOnline ? '#059669' : '#DC2626' },
              ]}
            >
              {isBackendOnline ? 'Connected & Healthy' : 'Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Service Base URL</Text>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Quick Presets */}
        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={styles.presetPill}
            onPress={() => setUrlInput('http://127.0.0.1:8000')}
          >
            <Text style={styles.presetText}>Localhost</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetPill}
            onPress={() => setUrlInput('http://10.0.2.2:8000')}
          >
            <Text style={styles.presetText}>Android (10.0.2.2)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveUrl}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save & Reconnect</Text>
        </TouchableOpacity>
      </View>

      {/* System Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>App Version</Text>
          <Text style={styles.infoVal}>1.0.0 (Expo SDK 57)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Database</Text>
          <Text style={styles.infoVal}>PostgreSQL 18</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Backend Framework</Text>
          <Text style={styles.infoVal}>FastAPI 0.135</Text>
        </View>
      </View>

      {/* Employee Switcher Modal */}
      <Modal visible={empModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Test Employee</Text>
              <TouchableOpacity onPress={() => setEmpModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={employees}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.empList}
              renderItem={({ item }) => {
                const isSelected = item.id === currentEmployee?.id;
                return (
                  <TouchableOpacity
                    style={[styles.empItem, isSelected && styles.empItemSelected]}
                    onPress={() => handleSelectEmployee(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.empAvatarSmall}>
                      <Text style={styles.empAvatarText}>
                        {`${item.first_name[0] || ''}${item.last_name[0] || ''}`.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.empItemInfo}>
                      <Text style={styles.empItemName}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Text style={styles.empItemSub}>
                        {item.department} • {item.employee_code}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  switchEmpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  switchEmpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
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
    maxHeight: '80%',
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
  empList: {
    gap: 8,
    paddingBottom: 30,
  },
  empItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  empItemSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  empAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  empItemInfo: {
    flex: 1,
  },
  empItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  empItemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
