# ADR-088: DNS over HTTPS Package

## Status

**Proposed** - 2026-09-23

## Background

A Cloudflare Worker has no socket it can send a DNS query over: there is no `node:dns`, no UDP,
and `connect()` opens TCP streams to hosts, not resolvers. Every name the apps need to resolve
goes over DNS over HTTPS (DoH) instead, a `fetch` to a public resolver. Three places in two apps
do this today, each with its own request, its own envelope schema, its own reading of the
response code and its own idea of what a TXT answer looks like.

They disagree in ways that matter. The uptime ownership job compares a TXT answer against
`JSON.stringify(token)`, so a token the resolver splits into two character-strings, or escapes,
never verifies. auth-saas strips one layer of quotes and unescapes. uptime's DNS monitors parse
character-strings properly. One lookup checks `response.ok` and `Status`, one checks only
`response.ok`, and one checks neither. The logic is DNS, not uptime or auth-saas, and it belongs
in one place with one set of tests.

## Context

### Current call sites

| File                                                  | Lines | Use                                                              | How it reads the answer                                                                             |
| ----------------------------------------------------- | ----: | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/services/dns-check.ts`               |   325 | DNS monitors: sweep six types per name; ad-hoc probe; trial SSRF | `Status` 0 ok, 3 (NXDOMAIN) as empty, anything else an error; answers filtered by type code; throws |
| `apps/uptime/app/jobs/verify-domain-ownership.ts`     |    62 | Team domain TXT token at `_ping-verification.<host>`             | No `Status` or `response.ok` check; `data === JSON.stringify(token)`                                |
| `apps/auth-saas/app/services/organization-domains.ts` |   105 | Organization domain TXT verification                             | `response.ok` only; unchecked cast of the body; one quote pair stripped, backslashes unescaped      |
| `apps/uptime/app/lib/dns-record-value.ts`             |   323 | Normalizing RDATA from the resolver and from zone-file imports   | TXT character-string reader, IPv6 canonicalization, MX re-printing (identity rules for diffing)     |

`dns-check.ts` also calls through to `trial-guard.ts`, whose SSRF defence resolves `A` and `AAAA`
and refuses the probe on any failure. Tests for all four stub `https://cloudflare-dns.com/dns-query`
with MSW, so the URL is repeated in five test files.

### The two DoH encodings

| Encoding                                   | Standard                | Resolvers                                             | Cost to implement                                                             |
| ------------------------------------------ | ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| JSON (`application/dns-json`)              | none; a de facto format | Cloudflare (`/dns-query`), Google (`/resolve`)        | a `data-schema` for the envelope and a presentation-format reader per type    |
| Wire (`application/dns-message`, RFC 8484) | RFC 8484 over RFC 1035  | every DoH server (Quad9, NextDNS, AdGuard, the above) | a message encoder and decoder: header, name compression, RDATA per type, EDNS |

The JSON envelope Cloudflare and Google share: `Status` (the RCODE), `TC`, `RD`, `RA`, `AD`, `CD`,
`Question`, `Answer`, `Authority`, and each record's `name`, `type`, `TTL`, `data`. `data` is the
record in presentation format, so `MX` arrives as `"10 mx.example.com."` and `TXT` as one or more
quoted character-strings.

### What the protocol asks of a client

| Rule                                                                               | Consequence for the package                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| RCODE 3 (NXDOMAIN) means the name does not exist; NOERROR with no answer is NODATA | NXDOMAIN is its own typed failure; NODATA is a success with no records                        |
| RCODE 2 (SERVFAIL) is the resolver failing, often DNSSEC validation                | a separate typed failure, so a monitor never reads it as "the records vanished"               |
| TXT RDATA is one or more character-strings of at most 255 bytes (RFC 1035)         | TXT records expose the joined text and the individual strings                                 |
| An answer for A may carry the CNAME chain before the addresses                     | answers split into the records of the asked type and the chain that led there                 |
| TTL is per record; negative answers are cached for the SOA minimum (RFC 2308)      | an answer reports the smallest TTL; NXDOMAIN reports the negative TTL when `Authority` has it |
| AD is set only when the resolver validated DNSSEC                                  | the flag is surfaced as `authenticated`; the policy of requiring it is the caller's           |
| Names are case-insensitive and end at the root                                     | owner names and targets come back lowercased without the trailing dot                         |

## Decision

Add `@sdxc/doh`: a typed DNS-over-HTTPS client over the JSON API, returning `Result` with records
typed per query type, plus the two verification helpers the apps need. It calls the global `fetch`
and keeps no state.

The JSON API is the only encoding in this ADR. Every resolver the apps use speaks it, the envelope
is small and validated with `remix/data-schema`, and presentation-format parsing is already half
written in uptime. The wire format would add a DNS message codec (name compression, EDNS(0),
binary RDATA for every type) of several hundred lines to reach resolvers nobody here queries. The
resolver option is an object carrying its `format`, so an `application/dns-message` resolver can be
added later as a new `format` value with no change to `resolve`'s signature.

### Package name

| Name                          | Trade-off                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| **`@sdxc/doh`** (recommended) | Names the transport exactly, and says what a Workers developer is looking for; short to import   |
| `@sdxc/dns`                   | Promises zone files, record normalization and wire codecs, most of which this package leaves out |
| `@sdxc/dns-over-https`        | Equally precise, three words longer at every import                                              |
| `@sdxc/resolver`              | Reads as module resolution to a JavaScript developer before it reads as DNS                      |

`@sdxc/doh` wins because the package is a client for one protocol, and the name is the one the
protocol goes by (RFC 8484's own title abbreviates it).

### Scope

The package includes:

- `resolve(name, type, options)` over the JSON API, with typed records for `A`, `AAAA`, `CNAME`,
  `TXT`, `MX`, `NS`, `CAA`, `SOA`, `SRV`, and a raw `data` string for any other type
- RCODE classification into typed errors, the CNAME chain, the AD flag, and TTLs
- Resolver presets for Cloudflare and Google and a custom resolver option
- `parseRecordData(type, data)`, the presentation-format reader, for callers holding RDATA from
  somewhere other than a query (a zone file)
- `verifyTxtRecord` and `checkCname`, the two checks domain-ownership flows perform

What stays out, and where it lives:

- Caching lives with the caller: every answer carries its TTL, and `@sdxc/cache`'s `fetch` stores it
- Record identity for monitoring (MX preference re-printing, IPv6 canonical form, the `(name, type,
value)` diff key) lives in `apps/uptime/app/lib/dns-record-value.ts`, which builds on
  `parseRecordData` for TXT
- SSRF and private-address policy live in `apps/uptime/app/services/trial-guard.ts`
- Custom hostname registration and its TXT validation records live in `@sdxc/hostname`
- `HTTPS`/`SVCB` typed parsing is left to a later revision; those records come back with `data`

### Exports

One entry point.

#### `"."`

```ts
import type { Result } from "@sdxc/result";

export namespace DoH {
	type RecordType =
		"A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "CAA" | "SOA" | "SRV" | (string & {});

	interface Resolver {
		url: string;
		format: "json";
	}

	interface RecordBase {
		name: string; // lowercased, no trailing dot
		ttl: number;
	}

	interface ARecord extends RecordBase {
		type: "A";
		address: string;
	}
	interface AAAARecord extends RecordBase {
		type: "AAAA";
		address: string;
	}
	interface CNAMERecord extends RecordBase {
		type: "CNAME";
		target: string;
	}
	interface NSRecord extends RecordBase {
		type: "NS";
		host: string;
	}
	interface MXRecord extends RecordBase {
		type: "MX";
		preference: number;
		exchange: string;
	}
	interface TXTRecord extends RecordBase {
		type: "TXT";
		text: string;
		strings: string[];
	}
	interface CAARecord extends RecordBase {
		type: "CAA";
		critical: boolean;
		tag: string;
		value: string;
	}
	interface SRVRecord extends RecordBase {
		type: "SRV";
		priority: number;
		weight: number;
		port: number;
		target: string;
	}
	interface SOARecord extends RecordBase {
		type: "SOA";
		primary: string;
		mailbox: string;
		serial: number;
		refresh: number;
		retry: number;
		expire: number;
		minimum: number;
	}
	interface UnknownRecord extends RecordBase {
		type: string;
		data: string;
	}

	/** The record type a query for `Type` returns. */
	type RecordFor<Type extends RecordType> = Type extends "A"
		? ARecord
		: Type extends "AAAA"
			? AAAARecord
			: /* ... */ UnknownRecord;

	interface Answer<Type extends RecordType> {
		name: string;
		type: Type;
		records: RecordFor<Type>[]; // only records of the asked type; empty is NODATA
		chain: CNAMERecord[]; // the aliases followed before reaching `records`
		ttl: number | null; // the smallest TTL in `records`, null when empty
		authenticated: boolean; // the AD flag
		truncated: boolean; // the TC flag
		durationMs: number;
	}

	interface ResolveOptions {
		resolver?: Resolver; // defaults to CLOUDFLARE
		dnssec?: boolean; // sets do=1 so the resolver returns DNSSEC records and validates
		checkingDisabled?: boolean; // sets cd=1
		signal?: AbortSignal;
		timeoutMs?: number; // defaults to 5000
	}
}

export const CLOUDFLARE: DoH.Resolver; // https://cloudflare-dns.com/dns-query
export const GOOGLE: DoH.Resolver; // https://dns.google/resolve

export function resolve<Type extends DoH.RecordType>(
	name: string,
	type: Type,
	options?: DoH.ResolveOptions,
): Promise<Result<DoH.Answer<Type>, DoHError>>;

/** Presentation-format RDATA to a typed record body, also reading RFC 3597 `\# len hex` data. */
export function parseRecordData<Type extends DoH.RecordType>(
	type: Type,
	data: string,
): Result<Omit<DoH.RecordFor<Type>, "name" | "ttl">, RecordDataError>;

/** Whether `name` publishes a TXT record whose joined text is exactly `expected`. */
export function verifyTxtRecord(
	name: string,
	expected: string,
	options?: DoH.ResolveOptions,
): Promise<Result<boolean, DoHError>>;

/** Whether `name` is a CNAME, directly or through its chain, to `target`, compared case-insensitively. */
export function checkCname(
	name: string,
	target: string,
	options?: DoH.ResolveOptions,
): Promise<Result<boolean, DoHError>>;

/** Base class; `instanceof` narrows every failure `resolve` returns. */
export class DoHError extends Error {}

/** RCODE 3: the name does not exist. `ttl` is the negative-caching TTL from the SOA, if any. */
export class NameNotFoundError extends DoHError {
	readonly ttl: number | null;
}

/** RCODE 2: the resolver could not answer, including a DNSSEC validation failure. */
export class ServerFailureError extends DoHError {}

/** Any other non-zero RCODE (FORMERR, NOTIMP, REFUSED, ...), with the code. */
export class ResponseCodeError extends DoHError {
	readonly rcode: number;
}

/** The request never produced a DNS answer: network error, timeout, non-2xx, or a body that is not the envelope. */
export class TransportError extends DoHError {
	readonly status: number | null;
}

/** RDATA that does not parse for its type; `resolve` keeps the record as `UnknownRecord` instead. */
export class RecordDataError extends Error {}
```

Decisions inside the API:

- **NXDOMAIN is a failure, NODATA is a success.** A caller asking for records gets an empty list only
  when the name exists and has none; the two answers mean different things to a monitor and to an
  SSRF guard, so the caller decides whether they collapse. `verifyTxtRecord` and `checkCname` treat
  NXDOMAIN as `success(false)`, because a record not yet published is the ordinary state of a
  verification in progress, and keep every other failure a failure.
- **TXT is joined.** `text` is the character-strings concatenated with nothing between them, as
  SPF and DKIM define, with the resolver's quoting and `\"`/`\\`/`\DDD` escapes removed; `strings`
  keeps the split for the rare record where the boundaries matter.
- **Records of other types are dropped from `records`, not the answer.** The CNAME chain is in
  `chain`, so uptime's rule of discarding address answers that arrived through a CNAME stays a
  one-line check in uptime.
- **A record that fails to parse degrades.** It is returned as an `UnknownRecord` with its raw
  `data`, since refusing a whole answer over one odd record would turn a resolver quirk into an
  outage.
- **No cache, no retries.** A monitor and a verification must see the resolver's current answer,
  and retry policy is the job queue's (`@sdxc/jobs`) or the caller's (`retry` from `@sdxc/result`).
- **`fetch` is global.** Tests intercept the resolver URL with MSW, the pattern the apps use today.

### Usage

uptime's ownership job, which today compares against `JSON.stringify`:

```ts
import { verifyTxtRecord } from "@sdxc/doh";

export default createJobHandler(jobs.verifyDomainOwnership, async (ctx) => {
	let domain = await TeamDomain.findById(ctx.database, ctx.input.teamDomainId);
	if (!domain || domain.verified_at !== null) return;

	let verified = await verifyTxtRecord(
		`_ping-verification.${domain.hostname}`,
		`ping_${domain.id}`,
	);
	if (isFailure(verified))
		return ctx.log.warn("domains.lookup_failed", { error: verified.error.message });

	if (verified.data) await TeamDomain.markVerified(ctx.database, domain.id);
	ctx.log.set({ domain: { verified: verified.data } });
});
```

uptime's monitor sweep, keeping its product rules (NXDOMAIN is "no records", any other failure
skips the diff, CNAME-routed addresses are suppressed):

```ts
import { NameNotFoundError, resolve } from "@sdxc/doh";

let answer = await resolve(owner, recordType);
if (isFailure(answer)) {
	if (answer.error instanceof NameNotFoundError) return outcome(owner, recordType, []);
	return failedOutcome(owner, recordType, answer.error.message);
}

let suppressedByCname = isAddressType(recordType) && answer.data.chain.length > 0;
let values = suppressedByCname ? [] : answer.data.records.map(toStoredValue); // uptime's identity rules
```

auth-saas's organization domains replace `lookupTxtRecord` and `unquoteTxtValue` with
`verifyTxtRecord(described.verification.name, described.verification.value)`. The trial guard's
`checkResolvedAddresses` calls `resolve(hostname, "A")` and `resolve(hostname, "AAAA")` and keeps
refusing on any failure. A name looked up repeatedly (the trial guard, for one visitor retrying)
can cache through the answer's TTL:

```ts
let answer = await resolve(hostname, "A");
if (isSuccess(answer)) {
	let seconds = Math.max(answer.data.ttl ?? 60, 60); // KV refuses a TTL under 60 seconds
	await ctx.cache.write(`doh:A:${hostname}`, answer.data.records, { ttl: `${seconds}s` });
}
```

## Consequences

### Positive

- **One reading of a DNS answer** - TXT joining, escape handling, RCODE classification and CNAME
  chains are written and tested once, fixing the ownership job's `JSON.stringify` comparison and
  auth-saas's unchecked body cast
- **Typed errors instead of string matching** - a monitor can tell "the name is gone" from "the
  resolver is down" by class, which is exactly the line uptime's diff logic draws
- **Typed records** - MX preference, SRV port and CAA tag are fields, not substrings
- **Resolver choice** - a second resolver is one option away, useful for confirming a SERVFAIL
  before alerting

### Negative

- **The JSON API is not a standard** - Cloudflare and Google agree on it today, but neither is
  bound to; a change on their side breaks every call site at once (it also fixes them at once)
- **Presentation-format parsing is fragile by nature** - each type's text form has corner cases
  (escaped TXT, RFC 3597 generic data) that a binary decoder would not have
- **Uptime's error messages change** - `DNS query returned status code 2` becomes the error class's
  message, and stored `errorMessage` values from before and after differ

### Neutral

- **Wire format deferred** - the `format` field keeps the door open without paying for a codec now
- **`dns-record-value.ts` stays in uptime** - its identity rules are product decisions; only its TXT
  character-string reader moves into the package

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 1 day

1. Write tests first, against recorded JSON answers: the uptime fixture zone
   (`apps/uptime/app/services/fixtures/`), a multi-string DKIM TXT, an escaped TXT, NXDOMAIN with
   an SOA in `Authority`, SERVFAIL, a CNAME chain for `A`, a truncated response, a non-2xx, and a
   body that is not the envelope
2. Implement `parseRecordData` per type, then `resolve`, then the two helpers
3. Write the README and add the row to the root README package table

### Phase 2: Migrate call sites

**Priority:** High
**Estimated Effort:** 4 hours

| Call site                                             | Change                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/jobs/verify-domain-ownership.ts`     | `verifyTxtRecord`; add a regression test for a token split into two character-strings             |
| `apps/uptime/app/services/dns-check.ts`               | `queryDoh` and the type-code table go; `resolveDns`, `queryDnsRecords`, `checkDns` call `resolve` |
| `apps/uptime/app/services/trial-guard.ts`             | unchanged API through `resolveDns`, now failing on `DoHError`                                     |
| `apps/uptime/app/lib/dns-record-value.ts`             | `readCharacterStrings` delegates to `parseRecordData("TXT", ...)`                                 |
| `apps/auth-saas/app/services/organization-domains.ts` | `verifyTxtRecord`; `lookupTxtRecord` and `unquoteTxtValue` go                                     |
| The five test files stubbing `cloudflare-dns.com`     | keep MSW, import the URL from `CLOUDFLARE.url`                                                    |

Each app is its own commit, per the repo's one-workspace-per-commit rule.

### Phase 3: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`, `bun run release:bootstrap @sdxc/doh`

## Alternatives Considered

### 1. RFC 8484 wire format now

**Rejected because**: it needs a DNS message codec to reach resolvers no app queries. The JSON API
covers Cloudflare and Google, and the `format` field lets the codec arrive when a resolver needs it.

### 2. Keep a lookup helper per app

**Rejected because**: the three copies already disagree on TXT handling and on what a failed
response means, and one of them verifies nothing when a token is split.

### 3. An npm DoH client (`dohjs`, `dns-over-http-resolver`, `tangerine`)

**Rejected because**: they either depend on Node's `dns` types and `Buffer`, throw on NXDOMAIN, or
return untyped `data` strings; none returns `Result` or separates NXDOMAIN from SERVFAIL by type.

### 4. Cloudflare's DNS API for zones the account owns

**Rejected because**: the names being checked belong to customers, in zones the account does not
control; only a public resolver sees them.

## References

- [RFC 8484 - DNS Queries over HTTPS](https://www.rfc-editor.org/rfc/rfc8484)
- [RFC 1035 - Domain Names: Implementation and Specification](https://www.rfc-editor.org/rfc/rfc1035)
- [RFC 2308 - Negative Caching of DNS Queries](https://www.rfc-editor.org/rfc/rfc2308)
- [RFC 3597 - Handling of Unknown DNS Resource Record Types](https://www.rfc-editor.org/rfc/rfc3597)
- [RFC 6895 - DNS IANA Considerations (RCODEs)](https://www.rfc-editor.org/rfc/rfc6895)
- [RFC 8659 - DNS CAA Resource Record](https://www.rfc-editor.org/rfc/rfc8659)
- [Cloudflare DNS over HTTPS: JSON format](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)
- [Google Public DNS: JSON API](https://developers.google.com/speed/public-dns/docs/doh/json)
- [uptime ADR-026: Domain DNS Monitors with Record Import](./uptime/ADR-026-domain-dns-monitors-with-record-import.md)
- [ADR-053: Cache Package with Adapters](./ADR-053-cache-package-with-adapters.md)

## Notes

- Cloudflare's JSON endpoint is `https://cloudflare-dns.com/dns-query` with `Accept:
application/dns-json`; Google's is `https://dns.google/resolve` and answers JSON regardless of
  `Accept`
- The package lowercases names and drops the trailing dot on output only; the query goes out as the
  caller wrote it, so an internationalized name must already be in its ASCII (punycode) form
