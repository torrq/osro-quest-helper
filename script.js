let DATA = {
  items: {},
  groups: [],
};

let state = {
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
};

// Ensure all 10 slots exist
for (let i = 1; i <= 10; i++) {
  if (!state.autolootData[i]) state.autolootData[i] = [];
}

// Apply initial viewer mode class
document.body.classList.add("viewer-mode");

// Initialize data - always fetch from remote (no caching for development)
(function initializeData() {
  // Always fetch quests, values, and items from remote
  if (AUTO_IMPORT_ON_FIRST_LOAD) {
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

        // Load quests (always from remote during development)
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

function switchTab(tabName) {
  state.currentTab = tabName;

  // 1. Update Tab styling
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.textContent.toLowerCase().includes(tabName));
  });

  // 2. Hide ALL Sidebar Content
  document.getElementById("treeContainer").classList.add("hidden");
  document.getElementById("itemsList").classList.add("hidden");
  document.getElementById("groupsList").classList.add("hidden");
  const alList = document.getElementById("autolootList");
  if (alList) alList.classList.add("hidden");

  // 3. Hide ALL Search/Header Inputs
  document.getElementById("questsSearch").classList.add("hidden");
  document.getElementById("itemsSearch").classList.add("hidden");

  // 4. Show Specific Content and render main content
  if (tabName === "quests") {
    document.getElementById("treeContainer").classList.remove("hidden");
    document.getElementById("questsSearch").classList.remove("hidden");
    renderSidebar();
    renderQuestContent();
  } else if (tabName === "items") {
    document.getElementById("itemsList").classList.remove("hidden");
    document.getElementById("itemsSearch").classList.remove("hidden");
    renderItems();
    renderItemContent();
  } else if (tabName === "groups") {
    document.getElementById("groupsList").classList.remove("hidden");
    renderGroupsList();
    renderGroupContent();
  } else if (tabName === "autoloot") {
    if (alList) alList.classList.remove("hidden");
    renderAutolootSidebar();
    renderAutolootMain();
  }
}

function clearItemSearch() {
  state.itemSearchFilter = "";
  document.getElementById("itemSearchInput").value = "";
  renderItems();
}

function clearQuestSearch() {
  state.questSearchFilter = "";
  document.getElementById("questSearchInput").value = "";
  renderSidebar();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function findQuestsByItemId(itemId) {
  const results = { produces: [], requires: [] };
  DATA.groups.forEach((group, gi) => {
    group.subgroups.forEach((subgroup, si) => {
      subgroup.quests.forEach((quest, qi) => {
        if (quest.producesId === itemId) {
          results.produces.push({
            quest,
            groupIdx: gi,
            subIdx: si,
            questIdx: qi,
            group,
            subgroup,
          });
        }
        // Find the matching requirement
        const matchingReq = quest.requirements.find((r) => {
          // Check regular items
          if (r.type === "item" && r.id === itemId) return true;
          // Check special currency types
          if (r.type === "gold" && itemId === SPECIAL_ITEMS.GOLD) return true;
          if (r.type === "credit" && itemId === SPECIAL_ITEMS.CREDIT)
            return true;
          return false;
        });

        if (matchingReq) {
          results.requires.push({
            quest,
            groupIdx: gi,
            subIdx: si,
            questIdx: qi,
            group,
            subgroup,
            amount: matchingReq.amount, // Store the amount from the requirement
          });
        }
      });
    });
  });
  return results;
}

function navigateToItem(itemId) {
  state.currentTab = "items";
  state.selectedQuest = null;
  state.selectedItemId = itemId;
  render();
}

function navigateToQuest(groupIdx, subIdx, questIdx) {
  state.currentTab = "quests";
  state.selectedItem = null;
  const group = DATA.groups[groupIdx];
  const subgroup = group?.subgroups[subIdx];
  const quest = subgroup?.quests[questIdx];
  if (quest) {
    state.expandedGroups.add(groupIdx);
    state.expandedSubgroups.add(`${groupIdx}-${subIdx}`);
    selectQuest(group, subgroup, quest);
  }
}

function render() {
  switchTab(state.currentTab);
}

function renderItems() {
  const container = document.getElementById("itemsList");

  // 1. First, identify every item ID that is actually used in a quest
  const usedItemIds = new Set();
  DATA.groups.forEach((group) => {
    group.subgroups.forEach((subgroup) => {
      subgroup.quests.forEach((quest) => {
        // Add the produced item
        if (quest.producesId) usedItemIds.add(Number(quest.producesId));

        // Add all required items
        quest.requirements.forEach((req) => {
          if (req.type === "item" && req.id) {
            usedItemIds.add(Number(req.id));
          }
        });
      });
    });
  });

  // 2. Filter the master item list to only those in our 'used' Set
  let items = getAllItems().filter((item) => usedItemIds.has(item.id));

  // 3. Apply search filter if active
  if (state.itemSearchFilter) {
    const q = state.itemSearchFilter;
    items = items.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(q) ||
        item.id.toString().includes(q),
    );
  }

  const totalFound = items.length;
  const limit = 1500;
  const displayedItems = items.slice(0, limit);

  let html = "";

  // Display a count of used items vs search results
  if (totalFound > 0) {
    html += `<div class="items-search-banner">
               ${displayedItems.length} items
             </div>`;
  }

  if (items.length === 0) {
    html = `<div class="empty-msg-centered">
              No used items found ${state.itemSearchFilter ? "matching your search" : ""}
            </div>`;
  } else {
    html += displayedItems
      .map(
        (item) => `
      <div class="item-row ${state.selectedItemId === item.id ? "active" : ""}"
           onclick="selectItem(${item.id})">
        <div class="item-row-header">
          <span>${getItemDisplayName(item) || "&lt;unnamed&gt;"}</span>
          <span class="item-row-id">#${item.id}</span>
        </div>
      </div>
    `,
      )
      .join("");
  }

  container.innerHTML = html;
}

function selectItem(id) {
  state.selectedItemId = id;
  renderItems();
  renderItemContent();
}

function renderItemContent() {
  const container = document.getElementById("mainContent");

  if (state.selectedItemId == null) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Item Selected</h2>
        <p>Select an item from the sidebar</p>
      </div>
    `;
    return;
  }

  const id = state.selectedItemId;

  const item = DATA.items[id];

  if (!item) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Item Not Found</h2>
        <p>The selected item no longer exists.</p>
      </div>
    `;
    return;
  }

  const usage = findQuestsByItemId(+id);
  const descriptionHtml = parseDescription(item.desc);

  container.innerHTML = `
    <div class="editor-item">
      <div class="item-header">
        <h2>
          ${getItemDisplayName(item)}
          <span class="item-id-badge">#${id}</span>
        </h2>
      </div>

      <div class="panel-section">
        ${
          descriptionHtml
            ? `
          <span class="item-label">Description:</span>
          <div class="item-description-box">${descriptionHtml}</div>`
            : ""
        }
      </div>

      <div class="panel-section">
        <div class="form-group">
          <span class="item-label">Zeny Value:</span>
          <div class="form-row-1">
            <input type="number"
                   placeholder="0"
                   value="${item.value || 0}"
                   onchange="updateItemValue(${id}, this.value)"
                   class="zeny-input-large">
          </div>
          <p class="help-text">
            Set the estimated market value for this item.
            This is saved to 'osromr_item_values.json'.
          </p>
        </div>
      </div>

      ${
        usage.produces.length > 0 || usage.requires.length > 0
          ? `
        <div class="usage-section">
          ${
            usage.produces.length > 0
              ? `
            <h3>Produced By:</h3>
            <ul class="usage-list">
              ${usage.produces
                .map(
                  (u) => `
                <li>
                  <a class="quest-link"
                     onclick="navigateToQuest(${u.groupIdx}, ${u.subIdx}, ${u.questIdx});">
                    ${u.quest.name}
                  </a>
                  <span class="quest-path-info">
                    (${u.group.name} / ${u.subgroup.name})
                  </span>
                  <span class="quest-meta-info">
                    [${u.quest.successRate}% Success]
                  </span>
                </li>
              `,
                )
                .join("")}
            </ul>
          `
              : ""
          }

          ${
            usage.requires.length > 0
              ? `
            <h3>Required By:</h3>
            <ul class="usage-list">
              ${usage.requires
                .map(
                  (u) => `
                <li>
                  <a class="quest-link"
                     onclick="navigateToQuest(${u.groupIdx}, ${u.subIdx}, ${u.questIdx});">
                    ${u.quest.name}
                  </a>
                  <span class="quest-path-info">
                    (${u.group.name} / ${u.subgroup.name})
                  </span>
                  ${
                    u.amount
                      ? `
                    <span class="quest-meta-info">
                      [Needs ${u.amount}]
                    </span>`
                      : ""
                  }
                </li>
              `,
                )
                .join("")}
            </ul>
          `
              : ""
          }
        </div>
      `
          : `
        <div class="usage-section">
          <p class="empty-msg-centered">
            This item is not used in any quests.
          </p>
        </div>
      `
      }
    </div>
  `;
}

function updateItemValue(id, value) {
  if (DATA.items[id]) {
    DATA.items[id].value = Number(value) || 0;
  }
}

// Helper to parse RO color codes for HTML display
function parseDescription(desc) {
  if (!desc) return "";

  let text;

  // NEW: handle string descriptions (newline-separated)
  if (typeof desc === "string") {
    text = desc.replace(/\n/g, "<br>");
  }
  // OLD: array-based descriptions
  else if (Array.isArray(desc)) {
    text = desc.join("<br>");
  } else {
    return "";
  }

  // RO color handling
  text = text.replace(/\^000000/g, "</span>");
  text = text.replace(/\^([0-9A-Fa-f]{6})/g, '<span style="color: #$1">');

  return text;
}

function renderSidebar() {
  const container = document.getElementById("treeContainer");
  container.innerHTML = "";

  const filter = state.questSearchFilter;

  DATA.groups.forEach((group, groupIdx) => {
    // Logic to determine if group should be shown/expanded based on filter
    let hasMatch = false;
    let matchingSubgroups = [];

    if (filter) {
      group.subgroups.forEach((subgroup, subIdx) => {
        const matchingQuests = subgroup.quests.filter((q) =>
          q.name.toLowerCase().includes(filter),
        );
        if (matchingQuests.length > 0) {
          hasMatch = true;
          matchingSubgroups.push(subIdx);
        }
      });
      if (!hasMatch) return; // Hide group if no matches
    }

    const groupDiv = document.createElement("div");
    groupDiv.className = "group";

    // Auto-expand if filtering, otherwise use state
    const isExpanded = filter ? true : state.expandedGroups.has(groupIdx);

    const header = document.createElement("div");
    header.className = "group-header clickable";
    header.onclick = () => toggleGroup(groupIdx);
    header.innerHTML = `
      <span class="expand-icon ${isExpanded ? "expanded" : ""}">▶</span>
      <div class="group-name-container">
        <span class="group-name-readonly">${group.name}</span>
        ${group.caption ? `<span class="group-caption">${group.caption}</span>` : ""}
      </div>
    `;
    groupDiv.appendChild(header);

    if (isExpanded) {
      group.subgroups.forEach((subgroup, subIdx) => {
        // Filter logic for subgroups
        if (filter && !matchingSubgroups.includes(subIdx)) return;

        let matchingQuests = subgroup.quests;
        if (filter) {
          matchingQuests = subgroup.quests.filter((q) =>
            q.name.toLowerCase().includes(filter),
          );
        }

        const subDiv = document.createElement("div");
        subDiv.className = "subgroup";

        const isSubExpanded = filter
          ? true
          : state.expandedSubgroups.has(`${groupIdx}-${subIdx}`);

        const subHeader = document.createElement("div");
        subHeader.className = "subgroup-header clickable";
        subHeader.onclick = () => toggleSubgroup(groupIdx, subIdx);
        subHeader.innerHTML = `
          <span class="expand-icon ${isSubExpanded ? "expanded" : ""}">▶</span>
          <span class="subgroup-name-readonly">${subgroup.name}</span>
        `;
        subDiv.appendChild(subHeader);

        if (isSubExpanded) {
          // Use matchingQuests array for filtering (or all quests if no filter)
          // We need original index for drag/drop to work correctly, so we iterate original array but check visibility
          subgroup.quests.forEach((quest, questIdx) => {
            if (filter && !quest.name.toLowerCase().includes(filter)) return;

            const questDiv = document.createElement("div");
            questDiv.className = "quest-item";
            if (state.selectedQuest === quest) {
              questDiv.classList.add("active");
            }

            // Only make draggable in editor mode
            questDiv.draggable = state.editorMode;

            questDiv.innerHTML = `
              <span class="drag-handle">${state.editorMode ? "⋮⋮" : "◆"}</span>
              <span class="quest-name">${quest.name}</span>
            `;

            // Only add drag/drop listeners in editor mode
            if (state.editorMode) {
              questDiv.addEventListener("dragstart", (e) => {
                state.draggedQuest = questIdx;
                state.draggedFrom = { groupIdx, subIdx };
                questDiv.classList.add("dragging");
              });

              questDiv.addEventListener("dragend", (e) => {
                questDiv.classList.remove("dragging");
                document
                  .querySelectorAll(".quest-item")
                  .forEach((el) => el.classList.remove("drag-over"));
              });

              questDiv.addEventListener("dragover", (e) => {
                e.preventDefault();
              });

              questDiv.addEventListener("dragenter", (e) => {
                if (
                  state.draggedQuest !== questIdx ||
                  state.draggedFrom.groupIdx !== groupIdx ||
                  state.draggedFrom.subIdx !== subIdx
                ) {
                  questDiv.classList.add("drag-over");
                }
              });

              questDiv.addEventListener("dragleave", (e) => {
                questDiv.classList.remove("drag-over");
              });

              questDiv.addEventListener("drop", (e) => {
                e.preventDefault();
                questDiv.classList.remove("drag-over");

                if (
                  state.draggedFrom.groupIdx === groupIdx &&
                  state.draggedFrom.subIdx === subIdx
                ) {
                  const quests = subgroup.quests;
                  const [removed] = quests.splice(state.draggedQuest, 1);
                  const newIdx =
                    questIdx > state.draggedQuest ? questIdx - 1 : questIdx;
                  quests.splice(newIdx, 0, removed);
                  render();
                }
              });
            }

            questDiv.querySelector(".quest-name").onclick = () => {
              selectQuest(group, subgroup, quest);
              if (window.innerWidth <= 768) {
                toggleSidebar();
              }
            };

            subDiv.appendChild(questDiv);
          });

          if (!filter && state.editorMode) {
            const addQuestBtn = document.createElement("button");
            addQuestBtn.className = "btn btn-sm btn-indent-quest";
            addQuestBtn.textContent = "+ Quest";
            addQuestBtn.onclick = () => addQuest(groupIdx, subIdx);
            subDiv.appendChild(addQuestBtn);
          }
        }
        groupDiv.appendChild(subDiv);
      });
    }

    container.appendChild(groupDiv);
  });
}

// For rendering groups management list
function renderGroupsList() {
  const container = document.getElementById("groupsList");

  let html = "";

  DATA.groups.forEach((group, groupIdx) => {
    const isSelected = state.selectedGroupForEdit === groupIdx;
    html += `
      <div class="group-edit-item ${isSelected ? "active" : ""}" onclick="selectGroupForEdit(${groupIdx})">
        <div class="group-edit-header">
          <div class="group-edit-name-container">
            <span class="group-edit-name">${group.name}</span>
            ${group.caption ? `<span class="group-edit-caption">${group.caption}</span>` : ""}
          </div>
          <span class="group-edit-count">${group.subgroups.length} subgroups</span>
        </div>
      </div>
    `;
  });

  if (DATA.groups.length === 0) {
    html = `<div class="empty-msg-centered">No quest groups yet. Click "+ Group" to create one.</div>`;
  }

  container.innerHTML = html;
}

function selectGroupForEdit(idx) {
  state.selectedGroupForEdit = idx;
  renderGroupsList();
  renderGroupContent();
}

function renderGroupContent() {
  const container = document.getElementById("mainContent");

  if (state.selectedGroupForEdit === null) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Group Selected</h2>
        <p>Select a group from the sidebar to edit</p>
      </div>
    `;
    return;
  }

  const groupIdx = state.selectedGroupForEdit;
  const group = DATA.groups[groupIdx];

  if (!group) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Group Not Found</h2>
        <p>The selected group no longer exists.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="editor-group">
      <div class="group-edit-top">
        <h2>Edit Quest Group</h2>
        <button class="btn btn-danger" onclick="deleteGroup(${groupIdx})">Delete Group</button>
      </div>
      
      <div class="form-group">
        <span class="item-label">Group Name:</span>
        <input type="text" placeholder="Group Name" value="${group.name}" onchange="updateGroupName(${groupIdx}, this.value)">
      </div>
      
      <div class="form-group">
        <span class="item-label">Caption (optional):</span>
        <input type="text" placeholder="e.g., Main Office, Prontera, etc." value="${group.caption || ""}" onchange="updateGroupCaption(${groupIdx}, this.value)">
        <p class="help-text">A short location or description displayed under the group name</p>
      </div>
      
      <div class="group-ordering-section">
        <span class="item-label">Group Position:</span>
        <div class="ordering-controls">
          <button class="btn btn-sm" onclick="moveGroup(${groupIdx}, -1)" ${groupIdx === 0 ? "disabled" : ""}>↑ Move Up</button>
          <button class="btn btn-sm" onclick="moveGroup(${groupIdx}, 1)" ${groupIdx === DATA.groups.length - 1 ? "disabled" : ""}>↓ Move Down</button>
          <span class="ordering-info">Position ${groupIdx + 1} of ${DATA.groups.length}</span>
        </div>
      </div>
      
      <div class="subgroups-section">
        <div class="subgroups-header">
          <span class="item-label">Subgroups (${group.subgroups.length})</span>
          <button class="btn btn-sm btn-primary" onclick="addSubgroup(${groupIdx})">+ Add Subgroup</button>
        </div>
        
        <div class="subgroups-list">
  `;

  if (group.subgroups.length === 0) {
    html += `<div class="empty-msg-centered">No subgroups yet. Click "+ Add Subgroup" to create one.</div>`;
  } else {
    group.subgroups.forEach((subgroup, subIdx) => {
      html += `
        <div class="subgroup-edit-card">
          <div class="subgroup-edit-header">
            <input type="text" class="subgroup-edit-name-input" value="${subgroup.name}" onchange="updateSubgroupName(${groupIdx}, ${subIdx}, this.value)">
            <span class="subgroup-quest-count">${subgroup.quests.length} quests</span>
            <div class="subgroup-ordering-controls">
              <button class="btn btn-sm btn-icon" onclick="moveSubgroup(${groupIdx}, ${subIdx}, -1)" ${subIdx === 0 ? "disabled" : ""} title="Move Up">↑</button>
              <button class="btn btn-sm btn-icon" onclick="moveSubgroup(${groupIdx}, ${subIdx}, 1)" ${subIdx === group.subgroups.length - 1 ? "disabled" : ""} title="Move Down">↓</button>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteSubgroup(${groupIdx}, ${subIdx})">Delete</button>
          </div>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function updateGroupCaption(idx, value) {
  DATA.groups[idx].caption = value.trim();
  render();
}

function moveGroup(idx, direction) {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= DATA.groups.length) return;

  // Swap groups
  const temp = DATA.groups[idx];
  DATA.groups[idx] = DATA.groups[newIdx];
  DATA.groups[newIdx] = temp;

  // Update selected index
  state.selectedGroupForEdit = newIdx;

  render();
}

function moveSubgroup(groupIdx, subIdx, direction) {
  const group = DATA.groups[groupIdx];
  const newIdx = subIdx + direction;
  if (newIdx < 0 || newIdx >= group.subgroups.length) return;

  // Swap subgroups
  const temp = group.subgroups[subIdx];
  group.subgroups[subIdx] = group.subgroups[newIdx];
  group.subgroups[newIdx] = temp;

  render();
}

function toggleGroup(idx) {
  if (state.expandedGroups.has(idx)) {
    state.expandedGroups.delete(idx);
  } else {
    state.expandedGroups.add(idx);
  }
  render();
}

function toggleSubgroup(groupIdx, subIdx) {
  const key = `${groupIdx}-${subIdx}`;
  if (state.expandedSubgroups.has(key)) {
    state.expandedSubgroups.delete(key);
  } else {
    state.expandedSubgroups.add(key);
  }
  render();
}

function selectQuest(group, subgroup, quest) {
  state.selectedQuest = quest;
  state.selectedGroup = group;
  state.selectedSubgroup = subgroup;
  render();
}

function renderQuestContent() {
  const container = document.getElementById("mainContent");

  if (!state.selectedQuest) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Quest Selected</h2>
        <p>Select a quest from the sidebar</p>
      </div>
    `;
    return;
  }

  const quest = state.selectedQuest;
  const item = getItem(quest.producesId);
  const descriptionHtml = parseDescription(item.desc);

  container.innerHTML = `
    <div class="editor-quest">
      <span class="item-label">Quest Name:</span>
      <div class="form-group">
        <input type="text" placeholder="Quest Name" value="${quest.name}" onchange="updateQuestName(this.value)">
      </div>

      <div class="form-group">
        <div class="quest-info-row">
          <div class="item-selector-wrapper">
            <span class="item-label label-block">Produces Item:</span>
            ${
              quest.producesId
                ? `
              <div class="item-selected-badge">
                <strong><a class="item-link tree-item-name" onclick="navigateToItem(${quest.producesId})">${getItemDisplayName(item)}</a></strong>
                <button class="clear-btn" onclick="updateProducesId(null)">×</button>
              </div>
            `
                : `
              <div class="search-container">
                <input type="text" id="produces-search" placeholder="Search item to produce..." oninput="setupProducesSearch(this)">
                <div id="produces-dropdown" class="autocomplete-dropdown"></div>
              </div>
            `
            }
          </div>
          
          <div>
            <span class="item-label label-block">Success Rate:</span>
            <input type="number" class="input-width-sm" min="1" max="100" placeholder="%" value="${quest.successRate}" onchange="updateSuccessRate(this.value)">
          </div>
          
          <div class="quest-bound">
            <span class="item-label label-block">Bound:</span>
            <input type="checkbox" ${quest.accountBound ? "checked" : ""} onchange="updateQuestAccountBound(this.checked)">
          </div>
        </div>
      </div>
      <div class="requirements-wrapper">
        <span class="item-label">Requirements: &nbsp;<button class="btn btn-sm btn-primary" onclick="addRequirement()">+ Add</button></span>
        <div class="requirements-section">
          <div class="requirements-grid">
            ${quest.requirements.map((req, idx) => renderRequirement(req, idx)).join("")}
          </div>
        </div>
      </div>

      ${
        descriptionHtml
          ? `
        <span class="item-label">Item Description:</span>
        <div class="item-description-box">${descriptionHtml}</div>`
          : ""
      }

      <span class="item-label">Tree:</span>
      <div class="material-tree">
        ${renderMaterialTree()}
      </div>

      ${
        hasNestedQuests()
          ? `
      <div class="totals-header">
        <span class="item-label">Totals:</span>
        <button class="btn btn-sm btn-toggle-totals" onclick="toggleTotals()">
          ${state.showFullTotals ? "This Quest Only" : "Include Sub-Quests"}
        </button>
      </div>
      `
          : `
      <span class="item-label">Totals:</span>
      `
      }
      <div class="summary-section">
        ${renderSummary()}
        <span class="quest-footer-badge">
            ${quest.successRate}% Success Rate
        </span>
      </div>
    </div>
  `;

  // Initialize listeners for all requirement search inputs
  document.querySelectorAll(".req-search-input").forEach((input) => {
    const idx = parseInt(input.getAttribute("data-idx"));
    setupAutocomplete(input, idx);
  });

  // Keep existing produces-search logic
  const producesInput = document.getElementById("produces-search");
  if (producesInput) {
    producesInput.addEventListener("input", () =>
      setupProducesSearch(producesInput),
    );
  }
}

function hasNestedQuests() {
  if (!state.selectedQuest) return false;

  const questIndex = buildQuestIndex();

  // Check if any requirement is an item that has a quest to produce it
  return state.selectedQuest.requirements.some(
    (req) => req.type === "item" && questIndex.has(req.id),
  );
}

function setupAutocomplete(input, idx) {
  input.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase();
    if (value.length < 1) {
      hideAutocomplete(idx);
      return;
    }

    const items = getAllItems();
    let matches = [];

    // Check if input is purely numeric
    const queryNum = parseInt(value, 10);
    const isNumericQuery = !isNaN(queryNum) && value === queryNum.toString();

    if (isNumericQuery) {
      // Find exact ID match
      const exactMatch = items.find((item) => item.id === queryNum);
      if (exactMatch) {
        matches.push(exactMatch);
        // Add other matches, excluding the exact one, up to 9 more
        const otherMatches = items
          .filter(
            (item) =>
              item.id !== queryNum &&
              (item.name.toLowerCase().includes(value) ||
                item.id.toString().includes(value)),
          )
          .slice(0, 9);
        matches = matches.concat(otherMatches);
      } else {
        // Fallback to regular matches if no exact ID
        matches = items
          .filter(
            (item) =>
              item.name.toLowerCase().includes(value) ||
              item.id.toString().includes(value),
          )
          .slice(0, 10);
      }
    } else {
      // Regular non-numeric search - prioritize exact name matches
      const lowerQuery = value.toLowerCase();

      matches = items
        .filter(
          (item) =>
            item.name.toLowerCase().includes(lowerQuery) ||
            item.id.toString().includes(lowerQuery),
        )
        .sort((a, b) => {
          const aNameLower = a.name.toLowerCase();
          const bNameLower = b.name.toLowerCase();

          // Exact name match comes first
          const aExactMatch = aNameLower === lowerQuery;
          const bExactMatch = bNameLower === lowerQuery;
          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          // Then prioritize matches at the start of the name
          const aStartsWith = aNameLower.startsWith(lowerQuery);
          const bStartsWith = bNameLower.startsWith(lowerQuery);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          // Finally, sort by ID (lower first)
          return a.id - b.id;
        })
        .slice(0, 10);
    }

    if (matches.length > 0) {
      showAutocomplete(idx, matches);
    } else {
      hideAutocomplete(idx);
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => hideAutocomplete(idx), 200);
  });
}

function showAutocomplete(idx, items) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (!dropdown) return;

  dropdown.innerHTML = items
    .map(
      (item) => `
  <div class="autocomplete-item" onclick="selectAutocomplete(${idx}, ${item.id})">
    ${getItemDisplayName(item)}<span class="autocomplete-item-id">[${item.id}]</span>
  </div>
  `,
    )
    .join("");
  dropdown.classList.add("block");
}

function hideAutocomplete(idx) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (dropdown) {
    dropdown.classList.remove("block");
  }
}

function selectAutocomplete(idx, itemId) {
  if (state.selectedQuest && state.selectedQuest.requirements[idx]) {
    state.selectedQuest.requirements[idx].id = itemId;
    // Auto-fill name logic if you have a name field in the requirement object,
    // otherwise the Badge will pull from DATA.items via getItem(req.id)
    render();
  }
}

function renderRequirement(req, idx) {
  const isItem = req.type === "item";
  const item = isItem ? getItem(req.id) : null;

  return `
    <div class="requirement-card">
      <button class="remove-btn" onclick="deleteRequirement(${idx})" title="Remove">×</button>
      
      <div class="req-top-row">
        <select onchange="updateReqType(${idx}, this.value)">
          <option value="item" ${req.type === "item" ? "selected" : ""}>Item</option>
          <option value="zeny" ${req.type === "zeny" ? "selected" : ""}>Zeny</option>
          <option value="gold" ${req.type === "gold" ? "selected" : ""}>Gold</option>
          <option value="credit" ${req.type === "credit" ? "selected" : ""}>Credit</option>
          <option value="vote_points" ${req.type === "vote_points" ? "selected" : ""}>Vote Points</option>
          <option value="hourly_points" ${req.type === "hourly_points" ? "selected" : ""}>Hourly Points</option>
          <option value="activity_points" ${req.type === "activity_points" ? "selected" : ""}>Activity Points</option>
          <option value="monster_arena_points" ${req.type === "monster_arena_points" ? "selected" : ""}>MA Points</option>
          <option value="otherworld_points" ${req.type === "otherworld_points" ? "selected" : ""}>Otherworld Points</option>
          <option value="hall_of_heritage_points" ${req.type === "hall_of_heritage_points" ? "selected" : ""}>HoH Points</option>
        </select>
        <input type="number" placeholder="Amount" value="${req.amount}" onchange="updateReqAmount(${idx}, this.value)">
      </div>

      ${
        isItem
          ? `
        <div class="req-name-row">
          ${
            req.id
              ? `
            <div class="item-selected-badge">
              <strong class="text-ellipsis-max">
                <a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item) || "Unknown"}</a>
              </strong>
              <small>(${req.id})</small>
              <button class="clear-btn ml-auto" onclick="updateReqId(${idx}, null)">×</button>
            </div>
          `
              : `
            <div class="search-container">
              <input type="text" 
                     class="req-search-input req-search-input-full" 
                     data-idx="${idx}" 
                     placeholder="Search item...">
              <div id="autocomplete-${idx}" class="autocomplete-dropdown"></div>
            </div>
          `
          }
        </div>
      `
          : ""
      }

      <div class="checkbox-group">
        <label class="checkbox-label text-muted-xs opacity-80">
          <input type="checkbox" ${req.immune ? "checked" : ""} onchange="updateReqImmune(${idx}, this.checked)">Immune</label>
      </div>
    </div>
  `;
}

function renderMaterialTree() {
  const questIndex = buildQuestIndex();
  const lines = [];
  const MAX_DEPTH = 10;

  function walk(
    quest,
    depth,
    multiplier,
    questPath = new Set(),
    parentKey = "",
    parentExpanded = true,
  ) {
    // Prevent infinite loops and excessive depth
    if (questPath.has(quest) || depth > MAX_DEPTH) return;
    const newPath = new Set(questPath);
    newPath.add(quest);

    quest.requirements.forEach((req, reqIdx) => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      const indent = "  ".repeat(depth);
      const connector = depth > 0 ? "└─ " : "";
      const immuneBadge = req.immune
        ? ' <span class="text-immune">[IMMUNE]</span>'
        : "";

      const itemKey = `${parentKey}-${depth}-${reqIdx}`;
      const isExpanded = state.expandedTreeItems.has(itemKey);
      const hasChildren = req.type === "item" && questIndex.has(req.id);

      // Item is visible if: it's at root level OR its parent is expanded
      const isVisible = depth === 0 || parentExpanded;

      if (req.type === "item" && questIndex.has(req.id)) {
        const item = getItem(req.id);
        const quests = questIndex.get(req.id);

        if (quests.length === 1) {
          // Single quest - show expand icon if it has children
          const expandIcon = hasChildren
            ? `<span class="tree-expand-icon ${isExpanded ? "expanded" : ""}" onclick="toggleTreeItem('${itemKey}')">▶</span> `
            : "";

          lines.push({
            level: depth,
            text: `${indent}${connector}${expandIcon}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
            visible: isVisible,
          });

          // Recurse into children, passing whether THIS item is expanded
          walk(
            quests[0],
            depth + 1,
            effectiveAmount,
            newPath,
            itemKey,
            isExpanded,
          );
        } else {
          // Multiple quests - show expand icon if it has children
          const expandIcon = hasChildren
            ? `<span class="tree-expand-icon ${isExpanded ? "expanded" : ""}" onclick="toggleTreeItem('${itemKey}')">▶</span> `
            : "";

          lines.push({
            level: depth,
            text: `${indent}${connector}${expandIcon}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge} <span class="text-warning-xs">[${quests.length} OPTIONS]</span>`,
            visible: isVisible,
          });

          if (isExpanded) {
            quests.forEach((q, idx) => {
              const optionIndent = "  ".repeat(depth + 1);
              const optionNum = idx + 1;
              const optionKey = `${itemKey}-opt${idx}`;
              lines.push({
                level: depth + 1,
                text: `${optionIndent}<span class="text-muted">Option ${optionNum}: ${q.name} (${q.successRate}% success)</span>`,
                visible: isExpanded,
              });
              walk(q, depth + 2, effectiveAmount, newPath, optionKey, true);
            });
          }
        }
      } else if (req.type === "zeny") {
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">Zeny</span> × <span class="tree-amount">${effectiveAmount.toLocaleString()}</span>${immuneBadge}`,
          visible: isVisible,
        });
      } else if (req.type === "credit") {
        const zenyValue = effectiveAmount * getCreditValue();
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`,
          visible: isVisible,
        });
      } else if (req.type === "gold") {
        const zenyValue = effectiveAmount * getGoldValue();
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`,
          visible: isVisible,
        });
      } else if (
        req.type === "vote_points" ||
        req.type === "activity_points" ||
        req.type === "hourly_points" ||
        req.type === "monster_arena_points" ||
        req.type === "otherworld_points" ||
        req.type === "hall_of_heritage_points" ||
        req.type === "event_points"
      ) {
        const typeName =
          req.type === "vote_points"
            ? "Vote Points"
            : req.type === "activity_points"
              ? "Activity Points"
              : req.type === "hourly_points"
                ? "Hourly Points"
                : req.type === "monster_arena_points"
                  ? "Monster Arena Points"
                  : req.type === "otherworld_points"
                    ? "Otherworld Points"
                    : req.type === "hall_of_heritage_points"
                      ? "Hall of Heritage Points"
                      : "Event Points";
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">${typeName}</span> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
          visible: isVisible,
        });
      } else if (req.type === "item") {
        const item = getItem(req.id);
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item) || "Unknown"}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
          visible: isVisible,
        });
      }
    });
  }

  walk(state.selectedQuest, 0, 1, new Set(), "", true);

  if (lines.length === 0) {
    return '<div class="tree-line">No requirements</div>';
  }

  return lines
    .filter((line) => line.visible)
    .map(
      (line) => `<div class="tree-line level-${line.level}">${line.text}</div>`,
    )
    .join("");
}

function toggleTreeItem(itemKey) {
  if (state.expandedTreeItems.has(itemKey)) {
    state.expandedTreeItems.delete(itemKey);
  } else {
    state.expandedTreeItems.add(itemKey);
  }
  renderQuestContent();
}

function toggleTotals() {
  state.showFullTotals = !state.showFullTotals;
  renderQuestContent();
}

function renderDirectRequirements() {
  const quest = state.selectedQuest;
  let totalZeny = 0;
  const totals = {};

  quest.requirements.forEach((req) => {
    const effectiveAmount = Number(req.amount) || 0;

    // Calculate zeny
    if (req.type === "zeny") {
      totalZeny += effectiveAmount;
    } else if (req.type === "credit") {
      totalZeny += effectiveAmount * getCreditValue();
    } else if (req.type === "gold") {
      totalZeny += effectiveAmount * getGoldValue();
    } else if (req.type === "item") {
      const item = getItem(req.id);
      totalZeny += effectiveAmount * (item.value || 0);
    }

    const key = req.type === "item" ? `item_${req.id}` : req.type;
    const name =
      req.type === "zeny"
        ? "Zeny"
        : req.type === "credit"
          ? "Credit"
          : req.type === "gold"
            ? "Gold"
            : req.type === "vote_points"
              ? "Vote Points"
              : req.type === "activity_points"
                ? "Activity Points"
                : req.type === "hourly_points"
                  ? "Hourly Points"
                  : req.type === "monster_arena_points"
                    ? "Monster Arena Points"
                    : req.type === "otherworld_points"
                      ? "Otherworld Points"
                      : req.type === "hall_of_heritage_points"
                        ? "Hall of Heritage Points"
                        : req.type === "event_points"
                          ? "Event Points"
                          : getItem(req.id).name || "Unknown";

    if (!totals[key]) {
      totals[key] = {
        name,
        amount: 0,
        type: req.type,
        value: req.type === "item" ? getItem(req.id).value : 0,
      };
    }
    totals[key].amount += effectiveAmount;
  });

  const entries = Object.values(totals).sort((a, b) => {
    const currencyOrder = { zeny: 0, credit: 1, gold: 2 };
    const aIsCurrency = a.type in currencyOrder;
    const bIsCurrency = b.type in currencyOrder;

    if (aIsCurrency && bIsCurrency) {
      return currencyOrder[a.type] - currencyOrder[b.type];
    }
    if (aIsCurrency) return -1;
    if (bIsCurrency) return 1;

    if (a.amount !== b.amount) {
      return b.amount - a.amount;
    }

    return a.name.localeCompare(b.name);
  });

  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  let html = "";

  if (totalZeny > 0) {
    html += `
      <div class="summary-item summary-total-row">
        <span class="summary-name summary-total-label">Total Zeny Value</span>
        <span class="summary-amount summary-total-amount">${totalZeny.toLocaleString()}</span>
      </div>
    `;
  }

  html += entries
    .map((entry) => {
      const displayAmount =
        entry.type === "zeny" ? entry.amount.toLocaleString() : entry.amount;
      let extra = "";
      if (entry.type === "credit") {
        extra = ` <span class="text-muted-sm">(${(entry.amount * getCreditValue()).toLocaleString()} zeny)</span>`;
      } else if (entry.type === "gold") {
        extra = ` <span class="text-muted-sm">(${(entry.amount * getGoldValue()).toLocaleString()} zeny)</span>`;
      } else if (entry.type === "item" && entry.value > 0) {
        extra = ` <span class="text-muted-sm">(${(entry.amount * entry.value).toLocaleString()} zeny)</span>`;
      }
      return `
      <div class="summary-item">
        <span class="summary-name">${entry.name}</span>
        <span class="summary-amount">${displayAmount}${extra}</span>
      </div>
    `;
    })
    .join("");

  return html;
}

function renderSummary() {
  const questIndex = buildQuestIndex();

  // If showing direct only, just return direct requirements
  if (!state.showFullTotals) {
    return renderDirectRequirements();
  }

  // Find all items with multiple quest options
  const multiQuestItems = new Map();

  function findMultiQuestItems(quest, questPath = new Set()) {
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath);
    newPath.add(quest);

    quest.requirements.forEach((req) => {
      if (req.type === "item" && questIndex.has(req.id)) {
        const quests = questIndex.get(req.id);
        if (quests.length > 1) {
          multiQuestItems.set(req.id, {
            name: getItem(req.id).name,
            quests: quests,
          });
        }
        // Continue searching in first option
        findMultiQuestItems(quests[0], newPath);
      }
    });
  }

  findMultiQuestItems(state.selectedQuest);

  // If no multi-quest items, calculate single summary
  if (multiQuestItems.size === 0) {
    return renderSingleSummary(questIndex, {});
  }

  // Generate all combinations of quest choices
  const items = Array.from(multiQuestItems.entries());
  const combinations = generateCombinations(items);

  // Generate tab labels with group and subgroup names
  const tabLabels = combinations.map((combo) => {
    const labels = [];
    for (const [itemId, quest] of Object.entries(combo)) {
      const itemName = multiQuestItems.get(Number(itemId)).name;
      // Find the group and subgroup for this quest
      let groupName = "";
      let subgroupName = "";
      DATA.groups.forEach((group) => {
        group.subgroups.forEach((subgroup) => {
          if (subgroup.quests.includes(quest)) {
            groupName = group.name;
            subgroupName = subgroup.name;
          }
        });
      });
      labels.push(`(${groupName} / ${subgroupName})`);
    }
    return labels.join(" | ");
  });

  let html = `
    <div class="summary-tabs-container">
      <div class="summary-tabs">
        ${combinations
          .map(
            (combo, idx) => `
          <div class="summary-tab ${idx === 0 ? "active" : ""}" 
               onclick="switchSummaryTab(${idx})"
               title="${tabLabels[idx]}">
            Option ${idx + 1} ${tabLabels[idx]}
          </div>
        `,
          )
          .join("")}
      </div>
      ${combinations
        .map(
          (combo, idx) => `
        <div class="summary-tab-content ${idx === 0 ? "active" : ""}" 
             id="summary-tab-${idx}">
          ${renderSingleSummary(questIndex, combo)}
        </div>
      `,
        )
        .join("")}
    </div>
  `;

  return html;
}

function generateCombinations(items) {
  if (items.length === 0) return [{}];

  const [first, ...rest] = items;
  const [itemId, { quests }] = first;
  const restCombos = generateCombinations(rest);

  const result = [];
  for (const quest of quests) {
    for (const combo of restCombos) {
      result.push({ ...combo, [itemId]: quest });
    }
  }
  return result;
}

function renderSingleSummary(questIndex, questChoices) {
  const totals = {};
  let totalZeny = 0;

  function accumulate(quest, multiplier, questPath = new Set()) {
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath);
    newPath.add(quest);

    quest.requirements.forEach((req) => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      if (req.type === "item" && questIndex.has(req.id)) {
        const quests = questIndex.get(req.id);
        // Use specified choice or default to first
        const chosenQuest = questChoices[req.id] || quests[0];
        accumulate(chosenQuest, effectiveAmount, newPath);
        return;
      } else {
        // Calculate zeny contributions
        if (req.type === "zeny") {
          totalZeny += effectiveAmount;
        } else if (req.type === "credit") {
          totalZeny += effectiveAmount * getCreditValue();
        } else if (req.type === "gold") {
          totalZeny += effectiveAmount * getGoldValue();
        } else if (req.type === "item") {
          const item = getItem(req.id);
          totalZeny += effectiveAmount * (item.value || 0);
        }

        const key = req.type === "item" ? `item_${req.id}` : req.type;
        const name =
          req.type === "zeny"
            ? "Zeny"
            : req.type === "credit"
              ? "Credit"
              : req.type === "gold"
                ? "Gold"
                : req.type === "vote_points"
                  ? "Vote Points"
                  : req.type === "activity_points"
                    ? "Activity Points"
                    : req.type === "hourly_points"
                      ? "Hourly Points"
                      : req.type === "monster_arena_points"
                        ? "Monster Arena Points"
                        : req.type === "otherworld_points"
                          ? "Otherworld Points"
                          : req.type === "hall_of_heritage_points"
                            ? "Hall of Heritage Points"
                            : req.type === "event_points"
                              ? "Event Points"
                              : getItem(req.id).name || "Unknown";

        if (!totals[key]) {
          totals[key] = {
            name,
            amount: 0,
            type: req.type,
            value: req.type === "item" ? getItem(req.id).value : 0,
          };
        }
        totals[key].amount += effectiveAmount;
      }
    });
  }

  accumulate(state.selectedQuest, 1);

  const entries = Object.values(totals).sort((a, b) => {
    const currencyOrder = { zeny: 0, credit: 1, gold: 2 };
    const aIsCurrency = a.type in currencyOrder;
    const bIsCurrency = b.type in currencyOrder;

    if (aIsCurrency && bIsCurrency) {
      return currencyOrder[a.type] - currencyOrder[b.type];
    }
    if (aIsCurrency) return -1;
    if (bIsCurrency) return 1;

    if (a.amount !== b.amount) {
      return b.amount - a.amount;
    }

    return a.name.localeCompare(b.name);
  });

  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  let html = "";

  if (totalZeny > 0) {
    html += `
      <div class="summary-item summary-total-row">
        <span class="summary-name summary-total-label">Total Zeny Value</span>
        <span class="summary-amount summary-total-amount">${totalZeny.toLocaleString()}</span>
      </div>
    `;
  }

  html += entries
    .map((entry) => {
      const displayAmount =
        entry.type === "zeny" ? entry.amount.toLocaleString() : entry.amount;
      let extra = "";
      if (entry.type === "credit") {
        extra = ` <span class="text-muted-sm">(${(entry.amount * getCreditValue()).toLocaleString()} zeny)</span>`;
      } else if (entry.type === "gold") {
        extra = ` <span class="text-muted-sm">(${(entry.amount * getGoldValue()).toLocaleString()} zeny)</span>`;
      } else if (entry.type === "item" && entry.value > 0) {
        extra = ` <span class="text-muted-sm">(${(entry.amount * entry.value).toLocaleString()} zeny)</span>`;
      }
      return `
      <div class="summary-item">
        <span class="summary-name">${entry.name}</span>
        <span class="summary-amount">${displayAmount}${extra}</span>
      </div>
    `;
    })
    .join("");

  return html;
}

function switchSummaryTab(index) {
  document.querySelectorAll(".summary-tab").forEach((tab, idx) => {
    tab.classList.toggle("active", idx === index);
  });
  document.querySelectorAll(".summary-tab-content").forEach((content, idx) => {
    content.classList.toggle("active", idx === index);
  });
}

function buildQuestIndex() {
  const index = new Map();
  DATA.groups.forEach((group) => {
    group.subgroups.forEach((subgroup) => {
      subgroup.quests.forEach((quest) => {
        if (!index.has(quest.producesId)) {
          index.set(quest.producesId, []);
        }
        index.get(quest.producesId).push(quest);
      });
    });
  });
  return index;
}

// CRUD operations
function addGroup() {
  const group = {
    name: "New Group",
    subgroups: [],
  };
  DATA.groups.push(group);

  if (state.currentTab === "groups") {
    selectGroupForEdit(DATA.groups.length - 1);
  } else {
    state.expandedGroups.add(DATA.groups.length - 1);
  }

  render();
}

function deleteGroup(idx) {
  if (confirm("Delete this group and all its contents?")) {
    DATA.groups.splice(idx, 1);
    state.expandedGroups.delete(idx);
    if (state.selectedGroup === DATA.groups[idx]) {
      state.selectedQuest = null;
    }

    if (state.selectedGroupForEdit === idx) {
      state.selectedGroupForEdit = null;
    } else if (state.selectedGroupForEdit > idx) {
      state.selectedGroupForEdit--;
    }

    render();
  }
}

function updateGroupName(idx, value) {
  DATA.groups[idx].name = value;
  render();
}

function updateSubgroupName(groupIdx, subIdx, value) {
  DATA.groups[groupIdx].subgroups[subIdx].name = value;
  render();
}

function addSubgroup(groupIdx) {
  const subgroup = {
    name: "New Subgroup",
    quests: [],
  };
  DATA.groups[groupIdx].subgroups.push(subgroup);
  render();
}

function deleteSubgroup(groupIdx, subIdx) {
  if (confirm("Delete this subgroup and all its quests?")) {
    const subgroup = DATA.groups[groupIdx].subgroups[subIdx];
    if (state.selectedSubgroup === subgroup) {
      state.selectedQuest = null;
    }
    DATA.groups[groupIdx].subgroups.splice(subIdx, 1);
    state.expandedSubgroups.delete(`${groupIdx}-${subIdx}`);
    render();
  }
}

function addQuest(groupIdx, subIdx) {
  const quest = {
    name: "New Quest",
    producesId: null,
    successRate: 100,
    accountBound: false,
    requirements: [],
  };
  DATA.groups[groupIdx].subgroups[subIdx].quests.push(quest);
  selectQuest(
    DATA.groups[groupIdx],
    DATA.groups[groupIdx].subgroups[subIdx],
    quest,
  );
}

function updateQuestName(value) {
  state.selectedQuest.name = value;
  render();
}

function updateProducesId(itemId) {
  if (!state.selectedQuest) return;
  state.selectedQuest.producesId = itemId;

  // Auto-fill quest name with item display name (including slots)
  if (itemId && DATA.items[itemId]) {
    const item = DATA.items[itemId];
    state.selectedQuest.name =
      getItemDisplayName(item) || state.selectedQuest.name;
  }

  // Close the dropdown immediately
  const dropdown = document.getElementById("produces-dropdown");
  if (dropdown) dropdown.classList.remove("block");

  saveData();
  renderQuestContent(); // Re-render to show the selected item name
}

function updateProducesName(value) {
  if (
    state.selectedQuest.producesId !== null &&
    state.selectedQuest.producesId !== ""
  ) {
    ensureItem(state.selectedQuest.producesId, value);
  }
  render();
}

function updateSuccessRate(value) {
  state.selectedQuest.successRate = Math.max(
    1,
    Math.min(100, parseInt(value) || 100),
  );
  render();
}

function updateQuestAccountBound(checked) {
  state.selectedQuest.accountBound = checked;
  render();
}

function addRequirement() {
  state.selectedQuest.requirements.push({
    type: "item",
    id: null,
    amount: 1,
  });
  render();
}

function deleteRequirement(idx) {
  state.selectedQuest.requirements.splice(idx, 1);
  render();
}

function updateReqType(idx, value) {
  const req = state.selectedQuest.requirements[idx];
  req.type = value;
  if (value !== "item") {
    delete req.id;
  }
  // Keep immune only if it was already true
  if (!req.immune) {
    delete req.immune;
  }
  render();
}

function updateReqId(idx, value) {
  // If value is null (from clear button), id becomes null
  state.selectedQuest.requirements[idx].id = value ? parseInt(value) : null;
  render();
}

function updateReqItemName(idx, value) {
  const req = state.selectedQuest.requirements[idx];
  if (req.id !== null && req.id !== "") {
    ensureItem(req.id, value);
  }
}

function updateReqAmount(idx, value) {
  state.selectedQuest.requirements[idx].amount = parseFloat(value) || 0;
  render();
}

function updateReqImmune(idx, checked) {
  if (checked) {
    state.selectedQuest.requirements[idx].immune = true;
  } else {
    delete state.selectedQuest.requirements[idx].immune;
  }
  render();
}

function exportQuests() {
  // Clean up immune: false before export
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

function saveData() {
  // No-op: Items are always fetched fresh from remote during development
  // Quest data is not persisted (always from remote)
  // This function is kept for compatibility in case it's called elsewhere
  console.log("[Save] No caching - data always fresh from remote");
}

function setupProducesSearch(input) {
  const dropdown = document.getElementById("produces-dropdown");
  if (!dropdown) return;

  const query = input.value.toLowerCase().trim();
  dropdown.innerHTML = "";

  if (query.length < 2) {
    dropdown.classList.remove("block");
    return;
  }

  const matches = Object.entries(DATA.items)
    .map(([id, item]) => ({ ...item, id: parseInt(id) }))
    .filter(
      (i) =>
        (i.name && i.name.toLowerCase().includes(query)) ||
        (i.id && i.id.toString().includes(query)),
    )
    .slice(0, 10);

  if (matches.length > 0) {
    dropdown.classList.add("block");
    matches.forEach((match) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.innerHTML = `${getItemDisplayName(match) || "Unknown"} <span class="autocomplete-item-id">[${match.id}]</span>`;
      div.onclick = (e) => {
        e.stopPropagation(); // Prevent event bubbling
        updateProducesId(match.id);
      };
      dropdown.appendChild(div);
    });
  } else {
    dropdown.classList.remove("block");
  }
}

// Ensure the dropdown closes if you click elsewhere
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("produces-dropdown");
  if (dropdown && !e.target.closest(".search-container")) {
    dropdown.classList.remove("block");
  }
});

render();

/**
 * Debounce Utility: Prevents a function from being called too rapidly.
 */
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

// Optimized Search Handlers
const debouncedQuestFilter = debounce((value) => {
  state.questSearchFilter = value.toLowerCase();
  renderSidebar();
}, 250);

const debouncedItemFilter = debounce((value) => {
  state.itemSearchFilter = value.toLowerCase();
  renderItems();
}, 250);

// Attach event listeners after DOM is ready
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

function filterItems(value) {
  debouncedItemFilter(value);
}

function filterQuests(value) {
  debouncedQuestFilter(value);
}

function toggleEditorMode(enabled) {
  state.editorMode = enabled;

  if (enabled) {
    document.body.classList.remove("viewer-mode");
  } else {
    document.body.classList.add("viewer-mode");
    // Switch away from Groups tab if currently on it
    if (state.currentTab === "groups") {
      switchTab("quests");
    }
  }

  render();
}

function saveAutoloot() {
  localStorage.setItem("osro_autoloot_v1", JSON.stringify(state.autolootData));
  renderAutolootSidebar();
  renderAutolootMain();
}

function renderAutolootSidebar() {
  const container = document.getElementById("autolootList");
  if (!container) return;

  container.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const itemCount = state.autolootData[i] ? state.autolootData[i].length : 0;
    const isActive = state.selectedAutolootSlot === i;

    const div = document.createElement("div");
    div.className = `autoloot-slot-row ${isActive ? "active" : ""}`;
    div.onclick = () => {
      state.selectedAutolootSlot = i;
      renderAutolootSidebar();
      renderAutolootMain();
    };

    div.innerHTML = `
      <span style="font-weight: 500;">@alootid2 slot ${i}</span>
      <span class="slot-badge">${itemCount} items</span>
    `;
    container.appendChild(div);
  }
}

function renderAutolootMain() {
  const container = document.getElementById("mainContent");
  const slot = state.selectedAutolootSlot;
  const items = state.autolootData[slot] || [];

  // @alootid2 limits
  const MAX_ITEMS_PER_LINE = 10;
  const MAX_CHARS_PER_LINE = 100;
  const PREFIX = `@alootid2 save ${slot} `;

  let commandBlocks = [];
  let currentChunk = [];
  let currentLength = PREFIX.length;

  items.forEach((id) => {
    const idStr = id.toString();
    // Calculate length this ID would add (id + space)
    const addedLength = idStr.length + 1;

    // Check if adding this item would exceed limits
    if (
      currentChunk.length >= MAX_ITEMS_PER_LINE ||
      currentLength + addedLength > MAX_CHARS_PER_LINE
    ) {
      // Push current line and reset
      if (currentChunk.length > 0) {
        commandBlocks.push(`${PREFIX}${currentChunk.join(" ")}`);
      }
      currentChunk = [];
      currentLength = PREFIX.length;
    }

    // Add item to current buffer
    currentChunk.push(idStr);
    currentLength += addedLength;
  });

  // Push any remaining items
  if (currentChunk.length > 0) {
    commandBlocks.push(`${PREFIX}${currentChunk.join(" ")}`);
  }

  // If empty, show placeholder
  let commandHtml = "";
  if (commandBlocks.length === 0) {
    commandHtml = `<div style="color:var(--text-muted); font-style:italic;">Slot is empty. Add items below.</div>`;
  } else {
    commandBlocks.unshift(`@alootid2 reset ${slot}`);
    commandBlocks.push(`@alootid2 load ${slot}`);
    commandHtml = commandBlocks
      .map((cmd) => `<div class="al-code-block">${cmd}</div>`)
      .join("");
  }

  container.innerHTML = `
    <div class="autoloot-main">
      <h2 style="margin-bottom: 10px;">Autoloot Manager <span style="color:var(--text-muted); font-size:0.6em">Slot ${slot}</span></h2>
      <p style="color:var(--text-muted); margin-bottom: 20px; font-size: 0.9em;">
        Commands are automatically optimized to fit server line limits (max ${MAX_ITEMS_PER_LINE} items or ${MAX_CHARS_PER_LINE} chars).
      </p>

      <div class="al-command-box">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <h4 style="color:var(--accent); text-transform:uppercase; font-size:12px; letter-spacing:1px;">Generated Commands</h4>
          <button class="btn btn-sm" onclick="copyAllAutoloot()" style="font-size:11px;">Copy All</button>
        </div>
        ${commandHtml}
      </div>

      <div class="al-search-wrapper">
        <input type="text" 
          id="alSearchInput" 
          class="al-search-input" 
          placeholder="Search Item Name or ID to add..." 
          autocomplete="off"
          oninput="handleAutolootSearch(this.value)"
        >
        <div id="alSearchResults" class="al-search-dropdown hidden"></div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
        <h3 style="font-size:16px;">Stored Items (${items.length})</h3>
        ${items.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="clearAutolootSlot(${slot})">Clear Slot</button>` : ""}
      </div>

      <div class="al-items-grid">
        ${items
          .map((id) => {
            const itemDef = DATA.items[id];
            const name = itemDef ? itemDef.name : "Unknown Item";
            const nameStyle = name === "Unknown Item" ? " style=\"color:red;\"" : "";
            return `
            <div class="al-item-card">
              <div style="display:flex; align-items:center; overflow:hidden;">
                <span style="color:var(--accent); font-family:monospace; margin-right:8px;">${id}</span>
                <span title="${name}"${nameStyle}>${name}</span>
              </div>
              <div class="al-remove-btn" onclick="removeFromAutoloot(${slot}, ${id})">×</div>
            </div>
          `;
          })
          .join("")}
      </div>

      <div class="al-paste-wrapper">
        <label class="item-label">Paste @alootid2 commands</label>
        <textarea
          id="alootPasteBox"
          class="al-paste-textarea"
          placeholder="@alootid2 607 909 910"
        ></textarea>

        <div class="al-paste-actions">
          <button
            class="btn btn-primary btn-sm"
            onclick="importAlootCommands()"
          >
            Import
          </button>

          <span class="help-text">
            Space-separated item IDs only. Extra spacing is fine.
          </span>
        </div>
      </div>

    </div>


  `;
}

function handleAutolootSearch(query) {
  const resultsDiv = document.getElementById("alSearchResults");

  // 1. Basic validation
  if (!query || query.trim().length < 1) {
    resultsDiv.classList.add("hidden");
    return;
  }

  const lowerQ = query.toLowerCase();
  // 2. Use getAllItems() to get the clean array of items exactly like Editor Mode
  const allItems = getAllItems();

  let matches = [];

  // Check if input is a number (ID search)
  const queryNum = parseInt(query, 10);
  const isNumeric = !isNaN(queryNum) && queryNum.toString() === query.trim();

  if (isNumeric) {
    // Exact ID match first
    const exactMatch = allItems.find((item) => item.id === queryNum);
    if (exactMatch) matches.push(exactMatch);

    // Then partial ID matches
    const others = allItems
      .filter(
        (item) =>
          item.id !== queryNum &&
          (item.id.toString().includes(query) ||
            (item.name && item.name.toLowerCase().includes(lowerQ))),
      )
      .slice(0, 10);
    matches = matches.concat(others);
  } else {
    // Text search logic
    matches = allItems
      .filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(lowerQ)) ||
          item.id.toString().includes(lowerQ),
      )
      .sort((a, b) => {
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();

        // Prioritize exact name match
        if (aName === lowerQ && bName !== lowerQ) return -1;
        if (bName === lowerQ && aName !== lowerQ) return 1;

        // Prioritize "starts with"
        if (aName.startsWith(lowerQ) && !bName.startsWith(lowerQ)) return -1;
        if (bName.startsWith(lowerQ) && !aName.startsWith(lowerQ)) return 1;

        return a.id - b.id;
      })
      .slice(0, 15);
  }

  if (matches.length === 0) {
    resultsDiv.classList.add("hidden");
    return;
  }

  // 3. Render results using getItemDisplayName for consistent formatting (e.g. showing slots)
  resultsDiv.innerHTML = matches
    .map(
      (item) => `
    <div class="al-result-item" onclick="addToAutoloot(${state.selectedAutolootSlot}, ${item.id})">
      <span style="color:var(--accent); font-family:monospace; margin-right:8px; font-weight:bold;">${item.id}</span>
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${getItemDisplayName(item)}
      </div>
    </div>
  `,
    )
    .join("");

  resultsDiv.classList.remove("hidden");
}

// Helper to hide search when clicking outside
document.addEventListener("click", (e) => {
  const searchWrapper = document.querySelector(".al-search-wrapper");
  const resultsDiv = document.getElementById("alSearchResults");
  if (searchWrapper && resultsDiv && !searchWrapper.contains(e.target)) {
    resultsDiv.classList.add("hidden");
  }
});

function addToAutoloot(slot, id) {
  if (!state.autolootData[slot].includes(id)) {
    state.autolootData[slot].push(id);
    saveAutoloot();

    // Clear search box but keep focus
    const input = document.getElementById("alSearchInput");
    if (input) {
      input.value = "";
      input.focus();
    }
    document.getElementById("alSearchResults").classList.add("hidden");
  }
}

function removeFromAutoloot(slot, id) {
  state.autolootData[slot] = state.autolootData[slot].filter((x) => x !== id);
  saveAutoloot();
}

function clearAutolootSlot(slot) {
  if (confirm(`Clear all items from Slot ${slot}?`)) {
    state.autolootData[slot] = [];
    saveAutoloot();
  }
}

function copyAllAutoloot() {
  const blocks = document.querySelectorAll(".al-code-block");
  let text = "";
  blocks.forEach((b) => (text += b.textContent + "\n"));
  navigator.clipboard.writeText(text);
  alert("Commands copied to clipboard");
}

function importAlootCommands() {
  const textarea = document.getElementById("alootPasteBox");
  let text = textarea.value;

  if (!text.trim()) return;

  // We need to keep the line breaks for splitting, so don't replace \s+ globally yet
  const lines = text.split(/\r?\n/);
  const ids = new Set();
  const slot = state.selectedAutolootSlot;

  if (!slot) {
    alert("No autoloot slot selected.");
    return;
  }

  // List of commands that are followed by a slot number we should ignore
  const commandsWithSlots = ["save", "reset", "load", "clear", "add", "remove"];

  for (let line of lines) {
    line = line.trim();
    if (!line.toLowerCase().startsWith("@alootid2")) continue;

    // Split line into parts and remove the @alootid2 prefix
    const parts = line.split(/\s+/).slice(1);

    for (let i = 0; i < parts.length; i++) {
      const token = parts[i].toLowerCase();

      // If the token is a command (save, reset, load, etc.), 
      // skip the command AND the next part (the slot number)
      if (commandsWithSlots.includes(token)) {
        i++; // skip slot number
        continue;
      }

      // If it's purely a number and wasn't skipped above, it's an item ID
      if (/^\d+$/.test(token)) {
        ids.add(Number(token));
      }
    }
  }

  if (!ids.size) {
    alert("No valid @alootid2 item IDs found.");
    return;
  }

  // Add all found IDs to the current slot
  ids.forEach((id) => addToAutoloot(slot, id));

  textarea.value = "";
  renderAutolootSidebar();
  renderAutolootMain();
}
