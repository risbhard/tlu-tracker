const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  powerMonitor,
  screen,
  nativeImage,
} = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// Get the database module path
let db;
try {
  db = require(path.join(__dirname, '..', 'server', 'db'));
} catch (error) {
  console.warn('Database module not available in Electron context:', error.message);
  db = null;
}

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Handle Windows installer events
if (require('electron-squirrel-startup')) {
  process.exit(0);
}

// Timer state lives in the main process
let timerState = {
  running: false,
  paused: false,
  projectId: null,
  userId: null,
  startTime: null,
  pausedDurationMs: 0, // accumulated paused time in ms
  elapsedMs: 0,
  lockTime: null, // when screen was locked
  suspendTime: null, // when system suspended
};

let mainWindow;
let miniTimerWindow;
let tray;
let systemIdleCheckInterval;
let idleWarningShown = false;

// ============================================================================
// WINDOW CREATION
// ============================================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../client/dist/vite/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createMiniTimerWindow() {
  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.show();
    miniTimerWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  miniTimerWindow = new BrowserWindow({
    width: 280,
    height: 180,
    x: screenWidth - 300,
    y: screenHeight - 200,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-mini-timer.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const miniTimerUrl = isDev
    ? 'http://localhost:5173/mini-timer.html'
    : `file://${path.join(__dirname, '../client/dist/vite/mini-timer.html')}`;

  miniTimerWindow.loadURL(miniTimerUrl);

  if (isDev) {
    miniTimerWindow.webContents.openDevTools({ mode: 'detach' });
  }

  miniTimerWindow.on('closed', () => {
    miniTimerWindow = null;
  });

  return miniTimerWindow;
}

// ============================================================================
// SYSTEM TRAY
// ============================================================================

function createTray() {
  // Create a simple tray icon - using a system icon as fallback
  let iconPath;
  
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, '../assets/tray-icon.ico');
  } else if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, '../assets/tray-icon-mac.png');
  } else {
    iconPath = path.join(__dirname, '../assets/tray-icon.png');
  }

  // Fallback: create icon from built-in assets if file doesn't exist
  try {
    if (!require('fs').existsSync(iconPath)) {
      // Use Electron's default app icon or create a minimal icon
      // For now, we'll skip setting an icon to avoid errors
      tray = new Tray(path.join(__dirname, '../assets/app-icon.png'));
    } else {
      tray = new Tray(iconPath);
    }
  } catch (error) {
    console.warn('Could not load tray icon:', error.message);
    // Create tray without icon (platform-specific handling)
    try {
      tray = new Tray(iconPath);
    } catch {
      // Last resort: just create the tray
      tray = new Tray(nativeImage.createEmpty());
    }
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Start / Stop Timer',
      click: () => {
        if (timerState.running) {
          ipcMain.emit('timer:stop-from-tray');
          if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
            miniTimerWindow.webContents.send('timer:state-changed', timerState);
          }
        } else {
          // Open mini timer to select project
          createMiniTimerWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Timer',
      click: () => {
        createMiniTimerWindow();
      },
    },
    {
      label: 'Open Main Window',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('TLU Tracker - Mini Timer');

  // Update tray icon based on timer state
  const updateTrayIcon = () => {
    // In a real app, you'd load different PNG files based on state
    // For now, just update the tooltip
    const label = timerState.running
      ? `TLU Tracker - Timer Running (${timerState.project})`
      : 'TLU Tracker - Timer Stopped';
    tray.setToolTip(label);
  };

  // Listen to timer state changes to update tray
  ipcMain.on('timer:state-changed-internal', updateTrayIcon);

  return tray;
}

// ============================================================================
// TIMER STATE MANAGEMENT
// ============================================================================

function getTimerState() {
  let elapsed = 0;
  if (timerState.running && timerState.startTime) {
    elapsed = Date.now() - timerState.startTime + timerState.pausedDurationMs;
  } else if (!timerState.running && timerState.pausedDurationMs > 0) {
    elapsed = timerState.pausedDurationMs;
  }
  
  return {
    running: timerState.running,
    paused: timerState.paused,
    projectId: timerState.projectId,
    userId: timerState.userId,
    startTime: timerState.startTime,
    elapsedMs: elapsed,
  };
}

function startTimer(projectId, userId) {
  if (timerState.running) return;

  timerState.running = true;
  timerState.paused = false;
  timerState.projectId = projectId;
  timerState.userId = userId;
  timerState.startTime = Date.now();
  timerState.pausedDurationMs = 0;
  timerState.lockTime = null;
  timerState.suspendTime = null;

  idleWarningShown = false;

  broadcastTimerState();
}

function stopTimer() {
  if (!timerState.running && !timerState.paused) return;

  const elapsed = timerState.running && timerState.startTime
    ? Date.now() - timerState.startTime + timerState.pausedDurationMs
    : timerState.pausedDurationMs;

  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - elapsed).toISOString();
  const durationSeconds = elapsed / 1000;

  let timeEntry = null;

  // Save to database if we have projectId, userId, and db is available
  if (timerState.projectId && timerState.userId && db) {
    try {
      const result = db.prepare(`
        INSERT INTO time_entries (project_id, user_id, start_time, end_time, duration_seconds, notes)
        VALUES (?, ?, ?, ?, ?, NULL)
      `).run(timerState.projectId, timerState.userId, startTime, endTime, durationSeconds);

      // Fetch the newly created entry
      timeEntry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid);

      // Broadcast to all windows (main dashboard + mini timer)
      broadcastToAllWindows('time-entry:created', {
        projectId: timerState.projectId,
        userId: timerState.userId,
        timeEntry,
      });
    } catch (error) {
      console.error('Error saving time entry:', error);
    }
  }

  timerState.running = false;
  timerState.paused = false;
  timerState.projectId = null;
  timerState.userId = null;
  timerState.startTime = null;
  timerState.pausedDurationMs = 0;

  broadcastTimerState();
}

function pauseTimer() {
  if (!timerState.running || !timerState.startTime) return;

  timerState.pausedDurationMs += Date.now() - timerState.startTime;
  timerState.startTime = null;
  timerState.running = false;
  timerState.paused = true;

  broadcastTimerState();
}

function resumeTimer() {
  if (timerState.running || !timerState.paused) return;

  timerState.running = true;
  timerState.paused = false;
  timerState.startTime = Date.now();

  broadcastTimerState();
}

function broadcastTimerState() {
  const state = getTimerState();

  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.webContents.send('timer:state-changed', state);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:state-changed', state);
  }
}

function broadcastToAllWindows(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }

  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.webContents.send(channel, data);
  }
}

// ============================================================================
// SYSTEM IDLE DETECTION & SCREEN LOCK DETECTION
// ============================================================================

function startIdleDetection() {
  systemIdleCheckInterval = setInterval(() => {
    if (!timerState.running) return;

    const idleTime = powerMonitor.getSystemIdleTime(); // seconds

    // If idle exceeds 20 minutes
    if (idleTime > 1200) {
      if (idleWarningShown) return;

      idleWarningShown = true;

      // Check if conferencing app is running
      const isConferencingAppRunning = checkConferencingApps();

      if (!isConferencingAppRunning) {
        // Send idle warning
        if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
          miniTimerWindow.webContents.send('timer:idle-warning', {
            idleTime,
          });
        }
      }
    } else {
      // Reset warning flag when user returns
      if (idleTime < 60) {
        idleWarningShown = false;
      }
    }
  }, 60000); // Check every 60 seconds
}

function checkConferencingApps() {
  const apps = ['zoom', 'Teams', 'Google Chrome'];
  
  try {
    if (process.platform === 'win32') {
      const result = execSync('tasklist', { encoding: 'utf8' });
      return apps.some(app => result.toLowerCase().includes(app.toLowerCase()));
    } else if (process.platform === 'darwin') {
      // macOS
      for (const app of apps) {
        try {
          execSync(`pgrep -f "${app}"`, { stdio: 'pipe' });
          return true;
        } catch {
          // app not found
        }
      }
      return false;
    } else if (process.platform === 'linux') {
      // Linux
      for (const app of apps) {
        try {
          execSync(`pgrep -f "${app}"`, { stdio: 'pipe' });
          return true;
        } catch {
          // app not found
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Error checking conferencing apps:', error);
    return false;
  }
}

function setupScreenLockDetection() {
  powerMonitor.on('suspend', () => {
    if (timerState.running) {
      timerState.suspendTime = Date.now();
      pauseTimer();
    }
  });

  powerMonitor.on('resume', () => {
    if (timerState.suspendTime) {
      const suspendDuration = Date.now() - timerState.suspendTime;
      timerState.suspendTime = null;

      // Show reconciliation dialog if paused for > 1 minute
      if (suspendDuration > 60000) {
        if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
          miniTimerWindow.webContents.send('timer:reconcile', {
            project: timerState.project,
            startTime: timerState.startTime,
            suspendTime: timerState.suspendTime,
            resumeTime: Date.now(),
            suspendDuration,
          });
        }
      }
    }
  });

  // System lock (screen lock on macOS/Linux via powerMonitor)
  powerMonitor.on('lock-screen', () => {
    if (timerState.running) {
      timerState.lockTime = Date.now();
      pauseTimer();
    }
  });

  powerMonitor.on('unlock-screen', () => {
    if (timerState.lockTime) {
      const lockDuration = Date.now() - timerState.lockTime;
      timerState.lockTime = null;

      // Show reconciliation dialog if locked for > 1 minute
      if (lockDuration > 60000) {
        if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
          miniTimerWindow.webContents.send('timer:reconcile', {
            project: timerState.project,
            workTime: timerState.pausedTime,
            lockTime: timerState.lockTime,
            unlockTime: Date.now(),
            lockDuration,
          });
        }
      }
    }
  });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.handle('timer:start', (event, { projectId, userId }) => {
  startTimer(projectId, userId);
  return getTimerState();
});

ipcMain.handle('timer:stop', (event) => {
  stopTimer();
  return getTimerState();
});

ipcMain.handle('timer:pause', (event) => {
  pauseTimer();
  return getTimerState();
});

ipcMain.handle('timer:resume', (event) => {
  resumeTimer();
  return getTimerState();
});

ipcMain.handle('timer:getState', (event) => {
  return getTimerState();
});

ipcMain.handle('projects:getActive', async (event, userId) => {
  try {
    const response = await fetch(`http://localhost:3001/api/users/${userId}/projects`);
    if (response.ok) {
      const projects = await response.json();
      return projects.filter(p => !p.archived);
    }
  } catch (error) {
    console.warn('Failed to fetch projects from API:', error);
  }
  return [];
});

ipcMain.handle('timer:reconcile', (event, { amount, unit }) => {
  // Handle reconciliation: amount + unit -> log to database
  // This would be handled by the main window or API call
  return { success: true };
});

ipcMain.handle('app:openMainWindow', (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

ipcMain.handle('app:minimizeMiniTimer', (event) => {
  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.hide();
  }
});

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.on('ready', () => {
  createMainWindow();
  createMiniTimerWindow();
  createTray();
  setupScreenLockDetection();
  startIdleDetection();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  if (systemIdleCheckInterval) {
    clearInterval(systemIdleCheckInterval);
  }
});

// Handle Windows installer events
require('electron-squirrel-startup');
