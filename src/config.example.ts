/**
 * HubWatch App Configuration — EXAMPLE FILE
 *
 * This file IS committed to GitHub. It contains NO real values.
 *
 * HOW TO SET UP:
 * 1. Copy this file: cp src/config.example.ts src/config.ts
 * 2. Open src/config.ts and fill in YOUR real values
 * 3. src/config.ts is gitignored — it will NEVER be pushed to GitHub
 */

const config = {
  /**
   * Local IP address of your home server.
   * Example: 'http://192.168.1.100:8000/hub_status.json'
   */
  API_BASE: 'http://YOUR_SERVER_IP:PORT/hub_status.json',

  /**
   * How often (in ms) the app polls for fresh data. Default: 30s.
   */
  POLL_INTERVAL_MS: 30000,

  /**
   * Storage % that triggers the critical alert + vibration.
   */
  STORAGE_ALERT_THRESHOLD: 90,
};

export default config;
