import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import authService from '../services/authService';

// Mock the authService
jest.mock('../services/authService');

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
    authService.getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'USER'
    });
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });

    it('returns context value when used within AuthProvider', () => {
      authService.getStoredToken.mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('handleOAuth2Callback');
      expect(result.current).toHaveProperty('updateProfile');
    });
  });

  describe('Initialization', () => {
    it('initializes with unauthenticated state when no token exists', async () => {
      authService.getStoredToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });

    it('initializes with authenticated state when token exists in localStorage', async () => {
      authService.getStoredToken.mockReturnValue('mock-jwt-token');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(authService.getStoredToken).toHaveBeenCalled();
      expect(authService.getCurrentUser).toHaveBeenCalled();
    });

    it('sets loading to false after initialization', async () => {
      authService.getStoredToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Loading state transitions quickly, so we just verify it ends up false
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('login method', () => {
    it('calls authService.login with credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };
      
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockResolvedValue({
        token: 'mock-jwt-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(authService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      });
    });

    it('updates state to authenticated after successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };
      
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockResolvedValue({
        token: 'mock-jwt-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('returns user data after successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };
      
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockResolvedValue({
        token: 'mock-jwt-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let userData;
      await act(async () => {
        userData = await result.current.login('testuser', 'password123');
      });

      expect(userData).toEqual(mockUser);
    });

    it('throws error when login fails', async () => {
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockRejectedValue('Invalid username or password.');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.login('testuser', 'wrongpassword');
        });
      }).rejects.toEqual('Invalid username or password.');
    });

    it('does not update state when login fails', async () => {
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockRejectedValue('Invalid username or password.');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.login('testuser', 'wrongpassword');
        });
      } catch (error) {
        // Expected error
      }

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('logout method', () => {
    it('calls authService.logout', async () => {
      authService.getStoredToken.mockReturnValue('mock-jwt-token');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.logout();
      });

      expect(authService.logout).toHaveBeenCalled();
    });

    it('clears authentication state', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };
      
      authService.getStoredToken.mockReturnValue(null);
      authService.login.mockResolvedValue({
        token: 'mock-jwt-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Login first
      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);

      // Then logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('handleOAuth2Callback method', () => {
    it('calls authService.storeToken with provided token', async () => {
      authService.getStoredToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.handleOAuth2Callback('oauth2-jwt-token');
      });

      expect(authService.storeToken).toHaveBeenCalledWith('oauth2-jwt-token');
    });

    it('updates state to authenticated after OAuth2 callback', async () => {
      authService.getStoredToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);

      act(() => {
        result.current.handleOAuth2Callback('oauth2-jwt-token');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('sets user to null after OAuth2 callback', async () => {
      authService.getStoredToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.handleOAuth2Callback('oauth2-jwt-token');
      });

      expect(result.current.user).toBe(null);
    });
  });
});
