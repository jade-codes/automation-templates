// Tesco Shopping List Extension - Content Script
// Runs on Tesco product pages to add items to basket

// Listen for messages from popup (e.g., to get product info)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PRODUCT_INFO') {
    const info = extractProductInfoFromPage();
    sendResponse(info);
  }
  return true; // Keep channel open for async response
});

function extractProductInfoFromPage() {
  // Try various selectors Tesco uses for product title
  const titleSelectors = [
    'h1[data-auto="product-title"]',
    'h1[class*="product-title"]',
    '.product-details-tile__title',
    'h1'
  ];
  
  let name = '';
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      name = el.textContent.trim();
      break;
    }
  }
  
  return { name };
}

(async function() {
  // Check if we have an item to add
  const data = await chrome.storage.local.get(['currentItem', 'itemIndex']);
  
  if (!data.currentItem) return;
  
  const item = data.currentItem;
  const index = data.itemIndex;
  
  console.log('[Tesco Extension] Processing:', item.name);
  
  // Clear the current item so we don't re-process on refresh
  await chrome.storage.local.remove(['currentItem']);
  
  // Wait for page to load
  await sleep(2000);
  
  try {
    // Check for "Currently unavailable"
    const unavailable = document.body.innerText.toLowerCase();
    if (unavailable.includes('currently unavailable') || unavailable.includes('sorry, this product')) {
      throw new Error('Product unavailable');
    }
    
    // Find and click Add button
    const addButton = findAddButton();
    if (!addButton) {
      throw new Error('Add button not found');
    }
    
    addButton.click();
    console.log('[Tesco Extension] Clicked add button');
    
    await sleep(1500);
    
    // Handle quantity if more than 1
    if (item.quantity > 1) {
      for (let i = 1; i < item.quantity; i++) {
        const plusBtn = document.querySelector('[data-auto="quantity-plus"], button[aria-label*="Increase"], button[aria-label*="increase"]');
        if (plusBtn) {
          plusBtn.click();
          await sleep(500);
        }
      }
      console.log('[Tesco Extension] Set quantity to', item.quantity);
    }
    
    // Success!
    chrome.runtime.sendMessage({
      type: 'ITEM_RESULT',
      index: index,
      success: true
    });
    
  } catch (error) {
    console.error('[Tesco Extension] Error:', error.message);
    chrome.runtime.sendMessage({
      type: 'ITEM_RESULT',
      index: index,
      success: false,
      error: error.message
    });
  }
})();

function findAddButton() {
  // Try various selectors Tesco uses
  const selectors = [
    'button[data-auto="add-button"]',
    '[data-auto="trolley-button"] button',
    'button[class*="add-control"]',
    'button[class*="AddButton"]',
  ];
  
  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn && isVisible(btn)) return btn;
  }
  
  // Fallback: find button with "Add" text
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent.toLowerCase();
    if ((text.includes('add') && !text.includes('address')) && isVisible(btn)) {
      return btn;
    }
  }
  
  return null;
}

function isVisible(el) {
  return el.offsetParent !== null && 
         getComputedStyle(el).display !== 'none' &&
         getComputedStyle(el).visibility !== 'hidden';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
