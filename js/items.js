// items.js - Item List and Detail Logic

function renderItemsCore() {
  const container = document.getElementById("itemsList");
  
  if (!container) {
    console.warn('[renderItems] Container element not found');
    return;
  }

  // 1. First, identify every item ID that is actually used in a quest
  const usedItemIds = new Set();
  
  // Safely iterate through groups
  if (Array.isArray(DATA.groups)) {
    DATA.groups.forEach((group) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach((subgroup) => {
        if (!subgroup || !Array.isArray(subgroup.quests)) return;
        
        subgroup.quests.forEach((quest) => {
          if (!quest) return;
          
          // Add the produced item
          if (quest.producesId) usedItemIds.add(Number(quest.producesId));

          // Add all required items
          if (Array.isArray(quest.requirements)) {
            quest.requirements.forEach((req) => {
              if (!req) return;
              
              if (req.type === "item" && req.id) {
                usedItemIds.add(Number(req.id));
              }
              if (req.type === "gold" && typeof SPECIAL_ITEMS !== 'undefined') {
                usedItemIds.add(SPECIAL_ITEMS.GOLD);
              }
              if (req.type === "credit" && typeof SPECIAL_ITEMS !== 'undefined') {
                usedItemIds.add(SPECIAL_ITEMS.CREDIT);
              }
            });
          }
        });
      });
    });
  }

  // 1b. Add items from autoloot lists
  if (state.autolootData) {
    Object.values(state.autolootData).forEach((autolootList) => {
      if (Array.isArray(autolootList)) {
        autolootList.forEach((itemId) => {
          usedItemIds.add(Number(itemId));
        });
      }
    });
  }

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

  // 4. Apply values filter if active
  if (state.showValuesOnly) {
    items = items.filter((item) => (item.value || 0) > 0);
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
      ${renderItemIcon(item.id)}
      <span style="margin-left: 8px;">${getItemDisplayName(item) || "&lt;unnamed&gt;"}</span>
      <span class="item-row-id">#${item.id}</span>
    </div>
  </div>
`,
  )
  .join("");
  }

  container.innerHTML = html;
}

function selectItem(id, pushToHistory = true) {
  state.selectedItemId = id;
  
  // Update URL with item ID for sharing and browser history
  if (id && typeof updateURL === 'function') {
    updateURL(id.toString(), 'item', pushToHistory);
  }
  
  renderItems();
  renderItemContent();
  if (window.innerWidth <= 768) toggleSidebar();
}

// Select an item by ID (for URL navigation)
function selectItemById(itemId, pushToHistory = true) {
  const id = parseInt(itemId);
  if (DATA.items[id]) {
    selectItem(id, pushToHistory);
    
    // Scroll to item in sidebar after a short delay
    setTimeout(() => {
      const itemElement = document.querySelector('.item-row.active');
      if (itemElement) {
        itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
}

function renderItemContentCore() {
  const container = document.getElementById("mainContent");
  
  if (!container) {
    console.warn('[renderItemContent] Container element not found');
    return;
  }

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
      <div class="quest-header-actions">
        <button class="btn btn-sm copy-link-btn" onclick="copyItemLink()" title="Copy link to this item">
          🔗 Copy Link
        </button>
      </div>
      <div class="item-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${renderItemIcon(id, 48)}
          <h2 style="margin: 0;">
            ${getItemDisplayName(item)}
            <span class="item-id-badge">#${id}</span>
          </h2>
        </div>
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
    // Mark that user has edited values (prevents race condition with remote fetch)
    if (window.initState) {
      window.initState.userHasEditedValues = true;
    }
    
    DATA.items[id].value = Number(value) || 0;
    saveItemValuesToStorage();
  }
}

function findQuestsByItemId(itemId) {
  const results = { produces: [], requires: [] };
  
  if (!Array.isArray(DATA.groups)) {
    console.warn('[findQuestsByItemId] DATA.groups is not an array');
    return results;
  }
  
  DATA.groups.forEach((group, gi) => {
    if (!group || !Array.isArray(group.subgroups)) return;
    
    group.subgroups.forEach((subgroup, si) => {
      if (!subgroup || !Array.isArray(subgroup.quests)) return;
      
      subgroup.quests.forEach((quest, qi) => {
        if (!quest) return;
        
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
        if (Array.isArray(quest.requirements)) {
          const matchingReq = quest.requirements.find((r) => {
            if (!r) return false;
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
        }
      });
    });
  });
  return results;
}

// items.js - Navigation Logic Fix

function navigateToItem(itemId) {
  const id = parseInt(itemId);

  // 1. Switch to items tab if not already there.
  // We pass 'false' to suppress the default URL update (e.g., ?tab=items),
  // because we are about to set a more specific URL (e.g., ?item=123).
  if (state.currentTab !== "items") {
    switchTab("items", false);
  }

  // 2. Use the robust selection functions
  // If the item exists in our data, use selectItemById (handles scrolling & URL).
  // If not, use selectItem directly to show the "Item Not Found" state with the ID.
  if (DATA.items[id]) {
    selectItemById(id);
  } else {
    selectItem(id);
  }
}

// ===== ERROR-WRAPPED RENDER FUNCTIONS =====

// Wrap render functions with error boundaries and data validation
window.renderItems = withErrorBoundary(
  withDataValidation(renderItemsCore, 'renderItems', ['DATA.items', 'DATA.groups']),
  'renderItems'
);

window.renderItemContent = withErrorBoundary(
  withDataValidation(renderItemContentCore, 'renderItemContent', ['DATA.items']),
  'renderItemContent'
);

// ===== EXPOSE FUNCTIONS CALLED FROM HTML =====

// These functions are called from inline HTML event handlers (onclick, onchange)
// and must be globally accessible on the window object
window.selectItem = selectItem;
window.selectItemById = selectItemById;
window.updateItemValue = updateItemValue;
window.navigateToItem = navigateToItem;