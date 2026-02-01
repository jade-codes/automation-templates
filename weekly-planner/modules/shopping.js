// ==========================================
// Shopping Module - Shopping list management
// ==========================================

import { state, saveShopping, getItem, getItemUrl, SHOPPING_CATEGORIES } from './store.js';
import { combineQuantities, escapeHtml, escapeJs, parseQuantity } from './utils.js';
import { getResolvedBundleItems } from './bundles.js';

/**
 * Add items from selected bundles to shopping list
 * @returns {Array} Array of added items
 */
function addSelectedToShopping() {
  const addedItems = [];
  
  state.selectedItems.forEach((itemIds, bundleId) => {
    const bundle = state.bundles.find(b => b.id === bundleId);
    if (!bundle) return;
    
    itemIds.forEach(itemId => {
      const bundleItem = bundle.items.find(bi => bi.itemId === itemId);
      if (!bundleItem) return;
      
      const item = getItem(itemId);
      if (!item) return;
      
      addToShoppingList(item, {
        quantity: bundleItem.quantity || 1,
        from: bundle.name
      });
      
      addedItems.push({ item, quantity: bundleItem.quantity || 1, from: bundle.name });
    });
  });
  
  // Clear selections
  state.selectedItems.clear();
  
  return addedItems;
}

/**
 * Add an item to the shopping list
 * @param {Object} item - The item from items.json
 * @param {Object} options - Options {quantity, from, unit}
 */
function addToShoppingList(item, options = {}) {
  const { quantity = 1, from = '', unit = null } = options;
  
  // Find existing item in shopping list
  const existing = state.shopping.find(s => s.itemId === item.id || s.name === item.name);
  
  if (existing) {
    // Add to quantities
    if (!existing.quantities) existing.quantities = [];
    existing.quantities.push({
      num: quantity,
      unit: unit || item.unit || '',
      from
    });
    existing.checked = false; // Uncheck when adding more
  } else {
    // Add new item
    const url = getItemUrl(item);
    state.shopping.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      unit: unit || item.unit || 'item',
      url: url,
      store: item.sources?.[0]?.store || 'Unknown',
      quantities: [{
        num: quantity,
        unit: unit || item.unit || '',
        from
      }],
      checked: false
    });
  }
}

/**
 * Add a manual item to shopping list (not from items.json)
 * @param {Object} itemData - The item data
 */
function addManualToShopping(itemData) {
  const { name, quantity = 1, unit = '', category = 'Other|Other', store = '', url = '' } = itemData;
  
  // Check if exists
  const existing = state.shopping.find(s => s.name.toLowerCase() === name.toLowerCase());
  
  if (existing) {
    if (!existing.quantities) existing.quantities = [];
    existing.quantities.push({ num: quantity, unit, from: 'Manual' });
    existing.checked = false;
  } else {
    state.shopping.push({
      name,
      category,
      unit,
      url,
      store,
      quantities: [{ num: quantity, unit, from: 'Manual' }],
      checked: false
    });
  }
}

/**
 * Toggle checked state of a shopping item
 * @param {number} index - The item index
 */
function toggleShoppingChecked(index) {
  if (index >= 0 && index < state.shopping.length) {
    state.shopping[index].checked = !state.shopping[index].checked;
  }
}

/**
 * Remove a shopping item
 * @param {number} index - The item index
 */
function removeShoppingItem(index) {
  if (index >= 0 && index < state.shopping.length) {
    state.shopping.splice(index, 1);
  }
}

/**
 * Clear all shopping items
 */
function clearShopping() {
  state.shopping = [];
}

/**
 * Clear only checked items
 */
function clearCheckedItems() {
  state.shopping = state.shopping.filter(item => !item.checked);
}

/**
 * Increment shopping item quantity
 * @param {number} index - The item index
 */
function incrementShoppingQty(index) {
  const item = state.shopping[index];
  if (!item) return;
  
  if (item.quantities && item.quantities.length > 0) {
    item.quantities[0].num = (item.quantities[0].num || 1) + 1;
  } else {
    item.quantities = [{ num: 2, unit: item.unit || '' }];
  }
}

/**
 * Decrement shopping item quantity
 * @param {number} index - The item index
 */
function decrementShoppingQty(index) {
  const item = state.shopping[index];
  if (!item || !item.quantities || item.quantities.length === 0) return;
  
  const qty = item.quantities[0];
  if (qty.num > 1) {
    qty.num--;
  }
}

/**
 * Update shopping item unit
 * @param {number} index - The item index
 * @param {string} unit - The new unit
 */
function updateShoppingUnit(index, unit) {
  const item = state.shopping[index];
  if (!item) return;
  
  item.unit = unit;
  if (item.quantities) {
    item.quantities.forEach(q => q.unit = unit);
  }
}

/**
 * Get shopping list organized by store
 * @returns {Object} Shopping items grouped by store
 */
function getShoppingByStore() {
  const byStore = {};
  
  state.shopping.forEach((item, index) => {
    const store = item.store || 'Other';
    if (!byStore[store]) byStore[store] = [];
    byStore[store].push({ ...item, index });
  });
  
  return byStore;
}

/**
 * Get shopping list organized by category
 * @returns {Object} Shopping items grouped by category
 */
function getShoppingByCategory() {
  const byCategory = {};
  
  state.shopping.forEach((item, index) => {
    const cat = item.category?.split('|')[0] || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ ...item, index });
  });
  
  return byCategory;
}

/**
 * Copy shopping list to clipboard
 * @returns {string} The copied text
 */
function copyShoppingList() {
  const byStore = getShoppingByStore();
  let text = '';
  
  for (const [store, items] of Object.entries(byStore)) {
    const unchecked = items.filter(i => !i.checked);
    if (unchecked.length === 0) continue;
    
    text += `=== ${store} ===\n`;
    unchecked.forEach(item => {
      const qty = combineQuantities(item.quantities, false);
      const unit = item.unit || '';
      text += `☐ ${item.name} - ${qty}${unit ? ' ' + unit : ''}\n`;
    });
    text += '\n';
  }
  
  navigator.clipboard.writeText(text.trim());
  return text.trim();
}

/**
 * Render the shopping list - matches old app.js table layout
 * @param {HTMLElement} container - The container element
 */
function renderShoppingList(container) {
  const emptyEl = document.getElementById('shopping-empty');
  
  if (state.shopping.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  
  if (emptyEl) emptyEl.style.display = 'none';
  
  // Group by category (Fridge, Cupboard, etc.) then subcategory
  const categories = {};
  state.shopping.forEach((item, index) => {
    const catParts = (item.category || 'Other|Other').split('|');
    const mainCat = catParts[0] || 'Other';
    const subCat = catParts[1] || 'Other';
    
    if (!categories[mainCat]) categories[mainCat] = {};
    if (!categories[mainCat][subCat]) categories[mainCat][subCat] = [];
    categories[mainCat][subCat].push({ ...item, index });
  });
  
  // Order categories
  const categoryOrder = ['Fridge', 'Fresh', 'Bakery', 'Cupboard', 'Freezer', 'Other'];
  const sortedCats = categoryOrder.filter(c => categories[c]);
  // Add any other categories not in the order
  Object.keys(categories).forEach(c => {
    if (!sortedCats.includes(c)) sortedCats.push(c);
  });
  
  container.innerHTML = sortedCats.map(mainCat => {
    const subcats = categories[mainCat];
    const totalItems = Object.values(subcats).flat().length;
    
    return `
      <li class="category-group expanded">
        <div class="category-group-header" onclick="toggleCategoryGroup(this)">
          <span class="category-name">${escapeHtml(mainCat)}</span>
          <span class="category-count">${totalItems} items</span>
          <span class="category-toggle">▼</span>
        </div>
        <div class="category-items">
          ${Object.entries(subcats).map(([subCat, items]) => `
            <div class="subcategory">
              <div class="subcategory-header">${escapeHtml(subCat)}</div>
              <table class="shopping-table">
                <tbody>
                ${items.map(item => {
                  const displayQty = item.quantities ? combineQuantities(item.quantities) : (item.quantity || 1);
                  const displayUnit = item.unit || (item.quantities && item.quantities[0]?.unit) || '';
                  const sourcesDisplay = item.quantities && item.quantities.length > 1 
                    ? `from ${item.quantities.length} bundles` 
                    : (item.quantities && item.quantities[0]?.from ? `from ${item.quantities[0].from}` : '');
                  const itemUrl = item.url || (item.urls && item.urls[0]);
                  return `
                    <tr class="${item.checked ? 'checked' : ''}">
                      <td class="col-check"><input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleShoppingChecked(${item.index})"></td>
                      <td class="col-name">${itemUrl ? `<a href="${escapeHtml(itemUrl)}" target="_blank">${escapeHtml(item.name)}</a>` : escapeHtml(item.name)}</td>
                      <td class="col-qty">
                        <div class="qty-controls">
                          <button class="qty-btn" onclick="event.stopPropagation(); decrementShoppingQty(${item.index})">−</button>
                          <span class="qty-display">${displayQty}</span>
                          <button class="qty-btn" onclick="event.stopPropagation(); incrementShoppingQty(${item.index})">+</button>
                        </div>
                      </td>
                      <td class="col-unit">
                        <input type="text" class="unit-input" value="${escapeHtml(displayUnit)}" placeholder="unit"
                               onchange="updateShoppingUnit(${item.index}, this.value)"
                               onclick="event.stopPropagation()">
                      </td>
                      <td class="col-store"><span class="item-store">${escapeHtml(item.store || 'Tesco')}</span></td>
                      <td class="col-source">${sourcesDisplay ? `<span class="item-source">${escapeHtml(sourcesDisplay)}</span>` : ''}</td>
                      <td class="col-actions"><button class="remove-item" onclick="event.stopPropagation(); removeShoppingItem(${item.index})">&times;</button></td>
                    </tr>
                  `;
                }).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      </li>
    `;
  }).join('');
}

export {
  addSelectedToShopping,
  addToShoppingList,
  addManualToShopping,
  toggleShoppingChecked,
  removeShoppingItem,
  clearShopping,
  clearCheckedItems,
  incrementShoppingQty,
  decrementShoppingQty,
  updateShoppingUnit,
  getShoppingByStore,
  getShoppingByCategory,
  copyShoppingList,
  renderShoppingList
};
