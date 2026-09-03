injectStyles('ntrloc-search-styles', `
  ntrloc-search {
    display: contents;
  }
  .search-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 0 16px;
  }
  .panes-container {
    position: relative;
    flex: 1;
    min-height: 0;
    display: grid;
    grid-auto-rows: 1fr;
    gap: 12px;
    padding: 16px;
    overflow: auto;
  }
  .pane {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 300px;
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  /* Overlays on top of (rather than reflowing) the grid, so the other panes stay exactly
     where they were underneath -- restoring just removes this, needing no position bookkeeping
     since the pane never actually left its grid slot. */
  .pane.is-maximized {
    position: absolute;
    inset: 16px;
    z-index: 10;
  }
  /* The dragged pane itself, left behind in its (live-reordered) slot as an empty dashed
     placeholder -- the actual pane content follows the cursor via the browser's native drag
     image, captured before this class is applied (see the dragstart handler). */
  .pane.is-drag-source {
    background: transparent;
    border: 2px dashed var(--accent);
  }
  .pane.is-drag-source > * {
    visibility: hidden;
  }
  .pane-header[draggable="true"] {
    cursor: grab;
  }
  .pane-header[draggable="true"]:active {
    cursor: grabbing;
  }
  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 14px;
    height: 40px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid var(--border);
  }
  .pane-title {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .pane-controls {
    display: flex;
    align-items: center;
  }
  .control-btn {
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
  }
  .control-btn:hover {
    color: var(--text);
  }
  .control-btn.close-btn:hover {
    color: #ef5350;
  }
  .pane-body {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
  }
  .query-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .query-row, .sort-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sort-label {
    font-size: 12px;
    color: var(--muted);
    flex-shrink: 0;
  }
  .page-size-input {
    width: 72px;
    flex-shrink: 0;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
  }
  .query-select {
    flex: 1;
    min-width: 140px;
  }
  /* A hand-rolled dropdown, not md-outlined-select -- see renderFieldPicker's own comment for why
     (a native/Material select can't render non-selectable indented group headers plus an inline
     search box at arbitrary nesting depth). Sized/styled to sit inline with .query-select. */
  .field-picker {
    position: relative;
    flex: 1;
    min-width: 140px;
  }
  .field-picker-toggle {
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-picker-toggle:hover {
    border-color: var(--accent);
  }
  .field-picker-popup {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    max-height: 320px;
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .field-picker-search {
    flex-shrink: 0;
    margin: 6px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
  }
  .field-tree-list {
    overflow-y: auto;
    padding-bottom: 4px;
  }
  .field-tree-none {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    border: none;
    background: none;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .field-tree-none:hover, .field-tree-leaf:hover {
    background: var(--bg);
  }
  /* Container rows -- plain labels, never clickable (an OBJECT property is never itself a valid
     sort/filter target, only its scalar leaves are -- see SortableFieldView). */
  .field-tree-group {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .field-tree-leaf {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    border: none;
    background: none;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .field-tree-empty {
    padding: 6px 12px;
    font-size: 13px;
    color: var(--muted);
    font-style: italic;
  }
  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .filter-op {
    font-size: 13px;
    color: var(--muted);
    flex-shrink: 0;
  }
  .filter-value-input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
  }
  .filter-remove-button {
    flex-shrink: 0;
  }
  .add-filter-button {
    align-self: flex-start;
  }
  .results-summary {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .result-item {
    margin: 0;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .view-toggle {
    display: flex;
    align-items: center;
    margin-left: auto;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .view-toggle button {
    padding: 5px 12px;
    background: transparent;
    color: var(--muted);
    border: none;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .view-toggle button.active {
    background: var(--accent);
    color: #fff;
  }
  .view-toggle button:not(.active):hover {
    background: rgba(74, 158, 255, 0.1);
    color: var(--text);
  }
  .pager {
    display: flex;
    gap: 6px;
  }
  .pager button {
    padding: 4px 10px;
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  .pager button:hover:not(:disabled) {
    background: rgba(74, 158, 255, 0.1);
    border-color: var(--accent);
  }
  .pager button:disabled {
    color: var(--muted);
    cursor: default;
    opacity: 0.5;
  }
  .item-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .item-card + .item-card {
    margin-top: 12px;
    border-top: 2px solid rgba(74, 158, 255, 0.5);
  }
  .item-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.02);
  }
  .item-card-title {
    font-weight: 600;
    font-size: 13px;
  }
  .item-card-id {
    font-size: 11px;
    color: var(--muted);
    font-family: monospace;
    margin-left: 8px;
  }
  .item-card-actions button:not(.edit-link-button):not(.delete-item-button) {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    transition: all 0.15s;
  }
  .item-card-actions button:not(.edit-link-button):not(.delete-item-button):hover {
    color: var(--text);
    border-color: var(--accent);
  }
  .item-card-actions button.editing {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  /* flex-wrap, not grid -- a grid's auto-fill/minmax tracks are all the SAME width, which is
     right for a row of scalar properties alone but wrong once an OBJECT property (see
     .object-property-row below) needs to size to its own content instead of stretching to fill
     a uniform column. flex-wrap lets every row claim only the width it actually needs and wrap
     onto a new line once the row runs out of room, scalar and object properties side by side. */
  .prop-grid {
    display: flex;
    flex-wrap: wrap;
    font-size: 13px;
    padding: 4px 0;
  }
  /* Label above value, not beside it -- reads better once an OBJECT property is in the mix
     (see .object-property-row below): a fixed-width side-by-side key column has no good answer
     for "the value is itself a whole nested panel", where stacking does. Kept for every property
     now, not just object-typed ones, so a card doesn't mix two different row shapes side by side.
     flex-basis/min-width here is the top-level default (a bare item card's own .prop-grid);
     :where(.nested-object-grid) below overrides both to a smaller basis for nested OBJECT
     properties' own fields, same as the old grid's separate minmax value did. */
  .prop-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 14px;
    flex: 1 1 300px;
    min-width: 300px;
  }
  .prop-row:hover {
    background: rgba(74, 158, 255, 0.04);
  }
  .prop-key {
    color: var(--accent);
    opacity: 0.75;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.02em;
  }
  .prop-value {
    width: 100%;
    word-break: break-word;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
  }
  .prop-value .value-text {
    flex: 1;
  }
  .prop-value .value-null {
    color: var(--muted);
    font-style: italic;
  }
  .prop-value .prop-image {
    max-width: 100%;
    max-height: 120px;
    object-fit: contain;
    border-radius: 3px;
  }
  .prop-value input,
  .prop-value textarea,
  .prop-value select {
    flex: 1;
    padding: 4px 8px;
    background: transparent;
    color: var(--text);
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .prop-value input:focus,
  .prop-value textarea:focus,
  .prop-value select:focus {
    border-bottom-color: var(--accent);
  }
  /* Same fix as ntrloc-item-detail.js's .pending-link-cardinality input -- Chrome/Safari's native
     number-input spinner renders as an opaque white box with tiny dark arrows (inverting its
     colors was tried first, but at native size the arrows are too small to register as a control
     worth keeping), and there's no way to actually restyle/enlarge it, only hide it. The input's
     own type="number" (see inputTypeFor) still gets the browser's native numeric keyboard/
     validation/scroll-to-change behavior -- only the spin buttons themselves are gone. */
  .prop-value input[type=number]::-webkit-inner-spin-button,
  .prop-value input[type=number]::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  .prop-value input[type=number] {
    -moz-appearance: textfield;
  }
  .prop-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .prop-actions button {
    width: 22px;
    height: 22px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--muted);
    border-radius: 3px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .prop-actions button:hover {
    background: rgba(74, 158, 255, 0.1);
    color: var(--accent);
  }
  .prop-actions button.delete-btn:hover {
    background: rgba(248, 81, 73, 0.1);
    color: #ef5350;
  }
  .prop-key.removed {
    color: #ef5350;
    text-decoration: line-through;
  }
  .prop-value.removed {
    color: var(--muted);
    font-style: italic;
    text-decoration: line-through;
  }
  .add-prop-row {
    padding: 8px 14px;
  }
  /* A nested OBJECT property's value, rendered by renderObjectPropRow as a <details> standing in
     for the whole .prop-row -- native <details> rather than the click-tracked-state approach
     .link-group-header uses below, since an object property can appear (and itself nest
     arbitrarily deep) inside any property row in any item card, at any depth: tracking "which
     panels are open" as explicit component state the way .collapsedLinkGroups does for the one
     flat, per-item, non-recursive case would mean a per-item-per-property-per-nesting-path key
     space instead of a single Set. The browser already tracks each <details>'s own open/closed
     state for free, so this reuses that instead, closed by default so a large item card isn't
     overwhelmed by every nested field showing at once. The chevron sits with the label in
     <summary> (the actual toggle) rather than inside the value, matching every other row's own
     label-above-value shape -- the property's *name* is what's being expanded, same as a link
     group's name is above. */
  /* Deliberately NOT opted out of .prop-row's flex-grow/basis -- an OBJECT property's panel
     shares leftover row space evenly with its scalar siblings (same flex-grow:1 from the base
     .prop-row rule, and the same 300px/140px/200px basis-by-context from :where() below) rather
     than sizing to bare content and leaving every extra pixel to the siblings around it. Its own
     content still reflows to whatever width it ends up with -- .nested-object-grid inside is
     itself flex-wrap, so a narrower share just re-wraps its fields into fewer columns rather than
     overflowing. max-width is still worth stating explicitly here: unlike a scalar row's text, a
     deeply nested panel's content can genuinely want more than an even share, and this is the
     backstop that keeps it from ever exceeding whatever contains it even then.
     min-width IS reset back to auto, though -- the 300px/140px/200px floor exists to keep a
     scalar's label+value readable, which doesn't apply to a collapsed "chevron + short label +
     (N fields)" summary the way it does to actual text. Letting an OBJECT panel shrink to its own
     min-content keeps a short one from being padded out to a scalar-sized floor it never needed,
     while flex-grow above still lets it expand and share space evenly whenever there's room. */
  .prop-row.object-property-row,
  .prop-row.object-property-edit-row {
    min-width: auto;
    max-width: 100%;
  }
  .object-property-row {
    cursor: pointer;
  }
  /* Two lines inside the toggle itself: chevron+label (.object-property-summary-row), then the
     "(N fields)" hint beneath it in the value's usual spot -- both have to live inside <summary>
     itself (see renderObjectPropRow's own comment on why), not as siblings after it. */
  .object-property-row > summary {
    display: flex;
    flex-direction: column;
    gap: 3px;
    list-style: none;
    user-select: none;
  }
  .object-property-row > summary::-webkit-details-marker {
    display: none;
  }
  .object-property-summary-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .object-property-row .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
    transform: rotate(-90deg);
    color: var(--accent);
    opacity: 0.75;
  }
  .object-property-row[open] .chevron {
    transform: rotate(0deg);
  }
  /* Stands in for the value line while collapsed -- the real nested grid is <details> content,
     so it isn't even in the DOM being interacted with while hidden; this hint is, and disappears
     once the real content takes its place. */
  .object-property-row[open] > summary .collapsed-hint {
    display: none;
  }
  /* A visibly distinct box (background + border), not just an indent -- this *is* the value now,
     for a row whose value is a whole nested panel rather than a line of text, so it needs to read
     as content rather than as a sub-list. display:flex/flex-wrap comes from also carrying the
     .prop-grid class (renderObjectPropRow's own markup); its fields size the same as any other
     .prop-row -- no separate basis/min-width for nested scalars anymore (a scalar's minimum
     readable width doesn't depend on how deep it's nested, only on it being a scalar at all --
     see .prop-row.object-property-row's own min-width: auto opt-out above for the one case that
     genuinely does differ). */
  .nested-object-grid {
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  /* An OBJECT property's editable form, standing in for renderObjectPropRow's <details> -- no
     collapse here, since edit mode exists precisely so the user can reach every leaf, and a
     closed-by-default panel would hide the very fields they came to change. */
  .object-property-edit-row .object-property-summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .object-property-edit-row > .add-prop-row {
    padding: 8px 0 0;
  }
  .link-groups {
    border-top: 1px solid var(--border);
  }
  .link-group + .link-group {
    border-top: 1px solid var(--border);
  }
  .link-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .link-group-header:hover {
    background: rgba(74, 158, 255, 0.04);
  }
  .link-group-header .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }
  .link-group-header .chevron.collapsed {
    transform: rotate(-90deg);
  }
  .link-group-label {
    letter-spacing: 0.02em;
  }
  .link-group-count {
    color: var(--muted);
    font-weight: 400;
  }
  .link-group-body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  /* Row layout: the unlink action rail on the left, full height, followed by everything the link
     grouped together (link properties + item, or just item -- see renderLinkedItemCard) as one
     block on the right. Unlink acts on the whole grouped unit (it removes the LINK, not either
     side of it individually), which is why it sits outside/beside that grouping rather than
     inside either section's own header, the way edit-link (which only ever acts on the link-
     properties section specifically) still does. */
  .nested-item-card {
    display: flex;
    align-items: stretch;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
    border-radius: 5px;
    overflow: hidden;
  }
  .nested-item-card > .unlink-button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 30px;
    padding: 0;
    background: none;
    border: none;
    border-right: 1px solid var(--border);
    color: var(--muted);
    cursor: pointer;
  }
  .nested-item-card > .unlink-button:hover {
    background: rgba(248, 81, 73, 0.1);
    color: #ef5350;
  }
  .nested-item-body {
    flex: 1;
    min-width: 0;
  }
  .nested-item-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }
  .nested-item-type {
    font-weight: 400;
    color: var(--muted);
    font-size: 11px;
    margin-left: 6px;
  }
  .nested-item-id {
    font-weight: 400;
    color: var(--muted);
    font-family: monospace;
    font-size: 11px;
  }
  /* Item-above-link-properties split, only present when the link type actually has properties to
     show (see renderLinkedItemCard) -- a link with none keeps the single-section layout above
     (just .nested-item-header + item .prop-grid), no empty section below. Each section reuses
     .nested-item-header/.prop-grid/.prop-row completely unmodified, the same way the top-level
     item card itself uses them -- "flows horizontally" here means exactly what it means there:
     the shared .prop-grid's own auto-fill columns, not a bespoke nested variant. */
  .nested-item-sections {
    display: flex;
    flex-direction: column;
  }
  .nested-item-section + .nested-item-section {
    border-top: 1px solid var(--border);
  }
  .nested-empty-note {
    padding: 4px 12px 10px;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
  }
  /* Admin-only info (see ProjectedItem.markers -- null, not rendered at all, for a non-superuser),
     so it reads as a distinct "system" affordance rather than another property: chips, not rows,
     below both properties and links since markers apply to the whole item rather than any one
     field. Reuses the same amber the decision-table editor uses for its own admin-facing accents. */
  .marker-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .marker-chip {
    padding: 3px 10px;
    border: 1px solid rgba(232, 167, 53, 0.4);
    border-radius: 999px;
    background: rgba(232, 167, 53, 0.08);
    color: #e8a735;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .sm-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .sm-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sm-machine {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    min-width: 120px;
  }
  .state-chip {
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(74, 158, 255, 0.12);
    border: 1px solid rgba(74, 158, 255, 0.4);
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
  }
  .sm-inactive {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
  }
  .sm-start-btn, .sm-transition-btn {
    padding: 3px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--panel-bg);
    color: var(--fg);
    font-size: 11px;
    cursor: pointer;
  }
  .sm-start-btn:hover, .sm-transition-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .sm-transition-btn.is-end {
    border-style: dashed;
    color: var(--muted);
  }
  .sm-transition-btn.is-end:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .add-prop-row button {
    padding: 4px 10px;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--muted);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  .add-prop-row button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .save-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    background: rgba(74, 158, 255, 0.04);
  }
  .save-bar .change-count {
    font-size: 12px;
    color: #d29922;
    margin-right: auto;
  }
  .save-bar button {
    padding: 5px 14px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    border: none;
  }
  .save-bar .cancel-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .save-bar .save-btn {
    background: #3fb950;
    color: #fff;
  }
  .no-results {
    text-align: center;
    padding: 32px 0;
    color: var(--muted);
    font-style: italic;
  }
  .panes-dock {
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: stretch;
    padding: 0 16px 16px 16px;
  }
  .panes-dock .pane {
    width: 220px;
    min-height: unset;
  }
  .item-card-header[draggable="true"] {
    cursor: grab;
  }
  .item-card-header[draggable="true"]:active {
    cursor: grabbing;
  }
  /* Left behind in place while its content follows the cursor as the native drag image (same
     technique as .pane.is-drag-source) -- content stays laid out (unlike the pane version) so
     the other cards around it don't jump, just dimmed to read as "this is what's being moved". */
  .item-card.is-drag-source {
    opacity: 0.4;
  }
  /* Computed once at dragstart and written directly to matching cards/groups (see
     computeLinkCandidates' callers) -- not part of the normal render(), since re-rendering mid-
     drag would tear down the dragged node and abort the gesture, same reasoning as the existing
     pane-reorder preview. */
  .item-card.valid-drop-target {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .item-card.valid-drop-target .item-card-header {
    background: rgba(74, 158, 255, 0.08);
  }
  .link-group.valid-drop-target {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    border-radius: 4px;
  }
  .nested-item-header {
    justify-content: space-between;
  }
  /* Shared icon-button look, reused as-is by the item card's own edit/delete actions (see
     renderItemCard) so both contexts present the same pencil/trash icon and tooltip pattern
     rather than each growing its own bespoke button style. */
  .edit-link-button,
  .delete-item-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
  }
  .edit-link-button:hover {
    background: rgba(74, 158, 255, 0.1);
    color: var(--accent);
  }
  .delete-item-button:hover {
    background: rgba(248, 81, 73, 0.1);
    color: #ef5350;
  }
`);

// Mirrors RegisterPartitionManager.DEFAULT_LIMIT -- the backend always applies this page size
// when a query's limit is null, it never returns every matching row unbounded. Pagination
// decisions here must use this as the effective page size whenever pane.pageSize itself is
// null, or Next/Prev and the "X of Y" summary silently go blind past the first page.
const DEFAULT_PAGE_SIZE = 50;

// Recreates the Angular search screen: a toolbar to add panes, and a grid of independent
// search panes (item-type picker + optional sort + Project button + results). Mirrors
// SearchViewModel/SearchPaneViewModel's behavior (one pane can be maximized at a time,
// closed panes are gone for good, minimized panes move to a bottom dock) without reusing
// any Angular code -- this is a fresh implementation built from watching/reading that screen.
class NtrlocSearch extends HTMLElement {
  constructor() {
    super();
    this.panes = [];
    this.nextId = 1;
    this.draggingPaneId = null;
    // Live working copy of the active-pane order while a drag is in progress -- only committed
    // into `panes` on a real drop, so a cancelled drag (dragend with no drop) just discards it.
    this.dragPreviewOrder = null;
    // Item-card drag-to-link state -- fully separate from draggingPaneId/dragPreviewOrder above
    // (a different gesture, on a different element) so the two drag systems can't interfere:
    // each one's own handlers only ever act when its own state is non-null. draggingItem is
    // {itemId, itemType, paneId} for the card currently being dragged; dragValidTargets/
    // dragValidGroups are computed once at dragstart (see startItemDrag) and written directly
    // into the DOM rather than through render(), since a re-render mid-drag would tear down the
    // dragged node and abort the native drag gesture -- same reasoning as dragPreviewOrder.
    this.draggingItem = null;
    this.dragValidTargets = null;
    this.dragValidGroups = null;
    // { [linkId]: {id, properties} } -- the schema-wide link property definitions (AdminLinkView),
    // separate from each item's own per-perspective links map: a perspective only carries a
    // linkId, the property *definitions* for that link live here, keyed by that id.
    this.linkDefsById = new Map();
    // { [typeName]: mappedType } -- every pane's own availableTypes is an identical copy of the
    // same schema, so drag/drop resolution (which is cross-pane by nature) reads from this single
    // component-level cache instead of reaching into whichever pane happens to be involved.
    this.itemTypesByName = new Map();
    // Same mapped types, keyed by id instead of name -- lets typeIsAssignableTo walk a concrete
    // type's supertypeId chain (which only carries ids, never names) up to whatever type a
    // perspective's targets actually declare.
    this.itemTypesById = new Map();
    // Which field-picker popup (sort or a specific filter row's) is currently open, as an opaque
    // key string -- see renderFieldPicker. At most one at a time across every pane, same as a
    // native <select> only ever has one open dropdown regardless of how many selects are on the
    // page. Never persisted per-pane: closing on any full re-render this component itself doesn't
    // trigger while a popup is open (a background schema change, say) is an acceptable, rare edge
    // case rather than something worth threading into every pane's own state.
    this.openFieldPicker = null;
  }

  connectedCallback() {
    this.addPane();
    // Keeps every open pane's dropdown live as the schema changes elsewhere -- previously each
    // pane's availableTypes was fetched once, at creation, and frozen from then on.
    this._unsubscribeSchema = onGlobalSchemaChange(() => this.refreshAvailableTypesFromGlobalSchema());
    // Closes any open field-picker popup on an outside click/Escape -- same UX contract a native
    // <select> gives for free, which a hand-rolled popup has to wire up itself. Deliberately
    // bubble-phase, not capture: capture would run (and re-render, tearing down the clicked node)
    // *before* the actual click target's own handler gets a chance to fire, silently eating
    // whatever the user was really clicking on outside the popup. Bubble-phase runs after, and
    // closest() on an already-detached node (if that handler itself re-rendered) still walks its
    // old, structurally-intact parent chain, so this stays correct either way.
    this._onDocumentClickForFieldPicker = (e) => {
      if (this.openFieldPicker && !e.target.closest('.field-picker')) {
        this.openFieldPicker = null;
        this.render();
      }
    };
    this._onDocumentKeydownForFieldPicker = (e) => {
      if (e.key === 'Escape' && this.openFieldPicker) {
        this.openFieldPicker = null;
        this.render();
      }
    };
    document.addEventListener('click', this._onDocumentClickForFieldPicker);
    document.addEventListener('keydown', this._onDocumentKeydownForFieldPicker);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClickForFieldPicker);
    document.removeEventListener('keydown', this._onDocumentKeydownForFieldPicker);
    if (this._unsubscribeSchema) this._unsubscribeSchema();
  }

  addPane() {
    const id = this.nextId++;
    this.panes.push({
      id,
      windowState: 'normal',
      availableTypes: [],
      selectedTypeName: null,
      sortableFields: [],
      selectedSortField: null,
      selectedSortDirection: 'ASC',
      // { field: string|null, value: string }[] -- AND-ed equality filters, staged until the next
      // Project click, same as sort/pageSize below. field is a possibly-dotted property path (see
      // sortableFields), never a system field -- PropertyValuePredicate only resolves real schema
      // properties (RegisterPartitionManager.resolvePropertyId), not itemId/createdAt/etc.
      filters: [],
      // null = user hasn't set one; the backend still paginates in that case
      // (RegisterPartitionManager.DEFAULT_LIMIT, mirrored here as DEFAULT_PAGE_SIZE) rather than
      // ever returning every matching row. A positive integer overrides that default page size.
      pageSize: null,
      // Row index the current page starts at -- always meaningful, even without an explicit
      // pageSize, since the backend paginates by DEFAULT_PAGE_SIZE regardless. Reset to 0 whenever
      // the query shape changes (type / sort / page size / filters / a fresh Project click).
      pageOffset: 0,
      results: [],
      isLoading: false,
      lastProjectionMs: null,
      lastTotalCount: null,
      viewMode: 'formatted',
      propertyDefs: [],
      editingItems: {},
      // { [itemId]: Set<perspectiveName> } -- absence means expanded, matching editingItems'
      // own "only the entries that need tracking are present" convention. Starts empty so every
      // link group is expanded by default (nothing hidden until the user actively collapses it),
      // per feedback that collapsing is for "pushing items out of view" once you've seen them,
      // not a default-hidden state. Lives on the pane object, not re-initialized in project() --
      // same lifetime as editingItems, reset only on selectType() (a real type change), so
      // re-running the same search (e.g. after a save) doesn't silently re-expand everything.
      collapsedLinkGroups: {},
    });
    this.render();
    this.loadItemTypes(id);
  }

  closePane(id) {
    this.panes = this.panes.filter(p => p.id !== id);
    this.render();
  }

  maximizePane(id) {
    this.panes.forEach(p => { p.windowState = p.id === id ? 'maximized' : 'normal'; });
    this.render();
  }

  minimizePane(id) {
    this.pane(id).windowState = 'minimized';
    this.render();
  }

  restorePane(id) {
    this.pane(id).windowState = 'normal';
    this.render();
  }

  pane(id) {
    return this.panes.find(p => p.id === id);
  }

  // links is kept as-is from the admin schema response (already { perspectiveName: [{id,
  // linkId, targets, minCardinality, maxCardinality, definedIn}] }, see AdminItemLinkPerspectiveView)
  // -- computeLinkCandidates reads targets/linkId straight off it, no need to remap.
  mapAvailableTypes(schema) {
    // Recurses into an OBJECT property's own `properties` -- needed so the item-card editor can
    // find/offer a nested property's definition (type, and its own children) at any depth, not
    // just the top level.
    const mapProps = (props) => (props || []).map(p => ({
      name: p.name,
      type: p.type,
      cardinality: p.cardinality,
      properties: p.type === 'OBJECT' ? mapProps(p.properties) : undefined,
    }));
    return (schema.items || [])
      .map(item => ({
        id: item.id,
        name: item.name,
        sortableFields: item.sortableFields || [],
        properties: mapProps(item.properties),
        links: item.links || {},
        supertypeId: item.supertypeId || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  cacheSchemaSideTables(schema) {
    this.linkDefsById = new Map((schema.links || []).map(l => [l.id, l]));
    const mapped = this.mapAvailableTypes(schema);
    this.itemTypesByName = new Map(mapped.map(t => [t.name, t]));
    this.itemTypesById = new Map(mapped.map(t => [t.id, t]));
  }

  // A perspective's declared target can be an abstract supertype (e.g. Person's ownsVehicle
  // targets "Vehicle", not "Car"/"Bicycle" individually -- confirmed live: dragging a Car onto a
  // Person worked because Car's own inherited "ownedBy" perspective targets the concrete "Person"
  // directly, but dragging a Person onto a Bicycle failed until this walked the chain, since
  // "Bicycle" !== "Vehicle" under plain string equality). Walks typeName's own supertypeId chain
  // (concrete type -> ... -> abstract root) checking each ancestor against targetTypeName, so a
  // concrete subtype still matches a perspective declared against its abstract supertype.
  typeIsAssignableTo(typeName, targetTypeName) {
    let current = this.itemTypesByName.get(typeName);
    while (current) {
      if (current.name === targetTypeName) return true;
      current = current.supertypeId ? this.itemTypesById.get(current.supertypeId) : null;
    }
    return false;
  }

  async loadItemTypes(id) {
    try {
      // load(), not reload(): globalSchemaModel is kept current by its own onSchemaEvent
      // subscription, so this only forces a real fetch the very first time (cold start); every
      // later pane just reads the already-current cache. Still self-healing against the rare case
      // of a missed SSE event during a disconnect/reconnect window, same as the New Item dialog's
      // own fresh-fetch-per-open behavior.
      const schema = await globalSchemaModel.load();
      this.pane(id).availableTypes = this.mapAvailableTypes(schema);
      this.cacheSchemaSideTables(schema);
      this.render();
    } catch (e) {
      // Left silently empty, mirroring the Angular view model's fetchItemTypes() error handling.
    }
  }

  refreshAvailableTypesFromGlobalSchema() {
    if (!globalSchemaModel._schema) return;
    // Each pane gets its own array (not a shared reference) -- availableTypes is only ever
    // reassigned wholesale elsewhere in this class, never mutated in place, but there's no reason
    // to rely on that staying true.
    this.panes.forEach(p => { p.availableTypes = this.mapAvailableTypes(globalSchemaModel._schema); });
    this.cacheSchemaSideTables(globalSchemaModel._schema);
    this.render();
  }

  selectType(id, typeName) {
    const pane = this.pane(id);
    pane.selectedTypeName = typeName || null;
    pane.results = [];
    pane.lastProjectionMs = null;
    pane.lastTotalCount = null;
    pane.selectedSortField = null;
    pane.selectedSortDirection = 'ASC';
    pane.filters = [];
    pane.pageSize = null;
    pane.pageOffset = 0;
    pane.editingItems = {};
    pane.collapsedLinkGroups = {};
    const type = pane.availableTypes.find(t => t.name === typeName);
    pane.sortableFields = type?.sortableFields ?? [];
    pane.propertyDefs = type?.properties ?? [];
    this.render();
  }

  selectSortField(id, field) {
    const pane = this.pane(id);
    pane.selectedSortField = field || null;
    pane.pageOffset = 0;
    this.render();
  }

  toggleSortDirection(id) {
    const pane = this.pane(id);
    pane.selectedSortDirection = pane.selectedSortDirection === 'ASC' ? 'DESC' : 'ASC';
    pane.pageOffset = 0;
    this.render();
  }

  addFilter(id) {
    const pane = this.pane(id);
    pane.filters = [...pane.filters, { field: null, value: '' }];
    pane.pageOffset = 0;
    this.render();
  }

  removeFilter(id, index) {
    const pane = this.pane(id);
    pane.filters = pane.filters.filter((_, i) => i !== index);
    pane.pageOffset = 0;
    this.render();
  }

  setFilterField(id, index, field) {
    const pane = this.pane(id);
    pane.filters[index].field = field || null;
    pane.pageOffset = 0;
    this.render();
  }

  // No re-render, same reasoning as setPageSize below: this fires on a text input's own change
  // event, and tearing the DOM down mid-edit would fight the user typing into it.
  setFilterValue(id, index, value) {
    const pane = this.pane(id);
    pane.filters[index].value = value;
    pane.pageOffset = 0;
  }

  // AND-ed PROPERTY_VALUE/EQUALS predicates, one per filter row that has both a field and a
  // non-empty value -- matches org.ntrloc.graph.db.projection's Predicate/PropertyValuePredicate/
  // AndPredicate JSON shape exactly (Jackson's @JsonTypeInfo "type" discriminator). A single
  // qualifying row is sent unwrapped rather than as a one-element AND, purely to keep the payload
  // minimal; the backend would accept either shape identically.
  buildFilterPredicate(pane) {
    const rows = (pane.filters || [])
        .filter(f => f.field && f.value !== '' && f.value != null)
        .map(f => ({ type: 'PROPERTY_VALUE', propertyName: f.field, operator: 'EQUALS', value: f.value }));
    if (rows.length === 0) return undefined;
    return rows.length === 1 ? rows[0] : { type: 'AND', predicates: rows };
  }

  // Stored, not applied, until the next Project -- same as the sort controls. No re-render: the
  // caller normalizes the field's displayed value itself so results aren't torn down mid-tweak.
  setPageSize(id, value) {
    const n = parseInt(value, 10);
    const pane = this.pane(id);
    pane.pageSize = Number.isInteger(n) && n > 0 ? n : null;
    pane.pageOffset = 0;
  }

  // The "Project" button runs the query afresh, from page one. Prev/Next call project(id)
  // directly so they keep the offset they just set.
  runQuery(id) {
    this.pane(id).pageOffset = 0;
    this.project(id);
  }

  // pane.pageSize itself may be null (user never set one) -- the backend still paginates in that
  // case (DEFAULT_PAGE_SIZE), so paging must work off the effective size, not the raw field.
  effectivePageSize(pane) {
    return pane.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  nextPage(id) {
    const pane = this.pane(id);
    const size = this.effectivePageSize(pane);
    // Don't advance past the last page (the backend errors on an offset >= the row count).
    if (pane.lastTotalCount != null && pane.pageOffset + size >= pane.lastTotalCount) return;
    pane.pageOffset += size;
    this.project(id);
  }

  prevPage(id) {
    const pane = this.pane(id);
    pane.pageOffset = Math.max(0, pane.pageOffset - this.effectivePageSize(pane));
    this.project(id);
  }

  async project(id, _retriedAfterClamp = false) {
    const pane = this.pane(id);
    if (!pane.selectedTypeName) return;
    pane.isLoading = true;
    pane.lastProjectionMs = null;
    this.render();
    const start = performance.now();
    try {
      const response = await fetch('/api/entity/projection', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemTypeName: pane.selectedTypeName,
          sortField: pane.selectedSortField,
          sortDirection: pane.selectedSortField ? pane.selectedSortDirection : undefined,
          filter: this.buildFilterPredicate(pane),
          // Both default to false server-side (see ProjectionSpec) -- this admin UI always needs
          // both, since it renders Edit/Delete affordances and the state-machine section.
          includePermissions: true,
          includeStates: true,
          limit: pane.pageSize ?? undefined,
          offset: pane.pageOffset || undefined,
        }),
      });
      if (!response.ok) throw new Error('Request failed: ' + response.status);
      const result = await response.json();
      pane.lastProjectionMs = performance.now() - start;
      pane.results = result.items || [];
      pane.lastTotalCount = result.totalCount ?? null;

      // Landed past the end (rows deleted since, or a stale offset) -- snap to the last real page
      // and fetch it once, so the user never sees an empty page they have to Prev out of.
      if (!_retriedAfterClamp && pane.pageOffset > 0
          && pane.results.length === 0 && pane.lastTotalCount > 0) {
        const size = this.effectivePageSize(pane);
        pane.pageOffset = Math.max(0, Math.floor((pane.lastTotalCount - 1) / size) * size);
        pane.isLoading = false;
        return this.project(id, true);
      }
    } catch (e) {
      pane.results = [];
    } finally {
      pane.isLoading = false;
      this.render();
    }
  }

  setViewMode(id, mode) {
    this.pane(id).viewMode = mode;
    this.render();
  }

  toggleLinkGroup(id, itemId, perspectiveName) {
    const pane = this.pane(id);
    if (!pane.collapsedLinkGroups[itemId]) pane.collapsedLinkGroups[itemId] = new Set();
    const collapsed = pane.collapsedLinkGroups[itemId];
    if (collapsed.has(perspectiveName)) collapsed.delete(perspectiveName);
    else collapsed.add(perspectiveName);
    this.render();
  }

  toggleEdit(id, itemId) {
    const pane = this.pane(id);
    if (pane.editingItems[itemId]) {
      delete pane.editingItems[itemId];
    } else {
      const item = pane.results.find(r => r.itemId === itemId);
      if (!item) return;
      pane.editingItems[itemId] = {
        // Deep-cloned, not spread -- an OBJECT property's value is itself an object, and a shallow
        // spread would leave edit.values[key] pointing at the exact same nested object as
        // item.properties[key], so editing a leaf would silently mutate the live (pre-save) item
        // too, corrupting both the diff and a cancelled edit.
        values: structuredClone(item.properties),
        // Dotted paths (e.g. "contactInfo.email"), not just top-level keys -- a removal can target
        // a single nested leaf or an entire OBJECT subtree at any depth. The value at a removed
        // path is left in place in `values` (not deleted) so "undo remove" has something to
        // restore.
        removed: new Set(),
      };
    }
    this.render();
  }

  cancelEdit(id, itemId) {
    delete this.pane(id).editingItems[itemId];
    this.render();
  }

  updateEditValue(id, itemId, pathKey, value) {
    const edit = this.pane(id).editingItems[itemId];
    if (edit) setAtPath(edit.values, pathKey.split('.'), value);
  }

  removeProperty(id, itemId, pathKey) {
    const edit = this.pane(id).editingItems[itemId];
    if (edit) {
      edit.removed.add(pathKey);
      this.render();
    }
  }

  undoRemoveProperty(id, itemId, pathKey) {
    const edit = this.pane(id).editingItems[itemId];
    if (edit) {
      edit.removed.delete(pathKey);
      this.render();
    }
  }

  // pathKey identifies the containing OBJECT property ("" for the item's own top-level
  // properties, "contactInfo" for a field nested inside it, etc.) -- the prompted name is looked
  // up against that container's own schema children, same idea as
  // ntrloc-property-table.js's "add property to X" but one level (item instance values, not
  // schema definitions).
  addProperty(id, itemId, pathKey) {
    const pane = this.pane(id);
    const edit = pane.editingItems[itemId];
    if (!edit) return;
    const path = pathKey ? pathKey.split('.') : [];
    const containerDef = path.length === 0 ? null : this.findPropertyDef(pane.propertyDefs, path);
    const childDefs = path.length === 0 ? pane.propertyDefs : (containerDef?.properties || []);
    const parentVal = path.length === 0 ? edit.values : (getAtPath(edit.values, path) || {});
    const existingKeys = new Set(Object.keys(parentVal));
    const available = childDefs.filter(p => !existingKeys.has(p.name) || edit.removed.has([...path, p.name].join('.')));
    if (available.length === 0) return;
    const name = prompt('Property name to add:\n\nAvailable: ' + available.map(p => p.name).join(', '));
    if (!name) return;
    const def = childDefs.find(p => p.name === name);
    if (!def) return;
    const childPath = [...path, name];
    setAtPath(edit.values, childPath, def.type === 'OBJECT' ? {} : '');
    edit.removed.delete(childPath.join('.'));
    this.render();
  }

  // Recursively diffs `newVal` (edit.values, or one of its nested objects) against `oldVal` (the
  // matching spot in item.properties) into the same partial-update shape the backend's nested
  // property resolution expects (see MutationRequestProcessor.resolveObjectPropertyValue): only
  // changed leaves are included, an explicit null clears just that leaf (or, for a whole removed
  // OBJECT subtree, everything beneath it), and untouched siblings are simply absent rather than
  // echoed back. `leafCount` powers the "N changes" badge -- a removed subtree counts as one
  // change (matching the single removal action that produced it), not one per descendant.
  diffEditedValue(newVal, oldVal, removed, path) {
    const pathKey = path.join('.');
    if (removed.has(pathKey)) return { changed: true, value: null, leafCount: 1 };
    if (newVal !== null && typeof newVal === 'object' && !Array.isArray(newVal)) {
      const oldObj = (oldVal && typeof oldVal === 'object' && !Array.isArray(oldVal)) ? oldVal : {};
      const nested = {};
      let leafCount = 0;
      for (const key of Object.keys(newVal)) {
        const child = this.diffEditedValue(newVal[key], oldObj[key], removed, [...path, key]);
        leafCount += child.leafCount;
        if (child.changed) nested[key] = child.value;
      }
      return { changed: leafCount > 0, value: nested, leafCount };
    }
    // Deep-cloning at toggleEdit() means an unedited LIST/SET-cardinality (array-valued) property
    // no longer shares a reference with item.properties -- a plain !== would flag it as changed
    // on every save. Compared by content instead, same as everything else here.
    const same = Array.isArray(newVal) || Array.isArray(oldVal)
      ? JSON.stringify(newVal) === JSON.stringify(oldVal)
      : newVal === oldVal;
    return same
      ? { changed: false, value: undefined, leafCount: 0 }
      : { changed: true, value: newVal === '' ? null : newVal, leafCount: 1 };
  }

  // Recursive lookup of a property's own definition against pane.propertyDefs' nested `properties`
  // (see mapAvailableTypes), by path -- e.g. ["contactInfo", "email"] walks into contactInfo's own
  // children to find email's definition (its type, and if it's itself OBJECT-typed, its children).
  findPropertyDef(defs, path) {
    let list = defs;
    let def = null;
    for (const key of path) {
      def = (list || []).find(d => d.name === key);
      if (!def) return null;
      list = def.properties;
    }
    return def;
  }

  async saveEdit(id, itemId) {
    const pane = this.pane(id);
    const edit = pane.editingItems[itemId];
    if (!edit) return;
    const item = pane.results.find(r => r.itemId === itemId);
    if (!item) return;
    const properties = {};
    for (const key of Object.keys(edit.values)) {
      const result = this.diffEditedValue(edit.values[key], item.properties[key], edit.removed, [key]);
      if (result.changed) properties[key] = result.value;
    }
    if (Object.keys(properties).length === 0) {
      delete pane.editingItems[itemId];
      this.render();
      return;
    }
    try {
      const response = await fetch('/api/mutation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ type: 'UPDATE', itemId, properties }] }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message || 'Save failed: ' + response.status);
      }
      delete pane.editingItems[itemId];
      this.project(id);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  }

  // item.states is a map keyed by state-machine name: { currentState, startable, availableTransitions }.
  // Active machines show their current state + a button per transition the caller may execute;
  // inactive-but-startable machines show a Start button.
  renderStateSection(item) {
    const machines = item.states ? Object.entries(item.states) : [];
    if (machines.length === 0) return '';
    // Only two shapes ever reach here now: active (currentState set), or inactive-but-startable
    // (see buildProjectedItemStates) -- a machine that's neither has no entry at all, not a third
    // "not started, and you can't start it either" row with nothing actionable in it.
    const rows = machines.map(([name, s]) => {
      if (s.currentState) {
        // The button is always the transition's own name. An END-bound transition additionally gets
        // a marker class so it can read as "this one exits the machine".
        const buttons = (s.availableTransitions || []).map(t => `
          <button class="sm-transition-btn ${t.toKind === 'END' ? 'is-end' : ''}" data-action="sm-transition" data-machine="${escapeHtml(name)}" data-transition="${t.id}" title="${t.toKind === 'END' ? 'Exits the state machine' : escapeHtml('→ ' + t.toState)}">
            ${escapeHtml(t.name)}
          </button>`).join('');
        return `<div class="sm-row">
          <span class="sm-machine">${escapeHtml(name)}</span>
          <span class="state-chip">${escapeHtml(s.currentState)}</span>
          ${buttons}
        </div>`;
      }
      return `<div class="sm-row">
        <span class="sm-machine">${escapeHtml(name)}</span>
        <button class="sm-start-btn" data-action="sm-start" data-machine="${escapeHtml(name)}">Start</button>
      </div>`;
    }).join('');
    return `<div class="sm-section">${rows}</div>`;
  }

  async startStateMachineForItem(id, itemId, machineName) {
    try {
      const response = await fetch(`/api/entity/${itemId}/state-machines/${encodeURIComponent(machineName)}/start`, {
        method: 'POST', credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || 'Start failed: ' + response.status);
      this.project(id);
    } catch (e) {
      alert('Start failed: ' + e.message);
    }
  }

  async executeTransitionForItem(id, itemId, machineName, transitionId) {
    try {
      const response = await fetch(`/api/entity/${itemId}/state-machines/${encodeURIComponent(machineName)}/transitions/${transitionId}`, {
        method: 'POST', credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || 'Transition failed: ' + response.status);
      this.project(id);
    } catch (e) {
      alert('Transition failed: ' + e.message);
    }
  }

  async deleteItem(id, itemId) {
    const pane = this.pane(id);
    const item = pane.results.find(r => r.itemId === itemId);
    if (!item) return;
    const title = item.displayLabel || item.itemType;
    const confirmed = await openConfirmDialog({
      title: 'Delete Item',
      message: `Delete "${title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch('/api/mutation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ type: 'DELETE', itemId }] }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message || 'Delete failed: ' + response.status);
      }
      delete pane.editingItems[itemId];
      this.project(id);
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  // Every valid (type-pair, not-already-linked) way to connect draggedItem to targetItem, paired
  // up by shared linkId rather than by target-type-name coincidence -- two item types can have
  // more than one link between them (e.g. "ownsVehicle" and a hypothetical "reservedVehicle"),
  // and only the underlying linkId (present on both sides' perspectives, via AdminLinkView/
  // AdminItemLinkPerspectiveView -- see global-schema-model.js's own comment on why the admin
  // schema, not the calculated one, is what's available here) reliably says which perspective on
  // draggedItem's side pairs with which on targetItem's side. "Already linked" is checked against
  // the already-fetched projection data (draggedItem.links), not the schema -- the schema only
  // proves the two *types* can be linked, not whether these two *instances* already are.
  // Reused as-is for both the drag-time highlight computation and the actual drop resolution, and
  // for a drop on a specific link-group section (see the .link-group drop handler in wireUp) by
  // just filtering this same list down to the one candidate whose toPerspective matches the
  // pinned group.
  computeLinkCandidates(draggedItem, targetItem) {
    const fromType = this.itemTypesByName.get(draggedItem.itemType);
    const toType = this.itemTypesByName.get(targetItem.itemType);
    if (!fromType || !toType) return [];
    const candidates = [];
    for (const [fromPerspective, fromEntries] of Object.entries(fromType.links)) {
      for (const fromEntry of fromEntries) {
        if (!fromEntry.targets.some(t => this.typeIsAssignableTo(targetItem.itemType, t.name))) continue;
        for (const [toPerspective, toEntries] of Object.entries(toType.links)) {
          if (!toEntries.some(e => e.linkId === fromEntry.linkId)) continue;
          // Matched on target-item identity alone, not l.linkId -- ProjectedLink.linkId is the
          // per-instance link's own id (register_link.link_id), a different UUID from the
          // schema-level fromEntry.linkId (link_definition_id) used everywhere else in this
          // method; a perspective already pointing at this exact target item is already linked
          // regardless of which specific instance id that link happens to have.
          const alreadyLinked = (draggedItem.links?.[fromPerspective] || [])
            .some(l => l.item?.itemId === targetItem.itemId);
          if (alreadyLinked) continue;
          const linkDef = this.linkDefsById.get(fromEntry.linkId);
          candidates.push({
            linkId: fromEntry.linkId,
            fromPerspective,
            toPerspective,
            propertyDefs: linkDef?.properties || [],
          });
        }
      }
    }
    return candidates;
  }

  // Re-runs project() on every currently-open pane that could be showing either side of a link
  // that just changed -- not just a pane whose selectedTypeName exactly matches one of the two
  // concrete types (typeNames), but also any pane searching an ABSTRACT ancestor of one of them:
  // a pane searching "Vehicle" still lists Bicycle instances, so a Person<->Bicycle link change
  // needs to refresh it too, even though "Vehicle" never appears in typeNames itself (typeNames is
  // always the two concrete item types actually on each end of the link). Confirmed live as the
  // cause of a real bug: linking a Person to a Bicycle updated a pane searching "Bicycle" directly,
  // but not one searching "Vehicle" -- same abstract/concrete gap as computeLinkCandidates' own
  // targets check, just surfacing on the refresh side instead of the candidate-resolution side.
  reprojectPanesForTypes(typeNames) {
    this.panes
      .filter(p => p.selectedTypeName && typeNames.some(t => this.typeIsAssignableTo(t, p.selectedTypeName)))
      .forEach(p => this.project(p.id));
  }

  async createLink(candidate, draggedItem, targetItem, properties) {
    try {
      const response = await fetch('/api/mutation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links: [{
            type: 'CREATE',
            firstItem: { perspectiveName: candidate.fromPerspective, item: { type: 'EXISTING', itemId: draggedItem.itemId } },
            secondItem: { perspectiveName: candidate.toPerspective, item: { type: 'EXISTING', itemId: targetItem.itemId } },
            properties: properties && Object.keys(properties).length > 0 ? properties : undefined,
          }],
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message || 'Link failed: ' + response.status);
      }
      this.reprojectPanesForTypes([draggedItem.itemType, targetItem.itemType]);
    } catch (e) {
      alert('Link failed: ' + e.message);
    }
  }

  // Same openConfirmDialog convention as deleteItem -- unlike link *creation* (still immediate on
  // drop with no confirm step when there are no properties to fill in), removing an existing link
  // is a one-click destructive action on data the user can already see, so it earns the same guard
  // rail as deleting an item outright.
  async unlinkItem(id, linkId, otherItemType, otherItemTitle) {
    const pane = this.pane(id);
    const confirmed = await openConfirmDialog({
      title: 'Remove Link',
      message: `Remove link to "${otherItemTitle}" (${otherItemType})?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch('/api/mutation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: [{ type: 'DELETE', linkId }] }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message || 'Unlink failed: ' + response.status);
      }
      this.reprojectPanesForTypes([pane.selectedTypeName, otherItemType]);
    } catch (e) {
      alert('Unlink failed: ' + e.message);
    }
  }

  // itemId/perspective/linkId together pin down exactly one ProjectedLink entry inside the
  // *outer* item's own already-fetched projection data -- reused as both the dialog's pre-fill
  // (linkEntry.properties) and the baseline the post-dialog diff is computed against, so this
  // never needs its own separate fetch.
  async editLinkProperties(id, itemId, perspective, linkId, otherItemType, otherItemTitle) {
    const pane = this.pane(id);
    const item = pane.results.find(r => r.itemId === itemId);
    if (!item) return;
    const linkEntry = (item.links[perspective] || []).find(l => l.linkId === linkId);
    if (!linkEntry) return;
    const propertyDefs = this.linkPropertyDefsFor(item.itemType, perspective);
    if (propertyDefs.length === 0) return;
    const edited = await openLinkPropertiesDialog({
      title: `Edit Link Properties — ${otherItemTitle}`,
      propertyDefs,
      initialValues: linkEntry.properties || {},
    });
    if (!edited) return;
    // Delta against the link's current properties, not a full replace -- mirrors saveEdit's own
    // item-property diffing (see its comment): only properties that actually changed are sent,
    // and a property the user blanked out (present in initialValues, absent from `edited` because
    // openLinkPropertiesDialog omits blank fields -- same convention as openLinkCreateDialog's own
    // confirm handler) becomes an explicit null rather than being silently dropped from the diff.
    const current = linkEntry.properties || {};
    const delta = {};
    for (const p of propertyDefs) {
      const newVal = Object.prototype.hasOwnProperty.call(edited, p.name) ? edited[p.name] : null;
      if (newVal !== (current[p.name] ?? null)) delta[p.name] = newVal;
    }
    if (Object.keys(delta).length === 0) return;
    try {
      const response = await fetch('/api/mutation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: [{ type: 'UPDATE', linkId, properties: delta }] }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message || 'Update failed: ' + response.status);
      }
      this.reprojectPanesForTypes([item.itemType, otherItemType]);
    } catch (e) {
      alert('Update link failed: ' + e.message);
    }
  }

  // Called once at dragstart (not per dragenter, unlike the pane-reorder preview -- there's no
  // live "preview order" to keep recomputing here, just a fixed valid/invalid classification of
  // every currently-rendered item-card and link-group). Writes '.valid-drop-target' straight into
  // the DOM, matching every other item-card and link-group's own class list; cleared again by
  // clearItemDragHighlights() at dragend.
  applyItemDragHighlights(draggedItem) {
    this.querySelectorAll('.item-card[data-item-id]').forEach(cardEl => {
      const targetItemId = cardEl.dataset.itemId;
      if (targetItemId === draggedItem.itemId) return;
      const targetPaneId = Number(cardEl.closest('[data-pane-id]')?.dataset.paneId);
      const targetPane = this.pane(targetPaneId);
      const targetItem = targetPane?.results.find(r => r.itemId === targetItemId);
      if (!targetItem) return;
      const candidates = this.computeLinkCandidates(draggedItem, targetItem);
      if (candidates.length === 0) return;
      cardEl.classList.add('valid-drop-target');
      cardEl.querySelectorAll('.link-group[data-perspective]').forEach(groupEl => {
        if (candidates.some(c => c.toPerspective === groupEl.dataset.perspective)) {
          groupEl.classList.add('valid-drop-target');
        }
      });
    });
  }

  clearItemDragHighlights() {
    this.querySelectorAll('.valid-drop-target').forEach(el => el.classList.remove('valid-drop-target'));
  }

  // Shared by both drop paths below: resolves candidates down to a chosen {linkId, fromPerspective,
  // toPerspective, properties}, opening the picker/properties dialog only when the candidate list or
  // its properties actually require user input (see ntrloc-link-create-dialog.js), then creates the
  // link. `candidates` is passed in already filtered -- full list for a plain item-card drop, pinned
  // to one perspective for a link-group drop (see wireUp).
  async resolveAndCreateLink(candidates, draggedItem, targetItem) {
    if (candidates.length === 0) return;
    let chosen;
    if (candidates.length === 1 && candidates[0].propertyDefs.length === 0) {
      chosen = { ...candidates[0], properties: {} };
    } else {
      chosen = await openLinkCreateDialog(candidates);
      if (!chosen) return;
    }
    await this.createLink(chosen, draggedItem, targetItem, chosen.properties);
  }

  activePanes() {
    return this.panes.filter(p => p.windowState !== 'minimized');
  }

  minimizedPanes() {
    return this.panes.filter(p => p.windowState === 'minimized');
  }

  gridCols() {
    return this.activePanes().length <= 1 ? 1 : 2;
  }

  // Live-updates the in-progress preview order (a working copy of the active panes) by moving
  // the dragged pane to sit where `targetId` currently is, then reflects that into the DOM via
  // each pane's CSS `order` -- no re-render, so the actively-dragged node is never recreated
  // (recreating it would abort the native drag session mid-gesture). A naive splice-out-then-
  // splice-in is a no-op for adjacent swaps (removing index 0 shifts the target into index 0,
  // so re-inserting "at the target's index" lands back where it started), so this shifts every
  // element between the two positions by one instead, same as Angular CDK's moveItemInArray
  // (which SearchViewModel.onDrop relies on).
  previewReorder(targetId) {
    const order = this.dragPreviewOrder;
    const fromIndex = order.findIndex(p => p.id === this.draggingPaneId);
    const toIndex = order.findIndex(p => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const dragged = order[fromIndex];
    const delta = toIndex < fromIndex ? -1 : 1;
    for (let i = fromIndex; i !== toIndex; i += delta) {
      order[i] = order[i + delta];
    }
    order[toIndex] = dragged;
    order.forEach((pane, index) => {
      const el = this.querySelector(`.pane[data-pane-id="${pane.id}"]`);
      if (el) el.style.order = index;
    });
  }

  // Folds the live preview order back into the real backing array: every slot that held an
  // active pane gets the next pane from the (now-reordered) preview list, in order, while any
  // minimized panes interleaved among them keep their original absolute position.
  commitDragPreviewOrder() {
    const activeIds = new Set(this.dragPreviewOrder.map(p => p.id));
    let next = 0;
    this.panes = this.panes.map(p => activeIds.has(p.id) ? this.dragPreviewOrder[next++] : p);
    this.draggingPaneId = null;
    this.dragPreviewOrder = null;
    this.render();
  }

  render() {
    const active = this.activePanes();
    const minimized = this.minimizedPanes();
    this.innerHTML = `
      <div class="search-toolbar">
        <md-outlined-button class="add-pane-button">+ Add Pane</md-outlined-button>
      </div>
      <div class="panes-container" style="grid-template-columns: repeat(${this.gridCols()}, 1fr);">
        ${active.map((pane, index) => this.renderPane(pane, index)).join('')}
      </div>
      ${minimized.length > 0 ? `
        <div class="panes-dock">
          ${minimized.map(pane => this.renderPane(pane)).join('')}
        </div>
      ` : ''}
    `;
    this.wireUp();
  }

  renderPane(pane, index) {
    const minimized = pane.windowState === 'minimized';
    const maximized = pane.windowState === 'maximized';
    const orderStyle = index !== undefined ? `order: ${index};` : '';
    return `
      <div class="pane ${maximized ? 'is-maximized' : ''}" data-pane-id="${pane.id}" style="${orderStyle}">
        <div class="pane-header" ${!minimized && !maximized ? 'draggable="true"' : ''}>
          <span class="pane-title">Search ${pane.id}</span>
          <div class="pane-controls">
            ${!minimized ? `<button class="control-btn" data-action="minimize" title="Minimize">&#8722;</button>` : ''}
            ${pane.windowState === 'normal' ? `<button class="control-btn" data-action="maximize" title="Maximize">&#10530;</button>` : ''}
            ${maximized || minimized ? `<button class="control-btn" data-action="restore" title="Restore">&#10529;</button>` : ''}
            <button class="control-btn close-btn" data-action="close" title="Close">&#10005;</button>
          </div>
        </div>
        ${!minimized ? `
          <div class="pane-body">
            <div class="query-panel">
              <div class="query-row">
                <md-outlined-select class="query-select item-type-select" data-action="select-type">
                  <md-select-option value="" ${!pane.selectedTypeName ? 'selected' : ''}>
                    <div slot="headline">-- Select item type --</div>
                  </md-select-option>
                  ${pane.availableTypes.map(type => `
                    <md-select-option value="${escapeHtml(type.name)}" ${pane.selectedTypeName === type.name ? 'selected' : ''}>
                      <div slot="headline">${escapeHtml(type.name)}</div>
                    </md-select-option>
                  `).join('')}
                </md-outlined-select>
                <md-filled-button class="project-button" data-action="project" ${!pane.selectedTypeName || pane.isLoading ? 'disabled' : ''}>
                  ${pane.isLoading ? 'Loading...' : 'Project'}
                </md-filled-button>
              </div>
              ${pane.selectedTypeName ? `
                <div class="sort-row">
                  ${pane.sortableFields.length > 0 ? `
                    <span class="sort-label">Sort</span>
                    ${this.renderFieldPicker({
                      key: `sort:${pane.id}`,
                      fields: pane.sortableFields,
                      value: pane.selectedSortField,
                      noneLabel: '-- None --',
                    })}
                    ${pane.selectedSortField ? `
                      <md-outlined-button class="sort-direction-button" data-action="toggle-sort-direction">${pane.selectedSortDirection}</md-outlined-button>
                    ` : ''}
                  ` : ''}
                  <span class="sort-label page-size-label">Page size</span>
                  <input type="number" class="page-size-input" data-action="set-page-size"
                         min="1" step="1" inputmode="numeric" placeholder="${DEFAULT_PAGE_SIZE}"
                         value="${pane.pageSize ?? ''}" />
                </div>
                <div class="filter-section">
                  <span class="sort-label">Filters</span>
                  ${pane.filters.map((f, i) => `
                    <div class="filter-row">
                      ${this.renderFieldPicker({
                        key: `filter:${pane.id}:${i}`,
                        fields: pane.sortableFields.filter(field => !field.system),
                        value: f.field,
                        noneLabel: '-- Field --',
                        filterIndex: i,
                      })}
                      <span class="filter-op">=</span>
                      <input type="text" class="filter-value-input" data-action="set-filter-value" data-index="${i}"
                             placeholder="value" value="${escapeHtml(f.value ?? '')}" />
                      <button class="control-btn filter-remove-button" data-action="remove-filter" data-index="${i}" title="Remove filter">&#10005;</button>
                    </div>
                  `).join('')}
                  <md-outlined-button class="add-filter-button" data-action="add-filter">+ Add Filter</md-outlined-button>
                </div>
              ` : ''}
            </div>
            ${pane.results.length > 0 ? `
              <div class="results-summary" style="display: flex; align-items: center; gap: 12px;">
                <span>${pane.lastTotalCount != null
                  ? `${pane.pageOffset + 1}–${pane.pageOffset + pane.results.length} of ${pane.lastTotalCount}`
                  : `${pane.results.length}`} items
                ${pane.lastProjectionMs !== null ? `<span class="timing"> &middot; ${(pane.lastProjectionMs / 1000).toFixed(3)}s</span>` : ''}</span>
                ${pane.lastTotalCount != null && pane.lastTotalCount > this.effectivePageSize(pane) ? `
                  <div class="pager">
                    <button data-action="page-prev" ${pane.pageOffset === 0 ? 'disabled' : ''}>&lsaquo; Prev</button>
                    <button data-action="page-next" ${pane.pageOffset + this.effectivePageSize(pane) >= pane.lastTotalCount ? 'disabled' : ''}>Next &rsaquo;</button>
                  </div>
                ` : ''}
                <div class="view-toggle">
                  <button class="${pane.viewMode === 'formatted' ? 'active' : ''}" data-action="view-formatted">Formatted</button>
                  <button class="${pane.viewMode === 'raw' ? 'active' : ''}" data-action="view-raw">Raw</button>
                </div>
              </div>
              ${pane.viewMode === 'raw' ? `
                <div class="results-list">
                  ${pane.results.map(item => `<pre class="result-item">${escapeHtml(JSON.stringify(item, null, 2))}</pre>`).join('')}
                </div>
              ` : `
                <div class="results-list">
                  ${pane.results.map(item => this.renderItemCard(pane, item)).join('')}
                </div>
              `}
            ` : (!pane.isLoading && pane.selectedTypeName ? '<p class="no-results">No items found.</p>' : '')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Groups a flat sortableFields-shaped list (dotted paths, e.g. "additionalDetails.reviewInfo.
  // reviewerName") into a nested tree by path segment, alphabetized at every level. Purely a
  // display concern -- the backend's own dot-path resolution (RegisterPartitionManager.
  // resolveProperty) is untouched; a leaf's `path` here is still the exact dotted string sort/
  // filter already send it. System fields (itemId, createdAt, ...) are plain un-dotted names, so
  // they fall out as ordinary top-level leaves, alphabetized alongside real properties rather than
  // kept in their own separate group.
  buildFieldTree(fields) {
    const root = [];
    for (const field of fields) {
      const segments = field.name.split('.');
      let level = root;
      for (let i = 0; i < segments.length - 1; i++) {
        let group = level.find(n => n.children && n.label === segments[i]);
        if (!group) {
          group = { label: segments[i], path: null, system: false, children: [] };
          level.push(group);
        }
        level = group.children;
      }
      level.push({ label: segments[segments.length - 1], path: field.name, system: field.system, children: null });
    }
    return this._sortFieldTree(root);
  }

  _sortFieldTree(nodes) {
    return [...nodes]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(n => n.children ? { ...n, children: this._sortFieldTree(n.children) } : n);
  }

  // A leaf survives a query if its own name matches, or any ancestor's does (ancestorMatch is
  // threaded down through the recursion) -- so typing "info" keeps both requestorName and
  // requestorEmail visible, indented under requestorInfo, even though neither leaf name itself
  // contains "info". A container survives only if at least one descendant does, pruning empty
  // branches. query is assumed already lower-cased by the caller.
  filterFieldTree(nodes, query, ancestorMatch) {
    const result = [];
    for (const node of nodes) {
      const matched = ancestorMatch || node.label.toLowerCase().includes(query);
      if (node.children) {
        const children = this.filterFieldTree(node.children, query, matched);
        if (children.length > 0) result.push({ ...node, children });
      } else if (matched) {
        result.push(node);
      }
    }
    return result;
  }

  renderFieldTreeNodes(nodes, depth) {
    return nodes.map(node => {
      const indent = 12 + depth * 16;
      if (node.children) {
        return `<div class="field-tree-group" style="padding-left:${indent}px">${escapeHtml(node.label)}</div>`
            + this.renderFieldTreeNodes(node.children, depth + 1);
      }
      return `<button type="button" class="field-tree-leaf" style="padding-left:${indent}px" data-field-value="${escapeHtml(node.path)}">${escapeHtml(node.label)}${node.system ? ' *' : ''}</button>`;
    }).join('');
  }

  renderFieldPickerList(fields, query) {
    const tree = this.buildFieldTree(fields);
    const nodes = query ? this.filterFieldTree(tree, query.toLowerCase(), false) : tree;
    const html = this.renderFieldTreeNodes(nodes, 0);
    return html || '<div class="field-tree-empty">No matches</div>';
  }

  // Hand-rolled dropdown, not md-outlined-select: a native/Material select can't render
  // non-selectable indented group headers (OBJECT properties, never a valid sort/filter target
  // themselves) alongside their scalar leaves at arbitrary nesting depth, plus an inline search
  // box that live-filters the list while preserving that nesting -- see filterFieldTree. Popup
  // visibility is driven by the single component-level openFieldPicker key (see the constructor),
  // not per-pane state, mirroring how only one native <select> dropdown is ever open at a time.
  renderFieldPicker({ key, fields, value, noneLabel, filterIndex }) {
    const isOpen = this.openFieldPicker === key;
    const dataAttrs = `data-picker-key="${escapeHtml(key)}"`
        + (filterIndex !== undefined ? ` data-filter-index="${filterIndex}"` : '');
    return `
      <div class="field-picker">
        <button type="button" class="field-picker-toggle" data-action="toggle-field-picker" ${dataAttrs}>${escapeHtml(value ?? noneLabel)}</button>
        ${isOpen ? `
          <div class="field-picker-popup" ${dataAttrs}>
            <input type="text" class="field-picker-search" placeholder="Filter properties..." autocomplete="off" />
            <button type="button" class="field-tree-none" data-field-value="">${escapeHtml(noneLabel)}</button>
            <div class="field-tree-list">${this.renderFieldPickerList(fields, '')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  toggleFieldPicker(key) {
    this.openFieldPicker = this.openFieldPicker === key ? null : key;
    this.render();
  }

  // Wires one already-rendered (open) popup: the search input live-filters .field-tree-list via a
  // direct, scoped innerHTML replacement rather than this.render() -- a full pane re-render on
  // every keystroke would tear down and recreate the input itself, losing focus/cursor position
  // mid-type (same reasoning as setPageSize/setFilterValue elsewhere in this file). Leaf clicks
  // (including the pinned "none" row) go through onSelect and always close the popup.
  wireFieldPickerPopup(popup, fields, onSelect) {
    const select = value => {
      this.openFieldPicker = null;
      onSelect(value || null);
    };
    // The "none" row lives outside .field-tree-list and is never replaced by the live-filter
    // re-render below, so it's wired exactly once here -- re-wiring it inside wireLeaves (like the
    // leaves themselves, which genuinely are fresh nodes each time) would stack a duplicate
    // listener per keystroke.
    popup.querySelector('.field-tree-none').addEventListener('click', () => select(''));
    const list = popup.querySelector('.field-tree-list');
    const wireLeaves = () => {
      list.querySelectorAll('.field-tree-leaf').forEach(btn => {
        btn.addEventListener('click', () => select(btn.dataset.fieldValue));
      });
    };
    wireLeaves();
    const search = popup.querySelector('.field-picker-search');
    search.addEventListener('input', e => {
      list.innerHTML = this.renderFieldPickerList(fields, e.target.value);
      wireLeaves();
    });
    search.focus();
  }

  renderItemCard(pane, item) {
    const edit = pane.editingItems[item.itemId];
    const isEditing = !!edit;
    const title = item.displayLabel || item.itemType;
    const shortId = item.itemId.substring(0, 8) + '...';
    // permissions.edit is a tree (see ProjectedItemPermissions), not a flat list -- buildEditTree/
    // buildFullEditTree never return an empty-but-non-null node (superuser included -- it gets the
    // real fully-enumerated tree, no separate flag), so a plain non-null check is enough to know
    // "something somewhere on this item is writable." Per-field filtering of which rows actually
    // render as editable is still TODO -- entering edit mode currently still offers every top-level
    // property, not just the ones this tree says are writable.
    const canEditProps = !!item.permissions?.edit;
    const canDelete = !!item.permissions?.delete;

    const propEntries = this.sortPropEntries(Object.entries(item.properties));
    let rows;
    let editCount = 0;
    if (isEditing) {
      const topKeys = Array.from(new Set(Object.keys(edit.values)));
      const topEntries = this.sortPropEntries(topKeys.map(key => [key, getAtPath(edit.values, [key])]));
      rows = topEntries.map(([key]) => this.renderEditableRow(pane, edit, [key])).join('');
      for (const [key] of topEntries) {
        editCount += this.diffEditedValue(edit.values[key], item.properties[key], edit.removed, [key]).leafCount;
      }
    } else {
      rows = propEntries.map(([key, val]) => this.renderPropRow(key, val)).join('');
    }

    return `
      <div class="item-card" data-item-id="${item.itemId}" data-item-type="${escapeHtml(item.itemType)}">
        <div class="item-card-header" draggable="true">
          <div>
            <span class="item-card-title">${escapeHtml(title)}</span>
            <span class="item-card-id">${shortId}</span>
          </div>
          ${canEditProps || canDelete ? `<div class="item-card-actions">
            ${canEditProps ? `<button class="edit-link-button ${isEditing ? 'editing' : ''}" title="${isEditing ? 'Editing' : 'Edit item'}" aria-label="${isEditing ? 'Editing' : 'Edit item'}" data-action="toggle-edit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
              </svg>
            </button>` : ''}
            ${canDelete && !isEditing ? `<button class="delete-item-button" title="Delete item" aria-label="Delete item" data-action="delete-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </button>` : ''}
          </div>` : ''}
        </div>
        <div class="prop-grid ${isEditing ? 'is-editing' : ''}">${rows}</div>
        ${this.renderLinkGroups(pane, item)}
        ${this.renderStateSection(item)}
        ${this.renderMarkerChips(item)}
        ${isEditing ? `
          <div class="add-prop-row">
            <button data-action="add-prop" data-path="">+ Add property</button>
          </div>
          <div class="save-bar">
            ${editCount > 0 ? `<span class="change-count">${editCount} change${editCount !== 1 ? 's' : ''}</span>` : ''}
            <button class="cancel-btn" data-action="cancel-edit">Cancel</button>
            <button class="save-btn" data-action="save-edit">Save</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // item.markers is null for a non-superuser (see ProjectedItem's own comment) -- rendered as
  // nothing at all, not an empty section, so the formatted view doesn't hint that admin-only data
  // exists. An empty array (superuser, item just has no markers) also renders nothing, same as
  // link groups do for an item with no links.
  renderMarkerChips(item) {
    if (!item.markers || item.markers.length === 0) return '';
    return `
      <div class="marker-chips">
        ${item.markers.map(name => `<span class="marker-chip">${escapeHtml(name)}</span>`).join('')}
      </div>
    `;
  }

  // Grouped by perspective name (the shape the projection response already comes in --
  // { perspectiveName: [{linkId, properties, item}, ...] }, so no client-side grouping logic is
  // actually needed, just per-group rendering), each group independently collapsible so a large
  // perspective can be pushed out of view without hiding the others. The nested item is rendered
  // one level deep only, matching what the backend actually returns (a linked item's own `links`
  // always comes back empty in this response) -- no risk of runaway recursive nesting.
  renderLinkGroups(pane, item) {
    const links = item.links || {};
    const perspectiveNames = Object.keys(links).sort();
    if (perspectiveNames.length === 0) return '';
    const collapsed = pane.collapsedLinkGroups[item.itemId] || new Set();
    return `
      <div class="link-groups">
        ${perspectiveNames.map(name => {
          const linkedItems = links[name];
          const isCollapsed = collapsed.has(name);
          const propertyDefs = this.linkPropertyDefsFor(item.itemType, name);
          return `
            <div class="link-group" data-perspective="${escapeHtml(name)}">
              <button class="link-group-header" data-action="toggle-link-group" data-perspective="${escapeHtml(name)}">
                <svg class="chevron ${isCollapsed ? 'collapsed' : ''}" viewBox="0 0 24 24" width="14" height="14"
                     fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span class="link-group-label">${escapeHtml(name)}</span>
                <span class="link-group-count">${linkedItems.length}</span>
              </button>
              ${!isCollapsed ? `
                <div class="link-group-body">
                  ${linkedItems.map(l => this.renderLinkedItemCard(l, propertyDefs)).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Resolves a perspective name to its link type's own property *definitions* -- two hops, since
  // a perspective (AdminItemLinkPerspectiveView) only carries the schema-level link-type id, and
  // the property definitions themselves live on the link type (AdminLinkView), keyed by that id
  // (see cacheSchemaSideTables). Returns [] for a perspective with no properties or one this
  // client's schema cache doesn't (yet) recognize, rather than throwing -- callers all treat an
  // empty list as "nothing to show/edit", which is the correct fallback either way.
  linkPropertyDefsFor(itemTypeName, perspectiveName) {
    const type = this.itemTypesByName.get(itemTypeName);
    const perspectiveEntry = (type?.links[perspectiveName] || [])[0];
    if (!perspectiveEntry) return [];
    return this.linkDefsById.get(perspectiveEntry.linkId)?.properties || [];
  }

  // Item section alone -- no unlink button here anymore (see renderLinkedItemCard's own comment
  // on why it moved out to the card's action rail instead).
  renderNestedItemSection(linkedItem, shortId, title) {
    const propEntries = this.sortPropEntries(Object.entries(linkedItem.properties || {}));
    return `
      <div class="nested-item-section">
        <div class="nested-item-header">
          <div>
            <span>${escapeHtml(title)}</span>
            <span class="nested-item-type">${escapeHtml(linkedItem.itemType)}</span>
          </div>
          <span class="nested-item-id">${shortId}</span>
        </div>
        <div class="prop-grid">
          ${propEntries.map(([key, val]) => this.renderPropRow(key, val)).join('')}
        </div>
      </div>
    `;
  }

  renderLinkedItemCard(linkEntry, propertyDefs) {
    const linkedItem = linkEntry.item;
    const shortId = linkedItem.itemId.substring(0, 8) + '...';
    const title = linkedItem.displayLabel || linkedItem.itemType;
    // Only properties the link actually has a value for -- propertyDefs is every property the
    // link TYPE could carry, not every property THIS link instance has actually set.
    const linkPropEntries = this.sortPropEntries((propertyDefs || [])
      .filter(p => linkEntry.properties && linkEntry.properties[p.name] !== undefined && linkEntry.properties[p.name] !== null)
      .map(p => [p.name, linkEntry.properties[p.name]]));
    const itemSection = this.renderNestedItemSection(linkedItem, shortId, title);

    const linkPropertiesSection = `
      <div class="nested-item-section">
        <div class="nested-item-header">
          <span class="nested-item-section-label">Link Properties</span>
          <button class="edit-link-button" title="Edit link properties" aria-label="Edit link properties" data-action="edit-link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
          </button>
        </div>
        ${linkPropEntries.length > 0 ? `
          <div class="prop-grid">
            ${linkPropEntries.map(([key, val]) => this.renderPropRow(key, val)).join('')}
          </div>
        ` : `<div class="nested-empty-note">No properties set</div>`}
      </div>
    `;

    // Item first, link properties below it -- flipped from the property order (link
    // properties are conceptually "about the connection", the item is the thing connected),
    // matching how the search pane groups results: the linked item is what a reader scans for
    // first, the link's own metadata is supplementary detail underneath it.
    const body = propertyDefs.length === 0 ? itemSection : `
      <div class="nested-item-sections">
        ${itemSection}
        ${linkPropertiesSection}
      </div>
    `;

    // unlink lives on the card itself, to the left of everything it groups together (link
    // properties + item, or just item), since it removes the LINK -- not either section
    // individually the way edit-link (scoped to just the link-properties section) still does.
    return `
      <div class="nested-item-card" data-link-id="${escapeHtml(linkEntry.linkId)}" data-item-type="${escapeHtml(linkedItem.itemType)}" data-item-title="${escapeHtml(title)}">
        <button class="unlink-button" title="Remove link" aria-label="Remove link" data-action="unlink">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
        </button>
        <div class="nested-item-body">${body}</div>
      </div>
    `;
  }

  // Same "does this render as a nested panel or a flat value" test renderPropRow branches on --
  // factored out so the scalar/object split used for display *ordering* (sortPropEntries below)
  // can never drift out of sync with what actually decides *how* a property renders. Arrays
  // (LIST/SET cardinality) and binary refs are objects in JS but render as plain values, same as
  // any scalar, so both count as "scalar" for ordering purposes too.
  isObjectProperty(val) {
    return !!(val && typeof val === 'object' && !Array.isArray(val) && !(val.mimeType && val.url));
  }

  // Scalar properties before OBJECT ones, alphabetical within each group -- so display order
  // tracks the same scalar/object distinction that already governs each property's shape, rather
  // than whatever order the schema or a JSON object's own keys happened to produce. Takes
  // [key, value] entries (not a plain properties object) so callers that need to sort by a value
  // living somewhere other than the entry itself (e.g. edit-mode's edit.values, keyed separately
  // from the schema-defined keys) can build entries however they need to first.
  sortPropEntries(entries) {
    const scalars = entries.filter(([, v]) => !this.isObjectProperty(v)).sort((a, b) => a[0].localeCompare(b[0]));
    const objects = entries.filter(([, v]) => this.isObjectProperty(v)).sort((a, b) => a[0].localeCompare(b[0]));
    return [...scalars, ...objects];
  }

  // Renders one property as a label-above-value cell. A nested OBJECT property's value gets a
  // fundamentally different shape from a scalar one -- the property's own name doubles as a
  // disclosure toggle (chevron sits right next to the label, not buried down in the value), so
  // that case is a <details> covering the *whole* cell (see renderObjectPropRow), not something
  // decided inside the value alone.
  renderPropRow(key, val) {
    if (this.isObjectProperty(val)) {
      return this.renderObjectPropRow(key, val);
    }
    return `
      <div class="prop-row">
        <div class="prop-key">${escapeHtml(key)}</div>
        <div class="prop-value">${this.renderPropertyValue(val)}</div>
      </div>
    `;
  }

  // Closed-by-default <details> standing in for a normal .prop-row -- the chevron+label live in
  // <summary> (the actual toggle). The "(N fields)" hint has to live *inside* <summary> too, not
  // as a sibling after it -- a native <details> unconditionally hides every child except
  // <summary> while closed (a browser-level content model, not a CSS display:none my own rules
  // could override), so a hint placed outside <summary> would never actually paint while
  // collapsed no matter what CSS targeted it. Hidden again once open via the [open] rule below,
  // at which point the real nested grid (genuine <details> content, so never in the DOM being
  // interacted with while hidden) takes its place. Each entry recurses through renderPropRow
  // again, so a child that's itself an OBJECT property becomes its own nested <details>
  // automatically, however deep the schema goes -- no depth limit needed (unlike
  // renderLinkGroups' linked items, which the backend only ever returns one level deep, this is
  // client-side recursion over data the projection already returned in full).
  renderObjectPropRow(key, val) {
    const entries = this.sortPropEntries(Object.entries(val));
    const hint = entries.length === 0 ? '(empty)' : `(${entries.length} field${entries.length === 1 ? '' : 's'})`;
    return `
      <details class="prop-row object-property-row">
        <summary>
          <span class="object-property-summary-row">
            <svg class="chevron" viewBox="0 0 24 24" width="12" height="12"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span class="prop-key">${escapeHtml(key)}</span>
          </span>
          <span class="collapsed-hint value-text">${hint}</span>
        </summary>
        ${entries.length > 0 ? `
          <div class="prop-grid nested-object-grid">
            ${entries.map(([k, v]) => this.renderPropRow(k, v)).join('')}
          </div>
        ` : ''}
      </details>
    `;
  }

  // The editable counterpart to renderPropRow/renderObjectPropRow -- same recursive shape (an
  // OBJECT-valued row renders its own boxed sub-grid instead of a single field), but every leaf is
  // an <input> and every row carries a remove action, addressed by dotted path (see
  // toggleEdit's own comment on why edit.values/edit.removed are path-keyed rather than flat).
  // Branches on the *value's* actual shape (object vs. not), not solely on the schema def's
  // declared type -- mirrors renderPropRow's own reasoning, and stays correct even if a value's
  // def can't be found (e.g. a property added before a schema change).
  renderEditableRow(pane, edit, path) {
    const pathKey = path.join('.');
    const key = path[path.length - 1];
    if (edit.removed.has(pathKey)) {
      return `<div class="prop-row is-editing">
        <div class="prop-key removed">${escapeHtml(key)}</div>
        <div class="prop-value removed">
          <span class="value-null">(marked for removal)</span>
          <div class="prop-actions">
            <button title="Undo remove" data-action="undo-remove" data-path="${escapeHtml(pathKey)}">&#x21b6;</button>
          </div>
        </div>
      </div>`;
    }
    const val = getAtPath(edit.values, path);
    const def = this.findPropertyDef(pane.propertyDefs, path);
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return this.renderEditableObjectRow(pane, edit, path, val, def);
    }
    const inputType = this.inputTypeFor(def?.type);
    return `<div class="prop-row is-editing">
      <div class="prop-key">${escapeHtml(key)}</div>
      <div class="prop-value">
        <input type="${inputType}" value="${escapeHtml(val == null ? '' : String(val))}" data-action="edit-value" data-path="${escapeHtml(pathKey)}">
        <div class="prop-actions">
          <button class="delete-btn" title="Remove property" data-action="remove-prop" data-path="${escapeHtml(pathKey)}">&times;</button>
        </div>
      </div>
    </div>`;
  }

  renderEditableObjectRow(pane, edit, path, val, def) {
    const pathKey = path.join('.');
    const key = path[path.length - 1];
    const childKeys = this.sortPropEntries(Object.entries(val)).map(([k]) => k);
    const childDefs = def?.properties || [];
    const available = childDefs.filter(p => !childKeys.includes(p.name));
    return `
      <div class="prop-row is-editing object-property-edit-row">
        <div class="object-property-summary-row">
          <span class="prop-key">${escapeHtml(key)}</span>
          <div class="prop-actions">
            <button class="delete-btn" title="Remove property" data-action="remove-prop" data-path="${escapeHtml(pathKey)}">&times;</button>
          </div>
        </div>
        <div class="prop-grid nested-object-grid is-editing">
          ${childKeys.map(k => this.renderEditableRow(pane, edit, [...path, k])).join('')}
        </div>
        ${available.length > 0 ? `
          <div class="add-prop-row">
            <button data-action="add-prop" data-path="${escapeHtml(pathKey)}">+ Add field</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderPropertyValue(val) {
    if (val == null || val === '') return '<span class="value-null">(empty)</span>';
    if (val && typeof val === 'object' && val.mimeType && val.url) {
      if (val.mimeType.startsWith('image/')) {
        return `<img class="prop-image" src="${escapeHtml(val.url)}" alt="image">`;
      }
      return `<span class="value-text">${escapeHtml(val.mimeType)} (${Math.round((val.length || 0) / 1024)}KB)</span>`;
    }
    if (val && typeof val === 'object') {
      return `<span class="value-text">${escapeHtml(JSON.stringify(val))}</span>`;
    }
    return `<span class="value-text">${escapeHtml(String(val))}</span>`;
  }

  // Matches PropertyType.java's real enum values (STRING, INT, LONG, DOUBLE, DATE, DATETIME,
  // BOOLEAN, BINARY, OBJECT) -- this used to check for 'INTEGER'/'FLOAT', which that enum has
  // never had, so every numeric property silently rendered as a plain text input. That in turn
  // meant its edited value was always captured as a JS string (see the 'edit-value' listener in
  // wireUp()), which the backend correctly rejects for an INT/LONG/DOUBLE property expecting an
  // actual number.
  inputTypeFor(schemaType) {
    switch (schemaType) {
      case 'INT': case 'LONG': case 'DOUBLE': return 'number';
      case 'DATE': return 'date';
      case 'DATETIME': return 'datetime-local';
      case 'BOOLEAN': return 'checkbox';
      default: return 'text';
    }
  }

  wireUp() {
    this.querySelectorAll('[data-pane-id]').forEach(paneEl => {
      const id = Number(paneEl.dataset.paneId);
      paneEl.querySelectorAll('[data-action]:not(.item-card [data-action])').forEach(el => {
        const action = el.dataset.action;
        if (action === 'minimize') el.addEventListener('click', () => this.minimizePane(id));
        if (action === 'maximize') el.addEventListener('click', () => this.maximizePane(id));
        if (action === 'restore') el.addEventListener('click', () => this.restorePane(id));
        if (action === 'close') el.addEventListener('click', () => this.closePane(id));
        if (action === 'project') el.addEventListener('click', () => this.runQuery(id));
        if (action === 'page-prev') el.addEventListener('click', () => this.prevPage(id));
        if (action === 'page-next') el.addEventListener('click', () => this.nextPage(id));
        if (action === 'toggle-sort-direction') el.addEventListener('click', () => this.toggleSortDirection(id));
        if (action === 'select-type') el.addEventListener('change', e => this.selectType(id, e.target.value));
        if (action === 'toggle-field-picker') el.addEventListener('click', () => this.toggleFieldPicker(el.dataset.pickerKey));
        if (action === 'set-page-size') el.addEventListener('change', e => {
          this.setPageSize(id, e.target.value);
          e.target.value = this.pane(id).pageSize ?? ''; // reflect the normalized value without a re-render
        });
        if (action === 'add-filter') el.addEventListener('click', () => this.addFilter(id));
        if (action === 'remove-filter') el.addEventListener('click', () => this.removeFilter(id, parseInt(el.dataset.index, 10)));
        if (action === 'set-filter-value') el.addEventListener('change', e => this.setFilterValue(id, parseInt(el.dataset.index, 10), e.target.value));
        if (action === 'view-formatted') el.addEventListener('click', () => this.setViewMode(id, 'formatted'));
        if (action === 'view-raw') el.addEventListener('click', () => this.setViewMode(id, 'raw'));
      });

      // At most one field-picker popup renders at a time (this.openFieldPicker), so this is
      // never more than a single element -- but scoped to this pane regardless, same as every
      // other [data-action] handler above.
      const pane = this.pane(id);
      paneEl.querySelectorAll('.field-picker-popup').forEach(popup => {
        const filterIndex = popup.dataset.filterIndex;
        if (filterIndex !== undefined) {
          const i = parseInt(filterIndex, 10);
          this.wireFieldPickerPopup(popup, pane.sortableFields.filter(field => !field.system), value => this.setFilterField(id, i, value));
        } else {
          this.wireFieldPickerPopup(popup, pane.sortableFields, value => this.selectSortField(id, value));
        }
      });

      paneEl.querySelectorAll('.item-card[data-item-id]').forEach(cardEl => {
        const itemId = cardEl.dataset.itemId;
        cardEl.querySelectorAll('[data-action]').forEach(el => {
          const action = el.dataset.action;
          if (action === 'toggle-edit') el.addEventListener('click', () => this.toggleEdit(id, itemId));
          if (action === 'cancel-edit') el.addEventListener('click', () => this.cancelEdit(id, itemId));
          if (action === 'save-edit') el.addEventListener('click', () => this.saveEdit(id, itemId));
          if (action === 'delete-item') el.addEventListener('click', () => this.deleteItem(id, itemId));
          if (action === 'sm-start') el.addEventListener('click', () => this.startStateMachineForItem(id, itemId, el.dataset.machine));
          if (action === 'sm-transition') el.addEventListener('click', () => this.executeTransitionForItem(id, itemId, el.dataset.machine, el.dataset.transition));
          if (action === 'add-prop') el.addEventListener('click', () => this.addProperty(id, itemId, el.dataset.path));
          if (action === 'remove-prop') el.addEventListener('click', () => this.removeProperty(id, itemId, el.dataset.path));
          if (action === 'undo-remove') el.addEventListener('click', () => this.undoRemoveProperty(id, itemId, el.dataset.path));
          // A number input's own .value is still a plain string in JS regardless of its type
          // attribute -- .valueAsNumber is what actually parses it, and is what makes an
          // INT/LONG/DOUBLE property round-trip as a real number instead of a string the backend
          // then rejects (see inputTypeFor's own comment). Empty is null (property cleared, not
          // NaN sent to the server), and a value that hasn't parsed to a valid number yet (e.g.
          // mid-typing "-") is left as NaN in memory -- diffEditedValue/saveEdit only ever compare
          // it against the old value and JSON.stringify it on actual save, both of which handle a
          // stray NaN fine without needing special-casing here.
          if (action === 'edit-value') el.addEventListener('input', e => {
            const value = e.target.type === 'number'
              ? (e.target.value === '' ? null : e.target.valueAsNumber)
              : e.target.value;
            this.updateEditValue(id, itemId, el.dataset.path, value);
          });
          if (action === 'toggle-link-group') el.addEventListener('click', () => this.toggleLinkGroup(id, itemId, el.dataset.perspective));
          // Nested inside cardEl (a linked item's own card, inside a link-group), not one of the
          // outer item's own actions above -- reads the linkId/type off the nested card itself
          // rather than the outer item, since that's what actually identifies the link to delete.
          if (action === 'unlink') {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              const nestedEl = el.closest('.nested-item-card');
              this.unlinkItem(id, nestedEl.dataset.linkId, nestedEl.dataset.itemType, nestedEl.dataset.itemTitle);
            });
          }
          // Perspective name isn't on the nested card itself (it's shared by every card in the
          // group) -- read off the ancestor .link-group instead of threading it through as its
          // own data attribute on every single nested card.
          if (action === 'edit-link') {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              const nestedEl = el.closest('.nested-item-card');
              const perspective = el.closest('.link-group').dataset.perspective;
              this.editLinkProperties(id, itemId, perspective, nestedEl.dataset.linkId, nestedEl.dataset.itemType, nestedEl.dataset.itemTitle);
            });
          }
        });
      });

      // draggable="true" lives on .pane-header, not the whole pane -- an ancestor-wide draggable
      // hijacks any click-and-drag gesture inside it for native HTML5 DnD, which made it
      // impossible to select text out of a pane's own results (a click-drag over a .result-item
      // started a pane-reorder drag instead of a text selection). The header is a small,
      // content-free strip, so this is a safe place for it. dragover/dragenter/drop stay on
      // paneEl below -- drop-target detection doesn't care which element the drag originated
      // from, and dropping anywhere over a pane (not just its header) should still reorder it.
      const headerEl = paneEl.querySelector('.pane-header');
      if (headerEl && headerEl.draggable) {
        headerEl.addEventListener('dragstart', e => {
          this.draggingPaneId = id;
          this.dragPreviewOrder = this.activePanes().slice();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(id));
          // The whole pane is still what visually follows the cursor (not just the header) --
          // setDragImage explicitly takes paneEl as the drag image, independent of which element
          // is the draggable="true" source. Deferred for the same reason as before: the browser
          // must snapshot the pane's normal appearance before is-drag-source hides its content.
          e.dataTransfer.setDragImage(paneEl, e.offsetX, e.offsetY);
          setTimeout(() => paneEl.classList.add('is-drag-source'), 0);
        });
        headerEl.addEventListener('dragend', () => {
          // A real drop already committed and cleared these; this only matters for a cancelled
          // drag (dropped outside any valid target), where it discards the live preview and
          // falls back to a full render so every pane's `order` reverts to its committed slot.
          paneEl.classList.remove('is-drag-source');
          if (this.draggingPaneId !== null) {
            this.draggingPaneId = null;
            this.dragPreviewOrder = null;
            this.render();
          }
        });
      }
      paneEl.addEventListener('dragover', e => {
        if (this.draggingPaneId === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      paneEl.addEventListener('dragenter', () => {
        if (this.draggingPaneId === null || this.draggingPaneId === id) return;
        this.previewReorder(id);
      });
      paneEl.addEventListener('drop', e => {
        e.preventDefault();
        if (this.draggingPaneId !== null) this.commitDragPreviewOrder();
      });

      // draggable="true" lives on .item-card-header only, for the same reason as .pane-header
      // above -- an ancestor-wide draggable would hijack click-drag text selection and edit-mode
      // <input> focus inside the card body.
      paneEl.querySelectorAll('.item-card[data-item-id]').forEach(cardEl => {
        const itemId = cardEl.dataset.itemId;
        const headerEl = cardEl.querySelector('.item-card-header');
        headerEl.addEventListener('dragstart', e => {
          const pane = this.pane(id);
          const item = pane.results.find(r => r.itemId === itemId);
          if (!item) return;
          this.draggingItem = item;
          e.dataTransfer.effectAllowed = 'link';
          e.dataTransfer.setData('text/plain', itemId);
          e.dataTransfer.setDragImage(cardEl, e.offsetX, e.offsetY);
          setTimeout(() => cardEl.classList.add('is-drag-source'), 0);
          this.applyItemDragHighlights(item);
        });
        headerEl.addEventListener('dragend', () => {
          cardEl.classList.remove('is-drag-source');
          this.draggingItem = null;
          this.clearItemDragHighlights();
        });

        cardEl.addEventListener('dragover', e => {
          if (this.draggingItem === null || !cardEl.classList.contains('valid-drop-target')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'link';
        });
        cardEl.addEventListener('drop', e => {
          if (this.draggingItem === null) return;
          e.preventDefault();
          const dragged = this.draggingItem;
          const pane = this.pane(id);
          const target = pane.results.find(r => r.itemId === itemId);
          if (!target) return;
          const candidates = this.computeLinkCandidates(dragged, target);
          this.resolveAndCreateLink(candidates, dragged, target);
        });

        // Listeners scoped to each .link-group individually (not delegated from cardEl) so
        // stopPropagation cleanly prevents the ancestor .item-card's own dragover/drop above from
        // also firing -- a drop pinned to one perspective shouldn't also run full resolution.
        cardEl.querySelectorAll('.link-group[data-perspective]').forEach(groupEl => {
          groupEl.addEventListener('dragover', e => {
            if (this.draggingItem === null || !groupEl.classList.contains('valid-drop-target')) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'link';
          });
          groupEl.addEventListener('drop', e => {
            if (this.draggingItem === null) return;
            e.preventDefault();
            e.stopPropagation();
            const dragged = this.draggingItem;
            const pane = this.pane(id);
            const target = pane.results.find(r => r.itemId === itemId);
            if (!target) return;
            const perspective = groupEl.dataset.perspective;
            const candidates = this.computeLinkCandidates(dragged, target).filter(c => c.toPerspective === perspective);
            this.resolveAndCreateLink(candidates, dragged, target);
          });
        });
      });
    });
    const addPaneButton = this.querySelector('.add-pane-button');
    if (addPaneButton) addPaneButton.addEventListener('click', () => this.addPane());
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

// path-addressed read/write into a nested value tree (item.properties' shape) -- used by the
// item-card editor so a dotted path like ["contactInfo", "email"] can reach a leaf however deep
// it's nested, without every caller re-implementing the walk.
function getAtPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

function setAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

customElements.define('ntrloc-search', NtrlocSearch);
