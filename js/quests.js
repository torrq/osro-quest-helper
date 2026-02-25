// quests.js - Quest Rendering, Editing, and Tree Logic

// ===== NAVIGATION & SELECTION =====

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

function toggleGroup(idx) {
  state.expandedGroups.has(idx) 
    ? state.expandedGroups.delete(idx) 
    : state.expandedGroups.add(idx);
  render();
}

function toggleSubgroup(groupIdx, subIdx) {
  const key = `${groupIdx}-${subIdx}`;
  state.expandedSubgroups.has(key)
    ? state.expandedSubgroups.delete(key)
    : state.expandedSubgroups.add(key);
  render();
}

function selectQuest(group, subgroup, quest, pushToHistory = true) {
  state.selectedQuest = quest;
  state.selectedGroup = group;
  state.selectedSubgroup = subgroup;
  
  // Update URL with quest ID for sharing and browser history
  // Only push to history if this is a user-initiated click (not browser navigation)
  if (quest && quest.producesId && typeof updateURL === 'function') {
    updateURL(quest.producesId.toString(), 'quest', pushToHistory);
  }
  
  render();
}

// ===== SIDEBAR RENDERING =====

function renderSidebarCore() {
  const container = document.getElementById("treeContainer");
  
  if (!container) {
    console.warn('[renderSidebar] Container element not found');
    return;
  }
  
  container.innerHTML = "";
  const filter = state.questSearchFilter;

  if (!Array.isArray(DATA.groups)) {
    console.warn('[renderSidebar] DATA.groups is not an array');
    return;
  }

  DATA.groups.forEach((group, groupIdx) => {
    if (!group) return;
    
    const { hasMatch, matchingSubgroups } = getGroupMatches(group, filter);
    if (filter && !hasMatch) return;

    const groupDiv = createGroupElement(group, groupIdx, filter, matchingSubgroups);
    container.appendChild(groupDiv);
  });
}

function getGroupMatches(group, filter) {
  if (!filter) return { hasMatch: true, matchingSubgroups: [] };
  
  if (!group || !Array.isArray(group.subgroups)) {
    return { hasMatch: false, matchingSubgroups: [] };
  }
  
  let hasMatch = false;
  const matchingSubgroups = [];

  group.subgroups.forEach((subgroup, subIdx) => {
    if (!subgroup || !Array.isArray(subgroup.quests)) return;
    
    if (subgroup.quests.some(q => q && q.name && q.name.toLowerCase().includes(filter))) {
      hasMatch = true;
      matchingSubgroups.push(subIdx);
    }
  });

  return { hasMatch, matchingSubgroups };
}

function createGroupElement(group, groupIdx, filter, matchingSubgroups) {
  const groupDiv = document.createElement("div");
  groupDiv.className = "group";
  const isExpanded = filter || state.expandedGroups.has(groupIdx);

  groupDiv.appendChild(createGroupHeader(group, groupIdx, isExpanded));

  if (isExpanded && Array.isArray(group.subgroups)) {
    group.subgroups.forEach((subgroup, subIdx) => {
      if (!subgroup) return;
      if (filter && !matchingSubgroups.includes(subIdx)) return;
      groupDiv.appendChild(createSubgroupElement(group, subgroup, groupIdx, subIdx, filter));
    });
  }

  return groupDiv;
}

function createGroupHeader(group, groupIdx, isExpanded) {
  const header = document.createElement("div");
  header.className = "group-header clickable";
  header.onclick = () => toggleGroup(groupIdx);
  header.innerHTML = `
    <span class="expand-icon ${isExpanded ? "expanded" : ""}">⯈</span>
    <div class="group-name-container">
      <span class="group-name-readonly">${group.name}</span>
      ${group.caption ? `<span class="group-caption">${group.caption}</span>` : ""}
    </div>
  `;
  return header;
}

function createSubgroupElement(group, subgroup, groupIdx, subIdx, filter) {
  const subDiv = document.createElement("div");
  subDiv.className = "subgroup";
  const isSubExpanded = filter || state.expandedSubgroups.has(`${groupIdx}-${subIdx}`);

  subDiv.appendChild(createSubgroupHeader(subgroup, groupIdx, subIdx, isSubExpanded));

  if (isSubExpanded && Array.isArray(subgroup.quests)) {
    subgroup.quests.forEach((quest, questIdx) => {
    if (!quest) return;
    if (filter && !(quest.name && quest.name.toLowerCase().includes(filter))) return;
    subDiv.appendChild(createQuestElement(group, subgroup, quest, groupIdx, subIdx, questIdx));
  });

    if (!filter && state.editorMode) {
      subDiv.appendChild(createAddQuestButton(groupIdx, subIdx));
    }
  }

  return subDiv;
}

function createSubgroupHeader(subgroup, groupIdx, subIdx, isSubExpanded) {
  const subHeader = document.createElement("div");
  subHeader.className = "subgroup-header clickable";
  subHeader.onclick = () => toggleSubgroup(groupIdx, subIdx);
  subHeader.innerHTML = `
    <span class="expand-icon ${isSubExpanded ? "expanded" : ""}">▷</span>
    <span class="subgroup-name-readonly">${subgroup.name}</span>
  `;
  return subHeader;
}

function createQuestElement(group, subgroup, quest, groupIdx, subIdx, questIdx) {
  const questDiv = document.createElement("div");
  questDiv.className = "quest-item";
  if (state.selectedQuest === quest) questDiv.classList.add("active");
  questDiv.draggable = state.editorMode;
  
  // Get icon HTML
  const iconHtml = quest.producesId ? renderItemIcon(quest.producesId) : '';
  
  questDiv.innerHTML = `
    <span class="drag-handle">${state.editorMode ? "⋮⋮" : ""}</span>
    ${iconHtml}
    <span class="quest-name">${quest.name}</span>
  `;

  if (state.editorMode) {
    setupDragAndDrop(questDiv, questIdx, groupIdx, subIdx, subgroup);
  }

  questDiv.querySelector(".quest-name").onclick = () => {
    selectQuest(group, subgroup, quest);
    if (window.innerWidth <= 768) toggleSidebar();
  };

  return questDiv;
}

function setupDragAndDrop(questDiv, questIdx, groupIdx, subIdx, subgroup) {
  questDiv.addEventListener("dragstart", () => {
    state.draggedQuest = questIdx;
    state.draggedFrom = { groupIdx, subIdx };
    questDiv.classList.add("dragging");
  });

  questDiv.addEventListener("dragend", () => {
    questDiv.classList.remove("dragging");
    document.querySelectorAll(".quest-item").forEach(el => el.classList.remove("drag-over"));
  });

  questDiv.addEventListener("dragover", e => e.preventDefault());

  questDiv.addEventListener("dragenter", () => {
    if (state.draggedQuest !== questIdx || 
        state.draggedFrom.groupIdx !== groupIdx || 
        state.draggedFrom.subIdx !== subIdx) {
      questDiv.classList.add("drag-over");
    }
  });

  questDiv.addEventListener("dragleave", () => questDiv.classList.remove("drag-over"));

  questDiv.addEventListener("drop", (e) => {
    e.preventDefault();
    questDiv.classList.remove("drag-over");

    if (state.draggedFrom.groupIdx === groupIdx && state.draggedFrom.subIdx === subIdx) {
      const quests = subgroup.quests;
      const [removed] = quests.splice(state.draggedQuest, 1);
      const newIdx = questIdx > state.draggedQuest ? questIdx - 1 : questIdx;
      quests.splice(newIdx, 0, removed);
      render();
    }
  });
}

function createAddQuestButton(groupIdx, subIdx) {
  const addQuestBtn = document.createElement("button");
  addQuestBtn.className = "btn btn-sm btn-indent-quest";
  addQuestBtn.textContent = "+ Quest";
  addQuestBtn.onclick = () => addQuest(groupIdx, subIdx);
  return addQuestBtn;
}

// ===== QUEST CONTENT RENDERING =====

function renderQuestContentCore() {
  const container = document.getElementById("mainContent");
  
  if (!container) {
    console.warn('[renderQuestContent] Container element not found');
    return;
  }

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

      ${state.editorMode ? `
        <span class="item-label">Quest Name:</span>
        <div class="form-group">
          <input type="text" placeholder="Quest Name" value="${quest.name}" onchange="updateQuestName(this.value)">
        </div>
        <div class="form-group">
          <div class="quest-info-row">
            ${renderProducesSelector(quest, item)}
            ${renderSuccessRateInput(quest)}
            ${renderBoundCheckbox(quest)}
          </div>
        </div>
      ` : renderQuestViewerHeader(quest, item)}

      ${renderRequirementsSection(quest)}

      ${descriptionHtml ? `
        <span class="item-label">Description:</span>
        <div class="item-description-box">${descriptionHtml}</div>
      ` : ""}
      
      <span class="item-label">Requirements:</span>
      <div class="material-tree">${renderMaterialTree()}</div>

      ${renderTotalsHeader()}
      <div class="summary-section">
        ${renderSummary()}
      </div>

      <div class="quest-footer-actions">
        <button class="btn btn-sm copy-link-btn" onclick="copyQuestLink()" title="Copy link to this quest">
          🔗 Copy Link
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll(".req-search-input").forEach(input => {
    setupAutocomplete(input, parseInt(input.getAttribute("data-idx")));
  });
}

function renderQuestViewerHeader(quest, item) {
  const icon48  = quest.producesId ? renderItemIcon(quest.producesId, 48) : '';
  const itemId  = quest.producesId ? `<span class="qvh-id">#${quest.producesId}</span>` : '';
  const slot    = item && Number(item.slot) > 0 ? `<span class="qvh-item-slots">[${item.slot}]</span>` : '';
  const name    = quest.producesId
    ? `<a class="item-link qvh-item-name" onclick="navigateToItem(${quest.producesId})">${item ? (item.name || 'Unknown') : 'Unknown'}</a>${slot}`
    : `<span class="qvh-item-name qvh-item-name--none">No item produced</span>`;
  const rate    = quest.successRate < 100
    ? `<span class="qvh-rate qvh-rate--partial">${quest.successRate}% Success</span>`
    : `<span class="qvh-rate qvh-rate--full">100% Success</span>`;
  const bound   = quest.accountBound
    ? `<span class="qvh-bound">Account Bound</span>`
    : '';

  return `
    <div class="qvh">
      <div class="qvh-icon">${icon48}</div>
      <div class="qvh-body">
        <div class="qvh-title-row">${name}${itemId}</div>
        <div class="qvh-meta">${rate}${bound}</div>
      </div>
    </div>
  `;
}

function renderProducesSelector(quest, item) {
  return `
    <div class="item-selector-wrapper">
      <span class="item-label label-block">Produces Item:</span>
      ${quest.producesId ? `
        <div class="item-selected-badge">
          <strong><a class="item-link tree-item-name" onclick="navigateToItem(${quest.producesId})">${getItemDisplayName(item)}</a></strong>
          ${state.editorMode ? `<button class="clear-btn" onclick="updateProducesId(null)">×</button>` : ''}
        </div>
      ` : state.editorMode ? `
        <div class="search-container">
          <input type="text" id="produces-search" placeholder="Search item to produce..." oninput="setupProducesSearch(this)">
          <div id="produces-dropdown" class="autocomplete-dropdown"></div>
        </div>
      ` : `
        <div class="text-muted">No item produced</div>
      `}
    </div>
  `;
}

function renderSuccessRateInput(quest) {
  if (!state.editorMode) return '';
  return `
    <div>
      <span class="item-label label-block">Success Rate:</span>
      <input type="number" class="input-width-sm" min="1" max="100" placeholder="%" 
             value="${quest.successRate}" onchange="updateSuccessRate(this.value)">
    </div>
  `;
}

function renderBoundCheckbox(quest) {
  return `
    <div class="quest-bound">
      <span class="item-label label-block">Bound:</span>
      <input type="checkbox" ${quest.accountBound ? "checked" : ""} 
             onchange="updateQuestAccountBound(this.checked)">
    </div>
  `;
}

function renderRequirementsSection(quest) {
  return `
    <div class="requirements-wrapper">
      <span class="item-label">Requirements: &nbsp;<button class="btn btn-sm btn-primary" onclick="addRequirement()">+ Add</button></span>
      <div class="requirements-section">
        <div class="requirements-grid">
          ${quest.requirements.map((req, idx) => renderRequirement(req, idx)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderTotalsHeader() {
  if (!hasNestedQuests()) return '<span class="item-label">Value:</span>';
  
  return `
    <div class="totals-header">
      <span class="item-label">Value:</span>
      <button class="btn btn-sm btn-toggle-totals" onclick="toggleTotals()">
        ${state.showFullTotals ? "This Quest Only" : "Include Sub-Quests"}
      </button>
    </div>
  `;
}

// ===== REQUIREMENT RENDERING =====

const REQ_TYPE_OPTIONS = [
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
  { value: 'cardo_points', label: 'Cardo Points'}
];

function renderRequirement(req, idx) {
  const isItem = req.type === "item";
  const item = isItem ? getItem(req.id) : null;

  return `
    <div class="requirement-card">
      <button class="remove-btn" onclick="deleteRequirement(${idx})" title="Remove">×</button>
      
      <div class="req-top-row">
        <select onchange="updateReqType(${idx}, this.value)">
          ${REQ_TYPE_OPTIONS.map(opt => 
            `<option value="${opt.value}" ${req.type === opt.value ? "selected" : ""}>${opt.label}</option>`
          ).join('')}
        </select>
        <input type="number" placeholder="Amount" value="${req.amount}" 
               onchange="updateReqAmount(${idx}, this.value)">
      </div>

      ${isItem ? renderItemRequirement(req, idx, item) : ""}

      <div class="checkbox-group">
        <label class="checkbox-label text-muted-xs opacity-80">
          <input type="checkbox" ${req.immune ? "checked" : ""} 
                 onchange="updateReqImmune(${idx}, this.checked)">Immune
        </label>
      </div>
    </div>
  `;
}

function renderItemRequirement(req, idx, item) {
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
          <button class="clear-btn ml-auto" onclick="updateReqId(${idx}, null)">×</button>
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

const CURRENCY_NAMES = {
  zeny: 'Zeny',
  credit: 'Credit',
  gold: 'Gold',
  vote_points: 'Vote Points',
  activity_points: 'Activity Points',
  hourly_points: 'Hourly Points',
  monster_arena_points: 'Monster Arena Points',
  otherworld_points: 'Otherworld Points',
  hall_of_heritage_points: 'Hall of Heritage Points',
  cardo_points: 'Cardo Points',
  token_points: 'Token Points',
  event_points: 'Event Points'
};

function renderMaterialTree() {
  const questIndex = buildQuestIndex();
  const MAX_DEPTH = 10;

  function walkQuest(quest, depth, multiplier, questPath, parentKey) {
    if (questPath.has(quest) || depth > MAX_DEPTH) return '';
    const newPath = new Set(questPath).add(quest);
    let html = '';

    // Three-tier sort (stable within each tier):
    //   0 — currencies (zeny, gold, credit): known zeny values, grouped first
    //   1 — plain items and shop-only sources: no expansion
    //   2 — anything expandable (quest source or multi-option): goes to bottom
    const sortTier = r => {
      const CURRENCIES = ['zeny', 'gold', 'credit'];
      if (CURRENCIES.includes(r.type)) return 0;
      if (r.type !== 'item' || !questIndex.has(r.id)) return 1;
      const srcs = questIndex.get(r.id);
      const hasQuest = srcs.some(s => s.type === 'quest');
      const isMulti  = srcs.length > 1;
      return (hasQuest || isMulti) ? 2 : 1;
    };

    const sorted = quest.requirements
      .map((req, originalIdx) => ({ req, originalIdx }))
      .sort((a, b) => sortTier(a.req) - sortTier(b.req));

    sorted.forEach(({ req, originalIdx }) => {
      const eff = (Number(req.amount) || 0) * multiplier;
      const itemKey = `${parentKey}-${depth}-${originalIdx}`;
      const expanded = state.expandedTreeItems.has(itemKey);
      const immuneHtml = req.immune ? `<span class="mat-immune">IMMUNE</span>` : '';

      if (req.type === 'item' && questIndex.has(req.id)) {
        html += _matSourceItem(req, questIndex, eff, immuneHtml, itemKey, expanded, depth, newPath, walkQuest);
      } else {
        html += _matLeaf(req, eff, immuneHtml);
      }
    });
    return html;
  }

  const inner = walkQuest(state.selectedQuest, 0, 1, new Set(), '');
  return inner
    ? `<div class="mat-tree">${inner}</div>`
    : '<div class="tree-line">No requirements</div>';
}

function _matXbtn(itemKey, expanded) {
  return `<div class="mat-xbtn${expanded ? ' open' : ''}" onclick="toggleTreeItem('${itemKey}')">▶</div>`;
}

// aside is rendered as a separate sub-line BELOW the flex row so it
// never competes with the item name or pushes the amount around.
// asideType: 'loc' → left-aligned location, 'val' → right-aligned zeny value.
function _matRow({ xbtn, badge, icon, name, slot, amt, aside, asideType, immune }) {
  const fmtAmt = (typeof amt === 'number' && amt >= 1000)
    ? amt.toLocaleString()
    : amt;
  const subClass = asideType === 'loc' ? 'mat-row-sub mat-row-sub--loc' : 'mat-row-sub mat-row-sub--val';
  const subLine = aside
    ? `<div class="${subClass}">${aside}</div>`
    : '';
  return `
    <div class="mat-row">
      ${xbtn  || '<span class="mat-xbtn-ph"></span>'}
      ${badge || ''}
      ${icon  || ''}
      <span class="mat-name">${name}${slot ? `<span class="mat-slot">${slot}</span>` : ''}</span>
      <span class="mat-amt"><span class="mat-x">×</span>${fmtAmt}</span>
      ${immune || ''}
    </div>${subLine}`;
}

function _matFindQuest(q) {
  let gi = -1, si = -1, qi = -1;
  DATA.groups.forEach((g, gIdx) => {
    g.subgroups.forEach((sg, sIdx) => {
      const idx = sg.quests.indexOf(q);
      if (idx !== -1) { gi = gIdx; si = sIdx; qi = idx; }
    });
  });
  return { gi, si, qi };
}

function _matFindShop(s) {
  let gi = -1, si = -1, shi = -1;
  DATA.shopGroups.forEach((g, gIdx) => {
    g.subgroups.forEach((sg, sIdx) => {
      const idx = sg.shops.indexOf(s);
      if (idx !== -1) { gi = gIdx; si = sIdx; shi = idx; }
    });
  });
  return { gi, si, shi };
}

function _matSourceItem(req, questIndex, eff, immuneHtml, itemKey, expanded, depth, newPath, walkQuest) {
  const item = getItem(req.id);
  const icon = renderItemIcon(req.id);
  const rawName = item ? (item.name || 'Unknown') : 'Unknown';
  const slot = item && Number(item.slot) > 0 ? `[${item.slot}]` : '';
  const sources = questIndex.get(req.id);
  const questSources = sources.filter(s => s.type === 'quest').map(s => s.source);
  const shopSources  = sources.filter(s => s.type === 'shop').map(s => s.source);

  // ---- CASE 1: single quest source, no shops ----
  if (questSources.length === 1 && shopSources.length === 0) {
    const q = questSources[0];
    const loc = findQuestLocation(q);
    const { gi, si, qi } = _matFindQuest(q);
    const xbtn  = _matXbtn(itemKey, expanded);
    const badge = `<span class="quest-badge">Quest</span>`;
    const name  = `<a class="item-link tree-item-name" onclick="navigateToQuest(${gi},${si},${qi})">${rawName}</a>`;
    const children = expanded
      ? `<div class="mat-children">${walkQuest(q, depth + 1, eff, newPath, itemKey)}</div>`
      : '';
    return `<div class="mat-node">${_matRow({ xbtn, badge, icon, name, slot, amt: eff, aside: loc, asideType: 'loc', immune: immuneHtml })}${children}</div>`;
  }

  // ---- CASE 2: single shop source, no quests ----
  if (questSources.length === 0 && shopSources.length === 1) {
    const s = shopSources[0];
    const loc = findShopLocation(s);
    const { gi, si, shi } = _matFindShop(s);
    const badge = `<span class="shop-badge">Shop</span>`;
    const name  = `<a class="item-link tree-item-name" onclick="navigateToShop(${gi},${si},${shi})">${rawName}</a>`;
    return `<div class="mat-node">${_matRow({ badge, icon, name, slot, amt: eff, aside: loc, asideType: 'loc', immune: immuneHtml })}</div>`;
  }

  // ---- CASES 3 & 4: multiple options (quests and/or shops) ----
  const total = questSources.length + shopSources.length;
  const xbtn  = _matXbtn(itemKey, expanded);
  const badge  = `<span class="mat-badge-opts">⚠ ${total} opts</span>`;
  const name   = `<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${rawName}</a>`;

  let optRows = '';
  if (expanded) {
    questSources.forEach(q => {
      const loc = findQuestLocation(q);
      const { gi, si, qi } = _matFindQuest(q);
      const optKey = `${itemKey}-q-${q.producesId}`;
      const sub = walkQuest(q, depth + 2, eff, newPath, optKey);
      optRows += `
        <div class="mat-opt-row">
          <span class="quest-badge">Quest</span>
          <a class="item-link" onclick="navigateToQuest(${gi},${si},${qi})">${loc}</a>
          <span class="mat-aside">${q.successRate}% success</span>
        </div>
        ${sub ? `<div class="mat-children">${sub}</div>` : ''}`;
    });
    shopSources.forEach(s => {
      const loc = findShopLocation(s);
      const { gi, si, shi } = _matFindShop(s);
      optRows += `
        <div class="mat-opt-row">
          <span class="shop-badge">Shop</span>
          <a class="item-link" onclick="navigateToShop(${gi},${si},${shi})">${loc}</a>
        </div>`;
    });
  }

  const children = expanded
    ? `<div class="mat-children mat-children-opts">${optRows}</div>`
    : '';
  return `<div class="mat-node">${_matRow({ xbtn, badge, icon, name, slot, amt: eff, immune: immuneHtml })}${children}</div>`;
}

function _matLeaf(req, eff, immuneHtml) {
  let icon = '', name = '', aside = '', asideType = '', slot = '';

  if (req.type === 'zeny') {
    icon = renderItemIcon(1);
    name = 'Zeny';
  } else if (req.type === 'credit') {
    icon  = renderItemIcon(SPECIAL_ITEMS.CREDIT);
    name  = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a>`;
  } else if (req.type === 'gold') {
    icon  = renderItemIcon(SPECIAL_ITEMS.GOLD);
    name  = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a>`;
  } else if (CURRENCY_NAMES[req.type]) {
    icon  = renderItemIcon(2);
    name  = CURRENCY_NAMES[req.type];
  } else if (req.type === 'item') {
    const item = getItem(req.id);
    icon = renderItemIcon(req.id);
    if (item && Number(item.slot) > 0) slot = `[${item.slot}]`;
    name = `<a class="item-link" onclick="navigateToItem(${req.id})">${item ? (item.name || 'Unknown') : 'Unknown'}</a>`;
  }

  return `<div class="mat-node">${_matRow({ icon, name, slot, amt: eff, aside, asideType, immune: immuneHtml })}</div>`;
}

// Retained from original — used by _matSourceItem above and also by
// renderSummary / generateTabLabel further down in this file.
function findQuestLocation(quest) {
  let location = "";
  DATA.groups.forEach(group => {
    group.subgroups.forEach(subgroup => {
      if (subgroup.quests.includes(quest)) {
        location = `${group.name} / ${subgroup.name}`;
      }
    });
  });
  return location;
}

function findShopLocation(shop) {
  let location = "";
  DATA.shopGroups.forEach(group => {
    group.subgroups.forEach(subgroup => {
      if (subgroup.shops.includes(shop)) {
        location = `${group.name} / ${subgroup.name}`;
      }
    });
  });
  return location;
}

// ===== ZENY FORMATTING =====

function formatZenyCompact(val) {
  if (val >= 1e12) return _fmtSuffix(val, 1e12, "T");
  if (val >= 1e9)  return _fmtSuffix(val, 1e9,  "B");
  if (val >= 1e6)  return _fmtSuffix(val, 1e6,  "M");
  return val.toLocaleString();
}

function _fmtSuffix(val, div, suffix) {
  const raw = val / div;
  // Up to 2 decimal places, strip trailing zeros
  const s = raw % 1 === 0 ? raw.toFixed(0)
          : raw.toFixed(2).replace(/\.?0+$/, "");
  return s + suffix;
}

// ===== SUMMARY RENDERING =====

function renderSummary() {
  if (!state.showFullTotals) return renderDirectRequirements();

  const questIndex = buildQuestIndex();
  const multiQuestItems = findMultiQuestItems(questIndex);

  if (multiQuestItems.size === 0) return renderSingleSummary(questIndex, {});

  return renderMultiOptionSummary(multiQuestItems, questIndex);
}

function findMultiQuestItems(questIndex) {
  const multiQuestItems = new Map();

  function scan(source, sourcePath = new Set()) {
    if (sourcePath.has(source)) return;
    const newPath = new Set(sourcePath).add(source);

    source.requirements.forEach(req => {
      if (req.type === "item" && questIndex.has(req.id)) {
        const sources = questIndex.get(req.id);
        if (sources.length > 1) {
          multiQuestItems.set(req.id, { name: getItem(req.id).name, sources });
        }
        // Recurse into quest sources to find nested multi-option items
        sources.filter(s => s.type === 'quest').forEach(s => scan(s.source, newPath));
      }
    });
  }

  scan(state.selectedQuest);
  return multiQuestItems;
}

function getSourceFingerprint(sources) {
  // Unique key representing a set of sources — items sharing this are the same choice
  return sources.map(s =>
    s.type === 'quest' ? `q:${s.source.producesId}` : `s:${findShopLocation(s.source)}`
  ).sort().join('||');
}

function renderMultiOptionSummary(multiQuestItems, questIndex) {
  const combinations = generateCombinations(multiQuestItems);
  const tabLabels = combinations.map(combo => generateTabLabel(combo));

  return `
    <div class="summary-tabs-container">
      <div class="summary-tabs">
        ${combinations.map((combo, idx) => `
          <div class="summary-tab ${idx === 0 ? "active" : ""}" 
               onclick="switchSummaryTab(${idx})"
               title="${tabLabels[idx]}">
            Option ${idx + 1}: ${tabLabels[idx]}
          </div>
        `).join("")}
      </div>
      ${combinations.map((combo, idx) => `
        <div class="summary-tab-content ${idx === 0 ? "active" : ""}" id="summary-tab-${idx}">
          ${renderSingleSummary(questIndex, combo)}
        </div>
      `).join("")}
    </div>
  `;
}

function generateTabLabel(combo) {
  const seen = new Set();
  const labels = [];
  for (const [, sourceObj] of Object.entries(combo)) {
    let label;
    if (sourceObj.type === 'quest') {
      label = findQuestLocation(sourceObj.source);
    } else if (sourceObj.type === 'shop') {
      label = `${findShopLocation(sourceObj.source)} (Shop)`;
    }
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.join(" | ");
}

function renderDirectRequirements() {
  const { totals, totalZeny } = calculateDirectRequirements();
  const entries = sortTotalEntries(totals);
  
  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  return renderSummaryItems(entries, totalZeny);
}

function calculateDirectRequirements() {
  const quest = state.selectedQuest;
  let totalZeny = 0;
  const totals = {};

  quest.requirements.forEach(req => {
    const effectiveAmount = Number(req.amount) || 0;
    totalZeny += calculateZenyValue(req, effectiveAmount);
    accumulateRequirement(totals, req, effectiveAmount);
  });

  return { totals, totalZeny };
}

function renderSingleSummary(questIndex, questChoices) {
  const { totals, totalZeny } = calculateFullRequirements(questIndex, questChoices);
  const entries = sortTotalEntries(totals);
  
  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }

  return renderSummaryItems(entries, totalZeny);
}

function calculateFullRequirements(questIndex, questChoices) {
  const totals = {};
  let totalZeny = 0;

  function accumulate(quest, multiplier, questPath = new Set()) {
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath).add(quest);

    quest.requirements.forEach(req => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      
      if (req.type === "item" && questIndex.has(req.id)) {
        const sources = questIndex.get(req.id);
        const chosenSourceObj = questChoices[req.id] || sources[0];
        
        // Only recurse if it's a quest
        if (chosenSourceObj.type === 'quest') {
          accumulate(chosenSourceObj.source, effectiveAmount, newPath);
        } else if (chosenSourceObj.type === 'shop') {
          // For shops, add the shop's requirements directly (don't recurse)
          const shop = chosenSourceObj.source;
          shop.requirements.forEach(shopReq => {
            const shopEffectiveAmount = (Number(shopReq.amount) || 0) * effectiveAmount;
            totalZeny += calculateZenyValue(shopReq, shopEffectiveAmount);
            accumulateRequirement(totals, shopReq, shopEffectiveAmount);
          });
        }
      } else {
        totalZeny += calculateZenyValue(req, effectiveAmount);
        accumulateRequirement(totals, req, effectiveAmount);
      }
    });
  }

  accumulate(state.selectedQuest, 1);
  return { totals, totalZeny };
}

function calculateZenyValue(req, amount) {
  if (req.type === "zeny") return amount;
  if (req.type === "credit") return amount * getCreditValue();
  if (req.type === "gold") return amount * getGoldValue();
  if (req.type === "item") return amount * (getItem(req.id).value || 0);
  return 0;
}

function accumulateRequirement(totals, req, effectiveAmount) {
  const key = req.type === "item" ? `item_${req.id}` : req.type;
  const item = req.type === "item" ? getItem(req.id) : null;
  const name = CURRENCY_NAMES[req.type] || (req.type === "item" ? (item?.name || "Unknown") : req.type);

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

function sortTotalEntries(totals) {
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

function renderSummaryItems(entries, totalZeny) {
  // Only show entries that have a known zeny value
  const zenyCurrencies = new Set(["zeny", "gold", "credit"]);
  const valued = entries.filter(e =>
    zenyCurrencies.has(e.type) || (e.type === "item" && e.value > 0)
  );

  if (valued.length === 0) {
    return '<div class="tot-empty">No zeny-valued materials</div>';
  }

  // Total zeny row
  let html = "";
  if (totalZeny > 0) {
    html += `
      <div class="tot-row tot-row--total">
        <span class="tot-label">Total Zeny Value</span>
        <span class="tot-amt">${totalZeny.toLocaleString()}</span>
      </div>`;
  }

  html += valued.map(entry => {
    // Icon
    let iconHtml = "";
    if (entry.type === "zeny")        iconHtml = renderItemIcon(1);
    else if (entry.type === "gold")   iconHtml = renderItemIcon(SPECIAL_ITEMS.GOLD);
    else if (entry.type === "credit") iconHtml = renderItemIcon(SPECIAL_ITEMS.CREDIT);
    else                              iconHtml = renderItemIcon(entry.itemId);

    // Name (clickable where applicable)
    const slot = entry.type === "item" && entry.slot > 0
      ? `<span class="mat-slot">[${entry.slot}]</span>` : "";
    let nameHtml = "";
    if (entry.type === "zeny") {
      nameHtml = `Zeny`;
    } else if (entry.type === "gold") {
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a>`;
    } else if (entry.type === "credit") {
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a>`;
    } else {
      nameHtml = `<a class="item-link" onclick="navigateToItem(${entry.itemId})">${entry.name}</a>`;
    }

    // Amount (formatted)
    const fmtAmt = entry.amount >= 1000
      ? entry.amount.toLocaleString()
      : entry.amount;

    // Zeny sub-value
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

function generateGroupedCombinations(groups) {
  if (groups.length === 0) return [{}];
  const [first, ...rest] = groups;
  const restCombos = generateGroupedCombinations(rest);
  const result = [];
  for (const sourceObj of first.sources) {
    for (const combo of restCombos) {
      const newCombo = { ...combo };
      for (const itemId of first.itemIds) {
        newCombo[itemId] = sourceObj;
      }
      result.push(newCombo);
    }
  }
  return result;
}

function generateCombinations(multiQuestItems) {
  // Group items that share identical source sets into one decision
  const fingerprintToGroup = new Map();
  for (const [itemId, { sources }] of multiQuestItems.entries()) {
    const fp = getSourceFingerprint(sources);
    if (!fingerprintToGroup.has(fp)) {
      fingerprintToGroup.set(fp, { sources, itemIds: [] });
    }
    fingerprintToGroup.get(fp).itemIds.push(itemId);
  }

  // Generate combinations across the unique groups only
  function combineGroups(groups) {
    if (groups.length === 0) return [{}];
    const [first, ...rest] = groups;
    const restCombos = combineGroups(rest);
    const result = [];
    for (const sourceObj of first.sources) {
      for (const combo of restCombos) {
        const newCombo = { ...combo };
        for (const itemId of first.itemIds) {
          newCombo[itemId] = sourceObj; // Same choice applies to all items in this group
        }
        result.push(newCombo);
      }
    }
    return result;
  }

  return combineGroups(Array.from(fingerprintToGroup.values()));
}

function switchSummaryTab(index) {
  document.querySelectorAll(".summary-tab").forEach((tab, idx) => {
    tab.classList.toggle("active", idx === index);
  });
  document.querySelectorAll(".summary-tab-content").forEach((content, idx) => {
    content.classList.toggle("active", idx === index);
  });
}

// ===== UTILITY FUNCTIONS =====

function buildQuestIndex() {
  const index = new Map();
  
  if (!Array.isArray(DATA.groups)) {
    return index;
  }
  
  // Add quests
  DATA.groups.forEach(group => {
    if (!group || !Array.isArray(group.subgroups)) return;
    
    group.subgroups.forEach(subgroup => {
      if (!subgroup || !Array.isArray(subgroup.quests)) return;
      
      subgroup.quests.forEach(quest => {
        if (!quest || !quest.producesId) return;
        
        if (!index.has(quest.producesId)) {
          index.set(quest.producesId, []);
        }
        index.get(quest.producesId).push({ type: 'quest', source: quest });
      });
    });
  });
  
  // Add shops
  if (Array.isArray(DATA.shopGroups)) {
    DATA.shopGroups.forEach(group => {
      if (!group || !Array.isArray(group.subgroups)) return;
      
      group.subgroups.forEach(subgroup => {
        if (!subgroup || !Array.isArray(subgroup.shops)) return;
        
        subgroup.shops.forEach(shop => {
          if (!shop || !shop.producesId) return;
          
          if (!index.has(shop.producesId)) {
            index.set(shop.producesId, []);
          }
          index.get(shop.producesId).push({ type: 'shop', source: shop });
        });
      });
    });
  }
  
  return index;
}

function hasNestedQuests() {
  if (!state.selectedQuest) return false;
  const questIndex = buildQuestIndex();
  return state.selectedQuest.requirements.some(
    req => req.type === "item" && questIndex.has(req.id)
  );
}

function toggleTotals() {
  state.showFullTotals = !state.showFullTotals;
  renderQuestContent();
}

function toggleTreeItem(itemKey) {
  state.expandedTreeItems.has(itemKey)
    ? state.expandedTreeItems.delete(itemKey)
    : state.expandedTreeItems.add(itemKey);
  renderQuestContent();
}

// ===== QUEST EDITING =====

function addQuest(groupIdx, subIdx) {
  const quest = {
    name: "New Quest",
    producesId: null,
    successRate: 100,
    accountBound: false,
    requirements: []
  };
  DATA.groups[groupIdx].subgroups[subIdx].quests.push(quest);
  selectQuest(DATA.groups[groupIdx], DATA.groups[groupIdx].subgroups[subIdx], quest);
}

function updateQuestName(value) {
  state.selectedQuest.name = value;
  render();
}

function updateProducesId(itemId) {
  if (!state.selectedQuest) return;
  state.selectedQuest.producesId = itemId;
  if (itemId && DATA.items[itemId]) {
    const item = DATA.items[itemId];
    state.selectedQuest.name = getItemDisplayName(item) || state.selectedQuest.name;
  }
  const dropdown = document.getElementById("produces-dropdown");
  if (dropdown) dropdown.classList.remove("block");
  saveData();
  renderQuestContent();
}

function updateSuccessRate(value) {
  state.selectedQuest.successRate = Math.max(1, Math.min(100, parseInt(value) || 100));
  render();
}

function updateQuestAccountBound(checked) {
  state.selectedQuest.accountBound = checked;
  render();
}

function addRequirement() {
  state.selectedQuest.requirements.push({ type: "item", id: null, amount: 1 });
  render();
}

function deleteRequirement(idx) {
  state.selectedQuest.requirements.splice(idx, 1);
  render();
}

function updateReqType(idx, value) {
  const req = state.selectedQuest.requirements[idx];
  req.type = value;
  if (value !== "item") delete req.id;
  if (!req.immune) delete req.immune;
  render();
}

function updateReqId(idx, value) {
  state.selectedQuest.requirements[idx].id = value ? parseInt(value) : null;
  render();
}

function updateReqAmount(idx, value) {
  state.selectedQuest.requirements[idx].amount = parseFloat(value) || 0;
  render();
}

function updateReqImmune(idx, checked) {
  checked ? state.selectedQuest.requirements[idx].immune = true : delete state.selectedQuest.requirements[idx].immune;
  render();
}

// ===== AUTOCOMPLETE =====

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
        updateProducesId(match.id);
      };
      dropdown.appendChild(div);
    });
  } else {
    dropdown.classList.remove("block");
  }
}

function setupAutocomplete(input, idx) {
  input.addEventListener("input", e => {
    const value = e.target.value.toLowerCase();
    if (value.length < 1) {
      hideAutocomplete(idx);
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

    matches.length > 0 ? showAutocomplete(idx, matches) : hideAutocomplete(idx);
  });

  input.addEventListener("blur", () => setTimeout(() => hideAutocomplete(idx), 200));
}

function showAutocomplete(idx, items) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (!dropdown) return;

  dropdown.innerHTML = items.map(item => `
    <div class="autocomplete-item" onclick="selectAutocomplete(${idx}, ${item.id})">
      ${getItemDisplayName(item)}<span class="autocomplete-item-id">[${item.id}]</span>
    </div>
  `).join("");
  dropdown.classList.add("block");
}

function hideAutocomplete(idx) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (dropdown) dropdown.classList.remove("block");
}

function selectAutocomplete(idx, itemId) {
  if (state.selectedQuest && state.selectedQuest.requirements[idx]) {
    state.selectedQuest.requirements[idx].id = itemId;
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
window.renderSidebar = withErrorBoundary(
  withDataValidation(renderSidebarCore, 'renderSidebar', ['DATA.groups']),
  'renderSidebar'
);

window.renderQuestContent = withErrorBoundary(
  withDataValidation(renderQuestContentCore, 'renderQuestContent', ['DATA.items']),
  'renderQuestContent'
);

// ===== EXPOSE FUNCTIONS CALLED FROM HTML =====

// Navigation and selection
window.navigateToQuest = navigateToQuest;
window.toggleGroup = toggleGroup;
window.toggleSubgroup = toggleSubgroup;
window.selectQuest = selectQuest;

// Quest editing
window.addQuest = addQuest;
window.updateQuestName = updateQuestName;
window.updateProducesId = updateProducesId;
window.updateSuccessRate = updateSuccessRate;
window.updateQuestAccountBound = updateQuestAccountBound;
window.addRequirement = addRequirement;
window.deleteRequirement = deleteRequirement;
window.updateReqType = updateReqType;
window.updateReqId = updateReqId;
window.updateReqAmount = updateReqAmount;
window.updateReqImmune = updateReqImmune;

// Autocomplete
window.setupProducesSearch = setupProducesSearch;
window.setupAutocomplete = setupAutocomplete;
window.selectAutocomplete = selectAutocomplete;

// Utility functions
window.toggleTotals = toggleTotals;
window.toggleTreeItem = toggleTreeItem;
window.switchSummaryTab = switchSummaryTab;