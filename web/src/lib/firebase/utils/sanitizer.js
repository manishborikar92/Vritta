/**
 * Cloud Firestore Data Sanitization Utility.
 * 
 * Recursively sanitizes data before writing to Firestore, stripping `undefined` fields
 * which cause Firestore SDK write operations to reject with Unsupported field value errors.
 * Preserves Date, FieldValue, and Firestore sentinel instances.
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
