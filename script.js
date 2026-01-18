let DATA = {
  items: {},
  groups: [],
};

let state = {
  currentTab: "quests",
  selectedQuest: null,
  selectedItem: null,
  selectedGroup: null,
  selectedSubgroup: null,
  expandedGroups: new Set(),
  expandedSubgroups: new Set(),
  draggedQuest: null,
  draggedFrom: null,
  itemSearchFilter: "",
  questSearchFilter: "",
};

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

function switchTab(tab) {
  state.currentTab = tab;
  if (tab === "items") {
    state.selectedQuest = null;
    state.itemSearchFilter = "";
    document.getElementById("itemSearchInput").value = "";
  } else {
    state.selectedItem = null;
    state.questSearchFilter = "";
    document.getElementById("questSearchInput").value = "";
  }
  render();
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
  // Update tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.textContent.toLowerCase() === state.currentTab) {
      tab.classList.add("active");
    }
  });

  const treeContainer = document.getElementById("treeContainer");
  const itemsList = document.getElementById("itemsList");
  const itemsSearch = document.getElementById("itemsSearch");
  const questsSearch = document.getElementById("questsSearch");
  const addBtn = document.getElementById("addBtn");

  if (state.currentTab === "quests") {
    treeContainer.classList.remove("hidden");
    itemsList.classList.add("hidden");
    itemsSearch.classList.add("hidden");
    questsSearch.classList.remove("hidden");

    // SHOW button for Quests
    addBtn.classList.remove("hidden");
    addBtn.textContent = "+ Group";
    addBtn.onclick = addGroup;

    renderSidebar();
    renderQuestContent();
  } else {
    treeContainer.classList.add("hidden");
    itemsList.classList.remove("hidden");
    itemsSearch.classList.remove("hidden");
    questsSearch.classList.add("hidden");

    // HIDE button for Items
    addBtn.classList.add("hidden");

    renderItems();
    renderItemContent();
  }
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
  const limit = 1000;
  const displayedItems = items.slice(0, limit);

  let html = "";

  // Display a count of used items vs search results
  if (totalFound > 0) {
    html += `<div class="items-search-banner">
               Showing ${displayedItems.length} of ${totalFound} items used in quests
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
        <p>Select an item from the sidebar to view details and edit its value</p>
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
    header.className = "group-header";
    header.innerHTML = `
      <span class="expand-icon ${isExpanded ? "expanded" : ""}" onclick="toggleGroup(${groupIdx})">▶</span>
      <input class="editable-name" value="${group.name}" onclick="event.stopPropagation()" onchange="updateGroupName(${groupIdx}, this.value)">
      <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteGroup(${groupIdx})">×</button>
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
        subHeader.className = "subgroup-header";
        subHeader.innerHTML = `
          <span class="expand-icon ${isSubExpanded ? "expanded" : ""}" onclick="toggleSubgroup(${groupIdx}, ${subIdx})">▶</span>
          <input class="editable-name" value="${subgroup.name}" onclick="event.stopPropagation()" onchange="updateSubgroupName(${groupIdx}, ${subIdx}, this.value)">
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSubgroup(${groupIdx}, ${subIdx})">×</button>
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
            questDiv.draggable = true;
            questDiv.innerHTML = `
              <span class="drag-handle">⋮⋮</span>
              <span class="quest-name">${quest.name}</span>
            `;

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

            questDiv.querySelector(".quest-name").onclick = () => {
              selectQuest(group, subgroup, quest);
              if (window.innerWidth <= 768) {
                toggleSidebar();
              }
            };

            subDiv.appendChild(questDiv);
          });

          // Only show 'Add Quest' button if not filtering
          if (!filter) {
            const addQuestBtn = document.createElement("button");
            addQuestBtn.className = "btn btn-sm btn-indent-quest";
            addQuestBtn.textContent = "+ Quest";
            addQuestBtn.onclick = () => addQuest(groupIdx, subIdx);
            subDiv.appendChild(addQuestBtn);
          }
        }

        groupDiv.appendChild(subDiv);
      });

      // Only show 'Add Subgroup' button if not filtering
      if (!filter) {
        const addSubBtn = document.createElement("button");
        addSubBtn.className = "btn btn-sm btn-indent-subgroup";
        addSubBtn.textContent = "+ Subgroup";
        addSubBtn.onclick = () => addSubgroup(groupIdx);
        groupDiv.appendChild(addSubBtn);
      }
    }

    container.appendChild(groupDiv);
  });
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
        <p>Select a quest from the sidebar or import your quest data</p>
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
      <span class="item-label">Requirements: &nbsp;<button class="btn btn-sm btn-primary" onclick="addRequirement()">+ Add</button></span>
      <div class="requirements-section">
        <div class="requirements-grid">
          ${quest.requirements.map((req, idx) => renderRequirement(req, idx)).join("")}
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

      <span class="item-label">Totals:</span>
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

  function walk(quest, depth, multiplier, questPath = new Set()) {
    // Prevent infinite loops
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath);
    newPath.add(quest);

    quest.requirements.forEach((req) => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      const indent = "  ".repeat(depth);
      const connector = depth > 0 ? "└─ " : "";
      const immuneBadge = req.immune
        ? ' <span class="text-immune">[IMMUNE]</span>'
        : "";

      if (req.type === "item" && questIndex.has(req.id)) {
        const item = getItem(req.id);
        const quests = questIndex.get(req.id);

        if (quests.length === 1) {
          // Single quest - show as normal
          lines.push({
            level: depth,
            text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
          });
          walk(quests[0], depth + 1, effectiveAmount, newPath);
        } else {
          // Multiple quests - show options
          lines.push({
            level: depth,
            text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge} <span class="text-warning-xs">[${quests.length} OPTIONS]</span>`,
          });

          quests.forEach((q, idx) => {
            const optionIndent = "  ".repeat(depth + 1);
            const optionNum = idx + 1;
            lines.push({
              level: depth + 1,
              text: `${optionIndent}<span class="text-muted">Option ${optionNum}: ${q.name} (${q.successRate}% success)</span>`,
            });
            walk(q, depth + 2, effectiveAmount, newPath);
          });
        }
      } else if (req.type === "zeny") {
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">Zeny</span> × <span class="tree-amount">${effectiveAmount.toLocaleString()}</span>${immuneBadge}`,
        });
      } else if (req.type === "credit") {
        const zenyValue = effectiveAmount * getCreditValue();
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`,
        });
      } else if (req.type === "gold") {
        const zenyValue = effectiveAmount * getGoldValue();
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`,
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
        });
      } else if (req.type === "item") {
        const item = getItem(req.id);
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item) || "Unknown"}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
        });
      }
    });
  }

  walk(state.selectedQuest, 0, 1);

  if (lines.length === 0) {
    return '<div class="tree-line">No requirements</div>';
  }

  return lines
    .map(
      (line) => `<div class="tree-line level-${line.level}">${line.text}</div>`,
    )
    .join("");
}

function renderSummary() {
  const questIndex = buildQuestIndex();

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
  state.expandedGroups.add(DATA.groups.length - 1);
  render();
}

function deleteGroup(idx) {
  if (confirm("Delete this group and all its contents?")) {
    DATA.groups.splice(idx, 1);
    state.expandedGroups.delete(idx);
    if (state.selectedGroup === DATA.groups[idx]) {
      state.selectedQuest = null;
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
  const subIdx = DATA.groups[groupIdx].subgroups.length - 1;
  state.expandedSubgroups.add(`${groupIdx}-${subIdx}`);
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
    immune: false,
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
  req.immune = req.immune || false;
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
  state.selectedQuest.requirements[idx].immune = checked;
  render();
}

function exportQuests() {
  const json = JSON.stringify({ groups: DATA.groups }, null, 2);
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

// Update the existing filter functions to be simple wrappers if needed elsewhere
function filterItems(value) {
  debouncedItemFilter(value);
}
function filterQuests(value) {
  debouncedQuestFilter(value);
}
