const express = require('express');
const router = express.Router();
const db = require('../database');

// Route to add a new relationship
router.post('/add', async (req, res) => {
    const { member1_id, member2_id, relationship_type } = req.body;

    // Server-side validation
    if (!member1_id || !member2_id || !relationship_type) {
        return res.status(400).render('relationships/add', {
            error: 'All fields are required.',
            member1_id,
            member2_id,
            relationship_type
        });
    }

    try {
        // Insert relationship into the database
        await db.run('INSERT INTO relationships (member1_id, member2_id, relationship_type) VALUES (?, ?, ?)', [member1_id, member2_id, relationship_type]);
        res.redirect('/members'); // Redirect to members list after adding
    } catch (error) {
        console.error(error);
        res.status(500).render('relationships/add', {
            error: 'An error occurred while adding the relationship.'
        });
    }
});

// Route to view relationships for a specific family member
router.get('/:id', async (req, res) => {
    const memberId = req.params.id;

    try {
        const member = await db.get('SELECT * FROM family_members WHERE id = ?', [memberId]);
        const relationships = await db.all('SELECT * FROM relationships WHERE member1_id = ? OR member2_id = ?', [memberId, memberId]);

        res.render('members/detail', { member, relationships });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while retrieving relationships.');
    }
});

module.exports = router;