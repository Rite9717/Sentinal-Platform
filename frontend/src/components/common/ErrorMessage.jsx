import React from 'react';
import './ErrorMessage.css';

/**
 * ErrorMessage component
 * Displays error messages with a dismiss button
 * 
 * @param {Object} props - Component props
 * @param {string|null} props.message - Error message to display (null to hide)
 * @param {Function} props.onDismiss - Callback function when dismiss button is clicked
 * @returns {React.ReactElement|null} Error message container or null
 */
const ErrorMessage = ({ message, onDismiss }) => {
  // Don't render if message is null
  if (!message) {
    return null;
  }

  return (
    <div id="login-error" className="error-message" role="alert" aria-live="polite">
      <span className="error-message__text">{message}</span>
      <button
        onClick={onDismiss}
        className="error-message__dismiss"
        aria-label="Dismiss error"
        type="button"
      >
        ×
      </button>
    </div>
  );
};

export default ErrorMessage;
