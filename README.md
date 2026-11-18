# LoopMarket · Campus Marketplace

LoopMarket is a secure, modern campus marketplace designed for university students to buy, sell, rent, and give away essentials (textbooks, electronics, furniture, lab equipment, etc.) within their campus community.

- **Production Target:** [https://loopmarket.vercel.app](https://loopmarket.vercel.app)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Vercel Node.js Serverless Functions (`/api/*`)
- **Production Database:** Neon PostgreSQL (connected via Vercel)
- **Production Storage:** Vercel Blob (`@vercel/blob`)
- **Local Development:** Built-in SQLite (`node:sqlite`) & local filesystem storage

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────┐
                      │             Vercel Edge / CDN            │
                      └─────┬──────────────────────────────┬─────┘
                            │                              │
                    Static Assets (/ & SPA)           API Requests (/api/*)
                            ▼                              ▼
                 ┌────────────────────┐       ┌────────────────────────┐
                 │ Vite React Client  │       │ Vercel Node Functions  │
                 │   (dist/client)    │       │     (api/index.ts)     │
                 └────────────────────┘       └────────────┬───────────┘
                                                           │
                                   ┌───────────────────────┴───────────────────────┐
                                   ▼                                               ▼
                     ┌───────────────────────────┐                   ┌───────────────────────────┐
                     │      Neon PostgreSQL      │                   │        Vercel Blob        │
                     │  (Relational Database)    │                   │      (Image Storage)      │
                     └───────────────────────────┘                   └───────────────────────────┘
```

---

## Deployment to Vercel & Neon PostgreSQL

### Step 1: Push Code to GitHub
Ensure all code is committed and pushed to your GitHub repository:
```bash
git init
git add .
git commit -m "feat: migrate LoopMarket to Vercel, Neon PostgreSQL, and Vercel Blob"
git branch -M main
git remote add origin https://github.com/<your-username>/LoopMarket.git
git push -u origin main
```

### Step 2: Import Project in Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** > **Project** and select your `LoopMarket` repository.
3. Framework Preset: **Vite**.
4. Root Directory: `./` (or `LoopMarket` if located in a subfolder).
5. Build Command: `npm run build`
6. Output Directory: `dist/client`

### Step 3: Connect Neon PostgreSQL
1. In your Vercel Project Dashboard, navigate to the **Storage** tab.
2. Click **Connect Store** > **Neon** (or Vercel Postgres powered by Neon).
3. Create a new Neon database or link an existing one.
4. Vercel automatically injects `POSTGRES_URL` and `DATABASE_URL` into your project environment variables.
5. Apply the production database schema:
   ```bash
   npm run db:migrate
   ```
   *(Note: The serverless backend also automatically creates tables, functions, and triggers on first run if they do not yet exist).*

### Step 4: Connect Vercel Blob Storage
1. In your Vercel Project Dashboard, navigate to the **Storage** tab.
2. Click **Connect Store** > **Blob**.
3. Create a Blob store named `loopmarket-uploads`.
4. Vercel automatically injects `BLOB_READ_WRITE_TOKEN` into your project environment variables.

### Step 5: Configure Production Environment Variables
In **Project Settings** > **Environment Variables**, verify and set:

| Variable | Description | Recommended Value |
|---|---|---|
| `POSTGRES_URL` | Neon connection string | Injected by Vercel |
| `DATABASE_URL` | Neon connection string | Injected by Vercel |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token | Injected by Vercel |
| `DEMO_MODE` | Disable demo accounts in production | `false` |
| `DEMO_ADMIN_ENABLED` | Disable demo moderator in production | `false` |
| `UNIVERSITY_EMAIL_DOMAINS` | Approved campus email domains | `mitadt.edu.in` (or blank) |
| `OWNER_SETUP_TOKEN_HASH` | SHA-256 hash of owner token | Generated via script |
| `OWNER_SETUP_EXPIRES_AT` | ISO timestamp of token expiry | Generated via script |

---

## Website Owner Setup (One-Time Claim)

To claim sole administrator ownership without risking public admin credentials:

1. Generate an owner invitation token:
   ```bash
   node scripts/create-owner-invitation.mjs https://loopmarket.vercel.app
   ```
2. The script outputs:
   - `OWNER_SETUP_TOKEN_HASH`
   - `OWNER_SETUP_EXPIRES_AT`
   - `private_setup_url` (e.g. `https://loopmarket.vercel.app/owner-setup#key=...`)
3. Add `OWNER_SETUP_TOKEN_HASH` and `OWNER_SETUP_EXPIRES_AT` to your Vercel environment variables and redeploy.
4. Open the `private_setup_url` in your browser.
5. Enter your owner name, email, and choose a strong password (at least 10 characters with numbers and letters).
6. Once submitted:
   - The token is cryptographically verified.
   - Your account is established as the sole website administrator.
   - The setup endpoint is permanently locked against further claims.

---

## Local Development

To run LoopMarket locally using the built-in SQLite database:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start local development server
npm run dev
```

Visit [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## Running Automated Tests

Run the complete test suite (API integration + PostgreSQL adapter + Vercel serverless checks):

```bash
npm test
```

Build production client:
```bash
npm run build
```
