# VorldX Security Architecture and Testing Verification Report

This document details the security posture, defensive controls, threat mitigations, and automated test suite results of the **VorldX Attendance Management System**.

---

## 1. Authentication Security Controls

### Credential Handling & Password Hashing
* **Algorithm**: Passwords are cryptographically salted and hashed using **PBKDF2-HMAC-SHA256** with **100,000 hashing rounds** and a dedicated 16-byte random salt.
* **Storage**: Plaintext passwords are never persisted to disk, transmitted in responses, or printed in log streams.
* **Database Representation**: Stored in `users.password_hash` as a standardized modular crypt format string (`pbkdf2:sha256:100000$<salt>$<hash>`).

### Login Identifier Separation
* **Admin Login**: Administrators must provide an assigned **Admin ID** (e.g. `ADM-001`). The database queries only records where `User.admin_id == login_id` and `User.role == UserRole.ADMIN`.
* **Employee Login**: Employees must provide their **Employee Code** (e.g. `VX-0101`). The database resolves the employee record and validates against the linked user account.
* **Email Rejection**: Direct login using email addresses is explicitly prohibited. This architectural separation prevents credential confusion and stops automated spray attacks from discovering employee roles based on email syntax.

### Account Status Controls
* Inactive or deactivated user accounts (`User.is_active == False`) are rejected at the authentication gateway with an immediate `403 Forbidden` response.

---

## 2. JWT Architecture & Token Validation

* **Token Format**: Standard JSON Web Token (JWT) signed via **HS256** using a server-side secret key (`SECRET_KEY`).
* **Lifetime**: Configured to **60 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES = 60`).
* **Validation Pipeline**:
  1. Header extraction (`Authorization: Bearer <token>`).
  2. Signature verification via `PyJWT`.
  3. Expiration verification (`exp` claim compared against current UTC time).
  4. Subject lookup: `sub` claim is extracted and verified against active database records in `get_current_user`.
  5. Revoked/Deactivated Account Check: If the caller's account was deactivated after token issuance, authorization is rejected.

### Stateless JWT Design & Logout Behavior
* **Implemented Mechanism**: The authentication system is currently **stateless**. Client-side logout clears the stored JWT from local storage (`AsyncStorage` on mobile, browser storage on web).
* **Security Implication**: In a purely stateless JWT architecture, an issued token remains cryptographically valid until its expiration timestamp lapses, even after the client application discards it.
* **Mitigation / Future Work**: For zero-trust enterprise deployments, a distributed in-memory cache (e.g., Redis) should be introduced to maintain a token denylist or track token revocation timestamps.

---

## 3. Role-Based Access Control (RBAC) & Data Isolation

### Horizontal Privilege Boundaries
The API strictly enforces tenant and employee data isolation:
* **Attendance Records (`GET /api/v1/attendance`)**: When invoked by an authenticated employee, the query automatically forces `employee_id = current_user.employee.id`, ignoring any client-supplied employee query parameter. Employees cannot view attendance logs of other employees.
* **Leave Requests (`GET /api/v1/leave`)**: Employees can only retrieve their own leave requests.
* **WFH Requests (`GET /api/v1/wfh`)**: Employees can only retrieve their own WFH requests.
* **Employee Dashboard (`GET /api/v1/attendance/dashboard`)**: Derives employee identity strictly from the caller's authenticated user profile.

### Vertical Privilege Boundaries
Administrative endpoints require the `require_admin_user` dependency:
* Employee creation, update, deletion, and account provisioning (`/api/v1/employees`).
* Organization attendance policy configuration (`PUT /api/v1/attendance/policy`).
* Attendance record manual corrections (`PATCH /api/v1/attendance/{record_id}/correct`).
* Dynamic QR kiosk token generation and rotation (`/api/v1/qr/active`, `/api/v1/qr/rotate`).
* Organization-wide metric summaries and audit log inspection (`/api/v1/analytics/*`, `/api/v1/attendance/audit-logs`).
Attempts by employees or unauthenticated callers to access administrative routes result in `403 Forbidden` or `401 Unauthorized`.

---

## 4. Governance & Anti-Self-Approval Enforcement

To prevent conflicts of interest and corporate governance violations, the backend implements strict **anti-self-approval guards**:
* **Leave Review (`PATCH /api/v1/leave/{leave_id}/review`)**: If an administrator attempts to approve or reject a leave request where `leave_request.employee_id == current_admin.employee.id`, the request is rejected with `403 Forbidden` (`detail="Administrators cannot approve or reject their own leave requests."`).
* **WFH Review (`PATCH /api/v1/wfh/{wfh_id}/review`)**: If an administrator attempts to review their own remote work request, the system blocks the action with `403 Forbidden`.
* **Segregation of Reviewer**: The identity of the reviewing administrator (`reviewed_by`) and the exact UTC timestamp (`reviewed_at`) are recorded immutably on the approved record.

---

## 5. Dynamic QR Attendance Security

```
18-Second Rotation Window:
[Session Created] ───────────────────── (18 Seconds) ─────────────────────► [Expired / Invalid]
      │                                                                           │
      ├─ Valid Check-in Allowed                                                   ├─ 400 Bad Request
      └─ Multiple distinct employees permitted                                    └─ Replay Denied
```

* **Dynamic Cryptographic Token**: Kiosk sessions generate a cryptographically random 64-character hexadecimal token.
* **Database Hashing**: The database stores only the **SHA-256 hash** of the token. An attacker with read access to the database cannot reconstruct the valid QR barcode payload.
* **18-Second Expiration**: Tokens expire exactly 18 seconds after issuance (`QR_CODE_EXPIRATION_SECONDS = 18`). This tight rotation window eliminates replay attacks from photographs or shared video recordings.
* **Office Code Binding**: QR tokens are bound to specific physical office locations (e.g. `HQ_MAIN`). Check-in records capture the source location tag (e.g. `DYNAMIC_QR_HQ_MAIN`).
* **Duplicate Check-in Defense**: A unique database constraint on `(employee_id, attendance_date)` prevents the same employee from checking in more than once on the same calendar day.

---

## 6. Input Sanitization & Attack Resilience

### SQL Injection Prevention
* All database interactions are executed using **SQLAlchemy 2.0 ORM** queries and parameterized expressions. User inputs are never concatenated into raw SQL strings.

### Cross-Site Scripting (XSS) Prevention
* API responses serialize string outputs via **Pydantic v2** models as structured JSON. Browsers consume data via React, which escapes text nodes automatically, preventing DOM-based script injection.

### CSV / Excel Formula Injection Defense
* When generating attendance exports (`/api/v1/analytics/export/attendance.csv`), all text cells pass through `sanitize_csv_cell()` in `backend/app/api/v1/routes/analytics.py`.
* Cells beginning with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are prepended with an escaping single quote (`'`), preventing malicious spreadsheet command execution when opened in Microsoft Excel or Google Sheets.

### Error Response Hygiene
* Internal stack traces, raw database error strings, and file system paths are suppressed in production. Database integrity collisions return standardized HTTP error responses (e.g., `409 Conflict`, `422 Unprocessable Content`).

---

## 7. Audit Logging & Compliance Trails

The system maintains an append-only audit trail in `audit_logs`:
* **Trigger Events**:
  1. Administrative attendance record corrections (`ATTENDANCE_CORRECTION`).
  2. Organization attendance policy updates (`POLICY_UPDATE`).
* **Audit Metadata Captured**:
  * `admin_id`: ID of the administrator executing the action.
  * `action_type`: Action classification.
  * `reason`: Mandatory text explanation for the change. Empty or missing reasons are rejected.
  * `previous_values`: Full JSON snapshot of the entity prior to modification.
  * `updated_values`: Full JSON snapshot of the modified entity.
  * `created_at`: UTC timestamp of the audit entry.
* **Atomic Transactions**: Audit log creation is committed in the same database transaction as the record modification. If the audit log fails, the modification is rolled back.

---

## 8. Automated Test Suite Verification

### Safety Guard in `backend/tests/conftest.py`
Automated tests are governed by strict safety checks:
1. `_verify_and_configure_test_database()` verifies that `TEST_DATABASE_URL` is set and distinct from `DATABASE_URL`.
2. Inspects `SELECT current_database();` over the live test connection. If the connected database name matches `vorldx_attendance` or lacks a dedicated test name, test execution is aborted immediately.
3. Test fixtures re-bind `SessionLocal` to `test_engine` and isolate all changes to `vorldx_test`.

### Executed Test Results Summary (October 24, 2026)

| Test Suite Module | Tests Run | Passed | Skipped | Failed | Coverage Focus |
|---|---|---|---|---|---|
| `test_day13_security_integration.py` | 38 | 38 | 0 | 0 | RBAC, SQLi, XSS, CSV injection, concurrency, self-approval |
| `test_dynamic_qr_checkpoint1.py` | 8 | 8 | 0 | 0 | QR generation, rotation, 18s expiry, kiosk caching |
| `test_dynamic_qr_checkpoint3.py` | 8 | 8 | 0 | 0 | Tamper-proofing, duplicate check-in, token expiration |
| `test_dynamic_qr_isolated_scenario.py` | 1 | 1 | 0 | 0 | End-to-end dynamic QR clock-in flow |
| `test_employee_dashboard.py` | 8 | 8 | 0 | 0 | Attendance percentage, eligible days, data isolation |
| `test_health.py` | 4 | 4 | 0 | 0 | Service health, DB probe, settings masking |
| `test_stage6_checkpoint2.py` | 3 | 3 | 0 | 0 | Timezone awareness, Kolkata time, LAN CORS origins |
| `test_stage6_checkpoint3_validation.py` | 16 | 16 | 0 | 0 | Concurrency, midnight shifts, half-day calculation, auth |
| `test_wfh.py` | 17 | 17 | 0 | 0 | WFH submission, validation, review, anti-self-approval |
| `test_day10_attendance_policy_audit.py` | 24 | 24 | 0 | 0 | Policy rules, audit logging, record corrections |
| `test_day11_reporting_and_statistics.py` | 26 | 26 | 0 | 0 | Analytics metrics, reports, CSV/Excel export safety |
| `test_auth_and_employees.py` | 36 | 35 | 1 | 0 | Authentication, activation, employee lifecycle |
| **Total Automated Suite** | **189** | **188** | **1** | **0** | **Execution Duration: 28.38s (100% Pass Rate)** |

*Note: 1 test skipped in `test_auth_and_employees.py` due to an optional legacy endpoint flag.*

### Frontend Quality Verification Results
* **Admin Web Lint (`npm run lint`)**: Passed with 0 errors.
* **Admin Web Production Build (`npm run build`)**: Passed with 0 errors (`dist/index.html` and assets bundled in 1.39s).
* **Employee Mobile TypeScript Check (`npx tsc --noEmit`)**: Passed with 0 errors.

---

## 9. Security Limitations & Future Hardening Matrix

| Security Area | Current Implemented Status | Verified In Environment | Future Production Task |
|---|---|---|---|
| **Password Storage** | PBKDF2-HMAC-SHA256 (100k rounds) | Yes (Automated tests) | Transition to Argon2id when supported |
| **Token Revocation** | Stateless 60m JWT expiration | Yes (Automated tests) | Deploy Redis token denylist for instant logout |
| **QR Code Expiry** | 18-second server-side rotation | Yes (Automated tests & kiosk) | Fine-tune for high-latency mobile networks |
| **Physical Camera Scan** | Camera scanner with Expo Camera | Implemented in code | Requires real mobile hardware on same Wi-Fi |
| **Rate Limiting** | Handled at API layer | Basic FastAPI validation | Introduce Redis-based IP rate limiter (SlowAPI) |
| **Transport Encryption** | HTTP (Local development scope) | Local scope only | Enforce TLS 1.3 / HTTPS behind reverse proxy |
| **CORS Policy** | Restrictive in prod, LAN regex in dev | Yes (Unit test verified) | Lock to verified production domains only |
