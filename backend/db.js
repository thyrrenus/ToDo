const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'todo.db');
const db = new Database(dbPath, { verbose: console.log });

const initDb = () => {
  db.exec(`
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
  
  // Migration for existing databases
  try { db.exec("ALTER TABLE tasks ADD COLUMN start_time DATETIME;"); } catch(e) {}
  try { db.exec("ALTER TABLE tasks ADD COLUMN end_time DATETIME;"); } catch(e) {}
  try { db.exec("ALTER TABLE subtasks ADD COLUMN description TEXT;"); } catch(e) {}
  try { db.exec("ALTER TABLE subtasks ADD COLUMN due_date DATETIME;"); } catch(e) {}
  try { db.exec("ALTER TABLE subtasks ADD COLUMN start_time DATETIME;"); } catch(e) {}
  try { db.exec("ALTER TABLE subtasks ADD COLUMN end_time DATETIME;"); } catch(e) {}
  try { db.exec("ALTER TABLE tasks ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;"); } catch(e) {}
  
  // Migration for multi-user system
  try { db.exec("ALTER TABLE lists ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"); } catch(e) {}
  try { db.exec("ALTER TABLE sections ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"); } catch(e) {}
  try { db.exec("ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"); } catch(e) {}
  
  // Insert an inbox list if no lists exist
  const count = db.prepare('SELECT COUNT(*) as count FROM lists').get().count;
  if (count === 0) {
    db.prepare("INSERT INTO lists (name, color) VALUES ('Inbox', '#3b82f6')").run();
  }
};

initDb();

module.exports = db;
