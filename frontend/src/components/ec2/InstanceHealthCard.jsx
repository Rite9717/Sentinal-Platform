import React, { useState, useEffect } from 'react';
import './InstanceHealthCard.css';

const stateColors = {
  UP: '#4caf50',
  SUSPECT: '#ff9800',
  QUARANTINED: '#f44336',
  TERMINATED: '#9e9e9e'
};

export default function InstanceHealthCard({ instance, onUpdate }) {
  const [timeInfo, setTimeInfo] = useState({ lastChecked: '', stateChanged: '' });

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
    </div>
  );
}
