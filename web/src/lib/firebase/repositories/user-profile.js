/**
 * Cloud Firestore User Profile & HabitState Repository.
 */

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config.js';
import { sanitizeForFirestore } from '../utils/sanitizer.js';

/**
 * Get reference to user profile / long-term progress document.
 * @param {string} userId
 */
export function getUserRef(userId) {
  return doc(db, 'users', userId);
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
