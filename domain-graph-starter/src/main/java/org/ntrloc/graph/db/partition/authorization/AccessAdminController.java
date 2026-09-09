package org.ntrloc.graph.db.partition.authorization;

import org.ntrloc.graph.db.partition.authorization.repository.AuthorizationRepository;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository;
import org.ntrloc.graph.db.partition.security.PrincipalResolver;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AccessAdminController {

    private static final String GROUP_PRINCIPAL_TYPE = "GROUP";
    private static final String USER_PRINCIPAL_TYPE = "USER";
    private static final String GROUP_NOT_FOUND = "Group not found";

    // --- Request/response records ---

    public record GroupPermissionView(String itemTypeName, UUID itemTypeId, List<String> operations) {}

    public record PermissionRequest(UUID itemTypeId, String operation) {}

    public record OperationWithVia(String operation, List<String> via) {}

    public record UserPermissionView(String itemTypeName, UUID itemTypeId, List<OperationWithVia> operations) {}

    public record GroupMembershipView(UUID id, String name) {}

    public record ItemTypeView(UUID id, String name) {}

    public record PrincipalRef(UUID id, String name) {}

    public record ItemTypeGrantPrincipalsView(List<PrincipalRef> groups, List<PrincipalRef> users) {}

    public record MarkerPropertyGrantView(UUID propertyId, boolean canRead, boolean canWrite) {}

    public record MarkerPropertyGrantRequest(boolean canRead, boolean canWrite) {}

    public record LinkPerspectiveGrantView(UUID perspectiveId, boolean canCreate, boolean canRead, boolean canDelete) {}

    public record LinkPerspectiveGrantRequest(boolean canCreate, boolean canRead, boolean canDelete) {}

    public record MarkerItemGrantView(boolean canRead, boolean canDelete) {}

    public record MarkerItemGrantRequest(boolean canRead, boolean canDelete) {}

    // --- Dependencies ---

    private final AuthorizationRepository authRepo;
    private final SecurityRepository securityRepo;
    private final SchemaRepository schemaRepo;
    private final PrincipalResolver principalResolver;

    public AccessAdminController(AuthorizationRepository authRepo, SecurityRepository securityRepo,
                                 SchemaRepository schemaRepo, PrincipalResolver principalResolver) {
        this.authRepo = authRepo;
        this.securityRepo = securityRepo;
        this.schemaRepo = schemaRepo;
        this.principalResolver = principalResolver;
    }

    // --- Type-level item-type:read/create grants -- one endpoint trio per principal kind, thin
    // wrappers over shared helpers, same pattern as the marker-scoped grants below. ---

    @GetMapping("/groups/{groupId}/permissions")
    List<GroupPermissionView> getGroupPermissions(@PathVariable("groupId") UUID groupId,
                                                  ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return getOwnPermissions(GROUP_PRINCIPAL_TYPE, groupId);
    }

    @PostMapping("/groups/{groupId}/permissions")
    ResponseEntity<Void> grantGroupPermission(@PathVariable("groupId") UUID groupId,
                                               @RequestBody PermissionRequest body,
                                               ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        requireValidPermissionRequest(body);
        authRepo.grantItemTypeIfAbsent(body.itemTypeId(), GROUP_PRINCIPAL_TYPE, groupId, body.operation());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/groups/{groupId}/permissions")
    ResponseEntity<Void> revokeGroupPermission(@PathVariable("groupId") UUID groupId,
                                                @RequestBody PermissionRequest body,
                                                ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        revokePermission(GROUP_PRINCIPAL_TYPE, groupId, body);
        return ResponseEntity.noContent().build();
    }

    // GET .../permissions is already taken by the aggregated, via-group effective view below
    // (getUserEffectivePermissions, used by the old Access screen) -- "own" distinguishes this
    // user's own direct grants only, the shape the Item Type perspective's detail pane needs.
    @GetMapping("/users/{userId}/permissions/own")
    List<GroupPermissionView> getUserOwnPermissions(@PathVariable("userId") UUID userId,
                                                    ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return getOwnPermissions(USER_PRINCIPAL_TYPE, userId);
    }

    @PostMapping("/users/{userId}/permissions")
    ResponseEntity<Void> grantUserPermission(@PathVariable("userId") UUID userId,
                                             @RequestBody PermissionRequest body,
                                             ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireValidPermissionRequest(body);
        authRepo.grantItemTypeIfAbsent(body.itemTypeId(), USER_PRINCIPAL_TYPE, userId, body.operation());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/permissions")
    ResponseEntity<Void> revokeUserPermission(@PathVariable("userId") UUID userId,
                                              @RequestBody PermissionRequest body,
                                              ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        revokePermission(USER_PRINCIPAL_TYPE, userId, body);
        return ResponseEntity.noContent().build();
    }

    private List<GroupPermissionView> getOwnPermissions(String principalType, UUID principalId) {
        var grants = authRepo.getItemTypeGrantsForPrincipal(principalType, principalId);
        Map<UUID, GroupPermissionView> byItemType = new LinkedHashMap<>();
        for (var g : grants) {
            byItemType.compute(g.itemTypeId(), (k, existing) -> {
                if (existing == null) {
                    var ops = new ArrayList<String>();
                    ops.add(g.permission());
                    return new GroupPermissionView(g.itemTypeName(), g.itemTypeId(), ops);
                } else {
                    existing.operations().add(g.permission());
                    return existing;
                }
            });
        }
        return new ArrayList<>(byItemType.values());
    }

    private void revokePermission(String principalType, UUID principalId, PermissionRequest body) {
        requireValidPermissionRequest(body);
        UUID grantId = authRepo.findItemTypeGrant(body.itemTypeId(), principalType, principalId, body.operation())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grant not found"));
        authRepo.deleteItemTypeGrant(grantId);
    }

    // --- Which groups and users have any type-level grant (read or create) on one item type --
    // the Item Type perspective's own detail pane needs this to build its Group grants / User
    // grants lists, mirroring MarkerAdminController.getMarkerGrantPrincipals exactly, just over
    // authorization_item_type_grant instead of marker_grant. ---

    @GetMapping("/schema/item-types/{itemTypeId}/grants")
    ItemTypeGrantPrincipalsView getItemTypeGrantPrincipals(@PathVariable("itemTypeId") UUID itemTypeId,
                                                            ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        var groupNames = securityRepo.listGroups().stream()
                .collect(Collectors.toMap(g -> g.id(), g -> g.name()));
        var userNames = securityRepo.listUsers().stream()
                .collect(Collectors.toMap(u -> u.id(), u -> u.displayName()));

        Set<UUID> groupIds = new LinkedHashSet<>();
        Set<UUID> userIds = new LinkedHashSet<>();
        for (var grant : authRepo.getAllItemTypeGrants()) {
            if (!grant.itemTypeId().equals(itemTypeId)) continue;
            if (GROUP_PRINCIPAL_TYPE.equals(grant.principalType()) && groupNames.containsKey(grant.principalId())) {
                groupIds.add(grant.principalId());
            } else if (USER_PRINCIPAL_TYPE.equals(grant.principalType()) && userNames.containsKey(grant.principalId())) {
                userIds.add(grant.principalId());
            }
        }
        var groups = groupIds.stream().map(id -> new PrincipalRef(id, groupNames.get(id))).toList();
        var users = userIds.stream().map(id -> new PrincipalRef(id, userNames.get(id))).toList();
        return new ItemTypeGrantPrincipalsView(groups, users);
    }

    // --- Which markers a group has its own grant row for (regardless of what's actually granted
    // under it -- same "has a row" semantics as MarkerAdminController.getMarkerGrantPrincipals) --
    // used by the Group perspective's own Permissions tab to build its default "Granted markers"
    // list without walking every marker in the schema one at a time. ---

    @GetMapping("/groups/{groupId}/markers")
    List<UUID> getGroupGrantedMarkerIds(@PathVariable("groupId") UUID groupId,
                                         ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return authRepo.getAllMarkerGrants().stream()
                .filter(g -> GROUP_PRINCIPAL_TYPE.equals(g.principalType()) && g.principalId().equals(groupId))
                .map(g -> g.markerId())
                .distinct()
                .toList();
    }

    // Mirrors getGroupGrantedMarkerIds above -- the User perspective's own Permissions tab needs
    // the same reverse index for a user principal.
    @GetMapping("/users/{userId}/markers")
    List<UUID> getUserGrantedMarkerIds(@PathVariable("userId") UUID userId,
                                        ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return authRepo.getAllMarkerGrants().stream()
                .filter(g -> USER_PRINCIPAL_TYPE.equals(g.principalType()) && g.principalId().equals(userId))
                .map(g -> g.markerId())
                .distinct()
                .toList();
    }

    // =========================================================================================
    // Marker-scoped grants -- one REST endpoint pair per (grant category) x (principal kind).
    // Each pair is a thin wrapper: validate the principal (a group must exist; a user id is
    // trusted as-is, matching every other user-scoped endpoint in this class), then delegate to a
    // shared private helper keyed by principalType so the six grant categories' actual query/
    // update logic is written exactly once regardless of which kind of principal it's for.
    // =========================================================================================

    // --- Marker-scoped property grants (Read/Write per property) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/properties")
    List<MarkerPropertyGrantView> getGroupMarkerPropertyGrants(@PathVariable("groupId") UUID groupId,
                                                                @PathVariable("markerId") UUID markerId,
                                                                ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return getMarkerPropertyGrants(GROUP_PRINCIPAL_TYPE, groupId, markerId);
    }

    @PutMapping("/groups/{groupId}/markers/{markerId}/properties/{propertyId}")
    ResponseEntity<Void> setGroupMarkerPropertyGrant(@PathVariable("groupId") UUID groupId,
                                                      @PathVariable("markerId") UUID markerId,
                                                      @PathVariable("propertyId") UUID propertyId,
                                                      @RequestBody MarkerPropertyGrantRequest body,
                                                      ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        setMarkerPropertyGrant(GROUP_PRINCIPAL_TYPE, groupId, markerId, propertyId, body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/properties")
    List<MarkerPropertyGrantView> getUserMarkerPropertyGrants(@PathVariable("userId") UUID userId,
                                                               @PathVariable("markerId") UUID markerId,
                                                               ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return getMarkerPropertyGrants(USER_PRINCIPAL_TYPE, userId, markerId);
    }

    @PutMapping("/users/{userId}/markers/{markerId}/properties/{propertyId}")
    ResponseEntity<Void> setUserMarkerPropertyGrant(@PathVariable("userId") UUID userId,
                                                     @PathVariable("markerId") UUID markerId,
                                                     @PathVariable("propertyId") UUID propertyId,
                                                     @RequestBody MarkerPropertyGrantRequest body,
                                                     ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        setMarkerPropertyGrant(USER_PRINCIPAL_TYPE, userId, markerId, propertyId, body);
        return ResponseEntity.noContent().build();
    }

    private List<MarkerPropertyGrantView> getMarkerPropertyGrants(String principalType, UUID principalId, UUID markerId) {
        return authRepo.getPropertyGrantsForMarker(markerId, principalType, principalId).stream()
                .map(r -> new MarkerPropertyGrantView(r.propertyId(), r.canRead(), r.canWrite()))
                .toList();
    }

    private void setMarkerPropertyGrant(String principalType, UUID principalId, UUID markerId, UUID propertyId, MarkerPropertyGrantRequest body) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.grantPropertyAccess(markerGrantId, propertyId, body.canRead(), body.canWrite());
    }

    // --- Marker-scoped item-level grants (Read/Delete of the item carrying the marker --
    // item_can_read / item_can_delete live directly on marker_grant, one pair per (marker, principal)) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/item-permissions")
    MarkerItemGrantView getGroupMarkerItemGrant(@PathVariable("groupId") UUID groupId,
                                                @PathVariable("markerId") UUID markerId,
                                                ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return getMarkerItemGrant(GROUP_PRINCIPAL_TYPE, groupId, markerId);
    }

    @PutMapping("/groups/{groupId}/markers/{markerId}/item-permissions")
    ResponseEntity<Void> setGroupMarkerItemGrant(@PathVariable("groupId") UUID groupId,
                                                 @PathVariable("markerId") UUID markerId,
                                                 @RequestBody MarkerItemGrantRequest body,
                                                 ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        setMarkerItemGrant(GROUP_PRINCIPAL_TYPE, groupId, markerId, body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/item-permissions")
    MarkerItemGrantView getUserMarkerItemGrant(@PathVariable("userId") UUID userId,
                                               @PathVariable("markerId") UUID markerId,
                                               ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return getMarkerItemGrant(USER_PRINCIPAL_TYPE, userId, markerId);
    }

    @PutMapping("/users/{userId}/markers/{markerId}/item-permissions")
    ResponseEntity<Void> setUserMarkerItemGrant(@PathVariable("userId") UUID userId,
                                                @PathVariable("markerId") UUID markerId,
                                                @RequestBody MarkerItemGrantRequest body,
                                                ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        setMarkerItemGrant(USER_PRINCIPAL_TYPE, userId, markerId, body);
        return ResponseEntity.noContent().build();
    }

    private MarkerItemGrantView getMarkerItemGrant(String principalType, UUID principalId, UUID markerId) {
        var row = authRepo.getItemPermissionsForMarker(markerId, principalType, principalId);
        return new MarkerItemGrantView(row.canRead(), row.canDelete());
    }

    private void setMarkerItemGrant(String principalType, UUID principalId, UUID markerId, MarkerItemGrantRequest body) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.setItemPermissions(markerGrantId, body.canRead(), body.canDelete());
    }

    // --- Marker-scoped link-property grants -- same shape as item properties above, just against
    // a link type's own properties (marker_grant_link_property) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/link-properties")
    List<MarkerPropertyGrantView> getGroupMarkerLinkPropertyGrants(@PathVariable("groupId") UUID groupId,
                                                                    @PathVariable("markerId") UUID markerId,
                                                                    ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return getMarkerLinkPropertyGrants(GROUP_PRINCIPAL_TYPE, groupId, markerId);
    }

    @PutMapping("/groups/{groupId}/markers/{markerId}/link-properties/{propertyId}")
    ResponseEntity<Void> setGroupMarkerLinkPropertyGrant(@PathVariable("groupId") UUID groupId,
                                                          @PathVariable("markerId") UUID markerId,
                                                          @PathVariable("propertyId") UUID propertyId,
                                                          @RequestBody MarkerPropertyGrantRequest body,
                                                          ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        setMarkerLinkPropertyGrant(GROUP_PRINCIPAL_TYPE, groupId, markerId, propertyId, body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/link-properties")
    List<MarkerPropertyGrantView> getUserMarkerLinkPropertyGrants(@PathVariable("userId") UUID userId,
                                                                   @PathVariable("markerId") UUID markerId,
                                                                   ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return getMarkerLinkPropertyGrants(USER_PRINCIPAL_TYPE, userId, markerId);
    }

    @PutMapping("/users/{userId}/markers/{markerId}/link-properties/{propertyId}")
    ResponseEntity<Void> setUserMarkerLinkPropertyGrant(@PathVariable("userId") UUID userId,
                                                         @PathVariable("markerId") UUID markerId,
                                                         @PathVariable("propertyId") UUID propertyId,
                                                         @RequestBody MarkerPropertyGrantRequest body,
                                                         ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        setMarkerLinkPropertyGrant(USER_PRINCIPAL_TYPE, userId, markerId, propertyId, body);
        return ResponseEntity.noContent().build();
    }

    private List<MarkerPropertyGrantView> getMarkerLinkPropertyGrants(String principalType, UUID principalId, UUID markerId) {
        return authRepo.getLinkPropertyGrantsForMarker(markerId, principalType, principalId).stream()
                .map(r -> new MarkerPropertyGrantView(r.propertyId(), r.canRead(), r.canWrite()))
                .toList();
    }

    private void setMarkerLinkPropertyGrant(String principalType, UUID principalId, UUID markerId, UUID propertyId, MarkerPropertyGrantRequest body) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.grantLinkPropertyAccess(markerGrantId, propertyId, body.canRead(), body.canWrite());
    }

    // --- Marker-scoped link-perspective grants (Create/Read/Delete per perspective) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/link-perspectives")
    List<LinkPerspectiveGrantView> getGroupMarkerLinkPerspectiveGrants(@PathVariable("groupId") UUID groupId,
                                                                        @PathVariable("markerId") UUID markerId,
                                                                        ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return getMarkerLinkPerspectiveGrants(GROUP_PRINCIPAL_TYPE, groupId, markerId);
    }

    @PutMapping("/groups/{groupId}/markers/{markerId}/link-perspectives/{perspectiveId}")
    ResponseEntity<Void> setGroupMarkerLinkPerspectiveGrant(@PathVariable("groupId") UUID groupId,
                                                             @PathVariable("markerId") UUID markerId,
                                                             @PathVariable("perspectiveId") UUID perspectiveId,
                                                             @RequestBody LinkPerspectiveGrantRequest body,
                                                             ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        setMarkerLinkPerspectiveGrant(GROUP_PRINCIPAL_TYPE, groupId, markerId, perspectiveId, body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/link-perspectives")
    List<LinkPerspectiveGrantView> getUserMarkerLinkPerspectiveGrants(@PathVariable("userId") UUID userId,
                                                                       @PathVariable("markerId") UUID markerId,
                                                                       ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return getMarkerLinkPerspectiveGrants(USER_PRINCIPAL_TYPE, userId, markerId);
    }

    @PutMapping("/users/{userId}/markers/{markerId}/link-perspectives/{perspectiveId}")
    ResponseEntity<Void> setUserMarkerLinkPerspectiveGrant(@PathVariable("userId") UUID userId,
                                                            @PathVariable("markerId") UUID markerId,
                                                            @PathVariable("perspectiveId") UUID perspectiveId,
                                                            @RequestBody LinkPerspectiveGrantRequest body,
                                                            ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        setMarkerLinkPerspectiveGrant(USER_PRINCIPAL_TYPE, userId, markerId, perspectiveId, body);
        return ResponseEntity.noContent().build();
    }

    private List<LinkPerspectiveGrantView> getMarkerLinkPerspectiveGrants(String principalType, UUID principalId, UUID markerId) {
        return authRepo.getLinkPerspectiveGrantsForMarker(markerId, principalType, principalId).stream()
                .map(r -> new LinkPerspectiveGrantView(r.perspectiveId(), r.canCreate(), r.canRead(), r.canDelete()))
                .toList();
    }

    private void setMarkerLinkPerspectiveGrant(String principalType, UUID principalId, UUID markerId, UUID perspectiveId, LinkPerspectiveGrantRequest body) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.grantLinkPerspectiveAccess(markerGrantId, perspectiveId, body.canCreate(), body.canRead(), body.canDelete());
    }

    // --- Marker-scoped transition-execute grants (existence-only, see
    // AuthorizationRepository.grantTransitionExecute's own comment) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/transitions")
    Set<UUID> getGroupMarkerTransitionGrants(@PathVariable("groupId") UUID groupId,
                                              @PathVariable("markerId") UUID markerId,
                                              ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return authRepo.getTransitionGrantsForMarker(markerId, GROUP_PRINCIPAL_TYPE, groupId);
    }

    @PostMapping("/groups/{groupId}/markers/{markerId}/transitions/{transitionId}")
    ResponseEntity<Void> grantGroupMarkerTransition(@PathVariable("groupId") UUID groupId,
                                                     @PathVariable("markerId") UUID markerId,
                                                     @PathVariable("transitionId") UUID transitionId,
                                                     ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        grantMarkerTransition(GROUP_PRINCIPAL_TYPE, groupId, markerId, transitionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/groups/{groupId}/markers/{markerId}/transitions/{transitionId}")
    ResponseEntity<Void> revokeGroupMarkerTransition(@PathVariable("groupId") UUID groupId,
                                                      @PathVariable("markerId") UUID markerId,
                                                      @PathVariable("transitionId") UUID transitionId,
                                                      ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        revokeMarkerTransition(GROUP_PRINCIPAL_TYPE, groupId, markerId, transitionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/transitions")
    Set<UUID> getUserMarkerTransitionGrants(@PathVariable("userId") UUID userId,
                                             @PathVariable("markerId") UUID markerId,
                                             ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return authRepo.getTransitionGrantsForMarker(markerId, USER_PRINCIPAL_TYPE, userId);
    }

    @PostMapping("/users/{userId}/markers/{markerId}/transitions/{transitionId}")
    ResponseEntity<Void> grantUserMarkerTransition(@PathVariable("userId") UUID userId,
                                                    @PathVariable("markerId") UUID markerId,
                                                    @PathVariable("transitionId") UUID transitionId,
                                                    ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        grantMarkerTransition(USER_PRINCIPAL_TYPE, userId, markerId, transitionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/markers/{markerId}/transitions/{transitionId}")
    ResponseEntity<Void> revokeUserMarkerTransition(@PathVariable("userId") UUID userId,
                                                     @PathVariable("markerId") UUID markerId,
                                                     @PathVariable("transitionId") UUID transitionId,
                                                     ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        revokeMarkerTransition(USER_PRINCIPAL_TYPE, userId, markerId, transitionId);
        return ResponseEntity.noContent().build();
    }

    private void grantMarkerTransition(String principalType, UUID principalId, UUID markerId, UUID transitionId) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.grantTransitionExecute(markerGrantId, transitionId);
    }

    private void revokeMarkerTransition(String principalType, UUID principalId, UUID markerId, UUID transitionId) {
        authRepo.findMarkerGrant(markerId, principalType, principalId)
                .ifPresent(markerGrantId -> authRepo.revokeTransitionExecute(markerGrantId, transitionId));
    }

    // --- Marker-scoped state-machine:start grants (existence-only, mirrors transitions above) ---

    @GetMapping("/groups/{groupId}/markers/{markerId}/state-machines/start")
    Set<UUID> getGroupMarkerStateMachineStartGrants(@PathVariable("groupId") UUID groupId,
                                                     @PathVariable("markerId") UUID markerId,
                                                     ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        return authRepo.getStateMachineStartGrantsForMarker(markerId, GROUP_PRINCIPAL_TYPE, groupId);
    }

    @PostMapping("/groups/{groupId}/markers/{markerId}/state-machines/{stateMachineId}/start")
    ResponseEntity<Void> grantGroupMarkerStateMachineStart(@PathVariable("groupId") UUID groupId,
                                                            @PathVariable("markerId") UUID markerId,
                                                            @PathVariable("stateMachineId") UUID stateMachineId,
                                                            ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        grantMarkerStateMachineStart(GROUP_PRINCIPAL_TYPE, groupId, markerId, stateMachineId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/groups/{groupId}/markers/{markerId}/state-machines/{stateMachineId}/start")
    ResponseEntity<Void> revokeGroupMarkerStateMachineStart(@PathVariable("groupId") UUID groupId,
                                                             @PathVariable("markerId") UUID markerId,
                                                             @PathVariable("stateMachineId") UUID stateMachineId,
                                                             ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        revokeMarkerStateMachineStart(GROUP_PRINCIPAL_TYPE, groupId, markerId, stateMachineId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/markers/{markerId}/state-machines/start")
    Set<UUID> getUserMarkerStateMachineStartGrants(@PathVariable("userId") UUID userId,
                                                    @PathVariable("markerId") UUID markerId,
                                                    ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return authRepo.getStateMachineStartGrantsForMarker(markerId, USER_PRINCIPAL_TYPE, userId);
    }

    @PostMapping("/users/{userId}/markers/{markerId}/state-machines/{stateMachineId}/start")
    ResponseEntity<Void> grantUserMarkerStateMachineStart(@PathVariable("userId") UUID userId,
                                                           @PathVariable("markerId") UUID markerId,
                                                           @PathVariable("stateMachineId") UUID stateMachineId,
                                                           ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        grantMarkerStateMachineStart(USER_PRINCIPAL_TYPE, userId, markerId, stateMachineId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/markers/{markerId}/state-machines/{stateMachineId}/start")
    ResponseEntity<Void> revokeUserMarkerStateMachineStart(@PathVariable("userId") UUID userId,
                                                            @PathVariable("markerId") UUID markerId,
                                                            @PathVariable("stateMachineId") UUID stateMachineId,
                                                            ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        revokeMarkerStateMachineStart(USER_PRINCIPAL_TYPE, userId, markerId, stateMachineId);
        return ResponseEntity.noContent().build();
    }

    private void grantMarkerStateMachineStart(String principalType, UUID principalId, UUID markerId, UUID stateMachineId) {
        UUID markerGrantId = authRepo.ensureMarkerGrant(markerId, principalType, principalId);
        authRepo.grantStateMachineStart(markerGrantId, stateMachineId);
    }

    private void revokeMarkerStateMachineStart(String principalType, UUID principalId, UUID markerId, UUID stateMachineId) {
        authRepo.findMarkerGrant(markerId, principalType, principalId)
                .ifPresent(markerGrantId -> authRepo.revokeStateMachineStart(markerGrantId, stateMachineId));
    }

    // --- Deleting a principal's entire grant of one marker (the wireframe's "Delete" action next
    // to Edit -- only ever shown for a principal that has its own grant row, never for one that's
    // merely inheriting) ---

    @DeleteMapping("/groups/{groupId}/markers/{markerId}")
    ResponseEntity<Void> deleteGroupMarkerGrant(@PathVariable("groupId") UUID groupId,
                                                @PathVariable("markerId") UUID markerId,
                                                ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        requireGroupExists(groupId);
        authRepo.findMarkerGrant(markerId, GROUP_PRINCIPAL_TYPE, groupId).ifPresent(authRepo::deleteMarkerGrant);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/markers/{markerId}")
    ResponseEntity<Void> deleteUserMarkerGrant(@PathVariable("userId") UUID userId,
                                               @PathVariable("markerId") UUID markerId,
                                               ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        authRepo.findMarkerGrant(markerId, USER_PRINCIPAL_TYPE, userId).ifPresent(authRepo::deleteMarkerGrant);
        return ResponseEntity.noContent().build();
    }

    // --- User effective permissions ---

    @GetMapping("/users/{userId}/permissions")
    List<UserPermissionView> getUserEffectivePermissions(@PathVariable("userId") UUID userId,
                                                         ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);

        // Get all groups user belongs to
        var userGroups = securityRepo.getGroupsForUser(userId);
        if (userGroups.isEmpty()) {
            return List.of();
        }

        // We also need to know which group each grant belongs to. Re-query per group to get that mapping.
        // Actually, let's restructure: query grants per group to know which group provides which grant.
        record GrantWithGroup(UUID itemTypeId, String itemTypeName, String operation, String groupName) {}
        List<GrantWithGroup> grantsWithGroup = new ArrayList<>();
        for (var group : userGroups) {
            var groupGrants = authRepo.getItemTypeGrantsForPrincipal(GROUP_PRINCIPAL_TYPE, group.id());
            for (var g : groupGrants) {
                grantsWithGroup.add(new GrantWithGroup(g.itemTypeId(), g.itemTypeName(), g.permission(), group.name()));
            }
        }

        // Group by (itemTypeId, operation) -> list of group names providing it
        record ItemOp(UUID itemTypeId, String itemTypeName, String operation) {}
        Map<ItemOp, List<String>> viaMap = new LinkedHashMap<>();
        for (var gwg : grantsWithGroup) {
            var key = new ItemOp(gwg.itemTypeId(), gwg.itemTypeName(), gwg.operation());
            viaMap.computeIfAbsent(key, k -> new ArrayList<>()).add(gwg.groupName());
        }

        // Group by item type
        Map<UUID, UserPermissionView> byItemType = new LinkedHashMap<>();
        for (var entry : viaMap.entrySet()) {
            var key = entry.getKey();
            var viaGroups = entry.getValue();
            byItemType.compute(key.itemTypeId(), (k, existing) -> {
                var opWithVia = new OperationWithVia(key.operation(), viaGroups);
                if (existing == null) {
                    var ops = new ArrayList<OperationWithVia>();
                    ops.add(opWithVia);
                    return new UserPermissionView(key.itemTypeName(), key.itemTypeId(), ops);
                } else {
                    existing.operations().add(opWithVia);
                    return existing;
                }
            });
        }
        return new ArrayList<>(byItemType.values());
    }

    // --- User group memberships ---

    @GetMapping("/users/{userId}/groups")
    List<GroupMembershipView> getUserGroups(@PathVariable("userId") UUID userId,
                                            ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return securityRepo.getGroupsForUser(userId).stream()
                .map(g -> new GroupMembershipView(g.id(), g.name()))
                .toList();
    }

    // --- Schema item types listing ---

    @GetMapping("/schema/item-types")
    List<ItemTypeView> listItemTypes(ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return schemaRepo.getAllItems().stream()
                .map(item -> new ItemTypeView(item.id(), item.name()))
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    // --- Helpers ---

    private void requireAdmin(ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can manage access");
        }
    }

    private void requireGroupExists(UUID groupId) {
        securityRepo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
    }

    private void requireValidPermissionRequest(PermissionRequest body) {
        if (body.itemTypeId() == null || body.operation() == null || body.operation().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemTypeId and operation are required");
        }
        if (!PermissionService.ITEM_TYPE_READ.equals(body.operation()) && !PermissionService.ITEM_TYPE_CREATE.equals(body.operation())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "operation must be one of: " + PermissionService.ITEM_TYPE_READ + ", " + PermissionService.ITEM_TYPE_CREATE);
        }
    }
}
