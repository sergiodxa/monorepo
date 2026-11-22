---
title: Overprint 2027
headline: A conference page printed in two inks, with a live countdown, a schedule that filters by CSS and forms that confirm in place
summary: A landing for an invented one-day web platform conference in Rotterdam, printed as a two-ink risograph poster with a live countdown.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Overprint 2027 landing, a condensed black headline overprinted in fluorescent pink and riso blue on grained newsprint.
  - id: countdown
    page: ""
    highlight: "dl:has([data-slot=countdown])"
    alt: The hero's facts row, the date Thursday 15 April 2027, Rotterdam with the venue, and a pink countdown of days, hours, minutes and seconds to the doors.
  - id: phone-schedule
    page: "#schedule"
    viewport: phone
    alt: The schedule on a phone, a Both rooms, Main stage and Side stage filter above the day's first slots.
  - id: speakers
    page: ""
    highlight: "#speakers ul > li:nth-child(3)"
    alt: A speaker card, a halftone bust in pink with the initials IO overprinted in blue, then the name, job and talk with its time and stage.
  - id: map
    page: ""
    highlight: "svg[aria-label^='Map of the venue']"
    alt: A two-ink map of Rotterdam, the metro from Centraal under the river, the venue marked with a pink burst and a six-minute walk from the metro, and three numbered hotels.
  - id: tickets
    page: ""
    highlight: "ol[aria-label='Ticket releases']"
    alt: Three ticket stubs, the early bird stamped Sold out, the regular release on sale in pink with 112 seats left, and the late release waiting for 1 March.
  - id: sponsors
    page: ""
    highlight: "[data-slot=sponsor-wall]"
    alt: A ruled sponsor wall in three tiers, two headline sponsors, four partners and six community groups, with a button for the sponsor pack.
  - id: tape
    page: ""
    highlight: "[data-slot=marquee]"
    alt: A strip of blue tape at a tilt, listing the date, the city, 12 talks, 2 stages, 780 seats and more between pink stars.
---

Overprint 2027 is an invented one-day conference on what browsers ship, held in two rooms of an old ship-propeller foundry in Rotterdam on Thursday 15 April 2027. The event does not exist. The page is an event landing built from [@sdxc/ui](/api/ui) landing patterns and [@sdxc/u](/api/u), and printed, in effect, as a two-ink risograph poster: fluorescent pink over riso blue on newsprint, a condensed black display face and grain over the whole page.

It is the demo to read for a loud art direction carried through every section without breaking the components underneath. The countdown, the schedule, the speaker wall, the venue map, the ticket stubs and the sponsor wall are all ordinary, accessible markup; the inks, the halftones and the grain are a layer of tokens and CSS on top. The schedule filters by room on a phone with radios and CSS alone, and both forms on the page land the reader on a confirmation with JavaScript off.

## The brief

A conference page answers the same questions every year: when and where, who is speaking, what the day looks like, how to get there, what a ticket costs and whether there are any left. The genre's hard parts are density and honesty. A two-track schedule is a table that falls apart on a phone. Ticket pages promise scarcity they cannot show. And a strong visual identity tends to stop at the hero, leaving a template below it.

Overprint takes all three on. The poster identity runs through every band, set once in `ink.ts` as two inks and three faces. The schedule is a timeline that becomes a filtered list on a phone. The ticket stubs show seats sold and left from data that adds up, and the hero, the ticker and the venue name the same seat count.

## The date, the city and the time left

The hero sets the conference name across the width, then a facts row of three: when, where, and how long until the doors open. The last is a [Countdown](/api/ui/countdown) of days, hours, minutes and seconds in the pink ink.

![The hero's facts row, the date Thursday 15 April 2027, Rotterdam with the venue, and a pink countdown of days, hours, minutes and seconds to the doors](/showcase/overprint/countdown.webp "The countdown is a server-rendered time element; its island keeps it ticking from the viewer's clock.")

The countdown is one `<time>` naming the moment the doors open. The server renders the time left from the current time, so the figures are right in the HTML, and the component's island keeps them ticking from the viewer's own clock once it loads. A cached page therefore still reads true after the island runs, and a reader without JavaScript sees the time left as of the render. The site's browser entry loads the countdown island by its package specifier, since it ships inside `@sdxc/ui/landing`.

## Two rooms that fold into one list

On a wide screen the schedule is a timeline: one row per slot, the time set large down the left, the main stage in a pink-ruled column and the side stage in a blue one, with breaks and lunch running across both. On a phone the rooms stack, and a strip of three radios above the list picks both rooms, the main stage or the side stage.

![The schedule on a phone, a Both rooms, Main stage and Side stage filter above the day's first slots](/showcase/overprint/phone-schedule.webp "On a phone, three radios filter the day by room, with no script.")

The filter is a container query and `:has()`. The schedule names its own container, and in the narrow layout each talk hides itself when the other room's radio is checked:

```tsx
[NARROW]: {
	'[data-slot="overprint-schedule"]:has(input[value="main"]:checked) &[data-track="side"]':
		{
			display: "none",
		},
```

Breaks carry no track, so they stay in every view, and the radios are hidden in the wide layout where both rooms already sit side by side. `schedule.browser.test.tsx` checks both: the filter narrows the list on a phone with CSS alone, and on a wide screen both rooms show with the filter gone.

## Portraits and a map in two inks

The twelve speakers are a wall of printed portraits: each a halftone bust in one ink with the speaker's initials overprinted in the other, then the name, the job and the talk, linked to the slot the schedule gives it. Last year's talks get the same treatment as a wall of video stills, the most watched one large and eight around it, each with its running time.

![A speaker card, a halftone bust in pink with the initials IO overprinted in blue, then the name, job and talk with its time and stage](/showcase/overprint/speakers.webp "Each portrait is a CSS halftone in one ink with initials overprinted in the other.")

Every halftone is drawn in CSS, a dot screen of one ink over a flat of the other; there are no images. The venue band answers the questions people email organisers about (the address, the two halls and their induction loops, step-free access from the metro, the quiet room, the bike racks) beside an SVG map in the same two inks: the river as a dot screen, the metro from Centraal under the river, a six-minute walk from the station to the door, and three numbered hotels.

![A two-ink map of Rotterdam, the metro from Centraal under the river, the venue marked with a pink burst and a six-minute walk from the metro, and three numbered hotels](/showcase/overprint/map.webp "The venue map is SVG in the poster's two inks, with a full description as its accessible name.")

The map's accessible name is a full sentence describing what it shows, so a screen reader hears the route, not "map". In dark mode the page's grain and the logo switch from multiplying to screening, through one `--op-blend` variable, so the overprint still reads on a dark sheet.

## Tickets that add up, and forms that answer

The tickets band shows three releases as printed stubs: the early bird stamped "Sold out" across its price, the regular release printed in pink with its seats sold and left on a bar, and the late release waiting for its date. Only the release on sale has a button that does anything.

![Three ticket stubs, the early bird stamped Sold out, the regular release on sale in pink with 112 seats left, and the late release waiting for 1 March](/showcase/overprint/tickets.webp "Each stub shows seats sold and left, and only the release on sale can be bought.")

The numbers are data, not copy. The three releases hold 740 seats and the scholarship 40 more, filling the two halls the hero and the ticker promise, and the band's eyebrow is computed as the sum of the releases. "Buy a regular ticket" posts to an example endpoint whose answer redirects to `#ticket-reserved`, a note under the button saying the seat is held for 15 minutes. The footer's sign-up for the 2028 letter does the same, landing on `#letter-signed-up`. Both work with JavaScript off, and every band holds a measured placeholder height so those fragments land in view.

## Sponsors, the tape and the rest of the sheet

Sponsors are a tiered [SponsorWall](/api/ui/sponsor-wall): two headline sponsors, four partners and six community groups, each mark drawn in SVG with its name as its label, in a ruled grid that ends on a link to the sponsor pack.

![A ruled sponsor wall in three tiers, two headline sponsors, four partners and six community groups, with a button for the sponsor pack](/showcase/overprint/sponsors.webp "A three-tier sponsor wall, every mark an SVG with its name as its accessible label.")

The page's one moving flourish is a strip of blue tape pasted across the poster at a tilt, the day's numbers scrolling along it in a [Marquee](/api/ui/marquee) with a pause button. For a reader who asks for reduced motion it sits still as a wrapped row.

![A strip of blue tape at a tilt, listing the date, the city, 12 talks, 2 stages, 780 seats and more between pink stars](/showcase/overprint/tape.webp "The tape is the page's only motion, and it stops for reduced motion.")

Travel and hotels, the code of conduct and a closing call follow. The whole sheet sits under a layer of grain drawn below the sticky header, and the header clears every in-page target, so the page reads as one pulled print.

## Takes after

- [CSS Day](https://cssday.nl) — a Dutch conference about the web platform, sold by its programme and its historic venue.
- [Smashing Conference](https://smashingconf.com) — the schedule, speaker wall, ticket releases and travel notes a conference page needs; Overprint sets them as printed stubs and a two-room timeline.
- [Config](https://config.figma.com) — a conference site that commits to one bold graphic identity across every section; Overprint's is a risograph poster in two inks.
