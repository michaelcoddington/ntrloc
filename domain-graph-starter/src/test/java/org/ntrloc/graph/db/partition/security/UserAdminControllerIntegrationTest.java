package org.ntrloc.graph.db.partition.security;

import org.junit.jupiter.api.Test;
import org.ntrloc.graph.AbstractIntegrationTest;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Covers UserAdminController's user CRUD and personal-access-token endpoints. Reuses
// AuthorizationTestDataInitializer's standing fixture (root=superuser, alice=non-admin) for
// admin-check tests -- see AccessAdminControllerIntegrationTest's own comment on why that's safe
// to read without risking cross-test contamination. Every created user/token below gets a
// UUID-suffixed externalId, so nothing here collides with that fixture or with other test methods
// sharing the same singleton Postgres container (see AbstractIntegrationTest's own comment).
class UserAdminControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private SecurityRepository securityRepo;

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
    void listUsers_includesKnownUsers_noAdminCheckRequired() {
        assertThat(getAsRoot("/api/admin/users")).extracting(u -> u.get("externalId")).contains("root", "alice");
    }

    // --- Create ---

    @Test
    void createUser_asAdmin_createsAUserWithCredentialsAndDefaultGroupMembership() {
        String externalId = "user-" + UUID.randomUUID();

        webTestClient.post().uri("/api/admin/users")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("externalId", externalId, "displayName", "New User",
                        "email", "new@example.com", "password", "s3cret!"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.externalId").isEqualTo(externalId)
                .jsonPath("$.isSuperuser").isEqualTo(false);

        var user = securityRepo.findUserByExternalId(externalId).orElseThrow();
        assertThat(securityRepo.findCredentialsByEmail(externalId)).isPresent();
        assertThat(securityRepo.getGroupsForUser(user.id())).extracting(g -> g.name()).contains("everyone");
    }

    @Test
    void createUser_withRoleAdmin_createsASuperuser() {
        String externalId = "user-" + UUID.randomUUID();

        webTestClient.post().uri("/api/admin/users")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("externalId", externalId, "displayName", "New Admin",
                        "email", "newadmin@example.com", "password", "s3cret!", "role", "admin"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.isSuperuser").isEqualTo(true);
    }

    @Test
    void createUser_asNonAdmin_isForbidden() {
        webTestClient.post().uri("/api/admin/users")
                .header("X-Ntrloc-User", "alice")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("externalId", "user-" + UUID.randomUUID(), "displayName", "X",
                        "email", "x@example.com", "password", "s3cret!"))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void createUser_forAnExternalIdThatAlreadyExists_returnsConflict() {
        webTestClient.post().uri("/api/admin/users")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("externalId", "alice", "displayName", "Duplicate Alice",
                        "email", "dup@example.com", "password", "s3cret!"))
                .exchange()
                .expectStatus().isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
    }

    // --- Update ---

    @Test
    void updateUser_asAdmin_persistsChanges() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Original Name", null, false);

        webTestClient.put().uri("/api/admin/users/" + user.id())
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("externalId", user.externalId(), "displayName", "Updated Name", "email", "updated@example.com", "role", "admin"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.displayName").isEqualTo("Updated Name")
                .jsonPath("$.isSuperuser").isEqualTo(true);

        var reloaded = securityRepo.findUserByExternalId(user.externalId()).orElseThrow();
        assertThat(reloaded.displayName()).isEqualTo("Updated Name");
        assertThat(reloaded.isSuperuser()).isTrue();
    }

    @Test
    void updateUser_asNonAdmin_isForbidden() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Original Name", null, false);

        webTestClient.put().uri("/api/admin/users/" + user.id())
                .header("X-Ntrloc-User", "alice")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("displayName", "Updated Name", "email", "updated@example.com"))
                .exchange()
                .expectStatus().isForbidden();
    }

    // --- Password reset ---

    @Test
    void resetPassword_asAdmin_persistsANewHash() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Local User", null, false);
        String email = "local-" + UUID.randomUUID() + "@example.com";
        securityRepo.createLocalCredentials(user.id(), email, "{bcrypt}old-hash", "USER");

        webTestClient.put().uri("/api/admin/users/" + user.id() + "/password")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("newPassword", "new-s3cret!"))
                .exchange()
                .expectStatus().isNoContent();

        var credentials = securityRepo.findCredentialsByEmail(email).orElseThrow();
        assertThat(credentials.passwordHash()).startsWith("{bcrypt}").isNotEqualTo("{bcrypt}old-hash");
    }

    @Test
    void resetPassword_asNonAdmin_isForbidden() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Local User", null, false);

        webTestClient.put().uri("/api/admin/users/" + user.id() + "/password")
                .header("X-Ntrloc-User", "alice")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("newPassword", "new-s3cret!"))
                .exchange()
                .expectStatus().isForbidden();
    }

    // --- Personal access tokens ---

    @Test
    void tokenLifecycle_createListAndRevoke() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Token User", null, false);

        webTestClient.get().uri("/api/admin/users/" + user.id() + "/tokens")
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Map.class)
                .hasSize(0);

        var createResponse = webTestClient.post().uri("/api/admin/users/" + user.id() + "/tokens")
                .header("X-Ntrloc-User", "root")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("name", "My Token", "expiresInDays", 30))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Map.class)
                .returnResult()
                .getResponseBody();

        assertThat(createResponse).containsKey("token");
        assertThat((String) createResponse.get("token")).isNotBlank();
        UUID tokenId = UUID.fromString((String) createResponse.get("id"));

        webTestClient.get().uri("/api/admin/users/" + user.id() + "/tokens")
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Map.class)
                .hasSize(1);

        webTestClient.delete().uri("/api/admin/users/" + user.id() + "/tokens/" + tokenId)
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isNoContent();

        webTestClient.get().uri("/api/admin/users/" + user.id() + "/tokens")
                .header("X-Ntrloc-User", "root")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Map.class)
                .hasSize(0);
    }

    @Test
    void listTokens_asNonAdmin_isForbidden() {
        var user = securityRepo.createUser("user-" + UUID.randomUUID(), "Token User", null, false);

        webTestClient.get().uri("/api/admin/users/" + user.id() + "/tokens")
                .header("X-Ntrloc-User", "alice")
                .exchange()
                .expectStatus().isForbidden();
    }
}
