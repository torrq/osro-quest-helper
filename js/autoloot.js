// autoloot.js - Autoloot Generator Logic

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
            const nameStyle =
              name === "Unknown Item" ? ' style="color:red;"' : "";
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

  const lines = text.split(/\r?\n/);
  const ids = new Set();
  const slot = state.selectedAutolootSlot;

  if (!slot) {
    alert("No autoloot slot selected.");
    return;
  }

  const commandsWithSlots = ["save", "reset", "load", "clear", "add", "remove"];

  for (let line of lines) {
    line = line.trim();
    if (!line.toLowerCase().startsWith("@alootid2")) continue;

    const parts = line.split(/\s+/).slice(1);

    for (let i = 0; i < parts.length; i++) {
      const token = parts[i].toLowerCase();

      if (commandsWithSlots.includes(token)) {
        i++; // skip slot number
        continue;
      }

      if (/^\d+$/.test(token)) {
        ids.add(Number(token));
      }
    }
  }

  if (!ids.size) {
    alert("No valid @alootid2 item IDs found.");
    return;
  }

  ids.forEach((id) => addToAutoloot(slot, id));

  textarea.value = "";
  renderAutolootSidebar();
  renderAutolootMain();
}

// Global click handler for autoloot search
document.addEventListener("click", (e) => {
  const searchWrapper = document.querySelector(".al-search-wrapper");
  const resultsDiv = document.getElementById("alSearchResults");
  if (searchWrapper && resultsDiv && !searchWrapper.contains(e.target)) {
    resultsDiv.classList.add("hidden");
  }
});
