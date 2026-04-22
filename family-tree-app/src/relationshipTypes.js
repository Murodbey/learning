const relationshipTypes = [
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'grandparent', label: 'Grandparent' },
    { value: 'grandchild', label: 'Grandchild' },
    { value: 'aunt_uncle', label: 'Aunt / Uncle' },
    { value: 'niece_nephew', label: 'Niece / Nephew' },
    { value: 'cousin', label: 'Cousin' },
    { value: 'in_law', label: 'In-Law' }
];

const genderOptions = [
    { value: '', label: 'Prefer not to say' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'nonbinary', label: 'Non-binary' }
];

const relationshipTypeValues = relationshipTypes.map((type) => type.value);

const inverseRelationship = (relationshipType) => {
    const inverses = {
        parent: 'child',
        child: 'parent',
        grandparent: 'grandchild',
        grandchild: 'grandparent',
        aunt_uncle: 'niece_nephew',
        niece_nephew: 'aunt_uncle',
        cousin: 'cousin',
        in_law: 'in_law',
        spouse: 'spouse',
        sibling: 'sibling'
    };

    return inverses[relationshipType] || relationshipType;
};

const canonicalizeRelationship = (memberId1, memberId2, relationshipType) => {
    const firstId = Number(memberId1);
    const secondId = Number(memberId2);

    if (!Number.isInteger(firstId) || !Number.isInteger(secondId)) {
        throw new Error('Relationship member IDs must be integers.');
    }

    if (firstId === secondId) {
        throw new Error('A relationship requires two different family members.');
    }

    if (firstId < secondId) {
        return {
            member_id_1: firstId,
            member_id_2: secondId,
            relationship_type: relationshipType
        };
    }

    return {
        member_id_1: secondId,
        member_id_2: firstId,
        relationship_type: inverseRelationship(relationshipType)
    };
};

const relationshipLabel = (relationshipType, gender = '') => {
    const genderedLabels = {
        parent: {
            female: 'Mother',
            male: 'Father',
            nonbinary: 'Parent'
        },
        child: {
            female: 'Daughter',
            male: 'Son',
            nonbinary: 'Child'
        },
        spouse: {
            female: 'Wife',
            male: 'Husband',
            nonbinary: 'Spouse'
        },
        sibling: {
            female: 'Sister',
            male: 'Brother',
            nonbinary: 'Sibling'
        },
        grandparent: {
            female: 'Grandmother',
            male: 'Grandfather',
            nonbinary: 'Grandparent'
        },
        grandchild: {
            female: 'Granddaughter',
            male: 'Grandson',
            nonbinary: 'Grandchild'
        },
        aunt_uncle: {
            female: 'Aunt',
            male: 'Uncle',
            nonbinary: 'Aunt / Uncle'
        },
        niece_nephew: {
            female: 'Niece',
            male: 'Nephew',
            nonbinary: 'Niece / Nephew'
        },
        in_law: {
            female: 'Sister-in-law',
            male: 'Brother-in-law',
            nonbinary: 'In-Law'
        }
    };

    const gendered = genderedLabels[relationshipType];
    if (gendered && gendered[gender]) {
        return gendered[gender];
    }

    const found = relationshipTypes.find((type) => type.value === relationshipType);
    return found ? found.label : relationshipType;
};

module.exports = {
    relationshipTypes,
    genderOptions,
    relationshipTypeValues,
    canonicalizeRelationship,
    inverseRelationship,
    relationshipLabel
};
