// The "ViewModel" -- UI-facing state (selection, entity lists, dirty tracking, mutation
// building), a direct port of the Angular reference's SchemaViewModel. Angular uses signals for
// reactivity; this app has no reactive framework, so instead this is a plain singleton object
// plus a subscriber list, mirroring the existing onTaskEvent/task-events.js pattern used for a
// different concern. ntrloc-schema-editor.js subscribes once in connectedCallback() and calls
// this.render() on every notification -- the only full re-render trigger, same as how
// ntrloc-tasks.js already re-renders itself on task events.
const schemaViewModelListeners = new Set();

function onSchemaViewModelChange(listener) {
  schemaViewModelListeners.add(listener);
  return () => schemaViewModelListeners.delete(listener);
}

// Converts a property (and, recursively, any of its own children) into the
// CreatePropertyDefinitionMutation JSON shape the backend expects -- shared by every place that
// embeds an initial property list (CREATE_ITEM, CREATE_TRAIT, CREATE_LINK) or creates a single
// new property, standalone or nested (CREATE_ITEM_PROPERTY, CREATE_LINK_PROPERTY,
// CREATE_OBJECT_PROPERTY_CHILD). The backend creates the whole returned subtree atomically, in
// one call, since a still-unsaved property has no real id yet for a *separate* child-creation
// call to reference (same "no real id yet" limitation CREATE_STATE_MACHINE's own comment
// documents for state machines) -- embedding sidesteps that rather than working around it.
function toCreatePropertySpec(prop) {
  return {
    name: prop.name, description: prop.description,
    propertyType: prop.type, cardinality: prop.cardinality, usage: prop.usage, facetable: prop.facetable,
    properties: prop.properties.map(toCreatePropertySpec),
  };
}

// Recurses into an OBJECT property's children (however deep), collecting UPDATE_PROPERTY/
// DELETE_PROPERTY/CREATE_OBJECT_PROPERTY_CHILD the same way collectMutations()'s own top-level
// property loop does. UPDATE_PROPERTY/DELETE_PROPERTY are keyed purely by the property's own id,
// so nesting depth doesn't matter to them; uses ownFieldsDirty, not isDirty, for the same reason
// the top-level loop below does -- isDirty is true whenever a descendant changed too, which would
// otherwise emit a spurious no-op UPDATE_PROPERTY for every ancestor on the way up.
//
// A new child is only reachable here when parentPropertyId is real, i.e. the *immediate* container
// already exists -- a new child of a still-new top-level property is embedded directly in that
// property's own CREATE_ITEM_PROPERTY/CREATE_LINK_PROPERTY spec instead (see the two call sites
// below), so this function is never reached for it at all.
function collectNestedPropertyMutations(properties, ops, parentPropertyId) {
  for (const prop of properties) {
    if (prop.isReadonly) continue;
    if (prop.isNew) {
      ops.push({ type: 'CREATE_OBJECT_PROPERTY_CHILD', parentPropertyId, ...toCreatePropertySpec(prop) });
      continue; // prop's own new children are embedded in the spec above, not created separately
    }
    if (prop.isDeleted) {
      ops.push({ type: 'DELETE_PROPERTY', id: prop.id });
      continue; // a deleted property's own (soon-to-be-orphaned) children aren't walked further
    }
    if (prop.ownFieldsDirty) {
      ops.push({ type: 'UPDATE_PROPERTY', id: prop.id, name: prop.name, description: prop.description, propertyType: prop.type, cardinality: prop.cardinality, usage: prop.usage, facetable: prop.facetable });
    }
    if (prop.listAssociationDirty) {
      ops.push({ type: 'SET_PROPERTY_CONTROLLED_LIST', propertyId: prop.id, listId: prop.controlledListId });
    }
    collectNestedPropertyMutations(prop.properties, ops, prop.id);
  }
}

function notifySchemaViewModelChange() {
  schemaViewModelListeners.forEach((listener) => listener());
}

const schemaViewModel = {
  items: [],
  traits: [],
  // Policy markers (authorization_marker) -- loaded alongside the schema for admin convenience
  // (an admin naturally reaches for marker creation from the item-type editor, since a marker's
  // scope is one specific item type/trait), but NOT part of the schema-mutation batch system:
  // markerService.createMarker is a direct, immediate write (see marker-service.js's own comment),
  // unlike items/traits/links which stage locally and only commit on Save. Rendered inside
  // ntrloc-item-detail.js's own "Access Markers" panel, filtered to whichever item is selected --
  // see markersForItem below.
  markers: [],
  // Marker assignment rules (authorization_marker_rule) -- read-only here (see marker-service.js's
  // getMarkerRules and MarkerAdminController's own comment on why there's no create/edit yet),
  // loaded the same best-effort way as markers/processDefinitions. Rendered in ntrloc-item-detail.js's
  // "Access Control" panel, second subsection, filtered to the selected item type -- see
  // markerRulesForItem below.
  markerRules: [],
  propertyTypes: [],
  // Flowable's deployed process definitions -- fetched alongside the schema purely to populate
  // the entry/exit/transition/init process pickers in the states editor. Best-effort: a failure
  // here (see _loadProcessDefinitions) never blocks the schema itself from loading.
  processDefinitions: [],
  // Reusable controlled lists (schema_controlled_list) -- managed as their own schema element
  // alongside items/traits, and staged/committed through the same Save flow (see
  // ControlledListViewModel + collectMutations' CREATE/UPDATE/DELETE_CONTROLLED_LIST ops). A
  // property opts into a list via its own controlledListId (SET_PROPERTY_CONTROLLED_LIST); one
  // list can back many properties across different item types/traits.
  controlledLists: [],
  selectedItem: null,
  selectedTrait: null,
  selectedControlledList: null,
  // Not-yet-saved links (see schema-viewmodels.js's PendingLinkViewModel) -- a plain array, not
  // nested inside items/traits, since a link spans two item types and doesn't belong to either
  // one alone.
  pendingNewLinks: [],
  _loaded: false,

  // Collapse/expand state for the Traits/Properties/Links panels in ntrloc-item-detail.js. Lives
  // here (not as an instance field on ntrloc-item-detail) because that element is destroyed and
  // recreated on every schemaViewModel change -- every field edit calls
  // notifySchemaViewModelChange(), which ntrloc-schema-editor.js reacts to by rebuilding its
  // entire innerHTML, including a fresh <ntrloc-item-detail>. Storing the toggle state on this
  // persistent singleton instead is what makes a panel stay collapsed while the user keeps
  // editing, matching the Angular reference's mat-expansion-panel (whose own open/closed state
  // is intrinsic to the long-lived component instance, not reset by unrelated input changes).
  sectionsExpanded: { traits: true, properties: true, links: true, states: true, accessControl: true },

  // Markers scoped to a given item type -- the only scope kind ntrloc-item-detail.js's "Access
  // Control" panel shows right now (see that panel's own comment on why trait-scoped markers
  // aren't included yet).
  markersForItem(itemId) {
    return this.markers.filter((m) => m.scopeKind === 'ITEM_TYPE' && m.scopeId === itemId);
  },

  // Rules target an item type directly (MarkerRuleAdminRow.itemTypeId), no scope-kind indirection
  // the way markers have.
  markerRulesForItem(itemId) {
    return this.markerRules.filter((r) => r.itemTypeId === itemId);
  },

  get isDirty() {
    return this.items.some((i) => i.isDirty)
      || this.traits.some((t) => t.isDirty)
      || this.controlledLists.some((l) => l.isDirty)
      || this.pendingNewLinks.length > 0;
  },

  // The backend has no friendly error for a malformed CREATE_LINK (self-referential links hit an
  // unhandled UNIQUE constraint violation; missing names hit a raw NOT NULL violation) -- see
  // PendingLinkViewModel.isValid. Save is gated on this so an incomplete pending link can never
  // actually be submitted; the UI surfaces why instead of letting the request 500.
  get hasInvalidPendingLinks() {
    return this.pendingNewLinks.some((link) => !link.isValid);
  },

  // Same "gate Save, don't invent a fixup" approach as hasInvalidPendingLinks -- predicateHasErrors
  // is exported by ntrloc-predicate-builder.js specifically so a host embedding it (here:
  // ntrloc-state-machine-editor.js's transition guard field) can check this without duplicating
  // its validity rules. A transition with no guard at all is always valid (predicateHasErrors(null)
  // is false) -- only a started-but-incomplete guard blocks Save.
  get hasInvalidPendingGuardConditions() {
    return this.items.some((item) => item.stateMachines.some((machine) => !machine.isDeleted
      && machine.states.some((state) => !state.isDeleted
        && state.transitions.some((t) => !t.isDeleted && predicateHasErrors(t.guardCondition)))));
  },

  // De-duplicated, latest-version-per-key view of processDefinitions -- a schema-level process
  // reference (entry/exit/transition/init process id) is stored as the process *key*, not a
  // specific "<key>:<version>:<generatedId>" definition id, so it keeps resolving correctly after
  // a process is redeployed at a new version.
  get processOptions() {
    const latestByKey = new Map();
    for (const def of this.processDefinitions) {
      const existing = latestByKey.get(def.key);
      if (!existing || def.version > existing.version) latestByKey.set(def.key, def);
    }
    return [...latestByKey.values()].sort((a, b) => (a.name ?? a.key).localeCompare(b.name ?? b.key));
  },

  newLink(item) {
    this.pendingNewLinks = [...this.pendingNewLinks, PendingLinkViewModel.create(item.id)];
    notifySchemaViewModelChange();
  },

  removePendingLink(pendingLink) {
    this.pendingNewLinks = this.pendingNewLinks.filter((link) => link !== pendingLink);
    notifySchemaViewModelChange();
  },

  load() {
    if (this._loaded) return Promise.resolve();
    return Promise.all([schemaModel.load(), this._loadProcessDefinitions(), this._loadMarkers(), this._loadMarkerRules()])
      .then(([schema]) => this._applySchema(schema, null, null, null, null, null, null));
  },

  reload() {
    const selectedItemId = this.selectedItem?.id ?? null;
    const selectedItemName = this.selectedItem?.name ?? null;
    const selectedTraitId = this.selectedTrait?.id ?? null;
    const selectedTraitName = this.selectedTrait?.name ?? null;
    const selectedListId = this.selectedControlledList?.id ?? null;
    const selectedListName = this.selectedControlledList?.name ?? null;
    this._loaded = false;
    this.selectedItem = null;
    this.selectedTrait = null;
    this.selectedControlledList = null;
    this.pendingNewLinks = [];
    return Promise.all([schemaModel.reload(), this._loadProcessDefinitions(), this._loadMarkers(), this._loadMarkerRules()])
      .then(([schema]) => this._applySchema(schema, selectedItemId, selectedItemName, selectedTraitId, selectedTraitName, selectedListId, selectedListName));
  },

  // Best-effort: a failure loading process definitions (Flowable down, etc.) shouldn't block the
  // schema editor itself from opening -- the process pickers just render as text inputs fed by an
  // empty list until this succeeds on a later reload.
  _loadProcessDefinitions() {
    return schemaService.getProcessDefinitions()
      .then((defs) => { this.processDefinitions = defs; })
      .catch((e) => {
        console.error('[schema] failed to load process definitions:', e);
        this.processDefinitions = [];
      });
  },

  // Same best-effort treatment as _loadProcessDefinitions -- a marker-listing failure shouldn't
  // block the schema editor itself from opening.
  _loadMarkers() {
    return markerService.getMarkers()
      .then((markers) => { this.markers = markers; })
      .catch((e) => {
        console.error('[schema] failed to load markers:', e);
        this.markers = [];
      });
  },

  _loadMarkerRules() {
    return markerService.getMarkerRules()
      .then((rules) => { this.markerRules = rules; })
      .catch((e) => {
        console.error('[schema] failed to load marker rules:', e);
        this.markerRules = [];
      });
  },

  // Direct, immediate write (see marker-service.js's own comment) -- unlike newItem()/newTrait(),
  // there's no local draft stage; the marker exists on the server (and in AuthorizationCacheManager)
  // the moment this resolves. Throws on failure so the caller (ntrloc-item-detail.js) can show the
  // error inline rather than this silently doing nothing.
  async createMarker({ name, description, scopeKind, scopeId }) {
    const marker = await markerService.createMarker({ name, description, scopeKind, scopeId });
    this.markers = [...this.markers, marker].sort((a, b) => a.name.localeCompare(b.name));
    this.sectionsExpanded.accessControl = true;
    notifySchemaViewModelChange();
    return marker;
  },

  async updateMarker(id, { name, description }) {
    const marker = await markerService.updateMarker(id, { name, description });
    this.markers = this.markers
      .map((m) => (m.id === id ? marker : m))
      .sort((a, b) => a.name.localeCompare(b.name));
    notifySchemaViewModelChange();
    return marker;
  },

  async deleteMarker(id) {
    await markerService.deleteMarker(id);
    this.markers = this.markers.filter((m) => m.id !== id);
    notifySchemaViewModelChange();
  },

  // Same immediate-write shape as createMarker -- see marker-service.js's own comment on why
  // there's no local draft stage for either.
  async createMarkerRule({ name, itemTypeId, decisionKey }) {
    const rule = await markerService.createMarkerRule({ name, itemTypeId, decisionKey });
    this.markerRules = [...this.markerRules, rule].sort((a, b) => a.name.localeCompare(b.name));
    this.sectionsExpanded.accessControl = true;
    notifySchemaViewModelChange();
    return rule;
  },

  // Immediate write, same as createMarkerRule/deleteMarker -- no local draft stage, not part of
  // the schema-mutation batch.
  async deleteMarkerRule(id) {
    await markerService.deleteMarkerRule(id);
    this.markerRules = this.markerRules.filter((r) => r.id !== id);
    notifySchemaViewModelChange();
  },

  // Traits/States start collapsed the moment an item/trait is selected if that section would
  // otherwise be empty -- nothing worth showing open by default. Called only from
  // selectItem/selectTrait (a real selection change), never from a render cycle -- every field
  // edit anywhere in the panel re-renders via notifySchemaViewModelChange, and recomputing here
  // on every one of those would immediately re-collapse a section the user just expanded to
  // start adding to it. Properties/Links are left alone: both are core to every item type and
  // stay open by default regardless of content, matching today's behavior.
  //
  // hasTraits mirrors ntrloc-item-detail.js's own display logic exactly, not just "any traits
  // exist": an item's own traitAssignments (unfiltered -- a pending removal or a brand-new
  // not-yet-saved assignment both still count, same as trait-chip rendering) for isItem, or
  // (viewing a trait) whether any item's traitAssignments references this trait's id at all,
  // matching implementingItems' own "any assignment, even isRemoved" check.
  _applyDefaultSectionsExpanded(entity, isItem) {
    const hasTraits = isItem
      ? entity.traitAssignments.length > 0
      : this.items.some((item) => item.traitAssignments.some((t) => t.id === entity.id));
    this.sectionsExpanded = {
      ...this.sectionsExpanded,
      traits: hasTraits,
      states: isItem ? entity.stateMachines.some((m) => !m.isDeleted) : this.sectionsExpanded.states,
      accessControl: isItem
        ? (this.markersForItem(entity.id).length > 0 || this.markerRulesForItem(entity.id).length > 0)
        : this.sectionsExpanded.accessControl,
    };
  },

  selectItem(item) {
    this.selectedTrait = null;
    this.selectedControlledList = null;
    this.selectedItem = item;
    this._applyDefaultSectionsExpanded(item, true);
    notifySchemaViewModelChange();
  },

  selectTrait(trait) {
    this.selectedItem = null;
    this.selectedControlledList = null;
    this.selectedTrait = trait;
    this._applyDefaultSectionsExpanded(trait, false);
    notifySchemaViewModelChange();
  },

  selectControlledList(list) {
    this.selectedItem = null;
    this.selectedTrait = null;
    this.selectedControlledList = list;
    notifySchemaViewModelChange();
  },

  newControlledList() {
    const vm = ControlledListViewModel.create();
    this.controlledLists = [...this.controlledLists, vm];
    this.selectControlledList(vm);
  },

  // Same isNew-vs-not shape as deleteItem/deleteTrait. A list still attached to properties is
  // deletable anyway -- the FK's ON DELETE SET NULL auto-detaches them server-side, and list
  // values are advisory (no item data is invalidated). ntrloc-controlled-list-detail.js shows a
  // "N properties will be detached" heads-up from list.usedBy before the user commits.
  deleteControlledList(list) {
    if (list.isNew) {
      this.controlledLists = this.controlledLists.filter((l) => l !== list);
      if (this.selectedControlledList === list) this.selectedControlledList = null;
    } else {
      list.isDeleted = true;
    }
    notifySchemaViewModelChange();
  },

  newItem() {
    const vm = ItemDefinitionViewModel.create();
    this.items = [...this.items, vm];
    this.selectItem(vm);
  },

  newTrait() {
    const vm = TraitDefinitionViewModel.create();
    this.traits = [...this.traits, vm];
    this.selectTrait(vm);
  },

  // Same isNew-vs-not shape as ItemDefinitionViewModel.removeStateMachine, but at this level
  // (item types/traits are top-level, not nested inside another view-model) rather than on the
  // view-model class itself, since only schemaViewModel holds the items/traits arrays a brand-new
  // one needs removing from. A brand-new one has nothing left to show once removed, so selection
  // clears; an existing one stays selected so ntrloc-item-detail.js can show its "marked for
  // deletion" state rather than jumping to a blank pane.
  deleteItem(item) {
    if (item.isNew) {
      this.items = this.items.filter((i) => i !== item);
      if (this.selectedItem === item) this.selectedItem = null;
    } else {
      item.isDeleted = true;
    }
    notifySchemaViewModelChange();
  },

  deleteTrait(trait) {
    if (trait.isNew) {
      this.traits = this.traits.filter((t) => t !== trait);
      if (this.selectedTrait === trait) this.selectedTrait = null;
    } else {
      trait.isDeleted = true;
    }
    notifySchemaViewModelChange();
  },

  // Direct port of Angular's SchemaViewModel.collectMutations() (schema-view-model.ts lines
  // 75-161) -- same iteration order, same processedLinkIds dedup-per-link-not-per-perspective
  // logic, same "new item/trait short-circuits to a single inline CREATE_* and skips further
  // diffing" behavior. Existing-trait name/description edits are intentionally NOT collected: the
  // backend has no UPDATE_TRAIT mutation yet, matching the Angular reference's own
  // "TODO: UPDATE_TRAIT when backend supports it" gap rather than inventing a mutation type the
  // backend doesn't support.
  collectMutations() {
    const ops = [];
    const processedLinkIds = new Set();

    // Controlled-list lifecycle first: a SET_PROPERTY_CONTROLLED_LIST emitted by the property
    // loops below may point at a list that CREATE_CONTROLLED_LIST in this same batch just made
    // (the backend applies ops in array order). UPDATE sends name/values only when each actually
    // changed -- null means "leave alone" (values stay null when never lazy-loaded, so a rename
    // can't wipe them).
    for (const list of this.controlledLists) {
      if (!list.isDirty) continue;
      if (list.isNew) {
        ops.push({ type: 'CREATE_CONTROLLED_LIST', name: list.name, valueType: list.valueType, values: list.values });
        continue;
      }
      if (list.isDeleted) {
        ops.push({ type: 'DELETE_CONTROLLED_LIST', listId: list.id });
        continue;
      }
      ops.push({
        type: 'UPDATE_CONTROLLED_LIST',
        listId: list.id,
        name: list.name !== list.originalName ? list.name : null,
        values: list.valuesLoaded && JSON.stringify(list.values) !== JSON.stringify(list.originalValues) ? list.values : null,
      });
    }

    for (const item of this.items) {
      if (!item.isDirty) continue;

      if (item.isNew) {
        ops.push({
          type: 'CREATE_ITEM',
          name: item.name,
          description: item.description,
          properties: item.properties.map(toCreatePropertySpec),
          supertypeId: item.supertypeId,
          abstractType: item.abstractType,
          displayLabelPattern: item.displayLabelPattern,
        });
        continue;
      }

      if (item.isDeleted) {
        ops.push({ type: 'DELETE_ITEM', id: item.id });
        continue;
      }

      if (item.name !== item.originalName || (item.description ?? '') !== (item.originalDescription ?? '')
        || item.supertypeId !== item.originalSupertypeId || item.abstractType !== item.originalAbstractType
        || (item.displayLabelPattern ?? '') !== (item.originalDisplayLabelPattern ?? '')) {
        ops.push({
          type: 'UPDATE_ITEM', id: item.id, name: item.name, description: item.description,
          supertypeId: item.supertypeId, abstractType: item.abstractType,
          displayLabelPattern: item.displayLabelPattern,
        });
      }

      for (const t of item.traitAssignments) {
        if (t.isNew && !t.isRemoved) ops.push({ type: 'IMPLEMENT_TRAIT', itemId: item.id, traitId: t.id });
        else if (t.isRemoved && !t.isNew) ops.push({ type: 'REMOVE_TRAIT', itemId: item.id, traitId: t.id });
      }

      for (const prop of item.properties) {
        if (prop.isReadonly) continue;
        if (prop.isNew) {
          ops.push({ type: 'CREATE_ITEM_PROPERTY', itemId: item.id, ...toCreatePropertySpec(prop) });
          continue; // prop's own new children are embedded above, not created separately
        } else if (prop.isDeleted) {
          ops.push({ type: 'DELETE_PROPERTY', id: prop.id });
          continue;
        } else if (prop.ownFieldsDirty) {
          ops.push({ type: 'UPDATE_PROPERTY', id: prop.id, name: prop.name, description: prop.description, propertyType: prop.type, cardinality: prop.cardinality, usage: prop.usage, facetable: prop.facetable });
        }
        if (!prop.isNew && prop.listAssociationDirty) {
          ops.push({ type: 'SET_PROPERTY_CONTROLLED_LIST', propertyId: prop.id, listId: prop.controlledListId });
        }
        collectNestedPropertyMutations(prop.properties, ops, prop.id);
      }

      for (const perspectives of Object.values(item.links)) {
        for (const p of perspectives) {
          if (p.isReadonly) continue;
          // A link has exactly one definition shared by both its perspectives (see
          // DeleteLinkDefinitionMutation's own repo.deleteLink), so deleting either side deletes
          // the whole thing -- processedLinkIds (already used below for link-property dedup)
          // keeps a self-referential link's two same-item perspectives from emitting this twice.
          if (p.isDeleted) {
            if (!processedLinkIds.has(p.linkId)) {
              processedLinkIds.add(p.linkId);
              ops.push({ type: 'DELETE_LINK', id: p.linkId });
            }
            continue;
          }
          if (p.name !== p.originalName || p.minCardinality !== p.originalMinCardinality || p.maxCardinality !== p.originalMaxCardinality) {
            ops.push({ type: 'UPDATE_PERSPECTIVE', id: p.id, name: p.name, description: p.description, minCardinality: p.minCardinality, maxCardinality: p.maxCardinality });
          }
          if (!processedLinkIds.has(p.linkId) && p.link.isDirty) {
            processedLinkIds.add(p.linkId);
            for (const prop of p.link.properties) {
              if (prop.isNew) {
                ops.push({ type: 'CREATE_LINK_PROPERTY', linkId: p.linkId, ...toCreatePropertySpec(prop) });
                continue; // prop's own new children are embedded above, not created separately
              } else if (prop.isDeleted) {
                ops.push({ type: 'DELETE_PROPERTY', id: prop.id });
                continue;
              } else if (prop.ownFieldsDirty) {
                ops.push({ type: 'UPDATE_PROPERTY', id: prop.id, name: prop.name, description: prop.description, propertyType: prop.type, cardinality: prop.cardinality, usage: prop.usage, facetable: prop.facetable });
              }
              if (!prop.isNew && prop.listAssociationDirty) {
                ops.push({ type: 'SET_PROPERTY_CONTROLLED_LIST', propertyId: prop.id, listId: prop.controlledListId });
              }
              collectNestedPropertyMutations(prop.properties, ops, prop.id);
            }
          }
        }
      }

      // New state machines/states/transitions on a still-new item are unreachable here (item.isNew
      // short-circuits above before this loop runs) -- matches the pendingNewLinks precedent (see
      // newLink's own comment): a not-yet-saved item type has no real id yet for
      // CREATE_STATE_MACHINE's itemDefinitionId to reference.
      for (const machine of item.stateMachines) {
        if (machine.isNew) {
          ops.push({ type: 'CREATE_STATE_MACHINE', itemDefinitionId: item.id, name: machine.name, description: machine.description });
          continue; // a brand-new machine's states are unreachable too -- same "no real id yet" problem, one level down
        }
        if (machine.isDeleted) {
          ops.push({ type: 'DELETE_STATE_MACHINE', id: machine.id });
          continue;
        }
        if (machine.name !== machine.originalName || (machine.description ?? '') !== (machine.originalDescription ?? '')) {
          ops.push({ type: 'UPDATE_STATE_MACHINE', id: machine.id, name: machine.name, description: machine.description });
        }

        for (const state of machine.states) {
          if (state.isNew) {
            ops.push({ type: 'CREATE_STATE', stateMachineId: machine.id, name: state.name, description: state.description, entryProcessId: state.entryProcessId, exitProcessId: state.exitProcessId, entryMarkerDecisionKey: state.entryMarkerDecisionKey });
            continue; // a brand-new state's transitions are unreachable too -- same "no real id yet" problem, one level down
          }
          // START/END pseudostates are server-managed -- never emit CREATE/UPDATE/DELETE_STATE for
          // them, but their outgoing transitions (START -> first state) still flow through below.
          if (!state.isPseudo) {
            if (state.isDeleted) {
              ops.push({ type: 'DELETE_STATE', id: state.id });
              continue;
            }
            if (state.name !== state.originalName
              || (state.description ?? '') !== (state.originalDescription ?? '')
              || state.entryProcessId !== state.originalEntryProcessId
              || state.exitProcessId !== state.originalExitProcessId
              || (state.entryMarkerDecisionKey ?? '') !== (state.originalEntryMarkerDecisionKey ?? '')) {
              ops.push({ type: 'UPDATE_STATE', id: state.id, name: state.name, description: state.description, entryProcessId: state.entryProcessId, exitProcessId: state.exitProcessId, entryMarkerDecisionKey: state.entryMarkerDecisionKey });
            }
          }

          for (const transition of state.transitions) {
            if (transition.isNew) {
              ops.push({ type: 'CREATE_TRANSITION', fromStateId: state.id, toStateId: transition.toStateId, name: transition.name, description: transition.description, processId: transition.processId, guardCondition: transition.guardCondition });
            } else if (transition.isDeleted) {
              ops.push({ type: 'DELETE_TRANSITION', id: transition.id });
            } else if (transition.isDirty) {
              ops.push({ type: 'UPDATE_TRANSITION', id: transition.id, name: transition.name, description: transition.description, processId: transition.processId, guardCondition: transition.guardCondition });
            }
          }
        }
      }
    }

    for (const trait of this.traits) {
      if (!trait.isDirty) continue;

      if (trait.isNew) {
        ops.push({
          type: 'CREATE_TRAIT',
          name: trait.name,
          description: trait.description,
          properties: trait.properties.map(toCreatePropertySpec),
        });
        continue;
      }

      if (trait.isDeleted) {
        ops.push({ type: 'DELETE_TRAIT', id: trait.id });
        continue;
      }

      // TODO: UPDATE_TRAIT when backend supports it (matches Angular reference)
    }

    // Invalid pending links (missing target/names, or self-referential) are never emitted --
    // Save is gated on hasInvalidPendingLinks so this should never actually filter anything out
    // in practice, but it's the last line of defense against a request that would 500.
    for (const link of this.pendingNewLinks) {
      if (!link.isValid) continue;
      ops.push({
        type: 'CREATE_LINK',
        properties: link.properties.map(toCreatePropertySpec),
        perspectives: [
          { itemId: link.firstItemId, name: link.firstPerspectiveName, description: null, minCardinality: link.firstMinCardinality, maxCardinality: link.firstMaxCardinality },
          { itemId: link.secondItemId, name: link.secondPerspectiveName, description: null, minCardinality: link.secondMinCardinality, maxCardinality: link.secondMaxCardinality },
        ],
      });
    }

    return ops;
  },

  // Recurses into an OBJECT property's children, appending their own new/deleted/updated summary
  // lines dotted-path-prefixed (e.g. "contactInfo.firstName") so a change inside a collapsed
  // subtree still shows up in the confirm dialog -- without the recursion, isDirty's own
  // broadened meaning (true for a dirty descendant too, see PropertyDefinitionViewModel's own
  // comment) would make the *parent's* line read "updated" even though none of its own fields
  // changed, with no indication of what actually did.
  describeNestedPropertyChanges(properties, changes, pathPrefix) {
    for (const prop of properties) {
      if (prop.isReadonly) continue;
      if (prop.isNew) { changes.push(`+ Property "${pathPrefix}.${prop.name || '(unnamed)'}"`); continue; }
      const path = `${pathPrefix}.${prop.originalName || '(unnamed)'}`;
      if (prop.isDeleted) { changes.push(`- Property "${path}"`); continue; }
      if (prop.ownFieldsDirty) changes.push(`Property "${path}": updated`);
      if (prop.listAssociationDirty) changes.push(this._describeListAssociationChange(prop, path));
      this.describeNestedPropertyChanges(prop.properties, changes, path);
    }
  },

  // Direct port of Angular's describePendingChanges() -- a parallel, independent human-readable
  // diff used only for the Save-confirm dialog, not sent to the server.
  describePendingChanges() {
    const summaries = [];
    const processedLinkIds = new Set();
    const deletedLinkIds = new Set();

    for (const item of this.items) {
      if (!item.isDirty) continue;

      if (item.isNew) {
        const propSummary = item.properties.length > 0
          ? [`${item.properties.length} propert${item.properties.length === 1 ? 'y' : 'ies'}`]
          : [];
        summaries.push({ label: `+ Item Type "${item.name || '(unnamed)'}"`, changes: propSummary });
        continue;
      }

      if (item.isDeleted) {
        summaries.push({ label: `- Item Type "${item.name}"`, changes: [] });
        continue;
      }

      const changes = [];
      if (item.name !== item.originalName) changes.push(`Name: "${item.originalName}" → "${item.name}"`);
      if ((item.description ?? '') !== (item.originalDescription ?? '')) changes.push('Description updated');
      if (item.supertypeId !== item.originalSupertypeId) {
        const supertypeName = (id) => this.items.find((i) => i.id === id)?.name ?? '(none)';
        changes.push(`Parent type: "${supertypeName(item.originalSupertypeId)}" → "${supertypeName(item.supertypeId)}"`);
      }
      if (item.abstractType !== item.originalAbstractType) changes.push(`Abstract: ${item.abstractType ? 'yes' : 'no'}`);
      if ((item.displayLabelPattern ?? '') !== (item.originalDisplayLabelPattern ?? '')) changes.push('Display label pattern updated');

      for (const t of item.traitAssignments) {
        if (t.isNew && !t.isRemoved) changes.push(`+ Trait "${t.name}"`);
        else if (t.isRemoved) changes.push(`- Trait "${t.name}"`);
      }

      for (const prop of item.properties) {
        if (prop.isReadonly) continue;
        if (prop.isNew) { changes.push(`+ Property "${prop.name}"`); continue; }
        if (prop.isDeleted) { changes.push(`- Property "${prop.originalName}"`); continue; }
        if (prop.ownFieldsDirty) changes.push(`Property "${prop.originalName}": updated`);
        if (prop.listAssociationDirty) changes.push(this._describeListAssociationChange(prop, prop.originalName));
        this.describeNestedPropertyChanges(prop.properties, changes, prop.originalName);
      }

      for (const [perspName, perspectives] of Object.entries(item.links)) {
        for (const p of perspectives) {
          if (p.isReadonly) continue;
          if (p.isDeleted) {
            if (!deletedLinkIds.has(p.linkId)) {
              deletedLinkIds.add(p.linkId);
              summaries.push({ label: `- Link "${perspName}"`, changes: [] });
            }
            continue;
          }
          if (p.name !== p.originalName) {
            summaries.push({ label: `"${perspName}"`, changes: [`Name: "${p.originalName}" → "${p.name}"`] });
          }
          if (p.minCardinality !== p.originalMinCardinality || p.maxCardinality !== p.originalMaxCardinality) {
            summaries.push({ label: `"${perspName}" cardinality`, changes: [`${p.originalMinCardinality}..${p.originalMaxCardinality ?? '∞'} → ${p.minCardinality}..${p.maxCardinality ?? '∞'}`] });
          }
        }
      }

      for (const machine of item.stateMachines) {
        if (!machine.isDirty) continue;
        if (machine.isNew) { changes.push(`+ State machine "${machine.name || '(unnamed)'}"`); continue; }
        if (machine.isDeleted) { changes.push(`- State machine "${machine.originalName}"`); continue; }
        if (machine.name !== machine.originalName || (machine.description ?? '') !== (machine.originalDescription ?? '')) {
          changes.push(`State machine "${machine.originalName}": updated`);
        }
        for (const state of machine.states) {
          if (!state.isDirty) continue;
          if (state.isNew) { changes.push(`+ State "${state.name || '(unnamed)'}" (${machine.originalName})`); continue; }
          if (state.isDeleted) { changes.push(`- State "${state.originalName}" (${machine.originalName})`); continue; }
          changes.push(`State "${state.originalName}" (${machine.originalName}): updated`);
          for (const transition of state.transitions) {
            if (transition.isNew) changes.push(`+ Transition "${transition.name || '(unnamed)'}" (${state.originalName} → ${transition.toStateName})`);
            else if (transition.isDeleted) changes.push(`- Transition "${transition.originalName}"`);
            else if (transition.isDirty) changes.push(`Transition "${transition.originalName}": updated`);
          }
        }
      }

      if (changes.length > 0) summaries.push({ label: item.name, changes });

      for (const perspectives of Object.values(item.links)) {
        for (const p of perspectives) {
          if (p.isReadonly || processedLinkIds.has(p.linkId) || !p.link.isDirty) continue;
          processedLinkIds.add(p.linkId);
          const linkChanges = [];
          for (const prop of p.link.properties) {
            if (prop.isNew) { linkChanges.push(`+ Property "${prop.name}"`); continue; }
            if (prop.isDeleted) { linkChanges.push(`- Property "${prop.originalName}"`); continue; }
            if (prop.ownFieldsDirty) linkChanges.push(`Property "${prop.originalName}": updated`);
            if (prop.listAssociationDirty) linkChanges.push(this._describeListAssociationChange(prop, prop.originalName));
            this.describeNestedPropertyChanges(prop.properties, linkChanges, prop.originalName);
          }
          if (linkChanges.length > 0) summaries.push({ label: this._linkLabel(p.linkId), changes: linkChanges });
        }
      }
    }

    for (const trait of this.traits) {
      if (!trait.isDirty) continue;
      if (trait.isNew) {
        const propSummary = trait.properties.length > 0
          ? [`${trait.properties.length} propert${trait.properties.length === 1 ? 'y' : 'ies'}`]
          : [];
        summaries.push({ label: `+ Trait "${trait.name || '(unnamed)'}"`, changes: propSummary });
      } else if (trait.isDeleted) {
        summaries.push({ label: `- Trait "${trait.name}"`, changes: [] });
      }
    }

    for (const list of this.controlledLists) {
      if (!list.isDirty) continue;
      if (list.isNew) {
        summaries.push({ label: `+ Controlled List "${list.name || '(unnamed)'}"`, changes: [`${list.values.length} value${list.values.length === 1 ? '' : 's'}`] });
        continue;
      }
      if (list.isDeleted) {
        const detach = list.usedBy.length > 0 ? [`${list.usedBy.length} propert${list.usedBy.length === 1 ? 'y' : 'ies'} detached`] : [];
        summaries.push({ label: `- Controlled List "${list.originalName}"`, changes: detach });
        continue;
      }
      const listChanges = [];
      if (list.name !== list.originalName) listChanges.push(`Name: "${list.originalName}" → "${list.name}"`);
      if (list.valuesLoaded && JSON.stringify(list.values) !== JSON.stringify(list.originalValues)) {
        listChanges.push(`${list.values.length} value${list.values.length === 1 ? '' : 's'}`);
      }
      if (listChanges.length > 0) summaries.push({ label: `Controlled List "${list.originalName}"`, changes: listChanges });
    }

    for (const link of this.pendingNewLinks) {
      if (!link.isValid) continue;
      const firstItemName = this.items.find((i) => i.id === link.firstItemId)?.name ?? '?';
      const secondItemName = this.items.find((i) => i.id === link.secondItemId)?.name ?? '?';
      const propSummary = link.properties.length > 0
        ? [`${link.properties.length} propert${link.properties.length === 1 ? 'y' : 'ies'}`]
        : [];
      summaries.push({
        label: `+ Link "${link.firstPerspectiveName}" (${firstItemName} ↔ ${secondItemName}) "${link.secondPerspectiveName}"`,
        changes: propSummary,
      });
    }

    return summaries;
  },

  _linkLabel(linkId) {
    const names = [];
    for (const item of this.items) {
      if (Object.values(item.links).some((ps) => ps.some((p) => p.linkId === linkId))) names.push(item.name);
    }
    return `Link (${names.join(' ↔ ')})`;
  },

  // Confirm-dialog line for a property whose controlled-list association changed (its
  // SET_PROPERTY_CONTROLLED_LIST op in collectMutations). `label` is the already-formatted
  // property path/name the caller uses for its other lines.
  _describeListAssociationChange(prop, label) {
    if (prop.controlledListId == null) return `Property "${label}": list detached`;
    const list = this.controlledLists.find((l) => l.id === prop.controlledListId);
    return `Property "${label}": list → "${list?.name ?? list?.originalName ?? '?'}"`;
  },

  _applySchema(schema, restoreItemId, restoreItemName, restoreTraitId, restoreTraitName, restoreListId, restoreListName) {
    this._loaded = true;
    this.propertyTypes = schema.propertyTypes;
    const linkMap = new Map(
      schema.links.map((link) => [link.id, LinkViewModel.fromAdmin(link, schema.propertyTypes)]));

    this.items = [...schema.items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ItemDefinitionViewModel.fromAdmin(item, schema.propertyTypes, linkMap));

    this.traits = [...(schema.traits ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((trait) => TraitDefinitionViewModel.fromAdmin(trait, schema.propertyTypes, linkMap));

    this.controlledLists = [...(schema.controlledLists ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => ControlledListViewModel.fromAdmin(list));

    const restoredItem = restoreItemId
      ? this.items.find((i) => i.id === restoreItemId)
      : restoreItemName
        ? this.items.find((i) => i.name === restoreItemName)
        : null;
    if (restoredItem) this.selectedItem = restoredItem;

    const restoredTrait = restoreTraitId
      ? this.traits.find((t) => t.id === restoreTraitId)
      : restoreTraitName
        ? this.traits.find((t) => t.name === restoreTraitName)
        : null;
    if (restoredTrait) this.selectedTrait = restoredTrait;

    // A brand-new list that was just saved comes back with a real id, so an id lookup misses --
    // fall back to name (list names are unique, enforced in ControlledListMutationApplier).
    const restoredList = restoreListId
      ? this.controlledLists.find((l) => l.id === restoreListId)
      : null;
    const restoredListByName = restoredList
      ?? (restoreListName ? this.controlledLists.find((l) => l.name === restoreListName) : null);
    if (restoredListByName) this.selectedControlledList = restoredListByName;

    notifySchemaViewModelChange();
  },
};
