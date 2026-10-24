# VorldX Production Deployment Readiness Plan

> [!IMPORTANT]
> **DEPLOYMENT STATUS: EXPLICITLY PROHIBITED AT THIS MILESTONE**  
> Per mentor directive, this document represents an architectural deployment plan and readiness checklist only. **No cloud infrastructure has been created, no public domains have been provisioned, and no services have been exposed to the internet.** The entire system remains strictly local.

---

## 1. Readiness Assessment Matrix

Every architecture component has been audited and categorized into one of four deployment readiness states:
1. **Verified Locally**: Functional behavior, unit logic, build output, or configuration verified in the local workstation environment.
2. **Partially Verified**: Underlying functionality verified locally, but production cloud infrastructure or environmental integration is pending.
3. **Not Verified**: Requires external hardware, physical production device, or live external service unavailable in local testing.
4. **Future Deployment Task**: Explicitly deferred to the post-demonstration deployment phase.

| Component / Discipline | Specific Requirement | Readiness State | Local Verification Details & Target Cloud Architecture |
|---|---|---|---|
| **Frontend Web** | Vite SPA Static Build | **Verified Locally** | `npm run build` succeeds in 1.39s; output bundles into `admin-web/dist/`. Target: S3 + CloudFront or Vercel. |
| **Frontend Web** | SPA Route Fallback | **Partially Verified** | React Router DOM works locally via Vite. Target: Nginx `try_files $uri /index.html;` or CDN rewrites. |
| **Backend Service** | ASGI Server Readiness | **Verified Locally** | FastAPI runs locally under Uvicorn (`0.29.0`). Target: Containerized Docker image with Gunicorn Uvicorn workers. |
| **Backend Service** | Health Probes | **Verified Locally** | `/health` and `/health/database` return `200 OK` with JSON telemetry. Ready for Kubernetes/ECS liveness probes. |
| **Database Tier** | Schema Migrations | **Verified Locally** | 6 Alembic revisions applied up to head `8131b0947487`. Schema migration pipeline tested against test database. |
| **Database Tier** | Managed Cloud DB & Backups | **Future Deployment Task** | Target: Managed PostgreSQL 15+ (AWS RDS / Neon) with automated daily snapshots and point-in-time recovery (PITR). |
| **Database Tier** | Connection Pooling | **Partially Verified** | SQLAlchemy pool pre-ping and recycling enabled locally. Target: PgBouncer for high-concurrency production load. |
| **Security & Auth** | Credential Hashing | **Verified Locally** | Salted PBKDF2-HMAC-SHA256 (100k rounds) verified in automated security tests. |
| **Security & Auth** | JWT Secret Management | **Future Deployment Task** | Local `SECRET_KEY` in `.env`. Target: Inject 256-bit cryptographically random hex via AWS Secrets Manager. |
| **Security & Auth** | Token Revocation Denylist | **Future Deployment Task** | Stateless JWT verified locally. Target: In-memory Redis token blacklist for instant logout invalidation. |
| **Transport** | HTTPS / TLS 1.3 Enforcement | **Future Deployment Task** | Local runs over HTTP. Target: Automated Let's Encrypt / AWS Certificate Manager TLS termination at reverse proxy. |
| **CORS Policy** | Production Whitelisting | **Partially Verified** | `main.py` enforces whitelisted `ALLOWED_ORIGINS` when `ENVIRONMENT != "development"`. Disable LAN regex in prod. |
| **Input Defense** | SQLi / XSS / CSV Defense | **Verified Locally** | Parameterized queries, Pydantic schemas, and `sanitize_csv_cell` formula defense verified with 38 security tests. |
| **Attendance Flow** | Dynamic QR Kiosk Engine | **Verified Locally** | Kiosk 18s rotation and SHA-256 hash validation tested end-to-end. Target: Dedicated hardware kiosk in office lobby. |
| **Mobile App** | Expo Application Bundle | **Partially Verified** | `npx tsc --noEmit` passes with 0 errors. Target: EAS Build for Android App Bundle (`.aab`) and iOS (`.ipa`). |
| **Mobile App** | Physical Camera QR Scan | **Not Verified** | Code implemented with `expo-camera`. Physical scanning requires physical hardware on same network. |
| **Observability** | Centralized Logging | **Future Deployment Task** | Structured Python logging (`vorldx.app`) functional. Target: Ship JSON logs to Datadog or CloudWatch. |
| **Observability** | Exception Monitoring | **Future Deployment Task** | Target: Integrate Sentry SDK for real-time frontend and backend uncaught exception alerts. |
| **Rate Limiting** | Brute-Force Abuse Defense | **Future Deployment Task** | Basic validation in place. Target: Redis-backed rate limiting (SlowAPI) on `/auth/login` and `/attendance/check-in`. |

---

## 2. Infrastructure & Hosting Architecture Plan

### 2.1 Admin Web Hosting Plan
* **Target Solution**: Static Site Hosting (AWS S3 + CloudFront CDN, Cloudflare Pages, or Vercel).
* **Build Artifact**: Static files generated from `admin-web/dist/`.
* **Routing Configuration**:
  ```nginx
  # Production Nginx SPA Routing Rule
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```
* **Cache Headers**:
  * `index.html`: `Cache-Control: no-cache, no-store, must-revalidate` (guarantees instantaneous deployment propagation).
  * Assets (`/assets/*.js`, `/assets/*.css`): `Cache-Control: public, max-age=31536000, immutable` (fingerprinted chunks).

### 2.2 Backend API Hosting Plan
* **Target Solution**: Containerized service deployed on AWS ECS (Fargate) or GCP Cloud Run.
* **Process Model**:
  ```bash
  # Production Entrypoint Command
  gunicorn app.main:app \
      --workers 4 \
      --worker-class uvicorn.workers.UvicornWorker \
      --bind 0.0.0.0:8000 \
      --access-logfile - \
      --error-logfile -
  ```
* **Reverse Proxy**: Nginx or AWS Application Load Balancer terminating TLS 1.3 and forwarding headers (`X-Forwarded-For`, `X-Forwarded-Proto`).

### 2.3 PostgreSQL Cloud Hosting & Backup Architecture
* **Target Solution**: AWS RDS PostgreSQL 15+ Multi-AZ or Neon PostgreSQL.
* **Storage**: Automated storage scaling with encrypted EBS volumes (AES-256).
* **Backup Policy**:
  * Automated daily snapshots retained for 30 days.
  * Continuous Write-Ahead Logging (WAL) archiving enabling Point-In-Time Recovery (PITR) to any second within the retention window.
  * Recovery Point Objective (RPO): $< 5$ minutes.
  * Recovery Time Objective (RTO): $< 30$ minutes.

---

## 3. Environment Variable and Secret Management Plan

Production secrets must never be committed to source control or baked into Docker container layers.

### Secret Injection Architecture
```
[ AWS Secrets Manager / HashiCorp Vault ]
                     │
                     ▼ (IAM Role Instance Profile)
         [ Application Container ]
                     │
        ├── Reads DATABASE_URL
        ├── Reads SECRET_KEY
        └── Reads ALLOWED_ORIGINS
```

### Production Environment Variable Matrix

| Variable Name | Production Guidance | Sensitivity |
|---|---|---|
| `ENVIRONMENT` | Set strictly to `production`. Disables development LAN CORS regex and verbose debugging. | Standard |
| `DEBUG` | Set strictly to `false`. Prevents stack trace disclosure in error responses. | Standard |
| `DATABASE_URL` | Managed RDS connection string with SSL mode (`sslmode=require`). | **Critical Secret** |
| `SECRET_KEY` | High-entropy 64-character random hexadecimal key generated via `openssl rand -hex 32`. | **Critical Secret** |
| `ALLOWED_ORIGINS` | Comma-separated list of exact production domains (e.g., `https://attendance.vorldx.com`). | Sensitive |
| `ORGANIZATION_TIMEZONE`| Fixed to `Asia/Kolkata`. | Standard |
| `QR_CODE_EXPIRATION_SECONDS` | Fixed to `18`. | Standard |

---

## 4. HTTPS, TLS, and Network Security Checklist

1. **TLS Enforcement**: Enforce TLS 1.3 minimum. Redirect all plaintext HTTP traffic to HTTPS on port 443 with HTTP 301.
2. **Security Headers**:
   ```
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   X-XSS-Protection: 1; mode=block
   Referrer-Policy: strict-origin-when-cross-origin
   ```
3. **CORS Hardening**: In production, remove all wildcards and LAN regexes. Only accept pre-flight `OPTIONS` requests from registered corporate domains.
4. **Time Synchronization**: Dynamic QR token validation requires millisecond precision. Ensure the production server runs `chrony` or `systemd-timesyncd` synchronized via NTP.

---

## 5. Mobile Application Release Preparation (EAS)

1. **Expo Application Services (EAS) Configuration**:
   * Create `eas.json` with dedicated `development`, `preview`, and `production` build profiles.
   * Configure environment-specific API endpoints using Expo Constants (`EXPO_PUBLIC_API_URL`).
2. **Android Keystore Management**:
   * Securely store production upload keystore in EAS Secrets.
   * Generate Android App Bundle (`.aab`) for Google Play Console distribution.
3. **Network Security Config**:
   * Enforce HTTPS-only network traffic in `app.json` (`cleartextTraffic: false`).

---

## 6. Pre-Deployment Smoke Test Protocol

Before releasing a production deployment, QA and DevOps engineers must execute this smoke test protocol against a staging environment:

1. **Infrastructure Health**:
   * Verify `GET /health` returns `HTTP 200` with `status: healthy`.
   * Verify `GET /health/database` returns `HTTP 200` with `database: connected`.
2. **Database Integrity**:
   * Execute `alembic current` to confirm the database schema matches migration head `8131b0947487`.
3. **Authentication Smoke Test**:
   * Perform administrator login via Admin ID (`ADM-001`). Confirm JWT issuance.
   * Perform employee login via Employee ID (`VX-0101`). Confirm JWT issuance.
   * Confirm invalid password returns `401 Unauthorized` without system details.
4. **Core Workflow Verification**:
   * Fetch active kiosk QR session (`GET /api/v1/qr/active`). Verify remaining seconds $\le 18$.
   * Perform clock-in using active token. Verify record persistence.
   * Verify duplicate clock-in is rejected with `409 Conflict`.
   * Submit test leave request. Confirm administrator review queue displays request.
   * Confirm administrator self-approval is rejected with `403 Forbidden`.
5. **Report Generation**:
   * Generate CSV export (`GET /api/v1/analytics/export/attendance.csv`). Confirm HTTP 200 and sanitized content.

---

## 7. Rollback and Disaster Recovery Procedures

If a critical defect or migration failure is detected during deployment, follow this rollback plan:

### 7.1 Backend Service Rollback
1. Re-route load balancer traffic to the previous healthy container revision.
2. In Kubernetes / ECS, trigger instant deployment undo:
   ```bash
   aws ecs update-service --cluster vorldx-prod --service api-service --task-definition api-task:PREVIOUS_REVISION
   ```

### 7.2 Database Schema Rollback
1. If the failed deployment included a schema change, execute Alembic downgrade to the prior revision:
   ```bash
   alembic downgrade -1
   ```
2. If data corruption occurred, restore from the pre-deployment automated snapshot taken prior to deployment commencement.

### 7.3 Frontend Web Rollback
1. Re-point CDN origin or invalidate CloudFront cache to serve the previous immutable build artifact directory:
   ```bash
   aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
   ```

---

## 8. Deployment Sign-off Governance

Actual deployment may proceed only after formal approval from the following project roles:

* [ ] **Software Architect**: Architectural verification and schema migration review.
* [ ] **DevOps Engineer**: Infrastructure provisioning, TLS certificates, and secret injection verification.
* [ ] **Security Engineer**: Threat model validation, secret rotation, and penetration test sign-off.
* [ ] **QA Lead**: Automated test suite pass confirmation (188+ tests) and staging smoke test pass.
* [ ] **Project Mentor**: Final authorization to transition from local development to production.
