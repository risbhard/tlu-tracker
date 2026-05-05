const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const HOURS_PER_TLU = 128;

const CATEGORIES = [
  'Research',
  'Grant Writing',
  'Curriculum Development',
  'Service',
  'Mentoring',
  'Professional Development',
  'Administrative',
  'Other',
];

app.use(cors());
app.use(express.json());

app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// --- Auth ---

app.get('/api/users/by-name/:name', (req, res) => {
  const user = db.prepare('SELECT id, name, CASE WHEN pin IS NOT NULL THEN 1 ELSE 0 END AS has_pin FROM users WHERE name = ?').get(req.params.name.trim());
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/register', (req, res) => {
  const { name, pin, tlu_count } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (pin && pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });

  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'A user with that name already exists' });

  const result = db.prepare('INSERT INTO users (name, pin, tlu_count) VALUES (?, ?, ?)').run(
    name.trim(),
    pin || null,
    tlu_count || 1
  );
  const user = db.prepare('SELECT id, name, tlu_count, pin_prompt_shown, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

app.post('/api/login', (req, res) => {
  const { name, pin } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const user = db.prepare('SELECT id, name, pin, tlu_count, total_hours_allocation, pin_prompt_shown, created_at FROM users WHERE name = ?').get(name.trim());
  if (!user) return res.status(401).json({ error: 'User not found' });

  if (user.pin) {
    if (!pin) return res.status(400).json({ error: 'PIN is required for this account' });
    if (user.pin !== pin) return res.status(401).json({ error: 'Invalid PIN' });
  } else {
    if (pin) return res.status(400).json({ error: 'This account does not have a PIN set' });
  }

  const { pin: _, ...safeUser } = user;
  res.json(safeUser);
});

app.put('/api/users/:id/set-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });

  db.prepare('UPDATE users SET pin = ?, pin_prompt_shown = 1 WHERE id = ?').run(pin, req.params.id);
  res.json({ success: true });
});

app.put('/api/users/:id', (req, res) => {
  const { tlu_count, total_hours_allocation, pin_prompt_shown } = req.body;
  
  // Allow updating tlu_count, total_hours_allocation, or pin_prompt_shown
  if (total_hours_allocation != null) {
    if (total_hours_allocation < 1) return res.status(400).json({ error: 'total_hours_allocation must be at least 1' });
    db.prepare('UPDATE users SET total_hours_allocation = ? WHERE id = ?').run(total_hours_allocation, req.params.id);
  } else if (tlu_count != null) {
    if (tlu_count < 1) return res.status(400).json({ error: 'tlu_count must be at least 1' });
    db.prepare('UPDATE users SET tlu_count = ? WHERE id = ?').run(tlu_count, req.params.id);
  } else if (pin_prompt_shown != null) {
    db.prepare('UPDATE users SET pin_prompt_shown = ? WHERE id = ?').run(pin_prompt_shown ? 1 : 0, req.params.id);
  } else {
    return res.status(400).json({ error: 'Either tlu_count, total_hours_allocation, or pin_prompt_shown is required' });
  }
  
  const user = db.prepare('SELECT id, name, tlu_count, total_hours_allocation, pin_prompt_shown, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// --- Dashboard ---

app.get('/api/users/:id/dashboard', (req, res) => {
  const user = db.prepare('SELECT id, name, tlu_count, total_hours_allocation FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Use total_hours_allocation if set, otherwise fall back to tlu_count * HOURS_PER_TLU
  const totalAllowed = user.total_hours_allocation || (user.tlu_count * HOURS_PER_TLU);

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(hours), 0) AS total_hours,
      COUNT(*) AS total_entries
    FROM hour_logs WHERE user_id = ?
  `).get(req.params.id);

  const byProject = db.prepare(`
    SELECT p.id, p.description, COALESCE(SUM(hl.hours), 0) AS hours, COUNT(hl.id) AS entries
    FROM projects p
    LEFT JOIN hour_logs hl ON p.id = hl.project_id
    WHERE p.user_id = ? AND p.archived = 0
    GROUP BY p.id, p.description
    ORDER BY hours DESC
  `).all(req.params.id);

  const recentLogs = db.prepare(`
    SELECT * FROM hour_logs WHERE user_id = ?
    ORDER BY date DESC, created_at DESC LIMIT 5
  `).all(req.params.id);

  res.json({
    user,
    hours_per_tlu: HOURS_PER_TLU,
    total_allowed: totalAllowed,
    total_used: stats.total_hours,
    remaining: totalAllowed - stats.total_hours,
    total_entries: stats.total_entries,
    by_project: byProject,
    recent_logs: recentLogs,
    has_allocation_set: user.total_hours_allocation != null,
  });
});

// --- Hour Logs ---

app.get('/api/users/:id/logs', (req, res) => {
  const { project_id, from, to } = req.query;
  let sql = 'SELECT * FROM hour_logs WHERE user_id = ?';
  const params = [req.params.id];

  if (project_id) {
    sql += ' AND project_id = ?';
    params.push(project_id);
  }
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/users/:id/logs', (req, res) => {
  const { date, hours, project_id, notes } = req.body;
  if (!date || hours == null || !project_id) {
    return res.status(400).json({ error: 'date, hours, and project_id are required' });
  }
  if (hours <= 0) return res.status(400).json({ error: 'Hours must be positive' });

  // Verify project exists and belongs to user
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(project_id, req.params.id);
  if (!project) {
    return res.status(400).json({ error: 'Invalid project' });
  }

  const result = db.prepare(
    'INSERT INTO hour_logs (user_id, date, hours, project_id, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, date, hours, project_id, notes || null);

  const log = db.prepare('SELECT * FROM hour_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(log);
});

app.delete('/api/logs/:id', (req, res) => {
  const result = db.prepare('DELETE FROM hour_logs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Log not found' });
  res.json({ success: true });
});

// --- Projects ---

app.get('/api/users/:id/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT
        p.*,
        COALESCE((
          SELECT SUM(hl.hours)
          FROM hour_logs hl
          WHERE hl.project_id = p.id
        ), 0) AS hours_logged
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.archived ASC, p.created_at DESC
    `).all(req.params.id);

    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/users/:id/projects', (req, res) => {
  try {
    const { description, tlu_count, hours_per_tlu, total_hours } = req.body;

    if (!description || tlu_count == null || hours_per_tlu == null) {
      return res.status(400).json({ error: 'description, tlu_count, and hours_per_tlu are required' });
    }

    const tluNum = parseFloat(tlu_count);
    const hptNum = parseFloat(hours_per_tlu);
    const totalNum = parseFloat(total_hours);

    if (isNaN(tluNum) || tluNum <= 0 || isNaN(hptNum) || hptNum <= 0) {
      return res.status(400).json({ error: 'TLU count and hours per TLU must be positive numbers' });
    }

    if (isNaN(totalNum) || totalNum <= 0) {
      return res.status(400).json({ error: 'Total hours must be a positive number' });
    }

    const result = db.prepare(`
      INSERT INTO projects (user_id, description, tlu_count, hours_per_tlu, total_hours)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, description.trim(), tluNum, hptNum, totalNum);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project: ' + err.message });
  }
});

app.put('/api/projects/:id/archive', (req, res) => {
  try {
    const result = db.prepare('UPDATE projects SET archived = 1 WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (err) {
    console.error('Error archiving project:', err);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// --- Export CSV ---

app.get('/api/users/:id/export/csv', (req, res) => {
  const user = db.prepare('SELECT name, tlu_count, total_hours_allocation FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const logs = db.prepare(`
    SELECT hl.*, p.description as project_name FROM hour_logs hl
    LEFT JOIN projects p ON hl.project_id = p.id
    WHERE hl.user_id = ? ORDER BY hl.date ASC
  `).all(req.params.id);

  const totalUsed = logs.reduce((sum, l) => sum + l.hours, 0);
  const totalAllowed = user.total_hours_allocation || (user.tlu_count * HOURS_PER_TLU);

  let csv = `TLU Hour Report - ${user.name}\n`;
  if (user.total_hours_allocation) {
    csv += `Total Hour Allocation: ${totalAllowed}h | Used: ${totalUsed}h | Remaining: ${totalAllowed - totalUsed}h\n\n`;
  } else {
    csv += `TLU Releases: ${user.tlu_count} | Total Allowed: ${totalAllowed}h | Used: ${totalUsed}h | Remaining: ${totalAllowed - totalUsed}h\n\n`;
  }
  csv += 'Date,Hours,Project,Notes\n';
  for (const log of logs) {
    const notes = (log.notes || '').replace(/"/g, '""');
    csv += `${log.date},${log.hours},"${log.project_name || 'Unknown'}","${notes}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tlu-hours-${user.name.replace(/\s+/g, '_')}.csv"`);
  res.send(csv);
});

// --- Export PDF ---

app.get('/api/users/:id/export/pdf', (req, res) => {
  const user = db.prepare('SELECT name, tlu_count, total_hours_allocation FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const logs = db.prepare(`
    SELECT hl.*, p.description as project_name FROM hour_logs hl
    LEFT JOIN projects p ON hl.project_id = p.id
    WHERE hl.user_id = ? ORDER BY hl.date ASC
  `).all(req.params.id);

  const totalUsed = logs.reduce((sum, l) => sum + l.hours, 0);
  const totalAllowed = user.total_hours_allocation || (user.tlu_count * HOURS_PER_TLU);

  const byProject = {};
  for (const log of logs) {
    const projectName = log.project_name || 'Unknown';
    byProject[projectName] = (byProject[projectName] || 0) + log.hours;
  }

  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="tlu-hours-${user.name.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  // Title
  doc.fontSize(20).text('TLU Hour Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(user.name, { align: 'center' });
  doc.moveDown(1);

  // Summary
  doc.fontSize(12);
  if (user.total_hours_allocation) {
    doc.text(`Total Hour Allocation: ${totalAllowed} hours`);
  } else {
    doc.text(`TLU Releases: ${user.tlu_count}`);
    doc.text(`Total Allowed: ${totalAllowed} hours`);
  }
  doc.text(`Hours Used: ${totalUsed} hours`);
  doc.text(`Remaining: ${totalAllowed - totalUsed} hours`);
  doc.moveDown(1);

  // Project breakdown
  doc.fontSize(14).text('Hours by Project', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  for (const [project, hours] of Object.entries(byProject)) {
    doc.text(`${project}: ${hours}h`);
  }
  doc.moveDown(1);

  // Log table
  doc.fontSize(14).text('Detailed Log', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);

  const colDate = 50, colHours = 150, colProject = 210, colNotes = 310;
  doc.font('Helvetica-Bold');
  doc.text('Date', colDate, doc.y, { continued: false });
  const headerY = doc.y - 12;
  doc.text('Hours', colHours, headerY);
  doc.text('Project', colProject, headerY);
  doc.text('Notes', colNotes, headerY);
  doc.font('Helvetica');
  doc.moveDown(0.3);

  for (const log of logs) {
    const y = doc.y;
    if (y > 700) {
      doc.addPage();
    }
    const rowY = doc.y;
    doc.text(log.date, colDate, rowY);
    doc.text(String(log.hours), colHours, rowY);
    doc.text(log.project_name || 'Unknown', colProject, rowY);
    doc.text(log.notes || '', colNotes, rowY, { width: 200 });
    doc.moveDown(0.2);
  }

  doc.end();
});

app.listen(PORT, () => {
  console.log(`TLU Tracker API running on http://localhost:${PORT}`);
});
