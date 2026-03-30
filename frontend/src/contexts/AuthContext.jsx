import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

/**
 * Authentication Context
 * Provides global authentication state and methods to all components
 */
const AuthContext = createContext(null);

/**
 * Custom hook to use the AuthContext
 * @returns {Object} Auth context value with state and methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider component
 * Wraps the application and provides authentication state
 */
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Initialize authentication state on mount
   * Checks localStorage for existing token
   */
  useEffect(() => {
    const initializeAuth = () => {
      const token = authService.getStoredToken();
      
      if (token) {
        // Token exists, set authenticated state
        setIsAuthenticated(true);
        // Note: User data will be set after successful login/OAuth2 callback
        // or could be decoded from JWT token if needed
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  /**
   * Login with username and password
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} User data
   */
  const login = async (username, password) => {
    try {
      const { token, user: userData } = await authService.login({ username, password });
      
      // Update authentication state
      setIsAuthenticated(true);
      setUser(userData);
      
      return userData;
    } catch (error) {
      // Re-throw error to be handled by the calling component
      throw error;
    }
  };

  /**
   * Logout the current user
   * Clears authentication state and token
   */
  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  /**
   * Handle OAuth2 callback with token
   * Processes token from OAuth2 redirect
   * @param {string} token - JWT token from OAuth2 callback
   */
  const handleOAuth2Callback = (token) => {
    // Store token
    authService.storeToken(token);
    
    // Update authentication state
    setIsAuthenticated(true);
    // Note: User data could be decoded from token or fetched from API
    // For now, setting user to null as per design spec
    setUser(null);
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    handleOAuth2Callback
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
