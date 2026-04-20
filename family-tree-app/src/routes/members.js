const express = require('express');
const router = express.Router();
const db = require('../database');
const asyncHandler = require('../asyncHandler');
const {
    relationshipTypes,
    relationshipTypeValues,
    inverseRelationship,
    relationshipLabel
} = require('../relationshipTypes');
const { getRelationshipsForMember } = require('../treeService');

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
    const selfMember = await getSelfMember(req);

    res.status(options.status || 200).render('members/add', {
        data: options.data || {},
        error: options.error || null,
        selfMember,
        relationshipTypes
    });
};

const getRelationshipToSelf = async (req, memberId) => {
    if (!req.currentUser.self_member_id || Number(memberId) === Number(req.currentUser.self_member_id)) {
        return null;
    }

    return db.get(`
        SELECT *
        FROM relationships
        WHERE user_id = ?
            AND (
                (member_id_1 = ? AND member_id_2 = ?)
                OR (member_id_1 = ? AND member_id_2 = ?)
            )
        ORDER BY created_at DESC
        LIMIT 1
    `, [
        req.currentUser.id,
        memberId,
        req.currentUser.self_member_id,
        req.currentUser.self_member_id,
        memberId
    ]);
};

const getRelationshipTypeToSelf = (relationship, memberId) => {
    if (!relationship) {
        return '';
    }

    return Number(relationship.member_id_1) === Number(memberId)
        ? relationship.relationship_type
        : inverseRelationship(relationship.relationship_type);
};

const renderEditMember = async (req, res, options = {}) => {
    const member = options.member || await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    const selfRelationship = await getRelationshipToSelf(req, member.id);

    res.status(options.status || 200).render('members/edit', {
        member,
        error: options.error || null,
        relationshipTypes,
        relationshipToSelf: options.relationshipToSelf !== undefined
            ? options.relationshipToSelf
            : getRelationshipTypeToSelf(selfRelationship, member.id),
        isSelfMember: Number(req.currentUser.self_member_id) === Number(member.id)
    });
};

const validateMemberFields = async (req, res, next) => {
    try {
        const { first_name, last_name } = req.body;
        if (!first_name || !last_name) {
            if (req.params.id) {
                return await renderEditMember(req, res, {
                    status: 400,
                    error: 'First name and last name are required.',
                    member: { id: req.params.id, ...req.body },
                    relationshipToSelf: req.body.relationship_type || ''
                });
            }

            return await renderAddMember(req, res, {
                status: 400,
                data: req.body,
                error: 'First name and last name are required.'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

router.get('/', asyncHandler(async (req, res) => {
    const members = await db.all(
        'SELECT * FROM family_members WHERE user_id = ? ORDER BY last_name, first_name',
        [req.currentUser.id]
    );
    res.render('members/list', { members });
}));

router.get('/add', asyncHandler(async (req, res) => {
    await renderAddMember(req, res);
}));

router.post('/add', validateMemberFields, asyncHandler(async (req, res) => {
    const {
        first_name,
        last_name,
        date_of_birth,
        location_of_birth,
        current_location,
        related_member_id,
        relationship_type
    } = req.body;

    if (!req.currentUser.self_member_id) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Your profile is still being prepared. Please refresh and try again.'
        });
    }

    if (!relationship_type) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Choose who this person is to you.'
        });
    }

    if (!relationshipTypeValues.includes(relationship_type)) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Choose a valid relationship type.'
        });
    }

    const relatedMember = await db.get(
        'SELECT id FROM family_members WHERE id = ? AND user_id = ?',
        [related_member_id || req.currentUser.self_member_id, req.currentUser.id]
    );

    if (!relatedMember) {
        return await renderAddMember(req, res, {
            status: 400,
            data: req.body,
            error: 'Your profile was not found. Please refresh and try again.'
        });
    }

    const result = await db.run(
        `INSERT INTO family_members
        (user_id, first_name, last_name, date_of_birth, location_of_birth, current_location)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [req.currentUser.id, first_name, last_name, date_of_birth, location_of_birth, current_location]
    );

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

    res.redirect(`/members/${result.lastID}`);
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const memberId = req.params.id;
    const member = await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [memberId, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    const relationships = await getRelationshipsForMember(req.currentUser.id, memberId);

    const relationshipsWithLabels = relationships.map((relationship) => {
        const displayType = Number(relationship.member_id_1) === Number(memberId)
            ? inverseRelationship(relationship.relationship_type)
            : relationship.relationship_type;

        return {
            ...relationship,
            display_label: relationshipLabel(displayType)
        };
    });

    res.render('members/detail', { member, relationships: relationshipsWithLabels });
}));

router.get('/:id/edit', asyncHandler(async (req, res) => {
    await renderEditMember(req, res);
}));

router.post('/:id/edit', validateMemberFields, asyncHandler(async (req, res) => {
    const { first_name, last_name, date_of_birth, location_of_birth, current_location, relationship_type } = req.body;
    const member = await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );

    if (!member) {
        return res.status(404).render('404', { message: 'Family member not found' });
    }

    const isSelfMember = Number(req.currentUser.self_member_id) === Number(req.params.id);

    if (!isSelfMember && !relationship_type) {
        return await renderEditMember(req, res, {
            status: 400,
            error: 'Choose who this person is to you.',
            member: { ...member, ...req.body },
            relationshipToSelf: relationship_type || ''
        });
    }

    if (!isSelfMember && !relationshipTypeValues.includes(relationship_type)) {
        return await renderEditMember(req, res, {
            status: 400,
            error: 'Choose a valid relationship type.',
            member: { ...member, ...req.body },
            relationshipToSelf: relationship_type || ''
        });
    }

    await db.run(
        `UPDATE family_members
        SET first_name = ?, last_name = ?, date_of_birth = ?, location_of_birth = ?,
            current_location = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
        [first_name, last_name, date_of_birth, location_of_birth, current_location, req.params.id, req.currentUser.id]
    );

    if (!isSelfMember) {
        await db.run(
            `DELETE FROM relationships
            WHERE user_id = ?
                AND (
                    (member_id_1 = ? AND member_id_2 = ?)
                    OR (member_id_1 = ? AND member_id_2 = ?)
                )`,
            [
                req.currentUser.id,
                req.params.id,
                req.currentUser.self_member_id,
                req.currentUser.self_member_id,
                req.params.id
            ]
        );

        await db.run(
            `INSERT INTO relationships (user_id, member_id_1, member_id_2, relationship_type)
            VALUES (?, ?, ?, ?)`,
            [req.currentUser.id, req.params.id, req.currentUser.self_member_id, relationship_type]
        );
    }

    res.redirect(`/members/${req.params.id}`);
}));

router.post('/:id/delete', asyncHandler(async (req, res) => {
    if (Number(req.currentUser.self_member_id) === Number(req.params.id)) {
        return res.status(400).render('404', { message: 'Your own profile is required for your tree.' });
    }

    await db.run(
        'DELETE FROM family_members WHERE id = ? AND user_id = ?',
        [req.params.id, req.currentUser.id]
    );
    res.redirect('/members');
}));

module.exports = router;
