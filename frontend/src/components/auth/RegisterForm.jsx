import React, { useEffect, useRef, useState } from 'react';
import ErrorMessage from '../common/ErrorMessage';

const RegisterForm = ({ onSubmit, errors, serverError, loading, onFieldBlur }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [localServerError, setLocalServerError] = useState(serverError);
  const [fieldErrors, setFieldErrors] = useState(errors || {});

  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const fullNameRef = useRef(null);

  useEffect(() => {
    setLocalServerError(serverError);
  }, [serverError]);

  useEffect(() => {
    setFieldErrors(errors || {});
  }, [errors]);

  useEffect(() => {
    if (fieldErrors.username && usernameRef.current) {
      usernameRef.current.focus();
    } else if (fieldErrors.email && emailRef.current) {
      emailRef.current.focus();
    } else if (fieldErrors.password && passwordRef.current) {
      passwordRef.current.focus();
    } else if (fieldErrors.fullName && fullNameRef.current) {
      fullNameRef.current.focus();
    }
  }, [fieldErrors]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({ username, email, password, fullName });
  };

  return (
    <form onSubmit={handleSubmit} className="register-form space-y-5" aria-label="Registration form">
      <ErrorMessage message={localServerError} onDismiss={() => setLocalServerError(null)} />

      <RegisterField
        refProp={usernameRef}
        id="username"
        label="Username"
        value={username}
        disabled={loading}
        error={fieldErrors.username}
        onChange={(event) => {
          setUsername(event.target.value);
          if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: null });
          if (localServerError) setLocalServerError(null);
        }}
        onBlur={() => onFieldBlur('username', username)}
      />

      <RegisterField
        refProp={emailRef}
        id="email"
        label="Email"
        ariaLabel="Email address"
        type="email"
        value={email}
        disabled={loading}
        error={fieldErrors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
          if (localServerError) setLocalServerError(null);
        }}
        onBlur={() => onFieldBlur('email', email)}
      />

      <RegisterField
        refProp={passwordRef}
        id="password"
        label="Password"
        type="password"
        value={password}
        disabled={loading}
        error={fieldErrors.password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null });
          if (localServerError) setLocalServerError(null);
        }}
        onBlur={() => onFieldBlur('password', password)}
      />

      <RegisterField
        refProp={fullNameRef}
        id="fullName"
        label="Full Name"
        ariaLabel="Full name"
        value={fullName}
        disabled={loading}
        error={fieldErrors.fullName}
        onChange={(event) => {
          setFullName(event.target.value);
          if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: null });
          if (localServerError) setLocalServerError(null);
        }}
        onBlur={() => onFieldBlur('fullName', fullName)}
      />

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="register-form__submit w-full rounded-2xl border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,212,255,0.16),rgba(123,97,255,0.18))] px-4 py-3 text-sm uppercase tracking-[0.2em] text-cyan-50 transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};

function RegisterField({
  refProp,
  id,
  label,
  ariaLabel,
  type = 'text',
  value,
  disabled,
  error,
  onChange,
  onBlur,
}) {
  const errorId = `${id}-error`;

  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <input
        ref={refProp}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required
        aria-label={ariaLabel || label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={`register-form__input w-full rounded-2xl border bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-600 focus:bg-slate-950 ${error ? 'register-form__input--error border-rose-400/40' : 'border-slate-800 focus:border-cyan-400/40'}`}
      />
      {error && (
        <div id={errorId} className="register-form__field-error text-sm text-rose-300" role="alert">
          {error}
        </div>
      )}
    </label>
  );
}

export default RegisterForm;
