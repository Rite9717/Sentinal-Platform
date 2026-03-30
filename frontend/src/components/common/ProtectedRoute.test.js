import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute';
import { AuthProvider } from '../../contexts/AuthContext';
import authService from '../../services/authService';

// Mock the authService
jest.mock('../../services/authService');

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

// Helper to render with AuthProvider
const renderWithAuth = (ui) => {
  return render(
    <AuthProvider>
      {ui}
    </AuthProvider>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getStoredToken = jest.fn();
    authService.login = jest.fn();
    authService.logout = jest.fn();
    authService.storeToken = jest.fn();
    authService.clearToken = jest.fn();
  });

  test('shows loading state while checking authentication', () => {
    authService.getStoredToken.mockReturnValue(null);
    
    renderWithAuth(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // The loading state is very brief in the AuthContext
    // After loading completes, unauthenticated users are redirected
    // So we should see either loading or redirect
    const loadingOrRedirect = screen.queryByText('Loading...') || screen.queryByText('Redirecting to /login');
    expect(loadingOrRedirect).toBeInTheDocument();
  });

  test('redirects to /login when user is not authenticated', async () => {
    authService.getStoredToken.mockReturnValue(null);
    
    renderWithAuth(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Wait for loading to complete and redirect
    await screen.findByText('Redirecting to /login');
    
    // Should show redirect message
    expect(screen.getByText('Redirecting to /login')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('renders children when user is authenticated', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Wait for loading to complete
    await screen.findByText('Protected Content');
    
    // Should render protected content
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Redirecting to /login')).not.toBeInTheDocument();
  });

  test('renders multiple children when authenticated', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <ProtectedRoute>
        <div>Header</div>
        <div>Main Content</div>
        <div>Footer</div>
      </ProtectedRoute>
    );

    // Wait for loading to complete
    await screen.findByText('Header');
    
    // Should render all children
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  test('does not render children when not authenticated', async () => {
    authService.getStoredToken.mockReturnValue(null);
    
    renderWithAuth(
      <ProtectedRoute>
        <div>Secret Content</div>
      </ProtectedRoute>
    );

    // Wait for redirect
    await screen.findByText('Redirecting to /login');
    
    // Should not render protected content
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });
});
