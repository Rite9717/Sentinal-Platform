import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap');

        body {
          font-family: 'JetBrains Mono', monospace;
          background: #f6f7f3;
          color: #111827;
        }

        h1, h2, h3 {
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: -0.03em;
        }
      `}</style>

      <div className="min-h-screen bg-[#f6f7f3] px-5 py-5 text-[#111827]">
        <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1500px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden rounded-[32px] bg-[#eef2ed] p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:flex lg:flex-col">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0f6b3d] text-xl font-semibold text-white">S</div>
              <div>
                <p className="text-sm text-[#7b817c]">Sentinal</p>
                <h1 className="text-2xl font-semibold">Ops Manager</h1>
              </div>
            </div>

            <nav className="mt-16 space-y-3 text-lg text-[#7b817c]">
              {['Dashboard', 'Instances', 'AI Chat', 'Telemetry'].map((item, index) => (
                <div key={item} className={`rounded-2xl px-4 py-3 ${index === 0 ? 'bg-white text-[#0f6b3d] shadow-sm' : ''}`}>
                  {item}
                </div>
              ))}
            </nav>

            <div className="mt-auto overflow-hidden rounded-[28px] bg-[#0b3f25] p-5 text-white">
              <p className="text-2xl font-semibold leading-tight">Monitor incidents before they become outages.</p>
              <p className="mt-3 text-sm leading-6 text-white/70">Register instances, inspect snapshots, and run AI analysis from one clean workspace.</p>
              <Link to="/register" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0f6b3d]">
                Get started
              </Link>
            </div>
          </aside>

          <main className="rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f6b3d] text-white">S</div>
                <span className="text-xl font-semibold">Sentinal</span>
              </div>
              <div className="hidden h-14 max-w-xl flex-1 items-center rounded-full bg-[#f6f7f3] px-5 text-[#9ca3af] md:flex">
                Search instances, incidents, snapshots
              </div>
              <div className="flex gap-3">
                <Link to="/login" className="rounded-full border border-[#0f6b3d] px-5 py-3 font-medium text-[#0f6b3d] transition hover:bg-[#eef2ed]">
                  Login
                </Link>
                <Link to="/register" className="rounded-full bg-[#0f6b3d] px-5 py-3 font-medium text-white shadow-[0_14px_28px_rgba(15,107,61,0.18)] transition hover:bg-[#0b5a33]">
                  Register
                </Link>
              </div>
            </header>

            <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
              <div>
                <p className="text-sm font-medium text-[#0f6b3d]">AI Infrastructure Control Plane</p>
                <h2 className="mt-4 max-w-4xl text-5xl font-semibold leading-[1.02] md:text-7xl">
                  A clean dashboard for incidents, telemetry, and AI analysis.
                </h2>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#7b817c]">
                  Sentinal helps operators register EC2 instances, connect monitoring roles, install the metrics stack, inspect Grafana context, and analyse lifecycle snapshots only when they choose.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link to="/register" className="rounded-full bg-[#0f6b3d] px-7 py-4 text-base font-medium text-white shadow-[0_16px_36px_rgba(15,107,61,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b5a33]">
                    Launch Sentinal
                  </Link>
                  <Link to="/login" className="rounded-full border border-black/10 px-7 py-4 text-base font-medium text-[#111827] transition hover:bg-[#f6f7f3]">
                    Operator Login
                  </Link>
                </div>
              </div>

              <div className="rounded-[32px] bg-[#f6f7f3] p-5">
                <div className="rounded-[28px] bg-[#0f4f2d] p-6 text-white">
                  <p className="text-sm text-white/70">Active fleet</p>
                  <p className="mt-4 text-6xl font-semibold">24</p>
                  <p className="mt-3 text-sm text-lime-100">+5 monitored nodes this month</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {[
                    ['Snapshots', '38'],
                    ['Analyses', '12'],
                    ['Recovered', '9'],
                    ['Pending', '2'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] bg-white p-5">
                      <p className="text-sm text-[#7b817c]">{label}</p>
                      <p className="mt-3 text-3xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ['Guided onboarding', 'Account ID, instance ID, region, role setup, and telemetry install instructions in one flow.'],
                ['Snapshot analysis', 'Select a saved lifecycle incident snapshot, edit the AI task, then run analysis on demand.'],
                ['Grafana context', 'Open live metrics panels directly from the selected instance workspace.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[28px] bg-[#f6f7f3] p-6">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#7b817c]">{copy}</p>
                </div>
              ))}
            </section>
          </main>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
