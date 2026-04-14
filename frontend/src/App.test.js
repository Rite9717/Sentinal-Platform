import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: jest.fn(),
}));

jest.mock('./components/common/ProtectedRoute', () => ({ children }) => <>{children}</>);
jest.mock('./components/common/PublicRoute', () => ({ children }) => <>{children}</>);
jest.mock('./pages/LandingPage', () => () => <div>Landing Page</div>);
jest.mock('./pages/LoginPage', () => () => <div>Login Page</div>);
jest.mock('./pages/RegisterPage', () => () => <div>Register Page</div>);
jest.mock('./pages/DashboardPage', () => () => <div>Dashboard Page</div>);
jest.mock('./pages/OAuth2CallbackPage', () => () => <div>OAuth2 Callback Page</div>);

describe('App', () => {
  test('renders landing route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  test('renders login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  test('renders dashboard route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
