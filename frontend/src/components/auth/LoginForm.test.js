import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from './LoginForm';

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  test('renders username and password fields with labels', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  test('renders submit button and OAuth2 button', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  test('displays error message when error prop provided', () => {
    const errorMessage = 'Invalid credentials';
    render(<LoginForm onSubmit={mockOnSubmit} error={errorMessage} loading={false} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test('disables submit button when loading prop is true', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={true} />);
    
    const submitButton = screen.getByRole('button', { name: /logging in/i });
    expect(submitButton).toBeDisabled();
  });

  test('disables OAuth2 button when loading prop is true', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={true} />);
    
    const oauth2Button = screen.getByRole('button', { name: /sign in with google/i });
    expect(oauth2Button).toBeDisabled();
  });

  test('disables input fields when loading prop is true', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={true} />);
    
    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });

  test('calls onSubmit with credentials when form submitted', async () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'testpass123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('testuser', 'testpass123');
    });
  });

  test('clears error when user types in username field', () => {
    const errorMessage = 'Invalid credentials';
    const { rerender } = render(
      <LoginForm onSubmit={mockOnSubmit} error={errorMessage} loading={false} />
    );
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  test('clears error when user types in password field', () => {
    const errorMessage = 'Invalid credentials';
    const { rerender } = render(
      <LoginForm onSubmit={mockOnSubmit} error={errorMessage} loading={false} />
    );
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'a' } });
    
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  test('shows loading text on submit button when loading', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={true} />);
    
    expect(screen.getByRole('button', { name: /logging in/i })).toBeInTheDocument();
  });

  test('allows dismissing error message', () => {
    const errorMessage = 'Invalid credentials';
    render(<LoginForm onSubmit={mockOnSubmit} error={errorMessage} loading={false} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    fireEvent.click(dismissButton);
    
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  test('updates error when error prop changes', () => {
    const { rerender } = render(
      <LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />
    );
    
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
    
    rerender(<LoginForm onSubmit={mockOnSubmit} error="First error" loading={false} />);
    expect(screen.getByText('First error')).toBeInTheDocument();
    
    rerender(<LoginForm onSubmit={mockOnSubmit} error="Second error" loading={false} />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });

  test('form fields are required', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  // Accessibility tests
  test('form has accessible label', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    const form = screen.getByRole('form', { name: /login form/i });
    expect(form).toBeInTheDocument();
  });

  test('input fields have aria-labels', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toHaveAttribute('aria-label', 'Username');
    expect(passwordInput).toHaveAttribute('aria-label', 'Password');
  });

  test('input fields have aria-invalid when error exists', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Invalid credentials" loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('input fields have aria-invalid false when no error', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toHaveAttribute('aria-invalid', 'false');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
  });

  test('input fields have aria-describedby when error exists', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Invalid credentials" loading={false} />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toHaveAttribute('aria-describedby', 'login-error');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error');
  });

  test('submit button has aria-busy when loading', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error={null} loading={true} />);
    
    const submitButton = screen.getByRole('button', { name: /logging in/i });
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });

  test('error message has role alert', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Invalid credentials" loading={false} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('Invalid credentials');
  });

  test('focuses on username field when error occurs', async () => {
    const { rerender } = render(
      <LoginForm onSubmit={mockOnSubmit} error={null} loading={false} />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    
    rerender(<LoginForm onSubmit={mockOnSubmit} error="Invalid credentials" loading={false} />);
    
    await waitFor(() => {
      expect(usernameInput).toHaveFocus();
    });
  });
});
