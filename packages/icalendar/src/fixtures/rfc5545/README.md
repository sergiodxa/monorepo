# RFC 5545 examples

The example iCalendar objects printed in [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545),
vendored so `src/rfc5545.test.ts` reads the same text the RFC shows.

- Source: `https://www.rfc-editor.org/rfc/rfc5545.txt`, fetched 2026-09-24
  (ETag `W/"32467f4393ddf21db93abc89ad85a85b"`)
- License: code components of IETF documents are available under the Simplified BSD License
  described in the IETF Trust Legal Provisions; see `LICENSE.md` beside this file

Each file keeps the RFC's lines verbatim, with the seven-space indentation and the page-break
lines of the text rendering removed, and CRLF line endings restored. The RFC prints some examples
as bare components; those files wrap them in a `VCALENDAR` with `VERSION:2.0` and
`PRODID:-//RFC 5545//Examples//EN`, and `section-3.6.6-alarms.ics` also nests the three `VALARM`
examples in one `VEVENT`.

| File                                      | RFC section                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `section-3.4-simple.ics`                  | §3.4, the simple iCalendar object                                            |
| `section-3.6.1-events.ics`                | §3.6.1, the four `VEVENT` examples                                           |
| `section-3.6.5-new-york-full.ics`         | §3.6.5, every New York rule since 1967                                       |
| `section-3.6.5-new-york-dtstart-only.ics` | §3.6.5, New York with `DTSTART` only                                         |
| `section-3.6.5-new-york-rrule.ics`        | §3.6.5, current New York rules as `RRULE`s                                   |
| `section-3.6.5-fictitious-ending.ics`     | §3.6.5, a daylight rule with an end date                                     |
| `section-3.6.5-fictitious-resumed.ics`    | §3.6.5, a daylight rule picked up by a second one                            |
| `section-3.6.6-alarms.ics`                | §3.6.6, the three `VALARM` examples                                          |
| `section-4-*.ics`                         | §4, the six object examples (conference to free/busy), MIME headers left out |
