// main.js - Globals, Init, and Helpers

// ===== GLOBAL DATA & STATE =====

window.DATA = {
  items: {},
  groups: [],
  itemIcons: []
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
};

// Ensure all 10 autoloot slots exist
for (let i = 1; i <= 10; i++) {
  if (!state.autolootData[i]) state.autolootData[i] = [];
}

document.body.classList.add("viewer-mode");

// ===== INITIALIZATION =====

// Track initialization state to prevent race conditions
window.initState = {
  complete: false,
  valuesLoaded: false,
  userHasEditedValues: false
};

(function initializeData() {
  if (!AUTO_IMPORT_ON_FIRST_LOAD) {
    render();
    return;
  }

  Promise.all([
    fetchJSON(AUTO_IMPORT_URLS.items),
    fetchJSON(AUTO_IMPORT_URLS.quests),
    fetchJSON(AUTO_IMPORT_URLS.icons)
  ])
    .then(([items, quests, icons]) => {
      loadItems(items);
      loadQuests(quests);
      loadItemIcons(icons);
      return loadItemValuesFromStorage();
    })
    .then(() => {
      initState.complete = true;
      render();
    })
    .catch(handleInitError);
})();

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

function loadItemIcons(icons) {
  if (icons && Array.isArray(icons)) {
    DATA.itemIcons = icons;
    console.log(`[Init] Loaded ${icons.length} item icons`);
  } else {
    console.warn("[Init] No item icons data received from remote");
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
  // Normalize/validate size: only allow 24 or 48 for now
  const parsed = Number(size);
  const validSize = parsed === 24 || parsed === 48 ? parsed : 24;
  const sizeClass = `icon${validSize}`;

  if (id === 1) {
    return `<div class="item-icon-placeholder-zeny ${sizeClass}"></div>`;
  } else if (id === 2) {
    return `<div class="item-icon-placeholder-points ${sizeClass}"></div>`;
  } else {
    const iconUrl = getItemIconUrl(id);
    if (iconUrl) {
      return `<img src="${iconUrl}" alt="Item #${id}" title="Item #${id}" class="item-icon pixelated ${sizeClass}" onerror="this.onerror=null; this.outerHTML='<div class=\\'item-icon-placeholder ${sizeClass}\\'></div>';">`;
    }
    return `<div class="item-icon-placeholder ${sizeClass}"></div>`;
  }
}

// ===== TEXT HELPERS =====

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
    
    // RO color handling
    return text
      .replace(/\^000000/g, "</span>")
      .replace(/\^([0-9A-Fa-f]{6})/g, '<span style="color: #$1">');
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

function switchTab(tabName) {
  state.currentTab = tabName;
  updateTabButtons(tabName);
  hideAllElements();
  showTabElements(tabName);
}

function updateTabButtons(tabName) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.textContent.toLowerCase().includes(tabName));
  });
}

function hideAllElements() {
  ["treeContainer", "itemsList", "groupsList", "autolootList"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  ["questsSearch", "itemsSearch", "groupsActions"].forEach(id => {
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

function render() {
  switchTab(state.currentTab);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

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

function exportValues() {
  const values = {};
  Object.entries(DATA.items).forEach(([id, item]) => {
    if (item.value > 0) values[id] = item.value;
  });
  downloadJSON(values, "osromr_item_values.json");
}

function exportAll() {
  exportQuests();
  setTimeout(exportValues, 100);
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
  if (window.renderItems) renderItems();
}, 250);

function clearItemSearch() {
  state.itemSearchFilter = "";
  document.getElementById("itemSearchInput").value = "";
  if (window.renderItems) renderItems();
}

function clearQuestSearch() {
  state.questSearchFilter = "";
  document.getElementById("questSearchInput").value = "";
  if (window.renderSidebar) renderSidebar();
}

// ===== EVENT LISTENERS =====

document.addEventListener("DOMContentLoaded", () => {
  const qInput = document.getElementById("questSearchInput");
  const iInput = document.getElementById("itemSearchInput");

  if (qInput) {
    qInput.addEventListener("input", e => debouncedQuestFilter(e.target.value));
  }
  if (iInput) {
    iInput.addEventListener("input", e => debouncedItemFilter(e.target.value));
  }
});

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
window.exportValues = exportValues;
window.exportAll = exportAll;
window.saveData = saveData;
window.render = render;