/**
 * Safe Error Presentation and Secure Diagnostic Logging.
 * 
 * Maps internal database, authentication, and validation exceptions
 * into safe, helpful, user-friendly messages for toasts and UI alerts,
 * strictly preventing the leakage of internal database schemas, exception
 * traces, or configuration details to user-facing screens.
 */

/**
 * Returns a safe, user-friendly error message appropriate for production display.
 * 
 * @param {Error|Object|string} err - The captured exception or error object
 * @returns {string} Safe user-facing message
 */
export function getSafeSaveErrorMessage(err) {
  if (!err) return 'Unable to save routine. Please try again.';
  const code = String(err.code || '');
  const message = String(err.message || '');

  if (code === 'permission-denied' || message.includes('permission-denied')) {
    return 'Permission denied: Please ensure you are signed in and try again.';
  }
  if (code === 'unavailable' || message.includes('network') || message.includes('offline')) {
    return 'Network error: Unable to reach the server. Please check your connection and try again.';
  }
  if (err.name === 'ValidationError' || message.includes('Validation') || message.includes('required')) {
    return 'Validation error: Please review the required routine fields and try again.';
  }
  // Safe production fallback preventing leakage of internal exception details or DB schema
  return 'Unable to save routine. Please check your inputs and try again.';
}

/**
 * Logs structured diagnostic information in development and monitoring without
 * leaking details to user toasts.
 * 
 * @param {string} context - Context descriptor (e.g. '[RoutinePersistenceError]')
 * @param {Error|Object} err - Error object
 */
export function logDiagnosticError(context, err) {
  console.error(context, {
    name: err?.name,
    code: err?.code,
    message: err?.message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err?.stack } : {}),
  });
}
