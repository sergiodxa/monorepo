# ADR-120: RDAP Package

## Status

**Accepted** - 2026-10-08

## Background

`apps/uptime` watches a domain's HTTP endpoints, its TCP ports, its certificate and, since
[uptime ADR-026](./uptime/ADR-026-domain-dns-monitors-with-record-import.md), the DNS records of
the whole zone. It does not watch the one date that takes all of them down at once: the day the
domain's registration lapses. A lapsed domain stops resolving, its mail bounces, and after the
redemption period anyone can register it. Uptime monitoring products commonly sell domain-expiry
alerts beside certificate-expiry alerts, and the uptime app's own certificate monitor already
shows the shape customers expect: a date, a warning threshold in days, and an alert as the date
approaches.

Registration data is public through RDAP, the Registration Data Access Protocol: JSON over HTTPS,
one server per registry, located through a bootstrap file IANA publishes. Every ICANN-accredited
gTLD registry has been required to run RDAP since 2019, and in January 2025 ICANN ended the
requirement to run port-43 WHOIS, so RDAP is the protocol that remains. Reading it is a protocol
concern — bootstrap, redirects, a JSON schema, jCard, EPP status names — that has nothing to do
with uptime monitoring, so it belongs in a package the app calls.

## Context

### What uptime has today

| Location                                                 | What it does                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/services/ssl-info.ts`                   | Classifies a certificate as `valid`, `expiring` or `expired` from an expiry date and `warningDays`; alerts at 30, 14, 7, 1 days |
| `apps/uptime/app/jobs/check-ssl.ts`                      | Daily at 06:00 UTC, re-runs that classification for every monitor in bounded-concurrency batches and enqueues `notify` messages |
| `apps/uptime/database/schema.ts` (`ssl_*`)               | The expiry date is **typed in by the user**: a Worker cannot read the peer certificate from `fetch()`                           |
| `apps/uptime/app/jobs/check-dns.ts`                      | Resolves every tracked record of a domain monitor through `@sdxc/doh` and diffs it against the imported set                     |
| `apps/uptime/database/schema.ts` (`dns_monitors.domain`) | The zone apex the DNS monitor covers: absolute, lowercased, no trailing dot                                                     |

The certificate monitor works from a date the user maintains by hand. A domain monitor can do
better: the registry publishes the expiry date, so the app reads it rather than asking for it,
and the DNS monitor already holds the apex it would look up.

### How an RDAP lookup works

| Step      | Specification | What happens                                                                                                                         |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Bootstrap | RFC 9224      | `https://data.iana.org/rdap/dns.json` maps label sequences (in practice TLDs) to base URLs; the longest matching suffix wins         |
| Query     | RFC 9082      | `GET {base}domain/{ldhName}` with `Accept: application/rdap+json`; the name is the A-label (punycode) form                           |
| Transport | RFC 7480      | HTTPS; `404` for an unknown object; a server may answer `3xx` pointing at another server; `429` when the client exceeds a rate limit |
| Response  | RFC 9083      | `objectClassName: "domain"`, `ldhName`, `status`, `events`, `entities`, `nameservers`, `secureDNS`, `links`, `notices`               |
| Status    | RFC 8056      | Status values are EPP status codes spelled as lowercase words: `client transfer prohibited`, `redemption period`, `pending delete`   |
| Contacts  | RFC 7095      | An entity's name and email arrive as jCard: `["vcard", [["fn", {}, "text", "Example Registrar, Inc."], …]]`                          |

The expiry date is the `events` entry whose `eventAction` is `expiration`. A few registries omit
it; the registrar entity is the `entities` entry whose `roles` include `registrar`, with its IANA
id in `publicIds`.

### Where real registries differ

| Behavior                                | Example                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A TLD with no bootstrap entry           | Many ccTLDs run no RDAP service, or run one IANA does not list                                                           |
| Several base URLs for one TLD           | Some entries list an `http:` and an `https:` URL; RFC 9224 asks clients to prefer HTTPS                                  |
| A registry that defers to the registrar | `.com` and `.net` answer registry data and a `links` entry with `rel: "related"` pointing at the registrar's RDAP server |
| No `expiration` event                   | Some ccTLD registries publish registration and last-changed dates only                                                   |
| Rate limits                             | Undocumented and per registry; a `429` may or may not carry `Retry-After`                                                |
| Redirects                               | Aggregators and some registries answer `301`/`302` to the authoritative server                                           |
| Non-conforming bodies                   | A `200` with an HTML error page, or `application/json` in place of `application/rdap+json`                               |
| Large responses                         | Notices, remarks and nested entities can run to tens of kilobytes                                                        |

### Packages to build on

| Package             | Fit                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/outbound`    | **Used.** `follow` re-checks every redirect hop against the public-host rules, applies one deadline to the chain and the body, and `readText` caps the body. A registry chooses where a redirect points, so every hop needs those checks |
| `@sdxc/cache`       | **Used.** The bootstrap file changes a few times a month and every lookup needs it; one `Cache` read per lookup replaces one IANA fetch                                                                                                  |
| `@sdxc/result`      | **Used.** Every lookup answers a `Result`                                                                                                                                                                                                |
| `remix/data-schema` | **Used.** Validates the bootstrap file and the RDAP envelope with `s.parseSafe`, as `@sdxc/doh` validates its envelope                                                                                                                   |
| `@sdxc/api-client`  | **Not used.** `APIClient` binds one base URL; RDAP picks the server per TLD at run time and follows redirects to servers it did not choose                                                                                               |
| `@sdxc/backoff`     | **Not used by the package.** A lookup makes one attempt and reports `retryAfter`; scheduling the next attempt belongs to the caller, which already owns a job queue (see [Rate limits](#rate-limits-and-retries))                        |
| `@sdxc/ip`          | **Not yet.** IP network and autonomous system lookups are out of scope (see [Out of scope](#out-of-scope)); when they arrive, `IP.Range` matches the `ipv4.json` and `ipv6.json` bootstrap entries                                       |

## Decision

Add `@sdxc/rdap`: one configured `RDAP` class that resolves a domain's registry through the IANA
bootstrap file, queries it through `@sdxc/outbound`, validates the response, and answers a
camelCase `RDAP.Domain` with the expiry date, status, registrar and nameservers. The bootstrap
file is cached through an `@sdxc/cache` `Cache`. Every failure is an `RDAPError` with a `code`
and `retryable`.

### Entry points

| Entry        | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `@sdxc/rdap` | `RDAP` (class and type namespace), `RDAPError`, `EPP_STATUSES` |

One entry point: the package has one runtime object and its data types, and nothing a bundle would
want to leave out.

### The client

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { RDAP } from "@sdxc/rdap";

let rdap = new RDAP({
	cache: new WorkerKVCache(env.CACHE),
	userAgent: "ExampleMonitor/1.0 (+https://monitor.example.com)",
});

let domain = await rdap.domain("example.com");
// Result<RDAP.Domain, RDAPError>
```

```typescript
export class RDAP {
	constructor(options: RDAP.Options);

	/** Looks up a registered domain at its registry. */
	domain(name: string, options?: RDAP.LookupOptions): Promise<Result<RDAP.Domain, RDAPError>>;

	/** The registry base URL for a name, or `null` for a TLD the bootstrap file does not list. */
	server(name: string): Promise<Result<URL | null, RDAPError>>;
}
```

| Option         | Default        | Meaning                                                                                                     |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `cache`        | Required       | Where the parsed bootstrap file is kept between isolates                                                    |
| `userAgent`    | Required       | Sent on every request; registries that rate-limit by client identify an operator by it                      |
| `bootstrap`    | IANA's URL     | The `dns.json` URL, for a mirror                                                                            |
| `servers`      | `{}`           | Base URLs by TLD, consulted before the bootstrap file, for a registry that runs RDAP IANA does not list yet |
| `bootstrapTtl` | `"1 day"`      | How long the cached bootstrap file is trusted                                                               |
| `timeout`      | `"10 seconds"` | One deadline per lookup, covering redirects and the body                                                    |
| `maxBytes`     | `1 MiB`        | The largest response body read                                                                              |

The constructor stores options and does nothing else, so an `RDAP` built at module scope does no
work in the Worker's global scope. The class shape follows the repo's server packages: the wiring
(cache, user agent, overrides) is given once, and each call names only what it looks up. IP and
autonomous-system lookups, when added, become methods on the same object over the same bootstrap
machinery.

`domain` takes the **registered** domain: `example.co.uk`, not `www.example.co.uk`. A registry
answers `404` for a name below a registration, which reaches the caller as `not-found`. The package
ships no public suffix list; the caller already knows which name is the registration (uptime's
`dns_monitors.domain` is the zone apex).

### Name handling

1. Trim, drop one trailing dot, lowercase.
2. Convert to the A-label form through the WHATWG URL host parser (`new URL("http://" + name).hostname`),
   which applies UTS #46 the way browsers do. A name the parser rejects, a name with one label, or
   an address literal fails with `invalid-domain`.
3. Match the bootstrap file: the entry whose label sequence is the longest suffix of the name.
   `servers` overrides are matched first, by the same rule.

### Bootstrap

- The bootstrap file is fetched with `follow`, validated with `remix/data-schema`
  (`{ version, publication, services: [[string[], string[]]] }`), and stored in the cache as a
  map from label sequence to base URLs under `rdap:bootstrap:dns`.
- Within one `RDAP` instance the parsed map is also held in memory after the first read, so a job
  looking up a thousand domains reads the cache once.
- An entry's HTTPS URL is chosen when it has one; an HTTP URL is used only when it is the entry's
  only URL. A base URL missing its trailing slash gets one, since RFC 9082 paths are relative.
- When the bootstrap fetch fails and the cache holds an expired copy, the expired copy is used. The
  cache entry is written with no TTL and carries its own `fetchedAt`; `bootstrapTtl` decides when
  to refresh, not when to discard. A bootstrap that has never been fetched fails the lookup with
  `bootstrap-unavailable`.
- A cache failure is absorbed as a miss, as `@sdxc/cache`'s `fetch` already does: the cost is a
  fetch, never a wrong answer.

### The domain model

The wire document's names stay inside the parser; the public model is camelCase and plain data,
ready for storage or a log line.

```typescript
export namespace RDAP {
	interface Domain {
		/** A-label form, lowercased, no trailing dot. */
		name: string;
		/** U-label form when the registry published one, otherwise `null`. */
		unicodeName: string | null;
		/** The registry's object id (`handle`). */
		handle: string | null;
		/** Epoch milliseconds of the `expiration` event, `null` when the registry publishes none. */
		expiresAt: number | null;
		registeredAt: number | null;
		updatedAt: number | null;
		/** EPP status codes, such as `clientTransferProhibited`; an unknown value is kept as written. */
		status: Status[];
		registrar: Registrar | null;
		/** Lowercased, no trailing dot, in the order published. */
		nameservers: string[];
		/** `secureDNS.delegationSigned`; `null` when the registry does not say. */
		dnssec: boolean | null;
		/** The `related` RDAP link, the registrar's own record on a thin registry. */
		relatedUrl: string | null;
		/** The server that answered, after redirects. */
		server: string;
		/** The validated response as the registry sent it, for fields this model omits. */
		document: unknown;
	}

	interface Registrar {
		name: string | null;
		/** The `IANA Registrar ID` public id. */
		ianaId: string | null;
		/** The email of the registrar's `abuse` entity, from its jCard. */
		abuseEmail: string | null;
	}

	type Status = EppStatus | (string & {});
}
```

**Status values use their EPP spelling.** RFC 8056 defines RDAP's status strings as a mapping of
EPP's codes (`client transfer prohibited` ⇄ `clientTransferProhibited`), so the camelCase name is
already the domain industry's name for the value, the one a registrar's dashboard shows.
`EPP_STATUSES` lists the RFC 8056 values with the RDAP-only ones (`active`, `inactive`, `locked`,
`associated`, `removed`, `obscured`); an unknown string is kept as written rather than dropped, so a
caller can still log it.

**Dates are epoch milliseconds.** RFC 3339 strings in the document become numbers, the same unit
`Date.now()` gives and the unit the consuming app stores. An event date that does not parse is
`null`, and the document keeps the original.

**Events are reduced to the three every consumer asks for.** `expiration`, `registration` and
`last changed`, the latest occurrence of each. A registry that repeats an action (a transfer
history) is read through `document`.

### Lookup flow

1. Resolve the base URL from `servers`, then the bootstrap file. No entry fails with
   `unsupported-tld`, carrying the TLD.
2. `follow(new URL("domain/" + name, base), { headers, timeout, maxRedirects: 3 })` with
   `Accept: application/rdap+json, application/json` and the configured `User-Agent`. Every hop
   passes `@sdxc/outbound`'s public-host rules, so a redirect cannot point the Worker at a private
   address.
3. Map the status: `404` → `not-found`; `429` → `rate-limited` with `retryAfter` read from
   `Retry-After` (seconds or HTTP date); other `4xx` → `refused`; `5xx` → `server-error`.
4. Read the body with `readText` under `maxBytes`, parse it as JSON, validate the subset the model
   reads with `remix/data-schema`, and require `objectClassName: "domain"`. Anything else is
   `invalid-response`. Fields the model does not read are not validated, so an extension a
   registry adds cannot fail a lookup.
5. Build the `RDAP.Domain`.

The package follows the `related` link only on request: `domain(name, { related: true })` makes a
second query to the registrar's server and fills each `registrar` field the registry's answer
left empty (a thin registry names the registrar but often omits its abuse email). The registry's
`expiresAt` is kept either way; it is the date the registration lapses at the registry, and the
registrar's copy can lag it. A registrar server that fails leaves the registry's answer as it was.

### Rate limits and retries

A lookup makes one request chain and never retries. Retrying inside the call would hold a
Worker invocation open across a server's `Retry-After`, which can be minutes, and would hide from
the caller that a registry is pushing back. `rate-limited` and `server-error` carry
`retryable: true` and, where the server said, `retryAfter` in milliseconds, so the caller
schedules the next attempt with `@sdxc/backoff` and its own queue.

The package does not throttle either: the rate a caller can sustain depends on how many lookups it
spreads across how many registries, which only the caller knows. The README's pattern for a batch
job groups domains by `rdap.server(name)` and runs each group with low concurrency.

### Errors

One class, `RDAPError`, with a `code`, `retryable`, and the fields that code fills:

| `code`                  | `retryable` | When                                                                                             | Fields              |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------ | ------------------- |
| `invalid-domain`        | No          | The name does not parse as a registrable host name                                               | `domain`            |
| `unsupported-tld`       | No          | Neither `servers` nor the bootstrap file lists the TLD                                           | `tld`               |
| `not-found`             | No          | The registry answered `404`: the name is not registered there                                    | `url`               |
| `rate-limited`          | Yes         | `429`                                                                                            | `url`, `retryAfter` |
| `server-error`          | Yes         | `5xx`                                                                                            | `url`, `status`     |
| `refused`               | No          | Any other non-`2xx`, or an `@sdxc/outbound` refusal of a hop (`refused-*`, `too-many-redirects`) | `url`, `status`     |
| `invalid-response`      | No          | The body is not JSON, fails the schema, or is not a domain object                                | `url`               |
| `too-large`             | No          | The body passed `maxBytes`                                                                       | `url`               |
| `timeout`               | Yes         | The deadline passed                                                                              | `url`               |
| `network`               | Yes         | `fetch` rejected or the body broke off                                                           | `url`               |
| `bootstrap-unavailable` | Yes         | The bootstrap file could not be fetched and no copy is cached                                    | `cause`             |

`not-found` and `unsupported-tld` are answers, not outages: a caller monitoring expiry shows the
first as "not registered" and the second as "registry has no RDAP service" and stops asking.

### Out of scope

| Feature                       | Reason                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WHOIS (port 43)               | Free text whose layout differs per registry; parsing it is a maintenance burden RDAP exists to retire. A ccTLD without RDAP is reported as `unsupported-tld` |
| IP network and ASN lookups    | No consumer. The bootstrap reader is written over a registry name (`dns`, `ipv4`, `ipv6`, `asn`) so they arrive as methods, with `@sdxc/ip` matching ranges  |
| Entity and nameserver lookups | No consumer; the domain response embeds the entities and nameservers a caller needs                                                                          |
| Search (`domains?name=`)      | RFC 9536 search is optional for servers and rarely offered                                                                                                   |
| Authenticated (tiered) access | Gated contact data requires registry credentials no consumer holds                                                                                           |
| Public suffix detection       | The caller names the registration; see [The client](#the-client)                                                                                             |
| Response caching              | A daily expiry check gains nothing from it; a caller that wants it wraps `domain` in `cache.fetch`                                                           |

### Testing

- Tests run under the packages Vitest project with MSW (`setupServer`), mocking
  `https://data.iana.org/rdap/dns.json` and registry hosts with public-looking names
  (`rdap.verisign.com`, `rdap.publicinterestregistry.org`), since `@sdxc/outbound` refuses
  `.example` and `.test` hosts before MSW sees them.
- Fixtures are real responses captured once and committed with personal data already redacted by
  the registry: a thin registry with a `related` link, a thick registry, a registry with no
  `expiration` event, an IDN, and a bootstrap file trimmed to those TLDs.
- The bootstrap cache runs against `MemoryCache`; one test proves an expired copy is served when
  IANA fails, one that a never-fetched bootstrap fails with `bootstrap-unavailable`.
- Every error code has a test, including a redirect to a private address (`refused`), a `429`
  with each `Retry-After` form, a `200` HTML body (`invalid-response`) and an oversized body.

## Usage in `apps/uptime`

This section sketches the consumer; the app's own ADR decides the schema and the product.

**Where it lives.** Expiry is a property of the domain the DNS monitor already watches, so the
check attaches to `dns_monitors` rather than becoming a new monitor type: `registration_expires_at`,
`registration_status`, `registrar`, `registration_checked_at`, `registration_error` and
`registration_warning_days` (default 30).

**When it runs.** A daily `checkDomainExpiry` job beside `checkSsl`, shaped like it: list the
monitors, look each one up with bounded concurrency, persist, and enqueue `notify` messages.

```typescript
const RDAP_CLIENT = new RDAP({ cache: new WorkerKVCache(env.CACHE), userAgent: USER_AGENT });

async function check(db: Database, monitor: SelectDnsMonitor) {
	let looked = await RDAP_CLIENT.domain(monitor.domain);
	if (isFailure(looked)) return recordLookupFailure(db, monitor, looked.error);

	let { status, daysUntilExpiry } = calculateExpiryStatus(
		looked.data.expiresAt,
		monitor.registration_warning_days,
	);
	await DnsMonitor.updateById(db, monitor.id, {
		registration_expires_at: looked.data.expiresAt,
		registration_status: looked.data.status.join(","),
		registrar: looked.data.registrar?.name ?? null,
		registration_checked_at: Date.now(),
	});
	return shouldAlertOnExpiry(status, daysUntilExpiry, looked.data.status)
		? { monitorType: "domain", monitorId: monitor.id, previousStatus, newStatus: status }
		: null;
}
```

- `calculateSslStatus`'s classification generalizes to any expiry date and is shared by both jobs.
- A status of `redemptionPeriod`, `pendingDelete`, `clientHold` or `serverHold` alerts whatever
  the date says: each means the domain has stopped, or is about to stop, resolving.
- `rate-limited`, `server-error`, `timeout` and `network` leave the stored date in place and set a
  retry time through `@sdxc/backoff`; a monitor whose lookup keeps failing past its warning window
  alerts as `error`, so a broken registry never silences a real expiry.
- `unsupported-tld` and `not-found` set the monitor's registration state to "unavailable" and the
  form says why; they are not retried daily.
- The job groups monitors by `RDAP_CLIENT.server(domain)` and runs one registry's lookups at a
  concurrency of two, so a team with many `.com` domains does not trip Verisign's limit.

This removes the one manual date the product still asks a customer to maintain for a domain, and
the certificate monitor keeps its manual date until a certificate source exists.

## Consequences

### Positive

- **Domain-expiry monitoring for uptime** from a date the registry publishes, with no user input.
- **One RDAP implementation** for any app that shows registration data, with bootstrap, redirects,
  jCard and EPP status names handled once.
- **Safe by construction:** every request goes through `@sdxc/outbound`, so a registry or a
  redirect cannot steer the Worker into a private network.
- **No work at import, no retries hidden in a call:** a lookup costs exactly the requests it
  reports.

### Negative

- **ccTLD coverage is partial.** A customer on a TLD without RDAP gets "unavailable", and the
  package offers no WHOIS fallback.
- **Registries change behavior without notice.** Fixtures pin today's responses; a registry that
  changes its envelope surfaces as `invalid-response` in production first.
- **The caller owns throttling.** A naive caller that looks up thousands of domains at once will
  be rate-limited; the README pattern is the mitigation.

### Neutral

- `document` exposes the raw response, so a caller can read a field before the model grows one.
- The package takes the registered domain, so a caller watching subdomains maps them to their
  registration itself.

## Implementation Plan

### Phase 1: Bootstrap and lookup

**Priority:** High
**Estimated Effort:** 5 hours

1. Create `packages/rdap`, public, depending on `@sdxc/outbound`, `@sdxc/cache`, `@sdxc/result`
   and `remix`.
2. Bootstrap reader: validation, longest-suffix match, HTTPS preference, `servers` overrides,
   in-memory and cached copies, stale-on-failure.
3. `RDAP.domain` and `RDAP.server`, the status mapping and `RDAPError`.
4. MSW tests with the captured fixtures, one per error code.

### Phase 2: The model

**Priority:** High
**Estimated Effort:** 3 hours

1. Event, status, registrar (jCard `fn`, `publicIds`, nested `abuse` entity), nameserver and DNSSEC
   readers, each tested against every fixture.
2. `related: true`.
3. README following the package documentation guide, with the batch-by-registry and
   `Retry-After` patterns; root README table row; `bun run release:bootstrap @sdxc/rdap`.

### Phase 3: `apps/uptime`

**Priority:** Medium
**Estimated Effort:** 6 hours

1. An uptime ADR settling the schema, the alert copy and whether a lookup is metered.
2. Migration, `checkDomainExpiry` job, the shared expiry classification, the DNS monitor page's
   registration panel, and locale keys in every locale.

## Alternatives Considered

### 1. WHOIS over `connect()`

Workers can open TCP sockets, and uptime's TCP monitor already does.

**Rejected because**: WHOIS answers free text in a layout per registry, with no expiry field to
read; gTLD registries are no longer required to run it; and RDAP covers every gTLD.

### 2. A third-party RDAP or WHOIS API

**Rejected because**: it adds a paid dependency and a key for data the registries publish for free,
and another party learns every domain the app's customers monitor.

### 3. Query `rdap.org` instead of bootstrapping

`rdap.org` redirects any query to the authoritative server.

**Rejected because**: it puts a volunteer-run service on every lookup's critical path, and its
fair-use limits apply to the app as a whole. The bootstrap file is the specified mechanism and is
one cached fetch a day.

### 4. Functions instead of a class

`lookupDomain(name, { cache, userAgent, servers })`.

**Rejected because**: every call site would repeat the same wiring, and the in-memory bootstrap
copy needs an owner whose lifetime the caller controls.

### 5. Retries inside `domain`

**Rejected because**: see [Rate limits and retries](#rate-limits-and-retries).

## References

- [RFC 7480, HTTP Usage in RDAP](https://www.rfc-editor.org/rfc/rfc7480)
- [RFC 9082, RDAP Query Format](https://www.rfc-editor.org/rfc/rfc9082)
- [RFC 9083, JSON Responses for RDAP](https://www.rfc-editor.org/rfc/rfc9083)
- [RFC 9224, Finding the Authoritative RDAP Service](https://www.rfc-editor.org/rfc/rfc9224)
- [RFC 8056, EPP and RDAP Status Mapping](https://www.rfc-editor.org/rfc/rfc8056)
- [RFC 7095, jCard](https://www.rfc-editor.org/rfc/rfc7095)
- [IANA RDAP bootstrap registries](https://data.iana.org/rdap/)
- [ICANN, RDAP](https://www.icann.org/rdap)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)
- [uptime ADR-026: A DNS Monitor Watches a Domain, Not a Record Type](./uptime/ADR-026-domain-dns-monitors-with-record-import.md)

## Current Progress

- [x] Phase 1: Bootstrap and lookup
- [x] Phase 2: The model (the npm bootstrap, `bun run release:bootstrap @sdxc/rdap`, runs from a developer machine)
- [ ] Phase 3: `apps/uptime`

## Open Questions

1. **Subdomain input.** Should `domain` walk up the labels on `404` (`a.example.co.uk` →
   `example.co.uk`) instead of requiring the registration? It costs a request per extra label at
   a rate-limited server, and the one consumer already holds the apex.
2. **Metering.** Is a daily RDAP lookup a ping under uptime's metering, or free like the
   certificate re-check?
3. **Registrar expiry on thin registries.** When `related: true` returns a registrar expiry that
   differs from the registry's, should the model expose both?
4. **Fixture licensing.** Registry responses carry terms-of-use notices; confirm committing
   redacted captures as test fixtures is acceptable, or synthesize them from the RFC 9083
   examples.
