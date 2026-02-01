// ==========================================
// Bundles Module - Bundle (meal/set) management
// ==========================================

import { state, saveBundles, getItem, getItemUrl, getDefaultStore, BUNDLE_CATEGORIES } from './store.js';
import { generateId, slugify, escapeHtml, escapeJs, capitalize } from './utils.js';
import { findOrCreateItem } from './items.js';

/**
 * Add a new bundle
 * @param {Object} bundleData - The bundle data
 * @returns {Object} The created bundle
 */
function addBundle(bundleData) {
  const id = bundleData.id || `${bundleData.category}-${generateId()}`;
  
  const bundle = {
    id,
    name: bundleData.name,
    category: bundleData.category || 'dinner',
    items: bundleData.items || []
  };
  
  state.bundles.push(bundle);
  return bundle;
}

/**
 * Update an existing bundle
 * @param {string} bundleId - The bundle ID
 * @param {Object} updates - The fields to update
 * @returns {Object|null} The updated bundle or null
 */
function updateBundle(bundleId, updates) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return null;
  
  Object.assign(bundle, updates);
  return bundle;
}

/**
 * Delete a bundle
 * @param {string} bundleId - The bundle ID
 * @returns {boolean} Success status
 */
function deleteBundle(bundleId) {
  const index = state.bundles.findIndex(b => b.id === bundleId);
  if (index === -1) return false;
  
  state.bundles.splice(index, 1);
  
  // Clean up UI state
  state.selectedBundles.delete(bundleId);
  state.selectedItems.delete(bundleId);
  state.expandedBundles.delete(bundleId);
  
  return true;
}

/**
 * Add an item to a bundle
 * @param {string} bundleId - The bundle ID
 * @param {string} itemId - The item ID
 * @param {number} quantity - The quantity
 * @returns {boolean} Success status
 */
function addItemToBundle(bundleId, itemId, quantity = 1) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return false;
  
  // Check if item already exists in bundle
  const existing = bundle.items.find(i => i.itemId === itemId);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    bundle.items.push({ itemId, quantity });
  }
  
  return true;
}

/**
 * Remove an item from a bundle
 * @param {string} bundleId - The bundle ID
 * @param {string} itemId - The item ID
 * @returns {boolean} Success status
 */
function removeItemFromBundle(bundleId, itemId) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return false;
  
  const index = bundle.items.findIndex(i => i.itemId === itemId);
  if (index === -1) return false;
  
  bundle.items.splice(index, 1);
  
  // Remove from selected items
  const selected = state.selectedItems.get(bundleId);
  if (selected) selected.delete(itemId);
  
  return true;
}

/**
 * Update an item's quantity in a bundle
 * @param {string} bundleId - The bundle ID
 * @param {string} itemId - The item ID
 * @param {number} quantity - The new quantity
 * @returns {boolean} Success status
 */
function updateBundleItemQuantity(bundleId, itemId, quantity) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return false;
  
  const bundleItem = bundle.items.find(i => i.itemId === itemId);
  if (!bundleItem) return false;
  
  bundleItem.quantity = quantity;
  return true;
}

/**
 * Get bundles by category
 * @param {string} category - The category name
 * @returns {Array} Array of bundles
 */
function getBundlesByCategory(category) {
  return state.bundles.filter(b => b.category === category);
}

/**
 * Toggle bundle expansion
 * @param {string} bundleId - The bundle ID
 */
function toggleBundleExpand(bundleId) {
  if (state.expandedBundles.has(bundleId)) {
    state.expandedBundles.delete(bundleId);
  } else {
    state.expandedBundles.add(bundleId);
  }
}

/**
 * Toggle item selection within a bundle
 * @param {string} bundleId - The bundle ID
 * @param {string} itemId - The item ID
 */
function toggleItemSelection(bundleId, itemId) {
  if (!state.selectedItems.has(bundleId)) {
    state.selectedItems.set(bundleId, new Set());
  }
  
  const selected = state.selectedItems.get(bundleId);
  if (selected.has(itemId)) {
    selected.delete(itemId);
  } else {
    selected.add(itemId);
  }
}

/**
 * Select all items in a bundle
 * @param {string} bundleId - The bundle ID
 */
function selectAllBundleItems(bundleId) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return;
  
  const selected = new Set(bundle.items.map(i => i.itemId));
  state.selectedItems.set(bundleId, selected);
}

/**
 * Deselect all items in a bundle
 * @param {string} bundleId - The bundle ID
 */
function deselectAllBundleItems(bundleId) {
  state.selectedItems.set(bundleId, new Set());
}

/**
 * Get resolved items for a bundle (with full item data)
 * @param {string} bundleId - The bundle ID
 * @returns {Array} Array of {item, quantity} objects
 */
function getResolvedBundleItems(bundleId) {
  const bundle = state.bundles.find(b => b.id === bundleId);
  if (!bundle) return [];
  
  return bundle.items
    .map(bi => ({
      item: getItem(bi.itemId),
      quantity: bi.quantity || 1,
      itemId: bi.itemId
    }))
    .filter(ri => ri.item !== null);
}

/**
 * Get count of selected items across all bundles
 * @returns {number} Total selected item count
 */
function getSelectedItemCount() {
  let count = 0;
  state.selectedItems.forEach(itemSet => {
    count += itemSet.size;
  });
  return count;
}

/**
 * Render all bundles organized by category
 * @param {Object} options - Render options
 */
function renderBundles(options = {}) {
  const { filter = '' } = options;
  const filterLower = filter.toLowerCase();
  
  // Auto-expand bundles where items match the search term
  if (filterLower) {
    state.bundles.forEach(bundle => {
      const resolvedItems = getResolvedBundleItems(bundle.id);
      const hasItemMatch = resolvedItems.some(ri => ri.item.name.toLowerCase().includes(filterLower));
      if (hasItemMatch && !state.expandedBundles.has(bundle.id)) {
        state.expandedBundles.add(bundle.id);
      }
    });
  }
  
  BUNDLE_CATEGORIES.forEach(category => {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    renderBundleCategory(container, category, filterLower);
  });
}

/**
 * Render bundles for a specific category
 * @param {HTMLElement} container - The container element
 * @param {string} category - The category name
 * @param {string} filter - Optional search filter
 */
function renderBundleCategory(container, category, filter = '') {
  const utilityCategories = ['household', 'toiletries'];
  const isUtility = utilityCategories.includes(category);
  const displayName = capitalize(category);
  const addLabel = isUtility ? `+ Add ${displayName} Item` : `+ Add ${displayName}`;
  
  let bundles = getBundlesByCategory(category);
  
  // Apply filter
  if (filter) {
    bundles = bundles.filter(b => {
      // Match bundle name
      if (b.name.toLowerCase().includes(filter)) return true;
      
      // Match item names
      const resolvedItems = getResolvedBundleItems(b.id);
      return resolvedItems.some(ri => ri.item.name.toLowerCase().includes(filter));
    });
  }
  
  const addButton = `<li class="add-meal-inline"><button class="btn-add-inline" onclick="openModal('bundle', null, '${category}')">${addLabel}</button></li>`;
  
  if (bundles.length === 0) {
    container.innerHTML = '<li class="empty-category">No items yet</li>' + addButton;
    return;
  }
  
  container.innerHTML = bundles.map(bundle => renderBundle(bundle, filter)).join('') + addButton;
}

/**
 * Render a single bundle
 * @param {Object} bundle - The bundle
 * @param {string} filter - Optional search filter for highlighting
 * @returns {string} HTML string
 */
function renderBundle(bundle, filter = '') {
  const isExpanded = state.expandedBundles.has(bundle.id);
  const resolvedItems = getResolvedBundleItems(bundle.id);
  const itemCount = resolvedItems.length;
  
  const selectedInBundle = state.selectedItems.get(bundle.id) || new Set();
  const allSelected = itemCount > 0 && resolvedItems.every(ri => selectedInBundle.has(ri.itemId));
  const someSelected = selectedInBundle.size > 0;
  
  // Build datalist of existing items for autocomplete
  const itemOptions = state.items
    .map(i => `<option value="${escapeHtml(i.name)}" data-id="${i.id}">`)
    .join('');
  
  let itemsHtml = '';
  if (isExpanded && itemCount > 0) {
    itemsHtml = `
      <ul class="ingredient-list">
        ${resolvedItems.map((ri, idx) => renderBundleItem(bundle.id, ri, idx, filter)).join('')}
      </ul>
      <datalist id="items-datalist-${bundle.id}">${itemOptions}</datalist>
      <div class="inline-add-ingredient" onclick="event.stopPropagation()">
        <input type="text" placeholder="Add item..." class="inline-ing-name" id="inline-ing-${bundle.id}"
               list="items-datalist-${bundle.id}"
               onchange="onItemSelected('${escapeJs(bundle.id)}')"
               onkeypress="if(event.key==='Enter'){event.preventDefault(); addItemToBundleInline('${escapeJs(bundle.id)}');}">
        <input type="number" placeholder="Qty" class="inline-ing-qty" id="inline-qty-${bundle.id}" value="1" min="0" step="0.5">
        <button class="btn-small btn-add-ing" onclick="addItemToBundleInline('${escapeJs(bundle.id)}')">+</button>
      </div>
      <div class="meal-actions">
        <button class="btn-small" onclick="event.stopPropagation(); selectAllBundleItems('${escapeJs(bundle.id)}')">Select All</button>
        <button class="btn-small" onclick="event.stopPropagation(); deselectAllBundleItems('${escapeJs(bundle.id)}')">Deselect All</button>
        <button class="btn-small" onclick="event.stopPropagation(); openModal('meal', '${escapeJs(bundle.id)}')">Edit</button>
        <button class="btn-small btn-delete-small" onclick="event.stopPropagation(); deleteBundle('${escapeJs(bundle.id)}')">Delete</button>
      </div>
    `;
  } else if (isExpanded) {
    // Expanded but no items yet
    itemsHtml = `
      <ul class="ingredient-list">
        <li class="no-ingredients">No items yet</li>
      </ul>
      <datalist id="items-datalist-${bundle.id}">${itemOptions}</datalist>
      <div class="inline-add-ingredient" onclick="event.stopPropagation()">
        <input type="text" placeholder="Add item..." class="inline-ing-name" id="inline-ing-${bundle.id}"
               list="items-datalist-${bundle.id}"
               onchange="onItemSelected('${escapeJs(bundle.id)}')"
               onkeypress="if(event.key==='Enter'){event.preventDefault(); addItemToBundleInline('${escapeJs(bundle.id)}');}">
        <input type="number" placeholder="Qty" class="inline-ing-qty" id="inline-qty-${bundle.id}" value="1" min="0" step="0.5">
        <button class="btn-small btn-add-ing" onclick="addItemToBundleInline('${escapeJs(bundle.id)}')">+</button>
      </div>
      <div class="meal-actions">
        <button class="btn-small" onclick="event.stopPropagation(); openModal('meal', '${escapeJs(bundle.id)}')">Edit</button>
        <button class="btn-small btn-delete-small" onclick="event.stopPropagation(); deleteBundle('${escapeJs(bundle.id)}')">Delete</button>
      </div>
    `;
  }
  
  return `
    <li class="${someSelected ? 'has-selected' : ''} ${isExpanded ? 'expanded' : ''}" data-bundle-id="${bundle.id}">
      <div class="meal-row" onclick="toggleBundleExpand('${escapeJs(bundle.id)}')">
        <label class="meal-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" 
                 ${allSelected ? 'checked' : ''} 
                 ${someSelected && !allSelected ? 'class="partial"' : ''}
                 onchange="toggleAllBundleItems('${escapeJs(bundle.id)}', this.checked)">
        </label>
        <span class="meal-name">${escapeHtml(bundle.name)}</span>
        <input type="url" class="meal-url-edit" value="${bundle.url || ''}" placeholder="🔗 Recipe URL"
               onchange="updateBundleUrl('${escapeJs(bundle.id)}', this.value)"
               onclick="event.stopPropagation()">
        ${bundle.url ? `<a href="${escapeHtml(bundle.url)}" target="_blank" class="meal-link" onclick="event.stopPropagation()" title="Open recipe">🔗</a>` : ''}
        <span class="item-count">${selectedInBundle.size > 0 ? `${selectedInBundle.size}/` : ''}${itemCount} items</span>
        <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
      </div>
      ${itemsHtml}
    </li>
  `;
}

/**
 * Render a single item within a bundle
 * @param {string} bundleId - The bundle ID
 * @param {Object} resolvedItem - The resolved item {item, quantity, itemId}
 * @param {number} idx - The index
 * @param {string} filter - Optional search filter for highlighting
 * @returns {string} HTML string
 */
function renderBundleItem(bundleId, resolvedItem, idx, filter = '') {
  const { item, quantity, itemId } = resolvedItem;
  const selectedInBundle = state.selectedItems.get(bundleId) || new Set();
  const isSelected = selectedInBundle.has(itemId);
  
  // Build sources HTML
  const sources = item.sources || [{ store: getDefaultStore(), url: '' }];
  const sourcesHtml = sources.map((src, srcIdx) => {
    const storeOptions = (state.stores || []).map(s => 
      `<option value="${escapeHtml(s.name)}" ${src.store === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');
    return `
      <div class="ing-source-row">
        <select class="ing-store-edit" onchange="updateItemSource('${escapeJs(bundleId)}', ${idx}, ${srcIdx}, 'store', this.value)"
                onclick="event.stopPropagation()">
          ${storeOptions}
        </select>
        <input type="url" class="ing-url-edit" value="${src.url || ''}" placeholder="🔗 Product URL"
               onchange="updateItemSource('${escapeJs(bundleId)}', ${idx}, ${srcIdx}, 'url', this.value)"
               onclick="event.stopPropagation()">
        ${src.url ? `<a href="${escapeHtml(src.url)}" target="_blank" class="ing-link" onclick="event.stopPropagation()" title="Open link">🔗</a>` : ''}
        ${sources.length > 1 ? `<button class="ing-source-remove" onclick="event.stopPropagation(); removeItemSource('${escapeJs(bundleId)}', ${idx}, ${srcIdx})">&times;</button>` : ''}
      </div>
    `;
  }).join('');
  
  // Highlight if matches filter
  const isHighlighted = filter && item.name.toLowerCase().includes(filter.toLowerCase());
  let nameHtml = escapeHtml(item.name);
  
  return `
    <li class="${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlight-match' : ''}" data-bundle="${bundleId}" data-item-id="${itemId}">
      <div class="ing-main-row">
        <label class="ing-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" 
                 ${isSelected ? 'checked' : ''} 
                 onchange="toggleItemSelection('${escapeJs(bundleId)}', '${escapeJs(itemId)}')">
        </label>
        <span class="ing-name-display">${nameHtml}</span>
        <input type="number" class="ing-qty-edit" value="${quantity}" min="0" step="0.5"
               onchange="updateBundleItemQuantity('${escapeJs(bundleId)}', '${escapeJs(itemId)}', this.value)"
               onclick="event.stopPropagation()">
        <input type="text" class="ing-unit-edit" value="${escapeHtml(item.unit || '')}" placeholder="unit"
               onchange="updateItemUnit('${escapeJs(itemId)}', this.value)"
               onclick="event.stopPropagation()">
        <button class="ing-remove" onclick="event.stopPropagation(); removeItemFromBundle('${escapeJs(bundleId)}', '${escapeJs(itemId)}')">&times;</button>
      </div>
      <div class="ing-sources-section" onclick="event.stopPropagation()">
        ${sourcesHtml}
      </div>
    </li>
  `;
}

export {
  addBundle,
  updateBundle,
  deleteBundle,
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
  renderBundleCategory,
  renderBundle,
  renderBundleItem
};
