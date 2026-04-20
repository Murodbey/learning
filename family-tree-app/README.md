# Family Tree Application

This is a simple Family Tree web application built using Node.js, Express.js, EJS templates, and SQLite. The application allows users to manage family members and their relationships.

## Project Structure

```
family-tree-app
├── src
│   ├── server.js
│   ├── database.js
│   ├── routes
│   │   ├── members.js
│   │   └── relationships.js
│   ├── views
│   │   ├── layout.ejs
│   │   ├── home.ejs
│   │   ├── members
│   │   │   ├── list.ejs
│   │   │   ├── detail.ejs
│   │   │   ├── add.ejs
│   │   │   └── edit.ejs
│   │   └── relationships
│   │       └── add.ejs
│   └── public
│       └── style.css
├── package.json
├── .gitignore
└── README.md
```

## Features

- View all family members
- Add a new family member
- View details of a specific family member
- Edit existing family member details
- Delete a family member
- Manage relationships between family members (parent, child, spouse, sibling)

## Database Schema

The application uses SQLite to store data. The following tables are created:

### family_members

```sql
CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT,
    location_of_birth TEXT,
    current_location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### relationships

```sql
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id_1 INTEGER NOT NULL,
    member_id_2 INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('parent', 'child', 'spouse', 'sibling')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id_1) REFERENCES family_members(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id_2) REFERENCES family_members(id) ON DELETE CASCADE,
    UNIQUE(member_id_1, member_id_2, relationship_type)
);
```

## Setup Instructions

1. Navigate to the project directory.
2. Run `npm install` to install all dependencies.
3. Run `npm run dev` to start the application in development mode.
4. Open your browser and go to `http://localhost:3000` to access the application.

## Dependencies

The application requires the following npm packages:

- express
- ejs
- sqlite3
- body-parser

## .gitignore

The `.gitignore` file excludes the following from version control:
- `node_modules/` - Dependencies (reinstall with npm install)
- `*.db` - Local database files
- `.env` - Environment variables
- `.DS_Store` - Mac system files
- `*.log` - Log files

This ensures you only commit your source code, not large files or sensitive data.

## License

This project is open-source and available under the MIT License.
