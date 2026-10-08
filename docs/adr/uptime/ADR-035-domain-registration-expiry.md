# ADR-035: Domain Registration Expiry on DNS Monitors

## Status

**Accepted** - 2026-10-08. Consumes `@sdxc/rdap` ([ADR-120](../ADR-120-rdap-package.md)) and
settles the schema, schedule, alerts and metering its "Usage in `apps/uptime`" section left to
this app.

## Background

A DNS monitor ([ADR-026](./ADR-026-domain-dns-monitors-with-record-import.md)) watches every
record of a zone, and an HTTP monitor can watch a certificate's expiry from a date the customer
types in. Neither watches the date that takes all of them down at once: the day the domain's
registration lapses. The registry publishes that date over RDAP, so the app can read it instead
of asking for it.

## Decision

### 1. Registration is a property of the DNS monitor

The DNS monitor already holds the zone apex (`dns_monitors.domain`), which is the registered
name RDAP is asked about, so the registration columns live on `dns_monitors` and every DNS
monitor gets the check with no extra setup:

| Column                       | Meaning                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `registration_status`        | `unknown`, `valid`, `expiring`, `expired`, `unavailable` or `error`; `unknown` until the first lookup |
| `registration_expires_at`    | The registry's `expiration` date, epoch ms; `null` when it publishes none                             |
| `registration_epp_statuses`  | The EPP statuses of the last successful lookup, JSON array                                            |
| `registrar`                  | The registrar's name from the last successful lookup                                                  |
| `registration_warning_days`  | Days before expiry the registration counts as `expiring`; 30 by default, editable on the edit page    |
| `registration_checked_at`    | When a lookup last **succeeded**                                                                      |
| `registration_error`         | The `RDAPError` code of the last failed lookup, cleared by a success                                  |
| `registration_failures`      | Consecutive failed lookups, which the retry backoff counts                                            |
| `registration_next_check_at` | When the next lookup is due; `null` means now, so a new monitor is looked up on the next sweep        |

A separate table would hold one row per monitor and cost a join on every read of the detail page,
so the columns sit on the monitor. The table is small (20 monitors per team), so the sweep scans
it rather than adding an index on `registration_next_check_at`.

### 2. An hourly sweep with a daily cadence per monitor

`checkDomainRegistrations` runs at the top of every hour, on the hourly trigger the trial watches already use, and claims at most 200 enabled
monitors whose `registration_next_check_at` has passed. A lookup that succeeds schedules the
next one a day later; the hourly delivery exists so a retry does not wait a whole day.

The sweep groups its monitors by `rdap.server(domain)` and runs each registry's lookups two at a
time while registries run side by side, so a team with many `.com` domains stays under
Verisign's undocumented limit. A disabled monitor is skipped.

### 3. Outcomes

| Lookup outcome                 | Status                                                                                                                                                             | Next lookup                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Success                        | From the expiry date and `registration_warning_days`, as certificates are classified                                                                               | One day                                                                     |
| `not-found`, `unsupported-tld` | `unavailable`, with the code shown on the page                                                                                                                     | Seven days, in case the TLD gains RDAP                                      |
| Any other failure              | The stored date's classification when it is `expiring` or `expired`; otherwise `error` once no lookup has succeeded within the warning window; otherwise unchanged | Backoff from one hour to one day, or the server's `Retry-After` when longer |

A failure never erases the stored date, and a stored date inside the warning window keeps
alerting through an outage, so a broken registry never silences a real expiry. `error` is
reached only once the app can no longer vouch that the domain is outside its warning window.

### 4. Alerts go through the DNS monitor's alerts

Registration alerts are a virtual alert kind, `registration`, the way certificate alerts are
`ssl`: they resolve alerts and maintenance windows as `dns` (the monitor they belong to) and are
recorded in `alert_events` as `registration`, with their own snapshot.

- `expiring` alerts on each day within 30, 14, 7 and 1 days of expiry, and `expired` every day,
  the same reminder policy as certificates.
- `redemptionPeriod`, `pendingDelete`, `clientHold` and `serverHold` alert every day whatever the
  date says: each means the domain has stopped, or is about to stop, resolving.
- Entering `error` alerts once.
- Per-alert cooldown bounds the repetition, and there is no recovery event, as with certificates.

### 5. Lookups are free

A registration lookup is not a ping: it is a daily read of public data, like the certificate
re-check, so it is never metered. Its share of the sweep's cost is apportioned to the teams whose
monitors it took, as every sweep's is.

### 6. The detail page shows it

The DNS monitor page gains a Registration panel: status, expiry date, registrar, the EPP statuses,
and why a lookup is unavailable or failing, with the time of the last successful lookup.

## Consequences

- Every DNS monitor gains domain-expiry monitoring with no input from the customer.
- A customer on a TLD with no RDAP service sees "unavailable" and gets no expiry alerts.
- The certificate monitor keeps its manually entered date until a certificate source exists.

## Current Progress

- [x] Migration and schema
- [x] `checkDomainRegistrations` job and the shared expiry classification
- [x] `registration` alerts, snapshot, email and message rows
- [x] Registration panel on the detail page, warning days on the edit page, locale keys in every locale
