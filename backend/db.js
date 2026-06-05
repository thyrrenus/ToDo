const { createClient } = require('@libsql/client');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const useTurso = !!process.env.TURSO_DATABASE_URL;

let client;

if (useTurso) {
  console.log('Connecting to Turso Cloud Database:', process.env.TURSO_DATABASE_URL);
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
} else {
  const dbPath = path.resolve(__dirname, 'todo.db');
  console.log('Connecting to Local SQLite Database:', dbPath);
  client = createClient({
    url: `file:${dbPath}`
  });
}

// Unified asynchronous DB helper matching better-sqlite3 structure
const db = {
  // Execute a raw query string
  async exec(sql) {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (e) {
        // If it's an ALTER TABLE error (like column already exists), ignore it
        if (!stmt.includes('ALTER TABLE')) {
          console.warn('SQL execution warning (ignored):', e.message);
        }
      }
    }
  },

  // Prepare a statement for execution
  prepare(sql) {
    const sanitizeArgs = (args) => args.map(arg => arg === undefined ? null : arg);

    return {
      async all(...args) {
        const res = await client.execute({ sql, args: sanitizeArgs(args) });
        return res.rows;
      },
      async get(...args) {
        const res = await client.execute({ sql, args: sanitizeArgs(args) });
        return res.rows[0] || null;
      },
      async run(...args) {
        const res = await client.execute({ sql, args: sanitizeArgs(args) });
        return {
          lastInsertRowid: res.lastInsertRowid ? Number(res.lastInsertRowid) : null,
          rowsAffected: res.rowsAffected
        };
      }
    };
  }
};

const initDb = async () => {
  // 1. Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      outlook_ical_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER,
      name TEXT NOT NULL,
      is_collapsed BOOLEAN DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER,
      section_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATETIME,
      start_time DATETIME,
      end_time DATETIME,
      priority INTEGER DEFAULT 0,
      is_completed BOOLEAN DEFAULT 0,
      recurrence_type TEXT DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists(id),
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_completed BOOLEAN DEFAULT 0,
      due_date DATETIME,
      start_time DATETIME,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(name, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(task_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS list_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      user_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 2. Safe Alterations (Migrations)
  await db.exec(`
    ALTER TABLE tasks ADD COLUMN start_time DATETIME;
    ALTER TABLE tasks ADD COLUMN end_time DATETIME;
    ALTER TABLE subtasks ADD COLUMN description TEXT;
    ALTER TABLE subtasks ADD COLUMN due_date DATETIME;
    ALTER TABLE subtasks ADD COLUMN start_time DATETIME;
    ALTER TABLE subtasks ADD COLUMN end_time DATETIME;
    ALTER TABLE tasks ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
    ALTER TABLE lists ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE sections ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
    ALTER TABLE tasks ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
     ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
     ALTER TABLE lists ADD COLUMN group_id INTEGER REFERENCES list_groups(id) ON DELETE SET NULL;
     ALTER TABLE lists ADD COLUMN icon TEXT;
     ALTER TABLE list_groups ADD COLUMN icon TEXT;
     ALTER TABLE tasks ADD COLUMN recurrence_type TEXT DEFAULT 'none';
     ALTER TABLE users ADD COLUMN outlook_ical_url TEXT;
   `);

  // Create Indexes for performance optimization on foreign keys
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_sections_list_id ON sections(list_id);
    CREATE INDEX IF NOT EXISTS idx_sections_user_id ON sections(user_id);
    CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_lists_group_id ON lists(group_id);
    CREATE INDEX IF NOT EXISTS idx_list_groups_user_id ON list_groups(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
  `);

  // 3. Ensure a default list if empty
  try {
    const countRes = await db.prepare('SELECT COUNT(*) as count FROM lists').get();
    if (countRes && countRes.count === 0) {
      await db.prepare("INSERT INTO lists (name, color) VALUES ('Inbox', '#3b82f6')").run();
    }
  } catch (e) {
    console.error('Error inserting default list:', e.message);
  }

  // 4. Ensure the oldest user is admin
  try {
    const oldestUser = await db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
    if (oldestUser) {
      await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(oldestUser.id);
      console.log('Oldest user promoted to admin:', oldestUser.id);
    }
  } catch (e) {
    console.error('Error promoting oldest user:', e.message);
  }
};

// Run initialization
initDb().then(() => {
  console.log('Database initialized successfully.');
}).catch((err) => {
  console.error('Error initializing database:', err);
});

module.exports = db;
