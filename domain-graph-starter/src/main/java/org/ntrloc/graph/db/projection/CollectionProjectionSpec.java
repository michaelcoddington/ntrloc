package org.ntrloc.graph.db.projection;

import org.springframework.lang.Nullable;

import java.util.List;
import java.util.Map;

public record CollectionProjectionSpec(
        String itemTypeName,
        // Mutually exclusive with itemTypeName -- exactly one must be set (enforced by
        // EntityManagerImpl, not here). Resolves to every item type implementing this trait,
        // directly or via any ancestor in its supertype chain (see SchemaManager.
        // resolveTraitImplementerItemTypeIds). Kept as a plain nullable String, not a primitive,
        // like every other optional field here -- this app's Jackson setup requires a primitive
        // field be present in the JSON body, but tolerates an absent reference-typed one.
        @Nullable String traitName,
        @Nullable String sortField,
        @Nullable String sortDirection,
        @Nullable Predicate filter,
        @Nullable List<String> facets,
        @Nullable List<FacetFilter> facetFilters,
        // Deliberately separate from facets/facetFilters above, not a shared mechanism with a type
        // discriminator -- state-machine facets are a distinct concept (current state, not a
        // property) with their own response field (ProjectionResult.stateMachineFacets). Unlike
        // facets (an empty list means "every facetable property"), this has no such auto-populate
        // behavior: null or empty always means none -- computing these has a real query cost per
        // machine, so a client has to name exactly which machines it wants, every time.
        @Nullable List<String> stateMachineFacets,
        // Both optional -- RegisterPartitionManager applies a default page size when limit is null
        // (and clamps it to a hard maximum regardless) rather than returning every matching row
        // unbounded, and treats a null/negative offset as 0. Left as plain nullable Integers here,
        // not defaulted in the record itself, matching how facets/facetFilters are already
        // null-checked at the point of use rather than forced to a default up front.
        @Nullable Integer offset,
        @Nullable Integer limit,
        // null -- today's plain single-hop link behavior, unchanged. Non-null -- only the named
        // perspectives, recursing into whichever entries carry their own nested links. See
        // LinkProjectionSpec.
        @Nullable Map<String, LinkProjectionSpec> links,
        // See ProjectionSpec's own comment -- both default to false (null) rather than true.
        @Nullable Boolean includePermissions,
        @Nullable Boolean includeStates
) implements ProjectionSpec {

    // Preserves every existing 11-arg call site (this was the canonical constructor before
    // includePermissions/includeStates were added) -- both default to null.
    public CollectionProjectionSpec(String itemTypeName, @Nullable String traitName, @Nullable String sortField,
            @Nullable String sortDirection, @Nullable Predicate filter, @Nullable List<String> facets,
            @Nullable List<FacetFilter> facetFilters, @Nullable List<String> stateMachineFacets,
            @Nullable Integer offset, @Nullable Integer limit, @Nullable Map<String, LinkProjectionSpec> links) {
        this(itemTypeName, traitName, sortField, sortDirection, filter, facets, facetFilters, stateMachineFacets, offset, limit, links, null, null);
    }

    // Preserves every existing 10-arg call site (this was the canonical/only constructor before
    // links was added) -- links defaults to null.
    public CollectionProjectionSpec(String itemTypeName, @Nullable String traitName, @Nullable String sortField,
            @Nullable String sortDirection, @Nullable Predicate filter, @Nullable List<String> facets,
            @Nullable List<FacetFilter> facetFilters, @Nullable List<String> stateMachineFacets,
            @Nullable Integer offset, @Nullable Integer limit) {
        this(itemTypeName, traitName, sortField, sortDirection, filter, facets, facetFilters, stateMachineFacets, offset, limit, null);
    }

    public CollectionProjectionSpec(String itemTypeName, String sortField, String sortDirection, Predicate filter) {
        this(itemTypeName, null, sortField, sortDirection, filter, null, null, null, null, null);
    }

    public CollectionProjectionSpec(String itemTypeName, String sortField, String sortDirection) {
        this(itemTypeName, null, sortField, sortDirection, null, null, null, null, null, null);
    }
}
