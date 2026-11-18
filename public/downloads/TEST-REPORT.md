# LoopMarket · Verification & Test Report

**Date:** 2026-11-19  
**Platform Target:** Vercel + Neon PostgreSQL + Vercel Blob  
**Status:** All Tests Passed (181 Automated Checks)

---

## 1. Summary of Test Coverage

| Category | Checks Run | Status | Description |
|---|---|---|---|
| **TypeScript Compilation** | Full project | **PASS** | `tsc --noEmit` verified with strict mode across `src/`, `server/`, `api/`, `tests/` |
| **Vite Client Production Build** | Full frontend | **PASS** | `vite build` generated optimized static assets in `dist/client` |
| **Public Assets & Fonts** | 20 assets | **PASS** | `public/images/` (19 images), `public/fonts/manrope.ttf`, `public/favicon.svg` verified |
| **API Integration Suite** | 155 checks | **PASS** | Full marketplace lifecycle (listings, searches, conversations, requests, moderation) |
| **Vercel Serverless Function Suite** | 26 checks | **PASS** | Request parsing, headers, cookie preservation, session handling, 404/403 responses |
| **PostgreSQL SQL Adapter** | 5 dialect checks | **PASS** | Placeholder conversion `$1..$n`, `INSERT OR IGNORE` -> `ON CONFLICT DO NOTHING` |
| **Vercel Blob Storage Adapter** | Storage ops | **PASS** | `put`, `get`, fallback to local directory |
| **Production Security Mode** | Security checks | **PASS** | `DEMO_MODE=false` disables demo logins, config hides demo admin, zero seeds |
| **Concurrency & Integrity** | Race condition tests | **PASS** | Overlapping rental booking conflict, concurrent owner setup claims |

---

## 2. Detailed Test Results

### 2.1 Authentication & Session Security
- **Owner Account Creation:** Tested single-use invitation token claim. Invalid token (403), expired token (403), valid token (200). Second concurrent attempt rejected with 409 conflict.
- **Password Security:** PBKDF2 with 100,000 iterations using SHA-256 and unique random salt per user. Passwords never stored in plaintext.
- **Session Tokens:** 128-bit random UUIDs stored in `sessions` table with 7-day expiration and issued in `HttpOnly; SameSite=Lax; Path=/` cookies.
- **Role Verification:** Non-admin requests to `/api/admin` strictly rejected with 403 Forbidden.
- **Manual User Approval:** New registrations default to `pending` status. Unapproved accounts cannot publish active listings or submit exchange requests.
- **Suspended Accounts:** Suspended users are locked out with 403 status.
- **Rate Limiting:** Auth endpoints rate-limited using `auth_attempts` sliding window.

### 2.2 Marketplace & Exchange Flow
- **Listing Creation:** Validated schema rules: prices >= 0, title length 1-100, up to 5 photos, mandatory photo for active listing.
- **Search & Filters:** Text keyword search with SQL escaping, category filters, price bounds (numeric min/max), sorting by date and price.
- **Saved Items:** Toggling favorites persisted per user.
- **Conversations & Messages:** Multi-user isolation verified: third-party users cannot view conversations. Deduplication of repeat enquiries.
- **Rental Availability:** Date range validation. Trigger prevents overlapping accepted rentals (verified with concurrent request tests).
- **Handover & Returns:** Complete rental lifecycle: pending -> accepted -> handed over -> completed. Sale lifecycle: draft -> active -> reserved -> sold.

### 2.3 Image Uploads & Retrieval
- **Magic Byte Validation:** File headers verified for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`RIFF...WEBP`). Fakes rejected with 400.
- **File Size Limit:** Files > 5 MB rejected with 400.
- **Ownership Check:** Users can only attach images they uploaded.

### 2.4 Production Database (PostgreSQL) Parity
- Verified SQL compatibility:
  - SQLite `?` translated to PostgreSQL `$1, $2, ...`
  - `INSERT OR IGNORE` translated to `ON CONFLICT DO NOTHING`
  - PostgreSQL PL/pgSQL triggers enforce rental availability, terms protection, and conflict prevention.
  - PostgreSQL custom `changes()` function supports SQLite `WHERE changes()>0` batch logic.

---

## 3. Command Outputs

### Automated Test Suite Execution:
```
> loopmarket@1.0.0 test
> tsx tests/integration.ts && tsx tests/vercel-postgres.test.ts

PASS: 155 API, authorization, exchange, upload and persistence checks.
--- Starting Vercel & PostgreSQL Integration Tests ---
Testing convertSqliteToPostgres...
Testing Blob Storage fallback to local bucket...
Testing handleVercelRequest...
Testing Production mode (DEMO_MODE=false)...
PASS: All 26 Vercel and PostgreSQL adapter checks passed successfully!
```

### Production Build Execution:
```
> loopmarket@1.0.0 build
> tsc --noEmit && vite build

vite v7.3.8 building client environment for production...
transforming...
✓ 1648 modules transformed.
rendering chunks...
computing gzip size...
dist/client/index.html                   0.64 kB │ gzip:   0.41 kB
dist/client/assets/index-DbWFJpCK.css   88.65 kB │ gzip:  18.81 kB
dist/client/assets/index-r9ku_sk8.js   412.28 kB │ gzip: 127.78 kB
✓ built in 2.13s
```
