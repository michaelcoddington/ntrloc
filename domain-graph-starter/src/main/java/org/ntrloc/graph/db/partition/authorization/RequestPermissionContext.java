package org.ntrloc.graph.db.partition.authorization;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

// Computed once per request (see PermissionService.buildContext), reused at every nesting depth
// of a projection response -- never recomputed per item, per link, or per recursion level. See
// docs/ntrloc-acl-design-notes.md "Request-scoped permission context".
//
// Deliberately a plain data record with no dependency back on PermissionService/AuthorizationRepository,
// so RegisterPartitionManager (which builds SQL and does the in-memory mode-2 resolution from
// this) doesn't need to depend on how these sets/maps are computed -- only on their shape.
//
// Mode 1 (existence-affecting, resolved as a SQL semi-join): grantedItemReadMarkerIds only now --
// link visibility used to be mode-1 too (a marker directly on the link), but markers only ever
// apply to items now (see docs/ntrloc-marker-admin-ui-design-notes.md, "Decision: markers apply to
// items only"), so link:read is resolved in-memory instead (mode 2, below) -- links aren't
// independently paginated the way top-level items are, so there's no pagination/totalCount
// correctness reason it has to be a semi-join.
//
// Mode 2 (field/capability-affecting, resolved in memory on an already-fetched page): everything
// else, including link visibility/deletion, which are now keyed by (markerId -> perspectiveIds)
// rather than a flat marker set, since link:read/create/delete are anchored to the *source* item's
// marker via a specific perspective, not to a marker on the link itself.
public record RequestPermissionContext(
        boolean superuser,
        Set<UUID> readableItemTypeIds,
        Set<UUID> grantedItemReadMarkerIds,
        Set<UUID> itemDeleteGrantedMarkerIds,
        Map<UUID, Set<UUID>> propertyReadGrantsByMarker,
        Map<UUID, Set<UUID>> propertyWriteGrantsByMarker,
        Map<UUID, Set<UUID>> linkPropertyReadGrantsByMarker,
        Map<UUID, Set<UUID>> linkPropertyWriteGrantsByMarker,
        Map<UUID, Set<UUID>> linkPerspectiveCreateGrantsByMarker,
        Map<UUID, Set<UUID>> linkPerspectiveReadGrantsByMarker,
        Map<UUID, Set<UUID>> linkPerspectiveDeleteGrantsByMarker,
        // Existence-only, marker-keyed: markerId -> transition ids / state-machine ids this
        // principal may execute / start. Mode 2 (in-memory resolution against an item's markers).
        Map<UUID, Set<UUID>> transitionExecuteGrantsByMarker,
        Map<UUID, Set<UUID>> stateMachineStartGrantsByMarker
) {
    public static RequestPermissionContext forSuperuser() {
        return new RequestPermissionContext(true, Set.of(), Set.of(), Set.of(),
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
    }
}
