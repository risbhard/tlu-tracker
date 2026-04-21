import { useState, useEffect, useCallback } from 'react';
import '../mini-timer.css';
import WorkDetailsModal from './WorkDetailsModal';

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

  // Derive a simpler status label for rendering decisions
  const status = timerState.running
    ? 'running'
    : timerState.paused
    ? 'paused'
    : 'idle';
  const isActive = status === 'running' || status === 'paused';

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const loadProjects = useCallback(async (uid) => {
    if (!uid) return;
    try {
      setLoading(true);
      const activeProjects = await window.electronAPI?.projects?.getActive(uid);
      setProjects(activeProjects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize user + timer state listener
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(parseInt(storedUserId, 10));
    } else {
      console.warn('No user ID found. Mini timer may not work properly.');
      setUserId(1);
    }

    const offState = window.electronAPI?.timer?.onStateChanged?.((state) => {
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    });

    return () => {
      if (typeof offState === 'function') offState();
    };
  }, []);

  // Load projects whenever user becomes available
  useEffect(() => {
    loadProjects(userId);
  }, [userId, loadProjects]);

  // Listen for live project changes (create/archive from main window)
  useEffect(() => {
    if (!userId) return;
    const off = window.electronAPI?.projects?.onChanged?.(() => {
      loadProjects(userId);
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [userId, loadProjects]);

  // Tick display every second while running
  useEffect(() => {
    if (!timerState.running) return;
    const interval = setInterval(() => {
      setDisplayElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState.running]);

  const handleStartTimer = async () => {
    if (!selectedProjectId || !userId) {
      alert('Please select a project first');
      return;
    }
    try {
      const state = await window.electronAPI?.timer?.start(parseInt(selectedProjectId, 10), userId);
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handlePauseTimer = async () => {
    try {
      const state = await window.electronAPI?.timer?.pause();
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to pause timer:', error);
    }
  };

  const handleResumeTimer = async () => {
    try {
      const state = await window.electronAPI?.timer?.resume();
      setTimerState(state);
      setDisplayElapsed(state.elapsedMs || 0);
    } catch (error) {
      console.error('Failed to resume timer:', error);
    }
  };

  const requestStop = () => {
    setShowDetailsModal(true);
  };

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

  const handleModalSave = (notesText) => finalizeStop(notesText);
  const handleModalSkip = () => finalizeStop('');

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
  };

  const getStatusDot = () => (status === 'running' ? '#E31B54' : status === 'paused' ? '#D97706' : '#888');

  const getActiveProjectName = () => {
    const pid = timerState.projectId ?? (selectedProjectId ? parseInt(selectedProjectId, 10) : null);
    if (!pid) return 'Project';
    const project = projects.find((p) => p.id === pid);
    return project ? project.description : 'Project';
  };

  const dropdownStyle = isActive
    ? { opacity: 0.6, cursor: 'not-allowed', background: '#F3F4F6' }
    : {};

  const primaryBtnBase = {
    minHeight: 44,
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '8px 12px',
    flex: 1,
  };

  return (
    <div className="mini-timer-window">
      {/* Title Bar */}
      <div className="mini-timer-title-bar" style={{ WebkitAppRegion: 'drag' }}>
        <div className="title-bar-left">
          <div className="status-dot" style={{ background: getStatusDot() }}></div>
          <span className="title-text">TLU Tracker</span>
        </div>
        <div className="title-bar-right" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            className="title-btn"
            onClick={() => window.electronAPI?.app?.minimizeMiniTimer()}
            title="Minimize"
          >
            −
          </button>
          <button
            className="title-btn"
            onClick={() => window.electronAPI?.app?.hideMiniTimer()}
            title="Hide to tray"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mini-timer-body">
        {/* Project Dropdown */}
        <div className="project-selector">
          <select
            value={selectedProjectId || ''}
            onChange={handleProjectChange}
            disabled={isActive || loading}
            className="project-dropdown"
            style={dropdownStyle}
          >
            <option value="">
              {loading ? 'Loading projects...' : 'Select a project…'}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.description}
              </option>
            ))}
          </select>
          {isActive && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Locked during active session — stop to switch projects.
            </div>
          )}
        </div>

        {/* Timer Display */}
        <div className="timer-display">
          <span className="timer-value">{formatTime(displayElapsed)}</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStartTimer}
              style={{ ...primaryBtnBase, background: '#E31B54' }}
            >
              Start
            </button>
          )}

          {status === 'running' && (
            <>
              <button
                type="button"
                onClick={handlePauseTimer}
                style={{ ...primaryBtnBase, background: '#D97706' }}
              >
                Pause
              </button>
              <button
                type="button"
                onClick={requestStop}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#E31B54',
                  textDecoration: 'underline',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 4,
                  alignSelf: 'center',
                }}
              >
                Stop &amp; Save
              </button>
            </>
          )}

          {status === 'paused' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleResumeTimer}
                style={{ ...primaryBtnBase, background: '#0F6E56' }}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={requestStop}
                style={{ ...primaryBtnBase, background: '#E31B54' }}
              >
                Stop &amp; Save
              </button>
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && (
        <WorkDetailsModal
          projectName={getActiveProjectName()}
          elapsedMs={displayElapsed}
          onSave={handleModalSave}
          onSkip={handleModalSkip}
        />
      )}
    </div>
  );
}
