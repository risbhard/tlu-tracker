const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Timer IPC
  timer: {
    start: (project) => ipcRenderer.invoke('timer:start', project),
    stop: () => ipcRenderer.invoke('timer:stop'),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    getState: () => ipcRenderer.invoke('timer:getState'),
    getProjects: () => ipcRenderer.invoke('timer:getProjects'),
    reconcile: (data) => ipcRenderer.invoke('timer:reconcile', data),
    onStateChanged: (callback) =>
      ipcRenderer.on('timer:state-changed', (_event, state) => callback(state)),
    onIdleWarning: (callback) =>
      ipcRenderer.on('timer:idle-warning', (_event, data) => callback(data)),
    onReconcile: (callback) =>
      ipcRenderer.on('timer:reconcile', (_event, data) => callback(data)),
  },

  // Time entries IPC
  timeEntry: {
    onCreated: (callback) =>
      ipcRenderer.on('time-entry:created', (_event, data) => callback(data)),
  },

  // App IPC
  app: {
    openMainWindow: () => ipcRenderer.invoke('app:openMainWindow'),
    minimizeMiniTimer: () => ipcRenderer.invoke('app:minimizeMiniTimer'),
  },
});
