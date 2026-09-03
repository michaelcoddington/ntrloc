-- A group can itself be a member of another group -- member_group_id is a member of group_id,
-- exactly the same shape as security_group_member's user_id being a member of group_id. A separate
-- table rather than making security_group_member's user_id polymorphic (accepting either a user or
-- a group id): ntrloc already has one polymorphic-reference wart (schema_entity_link_perspective.
-- entity_id, needed its own cross-table validation once schema_entity was dropped) and it's not a
-- pattern worth repeating here -- two real FKs beat one loose one.
--
-- Self-membership is rejected by the CHECK below; deeper cycles (A member of B member of A) are
-- rejected at the application layer (SecurityRepository.addGroupToGroup), not here -- a CHECK
-- constraint can't express "no path already exists back to this row."
CREATE TABLE security_group_member_group (
    member_group_id UUID NOT NULL REFERENCES security_group(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES security_group(id) ON DELETE CASCADE,
    PRIMARY KEY (member_group_id, group_id),
    CHECK (member_group_id != group_id)
);
