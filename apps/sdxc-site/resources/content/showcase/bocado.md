---
title: Bocado
headline: A food delivery app whose dish dialogs, cart, checkout and courier tracking all run on plain forms
summary: An invented food delivery app in Buenos Aires, with menus whose dishes ask for their picks, a cart in a cookie, checkout and live courier tracking on a real street map.
cover: home
shots:
  - id: home
    page: ""
    alt: Bocado's home screen, with the delivery address, cuisine chips, an Order again card and shelves of restaurant cards.
  - id: address
    page: ""
    click: "button[popovertarget='bocado-address']"
    highlight: "#bocado-address"
    alt: The delivery address popover open under the top bar, listing saved addresses.
  - id: section-bar
    page: "r/tres-empanadas"
    highlight: "[data-slot='section-bar']"
    alt: The sticky bar of menu categories on the Tres Empanadas restaurant page.
  - id: dish-dialog
    page: "r/tres-empanadas"
    click: "[data-slot='menu-item-card']"
    highlight: "dialog[open]"
    alt: A dish's options dialog with required and optional picks, each with its price, and an add button showing the total.
  - id: filters
    page: "search?free=1&sort=fastest"
    highlight: "[aria-label='Filters']"
    alt: Search filter chips for free delivery, under 30 minutes, rating, price and open now, with free delivery turned on.
  - id: tracking
    page: "orders/0190f2a1-6c3e-7b10-9c52-3a8e4f6d2b01"
    highlight: "#bocado-delivery-map"
    wait: 3000
    alt: A street map of Palermo with the courier's route from the restaurant to the delivery address.
  - id: order-steps
    page: "orders/0190f2a1-6c3e-7b10-9c52-3a8e4f6d2b01"
    highlight: "[data-slot='order-steps']"
    alt: The order's status timeline from Order placed to Delivered.
  - id: phone-restaurant
    page: "r/tres-empanadas"
    viewport: phone
    alt: A restaurant page on a phone, with the category bar under the hero and a bottom tab bar.
---

Bocado is an invented food delivery app. It delivers around Palermo and Villa Crespo in Buenos
Aires from twelve made-up kitchens, each named after a small Argentine joke and drawn with flat
food art: Tres Empanadas, Vacío Existencial, Pizza con Champán, Ñoqui del 29. Every
restaurant, dish, courier and saved card is invented, and nothing is ever charged.

The demo sets out to show that the whole ordering loop of a delivery app, from picking a dish
with its options to watching a courier ride to your door, works as server-rendered pages and
plain form posts. Every screen renders on the server and keeps working with script turned off.
Once script loads, links and posts swap only the main frame, a few islands reprice and animate,
and the tracking page follows a live stream.

What makes it worth a developer's time is how little of that depends on the client: the cart
is a cookie, a dish's options are a form, checkout is a form, and the courier's progress is a
clock the server and the stream both read.

## The brief

A delivery app has to get a handful of things right. The address decides what is on offer, so
it has to be one tap away on every screen. Dishes carry required and optional choices that
change the price, and an order can come from only one kitchen. Checkout has to show the real
total as the tip and delivery speed change. And after the order, the visitor wants to see where
their food is, on a map that follows real streets.

Bocado takes on all of these. It also takes on the parts a demo usually skips: an empty search
that explains itself, a cart that refuses to mix restaurants without asking first, order
history with Reorder, and a phone layout whose destinations move into a bottom tab bar.

## An address and a cart that follow the visitor

The top bar holds the delivery address. It is a native popover, opened through `popovertarget`
with no script, listing the saved addresses with their delivery notes; picking one is a form
post that returns to the page it came from. A pattern of allowed return pages keeps that post
from sending the visitor anywhere else.

![The delivery address popover open under the top bar, listing saved addresses](/showcase/bocado/address.webp "Each saved address is a form post, so switching where food goes needs no script.")

What the visitor chooses lives in their own cookies under the demo's path: the address, the
cart with its restaurant and lines, and the placed orders. The server reads them to draw every
screen, so the cart survives a reload and appears in three places at once: a popover in the top
bar, a floating View cart bar on phones, and the cart page itself, where each
[QuantityStepper](/api/ui/quantity-stepper) button is a post and each line is a
[CartLine](/api/ui/cart-line). A line read back from the cookie is checked with `validLine`,
which accepts only a dish the restaurant serves with exactly one pick per required group, so a
hand-edited cookie cannot order something the menu does not offer.

## Dishes that ask for their picks

A restaurant page opens with its hero and facts, then pins its categories in a
[SectionBar](/api/ui/section-bar). The bar marks the section in view as the menu scrolls and
jumps to any other; each chip carries its dish count. A dish found in search links to its
restaurant at `#dish-<id>`, so it opens scrolled to that dish.

![The sticky bar of menu categories on the Tres Empanadas restaurant page](/showcase/bocado/section-bar.webp "The category bar sticks under the hero and marks the section being read.")

Each [MenuItemCard](/api/ui/menu-item-card) opens a native dialog built from
[ItemOptionsDialog](/api/ui/item-options-dialog). Its [OptionGroup](/api/ui/option-group)
rows are radios for a required choice and checkboxes for an optional one, each with its price,
and an optional group stops at its limit. The add button shows the running total and reprices
as picks change. The whole dialog is one form posting to `cart/add`, each group as a `g.<group>`
field.

![A dish's options dialog with required and optional picks, each with its price](/showcase/bocado/dish-dialog.webp "Required groups say so, extras show their price, and the button carries the total.")

The one-kitchen rule is decided while the dialog renders. When the cart already holds another
restaurant's food, the dialog names it above the button, the button reads "Start a new cart",
and the post carries `replace` so the server swaps the cart:

```tsx
submitLabel={iife(() => {
	if (closed) return `Opens at ${restaurant.opensAt}`;
	if (other !== undefined) {
		return "Start a new cart";
	}
	return (
		<>
			Add <span data-options-qty="">1</span> to cart
		</>
	);
```

A missing required pick comes back with a toast naming the problem, and a kitchen that has not
opened yet disables the button with its opening time.

## Search with every filter in the address

Search is a GET form. The cuisine chips, the filter toggles for free delivery, under 30
minutes, rating, price and open now, and the sort menu all write the query string, so
`search?free=1&sort=fastest` is a link to send and a reload keeps the result. The sort menu is
another native popover. Results list matching dishes first, then the restaurants.

![Search filter chips with free delivery turned on and the fastest sort](/showcase/bocado/filters.webp "Every chip is a field of one GET form, and Clear filter is a plain link.")

Each kind of empty result says why it came back empty. A query with no match reads "Nothing
called … delivers here" and offers Clear search; filters that ruled out every kitchen say how
many filters are narrowing the list and offer Clear filters.

## Checkout priced with money math

Checkout is one form: the address, standard or priority delivery, one of four invented saved
payment methods and a tip, each a set of radios. A small island, `checkout-live.tsx`, reprices
the summary rows and the Place order button as the visitor changes the tip or the speed.
Without script the summary shows the defaults, and the server prices exactly what the form
posts. Subtotals, the service fee and tips are computed with
[@sdxc/money](/api/money)'s `percentOf` and written with `formatAmount`, on both sides, so the
island and the server never disagree by a cent.

Placing the order writes it into the orders cookie and redirects to its tracking page, with a
toast saying the restaurant has it.

## Live tracking on real streets

The tracking page draws a [GeoMap](/api/ui/map) on the server with the route, the restaurant
and home pins, and the courier, so the first paint already shows where the food is. Once its
island loads, the map pans and zooms over OpenFreeMap tiles, which the app's content security
policy allows. Each courier rides a route traced once along streets a car may take, so the
line turns where the streets turn and never cuts through a block.

![A street map of Palermo with the courier's route from the restaurant to the delivery address](/showcase/bocado/tracking.webp "The route follows Palermo's streets, with the courier riding along it to the home pin.")

```tsx
<GeoMap.Route path={path} progress={courier}>
	<GeoMap.RouteMarker>
		<CourierGlyph />
	</GeoMap.RouteMarker>
</GeoMap.Route>
```

Progress comes from one clock in `tracking.ts`. Every step from "Order placed" to "Delivered"
falls at a fixed time after the order, compressed so the visitor watches the whole delivery in
three minutes while the minutes left read like a real delivery. The page renders from that
clock, and the demo's stream route answers one line a second from the same clock until the
order is delivered, moving the courier and the [OrderSteps](/api/ui/order-tracker) timeline.
Without script, the page shows the status at render time and a Refresh
status link.

![The order's status timeline from Order placed to Delivered](/showcase/bocado/order-steps.webp "The timeline and the map read the same clock, so they never disagree about where the order is.")

The orders page lists every order with Track and a Reorder post that refills the cart, and the
footer's Reset the demo puts cart, address and orders back to how they started.

## A phone layout of its own

On a phone, the header keeps only the mark and the address, the destinations move into a
[TabBar](/api/ui/tab-bar), and the floating View cart bar rides above it while the cart holds
anything. A restaurant's hero card overlaps its art, and the category bar scrolls sideways under it.

![A restaurant page on a phone, with the category bar under the hero and a bottom tab bar](/showcase/bocado/phone-restaurant.webp "On a phone, Home, Search, Orders and Cart move into a bottom tab bar.")

## Takes after

- [Uber Eats](https://www.ubereats.com) — the home screen of cuisine chips over shelves of
  restaurants ranked by time, fee and rating; Bocado builds every shelf as a server-rendered
  list.
- [Rappi](https://www.rappi.com) — a Latin American city's delivery app with dish options
  priced inside the item sheet; Bocado's sheet is a native dialog that posts as one form.
- [DoorDash](https://www.doordash.com) — tracking that pairs a status timeline with the courier
  on a map; Bocado drives both from one server clock and keeps a no-script fallback.

## Where to start reading

- [`index.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/bocado/index.tsx)
  — the screens, the form schemas each post is parsed with, and the toast every redirect names.
- [`restaurant.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/bocado/restaurant.tsx)
  — the category bar and the dish dialog with its one-kitchen rule.
- [`tracking.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/bocado/tracking.ts)
  — the one clock the tracking page and its live stream both read.
