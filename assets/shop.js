let _inventory = null;
const MEDUSA_API_KEY = 'pk_7fbddc66e82e923c071fc144f86ed9f6e8689955a9c5b17b23a6b0eb44aed820';

function medusaHeaders() {
  return { 'x-publishable-api-key': MEDUSA_API_KEY };
}

async function getInventory() {
  if (_inventory) return _inventory;

  // Fetch static shop data (testimonials, trust badges, about, etc.)
  const staticRes = await fetch('/inventory.json');
  const staticData = await staticRes.json();

  // Fetch products from Medusa API
  let products = [];
  let categories = [];
  try {
    const prodRes = await fetch('/store/products?limit=100&fields=*variants,*variants.prices,metadata,*images,title,description,handle,collection_id,*categories,*tags', { headers: medusaHeaders() });
    const prodData = await prodRes.json();
    products = (prodData.products || []).map(p => {
      const variant = p.variants && p.variants[0];
      const price = variant && variant.prices && variant.prices[0];
      return {
        id: p.id,
        categoryId: (p.metadata && p.metadata.categoryId) || p.collection_id || (p.categories && p.categories[0] && p.categories[0].id) || '',
        name: p.title,
        price: price ? price.amount : 0,
        featured: p.metadata && (p.metadata.featured === true || p.metadata.featured === 'true'),
        images: (p.images || []).map(img => img.url.replace('http://localhost:9000', '').replace('https://sweetlyhannahmade.com', '').replace('http://5.78.150.112', '')),
        video: (p.metadata && p.metadata.video) || '',
        description: p.description || '',
        difficulty: (p.metadata && p.metadata.difficulty) || null,
        tags: (p.tags || []).map(t => t.value),
        stripeLink: '',
        inStock: p.variants ? p.variants.some(v => v.manage_inventory === false || v.inventory_quantity > 0 || v.allow_backorder) : true,
        variantId: variant ? variant.id : null,
        variants: (p.variants || []).map(v => ({
          id: v.id,
          title: v.title,
          price: v.prices && v.prices[0] ? v.prices[0].amount : 0,
          options: (v.options || []).map(o => ({ title: o.option ? o.option.title : '', value: o.value })),
        })),
        hasOptions: p.variants && p.variants.length > 1,
        shipping: (p.metadata && p.metadata.shipping) ? Number(p.metadata.shipping) : 0,
        processingTime: (p.metadata && p.metadata.processingTime) || null,
        personalization: p.metadata && (p.metadata.personalization === true || p.metadata.personalization === 'true'),
        personalizationLabel: (p.metadata && p.metadata.personalizationLabel) || null,
        stockQty: (p.metadata && p.metadata.stockQty) ? Number(p.metadata.stockQty) : null,
        variantImages: (p.metadata && p.metadata.variantImages) || null,
        customOptions: (p.metadata && p.metadata.customOptions) ? (typeof p.metadata.customOptions === 'string' ? JSON.parse(p.metadata.customOptions) : p.metadata.customOptions) : null,
      };
    });

    const catRes = await fetch('/store/product-categories?limit=100', { headers: medusaHeaders() });
    const catData = await catRes.json();
    categories = (catData.product_categories || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      coverImage: (c.metadata && c.metadata.coverImage) || '',
    }));
  } catch (e) {
    // Fall back to static data if Medusa API is unavailable
    products = staticData.products || [];
    categories = staticData.categories || [];
  }

  _inventory = {
    shop: staticData.shop,
    testimonials: staticData.testimonials,
    trustBadges: staticData.trustBadges,
    categories: (staticData.categories && staticData.categories.length > 0) ? staticData.categories : categories,
    products: products.length > 0 ? products : (staticData.products || []),
  };
  return _inventory;
}

// Create a Medusa cart and redirect to Stripe checkout
async function medusaCheckout(variantId) {
  const hdrs = { 'Content-Type': 'application/json', 'x-publishable-api-key': MEDUSA_API_KEY };

  // Create cart
  const cartRes = await fetch('/store/carts', {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({}),
  });
  const cartData = await cartRes.json();
  const cartId = cartData.cart.id;

  // Add item
  await fetch('/store/carts/' + cartId + '/line-items', {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  // Initialize payment sessions
  await fetch('/store/carts/' + cartId + '/payment-sessions', {
    method: 'POST',
    headers: hdrs,
  });

  // Complete order
  const completeRes = await fetch('/store/carts/' + cartId + '/complete', {
    method: 'POST',
    headers: hdrs,
  });
  const completeData = await completeRes.json();
  return completeData;
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function formatPrice(price) {
  return '$' + Number(price).toFixed(2);
}

function renderStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// Escape user-facing text before inserting into HTML template literals
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// Convert basic markdown to HTML. Output MUST be sanitized with DOMPurify before use.
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^]*?<\/li>\n?)+/g, match => '<ul>' + match + '</ul>')
    .split(/\n{2,}/)
    .map(block => {
      if (block.startsWith('<')) return block;
      return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    })
    .join('');
}

function renderIcon(icon) {
  const icons = {
    heart: `<svg class="w-8 h-8 mx-auto mb-2 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>`,
    download: `<svg class="w-8 h-8 mx-auto mb-2 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`,
    star: `<svg class="w-8 h-8 mx-auto mb-2 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`
  };
  return icons[icon] || icons.star;
}

// Shared social icon SVG path constants
const INSTAGRAM_PATH = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z';
const TIKTOK_PATH = 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z';

// Build a header social icon anchor element using DOM methods
function makeSocialAnchor(href, label, svgPath) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.setAttribute('aria-label', label);
  a.className = 'text-gray-500 hover:text-brand-500 transition-colors';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-5 h-5');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', svgPath);
  svg.appendChild(path);
  a.appendChild(svg);
  return a;
}

// ─── Cart ────────────────────────────────────────────────────────────────────

const CART_KEY = 'shm_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function _saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

// product: { id, name, price, image, variantId, quantity }
var MAX_PLUSHIE_QTY = 5;

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    // Digital products (patterns) limited to qty 1
    if (product.categoryId === 'patterns') {
      return 'already_in_cart';
    }
    var newQty = (existing.quantity || 1) + (product.quantity || 1);
    var itemMax = product.stockQty ? Math.min(product.stockQty, MAX_PLUSHIE_QTY) : MAX_PLUSHIE_QTY;
    if (newQty > itemMax) return 'max_qty';
    existing.quantity = newQty;
  } else {
    cart.push({ ...product, quantity: product.quantity || 1 });
  }
  _saveCart(cart);
  return 'added';
}

function removeFromCart(productId) {
  _saveCart(getCart().filter(item => item.id !== productId));
}

function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    _saveCart(cart);
  }
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function openCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const panel = document.getElementById('cart-drawer-panel');
  if (!overlay || !panel) return;
  renderCartDrawer();
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    panel.classList.remove('translate-x-full');
  });
}

function closeCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const panel = document.getElementById('cart-drawer-panel');
  if (!overlay || !panel) return;
  overlay.classList.add('opacity-0');
  panel.classList.add('translate-x-full');
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

function renderCartDrawer() {
  const cart = getCart();
  const itemsEl = document.getElementById('cart-drawer-items');
  const emptyEl = document.getElementById('cart-drawer-empty');
  const footerEl = document.getElementById('cart-drawer-footer');
  const totalEl = document.getElementById('cart-drawer-total');
  if (!itemsEl) return;

  // Clear items list
  while (itemsEl.firstChild) itemsEl.removeChild(itemsEl.firstChild);

  if (cart.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (footerEl) footerEl.style.display = 'none';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'block';

    // Build display rows — split items when promo applies to only 1 of N
    var displayRows = [];
    var promoAppliedTo = null;
    var hasPromo = localStorage.getItem('shm_promo') && localStorage.getItem('shm_promo_pct');
    var promoPct = hasPromo ? parseInt(localStorage.getItem('shm_promo_pct')) : 0;
    var cartPatternCount = cart.reduce(function(s, i) { return s + (i.categoryId === 'patterns' ? (i.quantity || 1) : 0); }, 0);

    cart.forEach(function(item, idx) {
      var isPattern = item.categoryId === 'patterns';
      var qty = item.quantity || 1;

      // Check if promo code applies to this item (first item, qty 1 only)
      var promoOnThis = false;
      if (hasPromo && !promoAppliedTo && idx === 0) {
        promoOnThis = true;
        promoAppliedTo = item.id;
      }

      if (promoOnThis && qty > 1) {
        // Split: 1 discounted + rest at full price
        displayRows.push({ item: item, qty: 1, discount: promoPct, discountLabel: 'Promo' });
        displayRows.push({ item: item, qty: qty - 1, discount: 0 });
      } else if (promoOnThis) {
        displayRows.push({ item: item, qty: 1, discount: promoPct, discountLabel: 'Promo' });
      } else if (isPattern && cartPatternCount >= 2) {
        // Bundle discount on patterns
        displayRows.push({ item: item, qty: qty, discount: 20, discountLabel: 'Bundle' });
      } else {
        displayRows.push({ item: item, qty: qty, discount: 0 });
      }
    });

    displayRows.forEach(function(row) {
      var item = row.item;
      var displayQty = row.qty;
      var promoDiscount = row.discount;

      const rowEl = document.createElement('div');
      rowEl.className = 'flex items-start gap-3 py-4 border-b border-brand-100 last:border-0';

      const img = document.createElement('img');
      img.src = item.image || '';
      img.alt = item.name || '';
      img.className = 'w-16 h-16 object-cover rounded-lg border border-brand-100 flex-shrink-0 bg-brand-50';
      img.addEventListener('error', () => { img.style.display = 'none'; });

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';

      const nameEl = document.createElement('p');
      nameEl.className = 'font-semibold text-gray-800 text-sm leading-snug truncate';
      nameEl.textContent = (item.name || '') + (displayQty > 1 ? '' : '');

      const priceEl = document.createElement('p');
      priceEl.className = 'text-sm mt-0.5';

      if (promoDiscount > 0) {
        var origSpan = document.createElement('span');
        origSpan.className = 'text-gray-400 line-through mr-2';
        origSpan.textContent = formatPrice(item.price || 0);
        var newPrice = (item.price || 0) * (1 - promoDiscount / 100);
        var saleSpan = document.createElement('span');
        saleSpan.className = 'text-green-600 font-bold';
        saleSpan.textContent = formatPrice(newPrice);
        priceEl.appendChild(origSpan);
        priceEl.appendChild(saleSpan);
      } else {
        priceEl.className = 'text-brand-600 font-bold text-sm mt-0.5';
        priceEl.textContent = formatPrice(item.price || 0);
      }

      // Quantity display
      if (displayQty > 1) {
        var qtyLabel = document.createElement('span');
        qtyLabel.className = 'text-gray-500 text-xs';
        qtyLabel.textContent = ' x' + displayQty;
        nameEl.appendChild(qtyLabel);
      }

      // Discount label
      if (row.discountLabel) {
        var discLabel = document.createElement('span');
        discLabel.className = 'text-xs font-medium ml-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700';
        discLabel.textContent = row.discountLabel + ' -' + promoDiscount + '%';
        priceEl.appendChild(discLabel);
      }

      // Quantity controls: show on the non-discounted row (or the only row if no split)
      var isSplitDiscountRow = row.discountLabel === 'Promo' && (item.quantity || 1) > 1;
      var isMainRow = !isSplitDiscountRow;
      info.appendChild(nameEl);
      info.appendChild(priceEl);

      if (item.categoryId !== 'patterns' && isMainRow) {
        var qtyControls = document.createElement('div');
        qtyControls.className = 'flex items-center gap-2 mt-2';
        var decBtn = document.createElement('button');
        decBtn.type = 'button';
        decBtn.className = 'w-6 h-6 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors';
        decBtn.textContent = '\u2212';
        decBtn.addEventListener('click', function() {
          if (item.quantity <= 1) removeFromCart(item.id);
          else updateCartQuantity(item.id, item.quantity - 1);
          renderCartDrawer();
        });
        var qtyNum = document.createElement('span');
        qtyNum.className = 'text-sm font-medium text-gray-700 w-5 text-center';
        qtyNum.textContent = String(item.quantity || 1);
        var incBtn = document.createElement('button');
        incBtn.type = 'button';
        incBtn.className = 'w-6 h-6 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors';
        incBtn.textContent = '+';
        incBtn.addEventListener('click', function() {
          var cartItemMax = item.stockQty ? Math.min(item.stockQty, MAX_PLUSHIE_QTY) : MAX_PLUSHIE_QTY;
          if ((item.quantity || 1) >= cartItemMax) return;
          updateCartQuantity(item.id, (item.quantity || 1) + 1);
          renderCartDrawer();
        });
        qtyControls.appendChild(decBtn);
        qtyControls.appendChild(qtyNum);
        qtyControls.appendChild(incBtn);
        info.appendChild(qtyControls);
      }

      // Remove button (only on main rows)
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5 p-1';
      removeBtn.setAttribute('aria-label', 'Remove item');
      var rmSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      rmSvg.setAttribute('class', 'w-4 h-4');
      rmSvg.setAttribute('fill', 'none');
      rmSvg.setAttribute('stroke', 'currentColor');
      rmSvg.setAttribute('stroke-width', '2');
      rmSvg.setAttribute('viewBox', '0 0 24 24');
      var rmPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rmPath.setAttribute('stroke-linecap', 'round');
      rmPath.setAttribute('stroke-linejoin', 'round');
      rmPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      rmSvg.appendChild(rmPath);
      removeBtn.appendChild(rmSvg);
      if (isMainRow) {
        removeBtn.addEventListener('click', function() {
          removeFromCart(item.id);
          renderCartDrawer();
        });
      } else {
        removeBtn.style.visibility = 'hidden';
      }

      rowEl.appendChild(img);
      rowEl.appendChild(info);
      rowEl.appendChild(removeBtn);
      itemsEl.appendChild(rowEl);
    });

    // Check if cart has physical items
    var hasPhysical = cart.some(function(item) { return item.categoryId !== 'patterns'; });
    // Calculate discounted total
    var rawTotal = getCartTotal();
    var discountedTotal = rawTotal;
    var totalPatterns = cart.reduce(function(s, i) { return s + (i.categoryId === 'patterns' ? (i.quantity || 1) : 0); }, 0);
    if (totalPatterns >= 2) {
      // Only discount pairs (e.g. 3 patterns = 2 discounted, 1 full price)
      var discountedPatternCount = Math.floor(totalPatterns / 2) * 2;
      var patternPrices = [];
      cart.forEach(function(i) {
        if (i.categoryId === 'patterns') {
          for (var q = 0; q < (i.quantity || 1); q++) patternPrices.push(i.price || 0);
        }
      });
      var discountAmount = 0;
      for (var dp = 0; dp < discountedPatternCount && dp < patternPrices.length; dp++) {
        discountAmount += patternPrices[dp] * 0.2;
      }
      discountedTotal = rawTotal - discountAmount;
    } else if (localStorage.getItem('shm_promo') && localStorage.getItem('shm_promo_pct')) {
      // Promo applies to first item only (qty 1)
      var pct = parseInt(localStorage.getItem('shm_promo_pct'));
      if (cart.length > 0) {
        var firstItemPrice = cart[0].price || 0;
        discountedTotal = rawTotal - (firstItemPrice * pct / 100);
      }
    }
    if (totalEl) {
      while (totalEl.firstChild) totalEl.removeChild(totalEl.firstChild);
      if (discountedTotal < rawTotal) {
        var origTotal = document.createElement('span');
        origTotal.className = 'text-gray-400 line-through text-sm mr-2';
        origTotal.textContent = formatPrice(rawTotal);
        totalEl.appendChild(origTotal);
        totalEl.appendChild(document.createTextNode(formatPrice(discountedTotal)));
      } else {
        totalEl.appendChild(document.createTextNode(formatPrice(rawTotal)));
      }
      if (hasPhysical) {
        var shipSpan = document.createElement('span');
        shipSpan.className = 'text-sm font-normal text-gray-400 block';
        shipSpan.textContent = 'Shipping calculated at checkout';
        totalEl.appendChild(shipSpan);
      }
    }

    // Promo code section
    var promoSection = document.getElementById('cart-promo-section');
    if (promoSection) promoSection.parentNode.removeChild(promoSection);

    promoSection = document.createElement('div');
    promoSection.id = 'cart-promo-section';
    promoSection.className = 'mb-4';

    var savedPromo = localStorage.getItem('shm_promo');
    var patternCount = cart.reduce(function(sum, item) { return sum + (item.categoryId === 'patterns' ? (item.quantity || 1) : 0); }, 0);
    var hasBundleDiscount = patternCount >= 2;

    // If bundle discount kicks in, auto-remove any saved promo
    if (hasBundleDiscount && savedPromo) {
      localStorage.removeItem('shm_promo');
      localStorage.removeItem('shm_promo_pct');
      savedPromo = null;
    }

    // Applied code pill (if one is saved)
    if (savedPromo) {
      var appliedRow = document.createElement('div');
      appliedRow.className = 'flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2';
      var codeInfo = document.createElement('div');
      var codePill = document.createElement('span');
      codePill.className = 'font-bold text-green-700 text-sm tracking-wider';
      codePill.textContent = savedPromo;
      var codeLabel = document.createElement('span');
      codeLabel.className = 'text-green-600 text-xs ml-2';
      codeLabel.textContent = 'Applied';
      codeInfo.appendChild(codePill);
      codeInfo.appendChild(codeLabel);
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-gray-400 hover:text-red-500 transition-colors p-1';
      removeBtn.setAttribute('aria-label', 'Remove promo code');
      var rmSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      rmSvg.setAttribute('class', 'w-4 h-4');
      rmSvg.setAttribute('fill', 'none');
      rmSvg.setAttribute('stroke', 'currentColor');
      rmSvg.setAttribute('stroke-width', '2');
      rmSvg.setAttribute('viewBox', '0 0 24 24');
      var rmPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rmPath.setAttribute('stroke-linecap', 'round');
      rmPath.setAttribute('stroke-linejoin', 'round');
      rmPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      rmSvg.appendChild(rmPath);
      removeBtn.appendChild(rmSvg);
      removeBtn.addEventListener('click', function() {
        localStorage.removeItem('shm_promo');
      localStorage.removeItem('shm_promo_pct');
        renderCartDrawer();
      });
      appliedRow.appendChild(codeInfo);
      appliedRow.appendChild(removeBtn);
      promoSection.appendChild(appliedRow);
    }

    // Bundle discount notice
    if (hasBundleDiscount) {
      var bundleNotice = document.createElement('p');
      bundleNotice.className = 'text-xs text-green-600 font-medium mb-2';
      bundleNotice.textContent = '20% bundle discount applied automatically.';
      promoSection.appendChild(bundleNotice);
    }

    // Promo code input (always visible)
    var inputRow = document.createElement('div');
    inputRow.className = 'flex gap-2';
    var promoInput = document.createElement('input');
    promoInput.type = 'text';
    promoInput.placeholder = 'Enter promo code';
    promoInput.className = 'flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-transparent uppercase';
    promoInput.style.letterSpacing = '1px';
    var applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0';
    applyBtn.textContent = 'Apply';

    var errorMsg = document.createElement('p');
    errorMsg.className = 'hidden text-xs font-medium mt-1.5';

    applyBtn.addEventListener('click', function() {
      var code = promoInput.value.trim().toUpperCase();
      if (!code) {
        errorMsg.textContent = 'Please enter a promo code.';
        errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
        errorMsg.classList.remove('hidden');
        return;
      }
      if (hasBundleDiscount) {
        errorMsg.textContent = 'Promo codes cannot be combined with other discounts.';
        errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
        errorMsg.classList.remove('hidden');
        return;
      }
      var currentPromo = localStorage.getItem('shm_promo');
      if (currentPromo && currentPromo === code) {
        errorMsg.textContent = 'This promo code has already been applied.';
        errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
        errorMsg.classList.remove('hidden');
        return;
      }
      if (currentPromo) {
        errorMsg.textContent = 'Only one promo code can be used at a time. Remove the current code first.';
        errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
        errorMsg.classList.remove('hidden');
        return;
      }

      errorMsg.classList.add('hidden');
      applyBtn.textContent = 'Applying...';
      applyBtn.disabled = true;

      fetch('/api/check-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.valid) {
          localStorage.setItem('shm_promo', code);
          localStorage.setItem('shm_promo_pct', String(data.pct));
          renderCartDrawer();
        } else {
          errorMsg.textContent = 'This promo code is not valid.';
          errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
          errorMsg.classList.remove('hidden');
          applyBtn.textContent = 'Apply';
          applyBtn.disabled = false;
        }
      }).catch(function() {
        errorMsg.textContent = 'Something went wrong. Try again.';
        errorMsg.className = 'text-xs text-red-500 font-medium mt-1.5';
        errorMsg.classList.remove('hidden');
        applyBtn.textContent = 'Apply';
        applyBtn.disabled = false;
      });
    });

    promoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); applyBtn.click(); }
    });

    inputRow.appendChild(promoInput);
    inputRow.appendChild(applyBtn);
    promoSection.appendChild(inputRow);
    promoSection.appendChild(errorMsg);

    var footer = document.getElementById('cart-drawer-footer');
    if (footer) {
      var checkoutBtn = document.getElementById('cart-checkout-btn');
      if (checkoutBtn) footer.insertBefore(promoSection, checkoutBtn);
    }
  }
}

async function cartCheckout() {
  const cart = getCart();
  if (cart.length === 0) return;

  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.textContent = 'Loading\u2026';
    checkoutBtn.disabled = true;
  }

  try {
    var promoCode = localStorage.getItem('shm_promo') || '';
    let body;
    if (cart.length === 1) {
      body = JSON.stringify({
        name: cart[0].name + (cart[0].personalization ? ' [Note: ' + cart[0].personalization + ']' : ''),
        price: cart[0].price,
        productId: cart[0].id,
        shipping: cart[0].shipping || 0,
        categoryId: cart[0].categoryId || '',
        promoCode: promoCode,
      });
    } else {
      body = JSON.stringify({
        items: cart.map(item => ({
          name: item.name + (item.personalization ? ' [Note: ' + item.personalization + ']' : ''),
          price: item.price,
          productId: item.id,
          quantity: item.quantity || 1,
          shipping: item.shipping || 0,
          categoryId: item.categoryId || '',
        })),
        promoCode: promoCode,
      });
    }

    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Something went wrong. Please try again.');
      if (checkoutBtn) { checkoutBtn.textContent = 'Checkout'; checkoutBtn.disabled = false; }
    }
  } catch {
    alert('Something went wrong. Please try again.');
    if (checkoutBtn) { checkoutBtn.textContent = 'Checkout'; checkoutBtn.disabled = false; }
  }
}

// Initialise cart badge and wire up drawer close/checkout as soon as DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();

  // Cart icon button
  const cartIconBtn = document.getElementById('cart-icon-btn');
  if (cartIconBtn) cartIconBtn.addEventListener('click', openCartDrawer);

  // Drawer close button
  const cartClose = document.getElementById('cart-drawer-close');
  if (cartClose) cartClose.addEventListener('click', closeCartDrawer);

  // Overlay click-outside to close
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCartDrawer();
    });
  }

  // Checkout button
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', cartCheckout);

  // Highlight active nav link
  const currentPath = window.location.pathname + window.location.search;
  document.querySelectorAll('nav a, .mobile-menu-panel nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isActive = (href === 'gallery' && currentPath.includes('gallery')) ||
                     (href.includes('category?id=patterns') && currentPath.includes('id=patterns')) ||
                     (href.includes('category?id=plushies') && currentPath.includes('id=plushies'));
    if (isActive) {
      link.classList.remove('text-gray-600', 'text-gray-700');
      link.classList.add('text-brand-600');
    }
  });

  // ─── Chat Widget ──────────────────────────────────────────────────────────
  (function() {
    // Don't show on admin/manage pages
    if (window.location.pathname.includes('admin') || window.location.pathname.includes('manage') || window.location.pathname.includes('gallery-edit')) return;

    // Chat bubble button
    var chatBtn = document.createElement('button');
    chatBtn.id = 'chat-bubble';
    chatBtn.setAttribute('aria-label', 'Chat with us');
    chatBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:45;width:56px;height:56px;border-radius:50%;background:#b87a90;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:transform 0.2s,background 0.2s;';
    var chatIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chatIcon.setAttribute('width', '24');
    chatIcon.setAttribute('height', '24');
    chatIcon.setAttribute('fill', 'none');
    chatIcon.setAttribute('stroke', 'currentColor');
    chatIcon.setAttribute('stroke-width', '2');
    chatIcon.setAttribute('viewBox', '0 0 24 24');
    var chatPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chatPath.setAttribute('stroke-linecap', 'round');
    chatPath.setAttribute('stroke-linejoin', 'round');
    chatPath.setAttribute('d', 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z');
    chatIcon.appendChild(chatPath);
    chatBtn.appendChild(chatIcon);

    // Chat panel
    var chatPanel = document.createElement('div');
    chatPanel.id = 'chat-panel';
    chatPanel.style.cssText = 'position:fixed;bottom:92px;right:24px;z-index:45;width:340px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.15);display:none;overflow:hidden;font-family:inherit;';

    // Header
    var chatHeader = document.createElement('div');
    chatHeader.style.cssText = 'background:#b87a90;color:#fff;padding:16px 20px;';
    var chatTitle = document.createElement('p');
    chatTitle.style.cssText = 'font-weight:700;font-size:16px;margin:0;';
    chatTitle.textContent = 'Chat with Hannah';
    var chatSubtitle = document.createElement('p');
    chatSubtitle.style.cssText = 'font-size:12px;opacity:0.8;margin:4px 0 0;';
    chatSubtitle.textContent = 'I\'ll get back to you as soon as I can!';
    chatHeader.appendChild(chatTitle);
    chatHeader.appendChild(chatSubtitle);

    // Body
    var chatBody = document.createElement('div');
    chatBody.style.cssText = 'padding:16px 20px;';

    var chatNameInput = document.createElement('input');
    chatNameInput.type = 'text';
    chatNameInput.placeholder = 'Your name';
    chatNameInput.style.cssText = 'width:100%;border:1px solid #e8c4d2;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:10px;outline:none;box-sizing:border-box;';

    var chatEmailInput = document.createElement('input');
    chatEmailInput.type = 'email';
    chatEmailInput.placeholder = 'Your email';
    chatEmailInput.style.cssText = 'width:100%;border:1px solid #e8c4d2;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:10px;outline:none;box-sizing:border-box;';

    var chatMsgInput = document.createElement('textarea');
    chatMsgInput.placeholder = 'Type your message...';
    chatMsgInput.rows = 3;
    chatMsgInput.style.cssText = 'width:100%;border:1px solid #e8c4d2;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:10px;outline:none;resize:vertical;box-sizing:border-box;font-family:inherit;';

    var chatSendBtn = document.createElement('button');
    chatSendBtn.type = 'button';
    chatSendBtn.textContent = 'Send Message';
    chatSendBtn.style.cssText = 'width:100%;background:#b87a90;color:#fff;border:none;border-radius:24px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s;';

    var chatStatus = document.createElement('p');
    chatStatus.style.cssText = 'font-size:12px;text-align:center;margin-top:10px;display:none;';

    chatBody.appendChild(chatNameInput);
    chatBody.appendChild(chatEmailInput);
    chatBody.appendChild(chatMsgInput);
    chatBody.appendChild(chatSendBtn);
    chatBody.appendChild(chatStatus);

    chatPanel.appendChild(chatHeader);
    chatPanel.appendChild(chatBody);

    // Toggle
    var chatOpen = false;
    chatBtn.addEventListener('click', function() {
      chatOpen = !chatOpen;
      chatPanel.style.display = chatOpen ? 'block' : 'none';
      chatBtn.style.transform = chatOpen ? 'scale(0.9)' : '';
    });
    chatBtn.addEventListener('mouseenter', function() { chatBtn.style.background = '#a0687c'; });
    chatBtn.addEventListener('mouseleave', function() { chatBtn.style.background = '#b87a90'; });

    // Send
    chatSendBtn.addEventListener('click', function() {
      var name = chatNameInput.value.trim();
      var email = chatEmailInput.value.trim();
      var msg = chatMsgInput.value.trim();
      if (!name || !email || !msg) {
        chatStatus.textContent = 'Please fill in all fields.';
        chatStatus.style.color = '#ef4444';
        chatStatus.style.display = 'block';
        return;
      }

      chatSendBtn.textContent = 'Sending...';
      chatSendBtn.disabled = true;
      chatStatus.style.display = 'none';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: '[Chat] ' + msg })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          chatBody.style.cssText = 'padding:24px 20px;text-align:center;';
          while (chatBody.firstChild) chatBody.removeChild(chatBody.firstChild);
          var ty1 = document.createElement('p');
          ty1.style.cssText = 'font-size:24px;margin-bottom:8px;';
          ty1.textContent = '\u2705';
          var ty2 = document.createElement('p');
          ty2.style.cssText = 'font-weight:700;color:#333;font-size:16px;margin:0 0 4px;';
          ty2.textContent = 'Message sent!';
          var ty3 = document.createElement('p');
          ty3.style.cssText = 'font-size:13px;color:#666;margin:0;';
          ty3.textContent = 'I\'ll get back to you as soon as I can.';
          chatBody.appendChild(ty1);
          chatBody.appendChild(ty2);
          chatBody.appendChild(ty3);
        } else {
          chatStatus.textContent = 'Something went wrong. Try again.';
          chatStatus.style.color = '#ef4444';
          chatStatus.style.display = 'block';
          chatSendBtn.textContent = 'Send Message';
          chatSendBtn.disabled = false;
        }
      }).catch(function() {
        chatStatus.textContent = 'Something went wrong. Try again.';
        chatStatus.style.color = '#ef4444';
        chatStatus.style.display = 'block';
        chatSendBtn.textContent = 'Send Message';
        chatSendBtn.disabled = false;
      });
    });

    document.body.appendChild(chatPanel);
    document.body.appendChild(chatBtn);
  })();
});
