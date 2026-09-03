package org.ntrloc.graph.db.partition.authorization;

import com.hazelcast.topic.ITopic;
import org.ntrloc.graph.cluster.ClusterService;
import org.ntrloc.graph.db.partition.authorization.repository.AuthorizationRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

// Caches authorization_item_type_grant/marker_grant (+ its child tables) -- schema-sized,
// admin-curated, rarely changing -- never register_item_marker (data-sized; that stays a real
// per-page query in RegisterPartitionManager/AuthorizationRepository). See
// docs/ntrloc-acl-design-notes.md "Caching grant definitions, not item-marker assignments".
//
// Mirrors SchemaManager's AtomicReference + Hazelcast ITopic pattern exactly -- same
// self-publishing-member filter, same rebuild-then-publish shape in refreshCache().
//
// Cached at the grant-source level -- Map<PrincipalKey, ...> keyed by (principalType,
// principalId), never at the resolved-effective-principal level. Resolving a specific principal's
// effective set is a request-time union over their own key plus each of their groups' keys -- a few
// hashmap lookups, no I/O. This is deliberate: it means group-membership changes need zero cache
// invalidation, and a grant change on one group never has to invalidate every member's own entry.
@Service
public class AuthorizationCacheManager {

    private static final String AUTHORIZATION_CHANGED_TOPIC = "authorizationChanged";
    private static final String PRINCIPAL_USER = "USER";
    private static final String PRINCIPAL_GROUP = "GROUP";

    private record PrincipalKey(String principalType, UUID principalId) {}

    private record PrincipalOpKey(String principalType, UUID principalId, String operation) {}

    private record Snapshot(
            Map<PrincipalOpKey, Set<UUID>> itemTypeGrants,
            Map<PrincipalKey, Set<UUID>> itemReadMarkers,
            Map<PrincipalKey, Set<UUID>> itemDeleteMarkers,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> propertyReadGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> propertyWriteGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> linkPropertyReadGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> linkPropertyWriteGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> linkPerspectiveCreateGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> linkPerspectiveReadGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> linkPerspectiveDeleteGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> transitionExecuteGrants,
            Map<PrincipalKey, Map<UUID, Set<UUID>>> stateMachineStartGrants) {
    }

    private final AuthorizationRepository authRepo;
    private final ClusterService clusterService;
    private final ITopic<String> authorizationChangedTopic;

    // AtomicReference, not a plain volatile field: rebuildCache() can run on the Hazelcast
    // message-listener thread (a remote node's change arriving) as well as on whatever thread
    // triggered the write -- same reasoning as SchemaManager's cachedAdminSchema.
    private final AtomicReference<Snapshot> cache = new AtomicReference<>();

    public AuthorizationCacheManager(AuthorizationRepository authRepo, ClusterService clusterService) {
        this.authRepo = authRepo;
        this.clusterService = clusterService;
        rebuildCache();

        this.authorizationChangedTopic = clusterService.getTopic(AUTHORIZATION_CHANGED_TOPIC);
        authorizationChangedTopic.addMessageListener(message -> {
            if (!message.getPublishingMember().equals(clusterService.getLocalMember())) {
                rebuildCache();
            }
        });
    }

    private record MarkerGrantMaps(Map<PrincipalKey, Set<UUID>> readMarkers, Map<PrincipalKey, Set<UUID>> deleteMarkers) {}

    private record NestedGrantMaps(Map<PrincipalKey, Map<UUID, Set<UUID>>> first, Map<PrincipalKey, Map<UUID, Set<UUID>>> second) {}

    private record LinkPerspectiveGrantMaps(Map<PrincipalKey, Map<UUID, Set<UUID>>> createGrants,
                                             Map<PrincipalKey, Map<UUID, Set<UUID>>> readGrants,
                                             Map<PrincipalKey, Map<UUID, Set<UUID>>> deleteGrants) {}

    private void rebuildCache() {
        Map<PrincipalOpKey, Set<UUID>> itemTypeGrants = buildItemTypeGrants();
        MarkerGrantMaps markerGrants = buildMarkerGrants();
        NestedGrantMaps propertyGrants = buildPropertyGrants(authRepo.getAllPropertyGrants());
        NestedGrantMaps linkPropertyGrants = buildPropertyGrants(authRepo.getAllLinkPropertyGrants());
        LinkPerspectiveGrantMaps linkPerspectiveGrants = buildLinkPerspectiveGrants();
        // Existence-only grants (transition:execute, state-machine:start): a row present == granted.
        Map<PrincipalKey, Map<UUID, Set<UUID>>> transitionExecuteGrants = buildExistenceGrants(authRepo.getAllTransitionGrants());
        Map<PrincipalKey, Map<UUID, Set<UUID>>> stateMachineStartGrants = buildExistenceGrants(authRepo.getAllStateMachineStartGrants());

        cache.set(new Snapshot(itemTypeGrants, markerGrants.readMarkers(), markerGrants.deleteMarkers(),
                propertyGrants.first(), propertyGrants.second(), linkPropertyGrants.first(), linkPropertyGrants.second(),
                linkPerspectiveGrants.createGrants(), linkPerspectiveGrants.readGrants(), linkPerspectiveGrants.deleteGrants(),
                transitionExecuteGrants, stateMachineStartGrants));
    }

    private Map<PrincipalOpKey, Set<UUID>> buildItemTypeGrants() {
        Map<PrincipalOpKey, Set<UUID>> itemTypeGrants = new HashMap<>();
        for (var row : authRepo.getAllItemTypeGrants()) {
            itemTypeGrants.computeIfAbsent(new PrincipalOpKey(row.principalType(), row.principalId(), row.permission()), k -> new HashSet<>())
                    .add(row.itemTypeId());
        }
        return itemTypeGrants;
    }

    private MarkerGrantMaps buildMarkerGrants() {
        Map<PrincipalKey, Set<UUID>> itemReadMarkers = new HashMap<>();
        Map<PrincipalKey, Set<UUID>> itemDeleteMarkers = new HashMap<>();
        for (var row : authRepo.getAllMarkerGrants()) {
            var key = new PrincipalKey(row.principalType(), row.principalId());
            if (row.itemCanRead()) itemReadMarkers.computeIfAbsent(key, k -> new HashSet<>()).add(row.markerId());
            if (row.itemCanDelete()) itemDeleteMarkers.computeIfAbsent(key, k -> new HashSet<>()).add(row.markerId());
        }
        return new MarkerGrantMaps(itemReadMarkers, itemDeleteMarkers);
    }

    private NestedGrantMaps buildPropertyGrants(List<AuthorizationRepository.PropertyGrantRow> rows) {
        Map<PrincipalKey, Map<UUID, Set<UUID>>> readGrants = new HashMap<>();
        Map<PrincipalKey, Map<UUID, Set<UUID>>> writeGrants = new HashMap<>();
        for (var row : rows) {
            var key = new PrincipalKey(row.principalType(), row.principalId());
            if (row.canRead()) addToNestedSet(readGrants, key, row.markerId(), row.propertyId());
            if (row.canWrite()) addToNestedSet(writeGrants, key, row.markerId(), row.propertyId());
        }
        return new NestedGrantMaps(readGrants, writeGrants);
    }

    private LinkPerspectiveGrantMaps buildLinkPerspectiveGrants() {
        Map<PrincipalKey, Map<UUID, Set<UUID>>> createGrants = new HashMap<>();
        Map<PrincipalKey, Map<UUID, Set<UUID>>> readGrants = new HashMap<>();
        Map<PrincipalKey, Map<UUID, Set<UUID>>> deleteGrants = new HashMap<>();
        for (var row : authRepo.getAllLinkPerspectiveGrants()) {
            var key = new PrincipalKey(row.principalType(), row.principalId());
            if (row.canCreate()) addToNestedSet(createGrants, key, row.markerId(), row.perspectiveId());
            if (row.canRead()) addToNestedSet(readGrants, key, row.markerId(), row.perspectiveId());
            if (row.canDelete()) addToNestedSet(deleteGrants, key, row.markerId(), row.perspectiveId());
        }
        return new LinkPerspectiveGrantMaps(createGrants, readGrants, deleteGrants);
    }

    private Map<PrincipalKey, Map<UUID, Set<UUID>>> buildExistenceGrants(List<AuthorizationRepository.MarkerScopedGrantRow> rows) {
        Map<PrincipalKey, Map<UUID, Set<UUID>>> grants = new HashMap<>();
        for (var row : rows) {
            addToNestedSet(grants, new PrincipalKey(row.principalType(), row.principalId()), row.markerId(), row.targetId());
        }
        return grants;
    }

    private void addToNestedSet(Map<PrincipalKey, Map<UUID, Set<UUID>>> index, PrincipalKey key, UUID markerId, UUID objectId) {
        index.computeIfAbsent(key, k -> new HashMap<>()).computeIfAbsent(markerId, k -> new HashSet<>()).add(objectId);
    }

    // Called by AuthorizationRepository's own write methods after every grant/revoke -- rebuilds
    // this node's copy immediately (so a "write then read" in the same request/test is always
    // consistent) and publishes so every other cluster node does the same.
    public void refreshCache() {
        rebuildCache();
        authorizationChangedTopic.publish(UUID.randomUUID().toString());
    }

    public boolean hasItemTypeGrant(UUID userId, Set<UUID> groupIds, UUID itemTypeId, String permission) {
        return getGrantedItemTypeIds(userId, groupIds, permission).contains(itemTypeId);
    }

    public Set<UUID> getGrantedItemTypeIds(UUID userId, Set<UUID> groupIds, String permission) {
        Set<UUID> result = new HashSet<>(cache.get().itemTypeGrants().getOrDefault(new PrincipalOpKey(PRINCIPAL_USER, userId, permission), Set.of()));
        for (UUID groupId : groupIds) {
            result.addAll(cache.get().itemTypeGrants().getOrDefault(new PrincipalOpKey(PRINCIPAL_GROUP, groupId, permission), Set.of()));
        }
        return result;
    }

    public Set<UUID> getGrantedItemReadMarkerIds(UUID userId, Set<UUID> groupIds) {
        return effectiveSet(cache.get().itemReadMarkers(), userId, groupIds);
    }

    public Set<UUID> getGrantedItemDeleteMarkerIds(UUID userId, Set<UUID> groupIds) {
        return effectiveSet(cache.get().itemDeleteMarkers(), userId, groupIds);
    }

    public Map<UUID, Set<UUID>> getPropertyReadGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().propertyReadGrants(), userId, groupIds);
    }

    public Map<UUID, Set<UUID>> getPropertyWriteGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().propertyWriteGrants(), userId, groupIds);
    }

    public Map<UUID, Set<UUID>> getLinkPropertyReadGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().linkPropertyReadGrants(), userId, groupIds);
    }

    public Map<UUID, Set<UUID>> getLinkPropertyWriteGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().linkPropertyWriteGrants(), userId, groupIds);
    }

    /** markerId -> perspectiveIds this marker grants link:create for. */
    public Map<UUID, Set<UUID>> getLinkPerspectiveCreateGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().linkPerspectiveCreateGrants(), userId, groupIds);
    }

    /** markerId -> perspectiveIds this marker grants link:read/traversal for. */
    public Map<UUID, Set<UUID>> getLinkPerspectiveReadGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().linkPerspectiveReadGrants(), userId, groupIds);
    }

    /** markerId -> perspectiveIds this marker grants link:delete for. */
    public Map<UUID, Set<UUID>> getLinkPerspectiveDeleteGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().linkPerspectiveDeleteGrants(), userId, groupIds);
    }

    /** markerId -> transition ids this marker grants transition:execute for. */
    public Map<UUID, Set<UUID>> getTransitionExecuteGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().transitionExecuteGrants(), userId, groupIds);
    }

    /** markerId -> state-machine ids this marker grants state-machine:start for. */
    public Map<UUID, Set<UUID>> getStateMachineStartGrantsByMarker(UUID userId, Set<UUID> groupIds) {
        return effectiveNestedSet(cache.get().stateMachineStartGrants(), userId, groupIds);
    }

    private Set<UUID> effectiveSet(Map<PrincipalKey, Set<UUID>> index, UUID userId, Set<UUID> groupIds) {
        Set<UUID> result = new HashSet<>(index.getOrDefault(new PrincipalKey(PRINCIPAL_USER, userId), Set.of()));
        for (UUID groupId : groupIds) {
            result.addAll(index.getOrDefault(new PrincipalKey(PRINCIPAL_GROUP, groupId), Set.of()));
        }
        return result;
    }

    private Map<UUID, Set<UUID>> effectiveNestedSet(Map<PrincipalKey, Map<UUID, Set<UUID>>> index, UUID userId, Set<UUID> groupIds) {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        mergeInto(result, index.get(new PrincipalKey(PRINCIPAL_USER, userId)));
        for (UUID groupId : groupIds) {
            mergeInto(result, index.get(new PrincipalKey(PRINCIPAL_GROUP, groupId)));
        }
        return result;
    }

    private void mergeInto(Map<UUID, Set<UUID>> target, Map<UUID, Set<UUID>> source) {
        if (source == null) return;
        source.forEach((markerId, objectIds) -> target.computeIfAbsent(markerId, k -> new HashSet<>()).addAll(objectIds));
    }
}
