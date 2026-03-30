import React, { useState, useRef, useEffect } from 'react';
import OAuth2Button from './OAuth2Button';
import ErrorMessage from '../common/ErrorMessage';
import './LoginForm.css';

/**
 * LoginForm component
 * Reusable form component for user login
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Callback function when form is submitted (username, password) => Promise<void>
 * @param {string|null} props.error - Error message to display
 * @param {boolean} props.loading - Whether the form is in loading state
 * @returns {React.ReactElement} Login form
 */
const LoginForm = ({ onSubmit, error, loading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(error);

  // Refs for focus management
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Update local error when prop changes
  React.useEffect(() => {
    setLocalError(error);
  }, [error]);

  // Focus management: focus on username field when error occurs
  useEffect(() => {
    if (localError && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [localError]);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    // Clear error when user types
    if (localError) {
      setLocalError(null);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    // Clear error when user types
    if (localError) {
      setLocalError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(username, password);
  };

  const handleDismissError = () => {
    setLocalError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form" aria-label="Login form">
      <ErrorMessage message={localError} onDismiss={handleDismissError} />

      <div className="login-form__field">
        <label htmlFor="username" className="login-form__label">
          Username
        </label>
        <input
          ref={usernameRef}
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          disabled={loading}
          required
          aria-label="Username"
          aria-describedby={localError ? 'login-error' : undefined}
          aria-invalid={localError ? 'true' : 'false'}
          className="login-form__input"
        />
      </div>

      <div className="login-form__field">
        <label htmlFor="password" className="login-form__label">
          Password
        </label>
        <input
          ref={passwordRef}
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          disabled={loading}
          required
          aria-label="Password"
          aria-describedby={localError ? 'login-error' : undefined}
          aria-invalid={localError ? 'true' : 'false'}
          className="login-form__input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className={`login-form__submit ${loading ? 'login-form__submit--loading' : ''}`}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>

      <div className="login-form__oauth-section">
        <OAuth2Button disabled={loading} />
      </div>
    </form>
  );
};

export default LoginForm;
