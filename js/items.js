// items.js - Item List and Detail Logic

// Search indices
let SEARCH_INDEX_NAME = {};
let SEARCH_INDEX_DESC = {};

// Debounced save for item values
let saveValueTimeout = null;

function debouncedSaveItemValues() {
  clearTimeout(saveValueTimeout);
  saveValueTimeout = setTimeout(() => {
    saveItemValuesToStorage();
  }, 500);
}

function renderItemsCore() {
  const container = document.getElementById("itemsList");
  
  if (!container) {
    console.warn('[renderItems] Container element not found');
    return;
  }

  // 1. Identify used items
  const usedItemIds = new Set();
  
  if (Array.isArray(DATA.groups)) {
    DATA.groups.forEach((group) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach((subgroup) => {
        if (!subgroup || !Array.isArray(subgroup.quests)) return;
        
        subgroup.quests.forEach((quest) => {
          if (!quest) return;
          
          if (quest.producesId) usedItemIds.add(Number(quest.producesId));

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

  // 1b. Add autoloot items
  if (state.autolootData) {
    Object.values(state.autolootData).forEach((autolootList) => {
      if (Array.isArray(autolootList)) {
        autolootList.forEach((itemId) => {
          usedItemIds.add(Number(itemId));
        });
      }
    });
  }

  // 2. Filter items
  let items = state.showAllItems 
    ? getAllItems() 
    : getAllItems().filter((item) => usedItemIds.has(item.id));

  if (state.itemSearchFilter) {
    const q = state.itemSearchFilter.trim();
    
    // Check if searching by ID
    if (/^\d+$/.test(q)) {
      items = items.filter(item => 
        item.id.toString().includes(q)
      );
    } else {
      // Parse quoted phrases and individual words
      const phrases = [];
      const words = [];
      
      let remaining = q.replace(/"([^"]+)"/g, (match, phrase) => {
        phrases.push(phrase.toLowerCase());
        return '';
      });
      
      remaining.split(/\s+/).forEach(word => {
        if (word.length > 0) words.push(word.toLowerCase());
      });
      
      const allTerms = [...phrases, ...words];
      
      // Build sets of matching IDs for each term (do this ONCE, not per item)
      const termMatchSets = allTerms.map(term => {
        const matchingIds = new Set();
        
        Object.keys(SEARCH_INDEX_NAME).forEach(indexTerm => {
          if (indexTerm.includes(term)) {
            SEARCH_INDEX_NAME[indexTerm].forEach(id => matchingIds.add(id));
          }
        });
        
        if (state.searchDescriptions) {
          Object.keys(SEARCH_INDEX_DESC).forEach(indexTerm => {
            if (indexTerm.includes(term)) {
              SEARCH_INDEX_DESC[indexTerm].forEach(id => matchingIds.add(id));
            }
          });
        }
        
        return matchingIds;
      });
      
      // Filter items: must be in ALL term match sets (AND logic)
      items = items.filter(item => 
        termMatchSets.every(matchSet => matchSet.has(item.id))
      );
    }
  }

  if (state.showValuesOnly) {
    items = items.filter((item) => (item.value || 0) > 0);
  }

  const totalFound = items.length;
  const limit = 2000; // Increased from 1500
  const displayedItems = items.slice(0, limit);

  let html = "";

  if (totalFound > 0) {
    html += `<div class="items-search-banner">
               ${displayedItems.length}${totalFound > limit ? `/${totalFound}` : ''} items
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
    
    if (totalFound > limit) {
      html += `<div class="items-limit-msg">Showing first ${limit} of ${totalFound} items. Use search to narrow results.</div>`;
    }
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

function highlightSearchTerm(text, searchQuery) {
  if (!searchQuery || !text) return text;
  
  // Parse search query into terms
  const phrases = [];
  const words = [];
  
  let remaining = searchQuery.replace(/"([^"]+)"/g, (match, phrase) => {
    phrases.push(phrase);
    return '';
  });
  
  remaining.split(/\s+/).forEach(word => {
    if (word.length > 0) words.push(word);
  });
  
  const allTerms = [...phrases, ...words];
  
  // Highlight each term
  let result = text;
  allTerms.forEach(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    result = result.replace(regex, '<span class="search-highlight">$1</span>');
  });
  
  return result;
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
            ${state.itemSearchFilter 
              ? highlightSearchTerm(getItemDisplayName(item), state.itemSearchFilter)
              : getItemDisplayName(item)}
            <span class="item-id-badge">#${id}</span>
          </h2>
        </div>
      </div>

      <div class="panel-section">
        ${
          descriptionHtml
            ? `
          <span class="item-label">Description:</span>
          <div class="item-description-box">${
            state.itemSearchFilter && state.searchDescriptions
              ? highlightSearchTerm(descriptionHtml, state.itemSearchFilter)
              : descriptionHtml
          }</div>`
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
    if (window.initState) {
      window.initState.userHasEditedValues = true;
    }
    
    DATA.items[id].value = Number(value) || 0;
    debouncedSaveItemValues(); // Changed from immediate save
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

window.SEARCH_INDEX_NAME = SEARCH_INDEX_NAME;
window.SEARCH_INDEX_DESC = SEARCH_INDEX_DESC;