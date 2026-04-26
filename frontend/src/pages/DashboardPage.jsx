import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import InstanceRegistrationWizard from '../components/ec2/InstanceRegistrationWizard';
import {
  analyseIncidentSnapshot,
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

const DEFAULT_AI_TASK = 'Analyse this selected lifecycle snapshot end to end. Identify the first degraded signal, explain the state transitions, infer the most likely root cause, and give immediate, short-term, long-term, and Sentinal configuration remediation steps.';

const TASK_PRESETS = [
  {
    label: 'Root Cause',
    value: 'Analyse this lifecycle snapshot and focus on the most likely root cause. Call out the first degraded metric, exact timestamps, and the state transition that proves the diagnosis.',
  },
  {
    label: 'Fix Plan',
    value: 'Create an operator remediation plan for this lifecycle snapshot. Separate immediate action, short-term fix, long-term fix, and Sentinal threshold/configuration recommendations.',
  },
  {
    label: 'Brief',
    value: 'Summarise this lifecycle snapshot for an incident review. Keep it concise: what happened, why it happened, user impact, and the next owner action.',
  },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const [activeScreen, setActiveScreen] = useState('instances');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [instances, setInstances] = useState([]);
  const [metricsById, setMetricsById] = useState({});
  const [snapshotsById, setSnapshotsById] = useState({});
  const [snapshotsLoadingById, setSnapshotsLoadingById] = useState({});
  const [snapshotSyncedAtById, setSnapshotSyncedAtById] = useState({});
  const [localMessagesById, setLocalMessagesById] = useState({});
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [draftMessage, setDraftMessage] = useState(DEFAULT_AI_TASK);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInstanceId, setActionInstanceId] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', fullName: '' });
  const [isTyping, setIsTyping] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const chatScrollRef = useRef(null);

  const selectedInstance = useMemo(
    () => instances.find((instance) => String(instance.id) === String(selectedInstanceId)) ?? instances[0] ?? null,
    [instances, selectedInstanceId]
  );

  const selectedMetrics = selectedInstance ? metricsById[selectedInstance.id] ?? null : null;
  const selectedSnapshots = useMemo(
    () => (selectedInstance ? snapshotsById[selectedInstance.id] ?? [] : []),
    [selectedInstance, snapshotsById]
  );
  const selectedSnapshot = useMemo(
    () => selectedSnapshots.find((snapshot) => String(snapshot.id) === String(selectedSnapshotId)) ?? selectedSnapshots[0] ?? null,
    [selectedSnapshotId, selectedSnapshots]
  );

  const selectedMessages = useMemo(() => {
    if (!selectedInstance) {
      return [];
    }

    const snapshotMessages = selectedSnapshot
      ? [
          {
            id: `snapshot-meta-${selectedSnapshot.id}`,
            sender: 'user',
            text: buildSnapshotSummary(selectedSnapshot),
            timestamp: formatTimestamp(selectedSnapshot.incidentStartTime || selectedSnapshot.incidentEndTime),
          },
          ...(selectedSnapshot.aiAnalysis || selectedSnapshot.aiContext
            ? [{
                id: `snapshot-ai-${selectedSnapshot.id}`,
                sender: 'ai',
                text: selectedSnapshot.aiAnalysis || selectedSnapshot.aiContext,
                timestamp: formatTimestamp(selectedSnapshot.incidentEndTime || selectedSnapshot.incidentStartTime),
              }]
            : []),
        ]
      : [];

    return [...snapshotMessages, ...(localMessagesById[selectedInstance.id] ?? [])];
  }, [localMessagesById, selectedInstance, selectedSnapshot]);

  const effectiveAiTask = draftMessage.trim() || DEFAULT_AI_TASK;
  const tokenEstimate = Math.round(effectiveAiTask.split(/\s+/).length * 1.35);

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
    setSnapshotsLoadingById((current) => ({ ...current, [instanceId]: true }));
    try {
      const snapshots = await getInstanceSnapshots(instanceId);
      setSnapshotsById((current) => ({ ...current, [instanceId]: snapshots }));
      setSnapshotSyncedAtById((current) => ({ ...current, [instanceId]: new Date().toISOString() }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load AI context snapshots');
    } finally {
      setSnapshotsLoadingById((current) => ({ ...current, [instanceId]: false }));
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
    if (!selectedSnapshots.length) {
      setSelectedSnapshotId(null);
      return;
    }

    if (!selectedSnapshotId || !selectedSnapshots.some((snapshot) => String(snapshot.id) === String(selectedSnapshotId))) {
      setSelectedSnapshotId(selectedSnapshots[0].id);
    }
  }, [selectedSnapshotId, selectedSnapshots]);

  useEffect(() => {
    if (chatScrollRef.current) {
      if (typeof chatScrollRef.current.scrollTo === 'function') {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
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

  const handleSendMessage = async () => {
    if (!selectedInstance || !selectedSnapshot || analysisLoading) {
      return;
    }

    const prompt = effectiveAiTask;
    const userMessage = {
      id: `local-user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: formatTimestamp(new Date().toISOString()),
    };

    setLocalMessagesById((current) => ({
      ...current,
      [selectedInstance.id]: [...(current[selectedInstance.id] ?? []), userMessage],
    }));
    setIsTyping(true);
    setAnalysisLoading(true);

    try {
      const response = await analyseIncidentSnapshot({
        instanceId: selectedInstance.id,
        snapshotId: selectedSnapshot.id,
        prompt,
      });

      const aiMessage = {
        id: `local-ai-${Date.now()}`,
        sender: 'ai',
        text: response.combinedAnalysis || response.remediation || response.rootCause || 'Analysis completed, but no narrative was returned.',
        timestamp: formatTimestamp(new Date().toISOString()),
      };

      setLocalMessagesById((current) => ({
        ...current,
        [selectedInstance.id]: [...(current[selectedInstance.id] ?? []), aiMessage],
      }));
      await loadSnapshots(selectedInstance.id);
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'AI analysis failed. Check the backend and Sentinal AI service logs.';
      setLocalMessagesById((current) => ({
        ...current,
        [selectedInstance.id]: [
          ...(current[selectedInstance.id] ?? []),
          {
            id: `local-ai-error-${Date.now()}`,
            sender: 'ai',
            text: message,
            timestamp: formatTimestamp(new Date().toISOString()),
          },
        ],
      }));
      setError(message);
    } finally {
      setIsTyping(false);
      setAnalysisLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap');

        :root {
          --bg: #f6f7f3;
          --surface: #ffffff;
          --surface-strong: #f0f3ed;
          --border: rgba(15, 23, 42, 0.08);
          --text: #111827;
          --muted: #6b7280;
          --cyan: #0f6b3d;
          --violet: #8b5cf6;
          --success: #137a45;
          --warning: #d97706;
          --danger: #dc2626;
          --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
        }

        body {
          font-family: 'JetBrains Mono', monospace;
          color: var(--text);
          background: var(--bg);
        }

        h1, h2, h3, h4 {
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: -0.02em;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(15, 107, 61, 0.45) rgba(226, 232, 240, 0.8);
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(226, 232, 240, 0.8);
        }

        *::-webkit-scrollbar-thumb {
          background: rgba(15, 107, 61, 0.45);
          border-radius: 9999px;
          border: 1px solid rgba(26, 45, 74, 0.9);
        }

        @keyframes pulseRing {
          0% { transform: scale(0.85); opacity: 0.75; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes hoverPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(56, 189, 248, 0.08); }
          50% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.14); }
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

      <div className="min-h-screen bg-[#f6f7f3] text-[#111827]">
        <div className="relative min-h-screen">
          <aside className={`fixed bottom-5 left-5 top-5 z-20 flex flex-col overflow-hidden rounded-[32px] border border-black/5 bg-[#eef2ed] text-[#111827] shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-200 ease-[var(--ease-out)] ${sidebarCollapsed ? 'w-24' : 'w-72'}`}>
            <div className="flex items-center justify-between px-6 py-6">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f6b3d] text-white shadow-[0_12px_30px_rgba(15,107,61,0.2)]">
                  <CoreIcon className="h-6 w-6" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-[0.18em] text-[#6b7280]">Sentinal</p>
                    <h1 className="truncate text-xl font-semibold text-[#111827]">Instance Manager</h1>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="rounded-2xl border border-black/5 bg-white p-2 text-[#111827] shadow-sm transition-all duration-200 hover:bg-[#e2eadf]"
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
                      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left transition-all duration-200 ${active ? 'bg-white text-[#0f6b3d] shadow-sm' : 'text-[#7b817c] hover:bg-white/70 hover:text-[#111827]'}`}
                    >
                      <span className={`absolute left-0 top-2 h-10 w-1 rounded-r-full bg-[#0f6b3d] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span className="text-base">{item.label}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="my-6 h-px bg-black/5" />

              <button
                type="button"
                className="group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[#7b817c] transition-all duration-200 hover:bg-white/70 hover:text-[#111827]"
              >
                <span className="absolute left-0 top-2 h-10 w-[3px] rounded-r-full bg-violet-400 opacity-0 transition-opacity duration-200 group-hover:opacity-70" />
                <GearIcon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-base">Settings</span>}
              </button>
            </nav>

            <div className="space-y-3 border-t border-black/5 p-4">
              {!sidebarCollapsed && (
                <div className="rounded-2xl bg-white px-4 py-3 text-xs uppercase tracking-[0.16em] text-[#6b7280] shadow-sm">
                  {refreshing ? 'Syncing telemetry...' : 'Telemetry link stable'}
                </div>
              )}
              <div className="flex items-center gap-3 rounded-3xl bg-white px-3 py-3 shadow-sm">
                <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-[#0f6b3d]/10">
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#0f6b3d]">
                    {getUserInitials(user?.fullName || user?.username || 'OP')}
                  </div>
                  <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--success)]" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#111827]">{user?.fullName || user?.username || 'Operator'}</p>
                    <p className="truncate text-xs text-[#7b817c]">{user?.role || 'Registry User'}</p>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileModalOpen(true)}
                      className="rounded-xl bg-[#edf5ef] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f6b3d] transition-all duration-200 hover:bg-[#dcebe0]"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b817c] transition-all duration-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className={`relative z-10 h-screen overflow-y-auto transition-[margin] duration-200 ${sidebarCollapsed ? 'ml-[8.5rem]' : 'ml-[22.25rem]'}`}>
            {error && (
              <div className="px-5 pt-5 md:px-8">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                snapshots={selectedSnapshots}
                selectedSnapshot={selectedSnapshot}
                selectedSnapshotId={selectedSnapshotId}
                snapshotsLoading={selectedInstance ? snapshotsLoadingById[selectedInstance.id] : false}
                snapshotSyncedAt={selectedInstance ? snapshotSyncedAtById[selectedInstance.id] : null}
                draftMessage={draftMessage}
                onDraftChange={setDraftMessage}
                onSelectInstance={(instanceId) => {
                  setSelectedInstanceId(instanceId);
                  loadSnapshots(instanceId);
                }}
                onSelectSnapshot={setSelectedSnapshotId}
                onRefreshSnapshots={() => selectedInstance?.id && loadSnapshots(selectedInstance.id)}
                onSend={handleSendMessage}
                isTyping={isTyping}
                analysisLoading={analysisLoading}
                chatScrollRef={chatScrollRef}
                tokenEstimate={tokenEstimate}
              />
            )}
          </main>

          {modalOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setModalOpen(false)} aria-hidden="true" />
              <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between border-b border-black/5 px-6 py-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f6b3d]">Provision Registry Target</p>
                    <h2 className="mt-2 text-xl text-[#111827]">Register Instance</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl bg-[#f3f5f1] p-2 text-[#6b7280] transition-all duration-200 hover:bg-[#e8eee5] hover:text-[#111827]"
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
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setProfileModalOpen(false)} aria-hidden="true" />
              <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between border-b border-black/5 px-6 py-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f6b3d]">Operator Identity</p>
                    <h2 className="mt-2 text-xl text-[#111827]">Edit Profile</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    className="rounded-xl bg-[#f3f5f1] p-2 text-[#6b7280] transition-all duration-200 hover:bg-[#e8eee5] hover:text-[#111827]"
                    aria-label="Close profile modal"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={handleProfileSave} className="space-y-5 px-6 py-6">
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Username</span>
                    <input
                      value={profileForm.username}
                      onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                      required
                      className="w-full rounded-2xl border border-black/10 bg-[#f6f7f3] px-4 py-3 text-sm text-[#111827] outline-none transition-all duration-200 focus:border-[#0f6b3d]/40 focus:bg-white"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Full Name</span>
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                      required
                      className="w-full rounded-2xl border border-black/10 bg-[#f6f7f3] px-4 py-3 text-sm text-[#111827] outline-none transition-all duration-200 focus:border-[#0f6b3d]/40 focus:bg-white"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">Email</span>
                    <input
                      value={user?.email || ''}
                      readOnly
                      disabled
                      className="w-full rounded-2xl border border-black/10 bg-[#eef2ed] px-4 py-3 text-sm text-[#7b817c] outline-none"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setProfileModalOpen(false)}
                      className="rounded-2xl border border-black/10 px-4 py-3 text-sm uppercase tracking-[0.14em] text-[#6b7280] transition-all duration-200 hover:bg-[#f3f5f1] hover:text-[#111827]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="rounded-2xl bg-[#0f6b3d] px-5 py-3 text-sm uppercase tracking-[0.14em] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b5a33] disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="px-5 py-5 md:px-8 md:py-7">
      <div className="rounded-[32px] bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)] md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[#7b817c]">Fleet Overview</p>
            <h2 className="mt-2 text-5xl font-semibold text-[#111827]">Instances</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#7b817c]">
              Registry-backed AWS monitoring for {user?.fullName || user?.username || 'your account'}. Every card below reflects the real backend `InstanceEntity` plus Prometheus metrics when the target is UP.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreate}
            className="rounded-full bg-[#0f6b3d] px-7 py-4 text-base font-medium text-white shadow-[0_16px_36px_rgba(15,107,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b5a33]"
          >
            Register Instance
          </button>
        </div>

        {loading ? (
          <div className="mt-7 flex min-h-[320px] items-center justify-center rounded-[28px] bg-[#f6f7f3] text-sm uppercase tracking-[0.16em] text-[#7b817c]">
            Loading registry targets...
          </div>
        ) : instances.length === 0 ? (
          <div className="mt-7 rounded-[28px] border border-dashed border-black/10 bg-[#f6f7f3] p-10 text-center">
            <p className="text-lg text-[#111827]">No instances registered yet.</p>
            <p className="mt-3 text-sm leading-7 text-[#7b817c]">
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
                  className={`group relative overflow-hidden rounded-[28px] border p-6 text-[#111827] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] ${instance.state === 'UP' ? 'border-[#0f6b3d]/20 bg-[#f2f7f0]' : 'border-transparent bg-[#f7f8f4]'}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectInstance(instance.id);
                    }
                  }}
                >
                  {selectedInstance?.id === instance.id && (
                    <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-2 ring-[#0f6b3d]/25 ring-offset-2 ring-offset-white" />
                  )}

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-[#7b817c]">{instance.region}</p>
                      <h3 className="mt-3 text-2xl font-semibold text-[#111827]">{instance.nickname || instance.instanceId}</h3>
                      <p className="mt-2 text-xs text-[#7b817c]">{instance.instanceId}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#0f6b3d] shadow-sm">
                      {instance.externalId ? `EXT ${instance.externalId.slice(0, 8)}` : 'Pending'}
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`relative flex h-3 w-3 items-center justify-center rounded-full ${tone.dot}`}>
                        <span className={`absolute inline-flex h-full w-full rounded-full ${tone.ring} ${instance.state === 'UP' ? '[animation:pulseRing_2s_ease-out_infinite]' : ''}`} />
                        <span className={`relative h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      </span>
                      <span className={`text-xs uppercase tracking-[0.18em] ${tone.text}`}>{instance.state}</span>
                    </div>
                    <p className="text-xs text-[#7b817c]">{formatLastSeen(instance)}</p>
                  </div>

                  <div className="mt-6 space-y-4">
                    <MetricBar label="CPU" value={cpu} tone="cyan" />
                    <MetricBar label="Memory" value={memory} tone="violet" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
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
                      className="rounded-2xl bg-[#0f6b3d] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:bg-[#0b5a33]"
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
                      className="rounded-2xl bg-white px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a5a00] transition-all duration-200 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="rounded-2xl bg-white px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] transition-all duration-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

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

  const refreshPanels = () => {
    setRefreshKey((current) => current + 1);
    setLastRefresh(new Date());
  };

  const metricHighlights = [
    {
      label: 'CPU Load',
      value: `${parseMetric(metrics?.cpu)}%`,
      detail: 'Node exporter',
      tone: 'from-[#0f6b3d] to-[#10291d] text-white',
      bars: [28, 46, 35, 62, 44, 72, 52],
    },
    {
      label: 'Memory',
      value: `${parseMetric(metrics?.memory)}%`,
      detail: 'Working set',
      tone: 'from-[#ecf7ef] to-white text-[#0f2f1f]',
      bars: [38, 34, 48, 45, 59, 54, 63],
    },
    {
      label: 'Disk',
      value: `${parseMetric(metrics?.disk)}%`,
      detail: 'Root volume',
      tone: 'from-[#fff8e8] to-white text-[#3b2a05]',
      bars: [24, 26, 25, 31, 29, 33, 34],
    },
  ];

  return (
    <div className="mt-7 overflow-hidden rounded-[38px] bg-[#edf2eb] p-3 shadow-[0_26px_80px_rgba(15,23,42,0.08)] md:p-5">
      <div className="relative overflow-hidden rounded-[34px] bg-[#0f2017] px-5 py-6 text-white md:px-7 md:py-7">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#33b875]/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-full bg-[radial-gradient(circle_at_20%_100%,rgba(111,207,151,0.28),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:auto,28px_28px]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Observability
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
                {instance.region || 'region unknown'}
              </span>
            </div>
            <h3 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Grafana command view</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
              Live Prometheus panels for <span className="font-semibold text-white">{instance.nickname || instance.instanceId}</span>. Refresh reloads every embedded panel without touching the rest of the dashboard.
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refreshPanels}
              className="rounded-full bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#0f6b3d] shadow-[0_18px_40px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              Refresh Panels
            </button>
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15"
              >
                Open Grafana
              </a>
            )}
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 md:grid-cols-3">
          {metricHighlights.map((metric) => (
            <div key={metric.label} className={`overflow-hidden rounded-[28px] bg-gradient-to-br p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${metric.tone}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm opacity-70">{metric.label}</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{metric.value}</p>
                </div>
                <span className="rounded-full bg-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] opacity-75">
                  Live
                </span>
              </div>
              <div className="mt-5 flex h-12 items-end gap-1.5">
                {metric.bars.map((height, index) => (
                  <span
                    key={`${metric.label}-${height}-${index}`}
                    className="w-full rounded-t-full bg-current opacity-20"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] opacity-60">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-5 rounded-[34px] bg-white p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#111827]">Embedded telemetry panels</p>
            <p className="mt-1 text-sm text-[#7b817c]">
              Last refreshed {formatTimestamp(lastRefresh)} · instance variable `{instance.instanceId}`
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-full bg-[#eef2ed] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[#0f6b3d]">
              <span className="h-2 w-2 rounded-full bg-[#0f6b3d] shadow-[0_0_0_4px_rgba(15,107,61,0.12)]" />
              Live embed
            </span>
            <span className="rounded-full bg-[#f7f8f4] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[#7b817c]">
              30m window
            </span>
          </div>
        </div>

        {!grafanaConfigured ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-800">
            Grafana environment variables are incomplete. Add `REACT_APP_GRAFANA_URL`, `REACT_APP_GRAFANA_DASHBOARD_UID`, and panel IDs in `frontend/.env`.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            <GrafanaPanel key={`cpu-${refreshKey}`} title="CPU Usage" panelId={GRAFANA_PANELS.cpu} instanceId={instance.instanceId} height={236} accent="emerald" />
            <GrafanaPanel key={`memory-${refreshKey}`} title="Memory Usage" panelId={GRAFANA_PANELS.memory} instanceId={instance.instanceId} height={236} accent="blue" />
            <GrafanaPanel key={`disk-${refreshKey}`} title="Disk Usage" panelId={GRAFANA_PANELS.disk} instanceId={instance.instanceId} height={216} accent="amber" />
            <GrafanaPanel key={`network-${refreshKey}`} title="Network Traffic" panelId={GRAFANA_PANELS.network} instanceId={instance.instanceId} height={216} accent="violet" />
          </div>
        )}
      </div>
    </div>
  );
}

function GrafanaPanel({ title, panelId, instanceId, height, accent = 'emerald' }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const url = `${GRAFANA_HOST}/d-solo/${DASHBOARD_UID}/dashboard?orgId=1&from=now-30m&to=now&panelId=${panelId}&var-instance=${encodeURIComponent(instanceId)}&theme=dark&refresh=15s`;
  const accentClass = {
    emerald: 'from-emerald-400/55 to-emerald-400/0',
    blue: 'from-sky-400/55 to-sky-400/0',
    amber: 'from-amber-300/60 to-amber-300/0',
    violet: 'from-violet-400/55 to-violet-400/0',
  }[accent] || 'from-emerald-400/55 to-emerald-400/0';

  return (
    <div className="group overflow-hidden rounded-[30px] border border-black/5 bg-[#f4f6f1] p-2 shadow-[0_18px_38px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.11)]">
      <div className="relative overflow-hidden rounded-[26px] bg-[#101418] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r ${accentClass}`} />
        <div className="mb-3 flex items-center justify-between gap-4 px-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <p className="mt-3 truncate text-sm font-medium text-white">{title}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/45">Grafana · panel {panelId}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.12em] ${loaded ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/60'}`}>
            {loaded ? 'Live' : 'Loading'}
          </span>
        </div>
        <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#171b20]" style={{ height }}>
          {!loaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:28px_28px] text-xs uppercase tracking-[0.14em] text-white/45">
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
    </div>
  );
}

function ChatScreen({
  instances,
  selectedInstance,
  selectedMetrics,
  selectedMessages,
  snapshots,
  selectedSnapshot,
  selectedSnapshotId,
  snapshotsLoading,
  snapshotSyncedAt,
  draftMessage,
  onDraftChange,
  onSelectInstance,
  onSelectSnapshot,
  onRefreshSnapshots,
  onSend,
  isTyping,
  analysisLoading,
  chatScrollRef,
  tokenEstimate,
}) {
  const selectedTone = getStateTone(selectedInstance?.state);
  const timelineCount = parseTimeline(selectedSnapshot?.metricsTimeline).length;

  return (
    <section className="px-5 py-5 md:px-8 md:py-7">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-[32px] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="border-b border-black/5 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[#7b817c]">Targets</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#111827]">Incident Chat</h2>
              </div>
              <span className="rounded-full bg-[#eef2ed] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#0f6b3d]">
                {instances.length} live
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#7b817c]">
              Pick an instance, then choose the exact lifecycle snapshot you want the AI to analyse.
            </p>
          </div>

          <div className="max-h-[34vh] space-y-2 overflow-y-auto px-4 py-4 xl:max-h-[calc(100vh-190px)]">
            {instances.map((instance) => {
              const tone = getStateTone(instance.state);
              const active = selectedInstance?.id === instance.id;
              return (
                <button
                  key={instance.id}
                  type="button"
                  onClick={() => onSelectInstance(instance.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition-all duration-200 ${active ? 'bg-[#0f6b3d] text-white shadow-[0_14px_28px_rgba(15,107,61,0.16)]' : 'bg-[#f7f8f4] text-[#111827] hover:bg-[#eef2ed]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={active ? 'text-sm text-white' : 'text-sm text-[#111827]'}>{instance.nickname || instance.instanceId}</p>
                      <p className={active ? 'mt-1 text-xs text-white/60' : 'mt-1 text-xs text-[#7b817c]'}>{instance.instanceId}</p>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot} shadow-[0_0_12px_currentColor]`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                    <span className={active ? 'text-white' : tone.text}>{instance.state}</span>
                    <span className={active ? 'text-white/60' : 'text-[#7b817c]'}>{instance.region}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="rounded-[32px] bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-[#7b817c]">Analysis Workspace</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h3 className="text-4xl font-semibold text-[#111827]">{selectedInstance?.nickname || selectedInstance?.instanceId || 'No instance selected'}</h3>
                  <span className={`rounded-full bg-[#eef2ed] px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${selectedTone.text}`}>
                    {selectedInstance?.state || 'Offline'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#7b817c]">
                  {selectedInstance?.instanceId || 'Waiting for registry data'} {selectedInstance?.region ? `· ${selectedInstance.region}` : ''}
                </p>
              </div>

              <div className="grid min-w-full gap-3 text-sm text-[#7b817c] sm:grid-cols-3 lg:min-w-[420px]">
                <StatPill label="CPU" value={`${parseMetric(selectedMetrics?.cpu)}%`} />
                <StatPill label="Memory" value={`${parseMetric(selectedMetrics?.memory)}%`} />
                <StatPill label="Snapshots" value={`${snapshots.length}`} />
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <div className="rounded-3xl bg-[#f7f8f4] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Lifecycle snapshots</p>
                    <p className="mt-1 text-sm text-[#7b817c]">{snapshotsLoading ? 'Syncing latest incidents...' : `Last sync ${formatTimestamp(snapshotSyncedAt)}`}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onRefreshSnapshots}
                    disabled={snapshotsLoading}
                    className="rounded-full bg-white px-4 py-2 text-xs font-medium text-[#0f6b3d] shadow-sm transition-all duration-200 hover:bg-[#eef2ed] disabled:cursor-wait disabled:opacity-60"
                  >
                    {snapshotsLoading ? 'Syncing' : 'Refresh'}
                  </button>
                </div>

                <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {snapshots.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-center text-sm text-[#7b817c]">
                      No closed lifecycle snapshots yet. New incidents will appear here after the backend saves them.
                    </div>
                  ) : (
                    snapshots.map((snapshot) => (
                      <SnapshotOption
                        key={snapshot.id}
                        snapshot={snapshot}
                        active={String(snapshot.id) === String(selectedSnapshotId)}
                        onSelect={() => onSelectSnapshot(snapshot.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-[#f7f8f4] p-4">
                <p className="text-sm font-medium text-[#111827]">Selected snapshot</p>
                <div className="mt-4 space-y-3">
                  <InlineStat label="Snapshot" value={selectedSnapshot ? `#${selectedSnapshot.id}` : 'None'} />
                  <InlineStat label="Started" value={formatTimestamp(selectedSnapshot?.incidentStartTime)} />
                  <InlineStat label="Ended" value={formatTimestamp(selectedSnapshot?.incidentEndTime)} />
                  <InlineStat label="Resolution" value={selectedSnapshot?.resolution || 'Open'} />
                  <InlineStat label="Intervals" value={`${timelineCount}`} />
                  <InlineStat label="Stored AI" value={selectedSnapshot?.aiAnalysis ? 'Available' : 'Not generated'} />
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden rounded-[32px] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="flex h-full min-h-[360px] flex-col">
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-[#111827]">Conversation</p>
                  <p className="mt-1 text-sm text-[#7b817c]">{analysisLoading ? 'Sentinal AI is analysing the selected snapshot...' : 'Analysis starts only when you press Send.'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${analysisLoading ? 'bg-[#0f6b3d] text-white' : 'bg-[#eef2ed] text-[#7b817c]'}`}>
                  {analysisLoading ? 'Running' : 'Idle'}
                </span>
              </div>

              <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              {selectedMessages.length === 0 && (
                <div className="rounded-3xl border border-dashed border-black/10 bg-[#f7f8f4] px-5 py-8 text-center text-sm leading-7 text-[#7b817c]">
                  Choose a snapshot and send the default task to generate the first AI analysis.
                </div>
              )}

              {selectedMessages.map((message) => (
                <div key={message.id} className={`group flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-3xl items-end gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {message.sender === 'ai' && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ed]">
                        <OrbIcon className="h-4 w-4 text-[#0f6b3d]" />
                      </div>
                    )}
                    <div className={`relative rounded-3xl px-4 py-4 text-sm leading-7 transition-all duration-200 ${message.sender === 'user' ? 'bg-[#0f6b3d] text-white' : 'bg-[#f7f8f4] text-[#111827]'}`}>
                      <span className="block whitespace-pre-wrap">{message.text}</span>
                      <span className="pointer-events-none absolute -bottom-6 right-2 text-[11px] uppercase tracking-[0.14em] text-[#7b817c] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {message.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef2ed]">
                      <OrbIcon className="h-4 w-4 text-[#0f6b3d]" />
                    </div>
                    <div className="rounded-3xl bg-[#f7f8f4] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="h-2.5 w-2.5 rounded-full bg-[#0f6b3d] [animation:typingDots_1.1s_ease-in-out_infinite]"
                            style={{ animationDelay: `${dot * 0.16}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-[#111827]">AI task</p>
                <p className="mt-1 text-sm text-[#7b817c]">Use the default, pick a preset, or edit the instruction before sending.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TASK_PRESETS.map((preset) => (
                  <TaskPresetButton key={preset.label} preset={preset} onSelect={() => onDraftChange(preset.value)} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
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
                  placeholder="Select an instance and lifecycle snapshot, then ask SentinelAI to analyse the incident timeline..."
                  className="min-h-[112px] w-full resize-none rounded-3xl border border-black/10 bg-[#f7f8f4] px-4 py-4 text-sm leading-7 text-[#111827] outline-none transition-all duration-200 placeholder:text-[#9ca3af] focus:border-[#0f6b3d]/35 focus:bg-white"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-[#7b817c]">
                  <span>{tokenEstimate} estimated tokens</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>{selectedSnapshot ? `Snapshot #${selectedSnapshot.id}` : 'No snapshot selected'}</span>
                </div>
              </div>

                <button
                  type="button"
                  onClick={onSend}
                  disabled={!selectedSnapshot || analysisLoading}
                  aria-label="Send analysis request"
                  className="group relative flex h-14 shrink-0 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#0f6b3d] px-7 text-sm font-medium uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(15,107,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b5a33] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 lg:h-[112px]"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [animation:hoverPulse_1.4s_ease-in-out_infinite]" />
                  <span className="relative">{analysisLoading ? 'Analysing' : 'Send'}</span>
                  <SendIcon className="relative h-6 w-6" />
                </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskPresetButton({ preset, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-full bg-[#eef2ed] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f6b3d] transition-all duration-200 hover:bg-[#dcebe0]"
    >
      {preset.label}
    </button>
  );
}

function SnapshotOption({ snapshot, active, onSelect }) {
  const intervals = parseTimeline(snapshot.metricsTimeline).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl px-4 py-3 text-left transition-all duration-200 ${active ? 'bg-[#0f6b3d] text-white shadow-[0_14px_28px_rgba(15,107,61,0.16)]' : 'bg-white text-[#111827] hover:bg-[#eef2ed]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Snapshot #{snapshot.id}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${snapshot.aiAnalysis ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-white/20 text-white' : 'bg-[#eef2ed] text-[#7b817c]'}`}>
          {snapshot.aiAnalysis ? 'Analysed' : 'Ready'}
        </span>
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.12em] ${active ? 'text-white/70' : 'text-[#7b817c]'}`}>
        <span>{snapshot.resolution || 'OPEN'}</span>
        <span className="text-right">{intervals} intervals</span>
      </div>
      <p className={active ? 'mt-2 text-xs text-white/65' : 'mt-2 text-xs text-[#7b817c]'}>{formatTimestamp(snapshot.incidentStartTime)}</p>
    </button>
  );
}

function MetricBar({ label, value, tone }) {
  const fillClass = tone === 'cyan'
    ? 'from-[#7bc59a] via-[#0f6b3d] to-[#0b5a33]'
    : 'from-[#c7d2fe] via-[#8b5cf6] to-[#6d28d9]';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">
        <span>{label}</span>
        <span className="text-current">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fillClass} transition-all duration-200`}
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">{label}</p>
      <p className="mt-2 text-sm text-current">{value}</p>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#f7f8f4] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function InlineStat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-[0.12em] text-[#7b817c]">{label}</span>
      <span className="text-right text-[#111827]">{value}</span>
    </div>
  );
}

function getStateTone(state) {
  switch (state) {
    case 'UP':
      return {
        dot: 'bg-[color:var(--success)] text-[color:var(--success)]',
        ring: 'bg-[color:var(--success)]/30',
        text: 'text-emerald-700',
      };
    case 'SUSPECT':
      return {
        dot: 'bg-[color:var(--warning)] text-[color:var(--warning)]',
        ring: 'bg-[color:var(--warning)]/30',
        text: 'text-amber-700',
      };
    case 'QUARANTINED':
      return {
        dot: 'bg-[color:var(--violet)] text-[color:var(--violet)]',
        ring: 'bg-[color:var(--violet)]/30',
        text: 'text-violet-700',
      };
    default:
      return {
        dot: 'bg-[color:var(--danger)] text-[color:var(--danger)]',
        ring: 'bg-[color:var(--danger)]/30',
        text: 'text-rose-700',
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
  const parts = [
    `Lifecycle snapshot #${snapshot.id} started ${formatTimestamp(snapshot.incidentStartTime)} and ended ${formatTimestamp(snapshot.incidentEndTime)}.`,
  ];

  if (snapshot.resolution) {
    parts.push(`Resolution: ${snapshot.resolution}.`);
  }

  const timelineCount = parseTimeline(snapshot.metricsTimeline).length;
  if (timelineCount > 0) {
    parts.push(`${timelineCount} metric transition intervals are embedded in this snapshot.`);
  }

  return parts.join(' ');
}

function parseTimeline(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
