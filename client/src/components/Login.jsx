import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [tluCount, setTluCount] = useState(1);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userInfo = await api.getUserByName(name.trim());
      setSelectedUser(userInfo);
      if (userInfo.has_pin) {
        setShowPinPrompt(true);
      } else {
        // Login without PIN
        const user = await api.login(name.trim());
        checkPinPrompt(user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await api.login(selectedUser.name, pin);
      checkPinPrompt(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const checkPinPrompt = (user) => {
    if (!user.pin_prompt_shown) {
      setShowSetPinModal(true);
    } else {
      onLogin(user);
    }
  };

  const handleSetPin = async () => {
    if (!newPin || newPin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    try {
      await api.setPin(selectedUser.id, newPin);
      const user = await api.login(selectedUser.name, newPin);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSkipPin = async () => {
    try {
      await api.updateUser(selectedUser.id, { pin_prompt_shown: true });
      const user = await api.login(selectedUser.name);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await api.register(name.trim(), pin, tluCount);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetLogin = () => {
    setSelectedUser(null);
    setShowPinPrompt(false);
    setPin('');
    setError('');
  };

  if (showSetPinModal) {
    return (
      <div className="login-container">
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '14px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ color: '#3C3C3C', marginBottom: '1rem' }}>Would you like to set a 4-digit PIN?</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>This adds a layer of privacy to your hour logs.</p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#3C3C3C' }}>PIN (4+ digits)</label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter PIN"
                inputMode="numeric"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleSkipPin} style={{ backgroundColor: '#666', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>Skip</button>
              <button className="btn btn-primary" onClick={handleSetPin} style={{ backgroundColor: '#E31B54', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>Set PIN</button>
            </div>
            {error && <p className="error" style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div
        className="left-panel"
        style={{
          backgroundImage: "url('./Images/campus-klo.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="left-panel-overlay" />
        <div className="left-panel-content">
          <div className="left-brand-logo">
            <div className="logo-card">
              <img src="./Images/oc-hall-logo.png" alt="Okanagan College Hall School of Business logo" />
            </div>
          </div>
          <h1>TLU Tracker</h1>
          <p className="subtitle">Teaching Load Unit Hour Tracking</p>
        </div>
      </div>
      <div className="right-panel">
        <form className="login-box" onSubmit={isRegister ? handleRegisterSubmit : (selectedUser && showPinPrompt ? handlePinSubmit : handleNameSubmit)}>
          <div className="card-logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7C4 7 8 4 12 4C16 4 20 7 20 7C20 7 16 10 12 10C8 10 4 7 4 7Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 7L4 16C4 16 8 19 12 19C16 19 20 16 20 16L20 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 9L12 13L17 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>TLU Tracker</h2>
          <p className="card-subtitle">
            {isRegister ? 'Create your account' : selectedUser && showPinPrompt ? 'Enter your PIN' : 'Welcome back, please log in'}
          </p>

          {!isRegister && !selectedUser && (
            <div className="form-group">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
          )}

          {!isRegister && selectedUser && showPinPrompt && (
            <>
              <div className="form-group">
                <label>Name</label>
                <input value={selectedUser.name} disabled style={{ backgroundColor: '#f5f5f5' }} />
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
            </>
          )}

          {isRegister && (
            <>
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
                <label>PIN (optional)</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4+ digit PIN"
                  inputMode="numeric"
                />
              </div>
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
            </>
          )}

          {error && <p className="error">{error}</p>}

          <div className="login-actions">
            <button type="submit" className="btn btn-primary">
              {isRegister ? 'Create Account' : selectedUser && showPinPrompt ? 'Log In' : 'Continue'}
            </button>
            {!isRegister && selectedUser && (
              <button type="button" className="btn btn-secondary" onClick={resetLogin} style={{ marginLeft: '1rem' }}>
                Back
              </button>
            )}
          </div>

          <p className="toggle-link">
            {isRegister ? (
              <>Already have an account? <a onClick={() => { setIsRegister(false); resetLogin(); }}>Log in</a></>
            ) : (
              <>New user? <a onClick={() => { setIsRegister(true); resetLogin(); }}>Create account</a></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}