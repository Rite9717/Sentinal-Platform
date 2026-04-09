import React, { useState, useEffect } from 'react';
import { getInstanceMetrics } from '../../services/ec2Service';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
// Replace with your actual Grafana host (EC2 public IP or domain)
const GRAFANA_HOST = process.env.REACT_APP_GRAFANA_URL

// Your Grafana dashboard UID — find it in the dashboard URL:
// http://<grafana-host>/d/<DASHBOARD_UID>/dashboard-name
const DASHBOARD_UID = process.env.REACT_APP_GRAFANA_DASHBOARD_UID

// Panel IDs from your Grafana dashboard (hover over panel title → Edit → note the id= in the URL)
const PANEL_IDS = {
  cpu:       process.env.REACT_APP_GRAFANA_PANEL_CPU, 
  memory:    process.env.REACT_APP_GRAFANA_PANEL_MEMORY, 
  disk:      process.env.REACT_APP_GRAFANA_PANEL_DISK,  
  network:   process.env.REACT_APP_GRAFANA_PANEL_NETWORK   
};

// Time range shown in the embedded panels (last 30 minutes by default)
const TIME_RANGE = 'from=now-30m&to=now';
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Builds a Grafana panel embed URL.
 * The `var-instance` variable must exist in your dashboard and filter by EC2 instance ID.
 *
 * @param {string|number} panelId  - Grafana panel id
 * @param {string}        instanceId - EC2 instance id (used as dashboard variable)
 */
const buildGrafanaUrl = (panelId, instanceId) =>
  `${GRAFANA_HOST}/d-solo/${DASHBOARD_UID}/dashboard` +
  `?orgId=1&${TIME_RANGE}&panelId=${panelId}` +
  `&var-instance=${encodeURIComponent(instanceId)}` +
  `&theme=light&refresh=15s`;

// ─── Fallback bar shown when Grafana is unavailable ───────────────────────────
const MetricBar = ({ label, value, unit, color }) => {
  const percentage = parseFloat(value).toFixed(1);
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: '#555' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>
          {percentage}{unit}
        </span>
      </div>
      <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px' }}>
        <div style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          borderRadius: '4px',
          backgroundColor: percentage > 80 ? '#dc3545' : percentage > 60 ? '#ffc107' : color,
          transition: 'width 0.4s ease'
        }} />
      </div>
    </div>
  );
};

// ─── A single embedded Grafana panel iframe ───────────────────────────────────
const GrafanaPanel = ({ title, panelId, instanceId, height = 200 }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const url = buildGrafanaUrl(panelId, instanceId);

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ position: 'relative', background: '#f0f2f5', borderRadius: '6px', overflow: 'hidden', height }}>
        {!loaded && !error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: '#888'
          }}>
            Loading panel…
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: '#dc3545'
          }}>
            ⚠ Could not load Grafana panel
          </div>
        )}
        <iframe
          src={url}
          title={title}
          width="100%"
          height={height}
          frameBorder="0"
          style={{ display: loaded && !error ? 'block' : 'none', borderRadius: '6px' }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          // Required if Grafana is on a different origin — ensure
          // grafana.ini has [security] allow_embedding = true
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
};

// ─── View toggle button ───────────────────────────────────────────────────────
const ViewToggle = ({ view, onChange }) => (
  <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
    {['grafana', 'simple'].map(v => (
      <button
        key={v}
        onClick={() => onChange(v)}
        style={{
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: '500',
          border: '1px solid',
          borderColor: view === v ? '#007bff' : '#dee2e6',
          backgroundColor: view === v ? '#007bff' : '#fff',
          color: view === v ? '#fff' : '#555',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        {v === 'grafana' ? '📊 Grafana' : '📈 Simple'}
      </button>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const InstanceMetricsCard = ({ instanceId }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grafana'); // 'grafana' | 'simple'

  const fetchMetrics = async () => {
    try {
      const data = await getInstanceMetrics(instanceId);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [instanceId]);

  const cardStyle = {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px'
  };

  const headingStyle = {
    margin: '0 0 16px',
    fontSize: '14px',
    color: '#333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  return (
    <div style={cardStyle}>
      <div style={headingStyle}>
        <span style={{ fontWeight: '600' }}>Instance Metrics</span>
        <a
          href={`${GRAFANA_HOST}/d/${DASHBOARD_UID}?var-instance=${instanceId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '11px', color: '#007bff', textDecoration: 'none' }}
        >
          Open in Grafana ↗
        </a>
      </div>

      <ViewToggle view={view} onChange={setView} />

      {/* ── Grafana embedded panels ── */}
      {view === 'grafana' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <GrafanaPanel title="CPU Usage" panelId={PANEL_IDS.cpu} instanceId={instanceId} height={180} />
            <GrafanaPanel title="Memory Usage" panelId={PANEL_IDS.memory} instanceId={instanceId} height={180} />
          </div>
          <GrafanaPanel title="Disk Usage" panelId={PANEL_IDS.disk} instanceId={instanceId} height={160} />
          <GrafanaPanel title="Network Traffic" panelId={PANEL_IDS.network} instanceId={instanceId} height={180} />

          <p style={{ fontSize: '11px', color: '#999', marginTop: '8px', marginBottom: 0 }}>
            Panels auto-refresh every 15 s · Powered by Grafana
          </p>
        </div>
      )}

      {/* ── Simple fallback view ── */}
      {view === 'simple' && (
        <>
          {loading && <p style={{ color: '#666', fontSize: '13px' }}>Loading metrics…</p>}

          {!loading && (!metrics || metrics.status === 'error') && (
            <p style={{ color: '#dc3545', fontSize: '13px' }}>
              Metrics unavailable — is Node Exporter running?
            </p>
          )}

          {!loading && metrics && metrics.status !== 'error' && (
            <>
              <MetricBar label="CPU Usage"    value={metrics.cpu}    unit="%" color="#007bff" />
              <MetricBar label="Memory Usage" value={metrics.memory} unit="%" color="#28a745" />
              <MetricBar label="Disk Usage"   value={metrics.disk}   unit="%" color="#6f42c1" />

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                {[
                  { label: 'Network In',  value: `${(parseFloat(metrics.networkIn)  / 1024).toFixed(2)} KB/s` },
                  { label: 'Network Out', value: `${(parseFloat(metrics.networkOut) / 1024).toFixed(2)} KB/s` },
                  { label: 'Load (1m)',   value: parseFloat(metrics.load).toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#666' }}>{label}</div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default InstanceMetricsCard;