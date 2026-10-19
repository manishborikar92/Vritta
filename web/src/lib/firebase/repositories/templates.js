/**
 * Cloud Firestore Templates Repository.
 */

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config.js';

/**
 * Fetch schedule templates from Firestore.
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
