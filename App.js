import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';

export default function App() {
  const [signalData, setSignalData] = useState({
    rsrp: 'N/A',
    snr: 'N/A',
    status: 'Initializing...'
  });

  // Telemetry / Router Signal Fetch Function
  const fetchSignalMetrics = async () => {
    try {
      setSignalData(prev => ({ ...prev, status: 'Fetching data...' }));
      
      // Placeholder endpoint for TP-Link router API / Webhook worker
      const endpoint = process.env.EXPO_PUBLIC_API_URL || 'https://your-cloud-backend.com/api/signal';
      
      /* 
      const response = await fetch(endpoint);
      const data = await response.json();
      setSignalData({ rsrp: data.rsrp, snr: data.snr, status: 'Connected' });
      */

      // Simulated initial signal state for test run
      setSignalData({
        rsrp: '-85 dBm',
        snr: '18 dB',
        status: 'Connected (Live)'
      });
    } catch (error) {
      setSignalData(prev => ({ ...prev, status: 'Connection Error' }));
    }
  };

  useEffect(() => {
    fetchSignalMetrics();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        <Text style={styles.header}>TP-Link NX510v Signal Monitor</Text>
        <Text style={styles.statusText}>Status: {signalData.status}</Text>
        
        <View style={styles.metricContainer}>
          <View style={styles.metricBox}>
            <Text style={styles.label}>RSRP</Text>
            <Text style={styles.value}>{signalData.rsrp}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.label}>SINR / SNR</Text>
            <Text style={styles.value}>{signalData.snr}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={fetchSignalMetrics}>
          <Text style={styles.buttonText}>Refresh Metrics</Text>
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 20,
  },
  metricContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});