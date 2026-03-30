import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/auth/LoginForm';

/**
 * LoginPage component
 * Page component that integrates LoginForm with AuthContext
 * Handles login flow, error management, and redirects
 * 
 * @returns {React.ReactElement} Login page
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handle form submission
   * @param {string} username - Username from form
   * @param {string} password - Password from form
   */
  const handleSubmit = async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      // Redirect to dashboard on successful login
      navigate('/dashboard');
    } catch (err) {
      // Display error message from login failure
      setError(err.message || 'Login failed. Please try again.');
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
          Login
        </h1>

        <LoginForm
          onSubmit={handleSubmit}
          error={error}
          loading={loading}
        />

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{
              color: '#007bff',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
