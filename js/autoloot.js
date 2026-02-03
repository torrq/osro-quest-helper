// autoloot.js - Autoloot Generator Logic

// ===== CONSTANTS =====

const AUTOLOOT_CONFIG = {
  MAX_ITEMS_PER_LINE: 10,
  MAX_CHARS_PER_LINE: 100,
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
      ${renderHeader(slot)}
      ${renderCommandBox(slot, items)}
      ${renderSearchBox()}
      ${renderItemsSection(slot, items)}
      ${renderImportSection()}
    </div>
  `;
}

function renderHeader(slot) {
  const slotName = state.autolootNames[slot] || `Autoloot Slot ${slot}`;
  
  return `
    <div class="quest-header-actions">
      <button class="btn btn-sm copy-link-btn" onclick="copyAutolootLink()" title="Copy link to this autoloot slot">
        🔗 Copy Link
      </button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; gap: 15px;">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">Autoloot Slot #${slot}</h2>
        </div>
        <div style="margin-bottom: 5px;">
          <input 
            type="text" 
            id="slotNameInput"
            placeholder="Enter slot name..."
            value="${slotName}"
            onchange="updateSlotName(${slot}, this.value)"
            style="width: 100%; max-width: 400px; padding: 8px 12px; font-size: 14pt; font-weight: 500; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px;"
          >
        </div>
        <p style="font-style: italic; color: var(--text-muted); margin: 0 8px; font-size: 0.8em;">
          Commands are automatically optimized to fit line limits 
          (max ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_LINE} items/${AUTOLOOT_CONFIG.MAX_CHARS_PER_LINE} chars)
        </p>
      </div>
    </div>
  `;
}

function renderCommandBox(slot, items) {
  const commands = generateCommands(slot, items);
  const commandHtml = commands.length === 0
    ? '<div style="color:var(--text-muted); font-style:italic;">Slot is empty. Add items below.</div>'
    : commands.map(cmd => `<div class="al-code-block">${cmd}</div>`).join("");

  return `
    <div class="al-command-box">
      <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
        <h4 style="color:var(--accent); text-transform:uppercase; font-size:12px; letter-spacing:1px;">
          Generated Commands
        </h4>
        <button class="btn btn-sm" onclick="copyAllAutoloot()" style="font-size:11px;">
          Copy All
        </button>
      </div>
      ${commandHtml}
    </div>
  `;
}

function renderSearchBox() {
  return `
    <div class="al-search-wrapper">
      <input type="text" 
        id="alSearchInput" 
        class="al-search-input" 
        placeholder="Search Item Name or ID to add..." 
        autocomplete="off"
        oninput="handleAutolootSearch(this.value)">
      <div id="alSearchResults" class="al-search-dropdown hidden"></div>
    </div>
  `;
}

function renderItemsSection(slot, items) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
      <h3 style="font-size:16px;">Stored Items (${items.length}/${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT})</h3>
      ${items.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="clearAutolootSlot(${slot})">Clear Slot</button>` : ""}
    </div>
    <div class="al-items-grid">
      ${items.map(id => renderItemCard(slot, id)).join("")}
    </div>
  `;
}

function renderItemCard(slot, id) {
  const item = DATA.items[id];
  const name = item?.name || "Unknown Item";
  const nameStyle = name === "Unknown Item" ? ' class="color-red"' : "";
  const slotCount = Number(item?.slot) || 0;
  const displayName = slotCount > 0 ? `${name} [${slotCount}]` : name;

  return `
    <div class="al-item-card">
      <div class="al-item-card-left">
        ${renderItemIcon(id, 24)}
        <span title="${displayName}"${nameStyle}>${displayName}</span>
        <span class="al-item-card-itemid">${id}</span>
      </div>
      <div class="al-remove-btn" onclick="removeFromAutoloot(${slot}, ${id})">×</div>
    </div>
  `;
}

function renderImportSection() {
  return `
    <div class="al-paste-wrapper">
      <label class="item-label">Paste @alootid2 commands</label>
      <textarea
        id="alootPasteBox"
        class="al-paste-textarea"
        placeholder="Example: @alootid2 save 1 7451 7507 7510"
      ></textarea>
      <div class="al-paste-actions">
        <button class="btn btn-primary btn-sm" onclick="importAlootCommands()">
          Import
        </button>
        <span class="help-text">
          Space-separated item IDs only. Extra spacing is fine.
        </span>
      </div>
    </div>
  `;
}

// ===== COMMAND GENERATION =====

function generateCommands(slot, items) {
  if (items.length === 0) return [];

  const { MAX_ITEMS_PER_LINE, MAX_CHARS_PER_LINE } = AUTOLOOT_CONFIG;
  const prefix = `@alootid2 save ${slot} `;
  const commandBlocks = [];
  let currentChunk = [];
  let currentLength = prefix.length;

  items.forEach(id => {
    const idStr = id.toString();
    const addedLength = idStr.length + 1;

    if (currentChunk.length >= MAX_ITEMS_PER_LINE || 
        currentLength + addedLength > MAX_CHARS_PER_LINE) {
      if (currentChunk.length > 0) {
        commandBlocks.push(`${prefix}${currentChunk.join(" ")}`);
      }
      currentChunk = [];
      currentLength = prefix.length;
    }

    currentChunk.push(idStr);
    currentLength += addedLength;
  });

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
    
    return `
      <div class="al-result-item" onclick="addToAutoloot(${state.selectedAutolootSlot}, ${item.id})">
        ${renderItemIcon(item.id, 24)}
        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;margin-left:8px;">
          ${displayName}
        </div>
        <span style="color:var(--text); font-family:monospace; margin:0 8px 0 8px; font-weight:bold;font-size:14pt;">
          ${item.id}
        </span>
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
    alert(`Slot ${slot} is full! Maximum ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT} items per slot.`);
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
  if (confirm(`Clear all items from Slot ${slot}?`)) {
    state.autolootData[slot] = [];
    saveAutoloot();
  }
}

function copyAllAutoloot() {
  const blocks = document.querySelectorAll(".al-code-block");
  const text = Array.from(blocks).map(b => b.textContent).join("\n");
  navigator.clipboard.writeText(text);
  alert("Commands copied to clipboard");
}

// ===== IMPORT FUNCTIONALITY =====

function importAlootCommands() {
  const textarea = document.getElementById("alootPasteBox");
  const text = textarea.value.trim();
  
  if (!text) return;

  const slot = state.selectedAutolootSlot;
  if (!slot) {
    alert("No autoloot slot selected.");
    return;
  }

  const ids = parseAlootCommands(text);

  if (ids.size === 0) {
    alert("No valid @alootid2 item IDs found.");
    return;
  }

  const currentItems = state.autolootData[slot];
  const availableSpace = AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT - currentItems.length;
  
  if (availableSpace <= 0) {
    alert(`Slot ${slot} is full! Maximum ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT} items per slot.`);
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
  
  if (skipped > 0) {
    alert(`Added ${added} items. ${skipped} items skipped due to ${AUTOLOOT_CONFIG.MAX_ITEMS_PER_SLOT} item limit.`);
  }
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