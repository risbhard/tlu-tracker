import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import ProgressBar from './ProgressBar';

function formatLiveElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function ProgressRing({ used, allowed }) {
  const pct = allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  return (
    <div className="progress-ring-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#E31B54"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="progress-ring-center">
        <div className="progress-ring-hours">
          {used.toFixed(1)} of {allowed}
        </div>
        <div className="progress-ring-unit">hours</div>
        <div className="progress-ring-pct">{pct.toFixed(0)}% of release used</div>
      </div>
    </div>
  );
}

export default function Dashboard({ user, setUser, onDataChange, onNavigate }) {
  const [data, setData] = useState(null);
  const [openTooltip, setOpenTooltip] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loadingButtons, setLoadingButtons] = useState({});
  const [timerState, setTimerState] = useState(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const tooltipRef = useRef(null);

  // Mirror the mini timer's elapsed time — tick once per second while running
  useEffect(() => {
    setLiveElapsed(timerState?.elapsedMs || 0);
    if (!timerState?.running) return;
    const id = setInterval(() => setLiveElapsed((v) => v + 1000), 1000);
    return () => clearInterval(id);
  }, [timerState?.running, timerState?.elapsedMs]);

  useEffect(() => {
    api.getDashboard(user.id).then(setData).catch(console.error);
  }, [user.id]);

  // Listen for time entry creation and timer state changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const offTimeEntry = window.electronAPI?.timeEntry?.onCreated?.((data) => {
      console.log('Time entry created:', data);
      setData((prev) => {
        if (!prev) return prev;
        const newData = { ...prev };
        const hoursAdded = data.timeEntry.duration_seconds / 3600;
        newData.total_used += hoursAdded;
        newData.remaining = newData.total_allowed - newData.total_used;
        return newData;
      });
      onDataChange();
    });

    const offState = window.electronAPI?.timer?.onStateChanged?.((state) => {
      setTimerState(state);
    });

    const refreshDashboard = () => {
      api.getDashboard(user.id).then(setData).catch(console.error);
      onDataChange();
    };
    const offEntries = window.electronAPI?.entries?.onChanged?.(refreshDashboard);
    const offProjects = window.electronAPI?.projects?.onChanged?.(refreshDashboard);

    return () => {
      if (typeof offTimeEntry === 'function') offTimeEntry();
      if (typeof offState === 'function') offState();
      if (typeof offEntries === 'function') offEntries();
      if (typeof offProjects === 'function') offProjects();
    };
  }, [onDataChange, user.id]);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setOpenTooltip(null);
      }
    };

    if (openTooltip) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openTooltip]);

  // Toast management
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    const newToast = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Loading state wrapper
  const withLoadingState = (buttonId, asyncAction) => {
    return async () => {
      setLoadingButtons((prev) => ({ ...prev, [buttonId]: true }));
      try {
        await asyncAction();
        showToast(buttonId === 'csv' ? 'CSV exported successfully!' : 
                  buttonId === 'pdf' ? 'PDF exported successfully!' :
                  'Settings updated!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Action failed — please try again.', 'error');
      } finally {
        setLoadingButtons((prev) => ({ ...prev, [buttonId]: false }));
      }
    };
  };

  const toggleTooltip = (name) => {
    setOpenTooltip(openTooltip === name ? null : name);
  };

  if (!data) return <div className="panel"><p>Loading...</p></div>;

  const pct = data.total_allowed > 0 ? Math.min((data.total_used / data.total_allowed) * 100, 100) : 0;
  const barColor = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  const valueClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';

  const timerStatus = timerState?.running
    ? 'Running'
    : timerState?.paused
    ? 'Paused'
    : 'Idle';
  const liveProjectName =
    timerState?.projectId
      ? data.by_project.find((p) => p.id === timerState.projectId)?.description ||
        `Project ${timerState.projectId}`
      : null;

  return (
    <div ref={tooltipRef}>
      {/* Expanded dashboard header: progress ring + live timer mirror */}
      <div className="dashboard-grid">
        <div className="panel dashboard-card progress-ring-card">
          <h2>Release Progress</h2>
          <ProgressRing used={data.total_used} allowed={data.total_allowed} />
        </div>

        <div className="panel dashboard-card live-timer-card">
          <div className="live-timer-head">
            <h2>Live Timer</h2>
            <button
              type="button"
              className="icon-link"
              onClick={() => onNavigate?.('projects')}
              aria-label="Open settings"
              title="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
          <div className="live-timer-display">{formatLiveElapsed(liveElapsed)}</div>
          <div className="live-timer-meta">
            <span className={`live-timer-status live-timer-status-${timerStatus.toLowerCase()}`}>
              {timerStatus}
            </span>
            <span className="live-timer-project">
              {liveProjectName || 'No active project'}
            </span>
          </div>
          <div className="live-timer-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate?.('log')}
            >
              + Manual Entry
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate?.('log')}
            >
              View full history
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="value">{data.total_used.toFixed(1)}</div>
          <div className="label-with-tooltip">
            Hours Used
            <button
              className="info-button"
              onClick={() => toggleTooltip('hours-used')}
              aria-label="More info about Hours Used"
              aria-expanded={openTooltip === 'hours-used'}
              aria-describedby="tooltip-hours-used"
            >
              ?
            </button>
          </div>
          {openTooltip === 'hours-used' && (
            <div id="tooltip-hours-used" role="tooltip" className="tooltip">
              Total hours you've logged across all projects for this TLU release period.
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className={`value ${valueClass}`}>{data.remaining.toFixed(1)}</div>
          <div className="label-with-tooltip">
            Hours Remaining
            <button
              className="info-button"
              onClick={() => toggleTooltip('hours-remaining')}
              aria-label="More info about Hours Remaining"
              aria-expanded={openTooltip === 'hours-remaining'}
              aria-describedby="tooltip-hours-remaining"
            >
              ?
            </button>
          </div>
          {openTooltip === 'hours-remaining' && (
            <div id="tooltip-hours-remaining" role="tooltip" className="tooltip">
              Hours left before reaching your allocation. Calculated as: Total Allowed minus Hours Used.
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="value">{data.total_allowed}</div>
          <div className="label-with-tooltip">
            {data.has_allocation_set ? `Total Allowed (${data.total_allowed}h)` : 'Total Allowed'}
            <button
              className="info-button"
              onClick={() => toggleTooltip('total-allowed')}
              aria-label="More info about Total Allowed"
              aria-expanded={openTooltip === 'total-allowed'}
              aria-describedby="tooltip-total-allowed"
            >
              ?
            </button>
          </div>
          {openTooltip === 'total-allowed' && (
            <div id="tooltip-total-allowed" role="tooltip" className="tooltip">
              Your total hour allocation for this release.
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="panel">
        <ProgressBar hoursUsed={data.total_used} totalAllowed={data.total_allowed} />
      </div>

      {/* Export buttons */}
      <div className="panel">
        <h2>Export</h2>
        <div className="export-row">
          <button 
            className="btn btn-success" 
            onClick={withLoadingState('csv', async () => {
              const link = document.createElement('a');
              link.href = api.exportCsvUrl(user.id);
              link.download = true;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            })}
            disabled={loadingButtons.csv}
          >
            {loadingButtons.csv ? (
              <span className="spinner"></span>
            ) : (
              'Export CSV'
            )}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={withLoadingState('pdf', async () => {
              const link = document.createElement('a');
              link.href = api.exportPdfUrl(user.id);
              link.download = true;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            })}
            disabled={loadingButtons.pdf}
          >
            {loadingButtons.pdf ? (
              <span className="spinner"></span>
            ) : (
              'Export PDF'
            )}
          </button>
        </div>
      </div>

      {/* Category breakdown */}
      {data.by_project.length > 0 && (
        <div className="panel">
          <h2>Hours by Project</h2>
          <div className="category-grid">
            {data.by_project.map((p) => (
              <div key={p.id} className="category-item">
                <div className="cat-name">{p.description}</div>
                <div className="cat-hours">{p.hours.toFixed(1)}h</div>
                <div className="cat-entries">{p.entries} {p.entries === 1 ? 'entry' : 'entries'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {data.recent_logs.length > 0 && (
        <div className="panel">
          <h2>Recent Activity</h2>
          <ul className="recent-list">
            {data.recent_logs.map((log) => (
              <li key={log.id}>
                <span className="recent-date">{log.date}</span>
                <span className="recent-cat">{log.project_description || 'No project'}{log.notes ? ` — ${log.notes}` : ''}</span>
                <span className="recent-hours">{log.hours}h</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
