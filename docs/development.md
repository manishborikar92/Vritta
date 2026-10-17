# Vritta Local Development Guide

**Document Role:** How-to & Developer Reference (Diátaxis)  
**Target:** Local Setup, Tooling & Workflow  
**Working Directory:** `web/` (contains application package)  

---

## 1. Prerequisites

Before setting up the project locally, verify that your environment meets these requirements:

- **Node.js:** v20.x or higher (verified with Node.js v20+ and v24+)
- **Package Manager:** `npm` (npm v10+)
- **Git:** Git 2.40+
- **Firebase Account:** Access to a Firebase project with Google Authentication and Cloud Firestore enabled

---

## 2. Quick Start Setup

Follow these steps to configure and run Vritta on a clean workstation:

### Step 1: Clone the Repository
```bash
git clone https://github.com/manishborikar92/Vritta.git
cd Vritta
```

### Step 2: Install Web Package Dependencies
All application code and package dependencies reside in the `web/` directory:
```bash
cd web
npm install
```

### Step 3: Configure Local Environment Variables
Create a local environment file in `web/` from the template:
```bash
cp .env.local.example .env.local
```

Open `web/.env.local` and populate the required variables with your Firebase project credentials. See [Section 3](#3-environment-variables-reference) for the complete reference.

### Step 4: Start the Development Server
```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000).

---

## 3. Environment Variables Reference

Vritta uses distinct client-side and server-side environment variables. Never commit `.env.local` or service account keys to source control.

| Variable Name | Scope | Required | Purpose |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client / Browser | Yes | Firebase Web API key for client-side authentication. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client / Browser | Yes | Auth domain for Google Sign-In redirect and popup flows. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client & Server | Yes | Project identifier for Cloud Firestore and Identity Toolkit. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client / Browser | Yes | Firebase Cloud Storage bucket identifier. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client / Browser | Yes | Firebase Cloud Messaging sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client / Browser | Yes | Firebase Web Application identifier. |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Client / Browser | No | Optional Google Analytics measurement ID. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server-Only / CLI | Dev | Absolute path to external service account JSON key for local CLI tools. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server-Only | Prod | Minified JSON string of service account key (used on Vercel). |

---

## 4. Package Scripts Reference

All package scripts are run from the `web/` directory (or from the project root using `npm --prefix web <script>`):

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Starts the Next.js development server with hot-reload on port 3000. |
| `npm run build` | `next build --webpack` | Compiles the production build, checks types, and exports static pages. |
| `npm run start` | `next start` | Runs the compiled production build locally for verification. |
| `npm run lint` | `eslint` | Runs ESLint using the Next.js 16 flat configuration. |
| `npm run test` | `node --test tests/**/*.test.mjs` | Executes the complete automated test suite using the Node.js test runner. |
| `npm run templates:seed` | `node ../scripts/seed-schedule-templates.mjs` | Seeds authoritative schedule templates into Firestore. |
| `npm run plan:backup` | `node ../scripts/backup-personal-plan.mjs` | Creates an atomic JSON backup of user plan data. |
| `npm run plan:restore` | `node ../scripts/restore-personal-plan.mjs` | Restores user plan data with safety checks. |

---

## 5. Automated Testing Strategy

Vritta uses the native Node.js test runner (`node --test`), providing sub-second test execution without third-party test framework overhead.

### Running Tests
```bash
# From the web/ directory
npm run test

# From project root
npm --prefix web run test
```

### Test Suite Structure
The automated test suite consists of 350+ unit and integration tests across 115+ test suites in `web/tests/`, executing in ~1.5 seconds via the native Node.js test runner (`node --test`).

Key test domains include:
- **`brand-assets.test.mjs` & `manifest-contract.test.mjs`:** Asserts Guiding Sutra SVG markup, PWA manifest existence, icons, and theme colors.
- **`categories-contract.test.mjs`:** Validates category definitions, semantic badges, and dark-mode tokens.
- **`date-helpers.test.mjs` & `streak-calculation.test.mjs`:** Verifies local timezone handling, rest-day exclusions, and multi-period streak continuity.
- **`theme-engine.test.mjs`:** Tests two-state theme toggle, pre-paint blocking script, and legacy `'system'` migration.
- **`audio-chime.test.mjs` & `sound-context.test.mjs`:** Tests Web Audio API synthesis, frequency parameters, gain envelopes, volume scaling, and mute toggles.
- **`timer-context.test.mjs` & `use-timer.test.mjs`:** Tests wall-clock deadline derivation, Web Worker ticks, focus/visibility wakeups, single-completion guards, and silent reload recovery.
- **`habits-contracts.test.mjs` & `routine-seeding.test.mjs`:** Verifies foundation routine loading, personal schedule isolation, and Firestore model validation.

> [!NOTE]
> Exactly 4 tests in `firestore-integration.test.mjs` are intentionally skipped during local and CI test runs as they require an active live Firestore emulator or cloud credentials.

---

## 6. Pre-Commit Quality Checks

Before committing changes, execute the four authoritative quality gates:

```bash
# 1. Run unit test suite
npm --prefix web run test

# 2. Run linter
npm --prefix web run lint

# 3. Compile production build
npm --prefix web run build

# 4. Check for whitespace errors
git diff --check
```

---

## 7. Troubleshooting & FAQ

### Issue: "Firebase Admin credentials not configured"
- **Cause:** Running `npm run schedule:fetch-personal` without setting `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_KEY` in `web/.env.local`.
- **Solution:** Place your service account key in an external directory (e.g., `~/.credentials/vritta-adminsdk.json`) and set `GOOGLE_APPLICATION_CREDENTIALS` to that path in `web/.env.local`.

### Issue: Port 3000 is already in use
- **Solution:** Specify an alternative port:
  ```bash
  npm run dev -- -p 3001
  ```

### Issue: Theme flashes briefly on page load
- **Cause:** Blocking script in `web/src/app/layout.js` was modified or removed.
- **Solution:** Ensure the pre-paint script remains synchronously placed inside `<head>` in `layout.js`.
