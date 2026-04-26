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
        <span className="text-xs uppercase tracking-[0.12em] text-[#7b817c]">Username</span>
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
          className="login-form__input w-full rounded-2xl border border-black/10 bg-[#f6f7f3] px-4 py-3 text-sm text-[#111827] outline-none transition-all duration-200 placeholder:text-[#9ca3af] focus:border-[#0f6b3d]/40 focus:bg-white"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.12em] text-[#7b817c]">Password</span>
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
          className="login-form__input w-full rounded-2xl border border-black/10 bg-[#f6f7f3] px-4 py-3 text-sm text-[#111827] outline-none transition-all duration-200 placeholder:text-[#9ca3af] focus:border-[#0f6b3d]/40 focus:bg-white"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="login-form__submit w-full rounded-2xl bg-[#0f6b3d] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_28px_rgba(15,107,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b5a33] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>

      <div className="pt-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-[#7b817c]">Or</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>
        <OAuth2Button disabled={loading} />
      </div>
    </form>
  );
};

export default LoginForm;
