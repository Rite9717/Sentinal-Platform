import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OAuth2CallbackPage from './OAuth2CallbackPage';
import { mockNavigate, mockSearchParams } from 'react-router-dom';

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

// Mock AuthContext
const mockHandleOAuth2Callback = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: () => ({
    handleOAuth2Callback: mockHandleOAuth2Callback
  })
}));

describe('OAuth2CallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete('token');
    mockSearchParams.delete('error');
  });

  describe('Successful authentication', () => {
    it('should extract token from URL and call handleOAuth2Callback', async () => {
      mockSearchParams.set('token', 'test-jwt-token');

      render(<OAuth2CallbackPage />);

      await waitFor(() => {
        expect(mockHandleOAuth2Callback).toHaveBeenCalledWith('test-jwt-token');
      });
    });

    it('should redirect to dashboard on success', async () => {
      mockSearchParams.set('token', 'test-jwt-token');

      render(<OAuth2CallbackPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should display success message', () => {
      mockSearchParams.set('token', 'test-jwt-token');

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('Authentication Successful')).toBeInTheDocument();
      expect(screen.getByText('Redirecting to dashboard...')).toBeInTheDocument();
    });
  });

  describe('Failed authentication', () => {
    it('should display error message when error parameter is present', () => {
      mockSearchParams.set('error', 'access_denied');

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Google authentication failed. Please try again.')).toBeInTheDocument();
    });

    it('should redirect to login with error when error parameter is present', async () => {
      mockSearchParams.set('error', 'access_denied');

      render(<OAuth2CallbackPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: { error: 'Google authentication failed. Please try again.' }
        });
      }, { timeout: 3000 });
    });

    it('should display error message when token is missing', () => {
      // No token or error parameter

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed. No token received.')).toBeInTheDocument();
    });

    it('should redirect to login when token is missing', async () => {
      // No token or error parameter

      render(<OAuth2CallbackPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: { error: 'Authentication failed. No token received.' }
        });
      }, { timeout: 3000 });
    });

    it('should handle errors from handleOAuth2Callback', async () => {
      mockSearchParams.set('token', 'test-jwt-token');
      mockHandleOAuth2Callback.mockImplementation(() => {
        throw new Error('Token processing failed');
      });

      render(<OAuth2CallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to process authentication. Please try again.')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: { error: 'Failed to process authentication. Please try again.' }
        });
      }, { timeout: 3000 });
    });

    it('should not call handleOAuth2Callback when error parameter is present', () => {
      mockSearchParams.set('error', 'access_denied');

      render(<OAuth2CallbackPage />);

      expect(mockHandleOAuth2Callback).not.toHaveBeenCalled();
    });

    it('should not call handleOAuth2Callback when token is missing', () => {
      // No token or error parameter

      render(<OAuth2CallbackPage />);

      expect(mockHandleOAuth2Callback).not.toHaveBeenCalled();
    });
  });

  describe('UI rendering', () => {
    it('should display success icon when authentication succeeds', () => {
      mockSearchParams.set('token', 'test-jwt-token');

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should display error icon when authentication fails', () => {
      mockSearchParams.set('error', 'access_denied');

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('❌')).toBeInTheDocument();
    });

    it('should display redirecting message on error', () => {
      mockSearchParams.set('error', 'access_denied');

      render(<OAuth2CallbackPage />);

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    });
  });
});
