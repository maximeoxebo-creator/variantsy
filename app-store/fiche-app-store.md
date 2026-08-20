# Variantsy — fiche App Store

Longueurs vérifiées à la génération. Orthographe américaine.

## App name  (27/30)

Variantsy ‑ Images & Titles

## Introduction  (94/100)

Give every color its own gallery. One click switches the photos, the title and the whole page.

## App details  (498/500)

A variant can carry only one image. Variantsy gives every color a gallery of its own: assign the photos once, and shoppers switch the whole set with a single click. The title switches too, rebuilt from the fields you choose.

Color swatches replace the default selector on product pages, and appear on catalog pages, where shoppers can switch the image without leaving the grid.

Everything is set from one screen with a live preview. No theme code to paste, and uninstalling leaves nothing behind.

## Feature 1  (69/80)

Give each color its own set of photos, switched instantly when picked

## Feature 2  (65/80)

Switch the whole gallery to the chosen color, with no page reload

## Feature 3  (64/80)

Switch the product title too, rebuilt from the fields you choose

## Feature 4  (66/80)

Let shoppers switch the image from catalog pages, before the click

## Feature 5  (63/80)

Choose swatches, text buttons or a dropdown to match your theme

## App card subtitle  (58/62)

One click switches the photos, the title and every swatch.

## Pricing display name  (3/18)

Pro

## Search term 1  (14/20)

color swatches

## Search term 2  (14/20)

variant images

## Search term 3  (13/20)

variant title

## Search term 4  (15/20)

variant gallery

## Search term 5  (16/20)

variant swatches

## Title tag  (52/60)

Variantsy — Variant Color Swatches & Image Galleries

## Meta description  (140/160)

Give every product color its own photo gallery, swatches and title. One click switches the whole page. Works on any theme, no code required.

## Category

Selling products › Custom products › Product variants

### Customization tags
Swatches · Variants display · Dropdowns · Radio buttons

Écartés à dessein : Custom CSS (le champ existe en base mais n'est pas exposé
dans l'admin — le tag serait faux tant qu'un marchand ne peut pas s'en servir),
Preview (désigne un aperçu montré à l'acheteur, pas à l'admin), Conditional
logic (désigne des options qui en révèlent d'autres).

### Pricing tags
Not applicable for this app

### Inventory tags
Hide out-of-stock

Correspond au réglage « Quand un coloris est en rupture → Retiré ». Écartés :
SKU management (afficher un SKU dans le titre n'est pas le gérer), In-stock
display et Stock availability (évoquent des badges ou des quantités, absents),
Auto-updates, Manual updates, Low stock alerts.

## Sales channel

Shopify Online Store — obligatoire avec une extension de thème.

## Languages

English. L'interface d'administration a été traduite le 19 août 2026 ; ce champ
demande les langues dans lesquelles l'app est ENTIÈREMENT disponible, et c'est
désormais l'anglais.

## Privacy policy URL

https://variantsy.vercel.app/privacy

## Support email · Merchant review email · App submission email

contact.zeppelin.studio@gmail.com

## Test account

Cocher « My app doesn't require an account to use it ».
Le mot de passe de la boutique de démonstration figure dans les instructions
de test.

## Feature media + Screenshots

Feature media : variantsy-01.png
Screenshots 1 à 5 : variantsy-02 à variantsy-06.png
Textes alternatifs : voir alt-text.md

## À fournir par Maxime

- App icon 1200×1200 — icones/variantsy-icon-W1.png, à téléverser au Partner Dashboard
- Demo store URL — la boutique est encore protégée par mot de passe
- Screencast URL — vidéo de 3 à 8 minutes, obligatoire

## Testing instructions  (2364/2800)

Variantsy adds color swatches to product and catalog pages, gives each color its own set of photos, and rewrites the product title as the shopper chooses.

STORE ACCESS
- Demo store: simple-popup-test.myshopify.com
- Storefront password: (see Test account section)
- No app account or separate login is required.

WHAT IS ALREADY SET UP
- The product page block and the catalog app embed are both enabled on the published theme (Savor).
- Two colors are configured on the demo products: Blue and Beige.

1. PRODUCT PAGE — SWATCHES AND GALLERY
- Open any product in the ALMA range from the catalog.
- Under the price you will see the color swatches. The theme's own selector is hidden; Variantsy drives it in the background, so the cart always receives the correct variant.
- Click Beige. The main image and the thumbnails switch to the photos assigned to Beige, without a page reload.
- Click Blue again to switch back.

2. PRODUCT PAGE — DYNAMIC TITLE
- While switching colors, watch the product title above the price. It is rebuilt to include the selected color.
- The template is set in the app under Settings, tab "Titre". Fields left empty are dropped, so no dangling separators appear.

3. CATALOG PAGE — SWATCHES ON THE PHOTO
- Open the "All products" catalog page.
- Each card shows its available colors on the product photo.
- Click a swatch. The card's image switches to that color and the card's link now points to that exact variant.
- Click through: the product page opens on the color you picked.

4. ADMIN — SETTINGS
- Open the app from the store admin.
- All settings live on one page with four tabs: Installation, Apparence, Titre, Produits liés.
- On the "Apparence" tab, change the swatch shape or size. The preview on the right updates as you drag. Save, then reload a product page to see the change on the storefront.
- The same tab carries a switch to turn catalog swatches off without touching the product page.

5. BILLING
- The app checks for an active subscription on every load of the admin, not only the first. Without an active plan the merchant is redirected to the pricing page.
- The demo store has an active Pro subscription so that the admin can be reviewed.

NOTES
- Uninstalling removes the storefront code entirely; no theme file is ever modified.

