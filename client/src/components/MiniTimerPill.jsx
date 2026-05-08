import { useState, useEffect, useRef, useCallback } from 'react';
import '../mini-timer-pill.css';

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

const Icon = {
  Play: ({ size = 11 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Pause: ({ size = 11 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
  Stop: ({ size = 9 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  ),
  Expand: ({ size = 10 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7" />
    </svg>
  ),
  Chev: ({ size = 8 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

function ProjectChip({ value, options, onChange, locked }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Pill BrowserWindow is sized just-tall-enough for the capsule, so the
  // dropdown menu would render below the window edge and get clipped.
  // Ask main to grow the window while the menu is open and shrink it back
  // on close.
  useEffect(() => {
    if (open) {
      window.electronAPI?.app?.expandForDropdown?.();
    } else {
      window.electronAPI?.app?.collapseAfterDropdown?.();
    }
  }, [open]);

  const label = value ? value.description : 'Pick project';

  return (
    <div className="mt-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="mt-chip"
        onClick={() => !locked && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch project"
        disabled={locked}
        title={locked ? 'Stop the timer to switch projects' : 'Switch project'}
      >
        <span className="mt-chip-text">{label}</span>
        <Icon.Chev />
      </button>
      {open && (
        <div className="mt-chip-menu" role="listbox">
          {options.length === 0 && (
            <div className="mt-chip-menu-empty">No projects</div>
          )}
          {options.map((p) => {
            const active = value && p.id === value.id;
            return (
              <div
                key={p.id}
                role="option"
                aria-selected={active}
                className={`mt-chip-menu-item${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
              >
                {p.description}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MiniTimerPill() {
  const [timerState, setTimerState] = useState({
    running: false,
    paused: false,
    projectId: null,
    elapsedMs: 0,
  });
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [hover, setHover] = useState(false);
  const [displayElapsed, setDisplayElapsed] = useState(0);

  const status = timerState.running ? 'running' : timerState.paused ? 'paused' : 'idle';
  const showChrome = hover || status === 'idle';
  const locked = status !== 'idle';

  const activeProjectId = locked
    ? timerState.projectId
    : selectedProjectId ?? (projects[0]?.id ?? null);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const loadProjects = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const list = await window.electronAPI?.projects?.getActive?.(uid);
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('[pill] failed to load projects:', err);
      setProjects([]);
    }
  }, []);

  // Bootstrap user + initial timer state. Source of truth for the active
  // user is the Electron main process — query it on mount and listen for
  // login/logout pushes. localStorage isn't reliable across BrowserWindows
  // under file:// and may be empty if the pill mounts before login.
  useEffect(() => {
    let cancelled = false;

    window.electronAPI?.session?.getCurrentUser?.().then((uid) => {
      if (!cancelled) setUserId(uid ?? null);
    });

    const offUser = window.electronAPI?.session?.onUserChanged?.((uid) => {
      setUserId(uid ?? null);
    });

    window.electronAPI?.timer?.getState?.().then((state) => {
      if (state) {
        setTimerState(state);
        setDisplayElapsed(state.elapsedMs || 0);
      }
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

  // Project list
  useEffect(() => {
    if (userId) loadProjects(userId);
  }, [userId, loadProjects]);

  useEffect(() => {
    const off = window.electronAPI?.projects?.onChanged?.((payload) => {
      if (Array.isArray(payload)) {
        setProjects(payload);
        setSelectedProjectId(null);
      } else if (userId) {
        loadProjects(userId);
      }
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [userId, loadProjects]);

  // Tick while running
  useEffect(() => {
    if (!timerState.running) return undefined;
    const id = setInterval(() => setDisplayElapsed((v) => v + 1000), 1000);
    return () => clearInterval(id);
  }, [timerState.running]);

  const handleStart = async () => {
    if (!activeProjectId || !userId) return;
    try {
      const state = await window.electronAPI?.timer?.start(activeProjectId, userId);
      if (state) {
        setTimerState(state);
        setDisplayElapsed(state.elapsedMs || 0);
      }
    } catch (err) {
      console.error('[pill] start failed:', err);
    }
  };

  const handlePause = async () => {
    try {
      const state = await window.electronAPI?.timer?.pause();
      if (state) setTimerState(state);
    } catch (err) {
      console.error('[pill] pause failed:', err);
    }
  };

  const handleResume = async () => {
    try {
      const state = await window.electronAPI?.timer?.resume();
      if (state) setTimerState(state);
    } catch (err) {
      console.error('[pill] resume failed:', err);
    }
  };

  // Keyboard: Space toggles play/pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      if (status === 'running') handlePause();
      else if (status === 'paused') handleResume();
      else handleStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeProjectId, userId]);

  // Stop on the pill expands to the full window so the user can capture
  // notes via the existing WorkDetailsModal. The full window receives a
  // `timer:request-stop` event on arrival and opens the modal.
  const handleStop = async () => {
    try {
      await window.electronAPI?.app?.requestStopFromPill?.();
    } catch (err) {
      console.error('[pill] stop request failed:', err);
    }
  };

  const handleExpand = async () => {
    try {
      await window.electronAPI?.app?.exitPillMode?.();
    } catch (err) {
      console.error('[pill] expand failed:', err);
    }
  };

  const primaryAction =
    status === 'running' ? handlePause : status === 'paused' ? handleResume : handleStart;
  const primaryAriaLabel =
    status === 'running' ? 'Pause' : status === 'paused' ? 'Resume timer' : 'Start timer';
  const primaryDisabled = status === 'idle' && !activeProjectId;

  return (
    <div
      className="mt-pill"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ WebkitAppRegion: 'drag' }}
    >
      <span className="mt-status-dot" data-status={status} aria-hidden="true" />

      <div style={{ WebkitAppRegion: 'no-drag' }}>
        <ProjectChip
          value={activeProject}
          options={projects}
          onChange={(p) => setSelectedProjectId(p.id)}
          locked={locked}
        />
      </div>

      <span className="mt-time" aria-live="polite">
        {formatElapsed(displayElapsed)}
      </span>

      <div
        className="mt-controls"
        data-visible={showChrome ? 'true' : 'false'}
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          type="button"
          className="mt-btn mt-btn--primary"
          onClick={primaryAction}
          aria-label={primaryAriaLabel}
          title={primaryAriaLabel}
          disabled={primaryDisabled}
        >
          {status === 'running' ? <Icon.Pause /> : <Icon.Play />}
        </button>
        <button
          type="button"
          className="mt-btn"
          onClick={handleStop}
          aria-label="Stop"
          title="Stop and save"
          disabled={status === 'idle'}
        >
          <Icon.Stop />
        </button>
      </div>

      {/* Expand button sits outside .mt-controls so it stays visible at all
          times — without it, the only way back to the full timer is the
          system tray icon. */}
      <button
        type="button"
        className="mt-btn mt-btn--expand"
        onClick={handleExpand}
        aria-label="Open full timer"
        title="Open full timer"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <Icon.Expand />
      </button>
    </div>
  );
}
