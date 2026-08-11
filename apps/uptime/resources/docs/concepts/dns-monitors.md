---
title: DNS Monitors
description: Watch a whole domain. Import its records once, then get alerted when one changes, stops resolving, or appears without you.
section:
  title: Concepts
  order: 2
order: 3
lastUpdated: 2026-08-11
---

A DNS monitor watches a **domain**, not a single record. One monitor covers your domain's apex — plus every name a zone file you paste declares — and on each check it queries six record types at each of those names.

What the monitor expects is the set of records it discovered, held one row per `(name, type, value)`. Nothing is transcribed into an expected-value box, and nothing is compared as one joined blob, so a record appearing beside the ones you already have is reported as an addition rather than hidden inside a string that changed.

DNS records control how users reach your website, where your email is delivered, and how third-party services verify your domain ownership. Monitoring them helps you:

- **Detect unauthorized changes** — a record edited without authorization can indicate a compromised registrar account or a domain hijacking attempt
- **Catch misconfigurations** — a typo or a wrong value shows up as a finding instead of as an outage
- **Notice delegation changes** — nameserver records changing unexpectedly is a signal worth acting on immediately

## What We Can and Cannot See

These limits come from DNS itself, and they shape everything below. They are stated first because a monitor is only as useful as your understanding of what it covers.

- **We cannot list your DNS records.** There is no query that answers "what records exist for this domain": `ANY` queries are answered `NOTIMP`, and zone transfer is disabled on every public nameserver worth the name. A zone file you paste is the only channel through which the _names_ in your zone can reach us.
- **Without a zone file, a monitor covers one name — your domain itself.** A record at `staging.example.com` or `_dmarc.example.com` is invisible to us unless that name was in a zone file you pasted.
- **The zone file is a snapshot.** It is read once, parsed, and never stored. Names added to your zone afterwards are not tracked until you paste again.
- **Six record types**, listed below. `CAA`, `SOA`, `SRV`, `PTR`, `DS`, `DNSKEY`, `HTTPS` and `SVCB` are not checked.
- **We resolve through one recursive resolver.** We do not query each of your authoritative nameservers, so we do not detect disagreement between them and we do not detect regional differences.
- **Detection latency is floored by your record's TTL, not by your check interval.** A recursive resolver serves a cached answer, so a 15-minute check against a 24-hour TTL does not find out fifteen minutes after a change.
- **We do not report DNSSEC validation state.**

Additions _inside_ a tracked name are detected, because a DNS query returns the full record set for a name and type rather than a sample of it. A sixth MX record appearing at a name we already track arrives in the same answer as the other five. Only the discovery of new _names_ needs the zone file.

## Supported Record Types

Every check queries all six types at every tracked name.

### A Records

A records map a domain name to an IPv4 address. These are the most common DNS records and control where your domain points.

```
example.com.  A  192.0.2.1
```

### AAAA Records

AAAA records map a domain name to an IPv6 address. Addresses are normalized to one canonical form, so `2001:DB8::1` from a zone file and `2001:db8::1` from a resolver are the same record.

```
example.com.  AAAA  2001:db8::1
```

### CNAME Records

CNAME (Canonical Name) records create an alias from one domain name to another. These are commonly used for subdomains that point to external services.

```
blog.example.com.  CNAME  example.netlify.app.
```

A CNAME at a name suppresses A and AAAA tracking at that name. The addresses a resolver returns for an aliased name belong to the alias _target_, not to your zone, and tracking them would alert you every time an unrelated third party rotated an address.

### MX Records

MX (Mail Exchange) records specify which mail servers handle email for your domain. Incorrect MX records mean you won't receive email. The preference number is part of the record, so a preference change is a change.

```
example.com.  MX  10 mail.example.com.
```

### TXT Records

TXT records store text data and are commonly used for domain verification, SPF email authentication, and DKIM keys. A record longer than 255 bytes arrives as several character-strings; they are joined back into the one value you configured.

```
example.com.  TXT  "v=spf1 include:_spf.google.com ~all"
```

### NS Records

NS (Name Server) records specify which DNS servers are authoritative for your domain. Changes to NS records could indicate domain hijacking.

```
example.com.  NS  ns1.example-dns.com.
```

## Configuration Options

### Domain

The domain the monitor covers. Every check queries this name, and it is the origin that relative names in a pasted zone file are resolved against.

### Zone File

Optional, and the only way to cover names other than the domain itself. Paste a BIND-format zone file — the export button in your DNS provider's dashboard produces one — and every name it declares is added to the set the monitor sweeps.

The parser reads one record per line, `<owner> [<ttl>] [IN] <TYPE> <rdata>`, with `;` comments, blank lines, absolute and relative owners, `@` for the apex, and quoted TXT character-strings.

**A line the parser cannot use is never silently dropped.** `$ORIGIN`, `$TTL`, `$INCLUDE` and `$GENERATE` directives, parenthesised multi-line records, owner-inheriting continuation lines, classes other than `IN`, and record types outside the six above are all reported back on the review screen with their line number and a reason. An import that decides what you monitor is the worst possible place for a silent drop.

The pasted text is **never stored**. It is parsed on submit; the records and the import date are kept, and the text is discarded. Re-importing later means pasting again.

### Check Interval

How often the monitor sweeps. Intervals range from **15 minutes to 24 hours**, and the default is **once a day** — DNS changes are human-caused and human-paced, and a record's TTL puts a floor under detection latency that a faster interval cannot get below.

A check costs **one ping**, however many names and types it swept.

## Reviewing Records

Creating a monitor from the dashboard runs discovery immediately and lands you on a review screen: every record found, grouped by name and then by type, each with a checkbox. Submitting saves them.

Records you uncheck are **still stored**, switched off. That is deliberate:

> The record table is the complete set of everything we have ever seen for the domain. The switch says only whether a deviation from that record alerts you.

Without it, a record you declined would be rediscovered as new on the very next check and alert forever.

A monitor created through the API has no review step — there is no reviewer standing at the other end of an API call — so it imports and enables everything discovery found. Turn off what you don't want through the records endpoint.

### Declared but not resolving

A record your zone file declares but the resolver does not answer for is shown on the review screen as its own group, saved switched off. It is a real finding at import time — a stale delegation, a change that never published, a typo between the console and the zone.

**On a proxied zone this is the normal case, not a broken one.** A record behind a reverse proxy does not appear in its own zone export, and the name answers with the proxy's address instead of yours. Neither channel is wrong: your record genuinely is not in public DNS. Nothing is misconfigured, and there is usually nothing to fix.

It does not alert on later checks unless you switch it on. As a standing alert it would be a comparison against a snapshot that only ever gets older — every legitimate change you make after the import would widen a divergence we kept emailing you about.

## Record Statuses

Each tracked record carries its own state.

| Status      | Description                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **OK**      | The record resolved on the last check.                                                             |
| **Changed** | The record's single value was edited — see the note below on when a change is attributable.        |
| **Missing** | A watched record stopped resolving.                                                                |
| **New**     | A record resolved that nobody configured. Saved switched off, waiting for you to accept or reject. |
| **Error**   | The query for that name and type did not answer, so nothing is known about the record this check.  |

**A value edited inside a set holding several records reads as one missing record plus one new one.** That is truthful rather than a bug: DNS gives an individual record no identity of its own, so editing one of five MX values is indistinguishable, on the wire, from removing one and adding another. **Changed** is used only where the diff can attribute the edit without guessing — a name and type holding exactly one watched record, answering with exactly one differing value.

**A newly discovered record is imported switched off, on purpose.** You have two honest responses to "this appeared and you didn't put it there" — fix your DNS, or accept it — and switching the record on is the second. Importing it switched on would make "accept" the thing that happens by not reading the email.

## Monitor Statuses

The monitor rolls its records up into one of three statuses:

| Status      | Description                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------ |
| **OK**      | Every query answered, and every watched record resolved exactly as stored.                       |
| **Changed** | A watched record is missing or was edited, or a record appeared that nobody configured.          |
| **Error**   | At least one query did not answer — a resolver failure, a network failure, or a transport error. |

**A failed query never reads as records vanishing.** If a query for one name and type does not answer, no record under it is diffed at all. Otherwise a resolver having a bad minute would tell you your entire zone had disappeared.

## Alerting

DNS results reach every alert whose scope covers the monitor: your team-wide alerts, any alert scoped to DNS monitors as a kind, and any alert scoped to that one domain. A domain monitor is noisier than a website check — it reports every record that stops resolving, changes, or newly appears across the whole zone — so a DNS-scoped alert on its own channel is usually worth setting up rather than letting all of it land wherever your outage alerts do. See [Alerts](/docs/concepts/alerts#scope).

Notification is edge-triggered on the monitor's status. If a second record is discovered while the monitor is already reporting **Changed**, that discovery does not produce its own immediate email; it appears in the next repeat, whose body lists everything currently outstanding.

## Best Practices

### Paste the zone file

Without it a monitor covers one name. With it, `www`, `_dmarc`, `_domainkey`, your API subdomain and everything else your zone declares are covered by the same monitor, on the same interval, attached to the same alerts.

### Re-import after you restructure

The zone file is a snapshot. After adding a subdomain, or migrating providers, paste the export again so the new names are tracked.

### Leave the interval long

DNS changes are rare in normal operation, and your records' TTLs put a floor under how quickly a change can be observed anyway. Daily is the default for good reason. Reserve short intervals for a domain you are actively changing.

### Act on new records

A record you did not create is the finding this monitor exists for. Switching it on says "this is mine now"; leaving it off keeps it on the list of things needing your attention. Either is a decision — silence is not.

### Watch your NS records

Your NS records determine who controls your DNS. They are swept along with everything else, and a change to them is worth investigating immediately.
