# VorldX Attendance System — Administrator Web Application

The **VorldX Admin Web Application** is the centralized HR and security control panel for the VorldX Attendance Management System. Built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**, it integrates directly with the shared FastAPI backend.

---

## Features & Modules

1. **Administrator Authentication & Protected Routing**:
   - Secure Admin ID authentication (`POST /api/v1/auth/login`).
   - Token-based session management (`localStorage` with automatic authorization header injection).
   - Invalidation on `401 Unauthorized` token expiry.
   - Dedicated `LoginPage` with input validation (restricts email logins to require unique Admin IDs).

2. **Dashboard & Presence Analytics**:
   - Live metrics from `GET /api/v1/analytics/dashboard` (Active Headcount, Present, Absent, On Leave, WFH, Late arrivals, Half-day records).
   - Time-series attendance trends chart powered by `GET /api/v1/analytics/trends`.
   - Date selector to inspect past or current organizational presence.
   - Actionable banners highlighting pending leave and WFH requests.

3. **Employee Management**:
   - Directory listing with department and query search (`GET /api/v1/employees`).
   - Create new personnel (`POST /api/v1/employees`).
   - Edit employee profile (`PUT /api/v1/employees/{id}`).
   - Provision login credentials (`POST /api/v1/employees/{id}/account`).
   - Activate / deactivate employee accounts (`PATCH /api/v1/employees/{id}/status`).
   - Safe deletion protection preventing deletion of personnel with historical records (`DELETE /api/v1/employees/{id}`).

4. **Attendance Management**:
   - Complete record audit with date and status filters (`GET /api/v1/attendance`).
   - Shift duration calculation.
   - Administrative check-in and check-out testing console.

5. **Leave Request Management**:
   - Status filtering: `ALL`, `PENDING`, `APPROVED`, `REJECTED`.
   - Admin approval and rejection workflow (`PATCH /api/v1/leave/{id}/review`) with optional review notes.
   - Administrative leave submission modal.

6. **Work-from-Home (WFH) Management**:
   - Status filtering: `ALL`, `PENDING`, `APPROVED`, `REJECTED`.
   - Admin approval and rejection workflow (`PATCH /api/v1/wfh/{id}/review`).
   - Enforces attendance isolation: WFH approvals do not create attendance check-in records.

7. **Attendance Policy Management**:
   - Configurable workday schedule (`work_start_time`, `work_end_time`).
   - Punctuality parameters (`late_grace_minutes`, `early_departure_grace_minutes`).
   - Shift thresholds (`half_day_hours_threshold`, `full_day_hours_threshold`).
   - Automatic late arrival and early departure detection toggles.
   - Interactive policy calculation simulation sandbox (`POST /api/v1/attendance/policy/calculate`).

8. **Reports & Audit Timesheets**:
   - Date range summary metrics (`GET /api/v1/analytics/summary`).
   - Attendance rate, average daily attendance, and status breakdown.
   - Real-time CSV export for HR and payroll reporting.

---

## Configuration & Environment Variables

Create `.env` in the `admin-web` root directory:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Run TypeScript compilation and production build
npm run build

# Run ESLint validation
npm run lint

# Format code
npm run format
```

---

## Administrator Access Procedure

1. Seed the default administrator credentials using the backend seed script:
   ```bash
   cd ../backend
   .\.venv\Scripts\python.exe scripts/seed_initial_data.py
   ```
2. Open the Admin Web app (`http://localhost:5173`).
3. Sign in using the assigned **Admin ID** (e.g. `ADM-001`) and administrator password.
