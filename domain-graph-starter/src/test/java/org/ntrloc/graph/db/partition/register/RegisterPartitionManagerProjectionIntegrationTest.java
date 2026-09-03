package org.ntrloc.graph.db.partition.register;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.ntrloc.graph.AbstractIntegrationTest;
import org.ntrloc.graph.db.coordinator.LedgerRegisterCoordinator;
import org.ntrloc.graph.db.mutation.ExistingItemReference;
import org.ntrloc.graph.db.mutation.ItemCreateMutation;
import org.ntrloc.graph.db.mutation.ItemDeleteMutation;
import org.ntrloc.graph.db.mutation.ItemMutation;
import org.ntrloc.graph.db.mutation.LinkCreateMutation;
import org.ntrloc.graph.db.mutation.LinkEndpointReference;
import org.ntrloc.graph.db.mutation.MutationRequest;
import org.ntrloc.graph.db.mutation.MutationResponse;
import org.ntrloc.graph.db.partition.authorization.RequestPermissionContext;
import org.ntrloc.graph.db.partition.schema.SchemaManager;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreateItemDefinitionMutation;
import org.ntrloc.graph.db.partition.schema.definition.mutation.DeleteItemDefinitionMutation;
import org.ntrloc.graph.db.projection.AndPredicate;
import org.ntrloc.graph.db.projection.CollectionProjectionSpec;
import org.ntrloc.graph.db.projection.DateRangeFacetFilter;
import org.ntrloc.graph.db.projection.FacetBucket;
import org.ntrloc.graph.db.projection.LinkProjectionSpec;
import org.ntrloc.graph.db.projection.NotPredicate;
import org.ntrloc.graph.db.projection.Operator;
import org.ntrloc.graph.db.projection.OrPredicate;
import org.ntrloc.graph.db.projection.Predicate;
import org.ntrloc.graph.db.projection.ProjectionResult;
import org.ntrloc.graph.db.projection.PropertyExistencePredicate;
import org.ntrloc.graph.db.projection.PropertyValuePredicate;
import org.ntrloc.graph.db.projection.RangeFacetFilter;
import org.ntrloc.graph.db.projection.StateValuePredicate;
import org.ntrloc.graph.db.projection.TermsFacetFilter;
import org.ntrloc.graph.db.partition.ledger.ItemUpdateEntry;
import org.ntrloc.graph.domain.DomainInitializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

// Covers RegisterPartitionManager.project(...) and its supporting machinery (predicate
// translation, faceting, sorting/pagination, link expansion, state-change projection, schema-change
// table management) -- the read/query side of the class. The write side (create/update/delete via
// the ledger/coordinator) is already exercised by MutationControllerIntegrationTest and
// LedgerRegisterCoordinatorIntegrationTest; this file deliberately doesn't repeat that. State
// changes here go straight through the coordinator (setState() helper) rather than an EntityManager
// entry point -- StateMachineExecutionIntegrationTest covers start/executeTransition end to end.
class RegisterPartitionManagerProjectionIntegrationTest extends AbstractIntegrationTest {

    private static final String BOOK_TYPE = "RegisterProjectionTestBook";

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private RegisterPartitionManager registerPartitionManager;

    @Autowired
    private LedgerRegisterCoordinator coordinator;

    @Autowired
    private RegisterProjectionTestDomainInitializer fixture;

    @Autowired
    private SchemaManager schemaManager;

    @Autowired
    private JdbcClient jdbcClient;

    // Every book this test class creates gets this value stamped onto testMarker
    // (RegisterProjectionTestDomainInitializer's own comment on why that property exists), and
    // project() below always ANDs a "testMarker = this test's marker" predicate into whatever
    // filter the test asked for -- so a facet/sort/pagination query run by one test method can
    // never see another method's leftover rows, without every test having to remember to scope
    // itself manually. Tests that instead look up a single, specific item by id (setState,
    // projectOne) don't need this -- an exact id can't collide with another test's rows either way.
    private String marker;

    @BeforeEach
    void authenticateAsStandInUserAndGenerateUniqueMarker() {
        // Same stand-in mechanism as MutationControllerIntegrationTest -- see that class's own
        // comment on why "root" specifically.
        webTestClient = webTestClient.mutate().defaultHeader("X-Ntrloc-User", "root").build();
        marker = UUID.randomUUID().toString();
    }

    private UUID createBook(String title, Integer pageCount, Boolean inStock, String genre) {
        return createBook(title, pageCount, inStock, genre, null, null);
    }

    // dimensionsWidthCm/packagingWidthCm feed the two OBJECT properties the fixture defines
    // (RegisterProjectionTestDomainInitializer's own comment on why there are two, sharing a leaf
    // name) -- exists so dot-path predicate/sort tests can create books distinguishable only by a
    // nested value, without every other test having to pass two extra nulls through createBook.
    private UUID createBook(String title, Integer pageCount, Boolean inStock, String genre,
                             Integer dimensionsWidthCm, Integer packagingWidthCm) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("testMarker", marker);
        if (title != null) properties.put("title", title);
        if (pageCount != null) properties.put("pageCount", pageCount);
        if (inStock != null) properties.put("inStock", inStock);
        if (genre != null) properties.put("genre", genre);
        if (dimensionsWidthCm != null) properties.put("dimensions", Map.of("widthCm", dimensionsWidthCm));
        if (packagingWidthCm != null) properties.put("packaging", Map.of("widthCm", packagingWidthCm));

        MutationResponse response = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(new ItemCreateMutation(null, BOOK_TYPE, properties)), List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        return response.items().get(0).itemId();
    }

    // Sets dimensions.material specifically -- the fixture's one nested, facetable property
    // (RegisterProjectionTestDomainInitializer's own comment on why it lives under "dimensions"
    // rather than as a new top-level property). Kept separate from the main createBook overloads
    // above, which are already at their practical parameter-count limit and have no other caller
    // that needs this field.
    private UUID createBookWithDimensionsMaterial(String title, String material) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("testMarker", marker);
        properties.put("title", title);
        properties.put("dimensions", Map.of("material", material));

        MutationResponse response = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(new ItemCreateMutation(null, BOOK_TYPE, properties)), List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        return response.items().get(0).itemId();
    }

    // Moves an item to a named state by staging an ItemUpdateEntry with only its stateChanges facet
    // through the coordinator -- exactly what the retired EntityManager.setItemState stub did
    // internally. The real transition entry points are covered by StateMachineExecutionIntegrationTest;
    // these projection/facet tests only need a recorded current state, not START-pseudostate wiring.
    private void setState(UUID itemId, String machineName, String stateName) {
        UUID smId = registerPartitionManager.resolveStateMachineId(fixture.bookTypeId(), machineName);
        UUID stateId = registerPartitionManager.resolveStateId(smId, stateName);
        UUID txn = UUID.randomUUID();
        coordinator.prepare(List.of(new ItemUpdateEntry(itemId, Map.of(), Map.of(smId, stateId), Set.of(), Set.of(), Set.of())), txn, null);
        coordinator.commit(txn, UUID.randomUUID());
    }

    private ProjectedItemsAndFacets project(CollectionProjectionSpec spec) {
        Predicate scopedToThisTest = new PropertyValuePredicate("testMarker", Operator.EQUALS, marker);
        Predicate combinedFilter = spec.filter() == null
                ? scopedToThisTest
                : new AndPredicate(List.of(scopedToThisTest, spec.filter()));
        var scopedSpec = new CollectionProjectionSpec(spec.itemTypeName(), spec.traitName(), spec.sortField(), spec.sortDirection(),
                combinedFilter, spec.facets(), spec.facetFilters(), spec.stateMachineFacets(), spec.offset(), spec.limit(), spec.links());
        var result = registerPartitionManager.project(fixture.bookTypeId(), scopedSpec, "http://binary");
        return new ProjectedItemsAndFacets(result);
    }

    // Thin wrapper purely so assertions below can say `.titles()` instead of repeating the same
    // "extract title property from every returned item" stream everywhere.
    private record ProjectedItemsAndFacets(ProjectionResult result) {
        List<String> titles() {
            return result.items().stream().map(i -> (String) i.properties().get("title")).toList();
        }
    }

    // --- Predicate translation ---

    @Test
    void propertyValuePredicate_equals_matchesOnlyTheExactValue() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("title", Operator.EQUALS, "Dune"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void propertyValuePredicate_notEquals_excludesTheGivenValue() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new PropertyValuePredicate("title", Operator.NOT_EQUALS, "Dune"));

        assertThat(project(spec).titles()).containsExactly("Foundation");
    }

    @Test
    void propertyValuePredicate_like_isCaseInsensitiveSubstringMatch() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("title", Operator.LIKE, "%dun%"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void propertyValuePredicate_comparisonOperators_onNumericProperty() {
        // pageCount is stored as JSONB text (rt.properties->>'id'), and PropertyValuePredicate.value
        // is itself a plain String -- comparisons are therefore lexicographic, not numeric. Using
        // same-digit-length values (300/400/500) keeps lexicographic and numeric ordering in
        // agreement, so this test exercises the operator translation itself without also asserting
        // on that text-vs-numeric-comparison behavior, which is a separate concern.
        createBook("Short", 300, true, "Fiction");
        createBook("Medium", 400, true, "Fiction");
        createBook("Long", 500, true, "Fiction");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new PropertyValuePredicate("pageCount", Operator.GREATER_THAN, "400"))).titles())
                .containsExactly("Long");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new PropertyValuePredicate("pageCount", Operator.GREATER_THAN_OR_EQUAL, "400"))).titles())
                .containsExactly("Long", "Medium");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new PropertyValuePredicate("pageCount", Operator.LESS_THAN, "400"))).titles())
                .containsExactly("Short");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new PropertyValuePredicate("pageCount", Operator.LESS_THAN_OR_EQUAL, "400"))).titles())
                .containsExactly("Medium", "Short");
    }

    @Test
    void andPredicate_requiresAllChildrenToMatch() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Dune Messiah", 300, false, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new AndPredicate(List.of(
                        new PropertyValuePredicate("title", Operator.LIKE, "%dune%"),
                        new PropertyValuePredicate("inStock", Operator.EQUALS, "true"))));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void orPredicate_matchesIfEitherChildMatches() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Reference");
        createBook("Neuromancer", 300, true, "Reference");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC",
                new OrPredicate(List.of(
                        new PropertyValuePredicate("title", Operator.EQUALS, "Dune"),
                        new PropertyValuePredicate("title", Operator.EQUALS, "Foundation"))));

        assertThat(project(spec).titles()).containsExactly("Dune", "Foundation");
    }

    @Test
    void notPredicate_invertsTheChildMatch() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Reference");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new NotPredicate(new PropertyValuePredicate("title", Operator.EQUALS, "Dune")));

        assertThat(project(spec).titles()).containsExactly("Foundation");
    }

    @Test
    void propertyExistencePredicate_matchesOnlyItemsWhereThePropertyWasSet() {
        createBook("Dune", 400, true, "Fiction");
        createBook(null, 100, true, "Fiction"); // no title at all -- the point of this test

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyExistencePredicate("title"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void stateValuePredicate_matchesItemsCurrentlyInThatState() {
        UUID outOfStockBook = createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        setState(outOfStockBook, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new StateValuePredicate(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                        RegisterProjectionTestDomainInitializer.OUT_OF_STOCK));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void predicateOnUnknownProperty_throwsIllegalArgumentException() {
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("noSuchProperty", Operator.EQUALS, "x"));

        assertThatThrownBy(() -> project(spec))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("noSuchProperty");
    }

    // --- Dot-path resolution into OBJECT properties ---

    @Test
    void propertyValuePredicate_dotPath_filtersOnANestedObjectLeaf() {
        createBook("Dune", 400, true, "Fiction", 20, null);
        createBook("Foundation", 300, true, "Fiction", 15, null);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("dimensions.widthCm", Operator.EQUALS, "20"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void propertyValuePredicate_dotPath_distinguishesSameLeafNameUnderDifferentObjectProperties() {
        // Both books set widthCm to 20 under "dimensions"; only "Dune" also sets it under
        // "packaging" -- if the two same-named leaves ever collided (resolved to the same stored
        // id), this would either match both books or throw, not select exactly one.
        createBook("Dune", 400, true, "Fiction", 20, 5);
        createBook("Foundation", 300, true, "Fiction", 20, null);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("packaging.widthCm", Operator.EQUALS, "5"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void propertyExistencePredicate_dotPath_matchesOnlyItemsWhereTheNestedLeafWasSet() {
        createBook("Dune", 400, true, "Fiction", 20, null);
        createBook("Foundation", 300, true, "Fiction", null, null);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyExistencePredicate("dimensions.widthCm"));

        assertThat(project(spec).titles()).containsExactly("Dune");
    }

    @Test
    void sortField_dotPath_sortsOnTheNestedLeaf() {
        createBook("Dune", 400, true, "Fiction", 30, null);
        createBook("Foundation", 300, true, "Fiction", 10, null);
        createBook("Neuromancer", 300, true, "Fiction", 20, null);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, "dimensions.widthCm", "ASC");

        assertThat(project(spec).titles()).containsExactly("Foundation", "Neuromancer", "Dune");
    }

    @Test
    void predicateOnUnknownNestedProperty_throwsIllegalArgumentExceptionNamingTheFullPath() {
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("dimensions.noSuchLeaf", Operator.EQUALS, "x"));

        assertThatThrownBy(() -> project(spec))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dimensions.noSuchLeaf");
    }

    @Test
    void predicateOnPathThroughANonObjectProperty_throwsIllegalArgumentException() {
        // "title" is a plain STRING, not an OBJECT -- "title.anything" has nowhere to descend into.
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("title.anything", Operator.EQUALS, "x"));

        assertThatThrownBy(() -> project(spec))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title.anything");
    }

    @Test
    void predicateOnAnObjectPropertyItself_throwsIllegalArgumentException() {
        // "dimensions" alone names a container, not a leaf value -- there's no single stored value
        // to compare against.
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new PropertyValuePredicate("dimensions", Operator.EQUALS, "x"));

        assertThatThrownBy(() -> project(spec))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dimensions");
    }

    @Test
    void stateValuePredicateOnUnknownStateMachineOrState_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> project(new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new StateValuePredicate("NoSuchMachine", "Available"))))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> project(new CollectionProjectionSpec(BOOK_TYPE, null, null,
                new StateValuePredicate(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE, "NoSuchState"))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- Faceting ---

    @Test
    void termsFacet_onBooleanProperty_countsEachDistinctValue() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("Neuromancer", 300, false, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of("inStock"), null, null, null, null);

        Map<String, List<FacetBucket>> facets = project(spec).result().facets();
        assertThat(facets.get("inStock"))
                .extracting(FacetBucket::value, FacetBucket::count)
                .containsExactlyInAnyOrder(
                        tuple("true", 2L),
                        tuple("false", 1L));
    }

    @Test
    void termsFacet_onControlledListBackedStringProperty_countsEachDistinctValue() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Neuromancer", 300, true, "Fiction");
        createBook("The Pragmatic Programmer", 300, true, "Reference");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of("genre"), null, null, null, null);

        Map<String, List<FacetBucket>> facets = project(spec).result().facets();
        assertThat(facets.get("genre"))
                .extracting(FacetBucket::value, FacetBucket::count)
                .containsExactlyInAnyOrder(
                        tuple("Fiction", 2L),
                        tuple("Reference", 1L));
    }

    @Test
    void requestedFacetsAsEmptyList_autoPopulatesFromEveryFacetableProperty() {
        createBook("Dune", 400, true, "Fiction");

        // Empty list (not null) means "every facetable property on this item type" --
        // facetableFieldsFor's own contract. title/pageCount aren't facetable (title has no
        // controlled list, pageCount isn't STRING/BOOLEAN), so only inStock, genre, and the nested
        // dimensions.material should show up here -- the last one specifically exercises
        // collectFacetableFieldNames' recursion into an OBJECT property, not just top-level fields.
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of(), null, null, null, null);

        assertThat(project(spec).result().facets().keySet()).containsExactlyInAnyOrder("inStock", "genre", "dimensions.material");
    }

    @Test
    void termsFacet_onNestedControlledListBackedProperty_countsEachDistinctValue() {
        createBookWithDimensionsMaterial("Dune", "Hardcover");
        createBookWithDimensionsMaterial("Foundation", "Hardcover");
        createBookWithDimensionsMaterial("Neuromancer", "Paperback");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of("dimensions.material"), null, null, null, null);

        Map<String, List<FacetBucket>> facets = project(spec).result().facets();
        assertThat(facets.get("dimensions.material"))
                .extracting(FacetBucket::value, FacetBucket::count)
                .containsExactlyInAnyOrder(
                        tuple("Hardcover", 2L),
                        tuple("Paperback", 1L));
    }

    @Test
    void facetFilter_withTermsValues_narrowsFacetedCountButLeavesTotalCountAlone() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("The Pragmatic Programmer", 300, true, "Reference");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                null, List.of(new TermsFacetFilter("genre", List.of("Reference"), false)), null, null, null);

        var result = project(spec).result();
        assertThat(result.totalCount()).isEqualTo(3);
        assertThat(result.facetedCount()).isEqualTo(1);
        assertThat(project(spec).titles()).containsExactly("The Pragmatic Programmer");
    }

    @Test
    void facetFilter_includeNull_matchesItemsMissingThatProperty() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Untitled Draft", 100, true, null);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                null, List.of(new TermsFacetFilter("genre", List.of(), true)), null, null, null);

        assertThat(project(spec).titles()).containsExactly("Untitled Draft");
    }

    @Test
    void facetIsDisjunctive_ownFilterDoesNotNarrowItsOwnBucketCounts() {
        // "Disjunctive" facets: a facet's own bucket counts are computed ignoring that facet's own
        // active filter (so a user can still see how many books there'd be in Fiction after
        // switching away from Reference) -- otherwise picking any filter value would instantly
        // collapse that same facet down to one bucket.
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("The Pragmatic Programmer", 300, true, "Reference");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of("genre"), List.of(new TermsFacetFilter("genre", List.of("Reference"), false)), null, null, null);

        Map<String, List<FacetBucket>> facets = project(spec).result().facets();
        assertThat(facets.get("genre"))
                .extracting(FacetBucket::value, FacetBucket::count)
                .containsExactlyInAnyOrder(
                        tuple("Fiction", 2L),
                        tuple("Reference", 1L));
    }

    @Test
    void stateMachineFacet_countsItemsByCurrentState() {
        // Creating an item never assigns it a state automatically -- so both items need an explicit
        // setState call to have a recorded state at all, even the one meant to represent "Available".
        UUID available = createBook("Dune", 400, true, "Fiction");
        UUID outOfStock = createBook("Foundation", 300, true, "Fiction");
        setState(available, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.AVAILABLE);
        setState(outOfStock, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                null, null, List.of(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE), null, null);

        Map<String, List<FacetBucket>> stateFacets = project(spec).result().stateMachineFacets();
        assertThat(stateFacets.get(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE))
                .extracting(FacetBucket::label, FacetBucket::count)
                .containsExactlyInAnyOrder(
                        tuple(RegisterProjectionTestDomainInitializer.AVAILABLE, 1L),
                        tuple(RegisterProjectionTestDomainInitializer.OUT_OF_STOCK, 1L));
    }

    @Test
    void stateMachineFacet_ordersBucketsByWorkflowPositionNotCount() {
        // Deliberately NOT the shared AVAILABILITY_MACHINE fixture -- StateMachineExecutionIntegrationTest
        // adds its own ad-hoc transitions to that machine (GuardedRetire, Archive) and never cleans
        // them up, since schema mutations (unlike the marker-scoped rows other tests in this file
        // create) aren't test-scoped. That's harmless for count-based assertions but would make this
        // test's expected order depend on suite execution order, so it gets its own throwaway item
        // type + machine instead, torn down at the end.
        //
        // Graph: START -> Available -> OutOfStock -> Discontinued (plus an OutOfStock -> Available
        // cycle back). Rank-distance from START is Available=1, OutOfStock=2, Discontinued=3 --
        // deliberately give the *last*-ranked state the most items, so a count-based ordering (the
        // old behavior) would produce a different, wrong order here.
        String itemTypeName = "RegisterProjectionTestFacetOrderThrowaway";
        String machineName = "FacetOrderMachine";
        schemaManager.applyMutations(List.of(new CreateItemDefinitionMutation(
                itemTypeName, "created only for stateMachineFacet ordering test", List.of(), null, false, null)));
        UUID throwawayTypeId = schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.name().equals(itemTypeName))
                .findFirst().orElseThrow().id();
        List<UUID> createdItemIds = new ArrayList<>();
        try {
            new DomainInitializer() {}.initStateMachine(schemaManager, throwawayTypeId, machineName,
                    List.of(
                            new DomainInitializer.StateDefinition("Available"),
                            new DomainInitializer.StateDefinition("OutOfStock"),
                            new DomainInitializer.StateDefinition("Discontinued")),
                    List.of(
                            new DomainInitializer.TransitionDefinition(DomainInitializer.START_STATE, "Available", "start"),
                            new DomainInitializer.TransitionDefinition("Available", "OutOfStock", "MarkOutOfStock"),
                            new DomainInitializer.TransitionDefinition("OutOfStock", "Available", "Restock"),
                            new DomainInitializer.TransitionDefinition("OutOfStock", "Discontinued", "Discontinue")));

            UUID discontinued1 = createItem(itemTypeName);
            UUID discontinued2 = createItem(itemTypeName);
            UUID discontinued3 = createItem(itemTypeName);
            UUID outOfStock = createItem(itemTypeName);
            UUID available = createItem(itemTypeName);
            UUID noState = createItem(itemTypeName); // never given a state -- the null bucket
            createdItemIds.addAll(List.of(discontinued1, discontinued2, discontinued3, outOfStock, available, noState));
            setStateForType(throwawayTypeId, discontinued1, machineName, "Discontinued");
            setStateForType(throwawayTypeId, discontinued2, machineName, "Discontinued");
            setStateForType(throwawayTypeId, discontinued3, machineName, "Discontinued");
            setStateForType(throwawayTypeId, outOfStock, machineName, "OutOfStock");
            setStateForType(throwawayTypeId, available, machineName, "Available");

            var spec = new CollectionProjectionSpec(itemTypeName, null, null, null, null,
                    null, null, List.of(machineName), null, null);
            ProjectionResult result = registerPartitionManager.project(throwawayTypeId, spec, "http://binary");

            assertThat(result.stateMachineFacets().get(machineName))
                    .extracting(FacetBucket::label, FacetBucket::count)
                    .containsExactly(
                            tuple("Available", 1L),
                            tuple("OutOfStock", 1L),
                            tuple("Discontinued", 3L),
                            tuple(null, 1L));
        } finally {
            if (!createdItemIds.isEmpty()) {
                webTestClient.post().uri("/api/mutation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(new MutationRequest(createdItemIds.stream().<ItemMutation>map(ItemDeleteMutation::new).toList(), List.of()))
                        .exchange()
                        .expectStatus().isOk();
            }
            schemaManager.applyMutations(List.of(new DeleteItemDefinitionMutation(throwawayTypeId)));
        }
    }

    private UUID createItem(String itemTypeName) {
        MutationResponse response = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(new ItemCreateMutation(null, itemTypeName, Map.of())), List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        return response.items().get(0).itemId();
    }

    private void setStateForType(UUID itemTypeId, UUID itemId, String machineName, String stateName) {
        UUID smId = registerPartitionManager.resolveStateMachineId(itemTypeId, machineName);
        UUID stateId = registerPartitionManager.resolveStateId(smId, stateName);
        UUID txn = UUID.randomUUID();
        coordinator.prepare(List.of(new ItemUpdateEntry(itemId, Map.of(), Map.of(smId, stateId), Set.of(), Set.of(), Set.of())), txn, null);
        coordinator.commit(txn, UUID.randomUUID());
    }

    @Test
    void invalidFacetFieldName_throwsIllegalArgumentException() {
        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                List.of("not a valid field; drop table books"), null, null, null, null);

        assertThatThrownBy(() -> project(spec)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unsupportedFacetFilterTypes_throwUnsupportedOperationException() {
        var rangeSpec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                null, List.of(new RangeFacetFilter("pageCount", null, null)), null, null, null);
        assertThatThrownBy(() -> project(rangeSpec)).isInstanceOf(UnsupportedOperationException.class);

        var dateRangeSpec = new CollectionProjectionSpec(BOOK_TYPE, null, null, null, null,
                null, List.of(new DateRangeFacetFilter("pageCount", LocalDate.now(), LocalDate.now())), null, null, null);
        assertThatThrownBy(() -> project(dateRangeSpec)).isInstanceOf(UnsupportedOperationException.class);
    }

    // --- Sorting and pagination ---

    @Test
    void sorting_byPropertyColumn_ordersAscendingOrDescendingAsRequested() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("Neuromancer", 300, true, "Fiction");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC")).titles())
                .containsExactly("Dune", "Foundation", "Neuromancer");
        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "title", "DESC")).titles())
                .containsExactly("Neuromancer", "Foundation", "Dune");
    }

    @Test
    void sorting_byIntPropertyColumn_ordersNumericallyNotLexicographically() {
        // pageCount is INT: the JSONB ->> extraction is text, so without a numeric cast "10" sorts
        // before "2". Values chosen so lexicographic and numeric order genuinely differ.
        createBook("ten", 10, true, "Fiction");
        createBook("two", 2, true, "Fiction");
        createBook("one", 1, true, "Fiction");
        createBook("hundred", 100, true, "Fiction");

        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "pageCount", "ASC")).titles())
                .containsExactly("one", "two", "ten", "hundred");
        assertThat(project(new CollectionProjectionSpec(BOOK_TYPE, "pageCount", "DESC")).titles())
                .containsExactly("hundred", "ten", "two", "one");
    }

    @Test
    void sorting_bySystemColumn_isAcceptedAlongsidePropertyColumns() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");

        // "itemId" is one of SYSTEM_SORT_COLUMNS -- resolved straight to a real column (ri.item_id)
        // rather than going through resolvePropertyId, unlike a property-name sort field.
        var spec = new CollectionProjectionSpec(BOOK_TYPE, "itemId", "ASC");
        assertThat(project(spec).titles()).hasSize(2);
    }

    @Test
    void pagination_limitAndOffset_selectTheCorrectSlice() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("Neuromancer", 300, true, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, null, "title", "ASC", null, null, null, null, 1, 1);
        assertThat(project(spec).titles()).containsExactly("Foundation");
    }

    @Test
    void pagination_offsetPastTheLastRow_returnsAnEmptyPageNotAnError() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");
        createBook("Neuromancer", 300, true, "Fiction");

        // offset == totalCount, and well past it: both must come back empty (the batch assembly
        // fetches bind `IN (:ids)`, which Postgres rejects for an empty list) with totalCount intact.
        var atEnd = new CollectionProjectionSpec(BOOK_TYPE, null, "title", "ASC", null, null, null, null, 3, 5);
        assertThat(project(atEnd).titles()).isEmpty();
        assertThat(project(atEnd).result().totalCount()).isEqualTo(3);

        var pastEnd = new CollectionProjectionSpec(BOOK_TYPE, null, "title", "ASC", null, null, null, null, 100, 5);
        assertThat(project(pastEnd).titles()).isEmpty();
        assertThat(project(pastEnd).result().totalCount()).isEqualTo(3);
    }

    @Test
    void pagination_nullLimit_stillReturnsEveryMatchingItemUnderTheDefaultCap() {
        createBook("Dune", 400, true, "Fiction");
        createBook("Foundation", 300, true, "Fiction");

        var spec = new CollectionProjectionSpec(BOOK_TYPE, "title", "ASC");
        assertThat(project(spec).titles()).containsExactly("Dune", "Foundation");
    }

    // --- Link expansion ---

    @Test
    void projectedItem_includesLinkedItemsUnderTheirPerspectiveName() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");

        MutationResponse authorResponse = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(
                        List.of(new ItemCreateMutation(null, "RegisterProjectionTestAuthor", Map.of("name", "Frank Herbert"))),
                        List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        UUID authorId = authorResponse.items().get(0).itemId();

        webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(), List.of(new LinkCreateMutation(
                        new LinkEndpointReference("authors", new ExistingItemReference(bookId)),
                        new LinkEndpointReference("books", new ExistingItemReference(authorId)),
                        Map.of()))))
                .exchange()
                .expectStatus().isOk();

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary").orElseThrow();
        assertThat(book.links().get("authors"))
                .extracting(link -> link.item().properties().get("name"))
                .containsExactly("Frank Herbert");
    }

    // --- Multi-hop requested links ---

    private UUID createAuthorLinkedToBook(UUID bookId, String name) {
        MutationResponse authorResponse = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(
                        List.of(new ItemCreateMutation(null, "RegisterProjectionTestAuthor", Map.of("name", name))),
                        List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        UUID authorId = authorResponse.items().get(0).itemId();

        webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(), List.of(new LinkCreateMutation(
                        new LinkEndpointReference("authors", new ExistingItemReference(bookId)),
                        new LinkEndpointReference("books", new ExistingItemReference(authorId)),
                        Map.of()))))
                .exchange()
                .expectStatus().isOk();
        return authorId;
    }

    private void createPublisherLinkedToAuthor(UUID authorId, String name) {
        MutationResponse publisherResponse = webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(
                        List.of(new ItemCreateMutation(null, "RegisterProjectionTestPublisher", Map.of("name", name))),
                        List.of()))
                .exchange()
                .expectStatus().isOk()
                .expectBody(MutationResponse.class)
                .returnResult().getResponseBody();
        UUID publisherId = publisherResponse.items().get(0).itemId();

        webTestClient.post().uri("/api/mutation")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new MutationRequest(List.of(), List.of(new LinkCreateMutation(
                        new LinkEndpointReference("publisher", new ExistingItemReference(authorId)),
                        new LinkEndpointReference("publishedAuthors", new ExistingItemReference(publisherId)),
                        Map.of()))))
                .exchange()
                .expectStatus().isOk();
    }

    @Test
    void requestedLinks_emptyMap_excludesAllLinks() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        createAuthorLinkedToBook(bookId, "Frank Herbert");

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary", Map.of())
                .orElseThrow();

        assertThat(book.links()).isEmpty();
    }

    @Test
    void requestedLinks_namedPerspectiveWithoutNestedSpec_expandsOneHopOnlyLikeTheDefault() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        UUID authorId = createAuthorLinkedToBook(bookId, "Frank Herbert");
        createPublisherLinkedToAuthor(authorId, "Ace Books");

        var requestedLinks = Map.of("authors", new LinkProjectionSpec(null));
        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary", requestedLinks)
                .orElseThrow();

        var author = book.links().get("authors").get(0).item();
        assertThat(author.properties().get("name")).isEqualTo("Frank Herbert");
        // No nested spec named for "authors" -- the Publisher one hop further isn't fetched, even
        // though it exists, matching today's plain single-hop default exactly.
        assertThat(author.links()).isEmpty();
    }

    @Test
    void requestedLinks_nestedSpec_recursesIntoTheNamedLinkOfTheLinkedItem() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        UUID authorId = createAuthorLinkedToBook(bookId, "Frank Herbert");
        createPublisherLinkedToAuthor(authorId, "Ace Books");

        var requestedLinks = Map.of("authors",
                new LinkProjectionSpec(Map.of("publisher", new LinkProjectionSpec(null))));
        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary", requestedLinks)
                .orElseThrow();

        var author = book.links().get("authors").get(0).item();
        assertThat(author.properties().get("name")).isEqualTo("Frank Herbert");
        assertThat(author.links().get("publisher"))
                .extracting(link -> link.item().properties().get("name"))
                .containsExactly("Ace Books");
    }

    // --- state-change projection ---

    @Test
    void stateChange_thenProjectOne_reflectsTheNewCurrentState() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");

        setState(bookId, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary").orElseThrow();
        assertThat(book.states().get(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE).currentState())
                .isEqualTo(RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);
    }

    @Test
    void projection_forAnItemNotInAMachine_surfacesTheMachineAsStartable() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary").orElseThrow();
        var s = book.states().get(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE);
        assertThat(s).isNotNull();
        assertThat(s.currentState()).isNull();
        assertThat(s.startable()).isTrue(); // superuser
        assertThat(s.availableTransitions()).isEmpty();
    }

    // A machine that's neither active nor startable by the caller has nothing to report -- no
    // current state, no Start affordance -- so its entry is omitted entirely rather than surfacing
    // as startable:false with nothing else useful in it. Non-superuser, zero grants of any kind:
    // this bypasses EntityManagerImpl's own item:read gate (see projectOne's own comment -- that
    // check happens one layer up, not here), which is fine since this test only cares about the
    // states filtering, not item-level visibility.
    @Test
    void projection_forAnItemNotInAMachine_andNotStartable_omitsTheMachineEntirely() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        var noGrants = new RequestPermissionContext(false, java.util.Set.of(), java.util.Set.of(), java.util.Set.of(),
                java.util.Map.of(), java.util.Map.of(), java.util.Map.of(), java.util.Map.of(),
                java.util.Map.of(), java.util.Map.of(), java.util.Map.of(), java.util.Map.of(), java.util.Map.of());

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary", null, noGrants).orElseThrow();

        assertThat(book.states()).isNull();
    }

    // ProjectionSpec.includePermissions/includeStates default to false -- a plain CollectionProjectionSpec
    // (via its legacy constructors, which don't expose these two fields at all) must come back with
    // both null even for an active machine and a superuser, who would otherwise always get real
    // values for both. Distinct from the two tests above/below: this covers the opt-in mechanism
    // itself, not the content of what's returned once opted in.
    @Test
    void projection_withoutIncludePermissionsOrIncludeStates_omitsBothByDefault() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        setState(bookId, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);

        var spec = new CollectionProjectionSpec("RegisterProjectionTestBook", null, null, null);
        var result = registerPartitionManager.project(fixture.bookTypeId(), spec, "http://binary");
        var book = result.items().stream().filter(i -> i.itemId().equals(bookId)).findFirst().orElseThrow();

        assertThat(book.permissions()).isNull();
        assertThat(book.states()).isNull();
    }

    @Test
    void projection_forAnActiveMachine_listsTheCurrentStatesOutgoingTransitions() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        setState(bookId, RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE,
                RegisterProjectionTestDomainInitializer.OUT_OF_STOCK);

        var book = registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary").orElseThrow();
        var s = book.states().get(RegisterProjectionTestDomainInitializer.AVAILABILITY_MACHINE);
        assertThat(s.startable()).isFalse();
        assertThat(s.availableTransitions()).extracting(t -> t.name())
                .contains("Restock", "Discontinue"); // OutOfStock's outgoing transitions
    }

    // --- Schema-change table management ---

    @Test
    void deletingAnItemType_dropsItsRegisterTable() {
        schemaManager.applyMutations(List.of(new CreateItemDefinitionMutation(
                "RegisterProjectionTestThrowaway", "created only to be deleted in this test", List.of(), null, false, null)));
        UUID throwawayTypeId = schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.name().equals("RegisterProjectionTestThrowaway"))
                .findFirst().orElseThrow().id();
        String tableName = RegisterPartitionManager.tableNameFor(throwawayTypeId);

        assertThat(tableExists(tableName)).isTrue();

        schemaManager.applyMutations(List.of(new DeleteItemDefinitionMutation(throwawayTypeId)));

        assertThat(tableExists(tableName)).isFalse();
    }

    private boolean tableExists(String tableName) {
        return jdbcClient.sql("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :tableName)")
                .param("tableName", tableName)
                .query(Boolean.class)
                .single();
    }

    // --- Malformed data defensive handling ---

    @Test
    void malformedPropertiesJsonInTheRegisterRow_failsClearlyRatherThanSilently() {
        UUID bookId = createBook("Dune", 400, true, "Fiction");
        String tableName = RegisterPartitionManager.tableNameFor(fixture.bookTypeId());

        // Postgres's jsonb column type itself rejects syntactically invalid JSON at write time, so
        // there's no way to get truly malformed JSON into this column -- what parseJsonb's catch
        // block actually guards against is syntactically valid JSON of the wrong shape. A JSON
        // array passes Postgres's own validation but can't deserialize into the Map parseJsonb
        // expects, which is exactly what reaches the catch block in practice (a properties column
        // that isn't a JSON object at all).
        jdbcClient.sql("UPDATE " + tableName + " SET properties = '[1, 2, 3]'::jsonb WHERE register_item_id = "
                        + "(SELECT id FROM register_item WHERE item_id = :itemId)")
                .param("itemId", bookId)
                .update();

        assertThatThrownBy(() -> registerPartitionManager.projectOne(fixture.bookTypeId(), bookId, "http://binary"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Failed to parse properties JSONB");
    }
}
