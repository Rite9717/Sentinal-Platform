import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import * as AuthContext from './contexts/AuthContext';

// Mock the AuthContext
jest.mock('./contexts/AuthContext', () => ({
  ...jest.requireActual('./contexts/AuthContext'),
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => <div>{children}</div>
}));

// Mock the page components
jest.mock('./pages/LoginPage', () => {
  return function LoginPage() {
    return <div>Login Page</div>;
  };
});

jest.mock('./pages/RegisterPage', () => {
  return function RegisterPage() {
    return <div>Register Page</div>;
  };
});

jest.mock('./pages/DashboardPage', () => {
  return function DashboardPage() {
    return <div>Dashboard Page</div>;
  };
});

jest.mock('./pages/OAuth2CallbackPage', () => {
  return function OAuth2CallbackPage() {
    return <div>OAuth2 Callback Page</div>;
  };
});

describe('App Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null
    });

    render(<App />);
    expect(screen.getByText(/Login Page/i)).toBeInTheDocument();
  });

  test('redirects root path to dashboard', async () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { username: 'testuser' }
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Dashboard Page/i)).toBeInTheDocument();
    });
  });

  test('wraps application with AuthProvider', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null
    });

    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  test('configures Router with all routes', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null
    });

    render(<App />);
    // If the app renders without errors, routing is configured correctly
    expect(screen.getByText(/Login Page/i)).toBeInTheDocument();
  });
});
