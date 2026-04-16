# Electron Mini Timer - Quick Start Guide

## Installation & Running

### 1. First-time Setup
```bash
# Install all dependencies (runs npm install in both root and client/)
npm run install-all
```

### 2. Development Mode

#### Option A: Web Server Only (No Electron)
```bash
npm run dev
# Starts Express server (http://localhost:3001) and Vite dev server (http://localhost:5173)
# Access web app at http://localhost:5173
```

#### Option B: Electron App
```bash
npm run electron-dev
# Builds client and launches Electron app with mini timer visible
# Also starts Express server for API calls
```

### 3. Production Build
```bash
npm run electron-build
# Creates distributable packages (Windows, macOS, Linux)
# Outputs to client/dist/electron folder
```

## Using the Mini Timer

### Starting a Timer
1. **Select a project** from the dropdown
2. **Click "Start"** button (green)
3. **Elapsed time** displays in monospace font
4. **Status dot** turns magenta to indicate timer running

### Stopping a Timer
1. **Click "Stop"** button (button changes to magenta when timer running)
2. Timer stops and work session is recorded

### Expanding to Main Window
- **Click "Expand"** button to open full TLU Tracker application

### Idle Warning (20+ minutes)
- If idle > 20 minutes and no Zoom/Teams active, overlay appears
- Click "Yes, still working" to continue or "Pause timer" to pause

### Screen Lock/Suspend Recovery
- When screen is locked or system suspends:
  - Timer pauses automatically
  - On unlock/resume, reconciliation dialog appears
  - Choose to log time until lock, custom amount, or discard

## Files Overview

| File | Purpose |
|------|---------|
| `electron/main.js` | Electron main process - timer state, IPC, screen lock detection |
| `electron/preload.js` | Preload script for main window IPC bridge |
| `electron/preload-mini-timer.js` | Preload script for mini timer IPC bridge |
| `client/src/components/MiniTimer.jsx` | React component for mini timer UI |
| `client/src/mini-timer.css` | Styling for mini timer (13px+ fonts, accessible) |
| `client/mini-timer.html` | HTML entry point for mini timer window |
| `client/src/mini-timer-main.jsx` | React entry point for mini timer |
| `client/vite.config.js` | Build config for multiple entry points |
| `package.json` | Root config with Electron scripts and build settings |

## Key Features Implemented

✅ **Mini Timer Window**
- 280x200px, frameless, always-on-top
- Draggable title bar with status indicator
- Positioned at bottom-right on startup
- Not resizable

✅ **Timer Management**
- State lives in main process (persists across window focus)
- Project selector
- Start/Stop controls
- Real-time elapsed time display (HH:MM:SS)

✅ **Idle Detection**
- Polls system idle time every 60 seconds
- Triggers warning if idle > 20 minutes
- Checks for Zoom, Teams, Chrome conferencing
- Suppresses warning during active calls

✅ **Screen Lock Detection**
- Detects Windows/macOS/Linux screen lock
- Detects system suspend/resume
- On unlock/resume, shows reconciliation dialog
- Options: Log until lock, custom amount, discard

✅ **System Tray**
- Quick access without opening window
- Start/stop timer from tray menu
- Shows current timer status in tooltip

✅ **Accessibility**
- Minimum 13px font sizes throughout
- High contrast colors
- Large buttons for easy clicking
- Clear descriptions, not icons-only

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Mini timer won't open | Check console for errors; verify mini-timer.html exists |
| Timer stops when window closes | This is by design - run electron-dev to keep running |
| IPC errors in console | Verify preload scripts are loading (check app close button) |
| Can't detect conferencing app | On Mac, may need System Events permission |
| Build fails | Try `npm run install-all` and `npm run electron-build` again |
| Timer not visible at startup | May be positioned off-screen; move to center in main.js if needed |

## API Integration

The mini timer fetches projects from:
```
GET http://localhost:3001/api/categories
```

Fallback projects if API unavailable:
- Curriculum Review
- PD Day Planning
- Program Assessment
- Committee Work
- Research Project

To log reconciled time, extend the `timer:reconcile` handler in `electron/main.js` to call your API.

## Next Steps

1. **Test Idle Detection**
   - Don't move mouse for 20+ minutes (or set lower threshold in main.js for faster testing)
   - Watch for idle warning overlay

2. **Test Screen Lock**
   - Lock your screen and wait 1+ minute
   - Unlock and verify reconciliation dialog appears

3. **Configure Projects**
   - Update `/api/categories` endpoint to return your actual project list
   - Or modify fallback list in `electron/main.js`

4. **Add Work Session Logging**
   - Update `timer:reconcile` IPC handler to save to database
   - Include reconciliation notes for tracking gaps

5. **Build for Distribution**
   - Run `npm run electron-build`
   - Distribute generated .exe/.dmg/.AppImage files

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vite.dev)
- [TLU Tracker Main Repository](../README.md)
- [Full Implementation Guide](../ELECTRON_MINI_TIMER_IMPLEMENTATION.md)

## Support

For issues:
1. Check console output: `Ctrl+Shift+I` in Electron app
2. Review main.js error handlers
3. Check that both `client/dist/vite/index.html` and `client/dist/vite/mini-timer.html` exist after build
4. Verify Node.js version 16+ installed
