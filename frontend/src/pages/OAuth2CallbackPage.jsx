import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * OAuth2CallbackPage component
 * Handles OAuth2 redirect callback from backend after Google authentication
 * Extracts JWT token from URL, processes it through AuthContext, and redirects appropriately
 * 
 * @returns {React.ReactElement} OAuth2 callback page
 */
const OAuth2CallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleOAuth2Callback } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    // Extract token from URL query parameters
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    // Check if there's an error in the URL
    if (errorParam) {
      setError('Google authentication failed. Please try again.');
      // Redirect to login with error message after a short delay
      setTimeout(() => {
        navigate('/login', { state: { error: 'Google authentication failed. Please try again.' } });
      }, 2000);
      return;
    }

    // Check if token exists
    if (!token) {
      setError('Authentication failed. No token received.');
      // Redirect to login with error message after a short delay
      setTimeout(() => {
        navigate('/login', { state: { error: 'Authentication failed. No token received.' } });
      }, 2000);
      return;
    }

    try {
      // Process token through AuthContext
      handleOAuth2Callback(token);
      
      // Redirect to dashboard on success
      navigate('/dashboard');
    } catch (err) {
      // Handle any errors during token processing
      setError('Failed to process authentication. Please try again.');
      setTimeout(() => {
        navigate('/login', { state: { error: 'Failed to process authentication. Please try again.' } });
      }, 2000);
    }
  }, [searchParams, handleOAuth2Callback, navigate]);

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
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {error ? (
          <>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              ❌
            </div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#d32f2f',
              marginBottom: '16px'
            }}>
              Authentication Failed
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '8px'
            }}>
              {error}
            </p>
            <p style={{
              fontSize: '14px',
              color: '#999'
            }}>
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              ✓
            </div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#4caf50',
              marginBottom: '16px'
            }}>
              Authentication Successful
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#666'
            }}>
              Redirecting to dashboard...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuth2CallbackPage;
