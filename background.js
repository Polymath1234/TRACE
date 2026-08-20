/**
 * FirstNode v2.0 - Background Service Worker
 * Autopilot tracking engine, state orchestration, journey graph construction,
 * session tracking, field classification, geocoding caching, and storage management.
 */

// Default configuration with Autopilot enabled
const DEFAULT_SETTINGS = {
  autopilot: true,
  autoDetect: true,
  showPrompts: false, // Autopilot logs data automatically in the background
  darkMode: true,
  trackAllFields: true,
  geocodingEnabled: true
};

const DEFAULT_METADATA = {
  version: '2.0.0',
  totalSites: 0,
  totalSubmissions: 0,
  globalVisitCounter: 0,
  lastBackup: new Date().toISOString()
};

// Geocoding cache duration: 24 hours in milliseconds
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory active session state
let currentSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
let sessionStartTime = Date.now();
let lastActivityTime = Date.now();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity creates new session

// Lifecycle: onInstalled and onStartup
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const data = await chrome.storage.local.get(['sites', 'settings', 'metadata', 'sessions']);
    const sites = Array.isArray(data.sites) ? data.sites : [];
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    const metadata = {
      ...DEFAULT_METADATA,
      ...(data.metadata || {}),
      totalSites: sites.length,
      lastBackup: new Date().toISOString()
    };
    const sessions = data.sessions || {};

    await chrome.storage.local.set({ sites, settings, metadata, sessions });
    await updateBadge(sites.length);

    // Setup periodic backup alarm (every 60 minutes)
    chrome.alarms.create('firstnode-periodic-backup', {
      periodInMinutes: 60
    });

    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/welcome.html') });
      console.log('FirstNode v2.0 Autopilot initialized successfully.');
    }
  } catch (error) {
    console.error('Error during FirstNode initialization:', error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  currentSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  sessionStartTime = Date.now();
  lastActivityTime = Date.now();

  const data = await chrome.storage.local.get('sites');
  await updateBadge((data.sites || []).length);
});

// Periodic backup & maintenance alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'firstnode-periodic-backup') {
    try {
      const data = await chrome.storage.local.get(['sites', 'metadata', 'settings']);
      const sites = data.sites || [];
      const backupMeta = {
        ...(data.metadata || DEFAULT_METADATA),
        totalSites: sites.length,
        lastBackup: new Date().toISOString()
      };
      await chrome.storage.local.set({ metadata: backupMeta });
      await updateBadge(sites.length);
    } catch (err) {
      console.error('FirstNode backup error:', err);
    }
  }
});

/**
 * Ensures active session ID is refreshed after inactivity
 */
function getActiveSessionId() {
  const now = Date.now();
  if (now - lastActivityTime > SESSION_TIMEOUT_MS) {
    currentSessionId = `sess_${now}_${Math.random().toString(36).substr(2, 6)}`;
    sessionStartTime = now;
  }
  lastActivityTime = now;
  return currentSessionId;
}

/**
 * Updates extension action badge count and styling
 * @param {number} count - Total number of tracked site nodes
 */
async function updateBadge(count) {
  try {
    const text = count > 0 ? (count > 999 ? '999+' : count.toString()) : '';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#00D4FF' }); // FirstNode Teal
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#0A1628' }); // Deep Navy
    }
  } catch (e) {
    // Ignore badge errors if action is not yet initialized
  }
}

/**
 * Normalizes domain by trimming, lowercasing, and stripping 'www.'
 * @param {string} rawDomain
 * @returns {string} Normalized domain
 */
function normalizeDomain(rawDomain) {
  if (!rawDomain) return '';
  let domain = rawDomain.trim().toLowerCase();
  try {
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      const url = new URL(domain);
      domain = url.hostname;
    }
  } catch (e) {
    // Fallback string manipulation
  }
  domain = domain.replace(/^www\./, '');
  return domain;
}

/**
 * Detects field category, label, and sensitivity based on attributes
 * Supports all 9 categories: Identity, Contact, Address, Government ID,
 * Financial, Professional, Education, Demographics, Social Media.
 *
 * @param {string} fieldName
 * @param {string} fieldId
 * @param {string} placeholder
 * @param {string} fieldType
 * @param {string} autocomplete
 * @returns {{category: string, label: string, sensitivity: string}}
 */
function detectFieldType(fieldName = '', fieldId = '', placeholder = '', fieldType = '', autocomplete = '') {
  const combined = `${fieldName} ${fieldId} ${placeholder} ${fieldType} ${autocomplete}`.toLowerCase();

  // 1. Financial (Highest sensitivity)
  if (/card|creditcard|debitcard|bank|account|routing|upi|cvv|cvc|expir|iban|swift|payment/.test(combined)) {
    return { category: 'financial', label: 'Financial', sensitivity: 'high' };
  }

  // 2. Government ID (Highest sensitivity)
  if (/ssn|socialsecurity|aadhaar|pan|passport|license|nationalid|taxid|citizen|voter/.test(combined)) {
    return { category: 'government_id', label: 'Government ID', sensitivity: 'high' };
  }

  // 3. Contact (Email, Phone, Messaging)
  if (fieldType === 'email' || autocomplete === 'email' || /email|e-mail/.test(combined)) {
    return { category: 'contact', label: 'Email', sensitivity: 'high' };
  }
  if (fieldType === 'tel' || autocomplete.includes('tel') || /phone|mobile|tel|telephone|whatsapp|telegram|contact/.test(combined)) {
    return { category: 'contact', label: 'Phone', sensitivity: 'high' };
  }

  // 4. Address
  if (autocomplete.includes('address') || /address|street|city|state|zip|postal|country|pincode|district|province/.test(combined)) {
    return { category: 'address', label: 'Address', sensitivity: 'medium' };
  }

  // 5. Identity (Name, Username)
  if (/name|fullname|username|nickname|firstname|lastname|fname|lname/.test(combined)) {
    return { category: 'identity', label: 'Identity', sensitivity: 'medium' };
  }

  // 6. Professional
  if (/job|title|company|department|employeeid|position|role|employer|work|organization/.test(combined)) {
    return { category: 'professional', label: 'Professional', sensitivity: 'low' };
  }

  // 7. Education
  if (/school|university|degree|education|college|graduate|major|alma/.test(combined)) {
    return { category: 'education', label: 'Education', sensitivity: 'low' };
  }

  // 8. Demographics
  if (/age|dob|birth|gender|nationality|birthday|sex|pronoun/.test(combined)) {
    return { category: 'demographics', label: 'Demographics', sensitivity: 'medium' };
  }

  // 9. Social Media
  if (/social|handle|bio|interests|about|profile|twitter|instagram|github|linkedin/.test(combined)) {
    return { category: 'social_media', label: 'Social Media', sensitivity: 'low' };
  }

  // Default fallback
  return { category: 'identity', label: 'Field Data', sensitivity: 'low' };
}

/**
 * Geocodes a domain using ipapi.co with 24-hour caching support
 * @param {string} domain
 * @returns {Promise<Object|null>} Geocoded location data
 */
async function geocodeDomain(domain) {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain || cleanDomain === 'localhost' || cleanDomain.startsWith('127.') || cleanDomain.startsWith('192.168.') || cleanDomain.endsWith('.local') || cleanDomain.endsWith('.test')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://ipapi.co/${cleanDomain}/json/`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.error || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null;
    }

    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city || 'Unknown City',
      region: data.region || '',
      country: data.country_name || 'Unknown Country',
      countryCode: data.country_code || '',
      org: data.org || '',
      cachedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn(`Geocoding failed for ${cleanDomain}:`, err.message);
    return null;
  }
}

/**
 * Saves a site submission into the Journey Graph.
 * Handles Autopilot background logging and merges field data.
 *
 * @param {Object} siteInput
 * @returns {Promise<{success: boolean, node: Object}>}
 */
async function saveSiteWithJourney(siteInput) {
  const data = await chrome.storage.local.get(['sites', 'settings', 'metadata', 'sessions']);
  const sites = Array.isArray(data.sites) ? [...data.sites] : [];
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const metadata = { ...DEFAULT_METADATA, ...(data.metadata || {}) };
  const sessions = data.sessions || {};

  const domain = normalizeDomain(siteInput.domain || siteInput.fullUrl);
  if (!domain) {
    return { success: false, error: 'Invalid domain' };
  }

  const now = new Date().toISOString();
  const sessionId = getActiveSessionId();
  const visitOrder = (metadata.globalVisitCounter || sites.length) + 1;
  const newNodeId = `fn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Find previous node in the journey flow
  const previousNode = sites.length > 0 ? sites[0].id : null;

  // Process data fields
  const rawFields = Array.isArray(siteInput.dataFields) ? siteInput.dataFields : [];
  const dataFields = rawFields.map(f => {
    const classification = detectFieldType(f.fieldName, f.fieldId, f.placeholder, f.type, f.autocomplete);
    return {
      type: f.type || classification.category,
      label: f.label || classification.label,
      fieldName: f.fieldName || 'field',
      value: f.value || '***', // Masked for privacy
      sensitivity: f.sensitivity || classification.sensitivity
    };
  });

  // Extract distinct data types
  const dataTypesSet = new Set(dataFields.map(f => f.type));
  if (siteInput.oauthProvider) {
    dataTypesSet.add('oauth');
  }
  if (Array.isArray(siteInput.dataTypes)) {
    siteInput.dataTypes.forEach(t => dataTypesSet.add(t));
  }
  if (dataTypesSet.size === 0) {
    dataTypesSet.add('identity');
  }

  // Geocoding with cache lookup from existing nodes of the same domain
  let geocoded = null;
  const existingGeoNode = sites.find(s => s.domain === domain && s.geocoded && s.geocoded.cachedAt);
  if (existingGeoNode && (Date.now() - new Date(existingGeoNode.geocoded.cachedAt).getTime() < GEOCODE_CACHE_TTL_MS)) {
    geocoded = existingGeoNode.geocoded;
  } else if (settings.geocodingEnabled) {
    geocoded = await geocodeDomain(domain);
  }

  // Construct complete Node object
  const newNode = {
    id: newNodeId,
    domain: domain,
    fullUrl: siteInput.fullUrl || `https://${domain}`,
    timestamp: now,
    sessionId: sessionId,
    dataFields: dataFields,
    dataTypes: Array.from(dataTypesSet),
    oauthProvider: siteInput.oauthProvider || null,
    previousNode: previousNode,
    nextNode: null,
    visitOrder: visitOrder,
    notes: siteInput.notes || '',
    geocoded: geocoded
  };

  // Link previous node's nextNode pointer to this new node
  if (sites.length > 0) {
    sites[0].nextNode = newNodeId;
  }

  // Add new node to top of list
  sites.unshift(newNode);

  // Update session tracking
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      startTime: now,
      lastActive: now,
      nodeCount: 0,
      domains: []
    };
  }
  sessions[sessionId].lastActive = now;
  sessions[sessionId].nodeCount += 1;
  if (!sessions[sessionId].domains.includes(domain)) {
    sessions[sessionId].domains.push(domain);
  }

  // Update metadata
  const updatedMetadata = {
    ...metadata,
    totalSites: sites.length,
    totalSubmissions: (metadata.totalSubmissions || 0) + 1,
    globalVisitCounter: visitOrder
  };

  await chrome.storage.local.set({
    sites: sites,
    metadata: updatedMetadata,
    sessions: sessions
  });

  await updateBadge(sites.length);

  return { success: true, node: newNode };
}

/**
 * Deletes a single site node and heals the previous/next journey links
 * @param {string} siteId
 */
async function deleteSite(siteId) {
  const data = await chrome.storage.local.get(['sites', 'metadata']);
  const sites = Array.isArray(data.sites) ? [...data.sites] : [];

  const targetIndex = sites.findIndex(s => s.id === siteId);
  if (targetIndex === -1) {
    return { success: false, error: 'Node not found' };
  }

  const targetNode = sites[targetIndex];
  const prevId = targetNode.previousNode;
  const nextId = targetNode.nextNode;

  // Heal pointers
  if (prevId) {
    const prevNode = sites.find(s => s.id === prevId);
    if (prevNode) prevNode.nextNode = nextId;
  }
  if (nextId) {
    const nextNode = sites.find(s => s.id === nextId);
    if (nextNode) nextNode.previousNode = prevId;
  }

  // Remove node
  sites.splice(targetIndex, 1);

  const metadata = {
    ...(data.metadata || DEFAULT_METADATA),
    totalSites: sites.length
  };

  await chrome.storage.local.set({ sites, metadata });
  await updateBadge(sites.length);

  return { success: true, remainingCount: sites.length };
}

/**
 * Builds the complete Journey Graph data structure for Cytoscape.js and timeline views
 * @returns {Promise<{nodes: Array, edges: Array, timeline: Array}>}
 */
async function getJourneyGraph() {
  const data = await chrome.storage.local.get('sites');
  const sites = Array.isArray(data.sites) ? data.sites : [];

  // Graph nodes
  const nodes = sites.map(s => ({
    id: s.id,
    domain: s.domain,
    timestamp: s.timestamp,
    dataTypes: s.dataTypes || [],
    visitOrder: s.visitOrder || 0,
    dataFields: s.dataFields || [],
    oauthProvider: s.oauthProvider || null,
    sessionId: s.sessionId || null,
    geocoded: s.geocoded || null
  }));

  // Build edges based on chronological previousNode links
  const edges = [];
  const chronological = [...sites].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (let i = 0; i < chronological.length - 1; i++) {
    const curr = chronological[i];
    const next = chronological[i + 1];
    const tCurr = new Date(curr.timestamp).getTime();
    const tNext = new Date(next.timestamp).getTime();
    const timeDiff = Math.max(0, tNext - tCurr);

    edges.push({
      id: `edge_${curr.id}_${next.id}`,
      source: curr.id,
      target: next.id,
      timestamp: next.timestamp,
      timeDiff: timeDiff
    });
  }

  // Timeline events
  const timeline = sites.map(s => ({
    siteId: s.id,
    domain: s.domain,
    fullUrl: s.fullUrl,
    timestamp: s.timestamp,
    action: 'data_submitted',
    fields: s.dataTypes || [],
    oauthProvider: s.oauthProvider || null,
    dataFields: s.dataFields || [],
    sessionId: s.sessionId || null,
    notes: s.notes || ''
  }));

  return { nodes, edges, timeline };
}

/**
 * Returns timeline submission list
 */
async function getTimeline() {
  const graph = await getJourneyGraph();
  return graph.timeline;
}

/**
 * Exports all FirstNode data as a structured JSON object
 */
async function exportData() {
  const data = await chrome.storage.local.get(['sites', 'settings', 'metadata', 'sessions']);
  return {
    app: 'FirstNode',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    metadata: data.metadata || DEFAULT_METADATA,
    settings: data.settings || DEFAULT_SETTINGS,
    sessions: data.sessions || {},
    sites: data.sites || []
  };
}

/**
 * Imports FirstNode data from a JSON object
 * @param {Object} payload
 * @param {boolean} merge
 */
async function importData(payload, merge = true) {
  if (!payload || !Array.isArray(payload.sites)) {
    throw new Error('Invalid format: missing sites array');
  }

  const current = await chrome.storage.local.get(['sites', 'settings', 'metadata', 'sessions']);
  let finalSites = [];

  if (merge) {
    const existing = current.sites || [];
    const idMap = new Map();
    existing.forEach(s => idMap.set(s.id, s));
    payload.sites.forEach(s => {
      if (s.id && !idMap.has(s.id)) {
        idMap.set(s.id, s);
      } else if (!s.id) {
        s.id = `fn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        idMap.set(s.id, s);
      }
    });
    finalSites = Array.from(idMap.values()).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } else {
    finalSites = payload.sites;
  }

  const updatedMetadata = {
    ...DEFAULT_METADATA,
    ...(payload.metadata || current.metadata || {}),
    totalSites: finalSites.length,
    lastBackup: new Date().toISOString()
  };

  const updatedSettings = {
    ...DEFAULT_SETTINGS,
    ...(payload.settings || current.settings || {})
  };

  await chrome.storage.local.set({
    sites: finalSites,
    settings: updatedSettings,
    metadata: updatedMetadata,
    sessions: payload.sessions || current.sessions || {}
  });

  await updateBadge(finalSites.length);
  return { success: true, count: finalSites.length };
}

/**
 * Clears all stored data
 */
async function clearAll() {
  await chrome.storage.local.set({
    sites: [],
    sessions: {},
    metadata: {
      ...DEFAULT_METADATA,
      totalSites: 0,
      totalSubmissions: 0,
      globalVisitCounter: 0,
      lastBackup: new Date().toISOString()
    }
  });
  await updateBadge(0);
  return { success: true };
}

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'DETECTED_DATA':
        case 'SAVE_SITE': {
          const result = await saveSiteWithJourney(message.data);
          sendResponse(result);
          break;
        }

        case 'GET_ALL_DATA': {
          const data = await chrome.storage.local.get(['sites', 'settings', 'metadata', 'sessions']);
          sendResponse({
            success: true,
            sites: data.sites || [],
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
            metadata: { ...DEFAULT_METADATA, ...(data.metadata || {}) },
            sessions: data.sessions || {},
            currentSessionId: getActiveSessionId()
          });
          break;
        }

        case 'GET_JOURNEY_GRAPH': {
          const graph = await getJourneyGraph();
          sendResponse({ success: true, ...graph });
          break;
        }

        case 'GET_TIMELINE': {
          const timeline = await getTimeline();
          sendResponse({ success: true, timeline });
          break;
        }

        case 'GET_SETTINGS': {
          const data = await chrome.storage.local.get('settings');
          sendResponse({
            success: true,
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
          });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const current = await chrome.storage.local.get('settings');
          const updated = {
            ...DEFAULT_SETTINGS,
            ...(current.settings || {}),
            ...(message.settings || {})
          };
          await chrome.storage.local.set({ settings: updated });
          sendResponse({ success: true, settings: updated });
          break;
        }

        case 'DELETE_SITE': {
          const result = await deleteSite(message.id);
          sendResponse(result);
          break;
        }

        case 'BATCH_DELETE_SITES': {
          const idsToDelete = new Set(message.ids || []);
          const data = await chrome.storage.local.get(['sites', 'metadata']);
          const sites = (data.sites || []).filter(s => !idsToDelete.has(s.id));
          const metadata = {
            ...(data.metadata || DEFAULT_METADATA),
            totalSites: sites.length
          };
          await chrome.storage.local.set({ sites, metadata });
          await updateBadge(sites.length);
          sendResponse({ success: true, remainingCount: sites.length });
          break;
        }

        case 'UPDATE_NOTE': {
          const data = await chrome.storage.local.get('sites');
          const sites = data.sites || [];
          const target = sites.find(s => s.id === message.id);
          if (target) {
            target.notes = message.notes || '';
            await chrome.storage.local.set({ sites });
            sendResponse({ success: true, site: target });
          } else {
            sendResponse({ success: false, error: 'Site node not found' });
          }
          break;
        }

        case 'EXPORT_DATA': {
          const exportObj = await exportData();
          sendResponse({ success: true, data: exportObj });
          break;
        }

        case 'IMPORT_DATA': {
          const result = await importData(message.data, message.merge !== false);
          sendResponse(result);
          break;
        }

        case 'CLEAR_ALL_DATA': {
          const result = await clearAll();
          sendResponse(result);
          break;
        }

        case 'GEOCODE_SITE': {
          const data = await chrome.storage.local.get('sites');
          const sites = data.sites || [];
          const site = sites.find(s => s.id === message.id);
          if (site) {
            const geo = await geocodeDomain(site.domain);
            if (geo) {
              site.geocoded = geo;
              await chrome.storage.local.set({ sites });
              sendResponse({ success: true, geocoded: geo });
            } else {
              sendResponse({ success: false, error: 'Could not resolve location' });
            }
          } else {
            sendResponse({ success: false, error: 'Site not found' });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
          break;
      }
    } catch (err) {
      console.error('Error handling message in FirstNode background worker:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
