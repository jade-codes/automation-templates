// ==========================================
// Chores Module - Chore management
// ==========================================

import { state, saveWeeklyPlan } from './store.js';
import { escapeHtml, escapeJs, generateId } from './utils.js';
import { API_ENDPOINTS, saveData } from './api.js';
import { renderWeeklyPlan } from './weekly.js';

// Constants - matching original app.js
const CHORE_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const CHORE_DAY_NAMES = { 'sat': 'S', 'sun': 'S', 'mon': 'M', 'tue': 'T', 'wed': 'W', 'thu': 'T', 'fri': 'F' };
const CHORE_TIMES = ['all', 'am', 'pm', 'eve'];
const CHORE_TIME_LABELS = { 'all': 'All', 'am': 'AM', 'pm': 'PM', 'eve': 'Eve' };
const CHORE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'one-off'];
const CHORE_FREQUENCY_LABELS = {
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'one-off': 'One-off'
};

/**
 * Render the chores tab - matching original app.js structure
 */
function renderChores() {
  const container = document.getElementById('chores-list');
  if (!container) return;
  
  // Group chores by frequency
  const categories = [...new Set(state.chores.map(c => c.frequency))];
  
  const inlineAdd = `
    <div class="inline-add-card">
      <input type="text" id="inline-chore-name" placeholder="Chore name..." 
             onkeypress="if(event.key==='Enter'){event.preventDefault(); addChoreInline();}">
      <select id="inline-chore-frequency">
        ${CHORE_FREQUENCIES.map(c => `<option value="${c}">${CHORE_FREQUENCY_LABELS[c]}</option>`).join('')}
      </select>
      <button class="btn-add-inline" onclick="addChoreInline()">+ Add</button>
    </div>
  `;
  
  if (state.chores.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No chores yet</p></div>' + inlineAdd;
    return;
  }
  
  container.innerHTML = categories.map(category => {
    const categoryChores = state.chores.filter(c => c.frequency === category);
    
    return `
      <div class="activity-category-group">
        <div class="activity-category-header" onclick="toggleChoreCategory('${escapeJs(category)}')">
          <span class="activity-category-name">${CHORE_FREQUENCY_LABELS[category] || category}</span>
          <span class="activity-category-count">${categoryChores.length}</span>
          <span class="expand-icon">▼</span>
        </div>
        <ul class="activity-list">
          ${categoryChores.map(chore => {
            // Check which days/times this chore is already scheduled
            const getScheduledSlots = () => {
              const slots = [];
              CHORE_DAYS.forEach(d => {
                CHORE_TIMES.forEach(t => {
                  const key = `${d}-${t}`;
                  if (state.weeklyPlan?.chores?.[key]?.some(c => c.id === chore.id)) {
                    slots.push(key);
                  }
                });
              });
              return slots;
            };
            const scheduledSlots = getScheduledSlots();
            
            return `
              <li class="activity-list-item compact-schedule">
                <span class="activity-name">${escapeHtml(chore.name)}</span>
                <div class="compact-grid">
                  <div class="compact-header"><span></span>${CHORE_DAYS.map(d => `<span>${CHORE_DAY_NAMES[d]}</span>`).join('')}</div>
                  ${CHORE_TIMES.map(t => `
                    <div class="compact-row"><span class="time-lbl">${CHORE_TIME_LABELS[t]}</span>${CHORE_DAYS.map(d => {
                      const key = `${d}-${t}`;
                      const isScheduled = scheduledSlots.includes(key);
                      return `<button class="slot-btn ${isScheduled ? 'scheduled' : ''}" onclick="toggleChoreSlot('${escapeJs(chore.id)}', '${d}', '${t}')"></button>`;
                    }).join('')}</div>
                  `).join('')}
                </div>
                <button class="btn-delete-small" onclick="deleteChore('${escapeJs(chore.id)}')">&times;</button>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }).join('') + inlineAdd;
}

/**
 * Toggle chore category collapsed state
 */
function toggleChoreCategory(category) {
  document.querySelectorAll('.activity-category-group').forEach(g => {
    const name = g.querySelector('.activity-category-name')?.textContent?.toLowerCase();
    if (name === category || name === (CHORE_FREQUENCY_LABELS[category] || '').toLowerCase()) {
      g.classList.toggle('collapsed');
    }
  });
}

/**
 * Toggle a time slot for a chore in the weekly plan
 */
async function toggleChoreSlot(choreId, day, time) {
  if (!state.weeklyPlan) state.weeklyPlan = { chores: {} };
  if (!state.weeklyPlan.chores) state.weeklyPlan.chores = {};
  
  const key = `${day}-${time}`;
  if (!state.weeklyPlan.chores[key]) {
    state.weeklyPlan.chores[key] = [];
  }
  
  const idx = state.weeklyPlan.chores[key].findIndex(c => c.id === choreId);
  if (idx >= 0) {
    // Remove
    state.weeklyPlan.chores[key].splice(idx, 1);
  } else {
    // Add
    const chore = state.chores.find(c => c.id === choreId);
    if (chore) {
      state.weeklyPlan.chores[key].push({ id: choreId, name: chore.name });
    }
  }
  
  await saveWeeklyPlan();
  renderChores();
  renderWeeklyPlan();
}

/**
 * Add a chore inline
 */
async function addChoreInline() {
  const nameInput = document.getElementById('inline-chore-name');
  const freqSelect = document.getElementById('inline-chore-frequency');
  
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) return;
  
  const frequency = freqSelect ? freqSelect.value : 'one-off';
  
  const chore = {
    id: generateId(),
    name: name,
    frequency: frequency
  };
  
  state.chores.push(chore);
  await saveData(API_ENDPOINTS.chores, state.chores);
  renderChores();
  
  // Clear and focus
  if (nameInput) {
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 100);
  }
}

/**
 * Delete a chore
 */
async function deleteChore(choreId) {
  if (!confirm('Delete this chore?')) return;
  const idx = state.chores.findIndex(c => c.id === choreId);
  if (idx >= 0) {
    state.chores.splice(idx, 1);
    await saveData(API_ENDPOINTS.chores, state.chores);
    renderChores();
  }
}

/**
 * Get chore by ID
 */
function getChore(id) {
  return state.chores.find(c => c.id === id);
}

export {
  CHORE_DAYS,
  CHORE_DAY_NAMES,
  CHORE_TIMES,
  CHORE_TIME_LABELS,
  CHORE_FREQUENCIES,
  CHORE_FREQUENCY_LABELS,
  renderChores,
  toggleChoreCategory,
  toggleChoreSlot,
  addChoreInline,
  deleteChore,
  getChore
};
