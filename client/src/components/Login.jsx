import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [tluCount, setTluCount] = useState(1);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        const user = await api.register(name.trim(), pin, tluCount);
        onLogin(user);
      } else {
        const user = await api.login(name.trim(), pin);
        onLogin(user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div
        className="left-panel"
        style={{
          backgroundImage: "url('/Images/campus-klo.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="left-panel-overlay" />
        <div className="left-panel-content">
          <div className="left-brand-logo">
            <div className="logo-card">
              <img src="/Images/oc-hall-logo.png" alt="Okanagan College Hall School of Business logo" />
            </div>
          </div>
          <h1>TLU Tracker</h1>
          <p className="subtitle">Teaching Load Unit Hour Tracking</p>
        </div>
      </div>
      <div className="right-panel">
        <form className="login-box" onSubmit={handleSubmit}>
          <div className="card-logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7C4 7 8 4 12 4C16 4 20 7 20 7C20 7 16 10 12 10C8 10 4 7 4 7Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 7L4 16C4 16 8 19 12 19C16 19 20 16 20 16L20 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 9L12 13L17 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>TLU Tracker</h2>
          <p className="card-subtitle">Welcome back, please log in to continue.</p>

          <div className="form-group">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="form-group">
            <label>PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4+ digit PIN"
              inputMode="numeric"
              required
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label>Number of TLU Releases</label>
              <input
                type="number"
                min="1"
                max="10"
                value={tluCount}
                onChange={(e) => setTluCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="login-actions">
            <button type="submit" className="btn btn-primary">
              {isRegister ? 'Create Account' : 'Log In'}
            </button>
          </div>

          <p className="toggle-link">
            {isRegister ? (
              <>Already have an account? <a onClick={() => { setIsRegister(false); setError(''); }}>Log in</a></>
            ) : (
              <>New user? <a onClick={() => { setIsRegister(true); setError(''); }}>Create account</a></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
