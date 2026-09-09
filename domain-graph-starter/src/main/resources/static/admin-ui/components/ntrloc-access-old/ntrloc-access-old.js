injectStyles('ntrloc-access-old-styles', `
  ntrloc-access-old[data-route].current {
    flex-direction: row;
  }
  ntrloc-access-old {
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 0;
  }

  /* Sidebar */
  .access-sidebar {
    width: 280px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }
  .access-sidebar-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1 1 50%;
    overflow: hidden;
  }
  .access-sidebar-section + .access-sidebar-section {
    border-top: 1px solid var(--border);
  }
  .access-sidebar-header {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .access-sidebar-header h3 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
  .access-sidebar-list {
    flex: 1;
    overflow-y: auto;
  }
  .access-sidebar-item {
    padding: 8px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .access-sidebar-item:hover { background: var(--panel-bg); }
  .access-sidebar-item.selected {
    background: var(--panel-bg);
    border-left: 3px solid var(--accent);
    padding-left: 13px;
  }
  .access-sidebar-item .item-name { font-weight: 500; font-size: 13px; }
  .access-sidebar-item .item-sub { color: var(--muted); font-size: 11px; }
  .access-sidebar-item .item-count { color: var(--muted); font-size: 11px; }
  .access-sidebar-item .badge-default {
    font-size: 9px;
    background: var(--accent);
    color: white;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 6px;
  }
  .access-sidebar-item .badge-admin {
    font-size: 9px;
    background: #e8a735;
    color: #1a1a1a;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 6px;
  }

  /* Detail panel */
  .access-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .access-detail-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .access-detail-header h2 { margin: 0; font-size: 18px; }
  .access-detail-header .type-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .access-detail-header .actions { margin-left: auto; display: flex; gap: 8px; }

  .access-detail-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    flex-shrink: 0;
  }
  .access-detail-tab {
    padding: 10px 16px;
    cursor: pointer;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    font-size: 13px;
  }
  .access-detail-tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .access-detail-content {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
  }

  .access-section {
    margin-bottom: 24px;
  }
  .access-section h4 {
    margin: 0 0 10px 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
  }

  .access-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .access-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .access-table td {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  .access-table tr:hover { background: var(--panel-bg); }
  .access-table tr.clickable { cursor: pointer; }
  .access-table tr.clickable.selected {
    background: var(--panel-bg);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  /* Same inline-SVG chevron idiom as ntrloc-property-table.js's own OBJECT-property rows --
     duplicated (not shared) since that file's styles aren't guaranteed to be injected on this
     page (Schema tab may never have been visited this session). Scoped to
     .marker-grants-properties (not .access-table) since this chevron button is reused for the
     property tree's OBJECT rows *and* the Links section's perspective/link-property rows *and*
     the State Machines section's machine/state rows -- most of which aren't inside a <table> at
     all, so an .access-table-scoped rule left them with an unstyled default <button> (white
     background, no rotation). */
  .marker-grants-properties .expand-toggle-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .marker-grants-properties .expand-toggle-button .chevron {
    transition: transform 0.15s ease;
  }
  .marker-grants-properties .expand-toggle-button .chevron.collapsed {
    transform: rotate(-90deg);
  }
  .marker-grants-properties .grant-leaf-spacer {
    display: inline-block;
    width: 16px;
  }

  /* Same .panel/.panel-header idiom as ntrloc-item-detail.js's own collapsible sections --
     distinctly named (not reused) to avoid any cross-component CSS coupling, since styles here
     aren't shadow-DOM-scoped and both components can be mounted on the page at once. */
  .grant-panel {
    background: var(--panel-bg);
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .grant-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    padding: 16px 20px;
    cursor: pointer;
    user-select: none;
  }
  .grant-panel-header.static {
    cursor: default;
  }
  .grant-panel-header .chevron {
    color: var(--muted);
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }
  .grant-panel-header .chevron.collapsed {
    transform: rotate(-90deg);
  }
  .grant-panel-body {
    padding: 0 20px 20px 20px;
  }
  .perm-check.partial {
    background: rgba(74, 158, 255, 0.08);
    border-color: var(--accent);
    color: var(--accent);
  }

  .marker-grants-section {
    border-top: 1px solid var(--border);
    padding-top: 20px;
  }
  .marker-grants-layout {
    display: flex;
    gap: 0;
  }
  .marker-grants-markers {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    padding-right: 16px;
    margin-right: 16px;
  }
  .marker-grants-markers-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .marker-grants-markers-header h4 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
  .marker-grant-item {
    padding: 8px 4px;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
  }
  .marker-grant-item:hover { background: var(--panel-bg); }
  .marker-grant-item.selected {
    color: var(--accent);
    font-weight: 600;
  }
  .marker-grants-properties {
    flex: 1;
    min-width: 0;
  }

  .perspective-card + .perspective-card {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .perspective-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .perspective-name {
    font-size: 14px;
    display: flex;
    align-items: center;
  }
  .perspective-checks {
    display: flex;
    gap: 16px;
  }
  .perspective-check-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .perspective-property-table,
  .perspective-card .access-table {
    margin-top: 10px;
    margin-left: 20px;
    width: calc(100% - 20px);
  }

  .access-error {
    color: #e55;
    font-size: 13px;
    margin-bottom: 8px;
  }

  .access-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .access-btn.primary { background: var(--accent); color: white; }
  .access-btn.danger { background: #c33; color: white; }
  .access-btn.ghost { background: none; border: 1px solid var(--border); color: var(--muted); }

  .access-add-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
  }
  .access-add-row select,
  .access-add-row input {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    flex: 1;
  }

  .access-chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 11px;
    border: 1px solid var(--accent);
    background: rgba(74, 158, 255, 0.15);
    color: var(--accent);
    margin: 2px 4px 2px 0;
    cursor: pointer;
  }
  .access-chip::after { content: ' \\00d7'; font-weight: bold; }

  .perm-check {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    color: transparent;
    background: none;
    padding: 0;
  }
  .perm-check.granted {
    background: rgba(74, 158, 255, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }
  .perm-check.implied {
    opacity: 0.45;
    cursor: default;
  }

  .access-empty {
    color: var(--muted);
    font-style: italic;
    text-align: center;
    padding: 40px 0;
  }

  .access-profile-table td:first-child {
    color: var(--muted);
    width: 120px;
  }
`);

class NtrlocAccessOld extends HTMLElement {
  constructor() {
    super();
    this.users = [];
    this.groups = [];
    this.selectedType = null; // 'user' | 'group'
    this.selectedId = null;
    this.selectedData = null;
    this.activeTab = 'members'; // for groups: 'members' | 'permissions'
    this.members = [];
    this.permissions = [];
    this.userGroups = [];
    this.userPermissions = [];
    this.tokens = [];
    this.itemTypes = [];
    this.markers = [];
    this.selectedItemTypeId = null; // ITEM TYPE row selected in the group permissions table
    this.selectedMarkerId = null; // marker selected within that item type's Markers list
    this.markerPropertyGrants = []; // [{propertyId, canRead, canWrite}] for selectedMarkerId
    this.markerItemGrant = { canRead: false, canDelete: false }; // marker_grant's own item-level Read/Delete
    this.linkPropertyGrants = []; // same shape, over a link type's own properties
    this.linkPerspectiveGrants = []; // [{perspectiveId, canCreate, canRead, canDelete}]
    this.transitionGrants = new Set(); // granted transition ids (existence-only)
    this.stateMachineStartGrants = new Set(); // granted state-machine ids for state-machine:start
    this.expandedGrantContainers = new Set(); // OBJECT-property ids expanded, shared across item/link property trees
    this.expandedGrantSections = new Set(['properties', 'links', 'statemachines']); // Properties/Links/State Machines panels
    this.expandedGrantPerspectives = new Set(); // perspective ids expanded in the Links section
    this.expandedGrantStateMachines = new Set(); // state machine ids expanded in the State Machines section
    this.error = '';
  }

  connectedCallback() {
    this.fetchAll();
    // Keeps the marker property grid (sourced from globalSchemaModel, not its own fetch) live as
    // properties are added/removed elsewhere -- otherwise a schema change made in the Schema tab
    // wouldn't show up here until this component happened to re-render for some other reason.
    this._unsubscribeSchema = onGlobalSchemaChange(() => this.render());
    // Same reasoning for markers -- this component keeps its own local this.markers, independent
    // of schema-view-model.js's own copy used by the Schema tab's "Access Markers" panel. Without
    // this, a marker created/edited/deleted on the Schema tab would never appear here (or a marker
    // created here, per onNewMarker's own splice, would never appear there) until a full reload.
    this._unsubscribeMarkers = onMarkersChange(() => this.fetchMarkers().then(() => this.render()));
  }

  disconnectedCallback() {
    if (this._unsubscribeSchema) this._unsubscribeSchema();
    if (this._unsubscribeMarkers) this._unsubscribeMarkers();
  }

  async fetchAll() {
    await Promise.all([this.fetchUsers(), this.fetchGroups(), this.fetchItemTypes(), this.fetchMarkers(), globalSchemaModel.load()]);
    this.render();
  }

  async fetchMarkers() {
    try {
      const res = await fetch('/api/admin/markers', { credentials: 'include' });
      this.markers = res.ok ? await res.json() : [];
    } catch (e) { this.markers = []; }
  }

  grantsArrayFor(kind) {
    return kind === 'link' ? this.linkPropertyGrants : this.markerPropertyGrants;
  }

  grantsEndpointSegment(kind) {
    return kind === 'link' ? 'link-properties' : 'properties';
  }

  async refetchPropertyGrants(kind) {
    if (kind === 'link') await this.fetchMarkerLinkPropertyGrants(this.selectedMarkerId);
    else await this.fetchMarkerPropertyGrants(this.selectedMarkerId);
  }

  async fetchMarkerLinkPropertyGrants(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/link-properties`, { credentials: 'include' });
      this.linkPropertyGrants = res.ok ? await res.json() : [];
    } catch (e) { this.linkPropertyGrants = []; }
  }

  async fetchMarkerLinkPerspectiveGrants(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/link-perspectives`, { credentials: 'include' });
      this.linkPerspectiveGrants = res.ok ? await res.json() : [];
    } catch (e) { this.linkPerspectiveGrants = []; }
  }

  async fetchMarkerTransitionGrants(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/transitions`, { credentials: 'include' });
      this.transitionGrants = res.ok ? new Set(await res.json()) : new Set();
    } catch (e) { this.transitionGrants = new Set(); }
  }

  async fetchMarkerStateMachineStartGrants(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/state-machines/start`, { credentials: 'include' });
      this.stateMachineStartGrants = res.ok ? new Set(await res.json()) : new Set();
    } catch (e) { this.stateMachineStartGrants = new Set(); }
  }

  async fetchUsers() {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) this.users = await res.json();
    } catch (e) { /* best effort */ }
  }

  async fetchGroups() {
    try {
      const res = await fetch('/api/admin/groups', { credentials: 'include' });
      if (res.ok) this.groups = await res.json();
    } catch (e) { /* best effort */ }
  }

  async fetchItemTypes() {
    try {
      const res = await fetch('/api/admin/schema/item-types', { credentials: 'include' });
      if (res.ok) this.itemTypes = await res.json();
    } catch (e) { /* best effort */ }
  }

  async selectGroup(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;
    this.selectedType = 'group';
    this.selectedId = groupId;
    this.selectedData = group;
    this.activeTab = 'members';
    this.selectedItemTypeId = null;
    this.selectedMarkerId = null;
    this.markerPropertyGrants = [];
    this.markerItemGrant = { canRead: false, canDelete: false };
    this.linkPropertyGrants = [];
    this.linkPerspectiveGrants = [];
    this.transitionGrants = new Set();
    this.stateMachineStartGrants = new Set();
    this.error = '';
    await this.fetchGroupMembers();
    await this.fetchGroupPermissions();
    this.render();
  }

  selectItemTypeForGrants(itemTypeId) {
    this.selectedItemTypeId = this.selectedItemTypeId === itemTypeId ? null : itemTypeId;
    this.selectedMarkerId = null;
    this.markerPropertyGrants = [];
    this.markerItemGrant = { canRead: false, canDelete: false };
    this.linkPropertyGrants = [];
    this.linkPerspectiveGrants = [];
    this.transitionGrants = new Set();
    this.stateMachineStartGrants = new Set();
    this.expandedGrantContainers = new Set();
    this.expandedGrantPerspectives = new Set();
    this.expandedGrantStateMachines = new Set();
    this.render();
  }

  // Same immediate-write pattern as ntrloc-item-detail.js's own "+ New Marker" (see
  // ntrloc-create-marker-dialog.js's comment on why scope isn't picked here) -- but updates this
  // component's own local this.markers rather than the schema editor's schemaViewModel.markers,
  // since this panel is mounted independently of the schema editor and doesn't share its state.
  async onNewMarker() {
    const itemType = this.itemTypes.find(it => it.id === this.selectedItemTypeId);
    const result = await openCreateMarkerDialog({
      scopeKind: 'ITEM_TYPE',
      scopeId: this.selectedItemTypeId,
      scopeLabel: `Item Type — ${itemType ? itemType.name : '(unknown)'}`,
    });
    if (!result) return;
    this.error = '';
    try {
      const marker = await markerService.createMarker(result);
      this.markers = [...this.markers, marker].sort((a, b) => a.name.localeCompare(b.name));
      await this.selectMarkerForGrants(marker.id);
    } catch (e) {
      this.error = e.message || 'Failed to create marker.';
      this.render();
    }
  }

  toggleGrantContainer(propertyId) {
    if (this.expandedGrantContainers.has(propertyId)) this.expandedGrantContainers.delete(propertyId);
    else this.expandedGrantContainers.add(propertyId);
    this.render();
  }

  toggleGrantSection(key) {
    if (this.expandedGrantSections.has(key)) this.expandedGrantSections.delete(key);
    else this.expandedGrantSections.add(key);
    this.render();
  }

  toggleGrantPerspective(perspectiveId) {
    if (this.expandedGrantPerspectives.has(perspectiveId)) this.expandedGrantPerspectives.delete(perspectiveId);
    else this.expandedGrantPerspectives.add(perspectiveId);
    this.render();
  }

  toggleGrantStateMachine(machineId) {
    if (this.expandedGrantStateMachines.has(machineId)) this.expandedGrantStateMachines.delete(machineId);
    else this.expandedGrantStateMachines.add(machineId);
    this.render();
  }


  async selectMarkerForGrants(markerId) {
    this.selectedMarkerId = markerId;
    await Promise.all([
      this.fetchMarkerPropertyGrants(markerId),
      this.fetchMarkerItemGrant(markerId),
      this.fetchMarkerLinkPropertyGrants(markerId),
      this.fetchMarkerLinkPerspectiveGrants(markerId),
      this.fetchMarkerTransitionGrants(markerId),
      this.fetchMarkerStateMachineStartGrants(markerId),
    ]);
    this.render();
  }

  async fetchMarkerPropertyGrants(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/properties`, { credentials: 'include' });
      this.markerPropertyGrants = res.ok ? await res.json() : [];
    } catch (e) { this.markerPropertyGrants = []; }
  }

  async fetchMarkerItemGrant(markerId) {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/markers/${markerId}/item-permissions`, { credentials: 'include' });
      this.markerItemGrant = res.ok ? await res.json() : { canRead: false, canDelete: false };
    } catch (e) { this.markerItemGrant = { canRead: false, canDelete: false }; }
  }

  async toggleMarkerItemGrant(field) {
    const next = { ...this.markerItemGrant, [field]: !this.markerItemGrant[field] };
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/markers/${this.selectedMarkerId}/item-permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(next)
      });
      await this.fetchMarkerItemGrant(this.selectedMarkerId);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  // kind: 'item' (marker_grant_property, this item type's own properties) or 'link'
  // (marker_grant_link_property, a link type's own properties reached via a perspective in the
  // Links section) -- same grant shape and UI, different backend table/endpoint.
  async setMarkerPropertyGrant(propertyId, patch, kind) {
    try {
      await this.putMarkerPropertyGrant(propertyId, patch, kind);
      await this.refetchPropertyGrants(kind);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  // Raw single-property PUT, no refetch/render -- used both by the leaf checkbox handler above
  // (via setMarkerPropertyGrant) and by the container "select all" bulk action below, which needs
  // to fire several of these before refreshing once at the end.
  putMarkerPropertyGrant(propertyId, patch, kind) {
    const current = this.grantsArrayFor(kind).find(g => g.propertyId === propertyId)
      || { canRead: false, canWrite: false };
    const next = { ...current, ...patch };
    const segment = this.grantsEndpointSegment(kind);
    return fetch(`/api/admin/groups/${this.selectedId}/markers/${this.selectedMarkerId}/${segment}/${propertyId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(next)
    });
  }

  // Every leaf (non-OBJECT) property reachable under this node, recursively -- a plain property is
  // its own sole leaf. Mirrors the server's propertyPaths walk (RegisterPartitionManager): an
  // OBJECT property's own id is never a grant target, only its leaves' are.
  leavesUnder(node) {
    if (node.type !== 'OBJECT') return [node];
    return (node.properties || []).flatMap(child => this.leavesUnder(child));
  }

  findPropertyNode(properties, propertyId) {
    for (const p of properties) {
      if (p.id === propertyId) return p;
      if (p.type === 'OBJECT') {
        const found = this.findPropertyNode(p.properties || [], propertyId);
        if (found) return found;
      }
    }
    return null;
  }

  // 'all' | 'partial' | 'none' | null (null = no leaf under this container at all -- renders as a
  // blank cell).
  containerFieldState(node, field, kind) {
    const grants = this.grantsArrayFor(kind);
    const eligible = this.leavesUnder(node);
    if (eligible.length === 0) return null;
    const grantedCount = eligible.filter(l => {
      const g = grants.find(g => g.propertyId === l.id);
      return g ? g[field] : false;
    }).length;
    if (grantedCount === 0) return 'none';
    return grantedCount === eligible.length ? 'all' : 'partial';
  }

  // Container-row "select all" click: partial/none -> grant the field on every eligible leaf;
  // all -> revoke it on every eligible leaf. One PUT per leaf (admin surface, small N), then a
  // single refetch/render at the end rather than one per leaf. rootProperties is the tree to search
  // for containerId in -- the selected item type's own properties for 'item', or the specific link
  // type's properties (reached via linkId) for 'link', since a single item type can have several
  // link perspectives, each with its own independent property tree.
  async setBulkPropertyGrant(containerId, field, kind, rootProperties) {
    const node = this.findPropertyNode(rootProperties, containerId);
    if (!node) return;
    const eligible = this.leavesUnder(node);
    const nextValue = this.containerFieldState(node, field, kind) !== 'all';
    try {
      await Promise.all(eligible.map(l => this.putMarkerPropertyGrant(l.id, { [field]: nextValue }, kind)));
      await this.refetchPropertyGrants(kind);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  linksForItemType(itemTypeId) {
    const schema = globalSchemaModel._schema;
    const item = schema && (schema.items || []).find(i => i.id === itemTypeId);
    if (!item || !item.links) return [];
    const result = [];
    Object.entries(item.links).forEach(([name, perspectives]) => {
      (perspectives || []).forEach(p => result.push({ ...p, perspectiveName: name }));
    });
    return result.sort((a, b) => a.perspectiveName.localeCompare(b.perspectiveName));
  }

  linkPropertiesForLinkId(linkId) {
    const schema = globalSchemaModel._schema;
    const linkDef = schema && (schema.links || []).find(l => l.id === linkId);
    return linkDef ? (linkDef.properties || []) : [];
  }

  stateMachinesForItemType(itemTypeId) {
    const schema = globalSchemaModel._schema;
    const item = schema && (schema.items || []).find(i => i.id === itemTypeId);
    return item ? (item.stateMachines || []) : [];
  }

  async setLinkPerspectiveGrant(perspectiveId, next) {
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/markers/${this.selectedMarkerId}/link-perspectives/${perspectiveId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(next)
      });
      await this.fetchMarkerLinkPerspectiveGrants(this.selectedMarkerId);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async toggleTransitionGrant(transitionId) {
    const granted = this.transitionGrants.has(transitionId);
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/markers/${this.selectedMarkerId}/transitions/${transitionId}`, {
        method: granted ? 'DELETE' : 'POST', credentials: 'include'
      });
      await this.fetchMarkerTransitionGrants(this.selectedMarkerId);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async toggleStateMachineStartGrant(machineId) {
    const granted = this.stateMachineStartGrants.has(machineId);
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/markers/${this.selectedMarkerId}/state-machines/${machineId}/start`, {
        method: granted ? 'DELETE' : 'POST', credentials: 'include'
      });
      await this.fetchMarkerStateMachineStartGrants(this.selectedMarkerId);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async selectUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    this.selectedType = 'user';
    this.selectedId = userId;
    this.selectedData = user;
    this.error = '';
    await Promise.all([
      this.fetchUserGroups(),
      this.fetchUserPermissions(),
      this.fetchUserTokens()
    ]);
    this.render();
  }

  async fetchGroupMembers() {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/members`, { credentials: 'include' });
      this.members = res.ok ? await res.json() : [];
    } catch (e) { this.members = []; }
  }

  async fetchGroupPermissions() {
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}/permissions`, { credentials: 'include' });
      this.permissions = res.ok ? await res.json() : [];
    } catch (e) { this.permissions = []; }
  }

  async fetchUserGroups() {
    try {
      const res = await fetch(`/api/admin/users/${this.selectedId}/groups`, { credentials: 'include' });
      this.userGroups = res.ok ? await res.json() : [];
    } catch (e) { this.userGroups = []; }
  }

  async fetchUserPermissions() {
    try {
      const res = await fetch(`/api/admin/users/${this.selectedId}/permissions`, { credentials: 'include' });
      this.userPermissions = res.ok ? await res.json() : [];
    } catch (e) { this.userPermissions = []; }
  }

  async fetchUserTokens() {
    try {
      const res = await fetch(`/api/admin/users/${this.selectedId}/tokens`, { credentials: 'include' });
      this.tokens = res.ok ? await res.json() : [];
    } catch (e) { this.tokens = []; }
  }

  // --- Group actions ---

  async addMemberToGroup(userId) {
    if (!userId) return;
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId })
      });
      await this.fetchGroupMembers();
      await this.fetchGroups();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async removeMemberFromGroup(userId) {
    try {
      await fetch(`/api/admin/groups/${this.selectedId}/members/${userId}`, {
        method: 'DELETE', credentials: 'include'
      });
      await this.fetchGroupMembers();
      await this.fetchGroups();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async toggleGroupPermission(itemTypeId, operation) {
    const existing = this.permissions.find(p => p.itemTypeId === itemTypeId);
    const hasOp = existing && existing.operations.includes(operation);
    try {
      if (hasOp) {
        await fetch(`/api/admin/groups/${this.selectedId}/permissions`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ itemTypeId, operation })
        });
      } else {
        await fetch(`/api/admin/groups/${this.selectedId}/permissions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ itemTypeId, operation })
        });
      }
      await this.fetchGroupPermissions();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async renameGroup() {
    const input = this.querySelector('[name="rename-group"]');
    const name = input?.value.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error(await res.text());
      this.selectedData = await res.json();
      await this.fetchGroups();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async deleteGroup() {
    if (!confirm(`Delete group "${this.selectedData.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedId}`, {
        method: 'DELETE', credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      this.selectedType = null;
      this.selectedId = null;
      this.selectedData = null;
      await this.fetchGroups();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async createGroup() {
    const input = this.querySelector('[name="new-group-name"]');
    const name = input?.value.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error(await res.text());
      const group = await res.json();
      await this.fetchGroups();
      this.selectGroup(group.id);
    } catch (e) { this.error = e.message; this.render(); }
  }

  // --- User actions ---

  async addUserToGroup(groupId) {
    if (!groupId) return;
    try {
      await fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId: this.selectedId })
      });
      await Promise.all([this.fetchUserGroups(), this.fetchUserPermissions(), this.fetchGroups()]);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async removeUserFromGroup(groupId) {
    try {
      await fetch(`/api/admin/groups/${groupId}/members/${this.selectedId}`, {
        method: 'DELETE', credentials: 'include'
      });
      await Promise.all([this.fetchUserGroups(), this.fetchUserPermissions(), this.fetchGroups()]);
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async createToken() {
    const nameInput = this.querySelector('[name="token-name"]');
    const daysInput = this.querySelector('[name="token-days"]');
    const name = nameInput?.value.trim();
    const expiresInDays = parseInt(daysInput?.value, 10) || null;
    if (!name) { this.error = 'Token name is required'; this.render(); return; }
    try {
      const res = await fetch(`/api/admin/users/${this.selectedId}/tokens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name, expiresInDays })
      });
      if (!res.ok) throw new Error('Failed to create token');
      this._createdToken = await res.json();
      await this.fetchUserTokens();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async revokeToken(tokenId) {
    try {
      await fetch(`/api/admin/users/${this.selectedId}/tokens/${tokenId}`, {
        method: 'DELETE', credentials: 'include'
      });
      await this.fetchUserTokens();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async createUser() {
    const get = name => this.querySelector(`[name="${name}"]`)?.value.trim();
    const body = { externalId: get('new-username'), displayName: get('new-displayname'),
                   email: get('new-email'), password: get('new-password'), role: get('new-role') };
    if (!body.externalId || !body.password) { this.error = 'Username and password required'; this.render(); return; }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const user = await res.json();
      await this.fetchUsers();
      await this.fetchGroups();
      this.selectUser(user.id);
    } catch (e) { this.error = e.message; this.render(); }
  }

  async resetPassword() {
    const input = this.querySelector('[name="new-password-reset"]');
    const pw = input?.value.trim();
    if (!pw) { this.error = 'Password is required'; this.render(); return; }
    try {
      const res = await fetch(`/api/admin/users/${this.selectedId}/password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ newPassword: pw })
      });
      if (!res.ok) throw new Error('Failed to reset password');
      input.value = '';
      this.error = '';
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  escapeHtml(v) {
    const d = document.createElement('div');
    d.textContent = String(v ?? '');
    return d.innerHTML;
  }

  formatDate(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString();
  }

  render() {
    const userItems = this.users.map(u => `
      <div class="access-sidebar-item ${this.selectedType === 'user' && this.selectedId === u.id ? 'selected' : ''}" data-select-user="${u.id}">
        <div>
          <span class="item-name">${this.escapeHtml(u.externalId)}</span>${u.isSuperuser ? '<span class="badge-admin">admin</span>' : ''}
          <br><span class="item-sub">${this.escapeHtml(u.displayName)}</span>
        </div>
      </div>
    `).join('');

    const groupItems = this.groups.map(g => `
      <div class="access-sidebar-item ${this.selectedType === 'group' && this.selectedId === g.id ? 'selected' : ''}" data-select-group="${g.id}">
        <span><span class="item-name">${this.escapeHtml(g.name)}</span>${g.name === 'everyone' ? '<span class="badge-default">default</span>' : ''}</span>
        <span class="item-count">${g.memberCount}</span>
      </div>
    `).join('');

    let detailHtml = '<div class="access-empty">Select a user or group from the sidebar.</div>';

    if (this.selectedType === 'group' && this.selectedData) {
      detailHtml = this.renderGroupDetail();
    } else if (this.selectedType === 'user' && this.selectedData) {
      detailHtml = this.renderUserDetail();
    } else if (this.selectedType === 'create-user') {
      detailHtml = this.renderCreateUser();
    } else if (this.selectedType === 'create-group') {
      detailHtml = this.renderCreateGroup();
    }

    this.innerHTML = `
      <div class="access-sidebar">
        <div class="access-sidebar-section">
          <div class="access-sidebar-header">
            <h3>Users</h3>
            <button class="access-btn primary" data-action="show-create-user">+ New</button>
          </div>
          <div class="access-sidebar-list">${userItems}</div>
        </div>
        <div class="access-sidebar-section">
          <div class="access-sidebar-header">
            <h3>Groups</h3>
            <button class="access-btn primary" data-action="show-create-group">+ New</button>
          </div>
          <div class="access-sidebar-list">${groupItems}</div>
        </div>
      </div>
      <div class="access-detail">
        ${this.error ? `<div class="access-error" style="padding:12px 24px;">${this.escapeHtml(this.error)}</div>` : ''}
        ${detailHtml}
      </div>
    `;

    this.bindEvents();
  }

  renderGroupDetail() {
    const g = this.selectedData;
    const isDefault = g.name === 'everyone';
    const tabContent = this.activeTab === 'members' ? this.renderGroupMembers() : this.renderGroupPermissions();

    return `
      <div class="access-detail-header">
        <h2>${this.escapeHtml(g.name)}</h2>
        <span class="type-badge">group</span>
        <div class="actions">
          <button class="access-btn ghost" data-action="rename-group">Rename</button>
          ${!isDefault ? `<button class="access-btn danger" data-action="delete-group">Delete</button>` : ''}
        </div>
      </div>
      <div class="access-detail-tabs">
        <div class="access-detail-tab ${this.activeTab === 'members' ? 'active' : ''}" data-tab="members">Members</div>
        <div class="access-detail-tab ${this.activeTab === 'permissions' ? 'active' : ''}" data-tab="permissions">Permissions</div>
      </div>
      <div class="access-detail-content">${tabContent}</div>
    `;
  }

  renderGroupMembers() {
    const memberIds = new Set(this.members.map(m => m.id));
    const available = this.users.filter(u => !memberIds.has(u.id));
    const rows = this.members.map(m => `
      <tr>
        <td>${this.escapeHtml(m.externalId)}</td>
        <td>${this.escapeHtml(m.displayName)}</td>
        <td>${this.escapeHtml(m.email || '')}</td>
        <td><button class="access-btn danger" data-remove-member="${m.id}">Remove</button></td>
      </tr>
    `).join('');

    const options = available.map(u =>
      `<option value="${u.id}">${this.escapeHtml(u.displayName)} (${this.escapeHtml(u.externalId)})</option>`
    ).join('');

    return `
      <div class="access-section">
        <table class="access-table">
          <thead><tr><th>Username</th><th>Display Name</th><th>Email</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="access-empty">No members</td></tr>'}</tbody>
        </table>
        ${available.length > 0 ? `
          <div class="access-add-row">
            <select name="add-member-select"><option value="">-- Add user --</option>${options}</select>
            <button class="access-btn primary" data-action="add-member">Add</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderGroupPermissions() {
    const operations = ['item-type:read', 'item-type:create'];
    const opLabels = { 'item-type:read': 'Read', 'item-type:create': 'Create' };

    const rows = this.itemTypes.map(it => {
      const perm = this.permissions.find(p => p.itemTypeId === it.id);
      const ops = perm ? perm.operations : [];
      const cells = operations.map(op => {
        const granted = ops.includes(op);
        return `<td><button class="perm-check ${granted ? 'granted' : ''}" data-perm-item="${it.id}" data-perm-op="${op}">${granted ? '&#10003;' : ''}</button></td>`;
      }).join('');
      const selected = this.selectedItemTypeId === it.id;
      return `<tr class="clickable ${selected ? 'selected' : ''}" data-select-item-type="${it.id}"><td>${this.escapeHtml(it.name)}</td>${cells}</tr>`;
    }).join('');

    return `
      <div class="access-section">
        <table class="access-table">
          <thead><tr><th>Item Type</th>${operations.map(op => `<th>${opLabels[op]}</th>`).join('')}</tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="access-empty">No item types defined</td></tr>'}</tbody>
        </table>
      </div>
      ${this.selectedItemTypeId ? this.renderMarkerPropertyGrants() : ''}
    `;
  }

  // Recursive rows for the property grants tree -- OBJECT properties render as an expandable
  // container row with bulk "select all descendants" checkboxes (see setBulkPropertyGrant) instead
  // of their own grant, since nothing is ever stored under a container's own property id (see
  // leavesUnder's comment); leaf rows render the real per-property grant checkboxes, same as before
  // nesting was supported. Mirrors ntrloc-property-table.js's chevron-toggle idiom for visual
  // consistency with the schema editor's own nested-property display.
  // kind/linkId thread through recursion so leaf/bulk buttons know which grant table and which
  // property tree (this item type's own vs. a specific link type's, reached via linkId) they
  // belong to -- see setMarkerPropertyGrant/setBulkPropertyGrant's own comments.
  renderPropertyGrantRows(properties, depth, kind, linkId) {
    const sorted = [...properties].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map(p => {
      const isContainer = p.type === 'OBJECT';
      const indent = `style="padding-left: ${depth * 20}px"`;
      if (isContainer) {
        const expanded = this.expandedGrantContainers.has(p.id);
        const chevron = `
          <button class="expand-toggle-button" data-toggle-grant-container="${p.id}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${this.escapeHtml(p.name)}" aria-expanded="${expanded}">
            <svg class="chevron ${expanded ? '' : 'collapsed'}" viewBox="0 0 24 24" width="14" height="14"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        `;
        const bulkCell = (field) => {
          const state = this.containerFieldState(p, field, kind);
          if (state === null) return '<td></td>';
          const label = state === 'all' ? '&#10003;' : state === 'partial' ? '&#8211;' : '';
          return `<td><button class="perm-check ${state === 'all' ? 'granted' : ''} ${state === 'partial' ? 'partial' : ''}" data-bulk-property="${p.id}" data-bulk-field="${field}" data-bulk-kind="${kind}" data-bulk-link-id="${linkId || ''}">${label}</button></td>`;
        };
        const ownRow = `
          <tr>
            <td ${indent}>${chevron}${this.escapeHtml(p.name)}</td>
            ${bulkCell('canRead')}
            ${bulkCell('canWrite')}
          </tr>
        `;
        const childRows = expanded ? this.renderPropertyGrantRows(p.properties || [], depth + 1, kind, linkId) : '';
        return ownRow + childRows;
      }

      const grant = this.grantsArrayFor(kind).find(g => g.propertyId === p.id)
        || { canRead: false, canWrite: false };
      // Write carries Read implicitly (server-enforced -- see AuthorizationRepository), so an
      // implied-but-not-explicit Read renders checked but faded and non-interactive rather than a
      // real, independently-clickable grant: toggling it off here wouldn't actually revoke read
      // access while Write stays on, which would be misleading to show as a live checkbox.
      const readImplied = !grant.canRead && grant.canWrite;
      const readCell = readImplied
        ? `<td><button class="perm-check granted implied" disabled title="Implied by Write">&#10003;</button></td>`
        : `<td><button class="perm-check ${grant.canRead ? 'granted' : ''}" data-marker-grant-property="${p.id}" data-marker-grant-field="canRead" data-grant-kind="${kind}">${grant.canRead ? '&#10003;' : ''}</button></td>`;
      return `
        <tr>
          <td ${indent}><span class="grant-leaf-spacer"></span>${this.escapeHtml(p.name)}</td>
          ${readCell}
          <td><button class="perm-check ${grant.canWrite ? 'granted' : ''}" data-marker-grant-property="${p.id}" data-marker-grant-field="canWrite" data-grant-kind="${kind}">${grant.canWrite ? '&#10003;' : ''}</button></td>
        </tr>
      `;
    }).join('');
  }

  propertyGrantTable(properties, kind, linkId) {
    const rows = this.renderPropertyGrantRows(properties, 0, kind, linkId);
    return `
      <table class="access-table">
        <thead><tr><th>Property</th><th>Read</th><th>Write</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="access-empty">No properties defined</td></tr>'}</tbody>
      </table>
    `;
  }

  propertiesForItemType(itemTypeId) {
    const schema = globalSchemaModel._schema;
    const item = schema && (schema.items || []).find(i => i.id === itemTypeId);
    return item ? (item.properties || []) : [];
  }

  renderLinksSection() {
    const perspectives = this.linksForItemType(this.selectedItemTypeId);
    if (perspectives.length === 0) return '<div class="access-empty">No links defined on this item type.</div>';

    return perspectives.map(p => {
      const grant = this.linkPerspectiveGrants.find(g => g.perspectiveId === p.id)
        || { canCreate: false, canRead: false, canDelete: false };
      const expanded = this.expandedGrantPerspectives.has(p.id);
      const chevron = `
        <button class="expand-toggle-button" data-toggle-grant-perspective="${p.id}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${this.escapeHtml(p.perspectiveName)}" aria-expanded="${expanded}">
          <svg class="chevron ${expanded ? '' : 'collapsed'}" viewBox="0 0 24 24" width="14" height="14"
               fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      `;
      const perspectiveCheck = (field, label) => `
        <label class="perspective-check-label">${label}
          <button class="perm-check ${grant[field] ? 'granted' : ''}" data-perspective-grant="${p.id}" data-perspective-field="${field}">${grant[field] ? '&#10003;' : ''}</button>
        </label>
      `;
      const header = `
        <div class="perspective-header">
          <span class="perspective-name">${chevron}${this.escapeHtml(p.perspectiveName)}</span>
          <span class="perspective-checks">
            ${perspectiveCheck('canCreate', 'Create')}
            ${perspectiveCheck('canRead', 'Read')}
            ${perspectiveCheck('canDelete', 'Delete')}
          </span>
        </div>
      `;
      const propertyTable = expanded
        ? this.propertyGrantTable(this.linkPropertiesForLinkId(p.linkId), 'link', p.linkId)
        : '';
      return `<div class="perspective-card">${header}${propertyTable}</div>`;
    }).join('');
  }

  // Flat "From State / Transition / To State / Execute" table per machine -- no separate
  // state-level expand/collapse tier (a state has no grant of its own, just like an OBJECT
  // property container; showing it as a plain column value alongside its transitions is both
  // simpler and enough, per the mockup this replaced).
  renderStateMachinesSection() {
    const machines = this.stateMachinesForItemType(this.selectedItemTypeId);
    if (machines.length === 0) return '<div class="access-empty">No state machines defined on this item type.</div>';

    const rows = machines.map(m => {
      const expanded = this.expandedGrantStateMachines.has(m.id);
      const chevron = `
        <button class="expand-toggle-button" data-toggle-grant-statemachine="${m.id}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${this.escapeHtml(m.name)}" aria-expanded="${expanded}">
          <svg class="chevron ${expanded ? '' : 'collapsed'}" viewBox="0 0 24 24" width="14" height="14"
               fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      `;
      const startGranted = this.stateMachineStartGrants.has(m.id);
      const machineRow = `<tr>
        <td>${chevron}${this.escapeHtml(m.name)}</td>
        <td></td><td></td>
        <td style="text-align:right;color:var(--muted);font-size:11px">start</td>
        <td><button class="perm-check ${startGranted ? 'granted' : ''}" data-sm-start-grant="${m.id}" title="state-machine:start">${startGranted ? '&#10003;' : ''}</button></td>
      </tr>`;

      let transitionRows = '';
      if (expanded) {
        const transitions = (m.states || []).flatMap(s => (s.transitions || []).map(t => ({ state: s, transition: t })));
        transitionRows = transitions.map(({ state, transition: t }) => {
          const granted = this.transitionGrants.has(t.id);
          return `
            <tr>
              <td></td>
              <td>${this.escapeHtml(state.name)}</td>
              <td>${this.escapeHtml(t.name)}</td>
              <td>${this.escapeHtml(t.toStateName)}</td>
              <td><button class="perm-check ${granted ? 'granted' : ''}" data-transition-grant="${t.id}">${granted ? '&#10003;' : ''}</button></td>
            </tr>
          `;
        }).join('') || '<tr><td></td><td colspan="4" class="access-empty">No transitions</td></tr>';
      }

      return machineRow + transitionRows;
    }).join('');

    return `
      <table class="access-table">
        <thead><tr><th>State Machine</th><th>From State</th><th>Transition</th><th>To State</th><th>Grant</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderMarkerPropertyGrants() {
    const markersForType = this.markers.filter(m => m.scopeKind === 'ITEM_TYPE' && m.scopeId === this.selectedItemTypeId);

    const markerItems = markersForType.map(m => `
      <div class="marker-grant-item ${this.selectedMarkerId === m.id ? 'selected' : ''}" data-select-marker="${m.id}">
        ${this.escapeHtml(m.name)}
      </div>
    `).join('') || '<div class="access-empty">No markers on this item type</div>';

    let sectionsHtml = '<div class="access-empty">Select a marker to view its grants.</div>';
    if (this.selectedMarkerId) {
      const g = this.markerItemGrant;
      const itemPanel = `
        <div class="grant-panel">
          <div class="grant-panel-header static"><span>Item</span></div>
          <div class="grant-panel-body">
            <div class="perspective-checks">
              <label class="perspective-check-label">Read
                <button class="perm-check ${g.canRead ? 'granted' : ''}" data-marker-item-field="canRead">${g.canRead ? '&#10003;' : ''}</button>
              </label>
              <label class="perspective-check-label">Delete
                <button class="perm-check ${g.canDelete ? 'granted' : ''}" data-marker-item-field="canDelete">${g.canDelete ? '&#10003;' : ''}</button>
              </label>
            </div>
          </div>
        </div>
      `;
      const sections = [
        { key: 'properties', label: 'Properties' },
        { key: 'links', label: 'Links' },
        { key: 'statemachines', label: 'State Machines' },
      ];
      sectionsHtml = itemPanel + sections.map(({ key, label }) => {
        const expanded = this.expandedGrantSections.has(key);
        // Plain SVG (no button wrapper) with the whole header div as the click target -- same
        // idiom as ntrloc-item-detail.js's own .panel-header sections, not the button-based
        // chevron used for inline row toggles elsewhere in this file (property/perspective/state
        // rows, where other independently-clickable elements share the same row).
        const chevronSvg = `
          <svg class="chevron ${expanded ? '' : 'collapsed'}" viewBox="0 0 24 24" width="20" height="20"
               fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;
        let body = '';
        if (expanded) {
          if (key === 'properties') body = this.propertyGrantTable(this.propertiesForItemType(this.selectedItemTypeId), 'item', null);
          else if (key === 'links') body = this.renderLinksSection();
          else body = this.renderStateMachinesSection();
        }
        return `
          <div class="grant-panel">
            <div class="grant-panel-header" data-toggle-grant-section="${key}">
              ${chevronSvg}<span>${label}</span>
            </div>
            ${expanded ? `<div class="grant-panel-body">${body}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    return `
      <div class="access-section marker-grants-section">
        <div class="marker-grants-layout">
          <div class="marker-grants-markers">
            <div class="marker-grants-markers-header">
              <h4>Markers</h4>
              <button class="access-btn primary" data-action="new-marker">+ New</button>
            </div>
            ${markerItems}
          </div>
          <div class="marker-grants-properties">
            ${sectionsHtml}
          </div>
        </div>
      </div>
    `;
  }

  renderUserDetail() {
    const u = this.selectedData;
    const groupChips = this.userGroups.map(g =>
      `<span class="access-chip" data-remove-user-group="${g.id}">${this.escapeHtml(g.name)}</span>`
    ).join('');

    const availableGroups = this.groups.filter(g => !this.userGroups.find(ug => ug.id === g.id));
    const groupOptions = availableGroups.map(g =>
      `<option value="${g.id}">${this.escapeHtml(g.name)}</option>`
    ).join('');

    const operations = ['item-type:read', 'item-type:create'];
    const opLabels = { 'item-type:read': 'Read', 'item-type:create': 'Create' };
    const permRows = this.userPermissions.map(p => {
      const cells = operations.map(op => {
        const entry = p.operations.find(o => o.operation === op);
        const granted = !!entry;
        const via = entry ? entry.via.join(', ') : '';
        return `<td><span class="perm-check ${granted ? 'granted' : ''}">${granted ? '&#10003;' : ''}</span></td>`;
      }).join('');
      const viaCol = operations.map(op => {
        const entry = p.operations.find(o => o.operation === op);
        return entry ? entry.via.join(', ') : '';
      }).filter(Boolean);
      const viaText = [...new Set(viaCol.flatMap(v => v.split(', ')))].join(', ');
      return `<tr><td>${this.escapeHtml(p.itemTypeName)}</td>${cells}<td style="font-size:11px;color:var(--muted);">${this.escapeHtml(viaText)}</td></tr>`;
    }).join('');

    const tokenRows = this.tokens.map(t => `
      <tr>
        <td>${this.escapeHtml(t.name)}</td>
        <td style="color:var(--muted);">${this.formatDate(t.createdAt)}</td>
        <td style="color:var(--muted);">${this.formatDate(t.expiresAt)}</td>
        <td><button class="access-btn danger" data-revoke-token="${t.id}">Revoke</button></td>
      </tr>
    `).join('');

    let tokenRevealHtml = '';
    if (this._createdToken) {
      tokenRevealHtml = `
        <div style="margin-top:10px;padding:10px;border:1px solid var(--accent);border-radius:6px;background:var(--bg);">
          <code style="display:block;font-size:12px;word-break:break-all;user-select:all;margin-bottom:4px;">${this.escapeHtml(this._createdToken.token)}</code>
          <div style="font-size:11px;color:var(--muted);">Copy this token now — it won't be shown again.</div>
        </div>
      `;
    }

    return `
      <div class="access-detail-header">
        <h2>${this.escapeHtml(u.externalId)}</h2>
        <span class="type-badge">user</span>
        <div class="actions">
          <button class="access-btn ghost" data-action="show-reset-password">Reset Password</button>
        </div>
      </div>
      <div class="access-detail-content">
        <div class="access-section">
          <h4>Profile</h4>
          <table class="access-table access-profile-table">
            <tbody>
              <tr><td>Username</td><td>${this.escapeHtml(u.externalId)}</td></tr>
              <tr><td>Display Name</td><td>${this.escapeHtml(u.displayName)}</td></tr>
              <tr><td>Email</td><td>${this.escapeHtml(u.email || '')}</td></tr>
              <tr><td>Role</td><td>${u.isSuperuser ? 'Admin' : 'User'}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="access-section">
          <h4>Group Memberships</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            ${groupChips || '<span style="color:var(--muted);font-style:italic;">No groups</span>'}
          </div>
          ${availableGroups.length > 0 ? `
            <div class="access-add-row">
              <select name="add-user-group"><option value="">-- Add to group --</option>${groupOptions}</select>
              <button class="access-btn primary" data-action="add-user-to-group">Add</button>
            </div>
          ` : ''}
        </div>

        <div class="access-section">
          <h4>Effective Permissions</h4>
          ${this.userPermissions.length > 0 ? `
            <table class="access-table">
              <thead><tr><th>Item Type</th>${operations.map(op => `<th>${opLabels[op]}</th>`).join('')}<th style="color:var(--muted);font-size:10px;">Via</th></tr></thead>
              <tbody>${permRows}</tbody>
            </table>
          ` : '<p style="color:var(--muted);font-style:italic;">No permissions (user has no group grants).</p>'}
        </div>

        <div class="access-section">
          <h4>Personal Access Tokens</h4>
          <table class="access-table">
            <thead><tr><th>Name</th><th>Created</th><th>Expires</th><th></th></tr></thead>
            <tbody>${tokenRows || '<tr><td colspan="4" style="color:var(--muted);font-style:italic;">No tokens</td></tr>'}</tbody>
          </table>
          ${tokenRevealHtml}
          <div class="access-add-row">
            <input name="token-name" placeholder="Token name" autocomplete="off">
            <input name="token-days" type="number" placeholder="Days" min="1" style="width:70px;flex:none;">
            <button class="access-btn primary" data-action="create-token">Create</button>
          </div>
        </div>

        <div class="access-section" id="reset-password-section" style="display:none;">
          <h4>Reset Password</h4>
          <div class="access-add-row">
            <input name="new-password-reset" type="password" placeholder="New password" autocomplete="new-password">
            <button class="access-btn danger" data-action="reset-password">Reset</button>
          </div>
        </div>
      </div>
    `;
  }

  renderCreateUser() {
    return `
      <div class="access-detail-header">
        <h2>Create User</h2>
      </div>
      <div class="access-detail-content">
        <div class="access-section">
          <table class="access-table access-profile-table">
            <tbody>
              <tr><td>Username</td><td><input name="new-username" placeholder="Login ID" autocomplete="off" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;width:100%;"></td></tr>
              <tr><td>Display Name</td><td><input name="new-displayname" placeholder="Full name" autocomplete="off" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;width:100%;"></td></tr>
              <tr><td>Email</td><td><input name="new-email" type="email" placeholder="Email" autocomplete="off" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;width:100%;"></td></tr>
              <tr><td>Password</td><td><input name="new-password" type="password" placeholder="Password" autocomplete="new-password" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;width:100%;"></td></tr>
              <tr><td>Role</td><td><select name="new-role" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px;"><option value="USER">User</option><option value="ADMIN">Admin</option></select></td></tr>
            </tbody>
          </table>
          <div style="margin-top:16px;display:flex;gap:8px;">
            <button class="access-btn primary" data-action="create-user">Create User</button>
          </div>
        </div>
      </div>
    `;
  }

  renderCreateGroup() {
    return `
      <div class="access-detail-header">
        <h2>Create Group</h2>
      </div>
      <div class="access-detail-content">
        <div class="access-section">
          <div class="access-add-row">
            <input name="new-group-name" placeholder="Group name" autocomplete="off">
            <button class="access-btn primary" data-action="create-group">Create Group</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.querySelectorAll('[data-select-user]').forEach(el => {
      el.addEventListener('click', () => this.selectUser(el.dataset.selectUser));
    });
    this.querySelectorAll('[data-select-group]').forEach(el => {
      el.addEventListener('click', () => this.selectGroup(el.dataset.selectGroup));
    });
    this.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => { this.activeTab = el.dataset.tab; this.render(); });
    });
    this.querySelectorAll('[data-remove-member]').forEach(el => {
      el.addEventListener('click', () => this.removeMemberFromGroup(el.dataset.removeMember));
    });
    this.querySelector('[data-action="add-member"]')?.addEventListener('click', () => {
      this.addMemberToGroup(this.querySelector('[name="add-member-select"]')?.value);
    });
    this.querySelectorAll('[data-perm-item]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGroupPermission(el.dataset.permItem, el.dataset.permOp);
      });
    });
    this.querySelectorAll('[data-select-item-type]').forEach(el => {
      el.addEventListener('click', () => this.selectItemTypeForGrants(el.dataset.selectItemType));
    });
    this.querySelectorAll('[data-select-marker]').forEach(el => {
      el.addEventListener('click', () => this.selectMarkerForGrants(el.dataset.selectMarker));
    });
    this.querySelectorAll('[data-marker-item-field]').forEach(el => {
      el.addEventListener('click', () => this.toggleMarkerItemGrant(el.dataset.markerItemField));
    });
    this.querySelectorAll('[data-marker-grant-property]').forEach(el => {
      el.addEventListener('click', () => {
        const field = el.dataset.markerGrantField;
        const kind = el.dataset.grantKind;
        const current = this.grantsArrayFor(kind).find(g => g.propertyId === el.dataset.markerGrantProperty);
        const currentlyOn = current ? current[field] : false;
        this.setMarkerPropertyGrant(el.dataset.markerGrantProperty, { [field]: !currentlyOn }, kind);
      });
    });
    this.querySelectorAll('[data-toggle-grant-container]').forEach(el => {
      el.addEventListener('click', () => this.toggleGrantContainer(el.dataset.toggleGrantContainer));
    });
    this.querySelectorAll('[data-bulk-property]').forEach(el => {
      el.addEventListener('click', () => {
        const kind = el.dataset.bulkKind;
        const rootProperties = kind === 'link'
          ? this.linkPropertiesForLinkId(el.dataset.bulkLinkId)
          : this.propertiesForItemType(this.selectedItemTypeId);
        this.setBulkPropertyGrant(el.dataset.bulkProperty, el.dataset.bulkField, kind, rootProperties);
      });
    });
    this.querySelectorAll('[data-toggle-grant-section]').forEach(el => {
      el.addEventListener('click', () => this.toggleGrantSection(el.dataset.toggleGrantSection));
    });
    this.querySelectorAll('[data-toggle-grant-perspective]').forEach(el => {
      el.addEventListener('click', () => this.toggleGrantPerspective(el.dataset.toggleGrantPerspective));
    });
    this.querySelectorAll('[data-perspective-grant]').forEach(el => {
      el.addEventListener('click', () => {
        const field = el.dataset.perspectiveField;
        const current = this.linkPerspectiveGrants.find(g => g.perspectiveId === el.dataset.perspectiveGrant)
          || { canCreate: false, canRead: false, canDelete: false };
        this.setLinkPerspectiveGrant(el.dataset.perspectiveGrant, { ...current, [field]: !current[field] });
      });
    });
    this.querySelectorAll('[data-toggle-grant-statemachine]').forEach(el => {
      el.addEventListener('click', () => this.toggleGrantStateMachine(el.dataset.toggleGrantStatemachine));
    });
    this.querySelectorAll('[data-sm-start-grant]').forEach(el => {
      el.addEventListener('click', () => this.toggleStateMachineStartGrant(el.dataset.smStartGrant));
    });
    this.querySelectorAll('[data-transition-grant]').forEach(el => {
      el.addEventListener('click', () => this.toggleTransitionGrant(el.dataset.transitionGrant));
    });
    this.querySelector('[data-action="rename-group"]')?.addEventListener('click', () => {
      const name = prompt('New group name:', this.selectedData.name);
      if (name && name.trim()) {
        this.querySelector('[name="rename-group"]') || (() => {
          const input = document.createElement('input');
          input.name = 'rename-group';
          input.value = name.trim();
          input.style.display = 'none';
          this.appendChild(input);
        })();
        const fakeInput = this.querySelector('[name="rename-group"]');
        if (fakeInput) fakeInput.value = name.trim();
        else {
          const i = document.createElement('input');
          i.name = 'rename-group'; i.value = name.trim(); i.style.display = 'none';
          this.appendChild(i);
        }
        this.renameGroup();
      }
    });
    this.querySelector('[data-action="delete-group"]')?.addEventListener('click', () => this.deleteGroup());
    this.querySelectorAll('[data-remove-user-group]').forEach(el => {
      el.addEventListener('click', () => this.removeUserFromGroup(el.dataset.removeUserGroup));
    });
    this.querySelector('[data-action="add-user-to-group"]')?.addEventListener('click', () => {
      this.addUserToGroup(this.querySelector('[name="add-user-group"]')?.value);
    });
    this.querySelector('[data-action="create-token"]')?.addEventListener('click', () => this.createToken());
    this.querySelectorAll('[data-revoke-token]').forEach(el => {
      el.addEventListener('click', () => this.revokeToken(el.dataset.revokeToken));
    });
    this.querySelector('[data-action="show-reset-password"]')?.addEventListener('click', () => {
      const sec = this.querySelector('#reset-password-section');
      if (sec) sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
    });
    this.querySelector('[data-action="reset-password"]')?.addEventListener('click', () => this.resetPassword());
    this.querySelector('[data-action="show-create-user"]')?.addEventListener('click', () => {
      this.selectedType = 'create-user';
      this.selectedData = {};
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="show-create-group"]')?.addEventListener('click', () => {
      this.selectedType = 'create-group';
      this.selectedData = {};
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="create-user"]')?.addEventListener('click', () => this.createUser());
    this.querySelector('[data-action="create-group"]')?.addEventListener('click', () => this.createGroup());
    this.querySelector('[data-action="new-marker"]')?.addEventListener('click', () => this.onNewMarker());
  }
}

customElements.define('ntrloc-access-old', NtrlocAccessOld);
