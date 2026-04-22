const express = require('express');
const router = express.Router();
const db = require('../database');
const asyncHandler = require('../asyncHandler');
const { relationshipTypes, relationshipTypeValues, canonicalizeRelationship } = require('../relationshipTypes');

const renderAddRelationship = async (req, res, options = {}) => {
    const members = await db.all(
        'SELECT id, first_name, last_name FROM family_members WHERE user_id = ? ORDER BY last_name, first_name',
        [req.currentUser.id]
    );

    res.status(options.status || 200).render('relationships/add', {
        members,
        relationshipTypes,
        data: options.data || {},
        error: options.error || null
    });
};

router.get('/add', asyncHandler(async (req, res) => {
    await renderAddRelationship(req, res);
}));

router.post('/add', asyncHandler(async (req, res) => {
    const { member_id_1, member_id_2, relationship_type } = req.body;
    const data = { member_id_1, member_id_2, relationship_type };

    if (!member_id_1 || !member_id_2 || !relationship_type) {
        return await renderAddRelationship(req, res, {
            status: 400,
            data,
            error: 'All fields are required.'
        });
    }

    if (member_id_1 === member_id_2) {
        return await renderAddRelationship(req, res, {
            status: 400,
            data,
            error: 'Choose two different family members.'
        });
    }

    if (!relationshipTypeValues.includes(relationship_type)) {
        return await renderAddRelationship(req, res, {
            status: 400,
            data,
            error: 'Choose a valid relationship type.'
        });
    }

    const selectedMembers = await db.all(
        `SELECT id FROM family_members
        WHERE user_id = ? AND id IN (?, ?)`,
        [req.currentUser.id, member_id_1, member_id_2]
    );

    if (selectedMembers.length !== 2) {
        return await renderAddRelationship(req, res, {
            status: 400,
            data,
            error: 'Both family members must belong to your account.'
        });
    }

    try {
        const canonical = canonicalizeRelationship(member_id_1, member_id_2, relationship_type);
        await db.run(
            `INSERT INTO relationships (user_id, member_id_1, member_id_2, relationship_type)
            VALUES (?, ?, ?, ?)`,
            [
                req.currentUser.id,
                canonical.member_id_1,
                canonical.member_id_2,
                canonical.relationship_type
            ]
        );
        res.redirect(`/members/${member_id_1}`);
    } catch (error) {
        const isDuplicate = error.message && error.message.includes('UNIQUE');
        await renderAddRelationship(req, res, {
            status: 400,
            data,
            error: isDuplicate ? 'That relationship already exists.' : 'An error occurred while adding the relationship.'
        });
    }
}));

router.post('/:id/delete', asyncHandler(async (req, res) => {
    await db.run(
        'DELETE FROM relationships WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );

    res.redirect(req.body.referrer || '/members');
}));

module.exports = router;
