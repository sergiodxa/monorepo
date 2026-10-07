# @sdxc/doh

Typed DNS over HTTPS lookups.

## Installation

```bash
npm add @sdxc/doh
```

Every lookup returns a [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value, which
installs alongside this package.

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

### Read Record Data From Anywhere

```typescript
import { parseRecordData } from "@sdxc/doh";

let data = parseRecordData("MX", "10 mail.example.com.");
// success({ type: "MX", preference: 10, exchange: "mail.example.com" })
```

## API

### `@sdxc/doh`

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
(`preference`, `exchange`), `TXT` (`text`, `strings`), `CAA` (`flags`, `critical`, `tag`, `value`), `SRV`
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

#### `formatRecordData(data): string`

Prints record data in canonical presentation format, the inverse of `parseRecordData`: names
absolute with the trailing dot (the root stays `"."`), TXT strings and the CAA value quoted with `"`
and `\` escaped and every octet outside printable ASCII as `\DDD`, the CAA tag lowercased. Untyped
records print their raw `data`. For any `data` that `parseRecordData` produced,
`parseRecordData(data.type, formatRecordData(data))` gives back `data`, so two spellings of one
record print to one string.

```typescript
formatRecordData(unwrap(parseRecordData("CAA", '0 ISSUE "comodoca.com"'))); // '0 issue "comodoca.com"'
formatRecordData({ type: "MX", preference: 10, exchange: "mx.example.com" }); // "10 mx.example.com."
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
`{ url: "https://dns.google/resolve", format: "json" }`.

#### Errors

| Class                | When                                                                       | Extra field                                                                                               |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DoHError`           | Base of every `resolve` failure                                            |                                                                                                           |
| `NameNotFoundError`  | RCODE 3, NXDOMAIN                                                          | `ttl`: the SOA's negative-caching TTL, or `null`; `authenticated`: the AD flag, a DNSSEC-validated denial |
| `ServerFailureError` | RCODE 2, SERVFAIL, DNSSEC validation failures included                     |                                                                                                           |
| `ResponseCodeError`  | Any other non-zero RCODE (FORMERR, NOTIMP, REFUSED)                        | `rcode`                                                                                                   |
| `TransportError`     | Network error, timeout, abort, non-2xx, or a body that is not the envelope | `status`: the HTTP status, `null` when none arrived                                                       |
| `RecordDataError`    | `parseRecordData` on data that does not fit the type                       |                                                                                                           |

#### `DoH` namespace

Types only: `RecordType`, `Resolver`, `ResolveOptions`, `Answer<Type>`, `RecordFor<Type>`,
`RecordData<Type>`, `RecordBase`, the nine record interfaces (`ARecord` through `SOARecord`), and
`UnknownRecord`.

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
import { formatRecordData, parseRecordData, resolve } from "@sdxc/doh";
import { isSuccess } from "@sdxc/result";

let published = parseRecordData("CAA", zoneLine.data);
let answer = await resolve("example.com", "CAA");
if (isSuccess(published) && isSuccess(answer)) {
	let live = new Set(answer.data.records.map(formatRecordData));
	let missing = !live.has(formatRecordData(published.data));
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
