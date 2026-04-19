import { useState, useEffect } from 'react';
import '../mini-timer.css';

export default function MiniTimer() {
  const [timerState, setTimerState] = useState({
    running: false,
    paused: false,
    projectId: null,
    userId: null,
    elapsedMs: 0,
  });

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayElapsed, setDisplayElapsed] = useState(0);

  // Format elapsed time as HH:MM:SS
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Initialize: get user ID and load projects
  useEffect(() => {
    const initializeUser = () => {
      // Try to get user ID from localStorage (set when user logs in to main app)
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        setUserId(parseInt(storedUserId, 10));
      } else {
        console.warn('No user ID found. Mini timer may not work properly.');
        // For now, use a default for testing
        setUserId(1);
      }
    };

    initializeUser();

    // Listen for timer state changes
    if (window.electronAPI?.timer?.onStateChanged) {
      window.electronAPI.timer.onStateChanged((state) => {
        setTimerState(state);
        setDisplayElapsed(state.elapsedMs || 0);
      });
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  // Load active projects when userId changes
  useEffect(() => {
    if (!userId) return;

    const loadProjects = async () => {
      try {
        setLoading(true);
        const activeProjects = await window.electronAPI?.projects?.getActive(userId);
        setProjects(activeProjects || []);
        if (activeProjects && activeProjects.length > 0) {
          setSelectedProjectId(activeProjects[0].id);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [userId]);

  // Update elapsed time display every second when timer is running
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
      const state = await window.electronAPI?.timer?.start(selectedProjectId, userId);
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

  const handleStopTimer = async () => {
    try {
      const state = await window.electronAPI?.timer?.stop();
      setTimerState(state);
      setDisplayElapsed(0);
      setSelectedProjectId(projects.length > 0 ? projects[0].id : null);
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const handleProjectChange = (e) => {
    setSelectedProjectId(parseInt(e.target.value, 10));
  };

  const getButtonStyle = () => {
    if (timerState.running) {
      return { background: '#E31B54' }; // Magenta when running
    } else if (timerState.paused) {
      return { background: '#d97706' }; // Amber when paused
    } else {
      return { background: '#888' }; // Grey when idle
    }
  };

  const getButtonLabel = () => {
    if (timerState.running) {
      return 'PAUSE';
    } else if (timerState.paused) {
      return 'RESUME';
    } else {
      return 'START';
    }
  };

  const getStatusDot = () => {
    return timerState.running ? '#E31B54' : '#888';
  };

  const getSelectedProjectName = () => {
    if (!selectedProjectId) return 'Select Project';
    const project = projects.find((p) => p.id === selectedProjectId);
    return project ? project.description : 'Select Project';
  };

  return (
    <div className="mini-timer-window">
      {/* Title Bar - Draggable */}
      <div className="mini-timer-title-bar" style={{ WebkitAppRegion: 'drag' }}>
        <div className="title-bar-left">
          <div
            className="status-dot"
            style={{ background: getStatusDot() }}
          ></div>
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
            onClick={() => window.close()}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Main Widget Body */}
      <div className="mini-timer-body">
        {/* Project Dropdown */}
        <div className="project-selector">
          <select
            value={selectedProjectId || ''}
            onChange={handleProjectChange}
            disabled={timerState.running || loading}
            className="project-dropdown"
          >
            <option value="">
              {loading ? 'Loading projects...' : 'Select Project'}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.description}
              </option>
            ))}
          </select>
        </div>

        {/* Timer Display */}
        <div className="timer-display">
          <span className="timer-value">{formatTime(displayElapsed)}</span>
        </div>

        {/* Control Button */}
        <div className="control-button-container">
          <button
            className="control-button"
            style={getButtonStyle()}
            onClick={() => {
              if (timerState.running) {
                handlePauseTimer();
              } else if (timerState.paused) {
                handleResumeTimer();
              } else {
                handleStartTimer();
              }
            }}
            title={getButtonLabel()}
          >
            {getButtonLabel()}
          </button>
        </div>

        {/* Stop & Save Button */}
        {(timerState.running || timerState.paused) && (
          <button className="stop-save-btn" onClick={handleStopTimer}>
            Stop & Save
          </button>
        )}
      </div>
    </div>
  );
}
