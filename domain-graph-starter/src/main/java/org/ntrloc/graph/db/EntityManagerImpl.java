package org.ntrloc.graph.db;

import org.ntrloc.graph.db.coordinator.LedgerRegisterCoordinator;
import org.ntrloc.graph.db.mutation.MutationRequest;
import org.ntrloc.graph.db.mutation.MutationRequestProcessor;
import org.ntrloc.graph.db.mutation.MutationResponse;
import org.ntrloc.graph.db.partition.ledger.ItemUpdateEntry;
import org.ntrloc.graph.db.partition.security.NtrlocPrincipal;
import org.ntrloc.graph.db.partition.authorization.PermissionService;
import org.ntrloc.graph.db.partition.authorization.RequestPermissionContext;
import org.ntrloc.graph.db.partition.register.RegisterPartitionManager;
import org.ntrloc.graph.db.partition.process.ProcessAccessible;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateMachineView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminStateView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminTransitionView;
import org.ntrloc.graph.db.projection.CollectionProjectionSpec;
import org.ntrloc.graph.db.projection.PredicateEvaluator;
import org.ntrloc.graph.db.projection.ProjectedItem;
import org.ntrloc.graph.db.projection.ProjectionResult;
import org.ntrloc.graph.db.projection.SingleItemProjectionSpec;
import org.ntrloc.graph.db.partition.schema.SchemaManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// @ProcessAccessible: the only bean reachable from process scripts as ${entityManager}, now that
// it fronts both reads and writes. RegisterPartitionManager and LedgerPartitionManagerImpl lost
// the annotation for the same reason -- one seam is enough.
@Service("entityManager")
@ProcessAccessible
public class EntityManagerImpl implements EntityManager {

    private final RegisterPartitionManager registerPartitionManager;
    private final SchemaManager schemaManager;
    private final PermissionService permissionService;
    private final MutationRequestProcessor mutationRequestProcessor;
    private final LedgerRegisterCoordinator coordinator;

    public EntityManagerImpl(RegisterPartitionManager registerPartitionManager, SchemaManager schemaManager,
                              PermissionService permissionService, MutationRequestProcessor mutationRequestProcessor,
                              LedgerRegisterCoordinator coordinator) {
        this.registerPartitionManager = registerPartitionManager;
        this.schemaManager = schemaManager;
        this.permissionService = permissionService;
        this.mutationRequestProcessor = mutationRequestProcessor;
        this.coordinator = coordinator;
    }

    // Polymorphic by default: itemTypeName resolves to itself plus every descendant (see
    // SchemaManager.resolveSupertypeInclusiveItemTypeIds), so a lookup by a supertype name still
    // finds an item that actually exists as a concrete subtype. The permission check runs against
    // the item's *actual* type, not the queried name -- what matters is whether this principal can
    // read the concrete data being returned, not the root of however it was searched for.
    @Override
    public Optional<ProjectedItem> project(SingleItemProjectionSpec spec, String binaryBaseUrl, NtrlocPrincipal principal) {
        UUID rootItemTypeId = resolveItemTypeId(spec.itemTypeName());
        Set<UUID> allowedItemTypeIds = schemaManager.resolveSupertypeInclusiveItemTypeIds(rootItemTypeId);

        Optional<UUID> actualItemTypeId = registerPartitionManager.findItemTypeId(spec.itemId());
        if (actualItemTypeId.isEmpty() || !allowedItemTypeIds.contains(actualItemTypeId.get())) {
            return Optional.empty();
        }
        requireReadAccess(principal, actualItemTypeId.get(), spec.itemTypeName());
        // Instance-level check, separate from the type-level one above -- cheaper to check before
        // fetching the item's own (possibly large) properties than to fetch first and discard; see
        // RegisterPartitionManager.projectOne's own comment on why this lives here, not in a
        // query-level semi-join.
        if (!permissionService.canReadItem(principal, spec.itemId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown item type: " + spec.itemTypeName());
        }
        var permissionContext = permissionService.buildContext(principal);
        return registerPartitionManager.projectOne(actualItemTypeId.get(), spec.itemId(), binaryBaseUrl, spec.links(), permissionContext,
                Boolean.TRUE.equals(spec.includePermissions()), Boolean.TRUE.equals(spec.includeStates()));
    }

    @Override
    public ProjectionResult project(CollectionProjectionSpec spec, String binaryBaseUrl, NtrlocPrincipal principal) {
        Set<UUID> itemTypeIds = resolveItemTypeIds(spec);

        // A *partial* drop (some branches unreadable, at least one isn't) proceeds silently --
        // a principal who can't read one specific subtype should still see every other branch of a
        // polymorphic query, not have the whole query fail. But if filtering leaves nothing
        // readable at all, that has to behave exactly like the pre-existing single-type case
        // already tested and relied on (AuthorizationEndpointsIntegrationTest): 404, not an empty
        // 200 -- an empty-but-200 response would leak "something exists here, you're just not
        // allowed to see it," which is exactly what the existing 404-not-403 principle exists to
        // avoid. requireReadAccess below reuses that exact same signal for the "nothing readable"
        // case, single-type or not.
        Set<UUID> readableItemTypeIds = itemTypeIds.stream()
                .filter(id -> permissionService.canReadItemType(principal, id))
                .collect(Collectors.toSet());
        if (readableItemTypeIds.isEmpty()) {
            String queriedName = spec.itemTypeName() != null ? spec.itemTypeName() : spec.traitName();
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown item type: " + queriedName);
        }

        var permissionContext = permissionService.buildContext(principal);
        // The common case (a type with no descendants, queried by name) goes through the existing,
        // proven single-table path unchanged -- projectAcrossTypes only engages once polymorphism
        // is actually in play, not on every request.
        return readableItemTypeIds.size() == 1
                ? registerPartitionManager.project(readableItemTypeIds.iterator().next(), spec, binaryBaseUrl, permissionContext)
                : registerPartitionManager.projectAcrossTypes(readableItemTypeIds, spec, binaryBaseUrl, permissionContext);
    }

    // Exactly one of itemTypeName/traitName must be set; resolves to the set of concrete item-type
    // ids the query should span -- itself plus every descendant for a supertype root, or every
    // implementer (direct or inherited) for a trait.
    private Set<UUID> resolveItemTypeIds(CollectionProjectionSpec spec) {
        boolean hasItemType = spec.itemTypeName() != null && !spec.itemTypeName().isBlank();
        boolean hasTrait = spec.traitName() != null && !spec.traitName().isBlank();
        if (hasItemType == hasTrait) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specify exactly one of itemTypeName or traitName");
        }
        if (hasItemType) {
            return schemaManager.resolveSupertypeInclusiveItemTypeIds(resolveItemTypeId(spec.itemTypeName()));
        }
        return schemaManager.resolveTraitImplementerItemTypeIds(resolveTraitId(spec.traitName()));
    }

    private UUID resolveTraitId(String traitName) {
        return schemaManager.getAdminSchema().traits().stream()
                .filter(t -> t.name().equals(traitName))
                .map(t -> t.id())
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown trait: " + traitName));
    }

    // Pure passthrough -- no permission check, matching MutationRequestProcessor's own documented
    // gap (its class comment: "Permission checks are a separate, not-yet-built component").
    // Deliberately not bundled into this change; see project()'s own requireReadAccess for the
    // write-side equivalent this will eventually need.
    // principal here is @Nullable and purely for ledger attribution (who made this change), not a
    // permission gate the way project()'s principal is -- see MutationRequestProcessor.process's
    // own note.
    @Override
    public MutationResponse mutate(MutationRequest request, NtrlocPrincipal principal) {
        return mutationRequestProcessor.process(request, principal);
    }

    @Override
    public void startStateMachine(UUID itemId, String stateMachineName, NtrlocPrincipal principal) {
        UUID itemTypeId = requireItemType(itemId);
        UUID smId = registerPartitionManager.resolveStateMachineId(itemTypeId, stateMachineName);
        AdminStateMachineView machine = machineView(itemTypeId, smId);

        if (registerPartitionManager.currentStateIds(itemId).containsKey(smId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "State machine '" + stateMachineName + "' is already active on this item");
        }
        AdminStateView startState = machine.states().stream()
                .filter(s -> "START".equals(s.kind())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "State machine has no START state"));
        AdminTransitionView startTransition = startState.transitions().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "State machine '" + stateMachineName + "' has no start transition"));

        var ctx = permissionService.buildContext(principal);
        if (!permissionService.mayStartStateMachine(ctx, permissionService.markerIdsForItem(itemId), smId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted to start this state machine");
        }

        commitStateEntry(new ItemUpdateEntry(itemId, Map.of(), Map.of(smId, startTransition.toStateId()), Set.of(), Set.of(), Set.of()), principal);
    }

    @Override
    public void executeTransition(UUID itemId, String stateMachineName, UUID transitionId, NtrlocPrincipal principal) {
        UUID itemTypeId = requireItemType(itemId);
        UUID smId = registerPartitionManager.resolveStateMachineId(itemTypeId, stateMachineName);
        AdminStateMachineView machine = machineView(itemTypeId, smId);

        UUID currentStateId = registerPartitionManager.currentStateIds(itemId).get(smId);
        if (currentStateId == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "State machine '" + stateMachineName + "' is not active on this item");
        }
        AdminStateView currentState = machine.states().stream()
                .filter(s -> s.id().equals(currentStateId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Current state no longer exists in the schema"));
        AdminTransitionView transition = currentState.transitions().stream()
                .filter(t -> t.id().equals(transitionId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transition is not available from the current state"));

        var ctx = permissionService.buildContext(principal);
        if (!permissionService.mayExecuteTransition(ctx, permissionService.markerIdsForItem(itemId), transitionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted to execute this transition");
        }

        if (hasGuard(transition) && !guardSatisfied(itemTypeId, itemId, transition)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Transition guard not satisfied");
        }

        AdminStateView targetState = machine.states().stream()
                .filter(s -> s.id().equals(transition.toStateId())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Target state no longer exists in the schema"));
        ItemUpdateEntry entry = "END".equals(targetState.kind())
                ? new ItemUpdateEntry(itemId, Map.of(), Map.of(), Set.of(smId), Set.of(), Set.of())
                : new ItemUpdateEntry(itemId, Map.of(), Map.of(smId, targetState.id()), Set.of(), Set.of(), Set.of());
        commitStateEntry(entry, principal);
    }

    private UUID requireItemType(UUID itemId) {
        return registerPartitionManager.findItemTypeId(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown item: " + itemId));
    }

    private AdminStateMachineView machineView(UUID itemTypeId, UUID smId) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(i -> i.id().equals(itemTypeId)).findFirst()
                .map(AdminItemDefinitionView::stateMachines).orElse(List.of()).stream()
                .filter(m -> m.id().equals(smId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown state machine"));
    }

    // A stored JSON null (NullNode) is not a real guard -- see SchemaRepository.serializeGuardCondition.
    private static boolean hasGuard(AdminTransitionView transition) {
        return transition.guardCondition() != null && !transition.guardCondition().isNull();
    }

    private boolean guardSatisfied(UUID itemTypeId, UUID itemId, AdminTransitionView transition) {
        ProjectedItem item = registerPartitionManager
                .projectOne(itemTypeId, itemId, "", null, RequestPermissionContext.forSuperuser())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown item: " + itemId));
        Map<String, String> currentStateByMachine = new java.util.HashMap<>();
        if (item.states() != null) {
            item.states().forEach((name, s) -> {
                if (s.currentState() != null) currentStateByMachine.put(name, s.currentState());
            });
        }
        return PredicateEvaluator.evaluate(
                PredicateEvaluator.fromJson(transition.guardCondition()), item.properties(), currentStateByMachine);
    }

    private void commitStateEntry(ItemUpdateEntry entry, NtrlocPrincipal principal) {
        UUID transactionId = UUID.randomUUID();
        String actor = principal == null ? null : principal.externalId();
        coordinator.prepare(List.of(entry), transactionId, actor);
        coordinator.commit(transactionId, UUID.randomUUID());
    }

    private void requireReadAccess(NtrlocPrincipal principal, UUID itemTypeId, String itemTypeName) {
        if (!permissionService.canReadItemType(principal, itemTypeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown item type: " + itemTypeName);
        }
    }

    private UUID resolveItemTypeId(String itemTypeName) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.name().equals(itemTypeName))
                .map(item -> item.id())
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Unknown item type: " + itemTypeName));
    }
}
