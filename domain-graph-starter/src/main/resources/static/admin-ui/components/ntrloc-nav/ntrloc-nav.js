injectStyles('ntrloc-nav-styles', `
  ntrloc-nav {
    display: contents;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 60px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  nav .brand {
    font-weight: bold;
    margin-right: 24px;
  }
  nav a {
    color: var(--text);
    text-decoration: none;
    padding: 8px 12px;
    border-radius: 6px;
  }
  nav a.active {
    background: var(--border);
  }
  .nav-task-badge {
    display: inline-block;
    min-width: 16px;
    margin-left: 6px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--accent);
    color: white;
    font-size: 11px;
    font-weight: bold;
    text-align: center;
  }
  nav .nav-spacer { flex: 1; }
  .new-item-button {
    margin-left: 12px;
  }
  .new-item-status {
    margin-left: 12px;
    font-size: 12px;
    color: var(--muted);
  }
  .theme-toggle {
    margin-left: 12px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
  }
  .theme-toggle:hover {
    background: var(--panel-bg);
  }
`);

const ROUTES = [
  { path: '/search', label: 'Search' },
  { path: '/schema', label: 'Schema' },
  { path: '/processes', label: 'Processes' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/access', label: 'Access' },
];

class NtrlocNav extends HTMLElement {
  constructor() {
    super();
    // "Tasks needing this user's attention" -- same count GET /api/admin/process/tasks already
    // filters to (assignee/candidate, or everything for a superuser). Kept live via task-events.js
    // rather than polling: any task-created/assigned/completed signal triggers a re-fetch.
    this.taskCount = 0;
    this._refreshTimer = null;
    // Static asset, no server-side templating -- fetched once from BrandingController rather
    // than baked in at build time. Falls back to "ntrloc" until the fetch resolves (and stays
    // there if it fails) so the nav bar never renders blank.
    this.brandName = 'ntrloc';
  }

  connectedCallback() {
    this.render();
    this.onHashChange = () => this.render();
    window.addEventListener('hashchange', this.onHashChange);
    this.fetchTaskCount();
    this.fetchBrandName();
    this.unsubscribeTaskEvents = onTaskEvent(() => this.scheduleTaskCountRefresh());
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHashChange);
    if (this.unsubscribeTaskEvents) this.unsubscribeTaskEvents();
    clearTimeout(this._refreshTimer);
    clearTimeout(this._newItemStatusTimer);
  }

  // Debounced: a Run that creates a task can fire more than one event in quick succession
  // (created, then possibly assigned) -- no need to re-fetch once per event.
  scheduleTaskCountRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.fetchTaskCount(), 200);
  }

  async fetchTaskCount() {
    try {
      const response = await fetch('/api/admin/process/tasks', { credentials: 'include' });
      if (!response.ok) return;
      this.taskCount = (await response.json()).length;
      this.render();
    } catch (e) {
      // Best-effort -- a failed count fetch shouldn't break navigation.
    }
  }

  async fetchBrandName() {
    try {
      const response = await fetch('/api/admin/branding', { credentials: 'include' });
      if (!response.ok) return;
      this.brandName = (await response.json()).displayName;
      // index.html's static <title>ntrloc admin</title> is the pre-fetch fallback -- this is
      // the one component that already fetches branding, so it's the natural place to update
      // the tab title too rather than adding a second fetch elsewhere.
      document.title = `${this.brandName} admin`;
      this.render();
    } catch (e) {
      // Best-effort -- keep the "ntrloc" fallback set in the constructor.
    }
  }

  currentPath() {
    return location.hash.replace(/^#/, '') || '/search';
  }

  // No constructor-time read of the current theme -- index.html's own inline script is the only
  // thing that runs early enough to avoid a flash, so this just reflects/toggles whatever
  // document.documentElement.dataset.theme already is by the time this element connects.
  currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  toggleTheme() {
    const next = this.currentTheme() === 'light' ? 'dark' : 'light';
    // 'dark' is the unattributed default (see index.html's base :root block) -- removing the
    // attribute entirely for it, rather than setting dataset.theme = 'dark', keeps the DOM state
    // matching what a user who's never touched the toggle also has (no attribute at all).
    if (next === 'dark') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = 'light';
    }
    localStorage.setItem('ntrloc-theme', next);
    this.render();
  }

  render() {
    const current = this.currentPath();
    const theme = this.currentTheme();
    this.innerHTML = `
      <nav>
        <span class="brand">${escapeHtml(this.brandName)}</span>
        ${ROUTES.map(route => `
          <a href="#${route.path}" class="${current === route.path ? 'active' : ''}">
            ${route.label}${route.path === '/tasks' && this.taskCount > 0 ? `<span class="nav-task-badge">${this.taskCount}</span>` : ''}
          </a>
        `).join('')}
        <span class="nav-spacer"></span>
        <span class="new-item-status">${escapeHtml(this._newItemStatus || '')}</span>
        <md-filled-button class="new-item-button">New Item</md-filled-button>
        <button class="theme-toggle" type="button">${theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
        <button class="theme-toggle logout-button" type="button">Logout</button>
      </nav>
    `;
    this.querySelector('.theme-toggle').addEventListener('click', () => this.toggleTheme());
    this.querySelector('.new-item-button').addEventListener('click', () => this.openNewItemDialog());
    this.querySelector('.logout-button').addEventListener('click', () => this.logout());
  }

  logout() {
    // CSRF is disabled repo-wide (SecurityConfig), and /logout's requiresLogout matcher isn't
    // restricted to POST, so a plain navigation is enough -- no form/fetch needed.
    window.location.href = '/logout';
  }

  // openItemMutationDialog (ntrloc-item-mutation-dialog.js) resolves the MutationResponse on a
  // successful create, undefined on cancel -- there's no per-instance detail page yet for a
  // created item to navigate to (only search/projection exists so far), so success is surfaced
  // here as a brief transient status message rather than a redirect. window's own
  // 'ntrloc-item-mutated' CustomEvent is dispatched regardless, for any other component (e.g. a
  // future auto-refreshing ntrloc-search) that wants to react without this nav needing to know
  // about it.
  async openNewItemDialog() {
    const result = await openItemMutationDialog({ mode: 'create' });
    if (!result) return;
    window.dispatchEvent(new CustomEvent('ntrloc-item-mutated', { detail: result }));
    this._newItemStatus = `Created ${result.items.length} item(s).`;
    this.render();
    clearTimeout(this._newItemStatusTimer);
    this._newItemStatusTimer = setTimeout(() => {
      this._newItemStatus = '';
      this.render();
    }, 4000);
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

customElements.define('ntrloc-nav', NtrlocNav);
