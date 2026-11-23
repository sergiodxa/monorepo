---
title: Sundial
headline: A calendar that stores every event as JSCalendar and keeps a London meeting at 3 PM London time
summary: An invented calendar with day, week, month and year views, events you drag and resize, a second time zone, find-a-time across five zones, one-line quick add, and iCalendar import and export.
tagline: A calendar across five time zones
cover: week
shots:
  - id: week
    page: ""
    wait: 1200
    alt: Sundial's week view, events laid out on an hour grid with overlapping meetings side by side, a marigold now line, and a sidebar with calendars and time zones.
  - id: popover
    page: ""
    click: "[popovertarget^='sundial-week-event-london-sync']"
    highlight: "[id^='sundial-week-event-london-sync'][id$='-popover']:popover-open"
    wait: 800
    alt: The popover for a design sync with London, showing its time on the viewer's clock and on London's, how it repeats, and its guests.
  - id: dialog
    page: "?new=1"
    highlight: "dialog[open]"
    alt: The new-event dialog with fields for title, date, start and end times, repeat, time zone, calendar, colour, guests, location and notes.
  - id: free-busy
    page: "find?with=mara,tomas,jonah&length=30&d=2026-11-18"
    highlight: "[data-slot='free-busy']"
    alt: The find-a-time view for teammates in New York, London, Mexico City and Los Angeles, busy blocks and hatched hours outside each working day, with the one shared slot at 12 PM highlighted.
  - id: year
    page: "year"
    highlight: "[data-slot='year-view']"
    alt: The year view, twelve small months with each day dotted by how busy it is.
  - id: quick-add
    page: ""
    highlight: "#sundial-quick-add"
    alt: The quick add box in the sidebar, a single text field for typing an event in plain English.
  - id: import
    page: "import"
    highlight: "[data-slot='zone']"
    alt: The import page's drop zone for an iCalendar or JSCalendar file.
  - id: phone
    page: ""
    viewport: phone
    wait: 1200
    alt: Sundial on a phone, three days of events under a scrolling strip of dates.
---

Sundial is an invented calendar. It has day, three-day, week, month and year views, an agenda, a find-a-time view across a team in five time zones, a quick-add box that reads plain English, and calendar import and export. The art direction is chalk paper with slate ink, a dial blue for events, and a marigold line that marks the current time.

Calendars are mostly about time zones and repeats, and that is where this build earns a careful read. Every event is stored as an RFC 8984 JSCalendar object. Repeats keep their own zone's wall-clock time across daylight saving changes, so a weekly 3 PM sync planned in London stays at 3 PM in London even in the weeks when New York has changed its clocks and London has not. Calendars travel in and out as iCalendar and JSCalendar files, invitations go out as iTIP, and the whole thing runs on server-rendered pages that a form can drive without script.

## The brief

A calendar has to get several hard things right at once. It has to lay out overlapping events so they can all be read. It has to let people create and move events by dragging, while staying usable from a keyboard. It has to show an event's time on the viewer's clock and on the clock it was planned in. It has to expand repeating events correctly across daylight saving changes, and let one occurrence move without dragging the series with it. And it has to exchange calendars with other software, which in practice means iCalendar.

Sundial takes on all of these. The views come from `@sdxc/ui/schedule`: [TimeGrid](/api/ui/time-grid), [MonthView](/api/ui/month-view), [YearView](/api/ui/year-view), [Agenda](/api/ui/agenda), [DayStrip](/api/ui/day-strip) and [FreeBusy](/api/ui/free-busy). The data model and the exchange formats come from [@sdxc/jscalendar](/api/jscalendar), [@sdxc/icalendar](/api/icalendar), [@sdxc/dates](/api/dates) and [@sdxc/natural-dates](/api/natural-dates). The visitor's own events and edits live in their cookies, with Undo on each toast and a reset in the account menu.

## A week you can read and drag

The week opens scrolled to the working day, with the marigold now line moving down the grid as time passes. Overlapping meetings sit side by side in the [TimeGrid](/api/ui/time-grid). All-day and multi-day events, such as an out-of-office or a planning week, share a lane across the top. The sidebar sets a primary time zone and a second one, and the second zone gets its own column of hours beside the first.

Drag across empty time to create an event, drag an event to move it, or drag its bottom edge to resize it. Alt and the arrow keys do the same for the focused event. Each of these gestures posts a form, so the server decides the result and the page shows exactly what is stored. On a touch screen, a quick swipe across the hours moves the week, three-day and day grids to the previous or next range. The arrows in the top bar do the same.

Clicking an event opens its card in a native popover: a button with `popovertarget` and no script of Sundial's own. The card shows when the event happens on the viewer's clock, and also on the clock of the zone it was planned in when the two differ. It also shows how the event repeats, who is invited, and the viewer's answer.

![The popover for a design sync with London, showing its time on the viewer's clock and on London's, how it repeats, and its guests](/showcase/sundial/popover.webp "A London meeting shows on your clock and on London's, so a DST gap is visible at a glance.")

Edit opens a [RouteDialog](/api/ui/route-dialog) whose address opens it too, as in `?new=1`, or `?date=2026-11-18&start=600&end=660` for a new event prefilled from a drag. It covers title, date and times, repeat, zone, calendar, colour, guests, location and notes, using the [DateField](/api/ui/date-field), [TimeField](/api/ui/time-field), [TextField](/api/ui/text-field), [Select](/api/ui/select) and [TextArea](/api/ui/textarea) components. The dialog does everything a drag does, without script, and it reloads and links like any page.

![The new-event dialog with fields for title, start and end, time zone, repeat, calendar, colour, guests, location and notes](/showcase/sundial/dialog.webp "The edit dialog is an address, so it reloads, links and works without script.")

## Repeats that keep their own clock

Sundial stores every event as a JSCalendar Event from [@sdxc/jscalendar](/api/jscalendar). Guests are Participants and the organizer is their owner. Repeats are recurrence rules in the event's own time zone. To draw a view, `time.ts` expands each event over the visible window with `occurrences()`:

```ts
let expanded = occurrences(event, window);
if (isFailure(expanded)) continue;
for (let occurrence of expanded.data) {
	let start = new Date(occurrence.start);
	found.push({
		key: `${event.uid}~${occurrence.recurrenceId ?? "once"}`,
		recurrenceId: occurrence.recurrenceId,
		start,
		/* … */
	});
}
```

Because each occurrence is computed in the event's own zone, a London 3 PM sync lands at 10 AM on a New York clock most weeks and at 11 AM in the weeks when only one city has changed its clocks. [@sdxc/dates](/api/dates) converts each instant to the viewer's zone for the grid. Moving or deleting a single occurrence writes a recurrence override for that occurrence, so the rest of the series stays where it was. An event whose rules the dialog cannot express keeps them as written, under "Custom rule (kept)".

The visitor's changes to the seed calendar are kept as PatchObjects, and the visitor's own events as whole Events. Each one is validated with `parse()` when it is read back from the cookie, so a tampered cookie can only lose edits, never inject a malformed event.

## Finding a time across five zones

The find screen compares invented teammates over one day in a [FreeBusy](/api/ui/free-busy) view. Each person's working hours are read in their own zone and shaded outside them, their busy blocks come from their calendars, and the view offers the times everyone can make. Who to include and how long the meeting runs are query parameters, so `find?with=mara,tomas,jonah&length=30&d=2026-11-18` is a link someone can send. When nobody's working day overlaps, as with teammates in Bengaluru and Tokyo on a weekend, the view says no time works and suggests a shorter meeting, fewer people or the next day.

![The find-a-time view for teammates in New York, London, Mexico City and Los Angeles, busy blocks and hatched hours outside each working day, with the one shared slot at 12 PM highlighted](/showcase/sundial/free-busy.webp "Each teammate's working day is read in their own zone, and the shared free times stand out.")

The other views borrow ideas from desktop and phone calendars. The [MonthView](/api/ui/month-view) scrolls on into the next two months under sticky month names. Picking a day selects it in place and lists its events in an [Agenda](/api/ui/agenda) beside the grid, or under it on a phone. The [YearView](/api/ui/year-view), on `y`, shows twelve months with each day dotted by how busy it is, and every day opens its own day view.

![The year view, twelve small months with each day dotted by how busy it is](/showcase/sundial/year.webp "The year view dots each day by how busy it is, and every day links to its day view.")

## One line becomes an event

The sidebar's quick add box takes a line such as "Design review with Mara every other Tuesday at 3pm". When the visitor presses Enter, the server runs `find()` from [@sdxc/natural-dates](/api/natural-dates) over the line, which picks out the day, time, length and repeat. `strip()` removes those phrases, and what remains becomes the title. "with Mara" invites the teammates it names. Anything the line leaves out takes the usual defaults: today, the next hour, an hour long. A span of days without a time becomes an all-day event.

![The quick add box in the sidebar, a single text field for typing an event in plain English](/showcase/sundial/quick-add.webp "Quick add is one field: the server reads the line, and the title is whatever the dates leave.")

With script, an island reads the line back under the box as it is typed, for example "Design review with Mara · Tue, Nov 24 · 3:00 PM · every 2 weeks", so the visitor can see how the line will be read before sending it. The read-back line appears only once there is something to read. Without script, the box posts the same line and the server does the same work.

## Calendars as files

Import and export, in the sidebar, lists every calendar three ways: as an iCalendar feed to subscribe to over `webcal://`, as an `.ics` download, and as JSCalendar JSON, all served by [@sdxc/icalendar](/api/icalendar) from the calendar's JSCalendar Group. Each event's popover offers its own `.ics` too.

An `.ics` or JSCalendar file dropped on the import page's [DropZone](/api/ui/drop-zone) lands in a new Travel calendar, and Sundial opens on the week of its first event. Importing the same events again updates them instead of adding them twice. A JSCalendar Group can also be posted to the import address as a form field, which is how another demo hands a trip to Sundial.

![The import page's drop zone for an iCalendar or JSCalendar file](/showcase/sundial/import.webp "Dropping a calendar file on the zone imports it, and importing it again updates it.")

New events with guests send an iTIP REQUEST. Each invented teammate's iTIP REPLY is read back onto the event: declined when they are busy, tentative outside their working day (read in their own zone), and accepted otherwise. Once the visitor answers an invitation, its popover also offers their own iTIP REPLY.

On a phone, the week becomes three days under a scrolling [DayStrip](/api/ui/day-strip) of dates.

![Sundial on a phone, three days of events under a scrolling strip of dates](/showcase/sundial/phone.webp "A phone shows three days under a strip of dates you can scroll.")

## Takes after

- [Google Calendar](https://calendar.google.com) — drag on the grid to create, a second time-zone column, and find a time across a team. Sundial keeps each repeat in its own zone's wall-clock time.
- [Fantastical](https://flexibits.com/fantastical) — one line of natural language that becomes an event, read back as you type.
- [Apple Calendar](https://www.apple.com/macos/) — a year view dotted by how busy each day is, and a month that scrolls on into the next.

## Where to start reading

- [`sundial/views.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/sundial/views.tsx) — every view, the popover card on each block, and the drags the grids post.
- [`sundial/model.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/sundial/model.ts) — events as JSCalendar: guests as participants, repeats as rules, single moves as overrides.
- [`sundial/quick.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/sundial/quick.ts) — one line of English turned into an event.
- [`sundial/ics.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/sundial/ics.ts) — the feeds, the import and the iTIP exchange.
