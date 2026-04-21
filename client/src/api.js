const isElectronProd = window.location.protocol === 'file:';
const API_BASE = isElectronProd ? 'http://localhost:3001/api' : '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (name, pin) => {
    const body = { name };
    if (pin !== undefined && pin !== null && pin !== '') {
      body.pin = pin;
    }
    return request('/login', { method: 'POST', body: JSON.stringify(body) });
  },
  register: (name, pin, tlu_count) => {
    const body = { name, tlu_count };
    if (pin !== undefined && pin !== null && pin !== '') {
      body.pin = pin;
    }
    return request('/register', { method: 'POST', body: JSON.stringify(body) });
  },
  getUserByName: (name) => request(`/users/by-name/${encodeURIComponent(name)}`),
  setPin: (id, pin) => request(`/users/${id}/set-pin`, { method: 'PUT', body: JSON.stringify({ pin }) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: (userId) => request(`/users/${userId}/dashboard`),
  getCategories: () => request('/categories'),

  // Logs
  getLogs: (userId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return request(`/users/${userId}/logs${qs ? `?${qs}` : ''}`);
  },
  addLog: (userId, data) =>
    request(`/users/${userId}/logs`, { method: 'POST', body: JSON.stringify(data) }),
  deleteLog: (id) => request(`/logs/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: (userId) => request(`/users/${userId}/projects`),
  createProject: (userId, data) =>
    request(`/users/${userId}/projects`, { method: 'POST', body: JSON.stringify(data) }),
  archiveProject: (projectId) =>
    request(`/projects/${projectId}/archive`, { method: 'PUT' }),

  // Export URLs (not fetched as JSON)
  exportCsvUrl: (userId) => `${API_BASE}/users/${userId}/export/csv`,
  exportPdfUrl: (userId) => `${API_BASE}/users/${userId}/export/pdf`,
};
