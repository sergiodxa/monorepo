# @sdxc/doh

Typed DNS over HTTPS lookups.

## Overview

A Cloudflare Worker has no socket to send a DNS query over, so names resolve through DNS over
HTTPS: a `fetch` to a public resolver. This package speaks the DoH JSON API (`application/dns-json`)
that Cloudflare and Google answer, validates the envelope with `remix/data-schema`, and returns a
`Result` whose records are typed per query type: an `MX` query gives `preference` and `exchange`, a
`TXT` query gives the joined `text` with the resolver's quoting and escapes removed.

Failures are classes, so a caller tells "the name is gone" from "the resolver is down" with
`instanceof`: NXDOMAIN is `NameNotFoundError`, SERVFAIL is `ServerFailureError`, any other RCODE is
`ResponseCodeError`, and a request that produced no DNS answer is `TransportError`. A name that
exists with no records of the asked type (NODATA) is a success with no records.

The package calls the global `fetch`, keeps no state, and neither caches nor retries: every answer
carries its TTL for a caller that caches, and retry policy belongs to the caller. The resolver is an
object carrying its `format`, leaving room for an RFC 8484 wire-format resolver later.

## Usage

```typescript
import { resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";

let answer = await resolve("example.com", "MX");
if (isSuccess(answer)) {
	for (let record of answer.data.records) console.log(record.preference, record.exchange);
}
```

Domain ownership checks:

```typescript
import { checkCname, verifyTxtRecord } from "@sdxc/doh";

let verified = await verifyTxtRecord("_verify.example.com", "token_abc123"); // Result<boolean>
let pointed = await checkCname("shop.example.com", "custom.hosting.example"); // Result<boolean>
```

## API

#### `resolve(name, type, options?): Promise<Result<DoH.Answer<Type>, DoHError>>`

Looks up `name`'s records of `type`. The name is sent as written, so an internationalized name must
already be in its ASCII (punycode) form. The answer holds:

- `records` - the records of the asked type, typed by `DoH.RecordFor<Type>`
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

Typed record types: `A` (`address`), `AAAA` (`address`), `CNAME` (`target`), `NS` (`host`), `MX`
(`preference`, `exchange`), `TXT` (`text`, `strings`), `CAA` (`critical`, `tag`, `value`), `SRV`
(`priority`, `weight`, `port`, `target`), `SOA` (`primary`, `mailbox`, `serial`, `refresh`,
`retry`, `expire`, `minimum`). Any other type returns records with a raw `data` string.

#### `parseRecordData(type, data): Result<DoH.RecordData<Type>, RecordDataError>`

The presentation-format reader `resolve` uses, for RDATA from anywhere else, such as a zone file.
Reads RFC 3597 generic data (`\# 4 0A000001`) for the typed types too, which is how Cloudflare
answers CAA. TXT bare words are separate character-strings, per RFC 1035.

```typescript
parseRecordData("TXT", '"v=DKIM1; p=AAA" "BBB"');
// success({ type: "TXT", text: "v=DKIM1; p=AAABBB", strings: ["v=DKIM1; p=AAA", "BBB"] })
```

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
`{ url: "https://dns.google/resolve", format: "json" }`. Tests intercept `CLOUDFLARE.url` with MSW.

#### Errors

| Class                | When                                                                       | Extra field                                         |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `DoHError`           | Base of every `resolve` failure                                            |                                                     |
| `NameNotFoundError`  | RCODE 3, NXDOMAIN                                                          | `ttl`: the SOA's negative-caching TTL, or `null`    |
| `ServerFailureError` | RCODE 2, SERVFAIL, DNSSEC validation failures included                     |                                                     |
| `ResponseCodeError`  | Any other non-zero RCODE (FORMERR, NOTIMP, REFUSED)                        | `rcode`                                             |
| `TransportError`     | Network error, timeout, abort, non-2xx, or a body that is not the envelope | `status`: the HTTP status, `null` when none arrived |
| `RecordDataError`    | `parseRecordData` on data that does not fit the type                       |                                                     |

#### `DoH` namespace

Types only: `RecordType`, `Resolver`, `ResolveOptions`, `Answer<Type>`, `RecordFor<Type>`,
`RecordData<Type>`, `RecordBase`, the nine record interfaces (`ARecord` through `SOARecord`), and
`UnknownRecord`.

## Patterns

### Tell a vanished name from a failing resolver

```typescript
import { NameNotFoundError, resolve } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

let answer = await resolve(owner, "A");
if (isFailure(answer)) {
	if (answer.error instanceof NameNotFoundError) return { records: [] };
	return { error: answer.error.message }; // skip the diff: the resolver is having a bad minute
}

let viaAlias = answer.data.chain.length > 0;
```

### Cache through the answer's TTL

```typescript
let answer = await resolve(hostname, "A");
if (isSuccess(answer)) {
	let seconds = Math.max(answer.data.ttl ?? 60, 60);
	await cache.write(`doh:A:${hostname}`, answer.data.records, { ttl: `${seconds}s` });
}
```

### Confirm a SERVFAIL with a second resolver

```typescript
import { GOOGLE, resolve, ServerFailureError } from "@sdxc/doh";

let answer = await resolve(name, "TXT");
if (isFailure(answer) && answer.error instanceof ServerFailureError) {
	answer = await resolve(name, "TXT", { resolver: GOOGLE });
}
```

## Related Packages

- [`@sdxc/result`](../result/README.md) - the `Result` every function returns, and `retry` for
  callers that want one
- [`@sdxc/cache`](../cache/README.md) - stores answers for their TTL

## Tips

- Keep NXDOMAIN and NODATA apart unless your product rule says they mean the same
- Treat `TransportError` and `ServerFailureError` as "unknown", never as "no records"
- Compare TXT values against `text`, never against the raw resolver data
