# VorldX Employee Mobile Application

React Native (Expo SDK 57) mobile self-service portal for the VorldX Employee Attendance Management System.

---

## 1. Architectural Overview

The employee mobile application allows organization personnel to securely authenticate, track presence, view attendance audit logs, submit leave applications, request remote work (WFH), and manage their profile.

- **Framework**: React Native 0.86 with Expo SDK 57 & TypeScript
- **Styling**: Native StyleSheet styling adhering to VorldX corporate theme
- **Security & Storage**: JWT Bearer token authentication stored via `@react-native-async-storage/async-storage`
- **Backend Integration**: Communicates directly with the FastAPI REST API (`/api/v1`)
- **Isolation**: Automatic role and identity scoping enforced by the backend (`/auth/me`, `/attendance`, `/leave`, `/wfh`)

---

## 2. Prerequisites & Setup

Ensure the FastAPI backend service is running locally before starting the mobile app:

```powershell
cd c:\Users\Rana\vorldx-attendance\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **Note**: Binding to `--host 0.0.0.0` allows connections from Android emulators and physical devices across your local network.

---

## 3. Network Configuration & Device Addressing

The app contains an in-app **Backend API Configuration** modal reachable from the login screen and the Profile tab:

| Environment | Base URL | Note |
|---|---|---|
| **iOS Simulator / Web** | `http://127.0.0.1:8000` | Local loopback to development host |
| **Android Emulator** | `http://10.0.2.2:8000` | Standard Android emulator alias for host machine |
| **Physical Mobile Device** | `http://<LOCAL_IP>:8000` | e.g. `http://192.168.1.100:8000` (ensure device is on same Wi-Fi) |

The selected URL is cached locally under `@vorldx_api_base_url`.

---

## 4. Running the Mobile Application

Install dependencies (if not already installed) and launch the Expo development server:

```powershell
cd c:\Users\Rana\vorldx-attendance\employee-mobile
npm install
npm run start
```

Target-specific launch shortcuts:

```powershell
npm run android    # Launch on connected Android device/emulator
npm run ios        # Launch on iOS simulator (macOS required)
npm run web        # Preview in browser
```

---

## 5. Employee Authentication

- **Identifier**: Unique assigned **Employee ID** (e.g. `VX-0101`). Email addresses are strictly rejected at the form and API level to ensure separation of identity and credentials.
- **Role Enforcement**: Only users with the `EMPLOYEE` role can access the mobile portal. Administrator credentials (`ADM-001`) are rejected with an explicit prompt to use the VorldX Admin Web portal.
- **Session Restoration**: On launch, the app verifies the cached JWT token with `GET /api/v1/auth/me`. Expired or invalid tokens automatically clear the session and return to the login screen.

### Verified Test Credentials

| Parameter | Value |
|---|---|
| **Employee ID** | `VX-0101` |
| **Password** | `Employee@VorldX2026` |
| **Employee Name** | Alex Vance |
| **Department** | Engineering |
| **Designation** | Lead Systems Architect |

*(A "Use Demo Credentials" button is provided on the login screen for rapid developer testing)*

---

## 6. Implemented Feature Modules

1. **Dashboard & Presence Management (`HomeScreen.tsx`)**:
   - Real-time time clock and calendar display.
   - Today's presence summary card: check-in time, check-out time, elapsed shift duration, and attendance status (`PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`).
   - One-tap check-out button logging `POST /api/v1/attendance/check-out`.
   - Real-time KPI counters: Days Logged, Pending Leaves, Pending WFH, and live server sync probe.

2. **Attendance History (`HistoryScreen.tsx`)**:
   - Chronological log of employee check-ins and check-outs with duration and source verification tags.
   - Pull-to-refresh data sync.

3. **Work-from-Home (WFH) Management (`WFHScreen.tsx`)**:
   - Dedicated remote work request submission modal with start date, end date, and reason validation.
   - Status filters (`ALL`, `PENDING`, `APPROVED`, `REJECTED`).
   - Policy notice informing employees that approved WFH authorizes remote work but still requires daily attendance check-in.

4. **Time Off & Leave Requests (`LeaveScreen.tsx`)**:
   - Dynamic leave balance / request counter cards.
   - Application modal with client-side date ordering validation (end date >= start date).
   - Status tracking across `PENDING`, `APPROVED`, and `REJECTED` states.

5. **Profile & Settings (`ProfileScreen.tsx`)**:
   - Employee identification badges: Full Name, Employee ID, Designation, Department, Email, and Account Status.
   - Live backend health indicator with custom base URL changer.
   - Sign Out action with confirmation dialog, securely clearing local token storage.

6. **QR Code Attendance Scanner (`ScannerScreen.tsx`)**:
   - Camera-based entrance gate scanner using `expo-camera`.
   - Built-in simulation fallbacks for virtual emulators.

---

## 7. Testing & Quality Verification

Run TypeScript compilation check:

```powershell
cd c:\Users\Rana\vorldx-attendance\employee-mobile
npx tsc --noEmit
```

Run full backend test suite:

```powershell
cd c:\Users\Rana\vorldx-attendance\backend
.\.venv\Scripts\pytest.exe -v
```
