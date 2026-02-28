// autoloot.js - Autoloot Generator Logic

// ===== CONSTANTS =====

const AUTOLOOT_CONFIG = {
  MAX_ITEMS_PER_LINE: 25, // Just an upper bound, specific limits handled in generateCommands
  MAX_CHARS_PER_LINE: 255, 
  MAX_SLOTS: 10,
  MAX_ITEMS_PER_SLOT: 100,
  COMMANDS_WITH_SLOTS: ["save", "reset", "load", "clear", "add", "remove"]
};

// ===== STORAGE =====

function saveAutoloot() {
  localStorage.setItem("osro_autoloot_v1", JSON.stringify(state.autolootData));
  localStorage.setItem("osro_autoloot_names_v1", JSON.stringify(state.autolootNames));
  renderAutolootSidebar();
  renderAutolootMain();
}

// ===== SIDEBAR RENDERING =====

function renderAutolootSidebar() {
  const container = document.getElementById("autolootList");
  if (!container) return;

  container.innerHTML = Array.from({ length: AUTOLOOT_CONFIG.MAX_SLOTS }, (_, i) => 
    createSlotElement(i + 1)
  ).join("");
}

function createSlotElement(slotNum) {
  const itemCount = state.autolootData[slotNum]?.length || 0;
  const isActive = state.selectedAutolootSlot === slotNum;
  const slotName = state.autolootNames[slotNum] || `Autoloot Slot ${slotNum}`;

  return `
    <div class="autoloot-slot-row ${isActive ? "active" : ""}" 
         onclick="selectAutolootSlot(${slotNum})">
      <div class="autoloot-slot-row-inner">
        <span class="autoloot-slot-row-number">${slotNum}</span>
        <div class="autoloot-slot-row-name-container">
          <div class="autoloot-slot-row-name" title="${slotName}">
            ${slotName}
          </div>
          <div class="autoloot-slot-row-itemcount">
            ${itemCount} item${itemCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function selectAutolootSlot(slotNum, pushToHistory = true) {
  state.selectedAutolootSlot = slotNum;
  
  // Update URL with autoloot slot for sharing and browser history
  if (slotNum && typeof updateURL === 'function') {
    updateURL(slotNum.toString(), 'autoloot', pushToHistory);
  }
  
  renderAutolootSidebar();
  renderAutolootMain();
  if (window.innerWidth <= 768) toggleSidebar();
}

// ===== MAIN CONTENT RENDERING =====

function renderAutolootMain() {
  const container = document.getElementById("mainContent");
  const slot = state.selectedAutolootSlot;
  const items = state.autolootData[slot] || [];

  container.innerHTML = `
    <div class="autoloot-main">
      ${renderHeader(slot, items)}
      ${renderItemsSection(slot, items)}
      ${renderSearchBox()}
      ${renderCommandBox(slot, items)}
      ${renderImportSection()}
      <div class="quest-footer-actions">
        <button class="btn btn-sm copy-link-btn" onclick="copyAutolootLink()" title="Copy link to this autoloot slot">
          🔗 Copy Link
        </button>
      </div>
    </div>
  `;
}

function renderHeader(slot, items) {
  const slotName = state.autolootNames[slot] || `Autoloot Slot ${slot}`;
  const used = items.length;
  const max  = AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT;
  const pct  = max > 0 ? Math.round((used / max) * 100) : 0;
  const fillClass = used >= max ? 'al-capacity-fill--full'
                  : used >= max * 0.8 ? 'al-capacity-fill--warn' : '';

  return `
    <div class="qvh qvh--autoloot">
      <div class="qvh-body">
        <div class="qvh-title-row">
          <span class="qvh-item-name">Autoloot</span>
          <span class="qvh-id">Slot #${slot}</span>
        </div>
        <div class="qvh-meta">
          <input
            type="text"
            id="slotNameInput"
            class="al-slot-name-input"
            placeholder="Name this slot…"
            value="${slotName}"
            onchange="updateSlotName(${slot}, this.value)"
          >
        </div>
        <div class="al-capacity">
          <div class="al-capacity-bar">
            <div class="al-capacity-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <span class="al-capacity-label">${used} / ${max}</span>
        </div>
      </div>
    </div>
  `;
}

function renderCommandBox(slot, items) {
  const commands = generateCommands(slot, items);
  const commandHtml = commands.length === 0
    ? '<div class="al-empty-hint">Add items above to generate commands.</div>'
    : commands.map(cmd => `<div class="al-code-block">${cmd}</div>`).join("");

  return `
    <div class="al-section">
      <div class="al-section-header">
        <span class="item-label">Generated Commands</span>
        ${commands.length > 0 ? `<button class="btn btn-sm" onclick="copyAllAutoloot()">Copy All</button>` : ''}
      </div>
      <div class="al-command-box">
        ${commandHtml}
      </div>
      <p class="al-overflow-hint">Commands are split to prevent client overflow — bursts first, then throttled.</p>
    </div>
  `;
}

function renderSearchBox() {
  return `
    <div class="al-section">
      <div class="al-section-header">
        <span class="item-label">Add Item</span>
      </div>
      <div class="al-search-wrapper">
        <div class="al-search-icon">🔍</div>
        <input type="text"
          id="alSearchInput"
          class="al-search-input"
          placeholder="Search by name or ID…"
          autocomplete="off"
          oninput="handleAutolootSearch(this.value)">
        <div id="alSearchResults" class="al-search-dropdown hidden"></div>
      </div>
    </div>
  `;
}

function renderItemsSection(slot, items) {
  const gridOrEmpty = items.length > 0
    ? `<div class="al-items-grid">${items.map(id => renderItemCard(slot, id)).join("")}</div>`
    : `<div class="al-empty-state">
         <div class="al-empty-icon">☁</div>
         <div class="al-empty-title">Slot is empty</div>
         <div class="al-empty-hint">Use the search below to add items to this slot.</div>
       </div>`;

  return `
    <div class="al-section">
      <div class="al-section-header">
        <span class="item-label">Stored Items</span>
        ${items.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="clearAutolootSlot(${slot})">Clear All</button>` : ''}
      </div>
      ${gridOrEmpty}
    </div>
  `;
}

function renderItemCard(slot, id) {
  const item = DATA.items[id];
  const name = item?.name || "Unknown Item";
  const isUnknown = !item;
  const slotCount = Number(item?.slot) || 0;
  const displayName = slotCount > 0 ? `${name} [${slotCount}]` : name;
  const nameHtml = isUnknown
    ? `<span class="al-item-name al-item-name--unknown" title="${displayName}">${displayName}</span>`
    : `<a class="item-link al-item-name" onclick="navigateToItem(${id})" title="${displayName}">${displayName}</a>`;

  return `
    <div class="al-item-card">
      <div class="al-item-card-left">
        ${renderItemIcon(id, 24)}
        ${nameHtml}
      </div>
      <div class="al-item-card-right">
        <span class="al-item-id">${id}</span>
        <button class="al-remove-btn" onclick="removeFromAutoloot(${slot}, ${id})" title="Remove">×</button>
      </div>
    </div>
  `;
}

function renderImportSection() {
  return `
    <div class="al-section al-section--import">
      <div class="al-section-header">
        <span class="item-label">Import from Commands</span>
      </div>
      <p class="al-overflow-hint">Paste existing <code>@alootid2</code> commands to import their item IDs into this slot.</p>
      <textarea
        id="alootPasteBox"
        class="al-paste-textarea"
        placeholder="@alootid2 save 1 7451 7507 7510"
      ></textarea>
      <div class="al-paste-actions">
        <button class="btn btn-primary btn-sm" onclick="importAlootCommands()">Import</button>
        <span class="help-text">Space-separated IDs only. Extra spacing is fine.</span>
      </div>
    </div>
  `;
}

// ===== COMMAND GENERATION =====

function generateCommands(slot, items) {
  if (items.length === 0) return [];

  const { MAX_CHARS_PER_LINE } = AUTOLOOT_CONFIG;
  const commandBlocks = [];
  const prefix = `@alootid2 save ${slot} `;
  
  // Revised "Steeper Decay" Strategy based on your testing:
  // Line 1: 20 items (Burst)
  // Line 2: 15 items
  // Line 3: 12 items
  // Lines 4-7: 7 items (Sustained)
  // Lines 8-9: 6 items (Fatigue sets in)
  // Lines 10+: 5 items (Maximum safety)
  const getLineLimit = (index) => {
    if (index === 0) return 20;
    if (index === 1) return 15;
    if (index === 2) return 12;
    if (index < 7) return 7;  // Lines 4, 5, 6, 7
    if (index < 9) return 6;  // Lines 8, 9
    return 5;                 // Line 10+
  };

  let currentChunk = [];
  let currentLineIndex = 0;
  let currentLength = prefix.length;

  items.forEach(id => {
    const idStr = id.toString();
    
    // 1. Determine Dynamic Limit for the current line number
    const limit = getLineLimit(currentLineIndex);
    
    // 2. Calculate projected length
    const spaceCost = currentChunk.length > 0 ? 1 : 0;
    const totalCost = spaceCost + idStr.length;

    // 3. Check Condition: Item Count Limit OR Character Limit
    if (currentChunk.length >= limit || (currentLength + totalCost) > MAX_CHARS_PER_LINE) {
      // Flush current line
      commandBlocks.push(`${prefix}${currentChunk.join(" ")}`);
      
      // Reset for next line
      currentChunk = [];
      currentLineIndex++;
      currentLength = prefix.length;
    }

    // Add item
    currentChunk.push(idStr);
    const addedLen = (currentChunk.length === 1) ? idStr.length : (1 + idStr.length);
    currentLength += addedLen;
  });

  // Flush remaining items
  if (currentChunk.length > 0) {
    commandBlocks.push(`${prefix}${currentChunk.join(" ")}`);
  }

  return [
    `@alootid2 reset ${slot}`,
    ...commandBlocks,
    `@alootid2 load ${slot}`
  ];
}

// ===== SEARCH FUNCTIONALITY =====

function handleAutolootSearch(query) {
  const resultsDiv = document.getElementById("alSearchResults");

  if (!query?.trim()) {
    resultsDiv.classList.add("hidden");
    return;
  }

  const matches = searchItems(query.toLowerCase());

  if (matches.length === 0) {
    resultsDiv.classList.add("hidden");
    return;
  }

  renderSearchResults(resultsDiv, matches);
}

function searchItems(lowerQuery) {
  const allItems = getAllItems();
  const queryNum = parseInt(lowerQuery, 10);
  const isNumeric = !isNaN(queryNum) && queryNum.toString() === lowerQuery.trim();

  if (isNumeric) {
    return searchByID(allItems, queryNum, lowerQuery);
  }
  
  return searchByName(allItems, lowerQuery);
}

function searchByID(allItems, queryNum, query) {
  const exactMatch = allItems.find(item => item.id === queryNum);
  const matches = exactMatch ? [exactMatch] : [];
  
  const others = allItems
    .filter(item => 
      item.id !== queryNum && 
      (item.id.toString().includes(query) || 
       item.name?.toLowerCase().includes(query))
    )
    .slice(0, 10);

  return [...matches, ...others];
}

function searchByName(allItems, lowerQuery) {
  return allItems
    .filter(item => 
      item.name?.toLowerCase().includes(lowerQuery) || 
      item.id.toString().includes(lowerQuery)
    )
    .sort((a, b) => sortByRelevance(a, b, lowerQuery))
    .slice(0, 15);
}

function sortByRelevance(a, b, lowerQuery) {
  const aName = (a.name || "").toLowerCase();
  const bName = (b.name || "").toLowerCase();

  if (aName === lowerQuery && bName !== lowerQuery) return -1;
  if (bName === lowerQuery && aName !== lowerQuery) return 1;
  if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
  if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1;

  return a.id - b.id;
}

function renderSearchResults(resultsDiv, matches) {
  resultsDiv.innerHTML = matches.map(item => {
    const slotCount = Number(item.slot) || 0;
    const displayName = slotCount > 0
      ? `${item.name || 'Unknown'} [${slotCount}]`
      : (item.name || 'Unknown');
    const alreadyAdded = (state.autolootData[state.selectedAutolootSlot] || []).includes(item.id);

    return `
      <div class="al-result-item ${alreadyAdded ? 'al-result-item--added' : ''}"
           onclick="addToAutoloot(${state.selectedAutolootSlot}, ${item.id})">
        ${renderItemIcon(item.id, 24)}
        <span class="al-result-name">${displayName}</span>
        <span class="al-result-id">${item.id}</span>
        ${alreadyAdded ? '<span class="al-result-check">✓</span>' : ''}
      </div>
    `;
  }).join("");

  resultsDiv.classList.remove("hidden");
}

// ===== ITEM MANAGEMENT =====

function updateSlotName(slot, name) {
  const trimmedName = name.trim();
  if (trimmedName) {
    state.autolootNames[slot] = trimmedName;
  } else {
    delete state.autolootNames[slot];
  }
  localStorage.setItem("osro_autoloot_names_v1", JSON.stringify(state.autolootNames));
  renderAutolootSidebar();
}

function addToAutoloot(slot, id) {
  const currentItems = state.autolootData[slot];
  
  if (currentItems.includes(id)) {
    return; // Item already exists
  }
  
  if (currentItems.length >= AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT) {
    showToast(`Slot ${slot} is full — max ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT} items`, 'warning');
    return;
  }
  
  currentItems.push(id);
  saveAutoloot();
  clearSearchInput();
}

function clearSearchInput() {
  const input = document.getElementById("alSearchInput");
  const results = document.getElementById("alSearchResults");
  
  if (input) {
    input.value = "";
    input.focus();
  }
  if (results) {
    results.classList.add("hidden");
  }
}

function removeFromAutoloot(slot, id) {
  state.autolootData[slot] = state.autolootData[slot].filter(x => x !== id);
  saveAutoloot();
}

function clearAutolootSlot(slot) {
  state.autolootData[slot] = [];
  saveAutoloot();
  showToast(`Slot ${slot} cleared`, "info");
}

function copyAllAutoloot() {
  const blocks = document.querySelectorAll(".al-code-block");
  const text = Array.from(blocks).map(b => b.textContent).join("\n");
  navigator.clipboard.writeText(text);
  showToast("Commands copied", "success");
}

// ===== IMPORT FUNCTIONALITY =====

function importAlootCommands() {
  const textarea = document.getElementById("alootPasteBox");
  const text = textarea.value.trim();
  
  if (!text) return;

  const slot = state.selectedAutolootSlot;
  if (!slot) {
    showToast('No autoloot slot selected', 'warning');
    return;
  }

  const ids = parseAlootCommands(text);

  if (ids.size === 0) {
    showToast('No valid @alootid2 item IDs found', 'warning');
    return;
  }

  const currentItems = state.autolootData[slot];
  const availableSpace = AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT - currentItems.length;
  
  if (availableSpace <= 0) {
    showToast(`Slot ${slot} is full — max ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT} items`, 'warning');
    return;
  }

  let added = 0;
  let skipped = 0;
  
  for (const id of ids) {
    if (currentItems.length >= AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT) {
      skipped = ids.size - added;
      break;
    }
    
    if (!currentItems.includes(id)) {
      currentItems.push(id);
      added++;
      saveAutoloot();
    }
  }

  textarea.value = "";
  renderAutolootSidebar();
  renderAutolootMain();
  
  showToast(`Imported ${added} item${added !== 1 ? 's' : ''}${skipped > 0 ? ` — ${skipped} skipped (slot full)` : ''}`, skipped > 0 ? 'warning' : 'success');
}

function parseAlootCommands(text) {
  const lines = text.split(/\r?\n/);
  const ids = new Set();

  for (let line of lines) {
    line = line.trim();
    if (!line.toLowerCase().startsWith("@alootid2")) continue;

    const parts = line.split(/\s+/).slice(1);
    extractItemIDs(parts, ids);
  }

  return ids;
}

function extractItemIDs(parts, ids) {
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].toLowerCase();

    if (AUTOLOOT_CONFIG.COMMANDS_WITH_SLOTS.includes(token)) {
      i++; // Skip slot number
      continue;
    }

    if (/^\d+$/.test(token)) {
      ids.add(Number(token));
    }
  }
}

// ===== EVENT LISTENERS =====

document.addEventListener("click", e => {
  const searchWrapper = document.querySelector(".al-search-wrapper");
  const resultsDiv = document.getElementById("alSearchResults");
  
  if (searchWrapper && resultsDiv && !searchWrapper.contains(e.target)) {
    resultsDiv.classList.add("hidden");
  }
});