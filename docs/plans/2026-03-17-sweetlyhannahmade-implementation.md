# SweetlyHannahMade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static Shopify-style storefront with homepage, category pages, and product detail pages driven by a single inventory.json, managed via Decap CMS, hosted free on Netlify.

**Architecture:** Multi-page static HTML files + vanilla JavaScript. All pages fetch `inventory.json` at runtime to populate content. Decap CMS provides a form-based admin UI at `/admin` that commits JSON changes to GitHub, which Netlify auto-deploys.

**Tech Stack:** HTML5, TailwindCSS (CDN), vanilla JS (fetch + URLSearchParams), DOMPurify (sanitization), Decap CMS, Netlify (free tier), GitHub, Stripe payment links, Behold.so (Instagram embed)

**Security note:** All content comes from a CMS with invite-only access (admin only). Even so, `escapeHtml()` is used for text injected into template literals, and DOMPurify sanitizes all HTML generated from markdown. This follows defense-in-depth.

> **Note on testing:** Static front-end only — no unit tests. Each task ends with browser verification. For local dev, run `npx serve .` in the project root to avoid CORS errors with `fetch()`.

---

## Task 1: Initialize Project

**Files:**
- Create: `.gitignore`

**Step 1: Verify directory exists**

```bash
ls /Users/finlay/Desktop/sweetlyhannahmade/
```
Expected: `docs/`

**Step 2: Create full directory structure**

```bash
cd /Users/finlay/Desktop/sweetlyhannahmade
mkdir -p assets/images assets/videos admin
```

**Step 3: Create `.gitignore`**

```
.DS_Store
node_modules/
```

**Step 4: Initialize git and push to GitHub**

```bash
git init
git add .
git commit -m "chore: initialize SweetlyHannahMade project"
gh repo create sweetlyhannahmade --public --source=. --remote=origin --push
```

---

## Task 2: Create `inventory.json` with Sample Data

**Files:**
- Create: `inventory.json`

**Step 1: Create `inventory.json`**

```json
{
  "shop": {
    "name": "SweetlyHannahMade",
    "tagline": "Handmade with love, stitch by stitch",
    "announcement": "Free pattern with every plushie purchase!",
    "about": "Hi, I'm Hannah! I'm a passionate crocheter who loves bringing adorable characters to life. Every plushie and pattern is made with care and lots of love.",
    "aboutPhoto": "assets/images/hannah.jpg",
    "instagram": "https://instagram.com/sweetlyhannahmade",
    "tiktok": "https://tiktok.com/@sweetlyhannahmade",
    "beholdEmbedId": "YOUR_BEHOLD_EMBED_ID"
  },
  "testimonials": [
    { "name": "Sarah M.", "text": "The bunny plushie is absolutely adorable. The quality is amazing!", "rating": 5 },
    { "name": "Jessica L.", "text": "The pattern was so well written and easy to follow.", "rating": 5 },
    { "name": "Emily R.", "text": "Hannah is so talented. I've bought three plushies now!", "rating": 5 }
  ],
  "trustBadges": [
    { "icon": "heart", "text": "100% Handmade" },
    { "icon": "download", "text": "Instant PDF Download" },
    { "icon": "star", "text": "Made with Love" }
  ],
  "categories": [
    {
      "id": "patterns",
      "name": "Crochet Patterns",
      "description": "Downloadable PDF patterns for all skill levels",
      "coverImage": "assets/images/patterns-cover.jpg"
    },
    {
      "id": "plushies",
      "name": "Plushies",
      "description": "Handmade crochet plushies, ready to ship",
      "coverImage": "assets/images/plushies-cover.jpg"
    }
  ],
  "products": [
    {
      "id": "sample-bunny-pattern",
      "categoryId": "patterns",
      "name": "Bunny Amigurumi Pattern",
      "price": 5.00,
      "featured": true,
      "images": ["assets/images/sample-product.jpg"],
      "video": "",
      "description": "This beginner-friendly bunny pattern will guide you through creating the most adorable little bunny!\n\n**What's included:**\n- 10-page PDF pattern\n- Full photo tutorial\n- Yarn and materials list\n- Finished size: approx. 6 inches tall",
      "difficulty": "Beginner",
      "tags": ["bunny", "beginner", "PDF", "amigurumi"],
      "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
      "inStock": true
    },
    {
      "id": "sample-bear-plushie",
      "categoryId": "plushies",
      "name": "Teddy Bear Plushie",
      "price": 35.00,
      "featured": true,
      "images": ["assets/images/sample-product.jpg"],
      "video": "",
      "description": "A handmade teddy bear crocheted with soft, high-quality yarn.\n\n**Details:**\n- Premium acrylic yarn\n- Safety eyes\n- Approx. 8 inches tall\n- Ships within 3-5 business days",
      "difficulty": null,
      "tags": ["bear", "plushie", "gift", "handmade"],
      "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
      "inStock": true
    }
  ]
}
```

**Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('inventory.json','utf8')); console.log('Valid JSON')"
```
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add inventory.json
git commit -m "feat: add inventory.json with sample data"
```

---

## Task 3: Create Shared Utilities (`assets/shop.js`)

**Files:**
- Create: `assets/shop.js`
- Create: `assets/style.css`

**Step 1: Create `assets/shop.js`**

Key functions needed. Note: `escapeHtml` must be used for all text inserted into template literals. DOMPurify must be used for any generated HTML (e.g. rendered markdown).

```javascript
let _inventory = null;

async function getInventory() {
  if (_inventory) return _inventory;
  const res = await fetch('/inventory.json');
  _inventory = await res.json();
  return _inventory;
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
    .split('\n\n')
    .map(block => block.startsWith('<') ? block : '<p>' + block + '</p>')
    .join('');
}

function renderIcon(icon) {
  const icons = {
    heart: `<svg class="w-8 h-8 mx-auto mb-2 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>`,
    download: `<svg class="w-8 h-8 mx-auto mb-2 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`,
    star: `<svg class="w-8 h-8 mx-auto mb-2 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`
  };
  return icons[icon] || icons.star;
}
```

**Step 2: Create `assets/style.css`**

```css
.product-description h2 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.product-description h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
.product-description p { margin-bottom: 0.75rem; line-height: 1.6; }
.product-description ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.product-description li { margin-bottom: 0.25rem; }
.product-description strong { font-weight: 600; }
```

**Step 3: Commit**

```bash
git add assets/shop.js assets/style.css
git commit -m "feat: add shared JS utilities and styles"
```

---

## Task 4: Build Homepage (`index.html`)

**Files:**
- Create: `index.html`

**Step 1: Create `index.html`**

Use this exact head block (with Tailwind config using placeholder pinks — Hannah will update these):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SweetlyHannahMade</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50:  '#fdf2f8',
              100: '#fce7f3',
              200: '#fbcfe8',
              300: '#f9a8d4',
              400: '#f472b6',
              500: '#ec4899',
              600: '#db2777',
              700: '#be185d',
            }
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="assets/style.css">
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
</head>
```

**Body sections to build (in order):**

1. **Announcement bar** — hidden div, shown by JS if `shop.announcement` is set. Text set via `textContent` (not innerHTML).
2. **Header** — shop name + nav links to `category.html?id=patterns` and `category.html?id=plushies`. Social icons (Instagram, TikTok) built from `shop.instagram` / `shop.tiktok`.
3. **Hero** — full-width pink banner. Tagline set via `textContent`.
4. **Category tiles** — grid built with JS. Each tile: cover image + name + description. Use `escapeHtml()` for name/description in template literals.
5. **Featured products** — row of cards where `product.featured === true`. Use `escapeHtml()` for name/price in template literals.
6. **Trust badges** — 3 cards from `trustBadges`. Use `escapeHtml()` for text.
7. **About me** — photo + text. Text set via `textContent`.
8. **Testimonials** — cards from `testimonials`. Use `escapeHtml()` for name/text.
9. **Instagram feed** — heading + Behold embed. Only render embed if `beholdEmbedId` is set and not placeholder.
10. **Footer** — shop name, policy links, copyright.

**JS init pattern:**

```javascript
async function init() {
  const inv = await getInventory();
  // ... build each section
}
init();
```

For the description field on any listing, always use:
```javascript
descriptionEl.innerHTML = DOMPurify.sanitize(renderMarkdown(product.description));
```

For all other text content in template literals, always use `escapeHtml()`:
```javascript
`<h3>${escapeHtml(cat.name)}</h3><p>${escapeHtml(cat.description)}</p>`
```

**Step 2: Verify locally**

```bash
npx serve /Users/finlay/Desktop/sweetlyhannahmade
```
Open `http://localhost:3000`. Check:
- [ ] All sections render with sample data
- [ ] No console errors
- [ ] Clicking category tiles navigates to category.html

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: build homepage with all sections"
```

---

## Task 5: Build Category Page (`category.html`)

**Files:**
- Create: `category.html`

**Step 1: HTML structure**

Same head block as `index.html` (copy it exactly, including Tailwind config, DOMPurify, shop.js, Netlify Identity).

Body sections:
- Header (same as homepage)
- Breadcrumb: `Home › [Category Name]`
- Category name (h1) + description
- Product grid (2-4 columns responsive)
- Empty state message (shown if no products in category)
- Footer

**Step 2: JS logic**

```javascript
async function init() {
  const categoryId = getParam('id');
  const inv = await getInventory();
  const category = inv.categories.find(c => c.id === categoryId);

  if (!category) { /* show not found */ return; }

  document.title = escapeHtml(category.name) + ' — SweetlyHannahMade';
  // Set breadcrumb, h1, description via textContent (not innerHTML)

  const products = inv.products.filter(p => p.categoryId === categoryId);

  products.forEach(p => {
    const card = document.createElement('a');
    card.href = 'product.html?id=' + escapeHtml(p.id);
    card.className = 'group bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition-shadow';
    // Build card content — use escapeHtml() for all text, set img src from p.images[0]
    // Show "Out of Stock" badge if !p.inStock
    grid.appendChild(card);
  });
}
```

**Step 3: Verify**

Open `http://localhost:3000/category.html?id=patterns`
- [ ] Shows "Crochet Patterns" heading
- [ ] Product cards render
- [ ] Clicking a card goes to `product.html?id=sample-bunny-pattern`

**Step 4: Commit**

```bash
git add category.html
git commit -m "feat: build category page with product grid"
```

---

## Task 6: Build Product Detail Page (`product.html`)

**Files:**
- Create: `product.html`

**Step 1: HTML structure**

Same head block as the other pages.

Body sections:
- Header
- Breadcrumb: `Home › [Category] › [Product Name]`
- Two-column layout (stacks on mobile):
  - **Left:** Main image (large), thumbnail strip below it (click to swap main image), video player (hidden unless `product.video` is set)
  - **Right:** Name, price, difficulty badge (hidden unless set), tags, Buy Now button, description
- Footer

**Step 2: JS logic**

```javascript
async function init() {
  const productId = getParam('id');
  const inv = await getInventory();
  const product = inv.products.find(p => p.id === productId);

  if (!product) { /* show not found */ return; }

  // Set title, breadcrumb via textContent
  // Set name, price via textContent
  // Build thumbnail strip — add click listeners to swap main image src
  // Show video element only if product.video is set (set src attribute)
  // Show difficulty badge only if product.difficulty is set
  // Build tags — use escapeHtml() in template literals
  // Set Buy Now href to product.stripeLink
  // If !product.inStock: disable button, change text to "Currently Unavailable"
  // Render description:
  descriptionEl.innerHTML = DOMPurify.sanitize(renderMarkdown(product.description));
}
```

**Step 3: Verify**

Open `http://localhost:3000/product.html?id=sample-bunny-pattern`
- [ ] Name, price, difficulty, tags show
- [ ] Description renders with formatting
- [ ] Buy Now button present
- [ ] Thumbnail strip clickable (works once real images are added)

**Step 4: Commit**

```bash
git add product.html
git commit -m "feat: build product detail page with gallery and buy button"
```

---

## Task 7: Set Up Decap CMS

**Files:**
- Create: `admin/index.html`
- Create: `admin/config.yml`
- Create: `netlify.toml`

**Step 1: Create `admin/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — SweetlyHannahMade</title>
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
```

**Step 2: Create `admin/config.yml`**

```yaml
backend:
  name: git-gateway
  branch: main

media_folder: assets/images
public_folder: /assets/images

collections:
  - name: shop_data
    label: Shop Data
    files:
      - name: inventory
        label: Products & Categories
        file: inventory.json
        fields:
          - label: Shop Info
            name: shop
            widget: object
            fields:
              - {label: Shop Name, name: name, widget: string}
              - {label: Tagline, name: tagline, widget: string}
              - {label: Announcement Bar, name: announcement, widget: string, required: false}
              - {label: About Me, name: about, widget: text}
              - {label: My Photo, name: aboutPhoto, widget: image, required: false}
              - {label: Instagram URL, name: instagram, widget: string, required: false}
              - {label: TikTok URL, name: tiktok, widget: string, required: false}
              - {label: Behold Embed ID, name: beholdEmbedId, widget: string, required: false}
          - label: Testimonials
            name: testimonials
            widget: list
            fields:
              - {label: Customer Name, name: name, widget: string}
              - {label: Review Text, name: text, widget: text}
              - {label: Rating (1-5), name: rating, widget: number, min: 1, max: 5, default: 5}
          - label: Trust Badges
            name: trustBadges
            widget: list
            fields:
              - {label: Icon, name: icon, widget: select, options: [heart, download, star]}
              - {label: Text, name: text, widget: string}
          - label: Categories
            name: categories
            widget: list
            fields:
              - {label: "ID (no spaces, e.g. patterns)", name: id, widget: string}
              - {label: Display Name, name: name, widget: string}
              - {label: Description, name: description, widget: string}
              - {label: Cover Photo, name: coverImage, widget: image, required: false}
          - label: Products
            name: products
            widget: list
            fields:
              - {label: "ID (no spaces, e.g. bunny-pattern)", name: id, widget: string}
              - {label: Category ID, name: categoryId, widget: string}
              - {label: Product Name, name: name, widget: string}
              - {label: "Price ($)", name: price, widget: number, valueType: float}
              - {label: Feature on Homepage, name: featured, widget: boolean, default: false}
              - label: Photos
                name: images
                widget: list
                field: {label: Photo, name: image, widget: image}
              - {label: Video (optional), name: video, widget: string, required: false}
              - {label: Description, name: description, widget: markdown}
              - label: Difficulty (patterns only)
                name: difficulty
                widget: select
                options: [Beginner, Intermediate, Advanced]
                required: false
              - label: Tags
                name: tags
                widget: list
                field: {label: Tag, name: tag, widget: string}
                required: false
              - {label: Stripe Payment Link, name: stripeLink, widget: string}
              - {label: In Stock, name: inStock, widget: boolean, default: true}
```

**Step 3: Create `netlify.toml`**

```toml
[build]
  publish = "."

[[headers]]
  for = "/admin/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-XSS-Protection = "1; mode=block"
```

**Step 4: Add Netlify Identity redirect script**

Add to the bottom of `<body>` in `index.html`, `category.html`, and `product.html`:

```html
<script>
  if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', user => {
      if (!user) {
        window.netlifyIdentity.on('login', () => {
          document.location.href = '/admin/';
        });
      }
    });
  }
</script>
```

**Step 5: Commit**

```bash
git add admin/ netlify.toml index.html category.html product.html
git commit -m "feat: add Decap CMS admin and Netlify config"
git push origin main
```

---

## Task 8: Deploy to Netlify

> This task is done in the browser, not in the terminal.

**Step 1: Connect repo to Netlify**

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. Choose **GitHub** → authorize → select `sweetlyhannahmade`
3. Build settings: leave build command blank, publish directory is `.`
4. Click **Deploy site**

**Step 2: Enable Netlify Identity**

1. **Site settings → Identity → Enable Identity**
2. Under **Registration** → set to **Invite only**
3. Under **Services → Git Gateway → Enable Git Gateway**

**Step 3: Invite yourself as admin**

1. **Identity tab → Invite users** → enter your email
2. Check email → accept invite → set a password

**Step 4: Test CMS**

1. Go to `https://your-site.netlify.app/admin`
2. Log in
3. Click **Products & Categories** → add a test product → save
4. Wait ~30 seconds → verify it appears on the live site

---

## Task 9: Connect Instagram Feed (Behold.so)

**Step 1: Sign up and get embed ID**

1. Go to [behold.so](https://behold.so) → sign up (free)
2. Connect your Instagram account
3. Create a new feed → copy the **Embed ID**

**Step 2: Add embed ID via CMS**

1. Go to `/admin` → Products & Categories
2. Under **Shop Info → Behold Embed ID** → paste the ID
3. Save → wait for deploy

**Step 3: Verify**

Homepage Instagram section should show your latest posts automatically.

---

## Task 10: Update Brand Colors

When Hannah provides exact hex values, update the Tailwind `brand` color config in all three HTML files (`index.html`, `category.html`, `product.html`). The config block looks like:

```javascript
colors: {
  brand: {
    50:  '#fdf2f8',  // lightest — page backgrounds
    100: '#fce7f3',  // light — section backgrounds
    200: '#fbcfe8',  // borders, light accents
    300: '#f9a8d4',  // medium light
    400: '#f472b6',  // medium
    500: '#ec4899',  // primary brand color (buttons, headings)
    600: '#db2777',  // hover states
    700: '#be185d',  // dark accents, footer
  }
}
```

Replace all 7 hex values with Hannah's shades. Commit:

```bash
git add index.html category.html product.html
git commit -m "chore: update brand colors to Hannah's palette"
```

> Note: All Tailwind classes in the HTML use `brand-X` (e.g. `bg-brand-500`, `text-brand-700`). If you used `pink-X` during building, do a find-and-replace of `pink-` to `brand-` before applying Hannah's colors.
