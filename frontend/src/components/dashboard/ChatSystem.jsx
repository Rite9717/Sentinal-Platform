import React, { useMemo } from 'react';

function ChatSystem({
  instances,
  selectedInstance,
  selectedMetrics,
  selectedMessages,
  snapshots,
  selectedSnapshot,
  selectedSnapshotDetails,
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
  taskPresets,
  getStateTone,
  parseMetric,
  formatTimestamp,
}) {
  const selectedTone = getStateTone(selectedInstance?.state);
  const timeline = useMemo(
    () => parseStructuredTimeline(selectedSnapshotDetails, selectedSnapshot?.metricsTimeline),
    [selectedSnapshotDetails, selectedSnapshot?.metricsTimeline]
  );
  const timelineCount = timeline.length;
  const isDetailView = Boolean(selectedSnapshot);

  const openSnapshot = (snapshotId) => {
    onSelectSnapshot(snapshotId);
  };

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

        <div className={`grid min-h-0 gap-4 ${isDetailView ? 'xl:grid-rows-[auto_minmax(0,1fr)_auto]' : 'xl:grid-rows-[auto_minmax(0,1fr)]'}`}>
          <div className="rounded-[32px] bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            {isDetailView ? (
              <>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectSnapshot(null)}
                      className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eef2ed] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#0f6b3d] transition-all duration-200 hover:bg-[#dcebe0]"
                    >
                      <ArrowLeftIcon className="h-3.5 w-3.5" />
                      Change snapshot
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-4xl font-semibold text-[#111827]">{selectedInstance?.nickname || selectedInstance?.instanceId || 'No instance selected'}</h3>
                      <span className={`rounded-full bg-[#eef2ed] px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${selectedTone.text}`}>
                        {selectedInstance?.state || 'Offline'}
                      </span>
                      <span className="rounded-full bg-[#f7f8f4] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#7b817c]">
                        Snapshot #{selectedSnapshot?.id}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#7b817c]">
                      {selectedInstance?.instanceId || 'Waiting for registry data'} {selectedInstance?.region ? `· ${selectedInstance.region}` : ''}
                    </p>
                  </div>

                  <div className="grid min-w-full gap-3 text-sm text-[#7b817c] sm:grid-cols-3 lg:min-w-[420px]">
                    <StatPill label="CPU" value={`${parseMetric(selectedMetrics?.cpu)}%`} />
                    <StatPill label="Memory" value={`${parseMetric(selectedMetrics?.memory)}%`} />
                    <StatPill label="Intervals" value={`${timelineCount}`} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-3xl bg-[#f7f8f4] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#111827]">Transition timeline</p>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#7b817c]">
                        {timelineCount} intervals
                      </span>
                    </div>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {timeline.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-[#7b817c]">
                          No embedded timeline entries found for this snapshot.
                        </div>
                      ) : (
                        timeline.map((entry, index) => (
                          <TimelineRow
                            key={`${entry.timestamp || entry.time || index}-${index}`}
                            entry={entry}
                            index={index}
                            formatTimestamp={formatTimestamp}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-[#f7f8f4] p-4">
                    <p className="text-sm font-medium text-[#111827]">Snapshot metadata</p>
                    <div className="mt-4 space-y-3">
                      <InlineStat label="Snapshot" value={selectedSnapshot ? `#${selectedSnapshot.id}` : 'None'} />
                      <InlineStat label="Started" value={formatTimestamp(selectedSnapshotDetails?.activeIncident?.startedAt || selectedSnapshot?.startedAt)} />
                      <InlineStat label="Ended" value={formatTimestamp(selectedSnapshot?.resolvedAt)} />
                      <InlineStat label="Resolution" value={selectedSnapshot?.resolution || selectedSnapshotDetails?.activeIncident?.status || selectedSnapshot?.status || 'Open'} />
                      <InlineStat label="Anomalies" value={`${selectedSnapshotDetails?.activeAnomalies?.length || 0}`} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
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

                <div className="mt-5 rounded-3xl bg-[#f7f8f4] p-4">
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

                  <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
                          onSelect={() => openSnapshot(snapshot.id)}
                          formatTimestamp={formatTimestamp}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedInstance && (
            <>
              <div className="min-h-0 overflow-hidden rounded-[32px] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
                <div className="flex h-full min-h-[360px] flex-col">
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">Conversation</p>
                      <p className="mt-1 text-sm text-[#7b817c]">
                        {analysisLoading
                          ? 'Sentinal AI is gathering tool context...'
                          : selectedSnapshot
                            ? 'Snapshot mode: the selected snapshot is attached automatically when you press Send.'
                            : 'Instance mode: ask about current health, recent anomalies, or history without selecting a snapshot.'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${analysisLoading ? 'bg-[#0f6b3d] text-white' : 'bg-[#eef2ed] text-[#7b817c]'}`}>
                      {analysisLoading ? 'Running' : selectedSnapshot ? `Snapshot #${selectedSnapshot.id}` : 'Instance mode'}
                    </span>
                  </div>

                  <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                      {selectedMessages.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-black/10 bg-[#f7f8f4] px-5 py-8 text-center text-sm leading-7 text-[#7b817c]">
                          {selectedSnapshot
                            ? 'Send the default task to generate the first AI analysis for this snapshot.'
                            : 'Ask Sentinal AI about this instance. It will choose the needed read-only tools automatically.'}
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
                              {message.sender === 'ai' && Array.isArray(message.toolsUsed) && message.toolsUsed.length > 0 && (
                                <span className="mt-3 block border-t border-black/5 pt-2 text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">
                                  Tools used: {message.toolsUsed.join(', ')}
                                </span>
                              )}
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
                    <p className="mt-1 text-sm text-[#7b817c]">
                      {selectedSnapshot
                        ? 'Use the default, pick a preset, or edit the instruction. The selected snapshot payload goes with it.'
                        : 'Ask a live instance question. The agent will fetch only the tools required by your prompt.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {taskPresets.map((preset) => (
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
                      placeholder={selectedSnapshot ? 'Ask Sentinal AI to analyse this incident timeline...' : 'Ask about current health, recent spikes, recurring incidents, or next actions...'}
                      className="min-h-[112px] w-full resize-none rounded-3xl border border-black/10 bg-[#f7f8f4] px-4 py-4 text-sm leading-7 text-[#111827] outline-none transition-all duration-200 placeholder:text-[#9ca3af] focus:border-[#0f6b3d]/35 focus:bg-white"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-[#7b817c]">
                      <span>{tokenEstimate} estimated tokens</span>
                      <span className="h-1 w-1 rounded-full bg-slate-700" />
                      <span>{selectedSnapshot ? `Snapshot #${selectedSnapshot.id}` : 'Instance mode'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onSend}
                    disabled={!selectedInstance || analysisLoading}
                    aria-label="Send analysis request"
                    className="group relative flex h-14 shrink-0 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#0f6b3d] px-7 text-sm font-medium uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(15,107,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b5a33] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 lg:h-[112px]"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [animation:hoverPulse_1.4s_ease-in-out_infinite]" />
                    <span className="relative">{analysisLoading ? 'Analysing' : 'Send'}</span>
                    <SendIcon className="relative h-6 w-6" />
                  </button>
                </div>
              </div>
            </>
          )}
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

function SnapshotOption({ snapshot, active, onSelect, formatTimestamp }) {
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
        <span>{snapshot.resolution || snapshot.status || 'OPEN'}</span>
        <span className="text-right">{intervals} intervals</span>
      </div>
      <p className={active ? 'mt-2 text-xs text-white/65' : 'mt-2 text-xs text-[#7b817c]'}>{formatTimestamp(snapshot.startedAt)}</p>
    </button>
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

function TimelineRow({ entry, index, formatTimestamp }) {
  const state = entry.state || entry.instanceState || entry.eventType || 'UNKNOWN';
  const stamp = formatTimestamp(entry.timestamp || entry.time || entry.collectedAt);
  const note = entry.note || entry.message || 'Transition captured in lifecycle timeline';

  return (
    <div className="rounded-2xl bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">#{index + 1}</p>
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">{stamp}</p>
      </div>
      <p className="mt-2 text-sm font-medium text-[#111827]">{state}</p>
      <p className="mt-1 text-xs leading-6 text-[#7b817c]">{note}</p>
    </div>
  );
}

function parseStructuredTimeline(snapshotDetails, legacyTimelineValue) {
  if (snapshotDetails && typeof snapshotDetails === 'object') {
    const eventRows = Array.isArray(snapshotDetails.incidentEvents)
      ? snapshotDetails.incidentEvents.map((event) => ({
          eventType: event.eventType,
          state: event.eventType,
          collectedAt: event.createdAt,
          message: event.message || 'Incident event',
        }))
      : [];

    const anomalyRows = Array.isArray(snapshotDetails.activeAnomalies)
      ? snapshotDetails.activeAnomalies.flatMap((anomaly) =>
          (Array.isArray(anomaly.snapshots) ? anomaly.snapshots : []).map((snapshot) => ({
            state: snapshot.type,
            collectedAt: snapshot.collectedAt,
            message: `${anomaly.metricName || 'Metric'} ${snapshot.type || 'snapshot'} · CPU ${formatMetricValue(snapshot.cpuUsage)}`,
          }))
        )
      : [];

    const combined = [...eventRows, ...anomalyRows]
      .filter((row) => row.collectedAt || row.message)
      .sort((left, right) => {
        const leftTs = left.collectedAt ? new Date(left.collectedAt).getTime() : 0;
        const rightTs = right.collectedAt ? new Date(right.collectedAt).getTime() : 0;
        return leftTs - rightTs;
      });

    if (combined.length > 0) {
      return combined;
    }
  }
  return parseTimeline(legacyTimelineValue);
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

function formatMetricValue(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 'unavailable';
  }
  return `${Math.round(parsed * 10) / 10}%`;
}

function ArrowLeftIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M15 18l-6-6 6-6" />
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

export default ChatSystem;
