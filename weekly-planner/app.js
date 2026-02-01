// ==========================================
// Weekly Planner App - Main Entry Point (Clean)
// ==========================================
// Modular architecture using ES modules
// 
// Modules:
//   - api.js       : Data loading/saving
//   - store.js     : Global state management
//   - utils.js     : Utility functions
//   - items.js     : Product management
//   - bundles.js   : Bundle (meal/set) management
//   - shopping.js  : Shopping list
//   - weekly.js    : Weekly plan
//   - activities.js: Activities management
//   - chores.js    : Chores management
//   - modal.js     : Modal editing
// ==========================================

import { API_ENDPOINTS, loadData, saveData } from './modules/api.js';
import { 
  state, 
  SHOPPING_CATEGORIES, 
  BUNDLE_CATEGORIES,
  loadAllData, 
  saveItems, 
  saveBundles, 
  saveShopping,
  saveWeeklyPlan,
  saveActivities,
  saveChores,
  getItem,
  getItemByName,
  getItemUrl,
  getDefaultStore,
  rebuildItemsIndex
} from './modules/store.js';
import { 
  generateId, 
  slugify, 
  capitalize, 
  parseQuantity, 
  combineQuantities, 
  debounce,
  escapeHtml,
  escapeJs
} from './modules/utils.js';
import {
  addItem,
  updateItem,
  deleteItem as deleteItemFn,
  addItemSource,
  removeItemSource,
  findOrCreateItem,
  getCategoryOptionsHtml,
  renderItemsList,
  renderItemsTab
} from './modules/items.js';
import {
  addBundle,
  updateBundle,
  deleteBundle as deleteBundleFn,
  addItemToBundle,
  removeItemFromBundle,
  updateBundleItemQuantity,
  getBundlesByCategory,
  toggleBundleExpand,
  toggleItemSelection,
  selectAllBundleItems,
  deselectAllBundleItems,
  getResolvedBundleItems,
  getSelectedItemCount,
  renderBundles,
  renderBundleCategory
} from './modules/bundles.js';
import {
  addSelectedToShopping,
  addToShoppingList,
  addManualToShopping,
  toggleShoppingChecked,
  removeShoppingItem as removeShoppingItemFn,
  clearShopping,
  clearCheckedItems,
  incrementShoppingQty,
  decrementShoppingQty,
  updateShoppingUnit,
  copyShoppingList,
  renderShoppingList
} from './modules/shopping.js';
import {
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
} from './modules/weekly.js';
import {
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
} from './modules/activities.js';
import {
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
} from './modules/chores.js';
import {
  openModal,
  closeModal,
  addItemRow,
  addModalUrlRow,
  onModalItemInput,
  initModal
} from './modules/modal.js';

// ==========================================
// Global state for filters
// ==========================================
let currentFilter = '';

// ==========================================
// Helper Functions
// ==========================================
function renderBundlesWithFilter() {
  const searchInput = document.getElementById('meal-search');
  const filter = searchInput ? searchInput.value.trim() : currentFilter;
  renderBundles({ filter });
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = getSelectedItemCount();
  const countEl = document.getElementById('selected-count');
  if (countEl) {
    countEl.textContent = count > 0 ? `(${count} selected)` : '';
  }
  
  const addBtn = document.getElementById('add-selected-btn');
  if (addBtn) {
    addBtn.disabled = count === 0;
  }
}

// ==========================================
// Bundle Global Handlers
// ==========================================
window.toggleBundleExpand = async (bundleId) => {
  toggleBundleExpand(bundleId);
  renderBundlesWithFilter();
};

window.toggleItemSelection = async (bundleId, itemId) => {
  toggleItemSelection(bundleId, itemId);
  renderBundlesWithFilter();
};

window.toggleAllBundleItems = (bundleId, checked) => {
  if (checked) {
    selectAllBundleItems(bundleId);
  } else {
    deselectAllBundleItems(bundleId);
  }
  renderBundlesWithFilter();
};

window.selectAllBundleItems = (bundleId) => {
  selectAllBundleItems(bundleId);
  renderBundlesWithFilter();
};

window.deselectAllBundleItems = (bundleId) => {
  deselectAllBundleItems(bundleId);
  renderBundlesWithFilter();
};

window.deleteBundle = async (bundleId) => {
  if (!confirm('Delete this bundle?')) return;
  deleteBundleFn(bundleId);
  await saveBundles();
  renderBundlesWithFilter();
};

window.removeItemFromBundle = async (bundleId, itemId) => {
  removeItemFromBundle(bundleId, itemId);
  await saveBundles();
  renderBundlesWithFilter();
};

window.updateBundleItemQuantity = async (bundleId, itemId, quantity) => {
  updateBundleItemQuantity(bundleId, itemId, parseFloat(quantity) || 1);
  await saveBundles();
};

window.updateBundleUrl = async (bundleId, url) => {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (bundle) {
    bundle.url = url;
    await saveBundles();
  }
};

window.updateItemSource = async (bundleId, itemIdx, sourceIdx, field, value) => {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle || !bundle.items[itemIdx]) return;
  
  const itemId = bundle.items[itemIdx].itemId;
  const item = getItem(itemId);
  if (!item) return;
  
  if (!item.sources) item.sources = [];
  if (!item.sources[sourceIdx]) {
    item.sources[sourceIdx] = { store: getDefaultStore(), url: '' };
  }
  
  item.sources[sourceIdx][field] = value;
  await saveItems();
};

window.updateItemUnit = async (itemId, unit) => {
  const item = getItem(itemId);
  if (!item) return;
  
  item.unit = unit;
  await saveItems();
};

window.removeItemSource = async (bundleId, itemIdx, sourceIdx) => {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle || !bundle.items[itemIdx]) return;
  
  const itemId = bundle.items[itemIdx].itemId;
  const item = getItem(itemId);
  if (!item || !item.sources) return;
  
  item.sources.splice(sourceIdx, 1);
  await saveItems();
  renderBundlesWithFilter();
};

window.onItemSelected = (bundleId) => {
  const nameInput = document.getElementById(`inline-ing-${bundleId}`);
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) return;
  
  const existing = getItemByName(name);
  if (existing) {
    console.log('Selected existing item:', existing.name);
  }
};

window.addItemToBundleInline = async (bundleId) => {
  const nameInput = document.getElementById(`inline-ing-${bundleId}`);
  const qtyInput = document.getElementById(`inline-qty-${bundleId}`);
  
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) return;
  
  const quantity = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;
  
  const item = findOrCreateItem(name);
  await saveItems();
  
  addItemToBundle(bundleId, item.id, quantity);
  await saveBundles();
  
  if (nameInput) nameInput.value = '';
  if (qtyInput) qtyInput.value = '1';
  renderBundlesWithFilter();
};

// ==========================================
// Shopping Global Handlers
// ==========================================
window.toggleShoppingChecked = async (index) => {
  toggleShoppingChecked(index);
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

window.removeShoppingItem = async (index) => {
  removeShoppingItemFn(index);
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

window.incrementShoppingQty = async (index) => {
  incrementShoppingQty(index);
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

window.decrementShoppingQty = async (index) => {
  decrementShoppingQty(index);
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

window.updateShoppingUnit = async (index, unit) => {
  updateShoppingUnit(index, unit);
  await saveShopping();
};

window.copyShoppingList = () => {
  const text = copyShoppingList();
  alert('Shopping list copied to clipboard!');
};

window.clearShoppingList = async () => {
  if (!confirm('Clear entire shopping list?')) return;
  clearShopping();
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

window.clearCheckedItems = async () => {
  clearCheckedItems();
  await saveShopping();
  renderShoppingList(document.getElementById('shopping-list'));
};

// Pending items for add selected flow
let pendingShoppingItems = [];
let pendingBundles = [];

window.addSelectedToShoppingList = async () => {
  // Check if anything is selected
  let hasSelections = false;
  state.selectedItems.forEach((itemIds) => {
    if (itemIds.size > 0) hasSelections = true;
  });
  
  if (!hasSelections) {
    alert('No items selected');
    return;
  }
  
  // Gather items and bundles
  pendingShoppingItems = [];
  pendingBundles = [];
  
  state.selectedItems.forEach((itemIds, bundleId) => {
    const bundle = state.bundles.find(b => b.id === bundleId);
    if (!bundle) return;
    
    pendingBundles.push(bundle);
    
    itemIds.forEach(itemId => {
      const bundleItem = bundle.items.find(bi => bi.itemId === itemId);
      if (!bundleItem) return;
      
      const item = getItem(itemId);
      if (!item) return;
      
      const existingPending = pendingShoppingItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (existingPending) {
        existingPending.quantities.push({ num: bundleItem.quantity || 1, unit: item.unit || '', from: bundle.name });
        if (!existingPending.sources.includes(bundle.name)) existingPending.sources.push(bundle.name);
      } else {
        pendingShoppingItems.push({
          itemId: item.id,
          name: item.name,
          category: item.category || 'Other|Other',
          unit: item.unit || '',
          url: item.sources?.[0]?.url || '',
          store: item.sources?.[0]?.store || 'Tesco',
          quantities: [{ num: bundleItem.quantity || 1, unit: item.unit || '', from: bundle.name }],
          sources: [bundle.name],
          checked: false
        });
      }
    });
  });
  
  if (pendingShoppingItems.length === 0) {
    alert('All selected items are already in your shopping list!');
    return;
  }
  
  // Show day selection modal
  showDaySelectionModal(pendingBundles, pendingShoppingItems, finishAddingToShopping);
};

async function finishAddingToShopping(bundles, items) {
  const itemsToAdd = items || pendingShoppingItems;
  
  itemsToAdd.forEach(item => {
    const existing = state.shopping.find(s => s.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      existing.quantities = existing.quantities || [];
      item.quantities.forEach(q => existing.quantities.push(q));
      existing.checked = false;
    } else {
      state.shopping.push(item);
    }
  });
  
  pendingShoppingItems = [];
  pendingBundles = [];
  
  await saveShopping();
  state.selectedItems.clear();
  
  renderBundlesWithFilter();
  renderShoppingList(document.getElementById('shopping-list'));
}

window.toggleStoreGroup = (store) => {
  const groups = document.querySelectorAll('.shopping-group');
  groups.forEach(g => {
    const header = g.querySelector('.shopping-group-header');
    if (header && header.textContent.includes(store)) {
      g.classList.toggle('collapsed');
    }
  });
};

window.toggleCategoryGroup = (header) => {
  const group = header.closest('.category-group');
  if (group) {
    group.classList.toggle('expanded');
    group.classList.toggle('collapsed');
  }
};

// ==========================================
// Weekly Plan Global Handlers
// ==========================================
window.addPlanItem = addPlanItem;
window.removePlanItem = removePlanItem;
window.addPlanItemSlot = addPlanItemSlot;
window.removePlanItemSlot = removePlanItemSlot;
window.closeDinnerModal = closeDinnerModal;
window.confirmDinnerDays = confirmDinnerDays;
window.printWeeklyPlan = printWeeklyPlan;
window.clearWeeklyPlan = async () => {
  if (!confirm('Clear entire weekly plan?')) return;
  await clearWeeklyPlan();
};

window.assignMeal = (mealType, day) => {
  const bundles = state.bundles.filter(b => b.category === mealType);
  if (bundles.length === 0) {
    alert(`No ${mealType} bundles available`);
    return;
  }
  
  const options = bundles.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
  const choice = prompt(`Choose a ${mealType} for ${day}:\n\n${options}\n\nEnter number (or 0 to clear):`);
  
  if (choice === null) return;
  const num = parseInt(choice);
  
  if (!state.weeklyPlan) state.weeklyPlan = {};
  if (!state.weeklyPlan[mealType]) state.weeklyPlan[mealType] = {};
  
  if (num === 0) {
    state.weeklyPlan[mealType][day] = [];
  } else if (num > 0 && num <= bundles.length) {
    const bundle = bundles[num - 1];
    if (!state.weeklyPlan[mealType][day]) state.weeklyPlan[mealType][day] = [];
    if (!Array.isArray(state.weeklyPlan[mealType][day])) state.weeklyPlan[mealType][day] = [];
    state.weeklyPlan[mealType][day].push({ id: bundle.id, name: bundle.name });
  }
  
  saveWeeklyPlan();
  renderWeeklyPlan();
};

// ==========================================
// Activities Global Handlers
// ==========================================
window.toggleActivityCategory = toggleActivityCategory;
window.toggleActivitySlot = toggleActivitySlot;
window.addActivityInline = addActivityInline;
window.deleteActivity = deleteActivity;
window.editActivity = (activityId) => {
  alert('Activity editing coming soon!');
};

// ==========================================
// Chores Global Handlers
// ==========================================
window.toggleChoreCategory = toggleChoreCategory;
window.toggleChoreSlot = toggleChoreSlot;
window.addChoreInline = addChoreInline;
window.deleteChore = deleteChore;
window.editChore = (choreId) => {
  alert('Chore editing coming soon!');
};

// ==========================================
// Items Global Handlers
// ==========================================
window.editItem = (itemId) => {
  const item = getItem(itemId);
  if (!item) return;
  
  // Open modal with item data
  const modal = document.getElementById('item-edit-modal');
  if (!modal) return;
  
  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('edit-item-name').value = item.name || '';
  document.getElementById('edit-item-unit').value = item.unit || '';
  document.getElementById('edit-item-category').value = item.category || '';
  
  // Render sources
  const sourcesContainer = document.getElementById('edit-item-sources');
  const sources = item.sources || [];
  sourcesContainer.innerHTML = sources.map((src, idx) => `
    <div class="source-row" data-index="${idx}">
      <input type="text" class="source-store" value="${src.store || ''}" placeholder="Store">
      <input type="url" class="source-url" value="${src.url || ''}" placeholder="URL">
      <button type="button" class="btn-small btn-delete" onclick="removeEditSource(${idx})">×</button>
    </div>
  `).join('') || '<p class="empty">No sources</p>';
  
  modal.style.display = 'flex';
};

window.closeItemModal = () => {
  const modal = document.getElementById('item-edit-modal');
  if (modal) modal.style.display = 'none';
};

window.addEditSource = () => {
  const container = document.getElementById('edit-item-sources');
  const empty = container.querySelector('.empty');
  if (empty) empty.remove();
  
  const idx = container.querySelectorAll('.source-row').length;
  const row = document.createElement('div');
  row.className = 'source-row';
  row.dataset.index = idx;
  row.innerHTML = `
    <input type="text" class="source-store" value="" placeholder="Store">
    <input type="url" class="source-url" value="" placeholder="URL">
    <button type="button" class="btn-small btn-delete" onclick="removeEditSource(${idx})">×</button>
  `;
  container.appendChild(row);
};

window.removeEditSource = (idx) => {
  const container = document.getElementById('edit-item-sources');
  const row = container.querySelector(`.source-row[data-index="${idx}"]`);
  if (row) row.remove();
};

window.updateItemField = async (itemId, field, value) => {
  const item = getItem(itemId);
  if (!item) return;
  
  item[field] = value;
  await saveItems();
};

window.updateItemSourceField = async (itemId, field, value) => {
  const item = getItem(itemId);
  if (!item) return;
  
  if (!item.sources) item.sources = [];
  if (!item.sources[0]) item.sources[0] = { store: '', url: '' };
  
  item.sources[0][field] = value;
  await saveItems();
};

window.deleteItemFromTab = async (itemId) => {
  if (!confirm('Delete this item?')) return;
  deleteItemFn(itemId);
  await saveItems();
  renderItemsTab();
};

window.addNewItem = () => {
  // Open modal with empty item data for creating a new item
  const modal = document.getElementById('item-edit-modal');
  if (!modal) return;
  
  document.getElementById('edit-item-id').value = '';
  document.getElementById('edit-item-name').value = '';
  document.getElementById('edit-item-unit').value = '';
  document.getElementById('edit-item-category').value = '';
  document.getElementById('item-modal-title').textContent = 'Add Item';
  
  // Clear sources
  document.getElementById('edit-item-sources').innerHTML = '<p class="empty">No sources</p>';
  
  modal.style.display = 'flex';
};

window.addItemInline = async () => {
  const nameInput = document.getElementById('new-item-name');
  const categoryInput = document.getElementById('new-item-category');
  const unitInput = document.getElementById('new-item-unit');
  const storeInput = document.getElementById('new-item-store');
  const urlInput = document.getElementById('new-item-url');
  
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  
  const item = addItem({
    name,
    category: categoryInput.value.trim(),
    unit: unitInput.value.trim()
  });
  
  const store = storeInput.value.trim();
  const url = urlInput.value.trim();
  if (store || url) {
    item.sources = [{ store: store || 'Tesco', url }];
  }
  
  await saveItems();
  
  // Clear inputs
  nameInput.value = '';
  categoryInput.value = '';
  unitInput.value = '';
  storeInput.value = '';
  urlInput.value = '';
  
  renderItemsTab();
  nameInput.focus();
};

window.renderItemsList = () => {
  renderItemsTab();
};

// ==========================================
// Filter/Search Functions
// ==========================================
window.filterBundles = () => {
  const searchInput = document.getElementById('meal-search') || document.getElementById('bundle-search');
  const searchValue = searchInput ? searchInput.value.trim() : '';
  renderBundles({ filter: searchValue });
};

window.filterCategoryItems = (category, value) => {
  renderBundles({ filter: value });
};

window.toggleCategory = (category) => {
  console.log('Toggle category:', category);
};

window.filterActivities = () => {
  const searchInput = document.getElementById('activity-search');
  const filterSelect = document.getElementById('activity-filter');
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterValue = filterSelect ? filterSelect.value : 'all';
  
  const items = document.querySelectorAll('#activities-list .activity-item');
  items.forEach(item => {
    const name = item.querySelector('.activity-name')?.textContent.toLowerCase() || '';
    const category = item.dataset.category || '';
    
    const matchesSearch = !searchValue || name.includes(searchValue);
    const matchesFilter = filterValue === 'all' || category === filterValue;
    
    item.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
  });
};

window.filterChores = () => {
  const searchInput = document.getElementById('chore-search');
  const filterSelect = document.getElementById('chore-filter');
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterValue = filterSelect ? filterSelect.value : 'all';
  
  const items = document.querySelectorAll('#chores-list .chore-item');
  items.forEach(item => {
    const name = item.querySelector('.chore-name')?.textContent.toLowerCase() || '';
    const frequency = item.dataset.frequency || '';
    
    const matchesSearch = !searchValue || name.includes(searchValue);
    const matchesFilter = filterValue === 'all' || frequency === filterValue;
    
    item.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
  });
};

// ==========================================
// Modal Handler
// ==========================================
window.openModal = openModal;
window.closeModal = closeModal;
window.addItemRow = addItemRow;
window.addModalUrlRow = addModalUrlRow;
window.onModalItemInput = onModalItemInput;

// ==========================================
// Utility Functions
// ==========================================
window.exportToGoogleKeep = () => {
  const text = copyShoppingList();
  alert('Shopping list copied! You can paste it into Google Keep.');
};

window.parseImportedProducts = () => {
  const textarea = document.getElementById('import-json');
  const outputDiv = document.getElementById('imported-products');
  
  if (!textarea || !outputDiv) return;
  
  try {
    const products = JSON.parse(textarea.value);
    if (!Array.isArray(products)) throw new Error('Expected an array');
    
    outputDiv.innerHTML = `
      <p>Found ${products.length} products:</p>
      <ul class="imported-list">
        ${products.map((p, i) => `
          <li>
            <span class="imported-name">${escapeHtml(p.name || 'Unknown')}</span>
            ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank">🔗</a>` : ''}
            <button class="btn-small" onclick="addImportedProduct(${i})">Add</button>
          </li>
        `).join('')}
      </ul>
      <button class="btn-add" onclick="addAllImportedProducts()">Add All to Items</button>
    `;
    
    window._importedProducts = products;
  } catch (e) {
    outputDiv.innerHTML = `<p class="error">Invalid JSON: ${e.message}</p>`;
  }
};

window.addImportedProduct = async (index) => {
  const products = window._importedProducts;
  if (!products || !products[index]) return;
  
  const p = products[index];
  const item = findOrCreateItem(p.name, {
    sources: p.url ? [{ store: getDefaultStore(), url: p.url }] : []
  });
  
  await saveItems();
  alert(`Added: ${p.name}`);
};

window.addAllImportedProducts = async () => {
  const products = window._importedProducts;
  if (!products) return;
  
  let added = 0;
  for (const p of products) {
    findOrCreateItem(p.name, {
      sources: p.url ? [{ store: getDefaultStore(), url: p.url }] : []
    });
    added++;
  }
  
  await saveItems();
  alert(`Added ${added} products to items!`);
  
  document.getElementById('import-json').value = '';
  document.getElementById('imported-products').innerHTML = '';
  window._importedProducts = null;
};

// ==========================================
// Tab Navigation
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ==========================================
// Search/Filter with Debouncing
// ==========================================
const debouncedFilter = debounce((searchValue) => {
  currentFilter = searchValue;
  renderBundles({ filter: searchValue });
}, 300);

const searchInput = document.getElementById('meal-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    debouncedFilter(e.target.value.trim());
  });
}

// ==========================================
// Initialize App
// ==========================================
async function init() {
  console.log('Initializing Weekly Planner...');
  
  await loadAllData();
  
  // Initialize modal
  initModal();
  
  // Item edit form handler
  const itemEditForm = document.getElementById('item-edit-form');
  if (itemEditForm) {
    itemEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const itemId = document.getElementById('edit-item-id').value;
      const name = document.getElementById('edit-item-name').value.trim();
      
      if (!name) {
        alert('Please enter an item name');
        return;
      }
      
      let item;
      if (itemId) {
        // Editing existing item
        item = getItem(itemId);
        if (!item) return;
      } else {
        // Creating new item
        item = addItem({ name });
      }
      
      item.name = name;
      item.unit = document.getElementById('edit-item-unit').value;
      item.category = document.getElementById('edit-item-category').value;
      
      // Collect sources
      const sourceRows = document.querySelectorAll('#edit-item-sources .source-row');
      item.sources = [];
      sourceRows.forEach(row => {
        const store = row.querySelector('.source-store').value;
        const url = row.querySelector('.source-url').value;
        if (store || url) {
          item.sources.push({ store, url });
        }
      });
      
      await saveItems();
      closeItemModal();
      renderItemsTab();
    });
  }
  
  // Render all tabs
  renderBundles();
  renderShoppingList(document.getElementById('shopping-list'));
  renderActivities();
  renderChores();
  renderWeeklyPlan();
  renderItemsTab();
  updateSelectedCount();
  
  console.log('App initialized!');
}

// Start the app
init();
