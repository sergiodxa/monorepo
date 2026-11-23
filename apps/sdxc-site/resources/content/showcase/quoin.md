---
title: Quoin
headline: A studio portfolio set like a printed book, where case studies lead with results and the brief form explains itself
summary: A landing for an invented design and engineering studio in Antwerp, set as a printed portfolio of a Didone on a strict twelve-column grid.
tagline: A studio portfolio on a Didone grid
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Quoin landing, an oversized Didone headline reading Designed and built in one room over tick marks at each of twelve column edges, a lead and a row of four studio figures.
  - id: plate
    page: ""
    highlight: "[data-slot=case-study-plate]"
    alt: A full-bleed case study plate, a ferry departures board drawn in SVG over a river route, its 08:22 row marked green with Tram 4 waits 3 min.
  - id: facts
    page: ""
    highlight: "[data-slot=case-study-facts]"
    alt: The case study's three columns, the problem, what was built and the result, a 31% drop in missed connections over the first winter.
  - id: availability
    page: ""
    highlight: "[data-slot=studio-availability]"
    alt: A twelve-month calendar of two project slots a month, filled through May and open from June, with March tinted as the first month with an open slot.
  - id: notes
    page: ""
    click: "#notes summary"
    highlight: "#notes details[open]"
    alt: An opened note from the studio's writing, its date, kind, title and reading time on one row and a paragraph under the title.
  - id: enquiry
    page: ""
    click: "[data-slot=studio-enquiry] button[type=submit]"
    highlight: "[data-slot=studio-enquiry]"
    alt: The brief form after an empty submit, every required field ruled red with its correction under it, and the four budget tiles outlined.
  - id: phone
    page: ""
    viewport: phone
    alt: The Quoin hero on a phone, the Didone headline stacked over the lead and the call to action.
---

Quoin is an invented design and engineering studio in Antwerp that designs and builds everyday software for transit, libraries and makers, and measures what it changed. The studio does not exist. The page is a studio landing built from [@sdxc/ui](/api/ui) landing patterns and [@sdxc/u](/api/u), set as a printed portfolio: cool white paper, ink, one ultramarine, an oversized Didone display over a grotesk body, mono captions and square corners on a strict twelve-column grid.

It is the demo to read for an editorial page where typography and the grid carry the design, and for proof a reader checks on the page. Case studies lead with a measured result, the client list shows how long each client has stayed, availability is a calendar of slots, and the brief form is checked by the browser with each correction appearing only after the reader has had a chance to type.

## The brief

A studio's site sells judgment, which is hard to show. The genre's default is a grid of beautiful project thumbnails, a list of logos and a contact form, and it leaves a prospective client guessing at what the work achieved, whether clients come back, who they would actually work with, and when the studio could start.

Quoin answers each of those with a specific part of the page. Three case studies state the problem, what was built and the figure it moved. A printed client index carries each client's sector and years. A sixteen-week process schedule says what the client holds at the end of each phase. The team appears as the people a project gets. A calendar shows the studio's whole capacity, and a short brief form with budget ranges closes the page.

## A grid you can see

The hero sets the studio's claim, "Designed and built in one room", in a Didone across the whole width, with the second line in italic. Above it, the top rule carries a short tick at the edge of each of the twelve columns, so the grid the page is built on shows without stripes running through the type. The lead sits in the right-hand half, and the studio's figures open the page as its first ruled table: products shipped, people, how long an average client stays, and how many projects run at once.

The grid lives in `grid.ts`: twelve columns from each band's large container breakpoint and one column below it. Every band after the hero hangs its content on those columns, and the section numbers ("03 — Process") sit in a running head the way a printed book sets them.

## Case studies that lead with the result

The selected work is three case studies in [CaseStudy](/api/ui/case-study): a ferry departures board, a library catalogue and a one-page checkout. Each opens on a full-bleed plate drawn in SVG, then sets the problem, what the studio built and the result in three columns.

![A full-bleed case study plate, a ferry departures board drawn in SVG over a river route, its 08:22 row marked green with Tram 4 waits 3 min](/showcase/quoin/plate.webp "Each plate is an SVG drawing of the shipped product, bleeding to the edges of the section.")

The plate bleeds to the edges of the section's own container, which keeps a scrollbar from appearing at any width:

```tsx
marginInline: "calc(50% - 50cqi)",
inlineSize: "100cqi",
```

The drawings show each product in use. The departures board marks the ferry whose tram will wait; the checkout plate carries a buyer's email, delivery address and postcode in its three fields, so the plate reads as a checkout in use.

![The case study's three columns, the problem, what was built and the result, a 31% drop in missed connections over the first winter](/showcase/quoin/facts.webp "Problem, what was built and the figure it moved, with the figure set largest.")

The result column sets its figure in the display face, large, followed by what it measured and against what. Every project on the page is judged by that number before its picture.

## Proof read off the page

Below the work, the client list is a printed index: each client's name in the Didone, its sector, and the years the studio has worked with it, so how long clients stay is visible at a glance. The process band draws a typical engagement as a schedule on a sixteen-week scale, five phases as bars from brief and audit to launch and measure, each with what the client holds when it ends; the copy points out that the designers who ran the interviews are still in the room when the build starts in week seven. The people band shows everyone a client works with as a typographic portrait plate with initials, role and year joined.

The studio's writing follows as notes that open in place. Each is a native `<details>` whose summary carries the date, the kind, the title and the reading time, so the list scans like a table of contents and expands with no script.

![An opened note from the studio's writing, its date, kind, title and reading time on one row and a paragraph under the title](/showcase/quoin/notes.webp "Each note is a native details element; its summary row is the date, kind, title and reading time.")

## Availability as a calendar

"Booking from March" is a claim the page backs with a drawing. The enquiry band opens with a calendar of the next twelve months, two project slots a month, which is the studio's whole capacity. Slots a project holds are filled; open ones are outlined, and the first month with an open slot is tinted.

![A twelve-month calendar of two project slots a month, filled through May and open from June, with March tinted as the first month with an open slot](/showcase/quoin/availability.webp "Two slots a month is all the studio takes, so the start date is read off the calendar.")

The hero's running head makes the same claim in its corner, "Booking from March", and the calendar is where a reader checks it.

## A brief the browser checks

The form beside the calendar asks for a name, an email, an optional organisation, a budget range, a start month and a sentence or two on what the work should change. It uses the kit's [Input](/api/ui/input), [Select](/api/ui/select) and [TextArea](/api/ui/textarea), with the budgets as four large tiles in the Didone. Every rule is a native constraint: `required`, `type="email"`, a minimum length on the brief.

![The brief form after an empty submit, every required field ruled red with its correction under it, and the four budget tiles outlined](/showcase/quoin/enquiry.webp "After a submit attempt, each invalid field shows its own correction, by CSS on :user-invalid.")

Each field carries a correction written for that field ("Pick the range closest to what you have set aside"), hidden until the browser marks the control `:user-invalid`, which happens only after the reader has edited it or tried to submit:

```tsx
when('[data-slot="studio-field"]:has(:user-invalid) &', raw({ display: "block" })),
```

So the form never greets a visitor with errors, and it explains itself the moment it is needed, with no script. A valid brief posts to an example endpoint that redirects back to `#brief-sent`, where a note at the head of the form says the brief arrived and who replies within two working days. The band heights are measured, so that note lands in view. `enquiry.browser.test.tsx` covers the corrections and the submit.

On a phone the grid collapses to one column, so the tick marks give way to a plain rule, the headline stacks, and the figures table becomes two columns.

![The Quoin hero on a phone, the Didone headline stacked over the lead and the call to action](/showcase/quoin/phone.webp "On a phone the headline stacks and the lead follows directly beneath it.")

## Takes after

- [Pentagram](https://www.pentagram.com) — a studio portfolio of projects shown large, each with its client and what changed; Quoin leads each one with the measured result.
- [thoughtbot](https://thoughtbot.com) — a studio that publishes its process and its team as part of the pitch; Quoin draws the process as a sixteen-week schedule.
- [Instrument](https://www.instrument.com) — editorial typography and a strict grid used as the studio's own identity.
