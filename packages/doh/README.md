# @sdxc/doh

Typed DNS over HTTPS lookups.

A runtime with no DNS socket, such as a Cloudflare Worker, resolves names with a `fetch` to a
public resolver. This package speaks the DoH JSON API (`application/dns-json`) that Cloudflare
and Google answer, returns records typed per query type, and gives each kind of failure its own
error class. The `./caa` entry point reads CAA records the way a certificate authority does.

## Installation

```sh
npm add @sdxc/doh
```

Every lookup returns a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
and record data is read by [`@sdxc/zone-file`](https://www.npmjs.com/package/@sdxc/zone-file); both
install alongside this package.

## Usage

### Look up records

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";

let answer = await resolve("example.com", "MX");
if (isSuccess(answer)) {
	for (let record of answer.data.records) {
		record.preference; // 10
		record.exchange; // "mail.example.com"
	}
	answer.data.ttl; // the smallest TTL across the records
}
```

Each record carries the fields of its type plus `name` and `ttl`. A name that exists with no
records of the type (NODATA) succeeds with an empty `records`, and `chain` lists any CNAMEs
followed to reach them.

### Tell failures apart

```typescript
import { NameNotFoundError, resolve, ServerFailureError, TransportError } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

let answer = await resolve("app.example.com", "A", { timeoutMs: 2000 });
if (isFailure(answer)) {
	if (answer.error instanceof NameNotFoundError) return "the name does not exist";
	if (answer.error instanceof ServerFailureError) return "the resolver failed (SERVFAIL)";
	if (answer.error instanceof TransportError) return "no DNS answer";
	return answer.error.message;
}
```

### Verify domain ownership

```typescript
import { checkCname, verifyTxtRecord } from "@sdxc/doh";

let verified = await verifyTxtRecord("_verify.example.com", "token_abc123"); // Result<boolean>
let pointed = await checkCname("shop.example.com", "custom.hosting.com"); // Result<boolean>
```

Both read NXDOMAIN as `success(false)`, since an unpublished record is the ordinary state of a
verification in progress.

### Check whether a CA may issue

```typescript
import { mayIssue } from "@sdxc/doh/caa";

let verdict = await mayIssue({ domain: "*.example.com", issuer: "letsencrypt.org" });
if (!verdict.allowed) verdict.reason; // "not-authorized", "forbidden", "lookup-failed", …
```

## API

### `resolve(name, type, options?): Promise<Result<DoH.Answer<Type>, DoHError>>`

Looks up `name`'s records of `type` with one `fetch` and no state. Send an internationalized name
in its ASCII (punycode) form. Options:

- `resolver`: `CLOUDFLARE` (default), `GOOGLE`, or any `{ url, format: "json" }`
- `dnssec`: sets `do=1`
- `checkingDisabled`: sets `cd=1`
- `signal`: aborts the request
- `timeoutMs`: abandons the request as a `TransportError`, default `5000`

The answer holds `records`, `unparsed` (records of the type whose data did not parse, with their
raw `data`), `chain` (the CNAMEs followed to reach `records`), `ttl` (smallest across `records`
and `unparsed`, `null` when both are empty), `authenticated` (the AD flag), `truncated` (the TC
flag), `name`, `type` and `durationMs`. Names come back lowercased without the trailing dot, and
AAAA addresses in RFC 5952 form.

Typed record fields: `A` and `AAAA` (`address`), `CNAME`, `PTR` and `DNAME` (`target`), `NS`
(`host`), `MX` (`preference`, `exchange`), `TXT` (`text`, `strings`), `CAA` (`flags`, `critical`,
`tag`, `value`), `SRV` (`priority`, `weight`, `port`, `target`), `SOA` (`primary`, `mailbox`,
`serial`, `refresh`, `retry`, `expire`, `minimum`). Any other type gives a raw `data` string.

### `verifyTxtRecord(name, expected, options?): Promise<Result<boolean, DoHError>>`

Whether `name` publishes a TXT record whose joined text equals `expected`, so a token split into
several character-strings still matches. NXDOMAIN is `success(false)`.

### `checkCname(name, target, options?): Promise<Result<boolean, DoHError>>`

Whether `name` aliases `target`, directly or through up to eight CNAME hops, compared
case-insensitively without the trailing dot. It holds even when the target resolves to nothing.
NXDOMAIN is `success(false)`.

### `CLOUDFLARE` / `GOOGLE`

The resolvers `https://cloudflare-dns.com/dns-query` and `https://dns.google/resolve`, ready to
pass as `resolver`.

### Errors

| Class                | When                                                                       | Extra fields                                                     |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `DoHError`           | Base of every failure                                                      |                                                                  |
| `NameNotFoundError`  | NXDOMAIN (RCODE 3)                                                         | `ttl`: the SOA's negative-caching TTL or `null`; `authenticated` |
| `ServerFailureError` | SERVFAIL (RCODE 2), DNSSEC validation failures included                    |                                                                  |
| `ResponseCodeError`  | Any other non-zero RCODE                                                   | `rcode`                                                          |
| `TransportError`     | Network error, timeout, abort, non-2xx, or a body that is not a DNS answer | `status`: the HTTP status, `null` when no response arrived       |

### `parseCaaProperty(record): CAA.Property` from `./caa`

Reads what one CAA record asks of a CA. `issue` and `issuewild` give `{ issuer, malformed,
parameters }`, with `issuer: null` when the value names none or fails RFC 8659's grammar (both
forbid issuance). `iodef` gives `{ url }`. Any other tag gives `{ kind: "unknown", tag, value }`.

```typescript
parseCaaProperty({
	type: "CAA",
	flags: 0,
	critical: false,
	tag: "issue",
	value: "ca.com; accounturi=x",
});
// { kind: "issue", critical: false, issuer: "ca.com", malformed: false,
//   parameters: [{ key: "accounturi", value: "x" }] }
```

### `findRelevantCaa(domain, options?): Promise<Result<CAA.RelevantSet, DoHError>>` from `./caa`

Finds the CAA RRset RFC 8659 applies to `domain`: its own, or the nearest ancestor's, one query
per label. A leading `*.` is dropped. The set holds `name` (where the records live, `null` when
nowhere), `records`, `unparsed`, `chain`, `queried` and `authenticated` (every answer in the climb
carried the AD flag).

### `evaluateCaa(records, request): CAA.Decision` from `./caa`

Decides a request `{ domain, issuer, accountUri?, validationMethod? }` against one RRset with no
I/O. `issuer` is one CAA identifier or a list; a `*.` domain reads `issuewild` when the set has
any. Checked in this order:

| `reason`                                          | `allowed` | When                                                             |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `no-policy`                                       | `true`    | No records                                                       |
| `critical-tag`                                    | `false`   | A critical property with a tag this package does not interpret   |
| `unrestricted`                                    | `true`    | No property applies, such as only `iodef`                        |
| `authorized`                                      | `true`    | A property names the issuer and its parameters are satisfied     |
| `account-mismatch` / `validation-method-mismatch` | `false`   | RFC 8657 `accounturi` or `validationmethods` exclude the request |
| `not-authorized`                                  | `false`   | Properties name other issuers, listed in `issuers`               |
| `forbidden`                                       | `false`   | Every applicable property names no issuer                        |

An omitted `accountUri` or `validationMethod` passes that check.

### `mayIssue(request, options?): Promise<CAA.Verdict>` from `./caa`

`findRelevantCaa` then `evaluateCaa`, with the RRset in `relevant`. It adds two refusals, as a CA
does: `unreadable` when the set holds a record that does not parse, and `lookup-failed` (with
`name`, `queried` and `error`) when a query in the climb fails.

### Types

- `DoH`: `RecordType`, `Resolver`, `ResolveOptions`, `Answer<Type>`, `RecordFor<Type>`,
  `RecordBase`, `UnknownRecord`, and one alias per typed record (`ARecord` through `SOARecord`).
- `CAA` (from `./caa`): `Record`, `Parameter`, `Property` and its three variants, `RelevantSet`,
  `Request`, `Decision`, `Verdict`, and one interface per reason. Every one but `LookupFailed` is
  plain data, ready to log or store.

## Pattern: Cache Answers And Absences By TTL

Each answer carries the TTL to cache it for, and an NXDOMAIN carries the negative-caching TTL from
the zone's SOA.

```typescript
import { env } from "cloudflare:workers";
import { NameNotFoundError, resolve } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

async function cachedAddresses(hostname: string): Promise<string[] | null> {
	let key = `doh:A:${hostname}`;
	let cached = await env.DNS_CACHE.get<string[]>(key, "json");
	if (cached) return cached;

	let answer = await resolve(hostname, "A");
	if (isFailure(answer)) {
		if (!(answer.error instanceof NameNotFoundError)) return null;
		let expirationTtl = Math.max(answer.error.ttl ?? 60, 60);
		await env.DNS_CACHE.put(key, "[]", { expirationTtl });
		return [];
	}

	let addresses = answer.data.records.map((record) => record.address);
	let expirationTtl = Math.max(answer.data.ttl ?? 60, 60);
	await env.DNS_CACHE.put(key, JSON.stringify(addresses), { expirationTtl });
	return addresses;
}
```

## Pattern: Confirm A Failure With A Second Resolver

A SERVFAIL or timeout from one resolver may be that resolver's problem. Ask another before
reporting it, and require DNSSEC validation when the answer must be trusted.

```typescript
import { GOOGLE, resolve, ServerFailureError, TransportError } from "@sdxc/doh";
import { isFailure, isSuccess } from "@sdxc/result";

let options = { dnssec: true, timeoutMs: 3000 };
let answer = await resolve("example.com", "TXT", options);
if (
	isFailure(answer) &&
	(answer.error instanceof ServerFailureError || answer.error instanceof TransportError)
) {
	answer = await resolve("example.com", "TXT", { ...options, resolver: GOOGLE });
}

let trusted = isSuccess(answer) && answer.data.authenticated;
```

## Pattern: A Custom Domain Onboarding Check

A customer proves ownership with a TXT token and points their host at yours with a CNAME. Report
each step separately, and keep a lookup failure apart from "not set up yet".

```typescript
import { checkCname, verifyTxtRecord } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

async function checkDomain(hostname: string, token: string) {
	let owned = await verifyTxtRecord(`_verify.${hostname}`, token);
	let pointed = await checkCname(hostname, "custom.hosting.com");
	if (isFailure(owned) || isFailure(pointed)) return { status: "retry-later" as const };
	return { status: "checked" as const, owned: owned.data, pointed: pointed.data };
}
```

## Pattern: Compare A Zone File With DNS

A zone file and a resolver can spell one record differently, such as `0 issue "ca.com"` against
RFC 3597 generic data. Parse both with `@sdxc/zone-file` and print them, and equal records give
equal strings.

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";
import { formatRecordData, parseRecordData } from "@sdxc/zone-file";

let published = parseRecordData("CAA", '0 issue "letsencrypt.org"');
let answer = await resolve("example.com", "CAA");
if (isSuccess(published) && isSuccess(answer)) {
	let live = new Set(answer.data.records.map(formatRecordData));
	let missing = !live.has(formatRecordData(published.data));
}
```

## Pattern: Decide A CAA Policy Before Publishing It

`evaluateCaa` runs on records from anywhere, so a policy can be checked against a request before
it reaches DNS, and `parseCaaProperty` shows what each record asks.

```typescript
import { isSuccess } from "@sdxc/result";
import { evaluateCaa, parseCaaProperty } from "@sdxc/doh/caa";
import type { CAA } from "@sdxc/doh/caa";
import { parseRecordData } from "@sdxc/zone-file";

let lines = ['0 issue "letsencrypt.org; validationmethods=dns-01"', '0 issuewild ";"'];
let records: CAA.Record[] = [];
for (let line of lines) {
	let parsed = parseRecordData("CAA", line);
	if (isSuccess(parsed)) records.push(parsed.data);
}

records.map(parseCaaProperty); // [{ kind: "issue", issuer: "letsencrypt.org", … }, { kind: "issuewild", issuer: null, … }]

evaluateCaa(records, {
	domain: "example.com",
	issuer: "letsencrypt.org",
	validationMethod: "dns-01",
});
// { allowed: true, reason: "authorized", property: … }
evaluateCaa(records, {
	domain: "example.com",
	issuer: "letsencrypt.org",
	validationMethod: "http-01",
});
// { allowed: false, reason: "validation-method-mismatch", property: … }
evaluateCaa(records, { domain: "*.example.com", issuer: "letsencrypt.org" });
// { allowed: false, reason: "forbidden" }
```

## Pattern: Explain A CAA Refusal

A CA refuses when its CAA lookup fails, so `mayIssue` answers `allowed: false` for a failing
lookup too. Narrow on `reason` to retry the lookup, or to tell the domain owner where the
blocking policy lives.

```typescript
import { GOOGLE } from "@sdxc/doh";
import { mayIssue } from "@sdxc/doh/caa";

let request = { domain: "shop.example.com", issuer: ["letsencrypt.org", "pki.goog"] };
let verdict = await mayIssue(request);
if (verdict.reason === "lookup-failed") verdict = await mayIssue(request, { resolver: GOOGLE });

if (verdict.reason === "not-authorized") {
	let where = verdict.relevant.name; // "example.com"
	let allowed = verdict.issuers; // ["digicert.com"]
	let validated = verdict.relevant.authenticated;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/doh": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
