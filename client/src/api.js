const API_BASE = '/api';

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
  login: (name, pin) => request('/login', { method: 'POST', body: JSON.stringify({ name, pin }) }),
  register: (name, pin, tlu_count) =>
    request('/register', { method: 'POST', body: JSON.stringify({ name, pin, tlu_count }) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: (userId) => request(`/users/${userId}/dashboard`),
  getCategories: () => request('/categories'),

  // Logs
  getLogs: (userId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
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
