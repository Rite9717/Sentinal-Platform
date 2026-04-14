import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RegisterForm from '../components/auth/RegisterForm';
import authService from '../services/authService';
import { validateEmail, validateFullName, validatePassword, validateUsername } from '../utils/validation';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [errors, setErrors] = useState({
    username: null,
    email: null,
    password: null,
    fullName: null,
  });
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleFieldBlur = (field, value) => {
    let error = null;

    switch (field) {
      case 'username':
        error = validateUsername(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'fullName':
        error = validateFullName(value);
        break;
      default:
        break;
    }

    setErrors((current) => ({ ...current, [field]: error }));
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      await authService.register(data);
      setSuccessMessage('Registration successful! Please log in.');
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Registration successful! Please log in.' },
        });
      }, 1500);
    } catch (err) {
      setServerError(err.message || err || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#020510] text-[#e8f4fd]">
      <div className="relative min-h-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.025)_0px,rgba(255,255,255,0.025)_1px,transparent_1px,transparent_4px)] opacity-20" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(123,97,255,0.14),transparent_28%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-8 lg:px-10">
          <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="hidden rounded-[32px] border border-[#1a2d4a] bg-[rgba(10,22,40,0.72)] p-8 backdrop-blur-xl lg:block">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Operator Onboarding</p>
              <h1 className="mt-5 font-['Orbitron'] text-4xl uppercase tracking-[0.08em] text-slate-50">Create Account</h1>
              <p className="mt-5 max-w-xl text-sm leading-8 text-slate-400">
                Create your Sentinal identity to onboard EC2 targets, configure monitoring roles, and inspect live Grafana-linked metrics.
              </p>
              <div className="mt-10 rounded-[28px] border border-slate-800 bg-slate-950/35 p-6">
                <p className="text-sm font-['Orbitron'] uppercase tracking-[0.18em] text-slate-100">What You Unlock</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-500">
                  <li>Guided AWS role and stack setup for monitored instances.</li>
                  <li>Grafana-backed metrics and backend Prometheus snapshots.</li>
                  <li>AI-assisted operational context inside the dashboard.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#1a2d4a] bg-[linear-gradient(180deg,rgba(10,22,40,0.94),rgba(6,14,26,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70 lg:hidden">Operator Onboarding</p>
              <h2 className="mt-4 font-['Orbitron'] text-3xl uppercase tracking-[0.08em] text-slate-50">Register</h2>
              <p className="mt-4 text-sm leading-7 text-slate-500 lg:hidden">
                Create your Sentinal identity to onboard EC2 targets and activate monitoring.
              </p>

              {successMessage && (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {successMessage}
                </div>
              )}

              <div className="mt-8">
                <RegisterForm
                  onSubmit={handleSubmit}
                  errors={errors}
                  serverError={serverError}
                  loading={loading}
                  onFieldBlur={handleFieldBlur}
                />
              </div>

              <div className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-cyan-300 transition-colors hover:text-cyan-100">
                  Login here
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
