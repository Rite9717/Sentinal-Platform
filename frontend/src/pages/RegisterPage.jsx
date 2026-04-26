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
              <p className="text-sm font-medium text-[#0f6b3d]">Operator Onboarding</p>
              <h1 className="mt-4 font-['Space_Grotesk'] text-5xl font-semibold tracking-[-0.03em]">Create Account</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#7b817c]">
                Create your Sentinal identity to onboard EC2 targets, configure monitoring roles, and inspect Grafana-linked incident context.
              </p>
              <div className="mt-10 rounded-[28px] bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">What You Unlock</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[#7b817c]">
                  <li>Guided AWS role and stack setup for monitored instances.</li>
                  <li>Node Exporter, Prometheus, and Grafana installation guidance.</li>
                  <li>AI analysis that only runs after you select a snapshot and send a task.</li>
                </ul>
              </div>
            </div>

            <div className="mt-auto rounded-[28px] bg-[#0b3f25] p-5 text-white">
              <p className="text-2xl font-semibold">Start with one instance. Scale to the fleet.</p>
              <p className="mt-3 text-sm text-white/70">Registration leads directly into your guided onboarding flow.</p>
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
            <p className="text-sm font-medium text-[#0f6b3d] lg:hidden">Operator Onboarding</p>
            <h2 className="mt-4 font-['Space_Grotesk'] text-4xl font-semibold tracking-[-0.03em]">Register</h2>
            <p className="mt-4 text-base leading-7 text-[#7b817c] lg:hidden">
              Create your Sentinal identity to onboard EC2 targets and activate monitoring.
            </p>

            {successMessage && (
              <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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

            <div className="mt-8 text-center text-sm text-[#7b817c]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#0f6b3d] transition-colors hover:text-[#0b5a33]">
                Login here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
