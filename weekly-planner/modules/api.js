// ==========================================
// API Module - Data loading and saving
// ==========================================

const API_ENDPOINTS = {
  items: '/api/items',
  bundles: '/api/bundles',
  activities: '/api/activities',
  chores: '/api/chores',
  stores: '/api/stores',
  shopping: '/api/shopping',
  weeklyPlan: '/api/weeklyPlan'
};

/**
 * Load data from an API endpoint
 * @param {string} endpoint - The API endpoint to load from
 * @returns {Promise<Array|Object>} The loaded data
 */
async function loadData(endpoint) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Failed to load ${endpoint}`);
    return await response.json();
  } catch (e) {
    console.error('Error loading:', e);
    return [];
  }
}

/**
 * Save data to an API endpoint
 * @param {string} endpoint - The API endpoint to save to
 * @param {Array|Object} data - The data to save
 * @returns {Promise<boolean>} Success status
 */
async function saveData(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2)
    });
    if (!response.ok) throw new Error('Failed to save');
    await response.text(); // Consume response to prevent connection hanging
    console.log(`Saved to ${endpoint}`);
    return true;
  } catch (e) {
    console.error('Error saving:', e);
    alert('Failed to save. Make sure you are running server.py');
    return false;
  }
}

/**
 * Save data without blocking (fire and forget)
 * @param {string} endpoint - The API endpoint to save to
 * @param {Array|Object} data - The data to save
 */
function saveDataAsync(endpoint, data) {
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data, null, 2)
  })
    .then(r => r.text())
    .then(() => console.log(`Saved to ${endpoint}`))
    .catch(e => console.error('Error saving:', e));
}

export { API_ENDPOINTS, loadData, saveData, saveDataAsync };
