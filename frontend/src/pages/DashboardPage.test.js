import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { useAuth } from '../contexts/AuthContext';
import { mockNavigate } from 'react-router-dom';
import * as ec2Service from '../services/ec2Service';

// Mock the AuthContext
jest.mock('../contexts/AuthContext');

// Mock react-router-dom using the manual mock
jest.mock('react-router-dom');

// Mock ec2Service
jest.mock('../services/ec2Service');

describe('DashboardPage', () => {
  let mockLogout;

  beforeEach(() => {
    mockLogout = jest.fn();
    mockNavigate.mockClear();
    
    // Mock ec2Service methods
    ec2Service.getUserInstances = jest.fn().mockResolvedValue([]);
    ec2Service.registerInstance = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderDashboard = async (user = null) => {
    useAuth.mockReturnValue({
      user,
      logout: mockLogout
    });

    const result = render(<DashboardPage />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });
    
    return result;
  };

  describe('Rendering', () => {
    it('should render welcome message without name when user is null', async () => {
      await renderDashboard(null);
      
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    it('should render welcome message with user full name when user exists', async () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      await renderDashboard(user);
      
      expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
    });

    it('should render user information section when user exists', async () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      await renderDashboard(user);
      
      expect(screen.getByText('User Information')).toBeInTheDocument();
      expect(screen.getByText('Username:')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('Email:')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('USER')).toBeInTheDocument();
    });

    it('should not render user information section when user is null', async () => {
      await renderDashboard(null);
      
      expect(screen.queryByText('User Information')).not.toBeInTheDocument();
    });

    it('should render logout button', async () => {
      await renderDashboard(null);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
    });

    it('should render EC2 monitoring section', async () => {
      await renderDashboard(null);
      
      expect(screen.getByText('EC2 Instance Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Register Instance')).toBeInTheDocument();
    });

    it('should show empty state when no instances', async () => {
      await renderDashboard(null);
      
      expect(screen.getByText('No instances registered yet.')).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout and navigate to login when logout button is clicked', async () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER'
      };

      await renderDashboard(user);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should call logout even when user is null', async () => {
      await renderDashboard(null);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('User Data Display', () => {
    it('should display all user fields correctly', async () => {
      const user = {
        id: 123,
        username: 'johndoe',
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        role: 'ADMIN',
        enabled: true,
        createdAt: '2024-01-01T12:00:00'
      };

      await renderDashboard(user);
      
      expect(screen.getByText('johndoe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    it('should handle user with minimal data', async () => {
      const user = {
        username: 'minimaluser',
        email: 'minimal@example.com',
        role: 'USER'
      };

      await renderDashboard(user);
      
      expect(screen.getByText('minimaluser')).toBeInTheDocument();
      expect(screen.getByText('minimal@example.com')).toBeInTheDocument();
      expect(screen.getByText('USER')).toBeInTheDocument();
    });
  });

  describe('Instance Registration', () => {
    it('should show wizard when register button is clicked', async () => {
      await renderDashboard(null);
      
      const registerButton = screen.getByText('Register Instance');
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(screen.getByText('Register AWS EC2 Instance')).toBeInTheDocument();
      });
    });

    it('should hide wizard when cancel is clicked', async () => {
      await renderDashboard(null);
      
      const registerButton = screen.getByText('Register Instance');
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(screen.getByText('Register AWS EC2 Instance')).toBeInTheDocument();
      });

      // Click the Cancel button - there are multiple, get all and click the first one
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Register AWS EC2 Instance')).not.toBeInTheDocument();
      });
    });

    it('should display instances when loaded', async () => {
      const mockInstances = [
        {
          id: 1,
          instanceId: 'i-1234567890abcdef0',
          nickname: 'Test Server',
          region: 'us-east-1',
          status: 'running'
        }
      ];

      ec2Service.getUserInstances.mockResolvedValue(mockInstances);

      await renderDashboard(null);

      await waitFor(() => {
        expect(screen.queryByText('No instances registered yet.')).not.toBeInTheDocument();
      });
    });

    it('should delete instance when delete button is clicked', async () => {
      const mockInstances = [
        {
          id: 1,
          instanceId: 'i-1234567890abcdef0',
          nickname: 'Test Server',
          region: 'us-east-1',
          state: 'UP'
        }
      ];

      ec2Service.getUserInstances.mockResolvedValue(mockInstances);
      ec2Service.deleteInstance = jest.fn().mockResolvedValue();
      
      // Mock window.confirm
      global.confirm = jest.fn(() => true);

      await renderDashboard(null);

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByText('Delete Instance');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(ec2Service.deleteInstance).toHaveBeenCalledWith(1);
      });
    });
  });
});
