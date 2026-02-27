// main.js - Globals, Init, and Helpers

// ===== GLOBAL DATA & STATE =====

window.DATA = {
  items: {},
  groups: [],
  shopGroups: [],
  itemIcons: [],
  newItemIds: new Set(),
  spriteMap: null
};

window.state = {
  currentTab: "quests",
  selectedQuest: null,
  selectedItem: null,
  selectedGroupForEdit: null,
  selectedGroup: null,
  selectedSubgroup: null,
  expandedGroups: new Set(),
  expandedSubgroups: new Set(),
  draggedQuest: null,
  draggedFrom: null,
  itemSearchFilter: "",
  questSearchFilter: "",
  editorMode: false,
  expandedTreeItems: new Set(),
  showFullTotals: false,
  autolootData: JSON.parse(localStorage.getItem("osro_autoloot_v1")) || {},
  autolootNames: JSON.parse(localStorage.getItem("osro_autoloot_names_v1")) || {},
  selectedAutolootSlot: 1,
  selectedItemId: null,
  showValuesOnly: false,
  searchDescriptions: false,
  showAllItems: false,
  showNewItemsOnly: false,
  selectedShop: null,
  selectedShopGroup: null,
  selectedShopSubgroup: null,
  selectedGroupForShopEdit: null,
  shopSearchFilter: "",
  expandedShopGroups: new Set(),
  expandedShopSubgroups: new Set()
};

// Ensure all 10 autoloot slots exist
for (let i = 1; i <= 10; i++) {
  if (!state.autolootData[i]) state.autolootData[i] = [];
}

document.body.classList.add("viewer-mode");

// ===== ICON CACHE =====

/**
 * Cache for rendered item icons
 * Key format: "{itemId}_{size}" (e.g., "12345_24" or "12345_48")
 */
window.iconCache = {
  cache: new Map(),
  
  get(id, size) {
    const key = `${id}_${size}`;
    return this.cache.get(key) || null;
  },
  
  set(id, size, html) {
    const key = `${id}_${size}`;
    this.cache.set(key, html);
    return html;
  },
  
  clear() {
    this.cache.clear();
    console.log('[IconCache] Cache cleared');
  },
  
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
};

// Secret editor mode activation
const SECRET_TOGGLE_CONFIG = {
  taps: 4,           // Number of taps required
  windowMs: 2000,    // Time window in milliseconds
};

let secretTapTimestamps = [];

function initSecretEditorToggle() {
  const versionTag = document.getElementById('header-version-tag');
  if (!versionTag) return;
  
  versionTag.style.cursor = 'default';
  versionTag.style.userSelect = 'none';
  
  versionTag.addEventListener('click', () => {
    const now = Date.now();
    secretTapTimestamps.push(now);
    
    // Remove taps outside the time window
    secretTapTimestamps = secretTapTimestamps.filter(
      time => now - time < SECRET_TOGGLE_CONFIG.windowMs
    );
    
    // Check if we have enough taps
    if (secretTapTimestamps.length >= SECRET_TOGGLE_CONFIG.taps) {
      toggleEditorMode(!state.editorMode);
      secretTapTimestamps = []; // Reset
      
      // Visual feedback (optional)
      versionTag.style.opacity = '0.5';
      setTimeout(() => versionTag.style.opacity = '1', 100);
    }
  });
}

// ===== THEME MANAGEMENT =====

function initTheme() {
  const savedTheme = localStorage.getItem('osro-theme') || 'dark';
  const isDark = savedTheme === 'dark';
  
  // Update the toggle checkbox
  const toggle = document.getElementById('themeModeToggle');
  if (toggle) {
    toggle.checked = !isDark; // Unchecked = dark, checked = light
  }
  
  applyTheme(savedTheme);
}

function toggleTheme(isLight) {
  const theme = isLight ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem('osro-theme', theme);
}

function applyTheme(theme) {
  const head = document.head;
  
  // Remove existing theme link
  const existingTheme = document.getElementById('theme-stylesheet');
  if (existingTheme) {
    existingTheme.remove();
  }
  
  // Add new theme link
  const link = document.createElement('link');
  link.id = 'theme-stylesheet';
  link.rel = 'stylesheet';
  link.href = `css/style_${theme}.css`;
  head.appendChild(link);
}

// ===== INITIALIZATION =====

// Track initialization state to prevent race conditions
window.initState = {
  complete: false,
  valuesLoaded: false,
  userHasEditedValues: false
};

function initializeData() {
  if (!AUTO_IMPORT_ON_FIRST_LOAD) {
    render();
    return;
  }

  Promise.all([
    fetchJSON(AUTO_IMPORT_URLS.items),
    fetchJSON(AUTO_IMPORT_URLS.quests),
    fetchJSON(AUTO_IMPORT_URLS.shops),
    fetchJSON(AUTO_IMPORT_URLS.icons),
    fetchJSON(AUTO_IMPORT_URLS.searchIndexName),
    fetchJSON(AUTO_IMPORT_URLS.searchIndexDesc),
    fetchJSON(AUTO_IMPORT_URLS.newItems),
    fetchJSON(AUTO_IMPORT_URLS.spriteMap)
  ])
    .then(([items, quests, shops, icons, searchName, searchDesc, newItems, spriteMap]) => {
      loadItems(items);
      loadQuests(quests);
      loadShops(shops);
      loadItemIcons(icons);
      loadSearchIndices(searchName, searchDesc);
      loadNewItems(newItems);
      loadSpriteMap(spriteMap);
      return loadItemValuesFromStorage();
    })
    .then(() => {
      initState.complete = true;
      
      // This ensures we never miss the window or check too early.
      handleURLNavigation();
      
      // Render the final state (handleURLNavigation might have set a specific tab)
      render();
      
      // Initialize history state if needed
      if (!window.history.state) {
        const urlParams = new URLSearchParams(window.location.search);
        const questId = urlParams.get('quest');
        window.history.replaceState(
          { questId: questId || null, tab: state.currentTab },
          '',
          window.location.href
        );
      }
    })
    .catch(handleInitError);
}

function fetchJSON(url) {
  return fetch(url).then(r => r.ok ? r.json() : null);
}

function loadItems(items) {
  if (!items) {
    console.warn("[Init] No items data received from remote");
    return;
  }

  DATA.items = items;
  console.log(`[Init] Loaded ${Object.keys(DATA.items).length} items from remote`);
}

function loadItemValuesFromStorage() {
  const stored = localStorage.getItem("osro_item_values_v1");
  
  if (stored) {
    // Load from localStorage
    try {
      const values = JSON.parse(stored);
      applyItemValues(values);
      initState.valuesLoaded = true;
      console.log(`[Init] Loaded ${Object.keys(values).length} item values from localStorage`);
      return Promise.resolve();
    } catch (err) {
      console.error("[Init] Failed to parse stored item values:", err);
      console.warn("[Init] Corrupt localStorage detected. Attempting to load from remote...");
      // Clear corrupt data
      localStorage.removeItem("osro_item_values_v1");
      // Load from remote and return the promise
      return loadItemValuesFromRemote();
    }
  } else {
    // No localStorage, load from remote
    console.log("[Init] No stored item values found. Loading from remote...");
    return loadItemValuesFromRemote();
  }
}

function loadItemValuesFromRemote() {
  return fetchJSON(AUTO_IMPORT_URLS.values)
    .then(values => {
      if (values) {
        // Check if user has already edited values during initialization
        if (initState.userHasEditedValues) {
          console.warn("[Init] User has already edited values. Skipping remote import to preserve user changes.");
          return;
        }
        
        applyItemValues(values);
        saveItemValuesToStorage();
        initState.valuesLoaded = true;
        console.log(`[Init] Loaded ${Object.keys(values).length} item values from remote and saved to localStorage`);
      } else {
        console.warn("[Init] No item values data received from remote");
      }
    })
    .catch(err => {
      console.error("[Init] Failed to load item values from remote:", err);
      // Don't throw - allow app to continue with no values
    });
}

function applyItemValues(values) {
  Object.entries(values).forEach(([id, value]) => {
    if (DATA.items[id]) {
      DATA.items[id].value = value;
    } else {
      DATA.items[id] = { name: "", value };
    }
  });
}

function saveItemValuesToStorage() {
  const values = {};
  Object.entries(DATA.items).forEach(([id, item]) => {
    if (item.value > 0) values[id] = item.value;
  });
  localStorage.setItem("osro_item_values_v1", JSON.stringify(values));
}

function saveAutolootData() {
  try {
    localStorage.setItem("osro_autoloot_v1", JSON.stringify(state.autolootData));
    localStorage.setItem("osro_autoloot_names_v1", JSON.stringify(state.autolootNames));
    console.log("[Autoloot] Saved autoloot data to localStorage");
  } catch (error) {
    console.error("[Autoloot] Failed to save autoloot data:", error);
    logError("saveAutolootData", error);
  }
}

function importItemValues() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const values = JSON.parse(text);
      
      applyItemValues(values);
      saveItemValuesToStorage();
      
      alert(`Successfully imported ${Object.keys(values).length} item values!`);
      
      if (state.currentTab === 'items') {
        renderItems();
        if (state.selectedItemId) renderItemContent();
      }
    } catch (err) {
      alert('Failed to import item values. Please check the file format.');
    }
  };
  
  input.click();
}

function toggleValuesFilter(checked) {
  state.showValuesOnly = checked;
  renderItems();
}

function loadQuests(quests) {
  if (quests?.groups) {
    DATA.groups = quests.groups;
    console.log(`[Init] Loaded ${quests.groups.length} quest groups`);
  } else {
    console.warn("[Init] No quest data received from remote");
  }
}

function loadShops(shops) {
  if (!shops) {
    console.warn("[Init] No shops data received from remote");
    DATA.shopGroups = [];
    return;
  }
  DATA.shopGroups = shops.groups || [];
  console.log(`[Init] Loaded ${DATA.shopGroups.length} shop groups from remote`);
}

function loadItemIcons(icons) {
  if (icons && Array.isArray(icons)) {
    DATA.itemIcons = icons;
    
    // Clear icon cache when new icons are loaded
    iconCache.clear();
    
    console.log(`[Init] Loaded ${icons.length} item icons`);
  } else {
    console.warn("[Init] No item icons data received from remote");
  }
}

function loadSearchIndices(nameIndex, descIndex) {
  if (nameIndex && typeof nameIndex === 'object') {
    if (typeof window.SEARCH_INDEX_NAME !== 'undefined') {
      SEARCH_INDEX_NAME = nameIndex;
    }
    console.log(`[Init] Loaded name search index (${Object.keys(nameIndex).length} terms)`);
  }
  
  if (descIndex && typeof descIndex === 'object') {
    if (typeof window.SEARCH_INDEX_DESC !== 'undefined') {
      SEARCH_INDEX_DESC = descIndex;
    }
    console.log(`[Init] Loaded description search index (${Object.keys(descIndex).length} terms)`);
  }
}

function loadNewItems(newItems) {
  if (newItems && Array.isArray(newItems)) {
    DATA.newItemIds = new Set(newItems);
    
    // Index new items so they work with text search
    newItems.forEach(id => {
      const item = DATA.items[id];
      if (item && item.name) {
        const terms = item.name.toLowerCase().split(/\s+/);
        terms.forEach(term => {
          if (term.length < 1) return;
          if (!SEARCH_INDEX_NAME[term]) SEARCH_INDEX_NAME[term] = [];
          if (!SEARCH_INDEX_NAME[term].includes(id)) {
            SEARCH_INDEX_NAME[term].push(id);
          }
        });
      }
    });
    
    console.log(`[Init] Loaded and indexed ${newItems.length} new item IDs`);
  }
}

function loadSpriteMap(spriteMap) {
  if (spriteMap && spriteMap.map) {
    DATA.spriteMap = spriteMap;
    console.log(`[Init] Loaded sprite map with ${spriteMap.totalIcons} icons`);
  } else {
    console.warn("[Init] No sprite map data received - falling back to individual icons");
  }
}

function handleInitError(err) {
  console.error("[Init] Auto-import failed:", err);
  logError("Initialization", err);
  
  const message = "Failed to auto-import data from remote URLs.\n\n" +
                  "Error: " + (err.message || String(err)) + "\n\n" +
                  "The application may not function correctly. Check console for details.";
  
  alert(message);
  
  // Still try to render with whatever data we have
  initState.complete = true;
  render();
}

// ===== ERROR HANDLING & BOUNDARIES =====

// Error logging and display
window.errorLog = [];

function logError(context, error, data = {}) {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message || String(error),
    stack: error.stack,
    data
  };
  
  errorLog.push(errorEntry);
  console.error(`[Error] ${context}:`, error, data);
  
  // Keep only last 50 errors
  if (errorLog.length > 50) {
    errorLog.shift();
  }
}

function showErrorMessage(container, context, error, canRetry = false) {
  const containerId = typeof container === 'string' ? container : container?.id || 'unknown';
  const errorMessage = error.message || String(error);
  
  const html = `
    <div class="error-state">
      <h2>⚠️ Something Went Wrong</h2>
      <p class="error-context">Error in: <strong>${context}</strong></p>
      <details class="error-details">
        <summary>Error Details</summary>
        <pre>${escapeHtml(errorMessage)}</pre>
        ${error.stack ? `<pre class="error-stack">${escapeHtml(error.stack)}</pre>` : ''}
      </details>
      ${canRetry ? `
        <button onclick="location.reload()" class="btn-retry">
          🔄 Reload Page
        </button>
      ` : ''}
      <p class="error-help">
        If this problem persists, try clearing your browser cache or 
        <a href="#" onclick="localStorage.clear(); location.reload();">resetting your data</a>.
      </p>
    </div>
  `;
  
  if (typeof container === 'string') {
    const el = document.getElementById(container);
    if (el) el.innerHTML = html;
  } else if (container instanceof HTMLElement) {
    container.innerHTML = html;
  }
}

// Error boundary wrapper for render functions
function withErrorBoundary(fn, context) {
  return function(...args) {
    try {
      const result = fn.apply(this, args);
      return result;
    } catch (error) {
      logError(context, error, { args });
      
      // Try to show error in appropriate container
      let containerId = null;
      if (context.includes('Items')) {
        containerId = context.includes('Content') ? 'mainContent' : 'itemsList';
      } else if (context.includes('Quest')) {
        containerId = context.includes('Content') ? 'mainContent' : 'treeContainer';
      } else if (context.includes('Group')) {
        containerId = context.includes('Content') ? 'mainContent' : 'groupsList';
      } else if (context.includes('Autoloot')) {
        containerId = context.includes('Main') ? 'mainContent' : 'autolootList';
      }
      
      if (containerId) {
        showErrorMessage(containerId, context, error, true);
      } else {
        // Fallback: show alert
        alert(`Error in ${context}: ${error.message}\n\nPlease refresh the page.`);
      }
      
      // Don't throw - allow app to continue
      return null;
    }
  };
}

// Wrap a function with validation for required data structures
function withDataValidation(fn, context, requiredData = []) {
  return function(...args) {
    // Check required data exists
    for (const dataPath of requiredData) {
      const parts = dataPath.split('.');
      let current = window;
      
      for (const part of parts) {
        if (current[part] === undefined || current[part] === null) {
          const error = new Error(`Required data missing: ${dataPath}`);
          logError(context, error, { requiredData });
          console.warn(`[${context}] Skipping render - required data not loaded yet`);
          return null;
        }
        current = current[part];
      }
    }
    
    return fn.apply(this, args);
  };
}

// ===== ITEM HELPERS =====

function getItem(id) {
  return (id != null && DATA.items[id]) || { name: "", value: 0 };
}

function getItemDisplayName(item) {
  if (!item) return "";
  const safeName = escapeHtml(item.name || "");
  const slot = Number(item.slot) || 0;
  return slot > 0 ? `${safeName} [${slot}]` : safeName;
}

function ensureItem(id, name) {
  const numId = parseInt(id);
  if (!id || isNaN(numId)) return null;

  if (!DATA.items[numId]) {
    DATA.items[numId] = { name: name || "", value: 0 };
  } else if (name && !DATA.items[numId].name) {
    DATA.items[numId].name = name;
  }
  return DATA.items[numId];
}

function getAllItems() {
  if (!DATA.items || typeof DATA.items !== 'object') {
    console.warn('[getAllItems] DATA.items is not a valid object');
    return [];
  }
  
  return Object.entries(DATA.items)
    .map(([id, item]) => ({ ...item, id: +id }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function getItemIconUrl(id) {
  const numId = Number(id); // Convert to number for comparison
  if (DATA.itemIcons && DATA.itemIcons.includes(numId)) {
    return `image/item/${numId}.png`;
  }
  return null;
}

function renderItemIcon(id, size = 24) {
  // Normalize/validate size: only allow 24 or 48
  const parsed = Number(size);
  const validSize = parsed === 24 || parsed === 48 ? parsed : 24;
  
  // Check cache first
  const cached = iconCache.get(id, validSize);
  if (cached) {
    return cached;
  }
  
  // Generate icon HTML
  const sizeClass = `icon${validSize}`;
  let html;

  // Special handling for Zeny (ID 1) and Points (ID 2)
  if (id === 1) {
    html = `<div class="item-icon-placeholder-zeny ${sizeClass}"></div>`;
  } else if (id === 2) {
    html = `<div class="item-icon-placeholder-points ${sizeClass}"></div>`;
  } else if (DATA.spriteMap && DATA.spriteMap.map[id]) {
    // Use sprite sheet if available
    const [col, row] = DATA.spriteMap.map[id];
    const iconSize = DATA.spriteMap.iconSize;
    const xPos = col * iconSize;
    const yPos = row * iconSize;
    
    // Calculate scaling for 48px icons (2x upscale)
    const scale = validSize / iconSize;
    const bgSize = `${DATA.spriteMap.spriteWidth * scale}px ${DATA.spriteMap.spriteHeight * scale}px`;
    const bgPos = `-${xPos * scale}px -${yPos * scale}px`;
    
    html = `<div class="item-icon sprite-icon ${sizeClass}" ` +
           `style="background-position: ${bgPos}; background-size: ${bgSize};" ` +
           `title="Item #${id}"></div>`;
  } else {
    // Fallback to individual icon file
    const iconUrl = getItemIconUrl(id);
    if (iconUrl) {
      html = `<img src="${iconUrl}" alt="Item #${id}" title="Item #${id}" ` +
             `class="item-icon pixelated ${sizeClass}" ` +
             `onerror="this.onerror=null; this.outerHTML='<div class=\\'item-icon-placeholder ${sizeClass}\\'></div>';">`;
    } else {
      html = `<div class="item-icon-placeholder ${sizeClass}"></div>`;
    }
  }
  
  // Store in cache and return
  return iconCache.set(id, validSize, html);
}

// ===== TEXT HELPERS =====

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== COLOR ADJUSTMENT FOR DARK THEME =====

/**
 * Adjusts hex colors for optimal contrast on dark backgrounds
 * Preserves hue while ensuring readability
 */
function adjustColorForDarkTheme(hexColor) {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  // Adjust lightness for dark theme
  // Dark colors (l < 0.4) → brighten significantly
  // Mid colors (0.4-0.6) → brighten moderately
  // Light colors (> 0.6) → keep bright but not pure white
  if (l < 0.4) {
    l = Math.min(0.75, l + 0.45); // Boost dark colors
  } else if (l < 0.6) {
    l = Math.min(0.8, l + 0.25); // Moderate boost for mid tones
  } else if (l > 0.95) {
    l = 0.9; // Slightly dim pure white for comfort
  }
  
  // Boost saturation slightly for very desaturated colors
  if (s < 0.3) {
    s = Math.min(0.5, s + 0.15);
  }
  
  // Convert HSL back to RGB
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }
  
  // Convert back to hex
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `${toHex(r2)}${toHex(g2)}${toHex(b2)}`.toUpperCase();
}

function parseDescription(desc) {
  if (!desc) return "";
  
  try {
    let text;
    if (typeof desc === "string") {
      text = desc.replace(/\n/g, "<br>");
    } else if (Array.isArray(desc)) {
      text = desc.join("<br>");
    } else {
      console.warn('[parseDescription] Unexpected description type:', typeof desc);
      return "";
    }
    
    // Check current theme
    const currentTheme = localStorage.getItem('osro-theme') || 'dark';
    const isDarkTheme = currentTheme === 'dark';
    
    // RO color handling - only adjust for dark theme
    return text
      .replace(/\^000000/g, "</span>")
      .replace(/\^([0-9A-Fa-f]{6})/g, (match, hexColor) => {
        // For light theme, use original colors
        const finalColor = isDarkTheme ? adjustColorForDarkTheme(hexColor) : hexColor;
        return `<span style="color: #${finalColor}">`;
      });
  } catch (error) {
    console.error('[parseDescription] Error parsing description:', error);
    return String(desc); // Fallback to string representation
  }
}

// ===== TAB NAVIGATION =====

const TAB_ELEMENTS = {
  quests: {
    sidebar: "treeContainer",
    search: "questsSearch",
    render: ["renderSidebar", "renderQuestContent"]
  },
  shops: {
    sidebar: "shopsTreeContainer",
    search: "shopsSearch",
    render: ["renderShopsSidebar", "renderShopContent"]
  },
  items: {
    sidebar: "itemsList",
    search: "itemsSearch",
    render: ["renderItems", "renderItemContent"]
  },
  groups: {
    sidebar: "groupsList",
    search: "groupsActions",
    render: ["renderGroupsList", "renderGroupContent"],
    editorOnly: true
  },
  autoloot: {
    sidebar: "autolootList",
    render: ["renderAutolootSidebar", "renderAutolootMain"]
  }
};

function switchTab(tabName, pushState = true) {
  const previousTab = state.currentTab;
  state.currentTab = tabName;
  updateTabButtons(tabName);
  hideAllElements();
  showTabElements(tabName);
  
  // Auto-select first item when switching to a tab with no selection
  // This ensures browser history works properly
  if (pushState) {
    setTimeout(() => {
      if (previousTab !== tabName) {
        // Tab switched but item already selected - still update URL
        updateURL(null, null, pushState);
      }
    }, 50);
  }
}

function updateTabButtons(tabName) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.textContent.toLowerCase().includes(tabName));
  });
}

function hideAllElements() {
  ["treeContainer", "shopsTreeContainer", "itemsList", "groupsList", "autolootList"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  ["questsSearch", "shopsSearch", "itemsSearch", "groupsActions"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
}

function showTabElements(tabName) {
  const config = TAB_ELEMENTS[tabName];
  if (!config) return;

  // Show sidebar
  const sidebar = document.getElementById(config.sidebar);
  if (sidebar) sidebar.classList.remove("hidden");

  // Show search/actions (if not editor-only or if in editor mode)
  if (config.search && (!config.editorOnly || state.editorMode)) {
    const searchEl = document.getElementById(config.search);
    if (searchEl) searchEl.classList.remove("hidden");
  }

  // Call render functions with error handling
  config.render?.forEach(fnName => {
    if (window[fnName]) {
      try {
        window[fnName]();
      } catch (error) {
        logError(`showTabElements -> ${fnName}`, error, { tabName });
        console.error(`[showTabElements] Failed to call ${fnName}:`, error);
      }
    } else {
      console.warn(`[showTabElements] Render function '${fnName}' not found`);
    }
  });
}

// Auto-select first item when switching to items tab with no selection
function selectFirstItem() {
  if (window.renderItems) {
    // Trigger render to populate the list
    window.renderItems();
  }
  
  // Wait for render, then select first
  setTimeout(() => {
    const firstItemRow = document.querySelector('.item-row');
    if (firstItemRow) {
      const itemId = firstItemRow.onclick?.toString().match(/selectItem\((\d+)/)?.[1];
      if (itemId && window.selectItem) {
        window.selectItem(parseInt(itemId), true);
      }
    }
  }, 100);
}

function render() {
  switchTab(state.currentTab);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ── Mobile FAB: hide on scroll-down, show on scroll-up ──────────────────────
(function () {
  const THRESHOLD = 8;
  let lastY = 0;
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        const btn = document.querySelector('.mobile-toggle');
        if (!btn) { ticking = false; return; }

        const scroller = document.querySelector('.main-content');
        if (!scroller) { ticking = false; return; }

        const currentY = scroller.scrollTop;
        const delta = currentY - lastY;

        if (Math.abs(delta) >= THRESHOLD) {
          const shouldHide = delta > 0 && currentY > 100;
          btn.classList.toggle('hidden', shouldHide);
          lastY = currentY;
        }

        ticking = false;
      });
      ticking = true;
    }
  }

  // .main-content exists immediately — attach directly, not to window
  document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.querySelector('.main-content');
    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });
  });
})();

function toggleEditorMode(enabled) {
  state.editorMode = enabled;
  document.body.classList.toggle("viewer-mode", !enabled);
  
  if (!enabled && state.currentTab === "groups") {
    switchTab("quests");
  }
  
  render();
}

function saveData() {
  console.log("[Save] No caching - data always fresh from remote");
}

// ===== EXPORT FUNCTIONS =====

function exportQuests() {
  const cleanedGroups = DATA.groups.map(group => ({
    ...group,
    subgroups: group.subgroups.map(subgroup => ({
      ...subgroup,
      quests: subgroup.quests.map(quest => ({
        ...quest,
        requirements: quest.requirements.map(req => {
          const cleaned = { ...req };
          if (!cleaned.immune) delete cleaned.immune;
          return cleaned;
        })
      }))
    }))
  }));

  downloadJSON({ groups: cleanedGroups }, "osromr_quests.json");
}

function exportShops() {
  const cleanedGroups = DATA.shopGroups.map(group => ({
    ...group,
    subgroups: group.subgroups.map(subgroup => ({
      ...subgroup,
      shops: subgroup.shops.map(shop => ({
        ...shop,
        requirements: shop.requirements.map(req => {
          const cleaned = { ...req };
          if (!cleaned.immune) delete cleaned.immune;
          return cleaned;
        })
      }))
    }))
  }));

  downloadJSON({ groups: cleanedGroups }, "osromr_shops.json");
}

function exportValues() {
  const values = {};
  Object.entries(DATA.items).forEach(([id, item]) => {
    if (item.value > 0) values[id] = item.value;
  });
  downloadJSON(values, "osromr_item_values.json");
}

function exportAll() {
  exportQuests();
  setTimeout(exportShops, 100);
}

function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== SEARCH FUNCTIONS =====

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), timeout);
  };
}

const debouncedQuestFilter = debounce(value => {
  state.questSearchFilter = value.toLowerCase();
  if (window.renderSidebar) renderSidebar();
}, 250);

const debouncedItemFilter = debounce(value => {
  state.itemSearchFilter = value.toLowerCase();
  if (typeof renderItems === 'function') renderItems();
  if (state.selectedItemId && typeof renderItemContent === 'function') {
    renderItemContent();
  }
}, 250);

const debouncedShopFilter = debounce(value => {
  state.shopSearchFilter = value.toLowerCase();
  if (window.renderShopsSidebar) renderShopsSidebar();
}, 250);

function clearItemSearch() {
  const input = document.getElementById("itemSearchInput");
  if (input) input.value = "";
  state.itemSearchFilter = "";
  if (typeof renderItems === 'function') renderItems();
  if (state.selectedItemId && typeof renderItemContent === 'function') {
    renderItemContent();
  }
}

function clearQuestSearch() {
  state.questSearchFilter = "";
  document.getElementById("questSearchInput").value = "";
  if (window.renderSidebar) renderSidebar();
}

function clearShopSearch() {
  state.shopSearchFilter = "";
  document.getElementById("shopSearchInput").value = "";
  if (window.renderShopsSidebar) renderShopsSidebar();
}

function toggleDescSearch(checked) {
  state.searchDescriptions = checked;
  renderItems();
}

function toggleShowAllItems(checked) {
  state.showAllItems = checked;
  renderItems();
}

window.toggleShowAllItems = toggleShowAllItems;

// ===== URL NAVIGATION FUNCTIONS =====

// Handle URL parameters on page load and navigation
function handleURLNavigation() {
  const urlParams = new URLSearchParams(window.location.search);
  const questId = urlParams.get('quest');
  const shopId = urlParams.get('shop');
  const itemId = urlParams.get('item');
  const autolootSlot = urlParams.get('autoloot');
  const tab = urlParams.get('tab');
  
  // Helper to ensure tab is active before selection
  const ensureTab = (tabName) => {
    if (state.currentTab !== tabName) {
      switchTab(tabName, false); // false = don't push to history during load
    }
  };

  // Priority 1: Entity Deep Links (Implicitly set the tab)
  if (questId) {
    ensureTab('quests');
    selectQuestById(questId, false);
  } 
  else if (shopId) {
    ensureTab('shops');
    if (window.selectShopById) {
      window.selectShopById(shopId, false);
    }
  }
  else if (itemId) {
    ensureTab('items');
    if (window.selectItemById) {
      // Clear any existing search filter so the deep-linked item is visible
      if (state.itemSearchFilter) {
        state.itemSearchFilter = "";
        document.getElementById("itemSearchInput").value = "";
      }
      window.selectItemById(itemId, false);
    }
  } 
  else if (autolootSlot) {
    ensureTab('autoloot');
    if (window.selectAutolootSlot) {
      window.selectAutolootSlot(parseInt(autolootSlot), false);
    }
  }
  // Priority 2: Pure Tab Navigation (Only if no entity is linked)
  else if (tab) {
    ensureTab(tab);
  }
}

// Update URL with current state without reloading page
function updateURL(entityId = null, entityType = null, pushState = true) {
  const url = new URL(window.location);
  
  // 1. Clear all tracking parameters first to ensure a clean state
  url.searchParams.delete('quest');
  url.searchParams.delete('shop');
  url.searchParams.delete('item');
  url.searchParams.delete('autoloot');
  url.searchParams.delete('tab'); // Always clear tab initially
  
  // 2. Set the specific entity parameter
  if (entityId && entityType) {
    url.searchParams.set(entityType, entityId);
    // Note: We intentionally DO NOT set 'tab' here. 
    // The entity presence implies the tab (quest->quests, item->items, etc.)
  } 
  // 3. If no entity is selected, we rely on the tab parameter
  else if (state.currentTab !== 'quests') {
    // Only set tab if it's not the default "quests" tab
    url.searchParams.set('tab', state.currentTab);
  }
  
  // 4. Create state object for history
  const historyState = {
    tab: state.currentTab,
    questId: entityType === 'quest' ? entityId : null,
    itemId: entityType === 'item' ? entityId : null,
    autolootSlot: entityType === 'autoloot' ? entityId : null
  };
  
  if (pushState) {
    window.history.pushState(historyState, '', url);
  } else {
    window.history.replaceState(historyState, '', url);
  }
}

// Find a quest by ID in the group/subgroup/quest structure
function findQuestById(questId) {
  if (!DATA.groups || !Array.isArray(DATA.groups)) return null;
  
  for (let groupIdx = 0; groupIdx < DATA.groups.length; groupIdx++) {
    const group = DATA.groups[groupIdx];
    if (!group || !Array.isArray(group.subgroups)) continue;
    
    for (let subIdx = 0; subIdx < group.subgroups.length; subIdx++) {
      const subgroup = group.subgroups[subIdx];
      if (!subgroup || !Array.isArray(subgroup.quests)) continue;
      
      for (let questIdx = 0; questIdx < subgroup.quests.length; questIdx++) {
        const quest = subgroup.quests[questIdx];
        if (quest && quest.producesId && quest.producesId.toString() === questId) {
          return { quest, group, subgroup, groupIdx, subIdx, questIdx };
        }
        // Also check by quest name as fallback
        if (quest && quest.name && quest.name.toLowerCase().replace(/\s+/g, '-') === questId) {
          return { quest, group, subgroup, groupIdx, subIdx, questIdx };
        }
      }
    }
  }
  return null;
}

// Select and display a quest by its ID
function selectQuestById(questId, pushToHistory = true) {
  const result = findQuestById(questId);
  if (result) {
    const { quest, group, subgroup, groupIdx, subIdx } = result;
    
    // Expand the group and subgroup
    state.expandedGroups.add(groupIdx);
    state.expandedSubgroups.add(`${groupIdx}-${subIdx}`);
    
    // Select the quest (this will trigger rendering)
    // Pass pushToHistory to control whether we add to browser history
    if (window.selectQuest) {
      window.selectQuest(group, subgroup, quest, pushToHistory);
    }
    
    // Scroll to the quest after a short delay to allow rendering
    setTimeout(() => {
      const questElement = document.querySelector('.quest-item.active');
      if (questElement) {
        questElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
}

// Expand tree nodes to reveal a specific quest
function expandTreeToQuest(questId) {
  const result = findQuestById(questId);
  if (result) {
    const { groupIdx, subIdx } = result;
    state.expandedGroups.add(groupIdx);
    state.expandedSubgroups.add(`${groupIdx}-${subIdx}`);
    render();
  }
}

// Highlight the active quest in the tree
function highlightActiveQuest(questId) {
  // The active class is already handled by quests.js
  // This is here for compatibility
  const result = findQuestById(questId);
  if (result) {
    const { quest } = result;
    state.selectedQuest = quest;
  }
}

// Copy the current quest URL to clipboard
function copyQuestLink() {
  if (!state.selectedQuest || !state.selectedQuest.producesId) {
    alert('No quest selected');
    return;
  }
  
  const url = new URL(window.location);
  url.searchParams.set('quest', state.selectedQuest.producesId.toString());
  
  navigator.clipboard.writeText(url.toString()).then(() => {
    showCopyFeedback('.copy-link-btn');
  }).catch(err => {
    console.error('Failed to copy link:', err);
    prompt('Copy this link:', url.toString());
  });
}

// Select a quest from browser history (back/forward navigation)
function selectQuestFromHistory(questId) {
  if (!questId) {
    state.selectedQuest = null;
    render();
    return;
  }
  
  // Don't push to history - we're already navigating through history
  selectQuestById(questId, false);
}
// Select an item from browser history (back/forward navigation)
function selectItemFromHistory(itemId) {
  if (!itemId) {
    state.selectedItemId = null;
    render();
    return;
  }
  
  if (window.selectItemById) {
    window.selectItemById(itemId, false);
  }
}

// Select an autoloot slot from browser history (back/forward navigation)
function selectAutolootSlotFromHistory(slotNum) {
  if (!slotNum) {
    render();
    return;
  }
  
  if (window.selectAutolootSlot) {
    window.selectAutolootSlot(parseInt(slotNum), false);
  }
}

// Copy the current item URL to clipboard
function copyItemLink() {
  if (!state.selectedItemId) {
    alert('No item selected');
    return;
  }
  
  const url = new URL(window.location);
  url.searchParams.set('item', state.selectedItemId.toString());
  
  navigator.clipboard.writeText(url.toString()).then(() => {
    showCopyFeedback('.copy-link-btn');
  }).catch(err => {
    console.error('Failed to copy link:', err);
    prompt('Copy this link:', url.toString());
  });
}

// Copy the current autoloot slot URL to clipboard
function copyAutolootLink() {
  if (!state.selectedAutolootSlot) {
    alert('No autoloot slot selected');
    return;
  }
  
  const url = new URL(window.location);
  url.searchParams.set('autoloot', state.selectedAutolootSlot.toString());
  
  navigator.clipboard.writeText(url.toString()).then(() => {
    showCopyFeedback('.copy-link-btn');
  }).catch(err => {
    console.error('Failed to copy link:', err);
    prompt('Copy this link:', url.toString());
  });
}

// Show copy feedback animation
function showCopyFeedback(selector) {
  const btn = document.querySelector(selector);
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('copied');
    }, 2000);
  }
}

// ===== EVENT LISTENERS =====

document.addEventListener("DOMContentLoaded", () => {

  const logo = document.getElementById("osro-quests-logo");
  if (logo) {
        logo.title = `OSRO Quests v${VERSION} (${FLAVOR})`;
  }

  const versionTag = document.getElementById("header-version-tag");
  if (versionTag) {
        versionTag.textContent = `${FLAVOR}`;
  }

  const iInput = document.getElementById("itemSearchInput");
  if (iInput) {
    iInput.addEventListener("input", e => debouncedItemFilter(e.target.value));
  }

  const qInput = document.getElementById("questSearchInput");
  if (qInput) {
    qInput.addEventListener("input", e => debouncedQuestFilter(e.target.value));
  }

  const sInput = document.getElementById("shopSearchInput");
  if (sInput) {
    sInput.addEventListener("input", e => debouncedShopFilter(e.target.value));
  }
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(event) {
    if (event.state) {
      const { tab, questId, itemId, autolootSlot } = event.state;
      
      if (tab && tab !== state.currentTab) {
        switchTab(tab, false);
      }
      
      if (questId) {
        selectQuestFromHistory(questId);
      } else if (itemId) {
        selectItemFromHistory(itemId);
      } else if (autolootSlot) {
        selectAutolootSlotFromHistory(autolootSlot);
      } else {
        state.selectedQuest = null;
        state.selectedItemId = null;
        render();
      }
    }
  });

  // START APPLICATION
  // Trigger initialization only after DOM is fully ready.
  initTheme();
  initializeData();
  initSecretEditorToggle();
});

// ===== SHARED USAGE LOOKUP & RENDERING =====
// findItemUsage — replaces items.js findQuestsByItemId, used by items/quests/shops
function findItemUsage(itemId) {
  const produces = [];
  const requires = [];

  if (Array.isArray(DATA.groups)) {
    DATA.groups.forEach((group, groupIdx) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      group.subgroups.forEach((subgroup, subIdx) => {
        if (!subgroup || !Array.isArray(subgroup.quests)) return;
        subgroup.quests.forEach((quest, questIdx) => {
          if (!quest) return;
          if (quest.producesId === itemId)
            produces.push({ type: 'quest', quest, group, subgroup, groupIdx, subIdx, questIdx });
          if (Array.isArray(quest.requirements)) {
            quest.requirements.forEach(req => {
              const rid = req.type === 'item' ? req.id
                        : req.type === 'gold'   ? SPECIAL_ITEMS?.GOLD
                        : req.type === 'credit' ? SPECIAL_ITEMS?.CREDIT : null;
              if (rid === itemId)
                requires.push({ type: 'quest', quest, group, subgroup, groupIdx, subIdx, questIdx, requirement: req });
            });
          }
        });
      });
    });
  }

  if (Array.isArray(DATA.shopGroups)) {
    DATA.shopGroups.forEach((group, groupIdx) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      group.subgroups.forEach((subgroup, subIdx) => {
        if (!subgroup || !Array.isArray(subgroup.shops)) return;
        subgroup.shops.forEach((shop, shopIdx) => {
          if (!shop) return;
          if (shop.producesId === itemId)
            produces.push({ type: 'shop', shop, group, subgroup, groupIdx, subIdx, shopIdx });
          if (Array.isArray(shop.requirements)) {
            shop.requirements.forEach(req => {
              const rid = req.type === 'item' ? req.id
                        : req.type === 'gold'   ? SPECIAL_ITEMS?.GOLD
                        : req.type === 'credit' ? SPECIAL_ITEMS?.CREDIT : null;
              if (rid === itemId)
                requires.push({ type: 'shop', shop, group, subgroup, groupIdx, subIdx, shopIdx, requirement: req });
            });
          }
        });
      });
    });
  }

  return { produces, requires };
}

// renderUsageSection — shared HTML renderer, mat-row style
// excludeQuest / excludeShop: the current quest or shop (omit self from "also produced by")
function renderUsageSection(itemId, { excludeQuest = null, excludeShop = null } = {}) {
  if (!itemId) return '';
  const { produces, requires } = findItemUsage(itemId);

  // For quests/shops: split "also produced by" (excluding self) from requires
  const isSelf = u =>
    (u.type === 'quest' && u.quest === excludeQuest) ||
    (u.type === 'shop'  && u.shop  === excludeShop);

  const alsoProduces = produces.filter(u => !isSelf(u));
  const showProduces = excludeQuest !== null || excludeShop !== null
    ? alsoProduces   // quest/shop view: only show "also" entries
    : produces;       // item view: show all

  if (showProduces.length === 0 && requires.length === 0) return '';

  function usageRow(u, amountStr = '') {
    if (u.type === 'quest') {
      return `
        <div class="mat-node">
          <div class="mat-row">
            <span class="mat-xbtn-ph"></span>
            <span class="quest-badge">Quest</span>
            <span class="mat-name">
              <a class="item-link tree-item-name" onclick="navigateToQuest(${u.groupIdx},${u.subIdx},${u.questIdx})">${u.quest.name}</a>
            </span>
            ${amountStr ? `<span class="mat-amt"><span class="mat-x">×</span>${amountStr}</span>` : ''}
          </div>
          <div class="mat-row-sub mat-row-sub--loc">${u.group.name} › ${u.subgroup.name}</div>
        </div>`;
    } else {
      return `
        <div class="mat-node">
          <div class="mat-row">
            <span class="mat-xbtn-ph"></span>
            <span class="shop-badge">Shop</span>
            <span class="mat-name">
              <a class="item-link tree-item-name" onclick="navigateToShop(${u.groupIdx},${u.subIdx},${u.shopIdx})">${u.shop.name}</a>
            </span>
            ${amountStr ? `<span class="mat-amt"><span class="mat-x">×</span>${amountStr}</span>` : ''}
          </div>
          <div class="mat-row-sub mat-row-sub--loc">${u.group.name} › ${u.subgroup.name}</div>
        </div>`;
    }
  }

  let html = '<div class="usage-section">';

  if (showProduces.length > 0) {
    const label = (excludeQuest || excludeShop) ? 'Also Produced By' : 'Produced By';
    html += `<span class="item-label">${label}:</span><div class="mat-tree">`;
    html += showProduces.map(u => usageRow(u)).join('');
    html += '</div>';
  }

  if (requires.length > 0) {
    html += `<span class="item-label">Required By:</span><div class="mat-tree">`;
    html += requires.map(u => {
      const amt = u.requirement?.amount
        ? (Number(u.requirement.amount) >= 1000
            ? Number(u.requirement.amount).toLocaleString()
            : u.requirement.amount)
        : '';
      return usageRow(u, amt);
    }).join('');
    html += '</div>';
  }

  html += '</div>';
  return html;
}

window.findItemUsage = findItemUsage;
window.renderUsageSection = renderUsageSection;

// ===== PUBLIC API EXPOSURE =====

// Explicitly expose functions that may be called from HTML or other scripts
// This ensures compatibility even if loaded as a module
window.toggleSidebar = toggleSidebar;
window.toggleEditorMode = toggleEditorMode;
window.switchTab = switchTab;
window.clearItemSearch = clearItemSearch;
window.clearQuestSearch = clearQuestSearch;
window.importItemValues = importItemValues;
window.toggleValuesFilter = toggleValuesFilter;
window.exportQuests = exportQuests;
window.exportShops = exportShops;
window.exportValues = exportValues;
window.exportAll = exportAll;
window.saveData = saveData;
window.render = render;
window.copyQuestLink = copyQuestLink;
window.copyItemLink = copyItemLink;
window.copyAutolootLink = copyAutolootLink;
window.toggleDescSearch = toggleDescSearch;
window.toggleTheme = toggleTheme;