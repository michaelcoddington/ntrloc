package org.ntrloc.graph.db.partition.authorization;

import org.ntrloc.graph.db.partition.authorization.repository.AuthorizationRepository;
import org.ntrloc.graph.db.partition.security.PrincipalResolver;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// Marker CRUD -- deliberately its own controller, separate from AccessAdminController (which
// covers type-level grants only), since the marker/grant admin surface is expected to keep growing
// (see docs/ntrloc-marker-admin-ui-design-notes.md). Markers live outside the schema-mutation batch
// system entirely (authorization_marker isn't a schema_* table, AuthorizationRepository.createMarker
// is a direct, immediate INSERT that refreshes AuthorizationCacheManager synchronously) -- so unlike
// item types/traits, marker creation here is a direct write, not staged into
// schemaViewModel.collectMutations()'s batched Save.
@RestController
@RequestMapping("/api/admin/markers")
public class MarkerAdminController {

    private static final Set<String> VALID_SCOPE_KINDS = Set.of("ITEM_TYPE", "TRAIT", "LINK_PERSPECTIVE");

    public record MarkerView(UUID id, String name, String description, String scopeKind, UUID scopeId) {}

    public record CreateMarkerRequest(String name, String description, String scopeKind, UUID scopeId) {}

    public record UpdateMarkerRequest(String name, String description) {}

    public record PrincipalRef(UUID id, String name) {}

    public record MarkerGrantPrincipalsView(List<PrincipalRef> groups, List<PrincipalRef> users) {}

    private final AuthorizationRepository authRepo;
    private final SecurityRepository securityRepo;
    private final PrincipalResolver principalResolver;

    public MarkerAdminController(AuthorizationRepository authRepo, SecurityRepository securityRepo,
                                  PrincipalResolver principalResolver) {
        this.authRepo = authRepo;
        this.securityRepo = securityRepo;
        this.principalResolver = principalResolver;
    }

    @GetMapping
    List<MarkerView> listMarkers(ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return authRepo.getAllMarkers().stream()
                .map(m -> new MarkerView(m.id(), m.name(), m.description(), m.scopeKind(), m.scopeId()))
                .toList();
    }

    @PostMapping
    MarkerView createMarker(@RequestBody CreateMarkerRequest body, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
        if (body.scopeKind() == null || !VALID_SCOPE_KINDS.contains(body.scopeKind())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scopeKind must be one of: " + VALID_SCOPE_KINDS);
        }
        if (body.scopeId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scopeId is required");
        }
        var marker = authRepo.createMarker(body.name(), body.description(), body.scopeKind(), body.scopeId());
        return new MarkerView(marker.id(), marker.name(), marker.description(), marker.scopeKind(), marker.scopeId());
    }

    @PutMapping("/{id}")
    MarkerView updateMarker(@PathVariable UUID id, @RequestBody UpdateMarkerRequest body, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
        var marker = authRepo.updateMarker(id, body.name(), body.description());
        return new MarkerView(marker.id(), marker.name(), marker.description(), marker.scopeKind(), marker.scopeId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteMarker(@PathVariable UUID id, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        authRepo.deleteMarker(id);
    }

    // Which groups and users have their own marker_grant row for this marker -- a row exists the
    // moment any of the six grant categories is first set on a principal (see ensureMarkerGrant),
    // regardless of what's actually granted under it, so this is exactly "who to show in the Item
    // Type perspective's Group grants / User grants trees" (a connector-only group pulled in for
    // hierarchy has no row here; it still renders, just with nothing of its own to show).
    @GetMapping("/{markerId}/grants")
    MarkerGrantPrincipalsView getMarkerGrantPrincipals(@PathVariable UUID markerId,
                                                        ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        var groupNames = securityRepo.listGroups().stream()
                .collect(Collectors.toMap(g -> g.id(), g -> g.name()));
        var userNames = securityRepo.listUsers().stream()
                .collect(Collectors.toMap(u -> u.id(), u -> u.displayName()));

        List<PrincipalRef> groups = new ArrayList<>();
        List<PrincipalRef> users = new ArrayList<>();
        for (var grant : authRepo.getAllMarkerGrants()) {
            if (!grant.markerId().equals(markerId)) continue;
            if ("GROUP".equals(grant.principalType()) && groupNames.containsKey(grant.principalId())) {
                groups.add(new PrincipalRef(grant.principalId(), groupNames.get(grant.principalId())));
            } else if ("USER".equals(grant.principalType()) && userNames.containsKey(grant.principalId())) {
                users.add(new PrincipalRef(grant.principalId(), userNames.get(grant.principalId())));
            }
        }
        return new MarkerGrantPrincipalsView(groups, users);
    }

    private void requireAdmin(ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can manage markers");
        }
    }

    // Nested under /markers rather than its own top-level resource -- same admin surface, same
    // requireAdmin gate, same "list everything, filter client-side by item type" shape as
    // listMarkers() above. Enable/disable toggling isn't here yet (a deliberate, smaller
    // follow-up); create + delete exist so an admin can wire a rule to an item type, or remove
    // one, without going around this UI to raw SQL.
    @GetMapping("/rules")
    List<MarkerRuleView> listMarkerRules(ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return authRepo.getAllMarkerRules().stream()
                .map(r -> new MarkerRuleView(r.id(), r.name(), r.itemTypeId(), r.decisionKey(), r.enabled()))
                .toList();
    }

    public record MarkerRuleView(UUID id, String name, UUID itemTypeId, String decisionKey, boolean enabled) {}

    public record CreateMarkerRuleRequest(String name, UUID itemTypeId, String decisionKey) {}

    @PostMapping("/rules")
    MarkerRuleView createMarkerRule(@RequestBody CreateMarkerRuleRequest body, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
        if (body.itemTypeId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemTypeId is required");
        }
        if (body.decisionKey() == null || body.decisionKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "decisionKey is required");
        }
        var rule = authRepo.createMarkerRule(body.name(), body.itemTypeId(), body.decisionKey());
        return new MarkerRuleView(rule.id(), rule.name(), rule.itemTypeId(), rule.decisionKey(), rule.enabled());
    }

    // Plain delete -- see AuthorizationRepository.deleteMarkerRule for why markers a deleted rule
    // already applied are left in place rather than reconciled away here.
    @DeleteMapping("/rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteMarkerRule(@PathVariable UUID id, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        authRepo.deleteMarkerRule(id);
    }
}
