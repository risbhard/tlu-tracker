const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  powerMonitor,
  screen,
  nativeImage,
  webContents,
} = require('electron');
const path = require('path');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

const SERVER_PORT = 3001;

// Database module is loaded lazily after userData path is configured, so main
// and the spawned server process both open the same writable DB file.
let db = null;
let dbPath = null;
let serverProcess = null;
let backendLogStream = null;

function logBackend(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    if (backendLogStream) backendLogStream.write(line);
  } catch (e) {
    // ignore
  }
  console.log(message);
}

function initDbPath() {
  const userData = app.getPath('userData');
  try {
    fs.mkdirSync(userData, { recursive: true });
  } catch (e) {
    // ignore
  }
  dbPath = path.join(userData, 'tlu-tracker.db');
  process.env.TLU_DB_PATH = dbPath;

  const logPath = path.join(userData, 'backend.log');
  try {
    backendLogStream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch (e) {
    backendLogStream = null;
  }

  logBackend('==========================================');
  logBackend(`App start. isDev=${isDev}`);
  logBackend(`userData=${userData}`);
  logBackend(`dbPath=${dbPath}`);
  logBackend(`execPath=${process.execPath}`);
  logBackend(`resourcesPath=${process.resourcesPath}`);
}

function loadDbModule() {
  try {
    db = require(path.join(__dirname, '..', 'server', 'db'));
    logBackend('[main] better-sqlite3 loaded successfully in main process');
  } catch (error) {
    logBackend(`[main] Failed to load db module: ${error.stack || error.message}`);
    db = null;
  }
}

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  logBackend(`[server] spawning: ${process.execPath} ${serverPath}`);

  // In a packaged Electron app, process.execPath points to the Electron
  // binary. Setting ELECTRON_RUN_AS_NODE=1 makes it behave as plain Node so
  // server/index.js can run as an Express backend child process.
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(SERVER_PORT),
      TLU_DB_PATH: dbPath,
      NODE_ENV: isDev ? 'development' : 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trimEnd();
    console.log(`[server] ${msg}`);
    if (backendLogStream) backendLogStream.write(`[stdout] ${msg}\n`);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trimEnd();
    console.error(`[server] ${msg}`);
    if (backendLogStream) backendLogStream.write(`[stderr] ${msg}\n`);
  });

  serverProcess.on('error', (err) => {
    logBackend(`[server] failed to spawn: ${err.stack || err.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    logBackend(`[server] exited code=${code} signal=${signal}`);
    serverProcess = null;
  });
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

function getAppIconPath() {
  // In a packaged build, process.resourcesPath is <install>/resources.
  // Assets are bundled inside the asar archive under assets/; Electron can
  // read them for the window/taskbar icon via the asar FS integration. For
  // the Tray, Windows handles .ico from inside asar correctly as well.
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(__dirname, '..', 'assets', 'icon.ico'));
  }
  candidates.push(path.join(__dirname, '..', 'assets', 'icon.png'));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getTrayIconPath() {
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(__dirname, '..', 'assets', 'icon.ico'));
  }
  candidates.push(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
  candidates.push(path.join(__dirname, '..', 'assets', 'icon.png'));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createMainWindow() {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../client/dist/index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Closing the main dashboard is one of the two documented ways to fully
    // quit the app (the other is the tray "Quit" item). Without this, the
    // tray + hidden widget would keep the process alive.
    app.isQuitting = true;
    app.quit();
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

  const iconPath = getAppIconPath();
  miniTimerWindow = new BrowserWindow({
    width: 280,
    height: 260,
    x: screenWidth - 300,
    y: screenHeight - 200,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    transparent: false,
    icon: iconPath || undefined,
    title: 'TLU Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload-mini-timer.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  if (isDev) {
    miniTimerWindow.loadURL('http://localhost:5173/mini-timer.html');
  } else {
    miniTimerWindow.loadFile(path.join(__dirname, '../client/dist/mini-timer.html'));
  }

  if (isDev) {
    miniTimerWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Hide instead of closing so the user can reopen it
  miniTimerWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      miniTimerWindow.hide();
    }
  });

  miniTimerWindow.on('closed', () => {
    miniTimerWindow = null;
  });

  return miniTimerWindow;
}

// ============================================================================
// SYSTEM TRAY
// ============================================================================

function showWidget() {
  if (!miniTimerWindow || miniTimerWindow.isDestroyed()) {
    createMiniTimerWindow();
    return;
  }
  if (miniTimerWindow.isMinimized()) miniTimerWindow.restore();
  miniTimerWindow.show();
  miniTimerWindow.focus();
}

function hideWidget() {
  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.hide();
  }
}

function toggleWidget() {
  if (!miniTimerWindow || miniTimerWindow.isDestroyed()) {
    createMiniTimerWindow();
    return;
  }
  const hiddenOrMinimized = !miniTimerWindow.isVisible() || miniTimerWindow.isMinimized();
  if (hiddenOrMinimized) {
    showWidget();
  } else {
    hideWidget();
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = getTrayIconPath();
  let trayImage;
  try {
    if (iconPath) {
      trayImage = nativeImage.createFromPath(iconPath);
      // On Windows, tray icons look best at 16x16. Resize if needed.
      if (process.platform === 'win32' && !trayImage.isEmpty()) {
        const size = trayImage.getSize();
        if (size.width > 32 || size.height > 32) {
          trayImage = trayImage.resize({ width: 16, height: 16 });
        }
      }
    }
  } catch (err) {
    logBackend(`[tray] failed to load icon: ${err.message}`);
    trayImage = null;
  }

  try {
    tray = new Tray(trayImage && !trayImage.isEmpty() ? trayImage : nativeImage.createEmpty());
  } catch (err) {
    logBackend(`[tray] failed to construct Tray: ${err.message}`);
    return null;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Widget', click: () => showWidget() },
    { label: 'Show Dashboard', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('TLU Tracker');

  // Left-click (Windows/Linux) toggles widget visibility. On macOS a single
  // click normally opens the menu; we also wire 'click' for consistency.
  tray.on('click', () => toggleWidget());
  tray.on('double-click', () => showWidget());

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

function stopTimer(notes = '') {
  if (!timerState.running && !timerState.paused) return;

  const elapsed = timerState.running && timerState.startTime
    ? Date.now() - timerState.startTime + timerState.pausedDurationMs
    : timerState.pausedDurationMs;

  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - elapsed).toISOString();
  const durationSeconds = elapsed / 1000;
  const hours = durationSeconds / 3600;
  const date = new Date().toISOString().slice(0, 10);

  const savedProjectId = timerState.projectId;
  const savedUserId = timerState.userId;

  let timeEntry = null;
  let hourLog = null;

  if (savedProjectId && savedUserId && db) {
    try {
      const result = db.prepare(`
        INSERT INTO time_entries (project_id, user_id, start_time, end_time, duration_seconds, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(savedProjectId, savedUserId, startTime, endTime, durationSeconds, notes || null);

      timeEntry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid);

      broadcastToAllWindows('time-entry:created', {
        projectId: savedProjectId,
        userId: savedUserId,
        timeEntry,
      });
    } catch (error) {
      console.error('Error saving time entry:', error);
    }

    try {
      const logResult = db.prepare(`
        INSERT INTO hour_logs (user_id, date, hours, project_id, notes, method)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(savedUserId, date, hours, savedProjectId, notes || null, 'timer');

      hourLog = db.prepare('SELECT * FROM hour_logs WHERE id = ?').get(logResult.lastInsertRowid);

      broadcastAll('entries:changed', { userId: savedUserId, hourLog });
    } catch (error) {
      console.error('Error saving hour log:', error);
    }
  }

  timerState.running = false;
  timerState.paused = false;
  timerState.projectId = null;
  timerState.userId = null;
  timerState.startTime = null;
  timerState.pausedDurationMs = 0;
  timerState.lockTime = null;
  timerState.suspendTime = null;

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

function broadcastAll(channel, data) {
  webContents.getAllWebContents().forEach((wc) => {
    if (!wc.isDestroyed()) wc.send(channel, data);
  });
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

ipcMain.handle('timer:stop', (event, payload) => {
  const notes = (payload && typeof payload.notes === 'string') ? payload.notes : '';
  stopTimer(notes);
  return getTimerState();
});

ipcMain.handle('projects:notifyChanged', () => {
  broadcastAll('projects:changed');
  return { success: true };
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
  // Minimize to the Windows taskbar (keeps an entry that can be clicked to
  // restore the widget). Use hideMiniTimer to send it to the tray instead.
  if (miniTimerWindow && !miniTimerWindow.isDestroyed()) {
    miniTimerWindow.minimize();
  }
});

ipcMain.handle('app:hideMiniTimer', (event) => {
  hideWidget();
});

ipcMain.handle('app:showMiniTimer', (event) => {
  showWidget();
});

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.on('ready', () => {
  initDbPath();
  loadDbModule();
  startServer();
  createMainWindow();
  createMiniTimerWindow();
  createTray();
  setupScreenLockDetection();
  startIdleDetection();
});

app.on('window-all-closed', () => {
  // Do nothing: the tray icon keeps the app alive when windows are hidden
  // or minimized. Quit only happens via the tray "Quit" menu item or by
  // closing the main dashboard window (see mainWindow 'closed' handler).
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (systemIdleCheckInterval) {
    clearInterval(systemIdleCheckInterval);
  }
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
});


