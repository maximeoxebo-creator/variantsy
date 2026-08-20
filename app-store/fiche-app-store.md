# Variantsy — fiche App Store

Longueurs vérifiées à la génération. Orthographe américaine.

Révisée le 20 août 2026, après deux changements que l'ancienne fiche ne
reflétait plus : les pastilles sur les pages de collection ont été retirées —
l'app ne touche plus qu'aux pages produit — et les produits liés sont apparus,
qui n'y figuraient nulle part.

## App name  (27/30)

Variantsy ‑ Images & Titles

## Introduction  (94/100)

A variant holds one photo. Variantsy gives every color a whole gallery — and a title to match.

## App details  (497/500)

A variant can carry only one image. Variantsy gives every color a gallery of its own: assign the photos once, and shoppers switch the whole set in one click. The title switches too, rebuilt from the fields you choose.

Selling each color as its own product page instead? Group those pages and every one of them shows the full range, while each keeps its address, SKU and stock.

Everything is set from one screen with a live preview. No theme code to paste, and uninstalling leaves nothing behind.

## Feature 1  (69/80)

Give each color its own set of photos, switched instantly when picked

## Feature 2  (65/80)

Switch the whole gallery to the chosen color, with no page reload

## Feature 3  (64/80)

Switch the product title too, rebuilt from the fields you choose

## Feature 4  (64/80)

Link a separate product page per color, with one shared selector

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

## Search term 5  (17/20)

combined listings

## Title tag  (54/60)

Variantsy — Variant Images, Swatches & Linked Products

## Meta description  (141/160)

Give every product color its own photo gallery, swatches and title. Or link one product page per color. Works on any theme, no code required.

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

Correspond au réglage « When a color is sold out → Removed ». Écartés :
SKU management (afficher un SKU dans le titre n'est pas le gérer), In-stock
display et Stock availability (évoquent des badges ou des quantités, absents),
Auto-updates, Manual updates, Low stock alerts.

## Sales channel

Shopify Online Store — obligatoire avec une extension de thème.

## Languages

English. L'admin, les textes du bloc de thème et la notice sont en anglais ;
ce champ demande les langues dans lesquelles l'app est ENTIÈREMENT disponible.

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

Planche 03 : produits liés. Elle a remplacé l'ancienne planche « catalog
pages », devenue mensongère.

## À fournir par Maxime

- App icon 1200×1200 — icones/variantsy-icon-W1.png, à téléverser au Partner Dashboard
- Demo store URL — la boutique est encore protégée par mot de passe
- Screencast URL — vidéo de 3 à 8 minutes, obligatoire
- UN GROUPE DE PRODUITS LIÉS configuré sur la boutique de démonstration :
  l'étape 3 des instructions de test demande à l'examinateur de l'ouvrir. Sans
  lui, la fonctionnalité mise en avant par la planche 03 et la feature 4 n'est
  pas vérifiable.

## Testing instructions  (2698/2800)

Variantsy adds color swatches to product pages, gives each color its own set of photos, and rewrites the product title as the shopper chooses. It also links separate product pages that are the same item in another color.

STORE ACCESS
- Demo store: simple-popup-test.myshopify.com
- Storefront password: see the Test account section.
- No app account or separate login is required.

WHAT IS ALREADY SET UP
- The Variantsy app block is enabled on the product template of the published theme (Savor).
- Two colors are configured on the demo products: Blue and Beige.

1. PRODUCT PAGE - SWATCHES AND GALLERY
- Open any product in the ALMA range.
- Under the price you will see the color swatches. The theme's own selector is hidden, never removed: Variantsy drives it in the background, so the cart always receives the correct variant.
- Click Beige. The main image and the thumbnails switch to the photos assigned to Beige, with no page reload.
- Click Blue again to switch back.

2. PRODUCT PAGE - DYNAMIC TITLE
- While switching colors, watch the product title above the price. It is rebuilt to include the selected color.
- The template is set in the app, on the Title tab. Fields left empty are dropped, so no dangling separators appear.

3. LINKED PRODUCTS
- Some catalogs sell one color per product page rather than as variants. Variantsy groups those pages so each one shows the whole range.
- In the app, choose "Linked products" at the top of the page, then open the Groups tab to see the configured group.
- On the storefront, open one of the grouped products. The swatch row leads to the other pages; each keeps its own URL, SKU and stock.
- A product that still carries a color option is ignored on purpose, so the same color never appears twice. The app warns about it in the editor.

4. ADMIN - SETTINGS
- Open the app from the store admin.
- At the top, two cards select which model your catalog uses: Product variants or Linked products. The tabs below follow that choice.
- On the Appearance tab, change the swatch shape or size. The preview above the settings updates as you drag. Save, then reload a product page to see the change on the storefront.
- The Installation tab holds the one-time setup: enabling the app block in the theme editor.

5. BILLING
- The app checks for an active subscription on every load of the admin, not only the first. Without an active plan the merchant is redirected to the pricing page.
- The demo store has an active Pro subscription so that the admin can be reviewed.

NOTES
- Variantsy adds nothing to collection or catalog pages; it works on product pages only.
- Uninstalling removes the storefront code entirely; no theme file is ever modified.
