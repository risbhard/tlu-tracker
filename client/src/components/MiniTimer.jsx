import { useState, useEffect, useRef } from 'react';

export default function MiniTimer() {
  const [timerState, setTimerState] = useState({
    running: false,
    project: null,
    elapsed: 0,
  });

  const [projects, setProjects] = useState([
    'Curriculum Review',
    'PD Day Planning',
    'Program Assessment',
    'Committee Work',
    'Research Project',
  ]);

  const [selectedProject, setSelectedProject] = useState(projects[0]);
  const [idleWarning, setIdleWarning] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [customAmount, setCustomAmount] = useState({ hours: 0, minutes: 0 });
  const [reconciliationOption, setReconciliationOption] = useState('recommended');

  const elapsedIntervalRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Initialize
  useEffect(() => {
    const initializeTimer = async () => {
      if (window.electronAPI) {
        const projects = await window.electronAPI.timer.getProjects();
        setProjects(projects);
        setSelectedProject(projects[0]);

        const state = await window.electronAPI.timer.getState();
        setTimerState(state);

        // Listen to state changes
        window.electronAPI.timer.onStateChanged((state) => {
          setTimerState(state);
        });

        // Listen to idle warnings
        window.electronAPI.timer.onIdleWarning((data) => {
          setIdleWarning(Math.floor(data.idleTime / 60)); // Convert to minutes
        });

        // Listen to reconcile events
        window.electronAPI.timer.onReconcile((data) => {
          setReconciliation(data);
        });
      }
    };

    initializeTimer();
  }, []);

  // Update elapsed time display every second
  useEffect(() => {
    if (timerState.running) {
      elapsedIntervalRef.current = setInterval(() => {
        setTimerState((prev) => ({
          ...prev,
          elapsed: prev.elapsed + 1000,
        }));
      }, 1000);
    }

    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
      }
    };
  }, [timerState.running]);

  const handleStartStop = async () => {
    if (timerState.running) {
      await window.electronAPI.timer.stop();
    } else {
      await window.electronAPI.timer.start(selectedProject);
    }
  };

  const handleIdleWarningResponse = async (stillWorking) => {
    if (stillWorking) {
      setIdleWarning(null);
    } else {
      await window.electronAPI.timer.pause();
      setIdleWarning(null);
    }
  };

  const handleReconciliationConfirm = async () => {
    let amount = 0;

    if (reconciliationOption === 'recommended') {
      amount = reconciliation.lockDuration || reconciliation.suspendDuration;
    } else if (reconciliationOption === 'custom') {
      amount = (customAmount.hours * 3600 + customAmount.minutes * 60) * 1000;
    } else {
      // Discard
      amount = 0;
    }

    await window.electronAPI.timer.reconcile({
      amount,
      unit: 'ms',
    });

    setReconciliation(null);
    setReconciliationOption('recommended');
    setCustomAmount({ hours: 0, minutes: 0 });
  };

  const handleDragStart = (e) => {
    dragOffsetRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleExpandClick = async () => {
    await window.electronAPI.app.openMainWindow();
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const statusDot = timerState.running ? '#E31B54' : '#888888';

  return (
    <div className="mini-timer-container">
      {/* Draggable Title Bar */}
      <div
        className="mini-timer-titlebar"
        onMouseDown={handleDragStart}
      >
        <div className="titlebar-content">
          <span className="status-dot" style={{ backgroundColor: statusDot }} />
          <span className="titlebar-text">TLU Tracker</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="mini-timer-content">
        {/* Project Selector */}
        <div className="mini-timer-section">
          <label className="mini-timer-label">Project</label>
          <select
            className="mini-timer-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={timerState.running}
          >
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>

        {/* Elapsed Time Display */}
        <div className="mini-timer-elapsed">
          {formatTime(timerState.elapsed)}
        </div>

        {/* Control Buttons */}
        <div className="mini-timer-buttons">
          <button
            className={`mini-timer-btn primary ${
              timerState.running ? 'stop' : 'start'
            }`}
            onClick={handleStartStop}
          >
            {timerState.running ? 'Stop' : 'Start'}
          </button>
          <button
            className="mini-timer-btn secondary"
            onClick={handleExpandClick}
          >
            Expand
          </button>
        </div>
      </div>

      {/* Idle Warning Overlay */}
      {idleWarning && (
        <div className="mini-timer-overlay">
          <div className="mini-timer-dialog">
            <h3>Still working?</h3>
            <p className="idle-time">
              You've been idle for {idleWarning} minute
              {idleWarning !== 1 ? 's' : ''}
            </p>
            <p className="idle-note">
              This won't appear during Zoom/Teams calls.
            </p>
            <div className="dialog-buttons">
              <button
                className="btn-yes"
                onClick={() => handleIdleWarningResponse(true)}
              >
                Yes, still working
              </button>
              <button
                className="btn-pause"
                onClick={() => handleIdleWarningResponse(false)}
              >
                Pause timer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Dialog */}
      {reconciliation && (
        <div className="mini-timer-overlay">
          <div className="mini-timer-dialog reconciliation">
            <h3>Session Reconciliation</h3>
            <div className="reconciliation-info">
              <p>
                <strong>Project:</strong> {reconciliation.project}
              </p>
              {reconciliation.lockTime && (
                <>
                  <p>
                    <strong>Work time:</strong>{' '}
                    {formatTime(reconciliation.lockDuration || 0)}
                  </p>
                  <p className="text-sm">
                    Worked until screen locked at{' '}
                    {new Date(reconciliation.lockTime).toLocaleTimeString()}
                  </p>
                </>
              )}
              {reconciliation.suspendTime && (
                <>
                  <p>
                    <strong>Work time:</strong>{' '}
                    {formatTime(reconciliation.suspendDuration || 0)}
                  </p>
                  <p className="text-sm">
                    System suspended at{' '}
                    {new Date(reconciliation.suspendTime).toLocaleTimeString()}
                  </p>
                </>
              )}
              <p className="text-sm">
                Resumed at {new Date(reconciliation.resumeTime || reconciliation.unlockTime).toLocaleTimeString()}
              </p>
            </div>

            <div className="reconciliation-options">
              <label className="option">
                <input
                  type="radio"
                  name="reconciliation"
                  value="recommended"
                  checked={reconciliationOption === 'recommended'}
                  onChange={(e) => setReconciliationOption(e.target.value)}
                />
                <span>
                  Log {Math.floor((reconciliation.lockDuration || reconciliation.suspendDuration) / 3600000)}h{' '}
                  {Math.floor(
                    ((reconciliation.lockDuration || reconciliation.suspendDuration) % 3600000) / 60000
                  )}
                  m (until lock)
                </span>
              </label>

              <label className="option">
                <input
                  type="radio"
                  name="reconciliation"
                  value="custom"
                  checked={reconciliationOption === 'custom'}
                  onChange={(e) => setReconciliationOption(e.target.value)}
                />
                <span>Custom amount</span>
              </label>

              {reconciliationOption === 'custom' && (
                <div className="custom-amount">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={customAmount.hours}
                    onChange={(e) =>
                      setCustomAmount({
                        ...customAmount,
                        hours: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="Hours"
                  />
                  <span>h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customAmount.minutes}
                    onChange={(e) =>
                      setCustomAmount({
                        ...customAmount,
                        minutes: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="Minutes"
                  />
                  <span>m</span>
                </div>
              )}

              <label className="option">
                <input
                  type="radio"
                  name="reconciliation"
                  value="discard"
                  checked={reconciliationOption === 'discard'}
                  onChange={(e) => setReconciliationOption(e.target.value)}
                />
                <span>Discard session</span>
              </label>
            </div>

            <button
              className="btn-confirm"
              onClick={handleReconciliationConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
