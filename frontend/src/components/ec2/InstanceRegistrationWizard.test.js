import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InstanceRegistrationWizard from './InstanceRegistrationWizard';

describe('InstanceRegistrationWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders step 1 initially', () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Register AWS EC2 Instance')).toBeInTheDocument();
    expect(screen.getByText('Enter your EC2 instance details')).toBeInTheDocument();
    expect(screen.getByLabelText(/AWS Account ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Instance ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AWS Region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nickname/i)).toBeInTheDocument();
  });

  test('validates AWS account ID format', () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const accountIdInput = screen.getByLabelText(/AWS Account ID/i);
    expect(accountIdInput).toHaveAttribute('pattern', '\\d{12}');
  });

  test('validates instance ID format', () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const instanceIdInput = screen.getByLabelText(/Instance ID/i);
    expect(instanceIdInput).toHaveAttribute('pattern', 'i-[a-f0-9]{8,17}');
  });

  test('moves to step 2 after submitting step 1', async () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    fireEvent.change(screen.getByLabelText(/AWS Account ID/i), {
      target: { value: '123456789012' }
    });
    fireEvent.change(screen.getByLabelText(/Instance ID/i), {
      target: { value: 'i-1234567890abcdef0' }
    });
    fireEvent.change(screen.getByLabelText(/Nickname/i), {
      target: { value: 'Test Server' }
    });

    fireEvent.click(screen.getByText('Next: Setup IAM Role'));

    await waitFor(() => {
      expect(screen.getByText('Setup IAM Role in AWS Console')).toBeInTheDocument();
      expect(screen.getByText(/Template configured for AWS Account: 123456789012/i)).toBeInTheDocument();
    });
  });

  test('calls onCancel when cancel button is clicked', () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('shows download button in step 2', async () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Fill form and move to step 2
    fireEvent.change(screen.getByLabelText(/AWS Account ID/i), {
      target: { value: '123456789012' }
    });
    fireEvent.change(screen.getByLabelText(/Instance ID/i), {
      target: { value: 'i-1234567890abcdef0' }
    });
    fireEvent.change(screen.getByLabelText(/Nickname/i), {
      target: { value: 'Test Server' }
    });
    fireEvent.click(screen.getByText('Next: Setup IAM Role'));

    await waitFor(() => {
      expect(screen.getByText('Setup IAM Role in AWS Console')).toBeInTheDocument();
      expect(screen.getByText(/Download sentinal-monitor-role.yaml/i)).toBeInTheDocument();
    });
  });

  test('navigates back to step 1', async () => {
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Move to step 2
    fireEvent.change(screen.getByLabelText(/AWS Account ID/i), {
      target: { value: '123456789012' }
    });
    fireEvent.change(screen.getByLabelText(/Instance ID/i), {
      target: { value: 'i-1234567890abcdef0' }
    });
    fireEvent.change(screen.getByLabelText(/Nickname/i), {
      target: { value: 'Test Server' }
    });
    fireEvent.click(screen.getByText('Next: Setup IAM Role'));

    await waitFor(() => {
      expect(screen.getByText('Setup IAM Role in AWS Console')).toBeInTheDocument();
    });

    // Go back to step 1
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Enter your EC2 instance details')).toBeInTheDocument();
  });

  test('completes registration with role ARN', async () => {
    const mockRoleArn = 'arn:aws:iam::123456789012:role/SentinalMonitorRole';
    
    render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Complete step 1
    fireEvent.change(screen.getByLabelText(/AWS Account ID/i), {
      target: { value: '123456789012' }
    });
    fireEvent.change(screen.getByLabelText(/Instance ID/i), {
      target: { value: 'i-1234567890abcdef0' }
    });
    fireEvent.change(screen.getByLabelText(/AWS Region/i), {
      target: { value: 'us-east-1' }
    });
    fireEvent.change(screen.getByLabelText(/Nickname/i), {
      target: { value: 'Test Server' }
    });
    fireEvent.click(screen.getByText('Next: Setup IAM Role'));

    await waitFor(() => {
      expect(screen.getByText('Setup IAM Role in AWS Console')).toBeInTheDocument();
    });

    // Enter role ARN
    const roleArnInput = screen.getByLabelText(/IAM Role ARN/i);
    fireEvent.change(roleArnInput, { target: { value: mockRoleArn } });

    // Submit
    const submitButton = screen.getByRole('button', { name: 'Complete Registration' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        instanceId: 'i-1234567890abcdef0',
        region: 'us-east-1',
        nickname: 'Test Server',
        roleArn: mockRoleArn
      });
    });
  });

  test('displays error message', async () => {
    const errorMessage = 'Failed to register instance';
    mockOnComplete.mockRejectedValueOnce(new Error(errorMessage));

    const { container } = render(
      <InstanceRegistrationWizard 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Complete step 1
    fireEvent.change(screen.getByLabelText(/AWS Account ID/i), {
      target: { value: '123456789012' }
    });
    fireEvent.change(screen.getByLabelText(/Instance ID/i), {
      target: { value: 'i-1234567890abcdef0' }
    });
    fireEvent.change(screen.getByLabelText(/Nickname/i), {
      target: { value: 'Test Server' }
    });
    fireEvent.click(screen.getByText('Next: Setup IAM Role'));

    await waitFor(() => {
      expect(screen.getByText('Setup IAM Role in AWS Console')).toBeInTheDocument();
    });

    // Enter role ARN and submit
    const roleArnInput = screen.getByLabelText(/IAM Role ARN/i);
    fireEvent.change(roleArnInput, { 
      target: { value: 'arn:aws:iam::123456789012:role/SentinalMonitorRole' } 
    });

    const submitButton = screen.getByRole('button', { name: 'Complete Registration' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
