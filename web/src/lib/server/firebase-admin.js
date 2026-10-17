/**
 * Firebase Admin SDK Initialization (Server-Only).
 * Authoritative backend administrator instance for cryptographic token verification,
 * user management, and privileged data synchronization.
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

function resolveCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // 1. Primary Strategy: FIREBASE_SERVICE_ACCOUNT_KEY (Vercel Sensitive Env Var or local .env.local)
  // Supports either a direct JSON string OR a relative/absolute file path for local development.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        return cert(parsed);
      } catch (err) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', err.message);
      }
    } else {
      const candidates = [
        raw,
        path.resolve(process.cwd(), raw),
        path.resolve(process.cwd(), 'web', raw),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            const fileContent = JSON.parse(fs.readFileSync(p, 'utf-8'));
            return cert(fileContent);
          } catch (err) {
            console.error('[Firebase Admin] Failed to read FIREBASE_SERVICE_ACCOUNT_KEY file:', err.message);
          }
        }
      }
    }
  }

  // 2. Individual Environment Variables (Vercel alternative for multi-line credentials)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      return cert({
        projectId: projectId || 'vritta-app',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } catch (err) {
      console.error('[Firebase Admin] Failed to initialize cert from private key env vars:', err.message);
    }
  }

  // 3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or local file path)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    const candidates = [
      rawPath,
      path.resolve(process.cwd(), rawPath),
      path.resolve(process.cwd(), 'web', rawPath),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const fileContent = JSON.parse(fs.readFileSync(p, 'utf-8'));
          return cert(fileContent);
        } catch {
          // Fall through to standard applicationDefault()
        }
      }
    }
    try {
      return applicationDefault();
    } catch (err) {
      console.error('[Firebase Admin] Failed to load applicationDefault credential:', err.message);
    }
  }

  // 4. Fallback ADC only in native Google Cloud environments (Cloud Functions, Cloud Run, GAE)
  if (process.env.K_SERVICE || process.env.GAE_ENV) {
    try {
      return applicationDefault();
    } catch {
      return null;
    }
  }

  return null;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    const existingApp = getApps()[0];
    return {
      adminApp: existingApp,
      adminAuth: getAuth(existingApp),
      adminDb: getFirestore(existingApp),
    };
  }

  const credential = resolveCredential();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vritta-app';

  if (!credential) {
    // Return uninitialized stub that fails securely with an actionable error message
    return {
      adminApp: null,
      adminAuth: {
        verifyIdToken: async () => {
          const err = new Error(
            'Firebase Admin credentials not configured. Please set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS in .env.local'
          );
          err.code = 'auth/admin-credentials-missing';
          throw err;
        },
        getUserByEmail: async () => {
          const err = new Error(
            'Firebase Admin credentials not configured. Please set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS in .env.local'
          );
          err.code = 'auth/admin-credentials-missing';
          throw err;
        },
      },
      adminDb: null,
    };
  }

  const app = initializeApp({
    credential,
    projectId,
  });

  return {
    adminApp: app,
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
  };
}

const { adminApp, adminAuth, adminDb } = initializeFirebaseAdmin();

export { adminApp, adminAuth, adminDb, Timestamp, FieldValue };
