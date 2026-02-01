// Tesco Shopping List Extension - Popup Script

let items = [];
let currentIndex = 0;
let isRunning = false;

document.getElementById('fetch-btn').addEventListener('click', fetchFromServer);
document.getElementById('load-btn').addEventListener('click', loadItems);
document.getElementById('start-btn').addEventListener('click', startAdding);
document.getElementById('stop-btn').addEventListener('click', stopAdding);
document.getElementById('check-all-btn').addEventListener('click', checkAllSuccessful);
document.getElementById('clear-btn').addEventListener('click', clearList);
document.getElementById('get-product-btn').addEventListener('click', getProductInfo);
document.getElementById('add-product-btn').addEventListener('click', addProductToList);

// Try to load saved items on popup open
chrome.storage.local.get(['tescoItems', 'currentIndex'], (data) => {
  if (data.tescoItems && data.tescoItems.length > 0) {
    items = data.tescoItems;
    currentIndex = data.currentIndex || 0;
    renderItems();
    updateStatus(`Loaded ${items.length} items from storage`, 'success');
  }
});

async function fetchFromServer() {
  updateStatus('Fetching from localhost:8080...', 'working');
  
  try {
    const response = await fetch('http://localhost:8080/api/shopping');
    if (!response.ok) throw new Error('Server not responding');
    
    const data = await response.json();
    processShoppingData(data);
    
  } catch (error) {
    updateStatus('Could not connect to localhost:8080. Is the server running?', 'error');
  }
}

function loadItems() {
  const jsonInput = document.getElementById('json-input').value.trim();
  
  if (!jsonInput) {
    updateStatus('Please paste your shopping.json contents', 'error');
    return;
  }
  
  try {
    const data = JSON.parse(jsonInput);
    processShoppingData(data);
  } catch (e) {
    updateStatus('Invalid JSON: ' + e.message, 'error');
  }
}

function processShoppingData(data) {
  // Filter for Tesco items only
  items = data
    .filter(item => !item.checked && item.url && item.url.includes('tesco.com'))
    .map(item => {
      // Calculate total quantity
      let qty = 1;
      if (item.quantities) {
        qty = item.quantities.reduce((sum, q) => sum + (q.num || 1), 0);
      }
      return {
        name: item.name,
        url: item.url,
        quantity: qty,
        unit: item.unit || '',
        status: 'pending'
      };
    });
  
  if (items.length === 0) {
    updateStatus('No Tesco items found in the list', 'error');
    return;
  }
  
  currentIndex = 0;
  
  // Save to storage
  chrome.storage.local.set({ tescoItems: items, currentIndex: 0 });
  
  renderItems();
  updateStatus(`Loaded ${items.length} Tesco items`, 'success');
}

function renderItems() {
  const list = document.getElementById('items-list');
  list.style.display = 'block';
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('clear-btn').style.display = 'block';
  
  list.innerHTML = items.map((item, i) => {
    let statusIcon = '';
    let className = '';
    let checkBtn = '';
    
    if (item.status === 'done') {
      statusIcon = '[OK]';
      className = 'done';
    } else if (item.status === 'failed') {
      statusIcon = '[X]';
      className = 'failed';
      checkBtn = `<button class="check-btn" onclick="manualCheckOff(${i})">Check Off</button>`;
    } else if (i === currentIndex && isRunning) {
      statusIcon = '...';
      className = 'current';
    } else {
      checkBtn = `<button class="check-btn" onclick="manualCheckOff(${i})">Check Off</button>`;
    }
    
    return `
      <div class="item ${className}">
        <span class="item-name">${item.name}</span>
        <span class="item-qty">x${item.quantity}</span>
        ${checkBtn}
        <span class="item-status">${statusIcon}</span>
      </div>
    `;
  }).join('');
  
  updateProgress();
}

// Manual check off button
async function manualCheckOff(index) {
  const item = items[index];
  updateStatus('Checking off: ' + item.name + '...', 'working');
  
  await checkOffItem(item.name);
  
  items[index].status = 'done';
  chrome.storage.local.set({ tescoItems: items });
  renderItems();
  updateStatus('Checked off: ' + item.name, 'success');
}

// Check all successful items off in shopping list
async function checkAllSuccessful() {
  const doneItems = items.filter(i => i.status === 'done');
  if (doneItems.length === 0) {
    updateStatus('No successful items to check off', 'error');
    return;
  }
  
  updateStatus(`Checking off ${doneItems.length} items...`, 'working');
  
  try {
    // Fetch current shopping list
    const response = await fetch('http://localhost:8080/api/shopping');
    if (!response.ok) throw new Error('Server not responding');
    
    const shoppingList = await response.json();
    let checkedCount = 0;
    
    // Check off all done items
    for (const doneItem of doneItems) {
      const item = shoppingList.find(i => i.name === doneItem.name);
      if (item && !item.checked) {
        item.checked = true;
        checkedCount++;
      }
    }
    
    // Save back to server
    const saveResponse = await fetch('http://localhost:8080/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shoppingList)
    });
    await saveResponse.text(); // Consume response body
    
    updateStatus(`Checked off ${checkedCount} items in shopping list!`, 'success');
  } catch (e) {
    updateStatus('Failed to check off items: ' + e.message, 'error');
  }
}

// Clear the loaded list
function clearList() {
  items = [];
  currentIndex = 0;
  isRunning = false;
  
  chrome.storage.local.remove(['tescoItems', 'currentIndex']);
  
  document.getElementById('items-list').style.display = 'none';
  document.getElementById('items-list').innerHTML = '';
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('check-all-btn').style.display = 'none';
  document.getElementById('clear-btn').style.display = 'none';
  document.getElementById('progress').style.display = 'none';
  
  updateStatus('List cleared. Click "Load from Planner" to reload.', 'success');
}

function updateProgress() {
  const done = items.filter(i => i.status === 'done').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const pending = items.length - done - failed;
  const progress = document.getElementById('progress');
  progress.style.display = 'block';
  progress.textContent = `Progress: ${done} added, ${failed} failed, ${pending} remaining`;
  
  // Show/hide check all button
  const checkAllBtn = document.getElementById('check-all-btn');
  if (done > 0) {
    checkAllBtn.style.display = 'block';
  } else {
    checkAllBtn.style.display = 'none';
  }
}

function updateStatus(message, type = '') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
}

async function startAdding() {
  if (items.length === 0) return;
  
  isRunning = true;
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'block';
  
  // Find first pending item
  while (currentIndex < items.length && items[currentIndex].status !== 'pending') {
    currentIndex++;
  }
  
  if (currentIndex >= items.length) {
    updateStatus('All items processed!', 'success');
    stopAdding();
    return;
  }
  
  await processNextItem();
}

function stopAdding() {
  isRunning = false;
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('stop-btn').style.display = 'none';
  chrome.storage.local.set({ tescoItems: items, currentIndex });
}

async function processNextItem() {
  if (!isRunning || currentIndex >= items.length) {
    if (currentIndex >= items.length) {
      updateStatus('All items processed!', 'success');
    }
    stopAdding();
    return;
  }
  
  const item = items[currentIndex];
  
  if (item.status !== 'pending') {
    currentIndex++;
    await processNextItem();
    return;
  }
  
  updateStatus(`Opening: ${item.name}...`, 'working');
  renderItems();
  
  // Open the product page in current tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      // Store item info for content script
      chrome.storage.local.set({ 
        currentItem: item,
        itemIndex: currentIndex 
      });
      
      // Navigate to product page
      chrome.tabs.update(tabs[0].id, { url: item.url });
    }
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ITEM_RESULT') {
    items[message.index].status = message.success ? 'done' : 'failed';
    chrome.storage.local.set({ tescoItems: items });
    
    if (message.success) {
      updateStatus('Added: ' + items[message.index].name, 'success');
      // Check off the item in the shopping list
      checkOffItem(items[message.index].name);
    } else {
      updateStatus('Failed: ' + items[message.index].name + ' - ' + message.error, 'error');
    }
    
    currentIndex++;
    renderItems();
    
    // Wait before next item
    if (isRunning) {
      setTimeout(() => processNextItem(), 2000 + Math.random() * 2000);
    }
  }
});

// Check off item in the shopping list on the server (fire-and-forget)
function checkOffItem(itemName) {
  fetch('http://localhost:8080/api/shopping')
    .then(response => response.ok ? response.json() : null)
    .then(shoppingList => {
      if (!shoppingList) return;
      
      const item = shoppingList.find(i => i.name === itemName);
      if (item) {
        item.checked = true;
        
        // Fire and forget - don't wait for response
        fetch('http://localhost:8080/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shoppingList)
        }).then(r => r.text()).catch(() => {});
        
        console.log(`Checked off: ${itemName}`);
      }
    })
    .catch(e => console.error('Failed to check off item:', e));
}

// ========== ADD PRODUCT TO LIST FEATURE ==========

// Get product info from current Tesco page
async function getProductInfo() {
  const productStatus = document.getElementById('product-status');
  productStatus.textContent = 'Getting product info...';
  productStatus.className = 'status working';
  
  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || !tab.url.includes('tesco.com')) {
      productStatus.textContent = 'Please go to a Tesco product page first';
      productStatus.className = 'status error';
      return;
    }
    
    // Send message to content script to get product info
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT_INFO' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded, try to extract from URL/title
        const name = tab.title ? tab.title.replace(' - Tesco Groceries', '').trim() : '';
        document.getElementById('product-name').value = name;
        document.getElementById('product-url').value = tab.url;
        document.getElementById('product-form').style.display = 'block';
        productStatus.textContent = 'Got info from tab. Edit if needed, then click Add.';
        productStatus.className = 'status success';
        return;
      }
      
      if (response && response.name) {
        document.getElementById('product-name').value = response.name;
        document.getElementById('product-url').value = tab.url;
        document.getElementById('product-form').style.display = 'block';
        productStatus.textContent = 'Product info loaded! Edit if needed, then click Add.';
        productStatus.className = 'status success';
      } else {
        // Fallback to tab title
        const name = tab.title ? tab.title.replace(' - Tesco Groceries', '').trim() : '';
        document.getElementById('product-name').value = name;
        document.getElementById('product-url').value = tab.url;
        document.getElementById('product-form').style.display = 'block';
        productStatus.textContent = 'Got info from tab title. Edit if needed.';
        productStatus.className = 'status success';
      }
    });
  } catch (e) {
    productStatus.textContent = 'Error: ' + e.message;
    productStatus.className = 'status error';
  }
}

// Add the product to items.json (master product list)
async function addProductToList() {
  const productStatus = document.getElementById('product-status');
  const name = document.getElementById('product-name').value.trim();
  const url = document.getElementById('product-url').value.trim();
  const qty = parseInt(document.getElementById('product-qty').value) || 1;
  const unit = document.getElementById('product-unit').value.trim();
  const category = document.getElementById('product-category').value;
  
  if (!name) {
    productStatus.textContent = 'Please enter a product name';
    productStatus.className = 'status error';
    return;
  }
  
  productStatus.textContent = 'Adding to items list...';
  productStatus.className = 'status working';
  
  try {
    // Fetch current items list
    const response = await fetch('http://localhost:8080/api/items');
    if (!response.ok) throw new Error('Server not responding. Is it running?');
    
    const itemsList = await response.json();
    
    // Generate ID from name
    const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const itemId = slugify(name);
    
    // Check if item already exists (by ID, name, or URL)
    let existingItem = itemsList.find(i => 
      i.id === itemId ||
      i.name.toLowerCase() === name.toLowerCase()
    );
    
    // Also check by URL
    if (!existingItem && url) {
      existingItem = itemsList.find(i => 
        i.sources && i.sources.some(s => s.url === url)
      );
    }
    
    if (existingItem) {
      // Add Tesco URL if not already present
      if (!existingItem.sources) existingItem.sources = [];
      const hasUrl = existingItem.sources.some(s => s.url === url);
      if (url && !hasUrl) {
        existingItem.sources.push({ store: 'Tesco', url: url });
      }
      // Update unit if provided and not set
      if (unit && !existingItem.unit) {
        existingItem.unit = unit;
      }
      // Update category if not set
      if (category && (!existingItem.category || existingItem.category === 'Other|Other')) {
        existingItem.category = category;
      }
      productStatus.textContent = `Updated "${existingItem.name}" with Tesco URL!`;
    } else {
      // Add new item
      const newItem = {
        id: itemId,
        name: name,
        category: category,
        unit: unit || 'item',
        sources: url ? [{ store: 'Tesco', url: url }] : []
      };
      itemsList.push(newItem);
      productStatus.textContent = `Added "${name}" to items list!`;
    }
    
    // Save back to server
    const saveResponse = await fetch('http://localhost:8080/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemsList)
    });
    await saveResponse.text(); // Consume response body
    
    productStatus.className = 'status success';
    
    // Clear form
    document.getElementById('product-form').style.display = 'none';
    document.getElementById('product-name').value = '';
    document.getElementById('product-url').value = '';
    document.getElementById('product-qty').value = '1';
    document.getElementById('product-unit').value = '';
    
  } catch (e) {
    productStatus.textContent = 'Error: ' + e.message;
    productStatus.className = 'status error';
  }
}
