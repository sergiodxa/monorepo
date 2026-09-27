# RFC 5546 examples

The group-event iCalendar objects printed in [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546)
§4.2, vendored so `src/itip.test.ts` reads the same text the RFC shows.

- Source: `https://www.rfc-editor.org/rfc/rfc5546.txt`, fetched 2026-09-26
  (ETag `W/"997345de311b0f017d9e73fbc8e35007"`)
- License: code components of IETF documents are available under the Simplified BSD License
  described in the IETF Trust Legal Provisions; see `LICENSE.md` beside this file

Each file keeps the RFC's lines verbatim, with the six-space indentation and the page-break lines
of the text rendering removed, and CRLF line endings restored. Two printed typos are corrected so
the objects parse: §4.2.1's `DTEND:19970701T2100000Z` has one digit too many and reads
`DTEND:19970701T210000Z`, and §4.2.9's first `ATTENDEE;CUTYPE=INDIVIDUAL;mailto:a@example.com`
has `;` where the value's `:` belongs.

| File                                 | RFC section                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `section-4.2.1-request.ics`          | §4.2.1, a group event request                        |
| `section-4.2.2-reply.ics`            | §4.2.2, an attendee accepts                          |
| `section-4.2.3-update.ics`           | §4.2.3, the organizer moves the event (`SEQUENCE:1`) |
| `section-4.2.9-cancel.ics`           | §4.2.9, the organizer cancels the event              |
| `section-4.2.10-remove-attendee.ics` | §4.2.10, the `CANCEL` sent to a removed attendee     |
| `section-4.2.10-updated-request.ics` | §4.2.10, the updated request to everyone else        |
