import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, SafeAreaView, StatusBar, ViewStyle, TextStyle, Vibration, Image, ImageStyle } from 'react-native';
import config from './src/config';

// ─── Constants (resolved from config — never hardcode here) ─────────────────
const { API_BASE, POLL_INTERVAL_MS, STORAGE_ALERT_THRESHOLD } = config;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServerData {
  system: {
    load: string;
    active_users: number;
    user_list: string[];
  };
  storage: {
    [key: string]: { free_gb: number; percent: number };
  };
  printer: {
    status: string;
    alert: string;
  };
  last_updated: string;
}

interface AppState {
  data: ServerData | null;
  error: string | null;
  isAlertActive: boolean;
  isStale: boolean;
  lastFetchTime: number | null;
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
  });
  const [refreshing, setRefreshing] = useState(false);

  // Ticker for "X mins ago" — stored in ref so it never triggers a re-render
  const [, setTick] = useState(0);
  const prevLastUpdatedRef = useRef<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      // Append cache-buster only in the fetch URL string, not in component state
      const response = await fetch(`${API_BASE}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Server not responding');
      const json: ServerData = await response.json();

      // Check staleness using a ref — no extra state
      const isStale = isManualRefresh && prevLastUpdatedRef.current === json.last_updated;
      prevLastUpdatedRef.current = json.last_updated;

      // Check storage alert
      let triggerAlert = false;
      if (json.storage) {
        Object.values(json.storage).forEach(info => {
          if (info.percent > STORAGE_ALERT_THRESHOLD) triggerAlert = true;
        });
      }
      if (triggerAlert) Vibration.vibrate([0, 500, 200, 500]);

      // ✅ ONE atomic state update → ONE re-render
      setAppState({
        data: json,
        error: null,
        isAlertActive: triggerAlert,
        isStale,
        lastFetchTime: Date.now(),
      });

    } catch (err: any) {
      setAppState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
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

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  // ── Destructure for clean JSX ──────────────────────────────────────────────
  const { data, error, isAlertActive, isStale, lastFetchTime } = appState;
  const timeAgoStr = getTimeAgo(lastFetchTime);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, isAlertActive && { backgroundColor: '#FFDCE0' }]}>
      <StatusBar barStyle="dark-content" />

      {isAlertActive && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>⚠️ CRITICAL STORAGE ALERT ⚠️</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <Image source={require('./assets/logo.png')} style={styles.logo} />
          <Text style={styles.header}>Home Server Health</Text>
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
              <Text style={styles.label}>SYSTEM LOAD / USERS</Text>
              <Text style={styles.value}>{data.system.load} Load | {data.system.active_users} User(s)</Text>
              <Text style={styles.subText}>Active: {data.system.user_list.join(', ') || 'None'}</Text>
            </View>

            {/* Storage Card */}
            <View style={styles.card}>
              <Text style={styles.label}>STORAGE REPOSITORY</Text>
              {data.storage && Object.entries(data.storage).map(([driveName, info]) => (
                <View key={driveName} style={{ marginBottom: 18 }}>
                  <View style={styles.row}>
                    <Text style={styles.driveLabel}>{driveName}</Text>
                    <Text style={styles.driveValue}>{info.free_gb} GB Free</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(info.percent, 2)}%`,
                          backgroundColor: info.percent > STORAGE_ALERT_THRESHOLD ? '#E53E3E' : '#007BFF',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.percentText}>{info.percent}% Used</Text>
                </View>
              ))}
            </View>

            {/* Printer Card */}
            <View style={styles.card}>
              <Text style={styles.label}>HP 1020 PRINTER</Text>
              <Text style={[styles.value, { color: data.printer.status === 'READY' ? '#28A745' : '#FD7E14' }]}>
                {data.printer.status}
              </Text>
              <Text style={styles.alertText}>{data.printer.alert}</Text>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>Server Time: {data.last_updated}</Text>
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
  driveLabel: TextStyle;
  driveValue: TextStyle;
  progressBar: ViewStyle;
  progressFill: ViewStyle;
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
  label: { fontSize: 11, fontWeight: '800', color: '#6C757D', letterSpacing: 1.2, marginBottom: 5 },
  value: { fontSize: 22, fontWeight: 'bold', color: '#212529' },
  subText: { fontSize: 13, color: '#ADB5BD', marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  driveLabel: { fontWeight: '600', color: '#495057' },
  driveValue: { color: '#007BFF', fontWeight: '700' },
  progressBar: { height: 6, backgroundColor: '#E9ECEF', borderRadius: 3, marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  alertText: { fontSize: 14, color: '#E53E3E', marginTop: 10, fontWeight: '500', lineHeight: 20 },
  errorBox: { padding: 20, backgroundColor: '#FFF5F5', borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#E53E3E' },
  errorText: { color: '#C53030', fontWeight: 'bold' },
  loadingText: { textAlign: 'center', marginTop: 50, color: '#ADB5BD' },
  footer: { textAlign: 'center', color: '#CED4DA', fontSize: 11, marginTop: 10 },
  timeAgo: { textAlign: 'center', color: '#6C757D', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  percentText: { fontSize: 12, color: '#6C757D', marginTop: 5, textAlign: 'right' },
  emergencyBanner: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center' },
  emergencyText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  staleBanner: { backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFC107' },
  staleText: { color: '#856404', fontWeight: '600', fontSize: 13 },
});

export default App;