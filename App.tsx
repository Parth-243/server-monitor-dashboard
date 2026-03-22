import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, ViewStyle, TextStyle, Vibration, Image, ImageStyle, ActivityIndicator } from 'react-native';
import config from './src/config';

// ─── Constants (resolved from config — never hardcode here) ─────────────────
const { API_BASE, POLL_INTERVAL_MS, STORAGE_ALERT_THRESHOLD } = config;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServerData {
  system: {
    load: string;
    cpu_temp: string;
    active_users: number;
  };
  network: {
    sent_mbps: number;
    recv_mbps: number;
  };
  printer_hub: {
    status: string;
    message: string;
    ui_color: string;
  };
  storage: {
    [key: string]: { status?: string; temp?: string; percent?: number; free_gb?: number };
  };
  version: string;
  last_updated: string;
}

interface AppState {
  data: ServerData | null;
  error: string | null;
  isAlertActive: boolean;
  isStale: boolean;
  lastFetchTime: number | null;
  isFetching: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getTimeAgo(ts: number | null): string {
  if (!ts) return 'Just now';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  // Single unified state object → ONE re-render per fetch, zero flicker
  const [appState, setAppState] = useState<AppState>({
    data: null,
    error: null,
    isAlertActive: false,
    isStale: false,
    lastFetchTime: null,
    isFetching: false,
  });
  const [, setTick] = useState(0);
  const lastUpdatedChangeTimeRef = useRef<number>(Date.now());
  const prevLastUpdatedRef = useRef<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setAppState(prev => ({ ...prev, isFetching: true, error: null }));

    const fetchWithRetryAndTimeout = async (url: string, retries: number = 3, delay: number = 2000): Promise<ServerData> => {
      let lastError: any;
      for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(url, {
            headers: {
              'Connection': 'close',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`Server returned error: ${response.status}`);
          return await response.json();
        } catch (error: any) {
          clearTimeout(timeoutId);
          lastError = error;
          if (i < retries - 1) {
            await new Promise<void>(res => setTimeout(() => res(), delay));
          }
        }
      }
      throw lastError;
    };

    try {
      // Append cache-buster in the fetch URL
      const json = await fetchWithRetryAndTimeout(`${API_BASE}?t=${Date.now()}`);

      // Heartbeat check: Compare the last_updated string.
      if (prevLastUpdatedRef.current !== json.last_updated) {
        lastUpdatedChangeTimeRef.current = Date.now();
        prevLastUpdatedRef.current = json.last_updated;
      }
      // If last_updated changed recently, isStale is immediately false, hiding the 'No new updates' banner
      const isStale = (Date.now() - lastUpdatedChangeTimeRef.current) > 15000;

      // Check CPU Temperature alert logic for "Red Alert" (if value > 60°C)
      let triggerAlert = false;
      let parsedTemp = 0;
      if (json.system && json.system.cpu_temp) {
        const match = json.system.cpu_temp.match(/\d+/);
        parsedTemp = match ? parseInt(match[0], 10) : 0;
        if (parsedTemp > 60) {
           triggerAlert = true;
        }
      }
      if (triggerAlert) Vibration.vibrate([0, 500, 200, 500]);

      // ✅ ONE atomic state update → ONE re-render
      setAppState({
        data: json,
        error: null,
        isAlertActive: triggerAlert,
        isStale,
        lastFetchTime: Date.now(),
        isFetching: false,
      });

    } catch (err: any) {
      setAppState(prev => ({
        ...prev,
        error: err.name === 'AbortError' ? 'Network Request Failed (Timeout)' : (err instanceof Error ? err.message : String(err)),
        isFetching: false,
      }));
    }
  }, []); // ← empty deps, never changes

  // ── Initial load + auto-poll ───────────────────────────────────────────────
  useEffect(() => {
    fetchData(); // Fetch immediately on mount

    const poll = setInterval(() => fetchData(), POLL_INTERVAL_MS);
    return () => clearInterval(poll); // Cleanup on unmount
  }, [fetchData]);

  // ── Tick timer (updates "X mins ago" label without re-fetching) ────────────
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // ── Destructure for clean JSX ──────────────────────────────────────────────
  const { data, error, isAlertActive, isStale, lastFetchTime, isFetching } = appState;
  const timeAgoStr = getTimeAgo(lastFetchTime);

  const cpuTempString = data?.system?.cpu_temp || "0";
  const cpuTempMatch = cpuTempString.match(/\d+/);
  const cpuTempValue = cpuTempMatch ? parseInt(cpuTempMatch[0], 10) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, isAlertActive && { backgroundColor: '#FFDCE0' }]}>
      <StatusBar barStyle="dark-content" />

      {isAlertActive && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>🔥 HIGH CPU TEMP DETECTED 🔥</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.container}
      >
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <Image source={require('./assets/logo.png')} style={styles.logo} />
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.header}>Home Server Health</Text>
            {isFetching && <ActivityIndicator style={{ marginLeft: 15 }} size="small" color="#007BFF" />}
          </View>
        </View>

        {/* ── Stale data warning ── */}
        {isStale && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>ℹ️ No new updates from server yet</Text>
          </View>
        )}

        {/* ── Content ── */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : !data ? (
          <Text style={styles.loadingText}>Fetching Home Server Health...</Text>
        ) : (
          <>
            {/* System Health Card */}
            <View style={styles.card}>
              <Text style={styles.label}>SYSTEM REPORT</Text>
              <Text style={styles.value}>{data.system.load} Load</Text>
              <Text style={styles.subText}>{data.system.active_users} Active User{data.system.active_users !== 1 ? 's' : ''}</Text>
              <Text style={[
                styles.subText, 
                cpuTempValue > 60 ? { color: '#E53E3E', fontWeight: 'bold' } : {}
              ]}>
                🌡️ CPU Temp: {data.system.cpu_temp}
              </Text>
            </View>

            {/* Printer Hub Card */}
            {data.printer_hub && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: data.printer_hub.ui_color || '#CCC' }]}>
                <Text style={styles.label}>PRINTER HUB</Text>
                <Text style={[styles.value, { color: data.printer_hub.ui_color || '#1A1A1A' }]}>
                  {data.printer_hub.status}
                </Text>
                <Text style={styles.subText}>{data.printer_hub.message}</Text>
              </View>
            )}

            {/* Network Card */}
            <View style={styles.card}>
              <Text style={styles.label}>NETWORK I/O</Text>
              <View style={styles.row}>
                <Text style={styles.driveLabel}>Data Out 📤</Text>
                <Text style={styles.driveValue}>{data.network.sent_mbps} MB/s</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.driveLabel}>Data In 📥</Text>
                <Text style={styles.driveValue}>{data.network.recv_mbps} MB/s</Text>
              </View>
            </View>

            {/* Storage Card */}
            <View style={styles.card}>
              <Text style={styles.label}>STORAGE DEVICES</Text>
              {data.storage && Object.entries(data.storage).map(([driveName, info]) => {
                const isMainVault = driveName === 'HDD-2TB';
                return (
                  <View key={driveName} style={[styles.storageRow, isMainVault && styles.mainVaultStyle, { flexDirection: 'column' }]}>
                    <View style={styles.row}>
                      <Text style={[styles.driveLabel, isMainVault && { color: '#B8860B', fontWeight: '800' }]}>
                        {isMainVault ? '⭐ ' : ''}{driveName}
                      </Text>
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
                        {info.temp && <Text style={styles.percentText}>Temp: {info.temp}</Text>}
                        {info.status && <Text style={[styles.percentText, isMainVault && { color: '#B8860B' }]}>{info.status}</Text>}
                        <Text style={[styles.driveValue, isMainVault && { color: '#B8860B' }]}>{info.free_gb != null ? `${info.free_gb}GB Free` : ''}</Text>
                      </View>
                    </View>
                    
                    {info.percent != null && (
                      <>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.max(info.percent, 2)}%`,
                                backgroundColor: info.percent > STORAGE_ALERT_THRESHOLD ? '#E53E3E' : (isMainVault ? '#B8860B' : '#007BFF'),
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.percentText}>{info.percent}% Used</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Footer */}
            <Text style={styles.footer}>Server Sync: {data.last_updated} (v: {data.version})</Text>
            <Text style={styles.timeAgo}>Updated {timeAgoStr}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
interface DashboardStyles {
  safeArea: ViewStyle;
  container: ViewStyle;
  headerContainer: ViewStyle;
  logo: ImageStyle;
  header: TextStyle;
  card: ViewStyle;
  label: TextStyle;
  value: TextStyle;
  subText: TextStyle;
  row: ViewStyle;
  storageRow: ViewStyle;
  mainVaultStyle: ViewStyle;
  progressBar: ViewStyle;
  progressFill: ViewStyle;
  driveLabel: TextStyle;
  driveValue: TextStyle;
  alertText: TextStyle;
  errorBox: ViewStyle;
  errorText: TextStyle;
  loadingText: TextStyle;
  footer: TextStyle;
  timeAgo: TextStyle;
  percentText: TextStyle;
  emergencyBanner: ViewStyle;
  emergencyText: TextStyle;
  staleBanner: ViewStyle;
  staleText: TextStyle;
}

const styles = StyleSheet.create<DashboardStyles>({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { padding: 20 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  logo: { width: 40, height: 40, marginRight: 15, borderRadius: 8 },
  header: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', flexShrink: 1 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 20, elevation: 4 },
  label: { fontSize: 11, fontWeight: '800', color: '#6C757D', letterSpacing: 1.2, marginBottom: 10 },
  value: { fontSize: 22, fontWeight: 'bold', color: '#212529' },
  subText: { fontSize: 15, color: '#495057', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingVertical: 5 },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  mainVaultStyle: { backgroundColor: '#FFF8E7', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: -15, borderWidth: 1, borderColor: '#FFD700', elevation: 1 },
  progressBar: { height: 6, backgroundColor: '#E9ECEF', borderRadius: 3, marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 4 },
  driveLabel: { fontWeight: '600', color: '#495057', fontSize: 16 },
  driveValue: { color: '#007BFF', fontWeight: '700', fontSize: 16 },
  alertText: { fontSize: 14, color: '#E53E3E', marginTop: 10, fontWeight: '500', lineHeight: 20 },
  errorBox: { padding: 20, backgroundColor: '#FFF5F5', borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#E53E3E' },
  errorText: { color: '#C53030', fontWeight: 'bold' },
  loadingText: { textAlign: 'center', marginTop: 50, color: '#ADB5BD' },
  footer: { textAlign: 'center', color: '#CED4DA', fontSize: 11, marginTop: 10 },
  timeAgo: { textAlign: 'center', color: '#6C757D', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  percentText: { fontSize: 13, color: '#6C757D', marginTop: 5, textAlign: 'right' },
  emergencyBanner: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center' },
  emergencyText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  staleBanner: { backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFC107' },
  staleText: { color: '#856404', fontWeight: '600', fontSize: 13 },
});

export default App;