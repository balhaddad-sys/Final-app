/**
 * Form Validation Utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate required field
 */
export function isRequired(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

/**
 * Validate minimum length
 */
export function minLength(value, min) {
  if (!value) return false;
  return String(value).trim().length >= min;
}

/**
 * Validate maximum length
 */
export function maxLength(value, max) {
  if (!value) return true;
  return String(value).trim().length <= max;
}

/**
 * Validate MRN format (alphanumeric)
 */
export function isValidMRN(mrn) {
  if (!mrn) return true; // Optional field
  return /^[a-zA-Z0-9-]+$/.test(mrn.trim());
}

/**
 * Validate patient data
 */
export function validatePatient(data) {
  const errors = [];

  if (!isRequired(data.name)) {
    errors.push('Patient name is required');
  } else if (!minLength(data.name, 2)) {
    errors.push('Patient name must be at least 2 characters');
  }

  if (data.mrn && !isValidMRN(data.mrn)) {
    errors.push('MRN must contain only letters, numbers, and dashes');
  }

  if (data.age && (data.age < 0 || data.age > 150)) {
    errors.push('Age must be between 0 and 150');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate task data
 */
export function validateTask(data) {
  const errors = [];

  if (!isRequired(data.text)) {
    errors.push('Task description is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate unit data
 */
export function validateUnit(data) {
  const errors = [];

  if (!isRequired(data.name)) {
    errors.push('Ward name is required');
  } else if (!minLength(data.name, 2)) {
    errors.push('Ward name must be at least 2 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
