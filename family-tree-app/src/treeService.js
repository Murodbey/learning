const db = require('./database');
const { inverseRelationship, relationshipLabel } = require('./relationshipTypes');

const emptyTreeGroups = () => ({
    grandparents: [],
    parents: [],
    siblings: [],
    spouse: [],
    children: [],
    grandchildren: [],
    aunt_uncle: [],
    niece_nephew: [],
    cousins: [],
    other: []
});

const groupMap = {
    grandparent: 'grandparents',
    parent: 'parents',
    sibling: 'siblings',
    spouse: 'spouse',
    child: 'children',
    grandchild: 'grandchildren',
    aunt_uncle: 'aunt_uncle',
    niece_nephew: 'niece_nephew',
    cousin: 'cousins'
};

const buildTreeGroups = (relationships, selfMemberId) => {
    const groups = emptyTreeGroups();

    relationships.forEach((relationship) => {
        const relatedIsFirst = Number(relationship.member_id_1) !== Number(selfMemberId);
        const typeFromSelf = relatedIsFirst
            ? relationship.relationship_type
            : inverseRelationship(relationship.relationship_type);
        const groupName = groupMap[typeFromSelf] || 'other';

        groups[groupName].push({
            id: relationship.related_member_id,
            first_name: relationship.related_first_name,
            last_name: relationship.related_last_name,
            relationshipLabel: relationshipLabel(typeFromSelf)
        });
    });

    return groups;
};

const getRelationshipsForMember = (userId, memberId) => {
    return db.all(`
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
    `, [memberId, memberId, userId, memberId, memberId]);
};

const getTreeForUser = async (user) => {
    const selfMember = await db.get(
        'SELECT * FROM family_members WHERE id = ? AND user_id = ?',
        [user.self_member_id, user.id]
    );

    const relationships = selfMember
        ? await getRelationshipsForMember(user.id, selfMember.id)
        : [];

    return {
        selfMember,
        treeGroups: buildTreeGroups(relationships, user.self_member_id)
    };
};

module.exports = {
    buildTreeGroups,
    getRelationshipsForMember,
    getTreeForUser
};
