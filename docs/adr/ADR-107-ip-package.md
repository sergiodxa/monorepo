# ADR-107: IP Package

## Status

**Accepted** - 2026-10-05

## Background

Three places decide whether an IP address belongs to the public internet before fetching a URL
someone else chose, and each decides differently. One of them parses IPv4 and IPv6 into numbers
and checks published special-purpose ranges; one tests the first two octets by hand; one refuses
every address literal outright. The repo also keys its rate limits on the raw client address,
which for an IPv6 client means one key per address in a range the client controls in its
entirety.

None of this is specific to the apps that wrote it. Parsing an address, testing it against a
range, classifying it and normalizing it for a key are the same operations wherever they run.

## Context

### Current address handling

| Location                                                                                                  | What it does                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/services/trial-guard.ts`                                                                 | Parses IPv4 and IPv6 (including `::` compression and a trailing dotted quad), checks 14 IPv4 and 7 IPv6 blocked ranges, unpacks the IPv4 inside IPv4-mapped, NAT64 and 6to4 addresses, and checks every address a hostname resolves to |
| `apps/reader/app/lib/media.ts` `isPrivateIpv4`, `isPrivateIpv6`                                           | Compares octets by hand; treats any `::ffff:` address and the `fc00::/7` and `fe80::/10` prefixes as private                                                                                                                           |
| `packages/distill/src/lib/limits.ts` `isAddressableHost`                                                  | Refuses every IPv4 literal and every bracketed host, without parsing either                                                                                                                                                            |
| `apps/uptime/app/lib/dns-record-value.ts` `isIpv4Address`                                                 | A regular expression for a dotted quad, to validate a stored `A` record                                                                                                                                                                |
| `packages/get-client-ip` and the rate limits in `apps/blog`, `apps/demo`, `apps/auth-saas`, `apps/uptime` | Read `CF-Connecting-IP` and use the string as the limit key                                                                                                                                                                            |

### Divergences

| Range or case                                                                        | `uptime` | `reader`                                             | `distill`               |
| ------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------- | ----------------------- |
| Documentation (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`) | Blocked  | Only `192.0.2.0/24`, inside its `192.0.0.0/16` check | Blocked (every literal) |
| A public IPv4 written as an address literal                                          | Allowed  | Allowed                                              | Blocked                 |
| `::ffff:8.8.8.8`, a public IPv4-mapped address                                       | Allowed  | Blocked                                              | Blocked                 |
| NAT64 `64:ff9b::a00:1`, which embeds `10.0.0.1`                                      | Blocked  | Allowed                                              | Blocked                 |
| Teredo `2001::/32`                                                                   | Blocked  | Allowed                                              | Blocked                 |

Each column is a reasonable policy written at a different time. The disagreement is in what the
ranges are, not in what each caller wants, and that is the part a package fixes.

### The rate limit key

An IPv6 client is normally assigned a whole `/64`, so it can send each request from a different
address. A limit keyed on the full address then counts every request separately. Keying IPv6 on
its `/64` and IPv4 on the full address is the common practice, and today every app would have to
write it.

## Decision

Add `@sdxc/ip`: parse IPv4 and IPv6 addresses and CIDR ranges into value objects that test
membership, classify an address against the IANA special-purpose registries, read the IPv4
address embedded in an IPv6 one, and print themselves canonically. It has no dependencies and
performs no I/O, so it runs anywhere a string arrives: a URL host, a DNS answer, a request header.

### `IP` is a value object

An `IP` is one parsed, valid address. Code that holds an `IP` holds an address that was checked,
and a function that takes one cannot be handed `"unknown"`, `"10.0.0"` or a hostname.

```typescript
import { IP } from "@sdxc/ip";

let parsed = IP.parse("2001:DB8::0:1"); // Result<IP, IP.Error>
if (isFailure(parsed)) return parsed;

let ip = parsed.data;
ip.version; // 6
ip.toString(); // "2001:db8::1"
ip.isPublic; // false: documentation range
```

- **The constructor is private.** `IP.parse` is the only way to get an instance, so every `IP`
  is valid and parsing never throws. This is the shape `Schedule` in `@sdxc/cron` has.
- **Instances are immutable.** Every method answers a new value.
- **`IP.parse` accepts what a URL host or a header carries.** Brackets are accepted (`[::1]`),
  since that is how a URL host spells IPv6. Only canonical dotted-decimal IPv4 parses: `URL`
  already normalizes octal, hex and bare-integer hosts into dotted decimal, and refusing them
  here keeps a non-URL input from reaching a different address than it appears to name. Zone
  identifiers (`fe80::1%eth0`) are refused, since no URL a Worker fetches carries one.

### The `IP` export

One name carries everything. The runtime pieces are the `IP` class and two classes reached
through its static properties; the namespace merged with it holds only types, as the
repository's rules require.

| Member                             | Kind                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `IP.parse(text)`                   | Static method, answering `Result<IP, IP.Error>`             |
| `IP.Range`                         | Static property holding the range class, and the range type |
| `IP.Range.parse(text)`             | Static method, answering `Result<IP.Range, IP.Error>`       |
| `IP.Error`                         | Static property holding the error class, and the error type |
| `IP.Classification`, `IP.Prefixes` | Types in the merged namespace                               |

`IP.Error` is a value as well as a type, so `instanceof IP.Error` works. Its `code` is
`"invalid-address"`, `"invalid-range"` or `"host-bits-set"`.

### Classifying

```typescript
ip.classification; // IP.Classification
// "public" | "unspecified" | "loopback" | "private" | "shared" | "link-local"
// | "documentation" | "benchmarking" | "multicast" | "reserved" | "unique-local"
// | "teredo" | "discard"

ip.isPublic; // ip.classification === "public", after unwrapping an embedded IPv4
ip.embeddedIPv4; // IP | null
```

- The ranges are the IANA IPv4 and IPv6 Special-Purpose Address Registries, as one table in the
  package with the RFC each row comes from. `uptime`'s current lists are that table's subset,
  and its tests become the package's fixtures.
- `isPublic` unwraps IPv4-mapped (`::ffff:0:0/96`), NAT64 (`64:ff9b::/96`) and 6to4
  (`2002::/16`) addresses and classifies the IPv4 inside, so `::ffff:10.0.0.1` is private and
  `::ffff:8.8.8.8` is public. `embeddedIPv4` gives callers the inner address itself.

### Ranges

```typescript
let range = IP.Range.parse("10.0.0.0/8"); // Result<IP.Range, IP.Error>
IP.Range.parse("10.0.0.1/8"); // failure: IP.Error { code: "host-bits-set" }

range.data.contains(ip); // false across versions
range.data.toString(); // "10.0.0.0/8"
ip.network({ v4: 32, v6: 64 }); // IP.Range: the network this address sits in
ip.network({ v4: 32, v6: 64 }).toString(); // "2001:db8:1:2::/64", a rate limit key
```

`IP.Range` follows the same rules as `IP`: private constructor, immutable, canonical text.

### Equality and serialization

`===` compares object identity in JavaScript, and no method or symbol changes that for two
objects. Two `IP`s for the same address are therefore compared by value:

```typescript
ip.equals(other); // same version and same address
ip.toString(); // RFC 5952 canonical text: lowercase, longest zero run compressed
JSON.stringify({ ip }); // '{"ip":"2001:db8::1"}', through toJSON
```

- `toString()` is canonical, so two spellings of one address give one string. That string is
  the key for a `Map`, a `Set`, a rate limit, a log field or a database column.
- `toJSON()` answers the same string, so an `IP` can go into a log or a response as is.
- An `IP` that crosses a structured clone (Durable Object storage, `postMessage`) arrives as a
  plain object without its methods; store `toString()` and parse it back on read.

### What stays out

- **Hostnames.** Whether `foo.internal` or `printer.local` is a public name is a naming policy
  for outbound requests, owned by ADR-108.
- **DNS resolution.** Resolving a name and classifying every answer belongs to the outbound
  checks, which already depend on `@sdxc/doh`.
- **Reading the client address from a request.** That stays in `@sdxc/get-client-ip`, which
  answers an `IP` once this package exists (below).

### `@sdxc/get-client-ip` answers an `IP`

`getClientIP(request)` changes from `string | null` to `IP | null`. It reads
`CF-Connecting-IP` and parses it; a malformed header answers `null`, the same as a missing one,
so a caller's existing `?? UNKNOWN` fallback covers both and a junk header can no longer become a
rate limit key or a stored address.

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

getClientIP(request); // IP | null
```

The change breaks the package's API, and every caller is updated in the same rollout:

| Use                   | Callers                                                                               | Change                                      |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| Rate limit key        | `apps/blog` (2), `apps/demo`, `apps/r3-auth` (2)                                      | `ip.network({ v4: 32, v6: 64 }).toString()` |
| Stored or logged      | `apps/auth-saas` `request-origin`, `apps/r3-auth` sign-in alert and provider callback | `ip?.toString() ?? null`                    |
| Handed on as a string | `apps/auth-saas` Turnstile `remoteIp`, `apps/books` Buttondown                        | `ip?.toString()`                            |

Two places read the header themselves and move to `getClientIP`: `packages/captcha`'s default
`remoteIp` and `apps/uptime`'s cron-job ping. The ping also falls back to `X-Forwarded-For` for the
source address it records on each ping, a header the client controls; that fallback is dropped in
the move, so a recorded address is always the one Cloudflare saw.

### `@sdxc/get-client-ip/middleware`

A router middleware parses the address once per request and publishes it as `ctx.ip`, so
handlers and other middleware read it without touching headers:

```typescript
import getClientIP from "@sdxc/get-client-ip/middleware";

let router = createRouter({ middleware: [log(logger), getClientIP()] });

router.get(routes.home, (ctx) => {
	ctx.ip; // IP | null
});
```

- The module augments `RequestContext` with `ip: IP | null`, declared in the module itself so
  the type reaches every project that installs the middleware.
- It exports the context key as `ClientIP`, with its type written out, for code that reads the
  value by key; a context the middleware never ran on reads `null`.
- The middleware is the default export, and `getClientIP(request)` stays at the package root
  for code with a `Request` and no router context, such as a job or a Durable Object.

## Usage Examples

### The trial guard

`uptime`'s `isPublicAddress` and its helpers (`parseIpv4`, `parseIpv6Groups`, `toIpv6Groups`,
`parseIpv6`, `embeddedIpv4`, `inIpv4Range`, `toBits`, `inIpv6Range`) and both blocklists are
replaced by:

```typescript
import { IP } from "@sdxc/ip";

function isPublicAddress(literal: string): boolean {
	let ip = IP.parse(literal);
	return isSuccess(ip) && ip.data.isPublic;
}
```

### The reader's media check

```typescript
export function isRetrievable(url: URL): boolean {
	if (!FETCHABLE_SCHEMES.has(url.protocol)) return false;
	if (url.port !== "" && url.port !== DEFAULT_PORTS[url.protocol]) return false;

	let ip = IP.parse(url.hostname);
	if (isSuccess(ip)) return ip.data.isPublic;

	let host = url.hostname.toLowerCase();
	return host.length > 0 && host !== "localhost" && !host.endsWith(".localhost");
}
```

The documentation, NAT64 and Teredo ranges become refused, and public IPv4-mapped addresses
become allowed, matching `uptime`.

### Validating a stored DNS record

```typescript
export function isIpv4Address(value: string): boolean {
	let ip = IP.parse(value);
	return isSuccess(ip) && ip.data.version === 4 && ip.data.toString() === value;
}
```

Comparing against `toString()` keeps the rule that a stored record is already canonical.

### A rate limit keyed on the client's network

With the middleware installed, the key is one expression:

```typescript
router.use(
	rateLimit({
		adapter,
		prefix: "webmention:ip",
		key: (ctx) => ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN,
	}),
);
```

Without a router context, the same key comes from the request:

```typescript
let key = getClientIP(request)?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN;
```

### Storing the address of a sign-in

```typescript
await alerts.send({ ip: ctx.ip?.toString() ?? null, at: now });
```

### An allowlist

```typescript
const OFFICE_RANGES = ["203.0.113.0/24", "2001:db8:42::/48"];

function isOffice(ip: IP): boolean {
	return OFFICE_RANGES.some((text) => {
		let range = IP.Range.parse(text);
		return isSuccess(range) && range.data.contains(ip);
	});
}
```

### A function that only accepts a checked address

```typescript
function recordProbe(db: Database, target: IP, at: number) {
	return db.create(probes, { target: target.toString(), at });
}

recordProbe(db, "10.0.0.1", now); // type error: a string is not an IP
```

## Consequences

### Positive

- **One answer to "is this address public":** every caller checks the same registry-derived
  table, and a new special-purpose range is added in one place.
- **Fewer surprises at the edges:** the embedded-IPv4 forms are unwrapped everywhere, which is
  where hand-written checks most often go wrong.
- **IPv6-aware rate limits:** a client rotating through its `/64` meets one limit.
- **Smaller app code:** about 200 lines leave `trial-guard.ts`, and both private-address
  helpers leave `media.ts`.

### Negative

- **Behavior changes in `reader`:** it starts refusing documentation, NAT64 and Teredo addresses
  and allowing public IPv4-mapped ones. Nothing legitimate is served from the refused ranges, but
  it is a change.
- **Rate limit keys change** for IPv6 clients when an app adopts `network`, so counters in flight
  at deploy time reset once.

### Neutral

- **Comparison by `equals`, keys by `toString()`.** An `IP` behaves like a `URL`: compared by
  value through a method, stored as its canonical text.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 3 hours

1. Create `packages/ip`, public, exporting the `IP` value object with `IP.Range`, `IP.Error`
   and the merged namespace of types.
2. Encode both IANA registries as one table, each row citing its RFC, and test every row's first
   and last address.
3. Move `trial-guard.ts`'s address tests in as fixtures, and add RFC 5952 formatting cases.
4. Write the README.

### Phase 2: Apps

**Priority:** High
**Estimated Effort:** 2 hours

1. `apps/uptime`: replace the trial guard's address code and `isIpv4Address`.
2. `apps/reader`: replace `isPrivateIpv4` and `isPrivateIpv6`.

### Phase 3: Client address

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `@sdxc/get-client-ip`: `getClientIP` answers `IP | null`, and the `./middleware` export
   publishes `ctx.ip`, with tests for a missing, a malformed, an IPv4 and an IPv6 header.
2. `@sdxc/captcha`: its default `remoteIp` reads through `getClientIP`.
3. Each app installs the middleware and moves its callers: rate limits key on
   `ctx.ip?.network({ v4: 32, v6: 64 })`, stored and forwarded addresses use `toString()`.
   `apps/uptime`'s cron-job ping drops its `X-Forwarded-For` fallback. One commit per workspace:
   `apps/blog`, `apps/demo`, `apps/auth-saas`, `apps/r3-auth`, `apps/books`, `apps/uptime`.

`packages/distill` moves to `@sdxc/ip` through ADR-108 rather than on its own.

## Alternatives Considered

### 1. An npm package (`ipaddr.js`, `ip-address`)

**Rejected because**: `ipaddr.js` covers parsing and ranges but classifies with its own range
names and leaves the embedded-IPv4 forms to the caller, and `ip-address` is several times the
size of what the repo uses. The special-purpose table is the part that has to be right, and it is
small enough to own and test row by row.

### 2. Plain data and static functions

`IP.parse` would answer `{ version: 4, value: number } | { version: 6, value: bigint }`, and
`IP.classify`, `IP.contains` and `IP.format` would take that data.

**Rejected because**: anyone can build the data by hand, so a function taking it has no
guarantee it was parsed, and the IPv6 `bigint` fails `JSON.stringify`. A value object carries
the guarantee in its type and serializes as its canonical text.

### 3. Interning so `===` compares addresses

`IP.parse` would keep a cache and answer the same instance for the same address.

**Rejected because**: the cache grows with every distinct address a rate limiter sees, and the
guarantee ends at the isolate: an `IP` parsed in another Worker or restored from storage is a
different object. `===` that holds only some of the time is worse than an `equals` that always
does.

### 4. Keep the code in `uptime` and export it

**Rejected because**: `packages/*` may not import from `apps/*`, and `reader` and `distill` are
not consumers of the uptime app.

### 5. Fold it into `@sdxc/get-client-ip`

**Rejected because**: most callers classify an address taken from a URL or a DNS answer and never
look at a request.

## References

- [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
- [IANA IPv6 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/)
- [RFC 5952: A Recommendation for IPv6 Address Text Representation](https://www.rfc-editor.org/rfc/rfc5952)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: Apps
- [x] Phase 3: Client address

## Notes

- `apps/uptime` and `apps/reader` are separate commits; Phase 1 is a `feat(ip): …` commit on
  its own.
- `distill`'s refusal of every address literal is a policy choice, not a missing range check; it
  carries over as an option in ADR-108.
