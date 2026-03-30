import apiClient from './apiClient';

/**
 * Authentication service for handling all auth-related API calls
 * Manages JWT token storage and transforms backend errors to user-friendly messages
 */

const TOKEN_KEY = 'jwt_token';

/**
 * Register a new user
 * @param {Object} registrationData - User registration data
 * @param {string} registrationData.username - Username (3-50 chars, alphanumeric + underscore)
 * @param {string} registrationData.email - Email address
 * @param {string} registrationData.password - Password (8-100 chars)
 * @param {string} registrationData.fullName - Full name (2-100 chars)
 * @returns {Promise<Object>} User response data
 */
const register = async (registrationData) => {
  try {
    const response = await apiClient.post('/api/auth/register', registrationData);
    return response.data;
  } catch (error) {
    throw transformError(error);
  }
};

/**
 * Login with username and password
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @returns {Promise<Object>} Login response with token and user data
 */
const login = async (credentials) => {
  try {
    const response = await apiClient.post('/api/auth/login', credentials);
    const { token, user } = response.data;
    
    // Store token in localStorage
    storeToken(token);
    
    return { token, user };
  } catch (error) {
    throw transformError(error);
  }
};

/**
 * Logout the current user
 * Clears the JWT token from localStorage
 */
const logout = () => {
  clearToken();
};

/**
 * Get the stored JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
const getStoredToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Store JWT token in localStorage
 * @param {string} token - JWT token to store
 */
const storeToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Clear JWT token from localStorage
 */
const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Transform backend errors into user-friendly messages
 * @param {Error} error - Error object from axios
 * @returns {string} User-friendly error message
 */
const transformError = (error) => {
  // Network errors (backend unreachable, timeout, etc.)
  if (!error.response) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return 'Unable to connect to server. Please check your connection and try again.';
    }
    return 'Network error. Please check your connection and try again.';
  }

  const { status, data } = error.response;

  // 401 Unauthorized - Invalid credentials
  if (status === 401) {
    return 'Invalid username or password.';
  }

  // 409 Conflict - Duplicate username or email
  if (status === 409) {
    const message = data.message || '';
    if (message.toLowerCase().includes('username')) {
      return 'Username already exists.';
    }
    if (message.toLowerCase().includes('email')) {
      return 'Email already exists.';
    }
    return 'User already exists.';
  }

  // 400 Bad Request - Validation errors
  if (status === 400) {
    return data.message || 'Invalid input. Please check your data and try again.';
  }

  // 500 Internal Server Error
  if (status >= 500) {
    return 'Server error. Please try again later.';
  }

  // Default error message
  return data.message || 'An unexpected error occurred. Please try again.';
};

const authService = {
  register,
  login,
  logout,
  getStoredToken,
  storeToken,
  clearToken,
  transformError
};

export default authService;
