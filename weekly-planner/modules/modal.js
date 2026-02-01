// ==========================================
// Modal Module - Bundle/Item editing modal
// ==========================================

import { state, saveItems, saveBundles, getItem, getItemByName, getDefaultStore, rebuildItemsIndex } from './store.js';
import { escapeHtml, escapeJs, generateId, slugify, capitalize } from './utils.js';
import { findOrCreateItem } from './items.js';
import { renderBundles } from './bundles.js';

/**
 * Open the modal for adding/editing bundles, activities, or chores
 */
function openModal(type, id = null, defaultCategory = null) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('item-form');
  
  if (!modal || !form) return;
  
  form.reset();
  document.getElementById('item-id').value = id || '';
  document.getElementById('item-type').value = type;
  
  // Show relevant fields
  document.querySelectorAll('.type-fields').forEach(f => f.style.display = 'none');
  const fieldsEl = document.getElementById(`${type}-fields`);
  if (fieldsEl) fieldsEl.style.display = 'block';
  
  // Use "Item" for bundles/utilities instead of "Meal"
  const displayType = type === 'meal' ? 'Item' : capitalize(type);
  title.textContent = id ? `Edit ${displayType}` : `Add ${displayType}`;
  
  if (id) {
    const item = type === 'meal' ? state.bundles.find(b => b.id === id) :
                 type === 'activity' ? state.activities.find(a => a.id === id) :
                 state.chores.find(c => c.id === id);
    
    if (item) {
      document.getElementById('item-name').value = item.name;
      
      if (type === 'meal') {
        document.getElementById('meal-category').value = item.category;
        populateItemEditor(item.items || []);
      } else if (type === 'activity') {
        document.getElementById('activity-category').value = item.category;
        const durationEl = document.getElementById('activity-duration');
        const costEl = document.getElementById('activity-cost');
        if (durationEl) durationEl.value = item.duration || 2;
        if (costEl) costEl.value = item.cost || 0;
      } else if (type === 'chore') {
        document.getElementById('chore-frequency').value = item.frequency;
        const effortEl = document.getElementById('chore-effort');
        const assigneeEl = document.getElementById('chore-assignee');
        if (effortEl) effortEl.value = item.effort || 'medium';
        if (assigneeEl) assigneeEl.value = item.assignee || '';
      }
    }
  } else {
    // New item - set default category if provided
    if (type === 'meal') {
      if (defaultCategory) {
        document.getElementById('meal-category').value = defaultCategory;
      }
      populateItemEditor([]);
    }
  }
  
  modal.classList.add('active');
}

/**
 * Close the modal
 */
function closeModal() {
  document.getElementById('modal')?.classList.remove('active');
}

/**
 * Populate the ingredient/item editor in the modal
 */
function populateItemEditor(bundleItems) {
  const container = document.getElementById('item-rows');
  if (!container) return;
  
  container.innerHTML = `
    <div class="ingredient-row-header">
      <span>Item</span>
      <span>Qty</span>
      <span>Unit</span>
      <span>Store</span>
      <span></span>
    </div>
  `;
  
  if (bundleItems && bundleItems.length > 0) {
    bundleItems.forEach(bi => {
      // Resolve the item from the master list
      const item = getItem(bi.itemId);
      if (item) {
        addItemRow({
          name: item.name,
          quantity: bi.quantity || 1,
          unit: item.unit || '',
          sources: item.sources || []
        });
      }
    });
  } else {
    addItemRow();
  }
}

/**
 * Add an item row to the modal editor
 */
function addItemRow(ingredient = null) {
  const container = document.getElementById('item-rows');
  if (!container) return;
  
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  
  const defaultStore = getDefaultStore();
  const currentStore = ingredient?.sources?.[0]?.store || defaultStore;
  
  const storeOptions = (state.stores || []).map(s => 
    `<option value="${escapeHtml(s.name)}" ${currentStore === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
  
  // Build URLs HTML from sources
  const sources = ingredient?.sources || [];
  let urlsHtml = '';
  if (sources.length > 0 && sources.some(s => s.url)) {
    urlsHtml = sources.filter(s => s.url).map((src, idx) => `
      <div class="modal-url-row">
        <input type="url" placeholder="URL ${idx + 1}" class="ing-url" value="${escapeHtml(src.url)}">
        <button type="button" class="remove-url-btn" onclick="this.parentElement.remove()">&times;</button>
      </div>
    `).join('');
  }
  if (!urlsHtml) {
    urlsHtml = `
      <div class="modal-url-row">
        <input type="url" placeholder="Product URL" class="ing-url" value="">
        <button type="button" class="remove-url-btn" onclick="this.parentElement.remove()">&times;</button>
      </div>
    `;
  }
  
  // Build datalist for autocomplete
  const datalistId = `items-datalist-${Date.now()}`;
  const datalistOptions = state.items.map(i => 
    `<option value="${escapeHtml(i.name)}">`
  ).join('');
  
  row.innerHTML = `
    <div class="ing-row-main">
      <div class="ing-name-wrapper">
        <input type="text" placeholder="Item name" class="ing-name" value="${escapeHtml(ingredient?.name || '')}" 
               list="${datalistId}" oninput="onModalItemInput(this)" autocomplete="off">
        <datalist id="${datalistId}">${datalistOptions}</datalist>
      </div>
      <input type="number" placeholder="Qty" class="ing-quantity" value="${ingredient?.quantity || 1}" min="0" step="0.5">
      <input type="text" placeholder="unit" class="ing-unit" value="${escapeHtml(ingredient?.unit || '')}">
      <select class="ing-store">
        ${storeOptions}
      </select>
      <button type="button" class="remove-ingredient" onclick="this.closest('.ingredient-row').remove()">&times;</button>
    </div>
    <div class="ing-urls-container">
      ${urlsHtml}
      <button type="button" class="btn-add-modal-url" onclick="addModalUrlRow(this)">+ Add URL</button>
    </div>
  `;
  
  container.appendChild(row);
}

/**
 * Handle input in modal item name field - autofill from existing items
 */
function onModalItemInput(input) {
  const name = input.value.trim();
  if (!name) return;
  
  const existingItem = getItemByName(name);
  if (existingItem) {
    const row = input.closest('.ingredient-row');
    if (!row) return;
    
    // Fill in unit
    const unitInput = row.querySelector('.ing-unit');
    if (unitInput && existingItem.unit) {
      unitInput.value = existingItem.unit;
    }
    
    // Fill in store
    if (existingItem.sources?.[0]?.store) {
      const storeSelect = row.querySelector('.ing-store');
      if (storeSelect) storeSelect.value = existingItem.sources[0].store;
    }
    
    // Fill in URLs
    if (existingItem.sources?.length > 0) {
      const urlsContainer = row.querySelector('.ing-urls-container');
      const addBtn = urlsContainer?.querySelector('.btn-add-modal-url');
      if (urlsContainer && addBtn) {
        // Clear existing URL rows
        urlsContainer.querySelectorAll('.modal-url-row').forEach(r => r.remove());
        
        // Add URLs from the existing item
        existingItem.sources.forEach((src, idx) => {
          if (src.url) {
            const urlRow = document.createElement('div');
            urlRow.className = 'modal-url-row';
            urlRow.innerHTML = `
              <input type="url" placeholder="URL ${idx + 1}" class="ing-url" value="${escapeHtml(src.url)}">
              <button type="button" class="remove-url-btn" onclick="this.parentElement.remove()">&times;</button>
            `;
            urlsContainer.insertBefore(urlRow, addBtn);
          }
        });
        
        // If no URLs were added, add an empty one
        if (urlsContainer.querySelectorAll('.modal-url-row').length === 0) {
          const urlRow = document.createElement('div');
          urlRow.className = 'modal-url-row';
          urlRow.innerHTML = `
            <input type="url" placeholder="Product URL" class="ing-url" value="">
            <button type="button" class="remove-url-btn" onclick="this.parentElement.remove()">&times;</button>
          `;
          urlsContainer.insertBefore(urlRow, addBtn);
        }
      }
    }
  }
}

/**
 * Add a URL row in the modal
 */
function addModalUrlRow(btn) {
  const container = btn.parentElement;
  const urlRow = document.createElement('div');
  urlRow.className = 'modal-url-row';
  urlRow.innerHTML = `
    <input type="url" placeholder="Product URL" class="ing-url" value="">
    <button type="button" class="remove-url-btn" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.insertBefore(urlRow, btn);
}

/**
 * Get items from the modal editor
 */
function getItemsFromEditor() {
  const rows = document.querySelectorAll('.ingredient-row');
  const items = [];
  
  rows.forEach(row => {
    const name = row.querySelector('.ing-name')?.value?.trim();
    if (name) {
      const store = row.querySelector('.ing-store')?.value || getDefaultStore();
      const item = {
        name: name,
        quantity: parseFloat(row.querySelector('.ing-quantity')?.value) || 1,
        unit: row.querySelector('.ing-unit')?.value?.trim() || '',
        sources: []
      };
      
      // Collect all URLs and create sources
      const urlInputs = row.querySelectorAll('.ing-url');
      urlInputs.forEach(input => {
        const url = input.value?.trim();
        if (url) {
          item.sources.push({ store: store, url: url });
        }
      });
      
      // If no URLs, still add an empty source with the store
      if (item.sources.length === 0) {
        item.sources.push({ store: store, url: '' });
      }
      
      items.push(item);
    }
  });
  
  return items;
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('item-id').value;
  const type = document.getElementById('item-type').value;
  const name = document.getElementById('item-name').value.trim();
  
  if (!name) return;
  
  if (type === 'meal') {
    const category = document.getElementById('meal-category').value;
    const editorItems = getItemsFromEditor();
    
    // Convert editor items to bundle items format
    // First, ensure all items exist in the master items list
    const bundleItems = [];
    for (const editorItem of editorItems) {
      // Find or create the item in master list
      let item = getItemByName(editorItem.name);
      if (!item) {
        // Create new item
        const newId = slugify(editorItem.name);
        item = {
          id: newId,
          name: editorItem.name,
          category: 'Other|Other',
          unit: editorItem.unit,
          sources: editorItem.sources
        };
        state.items.push(item);
        state.itemsById[newId] = item;
      } else {
        // Update existing item's sources if provided
        if (editorItem.sources?.length > 0 && editorItem.sources[0].url) {
          item.sources = editorItem.sources;
        }
        if (editorItem.unit) {
          item.unit = editorItem.unit;
        }
      }
      
      bundleItems.push({
        itemId: item.id,
        quantity: editorItem.quantity
      });
    }
    
    await saveItems();
    rebuildItemsIndex();
    
    if (id) {
      // Update existing bundle
      const bundle = state.bundles.find(b => b.id === id);
      if (bundle) {
        bundle.name = name;
        bundle.category = category;
        bundle.items = bundleItems;
      }
    } else {
      // Create new bundle
      const newBundle = {
        id: generateId(),
        name: name,
        category: category,
        items: bundleItems
      };
      state.bundles.push(newBundle);
    }
    
    await saveBundles();
    renderBundles();
  }
  
  closeModal();
}

/**
 * Initialize modal event listeners
 */
function initModal() {
  const form = document.getElementById('item-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

export {
  openModal,
  closeModal,
  addItemRow,
  addModalUrlRow,
  onModalItemInput,
  getItemsFromEditor,
  initModal
};
