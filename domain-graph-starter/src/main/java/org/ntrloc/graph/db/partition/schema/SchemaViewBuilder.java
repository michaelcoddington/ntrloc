package org.ntrloc.graph.db.partition.schema;

import org.ntrloc.graph.db.partition.schema.definition.PropertyCardinality;
import org.ntrloc.graph.db.partition.schema.definition.PropertyType;
import org.ntrloc.graph.db.partition.schema.definition.view.DefinedInView;
import org.ntrloc.graph.db.partition.schema.definition.view.SortableFieldView;
import org.ntrloc.graph.db.partition.schema.definition.view.TargetEntityView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminControlledListView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemLinkPerspectiveView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminLinkView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminSchemaView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateMachineView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminTraitDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminTransitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.ObjectAdminPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.PropertyTypeView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.ScalarAdminPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.TraitRefView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.ItemDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.ItemLinkPerspectiveView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.ObjectPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.PropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.ScalarPropertyDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.SchemaView;
import org.ntrloc.graph.db.partition.schema.definition.view.calculated.TraitDefinitionView;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository.ItemRow;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository.StateMachineRow;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository.StateRow;
import org.ntrloc.graph.db.partition.schema.repository.SchemaRepository.TraitRow;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// Builds both schema projections (admin: full detail for the schema editor; calculated: the
// client-facing shape SchemaManager caches and serves) from SchemaRepository's raw rows. Split out
// of SchemaManager -- which owns the cache lifecycle and mutation application -- to keep each class
// focused on one job; this one alone accounted for most of SchemaManager's dependency count.
@Component
class SchemaViewBuilder {

    private static final String ENTITY_KIND_TRAIT = "trait";
    private static final String ENTITY_KIND_SUPERTYPE = "supertype";

    private static final List<SortableFieldView> SYSTEM_SORTABLE_FIELDS = List.of(
            new SortableFieldView("itemId",          true),
            new SortableFieldView("itemType",        true),
            new SortableFieldView("createdAt",       true),
            new SortableFieldView("updatedAt",       true),
            new SortableFieldView("visibilityState", true)
    );

    private final SchemaRepository repo;
    private final ControlledListManager controlledListManager;

    SchemaViewBuilder(SchemaRepository repo, ControlledListManager controlledListManager) {
        this.repo = repo;
        this.controlledListManager = controlledListManager;
    }

    private List<SortableFieldView> sortableFieldsFor(List<AdminPropertyDefinitionView> properties) {
        var result = new ArrayList<>(SYSTEM_SORTABLE_FIELDS);
        appendSortableFields(properties, "", result);
        return List.copyOf(result);
    }

    // Recurses into OBJECT properties so a scalar leaf nested under one is sortable via its
    // dot-separated path (e.g. "additionalDetails.priority") -- matches the dot-path resolution
    // RegisterPartitionManager.resolveProperty already does for both ORDER BY and filter
    // predicates, this just exposes it as a pickable option. OBJECT properties themselves, and
    // LIST/SET-cardinality properties at any depth, are skipped: neither has a single scalar
    // value to order by.
    private void appendSortableFields(List<AdminPropertyDefinitionView> properties, String pathPrefix, List<SortableFieldView> result) {
        if (properties == null) return;
        for (var p : properties) {
            if (p.cardinality() != PropertyCardinality.SINGLE) continue;
            String path = pathPrefix + p.name();
            if (p instanceof ObjectAdminPropertyDefinitionView object) {
                appendSortableFields(object.properties(), path + ".", result);
            } else {
                result.add(new SortableFieldView(path, false));
            }
        }
    }

    // --- Admin schema ---

    AdminSchemaView buildAdminSchema() {
        var items  = repo.getAllItems();
        var traits = repo.getAllTraits();

        // id → name (for resolving perspective targets, which are keyed by item-or-trait id)
        Map<UUID, String> entityNameMap = new HashMap<>();
        items.forEach(i -> entityNameMap.put(i.id(), i.name()));
        traits.forEach(t -> entityNameMap.put(t.id(), t.name()));

        // item ids — used to determine targetKind on link perspectives
        Set<UUID> itemEntityIds = items.stream()
                .map(ItemRow::id)
                .collect(Collectors.toSet());

        var propertiesByProperty = repo.getPropertiesByProperty();
        var propertiesByItem     = resolveChildrenForMap(repo.getPropertiesByItem(), propertiesByProperty);
        var propertiesByTrait    = resolveChildrenForMap(repo.getPropertiesByTrait(), propertiesByProperty);
        var propertiesByLink     = resolveChildrenForMap(repo.getPropertiesByLink(), propertiesByProperty);
        var perspectivesByEntity = repo.getPerspectivesByEntity();
        var traitIdsByItem       = repo.getTraitIdsByItem();
        var stateMachinesByItem    = repo.getStateMachinesByItem();
        var statesByStateMachine   = repo.getStatesByStateMachine();
        var transitionsByFromState = repo.getTransitionsByFromState();

        Map<UUID, TraitRow> traitById = traits.stream()
                .collect(Collectors.toMap(TraitRow::id, t -> t));
        Map<UUID, ItemRow> itemById = items.stream()
                .collect(Collectors.toMap(ItemRow::id, i -> i));

        var itemViews = items.stream().map(item -> {
            var traitIds = traitIdsByItem.getOrDefault(item.id(), List.of());
            var traitRefs = traitIds.stream().map(id -> new TraitRefView(traitById.get(id).id(), traitById.get(id).name())).toList();

            // Own properties + trait-inherited properties + full supertype chain's effective properties
            var allProps = effectivePropertiesAdmin(item, itemById, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById);

            // Own link perspectives + trait-inherited perspectives + supertype chain's effective links
            var allLinks = effectiveLinksAdmin(item, itemById, perspectivesByEntity, entityNameMap, itemEntityIds, traitIdsByItem, traitById);

            // Own state machines + full supertype chain's state machines (additive, no override)
            var stateMachineViews = effectiveStateMachinesAdmin(item, itemById, stateMachinesByItem, statesByStateMachine, transitionsByFromState);

            return new AdminItemDefinitionView(item.id(), item.name(), item.description(), traitRefs, allProps, allLinks,
                    sortableFieldsFor(allProps), stateMachineViews.isEmpty() ? null : stateMachineViews,
                    item.supertypeId(), item.abstractType(), item.displayLabelPattern());
        }).toList();

        var traitViews = traits.stream().map(trait -> {
            var props = propertiesByTrait.getOrDefault(trait.id(), List.of());
            var links = buildPerspectiveAdminViews(trait.id(), perspectivesByEntity, entityNameMap, itemEntityIds, null);
            return new AdminTraitDefinitionView(trait.id(), trait.name(), trait.description(), props, links, sortableFieldsFor(props));
        }).toList();

        var linkViews = repo.getAllLinkIds().stream()
                .map(id -> new AdminLinkView(id, propertiesByLink.getOrDefault(id, List.of())))
                .toList();

        List<PropertyTypeView> propertyTypes = Arrays.stream(PropertyType.values())
                .map(type -> new PropertyTypeView(type, type.validCardinalities()))
                .toList();

        var controlledLists = buildControlledListViews(propertiesByItem, propertiesByTrait, propertiesByLink, entityNameMap);

        return new AdminSchemaView(itemViews, traitViews, linkViews, propertyTypes, controlledLists);
    }

    // controlledListManager.getAllLists() + a valueCount per list + the reverse "which properties
    // point at each list" map, built from the raw defining-owner property maps (each property
    // appears once, under its true owner -- inheritance is not walked here). Link-owned list-backed
    // properties are rare; they get a generic owner label since links carry no name.
    private List<AdminControlledListView> buildControlledListViews(
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByTrait,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByLink,
            Map<UUID, String> entityNameMap) {
        Map<UUID, List<AdminControlledListView.UsageRef>> usageByListId = new HashMap<>();
        propertiesByItem.forEach((ownerId, props) ->
                collectListUsage(props, entityNameMap.getOrDefault(ownerId, "(item)"), usageByListId));
        propertiesByTrait.forEach((ownerId, props) ->
                collectListUsage(props, entityNameMap.getOrDefault(ownerId, "(trait)"), usageByListId));
        propertiesByLink.forEach((ownerId, props) ->
                collectListUsage(props, "(link property)", usageByListId));

        return controlledListManager.getAllLists().stream()
                .map(list -> new AdminControlledListView(list.id(), list.name(), list.valueType(),
                        controlledListManager.countValues(list.id()),
                        usageByListId.getOrDefault(list.id(), List.of())))
                .toList();
    }

    private void collectListUsage(List<AdminPropertyDefinitionView> props, String ownerLabel,
                                  Map<UUID, List<AdminControlledListView.UsageRef>> out) {
        for (AdminPropertyDefinitionView p : props) {
            if (p.controlledListId() != null) {
                out.computeIfAbsent(p.controlledListId(), k -> new ArrayList<>())
                        .add(new AdminControlledListView.UsageRef(p.id(), p.name(), ownerLabel));
            }
            if (p instanceof ObjectAdminPropertyDefinitionView o) {
                collectListUsage(o.properties(), ownerLabel, out);
            }
        }
    }

    // An item's own properties (definedIn = null) plus its directly-implemented traits'
    // properties (definedIn = trait) -- no supertype involvement, used both directly and as the
    // per-level building block for effectivePropertiesAdmin's chain walk.
    private List<AdminPropertyDefinitionView> ownAndTraitPropertiesAdmin(
            ItemRow item, Map<UUID, List<UUID>> traitIdsByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByTrait,
            Map<UUID, TraitRow> traitById) {
        var traitIds = traitIdsByItem.getOrDefault(item.id(), List.of());
        var ownProps = propertiesByItem.getOrDefault(item.id(), List.of());
        var traitProps = traitIds.stream()
                .flatMap(traitId -> {
                    var trait = traitById.get(traitId);
                    var definedIn = new DefinedInView(ENTITY_KIND_TRAIT, trait.name());
                    return propertiesByTrait.getOrDefault(traitId, List.of()).stream()
                            .map(p -> p.withDefinedIn(definedIn));
                })
                .toList();
        return Stream.concat(ownProps.stream(), traitProps.stream()).toList();
    }

    // Object properties' children live in a separate join (schema_property_property), unresolvable
    // from a single-row property query -- mapProperty leaves them as an empty placeholder list,
    // replaced here with the real (recursively resolved) children before any view is assembled.
    // Applied once to each raw owner map, so the own/trait/supertype merge below never needs to
    // know children exist at all -- it just carries whatever's already on the node through.
    private Map<UUID, List<AdminPropertyDefinitionView>> resolveChildrenForMap(
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByOwner,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByProperty) {
        Map<UUID, List<AdminPropertyDefinitionView>> result = new HashMap<>();
        propertiesByOwner.forEach((ownerId, props) -> result.put(ownerId, resolveChildrenAdmin(props, propertiesByProperty)));
        return result;
    }

    private List<AdminPropertyDefinitionView> resolveChildrenAdmin(
            List<AdminPropertyDefinitionView> properties, Map<UUID, List<AdminPropertyDefinitionView>> propertiesByProperty) {
        return properties.stream()
                .map(p -> p instanceof ObjectAdminPropertyDefinitionView o
                        ? o.withProperties(resolveChildrenAdmin(propertiesByProperty.getOrDefault(o.id(), List.of()), propertiesByProperty))
                        : p)
                .toList();
    }

    // Recursive: own+trait properties, plus the full supertype chain's own effective set walked
    // upward. A property inherited from a supertype is tagged with that supertype's name -- but
    // only if it isn't already tagged (i.e. it's genuinely that ancestor's own property, not
    // something *that* ancestor itself inherited from a trait or a further ancestor), so the tag
    // always names the actual originating source, not just the immediate parent.
    private List<AdminPropertyDefinitionView> effectivePropertiesAdmin(
            ItemRow item, Map<UUID, ItemRow> itemById, Map<UUID, List<UUID>> traitIdsByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByTrait,
            Map<UUID, TraitRow> traitById) {
        var own = ownAndTraitPropertiesAdmin(item, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById);
        var supertype = item.supertypeId() == null ? null : itemById.get(item.supertypeId());
        if (supertype == null) return own;
        var inherited = effectivePropertiesAdmin(supertype, itemById, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById).stream()
                .map(p -> p.definedIn() == null ? p.withDefinedIn(new DefinedInView(ENTITY_KIND_SUPERTYPE, supertype.name())) : p)
                .toList();
        return Stream.concat(own.stream(), inherited.stream()).toList();
    }

    private Map<String, List<AdminItemLinkPerspectiveView>> ownAndTraitLinksAdmin(
            ItemRow item, Map<UUID, List<SchemaRepository.PerspectiveRow>> perspectivesByEntity,
            Map<UUID, String> entityNameMap, Set<UUID> itemEntityIds,
            Map<UUID, List<UUID>> traitIdsByItem, Map<UUID, TraitRow> traitById) {
        var traitIds = traitIdsByItem.getOrDefault(item.id(), List.of());
        var ownLinks = buildPerspectiveAdminViews(item.id(), perspectivesByEntity, entityNameMap, itemEntityIds, null);
        var traitLinks = traitIds.stream()
                .map(traitId -> {
                    var trait = traitById.get(traitId);
                    var definedIn = new DefinedInView(ENTITY_KIND_TRAIT, trait.name());
                    return buildPerspectiveAdminViews(trait.id(), perspectivesByEntity, entityNameMap, itemEntityIds, definedIn);
                })
                .filter(m -> m != null && !m.isEmpty())
                .reduce(new LinkedHashMap<>(), (acc, m) -> { acc.putAll(m); return acc; });
        return mergeLinkAdminMaps(ownLinks, traitLinks);
    }

    // Recursive counterpart to effectivePropertiesAdmin for links. mergeLinkAdminMaps requires
    // its second argument to be a non-null (possibly empty) map -- retagLinksAdminAsSupertype
    // upholds that even when the recursive call itself returns null (an ancestor with no links
    // of its own at all).
    private Map<String, List<AdminItemLinkPerspectiveView>> effectiveLinksAdmin(
            ItemRow item, Map<UUID, ItemRow> itemById,
            Map<UUID, List<SchemaRepository.PerspectiveRow>> perspectivesByEntity,
            Map<UUID, String> entityNameMap, Set<UUID> itemEntityIds,
            Map<UUID, List<UUID>> traitIdsByItem, Map<UUID, TraitRow> traitById) {
        var own = ownAndTraitLinksAdmin(item, perspectivesByEntity, entityNameMap, itemEntityIds, traitIdsByItem, traitById);
        var supertype = item.supertypeId() == null ? null : itemById.get(item.supertypeId());
        if (supertype == null) return own;
        var inherited = effectiveLinksAdmin(supertype, itemById, perspectivesByEntity, entityNameMap, itemEntityIds, traitIdsByItem, traitById);
        return mergeLinkAdminMaps(own, retagLinksAdminAsSupertype(inherited, supertype.name()));
    }

    private Map<String, List<AdminItemLinkPerspectiveView>> retagLinksAdminAsSupertype(
            Map<String, List<AdminItemLinkPerspectiveView>> links, String supertypeName) {
        if (links == null) return new LinkedHashMap<>();
        var definedIn = new DefinedInView(ENTITY_KIND_SUPERTYPE, supertypeName);
        var result = new LinkedHashMap<String, List<AdminItemLinkPerspectiveView>>();
        links.forEach((name, list) -> result.put(name, list.stream()
                .map(p -> p.definedIn() == null
                        ? new AdminItemLinkPerspectiveView(p.id(), p.linkId(), p.targets(), p.description(), p.minCardinality(), p.maxCardinality(), definedIn)
                        : p)
                .toList()));
        return result;
    }

    private List<AdminStateMachineView> ownStateMachinesAdmin(
            ItemRow item, Map<UUID, List<StateMachineRow>> stateMachinesByItem,
            Map<UUID, List<StateRow>> statesByStateMachine,
            Map<UUID, List<SchemaRepository.TransitionRow>> transitionsByFromState) {
        var rawStateMachines = stateMachinesByItem.get(item.id());
        if (rawStateMachines == null || rawStateMachines.isEmpty()) return List.of();
        return rawStateMachines.stream().map(machine -> {
            var rawStates = statesByStateMachine.getOrDefault(machine.id(), List.of());
            Map<UUID, String> stateNameById = rawStates.stream()
                    .collect(Collectors.toMap(StateRow::id, StateRow::name));
            var stateViews = rawStates.stream().map(state -> {
                var transitions = transitionsByFromState.getOrDefault(state.id(), List.of()).stream()
                        .map(t -> new AdminTransitionView(
                                t.id(), t.toStateId(), stateNameById.get(t.toStateId()),
                                t.name(), t.description(), t.processId(),
                                repo.parseGuardCondition(t.guardCondition())))
                        .toList();
                return new AdminStateView(state.id(), state.name(), state.description(),
                        state.kind(), state.entryProcessId(), state.exitProcessId(),
                        state.entryMarkerDecisionKey(), transitions);
            }).toList();
            return new AdminStateMachineView(machine.id(), machine.name(), machine.description(), stateViews);
        }).toList();
    }

    // Additive, no override: a subtype's effective state machines are its own plus every
    // ancestor's, concatenated. Unlike properties/links, AdminStateMachineView carries no
    // definedIn -- a state machine either belongs to this type or an ancestor's, and since it's
    // never redefined along the way (strictly additive), there's nothing to disambiguate.
    private List<AdminStateMachineView> effectiveStateMachinesAdmin(
            ItemRow item, Map<UUID, ItemRow> itemById,
            Map<UUID, List<StateMachineRow>> stateMachinesByItem,
            Map<UUID, List<StateRow>> statesByStateMachine,
            Map<UUID, List<SchemaRepository.TransitionRow>> transitionsByFromState) {
        var own = ownStateMachinesAdmin(item, stateMachinesByItem, statesByStateMachine, transitionsByFromState);
        var supertype = item.supertypeId() == null ? null : itemById.get(item.supertypeId());
        if (supertype == null) return own;
        var inherited = effectiveStateMachinesAdmin(supertype, itemById, stateMachinesByItem, statesByStateMachine, transitionsByFromState);
        return Stream.concat(own.stream(), inherited.stream()).toList();
    }

    private Map<String, List<AdminItemLinkPerspectiveView>> buildPerspectiveAdminViews(
            UUID entityId,
            Map<UUID, List<SchemaRepository.PerspectiveRow>> perspectivesByEntity,
            Map<UUID, String> entityNameMap,
            Set<UUID> itemEntityIds,
            DefinedInView definedIn) {
        var perspectives = perspectivesByEntity.get(entityId);
        if (perspectives == null || perspectives.isEmpty()) return null;
        return perspectives.stream().map(p -> {
            var inverses = repo.findInversePerspectives(p.linkId(), p.id());
            var targets = inverses.stream()
                    .map(inv -> new TargetEntityView(entityNameMap.get(inv.entityId()), itemEntityIds.contains(inv.entityId()) ? "item" : ENTITY_KIND_TRAIT))
                    .toList();
            return Map.entry(p.name(), new AdminItemLinkPerspectiveView(
                    p.id(), p.linkId(), targets, p.description(), p.minCardinality(), p.maxCardinality(), definedIn));
        }).collect(Collectors.groupingBy(Map.Entry::getKey, LinkedHashMap::new, Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    private Map<String, List<AdminItemLinkPerspectiveView>> mergeLinkAdminMaps(
            Map<String, List<AdminItemLinkPerspectiveView>> own,
            Map<String, List<AdminItemLinkPerspectiveView>> inherited) {
        if (own == null && inherited.isEmpty()) return null;
        var result = new LinkedHashMap<String, List<AdminItemLinkPerspectiveView>>();
        if (own != null) result.putAll(own);
        result.putAll(inherited);
        return result.isEmpty() ? null : result;
    }

    // --- Calculated schema ---

    SchemaView buildSchema() {
        var items  = repo.getAllItems();
        var traits = repo.getAllTraits();

        Map<UUID, String> entityNameMap = new HashMap<>();
        items.forEach(i -> entityNameMap.put(i.id(), i.name()));
        traits.forEach(t -> entityNameMap.put(t.id(), t.name()));

        Set<UUID> itemEntityIds = items.stream()
                .map(ItemRow::id)
                .collect(Collectors.toSet());

        var propertiesByProperty = repo.getPropertiesByProperty();
        var propertiesByItem  = resolveChildrenForMap(repo.getPropertiesByItem(), propertiesByProperty);
        var propertiesByTrait = resolveChildrenForMap(repo.getPropertiesByTrait(), propertiesByProperty);
        var propertiesByLink  = resolveChildrenForMap(repo.getPropertiesByLink(), propertiesByProperty);
        var perspectivesByEntity = repo.getPerspectivesByEntity();
        var traitIdsByItem    = repo.getTraitIdsByItem();

        Map<UUID, TraitRow> traitById = traits.stream()
                .collect(Collectors.toMap(TraitRow::id, t -> t));
        Map<UUID, ItemRow> itemById = items.stream()
                .collect(Collectors.toMap(ItemRow::id, i -> i));

        var linkBuildContext = new LinkBuildContext(perspectivesByEntity, entityNameMap, itemEntityIds, propertiesByLink, traitIdsByItem, traitById);

        var itemViews = items.stream().map(item -> {
            var allProps = effectiveProperties(item, itemById, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById);
            var allLinks = effectiveLinks(item, itemById, linkBuildContext);

            // Rebuild admin props for sortableFields (includes own, trait, and supertype-chain properties)
            var adminAllProps = effectivePropertiesAdmin(item, itemById, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById);

            return new ItemDefinitionView(item.id(), item.name(), item.description(), allProps, allLinks,
                    sortableFieldsFor(adminAllProps), item.supertypeId(), item.abstractType());
        }).toList();

        var traitViews = traits.stream().map(trait -> {
            var adminProps = propertiesByTrait.getOrDefault(trait.id(), List.of());
            var props = adminProps.stream().map(p -> toCalculated(p, null)).toList();
            var links = buildPerspectiveViews(trait.id(), linkBuildContext, null);
            return new TraitDefinitionView(trait.id(), trait.name(), trait.description(), props, links, sortableFieldsFor(adminProps));
        }).toList();

        return new SchemaView(itemViews, traitViews);
    }

    private List<PropertyDefinitionView> ownAndTraitProperties(
            ItemRow item, Map<UUID, List<UUID>> traitIdsByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByTrait,
            Map<UUID, TraitRow> traitById) {
        var traitIds = traitIdsByItem.getOrDefault(item.id(), List.of());
        var ownProps = propertiesByItem.getOrDefault(item.id(), List.of()).stream()
                .map(p -> toCalculated(p, null))
                .toList();
        var traitProps = traitIds.stream()
                .flatMap(traitId -> {
                    var trait = traitById.get(traitId);
                    var definedIn = new DefinedInView(ENTITY_KIND_TRAIT, trait.name());
                    return propertiesByTrait.getOrDefault(traitId, List.of()).stream()
                            .map(p -> toCalculated(p, definedIn));
                })
                .toList();
        return Stream.concat(ownProps.stream(), traitProps.stream()).toList();
    }

    // Converts an admin-side property (id-keyed children resolved by resolveChildrenAdmin) into
    // its client-facing calculated equivalent, recursively -- definedIn is only ever set at the
    // top level a caller passes in; a nested child's own definedIn always resolves to null, since
    // "why does this item have this top-level property" doesn't apply one level down (the parent
    // object property's own tag already answers that).
    private PropertyDefinitionView toCalculated(AdminPropertyDefinitionView p, DefinedInView definedIn) {
        if (p instanceof ObjectAdminPropertyDefinitionView o) {
            return new ObjectPropertyDefinitionView(
                    o.id(), o.name(), o.description(), o.type(), o.cardinality(), definedIn, allowedValuesFor(o),
                    o.properties().stream().map(child -> toCalculated(child, null)).toList());
        }
        return new ScalarPropertyDefinitionView(
                p.id(), p.name(), p.description(), p.type(), p.cardinality(), definedIn, allowedValuesFor(p));
    }

    private List<PropertyDefinitionView> effectiveProperties(
            ItemRow item, Map<UUID, ItemRow> itemById, Map<UUID, List<UUID>> traitIdsByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByItem,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByTrait,
            Map<UUID, TraitRow> traitById) {
        var own = ownAndTraitProperties(item, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById);
        var supertype = item.supertypeId() == null ? null : itemById.get(item.supertypeId());
        if (supertype == null) return own;
        var inherited = effectiveProperties(supertype, itemById, traitIdsByItem, propertiesByItem, propertiesByTrait, traitById).stream()
                .map(p -> p.definedIn() == null ? p.withDefinedIn(new DefinedInView(ENTITY_KIND_SUPERTYPE, supertype.name())) : p)
                .toList();
        return Stream.concat(own.stream(), inherited.stream()).toList();
    }

    // Bundles the schema-wide lookup maps ownAndTraitLinks/effectiveLinks/buildPerspectiveViews all
    // thread through unchanged -- keeps effectiveLinks under Sonar's 7-parameter limit (S107)
    // without changing behavior; every field here is still exactly what buildSchema() already
    // builds once per call and passes down.
    private record LinkBuildContext(
            Map<UUID, List<SchemaRepository.PerspectiveRow>> perspectivesByEntity,
            Map<UUID, String> entityNameMap,
            Set<UUID> itemEntityIds,
            Map<UUID, List<AdminPropertyDefinitionView>> propertiesByLink,
            Map<UUID, List<UUID>> traitIdsByItem,
            Map<UUID, TraitRow> traitById) {
    }

    private Map<String, List<ItemLinkPerspectiveView>> ownAndTraitLinks(ItemRow item, LinkBuildContext ctx) {
        var traitIds = ctx.traitIdsByItem().getOrDefault(item.id(), List.of());
        var ownLinks = buildPerspectiveViews(item.id(), ctx, null);
        var traitLinks = traitIds.stream()
                .map(traitId -> {
                    var trait = ctx.traitById().get(traitId);
                    var definedIn = new DefinedInView(ENTITY_KIND_TRAIT, trait.name());
                    return buildPerspectiveViews(trait.id(), ctx, definedIn);
                })
                .filter(m -> m != null && !m.isEmpty())
                .reduce(new LinkedHashMap<>(), (acc, m) -> { acc.putAll(m); return acc; });
        return mergeLinkViews(ownLinks, traitLinks);
    }

    private Map<String, List<ItemLinkPerspectiveView>> effectiveLinks(ItemRow item, Map<UUID, ItemRow> itemById, LinkBuildContext ctx) {
        var own = ownAndTraitLinks(item, ctx);
        var supertype = item.supertypeId() == null ? null : itemById.get(item.supertypeId());
        if (supertype == null) return own;
        var inherited = effectiveLinks(supertype, itemById, ctx);
        return mergeLinkViews(own, retagLinksAsSupertype(inherited, supertype.name()));
    }

    private Map<String, List<ItemLinkPerspectiveView>> retagLinksAsSupertype(
            Map<String, List<ItemLinkPerspectiveView>> links, String supertypeName) {
        if (links == null) return new LinkedHashMap<>();
        var definedIn = new DefinedInView(ENTITY_KIND_SUPERTYPE, supertypeName);
        var result = new LinkedHashMap<String, List<ItemLinkPerspectiveView>>();
        links.forEach((name, list) -> result.put(name, list.stream()
                .map(p -> p.definedIn() == null
                        ? new ItemLinkPerspectiveView(p.targets(), p.description(), p.minCardinality(), p.maxCardinality(), p.properties(), definedIn)
                        : p)
                .toList()));
        return result;
    }

    private Map<String, List<ItemLinkPerspectiveView>> buildPerspectiveViews(UUID entityId, LinkBuildContext ctx, DefinedInView definedIn) {
        var perspectives = ctx.perspectivesByEntity().get(entityId);
        if (perspectives == null || perspectives.isEmpty()) return null;
        return perspectives.stream().map(p -> {
            var inverses = repo.findInversePerspectives(p.linkId(), p.id());
            var targets = inverses.stream()
                    .map(inv -> new TargetEntityView(ctx.entityNameMap().get(inv.entityId()), ctx.itemEntityIds().contains(inv.entityId()) ? "item" : ENTITY_KIND_TRAIT))
                    .toList();
            var linkProps = ctx.propertiesByLink().get(p.linkId());
            var linkPropViews = linkProps == null ? null : linkProps.stream()
                    .map(lp -> toCalculated(lp, null))
                    .toList();
            return Map.entry(p.name(), new ItemLinkPerspectiveView(
                    targets, p.description(), p.minCardinality(), p.maxCardinality(), linkPropViews, definedIn));
        }).collect(Collectors.groupingBy(Map.Entry::getKey, LinkedHashMap::new, Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    private Map<String, List<ItemLinkPerspectiveView>> mergeLinkViews(
            Map<String, List<ItemLinkPerspectiveView>> own,
            Map<String, List<ItemLinkPerspectiveView>> inherited) {
        if (own == null && inherited.isEmpty()) return null;
        var result = new LinkedHashMap<String, List<ItemLinkPerspectiveView>>();
        if (own != null) result.putAll(own);
        result.putAll(inherited);
        return result.isEmpty() ? null : result;
    }

    private List<AllowedValue> allowedValuesFor(AdminPropertyDefinitionView p) {
        if (p.controlledListId() == null) return null;
        return controlledListManager.getValues(p.controlledListId(), p.type());
    }
}
