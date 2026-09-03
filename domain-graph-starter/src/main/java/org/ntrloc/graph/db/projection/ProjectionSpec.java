package org.ntrloc.graph.db.projection;

import org.springframework.lang.Nullable;

import java.util.Map;

public sealed interface ProjectionSpec permits SingleItemProjectionSpec, CollectionProjectionSpec {

    String itemTypeName();

    @Nullable Map<String, LinkProjectionSpec> links();

    // Both default to false (null treated the same as false at the point of use -- see
    // RegisterPartitionManager) rather than true: most projections are read-only lookups with no
    // intent to edit or drive a workflow, and both permissions and state resolution do real work
    // (a schema-tree walk per item for edit; a marker-grant lookup plus per-machine resolution for
    // states) that a caller who only wants property values shouldn't have to pay for. Applies to
    // the whole response tree uniformly -- the outer item and every linked item at every nesting
    // depth -- not configurable per link level; a caller wanting either turns both on for the
    // whole request.
    @Nullable Boolean includePermissions();

    @Nullable Boolean includeStates();
}
