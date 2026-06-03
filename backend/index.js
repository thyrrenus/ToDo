const express = require('express');
const cors = require('cors');
const db = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-todo-9988';

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Sesión no iniciada. Token ausente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión expirada o token no válido.' });
    }
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check if this is the first user registered to assign admin role
    const userCountRes = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const userCount = userCountRes ? userCountRes.count : 0;
    const role = userCount === 0 ? 'admin' : 'user';

    // Insert user
    const info = await db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(username, email, passwordHash, role);
    const userId = info.lastInsertRowid;

    if (userCount === 0) {
      // Migrate existing orphaned tasks, lists, and sections to this first user
      await db.prepare('UPDATE lists SET user_id = ? WHERE user_id IS NULL').run(userId);
      await db.prepare('UPDATE sections SET user_id = ? WHERE user_id IS NULL').run(userId);
      await db.prepare('UPDATE tasks SET user_id = ? WHERE user_id IS NULL').run(userId);
    } else {
      // Create a default Inbox list for this new user
      await db.prepare("INSERT INTO lists (name, color, user_id) VALUES ('Inbox', '#3b82f6', ?)").run(userId);
    }

    const newUser = await db.prepare('SELECT id, username, email, role, outlook_ical_url FROM users WHERE id = ?').get(userId);
    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    const userData = { id: user.id, username: user.username, email: user.email, role: user.role, outlook_ical_url: user.outlook_ical_url };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Authenticated User Details (Check Session)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// 4. Update User Profile Settings (such as iCal link)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  const { outlook_ical_url } = req.body;
  try {
    await db.prepare('UPDATE users SET outlook_ical_url = ? WHERE id = ?').run(outlook_ical_url, req.user.id);
    const updatedUser = await db.prepare('SELECT id, username, email, role, outlook_ical_url FROM users WHERE id = ?').get(req.user.id);
    const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, user: updatedUser, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

// Serve static files for uploaded images
app.use('/uploads', express.static(uploadsDir));

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }
  const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// Helper to compute next date occurrence for recurring tasks
function getNextOccurrenceDates(dueDateStr, startTimeStr, endTimeStr, recurrenceType) {
  let baseDate;
  if (dueDateStr) {
    baseDate = new Date(dueDateStr + 'T12:00:00'); // mid-day prevents timezone shifts
  } else if (startTimeStr) {
    baseDate = new Date(startTimeStr);
  } else {
    baseDate = new Date();
  }

  if (isNaN(baseDate.getTime())) return null;

  const nextDate = new Date(baseDate.getTime());

  if (recurrenceType === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (recurrenceType === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (recurrenceType === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (recurrenceType === 'weekdays') {
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
  } else {
    return null;
  }

  const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const d2 = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

  const formatIsoNoZ = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const formatDateOnly = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  let nextDueDate = dueDateStr ? formatDateOnly(nextDate) : null;
  let nextStartTime = null;
  let nextEndTime = null;

  if (startTimeStr) {
    const st = new Date(startTimeStr);
    st.setDate(st.getDate() + diffDays);
    nextStartTime = formatIsoNoZ(st);
  }
  if (endTimeStr) {
    const et = new Date(endTimeStr);
    et.setDate(et.getDate() + diffDays);
    nextEndTime = formatIsoNoZ(et);
  }

  return {
    due_date: nextDueDate,
    start_time: nextStartTime,
    end_time: nextEndTime
  };
}

app.get('/api/debug-version', (req, res) => {
  res.json({ version: 'f933c36' });
});

const port = process.env.PORT || 3001;

// --- LISTS ---
app.get('/api/lists', authenticateToken, async (req, res) => {
  try {
    const lists = await db.prepare('SELECT * FROM lists WHERE user_id = ?').all(req.user.id);
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', authenticateToken, async (req, res) => {
  const { name, color, group_id, icon } = req.body;
  try {
    const info = await db.prepare('INSERT INTO lists (name, color, user_id, group_id, icon) VALUES (?, ?, ?, ?, ?)').run(name, color, req.user.id, group_id || null, icon || null);
    const newList = await db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(newList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id', authenticateToken, async (req, res) => {
  const { name, color, group_id, icon } = req.body;
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'List not found' });

    await db.prepare('UPDATE lists SET name = ?, color = ?, group_id = ?, icon = ? WHERE id = ? AND user_id = ?').run(
      name !== undefined ? name : current.name,
      color !== undefined ? color : current.color,
      group_id !== undefined ? group_id : current.group_id,
      icon !== undefined ? icon : current.icon,
      id,
      req.user.id
    );
    const updatedList = await db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json(updatedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Optional: Delete all tasks in the list first
    await db.prepare('DELETE FROM tasks WHERE list_id = ? AND user_id = ?').run(id, req.user.id);
    await db.prepare('DELETE FROM lists WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LIST GROUPS: CRUD ENDPOINTS ---

// 1. Get all list groups
app.get('/api/list-groups', authenticateToken, async (req, res) => {
  try {
    const groups = await db.prepare('SELECT * FROM list_groups WHERE user_id = ? ORDER BY order_index ASC, created_at ASC').all(req.user.id);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create list group
app.post('/api/list-groups', authenticateToken, async (req, res) => {
  const { name, color, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de grupo requerido' });

  try {
    const info = await db.prepare('INSERT INTO list_groups (name, color, icon, user_id) VALUES (?, ?, ?, ?)').run(name.trim(), color || '#7c3aed', icon || 'Folder', req.user.id);
    const group = await db.prepare('SELECT * FROM list_groups WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update list group
app.put('/api/list-groups/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, color, order_index, icon } = req.body;
  try {
    const current = await db.prepare('SELECT * FROM list_groups WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.prepare('UPDATE list_groups SET name = ?, color = ?, order_index = ?, icon = ? WHERE id = ? AND user_id = ?').run(
      name !== undefined ? name.trim() : current.name,
      color !== undefined ? color : current.color,
      order_index !== undefined ? order_index : current.order_index,
      icon !== undefined ? icon : current.icon,
      id,
      req.user.id
    );
    const updated = await db.prepare('SELECT * FROM list_groups WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete list group
app.delete('/api/list-groups/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM list_groups WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.prepare('UPDATE lists SET group_id = NULL WHERE group_id = ?').run(id);
    await db.prepare('DELETE FROM list_groups WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SECTIONS ---
app.get('/api/sections', authenticateToken, async (req, res) => {
  try {
    const sections = await db.prepare('SELECT * FROM sections WHERE user_id = ? ORDER BY order_index ASC').all(req.user.id);
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sections', authenticateToken, async (req, res) => {
  const { list_id, name, order_index } = req.body;
  try {
    const info = await db.prepare('INSERT INTO sections (list_id, name, order_index, user_id) VALUES (?, ?, ?, ?)').run(list_id, name, order_index || 0, req.user.id);
    const newSection = await db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(newSection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sections/:id', authenticateToken, async (req, res) => {
  const { name, is_collapsed, order_index } = req.body;
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Section not found' });

    await db.prepare('UPDATE sections SET name = ?, is_collapsed = ?, order_index = ? WHERE id = ? AND user_id = ?').run(
      name !== undefined ? name : current.name,
      is_collapsed !== undefined ? is_collapsed : current.is_collapsed,
      order_index !== undefined ? order_index : current.order_index,
      id,
      req.user.id
    );
    const updatedSection = await db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json(updatedSection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sections/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.prepare('DELETE FROM sections WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASKS ---

const associateTaskTags = async (taskId, userId, tagsArray) => {
  if (!tagsArray) return;
  // 1. Clear old tags for this task
  await db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);

  // 2. Loop and link
  const colors = ['#f87171', '#f97316', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
  for (const tagName of tagsArray) {
    if (!tagName || !tagName.trim()) continue;
    const cleanName = tagName.trim().toLowerCase();

    // Ensure tag exists in tags table
    let tag = await db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?').get(cleanName, userId);
    if (!tag) {
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const insertRes = await db.prepare('INSERT INTO tags (name, color, user_id) VALUES (?, ?, ?)').run(cleanName, randomColor, userId);
      tag = { id: insertRes.lastInsertRowid };
    }

    // Link task to tag
    await db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(taskId, tag.id);
  }
};

app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    if (tasks.length === 0) {
      return res.json([]);
    }
    const taskIds = tasks.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const subtasks = await db.prepare(`SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY created_at ASC`).all(...taskIds);
    
    // Fetch tags for these tasks
    const taskTags = await db.prepare(`
      SELECT tt.task_id, t.id as tag_id, t.name, t.color
      FROM task_tags tt
      JOIN tags t ON tt.tag_id = t.id
      WHERE t.user_id = ?
    `).all(req.user.id);

    // Group subtasks and tags by task_id
    const tasksWithSubtasks = tasks.map(task => {
      task.subtasks = subtasks.filter(st => st.task_id === task.id);
      task.tags = taskTags.filter(tt => tt.task_id === task.id).map(tt => ({ id: tt.tag_id, name: tt.name, color: tt.color }));
      return task;
    });
    
    res.json(tasksWithSubtasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { list_id, section_id, title, description, due_date, start_time, end_time, priority, team_id, assigned_to, tags, recurrence_type } = req.body;
  try {
    const info = await db.prepare(`
      INSERT INTO tasks (list_id, section_id, title, description, due_date, start_time, end_time, priority, user_id, team_id, assigned_to, recurrence_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      list_id || null, 
      section_id || null, 
      title, 
      description || null, 
      due_date || null, 
      start_time || null, 
      end_time || null, 
      priority || 0, 
      req.user.id, 
      team_id || null, 
      assigned_to || null,
      recurrence_type || 'none'
    );
    const taskId = info.lastInsertRowid;
    
    // Link tags
    if (tags && Array.isArray(tags)) {
      await associateTaskTags(taskId, req.user.id, tags);
    }

    const newTask = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    const tTags = await db.prepare(`
      SELECT t.id as tag_id, t.name, t.color
      FROM task_tags tt
      JOIN tags t ON tt.tag_id = t.id
      WHERE tt.task_id = ?
    `).all(taskId);
    newTask.tags = tTags.map(tt => ({ id: tt.tag_id, name: tt.name, color: tt.color }));
    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { title, description, due_date, start_time, end_time, priority, is_completed, list_id, section_id, team_id, assigned_to, tags, recurrence_type } = req.body;
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check authorization: creator, direct assignee, or member of assigned team
    let isAuthorized = current.user_id === req.user.id || current.assigned_to === req.user.id;
    if (!isAuthorized && current.team_id) {
      const isTeamMember = await db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
        .get(current.team_id, req.user.id);
      if (isTeamMember) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta tarea.' });
    }

    // Clone recurring task for next occurrence if marked completed
    const isMarkedCompleted = (is_completed !== undefined && !!is_completed) && !current.is_completed;
    if (isMarkedCompleted) {
      const recType = recurrence_type !== undefined ? recurrence_type : current.recurrence_type;
      if (recType && recType !== 'none') {
        const nextDates = getNextOccurrenceDates(
          due_date !== undefined ? due_date : current.due_date,
          start_time !== undefined ? start_time : current.start_time,
          end_time !== undefined ? end_time : current.end_time,
          recType
        );
        if (nextDates) {
          const nextInfo = await db.prepare(`
            INSERT INTO tasks (list_id, section_id, title, description, due_date, start_time, end_time, priority, user_id, team_id, assigned_to, recurrence_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            list_id !== undefined ? list_id : current.list_id,
            section_id !== undefined ? section_id : current.section_id,
            title !== undefined ? title : current.title,
            description !== undefined ? description : current.description,
            nextDates.due_date,
            nextDates.start_time,
            nextDates.end_time,
            priority !== undefined ? priority : current.priority,
            current.user_id,
            team_id !== undefined ? team_id : current.team_id,
            assigned_to !== undefined ? assigned_to : current.assigned_to,
            recType
          );

          const nextTaskId = nextInfo.lastInsertRowid;

          // Clone subtasks as pending
          const subtasks = await db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(id);
          for (const st of subtasks) {
            let stNextDueDate = null;
            let stNextStartTime = null;
            let stNextEndTime = null;

            if (st.due_date || st.start_time) {
              const stDates = getNextOccurrenceDates(st.due_date, st.start_time, st.end_time, recType);
              if (stDates) {
                stNextDueDate = stDates.due_date;
                stNextStartTime = stDates.start_time;
                stNextEndTime = stDates.end_time;
              }
            }

            await db.prepare(`
              INSERT INTO subtasks (task_id, title, description, is_completed, due_date, start_time, end_time) 
              VALUES (?, ?, ?, 0, ?, ?, ?)
            `).run(nextTaskId, st.title, st.description, stNextDueDate, stNextStartTime, stNextEndTime);
          }

          // Clone tags
          const tagsList = await db.prepare('SELECT tag_id FROM task_tags WHERE task_id = ?').all(id);
          for (const t of tagsList) {
            await db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(nextTaskId, t.tag_id);
          }
        }
      }
    }

    await db.prepare(`
      UPDATE tasks 
      SET list_id = ?, section_id = ?, title = ?, description = ?, due_date = ?, start_time = ?, end_time = ?, priority = ?, is_completed = ?, team_id = ?, assigned_to = ?, recurrence_type = ? 
      WHERE id = ?
    `).run(
      list_id !== undefined ? list_id : current.list_id,
      section_id !== undefined ? section_id : current.section_id,
      title !== undefined ? title : current.title,
      description !== undefined ? description : current.description,
      due_date !== undefined ? due_date : current.due_date,
      start_time !== undefined ? start_time : current.start_time,
      end_time !== undefined ? end_time : current.end_time,
      priority !== undefined ? priority : current.priority,
      is_completed !== undefined ? is_completed : current.is_completed,
      team_id !== undefined ? team_id : current.team_id,
      assigned_to !== undefined ? assigned_to : current.assigned_to,
      recurrence_type !== undefined ? recurrence_type : current.recurrence_type,
      id
    );

    // Update tags
    if (tags && Array.isArray(tags)) {
      await associateTaskTags(id, req.user.id, tags);
    }

    const updatedTask = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const tTags = await db.prepare(`
      SELECT t.id as tag_id, t.name, t.color
      FROM task_tags tt
      JOIN tags t ON tt.tag_id = t.id
      WHERE tt.task_id = ?
    `).all(id);
    updatedTask.tags = tTags.map(tt => ({ id: tt.tag_id, name: tt.name, color: tt.color }));
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (current.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el creador de la tarea puede eliminarla' });
    }
    await db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SUBTASKS ---
app.post('/api/subtasks', authenticateToken, async (req, res) => {
  const { task_id, title, description, due_date, start_time, end_time } = req.body;
  try {
    const parentTask = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado para esta tarea' });
    }

    const info = await db.prepare('INSERT INTO subtasks (task_id, title, description, due_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)').run(
      task_id, title, description || null, due_date || null, start_time || null, end_time || null
    );
    const newSubtask = await db.prepare('SELECT * FROM subtasks WHERE id = ?').get(info.lastInsertRowid);
    res.json(newSubtask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subtasks/:id', authenticateToken, async (req, res) => {
  const { title, description, is_completed, due_date, start_time, end_time } = req.body;
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Subtask not found' });

    const parentTask = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(current.task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await db.prepare('UPDATE subtasks SET title = ?, description = ?, is_completed = ?, due_date = ?, start_time = ?, end_time = ? WHERE id = ?').run(
      title !== undefined ? title : current.title,
      description !== undefined ? description : current.description,
      is_completed !== undefined ? is_completed : current.is_completed,
      due_date !== undefined ? due_date : current.due_date,
      start_time !== undefined ? start_time : current.start_time,
      end_time !== undefined ? end_time : current.end_time,
      id
    );
    const updatedSubtask = await db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    res.json(updatedSubtask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subtasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Subtask not found' });

    const parentTask = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(current.task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EXTERNAL CALENDAR PROXY & PARSER ---
function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Demasiadas redirecciones'));
    }

    if (!targetUrl) {
      return reject(new Error('URL vacía'));
    }

    // Clean URL and auto-rewrite webcal/webcals protocols to https
    let urlToUse = targetUrl.trim();
    if (urlToUse.toLowerCase().startsWith('webcal://')) {
      urlToUse = 'https://' + urlToUse.substring(9);
    } else if (urlToUse.toLowerCase().startsWith('webcals://')) {
      urlToUse = 'https://' + urlToUse.substring(10);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(urlToUse);
    } catch (e) {
      return reject(new Error('URL inválida'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    client.get(urlToUse, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, urlToUse).toString();
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Error al cargar la página, código de estado: ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const WINDOWS_TO_IANA = {
  'pacific standard time': 'America/Los_Angeles',
  'mountain standard time': 'America/Denver',
  'central standard time': 'America/Chicago',
  'eastern standard time': 'America/New_York',
  'sa pacific standard time': 'America/Lima',
  'sa western standard time': 'America/La_Paz',
  'pacific sa standard time': 'America/Santiago',
  'chile/continental': 'America/Santiago',
  'chile/easterisland': 'Pacific/Easter',
  'santiago': 'America/Santiago',
  'montevideo standard time': 'America/Montevideo',
  'gmt standard time': 'Europe/London',
  'w. europe standard time': 'Europe/Berlin',
  'romance standard time': 'Europe/Paris',
  'central europe standard time': 'Europe/Belgrade',
  'gtb standard time': 'Europe/Athens',
  'russian standard time': 'Europe/Moscow',
  'turkey standard time': 'Europe/Istanbul',
  'arab standard time': 'Asia/Riyadh',
  'arabian standard time': 'Asia/Dubai',
  'china standard time': 'Asia/Shanghai',
  'tokyo standard time': 'Asia/Tokyo',
  'aus eastern standard time': 'Australia/Sydney'
};

function parseICSDate(dateStr, tzid) {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  
  if (cleanStr.length === 8) {
    const year = cleanStr.substring(0, 4);
    const month = cleanStr.substring(4, 6);
    const day = cleanStr.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00`;
  }
  
  if (cleanStr.includes('T')) {
    const parts = cleanStr.split('T');
    const datePart = parts[0];
    const timePart = parts[1];

    if (datePart.length === 8) {
      const year = parseInt(datePart.substring(0, 4), 10);
      const month = parseInt(datePart.substring(4, 6), 10);
      const day = parseInt(datePart.substring(6, 8), 10);

      const hours = parseInt(timePart.substring(0, 2), 10);
      const minutes = parseInt(timePart.substring(2, 4), 10);
      const seconds = parseInt(timePart.substring(4, 6) || '00', 10);

      const isUtc = timePart.endsWith('Z');
      
      if (isUtc) {
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}Z`;
      } else if (tzid) {
        const cleanTzid = tzid.toLowerCase().trim();
        const ianaTz = WINDOWS_TO_IANA[cleanTzid] || tzid;
        
        try {
          const utcBase = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: ianaTz,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
          });
          
          const formattedParts = formatter.formatToParts(utcBase);
          const partVal = (type) => formattedParts.find(p => p.type === type).value;
          
          const tzDate = new Date(Date.UTC(
            parseInt(partVal('year'), 10),
            parseInt(partVal('month'), 10) - 1,
            parseInt(partVal('day'), 10),
            parseInt(partVal('hour'), 10) === 24 ? 0 : parseInt(partVal('hour'), 10),
            parseInt(partVal('minute'), 10),
            parseInt(partVal('second'), 10)
          ));
          
          const offsetMinutes = Math.round((tzDate.getTime() - utcBase.getTime()) / (60 * 1000));
          const absoluteDate = new Date(utcBase.getTime() - offsetMinutes * 60 * 1000);
          
          return absoluteDate.toISOString();
        } catch (e) {
          console.error(`[PROX-CAL] Error parsing timezone ${tzid} (${ianaTz}):`, e.message);
          return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      } else {
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
  }
  return null;
}


function unescapeICSValue(val) {
  if (!val) return '';
  return val
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\\\/g, '\\');
}

function parseICS(icsContent) {
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let currentEvent = null;
  let inEvent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const upperLine = trimmedLine.toUpperCase();
    if (upperLine.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
      inEvent = true;
      continue;
    }

    if (upperLine.startsWith('END:VEVENT')) {
      if (currentEvent && currentEvent.dtstart) {
        events.push(currentEvent);
      }
      currentEvent = null;
      inEvent = false;
      continue;
    }

    if (inEvent && currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const keyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      const semicolonIndex = keyPart.indexOf(';');
      const key = (semicolonIndex === -1 ? keyPart : keyPart.substring(0, semicolonIndex)).toUpperCase().trim();

      if (key === 'SUMMARY') {
        currentEvent.summary = unescapeICSValue(value);
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = unescapeICSValue(value);
      } else if (key === 'LOCATION') {
        currentEvent.location = unescapeICSValue(value);
      } else if (key === 'DTSTART') {
        currentEvent.dtstart = value;
        const tzidMatch = keyPart.match(/TZID=([^;]+)/i);
        if (tzidMatch) {
          currentEvent.dtstart_tzid = tzidMatch[1].replace(/['"]/g, '').trim();
        }
      } else if (key === 'DTEND') {
        currentEvent.dtend = value;
        const tzidMatch = keyPart.match(/TZID=([^;]+)/i);
        if (tzidMatch) {
          currentEvent.dtend_tzid = tzidMatch[1].replace(/['"]/g, '').trim();
        }
      } else if (key === 'UID') {
        currentEvent.uid = value;
      }
    }
  }

  return events.map(e => {
    const start_time = parseICSDate(e.dtstart, e.dtstart_tzid);
    let end_time = parseICSDate(e.dtend, e.dtend_tzid);

    if (start_time && !end_time) {
      const startDate = new Date(start_time);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const pad = (num) => String(num).padStart(2, '0');
      end_time = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:${pad(endDate.getSeconds())}`;
    }

    return {
      uid: e.uid || Math.random().toString(36).substring(2, 11),
      title: e.summary || '(Reunión sin título)',
      description: e.description || '',
      location: e.location || '',
      start_time,
      end_time
    };
  }).filter(e => e.start_time !== null);
}

app.get('/api/external-events', async (req, res) => {
  const { url } = req.query;
  console.log('[PROX-CAL] Recibida solicitud para URL:', url);
  if (!url) {
    console.warn('[PROX-CAL] URL vacía o no provista');
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  try {
    console.log('[PROX-CAL] Descargando contenido iCal...');
    const icsContent = await fetchUrl(url);
    console.log('[PROX-CAL] Contenido iCal descargado con éxito. Tamaño:', icsContent.length, 'bytes');
    const parsedEvents = parseICS(icsContent);
    console.log('[PROX-CAL] Parseo completado. Eventos encontrados:', parsedEvents.length);
    if (parsedEvents.length > 0) {
      console.log('[PROX-CAL] Primer evento parseado como muestra:', JSON.stringify(parsedEvents[0], null, 2));
    }
    res.json(parsedEvents);
  } catch (err) {
    console.error('[PROX-CAL] Error en external-events proxy:', err.message);
    res.status(500).json({ error: `No se pudo obtener o procesar el calendario: ${err.message}` });
  }
});

// --- COLLABORATION: USERS, FRIENDS, TEAMS & SHARED TASKS ---

// 1. Get all users for discovery
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, username, email FROM users WHERE id != ?').all(req.user.id);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get friends list
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const friends = await db.prepare(`
      SELECT f.id, u.id as friend_id, u.username, u.email
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
    `).all(req.user.id);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add a friend
app.post('/api/friends', authenticateToken, async (req, res) => {
  const { friend_id } = req.body;
  if (!friend_id) return res.status(400).json({ error: 'Falta friend_id' });
  try {
    const existing = await db.prepare('SELECT id FROM friends WHERE user_id = ? AND friend_id = ?').get(req.user.id, friend_id);
    if (existing) return res.status(400).json({ error: 'Ya son amigos' });

    await db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)').run(req.user.id, friend_id);
    await db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(friend_id, req.user.id);

    const friend = await db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(friend_id);
    res.json({ success: true, friend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Remove a friend
app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
  const { friendId } = req.params;
  try {
    await db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
      .run(req.user.id, friendId, friendId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get teams list
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await db.prepare(`
      SELECT t.id, t.name, t.created_by, t.created_at, u.username as creator_name
      FROM teams t
      JOIN users u ON t.created_by = u.id
      WHERE t.id IN (SELECT team_id FROM team_members WHERE user_id = ?)
    `).all(req.user.id);

    const teamsWithMembers = await Promise.all(teams.map(async (team) => {
      const members = await db.prepare(`
        SELECT u.id, u.username, u.email
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
      `).all(team.id);
      team.members = members;
      return team;
    }));

    res.json(teamsWithMembers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Create a team
app.post('/api/teams', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de equipo requerido' });
  try {
    const info = await db.prepare('INSERT INTO teams (name, created_by) VALUES (?, ?)').run(name.trim(), req.user.id);
    const teamId = info.lastInsertRowid;
    await db.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)').run(teamId, req.user.id);

    const newTeam = await db.prepare(`
      SELECT t.id, t.name, t.created_by, t.created_at, u.username as creator_name
      FROM teams t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(teamId);
    
    newTeam.members = [{ id: req.user.id, username: req.user.username, email: req.user.email }];
    res.json(newTeam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Add team member
app.post('/api/teams/:id/members', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Falta user_id' });
  try {
    const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    if (team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Solo el creador del equipo puede añadir miembros' });
    }

    const existing = await db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?').get(id, user_id);
    if (existing) return res.status(400).json({ error: 'El usuario ya es miembro de este equipo' });

    await db.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)').run(id, user_id);
    
    const newMember = await db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(user_id);
    res.json(newMember);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Remove team member
app.delete('/api/teams/:id/members/:userId', authenticateToken, async (req, res) => {
  const { id, userId } = req.params;
  try {
    const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    
    if (team.created_by !== req.user.id && Number(userId) !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado para remover miembros de este equipo' });
    }

    await db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete team
app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    if (team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Solo el creador puede eliminar el equipo' });
    }

    await db.prepare('DELETE FROM team_members WHERE team_id = ?').run(id);
    await db.prepare('UPDATE tasks SET team_id = NULL WHERE team_id = ?').run(id);
    await db.prepare('DELETE FROM teams WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get shared tasks
app.get('/api/shared-tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await db.prepare(`
      SELECT t.*, u.username as creator_name, assign.username as assignee_name, team.name as team_name
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users assign ON t.assigned_to = assign.id
      LEFT JOIN teams team ON t.team_id = team.id
      WHERE t.assigned_to = ?
         OR t.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
         OR (t.user_id = ? AND (t.assigned_to IS NOT NULL OR t.team_id IS NOT NULL))
      ORDER BY t.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id);

    if (tasks.length === 0) {
      return res.json([]);
    }

    const taskIds = tasks.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const subtasks = await db.prepare(`SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY created_at ASC`).all(...taskIds);
    
    // Fetch tags for these tasks
    let taskTags = [];
    if (taskIds.length > 0) {
      taskTags = await db.prepare(`
        SELECT tt.task_id, t.id as tag_id, t.name, t.color
        FROM task_tags tt
        JOIN tags t ON tt.tag_id = t.id
        WHERE tt.task_id IN (${placeholders})
      `).all(...taskIds);
    }

    const tasksWithSubtasks = tasks.map(task => {
      task.subtasks = subtasks.filter(st => st.task_id === task.id);
      task.tags = taskTags.filter(tt => tt.task_id === task.id).map(tt => ({ id: tt.tag_id, name: tt.name, color: tt.color }));
      return task;
    });
    
    res.json(tasksWithSubtasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TAGS: CRUD ENDPOINTS ---

// 1. Get all tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const tags = await db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(req.user.id);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create tag
app.post('/api/tags', authenticateToken, async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de etiqueta requerido' });
  
  const colors = ['#f87171', '#f97316', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
  const finalColor = color || colors[Math.floor(Math.random() * colors.length)];

  try {
    await db.prepare('INSERT OR IGNORE INTO tags (name, color, user_id) VALUES (?, ?, ?)').run(name.trim().toLowerCase(), finalColor, req.user.id);
    const tag = await db.prepare('SELECT * FROM tags WHERE name = ? AND user_id = ?').get(name.trim().toLowerCase(), req.user.id);
    res.json(tag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update tag
app.put('/api/tags/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  try {
    const current = await db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Etiqueta no encontrada' });

    await db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      name !== undefined ? name.trim().toLowerCase() : current.name,
      color !== undefined ? color : current.color,
      id,
      req.user.id
    );
    const updated = await db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete tag
app.delete('/api/tags/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Etiqueta no encontrada' });

    await db.prepare('DELETE FROM task_tags WHERE tag_id = ?').run(id);
    await db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMINISTRATOR ENDPOINTS ---

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
  }
};

// 1. Get all users with task/list counts
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, username, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    // Query stats for each user asynchronously
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const taskCountRes = await db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(u.id);
      const listCountRes = await db.prepare('SELECT COUNT(*) as count FROM lists WHERE user_id = ?').get(u.id);
      return {
        ...u,
        task_count: taskCountRes ? taskCountRes.count : 0,
        list_count: listCountRes ? listCountRes.count : 0
      };
    }));

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Change user role
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Rol no válido. Debe ser admin o user.' });
  }

  try {
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete user account and cascade items safely
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
  }

  try {
    // Delete user's subtasks, tasks, sections, and lists manually to ensure clean DB
    const lists = await db.prepare('SELECT id FROM lists WHERE user_id = ?').all(id);
    const listIds = lists.map(l => l.id);
    if (listIds.length > 0) {
      const placeholders = listIds.map(() => '?').join(',');
      await db.prepare(`DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE list_id IN (${placeholders}))`).run(...listIds);
    }
    await db.prepare('DELETE FROM tasks WHERE user_id = ?').run(id);
    await db.prepare('DELETE FROM sections WHERE user_id = ?').run(id);
    await db.prepare('DELETE FROM lists WHERE user_id = ?').run(id);
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
