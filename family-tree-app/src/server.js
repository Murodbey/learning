const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const db = require('./database');
const { attachCurrentUser, requireAuth } = require('./auth');
const { getTreeForUser } = require('./treeService');
const asyncHandler = require('./asyncHandler');
const authRoutes = require('./routes/auth');
const membersRoutes = require('./routes/members');
const relationshipsRoutes = require('./routes/relationships');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(attachCurrentUser);

// Routes
app.use(authRoutes);

app.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { selfMember, treeGroups } = await getTreeForUser(req.currentUser);

    res.render('home', {
        layout: 'layout',
        selfMember,
        treeGroups
    });
}));

app.use('/members', requireAuth, membersRoutes);
app.use('/relationships', requireAuth, relationshipsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { message: 'Page not found', layout: 'layout' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('404', {
        message: 'Something went wrong',
        layout: 'layout'
    });
});

// Start server after the database is ready.
db.initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Family Tree App running at http://localhost:${PORT}`);
            console.log(`Press Ctrl+C to stop the server`);
        });
    })
    .catch((error) => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });
