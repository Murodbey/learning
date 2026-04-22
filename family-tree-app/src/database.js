const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { canonicalizeRelationship } = require('./relationshipTypes');

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

const RELATIONSHIP_TYPES_SQL = "'parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild', 'aunt_uncle', 'niece_nephew', 'cousin', 'in_law'";

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

const addColumnIfMissing = async (tableName, columnName, columnDefinition) => {
    const columns = await allAsync(`PRAGMA table_info(${tableName})`);
    const exists = columns.some((column) => column.name === columnName);

    if (!exists) {
        await runAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
};

const recreateRelationshipsTable = async () => {
    const existingRows = await allAsync(`
        SELECT user_id, member_id_1, member_id_2, relationship_type, created_at
        FROM relationships
        ORDER BY created_at, id
    `);

    await runAsync('PRAGMA foreign_keys = OFF');
    await runAsync('ALTER TABLE relationships RENAME TO relationships_old');
    await runAsync(`
        CREATE TABLE relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            member_id_1 INTEGER NOT NULL,
            member_id_2 INTEGER NOT NULL,
            relationship_type TEXT NOT NULL CHECK(relationship_type IN (${RELATIONSHIP_TYPES_SQL})),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id_1) REFERENCES family_members(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id_2) REFERENCES family_members(id) ON DELETE CASCADE,
            CHECK(member_id_1 < member_id_2),
            UNIQUE(user_id, member_id_1, member_id_2, relationship_type)
        )
    `);

    for (const row of existingRows) {
        const canonical = canonicalizeRelationship(
            row.member_id_1,
            row.member_id_2,
            row.relationship_type
        );

        await runAsync(
            `INSERT OR IGNORE INTO relationships
                (user_id, member_id_1, member_id_2, relationship_type, created_at)
            VALUES (?, ?, ?, ?, ?)`,
            [
                row.user_id,
                canonical.member_id_1,
                canonical.member_id_2,
                canonical.relationship_type,
                row.created_at
            ]
        );
    }

    await runAsync('DROP TABLE relationships_old');
    await runAsync('PRAGMA foreign_keys = ON');
};

const migrateRelationshipTypes = async () => {
    const row = await getAsync("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'relationships'");
    if (!row) {
        return;
    }

    const needsRebuild = !row.sql.includes('CHECK(member_id_1 < member_id_2)')
        || !row.sql.includes("'in_law'")
        || !row.sql.includes('UNIQUE(user_id, member_id_1, member_id_2, relationship_type)');

    if (!needsRebuild) {
        return;
    }

    await recreateRelationshipsTable();
};

// Initialize database tables
const initializeDatabase = async () => {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        self_member_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('users table ready');

    await runAsync(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        gender TEXT,
        date_of_birth TEXT,
        location_of_birth TEXT,
        current_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('family_members table ready');

    await runAsync(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        member_id_1 INTEGER NOT NULL,
        member_id_2 INTEGER NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN (${RELATIONSHIP_TYPES_SQL})),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id_1) REFERENCES family_members(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id_2) REFERENCES family_members(id) ON DELETE CASCADE,
        CHECK(member_id_1 < member_id_2),
        UNIQUE(user_id, member_id_1, member_id_2, relationship_type)
      )
    `);
    console.log('relationships table ready');

    await addColumnIfMissing('family_members', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
    await addColumnIfMissing('family_members', 'gender', 'TEXT');
    await addColumnIfMissing('relationships', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
    await addColumnIfMissing('users', 'self_member_id', 'INTEGER');
    await migrateRelationshipTypes();
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
