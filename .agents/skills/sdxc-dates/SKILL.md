---
name: sdxc-dates
description: "@sdxc/dates does calendar work over the platform `Date`, formatting every human-facing string with `Intl` and taking every time zone explicitly: `formatDate`/`formatTime`/`formatRelative`/`formatDuration`/`formatParts`, `startOfDay`/`diffInDays`/`eachDayOfInterval`, `add`/`subtract`, `toDayKey`/`fromDayKey`. Use when formatting a timestamp for a reader, bucketing rows by calendar day, building a day grid, or turning a `YYYY-MM-DD` segment into query bounds."
---

# @sdxc/dates

Calendar questions ("what day is this instant on?") take the IANA zone as a required argument, so an answer is always about a stated calendar; instant arithmetic (`add`, `subtract`, `addDays`, `elapsed`) takes no zone, because a length of time is the same length everywhere. Every human-facing string comes from `Intl`, through cached formatter instances, and the parsers (`parseDate`, `parseDayKey`, `fromDayKey`) return a `Result` rather than producing an `Invalid Date`. Day grids are first-class: `daysOfYear`, `lastNDays` and `groupByWeek` return `Day` cells with `key`, `weekday` and the day's first instant already resolved. Any runtime with `Intl`.

Full API, options and examples: [packages/dates/README.md](packages/dates/README.md)

## When to reach for it

- A timestamp has to be rendered in a reader's locale and zone, or worded relatively ("3 days ago", "yesterday").
- Rows have to be grouped into daily buckets that land on the reader's calendar rather than the server's.
- A contribution-graph-style grid, a month view or a rolling N-day window has to be laid out.
- A `YYYY-MM-DD` value from a URL or a column has to become the pair of instants a query filters between.
- A design needs the pieces of a date in separate elements, in the locale's own order.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/dates": "workspace:*" } }
```

```ts
import { add, formatDate, formatRelative, lastNDays, startOfDay, toDayKey } from "@sdxc/dates";

let locale = "en-US";
let timeZone = "America/New_York";

formatDate(publishedAt, { locale, timeZone }); // "Jul 29, 2026"
formatRelative(publishedAt, { locale, now }); // "3 days ago"

toDayKey(new Date("2026-07-29T02:00:00Z"), timeZone); // "2026-07-28"
startOfDay(new Date(), timeZone);
lastNDays(90, { timeZone });

let expiresAt = add(new Date(), "30 days");
```

## Suggestions

- Resolve the reader's locale and zone once, at the edge, and pass both down; every call site then reads as a statement about that reader's calendar. Nothing here defaults the zone.
- Group aggregations on `toDayKey()` rather than on a truncated timestamp, then look each grid cell up by `day.key` in constant time.
- `endOfDay()` is the day's last millisecond, not the next midnight, so a day range is closed at both ends and stays correct on days that are 23 or 25 hours long.
- `formatDuration` takes a `DurationInput`, so `"90 minutes"` and a millisecond count both word the same way; `maxUnits` trims it to the largest components.
- Use `formatParts()` instead of reaching for a pattern string when a layout needs the pieces separately — the parts arrive in the locale's own order, which is what keeps it correct where the day precedes the month.
- `parseDate()` reads a date-only string as UTC midnight; when the input names a calendar day, use `fromDayKey()` with the zone instead.

## Related

- `@sdxc/duration` — the `DurationInput` that `add`, `subtract` and `formatDuration` take; skill `sdxc-duration`
- `@sdxc/result` — the `Result` the parsers return; skill `sdxc-result`
- `@sdxc/cron` — produces the instants a schedule fires at, which these formatters render; skill `sdxc-cron`
