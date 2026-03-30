import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RegisterForm from '../components/auth/RegisterForm';
import authService from '../services/authService';
import { validateUsername, validateEmail, validatePassword, validateFullName } from '../utils/validation';

/**
 * RegisterPage component
 * Page component that integrates RegisterForm with validation and authService
 * Handles registration flow, validation, error management, and redirects
 * 
 * @returns {React.ReactElement} Registration page
 */
const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [errors, setErrors] = useState({
    username: null,
    email: null,
    password: null,
    fullName: null
  });
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handle field blur validation
   * @param {string} field - Field name (username, email, password, fullName)
   * @param {string} value - Field value to validate
   */
  const handleFieldBlur = (field, value) => {
    let error = null;

    switch (field) {
      case 'username':
        error = validateUsername(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'fullName':
        error = validateFullName(value);
        break;
      default:
        break;
    }

    setErrors(prevErrors => ({
      ...prevErrors,
      [field]: error
    }));
  };

  /**
   * Handle form submission
   * @param {Object} data - Registration data from form
   * @param {string} data.username - Username
   * @param {string} data.email - Email
   * @param {string} data.password - Password
   * @param {string} data.fullName - Full name
   */
  const handleSubmit = async (data) => {
    setLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      await authService.register(data);
      // Display success message and redirect to login
      setSuccessMessage('Registration successful! Please log in.');
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Registration successful! Please log in.' }
        });
      }, 1500);
    } catch (err) {
      // Display error message from registration failure
      setServerError(err.message || err || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '32px',
          fontSize: '28px',
          fontWeight: '600',
          color: '#333'
        }}>
          Register
        </h1>

        {successMessage && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {successMessage}
          </div>
        )}

        <RegisterForm
          onSubmit={handleSubmit}
          errors={errors}
          serverError={serverError}
          loading={loading}
          onFieldBlur={handleFieldBlur}
        />

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: '#007bff',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
