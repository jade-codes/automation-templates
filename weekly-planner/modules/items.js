// ==========================================
// Items Module - Product management
// ==========================================

import { state, saveItems, rebuildItemsIndex, getDefaultStore } from './store.js';
import { slugify, escapeHtml, escapeJs } from './utils.js';

/**
 * Add a new item to the master list
 * @param {Object} itemData - The item data
 * @returns {Object} The created item
 */
function addItem(itemData) {
  // Generate ID if not provided
  const id = itemData.id || slugify(itemData.name);
  
  // Check for existing item with same ID
  let finalId = id;
  let counter = 1;
  while (state.itemsById[finalId]) {
    finalId = `${id}-${counter}`;
    counter++;
  }
  
  const item = {
    id: finalId,
    name: itemData.name,
    category: itemData.category || 'Other|Other',
    unit: itemData.unit || 'item',
    sources: itemData.sources || []
  };
  
  state.items.push(item);
  state.itemsById[finalId] = item;
  
  return item;
}

/**
 * Update an existing item
 * @param {string} itemId - The item ID
 * @param {Object} updates - The fields to update
 * @returns {Object|null} The updated item or null
 */
function updateItem(itemId, updates) {
  const item = state.itemsById[itemId];
  if (!item) return null;
  
  Object.assign(item, updates);
  return item;
}

/**
 * Delete an item
 * @param {string} itemId - The item ID
 * @returns {boolean} Success status
 */
function deleteItem(itemId) {
  const index = state.items.findIndex(i => i.id === itemId);
  if (index === -1) return false;
  
  state.items.splice(index, 1);
  delete state.itemsById[itemId];
  
  return true;
}

/**
 * Add a source (store + URL) to an item
 * @param {string} itemId - The item ID
 * @param {string} store - The store name
 * @param {string} url - The product URL
 * @param {string} note - Optional note (e.g., "Smoked", "Large")
 * @returns {boolean} Success status
 */
function addItemSource(itemId, store, url, note = '') {
  const item = state.itemsById[itemId];
  if (!item) return false;
  
  if (!item.sources) item.sources = [];
  
  // Check if this exact URL already exists
  const exists = item.sources.some(s => s.url === url);
  if (exists) return false;
  
  const source = { store, url };
  if (note) source.note = note;
  
  item.sources.push(source);
  return true;
}

/**
 * Remove a source from an item
 * @param {string} itemId - The item ID
 * @param {number} sourceIndex - The source index to remove
 * @returns {boolean} Success status
 */
function removeItemSource(itemId, sourceIndex) {
  const item = state.itemsById[itemId];
  if (!item || !item.sources) return false;
  
  if (sourceIndex >= 0 && sourceIndex < item.sources.length) {
    item.sources.splice(sourceIndex, 1);
    return true;
  }
  return false;
}

/**
 * Find or create an item by name
 * @param {string} name - The item name
 * @param {Object} defaults - Default values if creating
 * @returns {Object} The existing or new item
 */
function findOrCreateItem(name, defaults = {}) {
  const lower = name.toLowerCase();
  let item = state.items.find(i => i.name.toLowerCase() === lower);
  
  if (!item) {
    item = addItem({
      name,
      category: defaults.category || 'Other|Other',
      unit: defaults.unit || 'item',
      sources: defaults.sources || []
    });
  }
  
  return item;
}

/**
 * Get category options HTML for a select
 * @param {string} selected - Currently selected category
 * @returns {string} HTML options string
 */
function getCategoryOptionsHtml(selected = '') {
  const categories = {
    'Fridge': ['Meats', 'Dairy', 'Sauces', 'Other'],
    'Cupboard': ['Carbs', 'Cereal', 'Tinned', 'Condiments', 'Other'],
    'Freezer': ['Ice cream', 'Vegetables', 'Meat', 'Other'],
    'Fresh': ['Fruit', 'Vegetables', 'Other'],
    'Bakery': ['Bread', 'Other'],
    'Other': ['Toiletries', 'Household', 'Other']
  };
  
  let html = '';
  
  for (const [category, subs] of Object.entries(categories)) {
    for (const sub of subs) {
      const value = `${category}|${sub}`;
      const isSelected = selected === value ? 'selected' : '';
      html += `<option value="${value}" ${isSelected}>${category} > ${sub}</option>`;
    }
  }
  
  return html;
}

/**
 * Render the items management list (for a dedicated items tab)
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Render options
 */
function renderItemsList(container, options = {}) {
  const { filter = '', showSources = true } = options;
  const filterLower = filter.toLowerCase();
  
  const filteredItems = filter
    ? state.items.filter(i => i.name.toLowerCase().includes(filterLower))
    : state.items;
  
  if (filteredItems.length === 0) {
    container.innerHTML = '<p class="empty">No items found</p>';
    return;
  }
  
  // Group by category
  const byCategory = {};
  filteredItems.forEach(item => {
    const cat = item.category?.split('|')[0] || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });
  
  let html = '';
  for (const [category, items] of Object.entries(byCategory).sort()) {
    html += `
      <div class="items-category">
        <h4 class="items-category-header">${escapeHtml(category)} (${items.length})</h4>
        <ul class="items-list">
          ${items.map(item => renderItemRow(item, showSources)).join('')}
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Render a single item row
 * @param {Object} item - The item
 * @param {boolean} showSources - Whether to show source URLs
 * @returns {string} HTML string
 */
function renderItemRow(item, showSources = true) {
  const sourcesHtml = showSources && item.sources?.length
    ? item.sources.map(s => `
        <span class="item-source">
          ${escapeHtml(s.store)}
          ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" title="${escapeHtml(s.note || '')}">🔗</a>` : ''}
        </span>
      `).join('')
    : '';
  
  return `
    <li class="item-row" data-item-id="${item.id}">
      <span class="item-name">${escapeHtml(item.name)}</span>
      <span class="item-unit">${escapeHtml(item.unit)}</span>
      <span class="item-category">${escapeHtml(item.category)}</span>
      ${sourcesHtml ? `<span class="item-sources">${sourcesHtml}</span>` : ''}
      <button class="btn-edit-item" onclick="editItem('${escapeJs(item.id)}')">Edit</button>
    </li>
  `;
}

/**
 * Render the items tab with table view
 */
function renderItemsTab() {
  const container = document.getElementById('items-list');
  const statsContainer = document.getElementById('items-stats');
  const searchInput = document.getElementById('item-search');
  const showMissingOnly = document.getElementById('show-missing-only');
  
  if (!container) return;
  
  let items = [...state.items];
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const missingOnly = showMissingOnly ? showMissingOnly.checked : false;
  
  // Filter
  if (searchValue) {
    items = items.filter(i => i.name.toLowerCase().includes(searchValue));
  }
  if (missingOnly) {
    items = items.filter(i => !i.sources || i.sources.length === 0 || !i.sources[0].url);
  }
  
  // Sort alphabetically
  items.sort((a, b) => a.name.localeCompare(b.name));
  
  // Stats
  const totalItems = state.items.length;
  const withUrls = state.items.filter(i => i.sources && i.sources.length > 0 && i.sources[0].url).length;
  const missingUrls = totalItems - withUrls;
  
  if (statsContainer) {
    statsContainer.innerHTML = `
      <span class="stat">${totalItems} total items</span>
      <span class="stat good">${withUrls} with URLs</span>
      <span class="stat ${missingUrls > 0 ? 'warning' : ''}">${missingUrls} missing URLs</span>
    `;
  }
  
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">No items found</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="items-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Unit</th>
          <th>Store</th>
          <th>URL</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const source = item.sources && item.sources[0] ? item.sources[0] : { store: '', url: '' };
          return `
            <tr data-item-id="${item.id}">
              <td>
                <input type="text" class="inline-edit" value="${escapeHtml(item.name)}" 
                       onchange="updateItemField('${escapeJs(item.id)}', 'name', this.value)">
              </td>
              <td>
                <input type="text" class="inline-edit inline-edit-sm" value="${escapeHtml(item.category || '')}" 
                       onchange="updateItemField('${escapeJs(item.id)}', 'category', this.value)" 
                       placeholder="Fridge|Dairy">
              </td>
              <td>
                <input type="text" class="inline-edit inline-edit-xs" value="${escapeHtml(item.unit || '')}" 
                       onchange="updateItemField('${escapeJs(item.id)}', 'unit', this.value)" 
                       placeholder="pack">
              </td>
              <td>
                <input type="text" class="inline-edit inline-edit-xs" value="${escapeHtml(source.store || '')}" 
                       onchange="updateItemSourceField('${escapeJs(item.id)}', 'store', this.value)" 
                       placeholder="Tesco">
              </td>
              <td>
                <input type="url" class="inline-edit" value="${escapeHtml(source.url || '')}" 
                       onchange="updateItemSourceField('${escapeJs(item.id)}', 'url', this.value)" 
                       placeholder="Product URL">
              </td>
              <td>
                <button class="btn-small btn-delete" onclick="deleteItemFromTab('${escapeJs(item.id)}')">×</button>
              </td>
            </tr>
          `;
        }).join('')}
        <tr class="inline-add-row">
          <td>
            <input type="text" class="inline-edit" id="new-item-name" placeholder="New item name...">
          </td>
          <td>
            <input type="text" class="inline-edit inline-edit-sm" id="new-item-category" placeholder="Fridge|Dairy">
          </td>
          <td>
            <input type="text" class="inline-edit inline-edit-xs" id="new-item-unit" placeholder="pack">
          </td>
          <td>
            <input type="text" class="inline-edit inline-edit-xs" id="new-item-store" placeholder="Tesco">
          </td>
          <td>
            <input type="url" class="inline-edit" id="new-item-url" placeholder="Product URL">
          </td>
          <td>
            <button class="btn-small btn-add-inline" onclick="addItemInline()">+</button>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

export {
  addItem,
  updateItem,
  deleteItem,
  addItemSource,
  removeItemSource,
  findOrCreateItem,
  getCategoryOptionsHtml,
  renderItemsList,
  renderItemRow,
  renderItemsTab
};
