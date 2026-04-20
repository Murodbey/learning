const express = require('express');
const router = express.Router();
const db = require('../database');

const relationshipTypes = ['parent', 'child', 'spouse', 'sibling'];

const getMembersForUser = (userId) => {
    return db.all(
        'SELECT * FROM family_members WHERE user_id = ? ORDER BY last_name, first_name',
        [userId]
    );
};

const getSelfMember = async (req) => {
    if (!req.currentUser.self_member_id) {
        return null;
    }

    return db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [req.currentUser.self_member_id, req.currentUser.id]
    );
};

const renderAddMember = async (req, res, options = {}) => {
    const members = await getMembersForUser(req.currentUser.id);
    const selfMember = await getSelfMember(req);

    res.status(options.status || 200).render('members/add', {
        data: options.data || {},
        error: options.error || null,
        members,
        selfMember
    });
};

const validateMemberFields = (req, res, next) => {
    const { first_name, last_name } = req.body;
    if (!first_name || !last_name) {
        if (req.params.id) {
            return res.status(400).render('members/edit', {
                error: 'First name and last name are required.',
                member: { id: req.params.id, ...req.body }
            });
        }

        return renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'First name and last name are required.'
        });
    }
    next();
};

router.get('/', async (req, res) => {
    const members = await db.all(
        'SELECT * FROM family_members WHERE user_id = ? ORDER BY last_name, first_name',
        [req.currentUser.id]
    );
    res.render('members/list', { members });
});

router.get('/add', async (req, res) => {
    await renderAddMember(req, res);
});

router.post('/add', validateMemberFields, async (req, res) => {
    const {
        first_name,
        last_name,
        date_of_birth,
        location_of_birth,
        current_location,
        is_self,
        related_member_id,
        relationship_type
    } = req.body;

    if (relationship_type && !related_member_id) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Choose who this person is related to.'
        });
    }

    if (relationship_type && !relationshipTypes.includes(relationship_type)) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Choose a valid relationship type.'
        });
    }

    const relatedMember = related_member_id ? await db.get(
        'SELECT id FROM family_members WHERE id = ? AND user_id = ?',
        [related_member_id, req.currentUser.id]
    ) : null;

    if (related_member_id && !relatedMember) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Choose a related person from your family tree.'
        });
    }

    const result = await db.run(
        `INSERT INTO family_members
        (user_id, first_name, last_name, date_of_birth, location_of_birth, current_location)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [req.currentUser.id, first_name, last_name, date_of_birth, location_of_birth, current_location]
    );

    if (is_self && !req.currentUser.self_member_id) {
        await db.run(
            'UPDATE users SET self_member_id = ? WHERE id = ?',
            [result.lastID, req.currentUser.id]
        );
        req.currentUser.self_member_id = result.lastID;
    }

    if (relatedMember && relationship_type) {
        try {
            await db.run(
                `INSERT INTO relationships (user_id, member_id_1, member_id_2, relationship_type)
                VALUES (?, ?, ?, ?)`,
                [req.currentUser.id, result.lastID, relatedMember.id, relationship_type]
            );
        } catch (error) {
            if (!error.message || !error.message.includes('UNIQUE')) {
                throw error;
            }
        }
    }

    res.redirect(`/members/${result.lastID}`);
});

router.get('/:id', async (req, res) => {
    const memberId = req.params.id;
    const member = await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [memberId, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    const relationships = await db.all(`
        SELECT
            relationships.id,
            relationships.relationship_type,
            relationships.member_id_1,
            relationships.member_id_2,
            CASE
                WHEN relationships.member_id_1 = ? THEN relationships.member_id_2
                ELSE relationships.member_id_1
            END AS related_member_id,
            related.first_name AS related_first_name,
            related.last_name AS related_last_name
        FROM relationships
        JOIN family_members AS related
            ON related.id = CASE
                WHEN relationships.member_id_1 = ? THEN relationships.member_id_2
                ELSE relationships.member_id_1
            END
        WHERE relationships.user_id = ?
            AND (relationships.member_id_1 = ? OR relationships.member_id_2 = ?)
        ORDER BY relationships.relationship_type, related.last_name, related.first_name
    `, [memberId, memberId, req.currentUser.id, memberId, memberId]);

    res.render('members/detail', { member, relationships });
});

router.get('/:id/edit', async (req, res) => {
    const member = await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    res.render('members/edit', { member });
});

router.post('/:id/edit', validateMemberFields, async (req, res) => {
    const { first_name, last_name, date_of_birth, location_of_birth, current_location } = req.body;
    await db.run(
        `UPDATE family_members
        SET first_name = ?, last_name = ?, date_of_birth = ?, location_of_birth = ?,
            current_location = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
        [first_name, last_name, date_of_birth, location_of_birth, current_location, req.params.id, req.currentUser.id]
    );
    res.redirect(`/members/${req.params.id}`);
});

router.post('/:id/set-self', async (req, res) => {
    const member = await db.get(
        'SELECT id FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    await db.run(
        'UPDATE users SET self_member_id = ? WHERE id = ?',
        [member.id, req.currentUser.id]
    );

    res.redirect(`/members/${member.id}`);
});

router.post('/:id/delete', async (req, res) => {
    if (Number(req.currentUser.self_member_id) === Number(req.params.id)) {
        await db.run(
            'UPDATE users SET self_member_id = NULL WHERE id = ?',
            [req.currentUser.id]
        );
    }

    await db.run(
        'DELETE FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );
    res.redirect('/members');
});

module.exports = router;
