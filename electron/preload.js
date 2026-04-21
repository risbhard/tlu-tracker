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
});
