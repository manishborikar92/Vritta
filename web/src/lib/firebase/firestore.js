import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    deleteField,
    query,
    where,
    orderBy,
    serverTimestamp,
    runTransaction,
} from 'firebase/firestore';
import { db } from './config.js';
import {
    validateComposableHabit,
    validateDailyLogDoc,
    deriveTrackingHorizon,
    createScheduleHistoryEntry,
    ValidationError,
    PERSISTED_OUTCOME_STATUSES,
    clampCounterProgress,
    isHabitRestDay,
} from '../../domain/index.js';

/**
 * Build a Firestore query for a user's habits.
 * @param {string} userId
 */
export function getHabitsQuery(userId) {
    return query(
        collection(db, 'habits'),
        where('userId', '==', userId)
    );
}

/**
 * Get a reference to a user's daily log document.
 * Format: dailyLogs/{userId}_{dateStr}
 * @param {string} userId
 * @param {string} dateStr - Format: YYYY-MM-DD
 */
export function getDailyLogRef(userId, dateStr) {
    return doc(db, 'dailyLogs', `${userId}_${dateStr}`);
}

import {
    getUserRef,
    getHabitStateRef,
    fetchHabitState,
    saveHabitState,
    fetchAllHabitStates,
    fetchUserProfile,
    saveUserProfile,
} from './repositories/user-profile.js';

export {
    getUserRef,
    getHabitStateRef,
    fetchHabitState,
    saveHabitState,
    fetchAllHabitStates,
    fetchUserProfile,
    saveUserProfile,
};

import { sanitizeForFirestore } from './utils/sanitizer.js';
export { sanitizeForFirestore };

/**
 * Construct a canonical schedule sub-document.
 * Enforces strict whitelist of allowed schedule attributes.
 * Obsolete legacy fields (e.g. order) are completely excluded from the data model.
 * 
 * @param {Object} schedule 
 * @returns {Object} Canonical schedule
 */
export function buildCanonicalSchedule(schedule = {}) {
    if (!schedule || typeof schedule !== 'object') {
        return {
            frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            restDays: [],
            timingType: 'anytime',
            preferredPeriod: null,
            relativeTiming: null,
            exactTime: null,
        };
    }
    return {
        frequency: Array.isArray(schedule.frequency) ? [...schedule.frequency] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        restDays: Array.isArray(schedule.restDays) ? [...schedule.restDays] : [],
        timingType: schedule.timingType || 'anytime',
        preferredPeriod: schedule.preferredPeriod || null,
        relativeTiming: schedule.relativeTiming || null,
        exactTime: schedule.exactTime || null,
    };
}

/**
 * Construct a canonical habit payload for Cloud Firestore storage.
 * Enforces an explicit canonical whitelist contract:
 * - Obsolete ordering fields (e.g. order, schedule.order) cannot enter the data model
 * - Arbitrary invalid properties are excluded
 * - Nested objects (schedule, features, lifecycle) are strictly formatted
 * 
 * @param {Object} habitData 
 * @returns {Object} Clean canonical payload ready for Firestore
 */
export function buildCanonicalHabitPayload(habitData) {
    if (!habitData || typeof habitData !== 'object') {
        throw new ValidationError('Habit data must be a valid object.');
    }

    const payload = {};

    if (habitData.title !== undefined) payload.title = typeof habitData.title === 'string' ? habitData.title.trim() : '';
    if (habitData.category !== undefined) payload.category = habitData.category;
    if (habitData.customCategory !== undefined) payload.customCategory = habitData.customCategory;
    if (habitData.description !== undefined) payload.description = habitData.description;
    if (habitData.instructions !== undefined) payload.instructions = habitData.instructions;
    if (habitData.completionMethod !== undefined) payload.completionMethod = habitData.completionMethod;
    if (habitData.time !== undefined) payload.time = habitData.time;
    if (habitData.targetMinutes !== undefined) payload.targetMinutes = habitData.targetMinutes;

    if (habitData.frequency !== undefined) payload.frequency = Array.isArray(habitData.frequency) ? [...habitData.frequency] : [];
    if (habitData.checklistItems !== undefined) payload.checklistItems = Array.isArray(habitData.checklistItems) ? habitData.checklistItems : [];
    if (habitData.schedule !== undefined) payload.schedule = buildCanonicalSchedule(habitData.schedule);
    if (habitData.features !== undefined && typeof habitData.features === 'object') payload.features = habitData.features;
    if (habitData.lifecycle !== undefined && typeof habitData.lifecycle === 'object') payload.lifecycle = habitData.lifecycle;
    if (habitData.scheduleHistory !== undefined && Array.isArray(habitData.scheduleHistory)) payload.scheduleHistory = habitData.scheduleHistory;
    if (habitData.metadata !== undefined && typeof habitData.metadata === 'object') payload.metadata = habitData.metadata;

    if (habitData.seedOrigin !== undefined) payload.seedOrigin = habitData.seedOrigin;
    if (habitData.stableKey !== undefined) payload.stableKey = habitData.stableKey;
    if (habitData.templateReference !== undefined) payload.templateReference = habitData.templateReference;
    if (habitData.sourceTemplateId !== undefined) payload.sourceTemplateId = habitData.sourceTemplateId;
    if (habitData.templateCategory !== undefined) payload.templateCategory = habitData.templateCategory;
    if (habitData.templateDescription !== undefined) payload.templateDescription = habitData.templateDescription;
    if (habitData.tags !== undefined && Array.isArray(habitData.tags)) payload.tags = [...habitData.tags];
    if (habitData.archived !== undefined) payload.archived = Boolean(habitData.archived);
    if (habitData.archivedAt !== undefined) payload.archivedAt = habitData.archivedAt;
    if (habitData.deleted !== undefined) payload.deleted = Boolean(habitData.deleted);
    if (habitData.deletedAt !== undefined) payload.deletedAt = habitData.deletedAt;
    if (habitData.icon !== undefined) payload.icon = habitData.icon;
    if (habitData.color !== undefined) payload.color = habitData.color;

    return sanitizeForFirestore(payload);
}

/**
 * Create a new habit document with atomic sortOrder allocation.
 * Guarantees monotonic sequence (First Added, First Displayed) across concurrent tabs.
 * Safely recovers missing nextSortOrder counters from existing habit records.
 * 
 * @param {string} userId
 * @param {Object} habitData
 * @returns {Promise<DocumentReference>}
 */
export async function createHabit(userId, habitData) {
    if (!userId) throw new Error('User ID is required to create a habit.');

    const userRef = getUserRef(userId);

    // Fallback counter resolution if user document lacks nextSortOrder
    let fallbackBaseOrder = null;
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || typeof userSnap.data()?.nextSortOrder !== 'number' || userSnap.data().nextSortOrder < 1) {
        const habitsSnap = await getDocs(getHabitsQuery(userId));
        let maxOrder = 0;
        habitsSnap.forEach(d => {
            const data = d.data();
            const val = typeof data?.sortOrder === 'number' ? data.sortOrder : 0;
            if (val > maxOrder) {
                maxOrder = val;
            }
        });
        fallbackBaseOrder = maxOrder + 1;
    }

    const canonicalPayload = buildCanonicalHabitPayload(habitData);
    const newHabitRef = doc(collection(db, 'habits'));

    await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        let allocatedOrder;

        if (userDoc.exists() && typeof userDoc.data()?.nextSortOrder === 'number' && userDoc.data().nextSortOrder >= 1) {
            allocatedOrder = userDoc.data().nextSortOrder;
        } else {
            allocatedOrder = fallbackBaseOrder || 1;
        }

        const nextSortOrder = allocatedOrder + 1;

        const habitToSave = {
            ...canonicalPayload,
            userId,
            sortOrder: allocatedOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        transaction.set(userRef, { nextSortOrder, updatedAt: serverTimestamp() }, { merge: true });
        transaction.set(newHabitRef, habitToSave);
    });

    return newHabitRef;
}

/**
 * Update an existing habit document.
 * Guarantees sortOrder, createdAt, and userId cannot be modified by habit updates.
 * Canonical data contracts strictly prevent obsolete ordering fields from entering Firestore.
 * 
 * @param {string} habitId
 * @param {Object} habitData
 */
export async function updateHabitDoc(habitId, habitData) {
    if (!habitId) throw new Error('Habit ID is required to update a habit.');
    const canonicalPayload = buildCanonicalHabitPayload(habitData);
    delete canonicalPayload.sortOrder;
    delete canonicalPayload.createdAt;
    delete canonicalPayload.userId;

    return updateDoc(doc(db, 'habits', habitId), {
        ...canonicalPayload,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a habit document.
 * @param {string} habitId
 */
export async function deleteHabitDoc(habitId) {
    return deleteDoc(doc(db, 'habits', habitId));
}

/**
 * Atomically swap the sortOrder of two habits using a Firestore transaction.
 * Guarantees race-condition safety and serialization under rapid or concurrent user interactions.
 * 
 * Invariants:
 * 1. Executes in a Firestore transaction to read current sortOrders before writing.
 * 2. Rejects if either document no longer exists.
 * 3. Preserves ownership invariant (both habits must belong to the same user).
 * 4. Stale-Inversion Protection:
 *    - Moving A 'up' past B strictly requires current orderA > orderB. If orderA <= orderB,
 *      A is already ahead of B; executing swap would erroneously move A DOWN.
 *    - Moving A 'down' past B strictly requires current orderA < orderB. If orderA >= orderB,
 *      A is already behind B; executing swap would erroneously move A UP.
 * 5. Does not alter nextSortOrder on the user document (N+1 append monotonic property remains intact).
 * 
 * @param {string} habitIdA 
 * @param {string} habitIdB 
 * @param {Object} [options] - Optional validation options
 * @param {'up'|'down'} [options.direction] - Direction of movement for habitIdA
 * @param {number} [options.expectedCurrentOrder] - Expected current sortOrder for habitIdA
 * @param {number} [options.expectedTargetOrder] - Expected current sortOrder for habitIdB
 * @returns {Promise<{ swapped: boolean, reason?: string, orderA?: number, orderB?: number }>}
 */
export async function swapHabitsSortOrder(habitIdA, habitIdB, options = {}) {
    if (!habitIdA || !habitIdB) {
        throw new Error('Both habit IDs are required to swap display order.');
    }
    if (habitIdA === habitIdB) return { swapped: false, reason: 'identical_ids' };

    const { direction, expectedCurrentOrder, expectedTargetOrder } = options;
    const refA = doc(db, 'habits', habitIdA);
    const refB = doc(db, 'habits', habitIdB);

    return runTransaction(db, async (transaction) => {
        const docSnapA = await transaction.get(refA);
        const docSnapB = await transaction.get(refB);

        if (!docSnapA.exists() || !docSnapB.exists()) {
            throw new Error('Cannot reorder: one or both habits do not exist.');
        }

        const dataA = docSnapA.data();
        const dataB = docSnapB.data();

        if (dataA.userId !== dataB.userId) {
            throw new Error('Cannot swap habits belonging to different users.');
        }

        const orderA = typeof dataA.sortOrder === 'number' ? dataA.sortOrder : 1;
        const orderB = typeof dataB.sortOrder === 'number' ? dataB.sortOrder : 2;

        // Guard against stale directional requests:
        // Moving A 'up' past B requires A to currently be after B (orderA > orderB).
        // If orderA <= orderB, A is already ahead of B; executing swap would move A DOWN.
        if (direction === 'up' && orderA <= orderB) {
            return { swapped: false, reason: 'already_ahead', orderA, orderB };
        }

        // Moving A 'down' past B requires A to currently be before B (orderA < orderB).
        // If orderA >= orderB, A is already behind B; executing swap would move A UP.
        if (direction === 'down' && orderA >= orderB) {
            return { swapped: false, reason: 'already_behind', orderA, orderB };
        }

        // Validate expected orders if provided
        if (expectedCurrentOrder !== undefined && orderA !== expectedCurrentOrder) {
            return { swapped: false, reason: 'stale_current_order', orderA, expectedCurrentOrder };
        }
        if (expectedTargetOrder !== undefined && orderB !== expectedTargetOrder) {
            return { swapped: false, reason: 'stale_target_order', orderB, expectedTargetOrder };
        }

        transaction.update(refA, {
            sortOrder: orderB,
            updatedAt: serverTimestamp(),
        });
        transaction.update(refB, {
            sortOrder: orderA,
            updatedAt: serverTimestamp(),
        });

        return { swapped: true, orderA: orderB, orderB: orderA };
    });
}

/**
 * Toggle a habit's binary completion status for a given day.
 * Idempotently updates the daily log and creates the document if it doesn't exist.
 * Preserves all existing granular habitProgress for other activities.
 * 
 * @param {string} userId
 * @param {string} dateStr
 * @param {string} habitId
 * @param {boolean} isCurrentlyCompleted
 */
export async function toggleHabitCompletion(userId, dateStr, habitId, isCurrentlyCompleted, options = {}) {
    const habit = options?.habit || (options && typeof options === 'object' && options.schedule ? options : null);
    const timezone = options?.timezone || habit?.timezone || 'UTC';

    if (!isCurrentlyCompleted && habit && isHabitRestDay(habit, dateStr, timezone)) {
        // Routine is in a planned rest state for this date; rest days are neutral and cannot be marked complete
        return null;
    }

    const dailyLogRef = getDailyLogRef(userId, dateStr);

    return setDoc(dailyLogRef, {
        userId,
        date: dateStr,
        completedHabitIds: isCurrentlyCompleted
            ? arrayRemove(habitId)
            : arrayUnion(habitId),
        habitOutcomes: {
            [habitId]: isCurrentlyCompleted
                ? deleteField()
                : {
                    status: 'completed',
                    recordedAt: new Date().toISOString(),
                },
        },
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Record an explicit outcome status for a habit on a given day.
 * Synchronizes with habitOutcomes and completedHabitIds.
 * 
 * @param {string} userId
 * @param {string} dateStr
 * @param {string} habitId
 * @param {'completed'|'skipped'|'missed'|null} outcomeStatus
 * @param {string} [reason]
 */
export async function setDailyHabitOutcome(userId, dateStr, habitId, outcomeStatus, reason = null) {
    const dailyLogRef = getDailyLogRef(userId, dateStr);

    const updatePayload = {
        userId,
        date: dateStr,
        updatedAt: serverTimestamp(),
    };

    if (outcomeStatus === 'completed') {
        updatePayload.completedHabitIds = arrayUnion(habitId);
        updatePayload.habitOutcomes = {
            [habitId]: {
                status: 'completed',
                recordedAt: new Date().toISOString(),
                ...(reason ? { reason } : {}),
            },
        };
    } else if (outcomeStatus === 'skipped') {
        updatePayload.completedHabitIds = arrayRemove(habitId);
        updatePayload.habitOutcomes = {
            [habitId]: {
                status: 'skipped',
                recordedAt: new Date().toISOString(),
                ...(reason ? { reason } : {}),
            },
        };
    } else if (outcomeStatus === 'missed') {
        updatePayload.completedHabitIds = arrayRemove(habitId);
        updatePayload.habitOutcomes = {
            [habitId]: {
                status: 'missed',
                recordedAt: new Date().toISOString(),
                ...(reason ? { reason } : {}),
            },
        };
    } else if (outcomeStatus === 'rest') {
        updatePayload.completedHabitIds = arrayRemove(habitId);
        updatePayload.habitOutcomes = {
            [habitId]: {
                status: 'rest',
                recordedAt: new Date().toISOString(),
                ...(reason ? { reason } : {}),
            },
        };
    } else {
        // Clear outcome
        updatePayload.completedHabitIds = arrayRemove(habitId);
        updatePayload.habitOutcomes = {
            [habitId]: deleteField(),
        };
        updatePayload[`habitOutcomes.${habitId}`] = deleteField();
    }

    return setDoc(dailyLogRef, updatePayload, { merge: true });
}

/**
 * Record granular progress for an activity (e.g., workbook session count, review done,
 * exercise checklist steps, reading timer, or private diary entry).
 * Idempotently updates the daily log and synchronizes binary completion.
 * 
 * @param {string} userId
 * @param {string} dateStr
 * @param {string} habitId
 * @param {Object} progressDetails - Granular activity details
 * @param {boolean} [isFullyCompleted] - Whether the activity now satisfies completion requirements
 */
export async function updateDailyHabitProgress(userId, dateStr, habitId, progressDetails, isFullyCompleted, options = {}) {
    if (!userId || !dateStr || !habitId) return null;

    const habit = options?.habit || (options && typeof options === 'object' && options.schedule ? options : null);
    const timezone = options?.timezone || habit?.timezone || 'UTC';
    const isRest = options?.isRest || (habit ? isHabitRestDay(habit, dateStr, timezone) : false);

    // Reject all writes on rest days:
    // A planned rest day is neutral and its progress state is strictly immutable.
    if (isRest) {
        return null;
    }

    const effectiveCompleted = Boolean(isFullyCompleted);

    const dailyLogRef = getDailyLogRef(userId, dateStr);

    const updatePayload = {
        userId,
        date: dateStr,
        habitProgress: {
            [habitId]: {
                ...progressDetails,
                updatedAt: new Date().toISOString(),
            },
        },
        updatedAt: serverTimestamp(),
    };

    if (typeof effectiveCompleted === 'boolean') {
        if (effectiveCompleted) {
            updatePayload.completedHabitIds = arrayUnion(habitId);
            updatePayload.habitOutcomes = {
                [habitId]: {
                    status: 'completed',
                    recordedAt: new Date().toISOString(),
                },
            };
        } else {
            updatePayload.completedHabitIds = arrayRemove(habitId);
            updatePayload.habitOutcomes = {
                [habitId]: deleteField(),
            };
            updatePayload[`habitOutcomes.${habitId}`] = deleteField();
        }
    }

    return setDoc(dailyLogRef, sanitizeForFirestore(updatePayload), { merge: true });
}

/**
 * Idempotent Seed: Seed or update foundation routines for a user.
 * Running this multiple times NEVER duplicates habits and NEVER wipes existing user records.
 * Uses deterministic document IDs derived from the routine's stableKey.
 * 
 * @param {string} userId
 * @param {Array<Object>} seedData
 * @returns {Promise<Array<string>>} List of document IDs upserted
 */
export async function seedHabitsForUser(userId, seedData) {
    if (!userId) throw new Error('User ID is required to seed routines.');
    if (!Array.isArray(seedData) || seedData.length === 0) return [];

    // Query existing habits for this user in a single request
    const existingSnap = await getDocs(getHabitsQuery(userId));

    // Strict guard: Seeding foundation routines is only permitted when the user has zero routines or habits.
    // If routines already exist (foundation, personalized, or custom), return early without writing.
    if (!existingSnap.empty) {
        return existingSnap.docs.map(docSnap => docSnap.id);
    }

    const promises = seedData.map(async (habit, index) => {
        // Deterministic document ID based on stableKey or index
        const key = habit.stableKey || `routine_${index + 1}`;
        const docId = `${userId}_${key}`;
        const habitRef = doc(db, 'habits', docId);

        const canonicalPayload = buildCanonicalHabitPayload(habit);

        const dataToSave = {
            ...canonicalPayload,
            id: docId,
            userId,
            sortOrder: index + 1,
            seedOrigin: habit.seedOrigin || 'foundation_preset',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // merge: true preserves any extra custom fields if written concurrently
        await setDoc(habitRef, dataToSave, { merge: true });
        return docId;
    });

    const docIds = await Promise.all(promises);

    // Initialize nextSortOrder counter on user document
    await setDoc(getUserRef(userId), {
        nextSortOrder: seedData.length + 1,
        updatedAt: serverTimestamp(),
    }, { merge: true });

    return docIds;
}

/**
 * Fetch historical daily logs for a user.
 * Queries by userId only (avoiding composite index requirement) and sorts safely in memory.
 * @param {string} userId
 * @returns {Promise<Object>} Map of dateStr -> { completedHabitIds: string[], habitProgress: Object }
 */
export async function fetchHistoricalLogs(userId) {
    const logsQuery = query(
        collection(db, 'dailyLogs'),
        where('userId', '==', userId)
    );
    const snapshot = await getDocs(logsQuery);

    const logsMap = {};
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date) {
            logsMap[data.date] = {
                completedHabitIds: data.completedHabitIds || [],
                habitProgress: data.habitProgress || {},
                habitOutcomes: data.habitOutcomes || {},
            };
        }
    });
    return logsMap;
}

// User profile & decoupled habitState functions are imported and re-exported above from ./repositories/user-profile.js

// ============================================================================
// Phase 1: Canonical Normalizers & Serializers
// ============================================================================

/**
 * Normalize a Firestore habit document into the canonical ComposableHabitModel.
 * Transparently supports both modern composable documents and legacy specialized routines.
 * 
 * @param {Object} data - Raw Firestore document data
 * @param {string} [id] - Document ID
 * @returns {Object|null} Canonical ComposableHabitModel
 */
export function normalizeHabitFromFirestore(data, id) {
    if (!data) return null;
    const docId = id || data.id || '';

    // If already in composable format (has features object)
    if (data.features && typeof data.features === 'object') {
        const schedule = {
            frequency: Array.isArray(data.schedule?.frequency) && data.schedule.frequency.length > 0
                ? [...data.schedule.frequency]
                : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            timingType: data.schedule?.timingType || 'anytime',
            preferredPeriod: data.schedule?.preferredPeriod || null,
            relativeTiming: data.schedule?.relativeTiming || null,
            exactTime: data.schedule?.exactTime || null,
            restDays: Array.isArray(data.schedule?.restDays) ? [...data.schedule.restDays] : [],
        };

        const trackingHorizon = data.lifecycle?.trackingHorizon || deriveTrackingHorizon(data, [], data.timezone || 'UTC');

        const scheduleHistory = Array.isArray(data.scheduleHistory) && data.scheduleHistory.length > 0
            ? [...data.scheduleHistory]
            : [createScheduleHistoryEntry(schedule, trackingHorizon.startDate || '1970-01-01')];

        return {
            id: docId,
            userId: data.userId || '',
            title: data.title || '',
            description: data.description || '',
            category: data.category || 'Health & Fitness',
            icon: data.icon || null,
            color: data.color || null,
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 1,
            schedule,
            scheduleHistory,
            features: {
                counter: data.features.counter ? { enabled: Boolean(data.features.counter.enabled), ...data.features.counter } : { enabled: false },
                timer: data.features.timer ? { enabled: Boolean(data.features.timer.enabled), ...data.features.timer } : { enabled: false },
                checklist: data.features.checklist
                    ? { enabled: Boolean(data.features.checklist.enabled), items: Array.isArray(data.features.checklist.items) ? [...data.features.checklist.items] : [] }
                    : { enabled: false, items: [] },
                notes: data.features.notes ? { enabled: Boolean(data.features.notes.enabled), ...data.features.notes } : { enabled: false },
                catalog: data.features.catalog ? { enabled: Boolean(data.features.catalog.enabled), ...data.features.catalog } : { enabled: false },
                daySchedule: data.features.daySchedule ? { enabled: Boolean(data.features.daySchedule.enabled), ...data.features.daySchedule } : { enabled: false },
            },
            lifecycle: {
                createdAt: data.lifecycle?.createdAt || data.createdAt || null,
                updatedAt: data.lifecycle?.updatedAt || data.updatedAt || null,
                archived: Boolean(data.lifecycle?.archived ?? data.archived),
                archivedAt: data.lifecycle?.archivedAt || data.archivedAt || null,
                deleted: Boolean(data.lifecycle?.deleted ?? data.deleted),
                deletedAt: data.lifecycle?.deletedAt || data.deletedAt || null,
                trackingHorizon,
            },
            seedOrigin: data.seedOrigin || 'custom',
            templateReference: data.templateReference || null,
            stableKey: data.stableKey || docId,
        };
    }

    // Legacy routine normalization
    const schedule = {
        frequency: Array.isArray(data.frequency) && data.frequency.length > 0
            ? [...data.frequency]
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        timingType: data.timingType || 'anytime',
        preferredPeriod: data.preferredPeriod || null,
        relativeTiming: data.relativeTiming || null,
        exactTime: data.time && data.time !== 'Flexible' ? data.time : null,
        restDays: Array.isArray(data.metadata?.restDays) ? [...data.metadata.restDays] : [],
    };

    const trackingHorizon = deriveTrackingHorizon(data, [], data.timezone || 'UTC');
    const scheduleHistory = [createScheduleHistoryEntry(schedule, trackingHorizon.startDate || '1970-01-01')];

    const features = {
        counter: { enabled: false },
        timer: { enabled: false },
        checklist: { enabled: false, items: [] },
        notes: { enabled: false },
        catalog: { enabled: false },
        daySchedule: { enabled: false },
    };

    const completionMethod = data.completionMethod;

    if (completionMethod === 'workbook_sessions') {
        features.counter = {
            enabled: true,
            targetCount: data.metadata?.dailySessionsTarget || 2,
            unit: 'sessions',
            step: 1,
            minCount: 0,
        };
        if (Array.isArray(data.checklistItems) && data.checklistItems.length > 0) {
            features.checklist = {
                enabled: true,
                items: data.checklistItems.map((item, idx) => ({
                    id: `step_${idx + 1}`,
                    label: item.label,
                    isRequiredForCompletion: true,
                })),
            };
        }
    } else if (completionMethod === 'exercise_plan') {
        features.daySchedule = {
            enabled: true,
            planTitle: '12-Week Progressive Movement Plan',
            totalWeeks: 12,
            dayVariations: {},
        };
        if (!schedule.restDays.includes('Sun')) {
            schedule.restDays.push('Sun');
        }
    } else if (completionMethod === 'osho_listening') {
        features.catalog = {
            enabled: true,
            catalogId: 'osho_discourses',
            catalogTitle: 'Osho Discourses',
            totalItems: data.metadata?.libraryCount || 30,
            items: [],
        };
        features.timer = {
            enabled: data.features?.timer ? Boolean(data.features.timer.enabled) : Boolean(data.targetMinutes),
            targetDurationMinutes: data.targetMinutes || 30,
            mode: 'countdown',
        };
    } else if (completionMethod === 'reading_duration') {
        features.timer = {
            enabled: true,
            targetDurationMinutes: data.targetMinutes || 30,
            mode: 'countdown',
        };
    } else if (completionMethod === 'notes') {
        features.notes = {
            enabled: true,
            reflectionPrompts: data.metadata?.reflectivePrompts || data.metadata?.reflectionPrompts || [],
            placeholder: data.metadata?.placeholder || '',
        };
    } else if (Array.isArray(data.checklistItems) && data.checklistItems.length > 0) {
        features.checklist = {
            enabled: true,
            items: data.checklistItems.map((item, idx) => ({
                id: `step_${idx + 1}`,
                label: item.label,
                isRequiredForCompletion: false,
            })),
        };
    }

    return {
        id: docId,
        userId: data.userId || '',
        title: data.title || '',
        description: data.instructions || '',
        category: data.category || 'Health & Fitness',
        icon: null,
        color: null,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 1,
        schedule,
        scheduleHistory,
        features,
        lifecycle: {
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            archived: Boolean(data.archived),
            archivedAt: data.archivedAt || null,
            deleted: Boolean(data.deleted),
            deletedAt: data.deletedAt || null,
            trackingHorizon,
        },
        seedOrigin: data.seedOrigin || 'custom',
        templateReference: null,
        stableKey: data.stableKey || docId,
    };
}

/**
 * Serialize a ComposableHabitModel for Cloud Firestore storage.
 * Enforces validation and strips undefined values.
 * 
 * @param {Object} habit - ComposableHabitModel
 * @returns {Object} Clean document ready for Firestore
 */
export function serializeHabitForFirestore(habit) {
    if (!habit) throw new ValidationError('Habit object is required for serialization.');
    const validation = validateComposableHabit(habit);
    if (!validation.valid) {
        throw new ValidationError(`Habit validation failed: ${validation.errors.join('; ')}`, validation.errors);
    }

    const clean = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(clean);
        const res = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) {
                res[k] = clean(v);
            }
        }
        return res;
    };

    return clean({
        id: habit.id,
        userId: habit.userId,
        title: habit.title,
        description: habit.description || '',
        category: habit.category,
        icon: habit.icon || null,
        color: habit.color || null,
        sortOrder: typeof habit.sortOrder === 'number' ? habit.sortOrder : 1,
        schedule: {
            frequency: habit.schedule.frequency,
            timingType: habit.schedule.timingType || 'anytime',
            preferredPeriod: habit.schedule.preferredPeriod || null,
            relativeTiming: habit.schedule.relativeTiming || null,
            exactTime: habit.schedule.exactTime || null,
            restDays: habit.schedule.restDays || [],
        },
        scheduleHistory: habit.scheduleHistory || [],
        features: habit.features,
        lifecycle: habit.lifecycle,
        seedOrigin: habit.seedOrigin || 'custom',
        templateReference: habit.templateReference || null,
        stableKey: habit.stableKey || habit.id,
    });
}

/**
 * Normalize a Firestore dailyLog document into the domain NormalizedDailyLog representation.
 * 
 * Implements Layer 2 domain model:
 * - Authoritative Completion Precedence: If completedHabitIds has h and habitOutcomes has skipped/missed,
 *   completed takes absolute precedence and a warning is logged.
 * - Legacy Normalization: Habits in completedHabitIds receive { status: 'completed' }.
 * - Missing outcomes are NOT converted to explicit misses or persisted 'unrecorded_outcome'.
 * - In-memory getHabitStatus(habitId) derives 'completed' | 'skipped' | 'missed' | 'unrecorded'.
 * 
 * @param {Object} data - Raw Firestore document data
 * @param {string} [id] - Document ID
 * @returns {Object|null} Normalized domain daily log
 */
export function normalizeDailyLogFromFirestore(data, id) {
    if (!data) return null;
    const docId = id || data.id || '';
    const userId = data.userId || (docId.includes('_') ? docId.split('_')[0] : '');
    const date = data.date || (docId.includes('_') ? docId.split('_').slice(1).join('_') : '');
    const timezone = data.timezone || 'UTC';
    const completedHabitIds = Array.isArray(data.completedHabitIds) ? [...data.completedHabitIds] : [];
    const habitProgress = data.habitProgress && typeof data.habitProgress === 'object' ? { ...data.habitProgress } : {};

    const rawOutcomes = data.habitOutcomes && typeof data.habitOutcomes === 'object' ? { ...data.habitOutcomes } : {};
    const habitOutcomes = {};

    // Copy valid persisted outcomes first
    for (const [hId, out] of Object.entries(rawOutcomes)) {
        if (out && typeof out === 'object' && PERSISTED_OUTCOME_STATUSES.includes(out.status)) {
            habitOutcomes[hId] = { ...out };
        }
    }

    // Authoritative Completion Precedence & Legacy Normalization
    for (const completedId of completedHabitIds) {
        if (habitOutcomes[completedId]) {
            if (habitOutcomes[completedId].status !== 'completed') {
                console.warn(`[Normalization Warning] Conflicting habit outcome resolved to completed for ${completedId}`);
                habitOutcomes[completedId] = {
                    ...habitOutcomes[completedId],
                    status: 'completed',
                };
            }
        } else {
            habitOutcomes[completedId] = {
                status: 'completed',
                recordedAt: data.updatedAt || null,
            };
        }
    }

    return {
        id: docId,
        userId,
        date,
        timezone,
        habitOutcomes,
        completedHabitIds,
        habitProgress,
        dayFinalized: Boolean(data.dayFinalized),
        dayFinalizedAt: data.dayFinalizedAt || null,
        updatedAt: data.updatedAt || null,

        /**
         * Domain outcome resolver.
         * Derives 'unrecorded' at runtime for habits with no explicit outcome.
         * @param {string} habitId 
         * @returns {'completed'|'skipped'|'missed'|'unrecorded'}
         */
        getHabitStatus(habitId) {
            if (this.completedHabitIds.includes(habitId)) {
                return 'completed';
            }
            const outcome = this.habitOutcomes[habitId];
            if (outcome && (outcome.status === 'skipped' || outcome.status === 'missed')) {
                return outcome.status;
            }
            return 'unrecorded';
        },
    };
}

/**
 * Serialize a daily log for Cloud Firestore persistence.
 * 
 * Enforces the strict Layer 1 persisted schema invariant:
 * - habitOutcomes MUST ONLY store actual recorded states: 'completed' | 'skipped' | 'missed'
 * - 'unrecorded' or derived statuses are STRICTLY EXCLUDED
 * - Synchronizes completedHabitIds with habitOutcomes
 * 
 * @param {Object} logData - Daily log data
 * @returns {Object} Clean document ready for Firestore
 */
export function serializeDailyLogForFirestore(logData) {
    if (!logData) throw new ValidationError('Daily log data is required for serialization.');
    const validation = validateDailyLogDoc(logData);
    if (!validation.valid) {
        throw new ValidationError(`Daily log validation failed: ${validation.errors.join('; ')}`, validation.errors);
    }

    const cleanOutcomes = {};
    const completedSet = new Set(Array.isArray(logData.completedHabitIds) ? logData.completedHabitIds : []);

    if (logData.habitOutcomes && typeof logData.habitOutcomes === 'object') {
        for (const [habitId, outcome] of Object.entries(logData.habitOutcomes)) {
            if (outcome && typeof outcome === 'object' && PERSISTED_OUTCOME_STATUSES.includes(outcome.status)) {
                cleanOutcomes[habitId] = {
                    status: outcome.status,
                    recordedAt: outcome.recordedAt || new Date().toISOString(),
                    ...(outcome.reason ? { reason: outcome.reason } : {}),
                };

                if (outcome.status === 'completed') {
                    completedSet.add(habitId);
                } else {
                    completedSet.delete(habitId);
                }
            }
        }
    }

    return {
        id: logData.id || `${logData.userId}_${logData.date}`,
        userId: logData.userId,
        date: logData.date,
        timezone: logData.timezone || 'UTC',
        habitOutcomes: cleanOutcomes,
        completedHabitIds: Array.from(completedSet),
        habitProgress: logData.habitProgress || {},
        ...(typeof logData.dayFinalized === 'boolean' ? { dayFinalized: logData.dayFinalized } : {}),
        ...(logData.dayFinalizedAt ? { dayFinalizedAt: logData.dayFinalizedAt } : {}),
    };
}

import {
    fetchScheduleTemplates,
    fetchScheduleTemplateById,
} from './repositories/templates.js';

export {
    fetchScheduleTemplates,
    fetchScheduleTemplateById,
};

