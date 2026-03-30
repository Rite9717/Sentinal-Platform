/**
 * Client-side validation functions for authentication forms.
 * These functions match the backend validation constraints.
 */

/**
 * Validates username field.
 * @param {string} username - The username to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export const validateUsername = (username) => {
  if (!username || username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (username.length > 50) {
    return 'Username must not exceed 50 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
};

/**
 * Validates email field.
 * @param {string} email - The email to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export const validateEmail = (email) => {
  if (!email) {
    return 'Email is required';
  }
  if (email.length > 100) {
    return 'Email must not exceed 100 characters';
  }
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

/**
 * Validates password field.
 * @param {string} password - The password to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password.length > 100) {
    return 'Password must not exceed 100 characters';
  }
  return null;
};

/**
 * Validates full name field.
 * @param {string} fullName - The full name to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export const validateFullName = (fullName) => {
  if (!fullName || fullName.length < 2) {
    return 'Full name must be at least 2 characters';
  }
  if (fullName.length > 100) {
    return 'Full name must not exceed 100 characters';
  }
  return null;
};
