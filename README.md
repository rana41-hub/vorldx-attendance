# VorldX Attendance Management System

Enterprise-grade, full-stack employee attendance tracking, policy calculation, and leave management system built for high-performance workforce operations.

---

## 1. System Architecture

The **VorldX Attendance Management System** comprises three core sub-applications integrated via a unified REST API contract:

```
+-----------------------------------------------------------------------------------+
|                                  PostgreSQL 15+                                   |
|   vorldx_attendance (Development DB)  |   vorldx_test (Isolated Automated Tests) |
+-----------------------------------------------------------------------------------+
                                         ^
                                         | SQLAlchemy 2.0 / Alembic
                                         v
+-----------------------------------------------------------------------------------+
|                             FastAPI Backend Service                               |
|                  Port 8000 | JWT Auth | Policy Engine | QR Tokens                 |
+-----------------------------------------------------------------------------------+
                                   ^              ^
                   HTTP / REST API |              | HTTP / REST API
                                   v              v
+---------------------------------------+    +--------------------------------------+
|       Admin Web Portal (Vite)         |    |      Employee Mobile Portal (Expo)   |
|   React 19 | Tailwind CSS | Port 5173 |    |     React Native | SDK 57 | Metro    |
+---------------------------------------+    +--------------------------------------+
```

### Sub-Applications

* **[`backend/`](backend/)**: FastAPI REST API providing JWT Bearer authentication, role-based access control (`ADMIN`, `EMPLOYEE`), policy rules engine, dynamic QR session generation, time-series metrics, CSV/Excel export, and Alembic database migrations.
* **[`admin-web/`](admin-web/)**: Administrator and HR web portal built with React 19, TypeScript, Vite, and Tailwind CSS. Includes live presence analytics, employee management, QR office kiosk, attendance logs, leave & WFH request reviews, attendance policy configuration, and diagnostics.
* **[`employee-mobile/`](employee-mobile/)**: Employee self-service mobile application built with React Native and Expo SDK 57. Provides camera QR scanning for attendance check-ins, time clock monitoring, attendance history, leave applications, remote work requests, and network connection configuration.
* **[`docs/`](docs/)**: Architecture documentation, metric reconciliation audits, test verification records, and reporting validation reports.

---

## 2. Repository Directory Structure

```
vorldx-attendance/
├── .gitignore                          # Global Git ignore rules
├── README.md                           # Master repository documentation
├── admin-web/                          # Administrator Web Application
│   ├── .env.example                    # Environment template for frontend
│   ├── index.html                      # Single-page application entry HTML
│   ├── package.json                    # Admin Web dependencies and scripts
│   ├── src/
│   │   ├── components/                 # Shared UI and layout components
│   │   ├── context/                    # Auth and Theme React contexts
│   │   ├── features/                   # Feature modules (dashboard, policy, kiosk, etc.)
│   │   ├── services/                   # Typed API client services
│   │   └── types/                      # TypeScript domain interfaces
│   └── vite.config.ts                  # Vite build and development configuration
├── backend/                            # FastAPI Backend Service
│   ├── .env.example                    # Environment template for backend & DB URLs
│   ├── alembic/                        # Database migration scripts and versions
│   ├── app/
│   │   ├── api/v1/routes/              # API route controllers (auth, attendance, qr, etc.)
│   │   ├── core/                       # Security, token, and hashing utilities
│   │   ├── dependencies/               # FastAPI dependency injection (DB session, auth)
│   │   ├── models/                     # SQLAlchemy declarative ORM models
│   │   ├── schemas/                    # Pydantic request and response schemas
│   │   └── services/                   # Business logic (policy calculation, QR tokens)
│   ├── requirements.txt                # Python backend dependencies
│   ├── scripts/                        # Database seeding utilities (admin seed)
│   └── tests/                          # Automated Pytest test suite (150+ tests)
├── docs/                               # Technical Documentation & Audits
│   ├── dashboard_final_verification.md # Dashboard KPI verification audit
│   ├── dashboard_metrics_reconciliation_audit.md # Metrics calculation documentation
│   ├── day11_reporting_validation_report.md      # Reports & analytics audit
│   └── project_audit_cleanup_report.md           # Cleanup & refactoring logs
└── employee-mobile/                    # Employee Mobile Application (Expo)
    ├── App.tsx                         # Mobile root component and navigation
    ├── app.json                        # Expo application manifest
    ├── package.json                    # Mobile dependencies and scripts
    └── src/
        ├── components/                 # Native UI components (Header, Nav, Toast)
        ├── context/                    # Mobile App and Theme contexts
        ├── screens/                    # Mobile screens (Home, Scanner, History, etc.)
        ├── services/                   # Mobile API client with network diagnostics
        └── types/                      # Mobile TypeScript definitions
```

---

## 3. Local Development Setup

### Prerequisites

* **Python 3.10+**
* **Node.js 18+** and **npm**
* **PostgreSQL 14+** running locally with two databases:
  1. `vorldx_attendance` (Development Database)
  2. `vorldx_test` (Automated Test Database)

---

### Step 1: Start the Backend Service

```powershell
cd c:\Users\Rana\vorldx-attendance\backend

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

* API Docs (Swagger): `http://localhost:8000/docs`
* Health Check: `http://localhost:8000/health`

---

### Step 2: Start the Admin Web Application

```powershell
cd c:\Users\Rana\vorldx-attendance\admin-web

# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

* Web URL: `http://localhost:5173`

---

### Step 3: Start the Employee Mobile Application

```powershell
cd c:\Users\Rana\vorldx-attendance\employee-mobile

# Install dependencies
npm install

# Start Expo development server
npm run start
```

* Metro Bundler: `http://localhost:8081`

---

## 4. Default Credentials & Authentication

| Role | Identifier | Default Password | Target Application |
|---|---|---|---|
| **Administrator** | `ADM-001` | `Admin@VorldX2026` | Admin Web (`http://localhost:5173`) |
| **Employee** | `VX-0101` | `Employee@VorldX2026` | Employee Mobile (`http://localhost:8081`) |

*Note: The system strictly separates Administrator IDs from Employee IDs. Admins cannot log into the mobile app, and employees cannot access administrative portals.*

---

## 5. Database Configuration & Test Isolation Safeguards

The repository enforces strict database isolation to guarantee that running automated tests never pollutes or alters the production/development database.

### Database Connection Strings

Configured in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:<PASSWORD>@localhost:5432/vorldx_attendance
TEST_DATABASE_URL=postgresql+psycopg://postgres:<PASSWORD>@localhost:5432/vorldx_test
```

### Safety Rules

1. **Dedicated Test Database**: All automated tests (`pytest`) strictly run against `vorldx_test`.
2. **Safety Guards**: `backend/tests/conftest.py` inspects the active database URL before running test fixtures. If the URL points to `vorldx_attendance` or lacks `_test`, test execution is aborted immediately.
3. **Session Isolation**: Test fixtures instantiate isolated test sessions and roll back transactions after every test scenario.

To run the backend test suite safely:

```powershell
cd c:\Users\Rana\vorldx-attendance\backend
.\.venv\Scripts\pytest.exe -v
```

---

## 6. Code Quality & Verification Commands

### Admin Web

```powershell
cd c:\Users\Rana\vorldx-attendance\admin-web
npm run lint          # ESLint code validation
npm run build         # TypeScript compilation & production bundle check
```

### Employee Mobile

```powershell
cd c:\Users\Rana\vorldx-attendance\employee-mobile
npx tsc --noEmit      # Mobile TypeScript type check
```

### Backend

```powershell
cd c:\Users\Rana\vorldx-attendance\backend
.\.venv\Scripts\pytest.exe -v   # Run test suite against vorldx_test
```
