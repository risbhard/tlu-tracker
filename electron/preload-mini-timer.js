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
    enterPillMode: () => ipcRenderer.invoke('app:enterPillMode'),
    exitPillMode: () => ipcRenderer.invoke('app:exitPillMode'),
    requestStopFromPill: () => ipcRenderer.invoke('app:requestStopFromPill'),
    expandForDropdown: () => ipcRenderer.invoke('app:expandForDropdown'),
    collapseAfterDropdown: () => ipcRenderer.invoke('app:collapseAfterDropdown'),
    onRequestStop: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('timer:request-stop', listener);
      return () => ipcRenderer.removeListener('timer:request-stop', listener);
    },
  },

  // Window IPC
  window: {
    openDashboard: () => ipcRenderer.invoke('window:openDashboard'),
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
});

// Generic bridge for the mini timer window so its React code can call
// window.electron.invoke / on / off for the new session + projects events.
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
