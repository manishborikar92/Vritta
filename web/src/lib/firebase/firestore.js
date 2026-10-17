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
} from '../constants/habit-models.js';

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

/**
 * Get reference to user profile / long-term progress document.
 * @param {string} userId
 */
export function getUserRef(userId) {
    return doc(db, 'users', userId);
}

/**
 * Recursively sanitizes data before writing to Firestore, stripping `undefined` fields
 * which cause Firestore SDK write operations to reject with Unsupported field value errors.
 * Preserves Date, FieldValue, and Firestore sentinel instances.
 * 
 * @param {*} val
 * @returns {*}
 */
export function sanitizeForFirestore(val) {
    if (val === undefined) {
        return null;
    }
    if (val === null || typeof val !== 'object') {
        return val;
    }
    if (Array.isArray(val)) {
        return val
            .filter(item => item !== undefined)
            .map(item => sanitizeForFirestore(item));
    }
    if (val instanceof Date || (val.constructor && val.constructor.name !== 'Object')) {
        return val;
    }
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
            clean[k] = sanitizeForFirestore(v);
        }
    }
    return clean;
}

/**
 * Create a new habit document.
 * @param {string} userId
 * @param {Object} habitData
 */
export async function createHabit(userId, habitData) {
    const cleanHabitData = sanitizeForFirestore(habitData);
    return addDoc(collection(db, 'habits'), {
        ...cleanHabitData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Update an existing habit document.
 * @param {string} habitId
 * @param {Object} habitData
 */
export async function updateHabitDoc(habitId, habitData) {
    const cleanHabitData = sanitizeForFirestore(habitData);
    return updateDoc(doc(db, 'habits', habitId), {
        ...cleanHabitData,
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
 * Toggle a habit's binary completion status for a given day.
 * Idempotently updates the daily log and creates the document if it doesn't exist.
 * Preserves all existing granular habitProgress for other activities.
 * 
 * @param {string} userId
 * @param {string} dateStr
 * @param {string} habitId
 * @param {boolean} isCurrentlyCompleted
 */
export async function toggleHabitCompletion(userId, dateStr, habitId, isCurrentlyCompleted) {
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
export async function updateDailyHabitProgress(userId, dateStr, habitId, progressDetails, isFullyCompleted) {
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

    if (typeof isFullyCompleted === 'boolean') {
        if (isFullyCompleted) {
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

    return setDoc(dailyLogRef, updatePayload, { merge: true });
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

        const cleanHabit = {};
        for (const [k, v] of Object.entries(habit)) {
            if (v !== undefined) cleanHabit[k] = v;
        }

        const dataToSave = {
            ...cleanHabit,
            id: docId,
            userId,
            seedOrigin: habit.seedOrigin || 'foundation_preset',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // merge: true preserves any extra custom fields if written concurrently
        await setDoc(habitRef, dataToSave, { merge: true });
        return docId;
    });

    return Promise.all(promises);
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

/**
 * Get reference to a decoupled habitState document.
 * Format: users/{userId}/habitState/{habitId}
 * @param {string} userId
 * @param {string} habitId
 */
export function getHabitStateRef(userId, habitId) {
    return doc(db, 'users', userId, 'habitState', habitId);
}

/**
 * Fetch a single decoupled habitState document.
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<Object|null>}
 */
export async function fetchHabitState(userId, habitId) {
    if (!userId || !habitId) return null;
    try {
        const stateRef = getHabitStateRef(userId, habitId);
        const docSnap = await getDoc(stateRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
        console.error('Error fetching habit state:', err);
        return null;
    }
}

/**
 * Save decoupled habitState document.
 * @param {string} userId
 * @param {string} habitId
 * @param {Object} data
 */
export async function saveHabitState(userId, habitId, data) {
    if (!userId || !habitId) return;
    const cleanData = sanitizeForFirestore(data);
    const stateRef = getHabitStateRef(userId, habitId);
    return setDoc(stateRef, {
        ...cleanData,
        habitId,
        userId,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Fetch all decoupled habitState documents for a user.
 * @param {string} userId
 * @returns {Promise<Record<string, Object>>}
 */
export async function fetchAllHabitStates(userId) {
    if (!userId) return {};
    try {
        const stateCol = collection(db, 'users', userId, 'habitState');
        const snap = await getDocs(stateCol);
        const states = {};
        snap.forEach(d => {
            states[d.id] = d.data();
        });
        return states;
    } catch (err) {
        console.error('Error fetching all habit states:', err);
        return {};
    }
}

/**
 * Fetch user preferences and long-term progress (e.g. 12-week exercise plan, Osho progress).
 * In Phase 5 decoupled state architecture, seamlessly aggregates root user preferences with
 * isolated habitState subcollection documents.
 * 
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function fetchUserProfile(userId) {
    if (!userId) return null;
    try {
        const userRef = getUserRef(userId);
        const docSnap = await getDoc(userRef);
        const rootData = docSnap.exists() ? docSnap.data() : {};

        // In Phase 5 decoupled architecture, progression states live in /users/{userId}/habitState
        const habitStates = await fetchAllHabitStates(userId);

        // Merge decoupled progression into profile for seamless consumer backward-compatibility
        let exercisePlan = rootData.exercisePlan || null;
        let oshoSeriesProgress = rootData.oshoSeriesProgress || null;
        let activeOshoSeriesId = rootData.activeOshoSeriesId || null;

        for (const [docId, state] of Object.entries(habitStates)) {
            // Exercise plan identification (by currentWeek / startDate or ID)
            if (state.currentWeek !== undefined || state.startDate !== undefined || docId.includes('exercise_plan')) {
                exercisePlan = {
                    ...(exercisePlan || {}),
                    ...state,
                };
            }
            // Osho series identification (by seriesProgress or ID)
            if (state.seriesProgress !== undefined || state.oshoSeriesProgress !== undefined || docId.includes('listen_osho')) {
                const incomingSeries = state.seriesProgress || state.oshoSeriesProgress || {};
                oshoSeriesProgress = {
                    ...(oshoSeriesProgress || {}),
                    ...incomingSeries,
                };
                const activeId = state.activeSeriesId || state.activeOshoSeriesId;
                if (activeId) {
                    activeOshoSeriesId = activeId;
                }
            }
        }

        return {
            ...rootData,
            exercisePlan,
            oshoSeriesProgress,
            activeOshoSeriesId,
            habitState: habitStates,
        };
    } catch (err) {
        console.error('Error fetching user profile:', err);
        return null;
    }
}

/**
 * Save user preferences or long-term progress (e.g. activate 12-week plan, save Osho progress).
 * Synchronizes progression state directly into decoupled habitState subcollections.
 * 
 * @param {string} userId
 * @param {Object} data
 */
export async function saveUserProfile(userId, data) {
    if (!userId) return;
    const cleanData = sanitizeForFirestore(data);
    const userRef = getUserRef(userId);

    const promises = [];
    if (cleanData.exercisePlan) {
        const exerciseHabitId = `${userId}_canonical_exercise_plan`;
        promises.push(saveHabitState(userId, exerciseHabitId, cleanData.exercisePlan));
    }
    if (cleanData.oshoSeriesProgress || cleanData.seriesProgress || cleanData.activeOshoSeriesId || cleanData.activeSeriesId) {
        const oshoHabitId = `${userId}_canonical_listen_osho`;
        const oshoState = {};
        const incomingProgress = cleanData.oshoSeriesProgress || cleanData.seriesProgress;
        if (incomingProgress) {
            oshoState.seriesProgress = incomingProgress;
        }
        const incomingActiveId = cleanData.activeOshoSeriesId || cleanData.activeSeriesId;
        if (incomingActiveId) {
            oshoState.activeSeriesId = incomingActiveId;
        }
        promises.push(saveHabitState(userId, oshoHabitId, oshoState));
    }

    // Strip decoupled state fields so they are never written back to root /users/{userId}
    const rootProfileData = { ...cleanData };
    delete rootProfileData.exercisePlan;
    delete rootProfileData.oshoSeriesProgress;
    delete rootProfileData.seriesProgress;
    delete rootProfileData.activeOshoSeriesId;
    delete rootProfileData.activeSeriesId;
    delete rootProfileData.habitState;

    // Only update root user doc if non-progression preference fields remain
    if (Object.keys(rootProfileData).length > 0) {
        promises.push(setDoc(userRef, {
            ...rootProfileData,
            updatedAt: serverTimestamp(),
        }, { merge: true }));
    }

    await Promise.all(promises);
}

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
            order: typeof data.schedule?.order === 'number' ? data.schedule.order : (data.order || 0),
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
            category: data.category || 'English Learning',
            icon: data.icon || null,
            color: data.color || null,
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
        order: typeof data.order === 'number' ? data.order : 0,
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
            soundOnComplete: false,
        };
    } else if (completionMethod === 'reading_duration') {
        features.timer = {
            enabled: true,
            targetDurationMinutes: data.targetMinutes || 30,
            mode: 'countdown',
            soundOnComplete: true,
        };
    } else if (completionMethod === 'simple_with_notes') {
        features.notes = {
            enabled: true,
            isPrivateDiary: false,
            placeholder: 'Practice English speaking notes...',
        };
    } else if (completionMethod === 'diary_entry') {
        features.notes = {
            enabled: true,
            isPrivateDiary: true,
            reflectionPrompts: data.metadata?.reflectivePrompts || data.metadata?.reflectionPrompts || [],
            placeholder: 'Write in your personal diary...',
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
        category: data.category || 'English Learning',
        icon: null,
        color: null,
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
        schedule: {
            frequency: habit.schedule.frequency,
            timingType: habit.schedule.timingType || 'anytime',
            preferredPeriod: habit.schedule.preferredPeriod || null,
            relativeTiming: habit.schedule.relativeTiming || null,
            exactTime: habit.schedule.exactTime || null,
            restDays: habit.schedule.restDays || [],
            order: typeof habit.schedule.order === 'number' ? habit.schedule.order : 0,
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

/**
 * Fetch all shared schedule templates from Cloud Firestore.
 * Templates are read-only for authenticated users and contain reusable routine blueprints.
 * 
 * @returns {Promise<Array<Object>>}
 */
export async function fetchScheduleTemplates() {
    try {
        const templatesRef = collection(db, 'scheduleTemplates');
        const snap = await getDocs(templatesRef);
        if (snap.empty) {
            return [];
        }
        const templates = snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
        }));
        // Sort by schedule.order then title
        return templates.sort((a, b) => {
            const orderA = a.schedule?.order ?? 999;
            const orderB = b.schedule?.order ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.title || '').localeCompare(b.title || '');
        });
    } catch (err) {
        console.error('Error fetching schedule templates:', err);
        return [];
    }
}

/**
 * Fetch a single schedule template by its stable ID.
 * 
 * @param {string} templateId
 * @returns {Promise<Object|null>}
 */
export async function fetchScheduleTemplateById(templateId) {
    if (!templateId) return null;
    try {
        const docRef = doc(db, 'scheduleTemplates', templateId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return {
            id: snap.id,
            ...snap.data(),
        };
    } catch (err) {
        console.error(`Error fetching schedule template "${templateId}":`, err);
        return null;
    }
}

