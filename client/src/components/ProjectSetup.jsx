import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ProjectSetup({ user, onDataChange }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerState, setTimerState] = useState(null);

  // Form state
  const [description, setDescription] = useState('');
  const [tluCount, setTluCount] = useState('');
  const [hoursPerTlu, setHoursPerTlu] = useState('128');

  const totalHours = tluCount && hoursPerTlu
    ? (parseFloat(tluCount) * parseFloat(hoursPerTlu)).toFixed(1)
    : '0';

  useEffect(() => {
    loadProjects();
  }, []);

  // Listen for time entry creation and timer state changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const offTimeEntry = window.electronAPI?.timeEntry?.onCreated?.((data) => {
      console.log('Time entry created for project:', data.projectId);
      setProjects((prev) =>
        prev.map((project) => {
          if (project.id === data.projectId) {
            const hoursAdded = data.timeEntry.duration_seconds / 3600;
            return {
              ...project,
              hours_logged: (project.hours_logged || 0) + hoursAdded,
            };
          }
          return project;
        })
      );
      onDataChange();
    });

    const offState = window.electronAPI?.timer?.onStateChanged?.((state) => {
      setTimerState(state);
    });

    const offEntries = window.electronAPI?.entries?.onChanged?.(() => {
      loadProjects();
      onDataChange();
    });

    const offProjects = window.electronAPI?.projects?.onChanged?.(() => {
      loadProjects();
    });

    return () => {
      if (typeof offTimeEntry === 'function') offTimeEntry();
      if (typeof offState === 'function') offState();
      if (typeof offEntries === 'function') offEntries();
      if (typeof offProjects === 'function') offProjects();
    };
  }, [onDataChange]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects(user.id);
      setProjects(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!description.trim()) {
      setError('Project description is required');
      setLoading(false);
      return;
    }

    const tlu = parseFloat(tluCount);
    const hpt = parseFloat(hoursPerTlu);

    if (isNaN(tlu) || tlu <= 0) {
      setError('TLU count must be a positive number');
      setLoading(false);
      return;
    }

    if (isNaN(hpt) || hpt <= 0) {
      setError('Hours per TLU must be a positive number');
      setLoading(false);
      return;
    }

    try {
      await api.createProject(user.id, {
        description: description.trim(),
        tlu_count: tlu,
        hours_per_tlu: hpt,
        total_hours: tlu * hpt,
      });

      setDescription('');
      setTluCount('');
      setHoursPerTlu('128');
      await loadProjects();
      onDataChange();
      window.electronAPI?.projects?.notifyChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (projectId) => {
    try {
      await api.archiveProject(projectId);
      await loadProjects();
      onDataChange();
      window.electronAPI?.projects?.notifyChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  return (
    <div>
      {/* Create Project Form */}
      <div className="panel">
        <h2>Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Course/Project Description</label>
            <input
              type="text"
              placeholder="e.g., BUAD 123 - Course Redesign"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>TLU Release Count</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="e.g., 0.5, 1, 1.5, 2"
                value={tluCount}
                onChange={(e) => setTluCount(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Hours per TLU</label>
              <input
                type="number"
                step="1"
                min="1"
                value={hoursPerTlu}
                onChange={(e) => setHoursPerTlu(e.target.value)}
              />
            </div>
          </div>

          <div className="project-total-display">
            <span className="project-total-label">Total Hours:</span>
            <span className="project-total-value">{totalHours}h</span>
          </div>

          <button
            type="submit"
            className="btn btn-charcoal"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Project'}
          </button>

          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Active Projects List */}
      {activeProjects.length > 0 && (
        <div className="panel">
          <h2>Projects</h2>
          <div className="projects-list">
            {activeProjects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <h3>{project.description}</h3>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => handleArchive(project.id)}
                  >
                    Archive
                  </button>
                </div>

                <div className="project-stats">
                  <div className="project-stat">
                    <span className="stat-label">Total Hours:</span>
                    <span className="stat-value">{project.total_hours}h</span>
                  </div>
                  <div className="project-stat">
                    <span className="stat-label">TLU Count:</span>
                    <span className="stat-value">{project.tlu_count}</span>
                  </div>
                  <div className="project-stat">
                    <span className="stat-label">Hours Logged:</span>
                    <span className="stat-value">
                      {project.hours_logged ? project.hours_logged.toFixed(1) : '0'}h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeProjects.length === 0 && (
        <div className="panel">
          <p className="empty-state">No projects yet. Create one above to get started.</p>
        </div>
      )}

      {/* Archived Projects */}
      {archivedProjects.length > 0 && (
        <div className="panel">
          <h2>Archived Projects ({archivedProjects.length})</h2>
          <div className="projects-list-archived">
            {archivedProjects.map((project) => (
              <div key={project.id} className="project-card-archived">
                <div className="project-header">
                  <h3>{project.description}</h3>
                </div>
                <div className="project-stats">
                  <span className="stat-label">Total Hours: {project.total_hours}h</span>
                  <span className="stat-label">Hours Logged: {project.hours_logged ? project.hours_logged.toFixed(1) : '0'}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
