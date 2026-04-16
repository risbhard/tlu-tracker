import { useState, useEffect } from 'react';
import { api } from '../api';

export default function HourLog({ user, onDataChange }) {
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  // Filters
  const [filterCat, setFilterCat] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    api.getCategories().then((cats) => {
      setCategories(cats);
      setCategory(cats[0] || '');
    });
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const filters = {};
    if (filterCat) filters.category = filterCat;
    if (filterFrom) filters.from = filterFrom;
    if (filterTo) filters.to = filterTo;
    const data = await api.getLogs(user.id, filters);
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, [filterCat, filterFrom, filterTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) return setError('Enter valid hours');
    try {
      await api.addLog(user.id, { date, hours: h, category, notes: notes.trim() || undefined });
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
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
            <label>Category</label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
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
                  <th>Category</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.date}</td>
                    <td><strong>{log.hours}</strong></td>
                    <td>{log.category}</td>
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
