/**
 * Domain-level error classes for Vritta.
 */

export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
