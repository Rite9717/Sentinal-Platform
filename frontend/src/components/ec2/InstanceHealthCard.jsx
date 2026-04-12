import React, { useState, useEffect } from 'react';
import './InstanceHealthCard.css';
import InstanceMetricsCard from './InstanceMetricsCard';

const stateColors = {
  UP: '#4caf50',
  SUSPECT: '#ff9800',
  QUARANTINED: '#f44336',
  TERMINATED: '#9e9e9e'
};

export default function InstanceHealthCard({ instance, onUpdate, onDelete, onReset }) {
  const [timeInfo, setTimeInfo] = useState({ lastChecked: '', stateChanged: '' });
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const updateTimes = () => {
      if (instance.lastCheckedAt) {
        const lastChecked = new Date(instance.lastCheckedAt);
        setTimeInfo(prev => ({
          ...prev,
          lastChecked: lastChecked.toLocaleString()
        }));
      }
      if (instance.stateChangedAt) {
        const stateChanged = new Date(instance.stateChangedAt);
        setTimeInfo(prev => ({
          ...prev,
          stateChanged: stateChanged.toLocaleString()
        }));
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [instance.lastCheckedAt, instance.stateChangedAt]);

  const getQuarantineTimeRemaining = () => {
    if (instance.state !== 'QUARANTINED' || !instance.quarantineUntil) return null;
    
    const remaining = instance.quarantineUntil - Date.now();
    if (remaining <= 0) return 'Lifting soon...';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${instance.nickname}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete(instance.id);
    } catch (error) {
      alert('Failed to delete instance: ' + (error.message || 'Unknown error'));
      setDeleting(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset "${instance.nickname}" to UP state?`)) {
      return;
    }

    setResetting(true);
    try {
      await onReset(instance.id);
    } catch (error) {
      alert('Failed to reset instance: ' + (error.message || 'Unknown error'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="health-card" style={{ borderLeft: `4px solid ${stateColors[instance.state] || '#9e9e9e'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#333' }}>
            {instance.nickname}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', fontFamily: 'monospace' }}>
            {instance.instanceId}
          </p>
        </div>
        <div style={{
          padding: '6px 12px',
          borderRadius: '4px',
          backgroundColor: stateColors[instance.state] || '#9e9e9e',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {instance.state}
        </div>
      </div>

      <div className="health-row">
        <label>Region:</label>
        <span>{instance.region}</span>
      </div>

      <div className="health-row">
        <label>Suspect Count:</label>
        <span>{instance.suspectCount}</span>
      </div>

      <div className="health-row">
        <label>Quarantine Count:</label>
        <span>{instance.quarantineCount}</span>
      </div>

      {instance.state === 'QUARANTINED' && (
        <div className="health-row">
          <label>Quarantine Remaining:</label>
          <span style={{ color: '#f44336', fontWeight: '600' }}>
            {getQuarantineTimeRemaining()}
          </span>
        </div>
      )}

      {instance.lastError && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#856404'
        }}>
          <strong>Last Error:</strong> {instance.lastError}
        </div>
      )}

      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e9ecef',
        fontSize: '12px',
        color: '#666'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>Last Checked:</strong> {timeInfo.lastChecked || 'Never'}
        </div>
        <div>
          <strong>State Changed:</strong> {timeInfo.stateChanged || 'N/A'}
        </div>
      </div>
      <InstanceMetricsCard instanceId={instance.id} />
      <div style={{ marginTop: '16px' }}>
        <button
          onClick={handleReset}
          disabled={resetting || instance.state === 'UP'}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: resetting ? '#ccc' : instance.state === 'UP' ? '#6c757d' : '#ffc107',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: resetting || instance.state === 'UP' ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            marginBottom: '8px'
          }}
          onMouseOver={(e) => !resetting && instance.state !== 'UP' && (e.target.style.backgroundColor = '#e0a800')}
          onMouseOut={(e) => !resetting && instance.state !== 'UP' && (e.target.style.backgroundColor = '#ffc107')}
        >
          {resetting ? 'Resetting...' : instance.state === 'UP' ? 'Already UP' : 'Reset to UP'}
        </button>
        
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: deleting ? '#ccc' : '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: deleting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => !deleting && (e.target.style.backgroundColor = '#c82333')}
          onMouseOut={(e) => !deleting && (e.target.style.backgroundColor = '#dc3545')}
        >
          {deleting ? 'Deleting...' : 'Delete Instance'}
        </button>
      </div>
    </div>
  );
}
