const relationshipTypes = [
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'grandparent', label: 'Grandparent' },
    { value: 'grandchild', label: 'Grandchild' },
    { value: 'aunt_uncle', label: 'Aunt / Uncle' },
    { value: 'niece_nephew', label: 'Niece / Nephew' },
    { value: 'cousin', label: 'Cousin' }
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
        spouse: 'spouse',
        sibling: 'sibling'
    };

    return inverses[relationshipType] || relationshipType;
};

const relationshipLabel = (relationshipType) => {
    const found = relationshipTypes.find((type) => type.value === relationshipType);
    return found ? found.label : relationshipType;
};

module.exports = {
    relationshipTypes,
    relationshipTypeValues,
    inverseRelationship,
    relationshipLabel
};
