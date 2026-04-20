const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const db = require('./database');
const { attachCurrentUser, requireAuth } = require('./auth');
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

// Initialize database
db.initializeDatabase();

// Routes
app.use(authRoutes);

app.get('/', requireAuth, (req, res) => {
    res.render('home', { layout: 'layout' });
});

app.use('/members', requireAuth, membersRoutes);
app.use('/relationships', requireAuth, relationshipsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { message: 'Page not found', layout: 'layout' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Family Tree App running at http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to stop the server`);
});
