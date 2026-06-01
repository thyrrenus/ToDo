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
    return {
      async all(...args) {
        const res = await client.execute({ sql, args });
        return res.rows;
      },
      async get(...args) {
        const res = await client.execute({ sql, args });
        return res.rows[0] || null;
      },
      async run(...args) {
        const res = await client.execute({ sql, args });
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
};

// Run initialization
initDb().then(() => {
  console.log('Database initialized successfully.');
}).catch((err) => {
  console.error('Error initializing database:', err);
});

module.exports = db;
