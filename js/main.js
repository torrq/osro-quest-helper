// main.js - Globals, Init, and Helpers

// === GLOBAL DATA & STATE ===
window.DATA = {
  items: {},
  groups: [],
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
  selectedAutolootSlot: 1,
  selectedItemId: null,
};

// Ensure all 10 slots exist
for (let i = 1; i <= 10; i++) {
  if (!state.autolootData[i]) state.autolootData[i] = [];
}

// Apply initial viewer mode class
document.body.classList.add("viewer-mode");

// === INITIALIZATION ===
(function initializeData() {
  // Always fetch quests, values, and items from remote
  if (
    typeof AUTO_IMPORT_ON_FIRST_LOAD !== "undefined" &&
    AUTO_IMPORT_ON_FIRST_LOAD
  ) {
    Promise.all([
      fetch(AUTO_IMPORT_URLS.items).then((r) => (r.ok ? r.json() : null)),
      fetch(AUTO_IMPORT_URLS.values).then((r) => (r.ok ? r.json() : null)),
      fetch(AUTO_IMPORT_URLS.quests).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([items, values, quests]) => {
        // Merge items with values
        if (items) {
          DATA.items = items;
          console.log(
            `[Init] Loaded ${Object.keys(DATA.items).length} items from remote`,
          );

          // Apply values to items
          if (values) {
            Object.keys(values).forEach((id) => {
              if (DATA.items[id]) {
                DATA.items[id].value = values[id];
              } else {
                DATA.items[id] = {
                  name: "",
                  value: values[id],
                };
              }
            });
            console.log(
              `[Init] Applied ${Object.keys(values).length} item values`,
            );
          }
        } else {
          console.warn("[Init] No items data received from remote");
        }

        // Load quests
        if (quests && quests.groups) {
          DATA.groups = quests.groups;
          console.log(`[Init] Loaded ${quests.groups.length} quest groups`);
        } else {
          console.warn("[Init] No quest data received from remote");
        }

        render();
      })
      .catch((err) => {
        console.error("[Init] Auto-import failed:", err);
        alert(
          "Failed to auto-import data from remote URLs.\n\nCheck console for details.",
        );
        render();
      });
  } else {
    render();
  }
})();

// === SHARED HELPERS ===
function getItem(id) {
  if (id === null || id === undefined) {
    return { name: "", value: 0 };
  }
  return DATA.items[id] || { name: "", value: 0 };
}

function getItemDisplayName(item) {
  if (!item) return "";
  const safeName = escapeHtml(item.name || "");
  const slot = Number(item.slot) || 0;
  return slot > 0 ? `${safeName} [${slot}]` : safeName;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function ensureItem(id, name) {
  if (id === null || id === undefined || id === "") return null;
  const numId = parseInt(id);
  if (isNaN(numId)) return null;

  if (!DATA.items[numId]) {
    DATA.items[numId] = { name: name || "", value: 0 };
  } else if (name && !DATA.items[numId].name) {
    DATA.items[numId].name = name;
  }
  return DATA.items[numId];
}

function getAllItems() {
  return Object.entries(DATA.items)
    .map(([id, item]) => ({
      ...item,
      id: +id, // derive numeric ID from key
    }))
    .sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
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
  text = text.replace(/\^000000/g, "</span>");
  text = text.replace(/\^([0-9A-Fa-f]{6})/g, '<span style="color: #$1">');
  return text;
}

// === TAB NAVIGATION ===
function switchTab(tabName) {
  state.currentTab = tabName;

  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.textContent.toLowerCase().includes(tabName));
  });

  document.getElementById("treeContainer").classList.add("hidden");
  document.getElementById("itemsList").classList.add("hidden");
  document.getElementById("groupsList").classList.add("hidden");
  const alList = document.getElementById("autolootList");
  if (alList) alList.classList.add("hidden");

  document.getElementById("questsSearch").classList.add("hidden");
  document.getElementById("itemsSearch").classList.add("hidden");
  document.getElementById("groupsActions").classList.add("hidden");

  if (tabName === "quests") {
    document.getElementById("treeContainer").classList.remove("hidden");
    document.getElementById("questsSearch").classList.remove("hidden");
    if (window.renderSidebar) renderSidebar();
    if (window.renderQuestContent) renderQuestContent();
  } else if (tabName === "items") {
    document.getElementById("itemsList").classList.remove("hidden");
    document.getElementById("itemsSearch").classList.remove("hidden");
    if (window.renderItems) renderItems();
    if (window.renderItemContent) renderItemContent();
  } else if (tabName === "groups") {
    document.getElementById("groupsList").classList.remove("hidden");
    if (state.editorMode) {
      document.getElementById("groupsActions").classList.remove("hidden");
    }
    if (window.renderGroupsList) renderGroupsList();
    if (window.renderGroupContent) renderGroupContent();
  } else if (tabName === "autoloot") {
    if (alList) alList.classList.remove("hidden");
    if (window.renderAutolootSidebar) renderAutolootSidebar();
    if (window.renderAutolootMain) renderAutolootMain();
  }
}

function render() {
  switchTab(state.currentTab);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function toggleEditorMode(enabled) {
  state.editorMode = enabled;
  if (enabled) {
    document.body.classList.remove("viewer-mode");
  } else {
    document.body.classList.add("viewer-mode");
    if (state.currentTab === "groups") {
      switchTab("quests");
    }
  }
  render();
}

function saveData() {
  console.log("[Save] No caching - data always fresh from remote");
}

// === EXPORT FUNCTIONS ===
function exportQuests() {
  const cleanedGroups = DATA.groups.map((group) => ({
    ...group,
    subgroups: group.subgroups.map((subgroup) => ({
      ...subgroup,
      quests: subgroup.quests.map((quest) => ({
        ...quest,
        requirements: quest.requirements.map((req) => {
          const cleaned = { ...req };
          if (!cleaned.immune) {
            delete cleaned.immune;
          }
          return cleaned;
        }),
      })),
    })),
  }));

  const json = JSON.stringify({ groups: cleanedGroups }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "osromr_quests.json";
  a.click();
  URL.revokeObjectURL(url);
}

function exportValues() {
  const values = {};
  Object.keys(DATA.items).forEach((id) => {
    if (DATA.items[id].value && DATA.items[id].value > 0) {
      values[id] = DATA.items[id].value;
    }
  });
  const json = JSON.stringify(values, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "osromr_item_values.json";
  a.click();
  URL.revokeObjectURL(url);
}

function exportAll() {
  exportQuests();
  setTimeout(() => exportValues(), 100);
}

// === SEARCH DEBOUNCING ===
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

const debouncedQuestFilter = debounce((value) => {
  state.questSearchFilter = value.toLowerCase();
  if (window.renderSidebar) renderSidebar();
}, 250);

const debouncedItemFilter = debounce((value) => {
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

document.addEventListener("DOMContentLoaded", () => {
  const qInput = document.getElementById("questSearchInput");
  const iInput = document.getElementById("itemSearchInput");

  if (qInput) {
    qInput.addEventListener("input", (e) =>
      debouncedQuestFilter(e.target.value),
    );
  }
  if (iInput) {
    iInput.addEventListener("input", (e) =>
      debouncedItemFilter(e.target.value),
    );
  }
});
