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
  
  // 1a. Add items from Quests
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

  // 1b. Add items from Shops
  if (Array.isArray(DATA.shopGroups)) {
    DATA.shopGroups.forEach((group) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach((subgroup) => {
        if (!subgroup || !Array.isArray(subgroup.shops)) return;
        
        subgroup.shops.forEach((shop) => {
          if (!shop) return;
          
          if (shop.producesId) usedItemIds.add(Number(shop.producesId));

          if (Array.isArray(shop.requirements)) {
            shop.requirements.forEach((req) => {
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

  // 1c. Add autoloot items
  if (state.autolootData) {
    Object.values(state.autolootData).forEach((autolootList) => {
      if (Array.isArray(autolootList)) {
        autolootList.forEach((itemId) => {
          usedItemIds.add(Number(itemId));
        });
      }
    });
  }

  // 1d. Add NEW items (treat them as "used" so they appear in the main list)
  if (DATA.newItemIds) {
    DATA.newItemIds.forEach((id) => {
      usedItemIds.add(Number(id));
    });
  }

  // 2. Filter items
  // If showAllItems is true, show everything.
  // Otherwise, only show items that are in the usedItemIds whitelist.
  let items = state.showAllItems 
    ? getAllItems() 
    : getAllItems().filter((item) => usedItemIds.has(item.id));

  // Apply value filter
  if (state.showValuesOnly) {
    items = items.filter((item) => (item.value || 0) > 0);
  }

  // Apply "New Only" filter
  // If checked, we restrict the list to ONLY new items.
  if (state.showNewItemsOnly) {
    items = items.filter((item) => DATA.newItemIds.has(item.id));
  }

  // 3. Apply Search
  if (state.itemSearchFilter) {
    const q = state.itemSearchFilter.trim();
    
    // Helper function to strip color codes (^RRGGBB format)
    const stripColorCodes = (text) => {
      if (!text) return '';
      return text.replace(/\^[0-9A-Fa-f]{6}/g, '');
    };
    
    if (/^\d+$/.test(q)) {
      items = items.filter(item => 
        item.id.toString().includes(q)
      );
    } else {
      const includePhrases = [];
      const includeWords = [];
      const excludePhrases = [];
      const excludeWords = [];
      
      // Extract quoted phrases (both include and exclude)
      let remaining = q.replace(/-?"([^"]+)"/g, (match, phrase) => {
        if (match.startsWith('-')) {
          excludePhrases.push(phrase.toLowerCase());
        } else {
          includePhrases.push(phrase.toLowerCase());
        }
        return '';
      });
      
      // Process remaining words
      remaining.split(/\s+/).forEach(word => {
        if (word.length > 0) {
          if (word.startsWith('-') && word.length > 1) {
            excludeWords.push(word.substring(1).toLowerCase());
          } else if (!word.startsWith('-')) {
            includeWords.push(word.toLowerCase());
          }
        }
      });
      
      // For regular words, use index matching
      const includeMatchSets = includeWords.map(word => {
        const matchingIds = new Set();
        // Strip punctuation from word for index lookup
        const cleanWord = word.replace(/[^\w]/g, '');
        
        Object.keys(SEARCH_INDEX_NAME).forEach(indexTerm => {
          if (indexTerm.includes(cleanWord)) {
            SEARCH_INDEX_NAME[indexTerm].forEach(id => matchingIds.add(id));
          }
        });
        
        if (state.searchDescriptions) {
          Object.keys(SEARCH_INDEX_DESC).forEach(indexTerm => {
            if (indexTerm.includes(cleanWord)) {
              SEARCH_INDEX_DESC[indexTerm].forEach(id => matchingIds.add(id));
            }
          });
        }
        
        return matchingIds;
      });
      
      // For phrases, get candidates using all words, then verify exact phrase
      const includePhraseMatchSets = includePhrases.map(phrase => {
        const matchingIds = new Set();
        const phraseWords = phrase.split(/\s+/);
        
        // Get candidates that contain all words
        const wordSets = phraseWords.map(word => {
          const wordIds = new Set();
          // Strip punctuation from word for index lookup
          const cleanWord = word.replace(/[^\w]/g, '');
          
          Object.keys(SEARCH_INDEX_NAME).forEach(indexTerm => {
            if (indexTerm.includes(cleanWord)) {
              SEARCH_INDEX_NAME[indexTerm].forEach(id => wordIds.add(id));
            }
          });
          
          if (state.searchDescriptions) {
            Object.keys(SEARCH_INDEX_DESC).forEach(indexTerm => {
              if (indexTerm.includes(cleanWord)) {
                SEARCH_INDEX_DESC[indexTerm].forEach(id => wordIds.add(id));
              }
            });
          }
          
          return wordIds;
        });
        
        // Get items that have all words (candidates)
        const candidates = Array.from(wordSets[0] || []).filter(id =>
          wordSets.every(set => set.has(id))
        );
        
        // Verify exact phrase in name or description
        candidates.forEach(id => {
          const item = DATA.items[id];
          if (!item) return;
          
          const itemName = stripColorCodes(item.name || '').toLowerCase();
          const itemDesc = stripColorCodes(item.desc || '').toLowerCase();
          const nameMatch = itemName.includes(phrase);
          const descMatch = state.searchDescriptions && itemDesc.includes(phrase);
          
          if (nameMatch || descMatch) {
            matchingIds.add(id);
          }
        });
        
        return matchingIds;
      });
      
      const allIncludeMatchSets = [...includeMatchSets, ...includePhraseMatchSets];
      
      // For exclude terms, also handle phrases and words separately
      const excludeIds = new Set();
      
      // Exclude words
      excludeWords.forEach(word => {
        // Strip punctuation from word for index lookup
        const cleanWord = word.replace(/[^\w]/g, '');
        
        Object.keys(SEARCH_INDEX_NAME).forEach(indexTerm => {
          if (indexTerm.includes(cleanWord)) {
            SEARCH_INDEX_NAME[indexTerm].forEach(id => excludeIds.add(id));
          }
        });
        
        if (state.searchDescriptions) {
          Object.keys(SEARCH_INDEX_DESC).forEach(indexTerm => {
            if (indexTerm.includes(cleanWord)) {
              SEARCH_INDEX_DESC[indexTerm].forEach(id => excludeIds.add(id));
            }
          });
        }
      });
      
      // Exclude phrases (exact match)
      excludePhrases.forEach(phrase => {
        const phraseWords = phrase.split(/\s+/);
        
        // Get candidates
        const wordSets = phraseWords.map(word => {
          const wordIds = new Set();
          // Strip punctuation from word for index lookup
          const cleanWord = word.replace(/[^\w]/g, '');
          
          Object.keys(SEARCH_INDEX_NAME).forEach(indexTerm => {
            if (indexTerm.includes(cleanWord)) {
              SEARCH_INDEX_NAME[indexTerm].forEach(id => wordIds.add(id));
            }
          });
          
          if (state.searchDescriptions) {
            Object.keys(SEARCH_INDEX_DESC).forEach(indexTerm => {
              if (indexTerm.includes(cleanWord)) {
                SEARCH_INDEX_DESC[indexTerm].forEach(id => wordIds.add(id));
              }
            });
          }
          
          return wordIds;
        });
        
        const candidates = Array.from(wordSets[0] || []).filter(id =>
          wordSets.every(set => set.has(id))
        );
        
        // Verify exact phrase
        candidates.forEach(id => {
          const item = DATA.items[id];
          if (!item) return;
          
          const itemName = stripColorCodes(item.name || '').toLowerCase();
          const itemDesc = stripColorCodes(item.desc || '').toLowerCase();
          const nameMatch = itemName.includes(phrase);
          const descMatch = state.searchDescriptions && itemDesc.includes(phrase);
          
          if (nameMatch || descMatch) {
            excludeIds.add(id);
          }
        });
      });
      
      // Filter: must match all include terms AND match no exclude terms
      items = items.filter(item => {
        const matchesAllIncludes = allIncludeMatchSets.length === 0 || 
          allIncludeMatchSets.every(matchSet => matchSet.has(item.id));
        const matchesNoExcludes = !excludeIds.has(item.id);
        return matchesAllIncludes && matchesNoExcludes;
      });
    }
  }

  // 4. Render
  const totalFound = items.length;
  const limit = 2000;
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
          ${DATA.newItemIds.has(item.id) ? '<span class="new-item-badge">NEW</span>' : ''}
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
  
  // Helper to strip color codes
  const stripColorCodes = (str) => str.replace(/\^[0-9A-Fa-f]{6}/g, '');
  
  // Parse search query into terms (excluding exclusion terms)
  const phrases = [];
  const words = [];
  
  // Extract quoted phrases (but not those prefixed with -)
  let remaining = searchQuery.replace(/-?"([^"]+)"/g, (match, phrase) => {
    if (!match.startsWith('-')) {
      phrases.push(phrase);
    }
    return '';
  });
  
  // Extract words (but not those prefixed with -)
  remaining.split(/\s+/).forEach(word => {
    if (word.length > 0 && !word.startsWith('-')) {
      words.push(word);
    }
  });
  
  let result = text;
  
  // Highlight full phrases first (so they take precedence over individual words)
  // Create regex that allows color codes between characters
  phrases.forEach(phrase => {
    // Build a pattern that allows ^RRGGBB color codes between any characters
    const chars = phrase.split('');
    const pattern = chars
      .map(char => {
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped;
      })
      .join('(\\^[0-9A-Fa-f]{6})*'); // Allow color codes between chars
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    result = result.replace(regex, '<span class="search-highlight">$1</span>');
  });
  
  // Then highlight individual words (also allowing color codes within)
  words.forEach(word => {
    const chars = word.split('');
    const pattern = chars
      .map(char => {
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped;
      })
      .join('(\\^[0-9A-Fa-f]{6})*');
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    result = result.replace(regex, '<span class="search-highlight">$1</span>');
  });
  
  return result;
}

function renderItemViewerHeader(id, item) {
  const icon48  = renderItemIcon(id, 48);
  const slot    = item && Number(item.slot) > 0 ? `<span class="qvh-item-slots">[${item.slot}]</span>` : '';
  const itemId  = `<span class="qvh-id">#${id}</span>`;
  const displayName = state.itemSearchFilter
    ? highlightSearchTerm(getItemDisplayName(item), state.itemSearchFilter)
    : (getItemDisplayName(item) || 'Unknown');
  const name = `<span class="qvh-item-name">${displayName}</span>`;

  const isNew    = DATA.newItemIds && DATA.newItemIds.has(id);
  const newBadge = isNew ? `<span class="qvh-rate qvh-rate--full">NEW</span>` : '';
  const valBadge = item.value > 0
    ? `<span class="qvh-bound">${formatZenyCompact(item.value)} zeny</span>`
    : '';
  const meta = (newBadge || valBadge)
    ? `<div class="qvh-meta">${newBadge}${valBadge}</div>`
    : '';

  return `
    <div class="qvh">
      <div class="qvh-icon">${icon48}</div>
      <div class="qvh-body">
        <div class="qvh-title-row">${name}${slot}${itemId}</div>
        ${meta}
      </div>
    </div>
  `;
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

      ${renderItemViewerHeader(id, item)}

      <div class="panel-section">
        ${descriptionHtml ? `
          <span class="item-label">Description:</span>
          <div class="item-description-box">${
            state.itemSearchFilter && state.searchDescriptions
              ? highlightSearchTerm(descriptionHtml, state.itemSearchFilter)
              : descriptionHtml
          }</div>` : ""}
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
        </div>
      </div>

      ${usage.produces.length > 0 || usage.requires.length > 0 ? `
        <div class="usage-section">
          ${usage.produces.length > 0 ? `
            <h3>Produced By:</h3>
            <ul class="usage-list">
              ${usage.produces.map(u => {
                if (u.type === 'quest') {
                  return `
                    <li>
                      <span class="quest-badge">Quest</span>
                      <a class="quest-link" onclick="navigateToQuest(${u.groupIdx},${u.subIdx},${u.questIdx})">${u.quest.name}</a>
                      <span class="quest-path-info">${u.group.name} / ${u.subgroup.name}</span>
                    </li>`;
                } else if (u.type === 'shop') {
                  return `
                    <li>
                      <span class="shop-badge">Shop</span>
                      <a class="quest-link" onclick="navigateToShop(${u.groupIdx},${u.subIdx},${u.shopIdx})">${u.shop.name}</a>
                      <span class="quest-path-info">${u.group.name} / ${u.subgroup.name}</span>
                    </li>`;
                }
              }).join("")}
            </ul>` : ""}

          ${usage.requires.length > 0 ? `
            <h3>Required By:</h3>
            <ul class="usage-list">
              ${usage.requires.map(u => {
                const amountText = u.requirement?.amount
                  ? `<span class="quest-meta-info">×${u.requirement.amount}</span>`
                  : '';
                if (u.type === 'quest') {
                  return `
                    <li>
                      <span class="quest-badge">Quest</span>
                      <a class="quest-link" onclick="navigateToQuest(${u.groupIdx},${u.subIdx},${u.questIdx})">${u.quest.name}</a>
                      <span class="quest-path-info">${u.group.name} / ${u.subgroup.name}</span>
                      ${amountText}
                    </li>`;
                } else if (u.type === 'shop') {
                  return `
                    <li>
                      <span class="shop-badge">Shop</span>
                      <a class="quest-link" onclick="navigateToShop(${u.groupIdx},${u.subIdx},${u.shopIdx})">${u.shop.name}</a>
                      <span class="quest-path-info">${u.group.name} / ${u.subgroup.name}</span>
                      ${amountText}
                    </li>`;
                }
              }).join("")}
            </ul>` : ""}
        </div>
      ` : `
        <div class="usage-section">
          <p class="empty-msg-centered">This item is not used in any quests or shops.</p>
        </div>
      `}

      <div class="quest-footer-actions">
        <button class="btn btn-sm copy-link-btn" onclick="copyItemLink()" title="Copy link to this item">
          🔗 Copy Link
        </button>
      </div>
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
  const produces = [];
  const requires = [];

  // Search in Quests
  if (Array.isArray(DATA.groups)) {
    DATA.groups.forEach((group, groupIdx) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach((subgroup, subIdx) => {
        if (!subgroup || !Array.isArray(subgroup.quests)) return;
        
        subgroup.quests.forEach((quest, questIdx) => {
          if (!quest) return;
          
          if (quest.producesId === itemId) {
            produces.push({
              type: 'quest',
              quest,
              group,
              subgroup,
              groupIdx,
              subIdx,
              questIdx
            });
          }

          if (Array.isArray(quest.requirements)) {
            quest.requirements.forEach((req) => {
              const reqId = req.type === "item" ? req.id : 
                           req.type === "gold" ? SPECIAL_ITEMS?.GOLD :
                           req.type === "credit" ? SPECIAL_ITEMS?.CREDIT : null;
              
              if (reqId === itemId) {
                requires.push({
                  type: 'quest',
                  quest,
                  group,
                  subgroup,
                  groupIdx,
                  subIdx,
                  questIdx,
                  requirement: req
                });
              }
            });
          }
        });
      });
    });
  }

  // Search in Shops
  if (Array.isArray(DATA.shopGroups)) {
    DATA.shopGroups.forEach((group, groupIdx) => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach((subgroup, subIdx) => {
        if (!subgroup || !Array.isArray(subgroup.shops)) return;
        
        subgroup.shops.forEach((shop, shopIdx) => {
          if (!shop) return;
          
          if (shop.producesId === itemId) {
            produces.push({
              type: 'shop',
              shop,
              group,
              subgroup,
              groupIdx,
              subIdx,
              shopIdx
            });
          }

          if (Array.isArray(shop.requirements)) {
            shop.requirements.forEach((req) => {
              const reqId = req.type === "item" ? req.id : 
                           req.type === "gold" ? SPECIAL_ITEMS?.GOLD :
                           req.type === "credit" ? SPECIAL_ITEMS?.CREDIT : null;
              
              if (reqId === itemId) {
                requires.push({
                  type: 'shop',
                  shop,
                  group,
                  subgroup,
                  groupIdx,
                  subIdx,
                  shopIdx,
                  requirement: req
                });
              }
            });
          }
        });
      });
    });
  }

  return { produces, requires };
}

function toggleNewItemsFilter(checked) {
  state.showNewItemsOnly = checked;
  renderItems();
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
window.toggleNewItemsFilter = toggleNewItemsFilter;

window.SEARCH_INDEX_NAME = SEARCH_INDEX_NAME;
window.SEARCH_INDEX_DESC = SEARCH_INDEX_DESC;