import React from 'react';

/**
 * OAuth2Button component
 * Button for Google OAuth2 authentication
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.disabled - Whether the button is disabled
 * @returns {React.ReactElement} OAuth2 button
 */
const OAuth2Button = ({ disabled = false }) => {
  const handleClick = () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="oauth2-button flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-200 transition-all duration-200 hover:border-slate-600 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Sign in with Google"
    >
      <svg className="oauth2-button__icon" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fillRule="evenodd">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
          <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
        </g>
      </svg>
      <span className="oauth2-button__text uppercase tracking-[0.16em]">Sign in with Google</span>
    </button>
  );
};

export default OAuth2Button;
