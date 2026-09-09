// Perspective-based Access screen (User / Group / Item Type) -- see the design work in the
// "Access Hierarchy Concept" wireframe this ports from. Superseded the old group-centric
// ntrloc-access-old/ screen, since removed.
//
// Group nesting note: the schema (security_group_member_group) technically allows a group to have
// more than one parent, but this UI only ever offers a single parent picker (see the backend's own
// GroupView.parentIds comment) -- parentIdOf() below always takes just the first entry, which is
// all a group created or reparented through this screen will ever have.
injectStyles('ntrloc-access-styles', `
  ntrloc-access[data-route].current {
    flex-direction: column;
  }
  ntrloc-access {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .axs-perspective-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .axs-pb-label {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    margin-right: 4px;
  }
  .axs-perspective-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .axs-perspective-btn:hover { border-color: var(--accent); }
  .axs-perspective-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .axs-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .axs-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-style: italic;
  }

  /* Directory (sidebar) */
  .axs-directory {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .axs-directory-top {
    padding: 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .axs-btn-block {
    width: 100%;
    background: none;
    border: 1px dashed var(--border);
    color: var(--muted);
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .axs-btn-block:hover { color: var(--accent); border-color: var(--accent); }
  .axs-directory-search {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .axs-directory-search input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  .axs-directory-list {
    flex: 1;
    overflow-y: auto;
  }
  .axs-directory-empty {
    padding: 24px 16px;
    color: var(--muted);
    font-size: 14px;
    text-align: center;
  }
  .axs-directory-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    border-left: 2px solid transparent;
  }
  .axs-directory-item:hover { background: var(--panel-bg); }
  .axs-directory-item.selected {
    background: var(--panel-bg);
    border-left-color: var(--accent);
  }
  .axs-directory-item.selected .axs-directory-item-name { color: var(--accent); font-weight: 600; }
  .axs-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--border);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .axs-directory-item-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    overflow: hidden;
  }
  .axs-directory-item-name {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .axs-directory-item-sub {
    font-size: 14px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .axs-badge-admin {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #1a1a1a;
    background: #e8a735;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Group hierarchy tree + "people reached" split (Group perspective's sidebar only) */
  .axs-directory-split {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .axs-directory-split .axs-directory-list {
    flex: 1 1 50%;
    min-height: 0;
  }
  .axs-directory-members {
    flex: 1 1 50%;
    min-height: 0;
    overflow-y: auto;
    border-top: 1px solid var(--border);
  }
  .axs-directory-section-title {
    padding: 10px 12px 6px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--muted);
  }
  .axs-tree-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    cursor: pointer;
    border-left: 2px solid transparent;
    white-space: nowrap;
  }
  .axs-tree-row:hover { background: var(--panel-bg); }
  .axs-tree-row.selected { background: var(--panel-bg); border-left-color: var(--accent); }
  .axs-tree-row.selected .axs-tree-label { color: var(--accent); font-weight: 600; }
  /* inline-flex + centered content, with height explicitly matching width, so the box is a true
     square and its visual center coincides with the glyph's own center -- without that, rotating
     90deg (the .open state, pointing down) spins around whatever the browser's default line-box
     height happens to be, which rarely matches the glyph's own bounding box, so the rotated glyph
     visibly jumps toward the top of the row instead of staying put. */
  .axs-disclosure {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1;
    transition: transform 0.15s ease;
    cursor: pointer;
  }
  .axs-disclosure.open { transform: rotate(90deg); }
  .axs-disclosure.leaf { visibility: hidden; }
  /* Every real hierarchy tree in this file (Group perspective's own sidebar, the User/Group
     Permissions tabs' item-type tree, the Group grants tree, the User perspective's own Groups-tab
     tree) uses this size for visual consistency -- .axs-disclosure's own base size stays small
     because it's also reused as a pure alignment spacer for genuinely flat, non-hierarchical lists
     (a marker chip row, a plain user row) that have no chevron to show at all. */
  .axs-disclosure-lg { width: 18px; height: 18px; font-size: 16px; }
  .axs-tree-icon-group {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: rgba(74, 158, 255, 0.15);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .axs-tree-label { font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
  .axs-tree-count { margin-left: auto; color: var(--muted); font-size: 14px; flex-shrink: 0; }
  .axs-badge-default {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    color: white;
    background: var(--accent);
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .axs-tree-children.collapsed { display: none; }
  .axs-tree-icon-itemtype {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--panel-bg);
    border: 1px solid var(--border);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .axs-marker-chip-row { padding: 4px 12px 4px 34px; }
  .axs-marker-chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 14px;
    border: 1px solid var(--border);
    color: var(--muted);
    cursor: pointer;
  }
  .axs-marker-chip:hover { border-color: var(--accent); color: var(--text); }
  .axs-marker-chip.selected {
    border-color: var(--accent);
    background: rgba(74, 158, 255, 0.15);
    color: var(--accent);
    font-weight: 600;
  }

  /* Detail pane */
  .axs-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .axs-empty-hint {
    padding: 40px 24px;
    color: var(--muted);
    font-style: italic;
    text-align: center;
  }
  .axs-detail-header {
    padding: 20px 24px 0 24px;
    flex-shrink: 0;
  }
  .axs-detail-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .axs-detail-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .axs-detail-title-row h1 {
    margin: 0;
    font-size: 20px;
  }
  .axs-type-pill {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--panel-bg);
    color: var(--muted);
  }
  .axs-type-pill.axs-pill-admin {
    background: #e8a735;
    color: #1a1a1a;
  }
  .axs-detail-sub {
    color: var(--muted);
    font-size: 14px;
    margin-top: 4px;
  }
  .axs-detail-actions {
    margin-top: 6px;
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .axs-detail-actions input[type="text"] {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  /* Action buttons (Edit/Delete/Rename/Move/etc.) for the User/Group/Item Type perspectives' own
     detail headers -- sits as the right-hand side of .axs-detail-title-row (space-between), so the
     name and its buttons share one row, vertically aligned. Distinct from .axs-detail-actions,
     which stays as the inline text-link style used inside the Permissions tab's grant detail pane. */
  .axs-detail-actions-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .axs-detail-actions-bar input[type="text"] {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  .axs-tabs {
    display: flex;
    gap: 4px;
    margin-top: 16px;
    border-bottom: 1px solid var(--border);
  }
  .axs-tab {
    padding: 8px 4px;
    margin-right: 20px;
    cursor: pointer;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    font-size: 14px;
  }
  .axs-tab:hover { color: var(--text); }
  .axs-tab.active {
    color: var(--text);
    font-weight: 600;
    border-bottom-color: var(--accent);
  }
  .axs-tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  .axs-section-label {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .axs-section {
    margin-bottom: 28px;
  }
  .axs-add-link {
    text-transform: none;
    letter-spacing: 0;
    color: var(--accent);
    cursor: pointer;
    font-size: 14px;
  }
  .axs-add-link:hover { text-decoration: underline; }

  .axs-profile-table { border-collapse: collapse; font-size: 14px; }
  .axs-profile-table td { padding: 5px 0; }
  .axs-profile-table td:first-child { color: var(--muted); width: 130px; }

  .axs-inline-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
  }
  .axs-inline-row input {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }

  /* User perspective's Groups tab -- tree of the user's own groups (and their ancestors) on the
     left, "who else is reached by whichever group is selected" on the right. Same bordered-box
     pairing the Item Type perspective's own two-box layout will eventually use. */
  .axs-user-groups-split {
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }
  .axs-user-groups-tree,
  .axs-user-groups-reach {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    max-height: 320px;
    overflow-y: auto;
  }
  .axs-user-groups-tree { width: 320px; flex-shrink: 0; }
  .axs-user-groups-reach { flex: 1; min-width: 0; }

  .axs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .axs-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--muted);
    font-size: 14px;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .axs-table td {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  .axs-table td.axs-perm-cell {
    width: 70px;
  }

  /* Checkmark-toggle, ported from ntrloc-access-old.js's own .perm-check for visual consistency
     between the old and new Access screens' permission grids -- a button when interactive (click
     toggles it, no re-render needed, see the [data-grant-field] handler), a span when read-only. */
  .axs-perm-check {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    color: transparent;
    background: none;
    padding: 0;
    font-family: inherit;
  }
  span.axs-perm-check { cursor: default; }
  .axs-perm-check.granted {
    background: rgba(74, 158, 255, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }
  /* Checked via inheritance only (not owned directly here) -- same checkmark, dimmed. */
  .axs-perm-check.dim { opacity: 0.5; }
  /* OBJECT-container bulk toggle only (see bulkPermCheckHtml): some but not all descendant
     leaves have this field granted directly. */
  .axs-perm-check.partial {
    background: rgba(74, 158, 255, 0.08);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Redundancy warning badge (wireframe's shadowWarnIcon): "up" when this own grant is also
     inherited from an ancestor (redundant, no additional effect); "down" when a descendant group
     redundantly re-grants something this group already grants directly. Shown in edit mode too,
     live-toggled by the [data-grant-field] click handler as "own" flips -- the whole point is to
     warn before an admin saves a redundant grant, not after, so they don't have to immediately
     re-edit and revert it. The [hidden] rule below is required: the hidden attribute alone is just
     a plain attribute selector, so without an explicit override here our own inline-flex display
     (same specificity, later in the cascade) would beat the UA stylesheet's hidden-hides-it rule. */
  .axs-shadow-warn {
    display: inline-flex;
    color: #c33;
    flex-shrink: 0;
    cursor: default;
    margin-left: 4px;
    vertical-align: middle;
  }
  .axs-shadow-warn[hidden] { display: none; }
  .axs-shadow-warn.down svg { transform: rotate(180deg); }

  /* --- Item Type perspective: marker grants (Group grants / User grants / Grant details) --- */
  .axs-grant-layout {
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }
  .axs-grant-left {
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex-shrink: 0;
    width: 300px;
  }
  .axs-grant-block-title {
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--muted);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .axs-grant-list {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
  }

  /* Group perspective's Permissions tab: "Granted markers" (this group's own grants only) vs "All
     markers" (the whole schema, so an admin can navigate to something not yet granted) -- ported
     from the wireframe's marker-scope-toggle. */
  .axs-perm-mode-toggle {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .axs-perm-mode-toggle label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
    cursor: pointer;
  }
  .axs-perm-mode-toggle input[type="radio"] { accent-color: var(--accent); cursor: pointer; }
  .axs-grant-detail-pane { flex: 1; min-width: 0; }
  .axs-grant-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .axs-grant-detail-header .name { font-size: 15px; font-weight: 700; }
  .axs-itemcap-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .axs-itemcap-label { font-size: 14px; font-weight: 600; width: 60px; flex-shrink: 0; }

  .axs-gt-wrap { margin-bottom: 16px; }
  .axs-gt-wrap:last-child { margin-bottom: 0; }
  .axs-gt-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 6px; }
  .axs-gt-subblock { margin: 10px 0 0 24px; padding-top: 10px; border-top: 1px dashed var(--border); }
  .axs-gt-subblock-label { display: block; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); margin-bottom: 6px; }
  .axs-gt-grid-scroll { overflow-x: auto; max-width: 100%; }
  .axs-gt-grid { display: grid; gap: 3px 10px; align-items: center; width: 100%; }
  .axs-gt-row { display: contents; }
  .axs-gt-header { font-size: 14px; color: var(--muted); font-weight: 700; letter-spacing: 0.03em; padding-bottom: 5px; border-bottom: 1px solid var(--border); text-align: left; }
  .axs-gt-name-cell { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .axs-gt-cell { text-align: left; }
  .axs-gt-dash { color: var(--border); font-size: 14px; }

  .axs-transitions-grid { display: grid; grid-template-columns: minmax(90px,1fr) minmax(90px,1fr) minmax(90px,1fr) 54px; gap: 3px 10px; align-items: center; width: 100%; }
  .axs-transitions-grid .tr-row { display: contents; }
  .axs-transitions-grid .tr-header { font-size: 14px; color: var(--muted); font-weight: 700; letter-spacing: 0.03em; padding-bottom: 5px; border-bottom: 1px solid var(--border); text-align: left; }
  .axs-transitions-grid .tr-header.tr-verb { text-align: left; }
  .axs-transitions-grid .tr-cell { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .axs-token-reveal {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--bg);
  }
  .axs-token-reveal code {
    display: block;
    font-size: 14px;
    word-break: break-all;
    user-select: all;
    margin-bottom: 4px;
  }
  .axs-token-reveal-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .axs-token-reveal .hint { font-size: 14px; color: var(--muted); }

  /* Brief success feedback (see toast()) -- re-created on every render while visible (this.
     innerHTML is fully replaced each time, not patched), so no entrance transition is attempted;
     it just appears and auto-dismisses after a few seconds via that same method's own timer. */
  .axs-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--panel-bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    z-index: 1000;
    max-width: 480px;
    text-align: center;
  }

  .axs-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .axs-btn-primary { background: var(--accent); color: white; }
  .axs-btn-danger { background: #c33; color: white; }
  .axs-btn-danger:hover { background: #a22; }
  .axs-btn-cancel { background: var(--border); color: var(--text); }

  .axs-error {
    color: #e55;
    font-size: 14px;
    margin-bottom: 10px;
  }

  /* Membership tab grids (Group perspective) */
  .axs-user-grid {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .axs-user-grid-header,
  .axs-user-grid-row {
    display: grid;
    grid-template-columns: 1.3fr 1.2fr 70px 100px;
    gap: 8px;
    padding: 8px 12px;
    align-items: center;
  }
  .axs-user-grid-header {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }
  .axs-user-grid-row + .axs-user-grid-row { border-top: 1px solid var(--border); }
  .axs-user-grid-cell-name { font-size: 14px; font-weight: 500; }
  .axs-user-grid-cell-sub { font-size: 14px; color: var(--muted); }
  .axs-admin-chip {
    display: inline-block;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    color: #1a1a1a;
    background: #e8a735;
    padding: 2px 6px;
    border-radius: 999px;
  }

  /* Add User / Add Group / etc. modals -- same plain-overlay idiom as ntrloc-users.js's
     .user-modal (not shared, each component names its own to avoid cross-component CSS
     coupling). */
  .axs-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .axs-modal {
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 420px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  .axs-modal-header {
    padding: 18px 20px;
    border-bottom: 1px solid var(--border);
    font-size: 16px;
    font-weight: 600;
  }
  .axs-modal-body { padding: 18px 20px; }
  .axs-modal-body label {
    font-size: 14px;
    color: var(--muted);
    display: block;
    margin-bottom: 4px;
  }
  .axs-modal-body input:not([type="checkbox"]),
  .axs-modal-body select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    margin-bottom: 12px;
  }
  .axs-modal-body p { font-size: 14px; margin: 0; }
  .axs-modal-checkboxes {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .axs-modal-checkboxes label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    padding: 4px 0;
  }
  .axs-modal-footer {
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
`);

class NtrlocAccess extends HTMLElement {
  constructor() {
    super();
    this.perspective = 'user'; // 'user' | 'group' | 'itemtype'

    // --- User perspective ---
    this.users = [];
    this.userFilterText = '';
    this.selectedUserId = null;
    this.activeTab = 'details'; // 'details' | 'groups' | 'permissions'
    this.tokens = [];
    this.createdToken = null;
    this.resetPasswordOpen = false;
    this.userGroups = []; // the selected user's own DIRECT group memberships
    this.userGroupTreeSelectedId = null; // which group is selected in the Groups tab's own tree
    this.userGroupTreeMembers = []; // direct members of that selection
    this.userGroupTreeSubgroupMembers = []; // [{user, viaGroupId}] for that selection

    // --- Group perspective ---
    this.groups = [];
    this.groupFilterText = '';
    this.selectedGroupId = null;
    this.closedGroupNodes = new Set(); // group ids whose children are collapsed (default open)
    this.groupActiveTab = 'membership'; // 'membership' | 'permissions'
    this.groupMembers = []; // direct members of the selected group
    this.subgroupMembers = []; // [{user, viaGroupId}] direct members of every descendant group
    this.groupMembershipFilter = '';
    this.groupRenaming = false;
    this.addGroupMembersFilter = '';
    this.groupError = '';

    // --- Group & User perspectives: Permissions tab -- the reverse lens on the Item Type
    // perspective's marker/type-level grant views (there the principal varies and the marker/
    // item-type is fixed; here one fixed principal, group or user, is browsed to whichever marker/
    // item-type the admin wants). Shared between both perspectives -- see enterPermissionsTab's
    // own comment for why. Reuses selectedItemTypeId/selectedMarkerId/grantSelection/grantOwn/
    // grantInherited/etc. from the Item Type perspective's own state below.
    this.permMode = null; // 'granted' | 'all' -- null until enterPermissionsTab picks a default
    this.permMarkerIds = null; // Set<markerId> this principal has its own marker_grant row for; null until fetched
    this.permTypeLevelItemTypeIds = null; // Set<itemTypeId> this principal has any type-level grant on
    // User perspective only: [{ principal: {kind,id,name}, markerIds: Set, typeIds: Set }, ...] --
    // principal[0] is the user themselves (name: null), the rest are their reach groups. Folds
    // into "Granted markers" mode's union (a user with zero direct grants but real group access
    // should still see a populated list) and drives selectGrantPrincipal's own/inherited-via-
    // groups computation for a 'user' selection; stays null for the Group perspective (a group's
    // own linear ancestor chain is already fully handled by the existing ancestorChain logic).
    this.userReachContributions = null;

    // --- Item Type perspective ---
    this.itemTypes = [];
    this.markers = [];
    this.itemTypeFilterText = '';
    this.selectedItemTypeId = null;
    this.selectedMarkerId = null;
    this.closedItemTypeNodes = new Set(); // item type ids whose marker list is collapsed (default open)

    // --- Item Type perspective: grants (Group grants / User grants / Grant details), shared by
    // both the type-level view (an item type row selected, no marker) and the marker-grants view
    // (a marker chip selected) -- selectedMarkerId being null/non-null is what distinguishes them. ---
    this.schema = null; // cached AdminSchemaView (properties/links/state machines), loaded lazily via globalSchemaModel
    this.grantPrincipals = { groups: [], users: [] }; // who has their own grant row for the current target (marker, or item type's type-level grant)
    this.grantSelection = null; // { kind: 'group'|'user', id } -- selected row in the Group/User grants lists
    this.grantEditing = false; // whether the detail pane's checkboxes are live (editing "own") vs read-only (showing "own" unioned with inherited)
    this.grantUsersPanelReach = { direct: [], nested: [] }; // direct+nested members of the selected group, shown under its own grant
    this.userGrantModalFilterText = '';
    // Marker-grant target: six categories merged into one object each.
    this.grantOwn = null; // the selection's own grant, or an all-false one if it has no row yet
    this.grantInherited = null; // union of every ancestor GROUP's own grant (groups only; all-false for a user) -- never includes the selection's own row
    // Same shape as grantOwn/grantInherited, but each leaf holds an array of contributing group
    // names instead of a boolean -- used only for the redundancy-warning badge's tooltip text.
    // grantInheritedNames: which ancestor(s) also grant this leaf (shown regardless of this
    // principal's own value). grantShadowNames: which descendant(s) redundantly re-grant a leaf
    // this principal already owns directly (only populated for leaves where own is true).
    this.grantInheritedNames = null;
    this.grantShadowNames = null;
    // Type-level target: just the two item-type:read/create booleans, same own/inherited split.
    this.typeLevelGrantOwn = null;
    this.typeLevelGrantInherited = null;
    this.typeLevelGrantInheritedNames = null;
    this.typeLevelGrantShadowNames = null;

    this.modal = null; // { type, ...context } | null
    this.error = '';

    this.toastMessage = null; // brief success feedback after a mutating action; null = hidden
    this.toastTimeoutId = null;
  }

  // Brief success feedback after a mutating action (create/save/delete/etc.) -- auto-dismisses
  // after a few seconds. A second toast while one is showing just replaces the message and resets
  // the dismiss timer, rather than stacking multiple toasts.
  toast(message) {
    this.toastMessage = message;
    if (this.toastTimeoutId) clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage = null;
      this.toastTimeoutId = null;
      this.render();
    }, 3000);
    this.render();
  }

  connectedCallback() {
    this.bootstrap();
  }

  async bootstrap() {
    await Promise.all([this.fetchUsers(), this.fetchGroups(), this.fetchItemTypes(), this.fetchMarkers()]);
    if (!this.selectedUserId && this.users.length) this.selectedUserId = this.sortedUsers()[0].id;
    if (!this.selectedGroupId && this.groups.length) {
      const fallback = this.groups.find(g => this.isDefaultGroup(g)) || this.rootGroups()[0];
      this.selectedGroupId = fallback ? fallback.id : null;
    }
    if (!this.selectedItemTypeId && this.itemTypes.length) this.selectedItemTypeId = this.sortedItemTypes()[0].id;
    this.render();
    await Promise.all([
      this.selectedUserId ? this.fetchUserTokens() : Promise.resolve(),
      this.selectedUserId ? this.fetchUserGroups() : Promise.resolve(),
      this.selectedGroupId ? this.loadGroupMembership() : Promise.resolve(),
      this.selectedItemTypeId ? this.selectItemType(this.selectedItemTypeId) : Promise.resolve(),
    ]);
    this.render();
  }

  // Group membership can change from either perspective (User's Groups-tab Edit modal, or
  // Group's own Membership tab) -- each perspective only refreshes its own cached member lists
  // on its own mutations, so a perspective switch re-fetches whatever the other one changed
  // rather than showing stale membership until the next unrelated mutation forces a re-fetch.
  async switchPerspective(perspective) {
    this.perspective = perspective;
    this.render();
    if (perspective === 'group' && this.selectedGroupId) {
      await this.loadGroupMembership();
      this.render();
    } else if (perspective === 'user' && this.selectedUserId) {
      await this.fetchUserGroups();
      if (this.activeTab === 'groups') await this.enterGroupsTab();
      else this.render();
    } else if (perspective === 'itemtype' && this.selectedItemTypeId) {
      await this.fetchGrantPrincipals();
      if (this.grantSelection) await this.selectGrantPrincipal(this.grantSelection.kind, this.grantSelection.id);
      else this.render();
    }
  }

  // =========================================================================
  // User perspective
  // =========================================================================

  sortedUsers() {
    return [...this.users].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  filteredUsers() {
    const filter = this.userFilterText.trim().toLowerCase();
    const sorted = this.sortedUsers();
    if (!filter) return sorted;
    return sorted.filter(u =>
      u.displayName.toLowerCase().includes(filter) ||
      u.externalId.toLowerCase().includes(filter) ||
      (u.email || '').toLowerCase().includes(filter)
    );
  }

  selectedUser() {
    return this.users.find(u => u.id === this.selectedUserId) || null;
  }

  async fetchUsers() {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) this.users = await res.json();
    } catch (e) { /* best effort */ }
  }

  async selectUser(userId) {
    this.selectedUserId = userId;
    this.perspective = 'user';
    this.activeTab = 'details';
    this.tokens = [];
    this.createdToken = null;
    this.resetPasswordOpen = false;
    this.userGroups = [];
    this.userGroupTreeSelectedId = null;
    this.userGroupTreeMembers = [];
    this.userGroupTreeSubgroupMembers = [];
    this.error = '';
    this.permMode = null;
    this.permMarkerIds = null;
    this.permTypeLevelItemTypeIds = null;
    this.userReachContributions = null;
    await Promise.all([this.fetchUserTokens(), this.fetchUserGroups()]);
    this.render();
  }

  async fetchUserGroups() {
    this.userGroups = await this.fetchDirectGroupsForUser(this.selectedUserId);
  }

  // Pure fetch, no state mutation -- unlike fetchUserGroups (which is hardwired to
  // this.selectedUserId and writes this.userGroups), this can be called for an arbitrary user
  // without disturbing the User perspective's own Groups-tab state. Needed by userReachGroups,
  // which may run for a user that isn't the User perspective's current selection at all (e.g. a
  // user browsed from the Item Type perspective's own User grants list).
  async fetchDirectGroupsForUser(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/groups`, { credentials: 'include' });
      return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  // Every group a user is directly in, plus every ancestor of those groups, deduplicated -- the
  // full set of groups whose own grants can affect this user (membership flows up the tree: a
  // direct member of a descendant is, by that same fact, a member of every ancestor too). Returns
  // full group objects (from this.groups, already loaded) rather than the bare id/name pairs
  // fetchDirectGroupsForUser returns, since callers need .id for further fetches.
  // Returned nearest-to-user first (each direct group, then its own ancestors nearest-first) --
  // ancestorChain itself is root-first, so its slice has to be walked backwards here to get that
  // order right. Matters for the User Permissions tab's origin tree, where this ordering is what
  // the admin actually sees (Direct, then "via <nearest group>", ..., "via <farthest ancestor>").
  async userReachGroups(userId) {
    const direct = await this.fetchDirectGroupsForUser(userId);
    const reach = new Map();
    for (const d of direct) {
      const g = this.groups.find(x => x.id === d.id);
      if (g) reach.set(g.id, g);
      const ancestors = this.ancestorChain(d.id);
      for (let i = ancestors.length - 1; i >= 0; i--) reach.set(ancestors[i].id, ancestors[i]);
    }
    return [...reach.values()];
  }

  // Every group the selected user is directly in, plus every ancestor of those groups -- the
  // pruned hierarchy the Groups tab's own tree shows (so you can see how far up the tree goes
  // without listing every unrelated group in the system).
  relevantGroupIdsForUser() {
    const relevant = new Set();
    for (const g of this.userGroups) {
      relevant.add(g.id);
      for (const a of this.ancestorChain(g.id)) relevant.add(a.id);
    }
    return relevant;
  }

  // Switching to the Groups tab needs its own tree selection (defaulting to one of the user's own
  // direct groups) and that selection's member "reach" -- both lazy, since Details is the default
  // tab and most visits never need this fetched at all.
  async enterGroupsTab() {
    this.activeTab = 'groups';
    const relevant = this.relevantGroupIdsForUser();
    if (!this.userGroupTreeSelectedId || !relevant.has(this.userGroupTreeSelectedId)) {
      const direct = this.userGroups.find(g => relevant.has(g.id));
      this.userGroupTreeSelectedId = direct ? direct.id : ([...relevant][0] || null);
    }
    this.render();
    if (this.userGroupTreeSelectedId) {
      const { direct, nested } = await this.fetchGroupReach(this.userGroupTreeSelectedId);
      this.userGroupTreeMembers = direct;
      this.userGroupTreeSubgroupMembers = nested;
    } else {
      this.userGroupTreeMembers = [];
      this.userGroupTreeSubgroupMembers = [];
    }
    this.render();
  }

  async selectUserGroupTreeNode(groupId) {
    this.userGroupTreeSelectedId = groupId;
    this.render();
    const { direct, nested } = await this.fetchGroupReach(groupId);
    this.userGroupTreeMembers = direct;
    this.userGroupTreeSubgroupMembers = nested;
    this.render();
  }

  async submitEditMembership() {
    const u = this.selectedUser();
    const checkedIds = new Set([...this.querySelectorAll('.axs-modal-checkboxes input[type="checkbox"]:checked')].map(cb => cb.value));
    const defaultId = this.groups.find(g => this.isDefaultGroup(g))?.id;
    if (defaultId) checkedIds.add(defaultId);
    const currentIds = new Set(this.userGroups.map(g => g.id));
    const toAdd = [...checkedIds].filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !checkedIds.has(id));
    try {
      await Promise.all([
        ...toAdd.map(groupId => fetch(`/api/admin/groups/${groupId}/members`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ userId: u.id })
        })),
        ...toRemove.map(groupId => fetch(`/api/admin/groups/${groupId}/members/${u.id}`, { method: 'DELETE', credentials: 'include' })),
      ]);
      this.modal = null;
      this.error = '';
      await Promise.all([this.fetchUserGroups(), this.fetchGroups()]);
      if (this.activeTab === 'groups') await this.enterGroupsTab(); else this.render();
      this.toast(`Updated ${u.displayName}'s group membership.`);
    } catch (e) { this.error = e.message; this.render(); }
  }

  async fetchUserTokens() {
    try {
      const res = await fetch(`/api/admin/users/${this.selectedUserId}/tokens`, { credentials: 'include' });
      this.tokens = res.ok ? await res.json() : [];
    } catch (e) { this.tokens = []; }
  }

  async createToken() {
    const name = this.querySelector('[name="token-name"]')?.value.trim();
    const days = parseInt(this.querySelector('[name="token-days"]')?.value, 10) || null;
    if (!name) { this.error = 'Token name is required.'; this.render(); return; }
    try {
      const res = await fetch(`/api/admin/users/${this.selectedUserId}/tokens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name, expiresInDays: days })
      });
      if (!res.ok) throw new Error('Failed to create token.');
      this.createdToken = await res.json();
      this.error = '';
      this.modal = { type: 'token-reveal' };
      await this.fetchUserTokens();
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  // The token is only ever readable while this modal is open -- closing it (button, backdrop
  // click, or revoking the token from underneath it) clears createdToken so it can never be
  // shown again, forcing the admin to generate a new one if they lost the copy.
  closeTokenRevealModal() {
    this.createdToken = null;
    this.modal = null;
    this.render();
  }

  async revokeToken(tokenId) {
    try {
      const revoked = this.tokens.find(t => t.id === tokenId);
      await fetch(`/api/admin/users/${this.selectedUserId}/tokens/${tokenId}`, { method: 'DELETE', credentials: 'include' });
      this.createdToken = null;
      await this.fetchUserTokens();
      this.toast(revoked ? `Revoked token "${revoked.name}".` : 'Revoked token.');
    } catch (e) { this.error = e.message; this.render(); }
  }

  // navigator.clipboard requires a secure context (https, or localhost) -- falls back to a plain
  // message telling the admin to select and copy manually rather than failing silently.
  async copyCreatedToken() {
    if (!this.createdToken) return;
    try {
      await navigator.clipboard.writeText(this.createdToken.token);
      this.toast('Token copied to clipboard.');
    } catch (e) {
      this.toast('Could not copy automatically — select and copy the value manually.');
    }
  }

  async resetPassword() {
    const input = this.querySelector('[name="new-password"]');
    const pw = input?.value.trim();
    if (!pw) { this.error = 'Password is required.'; this.render(); return; }
    try {
      const res = await fetch(`/api/admin/users/${this.selectedUserId}/password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ newPassword: pw })
      });
      if (!res.ok) throw new Error('Failed to reset password.');
      this.resetPasswordOpen = false;
      this.error = '';
      this.render();
    } catch (e) { this.error = e.message; this.render(); }
  }

  async createUser() {
    const get = name => this.querySelector(`[name="${name}"]`)?.value.trim();
    const body = {
      externalId: get('externalId'), displayName: get('displayName'),
      email: get('email'), password: get('password'), role: get('role'),
    };
    if (!body.externalId || !body.displayName || !body.password) {
      this.error = 'Username, display name, and password are required.';
      this.render();
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body)
      });
      if (res.status === 409) throw new Error('A user with that username already exists.');
      if (!res.ok) throw new Error('Failed to create user.');
      const user = await res.json();
      this.modal = null;
      this.error = '';
      await this.fetchUsers();
      await this.selectUser(user.id);
      this.toast(`Created user "${user.displayName}".`);
    } catch (e) { this.error = e.message; this.render(); }
  }

  async submitEditUser() {
    const userId = this.modal.userId;
    const get = name => this.querySelector(`[name="${name}"]`)?.value.trim();
    const body = {
      externalId: get('externalId'), displayName: get('displayName'),
      email: get('email'), role: get('role'),
    };
    if (!body.externalId || !body.displayName) {
      this.error = 'Username and display name are required.';
      this.render();
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body)
      });
      if (res.status === 409) throw new Error('A user with that username already exists.');
      if (!res.ok) throw new Error((await res.text()) || 'Failed to update user.');
      this.modal = null;
      this.error = '';
      await this.fetchUsers();
      this.render();
      this.toast(`Saved changes to "${body.displayName}".`);
    } catch (e) { this.error = e.message; this.render(); }
  }

  async submitDeleteUser() {
    const userId = this.modal.userId;
    const deleted = this.users.find(u => u.id === userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || 'Failed to delete user.');
      this.modal = null;
      this.error = '';
      await this.fetchUsers();
      if (this.selectedUserId === userId) this.selectedUserId = null;
      this.render();
      this.toast(deleted ? `Deleted user "${deleted.displayName}".` : 'Deleted user.');
    } catch (e) { this.error = e.message; this.render(); }
  }

  // =========================================================================
  // Group perspective
  // =========================================================================

  isDefaultGroup(g) { return g.name === 'everyone'; }

  // A group's single parent, per this UI's own restricted use of the (technically multi-parent)
  // schema -- see this file's header comment.
  parentIdOf(g) { return (g.parentIds && g.parentIds[0]) || null; }

  childGroupsOf(groupId) {
    return this.groups.filter(g => this.parentIdOf(g) === groupId).sort((a, b) => a.name.localeCompare(b.name));
  }

  rootGroups() {
    return this.groups.filter(g => !this.parentIdOf(g)).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Root-first order (for breadcrumbs), not including groupId itself.
  ancestorChain(groupId) {
    const chain = [];
    const seen = new Set();
    let current = this.groups.find(g => g.id === groupId);
    while (current) {
      const parentId = this.parentIdOf(current);
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      const parent = this.groups.find(g => g.id === parentId);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }

  descendantGroupIds(groupId) {
    const result = [];
    const queue = [...this.childGroupsOf(groupId)];
    while (queue.length) {
      const g = queue.shift();
      result.push(g.id);
      queue.push(...this.childGroupsOf(g.id));
    }
    return result;
  }

  selectedGroup() {
    return this.groups.find(g => g.id === this.selectedGroupId) || null;
  }

  sortedGroupsForPicker() {
    return [...this.groups].sort((a, b) => a.name.localeCompare(b.name));
  }

  async fetchGroups() {
    try {
      const res = await fetch('/api/admin/groups', { credentials: 'include' });
      if (res.ok) this.groups = await res.json();
    } catch (e) { /* best effort */ }
  }

  async selectGroup(groupId) {
    this.selectedGroupId = groupId;
    this.perspective = 'group';
    this.groupActiveTab = 'membership';
    this.groupMembershipFilter = '';
    this.groupRenaming = false;
    this.groupError = '';
    this.permMode = null;
    this.permMarkerIds = null;
    this.permTypeLevelItemTypeIds = null;
    await this.loadGroupMembership();
    this.render();
  }

  async loadGroupMembership() {
    const { direct, nested } = await this.fetchGroupReach(this.selectedGroupId);
    this.groupMembers = direct;
    this.subgroupMembers = nested;
  }

  // Direct members of groupId, plus direct members of every descendant group (each tagged with the
  // specific descendant they came from so the UI can say "via <that group>") -- the full "blast
  // radius" reach used by both the Group perspective's own Membership tab/sidebar panel and the
  // User perspective's Groups tab tree below.
  //
  // A user is counted once, at the SHALLOWEST group where they're a direct member -- groupId
  // itself first, then its descendants in breadth-first order (descendantGroupIds already returns
  // that order). Membership flows up the tree (a direct member of a descendant is also, by that
  // same fact, a member of every ancestor), so someone who's redundantly a direct member of both
  // groupId and one of its descendants has exactly one membership worth showing, not one row per
  // path to them -- and in the common case where every user really is meant to be a direct member
  // of the group being displayed (e.g. "everyone"), this means nobody ever shows up a second time
  // "via" some subgroup. The same rule also resolves the case of two sibling descendants both
  // directly containing the same user: they're attributed to whichever sibling comes first in
  // that breadth-first order, not listed twice.
  async fetchGroupReach(groupId) {
    const fetchMembers = async (id) => {
      try {
        const res = await fetch(`/api/admin/groups/${id}/members`, { credentials: 'include' });
        return res.ok ? await res.json() : [];
      } catch (e) { return []; }
    };
    const levels = [groupId, ...this.descendantGroupIds(groupId)];
    const membersByLevel = await Promise.all(levels.map(fetchMembers));
    const seen = new Set();
    const direct = [];
    const nested = [];
    membersByLevel.forEach((members, i) => {
      for (const u of members) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        if (i === 0) direct.push(u);
        else nested.push({ user: u, viaGroupId: levels[i] });
      }
    });
    return { direct, nested };
  }

  async createGroup() {
    const name = this.querySelector('[name="group-name"]')?.value.trim();
    const parentGroupId = this.querySelector('[name="group-parent"]')?.value || null;
    if (!name) { this.groupError = 'Group name is required.'; this.render(); return; }
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name, parentGroupId })
      });
      if (res.status === 409) throw new Error('A group with that name already exists.');
      if (!res.ok) throw new Error('Failed to create group.');
      const group = await res.json();
      this.modal = null;
      this.groupError = '';
      if (parentGroupId) this.closedGroupNodes.delete(parentGroupId);
      await this.fetchGroups();
      await this.selectGroup(group.id);
      this.toast(`Created group "${group.name}".`);
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  startRenameGroup() {
    this.groupRenaming = true;
    this.groupError = '';
    this.render();
  }

  cancelRenameGroup() {
    this.groupRenaming = false;
    this.render();
  }

  async submitRenameGroup() {
    const name = this.querySelector('[name="rename-group"]')?.value.trim();
    if (!name) { this.groupError = 'Group name is required.'; this.render(); return; }
    try {
      const res = await fetch(`/api/admin/groups/${this.selectedGroupId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to rename group.');
      this.groupRenaming = false;
      this.groupError = '';
      await this.fetchGroups();
      this.render();
      this.toast(`Renamed group to "${name}".`);
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  async submitMoveGroup() {
    const groupId = this.modal.groupId;
    const parentGroupId = this.querySelector('[name="move-group-parent"]')?.value || null;
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/parent`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ parentGroupId })
      });
      if (!res.ok) throw new Error((await res.text()) || 'Failed to move group.');
      this.modal = null;
      this.groupError = '';
      if (parentGroupId) this.closedGroupNodes.delete(parentGroupId);
      const moved = this.groups.find(g => g.id === groupId);
      const parent = this.groups.find(g => g.id === parentGroupId);
      await this.fetchGroups();
      this.render();
      this.toast(parent ? `Moved "${moved?.name || 'group'}" into "${parent.name}".` : `Moved "${moved?.name || 'group'}" to the top level.`);
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  async submitDeleteGroup() {
    const groupId = this.modal.groupId;
    const deleted = this.groups.find(g => g.id === groupId);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || 'Failed to delete group.');
      this.modal = null;
      this.groupError = '';
      await this.fetchGroups();
      if (this.selectedGroupId === groupId) {
        const fallback = this.groups.find(g => this.isDefaultGroup(g)) || this.groups[0];
        if (fallback) {
          await this.selectGroup(fallback.id);
          this.toast(deleted ? `Deleted group "${deleted.name}".` : 'Deleted group.');
          return;
        }
        this.selectedGroupId = null;
      }
      this.render();
      this.toast(deleted ? `Deleted group "${deleted.name}".` : 'Deleted group.');
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  async submitAddGroupMembers() {
    const groupId = this.modal.groupId;
    const checkedIds = [...this.querySelectorAll('.axs-modal-checkboxes input[type="checkbox"]:checked')].map(cb => cb.value);
    if (!checkedIds.length) { this.groupError = 'No users selected.'; this.render(); return; }
    try {
      await Promise.all(checkedIds.map(userId => fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId })
      })));
      this.modal = null;
      this.groupError = '';
      const group = this.groups.find(g => g.id === groupId);
      await this.fetchGroups();
      await this.loadGroupMembership();
      this.render();
      this.toast(`Added ${checkedIds.length} member${checkedIds.length === 1 ? '' : 's'} to "${group?.name || 'group'}".`);
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  async submitRemoveMember() {
    const { userId, groupId } = this.modal;
    const user = this.users.find(u => u.id === userId);
    const group = this.groups.find(g => g.id === groupId);
    try {
      await fetch(`/api/admin/groups/${groupId}/members/${userId}`, { method: 'DELETE', credentials: 'include' });
      this.modal = null;
      this.groupError = '';
      await this.fetchGroups();
      await this.loadGroupMembership();
      this.render();
      this.toast(`Removed ${user?.displayName || 'user'} from "${group?.name || 'group'}".`);
    } catch (e) { this.groupError = e.message; this.render(); }
  }

  // =========================================================================
  // Item Type perspective
  // =========================================================================

  sortedItemTypes() {
    return [...this.itemTypes].sort((a, b) => a.name.localeCompare(b.name));
  }

  markersForItemType(itemTypeId) {
    return this.markers
      .filter(m => m.scopeKind === 'ITEM_TYPE' && m.scopeId === itemTypeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async fetchItemTypes() {
    try {
      const res = await fetch('/api/admin/schema/item-types', { credentials: 'include' });
      if (res.ok) this.itemTypes = await res.json();
    } catch (e) { /* best effort */ }
  }

  async fetchMarkers() {
    try {
      const res = await fetch('/api/admin/markers', { credentials: 'include' });
      if (res.ok) this.markers = await res.json();
    } catch (e) { /* best effort */ }
  }

  // Entering an item type's own type-level grants view (its row selected, no marker chip): same
  // Group grants / User grants / Members-of-group chrome as a marker's own view (see
  // enterMarkerGrants), just targeting item-type:read/create instead of a marker's six categories.
  async selectItemType(itemTypeId) {
    this.selectedItemTypeId = itemTypeId;
    this.selectedMarkerId = null;
    this.perspective = 'itemtype';
    this.grantSelection = null;
    this.typeLevelGrantOwn = null;
    this.typeLevelGrantInherited = null;
    this.typeLevelGrantInheritedNames = null;
    this.typeLevelGrantShadowNames = null;
    this.grantPrincipals = { groups: [], users: [] };
    this.render();
    await this.fetchTypeLevelGrantPrincipals(itemTypeId);
    const { groups, users } = this.grantPrincipals;
    if (groups.length) await this.selectGrantPrincipal('group', groups[0].id);
    else if (users.length) await this.selectGrantPrincipal('user', users[0].id);
    else this.render();
  }

  // Entering a marker's own detail view: who has it (groups with their own grant, pruned to
  // include their ancestors for hierarchy context, plus users with a direct grant), defaulting
  // the right-hand detail pane to the first group with an own grant, or else the first direct
  // user grant -- mirroring the wireframe's own default-selection order.
  async enterMarkerGrants(itemTypeId, markerId) {
    this.selectedItemTypeId = itemTypeId;
    this.selectedMarkerId = markerId;
    this.perspective = 'itemtype';
    this.grantSelection = null;
    this.grantOwn = null;
    this.grantInherited = null;
    this.grantInheritedNames = null;
    this.grantShadowNames = null;
    this.grantPrincipals = { groups: [], users: [] };
    this.render();
    await Promise.all([this.fetchSchema(), this.fetchMarkerGrantPrincipals(markerId)]);
    const { groups, users } = this.grantPrincipals;
    if (groups.length) await this.selectGrantPrincipal('group', groups[0].id);
    else if (users.length) await this.selectGrantPrincipal('user', users[0].id);
    else this.render();
  }

  async fetchSchema() {
    if (this.schema) return;
    try { this.schema = await globalSchemaModel.load(); } catch (e) { this.schema = { items: [], links: [] }; }
  }

  // Refreshes this.grantPrincipals for whichever target is currently selected (a marker, or an
  // item type's own type-level grants) -- used by switchPerspective so coming back to this
  // perspective always reflects whatever changed elsewhere in the meantime.
  async fetchGrantPrincipals() {
    if (this.selectedMarkerId) await this.fetchMarkerGrantPrincipals(this.selectedMarkerId);
    else await this.fetchTypeLevelGrantPrincipals(this.selectedItemTypeId);
  }

  async fetchMarkerGrantPrincipals(markerId) {
    try {
      const res = await fetch(`/api/admin/markers/${markerId}/grants`, { credentials: 'include' });
      this.grantPrincipals = res.ok ? await res.json() : { groups: [], users: [] };
    } catch (e) { this.grantPrincipals = { groups: [], users: [] }; }
  }

  async fetchTypeLevelGrantPrincipals(itemTypeId) {
    try {
      const res = await fetch(`/api/admin/schema/item-types/${itemTypeId}/grants`, { credentials: 'include' });
      this.grantPrincipals = res.ok ? await res.json() : { groups: [], users: [] };
    } catch (e) { this.grantPrincipals = { groups: [], users: [] }; }
  }

  emptyGrant() {
    return {
      itemRead: false, itemDelete: false,
      properties: new Map(), linkProperties: new Map(), linkPerspectives: new Map(),
      transitionIds: new Set(), stateMachineStartIds: new Set(),
    };
  }

  // Fetches one principal's own grant of the selected marker across all six categories in
  // parallel and folds them into the client-side shape emptyGrant() defines. A principal with no
  // marker_grant row at all still resolves cleanly here (every endpoint below defaults to "not
  // granted" rather than 404ing) -- hasOwnGrant is tracked separately via grantPrincipals.
  async fetchPrincipalMarkerGrant(kind, principalId, markerId) {
    const base = kind === 'group' ? `/api/admin/groups/${principalId}` : `/api/admin/users/${principalId}`;
    const getJson = async (path, fallback) => {
      try {
        const res = await fetch(`${base}${path}`, { credentials: 'include' });
        return res.ok ? await res.json() : fallback;
      } catch (e) { return fallback; }
    };
    const [item, props, linkProps, linkPersps, transitions, smStarts] = await Promise.all([
      getJson(`/markers/${markerId}/item-permissions`, { canRead: false, canDelete: false }),
      getJson(`/markers/${markerId}/properties`, []),
      getJson(`/markers/${markerId}/link-properties`, []),
      getJson(`/markers/${markerId}/link-perspectives`, []),
      getJson(`/markers/${markerId}/transitions`, []),
      getJson(`/markers/${markerId}/state-machines/start`, []),
    ]);
    return {
      itemRead: item.canRead, itemDelete: item.canDelete,
      properties: new Map(props.map(p => [p.propertyId, { read: p.canRead, write: p.canWrite }])),
      linkProperties: new Map(linkProps.map(p => [p.propertyId, { read: p.canRead, write: p.canWrite }])),
      linkPerspectives: new Map(linkPersps.map(p => [p.perspectiveId, { create: p.canCreate, read: p.canRead, delete: p.canDelete }])),
      transitionIds: new Set(transitions),
      stateMachineStartIds: new Set(smStarts),
    };
  }

  // OR-merges source's granted flags into target in place -- used to fold a group's ancestors'
  // own grants into one "effective" picture, the same union semantics the real enforcement path
  // (AuthorizationCacheManager) applies across every group a user belongs to.
  mergeGrantInto(target, source) {
    target.itemRead = target.itemRead || source.itemRead;
    target.itemDelete = target.itemDelete || source.itemDelete;
    for (const [k, v] of source.properties) {
      const e = target.properties.get(k) || { read: false, write: false };
      e.read = e.read || v.read; e.write = e.write || v.write;
      target.properties.set(k, e);
    }
    for (const [k, v] of source.linkProperties) {
      const e = target.linkProperties.get(k) || { read: false, write: false };
      e.read = e.read || v.read; e.write = e.write || v.write;
      target.linkProperties.set(k, e);
    }
    for (const [k, v] of source.linkPerspectives) {
      const e = target.linkPerspectives.get(k) || { create: false, read: false, delete: false };
      e.create = e.create || v.create; e.read = e.read || v.read; e.delete = e.delete || v.delete;
      target.linkPerspectives.set(k, e);
    }
    for (const id of source.transitionIds) target.transitionIds.add(id);
    for (const id of source.stateMachineStartIds) target.stateMachineStartIds.add(id);
  }

  // Fetches this principal's own type-level item-type:read/create grant for the selected item
  // type. Mirrors fetchPrincipalMarkerGrant but the shape is just two booleans -- there's no
  // marker_grant-style row to speak of, each operation is its own independent authorization_
  // item_type_grant row (see AccessAdminController's own comment on getOwnPermissions).
  async fetchPrincipalTypeLevelGrant(kind, principalId, itemTypeId) {
    const path = kind === 'group' ? `/api/admin/groups/${principalId}/permissions` : `/api/admin/users/${principalId}/permissions/own`;
    try {
      const res = await fetch(path, { credentials: 'include' });
      const list = res.ok ? await res.json() : [];
      const entry = list.find(p => p.itemTypeId === itemTypeId);
      const ops = entry ? entry.operations : [];
      return { read: ops.includes('item-type:read'), create: ops.includes('item-type:create') };
    } catch (e) { return { read: false, create: false }; }
  }

  // Selecting a group or user in the Group grants / User grants lists: fetches that principal's
  // own grant, and -- for a group -- also every ancestor's own grant kept as a *separate* "inherited"
  // object (not merged into one all-in-one "effective" picture) -- permCheckHtml needs both own and
  // inherited independently to render the dim-vs-bright distinction, not just whether either is
  // true. A user selection here is always a *direct* grant (see enterMarkerGrants/
  // grantPrincipals.users), so inherited stays all-false -- their group-derived access is what the
  // Group grants tree already shows.
  async selectGrantPrincipal(kind, id) {
    this.grantSelection = { kind, id };
    this.grantEditing = false;
    this.grantUsersPanelReach = { direct: [], nested: [] };
    const typeLevel = !this.selectedMarkerId;
    if (typeLevel) {
      this.typeLevelGrantOwn = null; this.typeLevelGrantInherited = null;
      this.typeLevelGrantInheritedNames = null; this.typeLevelGrantShadowNames = null;
    } else {
      this.grantOwn = null; this.grantInherited = null;
      this.grantInheritedNames = null; this.grantShadowNames = null;
    }
    this.render();

    if (typeLevel) {
      const itemTypeId = this.selectedItemTypeId;
      const own = await this.fetchPrincipalTypeLevelGrant(kind, id, itemTypeId);
      const inherited = { read: false, create: false };
      let inheritedNames = { read: [], create: [] };
      let shadowNames = { read: [], create: [] };
      if (kind === 'group') {
        const ancestors = this.ancestorChain(id);
        const ancestorGrants = await Promise.all(ancestors.map(a => this.fetchPrincipalTypeLevelGrant('group', a.id, itemTypeId)));
        ancestorGrants.forEach(g => { inherited.read = inherited.read || g.read; inherited.create = inherited.create || g.create; });
        const descendants = this.descendantGroupIds(id).map(did => this.groups.find(g => g.id === did)).filter(Boolean);
        const descendantGrants = await Promise.all(descendants.map(d => this.fetchPrincipalTypeLevelGrant('group', d.id, itemTypeId)));
        const { direct, nested } = await this.fetchGroupReach(id);
        this.grantUsersPanelReach = { direct, nested };
        inheritedNames = this.buildTypeLevelNameMap(own, ancestors.map((a, i) => ({ name: a.name, grant: ancestorGrants[i] })), false);
        shadowNames = this.buildTypeLevelNameMap(own, descendants.map((d, i) => ({ name: d.name, grant: descendantGrants[i] })), true);
      } else if (kind === 'user') {
        // A user's "inherited" is everything they get via their group memberships, transitively --
        // every group they're directly in, plus every ancestor of those (membership flows up, see
        // userReachGroups's own comment). No descendant/shadow concept for a user -- they have no
        // members of their own.
        const reachGroups = await this.userReachGroups(id);
        const reachGrants = await Promise.all(reachGroups.map(g => this.fetchPrincipalTypeLevelGrant('group', g.id, itemTypeId)));
        reachGrants.forEach(g => { inherited.read = inherited.read || g.read; inherited.create = inherited.create || g.create; });
        inheritedNames = this.buildTypeLevelNameMap(own, reachGroups.map((g, i) => ({ name: g.name, grant: reachGrants[i] })), false);
      }
      this.typeLevelGrantOwn = own;
      this.typeLevelGrantInherited = inherited;
      this.typeLevelGrantInheritedNames = inheritedNames;
      this.typeLevelGrantShadowNames = shadowNames;
    } else {
      const markerId = this.selectedMarkerId;
      const own = await this.fetchPrincipalMarkerGrant(kind, id, markerId);
      const inherited = this.emptyGrant();
      let inheritedNames = this.buildMarkerNameMap(own, [], false);
      let shadowNames = this.buildMarkerNameMap(own, [], false);
      if (kind === 'group') {
        const ancestors = this.ancestorChain(id);
        const ancestorGrants = await Promise.all(ancestors.map(a => this.fetchPrincipalMarkerGrant('group', a.id, markerId)));
        ancestorGrants.forEach(g => this.mergeGrantInto(inherited, g));
        const descendants = this.descendantGroupIds(id).map(did => this.groups.find(g => g.id === did)).filter(Boolean);
        const descendantGrants = await Promise.all(descendants.map(d => this.fetchPrincipalMarkerGrant('group', d.id, markerId)));
        const { direct, nested } = await this.fetchGroupReach(id);
        this.grantUsersPanelReach = { direct, nested };
        inheritedNames = this.buildMarkerNameMap(own, ancestors.map((a, i) => ({ name: a.name, grant: ancestorGrants[i] })), false);
        shadowNames = this.buildMarkerNameMap(own, descendants.map((d, i) => ({ name: d.name, grant: descendantGrants[i] })), true);
      } else if (kind === 'user') {
        // See the type-level branch's own comment -- same reach-groups concept, marker shape.
        const reachGroups = await this.userReachGroups(id);
        const reachGrants = await Promise.all(reachGroups.map(g => this.fetchPrincipalMarkerGrant('group', g.id, markerId)));
        reachGrants.forEach(g => this.mergeGrantInto(inherited, g));
        inheritedNames = this.buildMarkerNameMap(own, reachGroups.map((g, i) => ({ name: g.name, grant: reachGrants[i] })), false);
      }
      this.grantOwn = own;
      this.grantInherited = inherited;
      this.grantInheritedNames = inheritedNames;
      this.grantShadowNames = shadowNames;
    }
    this.render();
  }

  // Turns a list of {name, grant} source rows into a name-map mirroring emptyGrant()'s shape, but
  // each leaf holds an array of contributing group names instead of a boolean -- used only to
  // build the redundancy-warning badge's tooltip text (see permCheckHtml). Pass every ANCESTOR's
  // own grant with gateOnOwn=false to get "which ancestor(s) also grant this" (shown regardless of
  // this principal's own value -- the "up" badge). Pass every DESCENDANT's own grant with
  // gateOnOwn=true to get "which descendant(s) redundantly re-grant a leaf this principal already
  // owns" (the wireframe's rule for the "down" badge: a descendant re-granting something merely
  // inherited here, not owned, isn't a redundant pair with *this* group).
  buildMarkerNameMap(ownGrant, sourceGrants, gateOnOwn) {
    const map = {
      itemRead: [], itemDelete: [],
      properties: new Map(), linkProperties: new Map(), linkPerspectives: new Map(),
      transitionIds: new Map(), stateMachineStartIds: new Map(),
    };
    const include = (ownVal) => !gateOnOwn || ownVal;
    for (const { name, grant } of sourceGrants) {
      if (grant.itemRead && include(ownGrant.itemRead)) map.itemRead.push(name);
      if (grant.itemDelete && include(ownGrant.itemDelete)) map.itemDelete.push(name);
      for (const [k, v] of grant.properties) {
        const ov = ownGrant.properties.get(k) || { read: false, write: false };
        const entry = map.properties.get(k) || { read: [], write: [] };
        if (v.read && include(ov.read)) entry.read.push(name);
        if (v.write && include(ov.write)) entry.write.push(name);
        map.properties.set(k, entry);
      }
      for (const [k, v] of grant.linkProperties) {
        const ov = ownGrant.linkProperties.get(k) || { read: false, write: false };
        const entry = map.linkProperties.get(k) || { read: [], write: [] };
        if (v.read && include(ov.read)) entry.read.push(name);
        if (v.write && include(ov.write)) entry.write.push(name);
        map.linkProperties.set(k, entry);
      }
      for (const [k, v] of grant.linkPerspectives) {
        const ov = ownGrant.linkPerspectives.get(k) || { create: false, read: false, delete: false };
        const entry = map.linkPerspectives.get(k) || { create: [], read: [], delete: [] };
        if (v.create && include(ov.create)) entry.create.push(name);
        if (v.read && include(ov.read)) entry.read.push(name);
        if (v.delete && include(ov.delete)) entry.delete.push(name);
        map.linkPerspectives.set(k, entry);
      }
      for (const tid of grant.transitionIds) {
        if (include(ownGrant.transitionIds.has(tid))) {
          const arr = map.transitionIds.get(tid) || []; arr.push(name); map.transitionIds.set(tid, arr);
        }
      }
      for (const sid of grant.stateMachineStartIds) {
        if (include(ownGrant.stateMachineStartIds.has(sid))) {
          const arr = map.stateMachineStartIds.get(sid) || []; arr.push(name); map.stateMachineStartIds.set(sid, arr);
        }
      }
    }
    return map;
  }

  // Type-level counterpart of buildMarkerNameMap -- same gateOnOwn contract, just the two
  // item-type:read/create leaves instead of a marker's six categories.
  buildTypeLevelNameMap(ownGrant, sourceGrants, gateOnOwn) {
    const map = { read: [], create: [] };
    const include = (ownVal) => !gateOnOwn || ownVal;
    for (const { name, grant } of sourceGrants) {
      if (grant.read && include(ownGrant.read)) map.read.push(name);
      if (grant.create && include(ownGrant.create)) map.create.push(name);
    }
    return map;
  }

  itemTypeSchema(itemTypeId) {
    if (!this.schema) return null;
    return this.schema.items.find(i => i.id === itemTypeId) || null;
  }

  startGrantEdit() {
    this.grantEditing = true;
    this.render();
  }

  cancelGrantEdit() {
    this.grantEditing = false;
    this.render();
  }

  async saveGrantEdit() {
    if (this.selectedMarkerId) await this.saveMarkerGrantEdit();
    else await this.saveTypeLevelGrantEdit();
  }

  // Reads every [data-grant-field] toggle currently in the DOM (edit mode renders one for every
  // schema leaf regardless of current grant, so this always sees the complete picture) and commits
  // it in one batch: a PUT per upsert-style category (item/properties/link-properties/link-
  // perspectives, all idempotent), plus a POST or DELETE per existence-only category (transitions,
  // state-machine starts) -- those two are diffed against grantOwn first so an untouched leaf never
  // fires a needless request.
  async saveMarkerGrantEdit() {
    const { kind, id } = this.grantSelection;
    const markerId = this.selectedMarkerId;
    const base = kind === 'group' ? `/api/admin/groups/${id}` : `/api/admin/users/${id}`;
    const checked = {};
    this.querySelectorAll('[data-grant-field]').forEach(el => { checked[el.dataset.grantField] = el.dataset.granted === 'true'; });
    const putJson = (path, body) => fetch(`${base}${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
    });

    const calls = [putJson(`/markers/${markerId}/item-permissions`, {
      canRead: !!checked['item:read'], canDelete: !!checked['item:delete'],
    })];

    const propertyIds = new Set(), linkPropIds = new Set(), perspIds = new Set(), transitionIds = new Set(), smIds = new Set();
    for (const key of Object.keys(checked)) {
      const [category, entityId] = key.split(':');
      if (category === 'property') propertyIds.add(entityId);
      else if (category === 'linkprop') linkPropIds.add(entityId);
      else if (category === 'linkpersp') perspIds.add(entityId);
      else if (category === 'transition') transitionIds.add(entityId);
      else if (category === 'smstart') smIds.add(entityId);
    }
    for (const pid of propertyIds) {
      calls.push(putJson(`/markers/${markerId}/properties/${pid}`, { canRead: !!checked[`property:${pid}:read`], canWrite: !!checked[`property:${pid}:write`] }));
    }
    for (const pid of linkPropIds) {
      calls.push(putJson(`/markers/${markerId}/link-properties/${pid}`, { canRead: !!checked[`linkprop:${pid}:read`], canWrite: !!checked[`linkprop:${pid}:write`] }));
    }
    for (const pid of perspIds) {
      calls.push(putJson(`/markers/${markerId}/link-perspectives/${pid}`, {
        canCreate: !!checked[`linkpersp:${pid}:create`], canRead: !!checked[`linkpersp:${pid}:read`], canDelete: !!checked[`linkpersp:${pid}:delete`],
      }));
    }
    const origTransitions = this.grantOwn ? this.grantOwn.transitionIds : new Set();
    for (const tid of transitionIds) {
      const isChecked = !!checked[`transition:${tid}`];
      if (isChecked && !origTransitions.has(tid)) calls.push(fetch(`${base}/markers/${markerId}/transitions/${tid}`, { method: 'POST', credentials: 'include' }));
      else if (!isChecked && origTransitions.has(tid)) calls.push(fetch(`${base}/markers/${markerId}/transitions/${tid}`, { method: 'DELETE', credentials: 'include' }));
    }
    const origStarts = this.grantOwn ? this.grantOwn.stateMachineStartIds : new Set();
    for (const mid of smIds) {
      const isChecked = !!checked[`smstart:${mid}`];
      if (isChecked && !origStarts.has(mid)) calls.push(fetch(`${base}/markers/${markerId}/state-machines/${mid}/start`, { method: 'POST', credentials: 'include' }));
      else if (!isChecked && origStarts.has(mid)) calls.push(fetch(`${base}/markers/${markerId}/state-machines/${mid}/start`, { method: 'DELETE', credentials: 'include' }));
    }

    await Promise.all(calls);
    this.grantEditing = false;
    await this.fetchMarkerGrantPrincipals(markerId);
    // Save only ever touches the currently selected principal's own grant, so re-selecting it is
    // always correct regardless of kind -- unlike Delete, there's no "does this principal still
    // belong in a list" ambiguity here.
    await this.refreshPermGrantedIdsIfCached(kind, id);
    await this.selectGrantPrincipal(kind, id);
    const marker = this.markers.find(m => m.id === markerId);
    this.toast(`Saved changes to "${marker?.name || 'marker'}".`);
  }

  // Type-level has just two independent operations, each its own POST-to-grant/DELETE-to-revoke
  // row (see AccessAdminController's own comment) -- no PUT/upsert here, so Save just diffs the two
  // checked booleans against the pre-edit own grant, same existence-only pattern saveMarkerGrantEdit
  // uses for transitions/state-machine-starts.
  async saveTypeLevelGrantEdit() {
    const { kind, id } = this.grantSelection;
    const itemTypeId = this.selectedItemTypeId;
    const base = kind === 'group' ? `/api/admin/groups/${id}` : `/api/admin/users/${id}`;
    const checked = {};
    this.querySelectorAll('[data-grant-field]').forEach(el => { checked[el.dataset.grantField] = el.dataset.granted === 'true'; });
    const wantRead = !!checked['item-type:read'];
    const wantCreate = !!checked['item-type:create'];
    const origRead = this.typeLevelGrantOwn ? this.typeLevelGrantOwn.read : false;
    const origCreate = this.typeLevelGrantOwn ? this.typeLevelGrantOwn.create : false;
    const call = (method, operation) => fetch(`${base}/permissions`, {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ itemTypeId, operation }),
    });
    const calls = [];
    if (wantRead && !origRead) calls.push(call('POST', 'item-type:read'));
    else if (!wantRead && origRead) calls.push(call('DELETE', 'item-type:read'));
    if (wantCreate && !origCreate) calls.push(call('POST', 'item-type:create'));
    else if (!wantCreate && origCreate) calls.push(call('DELETE', 'item-type:create'));

    await Promise.all(calls);
    this.grantEditing = false;
    await this.fetchTypeLevelGrantPrincipals(itemTypeId);
    await this.refreshPermGrantedIdsIfCached(kind, id);
    await this.selectGrantPrincipal(kind, id);
    const itemType = this.itemTypes.find(t => t.id === itemTypeId);
    this.toast(`Saved changes to "${itemType?.name || 'item type'}".`);
  }

  async deleteGrantForSelection() {
    if (this.selectedMarkerId) await this.deleteMarkerGrantForSelection();
    else await this.deleteTypeLevelGrantForSelection();
  }

  async deleteMarkerGrantForSelection() {
    const { kind, id } = this.grantSelection;
    const markerId = this.selectedMarkerId;
    const base = kind === 'group' ? `/api/admin/groups/${id}` : `/api/admin/users/${id}`;
    await fetch(`${base}/markers/${markerId}`, { method: 'DELETE', credentials: 'include' });
    this.modal = null;
    await this.fetchMarkerGrantPrincipals(markerId);
    const marker = this.markers.find(m => m.id === markerId);
    this.toast(`Deleted grant of "${marker?.name || 'marker'}".`);
    // A group never disappears from the Group grants tree just because its own grant was deleted
    // (the tree always shows the full hierarchy, per grantHasOwn's own comment) -- so a group
    // always stays put, showing it now as inherited-only, rather than jumping to some other
    // principal. A plain user only appears in the Item Type perspective's User grants list while
    // they have their own grant, so deleting there correctly falls through to "jump to whoever's
    // left" below -- UNLESS this delete came from that very user's own Permissions tab (this.
    // perspective === 'user' with this user selected), where staying put to show their now-empty
    // own grant is what deleteMarkerGrantForSelection's caller (this tab) actually needs.
    const stayOnSamePrincipal = kind === 'group' || (this.perspective === 'user' && this.selectedUserId === id);
    if (stayOnSamePrincipal) {
      await this.refreshPermGrantedIdsIfCached(kind, id);
      await this.selectGrantPrincipal(kind, id);
      return;
    }
    const { groups, users } = this.grantPrincipals;
    if (groups.length) await this.selectGrantPrincipal('group', groups[0].id);
    else if (users.length) await this.selectGrantPrincipal('user', users[0].id);
    else { this.grantSelection = null; this.grantOwn = null; this.grantInherited = null; this.render(); }
  }

  // No single row to delete here -- clears whichever of the two operations this principal
  // currently owns directly.
  async deleteTypeLevelGrantForSelection() {
    const { kind, id } = this.grantSelection;
    const itemTypeId = this.selectedItemTypeId;
    const base = kind === 'group' ? `/api/admin/groups/${id}` : `/api/admin/users/${id}`;
    const revoke = (operation) => fetch(`${base}/permissions`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ itemTypeId, operation }),
    });
    const calls = [];
    if (this.typeLevelGrantOwn?.read) calls.push(revoke('item-type:read'));
    if (this.typeLevelGrantOwn?.create) calls.push(revoke('item-type:create'));
    await Promise.all(calls);
    this.modal = null;
    await this.fetchTypeLevelGrantPrincipals(itemTypeId);
    const itemType = this.itemTypes.find(t => t.id === itemTypeId);
    this.toast(`Deleted grant of "${itemType?.name || 'item type'}".`);
    // See deleteMarkerGrantForSelection's comment for stayOnSamePrincipal's reasoning.
    const stayOnSamePrincipal = kind === 'group' || (this.perspective === 'user' && this.selectedUserId === id);
    if (stayOnSamePrincipal) {
      await this.refreshPermGrantedIdsIfCached(kind, id);
      await this.selectGrantPrincipal(kind, id);
      return;
    }
    const { groups, users } = this.grantPrincipals;
    if (groups.length) await this.selectGrantPrincipal('group', groups[0].id);
    else if (users.length) await this.selectGrantPrincipal('user', users[0].id);
    else { this.grantSelection = null; this.typeLevelGrantOwn = null; this.typeLevelGrantInherited = null; this.render(); }
  }

  openAddUserGrantModal() {
    this.userGrantModalFilterText = '';
    this.modal = { type: 'add-user-grant' };
    this.render();
  }

  async submitAddUserGrant(userId) {
    this.modal = null;
    if (this.selectedMarkerId) {
      // Creating a marker grant is just PUTting an all-false item-permissions row for them -- same
      // ensureMarkerGrant-on-first-write mechanism every other marker-grant endpoint already relies
      // on -- there's no separate "create" endpoint to call first.
      const markerId = this.selectedMarkerId;
      await fetch(`/api/admin/users/${userId}/markers/${markerId}/item-permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ canRead: false, canDelete: false }),
      });
      await this.fetchMarkerGrantPrincipals(markerId);
      const marker = this.markers.find(m => m.id === markerId);
      const user = this.users.find(u => u.id === userId);
      this.toast(`Added grant for ${user?.displayName || 'user'} on "${marker?.name || 'marker'}".`);
    } else {
      // Type-level grants have no all-false placeholder row (see saveTypeLevelGrantEdit's own
      // comment) -- granting Read is the smallest real grant that makes this user "count" as
      // having one, so that's what "+ Add" creates; Edit can then add Create or drop Read again.
      const itemTypeId = this.selectedItemTypeId;
      await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ itemTypeId, operation: 'item-type:read' }),
      });
      await this.fetchTypeLevelGrantPrincipals(itemTypeId);
      const itemType = this.itemTypes.find(t => t.id === itemTypeId);
      const user = this.users.find(u => u.id === userId);
      this.toast(`Added grant for ${user?.displayName || 'user'} on "${itemType?.name || 'item type'}".`);
    }
    await this.selectGrantPrincipal('user', userId);
  }

  // =========================================================================
  // Shared helpers
  // =========================================================================

  formatDate(iso) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString();
  }

  escapeHtml(v) {
    const d = document.createElement('div');
    d.textContent = String(v ?? '');
    return d.innerHTML;
  }

  render() {
    this.innerHTML = `
      <div class="axs-perspective-bar">
        <span class="axs-pb-label">Perspective:</span>
        <button class="axs-perspective-btn ${this.perspective === 'user' ? 'active' : ''}" data-perspective="user">User</button>
        <button class="axs-perspective-btn ${this.perspective === 'group' ? 'active' : ''}" data-perspective="group">Group</button>
        <button class="axs-perspective-btn ${this.perspective === 'itemtype' ? 'active' : ''}" data-perspective="itemtype">Item Type</button>
      </div>
      <div class="axs-body">
        ${this.perspective === 'user' ? this.renderUserPerspective()
          : this.perspective === 'group' ? this.renderGroupPerspective()
          : this.renderItemTypePerspective()}
      </div>
      ${this.modal ? this.renderModal() : ''}
      ${this.toastMessage ? `<div class="axs-toast">${this.escapeHtml(this.toastMessage)}</div>` : ''}
    `;
    this.bindEvents();
  }

  renderModal() {
    switch (this.modal.type) {
      case 'add-user': return this.renderAddUserModal();
      case 'edit-user': return this.renderEditUserModal();
      case 'confirm-delete-user': return this.renderConfirmDeleteUserModal();
      case 'edit-membership': return this.renderEditMembershipModalBody();
      case 'add-group': return this.renderAddGroupModal();
      case 'move-group': return this.renderMoveGroupModal();
      case 'add-group-members': return this.renderAddGroupMembersModal();
      case 'confirm-remove-member': return this.renderConfirmRemoveMemberModal();
      case 'confirm-delete-group': return this.renderConfirmDeleteGroupModal();
      case 'add-user-grant': return this.renderAddUserGrantModalBody();
      case 'confirm-delete-grant': return this.renderConfirmDeleteGrantModalBody();
      case 'token-reveal': return this.renderTokenRevealModal();
      default: return '';
    }
  }

  // Reuses the shared modal chrome's close-modal/close-modal-overlay data-actions, but
  // bindEvents routes both to closeTokenRevealModal when this modal is open, so every dismissal
  // path (Done button, backdrop click) equally clears createdToken -- once closed, this token is
  // gone for good and a new one has to be issued.
  renderTokenRevealModal() {
    if (!this.createdToken) return '';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Token created</div>
          <div class="axs-modal-body">
            <div class="axs-token-reveal">
              <code>${this.escapeHtml(this.createdToken.token)}</code>
              <div class="axs-token-reveal-row">
                <div class="hint">Copy this token now &mdash; it won't be shown again.</div>
                <button class="axs-btn axs-btn-cancel" data-action="copy-created-token">Copy</button>
              </div>
            </div>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-primary" data-action="close-modal">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- User perspective rendering ---

  renderUserPerspective() {
    const users = this.filteredUsers();
    const items = users.map(u => `
      <div class="axs-directory-item ${this.selectedUserId === u.id ? 'selected' : ''}" data-select-user="${u.id}">
        <span class="axs-avatar">U</span>
        <span class="axs-directory-item-text">
          <span class="axs-directory-item-name">${this.escapeHtml(u.displayName)}</span>
          <span class="axs-directory-item-sub">${this.escapeHtml(u.externalId)}</span>
        </span>
        ${u.isSuperuser ? '<span class="axs-badge-admin">Admin</span>' : ''}
      </div>
    `).join('') || `<div class="axs-directory-empty">No users match.</div>`;

    const selected = this.selectedUser();

    return `
      <div class="axs-directory">
        <div class="axs-directory-top">
          <button class="axs-btn-block" data-action="open-add-user">+ Add user</button>
        </div>
        <div class="axs-directory-search">
          <input type="text" id="axs-user-filter-input" placeholder="Filter users…" value="${this.escapeHtml(this.userFilterText)}">
        </div>
        <div class="axs-directory-list">${items}</div>
      </div>
      <div class="axs-detail">
        ${selected ? this.renderUserDetail(selected) : '<div class="axs-empty-hint">Select a user from the sidebar.</div>'}
      </div>
    `;
  }

  renderUserDetail(u) {
    const tabContent = this.activeTab === 'details' ? this.renderDetailsTab(u)
      : this.activeTab === 'groups' ? this.renderUserGroupsTab(u)
      : this.renderPermissionsTab('user', u);

    return `
      <div class="axs-detail-header">
        <div class="axs-detail-title-row">
          <div class="axs-detail-title-group">
            <h1>${this.escapeHtml(u.displayName)}</h1>
            <span class="axs-type-pill">User</span>
            ${u.isSuperuser ? '<span class="axs-type-pill axs-pill-admin">Admin</span>' : ''}
          </div>
          <div class="axs-detail-actions-bar">
            <button class="axs-btn axs-btn-cancel" data-action="open-edit-user">Edit</button>
            <button class="axs-btn axs-btn-danger" data-action="open-delete-user">Delete</button>
          </div>
        </div>
        <div class="axs-tabs">
          <div class="axs-tab ${this.activeTab === 'details' ? 'active' : ''}" data-tab="details">Details</div>
          <div class="axs-tab ${this.activeTab === 'groups' ? 'active' : ''}" data-tab="groups">Groups</div>
          <div class="axs-tab ${this.activeTab === 'permissions' ? 'active' : ''}" data-tab="permissions">Permissions</div>
        </div>
      </div>
      <div class="axs-tab-body">
        ${this.error ? `<div class="axs-error">${this.escapeHtml(this.error)}</div>` : ''}
        ${tabContent}
      </div>
    `;
  }

  renderDetailsTab(u) {
    const tokenRows = this.tokens.map(t => `
      <tr>
        <td>${this.escapeHtml(t.name)}</td>
        <td style="color:var(--muted);">${this.formatDate(t.createdAt)}</td>
        <td style="color:var(--muted);">${this.formatDate(t.expiresAt)}</td>
        <td><button class="axs-btn axs-btn-danger" data-revoke-token="${t.id}">Revoke</button></td>
      </tr>
    `).join('');

    return `
      <div class="axs-section">
        <div class="axs-section-label">Profile</div>
        <table class="axs-profile-table">
          <tr><td>Username</td><td>${this.escapeHtml(u.externalId)}</td></tr>
          <tr><td>Display name</td><td>${this.escapeHtml(u.displayName)}</td></tr>
          <tr><td>Email</td><td>${this.escapeHtml(u.email || '—')}</td></tr>
          <tr><td>Role</td><td>${u.isSuperuser ? 'Admin' : 'User'}</td></tr>
        </table>
      </div>

      <div class="axs-section">
        <div class="axs-section-label">Password <span class="axs-add-link" data-action="toggle-reset-password">${this.resetPasswordOpen ? 'Cancel' : 'Reset'}</span></div>
        ${this.resetPasswordOpen ? `
          <div class="axs-inline-row">
            <input type="password" name="new-password" placeholder="New password" autocomplete="new-password">
            <button class="axs-btn axs-btn-danger" data-action="reset-password">Reset password</button>
          </div>
        ` : ''}
      </div>

      <div class="axs-section">
        <div class="axs-section-label">Personal access tokens</div>
        <table class="axs-table">
          <thead><tr><th>Name</th><th>Created</th><th>Expires</th><th></th></tr></thead>
          <tbody>${tokenRows || '<tr><td colspan="4" style="color:var(--muted);font-style:italic;">No tokens</td></tr>'}</tbody>
        </table>
        <div class="axs-inline-row">
          <input type="text" name="token-name" placeholder="Token name" autocomplete="off">
          <input type="number" name="token-days" placeholder="Days" min="1" style="width:70px;">
          <button class="axs-btn axs-btn-primary" data-action="create-token">Create</button>
        </div>
      </div>
    `;
  }

  renderUserGroupsTab(u) {
    const relevant = this.relevantGroupIdsForUser();
    const roots = this.rootGroups().filter(g => relevant.has(g.id));
    const treeHtml = roots.length
      ? roots.map(g => this.renderUserGroupTreeNode(g, 0, relevant)).join('')
      : '<div class="axs-directory-empty">Not a member of any group.</div>';
    const selectedGroup = this.groups.find(g => g.id === this.userGroupTreeSelectedId);

    return `
      <div class="axs-section">
        <div class="axs-section-label">Groups <span class="axs-add-link" data-action="open-edit-membership">Edit</span></div>
        <p style="color:var(--muted);font-size: 14px;font-style:italic;margin:0 0 10px 0;">Full hierarchy this reaches, including groups nested above the ones listed here. Select a group to see who else is in it:</p>
        <div class="axs-user-groups-split">
          <div class="axs-user-groups-tree">${treeHtml}</div>
          <div class="axs-user-groups-reach">${this.renderUserGroupTreeReachPanel(selectedGroup)}</div>
        </div>
      </div>
    `;
  }

  // Always shown fully expanded (no independent collapse here -- see childGroupsOf's callers
  // elsewhere for the same "full hierarchy, always" convention), so the chevron is purely a static
  // indicator of "this group has children, shown below" rather than an interactive toggle -- same
  // role as renderGroupNode's own chevron plays when open, just without a closed state to reach.
  renderUserGroupTreeNode(g, depth, relevant) {
    const kids = this.childGroupsOf(g.id).filter(k => relevant.has(k.id));
    const selected = this.userGroupTreeSelectedId === g.id;
    return `
      <div class="axs-tree-node">
        <div class="axs-tree-row ${selected ? 'selected' : ''}" data-select-user-group-tree="${g.id}" style="padding-left:${12 + depth * 16}px">
          <span class="axs-disclosure axs-disclosure-lg ${kids.length ? 'open' : 'leaf'}">&#9656;</span>
          <span class="axs-tree-icon-group">G</span>
          <span class="axs-tree-label">${this.escapeHtml(g.name)}</span>
          ${this.isDefaultGroup(g) ? '<span class="axs-badge-default">default</span>' : ''}
          <span class="axs-tree-count">${g.memberCount}</span>
        </div>
        ${kids.length ? `<div class="axs-tree-children">${kids.map(k => this.renderUserGroupTreeNode(k, depth + 1, relevant)).join('')}</div>` : ''}
      </div>
    `;
  }

  renderUserGroupTreeReachPanel(g) {
    if (!g) return '<div class="axs-directory-empty">Select a group to see its members.</div>';
    const direct = this.userGroupTreeMembers.map(user => ({ user, hop: 'direct' }));
    const nested = this.userGroupTreeSubgroupMembers.map(({ user, viaGroupId }) => ({ user, hop: 'nested', viaGroupId }));
    const rows = [...direct, ...nested].map(({ user, hop, viaGroupId }) => {
      const viaName = hop === 'nested' ? (this.groups.find(x => x.id === viaGroupId)?.name || '?') : null;
      const sub = viaName
        ? `${this.escapeHtml(user.email || '')} &middot; via ${this.escapeHtml(viaName)}`
        : this.escapeHtml(user.email || '');
      return `
        <div class="axs-directory-item" data-goto-user="${user.id}">
          <span class="axs-avatar">U</span>
          <span class="axs-directory-item-text">
            <span class="axs-directory-item-name">${this.escapeHtml(user.displayName)}</span>
            <span class="axs-directory-item-sub">${sub}</span>
          </span>
        </div>
      `;
    }).join('') || '<div class="axs-directory-empty">No members.</div>';
    return `
      <div class="axs-directory-section-title">Members of <b>${this.escapeHtml(g.name)}</b></div>
      ${rows}
    `;
  }

  renderEditMembershipModalBody() {
    const currentIds = new Set(this.userGroups.map(g => g.id));
    const defaultId = this.groups.find(g => this.isDefaultGroup(g))?.id;
    const options = this.sortedGroupsForPicker().map(g => {
      const isDefault = g.id === defaultId;
      const checked = currentIds.has(g.id) || isDefault;
      return `<label><input type="checkbox" value="${g.id}" ${checked ? 'checked' : ''} ${isDefault ? 'disabled' : ''}> ${this.escapeHtml(g.name)}${isDefault ? ' <span style="color:var(--muted);font-size: 14px;">(required)</span>' : ''}</label>`;
    }).join('');
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Edit group membership</div>
          <div class="axs-modal-body">
            ${this.error ? `<div class="axs-error">${this.escapeHtml(this.error)}</div>` : ''}
            <div class="axs-modal-checkboxes">${options}</div>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-primary" data-action="submit-edit-membership">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAddUserModal() {
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Add user</div>
          <div class="axs-modal-body">
            ${this.error ? `<div class="axs-error">${this.escapeHtml(this.error)}</div>` : ''}
            <label>Username</label>
            <input name="externalId" placeholder="Login ID" autocomplete="off">
            <label>Display name</label>
            <input name="displayName" placeholder="Full name" autocomplete="off">
            <label>Email</label>
            <input name="email" type="email" placeholder="Email" autocomplete="off">
            <label>Password</label>
            <input name="password" type="password" placeholder="Password" autocomplete="new-password">
            <label>Role</label>
            <select name="role">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-primary" data-action="submit-add-user">Create user</button>
          </div>
        </div>
      </div>
    `;
  }

  // Password isn't editable here -- Details tab's own "Reset" link covers that separately, same
  // as it always has. Username/display name/email/role all round-trip through the one PUT
  // endpoint (see UserAdminController.updateUser) that also keeps security_local_credentials'
  // login key in sync when the username changes.
  renderEditUserModal() {
    const u = this.users.find(x => x.id === this.modal.userId);
    if (!u) return '';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Edit user</div>
          <div class="axs-modal-body">
            ${this.error ? `<div class="axs-error">${this.escapeHtml(this.error)}</div>` : ''}
            <label>Username</label>
            <input name="externalId" placeholder="Login ID" autocomplete="off" value="${this.escapeHtml(u.externalId)}">
            <label>Display name</label>
            <input name="displayName" placeholder="Full name" autocomplete="off" value="${this.escapeHtml(u.displayName)}">
            <label>Email</label>
            <input name="email" type="email" placeholder="Email" autocomplete="off" value="${this.escapeHtml(u.email || '')}">
            <label>Role</label>
            <select name="role">
              <option value="USER" ${!u.isSuperuser ? 'selected' : ''}>User</option>
              <option value="ADMIN" ${u.isSuperuser ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-primary" data-action="submit-edit-user">Save changes</button>
          </div>
        </div>
      </div>
    `;
  }

  renderConfirmDeleteUserModal() {
    const u = this.users.find(x => x.id === this.modal.userId);
    if (!u) return '';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Delete user</div>
          <div class="axs-modal-body">
            ${this.error ? `<div class="axs-error">${this.escapeHtml(this.error)}</div>` : ''}
            <p>Delete <b>${this.escapeHtml(u.displayName)}</b>? This removes their group memberships, personal access tokens, and login credentials. This cannot be undone.</p>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-danger" data-action="submit-delete-user">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- Group perspective rendering ---

  renderGroupPerspective() {
    const g = this.selectedGroup();
    return `
      <div class="axs-directory">
        <div class="axs-directory-top">
          <button class="axs-btn-block" data-action="open-add-group">+ Add group</button>
        </div>
        <div class="axs-directory-search">
          <input type="text" id="axs-group-filter-input" placeholder="Filter groups…" value="${this.escapeHtml(this.groupFilterText)}">
        </div>
        <div class="axs-directory-split">
          <div class="axs-directory-list">${this.renderGroupTree()}</div>
          ${this.renderPeopleReachedPanel()}
        </div>
      </div>
      <div class="axs-detail">
        ${g ? this.renderGroupDetail(g) : '<div class="axs-empty-hint">Select a group from the sidebar.</div>'}
      </div>
    `;
  }

  renderGroupTree() {
    if (!this.groups.length) return '<div class="axs-directory-empty">No groups.</div>';
    const filter = this.groupFilterText.trim().toLowerCase();
    const subtreeMatches = (g) => {
      if (!filter) return true;
      if (g.name.toLowerCase().includes(filter)) return true;
      return this.childGroupsOf(g.id).some(subtreeMatches);
    };
    const roots = this.rootGroups().filter(subtreeMatches);
    if (!roots.length) return '<div class="axs-directory-empty">No groups match.</div>';
    return roots.map(g => this.renderGroupNode(g, 0, subtreeMatches, !!filter)).join('');
  }

  renderGroupNode(g, depth, subtreeMatches, filterActive) {
    const kids = this.childGroupsOf(g.id).filter(subtreeMatches);
    const hasChildren = this.childGroupsOf(g.id).length > 0;
    const isOpen = !this.closedGroupNodes.has(g.id) || filterActive;
    const selected = this.selectedGroupId === g.id;
    return `
      <div class="axs-tree-node">
        <div class="axs-tree-row ${selected ? 'selected' : ''}" data-select-group="${g.id}" style="padding-left:${12 + depth * 16}px">
          <span class="axs-disclosure axs-disclosure-lg ${hasChildren ? '' : 'leaf'} ${isOpen ? 'open' : ''}" data-toggle-group-node="${g.id}">&#9656;</span>
          <span class="axs-tree-icon-group">G</span>
          <span class="axs-tree-label">${this.escapeHtml(g.name)}</span>
          ${this.isDefaultGroup(g) ? '<span class="axs-badge-default">default</span>' : ''}
          <span class="axs-tree-count">${g.memberCount}</span>
        </div>
        ${hasChildren ? `<div class="axs-tree-children ${isOpen ? '' : 'collapsed'}">${kids.map(k => this.renderGroupNode(k, depth + 1, subtreeMatches, filterActive)).join('')}</div>` : ''}
      </div>
    `;
  }

  // Direct members of the selected group, plus every descendant group's direct members -- the
  // full "blast radius" of a permission change on this group, matching why this panel sits right
  // below the tree on the group's own Membership/Permissions tabs.
  renderPeopleReachedPanel() {
    const g = this.selectedGroup();
    if (!g) return '<div class="axs-directory-members"></div>';
    const direct = this.groupMembers.map(u => ({ user: u, hop: 'direct' }));
    const nested = this.subgroupMembers.map(({ user, viaGroupId }) => ({ user, hop: 'nested', viaGroupId }));
    const rows = [...direct, ...nested].map(({ user, hop, viaGroupId }) => {
      const viaName = hop === 'nested' ? (this.groups.find(x => x.id === viaGroupId)?.name || '?') : null;
      const sub = viaName
        ? `${this.escapeHtml(user.email || '')} &middot; via ${this.escapeHtml(viaName)}`
        : this.escapeHtml(user.email || '');
      return `
        <div class="axs-directory-item" data-goto-user="${user.id}">
          <span class="axs-avatar">U</span>
          <span class="axs-directory-item-text">
            <span class="axs-directory-item-name">${this.escapeHtml(user.displayName)}</span>
            <span class="axs-directory-item-sub">${sub}</span>
          </span>
        </div>
      `;
    }).join('') || '<div class="axs-directory-empty">No members.</div>';

    return `
      <div class="axs-directory-members">
        <div class="axs-directory-section-title">People reached by <b>${this.escapeHtml(g.name)}</b></div>
        ${rows}
      </div>
    `;
  }

  renderGroupDetail(g) {
    const tabContent = this.groupActiveTab === 'membership' ? this.renderMembershipTab(g)
      : this.renderPermissionsTab('group', g);

    const actionsHtml = this.groupRenaming ? `
      <input type="text" name="rename-group" value="${this.escapeHtml(g.name)}">
      <button class="axs-btn axs-btn-primary" data-action="submit-rename-group">Save</button>
      <button class="axs-btn axs-btn-cancel" data-action="cancel-rename-group">Cancel</button>
    ` : `
      <button class="axs-btn axs-btn-cancel" data-action="start-rename-group">Rename</button>
      ${!this.isDefaultGroup(g) ? `
        <button class="axs-btn axs-btn-cancel" data-action="open-move-group">Move&hellip;</button>
        <button class="axs-btn axs-btn-danger" data-action="open-delete-group">Delete</button>
      ` : ''}
    `;

    return `
      <div class="axs-detail-header">
        <div class="axs-detail-title-row">
          <div class="axs-detail-title-group">
            <h1>${this.escapeHtml(g.name)}</h1>
            <span class="axs-type-pill">Group</span>
          </div>
          <div class="axs-detail-actions-bar">${actionsHtml}</div>
        </div>
        <div class="axs-tabs">
          <div class="axs-tab ${this.groupActiveTab === 'membership' ? 'active' : ''}" data-group-tab="membership">Membership</div>
          <div class="axs-tab ${this.groupActiveTab === 'permissions' ? 'active' : ''}" data-group-tab="permissions">Permissions</div>
        </div>
      </div>
      <div class="axs-tab-body">
        ${this.groupError ? `<div class="axs-error">${this.escapeHtml(this.groupError)}</div>` : ''}
        ${tabContent}
      </div>
    `;
  }

  renderMembershipTab(g) {
    const filter = this.groupMembershipFilter.trim().toLowerCase();
    const matchesFilter = (u) => !filter
      || u.displayName.toLowerCase().includes(filter)
      || u.externalId.toLowerCase().includes(filter)
      || (u.email || '').toLowerCase().includes(filter);

    const userCell = (u) => `
      <div>
        <div class="axs-user-grid-cell-name">${this.escapeHtml(u.displayName)}</div>
        <div class="axs-user-grid-cell-sub">${this.escapeHtml(u.externalId)}</div>
      </div>
      <div class="axs-user-grid-cell-sub">${this.escapeHtml(u.email || '')}</div>
      <div>${u.isSuperuser ? '<span class="axs-admin-chip">Admin</span>' : ''}</div>
    `;

    const directRows = this.groupMembers.filter(matchesFilter).map(u => `
      <div class="axs-user-grid-row">
        ${userCell(u)}
        <div>${this.isDefaultGroup(g) ? '' : `<button class="axs-btn axs-btn-danger" data-open-remove-member="${u.id}">Remove</button>`}</div>
      </div>
    `).join('');

    const nestedRows = this.subgroupMembers
      .filter(({ user }) => matchesFilter(user))
      .map(({ user, viaGroupId }) => `
        <div class="axs-user-grid-row">
          ${userCell(user)}
          <div class="axs-user-grid-cell-sub">${this.escapeHtml(this.groups.find(x => x.id === viaGroupId)?.name || '?')}</div>
        </div>
      `).join('');

    return `
      <div class="axs-section">
        <div class="axs-section-label">Direct members <span class="axs-add-link" data-action="open-add-group-members">+ Add user</span></div>
        <input type="text" id="axs-group-membership-filter-input" placeholder="Filter members…" value="${this.escapeHtml(this.groupMembershipFilter)}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size: 14px;font-family:inherit;margin-bottom:10px;">
        <div class="axs-user-grid">
          <div class="axs-user-grid-header"><div>Name</div><div>Email</div><div>Admin</div><div></div></div>
          ${directRows || '<div class="axs-directory-empty">No direct members.</div>'}
        </div>
      </div>
      <div class="axs-section">
        <div class="axs-section-label">Members of subgroups</div>
        <div class="axs-user-grid">
          <div class="axs-user-grid-header"><div>Name</div><div>Email</div><div>Admin</div><div>Subgroup</div></div>
          ${nestedRows || '<div class="axs-directory-empty">No subgroup members.</div>'}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Group & User perspectives: Permissions tab
  //
  // This is the reverse lens on the Item Type perspective's own marker/type-level grant views:
  // there the principal varies (Group grants / User grants trees) and the marker or item type is
  // fixed; here ONE principal (a group or a user -- "kind" below) is fixed and the admin browses
  // item types/markers to inspect or edit its grant on each. Rather than duplicate the own/
  // inherited/shadow-badge fetch-and-render machinery, this just points the SAME state the Item
  // Type perspective drives (selectedItemTypeId, selectedMarkerId, grantSelection, grantOwn,
  // grantInherited, grantInheritedNames, grantShadowNames, grantPrincipals) at that principal, so
  // renderGrantDetailPane/renderTypeLevelDetailPane/permCheckHtml's shadow-warning badges/
  // saveGrantEdit/deleteGrantForSelection all work completely unchanged from this new entry point.
  // A user has no descendants, so the "shadowed by a descendant" badge never fires for one -- but
  // a user's "inherited" is very much real: selectGrantPrincipal's own 'user' branch computes it
  // from userReachGroups(id) (every group the user is directly in, plus all of *those* groups'
  // ancestors), the same "membership flows up" fact the Group branch's ancestorChain relies on.
  // This is what makes the "up" redundancy badge meaningful for a user too -- their own direct
  // grant duplicating something a group already gives them -- and, more importantly, is what makes
  // this tab finally show a user's *effective* access (own + everything via groups), not just
  // their own direct grants, which is the whole point of it.
  //
  // The browsing state itself (permMode/permMarkerIds/permTypeLevelItemTypeIds) is shared between
  // the Group and User tabs rather than kept as two parallel copies: unlike grantOwn vs.
  // typeLevelGrantOwn (genuinely different data shapes), a group's and a user's "which markers/
  // item types do they have granted" browsing state is identical in shape and behavior -- the only
  // difference is which REST base path fetches it (fetchPermGrantedIds's own `kind` branch) --
  // so one shared implementation is the right level of abstraction, not premature generalization.
  // selectGroup/selectUser both reset it to null on principal change, same as grantOwn etc.
  // =========================================================================

  async enterPermissionsTab(kind, principal) {
    if (!principal) return;
    this.permMarkerIds = null; // renderPermissionsTab shows "Loading…" while this is null
    this.render();
    await this.fetchSchema();
    await this.fetchPermGrantedIds(kind, principal.id);
    if (!this.permMode) this.permMode = 'all';
    await this.enterPermFirstAvailable(kind, principal);
  }

  // Pure fetch of one principal's OWN granted marker/item-type ids -- no reach-group expansion,
  // no state mutation. Used both for the top-level principal and, for a user, for each of its
  // reach groups in turn (see fetchPermGrantedIds below).
  async fetchPermGrantedIdsRaw(kind, principalId) {
    const base = kind === 'group' ? `/api/admin/groups/${principalId}` : `/api/admin/users/${principalId}`;
    const permissionsPath = kind === 'group' ? `${base}/permissions` : `${base}/permissions/own`;
    const [markerIds, permissions] = await Promise.all([
      fetch(`${base}/markers`, { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(permissionsPath, { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    return { markerIds: new Set(markerIds), typeIds: new Set(permissions.map(p => p.itemTypeId)) };
  }

  // "Granted markers" mode's underlying data -- for a group, just its own grants. For a user, its
  // OWN grants unioned with every reach group's own grants, since most of what a user can actually
  // do typically comes from groups, not direct grants -- a user with zero direct grants but several
  // group memberships should still see a populated "Granted" list, not an empty one.
  //
  // For a user, also keeps the per-principal breakdown (userReachContributions) rather than only
  // the merged union -- that's what lets the tree be organized by *origin* ("Direct" / "via
  // Editors" / "via everyone"), not just by which markers exist somewhere in the user's reach.
  // Building it here (once per tab-enter) means selecting an item type/marker later doesn't need
  // to re-fetch anything to know which origins are relevant to it.
  async fetchPermGrantedIds(kind, principalId) {
    const own = await this.fetchPermGrantedIdsRaw(kind, principalId);
    const markerIds = own.markerIds, typeIds = own.typeIds;
    this.userReachContributions = null;
    if (kind === 'user') {
      const reachGroups = await this.userReachGroups(principalId);
      const reachData = await Promise.all(reachGroups.map(g => this.fetchPermGrantedIdsRaw('group', g.id)));
      this.userReachContributions = [
        { principal: { kind: 'user', id: principalId, name: null }, markerIds: own.markerIds, typeIds: own.typeIds },
        ...reachGroups.map((g, i) => ({ principal: { kind: 'group', id: g.id, name: g.name }, markerIds: reachData[i].markerIds, typeIds: reachData[i].typeIds })),
      ];
      reachData.forEach(r => {
        r.markerIds.forEach(id => markerIds.add(id));
        r.typeIds.forEach(id => typeIds.add(id));
      });
    }
    this.permMarkerIds = markerIds;
    this.permTypeLevelItemTypeIds = typeIds;
  }

  // Called after any grant mutation on a group or user (from either perspective's own Permissions
  // tab, or the Item Type perspective) -- re-fetches permMarkerIds/permTypeLevelItemTypeIds if
  // they're already cached for this exact principal, so "Granted markers" mode's own tree doesn't
  // go stale (e.g. deleting a marker's last own-grant row should drop it from that list on the
  // next visit). A no-op if this principal's Permissions tab was never opened this session, or if
  // some other principal is what's currently cached.
  async refreshPermGrantedIdsIfCached(kind, principalId) {
    if (this.permMarkerIds === null) return;
    const currentId = kind === 'group' ? this.selectedGroupId : this.selectedUserId;
    if (currentId === principalId) {
      await this.fetchPermGrantedIds(kind, principalId);
      return;
    }
    // Origin-tree case: a mutation on one of the CURRENTLY-VIEWED user's reach groups (edited via
    // the User tab's origin tree, not that group's own page) changes what this user's tab should
    // show too, even though the mutated principal isn't the user themselves.
    if (this.perspective === 'user' && kind === 'group' && this.userReachContributions
        && this.userReachContributions.some(c => c.principal.kind === 'group' && c.principal.id === principalId)) {
      await this.fetchPermGrantedIds('user', this.selectedUserId);
    }
  }

  // "Granted markers" mode: only item types where this principal has a marker grant or a
  // type-level grant of its own, and only the markers it's actually granted (per-marker, not
  // per-type) -- matching the wireframe's groupAccessTabHtml. "All markers" mode: the entire
  // schema, exactly what the Item Type perspective's own sidebar tree shows, so an admin can
  // navigate to a marker this principal doesn't have yet and grant it directly from here.
  permScopeList() {
    const showAll = this.permMode === 'all';
    const grantedMarkerIds = this.permMarkerIds || new Set();
    const grantedTypeIds = this.permTypeLevelItemTypeIds || new Set();
    const result = [];
    for (const itemType of this.sortedItemTypes()) {
      const allMarkers = this.markersForItemType(itemType.id);
      const markers = showAll ? allMarkers : allMarkers.filter(m => grantedMarkerIds.has(m.id));
      if (showAll || markers.length || grantedTypeIds.has(itemType.id)) {
        result.push({ itemType, markers });
      }
    }
    return result;
  }

  async enterPermFirstAvailable(kind, principal) {
    const scopeList = this.permScopeList();
    if (!scopeList.length) {
      this.selectedItemTypeId = null;
      this.selectedMarkerId = null;
      this.grantSelection = null;
      this.render();
      return;
    }
    const first = scopeList[0];
    if (first.markers.length) await this.selectPermMarker(kind, principal.id, first.itemType.id, first.markers[0].id);
    else await this.selectPermItemType(kind, principal.id, first.itemType.id);
  }

  async setPermMode(mode, kind, principal) {
    if (!principal || this.permMode === mode) return;
    this.permMode = mode;
    await this.enterPermFirstAvailable(kind, principal);
  }

  async selectPermItemType(kind, principalId, itemTypeId) {
    this.selectedItemTypeId = itemTypeId;
    this.selectedMarkerId = null;
    await this.fetchTypeLevelGrantPrincipals(itemTypeId);
    await this.selectGrantPrincipal(kind, principalId);
  }

  async selectPermMarker(kind, principalId, itemTypeId, markerId) {
    this.selectedItemTypeId = itemTypeId;
    this.selectedMarkerId = markerId;
    await this.fetchMarkerGrantPrincipals(markerId);
    await this.selectGrantPrincipal(kind, principalId);
  }

  renderPermissionsTab(kind, principal) {
    if (this.permMarkerIds === null) return '<div class="axs-empty-hint">Loading…</div>';
    const scopeList = this.permScopeList();
    const modeToggle = `
      <div class="axs-perm-mode-toggle">
        <label><input type="radio" name="permMode" value="all" ${this.permMode === 'all' ? 'checked' : ''} data-perm-mode> All markers</label>
        <label><input type="radio" name="permMode" value="granted" ${this.permMode === 'granted' ? 'checked' : ''} data-perm-mode> Granted markers</label>
      </div>
    `;
    if (!scopeList.length) {
      const who = kind === 'group' ? this.escapeHtml(principal.name) : this.escapeHtml(principal.displayName);
      const grantedEmpty = kind === 'group'
        ? `${who} has no grants of its own yet`
        : `${who} has no access anywhere, directly or via a group,`;
      const emptyMsg = this.permMode === 'all'
        ? 'No item types exist yet.'
        : `${grantedEmpty} &mdash; switch to "All markers" to grant one.`;
      return modeToggle + `<div class="axs-empty-hint">${emptyMsg}</div>`;
    }
    const t = this.itemTypeSchema(this.selectedItemTypeId);
    let detailHtml;
    if (!this.selectedItemTypeId) {
      detailHtml = `<div class="axs-empty-hint">Select an item type or marker to see what this ${kind === 'group' ? 'group' : 'user'} grants.</div>`;
    } else if (this.selectedMarkerId) {
      detailHtml = t ? this.renderGrantDetailPane(t) : '<div class="axs-empty-hint">Loading…</div>';
    } else {
      detailHtml = this.renderTypeLevelDetailPane();
    }
    // User tab gets two extra stacked blocks below the item-type/marker tree, in the SAME left
    // column: "Direct grants" (a single selectable node -- this user's own row) and "Group grants"
    // (the real, full group hierarchy, reusing renderGrantGroupTreeNode verbatim -- same component
    // the Item Type perspective's own left column already uses). Clicking either drives the
    // detail pane exactly like clicking a principal there does; data-select-grant is already wired
    // generically (see bindEvents), so no new click handling is needed for this at all.
    const userGrantsBlocksHtml = kind === 'user' ? this.renderUserGrantsBlocks(principal.id) : '';
    return `
      ${modeToggle}
      <div class="axs-grant-layout">
        <div class="axs-grant-left">
          <div>
            <div class="axs-grant-block-title">ITEM TYPES</div>
            <div class="axs-grant-list">${this.renderPermTree(scopeList)}</div>
          </div>
          ${userGrantsBlocksHtml}
        </div>
        <div class="axs-grant-detail-pane">${detailHtml}</div>
      </div>
    `;
  }

  renderUserGrantsBlocks(userId) {
    const roots = this.rootGroups();
    const groupTreeHtml = roots.length
      ? roots.map(g => this.renderGrantGroupTreeNode(g, 0)).join('')
      : '<div class="axs-directory-empty">No groups exist.</div>';
    const isDirectSelected = this.grantSelection && this.grantSelection.kind === 'user' && this.grantSelection.id === userId;
    return `
      <div>
        <div class="axs-grant-block-title">Direct grants</div>
        <div class="axs-grant-list">
          <div class="axs-tree-row ${isDirectSelected ? 'selected' : ''}" data-select-grant="user::${userId}">
            <span class="axs-disclosure leaf"></span>
            <span class="axs-tree-icon-itemtype">U</span>
            <span class="axs-tree-label">Direct</span>
          </div>
        </div>
      </div>
      <div>
        <div class="axs-grant-block-title">Group grants</div>
        <div class="axs-grant-list">${groupTreeHtml}</div>
      </div>
    `;
  }

  renderPermTree(scopeList) {
    return scopeList.map(({ itemType, markers }) => {
      const isOpen = this.selectedItemTypeId === itemType.id;
      const selected = isOpen && !this.selectedMarkerId;
      const childrenHtml = isOpen && markers.length
        ? `<div class="axs-tree-children">${markers.map(m => `
            <div class="axs-marker-chip-row" data-select-perm-marker="${itemType.id}::${m.id}">
              <span class="axs-marker-chip ${this.selectedMarkerId === m.id ? 'selected' : ''}">${this.escapeHtml(m.name)}</span>
            </div>
          `).join('')}</div>`
        : '';
      return `
        <div class="axs-tree-node">
          <div class="axs-tree-row ${selected ? 'selected' : ''}" data-select-perm-itemtype="${itemType.id}">
            <span class="axs-disclosure axs-disclosure-lg ${markers.length ? '' : 'leaf'} ${isOpen ? 'open' : ''}">&#9656;</span>
            <span class="axs-tree-icon-itemtype">T</span>
            <span class="axs-tree-label">${this.escapeHtml(itemType.name)}</span>
            ${markers.length ? `<span class="axs-tree-count">${markers.length} marker${markers.length === 1 ? '' : 's'}</span>` : ''}
          </div>
          ${childrenHtml}
        </div>
      `;
    }).join('');
  }

  // "everyone" is the one and only top-level group (see the backend's own createGroup comment) --
  // every new group must nest somewhere under it, so the picker offers every existing group as a
  // parent (defaulting to "everyone" itself) with no separate "top level" option that would just
  // create a second, sibling root.
  renderAddGroupModal() {
    const defaultGroupId = this.groups.find(g => this.isDefaultGroup(g))?.id;
    const options = this.sortedGroupsForPicker()
      .map(g => `<option value="${g.id}" ${g.id === defaultGroupId ? 'selected' : ''}>${this.escapeHtml(g.name)}</option>`).join('');
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Add group</div>
          <div class="axs-modal-body">
            ${this.groupError ? `<div class="axs-error">${this.escapeHtml(this.groupError)}</div>` : ''}
            <label>Name</label>
            <input name="group-name" placeholder="Group name" autocomplete="off">
            <label>Parent</label>
            <select name="group-parent">
              ${options}
            </select>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-primary" data-action="submit-add-group">Create group</button>
          </div>
        </div>
      </div>
    `;
  }

  // Never opened for the default group itself (see renderGroupDetail's actionsHtml) -- "everyone"
  // is the one and only group allowed to have no parent, so there's nowhere valid to move it to.
  renderMoveGroupModal() {
    const g = this.groups.find(x => x.id === this.modal.groupId);
    if (!g) return '';
    // A group can't become its own parent, or its own descendant's parent (that would be a
    // cycle) -- the backend rejects this too, but excluding them from the picker keeps it honest.
    const excluded = new Set([g.id, ...this.descendantGroupIds(g.id)]);
    const currentParentId = this.parentIdOf(g);
    const options = this.sortedGroupsForPicker().filter(x => !excluded.has(x.id))
      .map(x => `<option value="${x.id}" ${currentParentId === x.id ? 'selected' : ''}>${this.escapeHtml(x.name)}</option>`).join('');
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Move ${this.escapeHtml(g.name)}</div>
          <div class="axs-modal-body">
            ${this.groupError ? `<div class="axs-error">${this.escapeHtml(this.groupError)}</div>` : ''}
            <label>New parent</label>
            <select name="move-group-parent">
              ${options}
            </select>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-primary" data-action="submit-move-group">Move</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAddGroupMembersModal() {
    const g = this.groups.find(x => x.id === this.modal.groupId);
    if (!g) return '';
    const memberIds = new Set(this.groupMembers.map(u => u.id));
    const candidates = this.sortedUsers().filter(u => !memberIds.has(u.id));
    const filter = this.addGroupMembersFilter.trim().toLowerCase();
    const filtered = candidates.filter(u => !filter
      || u.displayName.toLowerCase().includes(filter)
      || u.externalId.toLowerCase().includes(filter)
      || (u.email || '').toLowerCase().includes(filter));
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Add users to ${this.escapeHtml(g.name)}</div>
          <div class="axs-modal-body">
            ${this.groupError ? `<div class="axs-error">${this.escapeHtml(this.groupError)}</div>` : ''}
            ${candidates.length ? `
              <input type="text" id="axs-add-group-members-filter" placeholder="Filter users…" value="${this.escapeHtml(this.addGroupMembersFilter)}">
              <div class="axs-modal-checkboxes">
                ${filtered.map(u => `<label><input type="checkbox" value="${u.id}"> ${this.escapeHtml(u.displayName)} <span style="color:var(--muted);font-size: 14px;">${this.escapeHtml(u.externalId)}</span></label>`).join('') || '<div style="color:var(--muted);font-style:italic;font-size: 14px;">No users match.</div>'}
              </div>
            ` : `<p style="color:var(--muted);font-style:italic;">Every user is already a member of ${this.escapeHtml(g.name)}.</p>`}
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            ${candidates.length ? `<button class="axs-btn axs-btn-primary" data-action="submit-add-group-members">Add</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderConfirmRemoveMemberModal() {
    const u = this.users.find(x => x.id === this.modal.userId);
    const g = this.groups.find(x => x.id === this.modal.groupId);
    if (!u || !g) return '';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Remove member</div>
          <div class="axs-modal-body">
            <p>Remove <b>${this.escapeHtml(u.displayName)}</b> from <b>${this.escapeHtml(g.name)}</b>? They'll lose whatever this membership grants them directly, though they may still have access through another group.</p>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-danger" data-action="submit-remove-member">Remove</button>
          </div>
        </div>
      </div>
    `;
  }

  renderConfirmDeleteGroupModal() {
    const g = this.groups.find(x => x.id === this.modal.groupId);
    if (!g) return '';
    const childCount = this.childGroupsOf(g.id).length;
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Delete group</div>
          <div class="axs-modal-body">
            <p>Delete <b>${this.escapeHtml(g.name)}</b>? Its direct members lose whatever it grants them.${childCount ? ` Its ${childCount} subgroup${childCount === 1 ? '' : 's'} will move to the top level.` : ''}</p>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-danger" data-action="submit-delete-group">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- Item Type perspective rendering ---

  renderItemTypePerspective() {
    const t = this.itemTypes.find(x => x.id === this.selectedItemTypeId);
    return `
      <div class="axs-directory">
        <div class="axs-directory-search">
          <input type="text" id="axs-itemtype-filter-input" placeholder="Filter item types…" value="${this.escapeHtml(this.itemTypeFilterText)}">
        </div>
        <div class="axs-directory-list">${this.renderItemTypeList()}</div>
      </div>
      <div class="axs-detail">
        ${t ? this.renderItemTypeDetail(t) : '<div class="axs-empty-hint">Select an item type from the sidebar.</div>'}
      </div>
    `;
  }

  renderItemTypeList() {
    const filter = this.itemTypeFilterText.trim().toLowerCase();
    const filtered = this.sortedItemTypes().filter(t => !filter || t.name.toLowerCase().includes(filter));
    if (!filtered.length) return '<div class="axs-directory-empty">No item types match.</div>';
    return filtered.map(t => this.renderItemTypeNode(t)).join('');
  }

  renderItemTypeNode(t) {
    const markers = this.markersForItemType(t.id);
    const hasMarkers = markers.length > 0;
    const isOpen = hasMarkers && !this.closedItemTypeNodes.has(t.id);
    const selected = this.selectedItemTypeId === t.id && !this.selectedMarkerId;
    return `
      <div class="axs-tree-node">
        <div class="axs-tree-row ${selected ? 'selected' : ''}" data-select-item-type="${t.id}">
          <span class="axs-disclosure axs-disclosure-lg ${hasMarkers ? '' : 'leaf'} ${isOpen ? 'open' : ''}" data-toggle-item-type-node="${t.id}">&#9656;</span>
          <span class="axs-tree-icon-itemtype">T</span>
          <span class="axs-tree-label">${this.escapeHtml(t.name)}</span>
          <span class="axs-tree-count">${markers.length} marker${markers.length === 1 ? '' : 's'}</span>
        </div>
        ${hasMarkers ? `<div class="axs-tree-children ${isOpen ? '' : 'collapsed'}">${markers.map(m => this.renderMarkerChipRow(t, m)).join('')}</div>` : ''}
      </div>
    `;
  }

  renderMarkerChipRow(t, m) {
    const selected = this.selectedItemTypeId === t.id && this.selectedMarkerId === m.id;
    return `
      <div class="axs-marker-chip-row" data-select-marker="${t.id}::${m.id}">
        <span class="axs-marker-chip ${selected ? 'selected' : ''}">${this.escapeHtml(m.name)}</span>
      </div>
    `;
  }

  renderItemTypeDetail(t) {
    const marker = this.selectedMarkerId ? this.markers.find(m => m.id === this.selectedMarkerId) : null;
    const body = marker
      ? this.renderMarkerGrantsBody(t, marker)
      : this.renderTypeLevelGrantsBody(t);
    return `
      <div class="axs-detail-header">
        <div class="axs-detail-title-row">
          <div class="axs-detail-title-group">
            <h1>${this.escapeHtml(t.name)}</h1>
            <span class="axs-type-pill">Item type</span>
          </div>
        </div>
        ${marker ? `<div class="axs-detail-sub">Marker: ${this.escapeHtml(marker.name)}</div>` : ''}
      </div>
      <div class="axs-tab-body">
        ${body}
      </div>
    `;
  }

  // --- Grant details: Group grants / User grants / Grant details -- shared chrome for both an
  // item type's own type-level read/create grants (no marker selected) and a marker's own six-
  // category grant (a marker chip selected); only the right-hand detail pane's content differs. ---

  renderMarkerGrantsBody(t, marker) {
    if (marker.scopeKind !== 'ITEM_TYPE') {
      return `<div class="axs-empty-hint">Grant details for ${this.escapeHtml(marker.scopeKind.toLowerCase())}-scoped markers are coming soon.</div>`;
    }
    return `
      <div class="axs-grant-layout">
        ${this.renderGrantsLeftColumn()}
        <div class="axs-grant-detail-pane">${this.renderGrantDetailPane(t)}</div>
      </div>
    `;
  }

  renderTypeLevelGrantsBody(t) {
    return `
      <div class="axs-grant-layout">
        ${this.renderGrantsLeftColumn()}
        <div class="axs-grant-detail-pane">${this.renderTypeLevelDetailPane()}</div>
      </div>
    `;
  }

  renderGrantsLeftColumn() {
    const roots = this.rootGroups();
    const groupTreeHtml = roots.length
      ? roots.map(g => this.renderGrantGroupTreeNode(g, 0)).join('')
      : '<div class="axs-directory-empty">No groups exist.</div>';
    const userListHtml = this.grantPrincipals.users.length
      ? this.grantPrincipals.users.map(u => `
          <div class="axs-tree-row ${this.grantSelection && this.grantSelection.kind === 'user' && this.grantSelection.id === u.id ? 'selected' : ''}" data-select-grant="user::${u.id}">
            <span class="axs-disclosure leaf"></span>
            <span class="axs-tree-icon-itemtype">U</span>
            <span class="axs-tree-label">${this.escapeHtml(u.name)}</span>
          </div>
        `).join('')
      : '<div class="axs-directory-empty">No users have this granted directly.</div>';
    const showUsersBlock = this.grantSelection && this.grantSelection.kind === 'group';

    return `
      <div class="axs-grant-left">
        <div>
          <div class="axs-grant-block-title">Group grants</div>
          <div class="axs-grant-list">${groupTreeHtml}</div>
        </div>
        <div>
          <div class="axs-grant-block-title">User grants <span class="axs-add-link" data-action="open-add-user-grant">+ Add</span></div>
          <div class="axs-grant-list">${userListHtml}</div>
        </div>
        ${showUsersBlock ? `
        <div>
          <div class="axs-grant-block-title">Members of this group</div>
          <div class="axs-grant-list">${this.renderGrantUsersPanel()}</div>
        </div>` : ''}
      </div>
    `;
  }

  // Same "always fully expanded, static chevron" convention as renderUserGroupTreeNode -- this
  // tree deliberately never collapses (the whole hierarchy has to stay visible, see its own
  // callers' history), so the chevron just indicates "has children" rather than toggling anything.
  renderGrantGroupTreeNode(g, depth) {
    const kids = this.childGroupsOf(g.id);
    const selected = this.grantSelection && this.grantSelection.kind === 'group' && this.grantSelection.id === g.id;
    return `
      <div class="axs-tree-node">
        <div class="axs-tree-row ${selected ? 'selected' : ''}" data-select-grant="group::${g.id}" style="padding-left:${12 + depth * 16}px">
          <span class="axs-disclosure axs-disclosure-lg ${kids.length ? 'open' : 'leaf'}">&#9656;</span>
          <span class="axs-tree-icon-group">G</span>
          <span class="axs-tree-label">${this.escapeHtml(g.name)}</span>
        </div>
        ${kids.length ? `<div class="axs-tree-children">${kids.map(k => this.renderGrantGroupTreeNode(k, depth + 1)).join('')}</div>` : ''}
      </div>
    `;
  }

  renderGrantUsersPanel() {
    const rows = [
      ...this.grantUsersPanelReach.direct.map(user => ({ user, hop: 'direct' })),
      ...this.grantUsersPanelReach.nested.map(({ user, viaGroupId }) => ({ user, hop: 'nested', viaGroupId })),
    ];
    if (!rows.length) return '<div class="axs-directory-empty">No members.</div>';
    return rows.map(({ user, hop, viaGroupId }) => {
      const viaName = hop === 'nested' ? (this.groups.find(x => x.id === viaGroupId)?.name || '?') : null;
      const sub = viaName ? `via ${this.escapeHtml(viaName)}` : this.escapeHtml(user.email || '');
      return `
        <div class="axs-directory-item" data-goto-user="${user.id}">
          <span class="axs-avatar">U</span>
          <span class="axs-directory-item-text">
            <span class="axs-directory-item-name">${this.escapeHtml(user.displayName)}</span>
            <span class="axs-directory-item-sub">${sub}</span>
          </span>
        </div>
      `;
    }).join('');
  }

  // Looks the name up in the full groups/users lists rather than grantPrincipals (which is
  // filtered to whoever has an own grant on the CURRENT target) -- the User/Group Permissions
  // tabs can have this principal selected while browsing a marker/item-type it has no own grant
  // on yet ("All markers" mode), where it wouldn't appear in grantPrincipals at all.
  grantPrincipalName() {
    return this.grantSelection.kind === 'group'
      ? (this.groups.find(g => g.id === this.grantSelection.id)?.name || '?')
      : (this.users.find(u => u.id === this.grantSelection.id)?.displayName || '?');
  }

  // Whether the selected principal has its own grant row on the CURRENT target -- checked against
  // grantPrincipals (populated per-target by fetchMarkerGrantPrincipals/fetchTypeLevelGrantPrincipals)
  // for both kinds alike. This used to shortcut to "always true" for a user, back when a user could
  // only ever be selected from a list that was itself already filtered to grant-holders (the Item
  // Type perspective's User grants list) -- the User Permissions tab's "All markers" mode breaks
  // that assumption by letting this exact user be selected while browsing a marker/item-type they
  // don't have yet, so both kinds now check the same way.
  grantHasOwn() {
    const list = this.grantSelection.kind === 'group' ? this.grantPrincipals.groups : this.grantPrincipals.users;
    return list.some(p => p.id === this.grantSelection.id);
  }

  // Shared by both detail panes: the selected principal's name plus Edit/Save/Cancel/Delete --
  // deliberately no "has no grant of its own" note (own-vs-inherited is now shown per leaf via the
  // dim/bright distinction below, so a separate summary line would just repeat it).
  renderGrantDetailHeader() {
    const hasOwnGrant = this.grantHasOwn();
    const editControls = this.grantEditing
      ? `<div class="axs-detail-actions-bar"><button class="axs-btn axs-btn-cancel" data-action="cancel-grant-edit">Cancel</button><button class="axs-btn axs-btn-primary" data-action="save-grant-edit">Save changes</button></div>`
      : `<div class="axs-detail-actions-bar"><button class="axs-btn axs-btn-cancel" data-action="start-grant-edit">Edit</button>${hasOwnGrant ? `<button class="axs-btn axs-btn-danger" data-action="open-delete-grant">Delete</button>` : ''}</div>`;
    return `<div class="axs-grant-detail-header"><span class="name">${this.escapeHtml(this.grantPrincipalName())}</span>${editControls}</div>`;
  }

  renderGrantDetailPane(t) {
    if (!this.grantSelection) {
      return '<div class="axs-empty-hint">Nobody has this marker yet. Use "+ Add" to grant it to a user directly, or grant it to a group from the Group perspective.</div>';
    }
    if (!this.grantOwn) return '<div class="axs-empty-hint">Loading…</div>';

    const own = this.grantOwn;
    const inherited = this.grantInherited || this.emptyGrant();
    const inheritedNames = this.grantInheritedNames || this.buildMarkerNameMap(own, [], false);
    const shadowNames = this.grantShadowNames || this.buildMarkerNameMap(own, [], false);

    return `
      ${this.renderGrantDetailHeader()}
      <div style="margin-bottom:16px;">
        ${this.renderItemCapRow('Read', own.itemRead, inherited.itemRead, 'item:read', inheritedNames.itemRead, shadowNames.itemRead)}
        ${this.renderItemCapRow('Delete', own.itemDelete, inherited.itemDelete, 'item:delete', inheritedNames.itemDelete, shadowNames.itemDelete)}
      </div>
      <div class="axs-gt-wrap"><div class="axs-gt-title">Properties</div>${this.renderPropertyGrantTree(t, own.properties, inherited.properties, inheritedNames.properties, shadowNames.properties)}</div>
      ${this.renderLinksGrantSection(t, own, inherited, inheritedNames, shadowNames)}
      <div class="axs-gt-wrap"><div class="axs-gt-title">State machines</div>${this.renderStateMachinesGrantSection(t, own, inherited, inheritedNames, shadowNames)}</div>
    `;
  }

  renderTypeLevelDetailPane() {
    if (!this.grantSelection) {
      return '<div class="axs-empty-hint">Nobody has type-level permissions on this item type yet. Use "+ Add" to grant it to a user directly, or grant it to a group from the Group perspective.</div>';
    }
    if (!this.typeLevelGrantOwn) return '<div class="axs-empty-hint">Loading…</div>';

    const own = this.typeLevelGrantOwn;
    const inherited = this.typeLevelGrantInherited || { read: false, create: false };
    const inheritedNames = this.typeLevelGrantInheritedNames || { read: [], create: [] };
    const shadowNames = this.typeLevelGrantShadowNames || { read: [], create: [] };

    return `
      ${this.renderGrantDetailHeader()}
      <div>
        ${this.renderItemCapRow('Read', own.read, inherited.read, 'item-type:read', inheritedNames.read, shadowNames.read)}
        ${this.renderItemCapRow('Create', own.create, inherited.create, 'item-type:create', inheritedNames.create, shadowNames.create)}
      </div>
    `;
  }

  // Checkmark-toggle matching ntrloc-access-old.js's own .perm-check, extended with the wireframe's
  // own vs. inherited distinction: checked-and-bright when this principal grants it directly
  // (own), checked-and-dimmed when only an ancestor group does (inherited, own=false), empty when
  // neither. A click always flips "own" -- toggling an inherited-only leaf makes it bright (now
  // granted directly too); toggling it off again drops back to dim, never to empty, since the
  // ancestor's own grant is untouched either way (see the [data-grant-field] click handler).
  // fieldKey is null in read-only mode, rendering a plain non-interactive span instead of a button.
  //
  // inheritedNames/shadowNames drive the wireframe's redundancy-warning badges: an "up" triangle
  // when this own grant is also inherited from an ancestor (inheritedNames non-empty -- redundant,
  // no additional effect), a "down" triangle when some descendant redundantly re-grants this same
  // leaf directly even though it already gets it from here (shadowNames non-empty). Shown in edit
  // mode too, not just read-only -- the whole point is to warn an admin *before* they save a
  // redundant grant, not after (when they'd have to immediately re-edit and revert it). Since
  // inheritedNames/shadowNames never change while editing a single leaf (only "own" toggles), a
  // badge whose condition is met at render time is emitted once with visibility keyed off "own",
  // then the [data-grant-field] click handler flips its `hidden` attribute live as "own" toggles,
  // with no re-render needed -- see that handler in bindEvents().
  permCheckHtml(own, inherited, fieldKey, inheritedNames, shadowNames) {
    const showCheck = own || inherited;
    const mark = showCheck ? '&#10003;' : '';
    const dim = !own && inherited;
    const classes = `axs-perm-check${showCheck ? ' granted' : ''}${dim ? ' dim' : ''}`;
    const check = fieldKey
      ? `<button type="button" class="${classes}" data-grant-field="${fieldKey}" data-granted="${own}" data-inherited="${inherited}">${mark}</button>`
      : `<span class="${classes}">${mark}</span>`;
    const hidden = !own;
    let warn = '';
    if (inheritedNames && inheritedNames.length) {
      warn += this.shadowWarnIcon('up', `Redundant: also inherited from ${inheritedNames.join(', ')}. Granting it here directly has no additional effect.`, hidden);
    }
    if (shadowNames && shadowNames.length) {
      const plural = shadowNames.length > 1;
      warn += this.shadowWarnIcon('down', `${shadowNames.join(', ')} redundantly re-grant${plural ? '' : 's'} this directly, even though ${plural ? 'they' : 'it'} already get${plural ? '' : 's'} it from here.`, hidden);
    }
    return check + warn;
  }

  // Ported from the wireframe's shadowWarnIcon -- a filled exclamation triangle, pointed "up" for
  // the redundant-with-ancestor badge, rotated 180° ("down") for the redundant-with-descendant one.
  shadowWarnIcon(direction, tooltip, hidden) {
    return `<span class="axs-shadow-warn ${direction}"${hidden ? ' hidden' : ''} title="${this.escapeHtml(tooltip)}"><svg viewBox="0 0 16 16" width="13" height="13">
      <path d="M8 1 L15 14 H1 Z" fill="currentColor"/>
      <rect x="7.15" y="5.4" width="1.7" height="4.3" rx="0.85" fill="var(--bg)"/>
      <circle cx="8" cy="11.6" r="0.95" fill="var(--bg)"/>
    </svg></span>`;
  }

  renderItemCapRow(label, own, inherited, fieldKey, inheritedNames, shadowNames) {
    const check = this.permCheckHtml(own, inherited, this.grantEditing ? fieldKey : null, inheritedNames, shadowNames);
    return `<div class="axs-itemcap-row"><span class="axs-itemcap-label">${label}</span>${check}</div>`;
  }

  // bulkInfo ({ leafIds, ownMap }) is only ever passed for an OBJECT-property container row (see
  // renderPropertyGrantTree's walk) -- every other caller passes hasChildren=false, so it's unused.
  renderGrantTreeRow(name, depth, hasChildren, ownEntry, inheritedEntry, category, id, fields, inheritedNamesEntry, shadowNamesEntry, bulkInfo) {
    const cells = fields.map(f => {
      if (hasChildren) {
        if (!this.grantEditing || !bulkInfo) return `<div class="axs-gt-cell axs-gt-dash">&mdash;</div>`;
        const state = this.containerFieldState(bulkInfo.leafIds, f, bulkInfo.ownMap);
        if (state === null) return `<div class="axs-gt-cell axs-gt-dash">&mdash;</div>`;
        return `<div class="axs-gt-cell">${this.bulkPermCheckHtml(state, category, id, f, bulkInfo.leafIds)}</div>`;
      }
      const own = ownEntry ? !!ownEntry[f] : false;
      const inherited = inheritedEntry ? !!inheritedEntry[f] : false;
      const inheritedNames = inheritedNamesEntry ? (inheritedNamesEntry[f] || []) : [];
      const shadowNames = shadowNamesEntry ? (shadowNamesEntry[f] || []) : [];
      const check = this.permCheckHtml(own, inherited, this.grantEditing ? `${category}:${id}:${f}` : null, inheritedNames, shadowNames);
      return `<div class="axs-gt-cell">${check}</div>`;
    }).join('');
    return `<div class="axs-gt-row"><div class="axs-gt-name-cell" style="padding-left:${depth * 16}px">${this.escapeHtml(name)}</div>${cells}</div>`;
  }

  // Every leaf (non-OBJECT) property id nested under an OBJECT container, recursively -- a
  // container's own id is never a grant target, only its leaves' are (mirrors ntrloc-access-old.
  // js's leavesUnder/RegisterPartitionManager's propertyPaths walk).
  leafPropertyIdsUnder(node) {
    if (node.type !== 'OBJECT') return [node.id];
    return (node.properties || []).flatMap(child => this.leafPropertyIdsUnder(child));
  }

  // 'all' | 'partial' | 'none' | null (null = no leaf under this container -- renders as a blank
  // dash rather than a clickable bulk toggle). Aggregates "own" only, matching exactly what a
  // click here would flip -- an inherited-but-not-own leaf (dim checkmark) still counts toward
  // "none" here, since bulk-granting it directly is still a real, non-redundant action.
  containerFieldState(leafIds, field, ownMap) {
    if (!leafIds.length) return null;
    const grantedCount = leafIds.filter(id => !!(ownMap.get(id) || {})[field]).length;
    if (grantedCount === 0) return 'none';
    return grantedCount === leafIds.length ? 'all' : 'partial';
  }

  // Bulk "select all descendants" toggle for an OBJECT-property container row. Unlike a leaf's
  // own checkbox, this never PUTs anything itself -- edit mode is pure DOM state until Save (see
  // saveMarkerGrantEdit/saveTypeLevelGrantEdit's own [data-grant-field] scan), so the click
  // handler below just synthesizes a click on every descendant leaf's own checkbox, reusing that
  // handler's DOM-mutation logic (classes/text/shadow-warn badges) instead of duplicating it.
  bulkPermCheckHtml(state, category, id, field, leafIds) {
    const label = state === 'all' ? '&#10003;' : state === 'partial' ? '&#8211;' : '';
    const classes = `axs-perm-check${state === 'all' ? ' granted' : ''}${state === 'partial' ? ' partial' : ''}`;
    return `<button type="button" class="${classes}" data-bulk-container-field="${category}:${id}:${field}" data-bulk-state="${state}" data-bulk-leaf-ids="${leafIds.join(',')}">${label}</button>`;
  }

  // Recomputes one bulk toggle's all/partial/none display from its descendant leaves' current DOM
  // state -- called both after the bulk toggle's own synthesized clicks and after any independent
  // edit to one of its leaves, so the aggregate never drifts from what the leaves actually show.
  syncBulkContainerDisplay(bulkEl, category, field, leafIds) {
    const grantedCount = leafIds.filter(id => {
      const leaf = this.querySelector(`[data-grant-field="${category}:${id}:${field}"]`);
      return leaf && leaf.dataset.granted === 'true';
    }).length;
    const state = grantedCount === 0 ? 'none' : grantedCount === leafIds.length ? 'all' : 'partial';
    bulkEl.dataset.bulkState = state;
    bulkEl.classList.toggle('granted', state === 'all');
    bulkEl.classList.toggle('partial', state === 'partial');
    bulkEl.textContent = state === 'all' ? '✓' : state === 'partial' ? '–' : '';
  }

  wrapGrantGrid(rowsHtml, headerLabels) {
    const headerCells = headerLabels.map(l => `<div class="axs-gt-header">${l}</div>`).join('');
    return `<div class="axs-gt-grid-scroll"><div class="axs-gt-grid" style="grid-template-columns: minmax(80px,1fr) ${headerLabels.map(() => '54px').join(' ')};">
      <div class="axs-gt-name-cell axs-gt-header"></div>${headerCells}
      ${rowsHtml}
    </div></div>`;
  }

  renderPropertyGrantTree(t, ownMap, inheritedMap, inheritedNamesMap, shadowNamesMap) {
    const schema = this.itemTypeSchema(t.id);
    const props = schema ? schema.properties : [];
    if (!props.length) return '<div class="axs-empty-hint">Nothing defined on this scope.</div>';
    const rows = [];
    const walk = (nodes, depth) => {
      for (const node of nodes) {
        const hasChildren = node.type === 'OBJECT' && node.properties && node.properties.length > 0;
        const bulkInfo = hasChildren ? { leafIds: this.leafPropertyIdsUnder(node), ownMap } : null;
        rows.push(this.renderGrantTreeRow(node.name, depth, hasChildren,
          hasChildren ? null : ownMap.get(node.id), hasChildren ? null : inheritedMap.get(node.id),
          'property', node.id, ['read', 'write'],
          hasChildren ? null : inheritedNamesMap.get(node.id), hasChildren ? null : shadowNamesMap.get(node.id),
          bulkInfo));
        if (hasChildren) walk(node.properties, depth + 1);
      }
    };
    walk(props, 0);
    return this.wrapGrantGrid(rows.join(''), ['Read', 'Write']);
  }

  // A link's own properties are shared by both perspectives of the link (marker_grant_link_
  // property isn't perspective-scoped), so each perspective block nests the same lookup by linkId
  // -- for the (common) case of one perspective per scope this reads as a single Links+Properties
  // pair; a scope with more than one outbound perspective gets the block repeated per perspective,
  // matching the real schema editor's own per-perspective property grouping.
  renderLinksGrantSection(t, own, inherited, inheritedNames, shadowNames) {
    const schema = this.itemTypeSchema(t.id);
    const linksMap = schema ? (schema.links || {}) : {};
    const perspectiveNames = Object.keys(linksMap);
    if (!perspectiveNames.length) {
      return `<div class="axs-gt-wrap"><div class="axs-gt-title">Links</div><div class="axs-empty-hint">No links defined on this scope.</div></div>`;
    }
    const blocks = perspectiveNames.map(name => {
      const persp = linksMap[name][0];
      const row = this.renderGrantTreeRow(name, 0, false, own.linkPerspectives.get(persp.id), inherited.linkPerspectives.get(persp.id), 'linkpersp', persp.id, ['create', 'read', 'delete'], inheritedNames.linkPerspectives.get(persp.id), shadowNames.linkPerspectives.get(persp.id));
      const linkType = (this.schema.links || []).find(l => l.id === persp.linkId);
      const linkProps = linkType ? linkType.properties : [];
      const propGrid = linkProps.length
        ? this.wrapGrantGrid(linkProps.map(p => this.renderGrantTreeRow(p.name, 0, false, own.linkProperties.get(p.id), inherited.linkProperties.get(p.id), 'linkprop', p.id, ['read', 'write'], inheritedNames.linkProperties.get(p.id), shadowNames.linkProperties.get(p.id))).join(''), ['Read', 'Write'])
        : '<div class="axs-empty-hint" style="padding:2px 0;">No properties on this link.</div>';
      return `
        ${this.wrapGrantGrid(row, ['Create', 'Read', 'Delete'])}
        <div class="axs-gt-subblock">
          <span class="axs-gt-subblock-label">Properties</span>
          ${propGrid}
        </div>
      `;
    }).join('<div style="height:14px;"></div>');
    return `<div class="axs-gt-wrap"><div class="axs-gt-title">Links</div>${blocks}</div>`;
  }

  renderStateMachinesGrantSection(t, own, inherited, inheritedNames, shadowNames) {
    const schema = this.itemTypeSchema(t.id);
    const machines = schema ? (schema.stateMachines || []) : [];
    if (!machines.length) return '<div class="axs-empty-hint">No state machines on this scope.</div>';
    return machines.map(machine => {
      const startOwn = own.stateMachineStartIds.has(machine.id);
      const startInherited = inherited.stateMachineStartIds.has(machine.id);
      const startCheck = this.permCheckHtml(startOwn, startInherited, this.grantEditing ? `smstart:${machine.id}` : null, inheritedNames.stateMachineStartIds.get(machine.id), shadowNames.stateMachineStartIds.get(machine.id));
      const machineRow = `<div class="axs-gt-row"><div class="axs-gt-name-cell">${this.escapeHtml(machine.name)}</div><div class="axs-gt-cell">${startCheck}</div></div>`;
      const machineGrid = this.wrapGrantGrid(machineRow, ['Start']);

      const transitions = [];
      for (const state of machine.states) {
        for (const tr of state.transitions) transitions.push({ ...tr, fromStateName: state.name });
      }
      const transRows = transitions.map(tr => {
        const trOwn = own.transitionIds.has(tr.id);
        const trInherited = inherited.transitionIds.has(tr.id);
        const check = this.permCheckHtml(trOwn, trInherited, this.grantEditing ? `transition:${tr.id}` : null, inheritedNames.transitionIds.get(tr.id), shadowNames.transitionIds.get(tr.id));
        return `<div class="tr-row"><div class="tr-cell">${this.escapeHtml(this.prettyStateName(tr.fromStateName))}</div><div class="tr-cell">${this.escapeHtml(tr.name)}</div><div class="tr-cell">${this.escapeHtml(this.prettyStateName(tr.toStateName))}</div><div class="tr-cell tr-verb">${check}</div></div>`;
      }).join('');
      const transTable = transitions.length
        ? `<div class="axs-transitions-grid"><div class="tr-header">From</div><div class="tr-header">Transition</div><div class="tr-header">To</div><div class="tr-header tr-verb">Exec</div>${transRows}</div>`
        : '<div class="axs-empty-hint" style="padding:2px 0;">No transitions</div>';
      return `${machineGrid}<div class="axs-gt-subblock"><span class="axs-gt-subblock-label">Transitions</span>${transTable}</div>`;
    }).join('<div style="height:14px;"></div>');
  }

  prettyStateName(name) { return name === '__start__' ? 'Start' : name === '__end__' ? 'End' : name; }

  renderAddUserGrantModalBody() {
    const filter = this.userGrantModalFilterText.trim().toLowerCase();
    const alreadyGranted = new Set(this.grantPrincipals.users.map(u => u.id));
    const candidates = this.users
      .filter(u => !alreadyGranted.has(u.id))
      .filter(u => !filter || u.displayName.toLowerCase().includes(filter) || (u.email || '').toLowerCase().includes(filter))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    const rows = candidates.length
      ? candidates.map(u => `
          <div class="axs-directory-item" data-add-user-grant="${u.id}">
            <span class="axs-avatar">U</span>
            <span class="axs-directory-item-text">
              <span class="axs-directory-item-name">${this.escapeHtml(u.displayName)}</span>
              <span class="axs-directory-item-sub">${this.escapeHtml(u.email || '')}</span>
            </span>
          </div>
        `).join('')
      : '<div class="axs-directory-empty">No users match.</div>';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Add user grant</div>
          <div class="axs-modal-body">
            <input type="text" id="axs-add-user-grant-filter-input" placeholder="Filter users…" value="${this.escapeHtml(this.userGrantModalFilterText)}">
            <div class="axs-grant-list" style="margin-top:10px;max-height:260px;overflow-y:auto;">${rows}</div>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  renderConfirmDeleteGrantModalBody() {
    const principalName = this.grantPrincipalName();
    const marker = this.selectedMarkerId ? this.markers.find(m => m.id === this.selectedMarkerId) : null;
    const targetName = marker ? marker.name : 'these type-level permissions';
    return `
      <div class="axs-modal-overlay" data-action="close-modal-overlay">
        <div class="axs-modal" data-stop-overlay>
          <div class="axs-modal-header">Delete grant</div>
          <div class="axs-modal-body">
            <p>Delete <b>${this.escapeHtml(targetName)}</b> from <b>${this.escapeHtml(principalName)}</b>? ${this.grantSelection.kind === 'group' ? 'Its members lose whatever this granted them directly, though they may still have access through an ancestor group.' : 'This user loses whatever this granted them directly.'}</p>
          </div>
          <div class="axs-modal-footer">
            <button class="axs-btn axs-btn-cancel" data-action="close-modal">Cancel</button>
            <button class="axs-btn axs-btn-danger" data-action="submit-delete-grant">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Event wiring
  // =========================================================================

  bindEvents() {
    this.querySelectorAll('[data-perspective]').forEach(el => {
      el.addEventListener('click', () => this.switchPerspective(el.dataset.perspective));
    });

    // --- User perspective ---
    this.querySelectorAll('[data-select-user]').forEach(el => {
      el.addEventListener('click', () => this.selectUser(el.dataset.selectUser));
    });
    this.querySelectorAll('[data-goto-user]').forEach(el => {
      el.addEventListener('click', () => this.selectUser(el.dataset.gotoUser));
    });
    this.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        this.error = '';
        this.activeTab = el.dataset.tab;
        if (el.dataset.tab === 'groups') this.enterGroupsTab();
        else if (el.dataset.tab === 'permissions') this.enterPermissionsTab('user', this.selectedUser());
        else this.render();
      });
    });

    this.wireFilterInput('axs-user-filter-input', v => { this.userFilterText = v; });

    this.querySelector('[data-action="toggle-reset-password"]')?.addEventListener('click', () => {
      this.resetPasswordOpen = !this.resetPasswordOpen;
      this.render();
    });
    this.querySelector('[data-action="reset-password"]')?.addEventListener('click', () => this.resetPassword());
    this.querySelector('[data-action="create-token"]')?.addEventListener('click', () => this.createToken());
    this.querySelector('[data-action="copy-created-token"]')?.addEventListener('click', () => this.copyCreatedToken());
    this.querySelectorAll('[data-revoke-token]').forEach(el => {
      el.addEventListener('click', () => this.revokeToken(el.dataset.revokeToken));
    });

    this.querySelector('[data-action="open-add-user"]')?.addEventListener('click', () => {
      this.modal = { type: 'add-user' };
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="submit-add-user"]')?.addEventListener('click', () => this.createUser());
    this.querySelector('[data-action="open-edit-user"]')?.addEventListener('click', () => {
      this.modal = { type: 'edit-user', userId: this.selectedUserId };
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="submit-edit-user"]')?.addEventListener('click', () => this.submitEditUser());
    this.querySelector('[data-action="open-delete-user"]')?.addEventListener('click', () => {
      this.modal = { type: 'confirm-delete-user', userId: this.selectedUserId };
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="submit-delete-user"]')?.addEventListener('click', () => this.submitDeleteUser());

    this.querySelectorAll('[data-select-user-group-tree]').forEach(el => {
      el.addEventListener('click', () => this.selectUserGroupTreeNode(el.dataset.selectUserGroupTree));
    });
    this.querySelector('[data-action="open-edit-membership"]')?.addEventListener('click', () => {
      this.modal = { type: 'edit-membership' };
      this.error = '';
      this.render();
    });
    this.querySelector('[data-action="submit-edit-membership"]')?.addEventListener('click', () => this.submitEditMembership());

    // --- Group perspective ---
    this.querySelectorAll('[data-select-group]').forEach(el => {
      el.addEventListener('click', () => this.selectGroup(el.dataset.selectGroup));
    });
    this.querySelectorAll('[data-toggle-group-node]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.toggleGroupNode;
        if (this.closedGroupNodes.has(id)) this.closedGroupNodes.delete(id); else this.closedGroupNodes.add(id);
        this.render();
      });
    });
    this.querySelectorAll('[data-group-tab]').forEach(el => {
      el.addEventListener('click', () => {
        this.groupActiveTab = el.dataset.groupTab;
        this.groupError = '';
        if (this.groupActiveTab === 'permissions') this.enterPermissionsTab('group', this.selectedGroup());
        else this.render();
      });
    });
    // Shared by the Group and User perspectives' own Permissions tabs -- whichever perspective is
    // currently active determines the principal these act on (only one is ever visible at a time).
    this.querySelectorAll('[data-perm-mode]').forEach(el => {
      el.addEventListener('change', () => {
        if (!el.checked) return;
        const [kind, principal] = this.perspective === 'group' ? ['group', this.selectedGroup()] : ['user', this.selectedUser()];
        this.setPermMode(el.value, kind, principal);
      });
    });
    this.querySelectorAll('[data-select-perm-itemtype]').forEach(el => {
      el.addEventListener('click', () => {
        const [kind, principal] = this.perspective === 'group' ? ['group', this.selectedGroup()] : ['user', this.selectedUser()];
        if (principal) this.selectPermItemType(kind, principal.id, el.dataset.selectPermItemtype);
      });
    });
    this.querySelectorAll('[data-select-perm-marker]').forEach(el => {
      el.addEventListener('click', () => {
        const [kind, principal] = this.perspective === 'group' ? ['group', this.selectedGroup()] : ['user', this.selectedUser()];
        const [itemTypeId, markerId] = el.dataset.selectPermMarker.split('::');
        if (principal) this.selectPermMarker(kind, principal.id, itemTypeId, markerId);
      });
    });
    this.wireFilterInput('axs-group-filter-input', v => { this.groupFilterText = v; });
    this.wireFilterInput('axs-group-membership-filter-input', v => { this.groupMembershipFilter = v; });
    this.wireFilterInput('axs-add-group-members-filter', v => { this.addGroupMembersFilter = v; });

    this.querySelector('[data-action="start-rename-group"]')?.addEventListener('click', () => this.startRenameGroup());
    this.querySelector('[data-action="cancel-rename-group"]')?.addEventListener('click', () => this.cancelRenameGroup());
    this.querySelector('[data-action="submit-rename-group"]')?.addEventListener('click', () => this.submitRenameGroup());

    this.querySelector('[data-action="open-add-group"]')?.addEventListener('click', () => {
      this.modal = { type: 'add-group' };
      this.groupError = '';
      this.render();
    });
    this.querySelector('[data-action="submit-add-group"]')?.addEventListener('click', () => this.createGroup());

    this.querySelector('[data-action="open-move-group"]')?.addEventListener('click', () => {
      this.modal = { type: 'move-group', groupId: this.selectedGroupId };
      this.groupError = '';
      this.render();
    });
    this.querySelector('[data-action="submit-move-group"]')?.addEventListener('click', () => this.submitMoveGroup());

    this.querySelector('[data-action="open-delete-group"]')?.addEventListener('click', () => {
      this.modal = { type: 'confirm-delete-group', groupId: this.selectedGroupId };
      this.groupError = '';
      this.render();
    });
    this.querySelector('[data-action="submit-delete-group"]')?.addEventListener('click', () => this.submitDeleteGroup());

    this.querySelector('[data-action="open-add-group-members"]')?.addEventListener('click', () => {
      this.modal = { type: 'add-group-members', groupId: this.selectedGroupId };
      this.addGroupMembersFilter = '';
      this.groupError = '';
      this.render();
    });
    this.querySelector('[data-action="submit-add-group-members"]')?.addEventListener('click', () => this.submitAddGroupMembers());

    this.querySelectorAll('[data-open-remove-member]').forEach(el => {
      el.addEventListener('click', () => {
        this.modal = { type: 'confirm-remove-member', userId: el.dataset.openRemoveMember, groupId: this.selectedGroupId };
        this.render();
      });
    });
    this.querySelector('[data-action="submit-remove-member"]')?.addEventListener('click', () => this.submitRemoveMember());

    // --- Item Type perspective ---
    this.querySelectorAll('[data-select-item-type]').forEach(el => {
      el.addEventListener('click', () => this.selectItemType(el.dataset.selectItemType));
    });
    this.querySelectorAll('[data-toggle-item-type-node]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.toggleItemTypeNode;
        if (this.closedItemTypeNodes.has(id)) this.closedItemTypeNodes.delete(id); else this.closedItemTypeNodes.add(id);
        this.render();
      });
    });
    this.querySelectorAll('[data-select-marker]').forEach(el => {
      el.addEventListener('click', () => {
        const [itemTypeId, markerId] = el.dataset.selectMarker.split('::');
        this.enterMarkerGrants(itemTypeId, markerId);
      });
    });
    this.wireFilterInput('axs-itemtype-filter-input', v => { this.itemTypeFilterText = v; });
    this.querySelectorAll('[data-select-grant]').forEach(el => {
      el.addEventListener('click', () => {
        const [kind, id] = el.dataset.selectGrant.split('::');
        this.selectGrantPrincipal(kind, id);
      });
    });
    this.querySelector('[data-action="open-add-user-grant"]')?.addEventListener('click', () => this.openAddUserGrantModal());
    // Toggles its own button in place -- read at Save time via dataset.granted, no re-render needed
    // per click. dataset.inherited is static (set once at render from the ancestor-only grant) so a
    // leaf that's only ever inherited never goes fully empty here: unchecking it just drops back to
    // checked-and-dim (still inherited) rather than clearing the checkmark outright.
    this.querySelectorAll('[data-grant-field]').forEach(el => {
      el.addEventListener('click', () => {
        const next = el.dataset.granted !== 'true';
        el.dataset.granted = String(next);
        const inherited = el.dataset.inherited === 'true';
        const showCheck = next || inherited;
        el.classList.toggle('granted', showCheck);
        el.classList.toggle('dim', !next && inherited);
        el.textContent = showCheck ? '✓' : '';
        // Any shadow-warning badge(s) rendered alongside this checkbox (permCheckHtml only emits
        // one when the leaf's own value would make it redundant) live-toggle with "own" -- so an
        // admin sees the warning *before* saving a redundant grant, not after.
        el.parentElement.querySelectorAll(':scope > .axs-shadow-warn').forEach(w => { w.hidden = !next; });
        // If this leaf sits under an OBJECT-container bulk toggle (possibly more than one, for
        // nested containers), keep that toggle's all/partial/none display honest even when the
        // leaf was flipped independently rather than via the bulk toggle itself.
        const parts = el.dataset.grantField.split(':');
        if (parts.length === 3) {
          const [category, leafId, field] = parts;
          this.querySelectorAll(`[data-bulk-container-field^="${category}:"][data-bulk-container-field$=":${field}"]`).forEach(bulkEl => {
            const leafIds = (bulkEl.dataset.bulkLeafIds || '').split(',').filter(Boolean);
            if (leafIds.includes(leafId)) this.syncBulkContainerDisplay(bulkEl, category, field, leafIds);
          });
        }
      });
    });
    // OBJECT-container bulk toggle: 'partial'/'none' -> grant the field on every descendant leaf,
    // 'all' -> revoke it on all of them. Synthesizes a click on each leaf's own [data-grant-field]
    // button rather than duplicating its DOM-mutation logic (see bulkPermCheckHtml's comment) --
    // Save still only ever reads real [data-grant-field] elements, so this control itself is never
    // part of that scan. The leaf handler above re-syncs this toggle's own display once every
    // synthesized click lands, so no separate display update is needed here.
    this.querySelectorAll('[data-bulk-container-field]').forEach(el => {
      el.addEventListener('click', () => {
        const [category, , field] = el.dataset.bulkContainerField.split(':');
        const leafIds = el.dataset.bulkLeafIds ? el.dataset.bulkLeafIds.split(',').filter(Boolean) : [];
        const nextValue = el.dataset.bulkState !== 'all';
        leafIds.forEach(leafId => {
          const leaf = this.querySelector(`[data-grant-field="${category}:${leafId}:${field}"]`);
          if (leaf && (leaf.dataset.granted === 'true') !== nextValue) leaf.click();
        });
      });
    });
    this.querySelector('[data-action="start-grant-edit"]')?.addEventListener('click', () => this.startGrantEdit());
    this.querySelector('[data-action="cancel-grant-edit"]')?.addEventListener('click', () => this.cancelGrantEdit());
    this.querySelector('[data-action="save-grant-edit"]')?.addEventListener('click', () => this.saveGrantEdit());
    this.querySelector('[data-action="open-delete-grant"]')?.addEventListener('click', () => {
      this.modal = { type: 'confirm-delete-grant' };
      this.render();
    });
    this.querySelector('[data-action="submit-delete-grant"]')?.addEventListener('click', () => this.deleteGrantForSelection());
    this.querySelectorAll('[data-add-user-grant]').forEach(el => {
      el.addEventListener('click', () => this.submitAddUserGrant(el.dataset.addUserGrant));
    });
    this.wireFilterInput('axs-add-user-grant-filter-input', v => { this.userGrantModalFilterText = v; });

    // --- Modal chrome (shared) ---
    this.querySelector('[data-action="close-modal"]')?.addEventListener('click', () => {
      if (this.modal?.type === 'token-reveal') { this.closeTokenRevealModal(); return; }
      this.modal = null;
      this.error = '';
      this.groupError = '';
      this.render();
    });
    this.querySelector('[data-action="close-modal-overlay"]')?.addEventListener('click', (e) => {
      if (!e.target.closest('[data-stop-overlay]')) {
        if (this.modal?.type === 'token-reveal') { this.closeTokenRevealModal(); return; }
        this.modal = null;
        this.error = '';
        this.groupError = '';
        this.render();
      }
    });
  }

  // Cursor-preservation pattern shared by every live-filter input on this screen -- render()
  // replaces the input's own DOM node on every keystroke (same as the rest of this component),
  // which would otherwise drop focus after each character typed.
  wireFilterInput(id, onChange) {
    const input = this.querySelector(`#${id}`);
    if (!input) return;
    input.addEventListener('input', (e) => {
      const cursor = e.target.selectionStart;
      onChange(e.target.value);
      this.render();
      const el = this.querySelector(`#${id}`);
      if (el) { el.focus(); el.setSelectionRange(cursor, cursor); }
    });
  }
}

customElements.define('ntrloc-access', NtrlocAccess);
