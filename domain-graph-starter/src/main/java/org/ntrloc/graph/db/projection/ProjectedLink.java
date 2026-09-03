package org.ntrloc.graph.db.projection;

import org.springframework.lang.Nullable;

import java.util.Map;
import java.util.UUID;

// permissions governs the link edge itself (link_property:write -> edit, link:delete -> delete)
// -- reuses ProjectedItemPermissions rather than a near-identical twin type since the shape (an
// edit tree plus a delete flag) is genuinely the same concept, just resolved from
// link_property:write/link:delete grants instead of property:write/item:delete ones. Null both
// when the caller's ProjectionSpec didn't ask for permissions at all (the common case -- see
// ProjectionSpec.includePermissions) and, within a leaf edit tree, wherever nothing is writable.
public record ProjectedLink(UUID linkId, Map<String, Object> properties, ProjectedItem item, @Nullable ProjectedItemPermissions permissions) {}
