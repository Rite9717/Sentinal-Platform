import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg: #020510;
          --surface: #0a1628;
          --border: #1a2d4a;
          --text: #e8f4fd;
          --muted: #5a7a9a;
          --cyan: #00d4ff;
          --violet: #7b61ff;
          --success: #00ff88;
        }

        body {
          font-family: 'JetBrains Mono', monospace;
          background:
            radial-gradient(circle at top, rgba(0, 212, 255, 0.12), transparent 32%),
            radial-gradient(circle at right, rgba(123, 97, 255, 0.12), transparent 24%),
            var(--bg);
          color: var(--text);
        }

        h1, h2, h3 {
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 0.08em;
        }
      `}</style>

      <div className="min-h-screen overflow-hidden bg-transparent text-[color:var(--text)]">
        <div className="relative min-h-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.025)_0px,rgba(255,255,255,0.025)_1px,transparent_1px,transparent_4px)] opacity-20" />
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
            <header className="flex items-center justify-between rounded-[24px] border border-[color:var(--border)] bg-[rgba(10,22,40,0.66)] px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.18),rgba(123,97,255,0.18))] shadow-[0_0_30px_rgba(0,212,255,0.15)]">
                  <span className="text-sm font-semibold text-cyan-100">S</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Sentinal Platform</p>
                  <h1 className="text-base text-slate-50">AI Instance Command Center</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="rounded-2xl border border-slate-700/80 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-300 transition-all duration-200 hover:border-cyan-400/40 hover:text-cyan-100"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-sm uppercase tracking-[0.18em] text-cyan-100 transition-all duration-200 hover:bg-cyan-400/20"
                >
                  Register
                </Link>
              </div>
            </header>

            <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.25fr_0.95fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.38em] text-cyan-300/70">Dark Ops Command Layer</p>
                <h2 className="mt-5 max-w-4xl text-4xl leading-tight text-slate-50 md:text-6xl">
                  Register, monitor, and interrogate AI-connected compute from one secure surface.
                </h2>
                <p className="mt-6 max-w-3xl text-sm leading-8 text-slate-400 md:text-base">
                  Sentinal is the operations console for EC2-backed AI infrastructure. Operators can onboard instances,
                  configure IAM monitoring access, install telemetry tooling, inspect Grafana metrics, and review AI
                  snapshot context from a unified dashboard.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    to="/register"
                    className="rounded-2xl border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.18))] px-6 py-4 text-sm uppercase tracking-[0.22em] text-cyan-50 shadow-[0_0_35px_rgba(0,212,255,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(0,212,255,0.2)]"
                  >
                    Launch Sentinal
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-2xl border border-slate-700/80 px-6 py-4 text-sm uppercase tracking-[0.22em] text-slate-300 transition-all duration-200 hover:border-slate-500 hover:text-slate-50"
                  >
                    Operator Login
                  </Link>
                </div>

                <div className="mt-10 grid gap-4 md:grid-cols-3">
                  {[
                    ['Registry-Backed Onboarding', 'Guided flow for AWS account ID, instance ID, region, role/stack creation, and monitor registration.'],
                    ['Grafana-Linked Telemetry', 'Every selected instance can render embedded Grafana panels and backend Prometheus metrics side by side.'],
                    ['AI Snapshot Context', 'Read backend-generated AI context and analysis directly inside the command console for each target.'],
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(10,22,40,0.72)] p-5 backdrop-blur-sm">
                      <h3 className="text-sm text-slate-100">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-500">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(10,22,40,0.92),rgba(6,14,28,0.94))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Operator Workflow</p>
                <div className="mt-6 space-y-4">
                  {[
                    ['1. Identify the target', 'Enter AWS account ID, instance ID, region, and a nickname for the node.'],
                    ['2. Grant monitoring access', 'Create the Sentinal IAM role or CloudFormation stack and paste the generated role ARN.'],
                    ['3. Install the telemetry stack', 'Follow guided commands for Node Exporter, Prometheus, and Grafana on the instance.'],
                    ['4. Observe and respond', 'Open the dashboard for state, live metrics, snapshots, and AI context.'],
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-[24px] border border-slate-800 bg-slate-950/35 p-5">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--success)] shadow-[0_0_16px_rgba(0,255,136,0.75)]" />
                        <p className="text-sm uppercase tracking-[0.18em] text-slate-100">{title}</p>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-500">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
