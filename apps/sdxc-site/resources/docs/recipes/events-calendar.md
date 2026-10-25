---
title: Publish an events calendar
description: Keep events as JSCalendar, show the upcoming sessions on a page, and serve the same events as a subscribable feed and per-event downloads.
section:
    title: Recipes
    order: 1.7
order: 16
lastUpdated: 2026-10-25
outcomes:
    - "What guides build an events calendar, and in what order to follow them"
    - "How to serve one stored event as a page, a feed entry and a download"
    - "Why a downloaded event and a subscribed one show up once"
---

By the end of this recipe your events live in one table as JSCalendar, your events page lists
the upcoming sessions, and the same rows go out as an `.ics` feed people subscribe to and as an
"Add to calendar" download for each event. Every view reads the same object, so they never
disagree about a date.

## Store events as JSCalendar

One stored object serves every later step, so store it first. Follow
[Model events and tasks as JSCalendar](/docs/content-and-feeds/jscalendar) through
[Accept an event or a task](/docs/content-and-feeds/jscalendar#accept-an-event-or-a-task),
whose `toICalendar` check on write keeps the feed and the download convertible.

## List the upcoming sessions

The page shows occurrences rather than rules. Build `upcoming` from
[Expand recurrences into an agenda](/docs/content-and-feeds/jscalendar#expand-recurrences-into-an-agenda)
and render its result from the `agenda.show` controller.

## Publish the feed

Serve the stored entries as `.ics` with
[Publish and import iCalendar](/docs/content-and-feeds/jscalendar#publish-and-import-icalendar).
Before handing `calendar.data` to `calendarResponse`, add the `name`, `url` and
`refreshInterval` from [Serve the feed](/docs/content-and-feeds/calendar-feeds#serve-the-feed),
so a client titles the subscription and polls it hourly.

## Offer each event as a download

An "Add to calendar" button is one entry converted alone and served as an attachment. Add
`download: get("/agenda/entries/:uid/calendar.ics")` to the agenda's routes, and in its action
find the entry by `uid`, pass it to `toICalendar` as the feed does, and give `calendarResponse`
a `filename`, as
[Offer a single event as a download](/docs/content-and-feeds/calendar-feeds#offer-a-single-event-as-a-download)
does. The download keeps the entry's `uid`, so someone who downloads an event and later
subscribes sees one event, not two.

## Test it

Test each stage as its guide does:
[Test the agenda](/docs/content-and-feeds/jscalendar#test-the-agenda) checks `upcoming` and a
round trip through iCalendar, and
[Test the series](/docs/content-and-feeds/calendar-feeds#test-the-series) checks a weekly
series across a daylight saving change.

## Where to go next

- [Publish calendar feeds](/docs/content-and-feeds/calendar-feeds) — time zone blocks, keeping
  past events in the feed, and reading uploaded `.ics` files.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — keep a busy
  feed cheap without delaying a change.
- [Build a date-range picker](/docs/building-remix-apps/calendars-and-date-ranges) — let
  readers pick the window the page lists.
