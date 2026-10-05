# @sdxc/ip

IPv4 and IPv6 addresses and ranges as value objects that classify against the IANA special-purpose registries.

An `IP` is one parsed, valid address. A function that takes one cannot be handed `"unknown"`, `"10.0.0"` or a hostname, and the address can say whether it is on the public internet, which network it sits in, and how it is spelled canonically. Nothing performs I/O, so it runs wherever an address arrives as text: a URL host, a DNS answer, a request header.

## Installation

```bash
npm add @sdxc/ip
```

Parsing answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package.

## Usage

### Parsing An Address

```typescript
import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

let parsed = IP.parse("2001:DB8::0:1");
if (isFailure(parsed)) return parsed; // IP.Error { code: "invalid-address" }

let ip = parsed.data;
ip.version; // 6
ip.toString(); // "2001:db8::1"
ip.isPublic; // false: documentation range
```

### Refusing A URL That Points Inside The Network

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

function isPublicHost(url: URL): boolean {
	let ip = IP.parse(url.hostname);
	return isSuccess(ip) && ip.data.isPublic;
}

isPublicHost(new URL("http://169.254.169.254/")); // false
isPublicHost(new URL("http://[::ffff:10.0.0.1]/")); // false
isPublicHost(new URL("http://[::ffff:8.8.8.8]/")); // true
```

### Testing A Range

```typescript
let office = IP.Range.parse("203.0.113.0/24");
if (isSuccess(office)) office.data.contains(ip); // false across versions

IP.Range.parse("10.0.0.1/8"); // failure: IP.Error { code: "host-bits-set" }
```

### Keying A Rate Limit On The Client's Network

An IPv6 client is normally assigned a whole `/64`, so a key on the full address counts each address it rotates through separately.

```typescript
ip.network({ v4: 32, v6: 64 }).toString(); // "2001:db8:1:2::/64" or "203.0.113.7/32"
```

## API

### `IP.parse(text): Result<IP, IP.Error>`

Parses an IPv4 or IPv6 address. Brackets around IPv6 are accepted (`[::1]`), the way a URL host spells it. IPv4 must be canonical dotted decimal: `URL` already normalizes octal, hex and bare-integer hosts, and refusing them here keeps any other input from naming a different address than it appears to. Zone identifiers (`fe80::1%eth0`) are refused.

### `IP`

Immutable, and only obtainable from `IP.parse`.

- `version` — `4` or `6`.
- `classification` — what the IANA special-purpose registries say the address is for: `"public"`, `"unspecified"`, `"loopback"`, `"private"`, `"shared"`, `"link-local"`, `"documentation"`, `"benchmarking"`, `"multicast"`, `"reserved"`, `"unique-local"`, `"teredo"` or `"discard"`. IPv6 outside `2000::/3` and not otherwise assigned is `"reserved"`.
- `isPublic` — `classification === "public"`.
- `embeddedIPv4` — the IPv4 address inside an IPv4-mapped (`::ffff:0:0/96`), NAT64 (`64:ff9b::/96`) or 6to4 (`2002::/16`) address, or `null`. `classification` and `isPublic` judge those addresses by the IPv4 inside, so `::ffff:10.0.0.1` is `"private"`.
- `network({ v4, v6 })` — the `IP.Range` the address sits in at the prefix length for its version. A length outside the version's width is clamped into it.
- `equals(other)` — same version and same address. `===` compares object identity, so compare two `IP`s with this.
- `toString()` — canonical text: dotted decimal, or [RFC 5952](https://www.rfc-editor.org/rfc/rfc5952) IPv6 (lowercase, longest zero run compressed, IPv4-mapped ending in a dotted quad), without brackets. Every spelling of one address prints one string, so it is the key for a `Map`, a rate limit, a log field or a database column.
- `toJSON()` — the same string, so `JSON.stringify({ ip })` writes `{"ip":"2001:db8::1"}`.

A structured clone (Durable Object storage, `postMessage`) drops the methods. Store `toString()` and parse it back on read.

### `IP.Range.parse(text): Result<IP.Range, IP.Error>`

Parses `network/prefix` text. A network address with bits set past the prefix fails with `host-bits-set`; anything else malformed fails with `invalid-range`.

### `IP.Range`

Immutable, and only obtainable from `IP.Range.parse` or `ip.network`.

- `network` — the first address, as an `IP`.
- `prefix` — the prefix length.
- `version` — `4` or `6`.
- `contains(ip)` — whether the address shares the range's leading bits. An address of the other version is never a member.
- `equals(other)`, `toString()`, `toJSON()` — as on `IP`; the text is `network/prefix`, such as `2001:db8::/32`.

### `IP.Error`

The failure both parsers answer, never thrown. `code` is `"invalid-address"`, `"invalid-range"` or `"host-bits-set"`, and `input` is the rejected text. It is a class, so `error instanceof IP.Error` narrows.

### Types

`IP.Range`, `IP.Error`, `IP.ErrorCode`, `IP.Classification` and `IP.Prefixes` (`{ v4: number; v6: number }`) are types under the same `IP` name.

## Pattern: An Allowlist Of Networks

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

const OFFICE_RANGES = ["203.0.113.0/24", "2001:db8:42::/48"];

function isOffice(ip: IP): boolean {
	return OFFICE_RANGES.some((text) => {
		let range = IP.Range.parse(text);
		return isSuccess(range) && range.data.contains(ip);
	});
}
```

## Pattern: Checking Every Address A Name Resolves To

A literal check only stops `http://127.0.0.1`. A public name whose `A` record points at an internal address is caught by classifying every answer before fetching:

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

function allPublic(answers: string[]): boolean {
	return (
		answers.length > 0 &&
		answers.every((answer) => {
			let ip = IP.parse(answer);
			return isSuccess(ip) && ip.data.isPublic;
		})
	);
}
```

## Pattern: A Function That Only Accepts A Checked Address

```typescript
import type { IP } from "@sdxc/ip";

function recordProbe(target: IP, at: number) {
	return { target: target.toString(), at };
}

recordProbe("10.0.0.1", Date.now()); // type error: a string is not an IP
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/ip": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
