import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Maximize2, Minimize2 } from 'lucide-react';
import '../mini-timer.css';
import WorkDetailsModal from './WorkDetailsModal';

const API_BASE = window.location.protocol === 'file:'
  ? 'http://localhost:3001/api'
  : '/api';

function getEncouragement(hoursToday) {
  const totalMinutes = Math.max(0, Math.round(hoursToday * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (hoursToday === 0) return { emoji: '👋', message: 'Ready when you are' };
  if (hoursToday < 0.5) return { emoji: '🌱', message: 'Nice start to the day' };
  if (hoursToday < 1) return { emoji: '☕', message: `Warming up — ${totalMinutes}m logged` };
  if (hoursToday < 2) return { emoji: '✨', message: `Great momentum — ${h}h ${m}m logged` };
  if (hoursToday < 4) return { emoji: '🎯', message: `Strong focus today — ${h}h ${m}m logged` };
  if (hoursToday < 6) return { emoji: '🔥', message: `Deep work day — ${h}h ${m}m logged` };
  return { emoji: '🏆', message: `Remarkable day — ${h}h ${m}m logged` };
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export default function MiniTimer() {
  const [timerState, setTimerState] = useState({
    running: false,
    paused: false,
    projectId: null,
    userId: null,
    elapsedMs: 0,
  });

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [hoursToday, setHoursToday] = useState(0);

  const status = timerState.running ? 'running' : timerState.paused ? 'paused' : 'idle';
  const isActive = status === 'running' || status === 'paused';

  const loadProjects = useCallback(async (uid) => {
    if (!uid) return;
    try {
      setLoading(true);
      const activeProjects = await window.electronAPI?.projects?.getActive?.(uid);
      setProjects(activeProjects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHoursToday = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_BASE}/users/${uid}/logs?from=${today}&to=${today}`);
      if (!res.ok) return;
      const logs = await res.json();
      const sum = logs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
      setHoursToday(sum);
    } catch (err) {
      console.warn('Failed to load today hours:', err);
    }
  }, []);

  // Initialize user + timer state listener. The active user is owned by the
  // Electron main process (currentUserId), so query it via IPC and subscribe
  // to login/logout pushes rather than reading localStorage — different
  // BrowserWindows under file:// don't reliably share localStorage, and the
  // mini timer can mount before login.
  useEffect(() => {
    let cancelled = false;

    window.electronAPI?.session?.getCurrentUser?.().then((uid) => {
      if (!cancelled) setUserId(uid ?? null);
    });

    const offUser = window.electronAPI?.session?.onUserChanged?.((uid) => {
      setUserId(uid ?? null);
      setSelectedProjectId('');
    });

    const offState = window.electronAPI?.timer?.onStateChanged?.((state) => {
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    });

    return () => {
      cancelled = true;
      if (typeof offUser === 'function') offUser();
      if (typeof offState === 'function') offState();
    };
  }, []);

  // Load projects + today totals when user resolves
  useEffect(() => {
    loadProjects(userId);
    loadHoursToday(userId);
  }, [userId, loadProjects, loadHoursToday]);

  // Live refresh on project changes from main window. The main process now
  // pushes the project list as the payload (fresh set for the current user
  // after a login/logout) — fall back to reloading from the API if the
  // payload is missing for backward compatibility with older events.
  useEffect(() => {
    const handler = (_event, payload) => {
      if (Array.isArray(payload)) {
        setProjects(payload);
        // Drop any stale selection that belongs to the previous user.
        setSelectedProjectId('');
        setLoading(false);
      } else if (userId) {
        loadProjects(userId);
      }
    };
    const genericOff = window.electron?.on?.('projects:changed', handler);
    const off = window.electronAPI?.projects?.onChanged?.((data) => handler(null, data));
    return () => {
      if (typeof off === 'function') off();
      if (genericOff && window.electron?.off) {
        window.electron.off('projects:changed', genericOff);
      }
    };
  }, [userId, loadProjects]);

  // Live refresh of today total whenever a new entry is saved
  useEffect(() => {
    if (!userId) return;
    const off = window.electronAPI?.entries?.onChanged?.(() => {
      loadHoursToday(userId);
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [userId, loadHoursToday]);

  // Pill-initiated stop: open the notes modal here.
  useEffect(() => {
    const off = window.electronAPI?.app?.onRequestStop?.(() => {
      setShowDetailsModal(true);
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  // Tick display every second while running
  useEffect(() => {
    if (!timerState.running) return;
    const interval = setInterval(() => {
      setDisplayElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState.running]);

  const handleStart = async () => {
    if (!selectedProjectId || !userId) {
      alert('Please select a project first');
      return;
    }
    try {
      const state = await window.electronAPI?.timer?.start(
        parseInt(selectedProjectId, 10),
        userId
      );
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handlePause = async () => {
    try {
      const state = await window.electronAPI?.timer?.pause();
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to pause timer:', error);
    }
  };

  const handleResume = async () => {
    try {
      const state = await window.electronAPI?.timer?.resume();
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to resume timer:', error);
    }
  };

  const requestStop = () => setShowDetailsModal(true);

  const finalizeStop = async (notesText) => {
    try {
      const state = await window.electronAPI?.timer?.stop({ notes: notesText || '' });
      setTimerState(state);
      setDisplayElapsed(0);
      setSelectedProjectId('');
    } catch (error) {
      console.error('Failed to stop timer:', error);
    } finally {
      setShowDetailsModal(false);
    }
  };

  const getActiveProjectName = () => {
    const pid = timerState.projectId ?? (selectedProjectId ? parseInt(selectedProjectId, 10) : null);
    if (!pid) return 'Project';
    const project = projects.find((p) => p.id === pid);
    return project ? project.description : 'Project';
  };

  const statusLabel = status === 'running' ? 'Tracking' : status === 'paused' ? 'Paused' : 'Ready';
  const encouragement = getEncouragement(hoursToday);

  return (
    <div className="mini-timer-window">
      {/* Title Bar */}
      <div className="mini-timer-title-bar" style={{ WebkitAppRegion: 'drag' }}>
        <div className="title-bar-left">
          <div className="brand-mark" aria-hidden="true">T</div>
          <span className="title-text">TLU Tracker</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' }}>
          <span className={`status-pill ${status}`} aria-live="polite">
            <span className="status-dot" aria-hidden="true"></span>
            {statusLabel}
          </span>
          <div className="title-bar-right">
            <button
              className="title-btn mini-timer-maximize-btn"
              onClick={() => window.electronAPI?.app?.enterPillMode?.()}
              title="Minimize to pill"
              aria-label="Minimize to pill"
            >
              <Minimize2 size={14} />
            </button>
            <button
              className="title-btn mini-timer-maximize-btn"
              onClick={() => {
                if (window.electron?.invoke) {
                  window.electron.invoke('window:openDashboard');
                } else {
                  window.electronAPI?.app?.openMainWindow?.();
                }
              }}
              title="Open full dashboard"
              aria-label="Open full dashboard"
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="title-btn"
              onClick={() => window.electronAPI?.app?.minimizeMiniTimer()}
              title="Minimize"
              aria-label="Minimize"
            >
              −
            </button>
            <button
              className="title-btn"
              onClick={() => window.electronAPI?.app?.hideMiniTimer()}
              title="Hide to tray"
              aria-label="Hide to tray"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mini-timer-body">
        {status === 'idle' ? (
          <div className="project-selector">
            <label htmlFor="mt-project" className="project-label">Which project?</label>
            <select
              id="mt-project"
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loading}
              className="project-dropdown"
            >
              <option value="">
                {loading ? 'Loading projects…' : 'Select a project…'}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.description}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="active-project-display">
            <span className="active-project-label">You're working on</span>
            <span className="active-project-name">{getActiveProjectName()}</span>
            <span className="dropdown-lock-caption">
              Locked during active session — stop to switch projects.
            </span>
          </div>
        )}

        {/* Fixed ring dial with a rotating red dot around the circumference */}
        <div className="ring-wrap">
          <svg
            className="timer-dial"
            viewBox="0 0 100 100"
            width="140"
            height="140"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="4"
            />
            <g className={`timer-dot-rotator ${status === 'running' ? 'spinning' : ''}`}>
              <circle cx="50" cy="8" r="5" fill="#E31B54" />
            </g>
            <text
              x="50"
              y="52"
              textAnchor="middle"
              dominantBaseline="middle"
              className="timer-dial-text"
              fill="#3C3C3C"
            >
              {formatElapsed(displayElapsed)}
            </text>
            <text
              x="50"
              y="66"
              textAnchor="middle"
              dominantBaseline="middle"
              className="timer-dial-label"
              fill="#9B7560"
            >
              ELAPSED
            </text>
          </svg>
        </div>

        {/* Icon buttons — same state machine as before, just icons not text */}
        <div className="buttons-row">
          {status === 'idle' && (
            <button
              type="button"
              className="btn-primary full-width icon-btn"
              onClick={handleStart}
              disabled={!selectedProjectId}
              aria-label="Start timer"
              title="Start timer"
            >
              <Play size={20} />
            </button>
          )}

          {status === 'running' && (
            <>
              <button
                type="button"
                className="btn-pause icon-btn"
                onClick={handlePause}
                aria-label="Pause timer"
                title="Pause timer"
              >
                <Pause size={20} />
              </button>
              <button
                type="button"
                className="btn-primary compact icon-btn"
                onClick={requestStop}
                aria-label="Stop and save"
                title="Stop and save"
              >
                <Square size={18} />
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                type="button"
                className="btn-resume compact icon-btn"
                onClick={handleResume}
                aria-label="Resume timer"
                title="Resume timer"
              >
                <Play size={20} />
              </button>
              <button
                type="button"
                className="btn-primary compact icon-btn"
                onClick={requestStop}
                aria-label="Stop and save"
                title="Stop and save"
              >
                <Square size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rotating encouragement footer */}
      <div className="mini-timer-footer" aria-live="polite">
        <span className="footer-emoji" aria-hidden="true">{encouragement.emoji}</span>
        <span className="footer-message">{encouragement.message}</span>
      </div>

      {showDetailsModal && (
        <WorkDetailsModal
          projectName={getActiveProjectName()}
          elapsedMs={displayElapsed}
          onSave={(notesText) => finalizeStop(notesText)}
          onSkip={() => finalizeStop('')}
        />
      )}
    </div>
  );
}
