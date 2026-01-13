// === AUTO-IMPORT CONFIGURATION ===
const AUTO_IMPORT_ON_FIRST_LOAD = true;           // ← change to false to disable
const AUTO_IMPORT_URL = 'https://torrq.github.io/osro-quest-helper/osromr_quests.json';

let DATA = {
  meta: { 
    creditValueZeny: 10000000, 
    creditItemId: 40001,
    goldValueZeny: 124000,
    goldItemId: 969
  },
  items: {},
  groups: []
};

let state = {
  currentTab: 'quests',
  selectedQuest: null,
  selectedItem: null,
  selectedGroup: null,
  selectedSubgroup: null,
  expandedGroups: new Set(),
  expandedSubgroups: new Set(),
  draggedQuest: null,
  draggedFrom: null,
  itemSearchFilter: '',
  questSearchFilter: ''
};

// Initialize data — auto-import remote file on first load if enabled
if (DATA.groups.length === 0) {
  if (AUTO_IMPORT_ON_FIRST_LOAD) {
    fetch(AUTO_IMPORT_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Handle both legacy and new format
        const isLegacy = data.groups?.[0]?.subgroups?.[0]?.quests?.[0]?.produces?.name !== undefined;
        DATA = isLegacy ? convertLegacyFormat(data) : {
          meta: {
            creditValueZeny: data.meta?.creditValueZeny ?? 10000000,
            creditItemId: data.meta?.creditItemId ?? 40001,
            goldValueZeny: data.meta?.goldValueZeny ?? 124000,
            goldItemId: data.meta?.goldItemId ?? 969
          },
          items: data.items || {},
          groups: data.groups || []
        };
        render();
      })
      .catch(err => {
        console.error('Auto-import failed:', err);
        alert('Failed to auto-import quests from remote URL.\n\nCheck console for details.');
        render(); // still show empty state
      });
  } else {
    // Optional: you can leave empty or load something else
    render();
  }
} else {
  render();
}

function convertLegacyFormat(oldData) {
  const items = {};
  const groups = [];
  
  // Extract all items from quests
  oldData.groups?.forEach(group => {
    const newGroup = {
      name: group.name,
      subgroups: []
    };
    
    group.subgroups?.forEach(subgroup => {
      const newSubgroup = {
        name: subgroup.name,
        quests: []
      };
      
      subgroup.quests?.forEach(quest => {
        // Register produced item
        if (quest.produces?.id && quest.produces?.name) {
          if (!items[quest.produces.id]) {
            items[quest.produces.id] = {
              id: quest.produces.id,
              name: quest.produces.name,
              value: 0
            };
          }
        }
        
        // Register requirement items
        quest.requirements?.forEach(req => {
          if (req.type === 'item' && req.id && req.name) {
            if (!items[req.id]) {
              items[req.id] = {
                id: req.id,
                name: req.name,
                value: 0
              };
            }
          }
        });
        
        // Create new quest format
        newSubgroup.quests.push({
          name: quest.name,
          producesId: quest.produces?.id || 0,
          successRate: quest.successRate || 100,
          description: quest.description || '',
          accountBound: quest.accountBound || false,
          requirements: quest.requirements?.map(req => ({
            type: req.type,
            id: req.id,
            amount: req.amount,
            immune: req.immune || false
          })) || []
        });
      });
      
      newGroup.subgroups.push(newSubgroup);
    });
    
    groups.push(newGroup);
  });
  
  return {
    meta: oldData.meta || DATA.meta,
    items,
    groups
  };
}

function getItem(id) {
  if (id === null || id === undefined) {
    return { id: null, name: '', value: 0 };
  }
  return DATA.items[id] || { id, name: '', value: 0 };
}

function ensureItem(id, name) {
  if (id === null || id === undefined || id === '') return null;
  const numId = parseInt(id);
  if (isNaN(numId)) return null;
  
  if (!DATA.items[numId]) {
    DATA.items[numId] = { id: numId, name: name || '', value: 0 };
  } else if (name && !DATA.items[numId].name) {
    DATA.items[numId].name = name;
  }
  return DATA.items[numId];
}

function getAllItems() {
  return Object.values(DATA.items).sort((a, b) => a.name.localeCompare(b.name));
}

function switchTab(tab) {
  state.currentTab = tab;
  if (tab === 'items') {
    state.selectedQuest = null;
    state.itemSearchFilter = '';
    document.getElementById('itemSearchInput').value = '';
    document.getElementById('itemsSearch').style.display = 'block';
    document.getElementById('questsSearch').style.display = 'none';
  } else {
    state.selectedItem = null;
    state.questSearchFilter = '';
    document.getElementById('questSearchInput').value = '';
    document.getElementById('itemsSearch').style.display = 'none';
    document.getElementById('questsSearch').style.display = 'block';
  }
  render();
}

function findQuestsByItemId(itemId) {
  const results = { produces: [], requires: [] };
  DATA.groups.forEach((group, gi) => {
    group.subgroups.forEach((subgroup, si) => {
      subgroup.quests.forEach((quest, qi) => {
        // Check if quest produces this item
        if (quest.producesId === itemId) {
          results.produces.push({ quest, groupIdx: gi, subIdx: si, questIdx: qi, group, subgroup });
        }
        
        // Check if quest requires this item
        const req = quest.requirements.find(r => r.type === 'item' && r.id === itemId);
        if (req) {
          results.requires.push({ 
            quest, 
            groupIdx: gi, 
            subIdx: si, 
            questIdx: qi, 
            group, 
            subgroup,
            amount: req.amount // Store amount for display
          });
        }
      });
    });
  });
  return results;
}

function filterItems(value) {
  state.itemSearchFilter = value.toLowerCase();
  renderItems();
}

function clearItemSearch() {
  state.itemSearchFilter = '';
  document.getElementById('itemSearchInput').value = '';
  renderItems();
}

function filterQuests(value) {
  state.questSearchFilter = value.toLowerCase();
  renderSidebar();
}

function clearQuestSearch() {
  state.questSearchFilter = '';
  document.getElementById('questSearchInput').value = '';
  renderSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function findQuestsByItemId(itemId) {
  const results = { produces: [], requires: [] };
  DATA.groups.forEach((group, gi) => {
    group.subgroups.forEach((subgroup, si) => {
      subgroup.quests.forEach((quest, qi) => {
        if (quest.producesId === itemId) {
          results.produces.push({ quest, groupIdx: gi, subIdx: si, questIdx: qi, group, subgroup });
        }
        if (quest.requirements.some(r => r.type === 'item' && r.id === itemId)) {
          results.requires.push({ quest, groupIdx: gi, subIdx: si, questIdx: qi, group, subgroup });
        }
      });
    });
  });
  return results;
}

function navigateToItem(itemId) {
  state.currentTab = 'items';
  state.selectedQuest = null;
  state.selectedItem = DATA.items[itemId] || null;
  render();
}

function navigateToQuest(groupIdx, subIdx, questIdx) {
  state.currentTab = 'quests';
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
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.textContent.toLowerCase() === state.currentTab) {
      tab.classList.add('active');
    }
  });
  
  if (state.currentTab === 'quests') {
    document.getElementById('treeContainer').style.display = 'block';
    document.getElementById('itemsList').style.display = 'none';
    document.getElementById('itemsSearch').style.display = 'none';
    document.getElementById('questsSearch').style.display = 'block';
    document.getElementById('addBtn').textContent = '+ Group';
    document.getElementById('addBtn').onclick = addGroup;
    renderSidebar();
    renderQuestContent();
  } else {
    document.getElementById('treeContainer').style.display = 'none';
    document.getElementById('itemsList').style.display = 'block';
    document.getElementById('itemsSearch').style.display = 'block';
    document.getElementById('questsSearch').style.display = 'none';
    document.getElementById('addBtn').textContent = '+ Item';
    document.getElementById('addBtn').onclick = addItem;
    renderItems();
    renderItemContent();
  }
}

function renderItems() {
  const container = document.getElementById('itemsList');
  let items = getAllItems();
  
  // Apply filter
  if (state.itemSearchFilter) {
    items = items.filter(item => 
      item.name.toLowerCase().includes(state.itemSearchFilter) ||
      item.id.toString().includes(state.itemSearchFilter)
    );
  }
  
  container.innerHTML = items.map(item => `
    <div class="item-row ${state.selectedItem?.id === item.id ? 'active' : ''}" onclick="selectItem(${item.id})">
      <div class="item-row-header">
        <span>${item.name || '<unnamed>'}</span>
        <span class="item-row-id">#${item.id}</span>
      </div>
    </div>
  `).join('');
}

function selectItem(id) {
  state.selectedItem = DATA.items[id];
  render();
}

function addItem() {
  // Always use ID 0 for new items
  const newId = 0;
  DATA.items[newId] = {
    id: newId,
    name: 'New Item',
    value: 0
  };
  state.selectedItem = DATA.items[newId];
  render();
}

function renderItemContent() {
  const container = document.getElementById('mainContent');
  
  if (!state.selectedItem) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Item Selected</h2>
        <p>Select an item from the sidebar or create a new one</p>
      </div>
    `;
    return;
  }
  
  const item = state.selectedItem;
  const usage = findQuestsByItemId(item.id);
  
  container.innerHTML = `
    <div class="editor">
      <h2>Item Editor</h2>
      
      <div class="form-group">
        <div class="form-row-3">
          <input type="number" placeholder="Item ID" value="${item.id}" onchange="updateItemId(this.value)">
          <input type="text" placeholder="Item Name" value="${item.name}" onchange="updateItemName(this.value)">
          <input type="number" placeholder="Zeny Value" value="${item.value || 0}" onchange="updateItemValue(this.value)">
        </div>
      </div>
      
      <button class="btn btn-danger" onclick="deleteItem()">Delete Item</button>

      ${usage.produces.length > 0 || usage.requires.length > 0 ? `
        <div class="usage-section">
          ${usage.produces.length > 0 ? `
            <h3>Produced By:</h3>
            <ul class="usage-list">
              ${usage.produces.map(u => `
                <li>
                  <a class="quest-link" onclick="navigateToQuest(${u.groupIdx}, ${u.subIdx}, ${u.questIdx});">
                    ${u.quest.name}
                    <span class="quest-path-info">(${u.group.name} / ${u.subgroup.name})</span>
                    <span class="quest-meta-info">[${u.quest.successRate}% Success]</span>
                  </a>
                </li>
              `).join('')}
            </ul>
          ` : ''}
          
          ${usage.requires.length > 0 ? `
            <h3>Required By:</h3>
            <ul class="usage-list">
              ${usage.requires.map(u => `
                <li>
                  <a class="quest-link" onclick="navigateToQuest(${u.groupIdx}, ${u.subIdx}, ${u.questIdx});">
                    ${u.quest.name}
                    <span class="quest-path-info">(${u.group.name} / ${u.subgroup.name})</span>
                    <span class="quest-meta-info">[Needs ${u.amount}]</span>
                  </a>
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      ` : `
        <div class="usage-section">
          <p style="color: var(--text-muted); font-style: italic; text-align: center; padding: 20px;">
            This item is not used in any quests.
          </p>
        </div>
      `}
    </div>
  `;
}

function updateItemId(value) {
  const newId = parseInt(value) || 0;
  if (newId !== state.selectedItem.id && !DATA.items[newId]) {
    const old = state.selectedItem.id;
    DATA.items[newId] = state.selectedItem;
    DATA.items[newId].id = newId;
    delete DATA.items[old];
    state.selectedItem = DATA.items[newId];
    render();
  }
}

function updateItemName(value) {
  state.selectedItem.name = value;
  render();
}

function updateItemValue(value) {
  state.selectedItem.value = parseFloat(value) || 0;
  render();
}

function deleteItem() {
  if (confirm('Delete this item? This may break quests that use it.')) {
    delete DATA.items[state.selectedItem.id];
    state.selectedItem = null;
    render();
  }
}

function renderSidebar() {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  
  const filter = state.questSearchFilter;

  DATA.groups.forEach((group, groupIdx) => {
    // Logic to determine if group should be shown/expanded based on filter
    let hasMatch = false;
    let matchingSubgroups = [];

    if (filter) {
      group.subgroups.forEach((subgroup, subIdx) => {
        const matchingQuests = subgroup.quests.filter(q => q.name.toLowerCase().includes(filter));
        if (matchingQuests.length > 0) {
          hasMatch = true;
          matchingSubgroups.push(subIdx);
        }
      });
      if (!hasMatch) return; // Hide group if no matches
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'group';

    // Auto-expand if filtering, otherwise use state
    const isExpanded = filter ? true : state.expandedGroups.has(groupIdx);
    
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <span class="expand-icon ${isExpanded ? 'expanded' : ''}" onclick="toggleGroup(${groupIdx})">▶</span>
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
          matchingQuests = subgroup.quests.filter(q => q.name.toLowerCase().includes(filter));
        }

        const subDiv = document.createElement('div');
        subDiv.className = 'subgroup';

        const isSubExpanded = filter ? true : state.expandedSubgroups.has(`${groupIdx}-${subIdx}`);
        
        const subHeader = document.createElement('div');
        subHeader.className = 'subgroup-header';
        subHeader.innerHTML = `
          <span class="expand-icon ${isSubExpanded ? 'expanded' : ''}" onclick="toggleSubgroup(${groupIdx}, ${subIdx})">▶</span>
          <input class="editable-name" value="${subgroup.name}" onclick="event.stopPropagation()" onchange="updateSubgroupName(${groupIdx}, ${subIdx}, this.value)">
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSubgroup(${groupIdx}, ${subIdx})">×</button>
        `;
        subDiv.appendChild(subHeader);

        if (isSubExpanded) {
          // Use matchingQuests array for filtering (or all quests if no filter)
          // We need original index for drag/drop to work correctly, so we iterate original array but check visibility
          subgroup.quests.forEach((quest, questIdx) => {
            if (filter && !quest.name.toLowerCase().includes(filter)) return;

            const questDiv = document.createElement('div');
            questDiv.className = 'quest-item';
            if (state.selectedQuest === quest) {
              questDiv.classList.add('active');
            }
            questDiv.draggable = true;
            questDiv.innerHTML = `
              <span class="drag-handle">⋮⋮</span>
              <span class="quest-name">${quest.name}</span>
            `;
            
            questDiv.addEventListener('dragstart', (e) => {
              state.draggedQuest = questIdx;
              state.draggedFrom = { groupIdx, subIdx };
              questDiv.classList.add('dragging');
            });
            
            questDiv.addEventListener('dragend', (e) => {
              questDiv.classList.remove('dragging');
              document.querySelectorAll('.quest-item').forEach(el => el.classList.remove('drag-over'));
            });
            
            questDiv.addEventListener('dragover', (e) => {
              e.preventDefault();
            });
            
            questDiv.addEventListener('dragenter', (e) => {
              if (state.draggedQuest !== questIdx || state.draggedFrom.groupIdx !== groupIdx || state.draggedFrom.subIdx !== subIdx) {
                questDiv.classList.add('drag-over');
              }
            });
            
            questDiv.addEventListener('dragleave', (e) => {
              questDiv.classList.remove('drag-over');
            });
            
            questDiv.addEventListener('drop', (e) => {
              e.preventDefault();
              questDiv.classList.remove('drag-over');
              
              if (state.draggedFrom.groupIdx === groupIdx && state.draggedFrom.subIdx === subIdx) {
                const quests = subgroup.quests;
                const [removed] = quests.splice(state.draggedQuest, 1);
                const newIdx = questIdx > state.draggedQuest ? questIdx : questIdx;
                quests.splice(newIdx, 0, removed);
                render();
              }
            });
            
            questDiv.querySelector('.quest-name').onclick = () => {
              selectQuest(group, subgroup, quest);
              if (window.innerWidth <= 768) {
                toggleSidebar();
              }
            };
            
            subDiv.appendChild(questDiv);
          });

          // Only show 'Add Quest' button if not filtering
          if (!filter) {
            const addQuestBtn = document.createElement('button');
            addQuestBtn.className = 'btn btn-sm';
            addQuestBtn.textContent = '+ Quest';
            addQuestBtn.style.margin = '4px 0 4px 32px';
            addQuestBtn.onclick = () => addQuest(groupIdx, subIdx);
            subDiv.appendChild(addQuestBtn);
          }
        }

        groupDiv.appendChild(subDiv);
      });

      // Only show 'Add Subgroup' button if not filtering
      if (!filter) {
        const addSubBtn = document.createElement('button');
        addSubBtn.className = 'btn btn-sm';
        addSubBtn.textContent = '+ Subgroup';
        addSubBtn.style.margin = '4px 0 4px 16px';
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
  const container = document.getElementById('mainContent');
  
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
  
  container.innerHTML = `
    <div class="editor">
      <h2>Quest Editor</h2>
      
      <div class="form-group">
        <input type="text" placeholder="Quest Name" value="${quest.name}" onchange="updateQuestName(this.value)">
      </div>

      <div class="form-group">
        <div class="quest-info-row">
          <input type="text" placeholder="Item Name" value="${item.name}" oninput="updateProducesName(this.value)">
          <input type="number" placeholder="Item ID" value="${quest.producesId !== null && quest.producesId !== undefined ? quest.producesId : ''}" onchange="updateProducesId(this.value)">
          <input type="number" min="1" max="100" placeholder="Success %" value="${quest.successRate}" onchange="updateSuccessRate(this.value)">
          <label class="quest-checkbox">
            <input type="checkbox" ${quest.accountBound ? 'checked' : ''} onchange="updateQuestAccountBound(this.checked)">
            Account Bound
          </label>
        </div>
      </div>

      <div class="form-group">
        <textarea placeholder="Description / Effects" onchange="updateDescription(this.value)">${quest.description || ''}</textarea>
      </div>

      <div class="requirements-section">
        <h3>
          Requirements
          <button class="btn btn-sm btn-primary" onclick="addRequirement()">+ Add</button>
        </h3>
        <div class="requirements-grid">
          ${quest.requirements.map((req, idx) => renderRequirement(req, idx)).join('')}
        </div>
      </div>

      <div class="material-tree">
        <h3>Material Breakdown Tree</h3>
        ${renderMaterialTree()}
      </div>

      <div class="summary-section">
        <div style="background: var(--bg); padding: 10px 16px; margin: -20px -20px 20px -20px; border-bottom: 1px solid var(--border); text-align: center; font-size: 15px; color: var(--accent); font-weight: 500;">
          ${quest.name}
        </div>
        <h3>
          Total Materials Summary
          <span style="margin-left: auto; font-size: 14px; font-style: italic; color: var(--text-muted); font-weight: normal;">
            ${quest.successRate}% Success Rate
          </span>
        </h3>
        ${renderSummary()}
      </div>
    </div>
  `;
  
  // Setup autocomplete for item name fields
  quest.requirements.forEach((req, idx) => {
    if (req.type === 'item') {
      const input = document.querySelector(`#item-name-${idx}`);
      if (input) {
        setupAutocomplete(input, idx);
      }
    }
  });
}

function setupAutocomplete(input, idx) {
  input.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase();
    if (value.length < 1) {
      hideAutocomplete(idx);
      return;
    }
    
    const items = getAllItems();
    const matches = items.filter(item => 
      item.name.toLowerCase().includes(value) || 
      item.id.toString().includes(value)
    ).slice(0, 10);
    
    if (matches.length > 0) {
      showAutocomplete(idx, matches);
    } else {
      hideAutocomplete(idx);
    }
  });
  
  input.addEventListener('blur', () => {
    setTimeout(() => hideAutocomplete(idx), 200);
  });
}

function showAutocomplete(idx, items) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (!dropdown) return;
  
  dropdown.innerHTML = items.map(item => `
    <div class="autocomplete-item" onclick="selectAutocomplete(${idx}, ${item.id})">
      ${item.name}<span class="autocomplete-item-id">[${item.id}]</span>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function hideAutocomplete(idx) {
  const dropdown = document.querySelector(`#autocomplete-${idx}`);
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

function selectAutocomplete(idx, id) {
  state.selectedQuest.requirements[idx].id = id;
  render();
}

function renderRequirement(req, idx) {
  const isItem = req.type === 'item';
  const isWideAmount = req.type === 'zeny' || req.type === 'credit' || req.type === 'gold' || req.type === 'monster_arena_points' || req.type === 'otherworld_points' || req.type === 'hall_of_heritage_points';
  const item = isItem ? getItem(req.id) : null;
  
  return `
    <div class="requirement-card">
      <button class="remove-btn" onclick="deleteRequirement(${idx})">×</button>
      ${isItem ? `
        <div class="req-top-row">
          <select onchange="updateReqType(${idx}, this.value)">
            <option value="item" selected>Item</option>
            <option value="zeny">Zeny</option>
            <option value="gold">Gold</option>
            <option value="credit">Credit</option>
            <option value="vote_points">Vote Points</option>
            <option value="hourly_points">Hourly Points</option>
            <option value="activity_points">Activity Points</option>
            <option value="monster_arena_points">Monster Arena Points</option>
            <option value="otherworld_points">Otherworld Points</option>
            <option value="hall_of_heritage_points">Hall of Heritage Points</option>
            <option value="event_points">Event Points</option>
          </select>
          <input type="number" placeholder="ID" value="${req.id !== null && req.id !== undefined ? req.id : ''}" onchange="updateReqId(${idx}, this.value)">
          <input type="number" placeholder="Amt" value="${req.amount}" onchange="updateReqAmount(${idx}, this.value)">
        </div>
        <div class="req-name-row">
          <input id="item-name-${idx}" type="text" placeholder="Item Name" value="${item?.name || ''}" oninput="updateReqItemName(${idx}, this.value)">
          <div id="autocomplete-${idx}" class="autocomplete-dropdown" style="display: none;"></div>
        </div>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" ${req.immune ? 'checked' : ''} onchange="updateReqImmune(${idx}, this.checked)">
            Immune
          </label>
        </div>
      ` : `
        <div class="${isWideAmount ? 'req-top-row-wide' : 'req-top-row'}">
          <select onchange="updateReqType(${idx}, this.value)">
            <option value="item">Item</option>
            <option value="zeny" ${req.type === 'zeny' ? 'selected' : ''}>Zeny</option>
            <option value="gold" ${req.type === 'gold' ? 'selected' : ''}>Gold</option>
            <option value="credit" ${req.type === 'credit' ? 'selected' : ''}>Credit</option>
            <option value="vote_points" ${req.type === 'vote_points' ? 'selected' : ''}>Vote Points</option>
            <option value="hourly_points" ${req.type === 'hourly_points' ? 'selected' : ''}>Hourly Points</option>
            <option value="activity_points" ${req.type === 'activity_points' ? 'selected' : ''}>Activity Points</option>
            <option value="monster_arena_points" ${req.type === 'monster_arena_points' ? 'selected' : ''}>Monster Arena Points</option>
            <option value="otherworld_points" ${req.type === 'otherworld_points' ? 'selected' : ''}>Otherworld Points</option>
            <option value="hall_of_heritage_points" ${req.type === 'hall_of_heritage_points' ? 'selected' : ''}>Hall of Heritage Points</option>
          </select>
          ${isWideAmount ? `
            <input type="number" placeholder="Amount" value="${req.amount}" onchange="updateReqAmount(${idx}, this.value)">
          ` : `
            <div></div>
            <input type="number" placeholder="Amt" value="${req.amount}" onchange="updateReqAmount(${idx}, this.value)">
          `}
        </div>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" ${req.immune ? 'checked' : ''} onchange="updateReqImmune(${idx}, this.checked)">
            Immune
          </label>
        </div>
      `}
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
    
    quest.requirements.forEach(req => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      const indent = '  '.repeat(depth);
      const connector = depth > 0 ? '└─ ' : '';
      const immuneBadge = req.immune ? ' <span style="color: var(--success); font-size: 11px;">[IMMUNE]</span>' : '';
      
      if (req.type === 'item' && questIndex.has(req.id)) {
        const item = getItem(req.id);
        const quests = questIndex.get(req.id);
        
        if (quests.length === 1) {
          // Single quest - show as normal
          lines.push({
            level: depth,
            text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${item.id})">${item.name}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`
          });
          walk(quests[0], depth + 1, effectiveAmount, newPath);
        } else {
          // Multiple quests - show options
          lines.push({
            level: depth,
            text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${item.id})">${item.name}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge} <span style="color: var(--warning); font-size: 11px;">[${quests.length} OPTIONS]</span>`
          });
          
          quests.forEach((q, idx) => {
            const optionIndent = '  '.repeat(depth + 1);
            const optionNum = idx + 1;
            lines.push({
              level: depth + 1,
              text: `${optionIndent}<span style="color: var(--text-muted);">Option ${optionNum}: ${q.name} (${q.successRate}% success)</span>`
            });
            walk(q, depth + 2, effectiveAmount, newPath);
          });
        }
      } else if (req.type === 'zeny') {
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">Zeny</span> × <span class="tree-amount">${effectiveAmount.toLocaleString()}</span>${immuneBadge}`
        });
      } else if (req.type === 'credit') {
        const zenyValue = effectiveAmount * DATA.meta.creditValueZeny;
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">Credit</span> × <span class="tree-amount">${effectiveAmount}</span> <span style="color: var(--text-muted)">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`
        });
      } else if (req.type === 'gold') {
        const zenyValue = effectiveAmount * DATA.meta.goldValueZeny;
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">Gold</span> × <span class="tree-amount">${effectiveAmount}</span> <span style="color: var(--text-muted)">(${zenyValue.toLocaleString()} zeny)</span>${immuneBadge}`
        });
      } else if (req.type === 'vote_points' || req.type === 'activity_points' || req.type === 'hourly_points' || req.type === 'monster_arena_points' || req.type === 'otherworld_points' || req.type === 'hall_of_heritage_points' || req.type === 'event_points') {
        const typeName = req.type === 'vote_points' ? 'Vote Points' : 
                         req.type === 'activity_points' ? 'Activity Points' : 
                         req.type === 'hourly_points' ? 'Hourly Points' :
                         req.type === 'monster_arena_points' ? 'Monster Arena Points' :
                         req.type === 'otherworld_points' ? 'Otherworld Points' :
                         req.type === 'hall_of_heritage_points' ? 'Hall of Heritage Points' :
                         'Event Points';
        lines.push({
          level: depth,
          text: `${indent}${connector}<span class="tree-item-name">${typeName}</span> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`
        });
      } else if (req.type === 'item') {
        const item = getItem(req.id);
        lines.push({
          level: depth,
          text: `${indent}${connector}<a class="item-link tree-item-name" onclick="navigateToItem(${item.id})">${item.name || 'Unknown'}</a> × <span class="tree-amount">${effectiveAmount}</span>${immuneBadge}`
        });
      }
    });
  }
  
  walk(state.selectedQuest, 0, 1);
  
  if (lines.length === 0) {
    return '<div class="tree-line">No requirements</div>';
  }
  
  return lines.map(line => `<div class="tree-line level-${line.level}">${line.text}</div>`).join('');
}

function renderSummary() {
  const questIndex = buildQuestIndex();
  const totals = {};
  let totalZeny = 0;
  
  // Track if we've seen items with multiple quest options
  const multiQuestWarning = new Set();
  
  function accumulate(quest, multiplier, questPath = new Set()) {
    // Prevent infinite loops
    if (questPath.has(quest)) return;
    const newPath = new Set(questPath);
    newPath.add(quest);
    
    quest.requirements.forEach(req => {
      const effectiveAmount = (Number(req.amount) || 0) * multiplier;
      if (req.type === 'item' && questIndex.has(req.id)) {
        const quests = questIndex.get(req.id);
        if (quests.length > 1) {
          multiQuestWarning.add(getItem(req.id).name);
        }
        // Use first quest option for summary calculation
        accumulate(quests[0], effectiveAmount, newPath);
        return;
      } else {
        // Calculate zeny contributions
        if (req.type === 'zeny') {
          totalZeny += effectiveAmount;
        } else if (req.type === 'credit') {
          totalZeny += effectiveAmount * DATA.meta.creditValueZeny;
        } else if (req.type === 'gold') {
          totalZeny += effectiveAmount * DATA.meta.goldValueZeny;
        } else if (req.type === 'item') {
          const item = getItem(req.id);
          totalZeny += effectiveAmount * (item.value || 0);
        }
        
        const key = req.type === 'item' ? `item_${req.id}` : req.type;
        const name = req.type === 'zeny' ? 'Zeny' :
                     req.type === 'credit' ? 'Credit' :
                     req.type === 'gold' ? 'Gold' :
                     req.type === 'vote_points' ? 'Vote Points' :
                     req.type === 'activity_points' ? 'Activity Points' :
                     req.type === 'hourly_points' ? 'Hourly Points' :
                     req.type === 'monster_arena_points' ? 'Monster Arena Points' :
                     req.type === 'otherworld_points' ? 'Otherworld Points' :
                     req.type === 'hall_of_heritage_points' ? 'Hall of Heritage Points' :
                     req.type === 'event_points' ? 'Event Points' :

                     getItem(req.id).name || 'Unknown';
        
        if (!totals[key]) {
          totals[key] = { name, amount: 0, type: req.type, value: req.type === 'item' ? getItem(req.id).value : 0 };
        }
        totals[key].amount += effectiveAmount;
      }
    });
  }
  
  accumulate(state.selectedQuest, 1);
  
  const entries = Object.values(totals).sort((a, b) => {
    // Currency types first
    const currencyOrder = { 'zeny': 0, 'credit': 1, 'gold': 2 };
    const aIsCurrency = a.type in currencyOrder;
    const bIsCurrency = b.type in currencyOrder;
    
    if (aIsCurrency && bIsCurrency) {
      return currencyOrder[a.type] - currencyOrder[b.type];
    }
    if (aIsCurrency) return -1;
    if (bIsCurrency) return 1;
    
    // Then sort by amount (descending)
    if (a.amount !== b.amount) {
      return b.amount - a.amount;
    }
    
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });
  
  if (entries.length === 0) {
    return '<div class="summary-item"><span>No materials required</span></div>';
  }
  
  let html = '';
  
  // Warning about multiple quest options
  if (multiQuestWarning.size > 0) {
    html += `
      <div style="background: var(--panel-hover); border: 1px solid var(--warning); border-radius: 4px; padding: 10px; margin-bottom: 12px; font-size: 12px; color: var(--warning);">
        ⚠️ Multiple crafting options exist for: ${Array.from(multiQuestWarning).join(', ')}. Summary uses first option - see breakdown tree for alternatives.
      </div>
    `;
  }
  
  // Add total zeny summary at the top
  if (totalZeny > 0) {
    html += `
      <div class="summary-item" style="border-bottom: 2px solid var(--accent); padding-bottom: 12px; margin-bottom: 12px;">
        <span class="summary-name" style="font-weight: 600; color: var(--text);">Total Zeny Value</span>
        <span class="summary-amount" style="font-size: 16px;">${totalZeny.toLocaleString()}</span>
      </div>
    `;
  }
  
  html += entries.map(entry => {
    const displayAmount = entry.type === 'zeny' ? 
      entry.amount.toLocaleString() : 
      entry.amount;
    let extra = '';
    let itemName = `<span class="summary-name">${entry.name}</span>`;
    if (entry.type === 'credit') {
      extra = ` <span style="color: var(--text-muted); font-size: 12px;">(${(entry.amount * DATA.meta.creditValueZeny).toLocaleString()} zeny)</span>`;
    } else if (entry.type === 'gold') {
      extra = ` <span style="color: var(--text-muted); font-size: 12px;">(${(entry.amount * DATA.meta.goldValueZeny).toLocaleString()} zeny)</span>`;
    } else if (entry.type === 'item' && entry.value > 0) {
      extra = ` <span style="color: var(--text-muted); font-size: 12px;">(${(entry.amount * entry.value).toLocaleString()} zeny)</span>`;
      itemName = `<a class="item-link" onclick="navigateToItem(${entry.id})">${entry.name}</a>`;
    }
    return `
      <div class="summary-item">
        <span class="summary-name">${itemName}</span>
        <span class="summary-amount">${displayAmount}${extra}</span>
      </div>
    `;
  }).join('');
  
  return html;
}

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

// CRUD operations
function addGroup() {
  const group = {
    name: 'New Group',
    subgroups: []
  };
  DATA.groups.push(group);
  state.expandedGroups.add(DATA.groups.length - 1);
  render();
}

function deleteGroup(idx) {
  if (confirm('Delete this group and all its contents?')) {
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
    name: 'New Subgroup',
    quests: []
  };
  DATA.groups[groupIdx].subgroups.push(subgroup);
  const subIdx = DATA.groups[groupIdx].subgroups.length - 1;
  state.expandedSubgroups.add(`${groupIdx}-${subIdx}`);
  render();
}

function deleteSubgroup(groupIdx, subIdx) {
  if (confirm('Delete this subgroup and all its quests?')) {
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
    name: 'New Quest',
    producesId: null,
    successRate: 100,
    description: '',
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

function updateProducesId(value) {
  const numValue = parseInt(value);
  state.selectedQuest.producesId = isNaN(numValue) ? null : numValue;
  render();
}

function updateProducesName(value) {
  if (state.selectedQuest.producesId !== null && state.selectedQuest.producesId !== '') {
    ensureItem(state.selectedQuest.producesId, value);
  }
  render();
}

function updateSuccessRate(value) {
  state.selectedQuest.successRate = Math.max(1, Math.min(100, parseInt(value) || 100));
  render();
}

function updateDescription(value) {
  state.selectedQuest.description = value;
  render();
}

function updateQuestAccountBound(checked) {
  state.selectedQuest.accountBound = checked;
  render();
}

function addRequirement() {
  state.selectedQuest.requirements.push({
    type: 'item',
    id: null,
    amount: 1,
    immune: false
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
  if (value !== 'item') {
    delete req.id;
  }
  req.immune = req.immune || false;
  render();
}

function updateReqId(idx, value) {
  const numValue = parseInt(value);
  state.selectedQuest.requirements[idx].id = isNaN(numValue) ? null : numValue;
  render();
}

function updateReqItemName(idx, value) {
  const req = state.selectedQuest.requirements[idx];
  if (req.id !== null && req.id !== '') {
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

// Import/Export
function exportData() {
  const json = JSON.stringify(DATA, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ro_quests.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      // Check if it's old format (has groups with quests that have produces.name)
      const isOldFormat = imported.groups?.[0]?.subgroups?.[0]?.quests?.[0]?.produces?.name !== undefined;
      
      if (isOldFormat) {
        DATA = convertLegacyFormat(imported);
      } else {
        DATA = {
          meta: {
            creditValueZeny: imported.meta?.creditValueZeny ?? 10000000,
            creditItemId: imported.meta?.creditItemId ?? 40001,
            goldValueZeny: imported.meta?.goldValueZeny ?? 124000,
            goldItemId: imported.meta?.goldItemId ?? 969
          },
          items: imported.items || {},
          groups: imported.groups || []
        };
      }

      state.selectedQuest = null;
      state.selectedItem = null;
      state.expandedGroups.clear();
      state.expandedSubgroups.clear();
      render();
    } catch (err) {
      alert('Error parsing JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

render();