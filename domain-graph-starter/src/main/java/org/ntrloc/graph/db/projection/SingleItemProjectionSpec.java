package org.ntrloc.graph.db.projection;

import org.springframework.lang.Nullable;

import java.util.Map;
import java.util.UUID;

public record SingleItemProjectionSpec(String itemTypeName, UUID itemId,
                                        @Nullable Map<String, LinkProjectionSpec> links,
                                        @Nullable Boolean includePermissions,
                                        @Nullable Boolean includeStates) implements ProjectionSpec {

    // Preserves both pre-existing call shapes -- includePermissions/includeStates default to null
    // (false at the point of use, see ProjectionSpec's own comment).
    public SingleItemProjectionSpec(String itemTypeName, UUID itemId, @Nullable Map<String, LinkProjectionSpec> links) {
        this(itemTypeName, itemId, links, null, null);
    }

    public SingleItemProjectionSpec(String itemTypeName, UUID itemId) {
        this(itemTypeName, itemId, null, null, null);
    }
}
