const express = require('express');
const router = express.Router();
const db = require('../database');
const asyncHandler = require('../asyncHandler');
const {
    hashPassword,
    verifyPassword,
    ensureSelfMember,
    loginUser,
    logoutUser,
    redirectIfAuthenticated
} = require('../auth');

router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('auth/login', { data: {}, error: null });
});

router.post('/login', redirectIfAuthenticated, asyncHandler(async (req, res) => {
    const { email = '', password = '' } = req.body;
    const data = { email: email.trim().toLowerCase() };

    const user = await db.get('SELECT * FROM users WHERE email = ?', [data.email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(400).render('auth/login', {
            data,
            error: 'Email or password is incorrect.'
        });
    }

    loginUser(res, user.id);
    res.redirect('/');
}));

router.get('/signup', redirectIfAuthenticated, (req, res) => {
    res.render('auth/signup', { data: {}, error: null });
});

router.post('/signup', redirectIfAuthenticated, asyncHandler(async (req, res) => {
    const { name = '', email = '', password = '', confirm_password = '' } = req.body;
    const data = {
        name: name.trim(),
        email: email.trim().toLowerCase()
    };

    if (!data.name || !data.email || !password || !confirm_password) {
        return res.status(400).render('auth/signup', {
            data,
            error: 'All fields are required.'
        });
    }

    if (password.length < 6) {
        return res.status(400).render('auth/signup', {
            data,
            error: 'Password must be at least 6 characters.'
        });
    }

    if (password !== confirm_password) {
        return res.status(400).render('auth/signup', {
            data,
            error: 'Passwords do not match.'
        });
    }

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existingUser) {
        return res.status(400).render('auth/signup', {
            data,
            error: 'An account with that email already exists.'
        });
    }

    const result = await db.run(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [data.name, data.email, hashPassword(password)]
    );

    await ensureSelfMember({
        id: result.lastID,
        name: data.name,
        email: data.email,
        self_member_id: null
    });

    loginUser(res, result.lastID);
    res.redirect('/');
}));

router.post('/logout', (req, res) => {
    logoutUser(res);
    res.redirect('/login');
});

module.exports = router;
