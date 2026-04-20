const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware to validate required fields
const validateMemberFields = (req, res, next) => {
    const { first_name, last_name, date_of_birth, location_of_birth, current_location } = req.body;
    if (!first_name || !last_name || !date_of_birth || !location_of_birth || !current_location) {
        return res.render('members/add', { error: 'All fields are required.' });
    }
    next();
};

// Route to view all family members
router.get('/', async (req, res) => {
    const members = await db.all('SELECT * FROM family_members');
    res.render('members/list', { members });
});

// Route to view a specific family member's details
router.get('/:id', async (req, res) => {
    const memberId = req.params.id;
    const member = await db.get('SELECT * FROM family_members WHERE id = ?', [memberId]);
    const relationships = await db.all('SELECT * FROM relationships WHERE member1_id = ? OR member2_id = ?', [memberId, memberId]);
    res.render('members/detail', { member, relationships });
});

// Route to show the form for adding a new family member
router.get('/add', (req, res) => {
    res.render('members/add');
});

// Route to handle adding a new family member
router.post('/add', validateMemberFields, async (req, res) => {
    const { first_name, last_name, date_of_birth, location_of_birth, current_location } = req.body;
    await db.run('INSERT INTO family_members (first_name, last_name, date_of_birth, location_of_birth, current_location) VALUES (?, ?, ?, ?, ?)', 
        [first_name, last_name, date_of_birth, location_of_birth, current_location]);
    res.redirect('/members');
});

// Route to show the form for editing an existing family member
router.get('/edit/:id', async (req, res) => {
    const memberId = req.params.id;
    const member = await db.get('SELECT * FROM family_members WHERE id = ?', [memberId]);
    res.render('members/edit', { member });
});

// Route to handle editing a family member
router.post('/edit/:id', validateMemberFields, async (req, res) => {
    const memberId = req.params.id;
    const { first_name, last_name, date_of_birth, location_of_birth, current_location } = req.body;
    await db.run('UPDATE family_members SET first_name = ?, last_name = ?, date_of_birth = ?, location_of_birth = ?, current_location = ? WHERE id = ?', 
        [first_name, last_name, date_of_birth, location_of_birth, current_location, memberId]);
    res.redirect('/members');
});

// Route to handle deleting a family member
router.post('/delete/:id', async (req, res) => {
    const memberId = req.params.id;
    await db.run('DELETE FROM family_members WHERE id = ?', [memberId]);
    res.redirect('/members');
});

module.exports = router;