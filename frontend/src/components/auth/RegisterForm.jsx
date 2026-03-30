import React, { useState, useRef, useEffect } from 'react';
import ErrorMessage from '../common/ErrorMessage';
import './RegisterForm.css';

/**
 * RegisterForm component
 * Reusable form component for user registration
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Callback function when form is submitted (data) => Promise<void>
 * @param {Object} props.errors - Validation errors for each field { username, email, password, fullName }
 * @param {string|null} props.serverError - Server error message to display
 * @param {boolean} props.loading - Whether the form is in loading state
 * @param {Function} props.onFieldBlur - Callback when field loses focus (field, value) => void
 * @returns {React.ReactElement} Registration form
 */
const RegisterForm = ({ onSubmit, errors, serverError, loading, onFieldBlur }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [localServerError, setLocalServerError] = useState(serverError);
  const [fieldErrors, setFieldErrors] = useState(errors || {});

  // Refs for focus management
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const fullNameRef = useRef(null);

  // Update local server error when prop changes
  React.useEffect(() => {
    setLocalServerError(serverError);
  }, [serverError]);

  // Update field errors when prop changes
  React.useEffect(() => {
    setFieldErrors(errors || {});
  }, [errors]);

  // Focus management: focus on first field with error
  useEffect(() => {
    if (fieldErrors.username && usernameRef.current) {
      usernameRef.current.focus();
    } else if (fieldErrors.email && emailRef.current) {
      emailRef.current.focus();
    } else if (fieldErrors.password && passwordRef.current) {
      passwordRef.current.focus();
    } else if (fieldErrors.fullName && fullNameRef.current) {
      fullNameRef.current.focus();
    }
  }, [fieldErrors]);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    // Clear field error when user types
    if (fieldErrors.username) {
      setFieldErrors({ ...fieldErrors, username: null });
    }
    // Clear server error when user types
    if (localServerError) {
      setLocalServerError(null);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    // Clear field error when user types
    if (fieldErrors.email) {
      setFieldErrors({ ...fieldErrors, email: null });
    }
    // Clear server error when user types
    if (localServerError) {
      setLocalServerError(null);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    // Clear field error when user types
    if (fieldErrors.password) {
      setFieldErrors({ ...fieldErrors, password: null });
    }
    // Clear server error when user types
    if (localServerError) {
      setLocalServerError(null);
    }
  };

  const handleFullNameChange = (e) => {
    setFullName(e.target.value);
    // Clear field error when user types
    if (fieldErrors.fullName) {
      setFieldErrors({ ...fieldErrors, fullName: null });
    }
    // Clear server error when user types
    if (localServerError) {
      setLocalServerError(null);
    }
  };

  const handleUsernameBlur = () => {
    onFieldBlur('username', username);
  };

  const handleEmailBlur = () => {
    onFieldBlur('email', email);
  };

  const handlePasswordBlur = () => {
    onFieldBlur('password', password);
  };

  const handleFullNameBlur = () => {
    onFieldBlur('fullName', fullName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit({ username, email, password, fullName });
  };

  const handleDismissServerError = () => {
    setLocalServerError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="register-form" aria-label="Registration form">
      <ErrorMessage message={localServerError} onDismiss={handleDismissServerError} />

      <div className="register-form__field">
        <label htmlFor="username" className="register-form__label">
          Username
        </label>
        <input
          ref={usernameRef}
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          onBlur={handleUsernameBlur}
          disabled={loading}
          required
          aria-label="Username"
          aria-describedby={fieldErrors.username ? 'username-error' : undefined}
          aria-invalid={fieldErrors.username ? 'true' : 'false'}
          className={`register-form__input ${fieldErrors.username ? 'register-form__input--error' : ''}`}
        />
        {fieldErrors.username && (
          <div id="username-error" className="register-form__field-error" role="alert">
            {fieldErrors.username}
          </div>
        )}
      </div>

      <div className="register-form__field">
        <label htmlFor="email" className="register-form__label">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          disabled={loading}
          required
          aria-label="Email address"
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          aria-invalid={fieldErrors.email ? 'true' : 'false'}
          className={`register-form__input ${fieldErrors.email ? 'register-form__input--error' : ''}`}
        />
        {fieldErrors.email && (
          <div id="email-error" className="register-form__field-error" role="alert">
            {fieldErrors.email}
          </div>
        )}
      </div>

      <div className="register-form__field">
        <label htmlFor="password" className="register-form__label">
          Password
        </label>
        <input
          ref={passwordRef}
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          disabled={loading}
          required
          aria-label="Password"
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          aria-invalid={fieldErrors.password ? 'true' : 'false'}
          className={`register-form__input ${fieldErrors.password ? 'register-form__input--error' : ''}`}
        />
        {fieldErrors.password && (
          <div id="password-error" className="register-form__field-error" role="alert">
            {fieldErrors.password}
          </div>
        )}
      </div>

      <div className="register-form__field">
        <label htmlFor="fullName" className="register-form__label">
          Full Name
        </label>
        <input
          ref={fullNameRef}
          id="fullName"
          type="text"
          value={fullName}
          onChange={handleFullNameChange}
          onBlur={handleFullNameBlur}
          disabled={loading}
          required
          aria-label="Full name"
          aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
          aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
          className={`register-form__input ${fieldErrors.fullName ? 'register-form__input--error' : ''}`}
        />
        {fieldErrors.fullName && (
          <div id="fullName-error" className="register-form__field-error" role="alert">
            {fieldErrors.fullName}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className={`register-form__submit ${loading ? 'register-form__submit--loading' : ''}`}
      >
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};

export default RegisterForm;
