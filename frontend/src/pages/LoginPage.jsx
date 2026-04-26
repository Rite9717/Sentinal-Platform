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
          <Link to="/register" className="font-semibold text-[#0f6b3d] transition-colors hover:text-[#0b5a33]">
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
    <div className="min-h-screen overflow-hidden bg-[#f6f7f3] text-[#111827]">
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-5 py-5 lg:px-8">
        <div className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden rounded-[32px] bg-[#eef2ed] p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:flex lg:flex-col">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0f6b3d] text-xl font-semibold text-white">S</div>
              <div>
                <p className="text-sm text-[#7b817c]">Sentinal</p>
                <h1 className="text-2xl font-semibold">Ops Manager</h1>
              </div>
            </div>

            <div className="mt-16">
              <p className="text-sm font-medium text-[#0f6b3d]">{eyebrow}</p>
              <h1 className="mt-4 font-['Space_Grotesk'] text-5xl font-semibold tracking-[-0.03em]">Operator Login</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#7b817c]">{subtitle}</p>
              <div className="mt-10 rounded-[28px] bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">{asideTitle}</p>
                <p className="mt-3 text-sm leading-7 text-[#7b817c]">{asideCopy}</p>
              </div>
            </div>

            <div className="mt-auto rounded-[28px] bg-[#0b3f25] p-5 text-white">
              <p className="text-2xl font-semibold">Analyse saved incident snapshots when you choose.</p>
              <p className="mt-3 text-sm text-white/70">No automatic AI spend. Select snapshot, edit task, send.</p>
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
            <p className="text-sm font-medium text-[#0f6b3d] lg:hidden">{eyebrow}</p>
            <h2 className="mt-4 font-['Space_Grotesk'] text-4xl font-semibold tracking-[-0.03em]">{title}</h2>
            <p className="mt-4 text-base leading-7 text-[#7b817c] lg:hidden">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-8 text-center text-sm text-[#7b817c]">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
