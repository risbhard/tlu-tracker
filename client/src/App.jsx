import { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import HourLog from './components/HourLog';
import ProjectSetup from './components/ProjectSetup';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (!user) {
    return <Login onLogin={setUser} />;
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
          <span className="user-name">{user.name}</span>
          <button className="btn btn-outline" onClick={() => setUser(null)}>Log Out</button>
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
          <Dashboard key={`dash-${refreshKey}`} user={user} setUser={setUser} onDataChange={refresh} />
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
