// ==========================================
// Store Module - Global state management
// ==========================================

import { API_ENDPOINTS, loadData, saveData } from './api.js';

// Shopping categories with subcategories
const SHOPPING_CATEGORIES = {
  'Fridge': ['Meats', 'Dairy', 'Sauces', 'Other'],
  'Cupboard': ['Carbs', 'Cereal', 'Tinned', 'Condiments', 'Other'],
  'Freezer': ['Ice cream', 'Vegetables', 'Meat', 'Other'],
  'Fresh': ['Fruit', 'Vegetables', 'Other'],
  'Bakery': ['Bread', 'Other'],
  'Other': ['Toiletries', 'Household', 'Other']
};

// Bundle categories
const BUNDLE_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack', 'household', 'toiletries'];

// Global state
const state = {
  items: [],           // Master product list
  itemsById: {},       // Quick lookup: id -> item
  bundles: [],         // Bundles (meals, household sets)
  activities: [],
  chores: [],
  stores: [],
  shopping: [],
  
  // UI state
  selectedBundles: new Set(),
  selectedItems: new Map(),  // bundleId -> Set of itemIds
  expandedBundles: new Set(),
  
  // Weekly planner
  weeklyPlan: {
    breakfast: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    lunch: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    dinner: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    activities: {},
    chores: {}
  }
};

// ==========================================
// Item lookup functions
// ==========================================

/**
 * Get an item by ID
 * @param {string} itemId - The item ID
 * @returns {Object|null} The item or null if not found
 */
function getItem(itemId) {
  return state.itemsById[itemId] || null;
}

/**
 * Get an item by name (case-insensitive)
 * @param {string} name - The item name
 * @returns {Object|null} The item or null if not found
 */
function getItemByName(name) {
  const lower = name.toLowerCase();
  return state.items.find(i => i.name.toLowerCase() === lower) || null;
}

/**
 * Get the preferred URL for an item (first Tesco, then first available)
 * @param {Object} item - The item
 * @param {string} preferredStore - Optional preferred store
 * @returns {string} The URL or empty string
 */
function getItemUrl(item, preferredStore = 'Tesco') {
  if (!item || !item.sources || item.sources.length === 0) return '';
  
  // Try preferred store first
  const preferred = item.sources.find(s => s.store === preferredStore);
  if (preferred && preferred.url) return preferred.url;
  
  // Fall back to first available URL
  const first = item.sources.find(s => s.url);
  return first ? first.url : '';
}

/**
 * Get all URLs for an item grouped by store
 * @param {Object} item - The item
 * @returns {Array} Array of {store, url} objects
 */
function getItemSources(item) {
  if (!item || !item.sources) return [];
  return item.sources.filter(s => s.url);
}

/**
 * Rebuild the itemsById lookup map
 */
function rebuildItemsIndex() {
  state.itemsById = {};
  state.items.forEach(item => {
    state.itemsById[item.id] = item;
  });
}

// ==========================================
// Data loading
// ==========================================

/**
 * Load all data from the server
 */
async function loadAllData() {
  const [items, bundles, activities, chores, stores, shopping, weeklyPlan] = await Promise.all([
    loadData(API_ENDPOINTS.items),
    loadData(API_ENDPOINTS.bundles),
    loadData(API_ENDPOINTS.activities),
    loadData(API_ENDPOINTS.chores),
    loadData(API_ENDPOINTS.stores),
    loadData(API_ENDPOINTS.shopping),
    loadData(API_ENDPOINTS.weeklyPlan)
  ]);
  
  state.items = items || [];
  state.bundles = bundles || [];
  state.activities = activities || [];
  state.chores = chores || [];
  state.stores = stores || [];
  state.shopping = shopping || [];
  
  // Load weekly plan from API, with default structure fallback
  if (weeklyPlan && Object.keys(weeklyPlan).length > 0) {
    state.weeklyPlan = weeklyPlan;
  }
  
  rebuildItemsIndex();
  
  console.log(`Loaded: ${state.items.length} items, ${state.bundles.length} bundles`);
}

// ==========================================
// Weekly plan persistence
// ==========================================

async function saveWeeklyPlan() {
  return saveData(API_ENDPOINTS.weeklyPlan, state.weeklyPlan);
}

// ==========================================
// Save functions
// ==========================================

async function saveItems() {
  return saveData(API_ENDPOINTS.items, state.items);
}

async function saveBundles() {
  return saveData(API_ENDPOINTS.bundles, state.bundles);
}

async function saveActivities() {
  return saveData(API_ENDPOINTS.activities, state.activities);
}

async function saveChores() {
  return saveData(API_ENDPOINTS.chores, state.chores);
}

async function saveShopping() {
  return saveData(API_ENDPOINTS.shopping, state.shopping);
}

// ==========================================
// Default store helper
// ==========================================

function getDefaultStore() {
  const defaultStore = state.stores.find(s => s.default);
  return defaultStore ? defaultStore.name : (state.stores[0]?.name || 'Tesco');
}

export {
  SHOPPING_CATEGORIES,
  BUNDLE_CATEGORIES,
  state,
  getItem,
  getItemByName,
  getItemUrl,
  getItemSources,
  rebuildItemsIndex,
  loadAllData,
  saveWeeklyPlan,
  saveItems,
  saveBundles,
  saveActivities,
  saveChores,
  saveShopping,
  getDefaultStore
};
