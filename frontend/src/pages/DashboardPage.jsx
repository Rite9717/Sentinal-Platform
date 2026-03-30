import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import InstanceHealthCard from '../components/ec2/InstanceHealthCard';
import { registerInstance, getUserInstances } from '../services/ec2Service';

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
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({
    instanceId: '',
    region: 'us-east-1',
    nickname: '',
    roleArn: ''
  });
  const [error, setError] = useState(null);

  /**
   * Load user's registered instances on mount
   */
  useEffect(() => {
    loadInstances();
  }, []);

  /**
   * Fetch user's registered instances
   */
  const loadInstances = async () => {
    try {
      setLoading(true);
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
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /**
   * Register a new instance
   */
  const handleRegisterInstance = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      await registerInstance(formData);
      setFormData({
        instanceId: '',
        region: 'us-east-1',
        nickname: '',
        roleArn: ''
      });
      setShowRegisterForm(false);
      await loadInstances();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register instance');
      console.error(err);
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
            onClick={() => setShowRegisterForm(!showRegisterForm)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {showRegisterForm ? 'Cancel' : 'Register Instance'}
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

        {showRegisterForm && (
          <form onSubmit={handleRegisterInstance} style={{
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#333' }}>
                Instance ID *
              </label>
              <input
                type="text"
                name="instanceId"
                value={formData.instanceId}
                onChange={handleInputChange}
                placeholder="i-1234567890abcdef0"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#333' }}>
                Region *
              </label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                placeholder="us-east-1"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#333' }}>
                Nickname *
              </label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
                placeholder="My Production Server"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#333' }}>
                IAM Role ARN *
              </label>
              <input
                type="text"
                name="roleArn"
                value={formData.roleArn}
                onChange={handleInputChange}
                placeholder="arn:aws:iam::123456789012:role/SentinalMonitorRole"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Register
            </button>
          </form>
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
              <InstanceHealthCard key={instance.id} instance={instance} onUpdate={loadInstances} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
