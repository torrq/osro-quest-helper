// groups.js - Group and Subgroup Management Logic

function renderGroupsList() {
  const container = document.getElementById("groupsList");

  let html = "";

  DATA.groups.forEach((group, groupIdx) => {
    const isSelected = state.selectedGroupForEdit === groupIdx;
    html += `
      <div class="group-edit-item ${isSelected ? "active" : ""}" onclick="selectGroupForEdit(${groupIdx})">
        <div class="group-edit-header">
          <div class="group-edit-name-container">
            <span class="group-edit-name">${group.name}</span>
            ${group.caption ? `<span class="group-edit-caption">${group.caption}</span>` : ""}
          </div>
          <span class="group-edit-count">${group.subgroups.length} subgroups</span>
        </div>
      </div>
    `;
  });

  if (DATA.groups.length === 0) {
    html = `<div class="empty-msg-centered">No quest groups yet. Click "+ Group" to create one.</div>`;
  }

  container.innerHTML = html;
}

function selectGroupForEdit(idx) {
  state.selectedGroupForEdit = idx;
  renderGroupsList();
  renderGroupContent();
}

function renderGroupContent() {
  const container = document.getElementById("mainContent");

  if (state.selectedGroupForEdit === null) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Group Selected</h2>
        <p>Select a group from the sidebar to edit</p>
      </div>
    `;
    return;
  }

  const groupIdx = state.selectedGroupForEdit;
  const group = DATA.groups[groupIdx];

  if (!group) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Group Not Found</h2>
        <p>The selected group no longer exists.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="editor-group">
      <div class="group-edit-top">
        <h2>Edit Quest Group</h2>
        <button class="btn btn-danger" onclick="deleteGroup(${groupIdx})">Delete Group</button>
      </div>
      
      <div class="form-group">
        <span class="item-label">Group Name:</span>
        <input type="text" placeholder="Group Name" value="${group.name}" onchange="updateGroupName(${groupIdx}, this.value)">
      </div>
      
      <div class="form-group">
        <span class="item-label">Caption (optional):</span>
        <input type="text" placeholder="e.g., Main Office, Prontera, etc." value="${group.caption || ""}" onchange="updateGroupCaption(${groupIdx}, this.value)">
        <p class="help-text">A short location or description displayed under the group name</p>
      </div>
      
      <div class="group-ordering-section">
        <span class="item-label">Group Position:</span>
        <div class="ordering-controls">
          <button class="btn btn-sm" onclick="moveGroup(${groupIdx}, -1)" ${groupIdx === 0 ? "disabled" : ""}>↑ Move Up</button>
          <button class="btn btn-sm" onclick="moveGroup(${groupIdx}, 1)" ${groupIdx === DATA.groups.length - 1 ? "disabled" : ""}>↓ Move Down</button>
          <span class="ordering-info">Position ${groupIdx + 1} of ${DATA.groups.length}</span>
        </div>
      </div>
      
      <div class="subgroups-section">
        <div class="subgroups-header">
          <span class="item-label">Subgroups (${group.subgroups.length})</span>
          <button class="btn btn-sm btn-primary" onclick="addSubgroup(${groupIdx})">+ Add Subgroup</button>
        </div>
        
        <div class="subgroups-list">
  `;

  if (group.subgroups.length === 0) {
    html += `<div class="empty-msg-centered">No subgroups yet. Click "+ Add Subgroup" to create one.</div>`;
  } else {
    group.subgroups.forEach((subgroup, subIdx) => {
      html += `
        <div class="subgroup-edit-card">
          <div class="subgroup-edit-header">
            <input type="text" class="subgroup-edit-name-input" value="${subgroup.name}" onchange="updateSubgroupName(${groupIdx}, ${subIdx}, this.value)">
            <span class="subgroup-quest-count">${subgroup.quests.length} quests</span>
            <div class="subgroup-ordering-controls">
              <button class="btn btn-sm btn-icon" onclick="moveSubgroup(${groupIdx}, ${subIdx}, -1)" ${subIdx === 0 ? "disabled" : ""} title="Move Up">↑</button>
              <button class="btn btn-sm btn-icon" onclick="moveSubgroup(${groupIdx}, ${subIdx}, 1)" ${subIdx === group.subgroups.length - 1 ? "disabled" : ""} title="Move Down">↓</button>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteSubgroup(${groupIdx}, ${subIdx})">Delete</button>
          </div>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function addGroup() {
  const group = {
    name: "New Group",
    subgroups: [],
  };
  DATA.groups.push(group);

  if (state.currentTab === "groups") {
    selectGroupForEdit(DATA.groups.length - 1);
  } else {
    state.expandedGroups.add(DATA.groups.length - 1);
  }

  render();
}

function deleteGroup(idx) {
  if (confirm("Delete this group and all its contents?")) {
    DATA.groups.splice(idx, 1);
    state.expandedGroups.delete(idx);
    if (state.selectedGroup === DATA.groups[idx]) {
      state.selectedQuest = null;
    }

    if (state.selectedGroupForEdit === idx) {
      state.selectedGroupForEdit = null;
    } else if (state.selectedGroupForEdit > idx) {
      state.selectedGroupForEdit--;
    }

    render();
  }
}

function updateGroupName(idx, value) {
  DATA.groups[idx].name = value;
  render();
}

function updateGroupCaption(idx, value) {
  DATA.groups[idx].caption = value.trim();
  render();
}

function moveGroup(idx, direction) {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= DATA.groups.length) return;

  // Swap groups
  const temp = DATA.groups[idx];
  DATA.groups[idx] = DATA.groups[newIdx];
  DATA.groups[newIdx] = temp;

  // Update selected index
  state.selectedGroupForEdit = newIdx;

  render();
}

function addSubgroup(groupIdx) {
  const subgroup = {
    name: "New Subgroup",
    quests: [],
  };
  DATA.groups[groupIdx].subgroups.push(subgroup);
  render();
}

function updateSubgroupName(groupIdx, subIdx, value) {
  DATA.groups[groupIdx].subgroups[subIdx].name = value;
  render();
}

function moveSubgroup(groupIdx, subIdx, direction) {
  const group = DATA.groups[groupIdx];
  const newIdx = subIdx + direction;
  if (newIdx < 0 || newIdx >= group.subgroups.length) return;

  // Swap subgroups
  const temp = group.subgroups[subIdx];
  group.subgroups[subIdx] = group.subgroups[newIdx];
  group.subgroups[newIdx] = temp;

  render();
}

function deleteSubgroup(groupIdx, subIdx) {
  if (confirm("Delete this subgroup and all its quests?")) {
    const subgroup = DATA.groups[groupIdx].subgroups[subIdx];
    if (state.selectedSubgroup === subgroup) {
      state.selectedQuest = null;
    }
    DATA.groups[groupIdx].subgroups.splice(subIdx, 1);
    state.expandedSubgroups.delete(`${groupIdx}-${subIdx}`);
    render();
  }
}
