const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Timer IPC
  timer: {
    start: (project) => ipcRenderer.invoke('timer:start', project),
    stop: (payload) => ipcRenderer.invoke('timer:stop', payload),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    getState: () => ipcRenderer.invoke('timer:getState'),
    getProjects: () => ipcRenderer.invoke('timer:getProjects'),
    reconcile: (data) => ipcRenderer.invoke('timer:reconcile', data),
    onStateChanged: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('timer:state-changed', listener);
      return () => ipcRenderer.removeListener('timer:state-changed', listener);
    },
    onIdleWarning: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('timer:idle-warning', listener);
      return () => ipcRenderer.removeListener('timer:idle-warning', listener);
    },
    onReconcile: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('timer:reconcile', listener);
      return () => ipcRenderer.removeListener('timer:reconcile', listener);
    },
  },

  // Time entries IPC
  timeEntry: {
    onCreated: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('time-entry:created', listener);
      return () => ipcRenderer.removeListener('time-entry:created', listener);
    },
  },

  // Projects IPC
  projects: {
    notifyChanged: () => ipcRenderer.invoke('projects:notifyChanged'),
    onChanged: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('projects:changed', listener);
      return () => ipcRenderer.removeListener('projects:changed', listener);
    },
  },

  // Entries (hour logs) change events
  entries: {
    onChanged: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('entries:changed', listener);
      return () => ipcRenderer.removeListener('entries:changed', listener);
    },
  },

  // App IPC
  app: {
    openMainWindow: () => ipcRenderer.invoke('app:openMainWindow'),
    minimizeMiniTimer: () => ipcRenderer.invoke('app:minimizeMiniTimer'),
    hideMiniTimer: () => ipcRenderer.invoke('app:hideMiniTimer'),
    showMiniTimer: () => ipcRenderer.invoke('app:showMiniTimer'),
  },

  // Session IPC
  session: {
    setCurrentUser: (userId) => ipcRenderer.invoke('session:setCurrentUser', userId),
    getCurrentUser: () => ipcRenderer.invoke('session:getCurrentUser'),
    onUserChanged: (callback) => {
      const listener = (_event, userId) => callback(userId);
      ipcRenderer.on('session:user-changed', listener);
      return () => ipcRenderer.removeListener('session:user-changed', listener);
    },
  },

  // Window IPC
  window: {
    openDashboard: () => ipcRenderer.invoke('window:openDashboard'),
  },
});

// Lightweight generic bridge so components can call
// window.electron.invoke(channel, ...args) for the handful of new channels
// the spec references (session:setCurrentUser, window:openDashboard, etc.)
// without having to thread every one through the namespaced electronAPI.
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const wrapped = (_event, ...args) => listener(_event, ...args);
    ipcRenderer.on(channel, wrapped);
    return wrapped;
  },
  off: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
});
