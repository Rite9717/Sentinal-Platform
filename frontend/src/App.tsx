import { useState } from 'react';
import './App.css';

function App() {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Login successful! Token: ${data.token.substring(0, 20)}...`);
        localStorage.setItem('token', data.token);
      } else {
        setMessage(`❌ Login failed: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          fullName: regFullName
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Registration successful! User: ${data.username}`);
        setView('login');
      } else {
        setMessage(`❌ Registration failed: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  return (
    <div className="app">
      <h1>Sentinal Backend Test</h1>
      
      <div className="tabs">
        <button 
          className={view === 'login' ? 'active' : ''} 
          onClick={() => setView('login')}
        >
          Login
        </button>
        <button 
          className={view === 'register' ? 'active' : ''} 
          onClick={() => setView('register')}
        >
          Register
        </button>
      </div>

      {message && <div className="message">{message}</div>}

      {view === 'login' ? (
        <form onSubmit={handleLogin}>
          <h2>Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <h2>Register</h2>
          <input
            type="text"
            placeholder="Username"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Full Name"
            value={regFullName}
            onChange={(e) => setRegFullName(e.target.value)}
            required
          />
          <button type="submit">Register</button>
        </form>
      )}

      <div className="oauth">
        <h3>OAuth2 Google Login</h3>
        <a href="http://localhost:8080/oauth2/authorization/google">
          <button type="button">Sign in with Google</button>
        </a>
      </div>
    </div>
  );
}

export default App;
