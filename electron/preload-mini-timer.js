const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Timer IPC
  timer: {
    start: (projectId, userId) => ipcRenderer.invoke('timer:start', { projectId, userId }),
    stop: () => ipcRenderer.invoke('timer:stop'),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    getState: () => ipcRenderer.invoke('timer:getState'),
    onStateChanged: (callback) =>
      ipcRenderer.on('timer:state-changed', (_event, state) => callback(state)),
  },

  // Time entries IPC
  timeEntry: {
    onCreated: (callback) =>
      ipcRenderer.on('time-entry:created', (_event, data) => callback(data)),
  },

  // Projects IPC
  projects: {
    getActive: (userId) => ipcRenderer.invoke('projects:getActive', userId),
  },

  // App IPC
  app: {
    openMainWindow: () => ipcRenderer.invoke('app:openMainWindow'),
    minimizeMiniTimer: () => ipcRenderer.invoke('app:minimizeMiniTimer'),
  },
});
