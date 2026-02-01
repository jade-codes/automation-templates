// ==========================================
// Activities Module - Activity management
// ==========================================

import { state, saveWeeklyPlan } from './store.js';
import { escapeHtml, escapeJs, generateId } from './utils.js';
import { API_ENDPOINTS, saveData } from './api.js';
import { renderWeeklyPlan } from './weekly.js';

// Constants - matching original app.js
const ACTIVITY_CATEGORIES = ['Local Activities', 'Local Attractions', 'UK Attractions', 'Spas', 'indoor', 'outdoor', 'social', 'solo'];
const ACTIVITY_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const ACTIVITY_DAY_NAMES = { 'sat': 'S', 'sun': 'S', 'mon': 'M', 'tue': 'T', 'wed': 'W', 'thu': 'T', 'fri': 'F' };
const ACTIVITY_TIMES = ['all', 'am', 'pm', 'eve'];
const ACTIVITY_TIME_LABELS = { 'all': 'All', 'am': 'AM', 'pm': 'PM', 'eve': 'Eve' };

/**
 * Render the activities tab - matching original app.js structure
 */
function renderActivities() {
  const container = document.getElementById('activities-list');
  if (!container) return;
  
  // Group activities by category
  const categories = [...new Set(state.activities.map(a => a.category))];
  
  const inlineAdd = `
    <div class="inline-add-card">
      <input type="text" id="inline-activity-name" placeholder="Activity name..." 
             onkeypress="if(event.key==='Enter'){event.preventDefault(); addActivityInline();}">
      <select id="inline-activity-category">
        ${ACTIVITY_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <button class="btn-add-inline" onclick="addActivityInline()">+ Add</button>
    </div>
  `;
  
  if (state.activities.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No activities yet</p></div>' + inlineAdd;
    return;
  }
  
  container.innerHTML = categories.map(category => {
    const categoryActivities = state.activities.filter(a => a.category === category);
    
    return `
      <div class="activity-category-group">
        <div class="activity-category-header" onclick="toggleActivityCategory('${escapeJs(category)}')">
          <span class="activity-category-name">${escapeHtml(category)}</span>
          <span class="activity-category-count">${categoryActivities.length}</span>
          <span class="expand-icon">▼</span>
        </div>
        <ul class="activity-list">
          ${categoryActivities.map(activity => {
            // Check which days/times this activity is already scheduled
            const getScheduledSlots = () => {
              const slots = [];
              ACTIVITY_DAYS.forEach(d => {
                ACTIVITY_TIMES.forEach(t => {
                  const key = `${d}-${t}`;
                  if (state.weeklyPlan?.activities?.[key]?.some(a => a.id === activity.id)) {
                    slots.push(key);
                  }
                });
              });
              return slots;
            };
            const scheduledSlots = getScheduledSlots();
            
            return `
              <li class="activity-list-item compact-schedule">
                <span class="activity-name">${escapeHtml(activity.name)}</span>
                <div class="compact-grid">
                  <div class="compact-header"><span></span>${ACTIVITY_DAYS.map(d => `<span>${ACTIVITY_DAY_NAMES[d]}</span>`).join('')}</div>
                  ${ACTIVITY_TIMES.map(t => `
                    <div class="compact-row"><span class="time-lbl">${ACTIVITY_TIME_LABELS[t]}</span>${ACTIVITY_DAYS.map(d => {
                      const key = `${d}-${t}`;
                      const isScheduled = scheduledSlots.includes(key);
                      return `<button class="slot-btn ${isScheduled ? 'scheduled' : ''}" onclick="toggleActivitySlot('${escapeJs(activity.id)}', '${d}', '${t}')"></button>`;
                    }).join('')}</div>
                  `).join('')}
                </div>
                <button class="btn-delete-small" onclick="deleteActivity('${escapeJs(activity.id)}')">&times;</button>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }).join('') + inlineAdd;
}

/**
 * Toggle activity category collapsed state
 */
function toggleActivityCategory(category) {
  document.querySelectorAll('.activity-category-group').forEach(g => {
    const name = g.querySelector('.activity-category-name')?.textContent;
    if (name === category) {
      g.classList.toggle('collapsed');
    }
  });
}

/**
 * Toggle a time slot for an activity in the weekly plan
 */
async function toggleActivitySlot(activityId, day, time) {
  if (!state.weeklyPlan) state.weeklyPlan = { activities: {} };
  if (!state.weeklyPlan.activities) state.weeklyPlan.activities = {};
  
  const key = `${day}-${time}`;
  if (!state.weeklyPlan.activities[key]) {
    state.weeklyPlan.activities[key] = [];
  }
  
  const idx = state.weeklyPlan.activities[key].findIndex(a => a.id === activityId);
  if (idx >= 0) {
    // Remove
    state.weeklyPlan.activities[key].splice(idx, 1);
  } else {
    // Add
    const activity = state.activities.find(a => a.id === activityId);
    if (activity) {
      state.weeklyPlan.activities[key].push({ id: activityId, name: activity.name });
    }
  }
  
  await saveWeeklyPlan();
  renderActivities();
  renderWeeklyPlan();
}

/**
 * Add an activity inline
 */
async function addActivityInline() {
  const nameInput = document.getElementById('inline-activity-name');
  const catSelect = document.getElementById('inline-activity-category');
  
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) return;
  
  const category = catSelect ? catSelect.value : 'indoor';
  
  const activity = {
    id: generateId(),
    name: name,
    category: category
  };
  
  state.activities.push(activity);
  await saveData(API_ENDPOINTS.activities, state.activities);
  renderActivities();
  
  // Clear and focus
  if (nameInput) {
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 100);
  }
}

/**
 * Delete an activity
 */
async function deleteActivity(activityId) {
  if (!confirm('Delete this activity?')) return;
  const idx = state.activities.findIndex(a => a.id === activityId);
  if (idx >= 0) {
    state.activities.splice(idx, 1);
    await saveData(API_ENDPOINTS.activities, state.activities);
    renderActivities();
  }
}

/**
 * Get activity by ID
 */
function getActivity(id) {
  return state.activities.find(a => a.id === id);
}

export {
  ACTIVITY_CATEGORIES,
  ACTIVITY_DAYS,
  ACTIVITY_DAY_NAMES,
  ACTIVITY_TIMES,
  ACTIVITY_TIME_LABELS,
  renderActivities,
  toggleActivityCategory,
  toggleActivitySlot,
  addActivityInline,
  deleteActivity,
  getActivity
};
