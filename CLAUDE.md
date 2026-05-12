# CLAUDE.md — TLU Tracker

This file is read automatically by Claude Code when working in this repo. It encodes the conventions, constraints, and history of the project so any Claude conversation starts already knowing the rules.

---

## Project overview

**TLU Tracker** is an Electron + React + SQLite desktop application for faculty at the Hall School of Business & Entrepreneurship (Okanagan College, Kelowna campus) to log hours against Teaching Load Unit (TLU) releases.

- **1 TLU = 128 hours** (configurable default, derived from the OCFA collective agreement)
- **Target users:** ~55 colleagues, predominantly 55+
- **Design lens:** large fonts, minimal steps, simple navigation, permanent visibility over hover-only, large touch targets
- **Owner:** Rishi (business professor; new to coding; uses Claude as a development partner)

The core UX is a desktop widget (the "pill") that faculty click to start working on a project and click again when done. Time accumulates into per-project totals stored in SQLite.

---

## Stack

- **Electron** — desktop shell
- **React + Vite** — renderer UI
- **SQLite via `better-sqlite3`** — local database
- **Node 20** (NOT Node 24 — `node-gyp` compatibility)
- **Python 3.12+ requires `pip install setuptools`** because `distutils` was removed

---

## Development environment

- **Primary dev environment: GitHub Codespaces.** All real work happens here.
- **Repo:** `github.com/risbhard/tlu-tracker` (public)
- **Local Windows machine:** `C:\Users\300283464\OneDrive - Okanagan College\Desktop\TLU-Tracker` contains only the packaged `.exe` and a ZIP-extracted source snapshot. **It is NOT a git repo.** Never direct edits from the Windows machine.
- Windows work machine lacks admin rights and cannot run Electron locally — builds are produced via GitHub Actions and downloaded.

### Edit rules

1. **Claude Code is unreliable for surgical edits to YAML and JS files.** Use terminal-based methods instead:
   - `sed` for in-place substitutions
   - `cat > file << 'EOF'` for full-file rewrites
2. **Always verify edits independently** with `grep`, `git status`, and `node --check`. Do not trust Claude Code's reported verification output.
3. **One command at a time.** Do not batch terminal instructions.
4. **Design before code.** Visual mockups / variants before committing to implementation.
5. **Plain-language explanations** of what commands do before running them.

---

## Key codebase facts

### Constants and naming

- `HOURS_PER_TLU = 128` lives in `server/index.js:9`
- The pill window variable is **`pillWindow`**, NOT `miniTimerWindow`
- Each project independently stores `tlu_count` AND `total_hours` — neither is derived from the other
- Dashboard total = `SUM(projects.total_hours WHERE archived = 0)`, NOT a user-level formula

### Critical SQL patterns

- Per-project `hours_logged` is a correlated subquery (`server/index.js:206–209`)
- Dashboard `byProject` uses correct `GROUP BY`
- Dashboard, CSV export, and PDF export all use the `projectTotals` query with `COALESCE(SUM(total_hours), 0)` and `COALESCE(SUM(tlu_count), 0)`
- The old `user.total_hours_allocation` branch has been removed — do not reintroduce it

### IPC and bridges

- `currentUserId` is sourced from the main process via IPC (`session:user-changed`)
- `MiniTimer` and `MiniTimerPill` use `session.getCurrentUser()` + `onUserChanged` — they no longer read localStorage
- The pill close button (×) hides the pill and shows the main window — it does NOT quit
- Right-click context menu on the pill: "Show main window," "Hide pill," "Quit TLU Tracker" (with confirmation)
- Pill dropdown clipping fix: `useEffect([open])` calls IPC to resize the pill to 320px when the dropdown opens and restores to 56px on close
- Always guard with `isDestroyed()` on `mainWindow` before calling `.show()`

### Known dead code / deferred items

- `timer:getProjects` is declared in `preload.js:11` but has no handler in `main.js` (deferred to v0.2)
- `timer:reconcile` handler in `main.js:681` is a no-op returning `{success:true}`
- `timer:idle-warning` and `timer:reconcile` IPC events exist but no React component subscribes
- Category column renders in Dashboard Recent Activity but no INSERT writes it
- No `PUT` route for project edit; only create + archive
- Server/main DB race: timer writes from main bypass the API
- No tests, no migrations system — schema changes via `try/catch ALTER TABLE` in `db.js`

---

## Design system

### App UI palette (mini timer warm theme)

- Magenta `#E31B54`
- Charcoal `#3C3C3C`
- Green `#0F6E56`
- Cream `#FAF6EC`
- Fonts: Fraunces (headings), Manrope (body)

### Pill close badge (Variant B)

- Charcoal `#3C3C3C` fill
- 2px cream `#FAF6EC` border
- 20px circle
- Position: `top: -6px; right: -6px`
- The -6px overhang risks clipping in frameless windows — verify on Windows builds

### OC brand assets (presentation only, not the app UI)

- Cherry `#E10054`
- Cabernet `#782434`
- Charcoal `#50534C`
- Lake teal `#005F63`
- Fonts: Poppins Bold (headlines), Noto Serif (body)

---

## Release pipeline

- GitHub Actions builds Windows (`.exe`) and Mac (`.dmg`) on tag push
- Mac build has `continue-on-error: true`
- `create-release` job runs if Windows succeeds, regardless of Mac
- Uses `softprops/action-gh-release@v2`
- Tag pattern: delete and recreate `v0.x.x` to re-trigger
- Repo must be public — GitHub artifact quota on private repos blocks releases
- Use `npm install`, NOT `npm ci`, to avoid lock file sync errors

---

## Working with Rishi

- Claude generates complete, ready-to-paste Claude Code prompts; Rishi executes in Codespaces and reports results
- Verification always happens independently in the Codespaces terminal
- Triage order: demo-blocking → nice-to-have → defer
- Git workflow: commit and push in Codespaces; re-trigger releases by deleting and recreating version tags; always check `git status` before tagging
- All design decisions filtered through the 55+ user lens
