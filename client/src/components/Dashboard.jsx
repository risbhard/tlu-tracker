import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import ProgressBar from './ProgressBar';

export default function Dashboard({ user, setUser, onDataChange }) {
  const [data, setData] = useState(null);
  const [selectedHours, setSelectedHours] = useState(user.total_hours_allocation || null);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [openTooltip, setOpenTooltip] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loadingButtons, setLoadingButtons] = useState({});
  const [timerState, setTimerState] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    api.getDashboard(user.id).then(setData).catch(console.error);
  }, [user.id]);

  // Listen for time entry creation and timer state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for time entry created events
      window.electronAPI?.timeEntry?.onCreated((data) => {
        console.log('Time entry created:', data);
        // Refresh dashboard data to show updated hours
        setData((prev) => {
          if (!prev) return prev;
          // Recalculate totals based on new entry
          const newData = { ...prev };
          const hoursAdded = data.timeEntry.duration_seconds / 3600;
          newData.total_used += hoursAdded;
          newData.remaining = newData.total_allowed - newData.total_used;
          
          // Update category breakdown if available
          if (newData.by_category) {
            // In a real app, you'd want to properly track which category this belongs to
            // For now, just update the totals
          }
          return newData;
        });
        // Trigger parent refresh to update projects list
        onDataChange();
      });

      // Listen for timer state changes
      window.electronAPI?.timer?.onStateChanged((state) => {
        setTimerState(state);
      });
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, [onDataChange]);

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

  const handleAllocationSelect = async (hours) => {
    try {
      const updated = await api.updateUser(user.id, { total_hours_allocation: hours });
      setUser(updated);
      setSelectedHours(hours);
      setShowCustomInput(false);
      setCustomInput('');
      const refreshed = await api.getDashboard(user.id);
      setData(refreshed);
      onDataChange();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomUpdate = async () => {
    const customValue = parseInt(customInput, 10);
    if (!customValue || customValue < 1) {
      alert('Please enter a valid number of hours (at least 1)');
      return;
    }
    await withLoadingState('settings', () => handleAllocationSelect(customValue))();
  };

  const toggleTooltip = (name) => {
    setOpenTooltip(openTooltip === name ? null : name);
  };

  const getProjectName = (projectId) => {
    // Placeholder - in a real app, you'd fetch project details
    // For now, we'll extract from data by searching through categories/projects
    return `Project ${projectId}`;
  };

  if (!data) return <div className="panel"><p>Loading...</p></div>;

  const pct = data.total_allowed > 0 ? Math.min((data.total_used / data.total_allowed) * 100, 100) : 0;
  const barColor = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  const valueClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';

  return (
    <div ref={tooltipRef}>
      {/* Timer Running Indicator */}
      {timerState?.running && (
        <div className="panel timer-indicator" style={{ background: '#fff8f9', borderLeft: '4px solid #E31B54', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '12px', height: '12px', background: '#E31B54', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              ⏱️ Timer running on {getProjectName(timerState.projectId)}
            </span>
          </div>
        </div>
      )}

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
              Your total hour allocation for this release. You can change this in Settings below (100h, 70h, or custom).
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="panel">
        <ProgressBar hoursUsed={data.total_used} totalAllowed={data.total_allowed} />
      </div>

      {/* Hour Allocation Selector */}
      <div className="panel">
        <h2>Settings & Export</h2>
        <div className="allocation-section">
          <h3>Total Hours Allocation</h3>
          <div className="allocation-options">
            <button
              className={`allocation-btn ${selectedHours === 100 ? 'active' : ''}`}
              onClick={() => handleAllocationSelect(100)}
            >
              <div className="btn-label">Department Standard</div>
              <div className="btn-hours">100h</div>
            </button>
            <button
              className={`allocation-btn ${selectedHours === 70 ? 'active' : ''}`}
              onClick={() => handleAllocationSelect(70)}
            >
              <div className="btn-label">Business Unit</div>
              <div className="btn-hours">70h</div>
            </button>
            <button
              className={`allocation-btn ${showCustomInput || (selectedHours && selectedHours !== 100 && selectedHours !== 70) ? 'active' : ''}`}
              onClick={() => setShowCustomInput(!showCustomInput)}
            >
              <div className="btn-label">Other</div>
              <div className="btn-hours">Custom</div>
            </button>
          </div>

          {showCustomInput && (
            <div className="custom-input-section">
              <label htmlFor="custom-hours">Enter your total hours:</label>
              <div className="custom-input-group">
                <input
                  id="custom-hours"
                  type="number"
                  min="1"
                  max="500"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 80"
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleCustomUpdate}
                  disabled={loadingButtons.settings}
                >
                  {loadingButtons.settings ? (
                    <span className="spinner"></span>
                  ) : (
                    'Update'
                  )}
                </button>
              </div>
            </div>
          )}

          {selectedHours && selectedHours !== 100 && selectedHours !== 70 && !showCustomInput && (
            <div className="custom-display">
              Current custom allocation: <strong>{selectedHours}h</strong>
              <button
                className="btn-link"
                onClick={() => setShowCustomInput(true)}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Export buttons */}
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
      {data.by_category.length > 0 && (
        <div className="panel">
          <h2>Hours by Category</h2>
          <div className="category-grid">
            {data.by_category.map((c) => (
              <div key={c.category} className="category-item">
                <div className="cat-name">{c.category}</div>
                <div className="cat-hours">{c.hours.toFixed(1)}h</div>
                <div className="cat-entries">{c.entries} {c.entries === 1 ? 'entry' : 'entries'}</div>
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
                <span className="recent-cat">{log.category}{log.notes ? ` — ${log.notes}` : ''}</span>
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
