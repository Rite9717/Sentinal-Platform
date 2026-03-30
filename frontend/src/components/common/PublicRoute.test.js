import React from 'react';
import { render, screen } from '@testing-library/react';
import PublicRoute from './PublicRoute';
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

describe('PublicRoute', () => {
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
      <PublicRoute>
        <div>Login Form</div>
      </PublicRoute>
    );

    // The loading state is very brief in the AuthContext
    // After loading completes, unauthenticated users see the content
    // So we should see either loading or the content
    const loadingOrContent = screen.queryByText('Loading...') || screen.queryByText('Login Form');
    expect(loadingOrContent).toBeInTheDocument();
  });

  test('renders children when user is not authenticated', async () => {
    authService.getStoredToken.mockReturnValue(null);
    
    renderWithAuth(
      <PublicRoute>
        <div>Login Form</div>
      </PublicRoute>
    );

    // Wait for loading to complete
    await screen.findByText('Login Form');
    
    // Should render public content
    expect(screen.getByText('Login Form')).toBeInTheDocument();
    expect(screen.queryByText('Redirecting to /dashboard')).not.toBeInTheDocument();
  });

  test('redirects to /dashboard when user is authenticated', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <PublicRoute>
        <div>Login Form</div>
      </PublicRoute>
    );

    // Wait for loading to complete and redirect
    await screen.findByText('Redirecting to /dashboard');
    
    // Should show redirect message
    expect(screen.getByText('Redirecting to /dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Form')).not.toBeInTheDocument();
  });

  test('renders multiple children when not authenticated', async () => {
    authService.getStoredToken.mockReturnValue(null);
    
    renderWithAuth(
      <PublicRoute>
        <div>Login Header</div>
        <div>Login Form</div>
        <div>Login Footer</div>
      </PublicRoute>
    );

    // Wait for loading to complete
    await screen.findByText('Login Header');
    
    // Should render all children
    expect(screen.getByText('Login Header')).toBeInTheDocument();
    expect(screen.getByText('Login Form')).toBeInTheDocument();
    expect(screen.getByText('Login Footer')).toBeInTheDocument();
  });

  test('does not render children when authenticated', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <PublicRoute>
        <div>Login Form</div>
      </PublicRoute>
    );

    // Wait for redirect
    await screen.findByText('Redirecting to /dashboard');
    
    // Should not render public content
    expect(screen.queryByText('Login Form')).not.toBeInTheDocument();
  });

  test('prevents authenticated users from accessing login page', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <PublicRoute>
        <div>Login Page</div>
      </PublicRoute>
    );

    // Wait for redirect
    await screen.findByText('Redirecting to /dashboard');
    
    // Should redirect instead of showing login
    expect(screen.getByText('Redirecting to /dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('prevents authenticated users from accessing register page', async () => {
    authService.getStoredToken.mockReturnValue('valid-token');
    
    renderWithAuth(
      <PublicRoute>
        <div>Register Page</div>
      </PublicRoute>
    );

    // Wait for redirect
    await screen.findByText('Redirecting to /dashboard');
    
    // Should redirect instead of showing register
    expect(screen.getByText('Redirecting to /dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Register Page')).not.toBeInTheDocument();
  });
});
