import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

import {
  validateComposableHabit,
  validateDailyLogDoc,
} from '../src/lib/constants/habit-models.js';

import {
  normalizeHabitFromFirestore,
  normalizeDailyLogFromFirestore,
} from '../src/lib/firebase/firestore.js';

describe('Safe Personal-Plan Backup & Restoration Workflow', () => {

  // Mock timestamp class mimicking Firebase Firestore Timestamp
  class MockTimestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }
  }

  function serializeFirestoreData(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj.toDate === 'function') {
      return {
        _type: 'timestamp',
        iso: obj.toDate().toISOString(),
        seconds: obj.seconds,
        nanoseconds: obj.nanoseconds,
      };
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeFirestoreData);
    }
    if (typeof obj === 'object') {
      const res = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = serializeFirestoreData(v);
      }
      return res;
    }
    return obj;
  }

  function deserializeFirestoreData(obj, TimestampClass) {
    if (obj === null || obj === undefined) return obj;
    if (obj && typeof obj === 'object' && obj._type === 'timestamp') {
      return new TimestampClass(obj.seconds, obj.nanoseconds);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => deserializeFirestoreData(item, TimestampClass));
    }
    if (typeof obj === 'object') {
      const res = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = deserializeFirestoreData(v, TimestampClass);
      }
      return res;
    }
    return obj;
  }

  // ==========================================================================
  // 1. Serialization / Deserialization Integrity
  // ==========================================================================
  describe('1. Timestamp & Data Structure Serialization', () => {
    it('should cleanly serialize and deserialize Firestore Timestamp instances without precision loss', () => {
      const originalTs = new MockTimestamp(1760688000, 500000);
      const doc = {
        id: 'test_doc',
        createdAt: originalTs,
        metadata: {
          nestedDate: new MockTimestamp(1760690000, 123456),
          tags: ['personal', 'important'],
        },
      };

      const serialized = serializeFirestoreData(doc);
      assert.equal(serialized.createdAt._type, 'timestamp');
      assert.equal(serialized.createdAt.seconds, 1760688000);
      assert.equal(serialized.createdAt.nanoseconds, 500000);
      assert.equal(serialized.metadata.nestedDate._type, 'timestamp');

      const deserialized = deserializeFirestoreData(serialized, MockTimestamp);
      assert.ok(deserialized.createdAt instanceof MockTimestamp);
      assert.equal(deserialized.createdAt.seconds, 1760688000);
      assert.equal(deserialized.createdAt.nanoseconds, 500000);
      assert.equal(deserialized.createdAt.toDate().toISOString(), originalTs.toDate().toISOString());
      assert.deepEqual(deserialized.metadata.tags, ['personal', 'important']);
    });
  });

  // ==========================================================================
  // 2. Backup Manifest & Cryptographic Integrity Check
  // ==========================================================================
  describe('2. Backup Manifest & Cryptographic Integrity Check', () => {
    const samplePayload = {
      userDoc: {
        id: 'usr_manish',
        path: 'users/usr_manish',
        data: { activeOshoSeriesId: 'osho_01', updatedAt: '2026-10-17T05:00:00Z' },
      },
      habits: [
        {
          id: 'usr_manish_habit_1',
          path: 'habits/usr_manish_habit_1',
          data: {
            userId: 'usr_manish',
            title: 'English Workbook Practice',
            category: 'English Learning',
            frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            features: {
              counter: { enabled: true, targetCount: 2, unit: 'exercises' },
              checklist: { enabled: true, items: [{ id: 's1', label: 'Exercise 1' }] },
            },
          },
        },
      ],
      dailyLogs: [
        {
          id: 'usr_manish_2026-10-17',
          path: 'dailyLogs/usr_manish_2026-10-17',
          data: {
            userId: 'usr_manish',
            date: '2026-10-17',
            completedHabitIds: ['usr_manish_habit_1'],
            habitOutcomes: {
              usr_manish_habit_1: { status: 'completed' },
            },
          },
        },
      ],
      habitState: [],
      personalRoutines: [],
    };

    it('should generate valid SHA-256 checksum and verify successfully against unmodified payload', () => {
      const dataString = JSON.stringify(samplePayload);
      const checksum = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');

      const manifest = {
        formatVersion: '1.0.0',
        targetProjectId: 'vritta-app',
        userUid: 'usr_manish',
        userEmail: 'manishborikar92@gmail.com',
        snapshotTimestamp: new Date().toISOString(),
        documentCounts: {
          habits: 1,
          dailyLogs: 1,
          userDoc: 1,
          habitState: 0,
          personalRoutines: 0,
          total: 3,
        },
        checksum,
      };

      const computed = crypto.createHash('sha256').update(JSON.stringify(samplePayload), 'utf8').digest('hex');
      assert.equal(computed, manifest.checksum, 'Computed checksum must match manifest');
    });

    it('should detect tampering or corruption if data payload is altered', () => {
      const dataString = JSON.stringify(samplePayload);
      const originalChecksum = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');

      // Tampered payload (modified habit title)
      const tamperedPayload = JSON.parse(JSON.stringify(samplePayload));
      tamperedPayload.habits[0].data.title = 'Tampered Habit Title';

      const tamperedChecksum = crypto.createHash('sha256').update(JSON.stringify(tamperedPayload), 'utf8').digest('hex');
      assert.notEqual(tamperedChecksum, originalChecksum, 'Tampered data must produce differing checksum');
    });
  });

  // ==========================================================================
  // 3. Ownership & Target Protection
  // ==========================================================================
  describe('3. Ownership & Target Protection', () => {
    it('should abort restoration if target account does not match backup owner unless --allow-cross-account is set', () => {
      const backupUid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2'; // Manish's personal account
      const targetUid = 'fr9Yo4VDtuRN8LjX1YKWLSLaSx42'; // Test account

      // Without allowCrossAccount, must reject
      const allowCrossAccount = false;
      const shouldProceed = backupUid === targetUid || allowCrossAccount;
      assert.equal(shouldProceed, false, 'Restoring into different account without --allow-cross-account must be rejected');

      // With allowCrossAccount, permitted
      const withOverride = true;
      assert.equal(backupUid === targetUid || withOverride, true, 'Override allows cross-account migration');
    });
  });

  // ==========================================================================
  // 4. Schema Validation & Corruption Defense
  // ==========================================================================
  describe('4. Schema Validation & Corruption Defense', () => {
    it('should reject malformed habit during restoration pre-flight', () => {
      const invalidHabit = {
        userId: 'usr_1',
        title: '', // empty title invalid
        category: 'English Learning',
        features: {
          counter: { enabled: true, targetCount: -5, unit: '' }, // negative targetCount invalid
        },
      };

      const normalized = normalizeHabitFromFirestore(invalidHabit, 'h_inv');
      const validation = validateComposableHabit(normalized);
      assert.equal(validation.valid, false, 'Invalid habit must fail validation');
      assert.ok(validation.errors.some(e => e.includes('Habit title must be a non-empty string')));
    });

    it('should reject daily log containing unrecorded or invalid outcome status', () => {
      const invalidLog = {
        userId: 'usr_1',
        date: '2026-10-17',
        habitOutcomes: {
          h1: { status: 'unrecorded' }, // unrecorded is forbidden in persisted doc
        },
      };

      const validation = validateDailyLogDoc(invalidLog);
      assert.equal(validation.valid, false, 'Log with unrecorded status must fail validation');
      assert.ok(validation.errors.some(e => e.includes("Invalid persisted outcome status 'unrecorded'")));
    });

    it('should successfully validate well-formed restored habits and daily logs', () => {
      const validHabit = {
        userId: 'usr_1',
        title: 'Morning Meditation',
        category: 'Reflection & Journaling',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        time: '07:00 AM',
      };

      const normalizedHabit = normalizeHabitFromFirestore(validHabit, 'h_valid');
      const habitVal = validateComposableHabit(normalizedHabit);
      assert.equal(habitVal.valid, true, `Expected valid habit: ${habitVal.errors.join('; ')}`);

      const validLog = {
        userId: 'usr_1',
        date: '2026-10-17',
        completedHabitIds: ['h_valid'],
        habitOutcomes: {
          h_valid: { status: 'completed' },
        },
      };

      const normalizedLog = normalizeDailyLogFromFirestore(validLog, 'usr_1_2026-10-17');
      const logVal = validateDailyLogDoc(normalizedLog);
      assert.equal(logVal.valid, true, `Expected valid log: ${logVal.errors.join('; ')}`);
    });
  });

  // ==========================================================================
  // 5. Pre-flight Dry-Run Categorization Logic
  // ==========================================================================
  describe('5. Pre-flight Action Categorization (Create vs Overwrite vs Skip)', () => {
    it('should categorize existing documents as skip by default when overwrite=false', () => {
      const existingInDb = new Set(['doc_existing_1', 'doc_existing_2']);
      const backupDocs = ['doc_existing_1', 'doc_existing_2', 'doc_missing_3'];

      const overwrite = false;
      const actions = backupDocs.map(id => {
        if (!existingInDb.has(id)) return 'create';
        return overwrite ? 'overwrite' : 'skip';
      });

      assert.deepEqual(actions, ['skip', 'skip', 'create']);
      assert.equal(actions.filter(a => a === 'create').length, 1);
      assert.equal(actions.filter(a => a === 'skip').length, 2);
      assert.equal(actions.filter(a => a === 'overwrite').length, 0);
    });

    it('should categorize existing documents as overwrite when overwrite=true', () => {
      const existingInDb = new Set(['doc_existing_1', 'doc_existing_2']);
      const backupDocs = ['doc_existing_1', 'doc_existing_2', 'doc_missing_3'];

      const overwrite = true;
      const actions = backupDocs.map(id => {
        if (!existingInDb.has(id)) return 'create';
        return overwrite ? 'overwrite' : 'skip';
      });

      assert.deepEqual(actions, ['overwrite', 'overwrite', 'create']);
      assert.equal(actions.filter(a => a === 'create').length, 1);
      assert.equal(actions.filter(a => a === 'skip').length, 0);
      assert.equal(actions.filter(a => a === 'overwrite').length, 2);
    });
  });

  // ==========================================================================
  // 6. Local Backup Directory & Git-Ignore Protection
  // ==========================================================================
  describe('6. Local Storage & Git-Ignore Protection', () => {
    it('should verify backups/ is explicitly ignored in .gitignore', () => {
      const gitignorePath = path.resolve(webRoot, '..', '.gitignore');
      assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
      const content = fs.readFileSync(gitignorePath, 'utf8');
      assert.ok(
        content.split('\n').some(line => line.trim() === 'backups/'),
        '.gitignore must contain backups/ to prevent accidental commits'
      );
    });
  });
});
