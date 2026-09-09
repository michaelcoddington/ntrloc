package org.ntrloc.graph.db.partition.security.repository;

import org.junit.jupiter.api.Test;
import org.ntrloc.graph.AbstractIntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Covers SecurityRepository's admin-facing listing/update/delete methods -- the ones
// AuthorizationTestDataInitializer/AccessAdminControllerIntegrationTest's fixture setup never
// exercises, since that only ever creates users/groups and reads them back, never lists, updates,
// or deletes. security_user/security_group are shared tables, so every test here gives its own
// rows a UUID-suffixed externalId/name/email and filters on that, never a shared literal.
class SecurityRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private SecurityRepository securityRepo;

    // --- Users ---

    @Test
    void listUsers_includesCreatedUsers() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Display Name", null, false);

        assertThat(securityRepo.listUsers()).contains(user);
    }

    @Test
    void updateUser_persistsChanges() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Original Name", "original@example.com", false);

        securityRepo.updateUser(user.id(), user.externalId(), "Updated Name", "updated@example.com", true);

        var reloaded = securityRepo.findUserByExternalId(user.externalId()).orElseThrow();
        assertThat(reloaded.displayName()).isEqualTo("Updated Name");
        assertThat(reloaded.email()).isEqualTo("updated@example.com");
        assertThat(reloaded.isSuperuser()).isTrue();
    }

    // --- Groups ---

    @Test
    void listGroups_includesCreatedGroups() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        assertThat(securityRepo.listGroups()).contains(group);
    }

    @Test
    void updateGroup_persistsNewName() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        securityRepo.updateGroup(group.id(), "renamed-" + UUID.randomUUID());

        assertThat(securityRepo.findGroupById(group.id())).isPresent().get()
                .satisfies(g -> assertThat(g.name()).startsWith("renamed-"));
    }

    @Test
    void deleteGroup_removesIt() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        securityRepo.deleteGroup(group.id());

        assertThat(securityRepo.findGroupById(group.id())).isEmpty();
    }

    @Test
    void listGroupMembers_returnsOnlyMembersOfThatGroup() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var member = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        var nonMember = securityRepo.createUser("user-" + UUID.randomUUID(), "Non-Member", null, false);
        securityRepo.addUserToGroup(member.id(), group.id());

        assertThat(securityRepo.listGroupMembers(group.id()))
                .extracting(SecurityRepository.UserRow::id)
                .contains(member.id())
                .doesNotContain(nonMember.id());
    }

    @Test
    void removeUserFromGroup_removesMembership() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addUserToGroup(user.id(), group.id());

        securityRepo.removeUserFromGroup(user.id(), group.id());

        assertThat(securityRepo.getGroupIdsForUser(user.id())).doesNotContain(group.id());
    }

    // --- Group nesting ---

    @Test
    void getGroupIdsForUser_includesGroupsTransitivelyContainingTheUsersDirectGroup() {
        var outer = securityRepo.createGroup("outer-" + UUID.randomUUID());
        var inner = securityRepo.createGroup("inner-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addGroupToGroup(inner.id(), outer.id());
        securityRepo.addUserToGroup(user.id(), inner.id());

        assertThat(securityRepo.getGroupIdsForUser(user.id())).contains(inner.id(), outer.id());
    }

    @Test
    void getGroupIdsForUser_resolvesMultipleLevelsOfNesting() {
        var grandparent = securityRepo.createGroup("grandparent-" + UUID.randomUUID());
        var parent = securityRepo.createGroup("parent-" + UUID.randomUUID());
        var child = securityRepo.createGroup("child-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addGroupToGroup(parent.id(), grandparent.id());
        securityRepo.addGroupToGroup(child.id(), parent.id());
        securityRepo.addUserToGroup(user.id(), child.id());

        assertThat(securityRepo.getGroupIdsForUser(user.id())).contains(child.id(), parent.id(), grandparent.id());
    }

    @Test
    void addGroupToGroup_rejectsSelfMembership() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        assertThatThrownBy(() -> securityRepo.addGroupToGroup(group.id(), group.id()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void addGroupToGroup_rejectsACycle() {
        var a = securityRepo.createGroup("a-" + UUID.randomUUID());
        var b = securityRepo.createGroup("b-" + UUID.randomUUID());
        securityRepo.addGroupToGroup(a.id(), b.id()); // a is a member of b

        assertThatThrownBy(() -> securityRepo.addGroupToGroup(b.id(), a.id())) // b member of a would close the loop
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void addGroupToGroup_rejectsAMultiLevelCycle() {
        var a = securityRepo.createGroup("a-" + UUID.randomUUID());
        var b = securityRepo.createGroup("b-" + UUID.randomUUID());
        var c = securityRepo.createGroup("c-" + UUID.randomUUID());
        securityRepo.addGroupToGroup(a.id(), b.id()); // a member of b
        securityRepo.addGroupToGroup(b.id(), c.id()); // b member of c, so a is transitively a member of c

        assertThatThrownBy(() -> securityRepo.addGroupToGroup(c.id(), a.id())) // c member of a would close a->b->c->a
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void listMemberGroups_returnsOnlyDirectChildren() {
        var outer = securityRepo.createGroup("outer-" + UUID.randomUUID());
        var inner = securityRepo.createGroup("inner-" + UUID.randomUUID());
        var innermost = securityRepo.createGroup("innermost-" + UUID.randomUUID());
        securityRepo.addGroupToGroup(inner.id(), outer.id());
        securityRepo.addGroupToGroup(innermost.id(), inner.id());

        // innermost is a transitive, not direct, member of outer -- must not appear here.
        assertThat(securityRepo.listMemberGroups(outer.id())).containsExactly(inner);
    }

    @Test
    void listContainingGroups_returnsOnlyDirectParents() {
        var outer = securityRepo.createGroup("outer-" + UUID.randomUUID());
        var inner = securityRepo.createGroup("inner-" + UUID.randomUUID());
        securityRepo.addGroupToGroup(inner.id(), outer.id());

        assertThat(securityRepo.listContainingGroups(inner.id())).containsExactly(outer);
    }

    @Test
    void removeGroupFromGroup_removesTransitiveMembershipEffect() {
        var outer = securityRepo.createGroup("outer-" + UUID.randomUUID());
        var inner = securityRepo.createGroup("inner-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addGroupToGroup(inner.id(), outer.id());
        securityRepo.addUserToGroup(user.id(), inner.id());

        securityRepo.removeGroupFromGroup(inner.id(), outer.id());

        assertThat(securityRepo.getGroupIdsForUser(user.id())).contains(inner.id()).doesNotContain(outer.id());
    }

    // --- Local credentials ---

    @Test
    void createLocalCredentials_thenFindCredentialsByEmail_returnsThem() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Local User", null, false);
        String email = "local-" + UUID.randomUUID() + "@example.com";

        securityRepo.createLocalCredentials(user.id(), email, "hashed-password", "USER");

        var credentials = securityRepo.findCredentialsByEmail(email).orElseThrow();
        assertThat(credentials.userId()).isEqualTo(user.id());
        assertThat(credentials.passwordHash()).isEqualTo("hashed-password");
        assertThat(credentials.role()).isEqualTo("USER");
    }

    @Test
    void findCredentialsByEmail_forUnknownEmail_returnsEmpty() {
        assertThat(securityRepo.findCredentialsByEmail("nobody-" + UUID.randomUUID() + "@example.com")).isEmpty();
    }

    @Test
    void updatePasswordHash_persistsChange() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Local User", null, false);
        String email = "local-" + UUID.randomUUID() + "@example.com";
        securityRepo.createLocalCredentials(user.id(), email, "old-hash", "USER");

        securityRepo.updatePasswordHash(user.id(), "new-hash");

        assertThat(securityRepo.findCredentialsByEmail(email).orElseThrow().passwordHash()).isEqualTo("new-hash");
    }

    @Test
    void updateLocalCredentialsRole_persistsChange() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Local User", null, false);
        String email = "local-" + UUID.randomUUID() + "@example.com";
        securityRepo.createLocalCredentials(user.id(), email, "hash", "USER");

        securityRepo.updateLocalCredentialsRole(user.id(), "ADMIN");

        assertThat(securityRepo.findCredentialsByEmail(email).orElseThrow().role()).isEqualTo("ADMIN");
    }

    // --- Personal access tokens ---

    @Test
    void listTokensForUser_returnsOnlyThatUsersTokens() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Token User", null, false);
        var otherUser = securityRepo.createUser("user-" + UUID.randomUUID(), "Other User", null, false);
        UUID tokenId = securityRepo.createPersonalAccessToken(user.id(), "token-hash-" + UUID.randomUUID(), "My Token", null);
        securityRepo.createPersonalAccessToken(otherUser.id(), "token-hash-" + UUID.randomUUID(), "Other Token", OffsetDateTime.now().plusDays(1));

        assertThat(securityRepo.listTokensForUser(user.id()))
                .extracting(SecurityRepository.PersonalAccessTokenRow::id)
                .containsExactly(tokenId);
    }
}
