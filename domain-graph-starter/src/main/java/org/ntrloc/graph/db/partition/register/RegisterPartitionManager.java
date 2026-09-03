package org.ntrloc.graph.db.partition.register;

import tools.jackson.databind.ObjectMapper;
import org.ntrloc.graph.db.partition.authorization.RequestPermissionContext;
import org.ntrloc.graph.db.partition.binary.BinaryPartitionManager;
import org.ntrloc.graph.db.partition.binary.BinaryPropertyObject;
import org.ntrloc.graph.db.projection.AndPredicate;
import org.ntrloc.graph.db.projection.AvailableTransition;
import org.ntrloc.graph.db.projection.CollectionProjectionSpec;
import org.ntrloc.graph.db.projection.FacetBucket;
import org.ntrloc.graph.db.projection.FacetFilter;
import org.ntrloc.graph.db.projection.LinkProjectionSpec;
import org.ntrloc.graph.db.projection.NotPredicate;
import org.ntrloc.graph.db.projection.Predicate;
import org.ntrloc.graph.db.partition.schema.SchemaManager;
import org.ntrloc.graph.db.partition.schema.definition.PropertyCardinality;
import org.ntrloc.graph.db.partition.schema.definition.PropertyType;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminLinkView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminSchemaView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateMachineView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminTransitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.ObjectAdminPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.event.SchemaChangeEvent;
import org.ntrloc.graph.db.partition.schema.event.SchemaChangeListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.context.expression.MapAccessor;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.ntrloc.graph.db.projection.ProjectedItem;
import org.ntrloc.graph.db.projection.ProjectedItemPermissions;
import org.ntrloc.graph.db.projection.ProjectedItemState;
import org.ntrloc.graph.db.projection.ProjectedLink;
import org.ntrloc.graph.db.projection.OrPredicate;
import org.ntrloc.graph.db.projection.ProjectionResult;
import org.ntrloc.graph.db.projection.PropertyExistencePredicate;
import org.ntrloc.graph.db.projection.PropertyValuePredicate;
import org.ntrloc.graph.db.projection.RangeFacetFilter;
import org.ntrloc.graph.db.projection.DateRangeFacetFilter;
import org.ntrloc.graph.db.projection.StateValuePredicate;
import org.ntrloc.graph.db.projection.TermsFacetFilter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class RegisterPartitionManager implements SchemaChangeListener {

    private static final Logger LOG = LoggerFactory.getLogger(RegisterPartitionManager.class);

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;
    private final BinaryPartitionManager binaryPartitionManager;
    private final SchemaManager schemaManager;

    // Keyed by pattern *string*, not item type -- a pure function cache (the same SpEL text always
    // compiles to the same Expression), so it needs no invalidation hook when a pattern is edited;
    // an edited pattern is simply a different string, a new cache entry. Unbounded is fine: the
    // realistic number of distinct patterns ever authored across a schema's lifetime is small.
    private final Map<String, Expression> compiledPatternCache = new ConcurrentHashMap<>();
    private final SpelExpressionParser spelParser = new SpelExpressionParser();

    // Memoizes resolveEffectiveDisplayLabelPatterns() by reference-identity of the last-seen
    // AdminSchemaView -- schemaManager.getAdminSchema() only ever returns a new instance when
    // rebuildCache() runs (on any schema mutation), so a normal run of project()/projectOne()/
    // projectAcrossTypes() (which each call assembleProjectedItems, and thus this resolution,
    // once) is a cache hit rather than an O(item types) supertype-chain walk every time.
    // schema and resolved are updated together as a pair, so they're held in one AtomicReference
    // rather than two volatile fields -- otherwise a racing reader could see the new schema but
    // the stale resolved map (or vice versa).
    private record DisplayLabelPatternsCache(AdminSchemaView schema, Map<String, String> resolved) {
    }

    private final AtomicReference<DisplayLabelPatternsCache> displayLabelPatternsCache =
            new AtomicReference<>(new DisplayLabelPatternsCache(null, Map.of()));

    public RegisterPartitionManager(JdbcClient jdbcClient, ObjectMapper objectMapper,
                                    BinaryPartitionManager binaryPartitionManager, SchemaManager schemaManager) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
        this.binaryPartitionManager = binaryPartitionManager;
        this.schemaManager = schemaManager;
    }

    private static final String PARAM_ITEM_ID = "itemId";
    private static final String PROPERTIES_JSON_ARROW_PREFIX = "rt.properties->>'";
    private static final String PARAM_ITEM_TYPE_ID = "itemTypeId";
    private static final String COL_REGISTER_ITEM_ID = "register_item_id";
    private static final String COL_ITEM_ID = "item_id";
    private static final String COL_PROPERTIES = "properties";
    private static final String COL_ITEM_TYPE = "item_type";
    private static final String COL_STATES = "states";
    private static final String COL_FACET_VALUE = "value";
    private static final String COL_FACET_COUNT = "count";
    private static final String PARAM_TRANSACTION_ID = "transactionId";
    private static final String PARAM_LINK_ID = "linkId";
    private static final String COL_REGISTER_LINK_ID = "register_link_id";
    private static final String STATE_CURRENT_STATE_ID = "currentStateId";
    private static final String PARAM_OLD_ID = "oldId";
    private static final String SQL_AND_FALSE = "AND FALSE";

    private static final Map<String, String> SYSTEM_SORT_COLUMNS = Map.of(
            PARAM_ITEM_ID,          "ri.item_id",
            "itemType",        "si.name",
            "createdAt",       "ri.created_at",
            "updatedAt",       "ri.updated_at",
            "visibilityState", "ri.state"
    );

    // Applied when CollectionProjectionSpec.limit()/offset() are null or out of range, rather than
    // ever running the main SELECT unbounded -- a projection with no filter narrow enough (or an
    // MCP tool call from an LLM that never thinks to set one) would otherwise return every
    // COMMITTED row of the item type in one response.
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 500;

    private int effectiveOffset(CollectionProjectionSpec spec) {
        return spec.offset() != null && spec.offset() > 0 ? spec.offset() : 0;
    }

    private int effectiveLimit(CollectionProjectionSpec spec) {
        if (spec.limit() == null || spec.limit() <= 0) return DEFAULT_LIMIT;
        return Math.min(spec.limit(), MAX_LIMIT);
    }

    private List<String> facetableFieldsFor(UUID itemTypeId) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(item -> collectFacetableFieldNames(item.properties(), ""))
                .orElse(List.of());
    }

    // Recurses into OBJECT properties so a nested facetable property (e.g. "additionalDetails.
    // reviewStatus") is auto-discovered by facets: [] the same as a top-level one, using the same
    // dot-path naming resolvePropertyId already understands for explicit facet requests -- this is
    // the only piece that was missing; querying a dot-path facet has worked since dot-notation was
    // added. An OBJECT property is itself never facetable (isTermsFacetable always rejects it, no
    // controlled list/BOOLEAN type applies), so it's only ever a container to recurse through here,
    // never added to the result itself. No cardinality guard needed on the recursion: OBJECT's own
    // valid cardinalities are SINGLE-only (PropertyType.validCardinalities), so a repeating group of
    // nested objects -- which would make a child's value multi-valued per item, the same ambiguity
    // LIST cardinality already rules out for a scalar -- can't occur here.
    private List<String> collectFacetableFieldNames(List<AdminPropertyDefinitionView> properties, String pathPrefix) {
        List<String> names = new ArrayList<>();
        for (AdminPropertyDefinitionView p : properties) {
            String qualifiedName = pathPrefix.isEmpty() ? p.name() : pathPrefix + "." + p.name();
            if (isTermsFacetable(p)) {
                names.add(qualifiedName);
            } else if (p instanceof ObjectAdminPropertyDefinitionView object) {
                names.addAll(collectFacetableFieldNames(object.properties(), qualifiedName));
            }
        }
        return names;
    }

    private List<String> resolveRequestedFacets(CollectionProjectionSpec spec, UUID itemTypeId) {
        if (spec.facets() == null) return List.of();
        if (spec.facets().isEmpty()) return facetableFieldsFor(itemTypeId);
        return spec.facets();
    }

    // Facetable is an explicit admin declaration (schema_property.facetable), not inferred purely
    // from shape -- see SchemaMutationValidation.requireFacetableEligible's own comment on why.
    // The structural check stays here too, not just at mutation time: it's what keeps an admin's
    // "facetable" flag from ever being treated as usable before a controlled-list-backed
    // property's list is actually attached (a real, normal sequencing gap in the admin workflow --
    // attaching a list requires the property to already have an id), rather than rejecting that
    // sequencing outright the way mutation-time validation does for combinations that could never
    // be valid. Not restricted to STRING -- any type a controlled list can back (see the admin
    // UI's own CONTROLLED_LIST_TYPES) is eligible once one is actually attached; BOOLEAN is the
    // one type that's facetable without a controlled list at all, since true/false is already a
    // closed set.
    private boolean isTermsFacetable(AdminPropertyDefinitionView p) {
        if (!p.facetable() || p.cardinality() != PropertyCardinality.SINGLE) return false;
        return p.type() == PropertyType.BOOLEAN || p.controlledListId() != null;
    }

    // Each dot-separated segment (one per level of OBJECT-property nesting) follows the same
    // identifier shape as a bare field name did before dot-paths existed. Quantifiers are
    // possessive (++/*+) so the engine never backtracks into them -- each segment's own \w*+ can't
    // be re-split against the outer repetition, which is what a client-controlled field name would
    // need to trigger catastrophic backtracking on a pathological input.
    private static final Pattern SAFE_FIELD_NAME = Pattern.compile("^[a-zA-Z]\\w*+(?:\\.[a-zA-Z]\\w*+)*+$");

    private String sanitizeFieldName(String field) {
        if (field == null || !SAFE_FIELD_NAME.matcher(field).matches()) {
            throw new IllegalArgumentException("Invalid facet field name: " + field);
        }
        return field;
    }

    private String orderByClause(CollectionProjectionSpec spec, UUID itemTypeId) {
        if (spec.sortField() == null || spec.sortField().isBlank()) return "ORDER BY ri.item_id ASC";
        String direction = "DESC".equalsIgnoreCase(spec.sortDirection()) ? "DESC" : "ASC";
        String column = SYSTEM_SORT_COLUMNS.containsKey(spec.sortField())
                ? SYSTEM_SORT_COLUMNS.get(spec.sortField())
                : typedSortExpression("rt.properties", resolveProperty(itemTypeId, spec.sortField()));
        return "ORDER BY " + column + " " + direction + " NULLS LAST, ri.item_id ASC";
    }

    // `->>` always yields text, so an unqualified ORDER BY on it sorts an INT property as "1", "10",
    // "2". Cast the extracted text to the property's real type so the sort is by value. NULLIF(_,'')
    // keeps an empty-string (or absent -> NULL) cell from failing the cast; NULLS LAST still applies.
    private static String typedSortExpression(String jsonbColumnAlias, AdminPropertyDefinitionView property) {
        String text = jsonbColumnAlias + "->>'" + property.id() + "'";
        return switch (property.type()) {
            case INT, LONG -> nullifCast(text, "bigint");
            case DOUBLE -> nullifCast(text, "double precision");
            case DATE -> nullifCast(text, "date");
            case DATETIME -> nullifCast(text, "timestamptz");
            case BOOLEAN -> nullifCast(text, "boolean");
            default -> text;
        };
    }

    private static String nullifCast(String text, String pgType) {
        return "NULLIF(" + text + ", '')::" + pgType;
    }

    private record RawItem(UUID registerItemId, UUID itemId, String itemType, Map<String, Object> properties, Map<String, Object> states) {}

    public ProjectionResult project(UUID itemTypeId, CollectionProjectionSpec spec, String binaryBaseUrl) {
        return project(itemTypeId, spec, binaryBaseUrl, RequestPermissionContext.forSuperuser());
    }

    public ProjectionResult project(UUID itemTypeId, CollectionProjectionSpec spec, String binaryBaseUrl, RequestPermissionContext permissions) {
        String tableName = tableNameFor(itemTypeId);
        SqlFragment filterFragment = combineFragments(List.of(
                buildPredicateFragment(spec.filter(), itemTypeId),
                buildItemReadPermissionFragment(permissions, "ri")));

        List<FacetFilter> activeFacetFilters = spec.facetFilters() != null ? spec.facetFilters() : List.of();
        List<String> requestedFacets = resolveRequestedFacets(spec, itemTypeId);

        // Build one SQL fragment per active facet filter, keyed by field
        AtomicInteger facetParamCounter = new AtomicInteger();
        Map<String, SqlFragment> facetFragmentsByField = new LinkedHashMap<>();
        for (FacetFilter ff : activeFacetFilters) {
            facetFragmentsByField.put(ff.field(), buildFacetFilterFragment(ff, itemTypeId, facetParamCounter));
        }
        SqlFragment allFacetFilters = combineFragments(facetFragmentsByField.values());

        // totalCount: base filter only
        long totalCount = runCount(tableName, itemTypeId, filterFragment, SqlFragment.empty());

        // facetedCount: base filter + all facet filters
        long facetedCount = activeFacetFilters.isEmpty() ? totalCount
                : runCount(tableName, itemTypeId, filterFragment, allFacetFilters);

        // Facet GROUP BY queries — disjunctive: each facet excludes its own active filter
        Map<String, List<FacetBucket>> facets = null;
        if (!requestedFacets.isEmpty()) {
            facets = new LinkedHashMap<>();
            for (String field : requestedFacets) {
                SqlFragment otherFilters = combineFragments(
                        facetFragmentsByField.entrySet().stream()
                                .filter(e -> !e.getKey().equals(field))
                                .map(Map.Entry::getValue)
                                .toList());
                facets.put(field, runTermsFacetQuery(tableName, itemTypeId, filterFragment, otherFilters, field));
            }
        }

        // Entirely separate from the property-facets block above -- no facetFilters interaction
        // (there's no equivalent "state machine facet filter" type, unlike TermsFacetFilter), just
        // the base predicate filter. Never auto-populated: only runs for machines the client
        // explicitly named (see CollectionProjectionSpec.stateMachineFacets' own comment).
        List<String> requestedStateMachineFacets = spec.stateMachineFacets() != null ? spec.stateMachineFacets() : List.of();
        Map<String, List<FacetBucket>> stateMachineFacets = null;
        if (!requestedStateMachineFacets.isEmpty()) {
            stateMachineFacets = new LinkedHashMap<>();
            for (String machineName : requestedStateMachineFacets) {
                stateMachineFacets.put(machineName, runStateMachineFacetQuery(tableName, itemTypeId, filterFragment, machineName));
            }
        }

        if (facetedCount == 0) {
            return new ProjectionResult(List.of(), totalCount, 0, facets, stateMachineFacets);
        }

        List<RawItem> rawItems = jdbcClient.sql("""
                SELECT ri.id AS register_item_id, ri.item_id, si.name AS item_type, rt.properties::text AS properties, rt.states::text AS states
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                JOIN schema_item si ON si.id = ri.item_type_id
                WHERE ri.item_type_id = :itemTypeId
                  AND ri.state = 'COMMITTED'
                  %s
                  %s
                %s
                LIMIT :limit OFFSET :offset
                """.formatted(tableName, filterFragment.sql(), allFacetFilters.sql(), orderByClause(spec, itemTypeId)))
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .params(mergeParams(filterFragment, allFacetFilters))
                .param("limit", effectiveLimit(spec))
                .param("offset", effectiveOffset(spec))
                .query((rs, n) -> new RawItem(
                        rs.getObject(COL_REGISTER_ITEM_ID, UUID.class),
                        rs.getObject(COL_ITEM_ID, UUID.class),
                        rs.getString(COL_ITEM_TYPE),
                        parseJsonb(rs.getString(COL_PROPERTIES)),
                        parseJsonb(rs.getString(COL_STATES))))
                .list();

        Map<UUID, List<String>> ownPropertyNames = propertyPathsByIdForItemType(itemTypeId);
        List<AdminStateMachineView> stateMachines = schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(AdminItemDefinitionView::stateMachines)
                .orElse(null);
        var items = assembleProjectedItems(rawItems, ownPropertyNames, stateMachines, binaryBaseUrl, spec.links(), permissions,
                Boolean.TRUE.equals(spec.includePermissions()), Boolean.TRUE.equals(spec.includeStates()));
        return new ProjectionResult(items, totalCount, facetedCount, facets, stateMachineFacets);
    }

    // --- Cross-type (trait/supertype-scoped) queries ---

    private static final Map<String, String> SYSTEM_SORT_COLUMNS_ACROSS_TYPES = Map.of(
            PARAM_ITEM_ID,     "combined.item_id",
            "itemType",        "combined.item_type",
            "createdAt",       "combined.created_at",
            "updatedAt",       "combined.updated_at",
            "visibilityState", "combined.visibility_state"
    );

    // Parallel to project(), not a refactor of it: the single-table path is proven and
    // read-performance-critical, and reshaping it to always route through an N-branch code path
    // risked destabilizing it for the (still overwhelmingly common) case of a type with no
    // descendants. EntityManagerImpl only calls this once a resolved type set actually has more
    // than one member.
    public ProjectionResult projectAcrossTypes(Set<UUID> itemTypeIds, CollectionProjectionSpec spec, String binaryBaseUrl) {
        return projectAcrossTypes(itemTypeIds, spec, binaryBaseUrl, RequestPermissionContext.forSuperuser());
    }

    public ProjectionResult projectAcrossTypes(Set<UUID> itemTypeIds, CollectionProjectionSpec spec, String binaryBaseUrl, RequestPermissionContext permissions) {
        List<UUID> branches = List.copyOf(itemTypeIds);
        // Property/sort/facet field names resolve against a single representative branch, not each
        // one individually -- deliberate: every branch in a resolved set is guaranteed (by
        // construction of SchemaManager's resolvers) to have inherited whichever properties are
        // common to the whole set, so any single member resolves them identically. A field valid on
        // only one specific sibling branch correctly fails to resolve here, same as it would
        // against project() for that branch alone -- querying it means querying that concrete type
        // directly, not polymorphically. Known minor wrinkle: Set has no defined order, so an empty
        // spec.facets() ("auto-populate every facetable property") auto-populates from whichever
        // branch happens to land here, not necessarily the query's literal root -- for a supertype
        // query that can pull in a sibling's own facetable property alongside the shared ones. Not
        // incorrect (branches lacking that property just contribute no values to it), just
        // possibly slightly more inclusive than strictly necessary in that one case.
        UUID representativeItemTypeId = branches.get(0);

        SqlFragment filterFragment = combineFragments(List.of(
                buildPredicateFragment(spec.filter(), representativeItemTypeId),
                buildItemReadPermissionFragment(permissions, "ri")));

        List<FacetFilter> activeFacetFilters = spec.facetFilters() != null ? spec.facetFilters() : List.of();
        List<String> requestedFacets = resolveRequestedFacets(spec, representativeItemTypeId);

        AtomicInteger facetParamCounter = new AtomicInteger();
        Map<String, SqlFragment> facetFragmentsByField = new LinkedHashMap<>();
        for (FacetFilter ff : activeFacetFilters) {
            facetFragmentsByField.put(ff.field(), buildFacetFilterFragment(ff, representativeItemTypeId, facetParamCounter));
        }
        SqlFragment allFacetFilters = combineFragments(facetFragmentsByField.values());

        SqlFragment baseSource = buildUnionedBranchSource(branches, filterFragment, SqlFragment.empty());
        long totalCount = jdbcClient.sql("SELECT COUNT(*) FROM (" + baseSource.sql() + ") combined")
                .params(baseSource.params())
                .query(Long.class).single();

        long facetedCount = totalCount;
        if (!activeFacetFilters.isEmpty()) {
            SqlFragment facetedSource = buildUnionedBranchSource(branches, filterFragment, allFacetFilters);
            facetedCount = jdbcClient.sql("SELECT COUNT(*) FROM (" + facetedSource.sql() + ") combined")
                    .params(facetedSource.params())
                    .query(Long.class).single();
        }

        Map<String, List<FacetBucket>> facets = null;
        if (!requestedFacets.isEmpty()) {
            facets = new LinkedHashMap<>();
            for (String field : requestedFacets) {
                SqlFragment otherFilters = combineFragments(
                        facetFragmentsByField.entrySet().stream()
                                .filter(e -> !e.getKey().equals(field))
                                .map(Map.Entry::getValue)
                                .toList());
                facets.put(field, runTermsFacetQueryAcrossTypes(branches, filterFragment, otherFilters, field, representativeItemTypeId));
            }
        }

        // No cross-type equivalent for state-machine facets in this pass -- naming one specific
        // machine id isn't guaranteed meaningful the same way across an arbitrary branch set the
        // way a merged property lookup is; left unsupported here rather than guessed at.
        Map<String, List<FacetBucket>> stateMachineFacets = null;

        if (facetedCount == 0) {
            return new ProjectionResult(List.of(), totalCount, 0, facets, stateMachineFacets);
        }

        SqlFragment mainSource = buildUnionedBranchSource(branches, filterFragment, allFacetFilters);
        List<RawItem> rawItems = jdbcClient.sql("""
                SELECT combined.register_item_id, combined.item_id, combined.item_type,
                       combined.properties::text AS properties, combined.states::text AS states
                FROM (%s) combined
                %s
                LIMIT :limit OFFSET :offset
                """.formatted(mainSource.sql(), orderByClauseAcrossTypes(spec, representativeItemTypeId)))
                .params(mainSource.params())
                .param("limit", effectiveLimit(spec))
                .param("offset", effectiveOffset(spec))
                .query((rs, n) -> new RawItem(
                        rs.getObject(COL_REGISTER_ITEM_ID, UUID.class),
                        rs.getObject(COL_ITEM_ID, UUID.class),
                        rs.getString(COL_ITEM_TYPE),
                        parseJsonb(rs.getString(COL_PROPERTIES)),
                        parseJsonb(rs.getString(COL_STATES))))
                .list();

        // Merged, not per-row-resolved: property ids are globally unique across the whole schema
        // (never scoped per type), so unioning each branch's own name lookup is a safe, unambiguous
        // merge -- see assembleProjectedItems' own comment on why an over-inclusive stateMachines
        // list is equally safe.
        Map<UUID, List<String>> mergedPropertyNames = new HashMap<>();
        List<AdminStateMachineView> mergedStateMachines = new ArrayList<>();
        for (UUID branchId : branches) {
            mergedPropertyNames.putAll(propertyPathsByIdForItemType(branchId));
            schemaManager.getAdminSchema().items().stream()
                    .filter(item -> item.id().equals(branchId))
                    .findFirst()
                    .map(AdminItemDefinitionView::stateMachines)
                    .ifPresent(mergedStateMachines::addAll);
        }

        var items = assembleProjectedItems(rawItems, mergedPropertyNames,
                mergedStateMachines.isEmpty() ? null : mergedStateMachines, binaryBaseUrl, spec.links(), permissions,
                Boolean.TRUE.equals(spec.includePermissions()), Boolean.TRUE.equals(spec.includeStates()));
        return new ProjectionResult(items, totalCount, facetedCount, facets, stateMachineFacets);
    }

    // One SELECT per branch (its own physical table, its own item-type-id parameter), UNION ALL'd
    // into a single source reusable for a count wrapper, a facet GROUP BY wrapper, or the main
    // paginated select -- filter/additionalFilter's own SQL text (and thus its :param placeholders)
    // is repeated verbatim in every branch, which is safe: JdbcClient binds a named parameter to
    // the same value everywhere it appears in one statement, so the shared filter params only need
    // to be bound once despite appearing N times. properties/states are left as JSONB here (not
    // cast to text) so a facet wrapper can access them directly -- only the final main-select
    // wrapper casts to text, matching what parseJsonb expects.
    private SqlFragment buildUnionedBranchSource(List<UUID> branches, SqlFragment filter, SqlFragment additionalFilter) {
        List<String> selects = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();
        params.putAll(filter.params());
        params.putAll(additionalFilter.params());
        for (int i = 0; i < branches.size(); i++) {
            UUID branchId = branches.get(i);
            String paramName = "branchType_" + i;
            params.put(paramName, branchId);
            selects.add("""
                    SELECT ri.id AS register_item_id, ri.item_id, si.name AS item_type,
                           rt.properties AS properties, rt.states AS states,
                           ri.created_at AS created_at, ri.updated_at AS updated_at, ri.state AS visibility_state
                    FROM register_item ri
                    JOIN %s rt ON rt.register_item_id = ri.id
                    JOIN schema_item si ON si.id = ri.item_type_id
                    WHERE ri.item_type_id = :%s
                      AND ri.state = 'COMMITTED'
                      %s
                      %s
                    """.formatted(tableNameFor(branchId), paramName, filter.sql(), additionalFilter.sql()));
        }
        return new SqlFragment(String.join(" UNION ALL ", selects), params);
    }

    private List<FacetBucket> runTermsFacetQueryAcrossTypes(List<UUID> branches, SqlFragment filter, SqlFragment otherFacetFilters,
                                                              String field, UUID representativeItemTypeId) {
        String propertyId = resolvePropertyId(representativeItemTypeId, sanitizeFieldName(field)).toString();
        SqlFragment source = buildUnionedBranchSource(branches, filter, otherFacetFilters);
        return jdbcClient.sql("""
                SELECT combined.properties->>'%s' AS value, COUNT(*) AS count
                FROM (%s) combined
                GROUP BY combined.properties->>'%s'
                ORDER BY count DESC, value ASC NULLS LAST
                """.formatted(propertyId, source.sql(), propertyId))
                .params(source.params())
                .query((rs, n) -> {
                    String value = rs.getString(COL_FACET_VALUE);
                    return new FacetBucket(value, value, rs.getLong(COL_FACET_COUNT));
                })
                .list();
    }

    private String orderByClauseAcrossTypes(CollectionProjectionSpec spec, UUID representativeItemTypeId) {
        if (spec.sortField() == null || spec.sortField().isBlank()) return "ORDER BY combined.item_id ASC";
        String direction = "DESC".equalsIgnoreCase(spec.sortDirection()) ? "DESC" : "ASC";
        String column = SYSTEM_SORT_COLUMNS_ACROSS_TYPES.containsKey(spec.sortField())
                ? SYSTEM_SORT_COLUMNS_ACROSS_TYPES.get(spec.sortField())
                : typedSortExpression("combined.properties", resolveProperty(representativeItemTypeId, spec.sortField()));
        return "ORDER BY " + column + " " + direction + " NULLS LAST, combined.item_id ASC";
    }

    private long runCount(String tableName, UUID itemTypeId, SqlFragment filter, SqlFragment additionalFilter) {
        return jdbcClient.sql("""
                SELECT COUNT(*)
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_type_id = :itemTypeId
                  AND ri.state = 'COMMITTED'
                  %s
                  %s
                """.formatted(tableName, filter.sql(), additionalFilter.sql()))
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .params(mergeParams(filter, additionalFilter))
                .query(Long.class)
                .single();
    }

    private List<FacetBucket> runTermsFacetQuery(String tableName, UUID itemTypeId,
                                                  SqlFragment filter, SqlFragment otherFacetFilters,
                                                  String field) {
        // sanitizeFieldName no longer carries the injection-prevention weight it used to here --
        // resolvePropertyId already rejects anything that isn't a real, known property name for
        // this item type, which subsumes it. Left in as a cheap, redundant first check.
        String propertyId = resolvePropertyId(itemTypeId, sanitizeFieldName(field)).toString();
        return jdbcClient.sql("""
                SELECT rt.properties->>'%s' AS value, COUNT(*) AS count
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_type_id = :itemTypeId
                  AND ri.state = 'COMMITTED'
                  %s
                  %s
                GROUP BY rt.properties->>'%s'
                ORDER BY count DESC, value ASC NULLS LAST
                """.formatted(propertyId, tableName, filter.sql(), otherFacetFilters.sql(), propertyId))
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .params(mergeParams(filter, otherFacetFilters))
                .query((rs, n) -> {
                    String value = rs.getString(COL_FACET_VALUE);
                    return new FacetBucket(value, value, rs.getLong(COL_FACET_COUNT));
                })
                .list();
    }

    // Unlike runTermsFacetQuery, a bucket's value (a state id) isn't human-readable on its own --
    // FacetBucket.value stays the id (stable, matches what a StateValuePredicate would need to
    // filter back down to this bucket) while .label carries the resolved name for display, finally
    // giving that value/label split real use (property facets today have identical value/label
    // since a property's own value already *is* its display form).
    //
    // Ordering isn't count-based (unlike runTermsFacetQuery) -- a state machine's states have a
    // meaningful workflow position, so buckets are sorted by rank-distance from the START
    // pseudostate (rankStatesByDistanceFromStart), tiebroken alphabetically by state name. A state
    // unreachable from START (should not normally happen, but the schema doesn't forbid an orphan)
    // sorts after every reachable state. The null-value bucket -- items that have never entered this
    // machine at all -- has no position in the graph, so it always sorts last, regardless of count.
    private List<FacetBucket> runStateMachineFacetQuery(String tableName, UUID itemTypeId, SqlFragment filter, String stateMachineName) {
        UUID stateMachineId = resolveStateMachineId(itemTypeId, stateMachineName);
        AdminStateMachineView machine = stateMachineView(stateMachineId);
        Map<UUID, String> stateNames = machine.states().stream()
                .collect(Collectors.toMap(AdminStateView::id, AdminStateView::name));
        Map<UUID, Integer> rankByStateId = rankStatesByDistanceFromStart(machine);
        List<FacetBucket> buckets = jdbcClient.sql("""
                SELECT (rt.states::jsonb)->'%s'->>'currentStateId' AS value, COUNT(*) AS count
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_type_id = :itemTypeId
                  AND ri.state = 'COMMITTED'
                  %s
                GROUP BY (rt.states::jsonb)->'%s'->>'currentStateId'
                """.formatted(stateMachineId, tableName, filter.sql(), stateMachineId))
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .params(filter.params())
                .query((rs, n) -> {
                    String stateId = rs.getString(COL_FACET_VALUE);
                    String label = stateId == null ? null : stateNames.get(UUID.fromString(stateId));
                    return new FacetBucket(stateId, label, rs.getLong(COL_FACET_COUNT));
                })
                .list();
        Comparator<FacetBucket> byWorkflowPosition = Comparator
                .comparing((FacetBucket b) -> b.value() == null)
                .thenComparing(b -> b.value() == null ? Integer.MAX_VALUE
                        : rankByStateId.getOrDefault(UUID.fromString(b.value()), Integer.MAX_VALUE))
                .thenComparing(b -> b.label() == null ? "" : b.label(), String.CASE_INSENSITIVE_ORDER);
        return buckets.stream().sorted(byWorkflowPosition).toList();
    }

    private AdminStateMachineView stateMachineView(UUID stateMachineId) {
        return schemaManager.getAdminSchema().items().stream()
                .flatMap(item -> Optional.ofNullable(item.stateMachines()).orElse(List.of()).stream())
                .filter(m -> m.id().equals(stateMachineId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown state machine: " + stateMachineId));
    }

    // BFS distance from the machine's START pseudostate, one hop per transition. A machine's states
    // form a graph, not a line (branches are normal, and re-entry after END is valid so cycles are
    // possible too) -- this is a best-effort rank, not a true total order, but it matches how the
    // diagram itself lays states out and needs no schema change to compute.
    private Map<UUID, Integer> rankStatesByDistanceFromStart(AdminStateMachineView machine) {
        Map<UUID, Integer> distanceByStateId = new HashMap<>();
        Optional<AdminStateView> start = machine.states().stream()
                .filter(s -> STATE_KIND_START.equals(s.kind()))
                .findFirst();
        if (start.isEmpty()) {
            return distanceByStateId;
        }
        Map<UUID, List<UUID>> outgoingByStateId = machine.states().stream()
                .collect(Collectors.toMap(AdminStateView::id,
                        s -> s.transitions().stream().map(AdminTransitionView::toStateId).toList()));
        Deque<UUID> frontier = new ArrayDeque<>();
        distanceByStateId.put(start.get().id(), 0);
        frontier.add(start.get().id());
        while (!frontier.isEmpty()) {
            UUID current = frontier.poll();
            int nextDistance = distanceByStateId.get(current) + 1;
            for (UUID next : outgoingByStateId.getOrDefault(current, List.of())) {
                if (!distanceByStateId.containsKey(next)) {
                    distanceByStateId.put(next, nextDistance);
                    frontier.add(next);
                }
            }
        }
        return distanceByStateId;
    }

    private SqlFragment buildFacetFilterFragment(FacetFilter facetFilter, UUID itemTypeId, AtomicInteger counter) {
        if (facetFilter instanceof TermsFacetFilter f) return buildTermsFacetFilterFragment(f, itemTypeId, counter);
        if (facetFilter instanceof RangeFacetFilter) throw new UnsupportedOperationException("Range facet filters not yet supported");
        if (facetFilter instanceof DateRangeFacetFilter) throw new UnsupportedOperationException("Date range facet filters not yet supported");
        throw new IllegalArgumentException("Unsupported facet filter: " + facetFilter.getClass().getSimpleName());
    }

    private SqlFragment buildTermsFacetFilterFragment(TermsFacetFilter f, UUID itemTypeId, AtomicInteger counter) {
        List<String> values = f.values() != null ? f.values() : List.of();
        boolean includeNull = f.includeNull();

        if (values.isEmpty() && !includeNull) {
            return SqlFragment.empty();
        }

        String propertyId = resolvePropertyId(itemTypeId, sanitizeFieldName(f.field())).toString();
        List<String> clauses = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        if (!values.isEmpty()) {
            String paramName = "facet_" + counter.getAndIncrement();
            clauses.add(PROPERTIES_JSON_ARROW_PREFIX + propertyId + "' IN (:" + paramName + ")");
            params.put(paramName, values);
        }
        if (includeNull) {
            clauses.add(PROPERTIES_JSON_ARROW_PREFIX + propertyId + "' IS NULL");
        }

        String sql = "AND (" + String.join(" OR ", clauses) + ")";
        return new SqlFragment(sql, params);
    }

    private SqlFragment combineFragments(Collection<SqlFragment> fragments) {
        String sql = fragments.stream()
                .map(SqlFragment::sql)
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining(" "));
        Map<String, Object> params = new HashMap<>();
        fragments.forEach(f -> params.putAll(f.params()));
        return new SqlFragment(sql, params);
    }

    @SafeVarargs
    private Map<String, Object> mergeParams(SqlFragment... fragments) {
        Map<String, Object> params = new HashMap<>();
        for (SqlFragment f : fragments) params.putAll(f.params());
        return params;
    }

    public Optional<ProjectedItem> projectOne(UUID itemTypeId, UUID itemId, String binaryBaseUrl) {
        return projectOne(itemTypeId, itemId, binaryBaseUrl, null);
    }

    public Optional<ProjectedItem> projectOne(UUID itemTypeId, UUID itemId, String binaryBaseUrl,
                                               @Nullable Map<String, LinkProjectionSpec> requestedLinks) {
        return projectOne(itemTypeId, itemId, binaryBaseUrl, requestedLinks, RequestPermissionContext.forSuperuser());
    }

    // Kept at "always include everything" -- unlike ProjectionSpec's HTTP-facing "default false"
    // policy (see its own comment), this overload has no spec to consult and predates
    // includePermissions/includeStates entirely; it's what every direct-Java caller (mostly tests)
    // already relied on. EntityManagerImpl.projectOne, the real HTTP-facing caller, goes through
    // the 7-arg overload below instead, with real flags read off the caller's own spec.
    public Optional<ProjectedItem> projectOne(UUID itemTypeId, UUID itemId, String binaryBaseUrl,
                                               @Nullable Map<String, LinkProjectionSpec> requestedLinks,
                                               RequestPermissionContext permissions) {
        return projectOne(itemTypeId, itemId, binaryBaseUrl, requestedLinks, permissions, true, true);
    }

    // permissions here only filters this item's *links* (see fetchLinksByItem) -- the item's own
    // existence isn't gated by this method at all, deliberately: unlike a paginated collection,
    // there's no totalCount/pagination correctness that requires it to be baked into this query,
    // so the caller (EntityManagerImpl) checks PermissionService.canReadItem before ever calling
    // this, exactly like it already does for the type-level requireReadAccess check -- cheaper,
    // since a denied request never pays for fetching the item's own (possibly large) properties.
    public Optional<ProjectedItem> projectOne(UUID itemTypeId, UUID itemId, String binaryBaseUrl,
                                               @Nullable Map<String, LinkProjectionSpec> requestedLinks,
                                               RequestPermissionContext permissions,
                                               boolean includePermissions, boolean includeStates) {
        List<RawItem> rawItems = jdbcClient.sql("""
                SELECT ri.id AS register_item_id, ri.item_id, si.name AS item_type, rt.properties::text AS properties, rt.states::text AS states
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                JOIN schema_item si ON si.id = ri.item_type_id
                WHERE ri.item_type_id = :itemTypeId
                  AND ri.item_id = :itemId
                  AND ri.state = 'COMMITTED'
                """.formatted(tableNameFor(itemTypeId)))
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .param(PARAM_ITEM_ID, itemId)
                .query((rs, n) -> new RawItem(
                        rs.getObject(COL_REGISTER_ITEM_ID, UUID.class),
                        rs.getObject(COL_ITEM_ID, UUID.class),
                        rs.getString(COL_ITEM_TYPE),
                        parseJsonb(rs.getString(COL_PROPERTIES)),
                        parseJsonb(rs.getString(COL_STATES))))
                .list();

        if (rawItems.isEmpty()) {
            return Optional.empty();
        }
        Map<UUID, List<String>> ownPropertyNames = propertyPathsByIdForItemType(itemTypeId);
        List<AdminStateMachineView> stateMachines = schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(AdminItemDefinitionView::stateMachines)
                .orElse(null);
        return Optional.of(assembleProjectedItems(rawItems, ownPropertyNames, stateMachines, binaryBaseUrl, requestedLinks, permissions,
                includePermissions, includeStates).get(0));
    }

    // --- Write side: staged at prepare (UNCOMMITTED), flipped/cleaned up at commit/abort ---
    // Updates are never in-place: prepare stages a whole new row: commit deletes the old
    // committed row for the same business id and flips the new one to COMMITTED.

    public UUID stageItemCreate(UUID itemId, UUID itemTypeId, Map<UUID, Object> properties, Map<UUID, UUID> initialStates, UUID transactionId) {
        Map<String, Object> states = new HashMap<>();
        initialStates.forEach((stateMachineId, stateId) -> states.put(stateMachineId.toString(), Map.of(STATE_CURRENT_STATE_ID, stateId.toString())));
        return insertItemRow(itemId, itemTypeId, keysToStrings(properties), states, transactionId);
    }

    // The only staging entry point for an already-existing item, regardless of how many ledger
    // entries (property update, state change, both) target it within one transaction. Deliberately
    // NOT split into separate "stage update" / "stage state change" methods: register_item rows are
    // swapped wholesale (never patched in place -- see commitItem), so each staging call reads
    // COMMITTED and inserts one new UNCOMMITTED row. Two independent staging calls for the same
    // item in the same transaction would each read the same stale COMMITTED row and produce two
    // competing UNCOMMITTED rows, which commitItem's single-row lookup can't resolve. The caller
    // (LedgerRegisterCoordinatorImpl.prepare) is responsible for merging every entry that targets a
    // given item within a transaction before calling this once -- this method has no way to detect
    // that on its own, and shouldn't need to.
    //
    // propertiesDiff/stateChanges/stateMachinesEnded are all allowed to be empty (a change to only
    // one is the common case); at least one is expected to be non-empty in practice.
    // stateMachinesEnded removes those machines from the item's _state entirely (END pseudostate
    // reached) -- no tombstone, since re-entry via START is valid.
    //
    // Deliberately deferred: stateChanges values are accepted unconditionally -- this does not check
    // that a given stateId is actually reachable from the item's current state via a defined
    // transition. Transition validity/guard enforcement lives in EntityManagerImpl.executeTransition.
    public UUID stageItemChange(UUID itemId, Map<UUID, Object> propertiesDiff, Map<UUID, UUID> stateChanges,
                                 Set<UUID> stateMachinesEnded, UUID transactionId) {
        UUID itemTypeId = findItemTypeId(itemId).orElseThrow();

        var current = jdbcClient.sql("""
                SELECT rt.properties::text AS properties, rt.states::text AS states
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_id = :itemId AND ri.state = 'COMMITTED'
                """.formatted(tableNameFor(itemTypeId)))
                .param(PARAM_ITEM_ID, itemId)
                .query((rs, n) -> new CurrentItemRowContent(parseJsonb(rs.getString(COL_PROPERTIES)), parseJsonb(rs.getString(COL_STATES))))
                .single();

        Map<String, Object> mergedProperties = propertiesDiff.isEmpty()
                ? current.properties()
                : mergeProperties(current.properties(), keysToStrings(propertiesDiff));

        Map<String, Object> mergedStates = new HashMap<>(current.states());
        stateChanges.forEach((stateMachineId, stateId) -> mergedStates.put(stateMachineId.toString(), Map.of(STATE_CURRENT_STATE_ID, stateId.toString())));
        stateMachinesEnded.forEach(stateMachineId -> mergedStates.remove(stateMachineId.toString()));

        return insertItemRow(itemId, itemTypeId, mergedProperties, mergedStates, transactionId);
    }

    private record CurrentItemRowContent(Map<String, Object> properties, Map<String, Object> states) {}

    private UUID insertItemRow(UUID itemId, UUID itemTypeId, Map<String, Object> properties, Map<String, Object> states, UUID transactionId) {
        UUID registerItemId = jdbcClient.sql("""
                INSERT INTO register_item (item_id, item_type_id, state, transaction_id)
                VALUES (:itemId, :itemTypeId, 'UNCOMMITTED', :transactionId)
                RETURNING id
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param(PARAM_ITEM_TYPE_ID, itemTypeId)
                .param(PARAM_TRANSACTION_ID, transactionId)
                .query(UUID.class)
                .single();

        jdbcClient.sql("INSERT INTO %s (register_item_id, properties, states) VALUES (:registerItemId, :properties::jsonb, :states::jsonb)"
                .formatted(tableNameFor(itemTypeId)))
                .param("registerItemId", registerItemId)
                .param(COL_PROPERTIES, writeProperties(properties))
                .param(COL_STATES, writeProperties(states))
                .update();

        return registerItemId;
    }

    public Optional<UUID> findItemTypeId(UUID itemId) {
        return jdbcClient.sql("SELECT item_type_id FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED'")
                .param(PARAM_ITEM_ID, itemId)
                .query(UUID.class)
                .optional();
    }

    // --- Marker-rule support: resolve a mutation's property values by name, for DMN input
    // variables. Both called from MarkerRuleEvaluationService during prepare(), before the
    // mutation's own ledger entry is appended -- see that class's own comment on why.

    /** A create's properties are already the complete set -- no current-row merge needed. */
    public Map<String, Object> resolvePropertiesByName(UUID itemTypeId, Map<UUID, Object> propertiesById) {
        return namesForIds(keysToStrings(propertiesById), propertyPathsByIdForItemType(itemTypeId));
    }

    // An update's properties() is a diff; DMN evaluation needs the item's full resulting property
    // set. Reads the same current-committed-row query stageItemChange uses internally and applies
    // the same merge -- duplicated rather than threaded through stageItemChange's own call, to
    // avoid restructuring that already-tested path for this first slice.
    public Map<String, Object> resolveMergedPropertiesByName(UUID itemId, UUID itemTypeId, Map<UUID, Object> propertiesDiff) {
        String currentJson = jdbcClient.sql("""
                SELECT rt.properties::text AS properties
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_id = :itemId AND ri.state = 'COMMITTED'
                """.formatted(tableNameFor(itemTypeId)))
                .param(PARAM_ITEM_ID, itemId)
                .query(String.class)
                .single();
        Map<String, Object> currentById = parseJsonb(currentJson);
        Map<String, Object> mergedById = propertiesDiff.isEmpty()
                ? currentById
                : mergeProperties(currentById, keysToStrings(propertiesDiff));
        return namesForIds(mergedById, propertyPathsByIdForItemType(itemTypeId));
    }

    public void commitItem(UUID itemId, UUID transactionId, UUID commitId) {
        UUID stagedRegisterItemId = jdbcClient.sql("""
                SELECT id FROM register_item WHERE item_id = :itemId AND transaction_id = :transactionId AND state = 'UNCOMMITTED'
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param(PARAM_TRANSACTION_ID, transactionId)
                .query(UUID.class)
                .single();

        Optional<UUID> oldRegisterItemId = jdbcClient.sql("""
                SELECT id FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED' AND id != :stagedRegisterItemId
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param("stagedRegisterItemId", stagedRegisterItemId)
                .query(UUID.class)
                .optional();

        // An update replaces the row wholesale (new surrogate id), but existing perspective rows
        // still point at the old one -- move them forward before deleting it, or the FK from
        // register_item_link_perspective (no cascade on that side) blocks the delete.
        if (oldRegisterItemId.isPresent()) {
            jdbcClient.sql("UPDATE register_item_link_perspective SET register_item_id = :newId WHERE register_item_id = :oldId")
                    .param("newId", stagedRegisterItemId)
                    .param(PARAM_OLD_ID, oldRegisterItemId.get())
                    .update();

            // register_item_marker also FKs to register_item.id, ON DELETE CASCADE -- without this,
            // the DELETE below would silently wipe every marker this item had. Same "row-swap
            // forgot to carry something forward" bug class as the states carry-forward fix, just via
            // an FK cascade instead of a missing field.
            jdbcClient.sql("UPDATE register_item_marker SET register_item_id = :newId WHERE register_item_id = :oldId")
                    .param("newId", stagedRegisterItemId)
                    .param(PARAM_OLD_ID, oldRegisterItemId.get())
                    .update();

            jdbcClient.sql("DELETE FROM register_item WHERE id = :oldId")
                    .param(PARAM_OLD_ID, oldRegisterItemId.get())
                    .update();
        }

        jdbcClient.sql("UPDATE register_item SET state = 'COMMITTED', commit_id = :commitId, updated_at = NOW() WHERE id = :stagedRegisterItemId")
                .param("commitId", commitId)
                .param("stagedRegisterItemId", stagedRegisterItemId)
                .update();
    }

    public void deleteItem(UUID itemId) {
        jdbcClient.sql("DELETE FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED'")
                .param(PARAM_ITEM_ID, itemId)
                .update();
    }

    public UUID stageLinkCreate(UUID linkId, UUID linkTypeId, RegisterLinkEndpoint endpointA, RegisterLinkEndpoint endpointB,
                                 Map<UUID, Object> properties, UUID transactionId) {
        UUID registerLinkId = insertLinkRow(linkId, linkTypeId, keysToStrings(properties), transactionId);
        insertPerspectiveRows(registerLinkId, List.of(endpointA, endpointB), transactionId);
        return registerLinkId;
    }

    public Optional<UUID> findLinkTypeId(UUID linkId) {
        return jdbcClient.sql("SELECT link_definition_id FROM register_link WHERE link_id = :linkId AND state = 'COMMITTED'")
                .param(PARAM_LINK_ID, linkId)
                .query(UUID.class)
                .optional();
    }

    public UUID stageLinkUpdate(UUID linkId, Map<UUID, Object> propertiesDiff, UUID transactionId) {
        UUID currentRegisterLinkId = jdbcClient.sql("SELECT id FROM register_link WHERE link_id = :linkId AND state = 'COMMITTED'")
                .param(PARAM_LINK_ID, linkId)
                .query(UUID.class)
                .single();

        UUID linkTypeId = findLinkTypeId(linkId).orElseThrow();

        Map<String, Object> currentProperties = jdbcClient.sql("SELECT properties::text AS properties FROM %s WHERE register_link_id = :id"
                .formatted(linkTableNameFor(linkTypeId)))
                .param("id", currentRegisterLinkId)
                .query((rs, n) -> parseJsonb(rs.getString(COL_PROPERTIES)))
                .single();

        Map<String, Object> merged = mergeProperties(currentProperties, keysToStrings(propertiesDiff));
        UUID registerLinkId = insertLinkRow(linkId, linkTypeId, merged, transactionId);

        // Endpoints don't change on an update (Section 8): re-resolve each one to whichever
        // register_item row currently represents it in this transaction, since an endpoint's
        // own item may itself be concurrently staged for update in the same transaction.
        List<RegisterLinkEndpoint> endpoints = jdbcClient.sql("""
                SELECT rilp.perspective_id, ri.item_id
                FROM register_item_link_perspective rilp
                JOIN register_item ri ON ri.id = rilp.register_item_id
                WHERE rilp.register_link_id = :oldLinkId
                """)
                .param("oldLinkId", currentRegisterLinkId)
                .query((rs, n) -> new RegisterLinkEndpoint(
                        rs.getObject("perspective_id", UUID.class),
                        rs.getObject(COL_ITEM_ID, UUID.class)))
                .list();
        insertPerspectiveRows(registerLinkId, endpoints, transactionId);

        return registerLinkId;
    }

    private UUID insertLinkRow(UUID linkId, UUID linkTypeId, Map<String, Object> properties, UUID transactionId) {
        UUID registerLinkId = jdbcClient.sql("""
                INSERT INTO register_link (link_id, link_definition_id, state, transaction_id)
                VALUES (:linkId, :linkTypeId, 'UNCOMMITTED', :transactionId)
                RETURNING id
                """)
                .param(PARAM_LINK_ID, linkId)
                .param("linkTypeId", linkTypeId)
                .param(PARAM_TRANSACTION_ID, transactionId)
                .query(UUID.class)
                .single();

        jdbcClient.sql("INSERT INTO %s (register_link_id, properties) VALUES (:registerLinkId, :properties::jsonb)"
                .formatted(linkTableNameFor(linkTypeId)))
                .param("registerLinkId", registerLinkId)
                .param(COL_PROPERTIES, writeProperties(properties))
                .update();

        return registerLinkId;
    }

    private void insertPerspectiveRows(UUID registerLinkId, List<RegisterLinkEndpoint> endpoints, UUID transactionId) {
        for (RegisterLinkEndpoint endpoint : endpoints) {
            UUID registerItemId = resolveRegisterItemId(endpoint.itemId(), transactionId);
            jdbcClient.sql("""
                    INSERT INTO register_item_link_perspective (register_link_id, perspective_id, register_item_id)
                    VALUES (:registerLinkId, :perspectiveId, :registerItemId)
                    """)
                    .param("registerLinkId", registerLinkId)
                    .param("perspectiveId", endpoint.perspectiveId())
                    .param("registerItemId", registerItemId)
                    .update();
        }
    }

    public void commitLink(UUID linkId, UUID transactionId, UUID commitId) {
        UUID stagedRegisterLinkId = jdbcClient.sql("""
                SELECT id FROM register_link WHERE link_id = :linkId AND transaction_id = :transactionId AND state = 'UNCOMMITTED'
                """)
                .param(PARAM_LINK_ID, linkId)
                .param(PARAM_TRANSACTION_ID, transactionId)
                .query(UUID.class)
                .single();

        jdbcClient.sql("DELETE FROM register_link WHERE link_id = :linkId AND state = 'COMMITTED' AND id != :stagedRegisterLinkId")
                .param(PARAM_LINK_ID, linkId)
                .param("stagedRegisterLinkId", stagedRegisterLinkId)
                .update();

        jdbcClient.sql("UPDATE register_link SET state = 'COMMITTED', commit_id = :commitId, updated_at = NOW() WHERE id = :stagedRegisterLinkId")
                .param("commitId", commitId)
                .param("stagedRegisterLinkId", stagedRegisterLinkId)
                .update();
    }

    public void deleteLink(UUID linkId) {
        jdbcClient.sql("DELETE FROM register_link WHERE link_id = :linkId AND state = 'COMMITTED'")
                .param(PARAM_LINK_ID, linkId)
                .update();
    }

    // Markers are never staged (see LedgerRegisterCoordinatorImpl.prepare) -- unlike a create/
    // update, there's no new register_item/register_link row being built, just a plain
    // insert/delete against an already-COMMITTED one, applied directly at commit like a delete.
    public void postItemMarkerAdd(UUID itemId, UUID markerId) {
        jdbcClient.sql("""
                INSERT INTO register_item_marker (register_item_id, marker_id)
                SELECT id, :markerId FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED'
                ON CONFLICT DO NOTHING
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param("markerId", markerId)
                .update();
    }

    public void postItemMarkerRemove(UUID itemId, UUID markerId) {
        jdbcClient.sql("""
                DELETE FROM register_item_marker
                WHERE marker_id = :markerId
                  AND register_item_id = (SELECT id FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED')
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param("markerId", markerId)
                .update();
    }

    // --- Mode-2 (field/capability-affecting) permission resolution: batched per-page marker
    // lookup + in-memory set arithmetic against RequestPermissionContext's grant maps. Never a
    // WHERE-clause concern (see buildItemReadPermissionFragment's own comment on the mode split).

    private Map<UUID, Set<UUID>> getMarkerIdsForRegisterItems(Collection<UUID> registerItemIds) {
        if (registerItemIds.isEmpty()) return Map.of();
        return jdbcClient.sql("SELECT register_item_id, marker_id FROM register_item_marker WHERE register_item_id IN (:ids)")
                .param("ids", registerItemIds)
                .query((rs, n) -> Map.entry(rs.getObject(COL_REGISTER_ITEM_ID, UUID.class), rs.getObject("marker_id", UUID.class)))
                .list().stream()
                .collect(Collectors.groupingBy(Map.Entry::getKey, Collectors.mapping(Map.Entry::getValue, Collectors.toSet())));
    }

    // Marker id -> name, for ProjectedItem.markers -- a display-only concern (never used for any
    // permission decision, unlike getMarkerIdsForRegisterItems above), so this queries
    // authorization_marker directly rather than going through AuthorizationRepository, matching
    // how this class already reads register_item_marker itself rather than depending on that repo.
    private Map<UUID, String> resolveMarkerNames(Set<UUID> markerIds) {
        if (markerIds.isEmpty()) return Map.of();
        return jdbcClient.sql("SELECT id, name FROM authorization_marker WHERE id IN (:ids)")
                .param("ids", markerIds)
                .query((rs, n) -> Map.entry(rs.getObject("id", UUID.class), rs.getString("name")))
                .list().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    // Union of a grant map's values across the markers a row actually carries -- the core mode-2
    // computation, reused for property:read/write, link_property:read/write, and (for the
    // perspective-keyed maps) link:read/delete alike, just with a different (markerIds,
    // grantsByMarker) pair each time.
    private Set<UUID> unionGrantedIds(Set<UUID> markerIds, Map<UUID, Set<UUID>> grantsByMarker) {
        if (markerIds.isEmpty() || grantsByMarker.isEmpty()) return Set.of();
        Set<UUID> result = new HashSet<>();
        for (UUID markerId : markerIds) {
            Set<UUID> granted = grantsByMarker.get(markerId);
            if (granted != null) result.addAll(granted);
        }
        return result;
    }

    // A write grant on a property implies read of it -- editing a value you can't see back is not a
    // coherent capability, and the admin UI already presents read as "implied by write". Callers
    // pass this merged (read UNION write) map into the read filter rather than the bare read map.
    // For binary properties there is no separate "download" grant -- read alone gates the bytes.
    private Map<UUID, Set<UUID>> readImpliedByWrite(Map<UUID, Set<UUID>> readGrants, Map<UUID, Set<UUID>> writeGrants) {
        Map<UUID, Set<UUID>> merged = new HashMap<>();
        readGrants.forEach((markerId, ids) -> merged.computeIfAbsent(markerId, k -> new HashSet<>()).addAll(ids));
        writeGrants.forEach((markerId, ids) -> merged.computeIfAbsent(markerId, k -> new HashSet<>()).addAll(ids));
        return merged;
    }

    // Filters a still-property-ID-keyed JSONB map down to what's readable, before namesForIds
    // resolves it -- redaction has to happen at the ID level, namesForIds has no concept of
    // permission. propertyReadGrantsByMarker == null means "don't filter at all" (superuser).
    private Map<String, Object> filterPropertiesByReadGrant(Map<String, Object> propertiesById, Set<UUID> markerIds,
                                                              @Nullable Map<UUID, Set<UUID>> propertyReadGrantsByMarker) {
        if (propertyReadGrantsByMarker == null) return propertiesById;
        Set<UUID> readable = unionGrantedIds(markerIds, propertyReadGrantsByMarker);
        if (readable.isEmpty()) return Map.of();
        Map<String, Object> filtered = new HashMap<>();
        propertiesById.forEach((idString, value) -> {
            if (readable.contains(UUID.fromString(idString))) filtered.put(idString, value);
        });
        return filtered;
    }

    // edit is a nested tree mirroring the item type's own property structure -- see
    // ProjectedItemPermissions' own comment for the exact shape and why. delete is a plain
    // capability flag. Superuser goes through the same buildEditTree walk as everyone else
    // (buildFullEditTree just never has to check a granted-id set to know the answer is "yes") --
    // no shortcut, so edit's shape never depends on who's asking.
    private ProjectedItemPermissions buildPermissions(RequestPermissionContext permissions, Set<UUID> markerIds,
                                                        Map<UUID, Set<UUID>> writeGrantsByMarker, Set<UUID> deleteGrantedMarkerIds,
                                                        List<AdminPropertyDefinitionView> rootProperties) {
        if (permissions.superuser()) {
            return new ProjectedItemPermissions(buildFullEditTree(rootProperties), true);
        }
        Set<UUID> grantedIds = unionGrantedIds(markerIds, writeGrantsByMarker);
        Map<String, Object> edit = grantedIds.isEmpty() ? null : buildEditTree(rootProperties, grantedIds);
        boolean canDelete = !Collections.disjoint(markerIds, deleteGrantedMarkerIds);
        return new ProjectedItemPermissions(edit, canDelete);
    }

    // Bottom-up: a node whose own scalar children are ALL granted collapses its "scalars" entry to
    // ["*"] rather than naming each one; an OBJECT child with nothing writable anywhere beneath it
    // is omitted from "objects" entirely, same as a fully-uncovered node returns null and is
    // omitted by its own parent. See ProjectedItemPermissions for why a fully-covered OBJECT child
    // is NOT itself collapsed to a bare "*" or similar -- every node keeps the same {scalars,
    // objects} shape regardless of how much of it is granted.
    private Map<String, Object> buildEditTree(List<AdminPropertyDefinitionView> properties, Set<UUID> grantedIds) {
        List<String> grantedScalarNames = new ArrayList<>();
        int totalScalarCount = 0;
        Map<String, Object> objectChildren = new LinkedHashMap<>();

        for (AdminPropertyDefinitionView p : properties) {
            if (p instanceof ObjectAdminPropertyDefinitionView o) {
                Map<String, Object> childNode = buildEditTree(o.properties(), grantedIds);
                if (childNode != null) objectChildren.put(o.name(), childNode);
            } else {
                totalScalarCount++;
                if (grantedIds.contains(p.id())) grantedScalarNames.add(p.name());
            }
        }

        if (grantedScalarNames.isEmpty() && objectChildren.isEmpty()) return null;

        Map<String, Object> node = new LinkedHashMap<>();
        if (!grantedScalarNames.isEmpty()) {
            node.put("scalars", grantedScalarNames.size() == totalScalarCount ? List.of("*") : List.copyOf(grantedScalarNames));
        }
        if (!objectChildren.isEmpty()) {
            node.put("objects", objectChildren);
        }
        return node;
    }

    // Superuser's counterpart to buildEditTree -- every scalar is granted by definition, so this
    // never needs a granted-id set, but keeps the identical {scalars, objects} shape (always "*",
    // never a per-name list) so a client can't tell which principal it's looking at from edit's
    // shape alone. Only returns null for a node with no properties at all, which real schema
    // content never produces.
    private Map<String, Object> buildFullEditTree(List<AdminPropertyDefinitionView> properties) {
        List<String> scalarNames = new ArrayList<>();
        Map<String, Object> objectChildren = new LinkedHashMap<>();

        for (AdminPropertyDefinitionView p : properties) {
            if (p instanceof ObjectAdminPropertyDefinitionView o) {
                Map<String, Object> childNode = buildFullEditTree(o.properties());
                if (childNode != null) objectChildren.put(o.name(), childNode);
            } else {
                scalarNames.add(p.name());
            }
        }

        if (scalarNames.isEmpty() && objectChildren.isEmpty()) return null;

        Map<String, Object> node = new LinkedHashMap<>();
        if (!scalarNames.isEmpty()) node.put("scalars", List.of("*"));
        if (!objectChildren.isEmpty()) node.put("objects", objectChildren);
        return node;
    }

    private List<AdminPropertyDefinitionView> rootPropertiesForItemTypeName(String itemTypeName) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.name().equals(itemTypeName))
                .findFirst()
                .map(AdminItemDefinitionView::properties)
                .orElse(List.of());
    }

    private List<AdminPropertyDefinitionView> rootPropertiesForItemType(UUID itemTypeId) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(AdminItemDefinitionView::properties)
                .orElse(List.of());
    }

    private List<AdminPropertyDefinitionView> rootPropertiesForLinkType(UUID linkTypeId) {
        return schemaManager.getAdminSchema().links().stream()
                .filter(link -> link.id().equals(linkTypeId))
                .findFirst()
                .map(AdminLinkView::properties)
                .orElse(List.of());
    }

    // A link's own permissions differ from buildPermissions' shape in exactly one way: delete is
    // perspective-keyed (marker_grant_link_perspective.can_delete), not a flat marker set, since
    // link:delete is anchored to the source item's marker via the specific perspective traversed --
    // same reasoning as link:read's own filtering above. Edit (link_property:write) uses the same
    // tree shape as buildPermissions, since link properties can themselves be OBJECT-typed too.
    private ProjectedItemPermissions buildLinkPermissions(RequestPermissionContext permissions, Set<UUID> sourceMarkerIds, UUID perspectiveId,
                                                            List<AdminPropertyDefinitionView> linkRootProperties) {
        if (permissions.superuser()) {
            return new ProjectedItemPermissions(buildFullEditTree(linkRootProperties), true);
        }
        Set<UUID> grantedIds = unionGrantedIds(sourceMarkerIds, permissions.linkPropertyWriteGrantsByMarker());
        Map<String, Object> edit = grantedIds.isEmpty() ? null : buildEditTree(linkRootProperties, grantedIds);
        boolean canDelete = unionGrantedIds(sourceMarkerIds, permissions.linkPerspectiveDeleteGrantsByMarker()).contains(perspectiveId);
        return new ProjectedItemPermissions(edit, canDelete);
    }

    public record RegisterLinkedItem(UUID linkId, UUID connectedItemId) {
    }

    public List<RegisterLinkedItem> findLinksForItem(UUID itemId) {
        return jdbcClient.sql("""
                SELECT rl.link_id AS link_id, ri_other.item_id AS connected_item_id
                FROM register_item ri_mine
                JOIN register_item_link_perspective rilp_mine  ON rilp_mine.register_item_id = ri_mine.id
                JOIN register_link                 rl          ON rl.id = rilp_mine.register_link_id AND rl.state = 'COMMITTED'
                JOIN register_item_link_perspective rilp_other ON rilp_other.register_link_id = rl.id AND rilp_other.id != rilp_mine.id
                JOIN register_item                 ri_other    ON ri_other.id = rilp_other.register_item_id
                WHERE ri_mine.item_id = :itemId AND ri_mine.state = 'COMMITTED'
                """)
                .param(PARAM_ITEM_ID, itemId)
                .query((rs, n) -> new RegisterLinkedItem(
                        rs.getObject("link_id", UUID.class),
                        rs.getObject("connected_item_id", UUID.class)))
                .list();
    }

    // Prefers this transaction's own staged (UNCOMMITTED) row for itemId over the existing
    // committed one, so a link create/update referencing an item concurrently staged in the
    // same transaction resolves to the row that will actually still exist after commit.
    private UUID resolveRegisterItemId(UUID itemId, UUID transactionId) {
        Optional<UUID> staged = jdbcClient.sql("""
                SELECT id FROM register_item WHERE item_id = :itemId AND transaction_id = :transactionId AND state = 'UNCOMMITTED'
                """)
                .param(PARAM_ITEM_ID, itemId)
                .param(PARAM_TRANSACTION_ID, transactionId)
                .query(UUID.class)
                .optional();
        if (staged.isPresent()) return staged.get();

        return jdbcClient.sql("SELECT id FROM register_item WHERE item_id = :itemId AND state = 'COMMITTED'")
                .param(PARAM_ITEM_ID, itemId)
                .query(UUID.class)
                .single();
    }

    public void discardStaged(UUID transactionId) {
        jdbcClient.sql("DELETE FROM register_item WHERE transaction_id = :transactionId AND state = 'UNCOMMITTED'")
                .param(PARAM_TRANSACTION_ID, transactionId)
                .update();
        jdbcClient.sql("DELETE FROM register_link WHERE transaction_id = :transactionId AND state = 'UNCOMMITTED'")
                .param(PARAM_TRANSACTION_ID, transactionId)
                .update();
    }

    private Map<String, Object> mergeProperties(Map<String, Object> current, Map<String, Object> diff) {
        Map<String, Object> merged = new HashMap<>(current);
        diff.forEach((key, value) -> {
            if (value == null) merged.remove(key);
            else merged.put(key, value);
        });
        return merged;
    }

    private String writeProperties(Map<String, Object> properties) {
        return objectMapper.writeValueAsString(properties);
    }

    // The register's JSONB property columns are keyed by property id (stringified), never by name
    // -- ids are stable, names are mutable (renameable via UpdatePropertyDefinitionMutation), and a
    // register row has to keep meaning the same thing across a rename with zero data migration.
    // This is the write-side half of that: LedgerEntry already carries properties keyed by id, so
    // there's nothing to resolve here, just a key-type change for JSON (object keys must be
    // strings). The read side (propertyPathsByIdForItemType/ForLinkType, used via namesForIds) is
    // the mirror image, resolving back to names only at the point a client-facing response is
    // assembled -- see assembleProjectedItems and fetchPropertiesByRegisterItemId.
    private Map<String, Object> keysToStrings(Map<UUID, Object> propertiesById) {
        Map<String, Object> byIdString = new HashMap<>();
        propertiesById.forEach((propertyId, value) -> byIdString.put(propertyId.toString(), value));
        return byIdString;
    }

    // Returns each leaf property's full name path from root to leaf, not just its own name --
    // storage is flat (a leaf's own id), but two leaves nested under different object properties
    // can share a name (e.g. dimensions.length vs packagingDimensions.length), so only the full
    // path is unambiguous. An OBJECT property's own id never appears here: nothing is ever stored
    // under a container's own id, only under each of its leaves'.
    private Map<UUID, List<String>> propertyPathsByIdForItemType(UUID itemTypeId) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(item -> propertyPaths(item.properties()))
                .orElse(Map.of());
    }

    private Map<UUID, List<String>> propertyPathsByIdForLinkType(UUID linkTypeId) {
        return schemaManager.getAdminSchema().links().stream()
                .filter(link -> link.id().equals(linkTypeId))
                .findFirst()
                .map(link -> propertyPaths(link.properties()))
                .orElse(Map.of());
    }

    private Map<UUID, List<String>> propertyPaths(List<AdminPropertyDefinitionView> properties) {
        Map<UUID, List<String>> result = new HashMap<>();
        for (AdminPropertyDefinitionView p : properties) {
            if (p instanceof ObjectAdminPropertyDefinitionView o) {
                propertyPaths(o.properties()).forEach((id, childPath) -> {
                    List<String> fullPath = new ArrayList<>();
                    fullPath.add(o.name());
                    fullPath.addAll(childPath);
                    result.put(id, fullPath);
                });
            } else {
                result.put(p.id(), List.of(p.name()));
            }
        }
        return result;
    }

    // The inverse lookup -- a client-supplied property *name* (in a filter, sort field, or facet
    // field) has to resolve to the id the register actually stores before it can be used in SQL.
    // This also gives predicate/sort/facet validation for free: an unknown name now fails clearly
    // here instead of silently generating a condition that matches nothing.
    //
    // propertyName may be a dot-separated path (e.g. "dimensions.length") reaching into one or more
    // OBJECT properties -- mirrors the write-side walk in
    // MutationRequestProcessor.resolveObjectPropertyValue, which resolves each segment against the
    // *containing* object property's own children rather than a global name index. That scoping is
    // required, not just mirrored for consistency: propertyPaths' own comment notes two leaves
    // nested under different object properties can share a name (dimensions.length vs
    // packagingDimensions.length), so only the full path is unambiguous.
    private UUID resolvePropertyId(UUID itemTypeId, String propertyName) {
        return resolveProperty(itemTypeId, propertyName).id();
    }

    private AdminPropertyDefinitionView resolveProperty(UUID itemTypeId, String propertyName) {
        List<AdminPropertyDefinitionView> rootProperties = schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .map(AdminItemDefinitionView::properties)
                .orElse(List.of());
        return resolveProperty(rootProperties, propertyName.split("\\."), propertyName);
    }

    private AdminPropertyDefinitionView resolveProperty(List<AdminPropertyDefinitionView> properties, String[] pathSegments, String fullPath) {
        AdminPropertyDefinitionView match = properties.stream()
                .filter(p -> p.name().equals(pathSegments[0]))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown property: " + fullPath));
        boolean isLastSegment = pathSegments.length == 1;
        if (match instanceof ObjectAdminPropertyDefinitionView object) {
            if (isLastSegment) {
                throw new IllegalArgumentException("Property is an object, not a leaf value: " + fullPath);
            }
            return resolveProperty(object.properties(), Arrays.copyOfRange(pathSegments, 1, pathSegments.length), fullPath);
        }
        if (!isLastSegment) {
            throw new IllegalArgumentException("Unknown property: " + fullPath);
        }
        return match;
    }

    // Same "translate name to id, never store the name" rule as resolvePropertyId, one level up:
    // a state machine name (like a property name) is mutable, so the states column has to be
    // keyed by the machine's stable id.
    public UUID resolveStateMachineId(UUID itemTypeId, String stateMachineName) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.id().equals(itemTypeId))
                .findFirst()
                .flatMap(item -> Optional.ofNullable(item.stateMachines()).orElse(List.of()).stream()
                        .filter(m -> m.name().equals(stateMachineName))
                        .map(AdminStateMachineView::id)
                        .findFirst())
                .orElseThrow(() -> new IllegalArgumentException("Unknown state machine: " + stateMachineName));
    }

    // A state's name is only unique within its own machine (schema_state's UNIQUE constraint is
    // (state_machine_id, name)), so resolution is scoped to a specific machine id, not global.
    public UUID resolveStateId(UUID stateMachineId, String stateName) {
        return schemaManager.getAdminSchema().items().stream()
                .flatMap(item -> Optional.ofNullable(item.stateMachines()).orElse(List.of()).stream())
                .filter(m -> m.id().equals(stateMachineId))
                .findFirst()
                .flatMap(m -> m.states().stream()
                        .filter(s -> s.name().equals(stateName))
                        .map(AdminStateView::id)
                        .findFirst())
                .orElseThrow(() -> new IllegalArgumentException("Unknown state: " + stateName));
    }

    // The item's current state id per state machine it is participating in (empty for machines it
    // isn't in). Reads the committed register row's states JSONB, shape
    // { "<stateMachineId>": { "currentStateId": "<stateId>" } }.
    public Map<UUID, UUID> currentStateIds(UUID itemId) {
        UUID itemTypeId = findItemTypeId(itemId).orElseThrow(() -> new IllegalArgumentException("Unknown item: " + itemId));
        String statesJson = jdbcClient.sql("""
                SELECT rt.states::text AS states
                FROM register_item ri
                JOIN %s rt ON rt.register_item_id = ri.id
                WHERE ri.item_id = :itemId AND ri.state = 'COMMITTED'
                """.formatted(tableNameFor(itemTypeId)))
                .param(PARAM_ITEM_ID, itemId)
                .query(String.class).optional().orElse("{}");
        Map<String, Object> byId = parseJsonb(statesJson);
        Map<UUID, UUID> result = new HashMap<>();
        byId.forEach((smId, entry) -> {
            if (entry instanceof Map<?, ?> m && m.get(STATE_CURRENT_STATE_ID) != null) {
                result.put(UUID.fromString(smId), UUID.fromString(m.get(STATE_CURRENT_STATE_ID).toString()));
            }
        });
        return result;
    }

    // Converts an id-keyed properties map (as read straight from the register's JSONB, always
    // flat -- storage never nests) into the nested name-keyed map a client actually wants to see,
    // by walking each stored leaf's full path and inserting it at the right depth, creating
    // intermediate maps as needed. A key that no longer resolves (the property was deleted from
    // the schema after this row was written) is silently dropped, same as before. The unchecked
    // cast is safe: only an OBJECT property's name ever occupies a non-final path segment, and a
    // container's own id is never a storage key (see propertyPaths), so a segment can't be both an
    // intermediate map and a leaf value at once.
    @SuppressWarnings("unchecked")
    private Map<String, Object> namesForIds(Map<String, Object> propertiesById, Map<UUID, List<String>> idToPath) {
        Map<String, Object> byName = new HashMap<>();
        propertiesById.forEach((idString, value) -> {
            List<String> path = idToPath.get(UUID.fromString(idString));
            if (path == null) return;
            Map<String, Object> cursor = byName;
            for (int i = 0; i < path.size() - 1; i++) {
                cursor = (Map<String, Object>) cursor.computeIfAbsent(path.get(i), k -> new HashMap<String, Object>());
            }
            cursor.put(path.get(path.size() - 1), value);
        });
        return byName;
    }

    private record LinkRow(UUID myRegisterItemId, String perspectiveName, UUID perspectiveId,
                           UUID registerLinkId, UUID linkId, UUID linkDefinitionId,
                           UUID linkedRegisterItemId, UUID linkedItemId, UUID linkedItemTypeId, String linkedItemType) {}

    private record BinaryPropertyRow(UUID registerItemId, UUID propertyId, String propertyName, UUID binaryId) {}

    private record AssembledBinary(UUID propertyId, String name, Object value) {}

    // Every item type's EFFECTIVE display-label pattern (own, or inherited from the nearest
    // supertype that defines one), keyed by type name -- name, not id, because RawItem/LinkRow
    // only carry the type name per row (schema_item.name is NOT NULL UNIQUE, so this is
    // unambiguous). Resolved for the whole schema, not just the branch(es) a given call is
    // querying: a linked item reachable via linksByItem below can be of a type completely
    // unrelated to the outer query, so a branch-scoped resolution (like the property-name merge
    // projectAcrossTypes already does) wouldn't cover it. Mirrors SchemaManager's own
    // implementsTraitInChain walk-up-supertype-chain idiom.
    private Map<String, String> resolveEffectiveDisplayLabelPatterns() {
        AdminSchemaView schema = schemaManager.getAdminSchema();
        DisplayLabelPatternsCache cached = displayLabelPatternsCache.get();
        if (schema == cached.schema()) {
            return cached.resolved();
        }
        Map<UUID, AdminItemDefinitionView> itemById = schema.items().stream()
                .collect(Collectors.toMap(AdminItemDefinitionView::id, i -> i));
        Map<String, String> resolved = new HashMap<>();
        for (AdminItemDefinitionView item : schema.items()) {
            AdminItemDefinitionView current = item;
            while (current != null && current.displayLabelPattern() == null) {
                current = current.supertypeId() == null ? null : itemById.get(current.supertypeId());
            }
            if (current != null) {
                resolved.put(item.name(), current.displayLabelPattern());
            }
        }
        displayLabelPatternsCache.set(new DisplayLabelPatternsCache(schema, resolved));
        return resolved;
    }

    private static final Pattern DISPLAY_LABEL_SEPARATOR_TRIM = Pattern.compile("(^[\\s,\\-/|]+)|([\\s,\\-/|]+$)");
    private static final Pattern DISPLAY_LABEL_WHITESPACE_RUN = Pattern.compile("\\s+");

    // pattern is the EFFECTIVE (already supertype-resolved) pattern for this item's type, or null
    // if none exists anywhere in its chain. A broken pattern (bad SpEL syntax, a property that
    // isn't actually a Map key so evaluation throws for some other reason) must never break
    // projection -- caught broadly and logged, not propagated. Evaluated with
    // SimpleEvaluationContext (not the default StandardEvaluationContext): no method calls, no
    // `new`, no type/bean references -- MapAccessor is registered so a pattern can reference
    // property names directly (`lastName`) rather than needing `['lastName']` map-index syntax.
    private String computeDisplayLabel(UUID itemId, Map<String, Object> props, String pattern) {
        if (pattern != null && !pattern.isBlank()) {
            try {
                Expression expression = compiledPatternCache.computeIfAbsent(pattern, spelParser::parseExpression);
                var context = SimpleEvaluationContext.forPropertyAccessors(new MapAccessor()).build();
                Object result = expression.getValue(context, props);
                String cleaned = DISPLAY_LABEL_WHITESPACE_RUN.matcher(
                        DISPLAY_LABEL_SEPARATOR_TRIM.matcher(String.valueOf(result == null ? "" : result)).replaceAll(""))
                        .replaceAll(" ").trim();
                if (!cleaned.isEmpty()) {
                    return cleaned;
                }
            } catch (Exception e) {
                LOG.warn("Display label pattern \"{}\" failed to evaluate for item {}: {}", pattern, itemId, e.getMessage());
            }
        }
        // No pattern anywhere in the chain, evaluation failed, or the cleaned result was empty --
        // a deliberate "fail loud" signal (the item's own id) that this type has no usable display
        // label configured, rather than silently guessing from a title/name-ish property.
        return itemId.toString();
    }

    // requestedLinks == null: today's original single-hop behavior, unchanged -- every direct
    // link, unfiltered, each linked item's own `links` left empty (Map.of()). requestedLinks !=
    // null: only the named perspectives come back, and any entry whose own LinkProjectionSpec
    // carries a non-empty `links` recurses exactly one more batched round trip for that
    // perspective's linked items -- never per item, so query count scales with depth actually
    // requested, not with result size. A perspective named in requestedLinks with no matching rows,
    // or with a spec whose own `links` is null/empty, simply doesn't recurse further.
    private Map<UUID, Map<String, List<ProjectedLink>>> fetchLinksByItem(
            List<UUID> myRegisterItemIds, @Nullable Map<String, LinkProjectionSpec> requestedLinks,
            RequestPermissionContext permissions, boolean includePermissions) {
        if (myRegisterItemIds.isEmpty() || (requestedLinks != null && requestedLinks.isEmpty())) {
            return Map.of();
        }

        SqlFragment permissionFragment = buildLinkVisibilityPermissionFragment(permissions);

        List<LinkRow> allLinkRows = jdbcClient.sql("""
                SELECT
                    rilp_mine.register_item_id  AS my_register_item_id,
                    silp_mine.name              AS perspective_name,
                    silp_mine.id                AS perspective_id,
                    rl.id                       AS register_link_id,
                    rl.link_id                  AS link_id,
                    rl.link_definition_id       AS link_definition_id,
                    ri_other.id                 AS linked_register_item_id,
                    ri_other.item_id            AS linked_item_id,
                    ri_other.item_type_id       AS linked_item_type_id,
                    si_other.name               AS linked_item_type
                FROM register_item ri_mine
                JOIN register_item_link_perspective rilp_mine  ON rilp_mine.register_item_id = ri_mine.id
                JOIN schema_entity_link_perspective silp_mine  ON silp_mine.id = rilp_mine.perspective_id
                JOIN register_link                 rl          ON rl.id = rilp_mine.register_link_id AND rl.state = 'COMMITTED'
                JOIN register_item_link_perspective rilp_other ON rilp_other.register_link_id = rl.id AND rilp_other.id != rilp_mine.id
                JOIN register_item                 ri_other    ON ri_other.id = rilp_other.register_item_id
                JOIN schema_item                   si_other    ON si_other.id = ri_other.item_type_id
                WHERE ri_mine.id IN (:rawItemIds)
                  AND ri_mine.state = 'COMMITTED'
                  %s
                  %s
                """.formatted(requestedLinks != null ? "AND silp_mine.name IN (:perspectiveNames)" : "", permissionFragment.sql()))
                .param("rawItemIds", myRegisterItemIds)
                .param("perspectiveNames", requestedLinks != null ? List.copyOf(requestedLinks.keySet()) : List.of())
                .params(permissionFragment.params())
                .query((rs, n) -> new LinkRow(
                        rs.getObject("my_register_item_id", UUID.class),
                        rs.getString("perspective_name"),
                        rs.getObject("perspective_id", UUID.class),
                        rs.getObject(COL_REGISTER_LINK_ID, UUID.class),
                        rs.getObject("link_id", UUID.class),
                        rs.getObject("link_definition_id", UUID.class),
                        rs.getObject("linked_register_item_id", UUID.class),
                        rs.getObject("linked_item_id", UUID.class),
                        rs.getObject("linked_item_type_id", UUID.class),
                        rs.getString("linked_item_type")))
                .list();

        if (allLinkRows.isEmpty()) {
            return Map.of();
        }

        // Mode-2, in-memory: link:read/create/delete are anchored to the *source* item's own
        // marker via the specific perspective traversed here (rilp_mine/silp_mine), never to a
        // marker on the link itself (link markers don't exist -- see
        // docs/ntrloc-marker-admin-ui-design-notes.md). This can't be a SQL semi-join the way
        // item:read is: it's a two-dimensional check (marker AND perspective together), and links
        // aren't independently paginated the way top-level items are, so there's no
        // pagination/totalCount correctness reason it has to be.
        Map<UUID, Set<UUID>> sourceItemMarkerIds = permissions.superuser() ? Map.of()
                : getMarkerIdsForRegisterItems(allLinkRows.stream().map(LinkRow::myRegisterItemId).distinct().toList());
        List<LinkRow> linkRows = permissions.superuser() ? allLinkRows : allLinkRows.stream()
                .filter(row -> !Collections.disjoint(
                        unionGrantedIds(sourceItemMarkerIds.getOrDefault(row.myRegisterItemId(), Set.of()), permissions.linkPerspectiveReadGrantsByMarker()),
                        Set.of(row.perspectiveId())))
                .toList();

        if (linkRows.isEmpty()) {
            return Map.of();
        }

        // Linked item's own properties use property:read/write (it's still an item, just reached
        // via a link); the link's own properties use link_property:read/write -- distinct grant
        // maps even though both may reference the same underlying schema_property ids. Link
        // properties aren't perspective-scoped (symmetric regardless of viewing side), so they're
        // gated by the source item's markers directly, same shape as an item's own properties --
        // merged (union) across every row reaching a given link, for the rare case the same link is
        // reachable from more than one source item in this same batch (e.g. a polymorphic page
        // containing both of a link's endpoints).
        Map<UUID, Set<UUID>> linkedItemMarkerIds = permissions.superuser() ? Map.of()
                : getMarkerIdsForRegisterItems(linkRows.stream().map(LinkRow::linkedRegisterItemId).distinct().toList());
        Map<UUID, Set<UUID>> linkOwnerMarkerIds = permissions.superuser() ? Map.of()
                : linkRows.stream().collect(Collectors.groupingBy(LinkRow::registerLinkId,
                        Collectors.flatMapping(row -> sourceItemMarkerIds.getOrDefault(row.myRegisterItemId(), Set.of()).stream(), Collectors.toSet())));

        Map<UUID, Map<String, Object>> linkedItemProperties = fetchPropertiesByRegisterItemId(
                linkRows.stream().collect(Collectors.groupingBy(
                        LinkRow::linkedItemTypeId,
                        Collectors.mapping(LinkRow::linkedRegisterItemId, Collectors.toList()))),
                COL_REGISTER_ITEM_ID, linkedItemMarkerIds, permissions.superuser() ? null
                        : readImpliedByWrite(permissions.propertyReadGrantsByMarker(), permissions.propertyWriteGrantsByMarker()));

        Map<UUID, Map<String, Object>> linkProperties = fetchPropertiesByRegisterItemId(
                linkRows.stream().collect(Collectors.groupingBy(
                        LinkRow::linkDefinitionId,
                        Collectors.mapping(LinkRow::registerLinkId, Collectors.toList()))),
                COL_REGISTER_LINK_ID, linkOwnerMarkerIds, permissions.superuser() ? null
                        : readImpliedByWrite(permissions.linkPropertyReadGrantsByMarker(), permissions.linkPropertyWriteGrantsByMarker()));

        Map<UUID, Map<String, List<ProjectedLink>>> nestedLinksByLinkedRegisterItemId = requestedLinks != null
                ? fetchNestedLinksForRequestedPerspectives(linkRows, requestedLinks, permissions, includePermissions)
                : Map.of();

        Map<String, String> displayLabelPatterns = resolveEffectiveDisplayLabelPatterns();
        Map<UUID, Map<String, List<ProjectedLink>>> finalNestedLinks = nestedLinksByLinkedRegisterItemId;
        return linkRows.stream()
                .collect(Collectors.groupingBy(
                        LinkRow::myRegisterItemId,
                        Collectors.groupingBy(
                                LinkRow::perspectiveName,
                                Collectors.mapping(row -> {
                                    Map<String, Object> linkedProps = linkedItemProperties.getOrDefault(row.linkedRegisterItemId(), Map.of());
                                    Set<UUID> linkedItemOwnMarkerIds = linkedItemMarkerIds.getOrDefault(row.linkedRegisterItemId(), Set.of());
                                    Set<UUID> mySourceMarkerIds = sourceItemMarkerIds.getOrDefault(row.myRegisterItemId(), Set.of());
                                    return new ProjectedLink(
                                        row.linkId(),
                                        linkProperties.getOrDefault(row.registerLinkId(), Map.of()),
                                        // states is left null for a linked item -- a projection's link expansion has
                                        // never fetched a linked item's full state (matching binary properties'
                                        // own scope, which the linked item also doesn't get); this is about the
                                        // top-level projected item's state, not every item reachable through it.
                                        new ProjectedItem(
                                                row.linkedItemId(),
                                                row.linkedItemType(),
                                                linkedProps,
                                                finalNestedLinks.getOrDefault(row.linkedRegisterItemId(), Map.of()),
                                                null,
                                                includePermissions
                                                        ? buildPermissions(permissions, linkedItemOwnMarkerIds,
                                                                permissions.propertyWriteGrantsByMarker(), permissions.itemDeleteGrantedMarkerIds(),
                                                                rootPropertiesForItemType(row.linkedItemTypeId()))
                                                        : null,
                                                computeDisplayLabel(row.linkedItemId(), linkedProps, displayLabelPatterns.get(row.linkedItemType())),
                                                null), // markers: not populated for a linked item yet -- see ProjectedItem's own comment
                                        includePermissions
                                                ? buildLinkPermissions(permissions, mySourceMarkerIds, row.perspectiveId(),
                                                        rootPropertiesForLinkType(row.linkDefinitionId()))
                                                : null
                                    );
                                },
                                Collectors.toList()))));
    }


    // Extracted from fetchLinksByItem purely to keep that method's own cognitive complexity down --
    // one more batched round trip per requested perspective that itself names further nested links,
    // never per item (fetchLinksByItem's own comment on why that's the scaling property that matters).
    private Map<UUID, Map<String, List<ProjectedLink>>> fetchNestedLinksForRequestedPerspectives(
            List<LinkRow> linkRows, Map<String, LinkProjectionSpec> requestedLinks, RequestPermissionContext permissions,
            boolean includePermissions) {
        Map<String, List<LinkRow>> rowsByPerspective = linkRows.stream()
                .collect(Collectors.groupingBy(LinkRow::perspectiveName));
        Map<UUID, Map<String, List<ProjectedLink>>> nested = new HashMap<>();
        for (var entry : rowsByPerspective.entrySet()) {
            LinkProjectionSpec childSpec = requestedLinks.get(entry.getKey());
            Map<String, LinkProjectionSpec> childLinks = childSpec != null ? childSpec.links() : null;
            if (childLinks == null || childLinks.isEmpty()) {
                continue;
            }
            List<UUID> childRegisterItemIds = entry.getValue().stream()
                    .map(LinkRow::linkedRegisterItemId).distinct().toList();
            // registerItemId is globally unique across every item type, so merging per-perspective
            // results here is safe even if two requested perspectives happened to reach the same item.
            nested.putAll(fetchLinksByItem(childRegisterItemIds, childLinks, permissions, includePermissions));
        }
        return nested;
    }

    // ownPropertyNames/stateMachines are pre-resolved by the caller rather than looked up here from
    // a single itemTypeId -- the single-table project()/projectOne() resolve them from their one
    // known type; projectAcrossTypes resolves a merged view across every branch instead (property
    // ids are globally unique across the whole schema, so a plain union of each branch's own
    // lookup is a safe, unambiguous merge -- an over-inclusive stateMachines list is likewise safe,
    // since buildProjectedItemStates already skips any machine a given row's states don't mention).
    private List<ProjectedItem> assembleProjectedItems(List<RawItem> rawItems, Map<UUID, List<String>> ownPropertyNames,
                                                         List<AdminStateMachineView> stateMachines, String binaryBaseUrl,
                                                         @Nullable Map<String, LinkProjectionSpec> requestedLinks,
                                                         RequestPermissionContext permissions,
                                                         boolean includePermissions, boolean includeStates) {
        // Nothing to assemble -- and every batch fetch below binds `... IN (:ids)`, which Postgres
        // rejects as a syntax error when the list is empty. A page whose offset lands past the last
        // row (offset >= totalCount) reaches here with an empty list; it must come back as [], not 500.
        if (rawItems.isEmpty()) return List.of();
        List<UUID> rawItemIds = rawItems.stream().map(RawItem::registerItemId).toList();
        Map<String, String> displayLabelPatterns = resolveEffectiveDisplayLabelPatterns();

        Map<UUID, Map<String, List<ProjectedLink>>> linksByItem = fetchLinksByItem(rawItemIds, requestedLinks, permissions, includePermissions);
        // A superuser used to skip this fetch entirely (nothing to filter by), but now also needs
        // it to populate ProjectedItem.markers -- so it's unconditional regardless of who's asking.
        Map<UUID, Set<UUID>> markerIdsByRegisterItemId = getMarkerIdsForRegisterItems(rawItemIds);
        // Names for every marker we might surface on a projected item: all of them for a superuser,
        // or just the caller's item:read-granted subset for everyone else. A non-superuser only ever
        // sees an item because one of its markers is granted (buildItemReadPermissionFragment), so a
        // visible item's disclosable list is non-empty in practice.
        Set<UUID> markerIdsToName = permissions.superuser()
                ? markerIdsByRegisterItemId.values().stream().flatMap(Set::stream).collect(Collectors.toSet())
                : permissions.grantedItemReadMarkerIds();
        Map<UUID, String> markerNamesById = resolveMarkerNames(markerIdsToName);

        List<BinaryPropertyRow> binaryRows = jdbcClient.sql("""
                SELECT rbp.register_item_id, rbp.property_id, sp.name AS property_name, rbp.binary_id
                FROM register_binary_property rbp
                JOIN schema_property sp ON sp.id = rbp.property_id
                WHERE rbp.register_item_id IN (:ids)
                """)
                .param("ids", rawItemIds)
                .query((rs, n) -> new BinaryPropertyRow(
                        rs.getObject(COL_REGISTER_ITEM_ID, UUID.class),
                        rs.getObject("property_id", UUID.class),
                        rs.getString("property_name"),
                        rs.getObject("binary_id", UUID.class)))
                .list();

        Set<UUID> binaryIds = binaryRows.stream().map(BinaryPropertyRow::binaryId).collect(Collectors.toSet());
        Map<UUID, BinaryPropertyObject> binaryObjects = binaryPartitionManager.getBinaryProperties(binaryIds);

        Map<UUID, List<AssembledBinary>> binaryPropsByItem = new HashMap<>();
        for (var row : binaryRows) {
            BinaryPropertyObject obj = binaryObjects.get(row.binaryId());
            if (obj == null) continue;
            binaryPropsByItem
                    .computeIfAbsent(row.registerItemId(), k -> new ArrayList<>())
                    .add(new AssembledBinary(row.propertyId(), row.propertyName(), assembleBinaryValue(obj, binaryBaseUrl)));
        }

        // Null for a superuser (no filtering); otherwise the read-granted (write implies read)
        // property-id grant map, resolved per item against that item's markers below.
        Map<UUID, Set<UUID>> effectiveReadGrants = permissions.superuser() ? null
                : readImpliedByWrite(permissions.propertyReadGrantsByMarker(), permissions.propertyWriteGrantsByMarker());

        AssemblyContext ctx = new AssemblyContext(ownPropertyNames, stateMachines, displayLabelPatterns,
                linksByItem, markerIdsByRegisterItemId, binaryPropsByItem, effectiveReadGrants,
                markerNamesById, permissions, includePermissions, includeStates);
        return rawItems.stream().map(raw -> assembleProjectedItem(raw, ctx)).toList();
    }

    private record AssemblyContext(
            Map<UUID, List<String>> ownPropertyNames,
            List<AdminStateMachineView> stateMachines,
            Map<String, String> displayLabelPatterns,
            Map<UUID, Map<String, List<ProjectedLink>>> linksByItem,
            Map<UUID, Set<UUID>> markerIdsByRegisterItemId,
            Map<UUID, List<AssembledBinary>> binaryPropsByItem,
            @Nullable Map<UUID, Set<UUID>> effectiveReadGrants,
            Map<UUID, String> markerNamesById,
            RequestPermissionContext permissions,
            boolean includePermissions,
            boolean includeStates) {}

    private ProjectedItem assembleProjectedItem(RawItem raw, AssemblyContext ctx) {
        Set<UUID> markerIds = ctx.markerIdsByRegisterItemId().getOrDefault(raw.registerItemId(), Set.of());
        Map<String, Object> readableProps = filterPropertiesByReadGrant(raw.properties(), markerIds, ctx.effectiveReadGrants());
        Map<String, Object> props = new HashMap<>(namesForIds(readableProps, ctx.ownPropertyNames()));
        // Binary properties are gated by property:read exactly like scalar ones -- there is no
        // separate download grant; read is equivalent to download.
        List<AssembledBinary> bins = ctx.binaryPropsByItem().get(raw.registerItemId());
        if (bins != null) {
            Set<UUID> readableBinaryIds = ctx.effectiveReadGrants() == null ? null
                    : unionGrantedIds(markerIds, ctx.effectiveReadGrants());
            for (var b : bins) {
                if (readableBinaryIds == null || readableBinaryIds.contains(b.propertyId())) {
                    props.put(b.name(), b.value());
                }
            }
        }
        var itemPermissions = ctx.includePermissions()
                ? buildPermissions(ctx.permissions(), markerIds,
                        ctx.permissions().propertyWriteGrantsByMarker(), ctx.permissions().itemDeleteGrantedMarkerIds(),
                        rootPropertiesForItemTypeName(raw.itemType()))
                : null;
        // Superuser sees every marker on the item; anyone else sees only the ones they hold an
        // item:read grant on -- never the mere existence of markers they can't read.
        Set<UUID> disclosableMarkerIds = ctx.permissions().superuser()
                ? markerIds
                : markerIds.stream().filter(ctx.permissions().grantedItemReadMarkerIds()::contains).collect(Collectors.toSet());
        List<String> markerNames = disclosableMarkerIds.stream()
                .map(ctx.markerNamesById()::get).filter(Objects::nonNull).sorted().toList();
        return new ProjectedItem(
                raw.itemId(),
                raw.itemType(),
                props,
                ctx.linksByItem().getOrDefault(raw.registerItemId(), Map.of()),
                ctx.includeStates() ? buildProjectedItemStates(raw.states(), ctx.stateMachines(), markerIds, ctx.permissions()) : null,
                itemPermissions,
                computeDisplayLabel(raw.itemId(), props, ctx.displayLabelPatterns().get(raw.itemType())),
                markerNames);
    }

    // One ProjectedItemState per state machine that's either active on this item, or inactive but
    // startable by this principal -- a machine that's neither (inactive, and this principal holds
    // no state-machine:start grant for it) has nothing to tell the caller: no current state to
    // report, no Start affordance to offer, so its entry is omitted entirely, same "absence means
    // nothing" convention buildEditTree uses. Returns null (not an empty map) when nothing survives
    // that filter -- either the type has no machines at all, or every machine on it does.
    private Map<String, ProjectedItemState> buildProjectedItemStates(Map<String, Object> statesById,
            List<AdminStateMachineView> stateMachines, Set<UUID> markerIds, RequestPermissionContext permissions) {
        if (stateMachines == null || stateMachines.isEmpty()) {
            return null;
        }
        Map<String, Object> states = statesById == null ? Map.of() : statesById;
        Set<UUID> startGrantedSmIds = permissions.superuser() ? Set.of()
                : unionGrantedIds(markerIds, permissions.stateMachineStartGrantsByMarker());
        Set<UUID> executeGrantedTransitionIds = permissions.superuser() ? Set.of()
                : unionGrantedIds(markerIds, permissions.transitionExecuteGrantsByMarker());

        Map<String, ProjectedItemState> result = new LinkedHashMap<>();
        for (AdminStateMachineView machine : stateMachines) {
            Optional<AdminStateView> currentState = currentStateOf(machine, states.get(machine.id().toString()));
            if (currentState.isPresent()) {
                AdminStateView cs = currentState.get();
                Map<UUID, String> kindByStateId = machine.states().stream()
                        .collect(Collectors.toMap(AdminStateView::id, AdminStateView::kind));
                List<AvailableTransition> available = cs.transitions().stream()
                        .filter(t -> permissions.superuser() || executeGrantedTransitionIds.contains(t.id()))
                        .map(t -> new AvailableTransition(t.id(), t.name(), t.toStateName(),
                                kindByStateId.getOrDefault(t.toStateId(), STATE_KIND_NORMAL)))
                        .toList();
                result.put(machine.name(), new ProjectedItemState(cs.name(), null, false, available));
            } else {
                boolean startable = permissions.superuser() || startGrantedSmIds.contains(machine.id());
                if (!startable) continue;
                result.put(machine.name(), new ProjectedItemState(null, null, startable, List.of()));
            }
        }
        return result.isEmpty() ? null : result;
    }

    private static final String STATE_KIND_NORMAL = "NORMAL";
    private static final String STATE_KIND_START = "START";

    // The item's current AdminStateView in this machine, or empty when the machine isn't active
    // (or the recorded state id no longer exists in the schema -- a dangling id is dropped, same
    // as namesForIds does for properties).
    private Optional<AdminStateView> currentStateOf(AdminStateMachineView machine, Object rawStateEntry) {
        if (!(rawStateEntry instanceof Map<?, ?> stateEntry)) return Optional.empty();
        Object currentStateId = stateEntry.get(STATE_CURRENT_STATE_ID);
        if (currentStateId == null) return Optional.empty();
        return machine.states().stream()
                .filter(s -> s.id().toString().equals(currentStateId.toString()))
                .findFirst();
    }

    private Map<String, Object> assembleBinaryValue(BinaryPropertyObject obj, String binaryBaseUrl) {
        Map<String, Object> value = new HashMap<>();
        value.put("id", obj.id().toString());
        value.put("sha256", obj.sha256());
        value.put("md5", obj.md5());
        value.put("mimeType", obj.mimeType());
        value.put("length", obj.length());
        value.put("url", binaryBaseUrl + "/api/binary/" + obj.id());
        if (obj.metadata() != null) value.put("metadata", obj.metadata());
        return value;
    }

    private record SqlFragment(String sql, Map<String, Object> params) {
        static SqlFragment empty() { return new SqlFragment("", Map.of()); }
    }

    private SqlFragment buildPredicateFragment(Predicate predicate, UUID itemTypeId) {
        if (predicate == null) return SqlFragment.empty();
        var translated = translatePredicate(predicate, itemTypeId, new AtomicInteger());
        return new SqlFragment("AND " + translated.sql(), translated.params());
    }

    // Mode-1 (existence-affecting) item:read check, expressed as a semi-join so it composes into
    // filterFragment and is honored by every downstream count/facet/list query built from it --
    // never a post-fetch filter, since totalCount/pagination must reflect the filtered set (see
    // docs/ntrloc-acl-design-notes.md "Performance model"). registerItemAlias is "ri" in both
    // project()'s single-table query and buildUnionedBranchSource()'s per-branch queries, so the
    // same fragment text is valid in both contexts. Empty granted set short-circuits to a literal
    // FALSE rather than "IN ()" (invalid SQL) -- correctly "nothing visible" without a query.
    private SqlFragment buildItemReadPermissionFragment(RequestPermissionContext permissions, String registerItemAlias) {
        if (permissions.superuser()) {
            return SqlFragment.empty();
        }
        if (permissions.grantedItemReadMarkerIds().isEmpty()) {
            return new SqlFragment(SQL_AND_FALSE, Map.of());
        }
        return new SqlFragment(
                "AND " + registerItemAlias + ".id IN (SELECT register_item_id FROM register_item_marker WHERE marker_id IN (:grantedItemReadMarkerIds))",
                Map.of("grantedItemReadMarkerIds", permissions.grantedItemReadMarkerIds()));
    }

    // The two checks fetchLinksByItem needs as a SQL semi-join beyond what's already established by
    // the time a row reaches that query: the *source* item (ri_mine) already passed the top-level
    // filter to be in the page this method was called with, so only the target's (ri_other)
    // type/instance readability needs checking here. Alias ri_other is fixed by fetchLinksByItem's
    // own query text, not parameterized.
    //
    // Link visibility itself (can this principal traverse *this* perspective from ri_mine) used to
    // be a third check here too, against the link's own marker -- markers only ever apply to items
    // now (see docs/ntrloc-marker-admin-ui-design-notes.md), so that check moved to an in-memory,
    // mode-2 filter in fetchLinksByItem instead (it's a two-dimensional marker+perspective check,
    // and links aren't independently paginated, so there's no correctness reason it has to be a
    // semi-join).
    private SqlFragment buildLinkVisibilityPermissionFragment(RequestPermissionContext permissions) {
        if (permissions.superuser()) {
            return SqlFragment.empty();
        }
        SqlFragment targetTypeCheck = permissions.readableItemTypeIds().isEmpty()
                ? new SqlFragment(SQL_AND_FALSE, Map.of())
                : new SqlFragment("AND ri_other.item_type_id IN (:readableItemTypeIds)",
                        Map.of("readableItemTypeIds", permissions.readableItemTypeIds()));
        SqlFragment targetItemReadCheck = permissions.grantedItemReadMarkerIds().isEmpty()
                ? new SqlFragment(SQL_AND_FALSE, Map.of())
                : new SqlFragment("AND ri_other.id IN (SELECT register_item_id FROM register_item_marker WHERE marker_id IN (:grantedItemReadMarkerIds))",
                        Map.of("grantedItemReadMarkerIds", permissions.grantedItemReadMarkerIds()));
        return combineFragments(List.of(targetTypeCheck, targetItemReadCheck));
    }

    private SqlFragment translatePredicate(Predicate predicate, UUID itemTypeId, AtomicInteger counter) {
        if (predicate instanceof AndPredicate and) {
            List<SqlFragment> children = and.predicates().stream()
                    .map(p -> translatePredicate(p, itemTypeId, counter))
                    .toList();
            String sql = children.stream()
                    .map(SqlFragment::sql)
                    .collect(Collectors.joining(" AND ", "(", ")"));
            Map<String, Object> params = new HashMap<>();
            children.forEach(c -> params.putAll(c.params()));
            return new SqlFragment(sql, params);
        } else if (predicate instanceof OrPredicate or) {
            List<SqlFragment> children = or.predicates().stream()
                    .map(p -> translatePredicate(p, itemTypeId, counter))
                    .toList();
            String sql = children.stream()
                    .map(SqlFragment::sql)
                    .collect(Collectors.joining(" OR ", "(", ")"));
            Map<String, Object> params = new HashMap<>();
            children.forEach(c -> params.putAll(c.params()));
            return new SqlFragment(sql, params);
        } else if (predicate instanceof NotPredicate not) {
            var child = translatePredicate(not.predicate(), itemTypeId, counter);
            return new SqlFragment("NOT (" + child.sql() + ")", child.params());
        } else if (predicate instanceof PropertyExistencePredicate p) {
            return new SqlFragment("jsonb_exists(rt.properties::jsonb, '" + resolvePropertyId(itemTypeId, p.propertyName()) + "')", Map.of());
        } else if (predicate instanceof PropertyValuePredicate p) {
            String paramName = "pred_" + counter.getAndIncrement();
            String sqlOp = switch (p.operator()) {
                case EQUALS              -> "=";
                case NOT_EQUALS          -> "!=";
                case LESS_THAN           -> "<";
                case LESS_THAN_OR_EQUAL  -> "<=";
                case GREATER_THAN        -> ">";
                case GREATER_THAN_OR_EQUAL -> ">=";
                case LIKE                -> "ILIKE";
            };
            return new SqlFragment(
                    "(rt.properties::jsonb)->>'" + resolvePropertyId(itemTypeId, p.propertyName()) + "' " + sqlOp + " :" + paramName,
                    Map.of(paramName, p.value()));
        } else if (predicate instanceof StateValuePredicate p) {
            UUID stateMachineId = resolveStateMachineId(itemTypeId, p.stateMachineName());
            UUID stateId = resolveStateId(stateMachineId, p.stateName());
            return new SqlFragment(
                    "(rt.states::jsonb)->'" + stateMachineId + "'->>'currentStateId' = '" + stateId + "'", Map.of());
        }
        throw new IllegalArgumentException("Unsupported predicate: " + predicate.getClass().getSimpleName());
    }

    // markerIdsByRegisterId/propertyReadGrantsByMarker: the mode-2 property-read filter, applied
    // at the ID level before namesForIds resolves names (namesForIds has no concept of
    // permission). propertyReadGrantsByMarker == null means "don't filter" (superuser).
    private Map<UUID, Map<String, Object>> fetchPropertiesByRegisterItemId(
            Map<UUID, List<UUID>> typeOrDefIdToRegisterIds, String idColumn,
            Map<UUID, Set<UUID>> markerIdsByRegisterId, @Nullable Map<UUID, Set<UUID>> propertyReadGrantsByMarker) {
        boolean isLinkTable = idColumn.equals(COL_REGISTER_LINK_ID);
        Map<UUID, Map<String, Object>> result = new HashMap<>();
        for (var entry : typeOrDefIdToRegisterIds.entrySet()) {
            UUID typeOrDefId = entry.getKey();
            String table = isLinkTable ? linkTableNameFor(typeOrDefId) : tableNameFor(typeOrDefId);
            Map<UUID, List<String>> idToPath = isLinkTable
                    ? propertyPathsByIdForLinkType(typeOrDefId)
                    : propertyPathsByIdForItemType(typeOrDefId);
            jdbcClient.sql("SELECT " + idColumn + ", properties::text FROM " + table + " WHERE " + idColumn + " IN (:ids)")
                    .param("ids", entry.getValue())
                    .query((rs, n) -> {
                        UUID registerId = rs.getObject(idColumn, UUID.class);
                        Map<String, Object> readable = filterPropertiesByReadGrant(parseJsonb(rs.getString(COL_PROPERTIES)),
                                markerIdsByRegisterId.getOrDefault(registerId, Set.of()), propertyReadGrantsByMarker);
                        return Map.entry(registerId, namesForIds(readable, idToPath));
                    })
                    .list()
                    .forEach(e -> result.put(e.getKey(), e.getValue()));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonb(String json) {
        if (json == null) return Map.of();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse properties JSONB", e);
        }
    }

    public static String tableNameFor(UUID typeId) {
        return "register_item_" + typeId.toString().replace("-", "_");
    }

    public static String linkTableNameFor(UUID linkTypeId) {
        return "register_link_" + linkTypeId.toString().replace("-", "_");
    }

    // --- Schema change reactions ---
    //
    // Each item/link type gets its own physical properties table (see tableNameFor/
    // linkTableNameFor), so that table has to be created the moment the type is defined and
    // dropped the moment it's deleted -- otherwise projection queries against a type created
    // after boot fail with "relation does not exist", since the static V1_0_0_1__baseline.sql Flyway
    // migration only creates the shared register_* tables once, for whatever types already
    // existed when it ran. Traits have no register-side table of their own (their properties live
    // in the owning item type's JSONB blob), so trait events are intentionally ignored here.

    @Override
    @EventListener
    public void onSchemaChange(SchemaChangeEvent event) {
        if (event instanceof SchemaChangeEvent.ItemTypeCreated e) {
            createItemTypeTable(e.itemTypeId());
        } else if (event instanceof SchemaChangeEvent.ItemTypeDeleted e) {
            dropItemTypeTable(e.itemTypeId());
        } else if (event instanceof SchemaChangeEvent.LinkTypeCreated e) {
            createLinkTypeTable(e.linkTypeId());
        } else if (event instanceof SchemaChangeEvent.LinkTypeDeleted e) {
            dropLinkTypeTable(e.linkTypeId());
        }
    }

    public void createItemTypeTable(UUID itemTypeId) {
        String tableName = tableNameFor(itemTypeId);
        // states is keyed by state-machine id (stringified), mirroring properties' own id-keying --
        // see keysToStrings/propertyPathsByIdForItemType's comment. Each value is a small object
        // (currently just currentStateId, currentTransitionId later) rather than the state id
        // directly, leaving room to add fields without a column/shape migration. Only item types
        // have this column -- state machines are schema_state_machine.item_definition_id-scoped,
        // links can't have one.
        jdbcClient.sql("""
                CREATE TABLE %s (
                    register_item_id UUID PRIMARY KEY REFERENCES register_item(id) ON DELETE CASCADE,
                    properties       JSONB,
                    states           JSONB
                )
                """.formatted(tableName)).update();
        jdbcClient.sql("CREATE INDEX ON %s USING GIN (properties)".formatted(tableName)).update();
        jdbcClient.sql("CREATE INDEX ON %s USING GIN (states)".formatted(tableName)).update();
    }

    public void dropItemTypeTable(UUID itemTypeId) {
        jdbcClient.sql("DROP TABLE IF EXISTS " + tableNameFor(itemTypeId)).update();
    }

    public void createLinkTypeTable(UUID linkTypeId) {
        String tableName = linkTableNameFor(linkTypeId);
        jdbcClient.sql("""
                CREATE TABLE %s (
                    register_link_id UUID PRIMARY KEY REFERENCES register_link(id) ON DELETE CASCADE,
                    properties       JSONB
                )
                """.formatted(tableName)).update();
        jdbcClient.sql("CREATE INDEX ON %s USING GIN (properties)".formatted(tableName)).update();
    }

    public void dropLinkTypeTable(UUID linkTypeId) {
        jdbcClient.sql("DROP TABLE IF EXISTS " + linkTableNameFor(linkTypeId)).update();
    }
}
