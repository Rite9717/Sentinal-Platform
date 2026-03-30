import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { AuthProvider } from '../contexts/AuthContext';
import authService from '../services/authService';
import { mockNavigate } from 'react-router-dom';

// Mock the authService
jest.mock('../services/authService');

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock authService methods
    authService.getStoredToken = jest.fn().mockReturnValue(null);
    authService.login = jest.fn();
    authService.logout = jest.fn();
    authService.storeToken = jest.fn();
    authService.clearToken = jest.fn();
  });

  const renderLoginPage = () => {
    return render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
  };

  test('renders login page with title', () => {
    renderLoginPage();
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  test('renders LoginForm component', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('provides link to RegisterPage', () => {
    renderLoginPage();
    const registerLink = screen.getByText('Register here');
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('handles successful login and redirects to dashboard', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'USER'
    };

    authService.login.mockResolvedValue({
      token: 'mock-jwt-token',
      user: mockUser
    });

    renderLoginPage();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for the login to complete
    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      });
    });

    // Verify redirect to dashboard
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('displays error message on login failure', async () => {
    const errorMessage = 'Invalid username or password';
    authService.login.mockRejectedValue(new Error(errorMessage));

    renderLoginPage();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'wronguser' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Verify no redirect occurred
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('displays loading state during login', async () => {
    authService.login.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        token: 'token',
        user: { id: 1, username: 'test' }
      }), 100))
    );

    renderLoginPage();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText('Logging in...')).toBeInTheDocument();
    });
  });

  test('manages form state correctly', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');

    // Initially empty
    expect(usernameInput.value).toBe('');
    expect(passwordInput.value).toBe('');

    // Update values
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    fireEvent.change(passwordInput, { target: { value: 'newpass' } });

    expect(usernameInput.value).toBe('newuser');
    expect(passwordInput.value).toBe('newpass');
  });

  test('clears error when user starts typing', async () => {
    authService.login.mockRejectedValue(new Error('Login failed'));

    renderLoginPage();

    // Fill and submit to trigger error
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'user' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' }
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });

    // Type in username field
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newuser' }
    });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
    });
  });

  test('handles network errors gracefully', async () => {
    authService.login.mockRejectedValue(new Error('Network error'));

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'user' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' }
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('handles login error without message', async () => {
    authService.login.mockRejectedValue(new Error());

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'user' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' }
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });
});
