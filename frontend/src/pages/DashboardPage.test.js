import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { useAuth } from '../contexts/AuthContext';
import { mockNavigate } from 'react-router-dom';

// Mock the AuthContext
jest.mock('../contexts/AuthContext');

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

describe('DashboardPage', () => {
  let mockLogout;

  beforeEach(() => {
    mockLogout = jest.fn();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderDashboard = (user = null) => {
    useAuth.mockReturnValue({
      user,
      logout: mockLogout
    });

    return render(<DashboardPage />);
  };

  describe('Rendering', () => {
    it('should render welcome message without name when user is null', () => {
      renderDashboard(null);
      
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    it('should render welcome message with user full name when user exists', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      renderDashboard(user);
      
      expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
    });

    it('should render user information section when user exists', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      renderDashboard(user);
      
      expect(screen.getByText('User Information')).toBeInTheDocument();
      expect(screen.getByText('Username:')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('Email:')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('USER')).toBeInTheDocument();
    });

    it('should not render user information section when user is null', () => {
      renderDashboard(null);
      
      expect(screen.queryByText('User Information')).not.toBeInTheDocument();
    });

    it('should render logout button', () => {
      renderDashboard(null);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout and navigate to login when logout button is clicked', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      renderDashboard(user);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should call logout even when user is null', () => {
      renderDashboard(null);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('User Data Display', () => {
    it('should display all user fields correctly', () => {
      const user = {
        id: 123,
        username: 'johndoe',
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        role: 'ADMIN',
        enabled: true,
        createdAt: '2024-01-01T12:00:00'
      };

      renderDashboard(user);
      
      expect(screen.getByText('johndoe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    it('should handle user with minimal data', () => {
      const user = {
        username: 'minimaluser',
        email: 'minimal@example.com',
        role: 'USER'
      };

      renderDashboard(user);
      
      expect(screen.getByText('minimaluser')).toBeInTheDocument();
      expect(screen.getByText('minimal@example.com')).toBeInTheDocument();
      expect(screen.getByText('USER')).toBeInTheDocument();
    });
  });
});
