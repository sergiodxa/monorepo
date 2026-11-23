---
title: Hollyhock Bakery
headline: A bakery page that reads the shop's own clock on the server, from the door sign to the pickup form
summary: A landing for an invented neighbourhood bakery whose door sign, chalkboard, hours and pickup form read the shop's own clock on the server.
tagline: A bakery page that knows if it's open
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Hollyhock Bakery landing, a hand-drawn shop front in terracotta and butter beside the headline and an open-or-closed sign.
  - id: sign
    page: ""
    highlight: "[data-slot=landing-hero-copy]"
    alt: The hero copy, a red Closed badge reading opens tomorrow at 8 am above the headline Warm bread on Alder Street, out by seven.
  - id: chalkboard
    page: ""
    highlight: "[data-slot=chalkboard]"
    alt: A green chalkboard titled Out of the oven today, listing four batch times from 7 am to 1:30 pm, each marked Out now.
  - id: hours
    page: ""
    highlight: "#hours div:has(> table[data-slot=week-hours])"
    alt: The hours card, a Closed status above the next seven days, with Thanksgiving closed and a late start the day after marked in red.
  - id: menu
    page: ""
    highlight: "[data-slot=price-list-group]"
    alt: The Bread group of the menu, five loaves with dotted leaders to their prices and vegan and gluten-free marks.
  - id: order
    page: ""
    highlight: "[data-slot=order-form]"
    alt: The pickup form, quantities for five bakes, a pickup day select, morning, midday and afternoon radios, name and phone fields and a Send my order button.
  - id: map
    page: ""
    highlight: "[data-slot=street-map]"
    alt: A drawn street map of Alder Street with Linden Park, the bakery pin, the car park, bus stop 4 and a dotted two-minute walk.
  - id: phone
    page: ""
    viewport: phone
    alt: The Hollyhock hero on a phone, the status badge, headline and order button above the drawn shop front.
---

Hollyhock Bakery is an invented neighbourhood bakery on Alder Street, and this is its one-page site: today's bake, the menu and prices, opening hours, pickup orders, directions, step-free access and parking. The bakery does not exist. The page is written for a non-technical reader in a warm, homely register and built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons).

It is the demo to read for a page whose content depends on the time. The sign above the headline, the chalkboard of batches, the week of hours and the days the pickup form offers are all computed on the server from the bakery's clock, and the order form works with no script at all. The art direction is terracotta and butter, a shop-sign serif, gingham and scallops drawn in CSS, and every picture (the shop front, the bakes, the street map) an SVG drawn in code.

## The brief

A small shop's website is visited for a handful of questions, asked in roughly this order: is it open right now, what do they have today, how much is it, can I order ahead, and how do I get there. Most bakery sites answer the first question with a static table that a visitor has to reconcile with today's date, a holiday and their own time zone.

Hollyhock answers it with a sentence. The page renders "Open now · closes at 6 pm", "Closing soon" or "Closed · opens tomorrow at 8 am" from the time of the render, in `America/Chicago`, so a visitor in another zone reads the bakery's clock and not their own. The rest of the page follows the same idea: the chalkboard knows which batches are out, the hours table applies the holidays coming up, and the pickup form only offers days the shop opens.

## A sign that states the time

The hero opens with a status badge, then the headline and two actions. The page's render passes `new Date()` into the page component, and everything time-dependent derives from it, down to the card hanging on the drawn shop door, which turns to OPEN or CLOSED with the badge.

![The hero copy, a red Closed badge reading opens tomorrow at 8 am above the headline Warm bread on Alder Street, out by seven](/showcase/hollyhock/sign.webp "The badge reads the bakery's clock: closed for the night, and when the doors open next.")

The rules live in `hours.ts`, which has its own tests. `WEEK` holds the regular week and `EXCEPTIONS` the holidays and the busy days around them, written as a shop sign would write them. `openingStatus(now)` returns one of three states: open with its closing time, closing soon once the doors are within 30 minutes of shutting, or closed with the next opening. That next opening is named the way a neighbour would say it: "today at 7 am", "tomorrow", a weekday within the week, or a date beyond it, which matters when a holiday closes the shop for more than a day.

```ts
let reason = today.exception && today.opening === null ? ` for ${today.exception.reason}` : "";
return { state: "closed", label: `Closed${reason}`, detail: nextOpening(today), today };
```

On Thanksgiving that line produces "Closed for Thanksgiving", with the next opening after it. Calendar arithmetic runs on UTC midnights, so moving from one local day to the next never crosses a daylight-saving change.

## A chalkboard and a week of hours

"Today's bake" is a chalkboard of the day's batches with their times, each marked "Out now" once its time has passed or with the time it comes out. A line under it says that a sold-out tray is gone until tomorrow. Beside it, the season's three bakes appear as illustrated cards, chosen by `seasonOf()` from the same local date.

![A green chalkboard titled Out of the oven today, listing four batch times from 7 am to 1:30 pm, each marked Out now](/showcase/hollyhock/chalkboard.webp "Each batch is marked against the bakery's clock, so the board and the sign always agree.")

The hours band repeats the status, then lists the next seven days from today. Each row names the day the way a person would, "Today", "Tomorrow", then weekdays, with its date and its hours. Where an exception falls inside the week, the row shows the reason in the accent colour: a late pie pickup night, Thanksgiving closed, a late start the morning after.

![The hours card, a Closed status above the next seven days, with Thanksgiving closed and a late start the day after marked in red](/showcase/hollyhock/hours.webp "The next seven days with the holidays applied, so nobody walks over on Thanksgiving.")

The status, the board and the table are rendered on the server. There is no client clock and no island. The demo's route caches its streamed render for the current build, so the sign can trail the real time by up to the cache's lifetime. Everything else on the page is unaffected by that.

## A menu set like a price board

The menu is a [PriceList](/api/ui/price-list): four groups (bread, pastry, pies and cakes, drinks), each with a line on when it is served, items with dotted leaders running to their prices, a sentence under each item, and small marks for vegan and gluten-free bakes. The groups sit two to a row on a wide screen and stack on a phone.

![The Bread group of the menu, five loaves with dotted leaders to their prices and vegan and gluten-free marks](/showcase/hollyhock/menu.webp "A price-list group with its serving note, leaders to each price and dietary marks.")

## Ordering for pickup with no script

The order band is a plain form. A visitor sets quantities for the bakes that can be ordered ahead, picks a day from a [Select](/api/ui/select), picks morning, midday or afternoon from a [RadioGroup](/api/ui/radio-group) of cards, and leaves a name and a phone number in [TextField](/api/ui/text-field)s. The phone field says why it is asked for: only to text if something sells out.

![The pickup form, quantities for five bakes, a pickup day select, morning, midday and afternoon radios, name and phone fields and a Send my order button](/showcase/hollyhock/order.webp "The pickup days come from the same hours as the sign, starting tomorrow and skipping closed days.")

The day list comes from `pickupDays(now)`: the next five days the bakery opens, starting tomorrow, because an order is baked overnight. The form posts to an example endpoint whose answer redirects back to the page at `#order-placed`, where a confirmation sits at the head of the band. Each band holds a measured placeholder height while it is off screen, so landing on that fragment puts the confirmation in view, clear of the sticky header.

## Getting there, and getting in

The visit band answers the last question. A street map drawn in SVG shows Linden Park, the bakery's pin, the car park behind it, the number 4 bus stop and the two-minute walk from it, with its colours as custom properties that flip for dark mode. Beside it, directions by bus, on foot, by bike and by car, then the access details: a step-free front door, the six parking spaces out back, and dogs on the porch.

![A drawn street map of Alder Street with Linden Park, the bakery pin, the car park, bus stop 4 and a dotted two-minute walk](/showcase/hollyhock/map.webp "The map is SVG drawn in code, marking the car park and the walk from the bus.")

The page closes with notes from neighbours in a [TestimonialBand](/api/ui/testimonial-band), a carded FAQ in a [FaqBand](/api/ui/faq-band), and a terracotta panel whose one solid cream button is "Order for pickup", beside the phone number. On a phone, the [SiteHeader](/api/ui/site-header) keeps the order button and folds its sections into a sheet, and the hero puts the status and the order button above the drawn shop front.

![The Hollyhock hero on a phone, the status badge, headline and order button above the drawn shop front](/showcase/hollyhock/phone.webp "On a phone the status and the order button come before the picture.")

## Takes after

- [Google Business Profile](https://www.google.com/business/) — the "Open now · closes at 6 pm" line and the week of hours with holidays applied; Hollyhock computes them on its own page from its own rules.
- [Square Online](https://squareup.com/us/en/online-store) — pickup ordering for a small shop, by day, in one short form; Hollyhock's form posts as plain HTML and offers only the days the shop opens.
