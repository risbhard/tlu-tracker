import { useState, useEffect } from 'react';
import { api } from '../api';

export default function HourLog({ user, onDataChange }) {
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMap, setProjectMap] = useState({});
  const [error, setError] = useState('');

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');

  // Filters
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    api.getProjects(user.id).then((prjs) => {
      const active = prjs.filter(p => !p.archived);
      setProjects(active);
      const map = {};
      active.forEach(p => map[p.id] = p);
      setProjectMap(map);
      if (active.length > 0) setProjectId(active[0].id);
    });
    loadLogs();
  }, [user.id]);

  const loadLogs = async () => {
    const filters = {};
    if (filterProjectId) filters.project_id = filterProjectId;
    if (filterFrom) filters.from = filterFrom;
    if (filterTo) filters.to = filterTo;
    const data = await api.getLogs(user.id, filters);
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, [filterProjectId, filterFrom, filterTo, user.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;
    const offEntries = window.electronAPI?.entries?.onChanged?.(() => {
      loadLogs();
      onDataChange && onDataChange();
    });
    const offProjects = window.electronAPI?.projects?.onChanged?.(() => {
      api.getProjects(user.id).then((prjs) => {
        const active = prjs.filter((p) => !p.archived);
        setProjects(active);
        const map = {};
        active.forEach((p) => (map[p.id] = p));
        setProjectMap(map);
      });
    });
    return () => {
      if (typeof offEntries === 'function') offEntries();
      if (typeof offProjects === 'function') offProjects();
    };
  }, [user.id, onDataChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!projectId) return setError('Select a project');
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) return setError('Enter valid hours');
    try {
      await api.addLog(user.id, { date, hours: h, project_id: projectId, notes: notes.trim() || undefined });
      setHours('');
      setNotes('');
      await loadLogs();
      onDataChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteLog(id);
      await loadLogs();
      onDataChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalFiltered = logs.reduce((sum, l) => sum + l.hours, 0);

  return (
    <div>
      {/* Log entry form */}
      <div className="panel">
        <h2>Log Hours</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Hours</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                placeholder="e.g. 2.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Project</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.description}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Log Hours</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Filters */}
      <div className="panel">
        <h2>Hour History</h2>
        <div className="filter-bar">
          <div className="form-group">
            <label>Project</label>
            <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.description}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>From</label>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To</label>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="empty-state">No hour logs yet. Start logging above.</p>
        ) : (
          <>
            <table className="log-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Project</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.date}</td>
                    <td><strong>{log.hours}</strong></td>
                    <td>{projectMap[log.project_id]?.description || 'Unknown'}</td>
                    <td className="notes-cell" title={log.notes || ''}>{log.notes || '—'}</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => handleDelete(log.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', marginTop: '12px', fontWeight: 600, color: '#0f3460' }}>
              Showing {logs.length} entries &middot; {totalFiltered.toFixed(1)} hours
            </div>
          </>
        )}
      </div>
    </div>
  );
}
