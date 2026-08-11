# ADR-026: A DNS Monitor Watches a Domain, Not a Record Type

## Status

**Proposed** — 2026-08-10. Replaces the per-record-type DNS monitor introduced by
`database/migrations/20260208160000_dns_monitors.sql` with a domain-level monitor built
around importing a zone's records and reviewing them. Supersedes the containment matching
added to `app/services/dns-check.ts` days ago (see
[§6](#6-expected_value-is-superseded-not-kept)).

Nothing in this ADR is a migration. There are no DNS monitors in production, which is what
lets the old shape be deleted rather than carried.

## Background

A DNS monitor today is one row: a domain, one record type, and an optional expected value.

```ts
export const dnsMonitors = table({
	name: "dns_monitors",
	// …
	domain: c.text(),
	record_type: c.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
	expected_value: c.text().nullable(),
	interval_seconds: c.integer().default(3600),
	last_status: c.enum(["ok", "changed", "error"]).nullable(),
	last_value: c.text().nullable(),
});
```

That is one query per check and one comparison per check, which is a clean thing to build
and the wrong unit for what people buy DNS monitoring for. Nobody watches an MX record.
They watch a domain, and they want to be told when _anything_ about it moves — because the
failure being insured against ("someone changed my DNS") does not arrive politely inside
the record type you happened to configure.

Expressed with the current shape, watching one domain properly means creating five or six
monitors, each named separately, each with its own interval, each attached to alerts and
status pages separately, each transcribed by hand from a DNS console into an
`expected_value` box. And after all that work it still only covers the apex: `_dmarc`,
`_domainkey`, `www` and every other subdomain need their own five or six monitors each.

The product decision is to make the monitor the domain. This ADR is how.

## Context: what DNS actually permits

Every design constraint below was verified against Cloudflare's DoH JSON API — the same
endpoint `app/services/dns-check.ts` already uses — rather than reasoned about. The queries
are quoted so they can be re-run.

### A zone cannot be enumerated from outside it

```
$ curl -s -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=sergiodxa.com&type=ANY'
{"Status":4, …}
```

`Status 4` is `NOTIMP`. RFC 8482 gutted `ANY` precisely so it could not be used this way,
and `AXFR` — the protocol's actual "give me the zone" verb — is disabled on every
public-facing nameserver worth the name.

**There is no query that answers "what records exist for this domain".** This single fact
is why the zone-file paste is in the product and not an optional convenience: it is the
only channel through which the set of _names_ in a zone can reach us.

### A per-type sweep at one name is complete for that name

```
$ for t in A AAAA CNAME MX TXT NS CAA; do
    curl -s -H 'accept: application/dns-json' \
      "https://cloudflare-dns.com/dns-query?name=sergiodxa.com&type=$t"; done
```

| Type  | Status | Answers |
| ----- | ------ | ------- |
| A     | 0      | 2       |
| AAAA  | 0      | 2       |
| CNAME | 0      | 0       |
| MX    | 0      | 5       |
| TXT   | 0      | 4       |
| NS    | 0      | 2       |
| CAA   | 0      | 10      |

A DNS query returns the **full RRset** for a name and type, not a sample of it. So while
the zone cannot be enumerated, a _name_ can be swept exhaustively across the types we
support, and — this is the load-bearing consequence — **additions are detectable inside a
tracked name**. A sixth MX appearing at `sergiodxa.com` shows up in the same answer as the
other five. Nothing about change detection requires the zone file; only the discovery of
_names_ does.

### Names nobody asked about are invisible

```
$ curl -s -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=_dmarc.sergiodxa.com&type=TXT'
{"Status":0,"Answer":[{"name":"_dmarc.sergiodxa.com","type":16, … "v=DMARC1; …"}, …]}
```

Two TXT records resolve there. Nothing at the apex points to `_dmarc`, and no query on the
apex can lead you to it. That is the gap the zone file closes, and it is the _only_ gap it
closes.

### `NXDOMAIN` is not an error, and today it is treated as one

```
$ curl -s -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=zzz-nope.sergiodxa.com&type=A'
{"Status":3, … "Authority":[{"name":"sergiodxa.com","type":6, …}]}
```

`resolveDns` throws on any non-zero `Status`. For the current shape that is defensible: a
monitor pointed at a name that does not exist is misconfigured. For a sweep it is not — a
zone-file name that has been retired, or a name that has A records but no MX, produces
`Status 3` or an empty answer routinely, and treating that as a failed check would put
every domain monitor permanently in `error`. **`Status 3` (`NXDOMAIN`) and `Status 0` with
an empty `Answer` both mean "no records of this type here" and must be distinguished from
`SERVFAIL`, a network error, or an HTTP failure**, which mean "we did not find out".

### CNAME chasing pollutes an address sweep

```
$ curl -s -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=www.github.com&type=A'
… "Answer":[{"type":5,"data":"github.com."},{"type":1,"data":"4.228.31.150"}]
```

`resolveDns` filters answers to the requested type code, so this reports an `A` record of
`4.228.31.150` at `www.github.com`. There is no such record in GitHub's zone — that is the
_target's_ address, reached by following the CNAME. Tracking it would make the monitor
alert every time an unrelated third party rotated an address, which is the fastest way to
teach a user to ignore us.

### TXT records arrive chunked, and are currently mangled

```
$ curl -s -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=google._domainkey.github.com&type=TXT'
… "data":"\"v=DKIM1; k=rsa; p=MIIBIjANBg…OP\" \"oA7dlR/A/pEC…IDAQAB\""
```

A TXT record longer than 255 bytes is several character-strings, and Cloudflare returns
them as several quoted strings inside one `data` field. The current normalization strips
one leading and one trailing quote, which leaves `…OP" "oA7…` — a value containing a stray
`" "` in the middle. It compares stably against itself, so nothing has broken, but it is
not the record and it is not what a user will paste into an expected-value box or read off
a review screen. A model whose primary key _is_ the value cannot carry that.

### CAA is unsupported, and comes back in generic wire format

`CAA` is absent from `RECORD_TYPE_CODES`, so it is not queryable today. When queried
directly it resolves, in RFC 3597 unknown-type presentation:

```
"data":"\\# 19 00 05 69 73 73 75 65 63 6f 6d 6f 64 6f 63 61 2e 63 6f 6d"
```

That is: 19 bytes, flags `00`, tag length `05`, tag `issue`, value `comodoca.com`.
Supporting CAA needs the type code (257) _and_ a decoder. See
[§12](#12-caa-is-out-of-scope-for-v1) for why that is not v1.

### `SRV` at an apex is empty, as expected

`?name=sergiodxa.com&type=SRV` returns `Status 0` with no answers. SRV lives only at
`_service._proto` names, so it is reachable exclusively through zone-file discovery — one
more reason it is not a v1 sweep type.

### Nothing is in production

`dns_monitors` has never been seeded, backfilled, or altered in a way that implies live
rows; the only migrations touching it are its creation, the index cleanup of ADR-010, the
retention indexes of ADR-020, and the `next_due_at` column of ADR-006. Combined with the
owner's statement that no customer has created one, the old shape can be **dropped and
recreated** rather than migrated.

What that buys, concretely, is the whole reason this ADR is short: no backfill, no dual
read path, no deprecation window on `/api/v1/dns-monitors`, no `AlertEventSnapshot` union
carrying a dead variant for the history view, and no partially-populated `expected_value`
column to reason about. If any of those assumptions is wrong, this ADR is wrong in a way
that is not locally repairable — so **verifying `SELECT count(*) FROM dns_monitors` against
production is step zero of the implementation plan**, not an assumption.

---

## Decision

### 1. One monitor per domain, plus a record table

`dns_monitors` keeps its name and its `monitor_type` spelling of `"dns"` everywhere —
`alert_events.monitor_type`, `monitor_daily_stats.monitor_type`, `PingType`, the API path,
the route names, the Analytics Engine blobs. Renaming the concept to "domain monitor" in
code would be a cross-cutting rename touching stored enum values and an analytics dataset
with history in it, in exchange for nothing a user sees. The **UI copy** may call it a
domain monitor; the schema stays `dns`.

```ts
export const dnsMonitors = table({
	name: "dns_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		/** The zone apex this monitor covers, absolute, lowercased, no trailing dot. */
		domain: c.text(),
		/**
		 * When a zone file was last pasted and parsed. The text itself is deliberately not
		 * stored — see §7. `null` means every tracked name was discovered by resolution.
		 */
		zone_file_imported_at: c.integer().nullable(),
		interval_seconds: c.integer().default(86_400),
		next_due_at: c.integer().nullable(),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(["ok", "changed", "error"]).nullable(),
	},
});
```

Gone: `record_type`, `expected_value`, `last_value`. The first is now a dimension of the
record table, the second is superseded ([§6](#6-expected_value-is-superseded-not-kept)),
and the third was a single joined blob that cannot represent a per-record baseline.

```ts
/**
 * What the last check found for one tracked record. `new` and `missing` are states of a
 * record, not of a check: a record stays `new` until the user enables or deletes it.
 */
export const dnsRecordStates = ["ok", "changed", "missing", "new", "error"] as const;

export const dnsMonitorRecords = table({
	name: "dns_monitor_records",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		dns_monitor_id: c.text(),
		/** Absolute owner name, lowercased, no trailing dot. The apex is `domain` itself. */
		name: c.text(),
		record_type: c.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
		/** Normalized RDATA. Part of the record's identity — see below. */
		value: c.text(),
		/** How this row first entered the table. */
		source: c.enum(["resolver", "zone_file"]),
		/** Whether a deviation from this record alerts. Discovery-time default is `true`. */
		is_enabled: c.boolean().default(true),
		status: c.enum(dnsRecordStates),
		first_seen_at: c.integer(),
		/** Last check at which this exact record resolved. `null` for zone-file-only rows. */
		last_seen_at: c.integer().nullable(),
		last_checked_at: c.integer().nullable(),
	},
});
```

with `UNIQUE (dns_monitor_id, name, record_type, value)`, plus
`(dns_monitor_id, name, record_type)` for the diff read and `(dns_monitor_id, status)` for
the "what needs my attention" list.

#### Record identity is `(name, type, value)`

This is the decision the rest of the design hangs off, and the alternative is tempting:
one row per RRset, holding the joined value, which is what `last_value` was.

It cannot answer the case that matters. An RRset going from five MX values to six is, under
the RRset model, one row whose text changed — so the diff is "the MX records at
example.com changed" and the user is handed two comma-joined strings to compare by eye. Per
value, the sixth MX is an `INSERT` and the other five are untouched, so the alert says _a
new MX record `20 mx.attacker.example` appeared_ and the review screen has exactly one row
to enable or reject.

The cost is real and is accepted: **DNS records have no identity of their own.** An RRset is
a set of RDATA, and editing `10 mail.example.com` to `20 mail.example.com` is, at the
protocol level, indistinguishable from deleting one record and adding another. So an edit
surfaces as one `missing` plus one `new` rather than one `changed`. That is the truthful
rendering, and `changed` exists in `dnsRecordStates` for the one case where it _is_
attributable — a name+type whose RRset has exactly one stored record and exactly one
resolved record, both differing — which the diff can pair without guessing. Anything looser
(pairing by prefix, by edit distance, by count) is a heuristic that will confidently
mis-pair a rotated DKIM key with an unrelated SPF record.

Because identity is the value, **normalization defines identity** and must be total and
stable across both input channels:

| Type      | Normalization                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A         | as returned                                                                                                                                |
| AAAA      | lowercased and `::`-compressed to one canonical form, so `2001:DB8::1` from a zone file and `2001:db8::1` from the resolver are one record |
| CNAME, NS | lowercased, trailing dot stripped                                                                                                          |
| MX        | `<preference> <host>`, host lowercased and un-dotted                                                                                       |
| TXT       | character-strings concatenated with quotes removed, byte-exact otherwise (case and whitespace are significant in SPF and DKIM)             |

These are the rules `comparisonKey` already encodes; what changes is that they run once, at
write time, instead of at every comparison — and that they now have to accept zone-file
text as well as DoH answers.

### 2. Setup is a domain, a textarea, and a daily interval

Three fields: the domain, an optional zone-file paste, and `interval_seconds` defaulting to
**86,400 — once a day**.

Daily because DNS changes are human-caused and human-paced, because a record's TTL puts a
floor under detection latency that a faster interval cannot get below
([§14](#14-honest-limits)), and because of the billing consequence in
[§9](#9-a-swept-domain-costs-one-ping-per-query) — a domain monitor is not one query.

**The minimum interval for a domain monitor is 900 seconds.** Today the floor disagrees with
itself — `app/http/validators/dns-monitor.ts` enforces 300 for the web form while
`app/http/controllers/api/dns-monitors.ts` allows 60 — so this ADR also settles that: one
floor, 900, in both places. A 6-type sweep at 60 seconds is 259,200 queries a month from a
single monitor, two and a half times the entire included allowance, which is not a limit
anybody sets on purpose and the form should not put one click away. The `interval_seconds`
column keeps its type; the floor is a validator and API-schema constraint.

Two other current defaults change with it. `MAX_DNS_MONITORS_PER_TEAM` is 20, which under
the old shape meant "three or four domains"; under this one it means twenty domains, and it
should be re-read as a per-team domain cap rather than left as an unexamined number
([Open Questions](#open-questions)). And the web form currently defaults `is_enabled` to
`false` while the API defaults it to `true` — the review step makes the form's default
untenable, since a user who has just chosen which records to watch has plainly enabled the
monitor. Both become `true`.

### 3. Discovery sweeps every supported type at every known name

The set of known names is `{ domain } ∪ names(zone file)`. For each known name, one query
per supported type.

Four rules the sweep needs that the current resolver does not have:

1. **`Status 3` and an empty `Answer` mean "none", not "error".** Only `SERVFAIL`, a
   transport failure, or a non-2xx HTTP response are errors.
2. **A CNAME at a name suppresses A/AAAA tracking at that name.** Per the `www.github.com`
   evidence, the addresses returned belong to the target. The CNAME itself is tracked; what
   it points to is the target's business.
3. **TXT chunks are joined properly**, per the DKIM evidence above.
4. **Answers are filtered to the queried type code**, which the current implementation
   already does correctly and which matters more now that CNAME answers appear in A queries.

Discovery is the same code path as a check. That is deliberate: a review screen that showed
records a subsequent check would not find is a review screen that lies on day one.

### 4. Review is a step, not a side effect

Creating a monitor runs discovery and lands on a review screen — records grouped by name,
then by type — with **every record checked by default**. Submitting persists them.

**Records the user unchecks are still stored, with `is_enabled = false`.** This is the
invariant the whole diff depends on:

> The record table is the complete set of everything we have ever seen for this domain.
> `is_enabled` says only whether a deviation from it alerts.

Without it, an unchecked record would be rediscovered as _new_ on the very next check and
alert forever, and the user's act of declining to monitor something would be unrepresentable.

The review screen also shows, before the save button, the **projected monthly ping count and
cost** for the interval chosen ([§9](#9-a-swept-domain-costs-one-ping-per-query)). A
40-name zone at 15 minutes is $60 a month, and the screen where the user picks how many
names to import is the only honest place to say so.

### 5. A check resolves, diffs, and produces three kinds of finding

For each known name × supported type, resolve; then compare the resolved value set against
the stored rows for that `(name, type)`:

| Situation                                            | Effect                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| stored, enabled, resolved                            | `status = ok`, `last_seen_at = now`                     |
| stored, enabled, absent                              | `status = missing` → contributes to a `degraded` alert  |
| stored, disabled, resolved                           | `last_seen_at = now`, no alert                          |
| resolved, not stored                                 | `INSERT … is_enabled = false, status = "new"` → alerts  |
| exactly one stored ↔ exactly one resolved, differing | the stored row is updated and marked `changed` → alerts |
| the query failed                                     | **no diff is applied for that (name, type) at all**     |

The last row is the one that will be got wrong if it is not stated: a failed query must
never be read as "every record at that name vanished". A monitor whose resolver is having a
bad minute would otherwise emit a _missing_ alert for the entire zone.

The monitor's `last_status` is `error` if any query failed, otherwise `changed` if any
enabled record is `missing`/`changed` or any record is `new`, otherwise `ok`. The vocabulary
is unchanged, so `shouldNotifyDnsResult`, the status-page derivation, and `monitor_daily_stats`
keep working without learning a new word.

A newly discovered record is imported **disabled** on purpose. The user has two honest
responses to "this appeared and you didn't put it there" — fix their DNS, or accept it — and
enabling the row is the second. Importing it enabled would make "accept" the default that
happens by not reading the email.

### 6. `expected_value` is superseded, not kept

`containsExpected` was added days ago, replacing exact set equality with containment, and it
is deleted here. The reasoning is preserved so it is not rediscovered rather than because it
was wrong.

Containment existed because a monitor watched one RRset and the only way to say what you
expected was to transcribe it into a text box. Set equality made that box a chore (list every
MX or get alerted); containment made it tolerable, at a documented price, quoted from the
current source:

> an attacker who ADDS a hostile record (say a rogue MX that outranks the legitimate ones)
> while leaving the configured ones in place will NOT be flagged

**Per-record tracking makes both modes obsolete, and closes exactly that hole.** The record
table _is_ the expectation — captured by import instead of transcription, held per record
instead of per RRset — and the added-hostile-record case is precisely what the
new-record diff detects and alerts on. There is no configuration left for containment to be
lenient about, so keeping the column would mean maintaining a second, weaker expectation
mechanism that can only disagree with the first.

What survives is the normalization: `comparisonKey`'s per-type folding rules become the
value normalizer of §1. What dies with the free-text token is the `hostOnly` MX affordance —
a token without a space matching any preference — because there is no token any more. A user
who wants to watch `aspmx.l.google.com` at any preference is, under the new model, watching
`10 aspmx.l.google.com` and will be told if the preference changes. That is a stricter and
more honest answer to the same question.

The ad-hoc probe endpoint (`POST /api/v1/ping`, ADR-021) **keeps** its `dns` variant with
`recordType` and `expectedValue`. It is a single synchronous probe with no stored history and
no record table, so "check this one record type against this one value" is still the right
question there. It is the one place the old shape deliberately survives.

### 7. The zone file: the smallest parser that is honest about what it skipped

The zone file exists for one job — **contributing names** — and the parser should be sized
for that job and no larger.

**Supported.** One record per line, `<owner> [<ttl>] [IN] <TYPE> <rdata>`; `;` comments to
end of line, outside quoted strings; blank lines; absolute owners with a trailing dot;
relative owners resolved against the monitor's `domain`; `@` as the apex; quoted TXT
character-strings, several per line, concatenated; the six supported types.

**Not supported, and reported rather than ignored.**

| Construct                             | Why not                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$ORIGIN`                             | The dangerous one. Silently ignoring it makes every relative name _after_ it resolve into the wrong zone, so the import would be confidently, invisibly wrong.                    |
| `$TTL`                                | We do not track TTLs, so honouring it would be work with no output.                                                                                                               |
| `$INCLUDE`                            | Names a file we do not have and must never fetch.                                                                                                                                 |
| `$GENERATE`                           | A loop construct; expanding it can produce thousands of names from one line, which is a billing decision disguised as a parser feature.                                           |
| Multi-line parenthesised records      | In practice only SOA uses them, and SOA is not a tracked type.                                                                                                                    |
| Blank-owner continuation lines        | A line starting with whitespace inherits the previous owner. Cloudflare's export always writes the owner explicitly, so guessing here buys hand-written files a correctness risk. |
| Classes other than `IN`               | `CH` and `HS` are not the internet.                                                                                                                                               |
| CAA, SOA, SRV, PTR, DS, HTTPS/SVCB, … | Not tracked types ([§12](#12-caa-is-out-of-scope-for-v1)).                                                                                                                        |

**A line the parser cannot use is never silently dropped.** Every one comes back with its
line number, its text, and a reason, and the review screen shows them above the record list
as _"N lines were not imported"_. An import that defines what you monitor is the worst
possible place for a silent drop: the user's mental model becomes "I pasted my zone, so it's
covered", and the product would be quietly disagreeing.

**What Cloudflare's Export actually produces.** Cloudflare's own documentation
(`developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/`) describes
standard BIND format — fully-qualified owners with a trailing dot, an explicit numeric TTL
(`1` meaning "automatic"), an explicit `IN` class, one record per line, e.g.
`a.example.com. 60 IN A 1.1.1.1` — and states that exports use inline `;` comments to append
record attributes. It documents a **256 KiB zone-file size limit** and a three-requests-per-
minute export rate limit. The supported subset above covers that output exactly, and the
textarea should reject a paste above 256 KiB for the same reason Cloudflare does.

Honesty about the limit of this research: the public documentation shows _import_ examples,
not a verbatim _export_ sample. The parser must be validated against a real Cloudflare export
before this ships — see [Open Questions](#open-questions).

**The pasted text is not stored.** It is parsed at submit; the records and
`zone_file_imported_at` are kept, the text is discarded. A customer's complete zone is a map
of their infrastructure, and there is no feature we would build on the stored copy that a
re-paste does not serve just as well. Re-running discovery after adding a supported record
type means asking for the file again, which is one interaction on a rare event, against
holding sensitive data indefinitely for every customer.

### 8. A record in the zone file that does not resolve is a finding — at review only

It is a real and useful signal: a stale delegation, a change that never published, a typo
between the console and the zone. **v1 surfaces it on the review screen**, as a
_"declared but not resolving"_ group, stored with `source = "zone_file"`, `status = "missing"`
and `is_enabled = false`.

It does **not** alert on subsequent checks unless the user enables it, and that is the
argued half. At import time the comparison is free and high-signal — both sides are already in
hand. As a standing alert it is a comparison against a snapshot that only gets older: the file
is pasted once and never re-fetched, so every legitimate DNS change the customer makes after
the import widens a divergence we would keep emailing about. Worse, the common way a zone file
reaches us is a provider migration export, where a meaningful fraction of the file is history
by construction.

So: shown once, when it is true, with a checkbox for the user who wants it watched.

### 9. A swept domain costs one ping per check

This is the revenue-affecting decision and it is stated rather than left implicit. **It was
settled by asking whether we pay per query, and we do not.**

`cloudflare-dns.com` is the free public resolver: unauthenticated, not associated with our
account, no per-query fee. `app/lib/cost-rates.ts` is the evidence — fifteen rate-card line
items and not one of them prices an outbound subrequest, because Cloudflare does not charge
for one. The only resource an extra DNS query consumes is `workerCpuMs` at $0.02 per million
ms, and a DNS lookup is almost entirely I/O wait, which Workers does not bill: it charges CPU
time, not wall time. Sweeping six record types instead of one costs us very close to nothing.

**Decision: one ping per check, per domain monitor.** The rule the owner set is that we
charge the way we are charged — per request if we pay per request, per job run if we do not —
and we do not. Billing a sweep as N pings would charge a customer for a cost we never incur.

An earlier draft of this ADR argued for per-query billing on the grounds that 240 queries
billed as one ping was indefensible. That argument assumed the queries cost us something.
They do not, so it collapses: what a domain monitor sells is _one monitored domain_, and that
is the unit to price.

The consequences are all simplifying:

- `app/services/ping-meter.ts` needs no change. `CheckDnsJob` keeps pushing exactly one
  `BillablePing` per monitor per check, keyed `ping:${resultId}` — no ordinal, no new
  dedup surface.
- **`app/lib/pricing.ts` needs no change either.** `monthlyPings`'s docblock assumption —
  _"one check per interval per monitor"_ — stays true for domain monitors, so no
  `queriesPerCheck` factor and no DNS special case. A domain monitor prices exactly like
  every other monitor.
- No cost-projection screen on the review step. It existed only to soften a per-query
  charge; with per-check pricing there is nothing to warn about, and a 40-name zone at 15
  minutes is 2,688 pings a month rather than 645,120 — comfortably inside the base
  subscription.
- "One monitor per domain, every record type" stays a clean sentence in the UI and in
  `resources/content/marketing.ts`, with no asterisk about query multipliers.

**The "Check now" action must still start metering**, and that is now the only billing change
this ADR carries. `app/http/controllers/actions/dns-monitors.ts` runs a check inline and
ingests no ping at all. Under the old shape that was one unbilled `A` lookup per press. Under
this one it is an unbilled full sweep behind a button anybody can hold down — a
denial-of-wallet surface against our own resolver budget before it is a revenue leak. It
meters one ping per press, keyed on the result row it writes, exactly as a scheduled check
does.

### 9a. The subrequest ceiling is a limit, not a cost — and batching is required on day one

Removing the pricing pressure does not remove the engineering constraint, and this one is a
hard failure rather than a gradual one.

Workers caps outbound subrequests per invocation (1,000 on the paid plan). A pasted zone is
attacker-shaped input in the sense that matters here: its size is chosen by the customer, not
by us. Forty names across six types is 240 queries — fine. A large zone at the 256 KiB paste
cap is not, and the failure mode is the whole sweep throwing partway through, which under
[§10](#10-results-stay-per-check) writes one `error` result for a domain whose records are
almost all fine.

**A bounded, batched sweep is therefore a day-one requirement, not a follow-up.** It must:

- run queries with a fixed concurrency ceiling and a hard per-check query budget, both
  named constants with the ceiling documented against the platform limit;
- chunk work across invocations when a zone exceeds one invocation's budget, rather than
  discovering the ceiling in production;
- record a partial sweep as partial — `queries_failed` exists for this — and never let a
  budget cut-off read as "these records are missing", which would alert a customer that
  their DNS broke when in fact we stopped looking;
- cap the number of importable names per monitor at review time, with the limit stated in
  the UI, so a zone that cannot be swept is refused at import rather than at check time.

This supersedes `MAX_DNS_MONITORS_PER_TEAM = 20` as the governing limit for DNS work: the
meaningful bound is now names-per-monitor and queries-per-check, not monitors-per-team.

### 10. Results stay per check

`dns_monitor_results` keeps one row per check of the monitor. Per-query rows would multiply
retention volume by N (ADR-020 governs every result table) for data nothing renders — the
results card and the uptime-history bar are both per check.

`resolved_value` goes; counters replace it:

```ts
status: c.enum(["ok", "changed", "error"]),
records_checked: c.integer(),
records_changed: c.integer(),
records_missing: c.integer(),
records_new: c.integer(),
queries_failed: c.integer(),
response_time_ms: c.integer().nullable(),
```

`response_time_ms` becomes **the slowest single query in the sweep**, not the sum. The column
means "how long did DNS take to answer", it feeds a latency chart, and the sum would silently
convert that chart into a cost chart the day this ships. The sum is recoverable from the ping
count and is not a latency figure.

`monitor_daily_stats` needs no change: `total_checks` / `successful_checks` are per check of
the monitor, and a domain monitor still performs one check per interval.

### 11. Alerting reuses the existing event types

First, a constraint inherited rather than chosen, and one this ADR does not fix: **the
`alerts` table has no `monitor_type` column** (`app/data/alert.ts` says so in its own
header — the table predates DNS, TCP and cron monitors). A DNS result therefore only ever
matches **team-wide** alerts, the ones with `monitor_id IS NULL`, via `Alert.listTeamWide`.
There is no such thing today as an alert scoped to one DNS monitor, and there will not be
one after this ADR either.

That matters more under the new shape than the old one, because a domain monitor is a
higher-volume, noisier source than a single-record monitor: new records appear, zone edits
land, and every one of those reaches every team-wide alert channel. It is named here so it
is a known limitation rather than a surprise, and scoping alerts per monitor is its own ADR.

`alert_events.event_type` is `["down", "up", "degraded"]`, stored, and read by the history
view and `AlertEvent.summarizeIncident`. **No new value is added.** The mapping is the one
`notifyDnsResult` already applies, unchanged:

| Monitor status | `event_type` |
| -------------- | ------------ |
| `error`        | `down`       |
| `changed`      | `degraded`   |
| `ok`           | `up`         |

Adding `changed` or `record_added` to the enum would force a migration, an exhaustive-switch
change in the history view and the digest, and a new branch in `summarizeIncident`, in
exchange for a distinction the email body already draws. The detail belongs in the snapshot,
which is what the snapshot is for.

`AlertEventSnapshot`'s `dns` variant is replaced outright — legal only because there are no
DNS `alert_events` rows to make unreadable:

```ts
| {
    type: "dns";
    status: string;
    domain: string;
    recordsChanged: number;
    recordsMissing: number;
    recordsNew: number;
    /** Up to five findings, each `"<name> <TYPE> <value>"`, for the email body. */
    findings: string[];
  }
```

`shouldNotifyDnsResult` keeps its shape — edge-triggered on a status transition — so
everything ADR-025 built (first-notification-is-incident-scoped, the five-minute repeat
floor, the 60-minute default cooldown) applies with no change.

**One gap, named rather than buried.** Notification is edge-triggered on the _monitor's_
status. A second new record discovered while the monitor is already `degraded` produces no
new transition, so it is not announced immediately; it appears in the next hourly repeat,
whose body lists everything currently outstanding. That is acceptable for v1 — the user has
already been told something is wrong and pointed at a page that lists all of it — but it is a
real difference from "you are alerted when a record appears", and marketing copy must not say
the stronger thing.

### 12. CAA is out of scope for v1

The decoder is fifteen lines. The reason it is not v1 is the _other_ direction: the zone file
declares `example.com. 300 IN CAA 0 issue "letsencrypt.org"`, the resolver returns
`\# 19 00 05 69 73 73 75 65 …`, and identity is the value — so the two must normalize to the
same string or **every CAA record reads as `missing` plus `new` on the first check after
import**. That is an encoder, a decoder, and a normalization all three of which have to agree,
on a type with three flavours (`issue`, `issuewild`, `iodef`), quoting rules of its own, and a
flags octet.

Not free, and worth naming the cost: **CAA is arguably the highest-value record for the
domain-hijack story**, because a rogue CAA record is how an attacker gets a certificate
issued. Shipping DNS-change monitoring without it is shipping the second-best version of the
headline use case. It is the first thing in v1.1, not a someday.

Also out of v1: `SOA` (its serial increments on every zone edit, so it would alert on every
legitimate change — permanent noise), and `SRV`/`PTR`/`DS`/`DNSKEY`/`HTTPS`/`SVCB` (reachable
only via zone-file names, and sweeping them at every name is a query per name for types almost
no zone has).

### 13. The public API changes shape, with no deprecation window

`/api/v1/dns-monitors` keeps its path and its existing `dns-monitors:read` /
`dns-monitors:write` scopes. The records sub-resource reuses them rather than adding a
scope: a key that may reconfigure a domain monitor may decide which of its records are
watched, since the two authorities are the same authority.

- **Create** takes `{ name, domain, zoneFile?, intervalSeconds?, isEnabled? }`. `recordType`
  and `expectedValue` are gone. `intervalSeconds` floors at 900 and defaults to 86,400.
- **An API create imports and enables everything discovered**, with no review step. There is
  no reviewer on an API call; the review screen exists because a human is standing there. The
  records sub-resource is how a script disables what it does not want.
- **New:** `GET /api/v1/dns-monitors/:dnsMonitorId/records` and a `PATCH` to toggle
  `isEnabled` per record.
- `GET …/results` keeps its path; its payload carries the counters of §10 instead of
  `resolvedValue`.

This is a breaking change to a public, documented, versioned API shipped without a `v2`. It is
justified by exactly one fact — no DNS monitors exist — and by nothing else. If that fact does
not hold, this section does not either.

### 14. Honest limits

Written to be quotable, because `resources/content/marketing.ts` states in its own docblock
that trust-indicator figures _"are claims about our own product, so they track what Uptime
actually does today"_, and every line below is a place that rule could be broken.

- **We cannot list your DNS records.** DNS does not allow it — `ANY` returns `NOTIMP` and zone
  transfer is disabled. Without a zone file we see your apex and nothing else.
- **A record added at a name we have never queried is invisible to us.** Discovery is per name.
  If `staging.example.com` is not in the zone file you pasted, a record appearing there is not
  detected.
- **The zone file is a snapshot.** It is pasted once, parsed once, and never re-fetched. Names
  added to your zone after the import are not tracked until you paste again.
- **Six record types in v1**: A, AAAA, CNAME, MX, TXT, NS. Not CAA, SOA, SRV, PTR, DS, DNSKEY,
  HTTPS or SVCB. Copy must say "six record types", never "all your DNS records".
- **We resolve through one recursive resolver**, Cloudflare's DoH endpoint. We do not query
  each authoritative nameserver, so we do not detect disagreement between them, and we do not
  detect regional propagation differences.
- **Detection latency is floored by the record's TTL, not by the check interval.** A recursive
  resolver serves a cached answer; a 15-minute check against a 24-hour TTL does not find out
  fifteen minutes after a change. Any figure about how fast a DNS change is caught must state
  the interval, in line with the same docblock's rule that alert-delivery figures are omitted
  because they belong to somebody else's infrastructure.
- **We do not report DNSSEC validation state.**
- **A second finding during an ongoing incident waits for the next repeat**, and DNS alerts
  reach team-wide alert channels only ([§11](#11-alerting-reuses-the-existing-event-types)).

**One existing claim is already false and must be corrected as part of this work.**
`resources/content/marketing.ts` states, on the DNS feature page:

> Propagation-aware — Checks account for normal DNS propagation delay before alerting

There is no propagation grace period anywhere in `app/services/dns-check.ts`. A single
differing lookup classifies as `changed` immediately, and this ADR does not add a grace
period either. By that file's own rule — figures about our own product "track what Uptime
actually does today" — the line has to go, or a confirming re-check has to be built. It is
listed as a task rather than left as a copy edit because it is the kind of claim a customer
would reasonably rely on.

---

## Migration

Every dependent surface, enumerated.

### Schema and migrations

| File                                        | Change                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database/schema.ts` — `dnsMonitors`        | drop `record_type`, `expected_value`, `last_value`; add `zone_file_imported_at`; `interval_seconds` default → 86,400                                                                        |
| `database/schema.ts` — new                  | `dnsRecordStates`, `dnsMonitorRecords`                                                                                                                                                      |
| `database/schema.ts` — `dnsMonitorResults`  | drop `resolved_value`; add `records_checked`, `records_changed`, `records_missing`, `records_new`, `queries_failed`                                                                         |
| `database/schema.ts` — `AlertEventSnapshot` | replace the `dns` variant                                                                                                                                                                   |
| `database/migrations/`                      | one new migration: `DROP TABLE dns_monitor_results; DROP TABLE dns_monitors;` then create all three tables and their indexes, including `UNIQUE (dns_monitor_id, name, record_type, value)` |

The generated SQL **must** be reviewed before commit and the re-emitted `*_id_unique` indexes
deleted, per `apps/uptime/AGENTS.md` and ADR-010. ADR-020 added no index of its own to
`dns_monitor_results` because `dns_monitor_results_checked_at_idx` already served the
retention sweep — so that index is load-bearing for `CleanJob` and must be re-created with
the table, not quietly lost with it.

### Services and data

| File                                                              | Change                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/services/dns-check.ts`                                       | rewrite: sweep, `NXDOMAIN` handling, CNAME suppression, TXT chunk joining, `comparisonKey` → value normalizer, delete `containsExpected`. **`resolveDns` is also imported by `app/services/trial-guard.ts`** for SSRF and DNS-rebinding defence — that export's signature and its throw-on-failure behaviour must survive the rewrite, or a security control breaks silently |
| `app/services/zone-file.ts` (new)                                 | the §7 parser, returning records **and** unparsed lines                                                                                                                                                                                                                                                                                                                      |
| `app/data/dns-monitor.ts`                                         | rewrite `claimDue` (`CLAIM_COLUMNS` loses `record_type`/`expected_value`/`last_value`), `recordCheckResult`; re-read `MAX_DNS_MONITORS_PER_TEAM`                                                                                                                                                                                                                             |
| `app/data/dns-monitor-record.ts` (new)                            | list, bulk upsert, the diff query, enable/disable                                                                                                                                                                                                                                                                                                                            |
| `app/jobs/check-dns.ts`                                           | per-monitor sweep with bounded concurrency (ADR-008 still governs), one `BillablePing` per query                                                                                                                                                                                                                                                                             |
| `app/jobs/notify.ts`                                              | the `"dns"` consumer branch reloads the monitor and re-applies the policy — it must reload the _findings_, not just a status, or the redelivered email loses its body                                                                                                                                                                                                        |
| `app/lib/notify-queue.ts`                                         | the DNS `NotifyMessage` variant                                                                                                                                                                                                                                                                                                                                              |
| `app/jobs/clean.ts`                                               | `DNS_RESULT_RETENTION_DAYS = 90` still applies to the per-check rows; unchanged, but the sweep must be re-pointed if `dns_monitor_results` is recreated. **`dns_monitor_records` gets no retention sweep** — it is configuration, not history                                                                                                                                |
| `app/jobs/report-costs.ts`                                        | joins `dns_monitor_results → dns_monitors`; still one row per check, so the join survives. Per-check infrastructure cost is now N subrequests, which ADR-007's apportionment already spreads by team                                                                                                                                                                         |
| `app/jobs/aggregate-daily-stats.ts`                               | keyed on `dns_monitor_id`/`checked_at`; unchanged                                                                                                                                                                                                                                                                                                                            |
| `app/services/alerts.ts`                                          | `notifyDnsResult` snapshot; `snapshotLines`' DNS branch (`Domain:` / `Status:` / `Resolved value:`) becomes a findings list; `shouldNotifyDnsResult` unchanged                                                                                                                                                                                                               |
| `app/emails/alert.tsx`                                            | the DNS case in the email body                                                                                                                                                                                                                                                                                                                                               |
| `app/services/status-page.ts`                                     | `deriveDnsStatus` — unchanged, the three statuses survive                                                                                                                                                                                                                                                                                                                    |
| `app/services/account-export.ts`                                  | the GDPR export writes `dns_monitors` rows; it must also export `dns_monitor_records`, or the export stops describing what the user configured                                                                                                                                                                                                                               |
| `app/services/analytics.ts`                                       | unchanged — `writePingResult` still takes one status per check                                                                                                                                                                                                                                                                                                               |
| `app/data/maintenance-window.ts`, `app/services/funnel-events.ts` | `"dns"` type members; unchanged                                                                                                                                                                                                                                                                                                                                              |
| `app/jobs/verify-domain-ownership.ts`                             | a **second, duplicate** DoH client with its own schema. Not in scope, but the rewrite of `dns-check.ts` is the moment to notice it and decide whether it collapses into one resolver                                                                                                                                                                                         |

### HTTP surfaces

| File                                                                | Change                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/http/controllers/api/dns-monitors.ts` / `dns-monitor.ts`       | create/update bodies, serializer (`recordType`, `expectedValue`, `lastValue` leave it), results payload                                                                |
| `app/http/controllers/api/dns-monitor-records.ts` (new)             | list + toggle, on the existing `dns-monitors:*` scopes                                                                                                                 |
| `app/http/controllers/api/ping.ts`                                  | **unchanged, deliberately** ([§6](#6-expected_value-is-superseded-not-kept))                                                                                           |
| `app/http/controllers/actions/dns-monitors.ts`                      | `create` takes a zone file and lands on review; `check` now meters ([§9](#9-a-swept-domain-costs-one-ping-per-query)); new record enable/disable and re-import actions |
| `app/http/validators/dns-monitor.ts`                                | drop `record_type`/`expected_value`; interval floor 900; `is_enabled` default `true`; new zone-file and record-toggle schemas                                          |
| `resources/views/dns-monitors/form.tsx`                             | the shared field markup the edit page uses                                                                                                                             |
| `app/http/controllers/app/team/dashboard-panel.tsx`                 | the `dns` tab's `DnsTable` shows a record type per row today                                                                                                           |
| `app/http/controllers/app/team/dns-monitor-new.tsx`                 | domain + zone-file textarea + interval                                                                                                                                 |
| `app/http/controllers/app/team/dns-monitor-review.tsx` (new)        | the review screen, unparsed-lines block, projected cost                                                                                                                |
| `app/http/controllers/app/team/dns-monitor-show.tsx`                | record list with per-record state and enable/disable                                                                                                                   |
| `app/http/controllers/app/team/dns-monitors.tsx`                    | list: record counts instead of record type                                                                                                                             |
| `app/http/controllers/app/team/dns-monitor-edit.tsx`                | interval and name only; re-import is its own action                                                                                                                    |
| `app/http/controllers/app/team/dns-monitor-card-results.tsx`        | counters instead of `resolved_value`                                                                                                                                   |
| `app/http/controllers/app/team/dns-monitor-card-uptime-history.tsx` | unchanged in shape                                                                                                                                                     |
| `app/http/controllers/app/team/dashboard-card-count.tsx`            | unchanged in code; **changed in meaning** — one domain is one monitor, so the DNS count now understates records watched. Worth a tooltip.                              |
| `app/http/controllers/status-page.tsx`                              | `dnsServices` derives status from the monitor row, so it survives; the display label should stop implying a record type                                                |

`status_page_dns_monitors` needs no change: it joins on `dns_monitor_id`, which still exists.
`app/data/team-digest.ts` needs no change: its `UNION ALL … 'dns' AS type … FROM dns_monitors`
reads only `id`, `name`, `team_id`.

### Routing and content

| File                                           | Change                                                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/web.ts`                                | + `dnsMonitors.review`, + record enable/disable actions, + re-import action, + `api.v1.dnsMonitors.records`                                                                                                                            |
| `bootstrap/app.tsx`                            | register the new controllers                                                                                                                                                                                                           |
| `app/locales/{en,es,de,fr,it,ja}.ts`           | new keys under `page.dnsMonitors.*`, `page.createDnsMonitor.*`, `page.editDnsMonitor.*`, `page.dnsMonitorDetail.*`, `page.dashboard.stats.dnsMonitors.*`, `action.*DnsMonitor.*`; the `record_type` and `expected_value` field keys go |
| `resources/docs/concepts/dns-monitors.md`      | rewrite: "Record Type" is no longer a configuration option; add the limits of §14                                                                                                                                                      |
| `resources/docs/api/resources/dns-monitors.md` | the five endpoints' bodies and samples, plus the new records sub-resource                                                                                                                                                              |
| `docs/dns-monitors.md`                         | the internal spec — configurable fields and the "How It Works" steps are both now wrong                                                                                                                                                |
| `resources/content/marketing.ts`               | the `features.dns` record; every claim checked against §14, including the propagation line                                                                                                                                             |
| `app/lib/pricing.ts`                           | unchanged — per-check billing keeps `monthlyPings`'s one-check-per-interval assumption true for domain monitors                                                                                                                        |

---

## Implementation plan

Each item is one agent's work. **Phase 0 is the contended set and is one commit by one
agent** — schema, routes and bootstrap are touched by nearly everything below, and settling
them first is what makes the rest parallelisable.

**Phase 0 — settle, sequentially**

- [x] 0.1 ~~Verify `SELECT count(*) FROM dns_monitors` and `dns_monitor_results` against
      production is zero.~~ **Done.** Queried production directly: `dns_monitors` 0,
      `dns_monitor_results` 0, `tcp_monitors` 0 (`monitors` 7, `cron_job_monitors` 13). The
      table-dropping and the undeprecated API break are safe, and get more expensive the
      longer this waits.
- [ ] 0.2 Obtain a real Cloudflare zone export and commit it as a parser fixture.
      **Partially done.** A real export could not be obtained, so
      `app/services/fixtures/sergiodxa.com.reconstructed.zone` was built instead: real RRsets,
      read back from the DoH API on 2026-08-10 for names the zone's own dashboard lists, laid
      out per Cloudflare's published import/export format, plus one line for every "not
      supported" row of §7. Its header says so. **The §7 BIND subset is still unverified
      against genuine Cloudflare output**, so [Open Question 5](#open-questions) stands and
      this box stays unticked.
- [x] 0.3 ~~`database/schema.ts` + the migration, SQL reviewed by hand for re-emitted
      `*_id_unique` indexes and for ADR-020's retention indexes.~~ **Done** —
      `database/migrations/20260810100000_dns_domain_monitors.sql`. Three deviations, argued
      in the migration's own header: `dns_monitors_is_enabled_idx` is not re-created (nothing
      seeks on it alone), `dns_monitor_records` gets no `(dns_monitor_id, name, record_type)`
      index (it is the leading prefix of the unique index, which SQLite seeks into by
      prefix), and the five result counters carry `DEFAULT 0` so a caller with nothing to
      report writes a truthful zero rather than being unable to insert. The
      `AlertEventSnapshot` `dns` variant was subtracted, not replaced: `recordType` and
      `resolvedValue` are gone, and the counters and findings arrive with the diff that
      produces them (2.2).
- [x] 0.4 ~~`routes/web.ts` + `bootstrap/app.tsx`: every new route registered against a
      stub.~~ **Done.** Every stub answers `501`, never an empty list or a placeholder row.
- [x] 0.5 ~~`app/locales/en.ts` key skeleton, then the six translations.~~ **Done** — 209
      DNS-scoped keys, verified to resolve in all six locales by key-path comparison against
      `en.ts` rather than by a green suite.

**Phase 1 — parallel, no shared files**

- [ ] 1.1 `app/services/zone-file.ts` + tests, driven by the 0.2 fixture. Must cover every
      "not supported" row of §7 producing a reported line, not a drop.
- [ ] 1.2 `app/services/dns-check.ts` rewrite + tests: sweep, `NXDOMAIN` vs `SERVFAIL`, CNAME
      suppression, TXT chunk joining, value normalization (both input channels agree).
      **`trial-guard.ts`'s use of `resolveDns` must keep working** — run `trial-guard`'s tests
      as part of this task, not later.
- [ ] 1.3 `app/data/dns-monitor.ts` + `app/data/dns-monitor-record.ts` + tests, including the
      diff query and the `missing`/`new`/`changed` classification.

**Phase 2 — depends on Phase 1**

- [ ] 2.1 `app/jobs/check-dns.ts`: sweep with bounded concurrency and a hard query budget
      (§9a), **one ping per check keyed `ping:${resultId}`** — no ordinal, per §9 — and no diff
      applied for a failed query.
- [ ] 2.2 `app/services/alerts.ts` snapshot + findings, `app/emails/alert.tsx`,
      `app/jobs/notify.ts`, `app/lib/notify-queue.ts` — one agent, since a findings list has to
      survive the queue hop intact.
- [ ] 2.3 API — create/update/show/index rewrite, validators, and the actions controller
      (including metering "Check now").
- [ ] 2.4 API — the records sub-resource.
- [ ] 2.5 Dashboard — new + review screens, including the unparsed-lines block and the
      names-per-monitor cap enforced at import (§9a). No cost projection: per-check billing
      removed the need for one.
- [ ] 2.6 Dashboard — show / list / edit / results card / `dashboard-panel.tsx` DNS tab /
      `resources/views/dns-monitors/form.tsx`.
- [ ] 2.7 `status-page.tsx` labelling and `app/services/account-export.ts`.

**Phase 3 — copy and cleanup**

- [ ] 3.1 ~~`app/lib/pricing.ts` + the calculator copy that interpolates it.~~ **Dropped
      from scope** — per-check billing (§9) leaves `monthlyPings`'s one-check-per-interval
      assumption true, so the calculator needs no change.
- [ ] 3.2 `resources/docs/concepts/dns-monitors.md`, `resources/docs/api/resources/dns-monitors.md`
      and `docs/dns-monitors.md`.
- [ ] 3.3 `resources/content/marketing.ts`, checked line by line against §14. The
      "propagation-aware" claim is already deleted (no grace period exists; the first non-ok
      result notifies), as is "every record type in one monitor" — which this ADR would
      finally make true and which may be worth reinstating once it ships.
- [ ] 3.4 Delete dead code: the record-type enum's import sites that no longer have a record
      type to validate. **Amended:** this originally also listed `containsExpected` and the
      `hostOnly` MX path, which contradicts §6 — that section keeps the ad-hoc probe's `dns`
      variant, and those two are its mechanism. Both are retained, rescoped and re-documented
      as belonging to the stateless probe alone. Follow this amendment, not the original line.

---

## Consequences

### Positive

- **One domain is one monitor.** Setup goes from five or six hand-transcribed monitors to a
  domain, a paste, and a review, and the alerts, status-page attachment and interval are
  configured once.
- **The expectation is imported, not typed.** The commonest failure of the old shape — a
  typo'd `expected_value` producing a monitor that is confidently wrong — is unrepresentable.
- **Additions are detected.** The documented hole in containment matching, where a hostile
  record added alongside the legitimate ones passed, is closed by construction.
- **Subdomains are reachable** for the first time, via the zone file.
- **The unit of billing matches the unit of work**: one monitored domain, one ping per check.
  It costs us nothing extra to sweep every record type, so it costs the customer nothing
  extra, and the pricing calculator needs no special case for DNS.

### Negative

- **A public API breaks with no deprecation window**, on the sole justification that nobody
  uses it.
- **A large pasted zone can exceed one invocation's subrequest budget**, and the exposure is
  set by how many names the customer pastes. Per-check billing means this is a reliability
  problem rather than an invoice problem, but it fails harder: the batching, the query budget
  and the names-per-monitor cap in [§9a](#9a-the-subrequest-ceiling-is-a-limit-not-a-cost--and-batching-is-required-on-day-one)
  are required on day one, not deferrable.
- **CAA is absent from the version that markets domain-hijack detection**
  ([§12](#12-caa-is-out-of-scope-for-v1)).
- **A value edit reads as a removal plus an addition** for any RRset with more than one record.
  Truthful, and it will be reported as a bug.
- **Discovery without a zone file covers the apex only**, which is a weaker product than the
  words "domain monitoring" suggest and must be said plainly in the setup screen, not only in
  the docs.

### Neutral

- `monitor_type` stays `"dns"` everywhere, so `alert_events`, `monitor_daily_stats`, the
  Analytics Engine dataset and `PingType` are untouched.
- `status_page_dns_monitors` and the team digest need no change.
- The ad-hoc ping endpoint keeps the per-record-type DNS probe, which is the correct shape for
  a stateless single probe.

---

## Open Questions

Each of these is the owner's call, and none is invented here.

1. **The 900-second minimum interval.** Argued in [§2](#2-setup-is-a-domain-a-textarea-and-a-daily-interval),
   not decided by the owner. The other monitor types floor at 60.
2. **Is the projected cost advisory or a cap?** The review screen shows it. Whether a monitor
   whose projection exceeds some threshold requires an extra confirmation, or is refused, is a
   commercial decision.
3. **Should an API-created monitor enable everything, or nothing?** [§13](#13-the-public-api-changes-shape-with-no-deprecation-window)
   chooses "everything", on the grounds that a script that wanted nothing monitored would not
   have created the monitor. The safer default is the opposite.
4. **Storing the pasted zone file.** [§7](#7-the-zone-file-the-smallest-parser-that-is-honest-about-what-it-skipped)
   says no, on data-sensitivity grounds. It costs a re-paste whenever discovery needs to re-run.
5. ~~**A verbatim Cloudflare export sample could not be obtained.**~~ **Resolved.** The owner
   exported a real zone (`app/services/fixtures/sergiodxa.com.txt`); §7's subset parses it to
   42 records, 2 rejected (SOA and CAA, both correctly outside the v1 type set) and 1
   duplicate. It corrected four assumptions: Cloudflare emits no `$ORIGIN`/`$TTL` and
   fully-qualifies every owner, its SOA line's owner is missing the trailing dot every other
   line has, inline comments carry `cf_tags=` metadata, and a zone file can contain the same
   `(name, type, value)` twice — DNS dedupes it at resolution, so the import path must too.
   The reconstructed fixture is retained: it is the only source of the unsupported-syntax
   rows, and the only one containing A/AAAA at all.
6. **UI naming.** The schema stays `dns`. Whether the product calls these "DNS monitors" or
   "domain monitors" in copy, navigation and the docs is unresolved, and mixing the two would
   be worse than either.
7. **The during-incident notification gap** ([§11](#11-alerting-reuses-the-existing-event-types)).
   Accepted for v1; whether a second discovery deserves its own immediate notification is a
   policy question adjacent to ADR-025's.
8. **CAA timing.** Named as v1.1 here. If the domain-hijack story is the headline, it may
   belong in v1 and this ADR should be re-scoped rather than followed.
9. **What a domain monitor promises about proxied records.** Discovered while parsing a real
   export, and it is a product question rather than a parser one. A Cloudflare-proxied record
   does not appear in the zone export at all, and resolves as the proxy's own address: the
   owner's zone exports zero A/AAAA records while its apex resolves to two Cloudflare edge
   addresses, and `gh.sergiodxa.com` exports as a `CNAME` while DoH answers with A records and
   no CNAME. Neither channel is wrong — the customer's record genuinely is not in public DNS.
   The consequence is that on a proxied zone, [§8](#8-a-record-in-the-zone-file-that-does-not-resolve-is-a-finding--at-review-only)'s
   "declared but not resolving" group is the **common** case, not the exceptional one, and the
   review screen must not imply something is broken. Neither the parser nor the resolver
   special-cases it; both report what they observe.
10. **`MAX_DNS_MONITORS_PER_TEAM` stays at 20.** Under the old shape that was three or four
    domains' worth; under this one it is twenty domains, each of which may carry hundreds of
    records. Whether the cap belongs on monitors, on tracked records, or on projected queries
    per month is a commercial question this ADR does not answer.
11. **Per-monitor DNS alerts.** `alerts` has no `monitor_type` column, so DNS results only
    reach team-wide alerts ([§11](#11-alerting-reuses-the-existing-event-types)). A domain
    monitor is noisier than the thing it replaces, so this may become the blocking gap rather
    than an inherited quirk — but fixing it is a change to the alert model, not to DNS.
12. **Does the "propagation-aware" claim get deleted or built?** Deleting it is one line.
    Building it means a confirming re-check before a `changed` classification, which is a
    second query, a second ping, and a detection-latency change across the whole feature.

## References

- [ADR-006: Honour `interval_seconds` for TCP and DNS](./ADR-006-honour-interval-seconds-for-tcp-and-dns.md) — `next_due_at` claiming, unchanged here
- [ADR-008: Bounded Concurrency Sweeps](./ADR-008-bounded-concurrency-sweeps.md) — still governs the sweep, which now fans out further
- [ADR-010: Drop Redundant Duplicate Id Indexes](./ADR-010-drop-redundant-duplicate-id-indexes.md) — the generated-SQL review the new migration needs
- [ADR-020: Retention for Every Result Table](./ADR-020-retention-for-every-result-table.md) — the indexes a `DROP TABLE` would take with it
- [ADR-021: An Ad-Hoc Ping API, and Metering Every Ping to Polar](./ADR-021-ad-hoc-ping-api-and-ping-metering.md) — the metering path §9 extends, and the probe endpoint §6 leaves alone
- [ADR-025: An Ongoing Outage Keeps Alerting](./ADR-025-alert-repeat-policy.md) — the repeat policy §11 inherits unchanged
- RFC 8482 — why `ANY` returns `NOTIMP`
- RFC 3597 — the generic RDATA presentation CAA arrives in
- `apps/uptime/app/services/dns-check.ts`, `app/jobs/check-dns.ts`, `app/services/ping-meter.ts`, `app/lib/pricing.ts`, `app/services/alerts.ts`, `database/schema.ts`
