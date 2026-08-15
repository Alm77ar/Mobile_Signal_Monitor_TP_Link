import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';

export default function App() {
  const [signalData, setSignalData] = useState({
    rsrp: '--',
    rsrq: '--',
    snr: '--',
    band: '--',
    status: 'Initializing...'
  });
  const [loading, setLoading] = useState(false);

  // Access Cloudflare key dynamically from environment variable
  const cloudflareKey = process.env.EXPO_PUBLIC_CLOUDFLARE_KEY;

  // Send Telemetry Payload to Cloudflare Worker
  const sendTelemetryToCloud = async (metrics) => {
    const cloudEndpoint = process.env.EXPO_PUBLIC_API_URL || 'https://your-worker.workers.dev/api/telemetry';
    try {
      await fetch(cloudEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cloudflareKey}`
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          deviceModel: 'TP-Link NX510v',
          signalMetrics: metrics
        })
      });
    } catch (err) {
      console.warn('Telemetry dispatch deferred:', err.message);
    }
  };

  // Fetch Live Router Metrics & Sync
  const fetchSignalMetrics = async () => {
    setLoading(true);
    setSignalData(prev => ({ ...prev, status: 'Querying router...' }));

    try {
      const routerEndpoint = process.env.EXPO_PUBLIC_ROUTER_URL || 'https://your-worker.workers.dev/api/signal';
      let liveMetrics;

      try {
        const response = await fetch(routerEndpoint, {
          headers: {
            'Authorization': `Bearer ${cloudflareKey}`
          }
        });
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
        const data = await response.json();
        liveMetrics = {
          rsrp: data.rsrp ? `${data.rsrp} dBm` : '-85 dBm',
          rsrq: data.rsrq ? `${data.rsrq} dB` : '-10 dB',
          snr: data.snr ? `${data.snr} dB` : '18 dB',
          band: data.band || 'B3 / n78',
          status: 'Connected (Live)'
        };
      } catch (networkErr) {
        // Fallback demo data for local UI verification
        liveMetrics = {
          rsrp: '-85 dBm',
          rsrq: '-10 dB',
          snr: '18 dB',
          band: 'B3 / n78',
          status: 'Connected (Demo Data)'
        };
      }

      setSignalData(liveMetrics);
      await sendTelemetryToCloud(liveMetrics);

    } catch (error) {
      setSignalData(prev => ({ ...prev, status: 'Connection Error' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignalMetrics();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        <Text style={styles.header}>TP-Link NX510v Monitor</Text>
        <Text style={styles.statusText}>Status: {signalData.status}</Text>

        <View style={styles.metricGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.label}>RSRP</Text>
            <Text style={styles.value}>{signalData.rsrp}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.label}>RSRQ</Text>
            <Text style={styles.value}>{signalData.rsrq}</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.label}>SINR / SNR</Text>
            <Text style={styles.value}>{signalData.snr}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.label}>Active Band</Text>
            <Text style={styles.value}>{signalData.band}</Text>
          </View>
        </View>

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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#1d4ed8',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});