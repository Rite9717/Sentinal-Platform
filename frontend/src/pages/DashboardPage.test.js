import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { useAuth } from '../contexts/AuthContext';
import { mockNavigate } from 'react-router-dom';
import * as ec2Service from '../services/ec2Service';

jest.mock('../contexts/AuthContext');
jest.mock('react-router-dom');
jest.mock('../services/ec2Service');
jest.mock('../hooks/useInstanceUpdates', () => ({
  useInstanceUpdates: jest.fn(),
}));

describe('DashboardPage', () => {
  const mockLogout = jest.fn();
  const mockUpdateProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER',
      },
      logout: mockLogout,
      updateProfile: mockUpdateProfile,
    });

    ec2Service.getUserInstances.mockResolvedValue([
      {
        id: 1,
        instanceId: 'i-1234567890abcdef0',
        nickname: 'Prod API',
        region: 'us-east-1',
        externalId: 'external-123',
        state: 'UP',
        suspectCount: 0,
        quarantineCount: 0,
        quarantineDurationMinutes: 5,
        maxSuspectStrikes: 5,
        maxQuarantineCycles: 3,
      },
    ]);
    ec2Service.getInstanceMetrics.mockResolvedValue({
      cpu: '34.2',
      memory: '51.7',
      disk: '20.4',
    });
    ec2Service.getInstanceSnapshots.mockResolvedValue([
      {
        Id: 10,
        snapshotTime: '2026-04-12T10:15:00',
        aiAnalysis: 'CPU remains healthy and no incident pattern is currently detected.',
        cpuUsage: 34.2,
        memoryUsage: 51.7,
      },
    ]);
    ec2Service.registerInstance.mockResolvedValue({});
    ec2Service.resetInstance.mockResolvedValue({});
    ec2Service.deleteInstance.mockResolvedValue({});
  });

  test('renders registry-backed instances view', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: /Instances/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Open Chat/i }).length).toBeGreaterThan(0);
    });
  });

  test('opens register modal', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Register Instance/i }));
    expect(screen.getByRole('heading', { name: /Register Instance/i })).toBeInTheDocument();
  });

  test('switches to chat view from an instance card', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByText(/Open Chat/i)[0]);

    await waitFor(() => {
      expect(ec2Service.getInstanceSnapshots).toHaveBeenCalledWith(1);
    });

    expect(screen.getByText(/Context Channel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CPU remains healthy/i).length).toBeGreaterThan(0);
  });

  test('logs out and navigates to login', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Logout/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('opens profile modal and updates profile', async () => {
    mockUpdateProfile.mockResolvedValue({
      id: 1,
      username: 'opslead',
      email: 'test@example.com',
      fullName: 'Ops Lead',
      role: 'USER',
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(ec2Service.getUserInstances).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Profile/i }));
    fireEvent.change(screen.getByDisplayValue('testuser'), { target: { value: 'opslead' } });
    fireEvent.change(screen.getByDisplayValue('Test User'), { target: { value: 'Ops Lead' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: 'opslead',
        fullName: 'Ops Lead',
      });
    });
  });
});
