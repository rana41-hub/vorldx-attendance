# Local Development Environment Setup Guide

This guide provides end-to-end instructions for configuring, installing, and running the **VorldX Attendance Management System** on a local development workstation.

---

## 1. Prerequisites and System Requirements

Ensure the following tools are installed on your workstation before starting:

| Tool | Minimum Version | Verification Command | Notes |
|---|---|---|---|
| **Python** | 3.10+ | `python --version` | Required for FastAPI backend and Alembic |
| **Node.js** | 18.0.0+ | `node -v` | LTS release recommended |
| **npm** | 9.0.0+ | `npm -v` | Included with Node.js installation |
| **PostgreSQL** | 14.0+ | `psql --version` | Relational database server running on port 5432 |
| **Git** | 2.30+ | `git --version` | Version control management |
| **Expo Go** (Optional) | Latest | Mobile App Store | Required only for physical phone testing |

---

## 2. PostgreSQL Database Setup

The VorldX backend uses two separate local databases:
1. `vorldx_attendance`: Primary local development database containing seed employee records, attendance records, and policies.
2. `vorldx_test`: Automated testing database used exclusively by `pytest`.

### Database Initialization Steps
Open a PowerShell terminal and connect to your local PostgreSQL server:

```powershell
# Open psql interactive prompt
psql -U postgres
```

Inside the `psql` console, create the development and testing databases if they do not already exist:

```sql
-- Create development database
CREATE DATABASE vorldx_attendance;

-- Create isolated automated test database
CREATE DATABASE vorldx_test;

-- Verify both databases exist
\l

-- Exit psql
\q
```

> [!IMPORTANT]
> Never truncate, drop, or alter `vorldx_attendance` during testing. Automated test suites are configured to strictly target `vorldx_test`.

---

## 3. Backend Setup (`backend/`)

Open **Terminal 1** for the backend service.

### Step 3.1: Navigate and Create Virtual Environment
```powershell
cd c:\Users\Rana\vorldx-attendance\backend

# Create a Python 3.10+ virtual environment
python -m venv .venv

# Activate the virtual environment in PowerShell
.\.venv\Scripts\Activate.ps1
```

### Step 3.2: Install Dependencies
```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3.3: Configure Environment Variables
Copy the example environment template:
```powershell
Copy-Item .env.example .env
```

Open `backend/.env` in your editor and configure your local database connection parameters:
```ini
APP_NAME=VorldX Employee Attendance System
ENVIRONMENT=development
DEBUG=true
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8081

# Replace <YOUR_POSTGRES_PASSWORD> with your local PostgreSQL password
DATABASE_URL=postgresql+psycopg://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/vorldx_attendance
TEST_DATABASE_URL=postgresql+psycopg://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/vorldx_test

SECRET_KEY=vorldx_super_secret_local_dev_jwt_key_2026_change_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

DEFAULT_WORK_START_TIME=09:00:00
DEFAULT_WORK_END_TIME=17:00:00
DEFAULT_LATE_GRACE_MINUTES=15
DEFAULT_EARLY_DEPARTURE_GRACE_MINUTES=15
DEFAULT_HALF_DAY_HOURS=4.5
DEFAULT_FULL_DAY_HOURS=8.0
QR_CODE_EXPIRATION_SECONDS=18
ORGANIZATION_TIMEZONE=Asia/Kolkata
```

### Step 3.4: Apply Database Migrations
Run Alembic migrations to bring the database schema to the latest version:
```powershell
alembic upgrade head
```

### Step 3.5: Start the Backend Server
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3.6: Verify Backend Health
Open a browser or run in another terminal:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
Invoke-RestMethod -Uri "http://localhost:8000/health/database"
```
Both probes should return `"status": "healthy"`.

---

## 4. Admin Web Setup (`admin-web/`)

Open **Terminal 2** for the administrator and HR web application.

### Step 4.1: Navigate and Install Dependencies
```powershell
cd c:\Users\Rana\vorldx-attendance\admin-web

# Install required npm packages
npm install
```

### Step 4.2: Configure Environment Variables
Create or verify `admin-web/.env`:
```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Step 4.3: Start Local Vite Server
```powershell
npm run dev
```
The application will be available at:
`http://localhost:5173`

### Step 4.4: Code Quality Verification
Verify TypeScript typings and ESLint rules:
```powershell
npm run lint
npm run build
```

---

## 5. Employee Mobile Setup (`employee-mobile/`)

Open **Terminal 3** for the employee mobile application.

### Step 5.1: Navigate and Install Dependencies
```powershell
cd c:\Users\Rana\vorldx-attendance\employee-mobile

# Install required npm packages
npm install
```

### Step 5.2: Start the Expo Bundler
```powershell
npm start
```
The Expo Metro Bundler will launch on `http://localhost:8081`.

### Step 5.3: Type Checking Verification
```powershell
npx tsc --noEmit
```

---

## 6. Mobile Device Connection Guide

When testing the Employee Mobile application, understanding network resolution is critical:

### Understanding Localhost on Mobile
* **On your laptop/desktop**: `localhost` refers to your computer.
* **On a mobile phone (or emulator)**: `localhost` refers to the **phone itself**, not your development workstation. A mobile app trying to connect to `http://localhost:8000` will fail.

### Option A: Physical Mobile Phone (Expo Go)
1. Ensure your mobile phone and development workstation are connected to the **same Wi-Fi network**.
2. Determine your workstation's private LAN IP address:
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" | Select-Object IPAddress
   ```
   *(Example: `192.168.1.150`)*.
3. Open the Employee Mobile app on your phone via Expo Go.
4. On the login or settings screen, configure the backend API URL:
   ```
   http://192.168.1.150:8000/api/v1
   ```
5. Ensure your Windows Firewall permits inbound TCP connections on port 8000:
   ```powershell
   New-NetFirewallRule -DisplayName "FastAPI Dev Server (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```

### Option B: Android Emulator
If using the official Android Studio Emulator, Android provides a special virtual router alias pointing to the host machine's loopback interface:
* Use backend URL: `http://10.0.2.2:8000/api/v1`

### Option C: iOS Simulator (macOS only)
On an iOS Simulator running on the same host, `http://localhost:8000/api/v1` works directly.

---

## 7. Camera Permissions for QR Scanning

The dynamic QR check-in feature utilizes `expo-camera`.
* When navigating to the **Scanner** screen for the first time, the mobile application requests camera permissions via `Camera.requestCameraPermissionsAsync()`.
* If permissions are denied, the application displays a friendly fallback screen prompting the user to grant camera access in their device system settings.
* In headless environments or desktop development where camera hardware is absent, camera verification can be validated via mocked scanning utilities or simulated token inputs.

---

## 8. Summary of Active Local URLs

| Application | Address | Default Port | Notes |
|---|---|---|---|
| **FastAPI Backend** | `http://localhost:8000` | `8000` | Host binding: `0.0.0.0` (accessible over LAN) |
| **FastAPI Swagger UI** | `http://localhost:8000/docs` | `8000` | Interactive testing console |
| **FastAPI ReDoc** | `http://localhost:8000/redoc` | `8000` | Static API documentation |
| **Admin Web Portal** | `http://localhost:5173` | `5173` | Vite local development server |
| **Expo Metro Bundler** | `http://localhost:8081` | `8081` | React Native Metro server |
| **PostgreSQL Database** | `localhost:5432` | `5432` | Relational database tier |
