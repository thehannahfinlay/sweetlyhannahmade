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
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    // Digital products (patterns) limited to qty 1
    if (product.categoryId === 'patterns' || (!product.shipping && !product.categoryId)) {
      return; // already in cart
    }
    existing.quantity = (existing.quantity || 1) + (product.quantity || 1);
  } else {
    cart.push({ ...product, quantity: product.quantity || 1 });
  }
  _saveCart(cart);
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

    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-3 py-4 border-b border-brand-100 last:border-0';

      // Thumbnail
      const img = document.createElement('img');
      img.src = item.image || '';
      img.alt = item.name || '';
      img.className = 'w-16 h-16 object-cover rounded-lg border border-brand-100 flex-shrink-0 bg-brand-50';
      img.addEventListener('error', () => { img.style.display = 'none'; });

      // Info block
      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';

      const nameEl = document.createElement('p');
      nameEl.className = 'font-semibold text-gray-800 text-sm leading-snug truncate';
      nameEl.textContent = item.name || '';

      const priceEl = document.createElement('p');
      priceEl.className = 'text-brand-600 font-bold text-sm mt-0.5';
      priceEl.textContent = formatPrice(item.price || 0);

      // Quantity controls
      const qtyRow = document.createElement('div');
      qtyRow.className = 'flex items-center gap-2 mt-2';

      const decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'w-6 h-6 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors';
      decBtn.textContent = '−';
      decBtn.setAttribute('aria-label', 'Decrease quantity');
      decBtn.addEventListener('click', () => {
        if (item.quantity <= 1) removeFromCart(item.id);
        else updateCartQuantity(item.id, item.quantity - 1);
        renderCartDrawer();
      });

      const qtyNum = document.createElement('span');
      qtyNum.className = 'text-sm font-medium text-gray-700 w-5 text-center';
      qtyNum.textContent = String(item.quantity || 1);

      const incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'w-6 h-6 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors';
      incBtn.textContent = '+';
      incBtn.setAttribute('aria-label', 'Increase quantity');
      incBtn.addEventListener('click', () => {
        updateCartQuantity(item.id, (item.quantity || 1) + 1);
        renderCartDrawer();
      });

      qtyRow.appendChild(decBtn);
      qtyRow.appendChild(qtyNum);
      qtyRow.appendChild(incBtn);

      info.appendChild(nameEl);
      info.appendChild(priceEl);
      // Only show quantity controls for physical items (not patterns)
      if (item.shipping > 0 || item.categoryId === 'plushies') {
        info.appendChild(qtyRow);
      }

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5 p-1';
      removeBtn.setAttribute('aria-label', 'Remove item');
      // SVG X icon via DOM
      const rmSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      rmSvg.setAttribute('class', 'w-4 h-4');
      rmSvg.setAttribute('fill', 'none');
      rmSvg.setAttribute('stroke', 'currentColor');
      rmSvg.setAttribute('stroke-width', '2');
      rmSvg.setAttribute('viewBox', '0 0 24 24');
      const rmPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rmPath.setAttribute('stroke-linecap', 'round');
      rmPath.setAttribute('stroke-linejoin', 'round');
      rmPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      rmSvg.appendChild(rmPath);
      removeBtn.appendChild(rmSvg);
      removeBtn.addEventListener('click', () => {
        removeFromCart(item.id);
        renderCartDrawer();
      });

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(removeBtn);
      itemsEl.appendChild(row);
    });

    var shippingTotal = cart.reduce(function(sum, item) { return sum + (item.shipping || 0) * (item.quantity || 1); }, 0);
    if (totalEl) {
      if (shippingTotal > 0) {
        totalEl.innerHTML = formatPrice(getCartTotal()) + '<span class="text-sm font-normal text-gray-500 block">+ ' + formatPrice(shippingTotal) + ' shipping</span>';
      } else {
        totalEl.textContent = formatPrice(getCartTotal());
      }
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
    let body;
    if (cart.length === 1) {
      // Backwards-compatible single-item format
      body = JSON.stringify({
        name: cart[0].name,
        price: cart[0].price,
        productId: cart[0].id,
        shipping: cart[0].shipping || 0,
      });
    } else {
      // Multi-item format
      body = JSON.stringify({
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          productId: item.id,
          quantity: item.quantity || 1,
          shipping: item.shipping || 0,
        })),
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
});
