package org.ntrloc.graph.db.partition.security;

import org.junit.jupiter.api.Test;
import org.ntrloc.graph.AbstractIntegrationTest;
import org.ntrloc.graph.db.partition.authorization.DefaultGroupInitializer;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Covers GroupAdminController's group CRUD and membership endpoints. Reuses
// AuthorizationTestDataInitializer's standing fixture (root=superuser, alice=non-admin) for
// admin-check tests -- see AccessAdminControllerIntegrationTest's own comment on why that's safe
// to read without risking cross-test contamination. Every created group/user below gets a
// UUID-suffixed name/externalId, so nothing here collides with that fixture or with other test
// methods sharing the same singleton Postgres container (see AbstractIntegrationTest's own
// comment).
class GroupAdminControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private SecurityRepository securityRepo;

    @Autowired
    private DefaultGroupInitializer defaultGroupInitializer;

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getAsRoot(String uri) {
        return (List<Map<String, Object>>) (List<?>) webTestClient.get().uri(uri)
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Map.class)
                .returnResult()
                .getResponseBody();
    }

    // --- List ---

    @Test
    void listGroups_asAdmin_includesMemberCounts() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var member = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addUserToGroup(member.id(), group.id());

        List<Map<String, Object>> groups = getAsRoot("/api/admin/groups");

        assertThat(groups).filteredOn(g -> g.get("id").equals(group.id().toString()))
                .extracting(g -> g.get("memberCount")).containsExactly(1);
    }

    @Test
    void listGroups_asNonAdmin_isForbidden() {
        webTestClient.get().uri("/api/admin/groups")
                .header("X-Ntrloc-User", "alice")
                .exchange()
                .expectStatus().isForbidden();
    }

    // --- Create ---

    @Test
    void createGroup_asAdmin_createsIt() {
        String name = "group-" + UUID.randomUUID();

        webTestClient.post().uri("/api/admin/groups")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", name, "parentGroupId", defaultGroupInitializer.getDefaultGroupId()))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo(name)
                .jsonPath("$.memberCount").isEqualTo(0);

        assertThat(securityRepo.findGroupByName(name)).isPresent();
    }

    @Test
    void createGroup_withABlankName_returnsBadRequest() {
        webTestClient.post().uri("/api/admin/groups")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", "   "))
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void createGroup_withANameThatAlreadyExists_returnsConflict() {
        String name = "group-" + UUID.randomUUID();
        securityRepo.createGroup(name);

        webTestClient.post().uri("/api/admin/groups")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", name, "parentGroupId", defaultGroupInitializer.getDefaultGroupId()))
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.CONFLICT);
    }

    // --- Update ---

    @Test
    void updateGroup_asAdmin_persistsTheNewName() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        String newName = "renamed-" + UUID.randomUUID();

        webTestClient.put().uri("/api/admin/groups/" + group.id())
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", newName))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo(newName);

        assertThat(securityRepo.findGroupById(group.id())).isPresent().get()
                .satisfies(g -> assertThat(g.name()).isEqualTo(newName));
    }

    @Test
    void updateGroup_forAnUnknownGroup_returnsNotFound() {
        webTestClient.put().uri("/api/admin/groups/" + UUID.randomUUID())
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", "new-name"))
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void updateGroup_withABlankName_returnsBadRequest() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        webTestClient.put().uri("/api/admin/groups/" + group.id())
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", ""))
                .exchange()
                .expectStatus().isBadRequest();
    }

    // --- Delete ---

    @Test
    void deleteGroup_asAdmin_removesIt() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());

        webTestClient.delete().uri("/api/admin/groups/" + group.id())
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isNoContent();

        assertThat(securityRepo.findGroupById(group.id())).isEmpty();
    }

    @Test
    void deleteGroup_forAnUnknownGroup_returnsNotFound() {
        webTestClient.delete().uri("/api/admin/groups/" + UUID.randomUUID())
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void deleteGroup_forTheDefaultGroup_isForbidden() {
        UUID defaultGroupId = defaultGroupInitializer.getDefaultGroupId();

        webTestClient.delete().uri("/api/admin/groups/" + defaultGroupId)
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isForbidden();
    }

    // --- Members ---

    @Test
    void listMembers_asAdmin_returnsEveryMember() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var member = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addUserToGroup(member.id(), group.id());

        List<Map<String, Object>> members = getAsRoot("/api/admin/groups/" + group.id() + "/members");

        assertThat(members).extracting(m -> m.get("id")).containsExactly(member.id().toString());
    }

    @Test
    void listMembers_forAnUnknownGroup_returnsNotFound() {
        webTestClient.get().uri("/api/admin/groups/" + UUID.randomUUID() + "/members")
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void addMember_asAdmin_addsTheUserToTheGroup() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "New Member", null, false);

        webTestClient.post().uri("/api/admin/groups/" + group.id() + "/members")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("userId", user.id().toString()))
                .exchange()
                .expectStatus().isNoContent();

        assertThat(securityRepo.getGroupIdsForUser(user.id())).contains(group.id());
    }

    @Test
    void addMember_forAnUnknownGroup_returnsNotFound() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "New Member", null, false);

        webTestClient.post().uri("/api/admin/groups/" + UUID.randomUUID() + "/members")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("userId", user.id().toString()))
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void removeMember_asAdmin_removesTheUserFromTheGroup() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);
        securityRepo.addUserToGroup(user.id(), group.id());

        webTestClient.delete().uri("/api/admin/groups/" + group.id() + "/members/" + user.id())
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isNoContent();

        assertThat(securityRepo.getGroupIdsForUser(user.id())).doesNotContain(group.id());
    }

    @Test
    void removeMember_asNonAdmin_isForbidden() {
        var group = securityRepo.createGroup("group-" + UUID.randomUUID());
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Member", null, false);

        webTestClient.delete().uri("/api/admin/groups/" + group.id() + "/members/" + user.id())
                .header("X-Ntrloc-User", "alice")
                .exchange()
                .expectStatus().isForbidden();
    }
}
