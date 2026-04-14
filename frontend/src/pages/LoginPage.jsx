import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Secure Access"
      title="Login"
      subtitle="Resume control of your registered infrastructure, live telemetry, and AI-linked incident context."
      asideTitle="Operator Access"
      asideCopy="Use your Sentinal credentials or continue through Google OAuth to reach the command grid."
      footer={(
        <>
          Don't have an account?{' '}
          <Link to="/register" className="text-cyan-300 transition-colors hover:text-cyan-100">
            Register here
          </Link>
        </>
      )}
    >
      <LoginForm onSubmit={handleSubmit} error={error} loading={loading} />
    </AuthShell>
  );
};

function AuthShell({ eyebrow, title, subtitle, asideTitle, asideCopy, footer, children }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#020510] text-[#e8f4fd]">
      <div className="relative min-h-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.025)_0px,rgba(255,255,255,0.025)_1px,transparent_1px,transparent_4px)] opacity-20" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(123,97,255,0.14),transparent_28%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-8 lg:px-10">
          <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="hidden rounded-[32px] border border-[#1a2d4a] bg-[rgba(10,22,40,0.72)] p-8 backdrop-blur-xl lg:block">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">{eyebrow}</p>
              <h1 className="mt-5 font-['Orbitron'] text-4xl uppercase tracking-[0.08em] text-slate-50">Operator Login</h1>
              <p className="mt-5 max-w-xl text-sm leading-8 text-slate-400">{subtitle}</p>
              <div className="mt-10 rounded-[28px] border border-slate-800 bg-slate-950/35 p-6">
                <p className="text-sm font-['Orbitron'] uppercase tracking-[0.18em] text-slate-100">{asideTitle}</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">{asideCopy}</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#1a2d4a] bg-[linear-gradient(180deg,rgba(10,22,40,0.94),rgba(6,14,26,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70 lg:hidden">{eyebrow}</p>
              <h2 className="mt-4 font-['Orbitron'] text-3xl uppercase tracking-[0.08em] text-slate-50">{title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-500 lg:hidden">{subtitle}</p>
              <div className="mt-8">{children}</div>
              <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
