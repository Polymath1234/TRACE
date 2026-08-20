/**
 * FirstNode v2.0 - Popup Dashboard Controller
 * Clean, professional, emoji-free interface.
 * Orchestrates Timeline (List), Journey Graph (Cytoscape.js),
 * Data Map (Leaflet.js), Analytics (Chart.js), and Autopilot Tracking.
 */

(function () {
  'use strict';

  // Global Application State
  const state = {
    sites: [],
    settings: {
      autopilot: true,
      autoDetect: true,
      showPrompts: false,
      darkMode: true,
      trackAllFields: true,
      geocodingEnabled: true
    },
    metadata: {
      version: '2.0.0',
      totalSites: 0,
      totalSubmissions: 0,
      globalVisitCounter: 0
    },
    sessions: {},
    activeTab: 'timeline',
    searchQuery: '',
    activeFilter: 'all',
    sortOrder: 'date-desc',
    
    // Map instance
    map: null,
    markersGroup: null,
    mapTimelinePercent: 100,

    // Cytoscape Graph instance
    cy: null,
    graphTimelinePercent: 100,
    selectedNodeId: null,
    activeInspectorCategory: 'all',

    // Chart.js instance
    growthChart: null,

    // Canvas fallback for graph
    canvasFallback: {
      canvas: null,
      ctx: null,
      animId: null
    }
  };

  // DOM Elements Reference
  const els = {
    // Header
    headerSiteCount: document.getElementById('header-site-count'),
    autopilotIndicator: document.getElementById('autopilot-indicator'),
    btnQuickAdd: document.getElementById('btn-quick-add'),
    btnHeaderWelcome: document.getElementById('btn-header-welcome'),
    btnHeaderSettings: document.getElementById('btn-header-settings'),

    // Navigation Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // 1. Timeline Panel
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    sortSelect: document.getElementById('sort-select'),
    filterChips: document.getElementById('filter-chips'),
    timelineListContainer: document.getElementById('timeline-list-container'),
    emptyState: document.getElementById('empty-state'),
    btnEmptyTrackTab: document.getElementById('btn-empty-track-tab'),
    listFooterStats: document.getElementById('list-footer-stats'),
    btnFooterExportJson: document.getElementById('btn-footer-export-json'),
    btnFooterExportCsv: document.getElementById('btn-footer-export-csv'),

    // 2. Journey Graph Panel
    cyContainer: document.getElementById('cy'),
    graphCanvasFallback: document.getElementById('graph-canvas-fallback'),
    graphMetaText: document.getElementById('graph-meta-text'),
    btnGraphFit: document.getElementById('btn-graph-fit'),
    btnGraphReset: document.getElementById('btn-graph-reset'),
    graphTimelineSlider: document.getElementById('graph-timeline-slider'),
    graphScrubberLabel: document.getElementById('graph-scrubber-label'),
    nodeInspector: document.getElementById('node-inspector'),
    inspectorDomain: document.getElementById('inspector-domain'),
    btnCloseInspector: document.getElementById('btn-close-inspector'),
    inspectorTime: document.getElementById('inspector-time'),
    inspectorTabs: document.getElementById('inspector-tabs'),
    inspectorFields: document.getElementById('inspector-fields'),
    btnInspectorVisit: document.getElementById('btn-inspector-visit'),
    btnInspectorDelete: document.getElementById('btn-inspector-delete'),

    // 3. Map Panel
    mapContainer: document.getElementById('map-container'),
    mapPinCount: document.getElementById('map-pin-count'),
    mapTimelineSlider: document.getElementById('map-timeline-slider'),
    mapTimelineLabel: document.getElementById('map-timeline-label'),
    btnMapFit: document.getElementById('btn-map-fit'),
    btnMapRefresh: document.getElementById('btn-map-refresh'),

    // 4. Settings & Analytics Panel
    statTotalSites: document.getElementById('stat-total-sites'),
    statTotalFields: document.getElementById('stat-total-fields'),
    statTopDatatype: document.getElementById('stat-top-datatype'),
    statTopProvider: document.getElementById('stat-top-provider'),
    growthChartCanvas: document.getElementById('growth-chart'),
    progressStackedBar: document.getElementById('progress-stacked-bar'),
    breakdownLegend: document.getElementById('breakdown-legend'),
    settingAutopilot: document.getElementById('setting-autopilot'),
    settingShowPrompts: document.getElementById('setting-show-prompts'),
    settingTrackAll: document.getElementById('setting-track-all'),
    settingDarkMode: document.getElementById('setting-dark-mode'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    fileImportJson: document.getElementById('file-import-json'),
    btnClearAll: document.getElementById('btn-clear-all'),
    linkOpenWelcome: document.getElementById('link-open-welcome'),

    // Modals & Toasts
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalConfirm: document.getElementById('btn-modal-confirm'),
    toast: document.getElementById('toast')
  };

  // Category Color Map (Clean Palette)
  const CATEGORY_COLORS = {
    identity: '#00D4FF',
    oauth: '#FFD700',
    contact: '#FF6B6B',
    address: '#00FFB3',
    government_id: '#F39C12',
    financial: '#9B59B6',
    professional: '#3498DB',
    education: '#1ABC9C',
    demographics: '#E67E22',
    social_media: '#E74C3C'
  };

  // Lifecycle Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupTimelineControls();
    setupGraphControls();
    setupMapControls();
    setupSettingsControls();
    await loadData();
  });

  /* ==========================================================================
     Data Loading & State Sync
     ========================================================================== */
  async function loadData() {
    try {
      const response = await sendMessagePromise({ type: 'GET_ALL_DATA' });
      if (response && response.success) {
        state.sites = Array.isArray(response.sites) ? response.sites : [];
        state.settings = response.settings || state.settings;
        state.metadata = response.metadata || state.metadata;
        state.sessions = response.sessions || {};

        applySettingsUI();
        renderHeader();
        renderTimeline();
        renderAnalytics();
      }
    } catch (err) {
      console.error('Error loading data in FirstNode popup:', err);
    }
  }

  function sendMessagePromise(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: true });
          }
        });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  function renderHeader() {
    const count = state.sites.length;
    els.headerSiteCount.textContent = `${count} site${count === 1 ? '' : 's'}`;

    if (els.autopilotIndicator) {
      const isAutopilot = state.settings.autopilot !== false;
      els.autopilotIndicator.style.display = isAutopilot ? 'flex' : 'none';
    }
  }

  /* ==========================================================================
     Navigation & Tab Switching
     ========================================================================== */
  function setupNavigation() {
    els.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    els.btnHeaderSettings.addEventListener('click', () => switchTab('settings'));
    els.btnHeaderWelcome.addEventListener('click', openWelcomePage);
    if (els.linkOpenWelcome) els.linkOpenWelcome.addEventListener('click', (e) => {
      e.preventDefault();
      openWelcomePage();
    });

    els.btnQuickAdd.addEventListener('click', trackActiveTab);
    els.btnEmptyTrackTab.addEventListener('click', trackActiveTab);
  }

  function openWelcomePage() {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/welcome.html') });
  }

  function switchTab(tab) {
    state.activeTab = tab;
    els.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    els.tabPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));

    if (tab === 'graph') {
      setTimeout(initOrRefreshGraph, 60);
    } else if (tab === 'map') {
      setTimeout(initOrRefreshMap, 60);
    } else if (tab === 'settings') {
      setTimeout(renderAnalytics, 60);
    }
  }

  /* ==========================================================================
     1. Timeline View Logic
     ========================================================================== */
  function setupTimelineControls() {
    // Search
    els.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      els.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
      renderTimeline();
    });

    els.btnClearSearch.addEventListener('click', () => {
      els.searchInput.value = '';
      state.searchQuery = '';
      els.btnClearSearch.style.display = 'none';
      renderTimeline();
    });

    // Sort
    els.sortSelect.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      renderTimeline();
    });

    // Filter Chips
    els.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      els.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.dataset.filter;
      renderTimeline();
    });

    // Footer export shortcuts
    els.btnFooterExportJson.addEventListener('click', exportJSON);
    els.btnFooterExportCsv.addEventListener('click', exportCSV);
  }

  function getFilteredAndSortedSites() {
    let filtered = [...state.sites];

    // Filter by data category
    if (state.activeFilter !== 'all') {
      if (state.activeFilter === 'oauth') {
        filtered = filtered.filter(s => s.oauthProvider || (s.dataTypes && s.dataTypes.includes('oauth')));
      } else {
        filtered = filtered.filter(s => {
          const types = s.dataTypes || [];
          const fieldTypes = (s.dataFields || []).map(f => f.type);
          return types.includes(state.activeFilter) || fieldTypes.includes(state.activeFilter);
        });
      }
    }

    // Filter by search query
    if (state.searchQuery) {
      const q = state.searchQuery;
      filtered = filtered.filter(s => {
        const domainMatch = (s.domain || '').toLowerCase().includes(q);
        const urlMatch = (s.fullUrl || '').toLowerCase().includes(q);
        const notesMatch = (s.notes || '').toLowerCase().includes(q);
        const oauthMatch = (s.oauthProvider || '').toLowerCase().includes(q);
        const fieldMatch = (s.dataFields || []).some(f => 
          (f.fieldName || '').toLowerCase().includes(q) || 
          (f.label || '').toLowerCase().includes(q) || 
          (f.value || '').toLowerCase().includes(q)
        );
        return domainMatch || urlMatch || notesMatch || oauthMatch || fieldMatch;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();

      switch (state.sortOrder) {
        case 'date-asc':
          return dateA - dateB;
        case 'domain-asc':
          return (a.domain || '').localeCompare(b.domain || '');
        case 'domain-desc':
          return (b.domain || '').localeCompare(a.domain || '');
        case 'fields-desc':
          return (b.dataFields || []).length - (a.dataFields || []).length;
        case 'date-desc':
        default:
          return dateB - dateA;
      }
    });

    return filtered;
  }

  function renderTimeline() {
    const list = getFilteredAndSortedSites();
    els.timelineListContainer.innerHTML = '';

    if (state.sites.length === 0) {
      els.emptyState.style.display = 'flex';
      els.emptyState.querySelector('.empty-title').textContent = 'Digital Trail is Empty';
      els.emptyState.querySelector('.empty-desc').textContent = 'Autopilot is active. As you browse, fill forms, or sign in with Google/GitHub, FirstNode will capture your privacy trail.';
      els.timelineListContainer.style.display = 'none';
      els.listFooterStats.textContent = 'Showing 0 submissions';
      return;
    }

    if (list.length === 0) {
      els.emptyState.style.display = 'flex';
      els.emptyState.querySelector('.empty-title').textContent = 'No matching submissions';
      els.emptyState.querySelector('.empty-desc').textContent = 'No entries match your search query and active filter chips.';
      els.timelineListContainer.style.display = 'none';
      els.listFooterStats.textContent = 'Showing 0 submissions';
      return;
    }

    els.emptyState.style.display = 'none';
    els.timelineListContainer.style.display = 'flex';
    els.listFooterStats.textContent = `Showing ${list.length} of ${state.sites.length} submission${state.sites.length === 1 ? '' : 's'}`;

    let lastSessionId = null;

    list.forEach(site => {
      // Session boundary indicator
      if (site.sessionId && site.sessionId !== lastSessionId && state.sortOrder.startsWith('date')) {
        const divider = document.createElement('div');
        divider.className = 'session-divider';
        divider.textContent = `Session • ${formatDate(site.timestamp)}`;
        els.timelineListContainer.appendChild(divider);
        lastSessionId = site.sessionId;
      }

      const card = createSiteCard(site);
      els.timelineListContainer.appendChild(card);
    });
  }

  function createSiteCard(site) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.id = site.id;

    const formattedDate = formatDateTime(site.timestamp);
    const domain = site.domain || 'unknown-domain.com';
    const dataFields = Array.isArray(site.dataFields) ? site.dataFields : [];

    // Distinct badges
    const badgesSet = new Set(dataFields.map(f => f.type));
    if (site.oauthProvider) badgesSet.add('oauth');

    let badgesHtml = '';
    badgesSet.forEach(type => {
      const cls = `badge-${type}`;
      let label = type.replace('_', ' ').toUpperCase();
      if (type === 'oauth') label = `OAUTH: ${(site.oauthProvider || 'AUTH').toUpperCase()}`;
      badgesHtml += `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
    });

    if (!badgesHtml) {
      badgesHtml = `<span class="badge badge-identity">INTERACTION</span>`;
    }

    // Build category tabs for the expandable drawer
    const categoriesPresent = Array.from(new Set(dataFields.map(f => f.type)));
    if (site.oauthProvider && !categoriesPresent.includes('oauth')) {
      categoriesPresent.unshift('oauth');
    }

    let drawerTabsHtml = '<button class="drawer-cat-tab active" data-cat="all">All</button>';
    categoriesPresent.forEach(cat => {
      const catLabel = cat === 'oauth' ? `OAuth (${site.oauthProvider || 'Auth'})` : cat.replace('_', ' ');
      drawerTabsHtml += `<button class="drawer-cat-tab" data-cat="${cat}">${escapeHtml(catLabel)}</button>`;
    });

    // Location text
    let locText = '';
    if (site.geocoded && site.geocoded.city) {
      locText = `Location: ${site.geocoded.city}, ${site.geocoded.country || ''}`;
    }

    card.innerHTML = `
      <div class="site-header">
        <div class="site-domain-row">
          <img class="favicon-icon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="" onerror="this.src='../icons/icon16.png'">
          <a href="${escapeHtml(site.fullUrl || `https://${domain}`)}" target="_blank" class="domain-name" title="Visit ${escapeHtml(domain)}">
            ${escapeHtml(domain)}
          </a>
        </div>
        <span class="site-date">${formattedDate}</span>
      </div>

      <div class="site-details">
        <div class="data-types-list">
          ${badgesHtml}
        </div>
        <div class="site-actions">
          <button class="action-btn visit-btn" title="Open Site" data-action="visit">↗</button>
          <button class="action-btn delete-btn" title="Remove Entry" data-action="delete">✕</button>
          <button class="action-btn expand-btn" title="View Shared Information" data-action="expand">▼</button>
        </div>
      </div>

      <div class="site-drawer" id="drawer-${site.id}">
        <div class="drawer-cat-tabs" id="drawer-tabs-${site.id}">
          ${drawerTabsHtml}
        </div>
        <div class="drawer-fields-grid" id="drawer-fields-${site.id}">
          <!-- Populated by renderDrawerFields -->
        </div>
        <div class="drawer-meta-row">
          <div><strong>URL:</strong> <a href="${escapeHtml(site.fullUrl || '')}" target="_blank" class="drawer-url">${escapeHtml(site.fullUrl || domain)}</a></div>
          ${locText ? `<div class="drawer-geo">${escapeHtml(locText)}</div>` : ''}
          ${site.visitOrder ? `<div><strong>Journey Hop:</strong> #${site.visitOrder}</div>` : ''}
        </div>
        <div class="drawer-notes-wrap">
          <textarea class="drawer-notes" placeholder="Add personal note for this site...">${escapeHtml(site.notes || '')}</textarea>
          <span class="notes-save-status">Saved</span>
        </div>
      </div>
    `;

    // Action listeners
    const expandBtn = card.querySelector('.expand-btn');
    const drawer = card.querySelector('.site-drawer');
    const visitBtn = card.querySelector('.visit-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const notesTextarea = card.querySelector('.drawer-notes');
    const notesStatus = card.querySelector('.notes-save-status');
    const drawerTabs = card.querySelector(`#drawer-tabs-${site.id}`);
    const drawerFields = card.querySelector(`#drawer-fields-${site.id}`);

    // Initial render of drawer fields
    renderDrawerFields(site, 'all', drawerFields);

    // Category sub-tabs click listener
    drawerTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.drawer-cat-tab');
      if (!tabBtn) return;
      drawerTabs.querySelectorAll('.drawer-cat-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      const cat = tabBtn.dataset.cat;
      renderDrawerFields(site, cat, drawerFields);
    });

    expandBtn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      expandBtn.classList.toggle('expanded', isOpen);
    });

    visitBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: site.fullUrl || `https://${site.domain}` });
    });

    deleteBtn.addEventListener('click', () => {
      showConfirm(
        'Delete Submission',
        `Are you sure you want to remove this submission to ${site.domain} from your digital journey?`,
        async () => {
          await deleteNodeById(site.id);
        }
      );
    });

    // Notes auto-save debounce
    let saveTimer = null;
    notesTextarea.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const notes = notesTextarea.value;
        await sendMessagePromise({ type: 'UPDATE_NOTE', id: site.id, notes });
        notesStatus.style.display = 'block';
        setTimeout(() => { notesStatus.style.display = 'none'; }, 1500);
      }, 400);
    });

    return card;
  }

  function renderDrawerFields(site, category, container) {
    let fields = site.dataFields || [];

    if (category === 'oauth') {
      if (site.oauthProvider) {
        container.innerHTML = `
          <div class="drawer-field-row">
            <span class="drawer-field-key">OAuth Authentication:</span>
            <span class="drawer-field-val">${escapeHtml(site.oauthProvider)}</span>
          </div>
        `;
        return;
      }
    }

    if (category !== 'all') {
      fields = fields.filter(f => f.type === category);
    }

    if (fields.length === 0) {
      if (category === 'all' && site.oauthProvider) {
        container.innerHTML = `
          <div class="drawer-field-row">
            <span class="drawer-field-key">OAuth Provider:</span>
            <span class="drawer-field-val">${escapeHtml(site.oauthProvider)}</span>
          </div>
        `;
        return;
      }
      container.innerHTML = '<div style="color:#8899AA; font-size:11px;">No fields captured for this category</div>';
      return;
    }

    let html = '';
    if (category === 'all' && site.oauthProvider) {
      html += `
        <div class="drawer-field-row">
          <span class="drawer-field-key">OAuth Provider:</span>
          <span class="drawer-field-val">${escapeHtml(site.oauthProvider)}</span>
        </div>
      `;
    }

    fields.forEach(f => {
      html += `
        <div class="drawer-field-row">
          <span class="drawer-field-key">${escapeHtml(f.label || f.fieldName)}:</span>
          <span class="drawer-field-val">${escapeHtml(f.value || '***')}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async function deleteNodeById(id) {
    state.sites = state.sites.filter(s => s.id !== id);
    renderHeader();
    renderTimeline();
    renderAnalytics();
    if (state.activeTab === 'graph') initOrRefreshGraph();
    if (state.activeTab === 'map') initOrRefreshMap();

    await sendMessagePromise({ type: 'DELETE_SITE', id });
    showToast('Submission removed from digital trail');
  }

  async function trackActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        showToast('Cannot track browser internal pages');
        return;
      }

      const urlObj = new URL(tab.url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      const payload = {
        domain: domain,
        fullUrl: tab.url,
        dataFields: [
          {
            type: 'identity',
            label: 'Web Visit',
            fieldName: 'active_tab',
            value: 'Tab Tracked',
            sensitivity: 'low'
          }
        ],
        notes: `Manually tracked from tab: ${tab.title || ''}`
      };

      const res = await sendMessagePromise({ type: 'SAVE_SITE', data: payload });
      if (res && res.success) {
        await loadData();
        showToast(`Tracked ${domain} successfully`);
      }
    } catch (e) {
      showToast('Could not track active tab');
    }
  }

  /* ==========================================================================
     2. Journey Graph (Cytoscape.js Integration)
     ========================================================================== */
  function setupGraphControls() {
    els.btnGraphFit.addEventListener('click', () => {
      if (state.cy) state.cy.fit(undefined, 30);
    });

    els.btnGraphReset.addEventListener('click', () => {
      initOrRefreshGraph();
    });

    els.graphTimelineSlider.addEventListener('input', (e) => {
      state.graphTimelinePercent = parseInt(e.target.value, 10);
      updateGraphTimelinePlayback();
    });

    els.btnCloseInspector.addEventListener('click', () => {
      els.nodeInspector.style.display = 'none';
      state.selectedNodeId = null;
    });

    els.inspectorTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.insp-tab');
      if (!tabBtn) return;
      els.inspectorTabs.querySelectorAll('.insp-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      state.activeInspectorCategory = tabBtn.dataset.inspCat;

      const site = state.sites.find(s => s.id === state.selectedNodeId);
      if (site) renderInspectorFields(site, state.activeInspectorCategory);
    });

    els.btnInspectorVisit.addEventListener('click', () => {
      if (state.selectedNodeId) {
        const site = state.sites.find(s => s.id === state.selectedNodeId);
        if (site) chrome.tabs.create({ url: site.fullUrl || `https://${site.domain}` });
      }
    });

    els.btnInspectorDelete.addEventListener('click', () => {
      if (state.selectedNodeId) {
        const site = state.sites.find(s => s.id === state.selectedNodeId);
        if (site) {
          showConfirm('Delete Journey Node', `Remove ${site.domain} from your journey graph?`, async () => {
            els.nodeInspector.style.display = 'none';
            await deleteNodeById(site.id);
          });
        }
      }
    });
  }

  async function initOrRefreshGraph() {
    if (state.sites.length === 0) {
      els.graphMetaText.textContent = '0 nodes • 0 hops';
      if (state.cy) state.cy.elements().remove();
      return;
    }

    const response = await sendMessagePromise({ type: 'GET_JOURNEY_GRAPH' });
    if (!response || !response.success) return;

    const rawNodes = response.nodes || [];
    const rawEdges = response.edges || [];

    els.graphMetaText.textContent = `${rawNodes.length} nodes • ${rawEdges.length} hops`;

    if (window.cytoscape) {
      els.graphCanvasFallback.style.display = 'none';
      els.cyContainer.style.display = 'block';

      const elements = [];
      const sortedNodes = [...rawNodes].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      sortedNodes.forEach((n, idx) => {
        const dominantType = (n.dataTypes && n.dataTypes[0]) || 'identity';
        const nodeColor = CATEGORY_COLORS[dominantType] || '#00D4FF';
        const fieldCount = (n.dataFields || []).length;
        const nodeSize = Math.min(46, Math.max(22, 20 + fieldCount * 4));

        elements.push({
          data: {
            id: n.id,
            label: n.domain,
            color: nodeColor,
            size: nodeSize,
            order: idx + 1,
            site: n
          }
        });
      });

      rawEdges.forEach((e) => {
        const diffText = formatTimeDiff(e.timeDiff);
        elements.push({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: diffText,
            timeDiff: e.timeDiff
          }
        });
      });

      if (!state.cy) {
        state.cy = cytoscape({
          container: els.cyContainer,
          elements: elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': '#0A1628',
                'border-width': 2.5,
                'border-color': 'data(color)',
                'width': 'data(size)',
                'height': 'data(size)',
                'label': 'data(label)',
                'color': '#FFFFFF',
                'font-size': '11px',
                'font-family': 'Inter, sans-serif',
                'font-weight': 600,
                'text-valign': 'bottom',
                'text-margin-y': 5,
                'text-background-opacity': 0.7,
                'text-background-color': '#070F1C',
                'text-background-padding': '2px',
                'text-background-shape': 'roundrectangle'
              }
            },
            {
              selector: 'node:selected',
              style: {
                'border-color': '#00D4FF',
                'border-width': 4,
                'shadow-blur': 14,
                'shadow-color': '#00D4FF',
                'shadow-opacity': 0.8
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 2,
                'line-color': '#2A3A4E',
                'target-arrow-color': '#00D4FF',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.1,
                'opacity': 0.8,
                'label': 'data(label)',
                'font-size': '9px',
                'color': '#8899AA',
                'text-rotation': 'autorotate',
                'text-background-opacity': 0.6,
                'text-background-color': '#0A1628'
              }
            }
          ],
          layout: {
            name: 'cose',
            animate: true,
            randomize: false,
            nodeRepulsion: 450000,
            idealEdgeLength: 80,
            padding: 30
          }
        });

        // Click / Tap Event
        state.cy.on('tap', 'node', (evt) => {
          const nodeData = evt.target.data();
          showNodeInspector(nodeData.site);
        });

        state.cy.on('tap', (evt) => {
          if (evt.target === state.cy) {
            els.nodeInspector.style.display = 'none';
            state.selectedNodeId = null;
          }
        });
      } else {
        state.cy.elements().remove();
        state.cy.add(elements);
        state.cy.layout({
          name: 'cose',
          animate: true,
          nodeRepulsion: 450000,
          idealEdgeLength: 80,
          padding: 30
        }).run();
      }

      state.cy.fit(undefined, 30);
    } else {
      runCanvasFallback(rawNodes, rawEdges);
    }
  }

  function updateGraphTimelinePlayback() {
    if (!state.cy) return;
    const sorted = [...state.sites].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (sorted.length === 0) return;

    const cut = Math.max(1, Math.ceil((sorted.length * state.graphTimelinePercent) / 100));
    const visibleIds = new Set(sorted.slice(0, cut).map(s => s.id));

    state.cy.nodes().forEach(node => {
      const isVis = visibleIds.has(node.id());
      node.style('display', isVis ? 'element' : 'none');
    });

    state.cy.edges().forEach(edge => {
      const srcVis = visibleIds.has(edge.source().id());
      const tgtVis = visibleIds.has(edge.target().id());
      edge.style('display', (srcVis && tgtVis) ? 'element' : 'none');
    });

    const latest = sorted[cut - 1];
    els.graphScrubberLabel.textContent = `Step ${cut} of ${sorted.length} (${formatDate(latest.timestamp)})`;
  }

  function showNodeInspector(site) {
    if (!site) return;
    state.selectedNodeId = site.id;
    state.activeInspectorCategory = 'all';

    els.inspectorDomain.textContent = site.domain || 'Domain';
    els.inspectorTime.textContent = formatDateTime(site.timestamp);

    // Reset tabs
    els.inspectorTabs.querySelectorAll('.insp-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.inspCat === 'all');
    });

    renderInspectorFields(site, 'all');
    els.nodeInspector.style.display = 'block';
  }

  function renderInspectorFields(site, category) {
    let fields = site.dataFields || [];

    if (category === 'oauth') {
      if (site.oauthProvider) {
        els.inspectorFields.innerHTML = `
          <div><strong>OAuth:</strong> ${escapeHtml(site.oauthProvider)} Authentication</div>
        `;
        return;
      }
    }

    if (category === 'other') {
      fields = fields.filter(f => ['government_id', 'professional', 'education', 'demographics', 'social_media'].includes(f.type));
    } else if (category !== 'all') {
      fields = fields.filter(f => f.type === category);
    }

    if (fields.length === 0) {
      if (category === 'all' && site.oauthProvider) {
        els.inspectorFields.innerHTML = `
          <div><strong>OAuth:</strong> ${escapeHtml(site.oauthProvider)}</div>
        `;
        return;
      }
      els.inspectorFields.innerHTML = '<div style="color:#8899AA">No data for this category</div>';
      return;
    }

    let html = '';
    if (category === 'all' && site.oauthProvider) {
      html += `<div><strong>OAuth:</strong> ${escapeHtml(site.oauthProvider)}</div>`;
    }

    fields.forEach(f => {
      html += `<div><strong>${escapeHtml(f.label || f.fieldName)}:</strong> ${escapeHtml(f.value || '***')}</div>`;
    });

    els.inspectorFields.innerHTML = html;
  }

  /* ==========================================================================
     3. Data Map View (Leaflet.js)
     ========================================================================== */
  function setupMapControls() {
    els.btnMapFit.addEventListener('click', () => {
      if (state.map && state.markersGroup) {
        const layers = state.markersGroup.getLayers();
        if (layers.length > 0) {
          const group = new L.featureGroup(layers);
          state.map.fitBounds(group.getBounds().pad(0.2));
        }
      }
    });

    els.btnMapRefresh.addEventListener('click', async () => {
      showToast('Refreshing server locations...');
      for (const site of state.sites) {
        if (!site.geocoded) {
          await sendMessagePromise({ type: 'GEOCODE_SITE', id: site.id });
        }
      }
      await loadData();
      initOrRefreshMap();
    });

    els.mapTimelineSlider.addEventListener('input', (e) => {
      state.mapTimelinePercent = parseInt(e.target.value, 10);
      updateMapMarkers();
    });
  }

  function initOrRefreshMap() {
    if (!window.L) {
      console.warn('Leaflet library not available');
      return;
    }

    if (!state.map) {
      state.map = L.map('map-container', {
        zoomControl: true,
        attributionControl: false
      }).setView([20, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
      }).addTo(state.map);

      state.markersGroup = L.layerGroup().addTo(state.map);
    }

    state.map.invalidateSize();
    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!state.map || !state.markersGroup) return;
    state.markersGroup.clearLayers();

    const geoSites = state.sites.filter(s => s.geocoded && typeof s.geocoded.lat === 'number');
    const sorted = [...geoSites].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let visible = sorted;
    if (sorted.length > 0 && state.mapTimelinePercent < 100) {
      const cut = Math.max(1, Math.ceil((sorted.length * state.mapTimelinePercent) / 100));
      visible = sorted.slice(0, cut);
      const latest = visible[visible.length - 1];
      els.mapTimelineLabel.textContent = formatDate(latest.timestamp);
    } else {
      els.mapTimelineLabel.textContent = 'All Time';
    }

    els.mapPinCount.textContent = `${visible.length} locations`;

    const latLngs = [];

    visible.forEach(site => {
      const lat = site.geocoded.lat;
      const lng = site.geocoded.lng;
      const domain = site.domain;
      const city = site.geocoded.city || 'Server Hub';
      const country = site.geocoded.country || '';

      const dominant = (site.dataTypes && site.dataTypes[0]) || 'identity';
      const markerColor = CATEGORY_COLORS[dominant] || '#00D4FF';

      const customIcon = L.divIcon({
        className: 'firstnode-marker',
        html: `
          <div class="marker-dot" style="background: ${markerColor}; box-shadow: 0 0 10px ${markerColor}">
            <div class="marker-pulse" style="border-color: ${markerColor}"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const badgesHtml = (site.dataTypes || []).map(t => `<span class="badge">${t.toUpperCase()}</span>`).join(' ');

      const popupContent = `
        <div class="marker-popup">
          <h4>${escapeHtml(domain)}</h4>
          <p>${escapeHtml(city)}, ${escapeHtml(country)}</p>
          <div class="marker-badges">${badgesHtml}</div>
          <a href="${escapeHtml(site.fullUrl || `https://${domain}`)}" target="_blank">Visit Site →</a>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupContent);
      state.markersGroup.addLayer(marker);
      latLngs.push([lat, lng]);
    });

    if (latLngs.length > 0) {
      state.map.fitBounds(latLngs, { padding: [30, 30], maxZoom: 5 });
    }
  }

  /* ==========================================================================
     4. Settings, Analytics & Growth Chart (Chart.js)
     ========================================================================== */
  function setupSettingsControls() {
    if (els.settingAutopilot) {
      els.settingAutopilot.addEventListener('change', (e) => {
        updateSetting('autopilot', e.target.checked);
        if (els.autopilotIndicator) {
          els.autopilotIndicator.style.display = e.target.checked ? 'flex' : 'none';
        }
      });
    }

    if (els.settingShowPrompts) {
      els.settingShowPrompts.addEventListener('change', (e) => {
        updateSetting('showPrompts', e.target.checked);
      });
    }

    if (els.settingTrackAll) {
      els.settingTrackAll.addEventListener('change', (e) => {
        updateSetting('trackAllFields', e.target.checked);
      });
    }

    if (els.settingDarkMode) {
      els.settingDarkMode.addEventListener('change', (e) => {
        updateSetting('darkMode', e.target.checked);
        document.body.classList.toggle('light-theme', !e.target.checked);
      });
    }

    els.btnExportJson.addEventListener('click', exportJSON);
    els.btnExportCsv.addEventListener('click', exportCSV);
    els.fileImportJson.addEventListener('change', handleImport);

    els.btnClearAll.addEventListener('click', () => {
      showConfirm(
        'Clear Digital Trail',
        'This will permanently erase all tracked sites, journey nodes, and notes from your local storage. This action cannot be undone.',
        async () => {
          await sendMessagePromise({ type: 'CLEAR_ALL_DATA' });
          state.sites = [];
          renderHeader();
          renderTimeline();
          renderAnalytics();
          if (state.cy) state.cy.elements().remove();
          if (state.markersGroup) state.markersGroup.clearLayers();
          showToast('Digital trail has been cleared');
        }
      );
    });
  }

  function applySettingsUI() {
    if (els.settingAutopilot) els.settingAutopilot.checked = state.settings.autopilot !== false;
    if (els.settingShowPrompts) els.settingShowPrompts.checked = !!state.settings.showPrompts;
    if (els.settingTrackAll) els.settingTrackAll.checked = state.settings.trackAllFields !== false;
    if (els.settingDarkMode) els.settingDarkMode.checked = state.settings.darkMode !== false;

    document.body.classList.toggle('light-theme', state.settings.darkMode === false);
  }

  async function updateSetting(key, val) {
    state.settings[key] = val;
    await sendMessagePromise({
      type: 'UPDATE_SETTINGS',
      settings: { [key]: val }
    });
    showToast('Preferences updated');
  }

  function renderAnalytics() {
    const totalSites = state.sites.length;
    els.statTotalSites.textContent = totalSites.toString();

    let totalFields = 0;
    const typeCounts = {
      identity: 0,
      oauth: 0,
      contact: 0,
      address: 0,
      government_id: 0,
      financial: 0,
      professional: 0,
      education: 0,
      demographics: 0,
      social_media: 0
    };
    const oauthProviders = {};

    state.sites.forEach(s => {
      const fields = s.dataFields || [];
      totalFields += fields.length;

      (s.dataTypes || []).forEach(t => {
        if (typeCounts[t] !== undefined) typeCounts[t]++;
      });

      if (s.oauthProvider) {
        typeCounts.oauth++;
        oauthProviders[s.oauthProvider] = (oauthProviders[s.oauthProvider] || 0) + 1;
      }
    });

    els.statTotalFields.textContent = totalFields.toString();

    // Top data type
    let topType = '-';
    let maxTypeCount = 0;
    for (const [t, c] of Object.entries(typeCounts)) {
      if (c > maxTypeCount) {
        maxTypeCount = c;
        topType = t.replace('_', ' ');
      }
    }
    els.statTopDatatype.textContent = topType;

    // Top OAuth provider
    let topProvider = '-';
    let maxProv = 0;
    for (const [p, c] of Object.entries(oauthProviders)) {
      if (c > maxProv) {
        maxProv = c;
        topProvider = p;
      }
    }
    els.statTopProvider.textContent = topProvider;

    // Stacked Distribution Bar
    const totalPoints = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    if (totalPoints > 0) {
      els.progressStackedBar.querySelector('.prog-identity').style.width = `${((typeCounts.identity / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-oauth').style.width = `${((typeCounts.oauth / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-contact').style.width = `${((typeCounts.contact / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-address').style.width = `${((typeCounts.address / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-gov').style.width = `${((typeCounts.government_id / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-financial').style.width = `${((typeCounts.financial / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-prof').style.width = `${((typeCounts.professional / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-edu').style.width = `${((typeCounts.education / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-demo').style.width = `${((typeCounts.demographics / totalPoints) * 100).toFixed(1)}%`;
      els.progressStackedBar.querySelector('.prog-social').style.width = `${((typeCounts.social_media / totalPoints) * 100).toFixed(1)}%`;

      els.breakdownLegend.innerHTML = Object.entries(typeCounts)
        .filter(([_, c]) => c > 0)
        .map(([t, c]) => `<span class="legend-item"><span class="dot" style="background:${CATEGORY_COLORS[t] || '#00D4FF'}"></span> ${escapeHtml(t.replace('_', ' '))}: ${c}</span>`)
        .join('');
    } else {
      els.progressStackedBar.querySelectorAll('.prog-bar').forEach(b => b.style.width = '0%');
      els.breakdownLegend.innerHTML = '<span style="color:#8899AA">No data points captured yet</span>';
    }

    renderGrowthChart();
  }

  function renderGrowthChart() {
    if (!window.Chart || !els.growthChartCanvas) return;

    const days = 30;
    const labels = [];
    const counts = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

      const count = state.sites.filter(s => {
        const sDate = (s.timestamp || '').split('T')[0];
        return sDate && sDate <= dateStr;
      }).length;
      counts.push(count);
    }

    if (state.growthChart) {
      state.growthChart.data.labels = labels;
      state.growthChart.data.datasets[0].data = counts;
      state.growthChart.update();
    } else {
      const ctx = els.growthChartCanvas.getContext('2d');
      state.growthChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Tracked Sites',
            data: counts,
            borderColor: '#00D4FF',
            backgroundColor: 'rgba(0, 212, 255, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0A1628',
              titleColor: '#00D4FF',
              bodyColor: '#FFFFFF',
              borderColor: '#2A3A4E',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#8899AA', font: { size: 9 }, maxTicksLimit: 6 }
            },
            y: {
              grid: { color: 'rgba(42, 58, 78, 0.3)' },
              ticks: { color: '#8899AA', font: { size: 9 }, precision: 0 }
            }
          }
        }
      });
    }
  }

  /* ==========================================================================
     Import / Export Helpers
     ========================================================================== */
  async function exportJSON() {
    if (state.sites.length === 0) {
      showToast('No data to export');
      return;
    }

    const res = await sendMessagePromise({ type: 'EXPORT_DATA' });
    const payload = res && res.data ? res.data : {
      app: 'FirstNode',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      sites: state.sites,
      settings: state.settings
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const filename = `firstnode_trail_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(dataStr, filename);
    showToast('JSON export downloaded');
  }

  function exportCSV() {
    if (state.sites.length === 0) {
      showToast('No data to export');
      return;
    }

    const headers = ['ID', 'Domain', 'Full URL', 'Timestamp', 'Data Types', 'OAuth Provider', 'Fields Count', 'City', 'Country', 'Notes'];
    const rows = state.sites.map(s => [
      s.id || '',
      s.domain || '',
      s.fullUrl || '',
      s.timestamp || '',
      (s.dataTypes || []).join(';'),
      s.oauthProvider || '',
      (s.dataFields || []).length,
      s.geocoded ? s.geocoded.city || '' : '',
      s.geocoded ? s.geocoded.country || '' : '',
      (s.notes || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\r\n');

    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const filename = `firstnode_trail_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(dataStr, filename);
    showToast('CSV export downloaded');
  }

  function downloadFile(dataUri, filename) {
    const a = document.createElement('a');
    a.setAttribute('href', dataUri);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json || !Array.isArray(json.sites)) {
        showToast('Invalid format: missing sites array');
        return;
      }

      showConfirm(
        'Import Data Trail',
        `Found ${json.sites.length} sites in file. Merge with existing trail data?`,
        async () => {
          const res = await sendMessagePromise({
            type: 'IMPORT_DATA',
            data: json,
            merge: true
          });
          if (res && res.success) {
            await loadData();
            showToast(`Imported ${res.count} sites successfully`);
          } else {
            showToast(`Import error: ${res.error || 'Unknown'}`);
          }
        }
      );
    } catch (err) {
      showToast('Could not parse JSON file');
    }

    e.target.value = '';
  }

  /* ==========================================================================
     Fallback 2D Canvas Graph
     ========================================================================== */
  function runCanvasFallback(nodes, edges) {
    els.cyContainer.style.display = 'none';
    els.graphCanvasFallback.style.display = 'block';

    const canvas = els.graphCanvasFallback;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    const count = nodes.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy) * 0.7;

    nodes.forEach((n, i) => {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#00D4FF';
      ctx.fill();
      ctx.fillText(n.domain, x, y + 16);
    });
  }

  /* ==========================================================================
     UI Modals & Toasts
     ========================================================================== */
  function showConfirm(title, message, onConfirm) {
    els.modalTitle.textContent = title;
    els.modalBody.textContent = message;
    els.modalBackdrop.style.display = 'flex';

    const handleConfirm = async () => {
      cleanup();
      if (onConfirm) await onConfirm();
    };

    const handleCancel = () => cleanup();

    function cleanup() {
      els.modalBackdrop.style.display = 'none';
      els.btnModalConfirm.removeEventListener('click', handleConfirm);
      els.btnModalCancel.removeEventListener('click', handleCancel);
    }

    els.btnModalConfirm.addEventListener('click', handleConfirm);
    els.btnModalCancel.addEventListener('click', handleCancel);
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.style.display = 'block';
    setTimeout(() => {
      els.toast.style.display = 'none';
    }, 2500);
  }

  /* ==========================================================================
     Utility Helpers
     ========================================================================== */
  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return isoStr;
    }
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  function formatTimeDiff(ms) {
    if (!ms || ms <= 0) return '';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s later`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m later`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h later`;
    const days = Math.floor(hrs / 24);
    return `${days}d later`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
