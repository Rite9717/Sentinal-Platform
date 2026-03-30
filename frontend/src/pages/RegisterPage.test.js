import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from './RegisterPage';
import { AuthProvider } from '../contexts/AuthContext';
import authService from '../services/authService';
import { mockNavigate } from 'react-router-dom';

// Mock the authService
jest.mock('../services/authService');

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock authService methods
    authService.getStoredToken = jest.fn().mockReturnValue(null);
    authService.register = jest.fn();
    authService.login = jest.fn();
    authService.logout = jest.fn();
    authService.storeToken = jest.fn();
    authService.clearToken = jest.fn();
  });

  const renderRegisterPage = () => {
    return render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    );
  };

  test('renders registration form', () => {
    renderRegisterPage();
    
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  test('provides link to login page', () => {
    renderRegisterPage();
    
    const loginLink = screen.getByText('Login here');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('validates username on blur', async () => {
    renderRegisterPage();
    
    const usernameInput = screen.getByLabelText('Username');
    
    // Enter invalid username (too short)
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.blur(usernameInput);
    
    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
    });
  });

  test('validates email on blur', async () => {
    renderRegisterPage();
    
    const emailInput = screen.getByLabelText('Email');
    
    // Enter invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  test('validates password on blur', async () => {
    renderRegisterPage();
    
    const passwordInput = screen.getByLabelText('Password');
    
    // Enter invalid password (too short)
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.blur(passwordInput);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  test('validates full name on blur', async () => {
    renderRegisterPage();
    
    const fullNameInput = screen.getByLabelText('Full Name');
    
    // Enter invalid full name (too short)
    fireEvent.change(fullNameInput, { target: { value: 'a' } });
    fireEvent.blur(fullNameInput);
    
    await waitFor(() => {
      expect(screen.getByText('Full name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  test('handles successful registration', async () => {
    authService.register.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User'
    });

    renderRegisterPage();
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User'
      });
    });

    // Check for success message
    await waitFor(() => {
      expect(screen.getByText('Registration successful! Please log in.')).toBeInTheDocument();
    });

    // Check navigation after delay
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { message: 'Registration successful! Please log in.' }
      });
    }, { timeout: 2000 });
  });

  test('displays server error on registration failure', async () => {
    const errorMessage = 'Username already exists.';
    authService.register.mockRejectedValue({ message: errorMessage });

    renderRegisterPage();
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'existinguser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('disables submit button while loading', async () => {
    authService.register.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderRegisterPage();
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);
    
    // Button should be disabled and show loading text
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /registering/i })).toBeDisabled();
    });
  });

  test('redirects authenticated users to dashboard', () => {
    // Mock authenticated state
    authService.getStoredToken.mockReturnValue('mock-token');
    
    renderRegisterPage();
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('clears validation errors when user types', async () => {
    renderRegisterPage();
    
    const usernameInput = screen.getByLabelText('Username');
    
    // Trigger validation error
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.blur(usernameInput);
    
    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
    });
    
    // Type again to clear error
    fireEvent.change(usernameInput, { target: { value: 'abc' } });
    
    await waitFor(() => {
      expect(screen.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument();
    });
  });

  test('handles network errors gracefully', async () => {
    authService.register.mockRejectedValue({ message: 'Network error. Please check your connection and try again.' });

    renderRegisterPage();
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();
    });
  });
});
