import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import InstanceRegistrationWizard from '../components/ec2/InstanceRegistrationWizard';
import {
  deleteInstance,
  getInstanceMetrics,
  getInstanceSnapshots,
  getUserInstances,
  registerInstance,
  resetInstance,
} from '../services/ec2Service';
import { useInstanceUpdates } from '../hooks/useInstanceUpdates';

const navItems = [
  { id: 'instances', label: 'Instances', icon: GridIcon },
  { id: 'chat', label: 'Chat', icon: ChatIcon },
];

const GRAFANA_HOST = process.env.REACT_APP_GRAFANA_URL;
const DASHBOARD_UID = process.env.REACT_APP_GRAFANA_DASHBOARD_UID;
const GRAFANA_PANELS = {
  cpu: process.env.REACT_APP_GRAFANA_PANEL_CPU,
  memory: process.env.REACT_APP_GRAFANA_PANEL_MEMORY,
  disk: process.env.REACT_APP_GRAFANA_PANEL_DISK,
  network: process.env.REACT_APP_GRAFANA_PANEL_NETWORK,
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const [activeScreen, setActiveScreen] = useState('instances');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [instances, setInstances] = useState([]);
  const [metricsById, setMetricsById] = useState({});
  const [snapshotsById, setSnapshotsById] = useState({});
  const [localMessagesById, setLocalMessagesById] = useState({});
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInstanceId, setActionInstanceId] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', fullName: '' });
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);
  const replyTimerRef = useRef(null);

  const selectedInstance = useMemo(
    () => instances.find((instance) => String(instance.id) === String(selectedInstanceId)) ?? instances[0] ?? null,
    [instances, selectedInstanceId]
  );

  const selectedMetrics = selectedInstance ? metricsById[selectedInstance.id] ?? null : null;

  const selectedMessages = useMemo(() => {
    if (!selectedInstance) {
      return [];
    }

    const snapshotMessages = (snapshotsById[selectedInstance.id] ?? [])
      .slice()
      .sort((left, right) => new Date(left.snapshotTime || 0) - new Date(right.snapshotTime || 0))
      .flatMap((snapshot) => {
        const snapshotId = snapshot.id ?? snapshot.Id ?? snapshot.snapshotTime;
        const messages = [
          {
            id: `snapshot-meta-${snapshotId}`,
            sender: 'user',
            text: buildSnapshotSummary(snapshot),
            timestamp: formatTimestamp(snapshot.snapshotTime),
          },
        ];

        if (snapshot.aiAnalysis || snapshot.aiContext) {
          messages.push({
            id: `snapshot-ai-${snapshotId}`,
            sender: 'ai',
            text: snapshot.aiAnalysis || snapshot.aiContext,
            timestamp: formatTimestamp(snapshot.snapshotTime),
          });
        }

        return messages;
      });

    return [...snapshotMessages, ...(localMessagesById[selectedInstance.id] ?? [])];
  }, [localMessagesById, selectedInstance, snapshotsById]);

  const tokenEstimate = draftMessage.trim() ? Math.round(draftMessage.trim().split(/\s+/).length * 1.35) : 0;

  const loadMetricsForInstance = useCallback(async (instanceId, silent = false) => {
    try {
      const metrics = await getInstanceMetrics(instanceId);
      setMetricsById((current) => ({ ...current, [instanceId]: metrics }));
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || 'Failed to load instance metrics');
      }
    }
  }, []);

  const loadSnapshots = useCallback(async (instanceId) => {
    try {
      const snapshots = await getInstanceSnapshots(instanceId);
      setSnapshotsById((current) => ({ ...current, [instanceId]: snapshots }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load AI context snapshots');
    }
  }, []);

  const loadDashboard = useCallback(async (showSpinner) => {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const data = await getUserInstances();
      setInstances(data);
      setError(null);

      if (data.length > 0) {
        await Promise.all(data.map((instance) => loadMetricsForInstance(instance.id, true)));
      } else {
        setMetricsById({});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load registry instances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadMetricsForInstance]);

  useEffect(() => {
    loadDashboard(true);

    const interval = window.setInterval(() => {
      loadDashboard(false);
    }, 15000);

    return () => {
      window.clearInterval(interval);
      if (replyTimerRef.current) {
        window.clearTimeout(replyTimerRef.current);
      }
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!instances.length) {
      setSelectedInstanceId(null);
      return;
    }

    if (!selectedInstanceId || !instances.some((instance) => String(instance.id) === String(selectedInstanceId))) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (activeScreen === 'chat' && selectedInstance?.id) {
      loadSnapshots(selectedInstance.id);
    }
  }, [activeScreen, loadSnapshots, selectedInstance?.id]);

  useEffect(() => {
    if (typeof endOfMessagesRef.current?.scrollIntoView === 'function') {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedMessages, activeScreen, isTyping]);

  useEffect(() => {
    setProfileForm({
      username: user?.username || '',
      fullName: user?.fullName || '',
    });
  }, [user]);

  useInstanceUpdates(user?.id, (update) => {
    setInstances((current) =>
      current.map((instance) =>
        instance.instanceId === update.instanceId
          ? { ...instance, state: update.state, lastError: update.lastError ?? instance.lastError }
          : instance
      )
    );

    const target = instances.find((instance) => instance.instanceId === update.instanceId);
    if (target?.id) {
      loadMetricsForInstance(target.id);
      loadSnapshots(target.id);
    }
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setError(null);

    try {
      await updateProfile({
        username: profileForm.username.trim(),
        fullName: profileForm.fullName.trim(),
      });
      setProfileModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleOpenChat = async (instanceId) => {
    setSelectedInstanceId(instanceId);
    setActiveScreen('chat');
    await loadSnapshots(instanceId);
  };

  const handleRegister = async (registrationData) => {
    try {
      await registerInstance(registrationData);
      setModalOpen(false);
      await loadDashboard(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register instance');
    }
  };

  const handleReset = async (instanceId) => {
    setActionInstanceId(instanceId);
    try {
      await resetInstance(instanceId);
      await Promise.all([loadDashboard(false), loadSnapshots(instanceId)]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset instance');
    } finally {
      setActionInstanceId(null);
    }
  };

  const handleDelete = async (instanceId) => {
    setActionInstanceId(instanceId);
    try {
      await deleteInstance(instanceId);
      setSnapshotsById((current) => {
        const next = { ...current };
        delete next[instanceId];
        return next;
      });
      setLocalMessagesById((current) => {
        const next = { ...current };
        delete next[instanceId];
        return next;
      });
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete instance');
    } finally {
      setActionInstanceId(null);
    }
  };

  const handleSendMessage = () => {
    if (!selectedInstance || !draftMessage.trim()) {
      return;
    }

    const userMessage = {
      id: `local-user-${Date.now()}`,
      sender: 'user',
      text: draftMessage.trim(),
      timestamp: formatTimestamp(new Date().toISOString()),
    };

    const prompt = draftMessage.trim();
    setLocalMessagesById((current) => ({
      ...current,
      [selectedInstance.id]: [...(current[selectedInstance.id] ?? []), userMessage],
    }));
    setDraftMessage('');
    setIsTyping(true);

    if (replyTimerRef.current) {
      window.clearTimeout(replyTimerRef.current);
    }

    replyTimerRef.current = window.setTimeout(() => {
      const aiMessage = {
        id: `local-ai-${Date.now()}`,
        sender: 'ai',
        text: buildOperatorResponse(selectedInstance, selectedMetrics, snapshotsById[selectedInstance.id] ?? [], prompt),
        timestamp: formatTimestamp(new Date().toISOString()),
      };

      setLocalMessagesById((current) => ({
        ...current,
        [selectedInstance.id]: [...(current[selectedInstance.id] ?? []), aiMessage],
      }));
      setIsTyping(false);
    }, 900);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg: #020510;
          --surface: #0a1628;
          --surface-strong: rgba(10, 22, 40, 0.84);
          --border: #1a2d4a;
          --text: #e8f4fd;
          --muted: #5a7a9a;
          --cyan: #00d4ff;
          --violet: #7b61ff;
          --success: #00ff88;
          --warning: #f5a623;
          --danger: #ff4757;
          --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
        }

        body {
          font-family: 'JetBrains Mono', monospace;
          color: var(--text);
          background:
            radial-gradient(circle at top, rgba(0, 212, 255, 0.12), transparent 30%),
            radial-gradient(circle at right, rgba(123, 97, 255, 0.12), transparent 24%),
            var(--bg);
        }

        h1, h2, h3, h4 {
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 0.08em;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(26, 45, 74, 0.95) rgba(2, 5, 16, 0.2);
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(2, 5, 16, 0.35);
        }

        *::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(0, 212, 255, 0.3), rgba(123, 97, 255, 0.3));
          border-radius: 9999px;
          border: 1px solid rgba(26, 45, 74, 0.9);
        }

        @keyframes pulseRing {
          0% { transform: scale(0.85); opacity: 0.75; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes hoverPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(0, 212, 255, 0.12); }
          50% { box-shadow: 0 0 22px rgba(0, 212, 255, 0.2); }
        }

        @keyframes shimmerSweep {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(130%); }
        }

        @keyframes typingDots {
          0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

      <div className="min-h-screen bg-transparent text-[color:var(--text)]">
        <div className="relative flex min-h-screen overflow-hidden bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.025)_0px,rgba(255,255,255,0.025)_1px,transparent_1px,transparent_4px)] opacity-20" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(123,97,255,0.12),transparent_28%)]" />

          <aside className={`relative z-10 flex h-screen shrink-0 flex-col border-r border-[color:var(--border)] bg-[rgba(10,22,40,0.72)] backdrop-blur-xl transition-all duration-200 ease-[var(--ease-out)] ${sidebarCollapsed ? 'w-24' : 'w-72'}`}>
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-5">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.22),rgba(123,97,255,0.16))] shadow-[0_0_35px_rgba(0,212,255,0.14)]">
                  <span className="absolute inset-x-2 top-0 h-px bg-cyan-300/90" />
                  <CoreIcon className="h-5 w-5 text-cyan-200" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-[0.35em] text-cyan-300/70">Sentinal Ops</p>
                    <h1 className="truncate text-lg font-semibold text-slate-100">Registry Command Grid</h1>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-2 text-slate-300 transition-all duration-200 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200"
                aria-label="Toggle sidebar"
              >
                <PanelIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6">
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveScreen(item.id)}
                      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${active ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-100 shadow-[inset_3px_0_0_rgba(0,212,255,0.95),0_0_25px_rgba(0,212,255,0.12)]' : 'border-transparent bg-transparent text-slate-400 hover:border-slate-700/70 hover:bg-slate-900/60 hover:text-slate-100'}`}
                    >
                      <span className={`absolute left-0 top-2 h-10 w-[3px] rounded-r-full bg-cyan-300 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span className="text-sm uppercase tracking-[0.2em]">{item.label}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

              <button
                type="button"
                className="group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-left text-slate-500 transition-all duration-200 hover:border-slate-700/70 hover:bg-slate-900/60 hover:text-slate-200"
              >
                <span className="absolute left-0 top-2 h-10 w-[3px] rounded-r-full bg-violet-400 opacity-0 transition-opacity duration-200 group-hover:opacity-70" />
                <GearIcon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-sm uppercase tracking-[0.2em]">Settings</span>}
              </button>
            </nav>

            <div className="space-y-3 border-t border-[color:var(--border)] p-4">
              {!sidebarCollapsed && (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {refreshing ? 'Syncing telemetry...' : 'Telemetry link stable'}
                </div>
              )}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-3">
                <div className="relative h-11 w-11 shrink-0 rounded-2xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,212,255,0.18),rgba(123,97,255,0.18))]">
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-cyan-100">
                    {getUserInitials(user?.fullName || user?.username || 'OP')}
                  </div>
                  <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--success)] shadow-[0_0_14px_rgba(0,255,136,0.8)]" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{user?.fullName || user?.username || 'Operator'}</p>
                    <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-500">{user?.role || 'Registry User'}</p>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileModalOpen(true)}
                      className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100 transition-all duration-200 hover:border-cyan-300/40 hover:bg-cyan-400/20"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-rose-100 transition-all duration-200 hover:border-rose-300/40 hover:bg-rose-400/20"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="relative z-10 flex min-h-screen flex-1 flex-col">
            {error && (
              <div className="px-5 pt-5 md:px-8">
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              </div>
            )}

            {activeScreen === 'instances' ? (
              <InstancesScreen
                user={user}
                instances={instances}
                metricsById={metricsById}
                selectedInstance={selectedInstance}
                loading={loading}
                actionInstanceId={actionInstanceId}
                onCreate={() => setModalOpen(true)}
                onSelectInstance={setSelectedInstanceId}
                onOpenChat={handleOpenChat}
                onReset={handleReset}
                onDelete={handleDelete}
              />
            ) : (
              <ChatScreen
                instances={instances}
                selectedInstance={selectedInstance}
                selectedMetrics={selectedMetrics}
                selectedMessages={selectedMessages}
                snapshots={selectedInstance ? snapshotsById[selectedInstance.id] ?? [] : []}
                draftMessage={draftMessage}
                onDraftChange={setDraftMessage}
                onSelectInstance={(instanceId) => {
                  setSelectedInstanceId(instanceId);
                  loadSnapshots(instanceId);
                }}
                onSend={handleSendMessage}
                isTyping={isTyping}
                endOfMessagesRef={endOfMessagesRef}
                tokenEstimate={tokenEstimate}
              />
            )}
          </main>

          {modalOpen && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#020510]/80 px-4 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setModalOpen(false)} aria-hidden="true" />
              <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(10,22,40,0.98),rgba(6,14,26,0.96))] shadow-[0_25px_100px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.9),transparent)]" />
                <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/75">Provision Registry Target</p>
                    <h2 className="mt-2 text-xl text-slate-50">Register Instance</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-2 text-slate-400 transition-all duration-200 hover:border-slate-500 hover:text-slate-100"
                    aria-label="Close modal"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-6 py-6">
                  <InstanceRegistrationWizard
                    onComplete={handleRegister}
                    onCancel={() => setModalOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}

          {profileModalOpen && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#020510]/80 px-4 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setProfileModalOpen(false)} aria-hidden="true" />
              <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(10,22,40,0.98),rgba(6,14,26,0.96))] shadow-[0_25px_100px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.9),transparent)]" />
                <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/75">Operator Identity</p>
                    <h2 className="mt-2 text-xl text-slate-50">Edit Profile</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-2 text-slate-400 transition-all duration-200 hover:border-slate-500 hover:text-slate-100"
                    aria-label="Close profile modal"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={handleProfileSave} className="space-y-5 px-6 py-6">
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Username</span>
                    <input
                      value={profileForm.username}
                      onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                      required
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 focus:border-cyan-400/40 focus:bg-slate-950"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Full Name</span>
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                      required
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 focus:border-cyan-400/40 focus:bg-slate-950"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Email</span>
                    <input
                      value={user?.email || ''}
                      readOnly
                      disabled
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-500 outline-none"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setProfileModalOpen(false)}
                      className="rounded-2xl border border-slate-700/80 px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-400 transition-all duration-200 hover:border-slate-500 hover:text-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="rounded-2xl border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.18),rgba(123,97,255,0.25))] px-5 py-3 text-sm uppercase tracking-[0.24em] text-cyan-50 transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

function InstancesScreen({
  user,
  instances,
  metricsById,
  selectedInstance,
  loading,
  actionInstanceId,
  onCreate,
  onSelectInstance,
  onOpenChat,
  onReset,
  onDelete,
}) {
  return (
    <section className="flex-1 px-5 py-5 md:px-8 md:py-7">
      <div className="rounded-[32px] border border-[color:var(--border)] bg-[rgba(4,10,20,0.58)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm md:p-7">
        <div className="flex flex-col gap-5 border-b border-[color:var(--border)] pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70">Fleet Overview</p>
            <h2 className="mt-3 text-3xl text-slate-50">Instances</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Registry-backed AWS monitoring for {user?.fullName || user?.username || 'your account'}. Every card below reflects the real backend `InstanceEntity` plus Prometheus metrics when the target is UP.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreate}
            className="group relative overflow-hidden rounded-2xl border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.14),rgba(123,97,255,0.22))] px-5 py-3 text-sm uppercase tracking-[0.24em] text-cyan-50 shadow-[0_0_35px_rgba(0,212,255,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_45px_rgba(0,212,255,0.18)]"
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-24 -translate-x-[130%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] transition-transform duration-700 group-hover:[animation:shimmerSweep_1s_linear]" />
            Register Instance
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-800/80 bg-slate-950/35 text-sm uppercase tracking-[0.24em] text-slate-500">
            Loading registry targets...
          </div>
        ) : instances.length === 0 ? (
          <div className="mt-7 rounded-[28px] border border-dashed border-slate-700 bg-slate-950/30 p-10 text-center">
            <p className="text-lg text-slate-200">No instances registered yet.</p>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Open the register flow to add an EC2 instance ID, region, and monitor role ARN from the backend contract.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {instances.map((instance) => {
              const metrics = metricsById[instance.id];
              const tone = getStateTone(instance.state);
              const cpu = parseMetric(metrics?.cpu);
              const memory = parseMetric(metrics?.memory);

              return (
                <article
                  key={instance.id}
                  onClick={() => onSelectInstance(instance.id)}
                  className={`group relative overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(10,22,40,0.95),rgba(6,14,28,0.92))] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_18px_60px_rgba(0,212,255,0.12)] ${instance.state === 'UP' ? 'border-cyan-400/25 shadow-[0_0_0_1px_rgba(0,212,255,0.08),0_0_42px_rgba(0,212,255,0.12)] [animation:hoverPulse_3.2s_ease-in-out_infinite]' : 'border-[color:var(--border)]'}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectInstance(instance.id);
                    }
                  }}
                >
                  <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,212,255,0.92),transparent)]" />
                  {instance.state === 'UP' && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.11),transparent_45%)]" />}
                  {selectedInstance?.id === instance.id && (
                    <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-cyan-300/80 ring-offset-2 ring-offset-[#020510]" />
                  )}

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{instance.region}</p>
                      <h3 className="mt-3 text-xl text-slate-50">{instance.nickname || instance.instanceId}</h3>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-600">{instance.instanceId}</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                      {instance.externalId ? `EXT ${instance.externalId.slice(0, 8)}` : 'Pending'}
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`relative flex h-3 w-3 items-center justify-center rounded-full ${tone.dot}`}>
                        <span className={`absolute inline-flex h-full w-full rounded-full ${tone.ring} ${instance.state === 'UP' ? '[animation:pulseRing_2s_ease-out_infinite]' : ''}`} />
                        <span className={`relative h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      </span>
                      <span className={`text-xs uppercase tracking-[0.3em] ${tone.text}`}>{instance.state}</span>
                    </div>
                    <p className="text-xs text-slate-500">{formatLastSeen(instance)}</p>
                  </div>

                  <div className="mt-6 space-y-4">
                    <MetricBar label="CPU" value={cpu} tone="cyan" />
                    <MetricBar label="Memory" value={memory} tone="violet" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <InfoPill label="Quarantine" value={`${instance.quarantineDurationMinutes || 0} min`} />
                    <InfoPill label="Strikes" value={`${instance.suspectCount}/${instance.maxSuspectStrikes || 0}`} />
                    <InfoPill label="Cycles" value={`${instance.quarantineCount}/${instance.maxQuarantineCycles || 0}`} />
                    <InfoPill label="Last Error" value={instance.lastError ? 'Present' : 'Clear'} />
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenChat(instance.id);
                      }}
                      className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-3 text-[11px] uppercase tracking-[0.24em] text-cyan-100 transition-all duration-200 hover:border-cyan-300/60 hover:bg-cyan-400/16"
                    >
                      Open Chat
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onReset(instance.id);
                      }}
                      disabled={actionInstanceId === instance.id}
                      className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-[11px] uppercase tracking-[0.24em] text-amber-100 transition-all duration-200 hover:border-amber-300/55 hover:bg-amber-400/16 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(instance.id);
                      }}
                      disabled={actionInstanceId === instance.id}
                      className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-3 text-[11px] uppercase tracking-[0.24em] text-rose-100 transition-all duration-200 hover:border-rose-300/55 hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {selectedInstance && (
          <GrafanaMetricsSection instance={selectedInstance} metrics={metricsById[selectedInstance.id]} />
        )}
      </div>
    </section>
  );
}

function GrafanaMetricsSection({ instance, metrics }) {
  const grafanaConfigured = Boolean(
    GRAFANA_HOST &&
    DASHBOARD_UID &&
    GRAFANA_PANELS.cpu &&
    GRAFANA_PANELS.memory &&
    GRAFANA_PANELS.disk &&
    GRAFANA_PANELS.network
  );

  const openUrl = grafanaConfigured
    ? `${GRAFANA_HOST}/d/${DASHBOARD_UID}/dashboard?orgId=1&var-instance=${encodeURIComponent(instance.instanceId)}`
    : null;

  return (
    <div className="mt-7 rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(8,18,34,0.96),rgba(4,12,22,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Grafana Metrics</p>
          <h3 className="mt-3 text-xl text-slate-50">{instance.nickname || instance.instanceId}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Live Grafana panels for `{instance.instanceId}` load as soon as this instance is selected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <InfoPill label="CPU" value={`${parseMetric(metrics?.cpu)}%`} />
          <InfoPill label="Memory" value={`${parseMetric(metrics?.memory)}%`} />
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-cyan-100 transition-all duration-200 hover:border-cyan-300/70 hover:bg-cyan-400/18"
            >
              Open in Grafana
            </a>
          )}
        </div>
      </div>

      {!grafanaConfigured ? (
        <div className="mt-5 rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          Grafana environment variables are incomplete. Add `REACT_APP_GRAFANA_URL`, `REACT_APP_GRAFANA_DASHBOARD_UID`, and panel IDs in `frontend/.env`.
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <GrafanaPanel title="CPU Usage" panelId={GRAFANA_PANELS.cpu} instanceId={instance.instanceId} height={220} />
          <GrafanaPanel title="Memory Usage" panelId={GRAFANA_PANELS.memory} instanceId={instance.instanceId} height={220} />
          <GrafanaPanel title="Disk Usage" panelId={GRAFANA_PANELS.disk} instanceId={instance.instanceId} height={200} />
          <GrafanaPanel title="Network Traffic" panelId={GRAFANA_PANELS.network} instanceId={instance.instanceId} height={200} />
        </div>
      )}
    </div>
  );
}

function GrafanaPanel({ title, panelId, instanceId, height }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const url = `${GRAFANA_HOST}/d-solo/${DASHBOARD_UID}/dashboard?orgId=1&from=now-30m&to=now&panelId=${panelId}&var-instance=${encodeURIComponent(instanceId)}&theme=dark&refresh=15s`;

  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/45 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{title}</p>
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-600">{loaded ? 'Live' : 'Loading'}</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#020510]" style={{ height }}>
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.18em] text-slate-500">
            Loading Grafana panel...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs uppercase tracking-[0.18em] text-rose-300">
            Grafana panel failed to load. Check embed permissions and dashboard variables.
          </div>
        )}
        <iframe
          title={title}
          src={url}
          width="100%"
          height={height}
          frameBorder="0"
          className={loaded && !error ? 'block w-full rounded-2xl' : 'hidden'}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}

function ChatScreen({
  instances,
  selectedInstance,
  selectedMetrics,
  selectedMessages,
  snapshots,
  draftMessage,
  onDraftChange,
  onSelectInstance,
  onSend,
  isTyping,
  endOfMessagesRef,
  tokenEstimate,
}) {
  const latestSnapshot = snapshots[0] ?? null;

  return (
    <section className="flex min-h-screen flex-1 flex-col px-5 py-5 md:px-8 md:py-7">
      <div className="flex flex-1 overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[rgba(4,10,20,0.6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm">
        <div className="hidden w-80 shrink-0 border-r border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(10,22,40,0.92),rgba(4,12,24,0.88))] lg:flex lg:flex-col">
          <div className="border-b border-[color:var(--border)] px-5 py-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Registered Targets</p>
            <h2 className="mt-3 text-xl text-slate-50">Chat</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">AI context is derived from the real snapshot and metric endpoints in the backend.</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {instances.map((instance) => {
              const tone = getStateTone(instance.state);
              const active = selectedInstance?.id === instance.id;
              return (
                <button
                  key={instance.id}
                  type="button"
                  onClick={() => onSelectInstance(instance.id)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all duration-200 ${active ? 'border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_24px_rgba(0,212,255,0.12)]' : 'border-slate-800/90 bg-slate-950/35 hover:border-slate-700 hover:bg-slate-900/55'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-100">{instance.nickname || instance.instanceId}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{instance.instanceId}</p>
                    </div>
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone.dot} shadow-[0_0_12px_currentColor]`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                    <span className={tone.text}>{instance.state}</span>
                    <span className="text-slate-600">{instance.region}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[color:var(--border)] px-5 py-5 md:px-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Context Channel</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.16))]">
                    <OrbIcon className="h-5 w-5 text-cyan-100" />
                  </div>
                  <div>
                    <h3 className="text-xl text-slate-50">{selectedInstance?.nickname || selectedInstance?.instanceId || 'No instance selected'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedInstance?.instanceId || 'Waiting for registry data'} · {selectedInstance?.state || 'OFFLINE'}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
                <StatPill label="CPU" value={`${parseMetric(selectedMetrics?.cpu)}%`} />
                <StatPill label="Memory" value={`${parseMetric(selectedMetrics?.memory)}%`} />
                <StatPill label="Snapshots" value={`${snapshots.length}`} />
              </div>
            </div>
          </div>

          <div className="grid border-b border-[color:var(--border)] px-4 py-4 md:grid-cols-[1.3fr_0.9fr] md:px-7">
            <div className="pr-0 md:pr-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-600">Latest Analysis</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {latestSnapshot?.aiAnalysis || latestSnapshot?.aiContext || 'No AI analysis is available yet for this instance. Once the backend stores a snapshot, it will appear here automatically.'}
              </p>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-4 md:mt-0 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-600">Latest Snapshot</p>
              <div className="mt-3 space-y-3 text-sm text-slate-400">
                <InlineStat label="Captured" value={formatTimestamp(latestSnapshot?.snapshotTime)} />
                <InlineStat label="Error Type" value={latestSnapshot?.errorType || 'None'} />
                <InlineStat label="Grafana" value={latestSnapshot?.grafanaSnapshotUrl ? 'Available' : 'N/A'} />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              {selectedMessages.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/30 px-5 py-8 text-center text-sm leading-7 text-slate-500">
                  No snapshot conversation yet. The backend has not returned AI context for this instance.
                </div>
              )}

              {selectedMessages.map((message) => (
                <div key={message.id} className={`group flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-3xl items-end gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {message.sender === 'ai' && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.18))] shadow-[0_0_24px_rgba(0,212,255,0.1)]">
                        <OrbIcon className="h-4 w-4 text-cyan-100" />
                      </div>
                    )}
                    <div className={`relative rounded-[24px] border px-4 py-4 text-sm leading-7 transition-all duration-200 ${message.sender === 'user' ? 'border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.16))] text-slate-50 shadow-[0_0_30px_rgba(0,212,255,0.08)]' : 'border-slate-800 bg-[rgba(10,22,40,0.88)] text-slate-200'}`}>
                      <span className="block whitespace-pre-wrap">{message.text}</span>
                      <span className="pointer-events-none absolute -bottom-6 right-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {message.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.18))]">
                      <OrbIcon className="h-4 w-4 text-cyan-100" />
                    </div>
                    <div className="rounded-[24px] border border-slate-800 bg-[rgba(10,22,40,0.88)] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="h-2.5 w-2.5 rounded-full bg-cyan-300/85 [animation:typingDots_1.1s_ease-in-out_infinite]"
                            style={{ animationDelay: `${dot * 0.16}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={endOfMessagesRef} />
            </div>
          </div>

          <div className="border-t border-[color:var(--border)] px-4 py-4 md:px-7">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-slate-800 bg-[rgba(7,16,29,0.92)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-3 text-slate-400 transition-all duration-200 hover:border-cyan-400/35 hover:text-cyan-200"
                    aria-label="Attach file"
                  >
                    <AttachIcon className="h-4 w-4" />
                  </button>
                  <select
                    value={selectedInstance?.id || ''}
                    onChange={(event) => onSelectInstance(event.target.value)}
                    className="min-w-[260px] rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none transition-all duration-200 focus:border-cyan-400/35"
                  >
                    {instances.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.nickname || instance.instanceId} · {instance.state}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{tokenEstimate} est. tokens</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>{selectedInstance?.state || 'OFFLINE'}</span>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <textarea
                  value={draftMessage}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onSend();
                    }
                  }}
                  rows={3}
                  placeholder="Ask for a quick summary, request health context, or leave an operator note against the latest backend snapshot..."
                  className="min-h-[104px] flex-1 resize-none rounded-[24px] border border-slate-800 bg-slate-950/55 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-400/35 focus:bg-slate-950/70"
                />
                <button
                  type="button"
                  onClick={onSend}
                  className="group relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-cyan-300/35 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.24))] text-cyan-50 shadow-[0_0_35px_rgba(0,212,255,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(0,212,255,0.2)]"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [animation:hoverPulse_1.4s_ease-in-out_infinite]" />
                  <SendIcon className="relative h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricBar({ label, value, tone }) {
  const fillClass = tone === 'cyan'
    ? 'from-cyan-300 via-cyan-400 to-cyan-500'
    : 'from-violet-300 via-violet-400 to-indigo-500';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
        <span>{label}</span>
        <span className="text-slate-300">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fillClass} shadow-[0_0_16px_rgba(0,212,255,0.24)] transition-all duration-200`}
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className="mt-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className="mt-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function InlineStat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-600">{label}</span>
      <span className="text-right text-slate-300">{value}</span>
    </div>
  );
}

function getStateTone(state) {
  switch (state) {
    case 'UP':
      return {
        dot: 'bg-[color:var(--success)] text-[color:var(--success)]',
        ring: 'bg-[color:var(--success)]/30',
        text: 'text-emerald-300',
      };
    case 'SUSPECT':
      return {
        dot: 'bg-[color:var(--warning)] text-[color:var(--warning)]',
        ring: 'bg-[color:var(--warning)]/30',
        text: 'text-amber-300',
      };
    case 'QUARANTINED':
      return {
        dot: 'bg-[color:var(--violet)] text-[color:var(--violet)]',
        ring: 'bg-[color:var(--violet)]/30',
        text: 'text-violet-300',
      };
    default:
      return {
        dot: 'bg-[color:var(--danger)] text-[color:var(--danger)]',
        ring: 'bg-[color:var(--danger)]/30',
        text: 'text-rose-300',
      };
  }
}

function parseMetric(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.round(parsed * 10) / 10;
}

function formatLastSeen(instance) {
  if (instance.lastCheckedAt) {
    return `Checked ${formatTimestamp(instance.lastCheckedAt)}`;
  }
  if (instance.stateChangedAt) {
    return `State shift ${formatTimestamp(instance.stateChangedAt)}`;
  }
  return 'Awaiting first poll';
}

function formatTimestamp(value) {
  if (!value) {
    return 'Unavailable';
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSnapshotSummary(snapshot) {
  const parts = [`Snapshot captured ${formatTimestamp(snapshot.snapshotTime)}.`];

  if (snapshot.errorType || snapshot.errorMessage) {
    parts.push(`Error lane: ${snapshot.errorType || 'unknown'}${snapshot.errorMessage ? ` - ${snapshot.errorMessage}` : ''}.`);
  }

  if (typeof snapshot.cpuUsage === 'number' || typeof snapshot.memoryUsage === 'number') {
    parts.push(`CPU ${snapshot.cpuUsage?.toFixed?.(1) ?? '0.0'}%, memory ${snapshot.memoryUsage?.toFixed?.(1) ?? '0.0'}%.`);
  }

  return parts.join(' ');
}

function buildOperatorResponse(instance, metrics, snapshots, prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const latestSnapshot = snapshots[0];

  if (lowerPrompt.includes('error') || lowerPrompt.includes('incident')) {
    return latestSnapshot?.errorMessage
      ? `${instance.nickname || instance.instanceId} reports latest error context: ${latestSnapshot.errorMessage}`
      : `${instance.nickname || instance.instanceId} has no stored error message in the latest snapshot.`;
  }

  if (lowerPrompt.includes('health') || lowerPrompt.includes('status')) {
    return `${instance.nickname || instance.instanceId} is currently ${instance.state}. CPU is ${parseMetric(metrics?.cpu)}%, memory is ${parseMetric(metrics?.memory)}%, and disk is ${parseMetric(metrics?.disk)}%.`;
  }

  if (lowerPrompt.includes('summary') || lowerPrompt.includes('summarize')) {
    return latestSnapshot?.aiAnalysis || latestSnapshot?.aiContext || 'There is no AI summary stored yet, so the best available signal is the live metrics panel and the instance monitor state.';
  }

  return `Local operator assistant composed a response from the current backend telemetry for ${instance.nickname || instance.instanceId}. For persisted chat, the backend will need a dedicated message endpoint beyond snapshots and metrics.`;
}

function getUserInitials(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function GridIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChatIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 10h10" />
      <path d="M7 14h6" />
      <path d="M5 19l2.4-2.4A3 3 0 0 1 9.5 16H17a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H7A4 4 0 0 0 3 8v7a4 4 0 0 0 2 3.5Z" />
    </svg>
  );
}

function GearIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.1a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.7Z" />
    </svg>
  );
}

function PanelIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

function CoreIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M4.9 4.9l2.8 2.8" />
      <path d="M16.3 16.3l2.8 2.8" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M4.9 19.1l2.8-2.8" />
      <path d="M16.3 7.7l2.8-2.8" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

function OrbIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function AttachIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 11.5L12.6 20a5 5 0 1 1-7.1-7.1l9.2-9.2a3.5 3.5 0 1 1 5 5l-9.5 9.6a2 2 0 1 1-2.8-2.8l8.4-8.4" />
    </svg>
  );
}

function SendIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 3L10 14" />
      <path d="M21 3L14 21l-4-7-7-4L21 3Z" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export default DashboardPage;
