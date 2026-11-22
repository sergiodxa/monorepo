---
title: Wayfern
headline: Booking a stay, a flight and a car on one island, with every search, filter and fare choice kept in the address
summary: An invented travel app that books stays, flights, cars and packages from one search, maps results on real streets, picks seats and fares, and exports every trip to calendars.
cover: results
shots:
  - id: results
    page: "s?where=ponta-delgada"
    wait: 3000
    alt: Wayfern's stay results in Ponta Delgada, a list of cards with drawn photos and nightly prices beside a street map of São Miguel with a price pin for each stay.
  - id: dates
    page: ""
    click: "button[popovertarget='hero-dates-panel']"
    highlight: "#hero-dates-panel"
    alt: The dates popover open under the home search, two months side by side for picking a check-in and a check-out.
  - id: map
    page: "s?where=ponta-delgada"
    highlight: "#wayfern-results-map"
    wait: 3000
    alt: The results map, OpenFreeMap streets of Ponta Delgada with a price pin for each stay and zoom controls.
  - id: booking
    page: "stay/the-canopy?checkin=2026-12-07&checkout=2026-12-10"
    highlight: "#wayfern-booking"
    alt: The Canopy's booking card for three nights in December, with the dates, guests, a nightly price and a breakdown of the total.
  - id: fares
    page: "flights?from=SRL&to=MRW&depart=2026-11-25&return=2026-11-30"
    highlight: "[data-slot='fare-calendar']"
    alt: A strip of nearby days' fares above the flight results, each day with its lowest price, the cheapest day tinted green and the chosen day filled.
  - id: timeline
    page: "trips"
    highlight: "[data-slot='trip-timeline']"
    alt: The trips itinerary, a day-by-day timeline of an overnight flight from New York, a car pickup, a stay in Furnas and the flights home, each with its local time.
  - id: boarding-pass
    page: "trips/WF-8F2TL"
    highlight: "[data-slot='boarding-pass']"
    alt: A boarding pass for Larkwing Air from SRL to MRW, with passenger, flight, gate, seat and confirmation fields above a QR code.
  - id: phone
    page: ""
    viewport: phone
    alt: Wayfern's home on a phone, a search with tabs for stays, flights, cars and packages over a drawn landscape.
---

Wayfern is an invented travel-booking app. It books stays, flights, cars and packages on invented airlines, airports and rental companies, and puts all of it into one itinerary that exports to calendars. Its invented stays and hosts sit at real coordinates in the towns of São Miguel in the Azores: Ponta Delgada, Ribeira Grande, Furnas, Sete Cidades, Nordeste and Vila Franca. The art direction is fern green on warm sand, and every photo is a drawn landscape served as a cached image. Trips and saved stays live in the visitor's own cookies.

Two things make this build worth a developer's time. First, nearly every step of a booking is a plain GET form or a link: a search, a filter, a date range, a fare choice and a listing's price are all part of the URL, so each step reloads, links and works without script. Second, it covers a broad slice of the travel and map components in `@sdxc/ui`, including a real map that renders on the server and pans and zooms once its island loads.

## The brief

Travel booking is one of the densest kinds of product on the web. Search needs a place, a date range and a party, and the date picker has to understand booked nights. Results have to sit beside a map, with the list and the pins in sync. Filters have to say how many results they would give before they are applied. A listing has to re-price as dates and guests change. Flights add nearby-day fares, legs chosen one at a time, fare classes and seats. And at the end, everything booked has to come together as one trip that goes into a calendar in the right time zones.

Wayfern takes on all of that. Its parts come from `@sdxc/ui`'s travel and map namespaces: [GeoMap](/api/ui/map), [FareCalendar](/api/ui/fare-calendar), [FlightOption](/api/ui/flight-option), [FareOptions](/api/ui/fare-options), [SeatMap](/api/ui/seat-map), [BoardingPass](/api/ui/boarding-pass), [CarOffer](/api/ui/car-offer), [PackageSavings](/api/ui/package-savings), [PriceBreakdown](/api/ui/price-breakdown), [RatingBreakdown](/api/ui/rating-breakdown) and [TripTimeline](/api/ui/trip-timeline). Filter counting comes from [@sdxc/facets](/api/facets), and the calendar export from [@sdxc/jscalendar](/api/jscalendar) and [@sdxc/icalendar](/api/icalendar).

## One search as a set of GET forms

The home search has a tab each for stays, flights, cars and packages. Every tab is a plain GET form, so submitting a search produces an address such as `s?where=ponta-delgada` that can be bookmarked or sent. Each tab shares one date-range picker built on [RangeMonths](/api/ui/range-months), [NumberField](/api/ui/number-field) steppers for adults and children, and an [Autocomplete](/api/ui/autocomplete) for places and airports.

The date picker opens as a native popover from a button with `popovertarget`. It shows two months side by side, and its availability rules match the booking's: a night already booked can still be picked as a check-out, so a stay can end on the morning another begins.

![The dates popover open under the home search, two months side by side for picking a check-in and a check-out](/showcase/wayfern/dates.webp "Dates open in a native popover, and a booked night can still be a check-out.")

Wide screens show the stays search as one pill bar. Phones show a compact pill that opens a full-screen sheet with the same form laid out as a column of cards.

## A real map that renders on the server

Results, wishlists and listings share a [GeoMap](/api/ui/map) over OpenFreeMap's streets of São Miguel. It draws a price pin for each stay, groups nearby pins into clusters, shows a card on hover, and offers "Search this area", which adds the map's bounds to the search. On the server it renders as a static map with links for zooming, so a page without script still shows where every stay is. Once its island loads, the map pans and zooms like any web map. A search for one of the island's towns centres the map there, and anything else frames the whole island so every pin starts in view.

![The results map, OpenFreeMap streets of Ponta Delgada with a price pin for each stay and zoom controls](/showcase/wayfern/map.webp "The map draws a price on every pin, and renders on the server before its island loads.")

Hovering a result card lights its pin, and hovering a pin lights its card. A map tile host is a new outside connection, so a demo app can declare extra content security policy sources, and those sources join the site's policy on that app's pages only. Wayfern allows the tile host and `blob:` workers, and no other page on the site does.

## Filters that say what they would give

Type, price, amenities and sort all live in the query, as in `s?where=furnas&type=cabin` or `s?amenity=hot-tub&min=150`. The counts on the filters come from [@sdxc/facets](/api/facets):

```ts
const STAY_FACETS = createFacets<Stay>()
	.terms("type", (stay) => stay.type, { values: STAY_TYPES.map((type) => type.id) })
	.range("price", (stay) => stay.nightly);
```

Place, dates, party, map bounds and amenities narrow the list first. Type and price then apply as facets, and each facet's counts leave that facet's own selection out. A stay-type chip therefore says how many stays adding it would give, with every other filter applied, and each amenity shows how many of the current results have it. Prices are read in cents, and a maximum price includes the dollar it names, so a stay priced at exactly the bound stays in the list.

## A listing priced from its address

A stay's page opens with a photo mosaic. Each photo is a [Lightbox](/api/ui/lightbox) trigger, and `?photo=2` opens the full-screen viewer at that photo. Below are highlights and amenities, an availability calendar with nightly prices, reviews with a [RatingBreakdown](/api/ui/rating-breakdown) of stars and categories, the host, and a map with this stay raised above its neighbours.

The booking card stays in view as the page scrolls. Its [PriceBreakdown](/api/ui/price-breakdown) follows the dates and guests in the URL. Picking dates reloads the page with them, so the price follows every change, with or without script.

![The Canopy's booking card for three nights in December, with the dates, guests, a nightly price and a breakdown of the total](/showcase/wayfern/booking.webp "The booking card prices the dates and party in the address, so a reload keeps the quote.")

Checkout picks from invented saved cards and never asks for a card number, so there is nothing real to type. Booking creates a trip with a confirmation code, and cancelling it offers Undo. The heart on a card saves the stay to a wishlist.

## Flights, cars and packages

Flights search one-way, round-trip or multi-city. A strip of nearby days' fares sits above the results, built from a [FareCalendar](/api/ui/fare-calendar), and a month of fares is one link away at `flights/calendar` for flexible dates.

![A strip of nearby days' fares above the flight results, each day with its lowest price, the cheapest day tinted green and the chosen day filled](/showcase/wayfern/fares.webp "The cheapest nearby day is tinted green, so moving the trip a day is one informed click.")

Results show each [FlightOption](/api/ui/flight-option) with its route, times, stops and price. Stops, departure and arrival times, airline, journey time and price are all filters in the query. The traveller chooses the outbound first, then the return. Then [FareOptions](/api/ui/fare-options) compares fare classes by what each includes, and a [SeatMap](/api/ui/seat-map) picks seats for every segment, before passenger names and a fake saved card book it.

Cars take pickup and drop-off places and times and show a [CarOffer](/api/ui/car-offer) per class. Extras re-price the rental through the form, and a one-way rental adds its fee. Packages book return flights and a stay together, and [PackageSavings](/api/ui/package-savings) shows what the bundle saves against booking each part alone.

## One itinerary that goes into a calendar

Trips gathers every booking into one itinerary. Each stay, flight and car is placed on a day-by-day [TripTimeline](/api/ui/trip-timeline), grouped into journeys. A booked flight's page shows a [BoardingPass](/api/ui/boarding-pass) for each segment, with gate, seat and zone fields and a QR code.

![The trips itinerary, a day-by-day timeline of an overnight flight from New York, a car pickup, a stay in Furnas and the flights home, each with its local time](/showcase/wayfern/timeline.webp "Every booking lands on one day-by-day timeline, grouped into journeys.")

Each item in the itinerary is a JSCalendar event in its own time zones, built with [@sdxc/jscalendar](/api/jscalendar), so a flight that leaves New York and lands in the Azores shows local time at both ends. A journey or one booking downloads as `.ics` through [@sdxc/icalendar](/api/icalendar). "Open in Sundial" posts the journey as a JSCalendar Group to the Sundial calendar demo's import address, and it appears there as a new calendar. The sample trip is arranged so its outbound flight lands before the car pickup and its return leaves after the drop-off, on whatever day a visitor arrives.

![A boarding pass for Larkwing Air from SRL to MRW, with passenger, flight, gate, seat and confirmation fields above a QR code](/showcase/wayfern/boarding-pass.webp "A booked flight shows a boarding pass for each segment.")

On a phone, the home search keeps its tabs over the drawn landscape, a bottom tab bar holds Explore, Wishlists and Trips, and results switch between the list and the map with a toggle.

![Wayfern's home on a phone, a search with tabs for stays, flights, cars and packages over a drawn landscape](/showcase/wayfern/phone.webp "On a phone the search keeps all four tabs, and opens into a full-screen sheet.")

## Takes after

- [Airbnb](https://www.airbnb.com) — the pill search bar, results beside a map of price pins, a listing's photo mosaic, and its sticky booking card. Wayfern prices the card from the address.
- [Google Flights](https://www.google.com/travel/flights) — a strip of nearby days' fares, a month fare calendar, and choosing the outbound before the return.
- [TripIt](https://www.tripit.com) — every booking gathered into one day-by-day itinerary that goes into your calendar.

## Where to start reading

- [`wayfern/travel-search.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/wayfern/travel-search.tsx) — four searches as plain GET forms sharing one date picker.
- [`wayfern/stays-map.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/wayfern/stays-map.tsx) — the server-rendered map and its pins.
- [`wayfern/query.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/wayfern/query.ts) — filters read from the address and counted with `@sdxc/facets`.
- [`wayfern/trips.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/wayfern/trips.tsx) — the itinerary, boarding passes and the calendar export.
