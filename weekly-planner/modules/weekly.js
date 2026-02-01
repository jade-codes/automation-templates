// ==========================================
// Weekly Module - Weekly plan management
// ==========================================

import { state, saveWeeklyPlan, saveShopping } from './store.js';
import { escapeHtml, escapeJs } from './utils.js';

// Constants
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_NAMES_SHORT = { 'sat': 'Sat', 'sun': 'Sun', 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri' };
const TIME_SLOTS = ['all', 'am', 'pm', 'eve'];
const TIME_LABELS = { 'all': 'All Day', 'am': 'Morning', 'pm': 'Afternoon', 'eve': 'Evening' };

// Pending items for day selection modal
let pendingShoppingItems = [];
let pendingBundles = [];

/**
 * Render the weekly plan with swimlane view
 */
function renderWeeklyPlan() {
  const container = document.getElementById('weekly-calendar');
  if (!container) return;
  
  // Get bundle options by category
  const breakfastOptions = state.bundles.filter(b => b.category === 'breakfast')
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  const lunchOptions = state.bundles.filter(b => b.category === 'lunch')
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  const dinnerOptions = state.bundles.filter(b => b.category === 'dinner')
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  
  // Activity options grouped by category
  const activityCategories = [...new Set(state.activities.map(a => a.category))];
  const activityOptions = activityCategories.map(cat => `
    <optgroup label="${escapeHtml(cat)}">
      ${state.activities.filter(a => a.category === cat).map(a => 
        `<option value="${a.id}">${escapeHtml(a.name)}</option>`
      ).join('')}
    </optgroup>
  `).join('');
  
  const choreOptions = state.chores.map(c => 
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');
  
  container.innerHTML = `
    <div class="weekly-grid swimlane-view">
      <!-- Header row -->
      <div class="weekly-header-row">
        <div class="swimlane-label"></div>
        ${DAYS.map(d => `<div class="day-header">${DAY_NAMES_SHORT[d]}</div>`).join('')}
      </div>
      
      <!-- Meals swimlane -->
      <div class="swimlane swimlane-group">
        <div class="swimlane-label">🍽️ Meals</div>
        <div class="swimlane-content">
          ${renderMealSubRow('Breakfast', 'breakfast', breakfastOptions)}
          ${renderMealSubRow('Lunch', 'lunch', lunchOptions)}
          ${renderMealSubRow('Dinner', 'dinner', dinnerOptions)}
        </div>
      </div>
      
      <!-- Activities swimlane -->
      <div class="swimlane swimlane-group">
        <div class="swimlane-label">🎯 Activities</div>
        <div class="swimlane-content">
          ${TIME_SLOTS.map(time => renderActivityChoreSubRow('activities', time, activityOptions)).join('')}
        </div>
      </div>
      
      <!-- Chores swimlane -->
      <div class="swimlane swimlane-group">
        <div class="swimlane-label">🧹 Chores</div>
        <div class="swimlane-content">
          ${TIME_SLOTS.map(time => renderActivityChoreSubRow('chores', time, choreOptions)).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a meal sub-row (breakfast/lunch/dinner)
 */
function renderMealSubRow(label, type, options) {
  return `
    <div class="meal-subrow">
      <div class="meal-subrow-label">${label}</div>
      ${DAYS.map(day => {
        const dayPlan = state.weeklyPlan?.[type]?.[day] || [];
        const mealsArray = Array.isArray(dayPlan) ? dayPlan : (dayPlan ? [dayPlan] : []);
        return `
          <div class="swimlane-cell">
            ${mealsArray.map((bundle, idx) => {
              const bundleName = typeof bundle === 'object' ? bundle.name : (state.bundles.find(b => b.id === bundle)?.name || bundle);
              return `
                <div class="plan-item meal-item">
                  <span>${escapeHtml(bundleName)}</span>
                  <button onclick="removePlanItem('${type}', '${day}', ${idx})">&times;</button>
                </div>
              `;
            }).join('')}
            <select class="add-plan-item" onchange="addPlanItem('${type}', '${day}', this.value); this.value=''">
              <option value="">+</option>
              ${options}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render an activity/chore sub-row for a time slot
 */
function renderActivityChoreSubRow(type, time, options) {
  return `
    <div class="meal-subrow">
      <div class="meal-subrow-label">${TIME_LABELS[time]}</div>
      ${DAYS.map(day => {
        const key = `${day}-${time}`;
        const slotItems = state.weeklyPlan?.[type]?.[key] || [];
        return `
          <div class="swimlane-cell">
            ${slotItems.map((item, idx) => `
              <div class="plan-item ${type === 'activities' ? 'activity-item' : 'chore-item'}">
                <span>${escapeHtml(item.name)}</span>
                <button onclick="removePlanItemSlot('${type}', '${key}', ${idx})">&times;</button>
              </div>
            `).join('')}
            <select class="add-plan-item" onchange="addPlanItemSlot('${type}', '${key}', this.value); this.value=''">
              <option value="">+</option>
              ${options}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Add a bundle to a meal slot
 */
async function addPlanItem(type, day, bundleId) {
  if (!bundleId) return;
  
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return;
  
  if (!state.weeklyPlan) state.weeklyPlan = {};
  if (!state.weeklyPlan[type]) state.weeklyPlan[type] = {};
  if (!state.weeklyPlan[type][day]) state.weeklyPlan[type][day] = [];
  if (!Array.isArray(state.weeklyPlan[type][day])) {
    state.weeklyPlan[type][day] = state.weeklyPlan[type][day] ? [state.weeklyPlan[type][day]] : [];
  }
  
  // Don't add duplicate
  if (!state.weeklyPlan[type][day].find(b => b.id === bundleId)) {
    state.weeklyPlan[type][day].push({ id: bundle.id, name: bundle.name });
  }
  
  await saveWeeklyPlan();
  renderWeeklyPlan();
}

/**
 * Remove a bundle from a meal slot
 */
async function removePlanItem(type, day, index) {
  if (!state.weeklyPlan?.[type]?.[day]) return;
  
  if (Array.isArray(state.weeklyPlan[type][day])) {
    state.weeklyPlan[type][day].splice(index, 1);
  } else {
    state.weeklyPlan[type][day] = null;
  }
  
  await saveWeeklyPlan();
  renderWeeklyPlan();
}

/**
 * Add an activity/chore to a time slot
 */
async function addPlanItemSlot(type, key, itemId) {
  if (!itemId) return;
  
  const items = type === 'activities' ? state.activities : state.chores;
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  
  if (!state.weeklyPlan) state.weeklyPlan = {};
  if (!state.weeklyPlan[type]) state.weeklyPlan[type] = {};
  if (!state.weeklyPlan[type][key]) state.weeklyPlan[type][key] = [];
  
  // Don't add duplicate
  if (!state.weeklyPlan[type][key].find(i => i.id === itemId)) {
    state.weeklyPlan[type][key].push({ id: item.id, name: item.name });
  }
  
  await saveWeeklyPlan();
  renderWeeklyPlan();
}

/**
 * Remove an activity/chore from a time slot
 */
async function removePlanItemSlot(type, key, index) {
  if (!state.weeklyPlan?.[type]?.[key]) return;
  
  state.weeklyPlan[type][key].splice(index, 1);
  
  await saveWeeklyPlan();
  renderWeeklyPlan();
}

/**
 * Clear the entire weekly plan
 */
async function clearWeeklyPlan() {
  state.weeklyPlan = {
    breakfast: {},
    lunch: {},
    dinner: {},
    activities: {},
    chores: {}
  };
  await saveWeeklyPlan();
  renderWeeklyPlan();
}

/**
 * Show day selection modal for bundles being added to shopping
 */
function showDaySelectionModal(bundlesList, shoppingItems, onConfirm) {
  pendingBundles = bundlesList;
  pendingShoppingItems = shoppingItems;
  
  const modal = document.getElementById('dinner-modal');
  const list = document.getElementById('dinner-day-list');
  if (!modal || !list) {
    // No modal available, call confirm directly
    onConfirm([], shoppingItems);
    return;
  }
  
  const dayNames = { 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun' };
  
  list.innerHTML = bundlesList.map(bundle => {
    const mealCat = bundle.category || 'dinner';
    return `
      <div class="dinner-day-row">
        <span class="dinner-name">${escapeHtml(bundle.name)}</span>
        <div class="day-checkboxes" data-bundle-id="${bundle.id}" data-meal-category="${mealCat}">
          ${DAYS.map(d => {
            const dayPlan = state.weeklyPlan?.[mealCat]?.[d];
            const mealsArray = Array.isArray(dayPlan) ? dayPlan : (dayPlan ? [dayPlan] : []);
            const alreadyAdded = mealsArray.some(m => m.id === bundle.id);
            return `
              <label class="day-checkbox ${alreadyAdded ? 'taken' : ''}">
                <input type="checkbox" value="${d}" ${alreadyAdded ? 'disabled' : ''}>
                <span>${dayNames[d]}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  // Store callback
  window._daySelectionCallback = onConfirm;
  
  modal.classList.add('active');
}

/**
 * Close the day selection modal
 */
function closeDinnerModal() {
  document.getElementById('dinner-modal')?.classList.remove('active');
  pendingBundles = [];
  pendingShoppingItems = [];
}

/**
 * Confirm day selection and add to weekly plan
 */
async function confirmDinnerDays() {
  // Store items before clearing
  const itemsToPass = [...pendingShoppingItems];
  const bundlesToPass = [...pendingBundles];
  const callback = window._daySelectionCallback;
  
  // Get checked days for each bundle
  const rows = document.querySelectorAll('.day-checkboxes');
  rows.forEach(row => {
    const bundleId = row.dataset.bundleId;
    const mealCategory = row.dataset.mealCategory || 'dinner';
    const bundle = state.bundles.find(b => b.id === bundleId);
    if (bundle) {
      const checkedBoxes = row.querySelectorAll('input[type="checkbox"]:checked');
      checkedBoxes.forEach(cb => {
        const day = cb.value;
        if (!state.weeklyPlan) state.weeklyPlan = {};
        if (!state.weeklyPlan[mealCategory]) state.weeklyPlan[mealCategory] = {};
        if (!state.weeklyPlan[mealCategory][day]) state.weeklyPlan[mealCategory][day] = [];
        if (!Array.isArray(state.weeklyPlan[mealCategory][day])) {
          state.weeklyPlan[mealCategory][day] = state.weeklyPlan[mealCategory][day] ? [state.weeklyPlan[mealCategory][day]] : [];
        }
        if (!state.weeklyPlan[mealCategory][day].find(m => m.id === bundleId)) {
          state.weeklyPlan[mealCategory][day].push({ id: bundle.id, name: bundle.name });
        }
      });
    }
  });
  
  await saveWeeklyPlan();
  closeDinnerModal();
  
  // Call the callback with the stored items
  if (callback) {
    callback(bundlesToPass, itemsToPass);
    window._daySelectionCallback = null;
  }
  
  renderWeeklyPlan();
}

/**
 * Print the weekly plan
 */
function printWeeklyPlan() {
  window.print();
}

export {
  DAYS,
  DAY_NAMES_SHORT,
  TIME_SLOTS,
  TIME_LABELS,
  renderWeeklyPlan,
  addPlanItem,
  removePlanItem,
  addPlanItemSlot,
  removePlanItemSlot,
  clearWeeklyPlan,
  showDaySelectionModal,
  closeDinnerModal,
  confirmDinnerDays,
  printWeeklyPlan
};
