# SweetlyHannahMade — Website Design

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

A static Shopify-style storefront for SweetlyHannahMade selling handmade crochet plushies and downloadable crochet patterns. Built with plain HTML + TailwindCSS, driven by a single `inventory.json`, managed via Decap CMS admin panel, hosted free on Netlify.

---

## Architecture

**Approach:** Multi-page static HTML
**Styling:** TailwindCSS (CDN)
**Data:** Single `inventory.json` file
**CMS:** Decap CMS (admin UI at `/admin`, saves to GitHub via Git Gateway)
**Payments:** Stripe payment links (embedded per product)
**Hosting:** Netlify free tier + GitHub repo
**Images:** Stored in repo under `assets/images/`

---

## File Structure

```
sweetlyhannahmade/
├── index.html           # Homepage
├── category.html        # Reusable category page (?id=patterns)
├── product.html         # Reusable product detail page (?id=bunny-pattern)
├── inventory.json       # All shop data
├── admin/
│   ├── index.html       # Decap CMS admin UI
│   └── config.yml       # CMS field definitions
├── assets/
│   └── images/          # Product photos & videos
└── docs/
    └── plans/
        └── this file
```

---

## Data Structure (`inventory.json`)

```json
{
  "shop": {
    "name": "SweetlyHannahMade",
    "tagline": "Handmade with love",
    "announcement": "Free pattern with every plushie purchase!",
    "about": "Hi, I'm Hannah...",
    "aboutPhoto": "assets/images/hannah.jpg",
    "instagram": "https://instagram.com/sweetlyhannahmade",
    "tiktok": "https://tiktok.com/@sweetlyhannahmade",
    "beholdEmbedId": "xxxx"
  },
  "featuredProducts": ["bunny-pattern", "bear-plushie"],
  "testimonials": [
    { "name": "Jane D.", "text": "So cute and fast shipping!", "rating": 5 }
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
      "description": "Downloadable PDF patterns",
      "coverImage": "assets/images/patterns-cover.jpg"
    },
    {
      "id": "plushies",
      "name": "Plushies",
      "description": "Handmade crochet plushies",
      "coverImage": "assets/images/plushies-cover.jpg"
    }
  ],
  "products": [
    {
      "id": "bunny-pattern",
      "categoryId": "patterns",
      "name": "Bunny Amigurumi Pattern",
      "price": 5.00,
      "images": ["assets/images/bunny-1.jpg", "assets/images/bunny-2.jpg"],
      "video": "assets/videos/bunny-preview.mp4",
      "description": "A beginner-friendly bunny pattern...",
      "difficulty": "Beginner",
      "tags": ["bunny", "beginner", "PDF"],
      "stripeLink": "https://buy.stripe.com/xxx",
      "inStock": true
    }
  ]
}
```

---

## Pages

### Homepage (`index.html`)

Sections in order:
1. **Announcement bar** — editable promo text from `shop.announcement`
2. **Header** — shop name, nav links (Home, Patterns, Plushies), social icons
3. **Hero banner** — large image with shop name and tagline overlay
4. **Category tiles** — grid of category cards (photo + name), links to `category.html?id=`
5. **Featured listings** — row of hand-picked products from `featuredProducts` array
6. **Trust badges** — 3 cards from `trustBadges` array
7. **About me** — photo + text from `shop.about`, "Learn More" anchor
8. **Customer testimonials** — cards from `testimonials` array
9. **Instagram feed** — "Follow Along on Instagram" + Behold.so embed
10. **Footer** — newsletter signup, social links, shop policies

### Category Page (`category.html?id=patterns`)

- Page title and description from matching category in JSON
- Product grid: first image, name, price per product
- Out-of-stock products shown with a greyed badge
- Click → `product.html?id=`

### Product Detail Page (`product.html?id=bunny-pattern`)

- Breadcrumb: Home → [Category] → [Product Name]
- Main photo + thumbnail strip for additional images
- Optional video player
- Product name, price, difficulty badge, tags
- Full description (rich text rendered from CMS markdown)
- Prominent "Buy Now" button → Stripe payment link (new tab)
- Out-of-stock state: button disabled, "Currently Unavailable" label

---

## CMS (Decap CMS)

- Admin UI at `/admin` — login via Netlify Identity (email/password)
- Editable fields: all product fields, categories, shop info, testimonials, trust badges, announcement bar, featured products
- Image uploads go directly to `assets/images/` in the GitHub repo
- On save: Decap CMS commits to GitHub → Netlify auto-deploys (~30 seconds)

---

## Hosting & Deployment

1. GitHub repo (free) — source of truth
2. Netlify free tier — auto-deploys on every commit
3. Custom domain — pointed to Netlify (free SSL included)
4. Netlify Identity — enables CMS login (free up to 1,000 users)

---

## Design Aesthetic

- **Name:** SweetlyHannahMade
- **Vibe:** Simple, cute, cozy — not cluttered
- **Colors:** Shades of pink (exact hex values to be provided by Hannah)
- **Typography:** Clean, soft — rounded or friendly font
- **Reference sites (content/structure only):** crochetbygenna.com, hooksandheelers.com

---

## Out of Scope

- Cart / multi-item checkout (Stripe payment links handle individual purchases)
- User accounts / order history
- Blog
- Search functionality
- Subcategories
