# 🖥️ HubWatch — Home Server Health Dashboard

A **React Native** mobile app that gives you a real-time health dashboard for your home Server. Monitor system load, storage usage per drive, and printer status — all from your phone.

---

## 📱 Features

- **Live System Monitor** — Tracks CPU load and active user sessions
- **Per-Drive Storage Bars** — Visual progress bar with percentage for every drive
- **Printer Status** — Instant HP 1020 printer state (READY / ERROR)
- **Smart Auto-Refresh** — Polls the server every 30 seconds silently in background
- **Stale-Data Detection** — Notifies you if the server hasn't published new data yet (like IRCTC train tracking)
- **Critical Storage Alert** — Full-screen red banner + double-pulse vibration when any drive exceeds 90% usage
- **Flicker-Free UI** — State updates are batched into a single atomic re-render with zero screen flash

---

## 🏗️ Architecture

```
HubWatch/
├── App.tsx              # Main dashboard component (all logic + UI)
├── assets/
│   └── logo.png         # App logo (Home Server Health icon)
├── android/             # Android native project
└── index.js             # React Native entry point
```

The app fetches data from a JSON endpoint served by a lightweight Python script running on the home server:

```
GET http://<SERVER_IP>:8000/hub_status.json
```

**Expected JSON shape:**
```json
{
  "system": {
    "load": "0.45",
    "active_users": 1,
    "user_list": ["parth"]
  },
  "storage": {
    "C:\\": { "free_gb": 42.5, "percent": 60 },
    "D:\\": { "free_gb": 120.0, "percent": 35 }
  },
  "printer": {
    "status": "READY",
    "alert": ""
  },
  "last_updated": "2026-03-20 18:45:00"
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- React Native CLI environment set up ([guide](https://reactnative.dev/docs/set-up-your-environment))
- Android device or emulator

### 1. Install dependencies

```sh
npm install
```

### 2. Configure your server IP

Open `App.tsx` and update the `API_BASE` constant at the top of the file:

```ts
const API_BASE = 'http://YOUR_SERVER_IP:8000/hub_status.json';
```

### 3. Start the Metro bundler

```sh
npx react-native start
```

### 4. Run on Android

```sh
npx react-native run-android
```

---

## ⚙️ Configuration

All tuneable constants are at the top of `App.tsx`:

| Constant | Default | Description |
|---|---|---|
| `API_BASE` | `http://YOUR_SERVER_IP:8000/...` | Your server's JSON endpoint |
| `POLL_INTERVAL_MS` | `30000` | Auto-refresh interval (ms) |
| `STORAGE_ALERT_THRESHOLD` | `90` | % usage that triggers critical alert |

---

## 🔔 Permissions

| Permission | Reason |
|---|---|
| `INTERNET` | Fetch server health data |
| `VIBRATE` | Critical storage alert notification |

---

## 📄 License

MIT — for personal home lab use.
