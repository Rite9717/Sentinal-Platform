import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import InstanceHealthCard from '../components/ec2/InstanceHealthCard';
import InstanceRegistrationWizard from '../components/ec2/InstanceRegistrationWizard';
import { registerInstance, getUserInstances, deleteInstance, resetInstance } from '../services/ec2Service';
import { useInstanceUpdates } from '../hooks/useInstanceUpdates';

/**
 * DashboardPage component
 * Protected page shown after successful authentication
 * Displays user information and provides logout functionality
 * 
 * @returns {React.ReactElement} Dashboard page
 */
const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterWizard, setShowRegisterWizard] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load user's registered instances on mount
   */
  useEffect(() => {
    loadInstances(true);
    const interval = setInterval(() => {
      loadInstances(false);
    },15000);

    return () => clearInterval(interval);
  }, []);

  useInstanceUpdates(user?.id, (update) => {
    setInstances(prev =>
      prev.map(instance => 
        instance.instanceId === update.instanceId
        ? { ...instance, state: update.state}
        : instance
      )
    );
  });
  /**
   * Fetch user's registered instances
   */
  const loadInstances = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await getUserInstances();
      setInstances(data);
      setError(null);
    } catch (err) {
      setError('Failed to load instances');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle logout button click
   * Clears authentication state and redirects to login
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /**
   * Handle instance registration completion
   */
  const handleRegistrationComplete = async (registrationData) => {    
    try {
      await registerInstance(registrationData);
      setShowRegisterWizard(false);
      await loadInstances(true);
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to register instance');
    }
  };

  /**
   * Handle instance deletion
   */
  const handleDeleteInstance = async (instanceId) => {
    try {
      await deleteInstance(instanceId);
      await loadInstances(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete instance');
      throw err;
    }
  };

  /**
   * Handle instance reset
   */
  const handleResetInstance = async (instanceId) => {
    try {
      await resetInstance(instanceId);
      await loadInstances(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset instance');
      throw err;
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
        maxWidth: '600px'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '32px',
          fontSize: '28px',
          fontWeight: '600',
          color: '#333'
        }}>
          Welcome{user?.fullName ? `, ${user.fullName}` : ''}!
        </h1>

        {user && (
          <div style={{
            marginBottom: '32px',
            padding: '24px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '16px'
            }}>
              User Information
            </h2>
            
            <div style={{ marginBottom: '12px' }}>
              <span style={{
                fontWeight: '600',
                color: '#555',
                marginRight: '8px'
              }}>
                Username:
              </span>
              <span style={{ color: '#333' }}>
                {user.username}
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{
                fontWeight: '600',
                color: '#555',
                marginRight: '8px'
              }}>
                Email:
              </span>
              <span style={{ color: '#333' }}>
                {user.email}
              </span>
            </div>

            <div>
              <span style={{
                fontWeight: '600',
                color: '#555',
                marginRight: '8px'
              }}>
                Role:
              </span>
              <span style={{ color: '#333' }}>
                {user.role}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
        >
          Logout
        </button>
      </div>

      {/* EC2 Instance Monitoring Section */}
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '800px',
        marginTop: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#333',
            margin: 0
          }}>
            EC2 Instance Monitoring
          </h2>
          <button
            onClick={() => setShowRegisterWizard(!showRegisterWizard)}
            style={{
              padding: '10px 20px',
              backgroundColor: showRegisterWizard ? '#6c757d' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {showRegisterWizard ? 'Cancel' : 'Register Instance'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        {showRegisterWizard && (
          <div style={{ marginBottom: '24px' }}>
            <InstanceRegistrationWizard
              onComplete={handleRegistrationComplete}
              onCancel={() => setShowRegisterWizard(false)}
            />
          </div>
        )}

        {loading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            <p>Loading instances...</p>
          </div>
        ) : instances.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px'
          }}>
            <p>No instances registered yet.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Click "Register Instance" to add your first EC2 instance for monitoring.
            </p>
          </div>
        ) : (
          <div>
            {instances.map((instance) => (
              <InstanceHealthCard 
                key={instance.id} 
                instance={instance} 
                onUpdate={loadInstances}
                onDelete={handleDeleteInstance}
                onReset={handleResetInstance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
