const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Timer IPC
  timer: {
    start: (projectId, userId) => ipcRenderer.invoke('timer:start', { projectId, userId }),
    stop: (payload) => ipcRenderer.invoke('timer:stop', payload),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    getState: () => ipcRenderer.invoke('timer:getState'),
    onStateChanged: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('timer:state-changed', listener);
      return () => ipcRenderer.removeListener('timer:state-changed', listener);
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
    getActive: (userId) => ipcRenderer.invoke('projects:getActive', userId),
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
  },
});
