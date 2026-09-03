injectStyles('ntrloc-item-detail-styles', `
  ntrloc-item-detail {
    display: contents;
  }
  .item-header {
    margin-bottom: 20px;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  /* ITEM/TRAIT eyebrow on the left, Delete Item Type/Delete Trait (or its deleted-status text) on
     the right -- shared by both entity kinds, unlike the rest of item-header below it (the
     parent-type row is items-only). Name/Description/etc. all follow beneath this, so the delete
     action reads as acting on the item type or trait as a whole rather than on any one field. */
  .header-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .states-edit-row {
    margin-top: 12px;
  }
  /* Without this, the diagram's own box wraps tightly to whatever height the states/transitions
     happen to need -- which, for anything short of a wide multi-branch machine, leaves the box
     barely taller than the diagram itself, with no slack for ntrloc-state-machine-diagram.js's own
     vertical centering (added per schema-editor.png) to actually be visible. A fixed floor gives
     it real room to center within, matching that mockup's own proportions -- content that's taller
     than this still just grows the box as before (min-height, not height).
     display:flex (overriding the shared component's own tag-level "display:block", via this more
     specific class selector) is what actually makes that floor usable, not just present: a plain
     block parent's min-height doesn't count as an "explicit height" for a percentage-height child
     to resolve against (confirmed live -- height:100% on .state-machine-diagram-scroll silently
     did nothing while the parent only had min-height), but a flex child's flex-basis is computed
     from the parent's actual used height regardless of *how* that height came about, min-height
     included -- the same reason .editor-diagram-pane/.editor-diagram-el are flex further down in
     ntrloc-state-machine-editor.js. */
  .states-diagram-el {
    display: flex;
    flex-direction: column;
    min-height: 320px;
  }
  .states-diagram-el .state-machine-diagram-scroll {
    flex: 1;
  }
  .state-machine-preview + .state-machine-preview {
    margin-top: 20px;
  }
  .state-machine-preview-name {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .markers-list {
    list-style: none;
    margin: 0 0 12px 0;
    padding: 0;
  }
  .markers-list li {
    display: flex;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .markers-list .marker-name {
    font-weight: 500;
  }
  .markers-list .marker-description {
    color: var(--muted);
    margin-left: 8px;
    flex: 1;
  }
  .markers-list .marker-actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }
  .markers-list .marker-actions button {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
  }
  .markers-list .marker-actions button:hover {
    text-decoration: underline;
  }
  .marker-error {
    color: #f85149;
    font-size: 13px;
    margin: 8px 0 0 0;
  }
  /* The two halves of the "Access Control" panel -- Access Markers and Marker Assignment Rules are
     related but distinct admin concepts (what a marker grants vs. what assigns it to an item), so
     they read as clearly separate blocks within the one panel rather than one flat list. Side by
     side rather than stacked: both lists are short and this is the panel's only content, so a row
     makes better use of the item detail pane's width instead of pushing Traits/Properties/etc.
     further down the page. */
  .access-control-body {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .access-control-subsection {
    flex: 1;
    min-width: 0;
  }
  .access-control-subsection + .access-control-subsection {
    padding-left: 24px;
    border-left: 1px solid var(--border);
  }
  .subsection-header {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .marker-rules-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .marker-rules-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .marker-rule-name {
    font-weight: 500;
  }
  .marker-rule-key {
    color: var(--muted);
    font-family: monospace;
    font-size: 12px;
    flex: 1;
  }
  .marker-rule-status {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .marker-rule-status.enabled {
    color: #3fb950;
    background: rgba(63, 185, 80, 0.12);
  }
  .marker-rule-status.disabled {
    color: var(--muted);
    background: rgba(255, 255, 255, 0.06);
  }
  .marker-rule-open-button,
  .marker-rule-delete-button {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    white-space: nowrap;
  }
  .marker-rule-open-button:hover,
  .marker-rule-delete-button:hover {
    text-decoration: underline;
  }
  .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .field-row .dirty-dot {
    color: var(--dirty-color, #e3b341);
  }
  .field-row .dirty-dot.is-new {
    color: var(--new-color, #3fb950);
  }
  /* Parent type / Abstract / Display label in one row, below Name/Description now (Delete Item
     Type moved to header-top-row above, see its own comment). The display-label group takes the
     1fr track so it gets first claim on any slack width (it holds a free-text SpEL input, the only
     field here that actually needs room to grow) while the other two stay their natural content
     width. align-items:start keeps every caption on one shared baseline across the row regardless
     of row-display-label's extra prior-value line making it taller than the other two. */
  .header-fields-row {
    display: grid;
    grid-template-columns: auto auto auto 1fr;
    align-items: start;
    gap: 100px;
    margin-top: 20px;
  }
  /* Caption-above-control, shared by all four input groups (see col-header/col-body below) --
     row-display-label additionally carries the prior-value line (see its own comment) beneath the
     control, which is why min-width:0 lives here too: without it, the flex column won't let its
     child input shrink below its content width, which for a free-text SpEL pattern can overflow the
     grid track. */
  .header-fields-row .row-start,
  .header-fields-row .row-center,
  .header-fields-row .row-traits,
  .header-fields-row .row-display-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .header-fields-row .row-start {
    justify-self: start;
  }
  .header-fields-row .row-center {
    justify-self: start;
  }
  .header-fields-row .row-traits {
    justify-self: start;
  }
  .header-fields-row .row-display-label {
    justify-self: stretch;
  }
  .traits-chip-row {
    flex-wrap: wrap;
    row-gap: 6px;
  }
  .add-trait-button {
    display: inline-flex;
    align-items: center;
    background: none;
    border: 1px solid var(--accent);
    border-radius: 16px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--accent);
    cursor: pointer;
    white-space: nowrap;
  }
  .add-trait-button:hover {
    background: rgba(74, 158, 255, 0.08);
  }
  .col-header {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: var(--muted);
    cursor: pointer;
  }
  .col-body {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  /* Unlabeled (the col-header above it is the label -- see the header-fields-row markup), but the
     filled select still reserves its default full label-row height regardless, leaving a big gap
     between col-header and the field's own visible text. --md-filled-field-top/bottom-space is the
     same token ntrloc-property-table.js already uses to compact md-filled-select for the identical
     reason (md-filled-select has no *-text-field-top/bottom-space alias of its own, unlike
     md-filled-text-field -- it reads the shared underlying token directly). */
  .item-supertype-select {
    --md-filled-field-top-space: 4px;
    --md-filled-field-bottom-space: 4px;
  }
  /* Matches the Angular reference's item-detail.scss exactly (plain input + placeholder, not a
     persistent Material label -- md-filled-text-field's floating label doesn't have a mode that
     disappears once you start typing the way a placeholder does, so these two header fields stay
     plain inputs while the rest of the editor uses Material). */
  input.item-name-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: inherit;
    font: inherit;
    font-size: 1.5rem;
    font-weight: 500;
    flex: 1;
    outline: none;
    padding: 2px 0;
  }
  input.item-name-input:focus {
    border-bottom-color: rgba(255, 255, 255, 0.4);
  }
  input.item-description-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: inherit;
    font: inherit;
    opacity: 0.7;
    flex: 1;
    outline: none;
    padding: 2px 0;
  }
  input.item-description-input:focus {
    border-bottom-color: rgba(255, 255, 255, 0.4);
    opacity: 1;
  }
  input.item-description-input::placeholder {
    opacity: 0.4;
  }
  input.item-display-label-pattern-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: inherit;
    font: inherit;
    font-family: monospace;
    font-size: 0.9em;
    opacity: 0.7;
    flex: 1;
    outline: none;
    padding: 2px 0;
  }
  input.item-display-label-pattern-input:focus {
    border-bottom-color: rgba(255, 255, 255, 0.4);
    opacity: 1;
  }
  input.item-display-label-pattern-input::placeholder {
    opacity: 0.4;
  }
  .original-value {
    font-size: 11px;
    color: var(--muted);
    text-decoration: line-through;
    margin: 2px 0 0 0;
  }
  .panel {
    background: var(--panel-bg);
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    padding: 16px 20px;
    cursor: pointer;
    user-select: none;
  }
  .panel-header .chevron {
    color: var(--muted);
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }
  .panel-header .chevron.collapsed {
    transform: rotate(-90deg);
  }
  .panel-body {
    padding: 0 20px 20px 20px;
  }
  .trait-assignments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .trait-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 16px;
    padding: 4px 6px 4px 12px;
    font-size: 13px;
  }
  .trait-chip.trait-removed {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .trait-chip.trait-new {
    border-color: var(--new-color, #3fb950);
  }
  .trait-chip button {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
  }
  .pending-link-card {
    background: var(--bg);
    border: 1px solid var(--new-color, #3fb950);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
  }
  .pending-link-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .pending-link-row > input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font: inherit;
    padding: 4px 0;
    flex: 1;
    outline: none;
  }
  .pending-link-row > input:focus {
    border-bottom-color: var(--accent);
  }
  .pending-link-cardinality {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  /* Same fix as ntrloc-links-table.js's .cardinality-input: a Material field here was nearly
     unreadable (native number spinner arrows eating most of a ~56px-wide, label-less field) --
     matching the Angular reference's own plain, monospace, centered, spinner-suppressed input
     instead. */
  .pending-link-cardinality input {
    width: 3ch;
    text-align: center;
    font-family: monospace;
    font-size: 13px;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: var(--text);
    padding: 2px 0;
    outline: none;
  }
  .pending-link-cardinality input:focus {
    border-bottom-color: var(--accent);
  }
  .pending-link-cardinality input::-webkit-inner-spin-button,
  .pending-link-cardinality input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  .pending-link-cardinality input[type=number] {
    -moz-appearance: textfield;
  }
  .pending-link-target-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--muted);
  }
  .pending-link-target-row md-filled-select {
    flex: 1;
  }
  .pending-link-hint {
    color: var(--dirty-color, #e3b341);
    font-size: 12px;
    font-style: italic;
    margin: 4px 0 8px 0;
  }
  .pending-link-properties-label {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
  }
`);

// Item/trait detail editor -- port of the Angular reference's ItemDetail component. Mutates the
// passed-in ItemDefinitionViewModel/TraitDefinitionViewModel directly by reference (same
// convention as ntrloc-property-table.js), notifying schemaViewModel listeners after every edit.
// Panel collapse state lives on schemaViewModel.sectionsExpanded (see schema-view-model.js),
// not on this instance, since this element is destroyed and recreated on every edit anywhere in
// the tree.
class NtrlocItemDetail extends HTMLElement {
  configure({ item, entityKind, propertyTypes, availableTraits, allItems }) {
    this._item = item;
    this._entityKind = entityKind;
    this._propertyTypes = propertyTypes || [];
    this._availableTraits = availableTraits || [];
    this._allItems = allItems || [];
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  get isItem() {
    return this._entityKind === 'item';
  }

  get unassignedTraits() {
    const assignedIds = new Set(this._item.traitAssignments.filter((t) => !t.isRemoved).map((t) => t.id));
    return this._availableTraits.filter((t) => t.id && !assignedIds.has(t.id));
  }

  get implementingItems() {
    if (!this._item.id) return [];
    const traitId = this._item.id;
    return this._allItems
      .map((item) => ({ item, assignment: item.traitAssignments.find((t) => t.id === traitId) }))
      .filter((x) => x.assignment !== undefined);
  }

  get unimplementingItems() {
    if (!this._item.id) return [];
    const traitId = this._item.id;
    return this._allItems.filter((item) => !item.traitAssignments.some((t) => t.id === traitId));
  }

  // Only links "created from" this item's own Links panel -- a pending link is rendered once,
  // on the item whose "+ Add Link" button spawned it, not on both sides (the other item doesn't
  // have anything to show yet since the target perspective doesn't exist until Save).
  get itemPendingLinks() {
    if (!this.isItem || !this._item.id) return [];
    return schemaViewModel.pendingNewLinks.filter((link) => link.firstItemId === this._item.id);
  }

  // Excludes the current item (the backend has no friendly error for a self-referential link --
  // see PendingLinkViewModel's isValid comment) and excludes any other not-yet-saved item type
  // (id === null can't be used as a CREATE_LINK perspective's itemId).
  get linkTargetCandidates() {
    return this._allItems.filter((i) => i.id && i.id !== this._item.id);
  }

  // Excludes the current item (an item can't be its own parent type) and every one of its own
  // current descendants (picking one would close a cycle) -- mirrors SchemaManager.
  // resolveSupertypeInclusiveItemTypeIds' server-side BFS client-side, so the dropdown itself
  // never offers a choice the backend would reject. The backend's cycle guard remains the actual
  // enforcement point regardless; this is a UX nicety, not a correctness requirement.
  get supertypeCandidates() {
    if (!this._item.id) return this._allItems.filter((i) => i.id);

    const childrenByParent = new Map();
    for (const i of this._allItems) {
      if (!i.supertypeId) continue;
      if (!childrenByParent.has(i.supertypeId)) childrenByParent.set(i.supertypeId, []);
      childrenByParent.get(i.supertypeId).push(i.id);
    }

    const excluded = new Set([this._item.id]);
    const queue = [this._item.id];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const childId of childrenByParent.get(current) ?? []) {
        if (!excluded.has(childId)) {
          excluded.add(childId);
          queue.push(childId);
        }
      }
    }

    return this._allItems.filter((i) => i.id && !excluded.has(i.id));
  }

  pendingLinkCard(link, index) {
    const targetItem = this._allItems.find((i) => i.id === link.secondItemId);
    return `
      <div class="pending-link-card" data-index="${index}">
        <div class="pending-link-row">
          <input class="pending-link-first-name" value="${escapeHtml(link.firstPerspectiveName)}" placeholder="This side's name (e.g. worksAt)" />
          <div class="pending-link-cardinality">
            <input type="number" min="0" class="pending-link-first-min" value="${link.firstMinCardinality}" />
            <span>..</span>
            <input type="number" min="0" class="pending-link-first-max" value="${link.firstMaxCardinality ?? ''}" placeholder="∞" />
          </div>
        </div>
        <div class="pending-link-target-row">
          <span>↔</span>
          <md-filled-select class="pending-link-target-select">
            <md-select-option value="" ${!link.secondItemId ? 'selected' : ''}><div slot="headline">Target item type…</div></md-select-option>
            ${this.linkTargetCandidates.map((i) => `<md-select-option value="${escapeHtml(i.id)}" ${i.id === link.secondItemId ? 'selected' : ''}><div slot="headline">${escapeHtml(i.name)}</div></md-select-option>`).join('')}
          </md-filled-select>
        </div>
        <div class="pending-link-row">
          <input class="pending-link-second-name" value="${escapeHtml(link.secondPerspectiveName)}" placeholder="${targetItem ? `${escapeHtml(targetItem.name)}'s name for this (e.g. employs)` : "Other side's name"}" />
          <div class="pending-link-cardinality">
            <input type="number" min="0" class="pending-link-second-min" value="${link.secondMinCardinality}" />
            <span>..</span>
            <input type="number" min="0" class="pending-link-second-max" value="${link.secondMaxCardinality ?? ''}" placeholder="∞" />
          </div>
        </div>
        ${!link.isValid ? '<p class="pending-link-hint">Pick a target item type and fill in both names to save this link.</p>' : ''}
        <div class="pending-link-properties-label">Properties</div>
        <ntrloc-property-table class="pending-link-properties-table"></ntrloc-property-table>
        <md-text-button class="pending-link-remove-button">Remove</md-text-button>
      </div>
    `;
  }

  // Item-type-scoped markers only (scopeKind === 'ITEM_TYPE') -- a marker's scope determines which
  // item instances it's eligible to be assigned to and which properties/transitions its grants may
  // reference (see docs/ntrloc-marker-admin-ui-design-notes.md), so a marker scoped to a *trait*
  // wouldn't belong on any one item type's own panel. Trait-scoped markers get their own panel on
  // the trait editor when that's built; not yet.
  markersBody() {
    const item = this._item;
    const markers = schemaViewModel.markersForItem(item.id);

    const listHtml = markers.length > 0
      ? `<ul class="markers-list">${markers.map((m) => `
          <li data-marker-id="${m.id}">
            <span class="marker-name">${escapeHtml(m.name)}</span>
            ${m.description ? `<span class="marker-description">${escapeHtml(m.description)}</span>` : ''}
            <span class="marker-actions">
              <button class="marker-edit-button" type="button">Edit</button>
              <button class="marker-delete-button" type="button">Delete</button>
            </span>
          </li>
        `).join('')}</ul>`
      : '<p class="status">No markers defined.</p>';

    // Same "save this first" guard as Links/States -- a marker's scope_id has to be a real item
    // type id, which a not-yet-saved item type doesn't have yet.
    const addAffordance = item.isNew
      ? '<p class="status">Save this item type before adding markers.</p>'
      : '<md-outlined-button class="add-marker-button">+ New Marker</md-outlined-button>';

    return `${listHtml}${addAffordance}${this._markerError ? `<p class="marker-error">${escapeHtml(this._markerError)}</p>` : ''}`;
  }

  // These are the DMN-backed rules that apply this item type's markers automatically on
  // create/update (MarkerRuleEvaluationService), as distinct from the markers themselves above.
  // Create + delete only -- enable/disable toggling from here is a smaller follow-up (see
  // MarkerAdminController's own comment); the decision-key text field lets a rule be created
  // before its DMN table is deployed (see openCreateMarkerRuleDialog's own comment), so a fresh
  // rule commonly shows up here with nothing to "open" yet until that table exists.
  markerRulesBody() {
    const item = this._item;
    const rules = schemaViewModel.markerRulesForItem(item.id);

    const listHtml = rules.length > 0
      ? `<ul class="marker-rules-list">${rules.map((r) => `
          <li data-marker-rule-id="${r.id}">
            <span class="marker-rule-name">${escapeHtml(r.name)}</span>
            <span class="marker-rule-key">${escapeHtml(r.decisionKey)}</span>
            <span class="marker-rule-status ${r.enabled ? 'enabled' : 'disabled'}">${r.enabled ? 'Enabled' : 'Disabled'}</span>
            <button class="marker-rule-open-button" type="button" title="Open this rule's DMN decision table">Open DMN</button>
            <button class="marker-rule-delete-button" type="button" title="Delete this assignment rule">Delete</button>
          </li>
        `).join('')}</ul>`
      : '<p class="status">No marker assignment rules defined for this item type.</p>';

    // Same "save this first" guard as Access Markers/Links/States -- a rule's item_type_id has to
    // be a real item type id, which a not-yet-saved item type doesn't have yet.
    const addAffordance = item.isNew
      ? '<p class="status">Save this item type before adding assignment rules.</p>'
      : '<md-outlined-button class="add-marker-rule-button">+ New Assignment Rule</md-outlined-button>';

    return `${listHtml}${addAffordance}${this._markerRuleError ? `<p class="marker-error">${escapeHtml(this._markerRuleError)}</p>` : ''}`;
  }

  accessControlBody() {
    return `
      <div class="access-control-body">
        <div class="access-control-subsection">
          <h4 class="subsection-header">Access Markers</h4>
          ${this.markersBody()}
        </div>
        <div class="access-control-subsection">
          <h4 class="subsection-header">Marker Assignment Rules</h4>
          ${this.markerRulesBody()}
        </div>
      </div>
    `;
  }

  // Immediate write, not staged into Save -- see schema-view-model.js's createMarker comment.
  // Scope is fixed to this item type, not picked in the dialog (see
  // ntrloc-create-marker-dialog.js's own comment on why).
  async onNewMarker() {
    const item = this._item;
    const result = await openCreateMarkerDialog({
      scopeKind: 'ITEM_TYPE',
      scopeId: item.id,
      scopeLabel: `Item Type — ${item.name || '(unnamed)'}`,
    });
    if (!result) return;
    this._markerError = null;
    try {
      await schemaViewModel.createMarker(result);
    } catch (e) {
      console.error('[item-detail] failed to create marker:', e);
      this._markerError = e.message || 'Failed to create marker.';
      this.render();
    }
  }

  async onEditMarker(marker) {
    const item = this._item;
    const result = await openEditMarkerDialog({
      id: marker.id,
      name: marker.name,
      description: marker.description,
      scopeLabel: `Item Type — ${item.name || '(unnamed)'}`,
    });
    if (!result) return;
    this._markerError = null;
    try {
      await schemaViewModel.updateMarker(result.id, { name: result.name, description: result.description });
    } catch (e) {
      console.error('[item-detail] failed to update marker:', e);
      this._markerError = e.message || 'Failed to update marker.';
      this.render();
    }
  }

  // Native confirm(), same as the item type/trait "Delete" flow above -- deleting a marker cascades
  // into its grants (marker_grant) and its item assignments (register_item_marker), so it's worth
  // naming what's about to happen even though this file can't know the counts without a dedicated
  // usage-lookup endpoint (not built yet).
  async onDeleteMarker(marker) {
    if (!confirm(`Delete marker "${marker.name}"? This also removes any grants and item assignments that use it. This cannot be undone.`)) return;
    this._markerError = null;
    try {
      await schemaViewModel.deleteMarker(marker.id);
    } catch (e) {
      console.error('[item-detail] failed to delete marker:', e);
      this._markerError = e.message || 'Failed to delete marker.';
      this.render();
    }
  }

  // Immediate write, not staged into Save -- see schema-view-model.js's createMarkerRule comment.
  // Item type is fixed to this item type, not picked in the dialog (see
  // openCreateMarkerRuleDialog's own comment on why), mirroring onNewMarker.
  async onNewMarkerRule() {
    const item = this._item;
    let existingKeys = [];
    try {
      const decisions = await fetch('/api/admin/dmn/decisions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : []));
      existingKeys = [...new Set(decisions.map((d) => d.key))].sort();
    } catch {
      // Best-effort only -- the dialog still works fine with an empty datalist if this fails.
    }
    const result = await openCreateMarkerRuleDialog({
      itemTypeId: item.id,
      itemTypeLabel: item.name || '(unnamed)',
      existingKeys,
    });
    if (!result) return;
    this._markerRuleError = null;
    try {
      await schemaViewModel.createMarkerRule(result);
    } catch (e) {
      console.error('[item-detail] failed to create marker rule:', e);
      this._markerRuleError = e.message || 'Failed to create assignment rule.';
      this.render();
    }
  }

  // Native confirm(), same as onDeleteMarker above. A deleted rule stops firing on future
  // create/update evaluations; markers it already applied stay on their items (see
  // AuthorizationRepository.deleteMarkerRule) -- worth naming so the admin isn't surprised.
  async onDeleteMarkerRule(rule) {
    if (!confirm(`Delete assignment rule "${rule.name}"? It will stop assigning markers on future changes. Markers it has already applied stay in place.`)) return;
    this._markerRuleError = null;
    try {
      await schemaViewModel.deleteMarkerRule(rule.id);
    } catch (e) {
      console.error('[item-detail] failed to delete marker rule:', e);
      this._markerRuleError = e.message || 'Failed to delete assignment rule.';
      this.render();
    }
  }

  // Cross-tab navigation into the Processes screen -- see ntrloc-processes.js's own
  // openDecisionByKey comment for how a decision *key* (all a rule row stores) resolves to a
  // specific deployed decision table to open. The <ntrloc-processes> element is a permanent
  // singleton (index.html mounts every route once and toggles visibility, never recreating them),
  // so grabbing it straight off the document and calling into it directly is safe and simpler than
  // inventing a cross-component event/router-param scheme for a single call site.
  //
  // applyRoute() (index.html's own hash router, a plain global function) is called explicitly
  // rather than left to the 'hashchange' listener alone -- that event dispatches as a separate
  // task, not synchronously with the location.hash assignment above, and without it the Processes
  // element would still be display:none the moment openDecisionByKey runs.
  //
  // Known cosmetic wrinkle: opening a decision table this way (route switch + tab-open in the same
  // gesture) logs two harmless "<rect> attribute width/height: Expected length, NaN" console
  // errors from diagram-js's initial background-rect sizing, which the same decision table does
  // NOT produce when opened by clicking it directly from an already-visible Processes tab. Neither
  // an explicit applyRoute() before the call nor deferring the call past a render pass (nested
  // requestAnimationFrame, tried and removed) prevents it, and the diagram still renders and
  // functions correctly either way -- verified visually, not just assumed. Left as a known,
  // non-blocking artifact rather than chased further into diagram-js internals.
  onOpenMarkerRule(rule) {
    location.hash = '#/processes';
    applyRoute();
    document.querySelector('ntrloc-processes')?.openDecisionByKey(rule.decisionKey, rule.name);
  }

  linksBody() {
    const item = this._item;
    const hasExistingLinks = Object.keys(item.links || {}).length > 0;
    const pendingLinks = this.itemPendingLinks;

    const existingLinksHtml = hasExistingLinks
      ? '<ntrloc-links-table class="links-table-el"></ntrloc-links-table>'
      : (pendingLinks.length === 0 ? '<p class="status">No links defined.</p>' : '');

    const pendingLinksHtml = pendingLinks.map((link, index) => this.pendingLinkCard(link, index)).join('');

    // Mirrors the trait-assignment panel's own "save this first" guard (unimplementingItems/
    // item.id checks above) -- a pending link needs a real itemId on both sides, which a
    // not-yet-saved item type doesn't have yet.
    const addLinkAffordance = item.isNew
      ? '<p class="status">Save this item type before adding links.</p>'
      : '<md-outlined-button class="add-link-button">+ Add Link</md-outlined-button>';

    return `${existingLinksHtml}${pendingLinksHtml}${addLinkAffordance}`;
  }

  statesBody() {
    const item = this._item;
    const machines = item.stateMachines.filter((m) => !m.isDeleted);

    // A single machine keeps the existing unlabeled full diagram preview -- still the common case
    // and there's nothing to disambiguate. Multiple machines each get their own labeled diagram,
    // stacked, rather than a compact list -- each one keyed by machine id (data-machine-id) so
    // updated() below can hydrate the right diagram element with the right machine's data.
    let previewHtml;
    if (machines.length === 0) {
      previewHtml = '<p class="status">No state machines defined.</p>';
    } else if (machines.length === 1) {
      previewHtml = machines[0].states.filter((s) => !s.isDeleted).length > 0
        ? `<ntrloc-state-machine-diagram class="states-diagram-el" data-machine-id="${machines[0].id}"></ntrloc-state-machine-diagram>`
        : '<p class="status">No states defined.</p>';
    } else {
      previewHtml = machines.map((m) => `
        <div class="state-machine-preview">
          <h4 class="state-machine-preview-name">${escapeHtml(m.name || '(unnamed)')}</h4>
          ${m.states.filter((s) => !s.isDeleted).length > 0
            ? `<ntrloc-state-machine-diagram class="states-diagram-el" data-machine-id="${m.id}"></ntrloc-state-machine-diagram>`
            : '<p class="status">No states defined.</p>'}
        </div>
      `).join('');
    }

    // Mirrors the Links panel's own "save this first" guard -- CreateStateMachineMutation needs a
    // real itemDefinitionId, which a not-yet-saved item type doesn't have yet.
    const editAffordance = item.isNew
      ? '<p class="status">Save this item type before defining state machines.</p>'
      : '<md-outlined-button class="edit-states-button">Edit State Machines</md-outlined-button>';

    return `${previewHtml}<div class="states-edit-row">${editAffordance}</div>`;
  }

  panel(key, title, bodyHtml) {
    const expanded = schemaViewModel.sectionsExpanded[key];
    // An inline SVG rather than mat-icon's "expand_more" glyph -- this app deliberately doesn't
    // vendor an icon font (every other action here is a text button, e.g. Delete/Revert/Restore),
    // so a small stroked chevron is the dependency-free way to get the same bold, crisp look
    // Angular Material's expansion panel indicator has, rather than relying on a Unicode triangle
    // character's thin, font-dependent rendering.
    const chevronSvg = `
      <svg class="chevron ${expanded ? '' : 'collapsed'}" viewBox="0 0 24 24" width="20" height="20"
           fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    return `
      <div class="panel">
        <div class="panel-header" data-section="${key}">
          ${chevronSvg}
          <span>${escapeHtml(title)}</span>
        </div>
        ${expanded ? `<div class="panel-body">${bodyHtml}</div>` : ''}
      </div>
    `;
  }

  render() {
    if (!this._item) {
      this.innerHTML = '<p class="status">Select an item, trait, or controlled list to view its details.</p>';
      return;
    }
    const item = this._item;

    // Only the trait-editor's own "Implemented By" view uses this now -- an item type's own
    // trait assignments render inline in the header-fields-row instead (see the Traits column
    // below), compact chips + an "Add Trait" button that opens a picker dialog rather than a
    // whole collapsible panel, since a handful of trait chips next to Parent Type doesn't need
    // the weight of its own section.
    const implementedByBody = `
      <div class="trait-assignments">
        ${item.id ? `
          ${this.implementingItems.map(({ item: implementingItem, assignment }) => `
            <div class="trait-chip ${assignment.isRemoved ? 'trait-removed' : ''} ${assignment.isNew && !assignment.isRemoved ? 'trait-new' : ''}" data-item-id="${escapeHtml(implementingItem.id)}">
              <span>${escapeHtml(implementingItem.name)}</span>
              ${!assignment.isRemoved ? '<button class="item-remove-button" title="Remove">✕</button>' : '<button class="item-restore-button" title="Restore">↺</button>'}
            </div>
          `).join('')}
          ${this.implementingItems.length === 0 ? '<p class="status">No item types use this trait.</p>' : ''}
          ${this.unimplementingItems.length > 0 ? `
            <md-filled-select class="add-item-type-select">
              <md-select-option value="" selected><div slot="headline">Add to item type…</div></md-select-option>
              ${this.unimplementingItems.map((i) => `<md-select-option value="${escapeHtml(i.id)}"><div slot="headline">${escapeHtml(i.name)}</div></md-select-option>`).join('')}
            </md-filled-select>
          ` : ''}
        ` : '<p class="status">Save this trait before assigning it to item types.</p>'}
      </div>
    `;

    this.innerHTML = `
      <div class="item-header">
        <div class="header-top-row">
          <div class="eyebrow">${this._entityKind === 'item' ? 'ITEM' : 'TRAIT'}</div>
          ${item.isDeleted
            ? '<span class="status">Marked for deletion -- Save to confirm.</span>'
            : `<md-text-button class="delete-entity-button">${this.isItem ? 'Delete Item Type' : 'Delete Trait'}</md-text-button>`}
        </div>

        <div class="field-row">
          ${item.isNew || item.name !== item.originalName ? `<span class="dirty-dot ${item.isNew ? 'is-new' : ''}">●</span>` : ''}
          <input class="item-name-input" value="${escapeHtml(item.name)}" placeholder="Name" />
          ${!item.isNew && item.name !== item.originalName ? '<md-text-button class="revert-name-button">Revert</md-text-button>' : ''}
        </div>
        ${!item.isNew && item.name !== item.originalName && item.originalName ? `<div class="original-value">${escapeHtml(item.originalName)}</div>` : ''}

        <div class="field-row">
          ${!item.isNew && (item.description ?? '') !== (item.originalDescription ?? '') ? '<span class="dirty-dot">●</span>' : ''}
          <input class="item-description-input" value="${escapeHtml(item.description ?? '')}" placeholder="Description (optional)" />
          ${!item.isNew && (item.description ?? '') !== (item.originalDescription ?? '') ? '<md-text-button class="revert-description-button">Revert</md-text-button>' : ''}
        </div>
        ${!item.isNew && (item.description ?? '') !== (item.originalDescription ?? '') && item.originalDescription ? `<div class="original-value">${escapeHtml(item.originalDescription)}</div>` : ''}

        ${this.isItem ? `
          <div class="header-fields-row">
            <div class="row-start">
              <label class="col-header" for="item-supertype-select">Parent Type</label>
              <div class="col-body">
                ${item.supertypeId !== item.originalSupertypeId ? '<span class="dirty-dot">●</span>' : ''}
                <md-filled-select id="item-supertype-select" class="item-supertype-select">
                  <md-select-option value="" ${!item.supertypeId ? 'selected' : ''}><div slot="headline">No parent type</div></md-select-option>
                  ${this.supertypeCandidates.map((i) => `<md-select-option value="${escapeHtml(i.id)}" ${i.id === item.supertypeId ? 'selected' : ''}><div slot="headline">${escapeHtml(i.name)}</div></md-select-option>`).join('')}
                </md-filled-select>
              </div>
            </div>
            <div class="row-traits">
              <label class="col-header">Traits</label>
              <div class="col-body traits-chip-row">
                ${item.traitAssignments.map((t) => `
                  <span class="trait-chip ${t.isRemoved ? 'trait-removed' : ''} ${t.isNew && !t.isRemoved ? 'trait-new' : ''}" data-trait-id="${escapeHtml(t.id)}">
                    <span>${escapeHtml(t.name)}</span>
                    ${!t.isRemoved ? '<button class="trait-remove-button" title="Remove trait">✕</button>' : '<button class="trait-restore-button" title="Restore trait">↺</button>'}
                  </span>
                `).join('')}
                <button class="add-trait-button" type="button">+ Add Trait</button>
              </div>
            </div>
            <div class="row-center">
              <label class="col-header" for="item-abstract-checkbox">Abstract</label>
              <div class="col-body">
                ${item.abstractType !== item.originalAbstractType ? '<span class="dirty-dot">●</span>' : ''}
                <md-checkbox id="item-abstract-checkbox" class="item-abstract-checkbox" ${item.abstractType ? 'checked' : ''}></md-checkbox>
              </div>
            </div>
            <div class="row-display-label">
              <label class="col-header" for="item-display-label-pattern-input">Display Label</label>
              <div class="col-body">
                ${!item.isNew && (item.displayLabelPattern ?? '') !== (item.originalDisplayLabelPattern ?? '') ? '<span class="dirty-dot">●</span>' : ''}
                <input id="item-display-label-pattern-input" class="item-display-label-pattern-input" value="${escapeHtml(item.displayLabelPattern ?? '')}" placeholder="SpEL expression (optional)" />
                ${!item.isNew && (item.displayLabelPattern ?? '') !== (item.originalDisplayLabelPattern ?? '') ? '<md-text-button class="revert-display-label-pattern-button">Revert</md-text-button>' : ''}
              </div>
              ${!item.isNew && (item.displayLabelPattern ?? '') !== (item.originalDisplayLabelPattern ?? '') && item.originalDisplayLabelPattern ? `<div class="original-value">${escapeHtml(item.originalDisplayLabelPattern)}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      ${this.isItem ? this.panel('accessControl', 'Access Control', this.accessControlBody()) : ''}

      ${!this.isItem ? this.panel('traits', 'Implemented By', implementedByBody) : ''}

      ${this.panel('properties', 'Properties', '<ntrloc-property-table class="properties-table"></ntrloc-property-table>')}

      ${this.panel('links', 'Links', this.linksBody())}

      ${this.isItem ? this.panel('states', 'States', this.statesBody()) : ''}
    `;

    this.wireUp();
  }

  wireUp() {
    const item = this._item;

    this.querySelectorAll('.panel-header').forEach((header) => {
      header.addEventListener('click', () => {
        const key = header.dataset.section;
        schemaViewModel.sectionsExpanded[key] = !schemaViewModel.sectionsExpanded[key];
        this.render();
      });
    });

    const nameInput = this.querySelector('.item-name-input');
    nameInput.addEventListener('change', (event) => {
      item.name = event.target.value;
      this.render();
      notifySchemaViewModelChange();
    });

    const descriptionInput = this.querySelector('.item-description-input');
    descriptionInput.addEventListener('change', (event) => {
      item.description = event.target.value || null;
      this.render();
      notifySchemaViewModelChange();
    });

    const supertypeSelect = this.querySelector('.item-supertype-select');
    if (supertypeSelect) supertypeSelect.addEventListener('change', (event) => {
      item.supertypeId = event.target.value || null;
      this.render();
      notifySchemaViewModelChange();
    });

    const abstractCheckbox = this.querySelector('.item-abstract-checkbox');
    if (abstractCheckbox) abstractCheckbox.addEventListener('change', (event) => {
      item.abstractType = event.target.checked;
      this.render();
      notifySchemaViewModelChange();
    });

    const revertNameButton = this.querySelector('.revert-name-button');
    if (revertNameButton) revertNameButton.addEventListener('click', () => {
      item.name = item.originalName;
      this.render();
      notifySchemaViewModelChange();
    });

    // Immediate, dedicated confirm here -- deliberately not relying solely on the later batch
    // Save-confirm dialog, unlike every other soft-delete in this editor (states, properties):
    // deleting a whole item type/trait is categorically more consequential, so it gets its own
    // explicit prompt naming exactly what's being deleted. Skipped for a still-new, unsaved
    // entity -- nothing has been persisted yet, so there's nothing to lose by discarding it.
    const deleteButton = this.querySelector('.delete-entity-button');
    if (deleteButton) deleteButton.addEventListener('click', () => {
      if (!item.isNew) {
        const label = this.isItem ? 'item type' : 'trait';
        if (!confirm(`Delete ${label} "${item.name}"? This cannot be undone.`)) return;
      }
      if (this.isItem) schemaViewModel.deleteItem(item);
      else schemaViewModel.deleteTrait(item);
    });

    const revertDescriptionButton = this.querySelector('.revert-description-button');
    if (revertDescriptionButton) revertDescriptionButton.addEventListener('click', () => {
      item.description = item.originalDescription;
      this.render();
      notifySchemaViewModelChange();
    });

    const displayLabelPatternInput = this.querySelector('.item-display-label-pattern-input');
    if (displayLabelPatternInput) displayLabelPatternInput.addEventListener('change', (event) => {
      item.displayLabelPattern = event.target.value || null;
      this.render();
      notifySchemaViewModelChange();
    });

    const revertDisplayLabelPatternButton = this.querySelector('.revert-display-label-pattern-button');
    if (revertDisplayLabelPatternButton) revertDisplayLabelPatternButton.addEventListener('click', () => {
      item.displayLabelPattern = item.originalDisplayLabelPattern;
      this.render();
      notifySchemaViewModelChange();
    });

    if (this.isItem) {
      this.querySelectorAll('.trait-remove-button').forEach((button) => {
        button.addEventListener('click', () => {
          const traitId = button.closest('.trait-chip').dataset.traitId;
          const assignment = item.traitAssignments.find((t) => t.id === traitId);
          if (assignment) item.removeTrait(assignment);
          this.render();
          notifySchemaViewModelChange();
        });
      });
      this.querySelectorAll('.trait-restore-button').forEach((button) => {
        button.addEventListener('click', () => {
          const traitId = button.closest('.trait-chip').dataset.traitId;
          const assignment = item.traitAssignments.find((t) => t.id === traitId);
          if (assignment) assignment.isRemoved = false;
          this.render();
          notifySchemaViewModelChange();
        });
      });
      const addTraitButton = this.querySelector('.add-trait-button');
      if (addTraitButton) addTraitButton.addEventListener('click', async () => {
        const traitId = await openAddTraitDialog({ traits: this.unassignedTraits });
        if (!traitId) return;
        const trait = this._availableTraits.find((t) => t.id === traitId);
        if (trait?.id) item.addTrait({ id: trait.id, name: trait.name });
        this.render();
        notifySchemaViewModelChange();
      });
    } else {
      this.querySelectorAll('.item-remove-button').forEach((button) => {
        button.addEventListener('click', () => {
          const itemId = button.closest('.trait-chip').dataset.itemId;
          const targetItem = this._allItems.find((i) => i.id === itemId);
          const assignment = targetItem?.traitAssignments.find((t) => t.id === item.id);
          if (assignment) targetItem.removeTrait(assignment);
          this.render();
          notifySchemaViewModelChange();
        });
      });
      this.querySelectorAll('.item-restore-button').forEach((button) => {
        button.addEventListener('click', () => {
          const itemId = button.closest('.trait-chip').dataset.itemId;
          const targetItem = this._allItems.find((i) => i.id === itemId);
          const assignment = targetItem?.traitAssignments.find((t) => t.id === item.id);
          if (assignment) assignment.isRemoved = false;
          this.render();
          notifySchemaViewModelChange();
        });
      });
      const addItemTypeSelect = this.querySelector('.add-item-type-select');
      if (addItemTypeSelect) addItemTypeSelect.addEventListener('change', (event) => {
        const itemId = event.target.value;
        if (!itemId || !item.id) return;
        const targetItem = this._allItems.find((i) => i.id === itemId);
        if (targetItem) targetItem.addTrait({ id: item.id, name: item.name });
        this.render();
        notifySchemaViewModelChange();
      });
    }

    const propertiesTable = this.querySelector('.properties-table');
    if (propertiesTable) {
      propertiesTable.data = { properties: item.properties, propertyTypes: this._propertyTypes, allowAdd: true };
    }

    const linksTable = this.querySelector('.links-table-el');
    if (linksTable) {
      linksTable.data = { links: item.links, propertyTypes: this._propertyTypes };
    }

    // One diagram element per (non-deleted, non-empty) state machine -- see statesBody(). Matched
    // by data-machine-id rather than position since machine order isn't guaranteed stable.
    const machinesById = new Map(item.stateMachines.filter((m) => !m.isDeleted).map((m) => [m.id, m]));
    this.querySelectorAll('.states-diagram-el').forEach((statesDiagram) => {
      const machine = machinesById.get(statesDiagram.dataset.machineId);
      if (!machine) return;
      statesDiagram.data = {
        states: machine.states.filter((s) => !s.isDeleted).map((s) => ({
          ...s,
          transitions: s.transitions.filter((t) => !t.isDeleted),
        })),
      };
    });

    const editStatesButton = this.querySelector('.edit-states-button');
    if (editStatesButton) editStatesButton.addEventListener('click', async () => {
      await openStateMachineEditorDialog(item);
      this.render();
    });

    const addMarkerButton = this.querySelector('.add-marker-button');
    if (addMarkerButton) addMarkerButton.addEventListener('click', () => this.onNewMarker());

    const markers = schemaViewModel.markersForItem(item.id);
    this.querySelectorAll('.markers-list li').forEach((row) => {
      const marker = markers.find((m) => m.id === row.dataset.markerId);
      if (!marker) return;
      row.querySelector('.marker-edit-button').addEventListener('click', () => this.onEditMarker(marker));
      row.querySelector('.marker-delete-button').addEventListener('click', () => this.onDeleteMarker(marker));
    });

    const addMarkerRuleButton = this.querySelector('.add-marker-rule-button');
    if (addMarkerRuleButton) addMarkerRuleButton.addEventListener('click', () => this.onNewMarkerRule());

    const markerRules = schemaViewModel.markerRulesForItem(item.id);
    this.querySelectorAll('.marker-rules-list li').forEach((row) => {
      const rule = markerRules.find((r) => r.id === row.dataset.markerRuleId);
      if (!rule) return;
      row.querySelector('.marker-rule-open-button').addEventListener('click', () => this.onOpenMarkerRule(rule));
      row.querySelector('.marker-rule-delete-button').addEventListener('click', () => this.onDeleteMarkerRule(rule));
    });

    const addLinkButton = this.querySelector('.add-link-button');
    if (addLinkButton) addLinkButton.addEventListener('click', () => schemaViewModel.newLink(item));

    const pendingLinks = this.itemPendingLinks;
    this.querySelectorAll('.pending-link-card').forEach((card) => {
      const link = pendingLinks[Number(card.dataset.index)];

      card.querySelector('.pending-link-first-name').addEventListener('change', (event) => {
        link.firstPerspectiveName = event.target.value;
        this.render();
        notifySchemaViewModelChange();
      });
      card.querySelector('.pending-link-first-min').addEventListener('change', (event) => {
        link.firstMinCardinality = event.target.value === '' ? 0 : Number(event.target.value);
        notifySchemaViewModelChange();
      });
      card.querySelector('.pending-link-first-max').addEventListener('change', (event) => {
        link.firstMaxCardinality = event.target.value === '' ? null : Number(event.target.value);
        notifySchemaViewModelChange();
      });

      card.querySelector('.pending-link-target-select').addEventListener('change', (event) => {
        link.secondItemId = event.target.value || null;
        this.render();
        notifySchemaViewModelChange();
      });

      card.querySelector('.pending-link-second-name').addEventListener('change', (event) => {
        link.secondPerspectiveName = event.target.value;
        this.render();
        notifySchemaViewModelChange();
      });
      card.querySelector('.pending-link-second-min').addEventListener('change', (event) => {
        link.secondMinCardinality = event.target.value === '' ? 0 : Number(event.target.value);
        notifySchemaViewModelChange();
      });
      card.querySelector('.pending-link-second-max').addEventListener('change', (event) => {
        link.secondMaxCardinality = event.target.value === '' ? null : Number(event.target.value);
        notifySchemaViewModelChange();
      });

      card.querySelector('.pending-link-remove-button').addEventListener('click', () => {
        schemaViewModel.removePendingLink(link);
      });

      const propertiesTable = card.querySelector('.pending-link-properties-table');
      if (propertiesTable) {
        propertiesTable.data = { properties: link.properties, propertyTypes: this._propertyTypes, allowAdd: true };
      }
    });
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

customElements.define('ntrloc-item-detail', NtrlocItemDetail);
