# TLU Tracker Electron Mini Timer - Implementation Guide

## Overview

This document describes the implementation of the Electron-based Mini Timer widget for the TLU Tracker application. The mini timer is a floating, always-on-top window that allows faculty members to quickly start/stop timing their project work without interrupting their main workflow.

## Architecture

### Main Process (electron/main.js)

The Electron main process manages:

1. **Timer State Management**
   - Timer state (running/stopped, project, startTime, elapsed) lives in main process
   - This ensures persistence across window focus changes
   - State is broadcasted to renderer processes via IPC

2. **System Idle Detection**
   - Uses `powerMonitor.getSystemIdleTime()` polled every 60 seconds
   - If idle exceeds 20 minutes AND no conferencing app is running, sends `timer:idle-warning` IPC message
   - Supports cross-platform idle detection (Windows/Mac/Linux)

3. **Screen Lock/Suspend Detection**
   - Listens to `powerMonitor.suspend`, `powerMonitor.resume`, `powerMonitor.lock-screen`, `powerMonitor.unlock-screen`
   - Records lock/suspend timestamp
   - On unlock/resume, sends `timer:reconcile` IPC message if locked/suspended > 1 minute

4. **Conferencing App Detection**
   - Checks for running processes: Zoom, Teams, Google Chrome
   - Windows: Uses `tasklist` command
   - macOS/Linux: Uses `pgrep` command
   - If conferencing app is running, suppresses idle warning

5. **System Tray Integration**
   - Displays timer status and allows quick start/stop
   - Context menu for opening timer and main window
   - Updates tray tooltip with timer state

6. **IPC Handlers**
   - `timer:start(project)` - Start timer for given project
   - `timer:stop()` - Stop timer
   - `timer:pause()` - Pause timer without stopping
   - `timer:resume()` - Resume paused timer
   - `timer:getState()` - Get current timer state
   - `timer:getProjects()` - Get list of available projects
   - `timer:reconcile(amount, unit)` - Log reconciled time
   - `app:openMainWindow()` - Open main application window
   - `app:minimizeMiniTimer()` - Minimize mini timer window

### Renderer Process - Mini Timer (client/src/components/MiniTimer.jsx)

The Mini Timer React component provides:

1. **UI Components**
   - Draggable title bar (charcoal #3C3C3C, white text)
   - Status indicator dot (magenta #E31B54 when running, grey #888 when stopped)
   - Project dropdown selector
   - Large monospace elapsed time display (20px, magenta when running)
   - Start/Stop button (green #0F6E56, changes to magenta #E31B54 when running)
   - Expand button to open main window

2. **Dialogs**
   - **Idle Warning Overlay**: Shows when user idle > 20 minutes
     - "Still working?" prompt
     - Two options: "Yes, still working" (green button) or "Pause timer" (outline button)
     - Note: "This won't appear during Zoom/Teams calls"
   
   - **Reconciliation Dialog**: Shows on screen unlock/system resume
     - Project name and work time details
     - Three radio options:
       - "Log [X]h [Y]m (until lock)" - Pre-selected, recommended
       - "Custom amount" with hour/minute inputs
       - "Discard session"
     - Confirm button to apply change

3. **Real-time Updates**
   - Elapsed time updates every second via setInterval
   - Queries main process state to maintain sync
   - Listens to IPC events for state changes

### Styling (client/src/mini-timer.css)

CSS follows accessibility guidelines:
- **Minimum font sizes**: 13px (labels), 14px (inputs), 28px (time display)
- **Colors**: Charcoal #3C3C3C, magenta #E31B54, green #0F6E56, grey #888888
- **Border radius**: 14px (container), 8px (buttons/inputs)
- **Spacing**: Generous padding and gaps for easy targeting
- **No gradients or shadows**: Clean, flat design
- **Responsive**: Handles various screen sizes with scrollable dialogs

## Project Structure

```
tlu-tracker/
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Preload script for main window
│   └── preload-mini-timer.js # Preload script for mini timer
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MiniTimer.jsx    # Mini timer React component
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HourLog.jsx
│   │   │   └── Login.jsx
│   │   ├── mini-timer-main.jsx  # Mini timer entry point
│   │   ├── mini-timer.css       # Mini timer styling
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── main.jsx
│   ├── mini-timer.html      # Mini timer HTML entry point
│   ├── index.html           # Main app HTML
│   ├── vite.config.js       # Updated for multiple entry points
│   └── package.json
├── server/
│   ├── index.js             # Express server
│   └── db.js                # SQLite database
├── assets/                  # Tray icons (optional)
├── electron-main.js         # (generated on build)
└── package.json             # Updated with Electron config
```

## Setup & Installation

### Prerequisites
- Node.js 16+ with npm
- Python 3.x (for better-sqlite3 build)
- Git

### Installation Steps

```bash
# Clone repository
git clone <repo-url>
cd tlu-tracker

# Install all dependencies
npm run install-all

# Development with web server
npm run dev

# Development with Electron
npm run electron-dev

# Production build
npm run electron-build
```

### First-time Setup

1. **Install dependencies**
   ```bash
   npm run install-all
   ```

2. **Start development server**
   ```bash
   npm run electron-dev
   ```
   This will:
   - Start Express server on http://localhost:3001
   - Start Vite dev server on http://localhost:5173
   - Launch Electron app with mini timer window

3. **Build for distribution**
   ```bash
   npm run electron-build
   ```
   Creates distributable packages for Windows, macOS, and Linux

## Development Workflow

### Adding Features to Mini Timer

1. **Update MiniTimer React component** (`client/src/components/MiniTimer.jsx`)
2. **Add styling** to `client/src/mini-timer.css` if needed
3. **Add IPC handlers** in `electron/main.js` if new features are needed

### Testing Idle Detection

1. Don't move mouse or use keyboard for 20+ minutes
2. Or modify the 1200 second check in main.js to a smaller value for testing:
   ```javascript
   if (idleTime > 120) {  // 2 minutes for testing
   ```

### Testing Screen Lock Detection

1. Lock your screen (Ctrl+Alt+Delete → Lock, or system menu)
2. Wait 1+ minute
3. Unlock screen - reconciliation dialog should appear

### Testing with Conferencing Apps

1. Open Zoom, Teams, or Chrome (with Meet tab)
2. Trigger idle for 20+ minutes
3. Idle warning should NOT appear

## Project Data Integration

### Categories/Projects

By default, the mini timer fetches projects from the API:
```
GET /api/categories
```

Fallback list if API unavailable:
- Curriculum Review
- PD Day Planning
- Program Assessment
- Committee Work
- Research Project

### Logging Work Sessions

The reconciliation dialog's "Confirm" button calls:
```javascript
await window.electronAPI.timer.reconcile({ amount, unit })
```

This currently returns `{ success: true }` in main.js. To integrate with database:

1. Create API endpoint: `POST /api/users/:id/logs`
2. Update `ipcMain.handle('timer:reconcile', ...)` to call API
3. Include session details: project, duration, date, reconciliation notes

## Important Notes

### Timer State Persistence
- **State lives in main process**: Timer keeps running even if windows are minimized/closed
- **Broadcasts to all windows**: Both mini timer and main window stay in sync
- **No local storage**: State is not persisted to disk (resets on app launch)

### Accessibility (for 55+ Faculty)
- **All font sizes**: 13px minimum (non-negotiable)
- **High contrast**: Dark text on light backgrounds
- **Clear labels**: Descriptive button text instead of icons alone
- **Large touch targets**: Buttons sized for easy clicking

### Security
- **Context isolation enabled**: Renderer cannot access Node.js APIs directly
- **Preload scripts**: Controlled IPC bridge for safe communication
- **No nodeIntegration**: Prevents arbitrary code execution
- **Sandbox enabled**: Extra isolation layer

## Troubleshooting

### Mini Timer Window Won't Open
- Check Electron main process console for errors
- Verify `mini-timer.html` and `mini-timer-main.jsx` exist
- Check Vite build output includes both entry points

### Timer Not Persisting When Window Closed
- This is by design - state lives in main process but not persisted to disk
- Consider adding localStorage or database persistence if needed

### IPC Communication Fails
- Verify preload scripts expose the correct API surface
- Check Windows have `contextIsolation: true` and `nodeIntegration: false`
- Look at renderer console for IPC errors

### Confere cing App Detection Not Working
- App detection uses platform-specific process listing
- On Windows with heavy process filtering, may need to adjust tasklist parsing
- On macOS, may need to request System Events permission

### Build Fails
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- On Windows, may need Visual Studio Build Tools for native modules
- Check electron-builder config in package.json

## Future Enhancements

1. **Persistent Timer State**: Save timer state to file/database
2. **Multiple Projects**: Allow switching projects mid-session
3. **Statistics Dashboard**: Show daily/weekly work time per project
4. **Break Reminders**: Notify after extended work sessions
5. **Offline Mode**: Cache data when server unavailable
6. **Analytics**: Track work patterns and productivity
7. **Export Reports**: Generate PDF/CSV work summaries
8. **Mobile Companion**: Mobile app for tracking from phone

## Performance Considerations

- **Idle detection polling**: 60-second intervals to minimize CPU usage
- **Timer display updates**: 1-second intervals only when timer running
- **Event listeners**: Properly cleaned up on app quit
- **Memory**: IPC messages are copied (no shared memory)

## License

TBD - See main project LICENSE file

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Electron documentation: https://www.electronjs.org/docs
3. Check React documentation: https://react.dev
4. File issues on project repository
