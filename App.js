import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  ActivityIndicator, 
  Modal, 
  TextInput,
  Dimensions,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Router Credentials State (Enforce HTTPS by default)
  const [routerUrl, setRouterUrl] = useState('https://192.168.1.1');
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState('');

  // Device & Geo-Location Metadata State
  const [deviceId, setDeviceId] = useState('unknown_device');
  const [geoData, setGeoData] = useState({
    ip: 'Offline/Unknown',
    city: 'Unknown',
    country: 'Unknown',
    isp: 'Unknown'
  });

  // Signal Metrics State
  const [lteBand, setLteBand] = useState('B3');
  const [nrBand, setNrBand] = useState('n78');
  const [statusMessage, setStatusMessage] = useState('Initializing...');

  const [metrics, setMetrics] = useState({
    RSRP: -85,
    SNR: 18.0,
    Signal: 80,
    RSRQ: -10,
    NR_SSRSRP: -95,
    NR_SSSINR: 12.0,
    NR_Signal: 72,
    NR_SSRSRQ: -12
  });

  const [stats, setStats] = useState({
    RSRP: { min: -110, max: -75 },
    SNR: { min: 4.0, max: 25.0 },
    Signal: { min: 45, max: 98 },
    RSRQ: { min: -18, max: -6 },
    NR_SSRSRP: { min: -118, max: -82 },
    NR_SSSINR: { min: 0.0, max: 22.0 },
    NR_Signal: { min: 35, max: 90 },
    NR_SSRSRQ: { min: -20, max: -8 }
  });

  // Environment variables
  const cloudflareWorkerUrl = process.env.EXPO_PUBLIC_API_URL;
  const secretAuthToken = process.env.EXPO_PUBLIC_CLOUDFLARE_KEY;

  useEffect(() => {
    loadSettings();
    initDeviceAndGeo();
  }, []);

  // Compute Stable SHA-256 Device Identifier
  const initDeviceAndGeo = async () => {
    try {
      let storedHash = await AsyncStorage.getItem('DEVICE_ID_HASH');
      if (!storedHash) {
        const rawNativeId = 
          Application.androidId || 
          (await Application.getIosIdForVendorAsync()) || 
          Math.random().toString(36).substring(2);
        
        const computedHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          String(rawNativeId)
        );
        storedHash = computedHash.substring(0, 16);
        await AsyncStorage.setItem('DEVICE_ID_HASH', storedHash);
      }
      setDeviceId(storedHash);
    } catch (e) {
      setDeviceId('unknown_device');
    }

    // Resolve Geo & IP Info via ip-api.com
    try {
      const response = await fetch('http://ip-api.com/json/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Mobile; Android)' }
      });
      const data = await response.json();
      if (data && data.status === 'success') {
        setGeoData({
          ip: data.query || 'Unknown',
          city: data.city || 'Unknown',
          country: data.country || 'Unknown',
          isp: data.isp || 'Unknown'
        });
      }
    } catch (err) {
      // Retain fallback values on network error
    }
  };

  // Dispatch Telemetry Payload to Cloudflare Worker
  const sendTelemetryToCloudflare = async () => {
    if (!cloudflareWorkerUrl || !secretAuthToken) {
      console.warn('Telemetry skipped: EXPO_PUBLIC_API_URL or EXPO_PUBLIC_CLOUDFLARE_KEY missing');
      return;
    }

    try {
      const { width, height } = Dimensions.get('screen');

      const payload = {
        app_id: 'tplink_signal_monitor_mobile',
        device_id: deviceId,
        last_seen: new Date().toISOString(),
        screen_resolution: `${Math.round(width)}x${Math.round(height)}`,
        os: {
          name: Platform.OS === 'android' ? 'Android' : 'iOS',
          release: Device.osVersion || String(Platform.Version),
          architecture: Platform.arch || Platform.OS
        },
        network: geoData,
        router_url_target: routerUrl,
        configured_refresh_rate: 1.5,
        metrics: {
          lte: {
            band: lteBand,
            rsrp: metrics.RSRP,
            snr: metrics.SNR,
            signal: metrics.Signal,
            rsrq: metrics.RSRQ
          },
          nr: {
            band: nrBand,
            nr_ssrsrp: metrics.NR_SSRSRP,
            nr_sssinr: metrics.NR_SSSINR,
            nr_signal: metrics.NR_Signal,
            nr_ssrsrq: metrics.NR_SSRSRQ
          }
        }
      };

      await fetch(cloudflareWorkerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telemetry-Auth': secretAuthToken
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Telemetry dispatch error:', err.message);
    }
  };

  // Load Saved Settings (Non-sensitive from AsyncStorage, Credentials from SecureStore)
  const loadSettings = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('ROUTER_URL');
      const savedUser = await AsyncStorage.getItem('ROUTER_USER_ID');
      const savedPass = await SecureStore.getItemAsync('ROUTER_PASSWORD');

      if (savedUrl) setRouterUrl(savedUrl);
      if (savedUser) setUserId(savedUser);
      if (savedPass) setPassword(savedPass);
    } catch (e) {
      console.warn('Failed to load secure settings:', e);
    }
  };

  // Save Settings Securely
  const saveSettings = async () => {
    try {
      // Validate HTTPS protocol on save
      if (!routerUrl.trim().toLowerCase().startsWith('https://')) {
        Alert.alert(
          'Security Constraint',
          'URL must begin with https:// to protect credentials over local networks.'
        );
        return;
      }

      await AsyncStorage.setItem('ROUTER_URL', routerUrl.trim());
      await AsyncStorage.setItem('ROUTER_USER_ID', userId.trim());

      // Store router password inside Hardware KeyStore / Keychain
      if (password) {
        await SecureStore.setItemAsync('ROUTER_PASSWORD', password, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED
        });
      }

      setModalVisible(false);
      fetchSignalMetrics();
    } catch (e) {
      Alert.alert('Error', 'Failed to securely store settings.');
    }
  };

  // Securely Fetch Router Metrics with HTTPS Enforcement
  const fetchSignalMetrics = async () => {
    let targetUrl = routerUrl.trim().replace(/\/$/, '');

    // HTTPS Protocol Enforcement Check
    if (!targetUrl.toLowerCase().startsWith('https://')) {
      Alert.alert(
        'Insecure Transport Blocked',
        'Plaintext HTTP traffic exposes passwords on local Wi-Fi. Please configure your endpoint using https://'
      );
      setStatusMessage('Blocked (Insecure Protocol)');
      return;
    }

    setLoading(true);
    setStatusMessage(`Querying ${targetUrl}...`);

    try {
      const response = await fetch(`${targetUrl}/api/signal`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ userId, password })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data) {
        if (data.lte_band) setLteBand(data.lte_band);
        if (data.nr_band) setNrBand(data.nr_band);
        
        setMetrics({
          RSRP: data.rsrp ?? -85,
          SNR: data.snr ?? 18.0,
          Signal: data.signal ?? 80,
          RSRQ: data.rsrq ?? -10,
          NR_SSRSRP: data.nr_ssrsrp ?? -95,
          NR_SSSINR: data.nr_sssinr ?? 12.0,
          NR_Signal: data.nr_signal ?? 72,
          NR_SSRSRQ: data.nr_sssrsq ?? -12
        });
      }
      setStatusMessage('Connected (Live & Encrypted)');
    } catch (error) {
      setStatusMessage('Connection Failed');
      Alert.alert('Network Error', 'Failed to retrieve signal metrics securely.');
    } finally {
      setLoading(false);
      sendTelemetryToCloudflare();
    }
  };

  const renderMetricRow = (label, key, isNR = false) => {
    const val = metrics[key];
    const minVal = stats[key]?.min ?? 'N/A';
    const maxVal = stats[key]?.max ?? 'N/A';

    return (
      <View key={key} style={styles.metricRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, isNR ? styles.nrText : styles.lteText]}>
          {val}
        </Text>
        <View style={styles.rangeBox}>
          <Text style={styles.rangeText}>MAX: {maxVal}</Text>
          <Text style={styles.rangeText}>MIN: {minVal}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header & Connection Status */}
        <Text style={styles.headerTitle}>=== SIGNAL MONITOR ===</Text>
        <Text style={styles.subHeader}>Status: {statusMessage}</Text>

        {/* Device Metadata Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>DEVICE & NETWORK METRICS</Text>
          <Text style={styles.infoText}>Device ID: {deviceId}</Text>
          <Text style={styles.infoText}>IP: {geoData.ip} ({geoData.city}, {geoData.country})</Text>
          <Text style={styles.infoText}>ISP: {geoData.isp}</Text>
        </View>

        {/* LTE Band & Metrics Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.lteSectionTitle}>
            --- LTE SECTION (Band: {lteBand}) ---
          </Text>
          {renderMetricRow('RSRP', 'RSRP')}
          {renderMetricRow('SNR', 'SNR')}
          {renderMetricRow('Signal', 'Signal')}
          {renderMetricRow('RSRQ', 'RSRQ')}
        </View>

        {/* NR 5G Band & Metrics Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.nrSectionTitle}>
            --- NR SECTION (Band: {nrBand}) ---
          </Text>
          {renderMetricRow('NR RSRP', 'NR_SSRSRP', true)}
          {renderMetricRow('NR SINR', 'NR_SSSINR', true)}
          {renderMetricRow('NR Signal', 'NR_Signal', true)}
          {renderMetricRow('NR RSRQ', 'NR_SSRSRQ', true)}
        </View>

        {/* Control Buttons */}
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={fetchSignalMetrics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Refresh & Sync Telemetry</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️ Secure Router Settings</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configure Router Endpoint</Text>

            <Text style={styles.inputLabel}>Router URL (HTTPS Enforced)</Text>
            <TextInput
              style={styles.input}
              value={routerUrl}
              onChangeText={setRouterUrl}
              placeholder="https://192.168.1.1"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.inputLabel}>User ID / Username</Text>
            <TextInput
              style={styles.input}
              value={userId}
              onChangeText={setUserId}
              placeholder="admin"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Router Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#64748b"
              secureTextEntry={true}
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
              <Text style={styles.buttonText}>Save Encrypted Configuration</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#38bdf8',
    textAlign: 'center',
    marginTop: 8,
  },
  subHeader: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  infoTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lteSectionTitle: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10,
  },
  nrSectionTitle: {
    color: '#4ade80',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  metricLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    width: 85,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 60,
  },
  lteText: {
    color: '#38bdf8',
  },
  nrText: {
    color: '#4ade80',
  },
  rangeBox: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  settingsButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#334155',
    color: '#ffffff',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  closeButtonText: {
    color: '#ef4444',
  },
});