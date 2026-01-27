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
      loadItemValuesFromStorage();
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
      console.log(`[Init] Loaded ${Object.keys(values).length} item values from localStorage`);
    } catch (err) {
      console.error("[Init] Failed to parse stored item values:", err);
      loadItemValuesFromRemote();
    }
  } else {
    // No localStorage, load from remote
    loadItemValuesFromRemote();
  }
}

function loadItemValuesFromRemote() {
  fetchJSON(AUTO_IMPORT_URLS.values)
    .then(values => {
      if (values) {
        applyItemValues(values);
        saveItemValuesToStorage();
        console.log(`[Init] Loaded ${Object.keys(values).length} item values from remote and saved to localStorage`);
      }
    })
    .catch(err => {
      console.error("[Init] Failed to load item values from remote:", err);
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
  alert("Failed to auto-import data from remote URLs.\n\nCheck console for details.");
  render();
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

function renderItemIcon(id, sizeClass = "icon24") {
  if(id === 1) {
    return `<div class="item-icon-placeholder-zeny ${sizeClass}"></div>`;
  } else if (id === 2) {
    return `<div class="item-icon-placeholder-points ${sizeClass}"></div>`;
  } else {
    const iconUrl = getItemIconUrl(id);
    if (iconUrl) {
      return `<img src="${iconUrl}" alt="Item ${id}" class="item-icon pixelated ${sizeClass}" onerror="this.onerror=null; this.outerHTML='<div class=\\'item-icon-placeholder ${sizeClass}\\'></div>';">`;
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
  
  let text;
  if (typeof desc === "string") {
    text = desc.replace(/\n/g, "<br>");
  } else if (Array.isArray(desc)) {
    text = desc.join("<br>");
  } else {
    return "";
  }
  
  // RO color handling
  return text
    .replace(/\^000000/g, "</span>")
    .replace(/\^([0-9A-Fa-f]{6})/g, '<span style="color: #$1">');
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
    document.getElementById(config.search).classList.remove("hidden");
  }

  // Call render functions
  config.render?.forEach(fnName => {
    if (window[fnName]) window[fnName]();
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