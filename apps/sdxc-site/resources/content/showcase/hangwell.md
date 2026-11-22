---
title: Hangwell
headline: A poster shop whose configurator, checkout and returns all work as server-rendered forms
summary: An invented poster shop selling each print as a file, a print or a framed print, with faceted collections, a configurator page, a checkout that adapts to what ships, and returns.
cover: shop
shots:
  - id: shop
    page: "shop?color=ochre&color=teal&sort=price-asc"
    alt: Hangwell's shop filtered to ochre and teal posters sorted by price, with facet filters beside a grid of drawn poster cards.
  - id: facets
    page: "shop?color=ochre&color=teal&sort=price-asc"
    highlight: "[data-slot='facet-filters']"
    alt: The facet filters for style, colour and price, with ochre and teal checked and a count beside every value.
  - id: room
    page: "p/port-anselm?format=framed&size=70x100&frame=walnut&mount=1&image=room"
    highlight: "[data-slot='product-gallery']"
    alt: The product gallery showing Port Anselm framed in walnut with a mount, hanging to scale above a sofa in a drawn room.
  - id: variants
    page: "p/port-anselm?format=framed&size=70x100&frame=walnut&mount=1&image=room"
    highlight: "[data-slot='variant-picker']"
    alt: The variant picker with Framed, Print and Print file formats, sizes, frame swatches and mount, the 70 by 100 walnut size struck through as sold out.
  - id: reviews
    page: "p/fern-study?stars=4&review_sort=helpful"
    highlight: "[data-slot='rating-breakdown']"
    alt: The rating breakdown for Fern Study, with the average score and a bar per star count.
  - id: tracking
    page: "track?order=HW-40312&email=maya@example.com"
    highlight: "[data-slot='order-steps']"
    alt: Guest order tracking for order HW-40312, with the parcel's steps from ordered to delivered.
  - id: refund
    page: "account/orders/0190a1b2-0000-7000-8000-000000000101/return"
    highlight: "[data-slot='price-breakdown']"
    alt: A return's refund summary, noting that each line is refunded less its share of the WELCOME10 discount and that shipping is not refunded.
  - id: phone-shop
    page: "shop"
    viewport: phone
    alt: Hangwell's shop on a phone, with a filters button and a two-column grid of poster cards.
---

Hangwell is an invented poster studio's online shop. Eight made-up artists' posters are sold
three ways from one product page: a print-ready file, a print rolled in a tube, or a print
framed by hand. Every poster is drawn in SVG from its style, inks and a seed, so the card, the
gallery, the room preview, the zoomed detail and the downloadable print file are the same
drawing, and none copies a real artist. Nothing is charged, and checkout never shows a card
field.

The demo sets out to be a complete store done on the server: collections with honest facet
counts, a product configurator, a bag and drawer, a checkout whose steps follow what ships,
orders with downloads and tracking, guest tracking, returns and an account. Every screen renders
on the server and works with script turned off. With script, screens swap in the main frame, a
variant pick swaps only the buy box, and a review filter swaps only the reviews.

## The brief

A store has to answer a shopper's questions before they ask them. How many posters match these
filters, and how many would match if I added one more? What does this size look like on a wall?
What does the framed version cost, is it in stock, when does it arrive? Why did my promo code
fail? Does a digital file need an address? And after the sale: where is my parcel, and what do I
get back if I return one item from a discounted order?

Hangwell takes on each of these. One product sold three ways makes the hard part concrete: the
variant picker changes how the order is fulfilled, so the price, the delivery estimate, the
checkout steps and the refund all follow from it.

## Facets whose counts are honest

A collection page filters by style, colour, artist, orientation, price, sale and stock. The
filters are a GET form, so a filtered page is a link and works without script; with script, a
change submits itself and swaps the main frame. The facets are declared once with
[@sdxc/facets](/api/facets) in `catalog.ts`, which reads them from the address and writes them
back:

```ts
export const POSTER_FACETS = createFacets<Poster>()
	.terms("style", (poster) => poster.style, { values: STYLES.map((style) => style.id) })
	.terms("color", (poster) => poster.paints, { values: PAINTS.map((paint) => paint.id) })
	.terms("artist", (poster) => poster.artist, { values: ARTISTS.map((artist) => artist.id) })
	.terms("orientation", (poster) => poster.orientation, { values: ["portrait", "landscape"] })
	.range("price", (poster) => fromPrice(poster) / 100, { buckets: [0, 20, 25, 30] })
	.toggle("sale", (poster) => poster.sale !== undefined)
	.toggle("framed", inStock, { param: "ready" });
```

Each count accounts for the other filters applied, so a number beside "Sage" is what you get by
adding it. [FacetFilters](/api/ui/facet-filters) draws the groups with colour swatches, price
buckets and the applied chips that clear one at a time, and a [SortSelect](/api/ui/sort-select)
and "Show more" sit in the address too. On a phone the same filters open in a
[Drawer](/api/ui/drawer).

![The facet filters for style, colour and price, with ochre and teal checked and counts beside each value](/showcase/hangwell/facets.webp "Every count already accounts for the other filters, so it is the number you get by adding that value.")

Search offers suggestions as you type through an [Autocomplete](/api/ui/autocomplete), and a
typo gets a "did you mean" on the results page.

## A configurator that swaps one frame

A product page's buy box is a [VariantPicker](/api/ui/variant-picker) with four axes: format,
size, frame and mount. Every option is a link to that variant, swapped into a frame named `buy`,
so the page keeps its scroll while [Price](/api/ui/price), stock and the delivery date follow the
pick, and the address always names the exact variant. A sold-out combination is struck through
and offers to email the shopper when it is framed again.

![The variant picker with format, size, frame and mount, one size struck through as sold out](/showcase/hangwell/variants.webp "Each choice is a link to that variant, and the buy box swaps alone so the page stays where it was.")

The gallery is a [ProductGallery](/api/ui/product-gallery) with thumbnails and zoom that opens a
full-screen [Lightbox](/api/ui/lightbox). One of its images is the room view: the chosen poster
in the chosen frame, hung above a sofa in a scene drawn one viewBox unit per centimetre, so a
70 × 100 print reads at its real scale against the furniture. The frames and sizes guide hangs
every size on the same wall.

![The gallery's room view, Port Anselm framed in walnut with a mount above a sofa](/showcase/hangwell/room.webp "The room is drawn one unit per centimetre, so the chosen size hangs at its real scale.")

## Reviews and questions in their own frame

Reviews sit under a [RatingBreakdown](/api/ui/rating-breakdown) that counts them by stars, with
a "would recommend" share. Star links and the sort reload only the reviews frame, so filtering
to four-star reviews leaves the rest of the page alone, and each [ReviewCard](/api/ui/review-card)
marks verified buyers and has a Helpful button. Questions are a
[QuestionList](/api/ui/question-list) with answers from the studio and from buyers, and an Ask
form.

![The rating breakdown for Fern Study, with the average and a bar per star count](/showcase/hangwell/reviews.webp "The breakdown counts reviews by stars, and the star links below it filter only the reviews frame.")

Shelves for the same artist, the same style and recently viewed close the page. The recently
viewed shelf is filled by a small island that writes the poster to a cookie once script runs.

## A checkout that follows the bag

The bag is a page and a [CartDrawer](/api/ui/cart-drawer) with a free-shipping
[Meter](/api/ui/meter). Lines have steppers and "save for later", a
[PromoCode](/api/ui/promo-code) field explains why a code fails, and a
[ShippingEstimate](/api/ui/shipping-estimate) prices delivery by postcode. A tampered bag cookie
only loses lines, which the tests check.

Checkout's [StepIndicator](/api/ui/step-indicator) follows what ships. A bag of print files skips
the address and shipping steps; framed prints carry their longer delivery. Payment offers demo
methods only, and every step is a form post that keeps what was typed on an error. Prices,
discounts and refunds are computed with [@sdxc/money](/api/money), and a promo's discount is
split across the lines it applies to with `allocate`, so each line knows its exact share.

## After the sale

An order's page offers print files to download beside the parcel's tracking in
[OrderSteps](/api/ui/order-tracker). Guests track an order by its number and email, with the
same steps.

![Guest order tracking for HW-40312, with the parcel's steps from order placed to delivered](/showcase/hangwell/tracking.webp "Guest tracking needs only the order number and email, and shows each step with where it happened.")

A return picks the lines, a reason and how the parcel goes back. Its refund preview shows each
line's price less its exact share of the order's discount, read from the same allocation
checkout used. "Update refund" is a GET to the same page, so the preview works without script,
and "Start return" posts and shows a QR code label from [@sdxc/qr](/api/qr) to show at a parcel
point.

![A return's refund summary, noting each line is refunded less its share of the discount](/showcase/hangwell/refund.webp "A refund returns each line's exact share of the discount, and the preview updates as a plain GET.")

The account holds the orders, a library of owned print files, addresses to add, edit, make
default or delete, and a wishlist, all in the shopper's own cookies. The header's shop menu is a
native popover mega menu on wide screens and a drawer on phones.

![Hangwell's shop on a phone, with a filters button and a grid of poster cards](/showcase/hangwell/phone-shop.webp "On a phone the filters move into a drawer behind one button, and the grid keeps two columns.")

## Takes after

- [Desenio](https://desenio.com) — posters sold by size and frame, with a room preview to judge
  scale; Hangwell draws its room to the centimetre.
- [Apple Store](https://www.apple.com/store) — one configurator page where each choice updates
  the price and the picture in place.
- [Shopify](https://www.shopify.com) shops — a calm collection grid, a bag drawer with a
  free-shipping meter and a short stepped checkout.
- [Amazon](https://www.amazon.com) — facet counts, a delivery date on the product page, questions
  answered on the listing and guest order tracking.

## Where to start reading

- [`catalog.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/hangwell/catalog.ts)
  — every list as a pure function of the address.
- [`product.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/hangwell/product.tsx)
  — variant pickers as links into the `buy` frame, and reviews in their own frame.
- [`hangwell.test.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/hangwell/hangwell.test.tsx)
  — what a shopper relies on, from pricing to refunds.
