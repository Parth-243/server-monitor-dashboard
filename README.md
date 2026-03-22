# 🖥️ HubWatch — Home Server Health Dashboard

This project is a **mobile application** developed using modern frameworks such as **React Native** and **TypeScript**. The application is designed to **monitor the overall health of a personal home server**.

---

## 🏗️ Project Background

The server is a **self-built personal server** created using an old Dell laptop with the following specifications:

* **Processor:** Intel i3 (dual-core)
* **OS Drive:** 250 GB internal SSD
* **Internal Storage:** 1 TB internal HDD
* **External Storage:** 2 TB external desktop SATA HDD

Additionally, an old **HP LaserJet 1020 printer** has been converted into a **wireless printer** using this server. The server is connected to a home router via an **Ethernet cable** and runs **24/7**, which makes continuous monitoring essential.

---

## 📱 Application Features

The mobile app monitors and displays the following real-time server metrics:

* **CPU Usage & Temperature**
* **Number of Active Users**
* **Printer Status** (Ready, Busy, Waiting, or Offline)
* **Network I/O** (Data in / Data out speeds)
* **Storage Details**, including:
  * OS Drive (SSD 250 GB)
  * Internal HDD (1 TB)
  * External HDD (2 TB) with specific **temperature monitoring**

> **Note:** The external 2 TB HDD is a desktop SATA drive that requires external power, which may cause it to run at higher temperatures.

### Backend Infrastructure

The application relies on **FastAPI** on the backend to fetch and serve real-time hardware data. All metrics are automatically updated every **5 seconds**. The app uses robust network mechanisms—including automatic connection retries, cache-busting, and strict 5-second timeouts—to handle local WiFi instability seamlessly.

---

## 📸 Media

![Dashboard View 1](./assets/Screenshot%202026-03-22%20204813.png)
![Dashboard View 2](./assets/Screenshot%202026-03-23%20033749.png)
![Dashboard View 3](./assets/Screenshot%202026-03-23%20033821.png)

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- React Native CLI environment set up
- Android device or emulator

### 1. Install dependencies

```sh
npm install
```

### 2. Configure your server IP

First, create your private configuration file from the provided template:
```sh
# On Windows
copy src\config.example.ts src\config.ts

# On Mac/Linux
cp src/config.example.ts src/config.ts
```

Next, open `src/config.ts` and update the `API_BASE` constant. *(Note: `config.ts` is intentionally gitignored to prevent exposing your local home server IP to version control).*

```ts
const config = {
  API_BASE: 'http://192.168.X.X:8000/hub_v3.json',
  ...
};
```

### 3. Run the App

Start the Metro bundler and deploy to your Android device/emulator:

```sh
npm start
npm run android
```

---

## ⚙️ Configuration

Tuneable constants located in `src/config.ts`:

| Constant | Description |
|---|---|
| `API_BASE` | Your server's JSON endpoint (`http://YOUR_SERVER_IP:8000/hub_v3.json`) |
| `POLL_INTERVAL_MS` | Auto-refresh interval (ms) |
| `STORAGE_ALERT_THRESHOLD` | % usage that triggers a critical vibration alert |

---

## ✉️ Contact & Additional Information

For more details about the home-built server setup or the mobile app, contact:
📧 [parthShrivastava7019@gmail.com](mailto:parthShrivastava7019@gmail.com)
