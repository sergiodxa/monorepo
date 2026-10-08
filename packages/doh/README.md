# @sdxc/doh

Typed DNS over HTTPS lookups.

## Installation

```bash
npm add @sdxc/doh
```

Every lookup returns a [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value, and
records are read by [`@sdxc/zone-file`](https://www.npmjs.com/package/@sdxc/zone-file)'s record data
codec; both install alongside this package.

A runtime with no DNS socket, such as a Cloudflare Worker, resolves names through DNS over HTTPS:
a `fetch` to a public resolver. This package speaks the DoH JSON API (`application/dns-json`)
that Cloudflare and Google answer, validates the envelope, and returns a `Result` whose records
are typed per query type: an `MX` query gives `preference` and `exchange`, a `TXT` query gives
the joined `text` with the resolver's quoting and escapes removed.

Failures are classes, so a caller tells "the name is gone" from "the resolver is down" with
`instanceof`: NXDOMAIN is `NameNotFoundError`, SERVFAIL is `ServerFailureError`, any other RCODE
is `ResponseCodeError`, and a request that produced no DNS answer is `TransportError`. A name
that exists with no records of the asked type (NODATA) is a success with no records.

Each call is one request through the global `fetch` and keeps no state: every answer carries its
TTL for a caller that caches, and retry policy stays with the caller.

## Usage

### Look Up Records

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";

let answer = await resolve("example.com", "MX");
if (isSuccess(answer)) {
	for (let record of answer.data.records) console.log(record.preference, record.exchange);
}
```

### Check Domain Ownership

```typescript
import { checkCname, verifyTxtRecord } from "@sdxc/doh";

let verified = await verifyTxtRecord("_verify.example.com", "token_abc123"); // Result<boolean>
let pointed = await checkCname("shop.example.com", "custom.hosting.example"); // Result<boolean>
```

## API

### `@sdxc/doh`

#### `resolve(name, type, options?): Promise<Result<DoH.Answer<Type>, DoHError>>`

Looks up `name`'s records of `type`. The name is sent as written, so an internationalized name must
already be in its ASCII (punycode) form. The answer holds:

- `records` - the records of the asked type, typed by `DoH.RecordFor<Type>`: the
  `ZoneFile.RecordData<Type>` fields plus `name` and `ttl`, so a resolved record and one read from a
  zone file share every type-specific field
- `unparsed` - records of the asked type whose data did not parse, as `{ name, ttl, type, data }`,
  so one odd record never fails the whole answer
- `chain` - the CNAME records followed before reaching `records`
- `ttl` - the smallest TTL across `records` and `unparsed`, `null` when both are empty
- `authenticated` - the AD flag (the resolver validated DNSSEC); requiring it is the caller's policy
- `truncated` - the TC flag
- `name` (lowercased, no trailing dot), `type`, and `durationMs`

Records of other types (RRSIG with `dnssec: true`, say) are dropped. Owner names and targets come
back lowercased without the trailing dot; an AAAA address comes back in RFC 5952 form.

**Options:**

- `resolver`: `CLOUDFLARE` (default), `GOOGLE`, or `{ url, format: "json" }`
- `dnssec`: sets `do=1`
- `checkingDisabled`: sets `cd=1`
- `signal`: aborts the request
- `timeoutMs`: abandons the request as a `TransportError`, default `5000`

Typed record types: `A` (`address`), `AAAA` (`address`), `CNAME`, `PTR` and `DNAME` (`target`), `NS`
(`host`), `MX` (`preference`, `exchange`), `TXT` (`text`, `strings`), `CAA` (`flags`, `critical`,
`tag`, `value`), `SRV` (`priority`, `weight`, `port`, `target`), `SOA` (`primary`, `mailbox`,
`serial`, `refresh`, `retry`, `expire`, `minimum`). Any other type returns records with a raw `data`
string. To read or print RDATA outside a lookup, use `parseRecordData` and `formatRecordData` from
`@sdxc/zone-file`.

#### `verifyTxtRecord(name, expected, options?): Promise<Result<boolean, DoHError>>`

Whether `name` publishes a TXT record whose joined text is exactly `expected`. A token split into
several character-strings or escaped still matches. NXDOMAIN is `success(false)`, since a record not
yet published is the ordinary state of a verification; every other failure stays a failure.

#### `checkCname(name, target, options?): Promise<Result<boolean, DoHError>>`

Whether `name` aliases `target`, directly or through further CNAMEs, compared case-insensitively and
ignoring the trailing dot. It follows the chain one `CNAME` query per hop (up to eight, stopping on
a loop), so it holds even when the target resolves to nothing. NXDOMAIN is `success(false)`.

#### `CLOUDFLARE` / `GOOGLE`

`{ url: "https://cloudflare-dns.com/dns-query", format: "json" }` and
`{ url: "https://dns.google/resolve", format: "json" }`.

#### Errors

| Class                | When                                                                       | Extra field                                                                                               |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DoHError`           | Base of every `resolve` failure                                            |                                                                                                           |
| `NameNotFoundError`  | RCODE 3, NXDOMAIN                                                          | `ttl`: the SOA's negative-caching TTL, or `null`; `authenticated`: the AD flag, a DNSSEC-validated denial |
| `ServerFailureError` | RCODE 2, SERVFAIL, DNSSEC validation failures included                     |                                                                                                           |
| `ResponseCodeError`  | Any other non-zero RCODE (FORMERR, NOTIMP, REFUSED)                        | `rcode`                                                                                                   |
| `TransportError`     | Network error, timeout, abort, non-2xx, or a body that is not the envelope | `status`: the HTTP status, `null` when none arrived                                                       |

#### `DoH` namespace

Types only: `RecordType`, `Resolver`, `ResolveOptions`, `Answer<Type>`, `RecordFor<Type>`,
`RecordBase`, one alias per typed record (`ARecord` through `SOARecord`, `PTRRecord` and
`DNAMERecord` included), and `UnknownRecord`.

### `@sdxc/doh/caa`

The WebPKI reading of CAA records (RFC 8659, RFC 8657): what a record asks of a certificate
authority, which RRset applies to a name, and whether a CA may issue for it.

#### `parseCaaProperty(record): CAA.Property`

Reads one CAA record's meaning:

- `issue` / `issuewild` - `{ kind, critical, issuer, malformed, parameters }`. The value follows RFC
  8659's grammar, whitespace around `;` and `=` included. `issuer` is lowercased without a trailing
  dot, and `null` when the value names none (`";"`), which forbids issuance. A value that fails the
  grammar reads as `issuer: null, malformed: true`, forbidding issuance the same way. Parameters keep
  their published order and spelling.
- `iodef` - `{ kind, critical, url }`, `url` being `null` unless the value is a `mailto:`, `http:` or
  `https:` URL.
- Any other tag - `{ kind: "unknown", critical, tag, value }`; critical, it forbids issuance.

```typescript
import { parseCaaProperty } from "@sdxc/doh/caa";

parseCaaProperty({
	type: "CAA",
	flags: 0,
	critical: false,
	tag: "issue",
	value: "digicert.com; cansignhttpexchanges=yes",
});
// { kind: "issue", critical: false, issuer: "digicert.com", malformed: false,
//   parameters: [{ key: "cansignhttpexchanges", value: "yes" }] }
```

#### `findRelevantCaa(domain, options?): Promise<Result<CAA.RelevantSet, DoHError>>`

RFC 8659's climb: one `CAA` query for the domain, then for each ancestor up to the TLD, stopping at
the first answer with records. A leading `*.` and a trailing dot are dropped and the name is
lowercased. NODATA and NXDOMAIN move the climb on; any other failure ends it as a failure. Records
reached through a CNAME or DNAME are the target's, with the aliases in `chain`, and when the target
publishes none the climb continues at the alias's parent.

The set holds `name` (where the records were found, `null` when nowhere), `records`, `unparsed`,
`chain`, `queried` (every name asked, nearest first) and `authenticated`: whether every answer in
the climb, denials of existence included, carried the AD flag.

#### `evaluateCaa(records, request): CAA.Decision`

Decides a request against one RRset with no I/O, so records from a zone file decide as records from
DNS do. `request` is `{ domain, issuer, accountUri?, validationMethod? }`: `domain` starting with
`*.` asks about a wildcard certificate, and `issuer` is the CA's CAA identifier or a list of them.
In order:

| Reason                                            | `allowed` | When                                                                                               |
| ------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `no-policy`                                       | `true`    | No records                                                                                         |
| `critical-tag`                                    | `false`   | A critical property of a tag this package does not interpret                                       |
| `unrestricted`                                    | `true`    | No property applies: only `iodef`, non-critical unknown tags, or `issuewild` on a plain name       |
| `authorized`                                      | `true`    | An applicable property names one of the issuers and its parameters are satisfied                   |
| `account-mismatch` / `validation-method-mismatch` | `false`   | Properties name the issuer, and RFC 8657's `accounturi` or `validationmethods` exclude the request |
| `not-authorized`                                  | `false`   | Applicable properties name other issuers, listed in `issuers`                                      |
| `forbidden`                                       | `false`   | Every applicable property names no issuer                                                          |

For a wildcard domain, any `issuewild` property replaces every `issue`. Authorizations add up, so
`issue ";"` beside `issue "ca.example"` still authorizes `ca.example`. Issuers match exactly and
case-insensitively. Two `accounturi` parameters, or a repeated, empty or malformed
`validationmethods`, are never satisfied; an omitted `accountUri` or `validationMethod` passes that
check, and the `authorized` decision carries the property whose parameters show what went unchecked.

#### `mayIssue(request, options?): Promise<CAA.Verdict>`

`findRelevantCaa`, then `evaluateCaa`, with the RRset in `relevant`. Two more refusals:
`unreadable` when the set holds a record that does not parse, and `lookup-failed` when a query in
the climb fails, with the failing `name`, `queried` and the `DoHError`. `options` reach every
query, so `resolver: GOOGLE` confirms a verdict through a second resolver.

The verdict predicts what a CA's own lookup finds when the zone serves it what the resolver saw.

#### `CAA` namespace

Types only: `Record`, `Parameter`, `Property` (`IssueProperty`, `IodefProperty`, `UnknownProperty`),
`RelevantSet`, `Request`, `Decision`, `Verdict` and one interface per reason. Every one but
`LookupFailed` is plain data, ready for a log line or storage.

## Pattern: Tell A Vanished Name From A Failing Resolver

Keep NXDOMAIN and NODATA apart, and treat `TransportError` and `ServerFailureError` as unknown
rather than as "no records".

```typescript
import { NameNotFoundError, resolve } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

let answer = await resolve("app.example.com", "A");
if (isFailure(answer)) {
	if (answer.error instanceof NameNotFoundError) return { records: [] };
	return { error: answer.error.message }; // the resolver is having a bad minute
}

let viaAlias = answer.data.chain.length > 0;
```

## Pattern: Compare A Zone File With DNS

A zone file and a resolver can spell one record differently: `0 ISSUE "ca.example"` in one,
RFC 3597 generic data (`\# 15 00 05 69 73 73 75 65 …`) in the other. Parse both and print them, and
equal records give equal strings.

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";
import { formatRecordData, parseRecordData } from "@sdxc/zone-file";

let published = parseRecordData("CAA", zoneLine.data);
let answer = await resolve("example.com", "CAA");
if (isSuccess(published) && isSuccess(answer)) {
	let live = new Set(answer.data.records.map(formatRecordData));
	let missing = !live.has(formatRecordData(published.data));
}
```

## Pattern: A Lookup Failure Is A Refusal

A CA refuses to issue when its CAA lookup fails, so `mayIssue` answers `allowed: false` for a
failing lookup too. Checking `allowed` alone treats a SERVFAIL the way a CA does; narrow on
`reason` to retry first.

```typescript
import { GOOGLE } from "@sdxc/doh";
import { mayIssue } from "@sdxc/doh/caa";

let request = { domain: "*.example.com", issuer: "letsencrypt.org" };
let verdict = await mayIssue(request);
if (verdict.reason === "lookup-failed") verdict = await mayIssue(request, { resolver: GOOGLE });

if (!verdict.allowed && verdict.reason !== "lookup-failed") {
	verdict.relevant.name; // "example.com": where the blocking policy lives
}
```

## Pattern: Cache Through The Answer's TTL

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";

let answer = await resolve(hostname, "A");
if (isSuccess(answer)) {
	let seconds = Math.max(answer.data.ttl ?? 60, 60);
	await cache.put(`doh:A:${hostname}`, JSON.stringify(answer.data.records), {
		expirationTtl: seconds,
	});
}
```

## Pattern: Confirm A SERVFAIL With A Second Resolver

```typescript
import { GOOGLE, resolve, ServerFailureError } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

let answer = await resolve(name, "TXT");
if (isFailure(answer) && answer.error instanceof ServerFailureError) {
	answer = await resolve(name, "TXT", { resolver: GOOGLE });
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
