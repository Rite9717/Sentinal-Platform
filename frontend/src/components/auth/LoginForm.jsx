import React, { useEffect, useRef, useState } from 'react';
import OAuth2Button from './OAuth2Button';
import ErrorMessage from '../common/ErrorMessage';

const LoginForm = ({ onSubmit, error, loading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(error);
  const usernameRef = useRef(null);

  useEffect(() => {
    setLocalError(error);
  }, [error]);

  useEffect(() => {
    if (localError && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [localError]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form space-y-5" aria-label="Login form">
      <ErrorMessage message={localError} onDismiss={() => setLocalError(null)} />

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Username</span>
        <input
          ref={usernameRef}
          id="username"
          type="text"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (localError) setLocalError(null);
          }}
          disabled={loading}
          required
          aria-label="Username"
          aria-describedby={localError ? 'login-error' : undefined}
          aria-invalid={localError ? 'true' : 'false'}
          className="login-form__input w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-slate-950"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Password</span>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (localError) setLocalError(null);
          }}
          disabled={loading}
          required
          aria-label="Password"
          aria-describedby={localError ? 'login-error' : undefined}
          aria-invalid={localError ? 'true' : 'false'}
          className="login-form__input w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-slate-950"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="login-form__submit w-full rounded-2xl border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.18))] px-4 py-3 text-sm uppercase tracking-[0.2em] text-cyan-50 transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>

      <div className="pt-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-600">Or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
        <OAuth2Button disabled={loading} />
      </div>
    </form>
  );
};

export default LoginForm;
