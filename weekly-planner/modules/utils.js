// ==========================================
// Utilities Module - Helper functions
// ==========================================

/**
 * Generate a unique ID
 * @returns {string} A unique identifier
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Convert a string to a URL-friendly slug
 * @param {string} name - The string to slugify
 * @returns {string} A slugified string
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse a quantity string into a number
 * @param {string|number} qty - The quantity to parse
 * @returns {number} The parsed quantity
 */
function parseQuantity(qty) {
  if (typeof qty === 'number') return qty;
  if (!qty) return 1;
  
  const str = String(qty).trim();
  
  // Handle fractions like "1/2"
  if (str.includes('/')) {
    const [num, denom] = str.split('/').map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return num / denom;
    }
  }
  
  // Handle mixed fractions like "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const denom = Number(mixedMatch[3]);
    if (denom !== 0) {
      return whole + (num / denom);
    }
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * Combine quantities into a display string
 * @param {Array} quantities - Array of {num, unit, from} objects
 * @param {boolean} includeUnit - Whether to include the unit in output
 * @returns {string} Combined quantity string
 */
function combineQuantities(quantities, includeUnit = false) {
  if (!quantities || quantities.length === 0) return '1';
  
  // Group by unit
  const byUnit = {};
  quantities.forEach(q => {
    const unit = q.unit || '';
    const num = parseQuantity(q.num);
    byUnit[unit] = (byUnit[unit] || 0) + num;
  });
  
  // Format output
  const parts = Object.entries(byUnit).map(([unit, total]) => {
    const numStr = Number.isInteger(total) ? total.toString() : total.toFixed(1);
    if (includeUnit && unit) {
      return `${numStr} ${unit}`;
    }
    return numStr;
  });
  
  return parts.join(' + ') || '1';
}

/**
 * Debounce a function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Escape HTML special characters
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for use in JavaScript
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeJs(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export {
  generateId,
  slugify,
  capitalize,
  parseQuantity,
  combineQuantities,
  debounce,
  escapeHtml,
  escapeJs
};
