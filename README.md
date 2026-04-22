# TLU Tracker

Teaching Load Unit (TLU) hour tracker for college professors. Track hours used against TLU release allocations (70 hours per TLU release).

## Features

- **Simple login** — name + PIN authentication
- **Dashboard** — hours used vs remaining with progress bar, category breakdown
- **Hour logging** — log hours with date, category, and notes
- **Filtering** — filter logs by category and date range
- **Export** — download reports as CSV or PDF

## Setup

```bash
npm run install-all
npm run dev
```

- **React app**: http://localhost:5173
- **API server**: http://localhost:3001

## Hour Categories

Research, Grant Writing, Curriculum Development, Service, Mentoring, Professional Development, Administrative, Other

## Running the app

After first launch, TLU Tracker lives in your system tray — bottom-right
on Windows, top-right on macOS — so you never have to reopen the app folder.

- **Single-click the tray icon** to show or hide the Mini Timer.
- **Right-click the tray icon** for "Show Mini Timer", "Open Dashboard",
  and "Quit TLU Tracker".
- **Closing the window does NOT quit the app.** The Mini Timer and main
  dashboard both hide to the tray on close; only "Quit TLU Tracker" from
  the tray menu (or Cmd/Ctrl+Q) actually exits.
- **Windows taskbar pinning:** right-click the running app's taskbar
  button and choose *Pin to taskbar* for a second, always-visible
  shortcut.

### Maximize from the Mini Timer

Click the maximize icon in the Mini Timer's title bar to open (or focus)
the full dashboard — progress ring, live timer mirror, manual-entry
shortcut, recent entries, and CSV export all live there.
