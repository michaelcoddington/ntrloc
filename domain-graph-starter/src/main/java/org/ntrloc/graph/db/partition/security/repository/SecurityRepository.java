package org.ntrloc.graph.db.partition.security.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Component
public class SecurityRepository {

    private static final String COL_EXTERNAL_ID = "external_id";
    private static final String COL_DISPLAY_NAME = "display_name";
    private static final String COL_EMAIL = "email";
    private static final String COL_IS_SUPERUSER = "is_superuser";
    private static final String PARAM_USER_ID = "userId";
    private static final String PARAM_GROUP_ID = "groupId";

    public record UserRow(UUID id, String externalId, String displayName, String email, boolean isSuperuser) {}

    public record GroupRow(UUID id, String name) {}

    public record LocalCredentialsRow(UUID userId, String email, String passwordHash, String role, boolean active) {}

    public record PersonalAccessTokenRow(UUID id, UUID userId, String name, OffsetDateTime createdAt, OffsetDateTime expiresAt) {}

    private final JdbcClient jdbcClient;

    public SecurityRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    // --- Principal resolution reads ---

    public Optional<UserRow> findUserByExternalId(String externalId) {
        return jdbcClient.sql("SELECT id, external_id, display_name, email, is_superuser FROM security_user WHERE external_id = :externalId")
                .param("externalId", externalId)
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        rs.getString(COL_EXTERNAL_ID),
                        rs.getString(COL_DISPLAY_NAME),
                        rs.getString(COL_EMAIL),
                        rs.getBoolean(COL_IS_SUPERUSER)))
                .optional();
    }

    // Used by UserAdminController to populate assignee pickers (e.g. a User Task's assignee
    // select in the process editor) -- not part of principal resolution, just a plain listing.
    public List<UserRow> listUsers() {
        return jdbcClient.sql("SELECT id, external_id, display_name, email, is_superuser FROM security_user ORDER BY display_name")
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        rs.getString(COL_EXTERNAL_ID),
                        rs.getString(COL_DISPLAY_NAME),
                        rs.getString(COL_EMAIL),
                        rs.getBoolean(COL_IS_SUPERUSER)))
                .list();
    }

    // Transitive: a user's effective groups are their direct groups, plus every group any of those
    // groups is itself (transitively) a member of via security_group_member_group. Everything
    // downstream (AuthorizationCacheManager.effectiveSet/effectiveNestedSet, RequestPermissionContext)
    // already unions grants over whatever this returns, so nothing above this method needs to know
    // nesting exists at all -- the closure has to be complete by the time it leaves here.
    public Set<UUID> getGroupIdsForUser(UUID userId) {
        return Set.copyOf(jdbcClient.sql("""
                WITH RECURSIVE effective_groups(group_id) AS (
                    SELECT group_id FROM security_group_member WHERE user_id = :userId
                    UNION
                    SELECT smg.group_id
                    FROM security_group_member_group smg
                    JOIN effective_groups eg ON smg.member_group_id = eg.group_id
                )
                SELECT group_id FROM effective_groups
                """)
                .param(PARAM_USER_ID, userId)
                .query((rs, n) -> rs.getObject("group_id", UUID.class))
                .list());
    }

    public List<GroupRow> getGroupsForUser(UUID userId) {
        return jdbcClient.sql("""
                SELECT g.id, g.name FROM security_group g
                JOIN security_group_member gm ON gm.group_id = g.id
                WHERE gm.user_id = :userId ORDER BY g.name
                """)
                .param(PARAM_USER_ID, userId)
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .list();
    }

    // --- Test-data seeding writes ---

    public UserRow createUser(String externalId, String displayName, String email, boolean isSuperuser) {
        UUID id = jdbcClient.sql("""
                INSERT INTO security_user (external_id, display_name, email, is_superuser)
                VALUES (:externalId, :displayName, :email, :isSuperuser) RETURNING id
                """)
                .param("externalId", externalId).param("displayName", displayName)
                .param(COL_EMAIL, email).param("isSuperuser", isSuperuser)
                .query(UUID.class).single();
        return new UserRow(id, externalId, displayName, email, isSuperuser);
    }

    public GroupRow createGroup(String name) {
        UUID id = jdbcClient.sql("INSERT INTO security_group (name) VALUES (:name) RETURNING id")
                .param("name", name)
                .query(UUID.class).single();
        return new GroupRow(id, name);
    }

    public void addUserToGroup(UUID userId, UUID groupId) {
        jdbcClient.sql("INSERT INTO security_group_member (user_id, group_id) VALUES (:userId, :groupId) ON CONFLICT DO NOTHING")
                .param(PARAM_USER_ID, userId).param(PARAM_GROUP_ID, groupId).update();
    }

    // memberGroupId becomes a member of groupId (same direction as addUserToGroup: member, then
    // container). Self-membership is caught by the table's own CHECK; a deeper cycle (groupId
    // already transitively a member of memberGroupId) has no equivalent constraint, so it's checked
    // here before the insert.
    public void addGroupToGroup(UUID memberGroupId, UUID groupId) {
        if (memberGroupId.equals(groupId)) {
            throw new IllegalArgumentException("A group cannot be a member of itself");
        }
        if (isTransitiveMemberOf(groupId, memberGroupId)) {
            throw new IllegalArgumentException("Adding this membership would create a cycle");
        }
        jdbcClient.sql("INSERT INTO security_group_member_group (member_group_id, group_id) VALUES (:memberGroupId, :groupId) ON CONFLICT DO NOTHING")
                .param("memberGroupId", memberGroupId).param(PARAM_GROUP_ID, groupId).update();
    }

    // True iff candidateMemberId is already (directly or transitively) a member of ofGroupId --
    // i.e. whether groupId already appears somewhere in candidateMemberId's own membership chain.
    // Used as the cycle guard for addGroupToGroup: adding "ofGroupId member of candidateMemberId"
    // when this already holds true would close a loop.
    private boolean isTransitiveMemberOf(UUID candidateMemberId, UUID ofGroupId) {
        return Boolean.TRUE.equals(jdbcClient.sql("""
                WITH RECURSIVE ancestors(group_id) AS (
                    SELECT group_id FROM security_group_member_group WHERE member_group_id = :candidateMemberId
                    UNION
                    SELECT smg.group_id
                    FROM security_group_member_group smg
                    JOIN ancestors a ON smg.member_group_id = a.group_id
                )
                SELECT EXISTS (SELECT 1 FROM ancestors WHERE group_id = :ofGroupId)
                """)
                .param("candidateMemberId", candidateMemberId).param("ofGroupId", ofGroupId)
                .query(Boolean.class).single());
    }

    public void removeGroupFromGroup(UUID memberGroupId, UUID groupId) {
        jdbcClient.sql("DELETE FROM security_group_member_group WHERE member_group_id = :memberGroupId AND group_id = :groupId")
                .param("memberGroupId", memberGroupId).param(PARAM_GROUP_ID, groupId).update();
    }

    // Direct (non-transitive) child groups -- groups that are themselves members of groupId.
    public List<GroupRow> listMemberGroups(UUID groupId) {
        return jdbcClient.sql("""
                SELECT g.id, g.name FROM security_group g
                JOIN security_group_member_group smg ON smg.member_group_id = g.id
                WHERE smg.group_id = :groupId ORDER BY g.name
                """)
                .param(PARAM_GROUP_ID, groupId)
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .list();
    }

    // Direct (non-transitive) parent groups -- groups that groupId is itself a member of.
    public List<GroupRow> listContainingGroups(UUID groupId) {
        return jdbcClient.sql("""
                SELECT g.id, g.name FROM security_group g
                JOIN security_group_member_group smg ON smg.group_id = g.id
                WHERE smg.member_group_id = :groupId ORDER BY g.name
                """)
                .param(PARAM_GROUP_ID, groupId)
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .list();
    }

    public List<GroupRow> listGroups() {
        return jdbcClient.sql("SELECT id, name FROM security_group ORDER BY name")
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .list();
    }

    public Optional<GroupRow> findGroupById(UUID groupId) {
        return jdbcClient.sql("SELECT id, name FROM security_group WHERE id = :id")
                .param("id", groupId)
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .optional();
    }

    public GroupRow updateGroup(UUID groupId, String name) {
        jdbcClient.sql("UPDATE security_group SET name = :name WHERE id = :id")
                .param("name", name).param("id", groupId).update();
        return new GroupRow(groupId, name);
    }

    public void deleteGroup(UUID groupId) {
        jdbcClient.sql("DELETE FROM security_group WHERE id = :id")
                .param("id", groupId).update();
    }

    public List<UserRow> listGroupMembers(UUID groupId) {
        return jdbcClient.sql("""
                SELECT u.id, u.external_id, u.display_name, u.email, u.is_superuser
                FROM security_user u
                JOIN security_group_member gm ON gm.user_id = u.id
                WHERE gm.group_id = :groupId
                ORDER BY u.display_name
                """)
                .param(PARAM_GROUP_ID, groupId)
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        rs.getString(COL_EXTERNAL_ID),
                        rs.getString(COL_DISPLAY_NAME),
                        rs.getString(COL_EMAIL),
                        rs.getBoolean(COL_IS_SUPERUSER)))
                .list();
    }

    public void removeUserFromGroup(UUID userId, UUID groupId) {
        jdbcClient.sql("DELETE FROM security_group_member WHERE user_id = :userId AND group_id = :groupId")
                .param(PARAM_USER_ID, userId).param(PARAM_GROUP_ID, groupId).update();
    }

    public Optional<GroupRow> findGroupByName(String name) {
        return jdbcClient.sql("SELECT id, name FROM security_group WHERE name = :name")
                .param("name", name)
                .query((rs, n) -> new GroupRow(rs.getObject("id", UUID.class), rs.getString("name")))
                .optional();
    }

    // --- Local credentials ---

    public void createLocalCredentials(UUID userId, String email, String passwordHash, String role) {
        jdbcClient.sql("""
                INSERT INTO security_local_credentials (user_id, email, password_hash, role)
                VALUES (:userId, :email, :passwordHash, :role)
                """)
                .param(PARAM_USER_ID, userId).param(COL_EMAIL, email)
                .param("passwordHash", passwordHash).param("role", role)
                .update();
    }

    public void updatePasswordHash(UUID userId, String newPasswordHash) {
        jdbcClient.sql("UPDATE security_local_credentials SET password_hash = :hash WHERE user_id = :userId")
                .param("hash", newPasswordHash)
                .param(PARAM_USER_ID, userId)
                .update();
    }

    public void updateUser(UUID userId, String displayName, String email, boolean isSuperuser) {
        jdbcClient.sql("UPDATE security_user SET display_name = :displayName, email = :email, is_superuser = :isSuperuser WHERE id = :userId")
                .param("displayName", displayName)
                .param(COL_EMAIL, email)
                .param("isSuperuser", isSuperuser)
                .param(PARAM_USER_ID, userId)
                .update();
    }

    public void updateLocalCredentialsRole(UUID userId, String role) {
        jdbcClient.sql("UPDATE security_local_credentials SET role = :role WHERE user_id = :userId")
                .param("role", role)
                .param(PARAM_USER_ID, userId)
                .update();
    }

    public Optional<LocalCredentialsRow> findCredentialsByEmail(String email) {
        return jdbcClient.sql("""
                SELECT user_id, email, password_hash, role, active
                FROM security_local_credentials WHERE email = :email
                """)
                .param(COL_EMAIL, email)
                .query((rs, n) -> new LocalCredentialsRow(
                        rs.getObject("user_id", UUID.class),
                        rs.getString(COL_EMAIL),
                        rs.getString("password_hash"),
                        rs.getString("role"),
                        rs.getBoolean("active")))
                .optional();
    }

    // --- Personal access tokens ---

    public UUID createPersonalAccessToken(UUID userId, String tokenHash, String name, OffsetDateTime expiresAt) {
        return jdbcClient.sql("""
                INSERT INTO security_personal_access_token (user_id, token_hash, name, expires_at)
                VALUES (:userId, :tokenHash, :name, :expiresAt) RETURNING id
                """)
                .param(PARAM_USER_ID, userId).param("tokenHash", tokenHash)
                .param("name", name).param("expiresAt", expiresAt)
                .query(UUID.class).single();
    }

    public Optional<UserRow> findUserByValidTokenHash(String tokenHash) {
        return jdbcClient.sql("""
                SELECT u.id, u.external_id, u.display_name, u.email, u.is_superuser
                FROM security_user u
                JOIN security_personal_access_token t ON t.user_id = u.id
                WHERE t.token_hash = :tokenHash
                  AND (t.expires_at IS NULL OR t.expires_at > NOW())
                """)
                .param("tokenHash", tokenHash)
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        rs.getString(COL_EXTERNAL_ID),
                        rs.getString(COL_DISPLAY_NAME),
                        rs.getString(COL_EMAIL),
                        rs.getBoolean(COL_IS_SUPERUSER)))
                .optional();
    }

    public List<PersonalAccessTokenRow> listTokensForUser(UUID userId) {
        return jdbcClient.sql("""
                SELECT id, user_id, name, created_at, expires_at
                FROM security_personal_access_token WHERE user_id = :userId
                ORDER BY created_at DESC
                """)
                .param(PARAM_USER_ID, userId)
                .query((rs, n) -> new PersonalAccessTokenRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getString("name"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("expires_at", OffsetDateTime.class)))
                .list();
    }

    public void revokeToken(UUID tokenId, UUID userId) {
        jdbcClient.sql("DELETE FROM security_personal_access_token WHERE id = :tokenId AND user_id = :userId")
                .param("tokenId", tokenId).param(PARAM_USER_ID, userId)
                .update();
    }
}
