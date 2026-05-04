import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import HourLog from './components/HourLog';
import ProjectSetup from './components/ProjectSetup';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

const THEME_STORAGE_KEY = 'tlu-tracker-theme';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const refresh = () => setRefreshKey((k) => k + 1);

  // Tell the Electron main process which user is active so the mini timer
  // dropdown, timer state, and any future "current user" queries can switch
  // cleanly when a different person logs in.
  const handleLogin = (loggedInUser) => {
    try {
      window.electron?.invoke?.('session:setCurrentUser', loggedInUser?.id ?? null);
      window.electronAPI?.session?.setCurrentUser?.(loggedInUser?.id ?? null);
    } catch (err) {
      console.warn('[session] setCurrentUser(login) failed:', err);
    }
    if (loggedInUser?.id != null) {
      try {
        localStorage.setItem('userId', String(loggedInUser.id));
      } catch {
        // ignore
      }
    }
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    try {
      window.electron?.invoke?.('session:setCurrentUser', null);
      window.electronAPI?.session?.setCurrentUser?.(null);
    } catch (err) {
      console.warn('[session] setCurrentUser(logout) failed:', err);
    }
    try {
      localStorage.removeItem('userId');
    } catch {
      // ignore
    }
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>TLU Tracker</h1>
          <p>Teaching Load Unit Hour Tracking</p>
        </div>
        <div className="header-right">
          {window.electronAPI && (
            <button className="btn btn-outline" onClick={() => window.electronAPI.app.showMiniTimer()} title="Open Mini Timer">
              Mini Timer
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="user-name">{user.name}</span>
          <button className="btn btn-outline" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab ${view === 'projects' ? 'active' : ''}`}
          onClick={() => setView('projects')}
        >
          Projects
        </button>
        <button
          className={`tab ${view === 'log' ? 'active' : ''}`}
          onClick={() => setView('log')}
        >
          Hour Log
        </button>
      </nav>

      <main className="app-main">
        {view === 'dashboard' && (
          <Dashboard
            key={`dash-${refreshKey}`}
            user={user}
            setUser={setUser}
            onDataChange={refresh}
            onNavigate={setView}
          />
        )}
        {view === 'projects' && (
          <ProjectSetup key={`proj-${refreshKey}`} user={user} onDataChange={refresh} />
        )}
        {view === 'log' && (
          <HourLog key={`log-${refreshKey}`} user={user} onDataChange={refresh} />
        )}
      </main>
    </div>
  );
}

export default App;
