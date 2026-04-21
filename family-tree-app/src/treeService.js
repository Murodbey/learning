const db = require('./database');
const { inverseRelationship, relationshipLabel } = require('./relationshipTypes');

const toTypeFromPerspective = (relationship, perspectiveMemberId) => {
    const relatedIsFirst = Number(relationship.member_id_1) !== Number(perspectiveMemberId);
    return relatedIsFirst
        ? relationship.relationship_type
        : inverseRelationship(relationship.relationship_type);
};

const createPersonCard = (member, displayType = '', overrideLabel = '') => {
    if (!member) {
        return null;
    }

    return {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        gender: member.gender || '',
        current_location: member.current_location || '',
        relationshipLabel: overrideLabel || (displayType ? relationshipLabel(displayType, member.gender || '') : '')
    };
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
            related.last_name AS related_last_name,
            related.gender AS related_gender
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

const getAllRelationshipsForUser = (userId) => {
    return db.all(`
        SELECT id, user_id, member_id_1, member_id_2, relationship_type, created_at
        FROM relationships
        WHERE user_id = ?
        ORDER BY created_at, id
    `, [userId]);
};

const uniqueIds = (ids) => Array.from(new Set(ids.map((id) => Number(id))));

const buildAdjacency = (relationships) => {
    const adjacency = new Map();

    relationships.forEach((relationship) => {
        const memberOne = Number(relationship.member_id_1);
        const memberTwo = Number(relationship.member_id_2);

        if (!adjacency.has(memberOne)) {
            adjacency.set(memberOne, []);
        }
        if (!adjacency.has(memberTwo)) {
            adjacency.set(memberTwo, []);
        }

        adjacency.get(memberOne).push(relationship);
        adjacency.get(memberTwo).push(relationship);
    });

    return adjacency;
};

const getNeighborIdsByType = (adjacency, memberId, type) => {
    return uniqueIds(
        (adjacency.get(Number(memberId)) || [])
            .filter((relationship) => toTypeFromPerspective(relationship, memberId) === type)
            .map((relationship) => (
                Number(relationship.member_id_1) === Number(memberId)
                    ? relationship.member_id_2
                    : relationship.member_id_1
            ))
    );
};

const buildBranch = ({
    memberId,
    relationType,
    selfMemberId,
    membersById,
    adjacency
}) => {
    const member = membersById.get(Number(memberId));
    if (!member) {
        return null;
    }

    const spouses = getNeighborIdsByType(adjacency, memberId, 'spouse')
        .filter((id) => Number(id) !== Number(selfMemberId))
        .map((id) => createPersonCard(membersById.get(id), 'spouse'));

    let childLabelType = '';
    let overrideChildLabel = '';

    if (relationType === 'parent') {
        childLabelType = 'sibling';
    } else if (relationType === 'sibling') {
        childLabelType = 'niece_nephew';
    } else if (relationType === 'child') {
        childLabelType = 'grandchild';
    } else if (relationType === 'aunt_uncle') {
        childLabelType = 'cousin';
    } else if (relationType === 'self') {
        childLabelType = 'child';
    }

    const children = getNeighborIdsByType(adjacency, memberId, 'child')
        .map((id) => {
            const childMember = membersById.get(id);
            if (!childMember) {
                return null;
            }

            if (relationType === 'parent' && Number(id) === Number(selfMemberId)) {
                overrideChildLabel = 'Me';
                return createPersonCard(childMember, '', overrideChildLabel);
            }

            return createPersonCard(childMember, childLabelType);
        })
        .filter(Boolean);

    return {
        primary: createPersonCard(member, relationType),
        spouses,
        children
    };
};

const getTreeForUser = async (user) => {
    const members = await db.all(
        'SELECT * FROM family_members WHERE user_id = ? ORDER BY last_name, first_name',
        [user.id]
    );
    const membersById = new Map(members.map((member) => [Number(member.id), member]));
    const selfMember = membersById.get(Number(user.self_member_id)) || null;

    if (!selfMember) {
        return {
            selfMember: null,
            tree: {
                self: null,
                grandparents: [],
                parents: [],
                siblings: [],
                children: [],
                auntUncles: []
            }
        };
    }

    const allRelationships = await getAllRelationshipsForUser(user.id);
    const adjacency = buildAdjacency(allRelationships);

    const directIdsByType = {
        grandparent: getNeighborIdsByType(adjacency, selfMember.id, 'grandparent'),
        parent: getNeighborIdsByType(adjacency, selfMember.id, 'parent'),
        sibling: getNeighborIdsByType(adjacency, selfMember.id, 'sibling'),
        child: getNeighborIdsByType(adjacency, selfMember.id, 'child'),
        aunt_uncle: getNeighborIdsByType(adjacency, selfMember.id, 'aunt_uncle')
    };

    const inferredAuntUncles = directIdsByType.parent.flatMap((parentId) =>
        getNeighborIdsByType(adjacency, parentId, 'sibling').filter((id) => Number(id) !== Number(selfMember.id))
    );

    const auntUncleIds = uniqueIds([...directIdsByType.aunt_uncle, ...inferredAuntUncles]);

    const branchFactory = (relationType) => (memberId) => buildBranch({
        memberId,
        relationType,
        selfMemberId: selfMember.id,
        membersById,
        adjacency
    });

    return {
        selfMember,
        tree: {
            self: buildBranch({
                memberId: selfMember.id,
                relationType: 'self',
                selfMemberId: selfMember.id,
                membersById,
                adjacency
            }),
            grandparents: directIdsByType.grandparent.map(branchFactory('grandparent')).filter(Boolean),
            parents: directIdsByType.parent.map(branchFactory('parent')).filter(Boolean),
            siblings: directIdsByType.sibling.map(branchFactory('sibling')).filter(Boolean),
            children: directIdsByType.child.map(branchFactory('child')).filter(Boolean),
            auntUncles: auntUncleIds.map(branchFactory('aunt_uncle')).filter(Boolean)
        }
    };
};

module.exports = {
    getRelationshipsForMember,
    getTreeForUser
};
