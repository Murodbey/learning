const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file location
const dbPath = path.join(__dirname, '../family_tree.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database tables
const initializeDatabase = () => {
    db.serialize(() => {
        // Create family_members table
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('users table ready');
            }
        });

        db.run(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT,
        location_of_birth TEXT,
        current_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
            if (err) {
                console.error('Error creating family_members table:', err.message);
            } else {
                console.log('family_members table ready');
            }
        });

        // Create relationships table
        db.run(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        member_id_1 INTEGER NOT NULL,
        member_id_2 INTEGER NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN ('parent', 'child', 'spouse', 'sibling')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id_1) REFERENCES family_members(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id_2) REFERENCES family_members(id) ON DELETE CASCADE,
        UNIQUE(member_id_1, member_id_2, relationship_type)
      )
    `, (err) => {
            if (err) {
                console.error('Error creating relationships table:', err.message);
            } else {
                console.log('relationships table ready');
            }
        });

        addColumnIfMissing('family_members', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
        addColumnIfMissing('relationships', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
    });
};

const addColumnIfMissing = (tableName, columnName, columnDefinition) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
            console.error(`Error checking ${tableName} columns:`, err.message);
            return;
        }

        const exists = columns.some((column) => column.name === columnName);
        if (!exists) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (alterErr) => {
                if (alterErr) {
                    console.error(`Error adding ${columnName} to ${tableName}:`, alterErr.message);
                }
            });
        }
    });
};

// Helper function to run queries with promises
const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
};

// Helper function to get single row
const getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Helper function to get all rows
const allAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

module.exports = {
    db,
    initializeDatabase,
    run: runAsync,
    get: getAsync,
    all: allAsync,
    runAsync,
    getAsync,
    allAsync
};
