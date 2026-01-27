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

function selectQuest(group, subgroup, quest) {
  state.selectedQuest = quest;
  state.selectedGroup = group;
  state.selectedSubgroup = subgroup;
  render();
}

// ===== SIDEBAR RENDERING =====

function renderSidebar() {
  const container = document.getElementById("treeContainer");
  container.innerHTML = "";
  const filter = state.questSearchFilter;

  DATA.groups.forEach((group, groupIdx) => {
    const { hasMatch, matchingSubgroups } = getGroupMatches(group, filter);
    if (filter && !hasMatch) return;

    const groupDiv = createGroupElement(group, groupIdx, filter, matchingSubgroups);
    container.appendChild(groupDiv);
  });
}

function getGroupMatches(group, filter) {
  if (!filter) return { hasMatch: true, matchingSubgroups: [] };
  
  let hasMatch = false;
  const matchingSubgroups = [];

  group.subgroups.forEach((subgroup, subIdx) => {
    if (subgroup.quests.some(q => q.name.toLowerCase().includes(filter))) {
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

  if (isExpanded) {
    group.subgroups.forEach((subgroup, subIdx) => {
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
    <span class="expand-icon ${isExpanded ? "expanded" : ""}">▶</span>
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

  if (isSubExpanded) {
    const matchingQuests = filter 
      ? subgroup.quests.filter(q => q.name.toLowerCase().includes(filter))
      : subgroup.quests;

    matchingQuests.forEach((quest, questIdx) => {
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
    <span class="expand-icon ${isSubExpanded ? "expanded" : ""}">▶</span>
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
          ${renderProducesSelector(quest, item)}
          ${renderSuccessRateInput(quest)}
          ${renderBoundCheckbox(quest)}
        </div>
      </div>

      ${renderRequirementsSection(quest)}

      ${descriptionHtml ? `
        <span class="item-label">Item Description:</span>
        <div class="item-description-box">${quest.producesId ? `<div class="desc-box-icon">${renderItemIcon(quest.producesId, "icon48")}</div>` : ''}${descriptionHtml}</div>
      ` : ""}
      
      <span class="item-label">Tree:</span>
      <div class="material-tree">${renderMaterialTree()}</div>

      ${renderTotalsHeader()}
      <div class="summary-section">
        ${renderSummary()}
        <span class="quest-footer-badge">${quest.successRate}% Success Rate</span>
      </div>
    </div>
  `;

  document.querySelectorAll(".req-search-input").forEach(input => {
    setupAutocomplete(input, parseInt(input.getAttribute("data-idx")));
  });
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
  if (!hasNestedQuests()) return '<span class="item-label">Totals:</span>';
  
  return `
    <div class="totals-header">
      <span class="item-label">Totals:</span>
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
  { value: 'hall_of_heritage_points', label: 'HoH Points' }
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
  event_points: 'Event Points'
};

function renderMaterialTree() {
  const questIndex = buildQuestIndex();
  const lines = [];
  const MAX_DEPTH = 10;

  function walk(quest, depth, multiplier, questPath = new Set(), parentKey = "", parentExpanded = true) {
    if (questPath.has(quest) || depth > MAX_DEPTH) return;
    const newPath = new Set(questPath).add(quest);

    quest.requirements.forEach((req, reqIdx) => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      const indent = "  ".repeat(depth);
      const connector = depth > 0 ? "└─ " : "";
      const immuneBadge = req.immune ? ' <span class="text-immune">[IMMUNE]</span>' : "";
      const itemKey = `${parentKey}-${depth}-${reqIdx}`;
      const isExpanded = state.expandedTreeItems.has(itemKey);
      const hasChildren = req.type === "item" && questIndex.has(req.id);
      const isVisible = depth === 0 || parentExpanded;

      if (req.type === "item" && questIndex.has(req.id)) {
        renderTreeItemWithQuests(req, questIndex, indent, connector, itemKey, isExpanded, hasChildren, effectiveAmount, immuneBadge, depth, lines, isVisible, newPath, walk);
      } else {
        renderTreeLeafItem(req, effectiveAmount, indent, connector, immuneBadge, depth, lines, isVisible);
      }
    });
  }

  walk(state.selectedQuest, 0, 1, new Set(), "", true);
  return lines.length === 0 ? '<div class="tree-line">No requirements</div>' : 
         lines.filter(l => l.visible).map(l => `<div class="tree-line level-${l.level}">${l.text}</div>`).join("");
}

function renderTreeItemWithQuests(req, questIndex, indent, connector, itemKey, isExpanded, hasChildren, effectiveAmount, immuneBadge, depth, lines, isVisible, newPath, walk) {
  const item = getItem(req.id);
  const quests = questIndex.get(req.id);
  const expandIcon = hasChildren ? `<span class="tree-expand-icon ${isExpanded ? "expanded" : ""}" onclick="toggleTreeItem('${itemKey}')">▶</span> ` : "";

  if (quests.length === 1) {
    lines.push({
      level: depth,
      text: `${indent}${connector}${expandIcon}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`,
      visible: isVisible
    });
    walk(quests[0], depth + 1, effectiveAmount, newPath, itemKey, isExpanded);
  } else {
    lines.push({
      level: depth,
      text: `${indent}${connector}${expandIcon}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item)}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge} <span class="text-warning-xs">[${quests.length} OPTIONS]</span>`,
      visible: isVisible
    });

    if (isExpanded) {
      quests.forEach((q, idx) => {
        const optionIndent = "  ".repeat(depth + 1);
        const optionKey = `${itemKey}-opt${idx}`;
        lines.push({
          level: depth + 1,
          text: `${optionIndent}<span class="text-muted">Option ${idx + 1}: ${q.name} (${q.successRate}% success)</span>`,
          visible: isExpanded
        });
        walk(q, depth + 2, effectiveAmount, newPath, optionKey, true);
      });
    }
  }
}

function renderTreeLeafItem(req, effectiveAmount, indent, connector, immuneBadge, depth, lines, isVisible) {
  let text = "";
  
  if (req.type === "zeny") {
    text = `${indent}${connector}<span class="tree-item-name">Zeny</span> × <span class="tree-amount">${effectiveAmount.toLocaleString()}</span>${immuneBadge}`;
  } else if (req.type === "credit") {
    const zenyValue = effectiveAmount * getCreditValue();
    text = `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">Credit</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`;
  } else if (req.type === "gold") {
    const zenyValue = effectiveAmount * getGoldValue();
    text = `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">Gold</a> × <span class="tree-amount">${effectiveAmount}</span> <span class="text-muted">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`;
  } else if (CURRENCY_NAMES[req.type]) {
    text = `${indent}${connector}<span class="tree-item-name">${CURRENCY_NAMES[req.type]}</span> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`;
  } else if (req.type === "item") {
    const item = getItem(req.id);
    text = `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${req.id})">${getItemDisplayName(item) || "Unknown"}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`;
  }

  if (text) lines.push({ level: depth, text, visible: isVisible });
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

  function scan(quest, questPath = new Set()) {
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath).add(quest);

    quest.requirements.forEach(req => {
      if (req.type === "item" && questIndex.has(req.id)) {
        const quests = questIndex.get(req.id);
        if (quests.length > 1) {
          multiQuestItems.set(req.id, { name: getItem(req.id).name, quests });
        }
        scan(quests[0], newPath);
      }
    });
  }

  scan(state.selectedQuest);
  return multiQuestItems;
}

function renderMultiOptionSummary(multiQuestItems, questIndex) {
  const items = Array.from(multiQuestItems.entries());
  const combinations = generateCombinations(items);
  const tabLabels = combinations.map(combo => generateTabLabel(combo));

  return `
    <div class="summary-tabs-container">
      <div class="summary-tabs">
        ${combinations.map((combo, idx) => `
          <div class="summary-tab ${idx === 0 ? "active" : ""}" 
               onclick="switchSummaryTab(${idx})"
               title="${tabLabels[idx]}">
            Option ${idx + 1} ${tabLabels[idx]}
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
  const labels = [];
  for (const [, quest] of Object.entries(combo)) {
    let groupName = "", subgroupName = "";
    DATA.groups.forEach(group => {
      group.subgroups.forEach(subgroup => {
        if (subgroup.quests.includes(quest)) {
          groupName = group.name;
          subgroupName = subgroup.name;
        }
      });
    });
    labels.push(`(${groupName} / ${subgroupName})`);
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
        const quests = questIndex.get(req.id);
        const chosenQuest = questChoices[req.id] || quests[0];
        accumulate(chosenQuest, effectiveAmount, newPath);
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
  let html = "";

  if (totalZeny > 0) {
    html += `
      <div class="summary-item summary-total-row">
        <span class="summary-name summary-total-label">Total Zeny Value</span>
        <span class="summary-amount summary-total-amount">${totalZeny.toLocaleString()}</span>
      </div>
    `;
  }

  html += entries.map(entry => {
    const displayAmount = entry.type === "zeny" ? entry.amount.toLocaleString() : entry.amount;
    let extra = "";
    
    if (entry.type === "credit") {
      extra = ` <span class="text-muted-sm">(${(entry.amount * getCreditValue()).toLocaleString()} zeny)</span>`;
    } else if (entry.type === "gold") {
      extra = ` <span class="text-muted-sm">(${(entry.amount * getGoldValue()).toLocaleString()} zeny)</span>`;
    } else if (entry.type === "item" && entry.value > 0) {
      extra = ` <span class="text-muted-sm">(${(entry.amount * entry.value).toLocaleString()} zeny)</span>`;
    }

    // Add slot display for items
    const slotDisplay = entry.type === "item" && entry.slot > 0 ? ` [${entry.slot}]` : '';
    
    iconHtml = '';
    nameHtml = '';

    // Make item names clickable
    if(entry.type === "item" && entry.itemId) {
      iconHtml = renderItemIcon(entry.itemId);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${entry.itemId})">${entry.name}${slotDisplay}</a>`;
    } else if (entry.type === "zeny") {
      iconHtml = renderItemIcon(1);
      nameHtml = `${entry.name}${slotDisplay}`;
    } else if(entry.type === "gold") {
      iconHtml = renderItemIcon(SPECIAL_ITEMS.GOLD);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.GOLD})">${entry.name}${slotDisplay}</a>`;
    } else if(entry.type === "credit") {
      iconHtml = renderItemIcon(SPECIAL_ITEMS.CREDIT);
      nameHtml = `<a class="item-link" onclick="navigateToItem(${SPECIAL_ITEMS.CREDIT})">${entry.name}${slotDisplay}</a>`;
    } else {
      iconHtml = renderItemIcon(2);
      nameHtml = `${entry.name}${slotDisplay}`;
    }

    return `
      <div class="summary-item">
        ${iconHtml}
        <span class="summary-name">${nameHtml}</span>
        <span class="summary-amount">${displayAmount}${extra}</span>
      </div>
    `;
  }).join("");

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
  DATA.groups.forEach(group => {
    group.subgroups.forEach(subgroup => {
      subgroup.quests.forEach(quest => {
        if (!index.has(quest.producesId)) {
          index.set(quest.producesId, []);
        }
        index.get(quest.producesId).push(quest);
      });
    });
  });
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