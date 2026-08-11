# DNS Monitors

## Purpose

A DNS monitor verifies that a **domain**'s records still resolve to what they resolved to when the monitor was set up. The unit is the domain, not one record: the monitor holds a table of the records it discovered, and each check re-resolves them and reports what moved.

## What Users Configure

- Name
- Domain
- Zone file, optional, pasted once
- Check interval
- Enabled or disabled state
- Which of the discovered records are watched, per record

There is no record type to pick and no expected value to type. Every check queries all six supported types at every name the monitor tracks:

- `A`
- `AAAA`
- `CNAME`
- `MX`
- `TXT`
- `NS`

## How It Works

1. The user defines a domain, and may paste a zone file.
2. Discovery runs immediately: for each known name — the domain, plus every name the zone file declares — one query per supported type.
3. The user reviews what was found, record by record, and saves. Records they decline are stored switched off, never dropped, so they are not rediscovered as new forever.
4. Each scheduled check repeats the same sweep and diffs the answers against the stored records.
5. A record found that is not stored is imported switched off, as `new`. A stored watched record that stopped resolving becomes `missing`.

An API-created monitor skips step 3 and watches everything the resolver answered with.

## Record Identity and Normalization

A record's identity is `(name, type, value)`. Values are normalized once, at write time, so a value that arrives from a zone file and the same value from the resolver are one record: IPv6 is lowercased and compressed, host names are lowercased and un-dotted, MX carries its preference, and TXT character-strings are joined with quotes removed and are otherwise byte-exact.

Because DNS gives an individual record no identity of its own, editing one value inside a set holding several reads as one `missing` plus one `new`. `changed` is reserved for the one case the diff can attribute without guessing: a name and type holding exactly one watched record, answering with exactly one differing value.

## Status Model

Per record: `ok`, `changed`, `missing`, `new`, `error`.

Per monitor:

- `ok`: every query answered and every watched record resolved as stored
- `changed`: a watched record is missing or was edited, or a record appeared that nobody configured
- `error`: at least one query did not answer
- `not checked`: no result exists yet

## Result Handling Rules

- A query that does not answer applies **no diff** for that name and type. A resolver having a bad minute must never read as the zone disappearing.
- `NXDOMAIN` and an empty answer both mean "no records of this type here", and are not errors.
- A CNAME at a name suppresses A/AAAA tracking at that name: the addresses returned belong to the alias target.
- The zone file is parsed at submit and discarded. Lines the parser cannot use are reported with their line number and a reason, never silently dropped.

## Scheduling Rules

- DNS monitoring is designed around less frequent checks than HTTP monitoring.
- The default interval is `86400` seconds — once a day.
- The minimum interval is `900` seconds. Detection latency is floored by the record's TTL anyway, so a faster interval buys less than it appears to.

## Visible Outputs

- Current status
- Last checked time
- The record table, with each record's own state and its watched/unwatched switch
- Per-check counters: records checked, changed, missing, new, and queries failed
- Result history
- Success rate
- Response time — the slowest single query in the sweep, not the sum
- Total checks
- Manual check trigger from the detail view, which meters a ping like a scheduled check does

## Defaults and Limits

- Default interval is `86400` seconds.
- DNS monitors are enabled by default, and discovered records are watched by default at review; records discovered by a later check are not.
- A monitor tracks at most `100` names, because one check sweeps every tracked name against a bounded per-invocation query budget.
- The product uses a team-level limit of `20` DNS monitors.
- A check costs one ping, however many queries the sweep made — the resolver is free to us, so it is free to the customer.

## Important Behavior Notes

- A changed record is not the same as a failed lookup. The distinction matters for alerts and status communication.
- The feature is best treated as configuration monitoring, not service-availability monitoring.
- Coverage is bounded by what DNS permits: a zone cannot be enumerated from outside it, so without a zone file a monitor covers the domain itself and nothing else, and the zone file is a snapshot that is never re-fetched.
- Records a zone file declares that do not resolve are shown once at review and stored switched off. On a proxied zone that is the common case, not a fault.
- DNS results reach team-wide alert channels only; there is no per-monitor DNS alert.

## Reimplementation Guidance

Preserve these product rules:

- The expectation is **imported, not typed**. Nothing a user transcribes by hand can be the baseline.
- The record table is the complete set of everything ever seen for the domain; the per-record switch says only whether a deviation alerts.
- A record that appears without the user putting it there is a finding, and accepting it must be an act rather than the thing that happens by ignoring an email.
- DNS-specific statuses stay distinct from HTTP statuses.
- A partial or failed sweep is recorded as partial, never as records vanishing.
