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

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-cockpit-todo-9988';

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
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const info = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, passwordHash);
    const userId = info.lastInsertRowid;

    // Check if this is the first user registered
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 1) {
      // Migrate existing orphaned tasks, lists, and sections to this first user
      db.prepare('UPDATE lists SET user_id = ? WHERE user_id IS NULL').run(userId);
      db.prepare('UPDATE sections SET user_id = ? WHERE user_id IS NULL').run(userId);
      db.prepare('UPDATE tasks SET user_id = ? WHERE user_id IS NULL').run(userId);
    } else {
      // Create a default Inbox list for this new user
      db.prepare("INSERT INTO lists (name, color, user_id) VALUES ('Inbox', '#3b82f6', ?)").run(userId);
    }

    const newUser = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId);
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
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    const userData = { id: user.id, username: user.username, email: user.email };
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
  const imageUrl = `http://localhost:${process.env.PORT || 3001}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

const port = process.env.PORT || 3001;

// --- LISTS ---
app.get('/api/lists', authenticateToken, (req, res) => {
  try {
    const lists = db.prepare('SELECT * FROM lists WHERE user_id = ?').all(req.user.id);
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', authenticateToken, (req, res) => {
  const { name, color } = req.body;
  try {
    const info = db.prepare('INSERT INTO lists (name, color, user_id) VALUES (?, ?, ?)').run(name, color, req.user.id);
    const newList = db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(newList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id', authenticateToken, (req, res) => {
  const { name, color } = req.body;
  const { id } = req.params;
  try {
    db.prepare('UPDATE lists SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, id, req.user.id);
    const updatedList = db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json(updatedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lists/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    // Optional: Delete all tasks in the list first
    db.prepare('DELETE FROM tasks WHERE list_id = ? AND user_id = ?').run(id, req.user.id);
    db.prepare('DELETE FROM lists WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SECTIONS ---
app.get('/api/sections', authenticateToken, (req, res) => {
  try {
    const sections = db.prepare('SELECT * FROM sections WHERE user_id = ? ORDER BY order_index ASC').all(req.user.id);
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sections', authenticateToken, (req, res) => {
  const { list_id, name, order_index } = req.body;
  try {
    const info = db.prepare('INSERT INTO sections (list_id, name, order_index, user_id) VALUES (?, ?, ?, ?)').run(list_id, name, order_index || 0, req.user.id);
    const newSection = db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(newSection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sections/:id', authenticateToken, (req, res) => {
  const { name, is_collapsed, order_index } = req.body;
  const { id } = req.params;
  try {
    const current = db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Section not found' });

    db.prepare('UPDATE sections SET name = ?, is_collapsed = ?, order_index = ? WHERE id = ? AND user_id = ?').run(
      name !== undefined ? name : current.name,
      is_collapsed !== undefined ? is_collapsed : current.is_collapsed,
      order_index !== undefined ? order_index : current.order_index,
      id,
      req.user.id
    );
    const updatedSection = db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json(updatedSection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sections/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM sections WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASKS ---
app.get('/api/tasks', authenticateToken, (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    if (tasks.length === 0) {
      return res.json([]);
    }
    const taskIds = tasks.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const subtasks = db.prepare(`SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY created_at ASC`).all(...taskIds);
    
    // Group subtasks by task_id
    const tasksWithSubtasks = tasks.map(task => {
      task.subtasks = subtasks.filter(st => st.task_id === task.id);
      return task;
    });
    
    res.json(tasksWithSubtasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const { list_id, section_id, title, description, due_date, start_time, end_time, priority } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO tasks (list_id, section_id, title, description, due_date, start_time, end_time, priority, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(list_id, section_id || null, title, description, due_date, start_time || null, end_time || null, priority || 0, req.user.id);
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.user.id);
    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { title, description, due_date, start_time, end_time, priority, is_completed, list_id, section_id } = req.body;
  const { id } = req.params;
  try {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare(`
      UPDATE tasks 
      SET list_id = ?, section_id = ?, title = ?, description = ?, due_date = ?, start_time = ?, end_time = ?, priority = ?, is_completed = ? 
      WHERE id = ? AND user_id = ?
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
      id,
      req.user.id
    );

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }
    db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SUBTASKS ---
app.post('/api/subtasks', authenticateToken, (req, res) => {
  const { task_id, title, description, due_date, start_time, end_time } = req.body;
  try {
    const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado para esta tarea' });
    }

    const info = db.prepare('INSERT INTO subtasks (task_id, title, description, due_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)').run(
      task_id, title, description || null, due_date || null, start_time || null, end_time || null
    );
    const newSubtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(info.lastInsertRowid);
    res.json(newSubtask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subtasks/:id', authenticateToken, (req, res) => {
  const { title, description, is_completed, due_date, start_time, end_time } = req.body;
  const { id } = req.params;
  try {
    const current = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Subtask not found' });

    const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(current.task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    db.prepare('UPDATE subtasks SET title = ?, description = ?, is_completed = ?, due_date = ?, start_time = ?, end_time = ? WHERE id = ?').run(
      title !== undefined ? title : current.title,
      description !== undefined ? description : current.description,
      is_completed !== undefined ? is_completed : current.is_completed,
      due_date !== undefined ? due_date : current.due_date,
      start_time !== undefined ? start_time : current.start_time,
      end_time !== undefined ? end_time : current.end_time,
      id
    );
    const updatedSubtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    res.json(updatedSubtask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subtasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const current = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Subtask not found' });

    const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(current.task_id, req.user.id);
    if (!parentTask) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
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

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('URL inválida'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    client.get(targetUrl, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
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

function parseICSDate(dateStr) {
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
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);

      const hours = timePart.substring(0, 2);
      const minutes = timePart.substring(2, 4);
      const seconds = timePart.substring(4, 6) || '00';

      const isUtc = timePart.endsWith('Z');
      
      if (isUtc) {
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
      } else {
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
    if (trimmedLine.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
      inEvent = true;
      continue;
    }

    if (trimmedLine.startsWith('END:VEVENT')) {
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
      const key = semicolonIndex === -1 ? keyPart : keyPart.substring(0, semicolonIndex);

      if (key === 'SUMMARY') {
        currentEvent.summary = unescapeICSValue(value);
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = unescapeICSValue(value);
      } else if (key === 'LOCATION') {
        currentEvent.location = unescapeICSValue(value);
      } else if (key === 'DTSTART') {
        currentEvent.dtstart = value;
      } else if (key === 'DTEND') {
        currentEvent.dtend = value;
      } else if (key === 'UID') {
        currentEvent.uid = value;
      }
    }
  }

  return events.map(e => {
    const start_time = parseICSDate(e.dtstart);
    let end_time = parseICSDate(e.dtend);

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
  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  try {
    const icsContent = await fetchUrl(url);
    const parsedEvents = parseICS(icsContent);
    res.json(parsedEvents);
  } catch (err) {
    console.error('Error in external-events proxy:', err.message);
    res.status(500).json({ error: `No se pudo obtener o procesar el calendario: ${err.message}` });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
