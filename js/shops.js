// shops.js - Shop Rendering, Editing, and Tree Logic

// ===== NAVIGATION & SELECTION =====

function navigateToShop(groupIdx, subIdx, shopIdx) {
  state.currentTab = "shops";
  state.selectedItem = null;
  const group = DATA.shopGroups[groupIdx];
  const subgroup = group?.subgroups[subIdx];
  const shop = subgroup?.shops[shopIdx];
  if (shop) {
    state.expandedShopGroups.add(groupIdx);
    state.expandedShopSubgroups.add(`${groupIdx}-${subIdx}`);
    selectShop(group, subgroup, shop);
  }
}

function toggleShopGroup(idx) {
  state.expandedShopGroups.has(idx) 
    ? state.expandedShopGroups.delete(idx) 
    : state.expandedShopGroups.add(idx);
  render();
}

function toggleShopSubgroup(groupIdx, subIdx) {
  const key = `${groupIdx}-${subIdx}`;
  state.expandedShopSubgroups.has(key)
    ? state.expandedShopSubgroups.delete(key)
    : state.expandedShopSubgroups.add(key);
  render();
}

function selectShop(group, subgroup, shop, pushToHistory = true) {
  state.selectedShop = shop;
  state.selectedShopGroup = group;
  state.selectedShopSubgroup = subgroup;
  
  // Update URL with shop ID for sharing and browser history
  // Only push to history if this is a user-initiated click (not browser navigation)
  if (shop && shop.producesId && typeof updateURL === 'function') {
    updateURL(shop.producesId.toString(), 'shop', pushToHistory);
  }
  
  render();
}

// Select a shop by its producesId (for URL navigation)
function selectShopById(shopId, pushToHistory = true) {
  const id = parseInt(shopId);
  const result = findShopById(id);
  
  if (result) {
    const { group, subgroup, shop, groupIdx, subIdx, shopIdx } = result;
    state.expandedShopGroups.add(groupIdx);
    state.expandedShopSubgroups.add(`${groupIdx}-${subIdx}`);
    selectShop(group, subgroup, shop, pushToHistory);
    
    // Scroll to shop in sidebar after a short delay
    setTimeout(() => {
      const shopElement = document.querySelector('.quest.active');
      if (shopElement) {
        shopElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
}

// Find a shop by its producesId
function findShopById(shopId) {
  if (!Array.isArray(DATA.shopGroups)) return null;
  
  for (let groupIdx = 0; groupIdx < DATA.shopGroups.length; groupIdx++) {
    const group = DATA.shopGroups[groupIdx];
    if (!group || !Array.isArray(group.subgroups)) continue;
    
    for (let subIdx = 0; subIdx < group.subgroups.length; subIdx++) {
      const subgroup = group.subgroups[subIdx];
      if (!subgroup || !Array.isArray(subgroup.shops)) continue;
      
      for (let shopIdx = 0; shopIdx < subgroup.shops.length; shopIdx++) {
        const shop = subgroup.shops[shopIdx];
        if (shop && shop.producesId === shopId) {
          return { group, subgroup, shop, groupIdx, subIdx, shopIdx };
        }
      }
    }
  }
  
  return null;
}

// ===== SIDEBAR RENDERING =====

function renderShopsSidebarCore() {
  const container = document.getElementById("shopsTreeContainer");
  
  if (!container) {
    console.warn('[renderShopsSidebar] Container element not found');
    return;
  }
  
  container.innerHTML = "";
  const filter = state.shopSearchFilter;

  if (!Array.isArray(DATA.shopGroups)) {
    console.warn('[renderShopsSidebar] DATA.shopGroups is not an array');
    return;
  }

  DATA.shopGroups.forEach((group, groupIdx) => {
    if (!group) return;
    
    const { hasMatch, matchingSubgroups } = getShopGroupMatches(group, filter);
    if (filter && !hasMatch) return;

    const groupDiv = createShopGroupElement(group, groupIdx, filter, matchingSubgroups);
    container.appendChild(groupDiv);
  });
}

function getShopGroupMatches(group, filter) {
  if (!filter) return { hasMatch: true, matchingSubgroups: [] };
  
  if (!group || !Array.isArray(group.subgroups)) {
    return { hasMatch: false, matchingSubgroups: [] };
  }
  
  let hasMatch = false;
  const matchingSubgroups = [];

  group.subgroups.forEach((subgroup, subIdx) => {
    if (!subgroup || !Array.isArray(subgroup.shops)) return;
    
    if (subgroup.shops.some(q => q && q.name && q.name.toLowerCase().includes(filter))) {
      hasMatch = true;
      matchingSubgroups.push(subIdx);
    }
  });

  return { hasMatch, matchingSubgroups };
}

function createShopGroupElement(group, groupIdx, filter, matchingSubgroups) {
  const groupDiv = document.createElement("div");
  groupDiv.className = "group";
  const isExpanded = filter || state.expandedShopGroups.has(groupIdx);

  groupDiv.appendChild(createShopGroupHeader(group, groupIdx, isExpanded));

  if (isExpanded && Array.isArray(group.subgroups)) {
    group.subgroups.forEach((subgroup, subIdx) => {
      if (!subgroup) return;
      if (filter && !matchingSubgroups.includes(subIdx)) return;
      groupDiv.appendChild(createShopSubgroupElement(group, subgroup, groupIdx, subIdx, filter));
    });
  }

  return groupDiv;
}

function createShopGroupHeader(group, groupIdx, isExpanded) {
  const header = document.createElement("div");
  header.className = "group-header clickable";
  header.onclick = () => toggleShopGroup(groupIdx);
  header.innerHTML = `
    <span class="expand-icon ${isExpanded ? "expanded" : ""}">▶</span>
    <div class="group-name-container">
      <span class="group-name-readonly">${group.name}</span>
      ${group.caption ? `<span class="group-caption">${group.caption}</span>` : ""}
    </div>
  `;
  return header;
}

function createShopSubgroupElement(group, subgroup, groupIdx, subIdx, filter) {
  const subDiv = document.createElement("div");
  subDiv.className = "subgroup";
  const isSubExpanded = filter || state.expandedShopSubgroups.has(`${groupIdx}-${subIdx}`);

  subDiv.appendChild(createShopSubgroupHeader(subgroup, groupIdx, subIdx, isSubExpanded));

  if (isSubExpanded && Array.isArray(subgroup.shops)) {
    subgroup.shops.forEach((shop, shopIdx) => {
        if (!shop) return;
        if (filter && !(shop.name && shop.name.toLowerCase().includes(filter))) return;
        subDiv.appendChild(createShopElement(group, subgroup, shop, groupIdx, subIdx, shopIdx));
    });

    if (!filter && state.editorMode) {
      subDiv.appendChild(createAddShopButton(groupIdx, subIdx));
    }
  }

  return subDiv;
}

function createShopSubgroupHeader(subgroup, groupIdx, subIdx, isSubExpanded) {
  const subHeader = document.createElement("div");
  subHeader.className = "subgroup-header clickable";
  subHeader.onclick = () => toggleShopSubgroup(groupIdx, subIdx);
  subHeader.innerHTML = `
    <span class="expand-icon ${isSubExpanded ? "expanded" : ""}">▷</span>
    <span class="subgroup-name-readonly">${subgroup.name}</span>
  `;
  return subHeader;
}

function createShopElement(group, subgroup, shop, groupIdx, subIdx, shopIdx) {
  const shopDiv = document.createElement("div");
  shopDiv.className = "shop-item";
  if (state.selectedShop === shop) shopDiv.classList.add("active");
  shopDiv.draggable = state.editorMode;
  
  // Get icon HTML
  const iconHtml = shop.producesId ? renderItemIcon(shop.producesId) : '';
  
  shopDiv.innerHTML = `
    <span class="drag-handle">${state.editorMode ? "⋮⋮" : ""}</span>
    ${iconHtml}
    <span class="shop-name">${shop.name}</span>
  `;

  if (state.editorMode) {
    shopDiv.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));
    setupShopDragAndDrop(shopDiv, shopIdx, groupIdx, subIdx, subgroup);
  }

  shopDiv.querySelector(".shop-name").onclick = () => {
    selectShop(group, subgroup, shop);
    if (window.innerWidth <= 768) toggleSidebar();
  };

  return shopDiv;
}

function setupShopDragAndDrop(shopDiv, shopIdx, groupIdx, subIdx, subgroup) {
  shopDiv.addEventListener("dragstart", (e) => {
    e.dataTransfer.setDragImage(shopDiv, 0, 0);
    e.dataTransfer.effectAllowed = 'move';
    state.draggedShop = shopIdx;
    state.draggedFrom = { groupIdx, subIdx };
    shopDiv.classList.add("dragging");
  });

  shopDiv.addEventListener("dragend", () => {
    shopDiv.classList.remove("dragging");
    document.querySelectorAll(".shop-item").forEach(el => el.classList.remove("drag-over"));
  });

  shopDiv.addEventListener("dragover", e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  shopDiv.addEventListener("dragenter", () => {
    if (state.draggedShop !== shopIdx || 
        state.draggedFrom.groupIdx !== groupIdx || 
        state.draggedFrom.subIdx !== subIdx) {
      shopDiv.classList.add("drag-over");
    }
  });

  shopDiv.addEventListener("dragleave", () => shopDiv.classList.remove("drag-over"));

  shopDiv.addEventListener("drop", (e) => {
    e.preventDefault();
    shopDiv.classList.remove("drag-over");

    if (state.draggedFrom.groupIdx === groupIdx && state.draggedFrom.subIdx === subIdx) {
      const shops = subgroup.shops;
      const [removed] = shops.splice(state.draggedShop, 1);
      const newIdx = shopIdx > state.draggedShop ? shopIdx - 1 : shopIdx;
      shops.splice(newIdx, 0, removed);
      render();
    }
  });
}

function createAddShopButton(groupIdx, subIdx) {
  const addShopBtn = document.createElement("button");
  addShopBtn.className = "btn btn-sm btn-indent-shop";
  addShopBtn.textContent = "+ Shop";
  addShopBtn.onclick = () => addShop(groupIdx, subIdx);
  return addShopBtn;
}

// ===== SHOPS CONTENT RENDERING =====

function renderShopContentCore() {
  const container = document.getElementById("mainContent");
  
  if (!container) {
    console.warn('[renderShopContent] Container element not found');
    return;
  }

  if (!state.selectedShop) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Shop Selected</h2>
        <p>Select a shop from the sidebar</p>
      </div>
    `;
    return;
  }

  const shop = state.selectedShop;
  const item = getItem(shop.producesId);
  const descriptionHtml = parseDescription(item.desc);

  if (state.editorMode) {
    // ── EDITOR MODE ──────────────────────────────────────────
    container.innerHTML = `
      <div class="shop-header-actions">
        <button class="btn btn-sm copy-link-btn" onclick="copyShopLink()" title="Copy link to this shop">
          🔗 Copy Link
        </button>
      </div>
      <div class="editor-shop">
        <span class="item-label">Shop Item:</span>
        <div class="form-group">
          <input type="text" placeholder="Shop Item" value="${shop.name}" onchange="updateShopName(this.value)">
        </div>

        <div class="form-group">
          <div class="shop-info-row">
            ${shopRenderProducesSelector(shop, item)}
            ${shopRenderBoundCheckbox(shop)}
          </div>
        </div>

        ${shopRenderRequirementsSection(shop)}

        ${descriptionHtml ? `
          <span class="item-label">Item Description:</span>
          <div class="item-description-box">${shop.producesId ? `<div class="desc-box-icon">${renderItemIcon(shop.producesId, 48)}</div>` : ''}${descriptionHtml}</div>
        ` : ""}

        ${(() => {
            const summaryHtml = renderShopSummary();
            if (summaryHtml.includes('tot-empty')) return '';
            return `${shopRenderTotalsHeader()}
        <div class="summary-section">${summaryHtml}</div>`;
        })()}
      </div>
    `;

    document.querySelectorAll(".req-search-input").forEach(input => {
      shopSetupAutocomplete(input, parseInt(input.getAttribute("data-idx")));
    });

  } else {
    // ── VIEWER MODE ──────────────────────────────────────────
    container.innerHTML = `
      <div class="editor-shop">
        ${renderShopViewerHeader(shop, item)}

        ${descriptionHtml ? `
          <span class="item-label">Description:</span>
          <div class="item-description-box">${descriptionHtml}</div>
        ` : ""}

        <span class="item-label">Requirements:</span>
        <div class="material-tree">${renderShopRequirementsFlat(shop)}</div>

        ${(() => {
            const summaryHtml = renderShopSummary();
            if (summaryHtml.includes('tot-empty')) return '';
            return `${shopRenderTotalsHeader()}
        <div class="summary-section">${summaryHtml}</div>`;
        })()}

        <div class="quest-footer-actions">
          <button class="btn btn-sm copy-link-btn" onclick="copyShopLink()" title="Copy link to this shop">
            🔗 Copy Link
          </button>
        </div>
      </div>
    `;
  }
}

function renderShopViewerHeader(shop, item) {
  const bound = shop.accountBound ? `<span class="qvh-bound">Account Bound</span>` : '';
  return renderViewerHeader(shop.producesId, item, {
    meta: bound,
    loc:  findShopLocation(shop)
  });
}

function renderShopRequirementsFlat(shop) {
  if (!shop.requirements || shop.requirements.length === 0) {
    return '<div class="tree-line">No requirements</div>';
  }

  const rows = shop.requirements.map(req => {
    const eff = Number(req.amount) || 0;
    // Format amount compactly (1M instead of 1,000,000)
    const fmtAmt = eff >= 1e6 ? formatZenyCompact(eff) : eff >= 1000 ? eff.toLocaleString() : eff;
    const immuneHtml = req.immune ? `<span class="mat-immune">IMMUNE</span>` : '';

    let icon = '', name = '', slot = '';

    if (req.type === 'zeny') {
      icon = renderItemIcon(1);
      name = 'Zeny';
    } else if (req.type === 'credit') {
      icon = renderItemIcon(SPECIAL_ITEMS.CREDIT);
      name = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a>`;
    } else if (req.type === 'gold') {
      icon = renderItemIcon(SPECIAL_ITEMS.GOLD);
      name = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a>`;
    } else if (SHOP_CURRENCY_NAMES[req.type]) {
      icon = renderItemIcon(2);
      name = SHOP_CURRENCY_NAMES[req.type];
    } else if (req.type === 'item') {
      const itm = getItem(req.id);
      icon = renderItemIcon(req.id);
      if (itm && Number(itm.slot) > 0) slot = `[${itm.slot}]`;
      name = `<a class="item-link" onclick="navigateToItem(${req.id})">${itm ? (itm.name || 'Unknown') : 'Unknown'}</a>`;
    }

    // Zeny sub-value line
    let zenyVal = 0;
    if (req.type === 'zeny')        zenyVal = eff;
    else if (req.type === 'gold')   zenyVal = eff * getGoldValue();
    else if (req.type === 'credit') zenyVal = eff * getCreditValue();
    else if (req.type === 'item') {
      const itm = getItem(req.id);
      zenyVal = eff * (itm?.value || 0);
    }

    return `
      <div class="mat-node">
        <div class="mat-row">
          <span class="mat-xbtn-ph"></span>
          ${icon}
          <span class="mat-name">${name}${slot ? `<span class="mat-slot">${slot}</span>` : ''}</span>
          <span class="mat-amt"><span class="mat-x">×</span>${fmtAmt}</span>
          ${immuneHtml}
        </div>
      </div>`;
  });

  return `<div class="mat-tree">${rows.join('')}</div>`;
}

function shopRenderProducesSelector(shop, item) {
  return `
    <div class="item-selector-wrapper">
      <span class="item-label label-block">Produces Item:</span>
      ${shop.producesId ? `
        <div class="item-selected-badge">
          <strong><a class="item-link tree-item-name" onclick="navigateToItem(${shop.producesId})">${getItemDisplayName(item)}</a></strong>
          ${state.editorMode ? `<button class="clear-btn" onclick="shopUpdateProducesId(null)">×</button>` : ''}
        </div>
      ` : state.editorMode ? `
        <div class="search-container">
          <input type="text" id="produces-search" placeholder="Search item to produce..." oninput="shopSetupProducesSearch(this)">
          <div id="produces-dropdown" class="autocomplete-dropdown"></div>
        </div>
      ` : `
        <div class="text-muted">No item produced</div>
      `}
    </div>
  `;
}

function shopRenderBoundCheckbox(shop) {
  return `
    <div class="shop-bound">
      <span class="item-label label-block">Bound:</span>
      <input type="checkbox" ${shop.accountBound ? "checked" : ""} 
             onchange="updateShopAccountBound(this.checked)">
    </div>
  `;
}

function shopRenderRequirementsSection(shop) {
  return `
    <div class="requirements-wrapper">
      <span class="item-label">Requirements: &nbsp;<button class="btn btn-sm btn-primary" onclick="shopAddRequirement()">+ Add</button></span>
      <div class="requirements-section">
        <div class="requirements-grid">
          ${shop.requirements.map((req, idx) => shopRenderRequirement(req, idx)).join("")}
        </div>
      </div>
    </div>
  `;
}

function shopRenderTotalsHeader() {
  if (!hasNestedShops()) return '<span class="item-label">Value:</span>';

  // Only show the toggle if including sub-shops actually changes the total
  const shopIndex = buildShopIndex();
  const { totalZeny: directZeny } = shopCalculateDirectRequirements();
  const { totalZeny: fullZeny }   = shopCalculateFullRequirements(shopIndex, {});
  if (directZeny === fullZeny) return '<span class="item-label">Value:</span>';

  return `
    <div class="totals-header">
      <span class="item-label">Value:</span>
      <button class="btn-toggle-totals" onclick="shopToggleTotals()">
        ${state.showFullTotals
          ? '<span>⊖</span> This Shop Only'
          : '<span>⊕</span> Include Sub-Shops'}
      </button>
    </div>
  `;
}

// ===== REQUIREMENT RENDERING =====

const SHOP_SHOP_REQ_TYPE_OPTIONS = [
  { value: 'item', label: 'Item' },
  { value: 'zeny', label: 'Zeny' },
  { value: 'gold', label: 'Gold' },
  { value: 'credit', label: 'Credit' },
  { value: 'vote_points', label: 'Vote Points' },
  { value: 'hourly_points', label: 'Hourly Points' },
  { value: 'activity_points', label: 'Activity Points' },
  { value: 'monster_arena_points', label: 'MA Points' },
  { value: 'otherworld_points', label: 'Otherworld Points' },
  { value: 'hall_of_heritage_points', label: 'HoH Points' },
  { value: 'token_points', label: 'Token Points' },
  { value: 'cardo_points', label: 'Cardo Points' }
];

function shopRenderRequirement(req, idx) {
  const isItem = req.type === "item";
  const item = isItem ? getItem(req.id) : null;

  return `
    <div class="requirement-card">
      <button class="remove-btn" onclick="shopDeleteRequirement(${idx})" title="Remove">×</button>
      
      <div class="req-top-row">
        <select onchange="shopUpdateReqType(${idx}, this.value)">
          ${SHOP_SHOP_REQ_TYPE_OPTIONS.map(opt => 
            `<option value="${opt.value}" ${req.type === opt.value ? "selected" : ""}>${opt.label}</option>`
          ).join('')}
        </select>
        <input type="number" placeholder="Amount" value="${req.amount}" 
               onchange="shopUpdateReqAmount(${idx}, this.value)">
      </div>

      ${isItem ? shopRenderItemRequirement(req, idx, item) : ""}

      <div class="checkbox-group">
        <label class="checkbox-label text-muted-xs opacity-80">
          <input type="checkbox" ${req.immune ? "checked" : ""} 
                 onchange="shopUpdateReqImmune(${idx}, this.checked)">Immune
        </label>
      </div>
    </div>
  `;
}

function shopRenderItemRequirement(req, idx, item) {
  const iconHtml = req.id ? renderItemIcon(req.id) : '';
  
  return `
    <div class="req-name-row">
      ${req.id ? `
        <div class="item-selected-badge">
          ${iconHtml}
          <strong class="text-ellipsis-max">
            <a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item) || "Unknown"}</a>
          </strong>
          <small>(${req.id})</small>
          <button class="clear-btn ml-auto" onclick="shopUpdateReqId(${idx}, null)">×</button>
        </div>
      ` : `
        <div class="search-container">
          <input type="text" class="req-search-input req-search-input-full" 
                 data-idx="${idx}" placeholder="Search item...">
          <div id="autocomplete-${idx}" class="autocomplete-dropdown"></div>
        </div>
      `}
    </div>
  `;
}

// ===== MATERIAL TREE =====

const SHOP_CURRENCY_NAMES = {
  zeny: 'Zeny',
  credit: 'Credit',
  gold: 'Gold',
  vote_points: 'Vote Points',
  activity_points: 'Activity Points',
  hourly_points: 'Hourly Points',
  monster_arena_points: 'Monster Arena Points',
  otherworld_points: 'Otherworld Points',
  hall_of_heritage_points: 'Hall of Heritage Points',
  token_points: 'Token Points',
  cardo_points: 'Cardo Points',
  event_points: 'Event Points'
};

// ===== SUMMARY RENDERING =====

function renderShopSummary() {
  if (!state.showFullTotals) return shopRenderDirectRequirements();

  const shopIndex = buildShopIndex();
  const multiShopItems = shopFindMultiShopItems(shopIndex);

  if (multiShopItems.size === 0) return shopRenderSingleSummary(shopIndex, {});

  return shopRenderMultiOptionSummary(multiShopItems, shopIndex);
}

function shopFindMultiShopItems(shopIndex) {
  const multiShopItems = new Map();

  function scan(shop, shopPath = new Set()) {
    if (shopPath.has(shop)) return;
    const newPath = new Set(shopPath).add(shop);

    shop.requirements.forEach(req => {
      if (req.type === "item" && shopIndex.has(req.id)) {
        const shops = shopIndex.get(req.id);
        if (shops.length > 1) {
          multiShopItems.set(req.id, { name: getItem(req.id).name, shops });
        }
        scan(shops[0], newPath);
      }
    });
  }

  scan(state.selectedShop);
  return multiShopItems;
}

function shopRenderMultiOptionSummary(multiShopItems, shopIndex) {
  const items = Array.from(multiShopItems.entries());
  const combinations = shopGenerateCombinations(items);
  const tabLabels = combinations.map(combo => shopGenerateTabLabel(combo));

  return `
    <div class="summary-tabs-container">
      <div class="summary-tabs">
        ${combinations.map((combo, idx) => `
          <div class="summary-tab ${idx === 0 ? "active" : ""}" 
               onclick="shopSwitchSummaryTab(${idx})"
               title="${tabLabels[idx]}">
            Option ${idx + 1} ${tabLabels[idx]}
          </div>
        `).join("")}
      </div>
      ${combinations.map((combo, idx) => `
        <div class="summary-tab-content ${idx === 0 ? "active" : ""}" id="summary-tab-${idx}">
          ${shopRenderSingleSummary(shopIndex, combo)}
        </div>
      `).join("")}
    </div>
  `;
}

function shopGenerateTabLabel(combo) {
  const labels = [];
  for (const [, shop] of Object.entries(combo)) {
    let groupName = "", subgroupName = "";
    DATA.shopGroups.forEach(group => {
      group.subgroups.forEach(subgroup => {
        if (subgroup.shops.includes(shop)) {
          groupName = group.name;
          subgroupName = subgroup.name;
        }
      });
    });
    labels.push(`(${groupName} / ${subgroupName})`);
  }
  return labels.join(" | ");
}

function shopRenderDirectRequirements() {
  const { totals, totalZeny } = shopCalculateDirectRequirements();
  const entries = shopSortTotalEntries(totals);
  
  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  return renderShopSummaryItems(entries, totalZeny);
}

function shopCalculateDirectRequirements() {
  const shop = state.selectedShop;
  let totalZeny = 0;
  const totals = {};

  shop.requirements.forEach(req => {
    const effectiveAmount = Number(req.amount) || 0;
    totalZeny += shopCalculateZenyValue(req, effectiveAmount);
    shopAccumulateRequirement(totals, req, effectiveAmount);
  });

  return { totals, totalZeny };
}

function shopRenderSingleSummary(shopIndex, shopChoices) {
  const { totals, totalZeny } = shopCalculateFullRequirements(shopIndex, shopChoices);
  const entries = shopSortTotalEntries(totals);
  
  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  return renderShopSummaryItems(entries, totalZeny);
}

function shopCalculateFullRequirements(shopIndex, shopChoices) {
  const totals = {};
  let totalZeny = 0;

  function shopAccumulate(shop, multiplier, shopPath = new Set()) {
    if (shopPath.has(shop)) return;
    const newPath = new Set(shopPath).add(shop);

    shop.requirements.forEach(req => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      
      if (req.type === "item" && shopIndex.has(req.id)) {
        const shops = shopIndex.get(req.id);
        const chosenShop = shopChoices[req.id] || shops[0];
        shopAccumulate(chosenShop, effectiveAmount, newPath);
      } else {
        totalZeny += shopCalculateZenyValue(req, effectiveAmount);
        shopAccumulateRequirement(totals, req, effectiveAmount);
      }
    });
  }

  shopAccumulate(state.selectedShop, 1);
  return { totals, totalZeny };
}

function shopCalculateZenyValue(req, amount) {
  if (req.type === "zeny") return amount;
  if (req.type === "credit") return amount * getCreditValue();
  if (req.type === "gold") return amount * getGoldValue();
  if (req.type === "item") return amount * (getItem(req.id).value || 0);
  return 0;
}

function shopAccumulateRequirement(totals, req, effectiveAmount) {
  const key = req.type === "item" ? `item_${req.id}` : req.type;
  const item = req.type === "item" ? getItem(req.id) : null;
  const name = SHOP_CURRENCY_NAMES[req.type] || (req.type === "item" ? (item?.name || "Unknown") : req.type);

  if (!totals[key]) {
    totals[key] = {
      name,
      amount: 0,
      type: req.type,
      itemId: req.type === "item" ? req.id : null,  // ADD THIS
      slot: req.type === "item" ? (Number(item?.slot) || 0) : 0,  // ADD THIS
      value: req.type === "item" ? (item?.value || 0) : 0
    };
  }
  totals[key].amount += effectiveAmount;
}

function shopSortTotalEntries(totals) {
  const currencyOrder = { zeny: 0, credit: 1, gold: 2 };
  
  return Object.values(totals).sort((a, b) => {
    const aIsCurrency = a.type in currencyOrder;
    const bIsCurrency = b.type in currencyOrder;

    if (aIsCurrency && bIsCurrency) return currencyOrder[a.type] - currencyOrder[b.type];
    if (aIsCurrency) return -1;
    if (bIsCurrency) return 1;
    if (a.amount !== b.amount) return b.amount - a.amount;
    return a.name.localeCompare(b.name);
  });
}

function renderShopSummaryItems(entries, totalZeny) {
  // Only show entries that have a known zeny value
  const zenyCurrencies = new Set(["zeny", "gold", "credit"]);
  const valued = entries.filter(e =>
    zenyCurrencies.has(e.type) || (e.type === "item" && e.value > 0)
  );

  if (valued.length === 0) {
    return '<div class="tot-empty">No zeny-valued materials</div>';
  }

  let html = "";

  if (totalZeny > 0) {
    html += `
      <div class="tot-row tot-row--total">
        <span class="tot-label">Total Zeny Value</span>
        <span class="tot-amt">${formatZenyCompact(totalZeny)}</span>
      </div>`;
  }

  html += valued.map(entry => {
    const fmtAmt = entry.amount >= 1e6 ? formatZenyCompact(entry.amount)
                 : entry.amount >= 1000 ? entry.amount.toLocaleString()
                 : entry.amount;

    const slot = entry.type === "item" && entry.slot > 0
      ? `<span class="mat-slot">[${entry.slot}]</span>` : "";

    let iconHtml = "", nameHtml = "";
    if (entry.type === "zeny") {
      iconHtml = renderItemIcon(1);
      nameHtml = "Zeny";
    } else if (entry.type === "gold") {
      iconHtml = renderItemIcon(SPECIAL_ITEMS.GOLD);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a>`;
    } else if (entry.type === "credit") {
      iconHtml = renderItemIcon(SPECIAL_ITEMS.CREDIT);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a>`;
    } else {
      iconHtml = renderItemIcon(entry.itemId);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${entry.itemId})">${entry.name}</a>`;
    }

    let zenyVal = 0;
    if (entry.type === "zeny")        zenyVal = entry.amount;
    else if (entry.type === "gold")   zenyVal = entry.amount * getGoldValue();
    else if (entry.type === "credit") zenyVal = entry.amount * getCreditValue();
    else                              zenyVal = entry.amount * entry.value;

    const subLine = (entry.type !== "zeny" && zenyVal > 0)
      ? `<div class="mat-row-sub mat-row-sub--val">${formatZenyCompact(zenyVal)} zeny</div>`
      : "";

    return `
      <div class="tot-row">
        <span class="mat-xbtn-ph"></span>
        ${iconHtml}
        <span class="tot-name">${nameHtml}${slot}</span>
        <span class="tot-amt"><span class="mat-x">×</span>${fmtAmt}</span>
      </div>${subLine}`;
  }).join("");

  return html;
}

function shopGenerateCombinations(items) {
  if (items.length === 0) return [{}];
  const [first, ...rest] = items;
  const [itemId, { shops }] = first;
  const restCombos = shopGenerateCombinations(rest);
  const result = [];
  for (const shop of shops) {
    for (const combo of restCombos) {
      result.push({ ...combo, [itemId]: shop });
    }
  }
  return result;
}

function shopSwitchSummaryTab(index) {
  document.querySelectorAll(".summary-tab").forEach((tab, idx) => {
    tab.classList.toggle("active", idx === index);
  });
  document.querySelectorAll(".summary-tab-content").forEach((content, idx) => {
    content.classList.toggle("active", idx === index);
  });
}

// ===== UTILITY FUNCTIONS =====

function buildShopIndex() {
  const index = new Map();
  
  if (!Array.isArray(DATA.shopGroups)) {
    return index;
  }
  
  DATA.shopGroups.forEach(group => {
    if (!group || !Array.isArray(group.subgroups)) return;
    
    group.subgroups.forEach(subgroup => {
      if (!subgroup || !Array.isArray(subgroup.shops)) return;
      
      subgroup.shops.forEach(shop => {
        if (!shop || !shop.producesId) return;
        
        if (!index.has(shop.producesId)) {
          index.set(shop.producesId, []);
        }
        index.get(shop.producesId).push(shop);
      });
    });
  });
  return index;
}

function hasNestedShops() {
  if (!state.selectedShop) return false;
  const shopIndex = buildShopIndex();
  return state.selectedShop.requirements.some(
    req => req.type === "item" && shopIndex.has(req.id)
  );
}

function shopToggleTotals() {
  state.showFullTotals = !state.showFullTotals;
  renderShopContent();
}

// ===== SHOP EDITING =====

function addShop(groupIdx, subIdx) {
  const shop = {
    name: "New Shop",
    producesId: null,
    accountBound: false,
    requirements: []
  };
  DATA.shopGroups[groupIdx].subgroups[subIdx].shops.push(shop);
  selectShop(DATA.shopGroups[groupIdx], DATA.shopGroups[groupIdx].subgroups[subIdx], shop);
}

function updateShopName(value) {
  state.selectedShop.name = value;
  render();
}

function shopUpdateProducesId(itemId) {
  if (!state.selectedShop) return;
  state.selectedShop.producesId = itemId;
  if (itemId && DATA.items[itemId]) {
    const item = DATA.items[itemId];
    state.selectedShop.name = getItemDisplayName(item) || state.selectedShop.name;
  }
  const dropdown = document.getElementById("produces-dropdown");
  if (dropdown) dropdown.classList.remove("block");
  saveData();
  renderShopContent();
}

function updateShopAccountBound(checked) {
  state.selectedShop.accountBound = checked;
  render();
}

function shopAddRequirement() {
  state.selectedShop.requirements.push({ type: "item", id: null, amount: 1 });
  render();
}

function shopDeleteRequirement(idx) {
  state.selectedShop.requirements.splice(idx, 1);
  render();
}

function shopUpdateReqType(idx, value) {
  const req = state.selectedShop.requirements[idx];
  req.type = value;
  if (value !== "item") delete req.id;
  if (!req.immune) delete req.immune;
  render();
}

function shopUpdateReqId(idx, value) {
  state.selectedShop.requirements[idx].id = value ? parseInt(value) : null;
  render();
}

function shopUpdateReqAmount(idx, value) {
  state.selectedShop.requirements[idx].amount = parseFloat(value) || 0;
  render();
}

function shopUpdateReqImmune(idx, checked) {
  checked ? state.selectedShop.requirements[idx].immune = true : delete state.selectedShop.requirements[idx].immune;
  render();
}

// ===== AUTOCOMPLETE =====

function shopSetupProducesSearch(input) {
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
    .filter(i => (i.name && i.name.toLowerCase().includes(query)) || i.id.toString().includes(query))
    .slice(0, 10);

  if (matches.length > 0) {
    dropdown.classList.add("block");
    matches.forEach(match => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.innerHTML = `${getItemDisplayName(match) || "Unknown"} <span class="autocomplete-item-id">[${match.id}]</span>`;
      div.onclick = e => {
        e.stopPropagation();
        shopUpdateProducesId(match.id);
      };
      dropdown.appendChild(div);
    });
  } else {
    dropdown.classList.remove("block");
  }
}

function shopSetupAutocomplete(input, idx) {
  input.addEventListener("input", e => {
    const value = e.target.value.toLowerCase();
    if (value.length < 1) {
      shopHideAutocomplete(idx);
      return;
    }

    const items = getAllItems();
    const queryNum = parseInt(value, 10);
    const isNumericQuery = !isNaN(queryNum) && value === queryNum.toString();
    let matches = [];

    if (isNumericQuery) {
      const exactMatch = items.find(item => item.id === queryNum);
      if (exactMatch) {
        matches = [exactMatch, ...items.filter(item => 
          item.id !== queryNum && 
          (item.name.toLowerCase().includes(value) || item.id.toString().includes(value))
        ).slice(0, 9)];
      } else {
        matches = items.filter(item => 
          item.name.toLowerCase().includes(value) || item.id.toString().includes(value)
        ).slice(0, 10);
      }
    } else {
      const lowerQuery = value.toLowerCase();
      matches = items.filter(item => 
        item.name.toLowerCase().includes(lowerQuery) || item.id.toString().includes(lowerQuery)
      ).sort((a, b) => {
        const aNameLower = a.name.toLowerCase();
        const bNameLower = b.name.toLowerCase();
        if (aNameLower === lowerQuery) return -1;
        if (bNameLower === lowerQuery) return 1;
        if (aNameLower.startsWith(lowerQuery) && !bNameLower.startsWith(lowerQuery)) return -1;
        if (!aNameLower.startsWith(lowerQuery) && bNameLower.startsWith(lowerQuery)) return 1;
        return a.id - b.id;
      }).slice(0, 10);
    }

    matches.length > 0 ? shopShowAutocomplete(idx, matches) : shopHideAutocomplete(idx);
  });

  input.addEventListener("blur", () => setTimeout(() => shopHideAutocomplete(idx), 200));
}

function shopShowAutocomplete(idx, items) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (!dropdown) return;

  dropdown.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.innerHTML = `${getItemDisplayName(item)}<span class="autocomplete-item-id">[${item.id}]</span>`;
    div.addEventListener('mousedown', e => {
      e.preventDefault();
      shopSelectAutocomplete(idx, item.id);
    });
    dropdown.appendChild(div);
  });
  dropdown.classList.add("block");
}

function shopHideAutocomplete(idx) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (dropdown) dropdown.classList.remove("block");
}

function shopSelectAutocomplete(idx, itemId) {
  if (state.selectedShop && state.selectedShop.requirements[idx]) {
    state.selectedShop.requirements[idx].id = itemId;
    render();
  }
}

// Global click handler to close dropdowns
document.addEventListener("click", e => {
  const dropdown = document.getElementById("produces-dropdown");
  if (dropdown && !e.target.closest(".search-container")) {
    dropdown.classList.remove("block");
  }
});

// ===== ERROR-WRAPPED RENDER FUNCTIONS =====

// Wrap render functions with error boundaries and data validation
window.renderShopsSidebar = withErrorBoundary(
  withDataValidation(renderShopsSidebarCore, 'renderShopsSidebar', ['DATA.shopGroups']),
  'renderShopsSidebar'
);

window.renderShopContent = withErrorBoundary(
  withDataValidation(renderShopContentCore, 'renderShopContent', ['DATA.items']),
  'renderShopContent'
);

// ===== EXPOSE FUNCTIONS CALLED FROM HTML =====

// Navigation and selection
window.navigateToShop = navigateToShop;
window.toggleShopGroup = toggleShopGroup;
window.toggleShopSubgroup = toggleShopSubgroup;
window.selectShop = selectShop;
window.selectShopById = selectShopById;

// Shop editing
window.addShop = addShop;
window.updateShopName = updateShopName;
window.shopUpdateProducesId = shopUpdateProducesId;
window.updateShopAccountBound = updateShopAccountBound;
window.shopAddRequirement = shopAddRequirement;
window.shopDeleteRequirement = shopDeleteRequirement;
window.shopUpdateReqType = shopUpdateReqType;
window.shopUpdateReqId = shopUpdateReqId;
window.shopUpdateReqAmount = shopUpdateReqAmount;
window.shopUpdateReqImmune = shopUpdateReqImmune;

// Autocomplete
window.shopSetupProducesSearch = shopSetupProducesSearch;
window.shopSetupAutocomplete = shopSetupAutocomplete;
window.shopSelectAutocomplete = shopSelectAutocomplete;

// Utility functions
window.shopToggleTotals = shopToggleTotals;
window.shopSwitchSummaryTab = shopSwitchSummaryTab;