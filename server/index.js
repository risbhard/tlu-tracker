const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const HOURS_PER_TLU = 70;

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

app.post('/api/register', (req, res) => {
  const { name, pin, tlu_count } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN are required' });
  if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });

  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'A user with that name already exists' });

  const result = db.prepare('INSERT INTO users (name, pin, tlu_count) VALUES (?, ?, ?)').run(
    name.trim(),
    pin,
    tlu_count || 1
  );
  const user = db.prepare('SELECT id, name, tlu_count, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

app.post('/api/login', (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN are required' });

  const user = db.prepare('SELECT id, name, pin, tlu_count, total_hours_allocation, created_at FROM users WHERE name = ?').get(name.trim());
  if (!user || user.pin !== pin) return res.status(401).json({ error: 'Invalid name or PIN' });

  const { pin: _, ...safeUser } = user;
  res.json(safeUser);
});

app.put('/api/users/:id', (req, res) => {
  const { tlu_count, total_hours_allocation } = req.body;
  
  // Allow updating either tlu_count or total_hours_allocation
  if (total_hours_allocation != null) {
    if (total_hours_allocation < 1) return res.status(400).json({ error: 'total_hours_allocation must be at least 1' });
    db.prepare('UPDATE users SET total_hours_allocation = ? WHERE id = ?').run(total_hours_allocation, req.params.id);
  } else if (tlu_count != null) {
    if (tlu_count < 1) return res.status(400).json({ error: 'tlu_count must be at least 1' });
    db.prepare('UPDATE users SET tlu_count = ? WHERE id = ?').run(tlu_count, req.params.id);
  } else {
    return res.status(400).json({ error: 'Either tlu_count or total_hours_allocation is required' });
  }
  
  const user = db.prepare('SELECT id, name, tlu_count, total_hours_allocation, created_at FROM users WHERE id = ?').get(req.params.id);
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

  const byCategory = db.prepare(`
    SELECT category, SUM(hours) AS hours, COUNT(*) AS entries
    FROM hour_logs WHERE user_id = ?
    GROUP BY category ORDER BY hours DESC
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
    by_category: byCategory,
    recent_logs: recentLogs,
    has_allocation_set: user.total_hours_allocation != null,
  });
});

// --- Hour Logs ---

app.get('/api/users/:id/logs', (req, res) => {
  const { category, from, to } = req.query;
  let sql = 'SELECT * FROM hour_logs WHERE user_id = ?';
  const params = [req.params.id];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
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
  const { date, hours, category, notes } = req.body;
  if (!date || hours == null || !category) {
    return res.status(400).json({ error: 'date, hours, and category are required' });
  }
  if (hours <= 0) return res.status(400).json({ error: 'Hours must be positive' });
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Valid: ${CATEGORIES.join(', ')}` });
  }

  const result = db.prepare(
    'INSERT INTO hour_logs (user_id, date, hours, category, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, date, hours, category, notes || null);

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
  const projects = db.prepare(`
    SELECT p.*,
           COALESCE(SUM(l.hours), 0) AS hours_logged
    FROM projects p
    LEFT JOIN hour_logs l ON l.user_id = p.user_id AND l.id IN (
      SELECT MAX(id) FROM hour_logs GROUP BY user_id
    )
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.archived ASC, p.created_at DESC
  `).all(req.params.id);

  res.json(projects);
});

app.post('/api/users/:id/projects', (req, res) => {
  const { description, tlu_count, hours_per_tlu, total_hours } = req.body;

  if (!description || tlu_count == null || hours_per_tlu == null) {
    return res.status(400).json({ error: 'description, tlu_count, and hours_per_tlu are required' });
  }

  if (tlu_count <= 0 || hours_per_tlu <= 0) {
    return res.status(400).json({ error: 'TLU count and hours per TLU must be positive' });
  }

  const result = db.prepare(`
    INSERT INTO projects (user_id, description, tlu_count, hours_per_tlu, total_hours)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, description.trim(), tlu_count, hours_per_tlu, total_hours);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

app.put('/api/projects/:id/archive', (req, res) => {
  const result = db.prepare('UPDATE projects SET archived = 1 WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// --- Export CSV ---

app.get('/api/users/:id/export/csv', (req, res) => {
  const user = db.prepare('SELECT name, tlu_count, total_hours_allocation FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const logs = db.prepare('SELECT * FROM hour_logs WHERE user_id = ? ORDER BY date ASC').all(req.params.id);

  const totalUsed = logs.reduce((sum, l) => sum + l.hours, 0);
  const totalAllowed = user.total_hours_allocation || (user.tlu_count * HOURS_PER_TLU);

  let csv = `TLU Hour Report - ${user.name}\n`;
  if (user.total_hours_allocation) {
    csv += `Total Hour Allocation: ${totalAllowed}h | Used: ${totalUsed}h | Remaining: ${totalAllowed - totalUsed}h\n\n`;
  } else {
    csv += `TLU Releases: ${user.tlu_count} | Total Allowed: ${totalAllowed}h | Used: ${totalUsed}h | Remaining: ${totalAllowed - totalUsed}h\n\n`;
  }
  csv += 'Date,Hours,Category,Notes\n';
  for (const log of logs) {
    const notes = (log.notes || '').replace(/"/g, '""');
    csv += `${log.date},${log.hours},"${log.category}","${notes}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tlu-hours-${user.name.replace(/\s+/g, '_')}.csv"`);
  res.send(csv);
});

// --- Export PDF ---

app.get('/api/users/:id/export/pdf', (req, res) => {
  const user = db.prepare('SELECT name, tlu_count, total_hours_allocation FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const logs = db.prepare('SELECT * FROM hour_logs WHERE user_id = ? ORDER BY date ASC').all(req.params.id);
  const totalUsed = logs.reduce((sum, l) => sum + l.hours, 0);
  const totalAllowed = user.total_hours_allocation || (user.tlu_count * HOURS_PER_TLU);

  const byCategory = {};
  for (const log of logs) {
    byCategory[log.category] = (byCategory[log.category] || 0) + log.hours;
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

  // Category breakdown
  doc.fontSize(14).text('Hours by Category', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  for (const [cat, hours] of Object.entries(byCategory)) {
    doc.text(`${cat}: ${hours}h`);
  }
  doc.moveDown(1);

  // Log table
  doc.fontSize(14).text('Detailed Log', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);

  const colDate = 50, colHours = 150, colCat = 210, colNotes = 340;
  doc.font('Helvetica-Bold');
  doc.text('Date', colDate, doc.y, { continued: false });
  const headerY = doc.y - 12;
  doc.text('Hours', colHours, headerY);
  doc.text('Category', colCat, headerY);
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
    doc.text(log.category, colCat, rowY);
    doc.text(log.notes || '', colNotes, rowY, { width: 200 });
    doc.moveDown(0.2);
  }

  doc.end();
});

app.listen(PORT, () => {
  console.log(`TLU Tracker API running on http://localhost:${PORT}`);
});
