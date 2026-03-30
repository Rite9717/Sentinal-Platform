import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterForm from './RegisterForm';

describe('RegisterForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnFieldBlur = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnFieldBlur.mockClear();
  });

  test('renders all registration fields with labels', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
  });

  test('renders submit button', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  test('displays inline validation errors below each field', () => {
    const errors = {
      username: 'Username is too short',
      email: 'Invalid email format',
      password: 'Password is too short',
      fullName: 'Full name is required'
    };

    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Username is too short')).toBeInTheDocument();
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    expect(screen.getByText('Password is too short')).toBeInTheDocument();
    expect(screen.getByText('Full name is required')).toBeInTheDocument();
  });

  test('displays server error using ErrorMessage component', () => {
    const serverError = 'Username already exists';
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={serverError}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText(serverError)).toBeInTheDocument();
  });

  test('disables submit button when loading', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={true}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const submitButton = screen.getByRole('button', { name: /registering/i });
    expect(submitButton).toBeDisabled();
  });

  test('disables input fields when loading', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={true}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByLabelText('Full Name')).toBeDisabled();
  });

  test('calls onFieldBlur when username field loses focus', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.blur(usernameInput);
    
    expect(mockOnFieldBlur).toHaveBeenCalledWith('username', 'testuser');
  });

  test('calls onFieldBlur when email field loses focus', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.blur(emailInput);
    
    expect(mockOnFieldBlur).toHaveBeenCalledWith('email', 'test@example.com');
  });

  test('calls onFieldBlur when password field loses focus', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.blur(passwordInput);
    
    expect(mockOnFieldBlur).toHaveBeenCalledWith('password', 'password123');
  });

  test('calls onFieldBlur when fullName field loses focus', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const fullNameInput = screen.getByLabelText('Full Name');
    fireEvent.change(fullNameInput, { target: { value: 'John Doe' } });
    fireEvent.blur(fullNameInput);
    
    expect(mockOnFieldBlur).toHaveBeenCalledWith('fullName', 'John Doe');
  });

  test('calls onSubmit with form data when submitted', async () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const fullNameInput = screen.getByLabelText('Full Name');
    const submitButton = screen.getByRole('button', { name: /register/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(fullNameInput, { target: { value: 'John Doe' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'John Doe'
      });
    });
  });

  test('clears username error when user types in username field', () => {
    const errors = { username: 'Username is too short' };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Username is too short')).toBeInTheDocument();
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    
    expect(screen.queryByText('Username is too short')).not.toBeInTheDocument();
  });

  test('clears email error when user types in email field', () => {
    const errors = { email: 'Invalid email format' };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'a' } });
    
    expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();
  });

  test('clears password error when user types in password field', () => {
    const errors = { password: 'Password is too short' };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Password is too short')).toBeInTheDocument();
    
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'a' } });
    
    expect(screen.queryByText('Password is too short')).not.toBeInTheDocument();
  });

  test('clears fullName error when user types in fullName field', () => {
    const errors = { fullName: 'Full name is required' };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    
    const fullNameInput = screen.getByLabelText('Full Name');
    fireEvent.change(fullNameInput, { target: { value: 'a' } });
    
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });

  test('clears server error when user types in any field', () => {
    const serverError = 'Username already exists';
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={serverError}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText(serverError)).toBeInTheDocument();
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    
    expect(screen.queryByText(serverError)).not.toBeInTheDocument();
  });

  test('shows loading text on submit button when loading', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={true}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByRole('button', { name: /registering/i })).toBeInTheDocument();
  });

  test('allows dismissing server error message', () => {
    const serverError = 'Username already exists';
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={serverError}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText(serverError)).toBeInTheDocument();
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    fireEvent.click(dismissButton);
    
    expect(screen.queryByText(serverError)).not.toBeInTheDocument();
  });

  test('updates errors when errors prop changes', () => {
    const { rerender } = render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.queryByText('Username is too short')).not.toBeInTheDocument();
    
    rerender(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{ username: 'Username is too short' }}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Username is too short')).toBeInTheDocument();
  });

  test('updates server error when serverError prop changes', () => {
    const { rerender } = render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
    
    rerender(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError="First error"
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('First error')).toBeInTheDocument();
    
    rerender(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError="Second error"
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });

  test('form fields are required', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByLabelText('Username')).toBeRequired();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByLabelText('Full Name')).toBeRequired();
  });

  test('applies error styling to fields with errors', () => {
    const errors = {
      username: 'Username is too short',
      email: 'Invalid email format'
    };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    
    expect(usernameInput).toHaveClass('register-form__input--error');
    expect(emailInput).toHaveClass('register-form__input--error');
    expect(passwordInput).not.toHaveClass('register-form__input--error');
  });

  // Accessibility tests
  test('form has accessible label', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const form = screen.getByRole('form', { name: /registration form/i });
    expect(form).toBeInTheDocument();
  });

  test('input fields have aria-labels', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const fullNameInput = screen.getByLabelText('Full Name');
    
    expect(usernameInput).toHaveAttribute('aria-label', 'Username');
    expect(emailInput).toHaveAttribute('aria-label', 'Email address');
    expect(passwordInput).toHaveAttribute('aria-label', 'Password');
    expect(fullNameInput).toHaveAttribute('aria-label', 'Full name');
  });

  test('input fields have aria-invalid when field has error', () => {
    const errors = {
      username: 'Username is too short',
      email: 'Invalid email format'
    };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const fullNameInput = screen.getByLabelText('Full Name');
    
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
    expect(fullNameInput).toHaveAttribute('aria-invalid', 'false');
  });

  test('input fields have aria-describedby when field has error', () => {
    const errors = {
      username: 'Username is too short',
      password: 'Password is too short'
    };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const emailInput = screen.getByLabelText('Email');
    
    expect(usernameInput).toHaveAttribute('aria-describedby', 'username-error');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'password-error');
    expect(emailInput).not.toHaveAttribute('aria-describedby');
  });

  test('error messages have role alert', () => {
    const errors = {
      username: 'Username is too short',
      email: 'Invalid email format'
    };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });

  test('submit button has aria-busy when loading', () => {
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={true}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const submitButton = screen.getByRole('button', { name: /registering/i });
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });

  test('focuses on first field with error when errors change', async () => {
    const { rerender } = render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const usernameInput = screen.getByLabelText('Username');
    
    rerender(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{ username: 'Username is too short' }}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    await waitFor(() => {
      expect(usernameInput).toHaveFocus();
    });
  });

  test('focuses on email field when it has error and username does not', async () => {
    const { rerender } = render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{}}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    const emailInput = screen.getByLabelText('Email');
    
    rerender(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={{ email: 'Invalid email format' }}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    await waitFor(() => {
      expect(emailInput).toHaveFocus();
    });
  });

  test('error messages have unique IDs for aria-describedby', () => {
    const errors = {
      username: 'Username is too short',
      email: 'Invalid email format',
      password: 'Password is too short',
      fullName: 'Full name is required'
    };
    
    render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        errors={errors}
        serverError={null}
        loading={false}
        onFieldBlur={mockOnFieldBlur}
      />
    );
    
    expect(screen.getByText('Username is too short')).toHaveAttribute('id', 'username-error');
    expect(screen.getByText('Invalid email format')).toHaveAttribute('id', 'email-error');
    expect(screen.getByText('Password is too short')).toHaveAttribute('id', 'password-error');
    expect(screen.getByText('Full name is required')).toHaveAttribute('id', 'fullName-error');
  });
});
