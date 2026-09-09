package org.ntrloc.graph.db.partition.security;

import org.ntrloc.graph.db.partition.authorization.DefaultGroupInitializer;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    public record UserView(UUID id, String externalId, String displayName, String email, boolean isSuperuser) {}

    public record CreateUserRequest(String externalId, String displayName, String email, String password, String role) {}

    public record UpdateUserRequest(String externalId, String displayName, String email, String role) {}

    public record ResetPasswordRequest(String newPassword) {}

    public record CreateTokenRequest(String name, Integer expiresInDays) {}

    public record CreatedTokenResponse(UUID id, String name, String token, OffsetDateTime expiresAt) {}

    public record TokenSummaryResponse(UUID id, String name, OffsetDateTime createdAt, OffsetDateTime expiresAt) {}

    private final SecurityRepository repo;
    private final PersonalAccessTokenService patService;
    private final PrincipalResolver principalResolver;
    private final DefaultGroupInitializer defaultGroupInitializer;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UserAdminController(SecurityRepository repo, PersonalAccessTokenService patService,
                               PrincipalResolver principalResolver, DefaultGroupInitializer defaultGroupInitializer) {
        this.repo = repo;
        this.patService = patService;
        this.principalResolver = principalResolver;
        this.defaultGroupInitializer = defaultGroupInitializer;
    }

    @GetMapping
    List<UserView> listUsers() {
        return repo.listUsers().stream()
                .map(u -> new UserView(u.id(), u.externalId(), u.displayName(), u.email(), u.isSuperuser()))
                .toList();
    }

    @PostMapping
    UserView createUser(@RequestBody CreateUserRequest body, ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can create users");
        }
        if (repo.findUserByExternalId(body.externalId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already exists: " + body.externalId());
        }

        String role = body.role() == null ? "USER" : body.role().toUpperCase();
        boolean isSuperuser = "ADMIN".equals(role);
        var user = repo.createUser(body.externalId(), body.displayName(), body.email(), isSuperuser);
        String passwordHash = "{bcrypt}" + encoder.encode(body.password());
        repo.createLocalCredentials(user.id(), body.externalId(), passwordHash, role);
        defaultGroupInitializer.addUserToDefaultGroup(user.id());
        return new UserView(user.id(), user.externalId(), user.displayName(), user.email(), user.isSuperuser());
    }

    // @Transactional: three separate writes (security_user, security_local_credentials' login key,
    // its role) that must all land together -- a partial failure here previously left external_id
    // and security_local_credentials.email out of sync, which would silently lock the user out
    // under their new username. See updateLocalCredentialsLogin's own comment.
    @Transactional
    @PutMapping("/{userId}")
    UserView updateUser(@PathVariable("userId") UUID userId, @RequestBody UpdateUserRequest body,
                        ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can update users");
        }
        if (body.externalId() == null || body.externalId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        if (body.displayName() == null || body.displayName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name is required");
        }
        repo.findUserByExternalId(body.externalId())
                .filter(existing -> !existing.id().equals(userId))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already in use: " + body.externalId());
                });
        String role = body.role() == null ? "USER" : body.role().toUpperCase();
        boolean isSuperuser = "ADMIN".equals(role);
        repo.updateUser(userId, body.externalId(), body.displayName(), body.email(), isSuperuser);
        repo.updateLocalCredentialsLogin(userId, body.externalId());
        repo.updateLocalCredentialsRole(userId, role);
        return new UserView(userId, body.externalId(), body.displayName(), body.email(), isSuperuser);
    }

    @DeleteMapping("/{userId}")
    ResponseEntity<Void> deleteUser(@PathVariable("userId") UUID userId, ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can delete users");
        }
        if (principal.id().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account");
        }
        repo.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{userId}/password")
    ResponseEntity<Void> resetPassword(@PathVariable("userId") UUID userId, @RequestBody ResetPasswordRequest body,
                                        ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can reset passwords");
        }
        String passwordHash = "{bcrypt}" + encoder.encode(body.newPassword());
        repo.updatePasswordHash(userId, passwordHash);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/tokens")
    List<TokenSummaryResponse> listTokens(@PathVariable("userId") UUID userId,
                                           ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return patService.listForUser(userId).stream()
                .map(t -> new TokenSummaryResponse(t.id(), t.name(), t.createdAt(), t.expiresAt()))
                .toList();
    }

    @PostMapping("/{userId}/tokens")
    ResponseEntity<CreatedTokenResponse> createToken(@PathVariable("userId") UUID userId,
                                                      @RequestBody CreateTokenRequest body,
                                                      ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        var issued = patService.issueForUser(userId, body.name(), body.expiresInDays());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new CreatedTokenResponse(issued.id(), issued.name(), issued.rawToken(), issued.expiresAt()));
    }

    @DeleteMapping("/{userId}/tokens/{tokenId}")
    ResponseEntity<Void> revokeToken(@PathVariable("userId") UUID userId, @PathVariable("tokenId") UUID tokenId,
                                      ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        patService.revokeForUser(userId, tokenId);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can manage tokens");
        }
    }
}
