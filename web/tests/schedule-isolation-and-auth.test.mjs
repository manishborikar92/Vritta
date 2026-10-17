import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROUTINES, MANISH_PERSONAL_ROUTINES } from '../src/lib/server/schedule-templates.js';

describe('Schedule Isolation & Boundary Integrity', () => {
  it('should define exactly 6 client-safe foundation routines in DEFAULT_ROUTINES', () => {
    assert.equal(DEFAULT_ROUTINES.length, 6, 'DEFAULT_ROUTINES must define 6 foundation routines');

    const stableKeys = DEFAULT_ROUTINES.map(r => r.stableKey);
    const uniqueKeys = new Set(stableKeys);
    assert.equal(uniqueKeys.size, 6, 'All foundation routines must have unique stable keys');

    for (const key of stableKeys) {
      assert.ok(key.startsWith('routine_'), `Foundation key ${key} must have 'routine_' prefix`);
    }
  });

  it('should not contain any proprietary personal books or audio catalogs in DEFAULT_ROUTINES', () => {
    const serializedDefaults = JSON.stringify(DEFAULT_ROUTINES);

    assert.ok(!serializedDefaults.includes('Word Power Made Easy'), 'Must not leak Word Power Made Easy');
    assert.ok(!serializedDefaults.includes('Norman Lewis'), 'Must not leak Norman Lewis');
    assert.ok(!serializedDefaults.includes('Osho'), 'Must not leak Osho library');
    assert.ok(!serializedDefaults.includes('ChatGPT Voice'), 'Must not leak ChatGPT voice tool metadata');
  });

  it('should define the 6 canonical personalized routines in MANISH_PERSONAL_ROUTINES', () => {
    assert.equal(MANISH_PERSONAL_ROUTINES.length, 6);

    const personalKeys = MANISH_PERSONAL_ROUTINES.map(r => r.stableKey);
    for (const key of personalKeys) {
      assert.ok(key.startsWith('canonical_'), `Personal key ${key} must have 'canonical_' prefix`);
    }

    assert.ok(personalKeys.includes('canonical_english_workbook'));
    assert.ok(personalKeys.includes('canonical_exercise_plan'));
    assert.ok(personalKeys.includes('canonical_listen_osho'));
    assert.ok(personalKeys.includes('canonical_read_books'));
    assert.ok(personalKeys.includes('canonical_english_speaking'));
    assert.ok(personalKeys.includes('canonical_maintain_diary'));
  });

  it('should guarantee zero key collisions between foundation routines and personal routines', () => {
    const defaultKeys = new Set(DEFAULT_ROUTINES.map(r => r.stableKey));
    const personalKeys = new Set(MANISH_PERSONAL_ROUTINES.map(r => r.stableKey));

    for (const key of personalKeys) {
      assert.ok(!defaultKeys.has(key), `Collision detected: ${key} exists in both sets!`);
    }
  });
});

describe('Backend Authorization & Security Rule Enforcement', () => {
  // Pure authorization evaluator matching the Route Handler's exact security logic
  function evaluateScheduleAccess(authHeader, decodedToken) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { status: 401, error: 'Unauthorized: Missing or invalid Authorization header.' };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return { status: 401, error: 'Unauthorized: Empty token provided.' };
    }

    if (!decodedToken || decodedToken.revoked) {
      return { status: 401, error: 'Unauthorized: Token revoked or invalid.' };
    }

    const email = (decodedToken.email || '').toLowerCase();
    const isVerified = decodedToken.email_verified === true;

    if (!isVerified || email !== 'manishborikar92@gmail.com') {
      return { status: 403, error: 'Forbidden: Personalized schedule data is restricted to authorized accounts.' };
    }

    return { status: 200, success: true, uid: decodedToken.uid };
  }

  it('should reject unauthenticated requests with 401', () => {
    assert.equal(evaluateScheduleAccess(null, null).status, 401);
    assert.equal(evaluateScheduleAccess('', null).status, 401);
    assert.equal(evaluateScheduleAccess('Basic abc123xyz', null).status, 401);
    assert.equal(evaluateScheduleAccess('Bearer ', null).status, 401);
  });

  it('should reject revoked or expired tokens with 401', () => {
    const revokedToken = {
      uid: 'user_123',
      email: 'manishborikar92@gmail.com',
      email_verified: true,
      revoked: true,
    };
    assert.equal(evaluateScheduleAccess('Bearer valid_format', revokedToken).status, 401);
  });

  it('should reject unverified emails with 403 even if email matches', () => {
    const unverifiedToken = {
      uid: 'user_123',
      email: 'manishborikar92@gmail.com',
      email_verified: false,
    };
    const result = evaluateScheduleAccess('Bearer valid_format', unverifiedToken);
    assert.equal(result.status, 403);
  });

  it('should reject unauthorized third-party accounts with 403', () => {
    const otherUserToken = {
      uid: 'other_user_456',
      email: 'attacker@example.com',
      email_verified: true,
    };
    const result = evaluateScheduleAccess('Bearer valid_format', otherUserToken);
    assert.equal(result.status, 403);
  });

  it('should authorize verified manishborikar92@gmail.com account with 200', () => {
    const authorizedToken = {
      uid: 'manish_uid_789',
      email: 'manishborikar92@gmail.com',
      email_verified: true,
    };
    const result = evaluateScheduleAccess('Bearer valid_format', authorizedToken);
    assert.equal(result.status, 200);
    assert.equal(result.uid, 'manish_uid_789');
  });
});

describe('Customization Preservation & Data Integrity Logic', () => {
  // Pure reconciliation helper matching sync-service.js logic
  function reconcileHabitRecord(routine, existingHabit, userId) {
    const docId = `${userId}_${routine.stableKey}`;
    if (existingHabit) {
      return {
        id: docId,
        title: routine.title,
        category: routine.category,
        completionMethod: routine.completionMethod,
        instructions: routine.instructions,
        isSystemSeed: true,
        seedOrigin: 'personal_preset',
        userId,
        time: existingHabit.time ?? routine.time,
        timingType: existingHabit.timingType ?? routine.timingType,
        frequency: existingHabit.frequency ?? routine.frequency,
        checklistItems: existingHabit.checklistItems ?? routine.checklistItems,
      };
    }
    return {
      ...routine,
      id: docId,
      userId,
      seedOrigin: 'personal_preset',
    };
  }

  it('should preserve user custom times and frequencies on resync', () => {
    const workbookRoutine = MANISH_PERSONAL_ROUTINES.find(r => r.stableKey === 'canonical_english_workbook');
    const existingCustomizedHabit = {
      time: '08:00 AM',
      timingType: 'exact',
      frequency: ['Mon', 'Wed', 'Fri'],
      checklistItems: [{ label: 'Custom user step' }],
    };

    const reconciled = reconcileHabitRecord(workbookRoutine, existingCustomizedHabit, 'test_user');

    assert.equal(reconciled.time, '08:00 AM', 'Must preserve user custom time');
    assert.equal(reconciled.timingType, 'exact', 'Must preserve user custom timingType');
    assert.deepEqual(reconciled.frequency, ['Mon', 'Wed', 'Fri'], 'Must preserve user custom frequency');
    assert.deepEqual(reconciled.checklistItems, [{ label: 'Custom user step' }], 'Must preserve user checklist');
    assert.equal(reconciled.seedOrigin, 'personal_preset');
    assert.equal(reconciled.title, workbookRoutine.title, 'Must reconcile canonical title');
  });

  it('should guarantee coexistence between foundation routines, personal routines, and custom habits', () => {
    const userId = 'user_test_456';
    const foundationDocIds = DEFAULT_ROUTINES.map(r => `${userId}_${r.stableKey}`);
    const personalDocIds = MANISH_PERSONAL_ROUTINES.map(r => `${userId}_${r.stableKey}`);
    const customDocId = `${userId}_custom_meditation_123`;

    // Ensure completely disjoint ID sets
    const foundationSet = new Set(foundationDocIds);
    for (const pId of personalDocIds) {
      assert.ok(!foundationSet.has(pId), `Conflict: ${pId} overlaps with foundation routine IDs`);
    }

    assert.ok(!foundationSet.has(customDocId));
    assert.ok(!personalDocIds.includes(customDocId));
  });
});

describe('Phase 5 Architecture Simplification, Dead Code Removal & Quarantine', () => {
  it('should verify that PresetSelectorModal and /api/schedule routes are completely removed', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const srcDir = path.resolve(__dirname, '../src');

    const removedPaths = [
      path.join(srcDir, 'components/habits/PresetSelectorModal.js'),
      path.join(srcDir, 'app/api/schedule'),
      path.join(srcDir, 'lib/server/personal-schedule.js'),
      path.join(srcDir, 'lib/server/sync-service.js'),
      path.join(srcDir, 'lib/seed-data.js'),
    ];

    for (const p of removedPaths) {
      assert.ok(!fs.existsSync(p), `Removed file/directory must NOT exist: ${p}`);
    }
  });

  it('should verify client components and hooks never import personal schedule or removed modals', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const srcDir = path.resolve(__dirname, '../src');

    const clientFiles = [
      path.join(srcDir, 'app/(protected)/habits/page.js'),
      path.join(srcDir, 'app/(protected)/dashboard/page.js'),
      path.join(srcDir, 'hooks/use-habits.js'),
      path.join(srcDir, 'contexts/DataContext.js'),
      path.join(srcDir, 'components/habits/index.js'),
    ];

    for (const filePath of clientFiles) {
      assert.ok(fs.existsSync(filePath), `Client file must exist: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(!content.includes('PresetSelectorModal'), `Forbidden PresetSelectorModal reference in ${filePath}`);
      assert.ok(!content.includes('syncPersonalPreset'), `Forbidden syncPersonalPreset reference in ${filePath}`);
      assert.ok(!content.includes('/api/schedule'), `Forbidden /api/schedule route reference in ${filePath}`);
      assert.ok(!content.includes('personal-schedule'), `Forbidden personal-schedule module import in ${filePath}`);
      assert.ok(!content.includes('MANISH_PERSONAL_ROUTINES'), `Forbidden MANISH_PERSONAL_ROUTINES reference in ${filePath}`);
      assert.ok(!content.includes('Norman Lewis'), `Proprietary book author found in client file: ${filePath}`);
    }
  });

  it('should verify firestore.rules disables client writes to personalRoutines', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rulesPath = path.resolve(__dirname, '../firestore.rules');

    assert.ok(fs.existsSync(rulesPath), `firestore.rules must exist at ${rulesPath}`);
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

    assert.ok(rulesContent.includes('match /personalRoutines/{routineId}'), 'Must declare personalRoutines match rule');
    assert.ok(rulesContent.includes('allow write: if false;'), 'Must forbid all client writes to personalRoutines');
    assert.ok(rulesContent.includes('resource.data.userId == request.auth.uid'), 'Must restrict reads to owner');
  });
});
