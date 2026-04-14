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
    const initializeAuth = async () => {
      const token = authService.getStoredToken();
      
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setIsAuthenticated(true);
          setUser(userData);
        } catch (error) {
          authService.clearToken();
          setIsAuthenticated(false);
          setUser(null);
        }
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
      const { user: userData } = await authService.login({ username, password });
      
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

  const updateProfile = async (profileData) => {
    const updatedUser = await authService.updateProfile(profileData);
    setUser(updatedUser);
    return updatedUser;
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    handleOAuth2Callback,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
