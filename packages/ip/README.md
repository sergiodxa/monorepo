# @sdxc/ip

IPv4 and IPv6 addresses and ranges as value objects that classify against the IANA special-purpose registries.

An `IP` is one parsed, valid address: it knows whether it is on the public internet, which network it sits in, and how it is spelled canonically. Everything runs without I/O, wherever an address arrives as text: a URL host, a DNS answer, a request header.

## Installation

```sh
npm add @sdxc/ip
```

Parsing answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package.

## Usage

### Parse an address

```typescript
import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

let parsed = IP.parse("2001:DB8::0:1");
if (isFailure(parsed)) return parsed.error.code; // "invalid-address"

let ip = parsed.data;
ip.version; // 6
ip.toString(); // "2001:db8::1"
ip.equals(ip); // compare two addresses with equals, never ===
```

### Classify it

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

function isPublicHost(url: URL): boolean {
	let ip = IP.parse(url.hostname);
	return isSuccess(ip) && ip.data.isPublic;
}

isPublicHost(new URL("http://169.254.169.254/")); // false: link-local
isPublicHost(new URL("http://[::ffff:10.0.0.1]/")); // false: judged by the IPv4 inside
isPublicHost(new URL("http://[::ffff:8.8.8.8]/")); // true
```

`classification` names what the address is for (`"private"`, `"loopback"`, `"documentation"`, …), and `isPublic` is `classification === "public"`.

### Test a range

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

let range = IP.Range.parse("203.0.113.0/24");
let ip = IP.parse("203.0.113.7");
if (isSuccess(range) && isSuccess(ip)) range.data.contains(ip.data); // true

IP.Range.parse("10.0.0.1/8"); // failure: IP.Error { code: "host-bits-set" }
```

## API

### `IP.parse(text: string): Result<IP, IP.Error>`

Parses an IPv4 or IPv6 address, accepting brackets around IPv6 (`[::1]`) the way a URL host spells it. IPv4 must be canonical dotted decimal, and zone identifiers (`fe80::1%eth0`) fail, so every accepted text names exactly the address it appears to.

### `IP`

An immutable address, obtainable only from `IP.parse`.

- `version`: `4` or `6`.
- `classification`: what the IANA special-purpose registries say the address is for, one of `"public"`, `"unspecified"`, `"loopback"`, `"private"`, `"shared"`, `"link-local"`, `"documentation"`, `"benchmarking"`, `"multicast"`, `"reserved"`, `"unique-local"`, `"teredo"` or `"discard"`. IPv6 outside `2000::/3` and not otherwise assigned is `"reserved"`.
- `isPublic`: `classification === "public"`.
- `embeddedIPv4`: the IPv4 address inside an IPv4-mapped (`::ffff:0:0/96`), NAT64 (`64:ff9b::/96`) or 6to4 (`2002::/16`) address, or `null`. `classification` judges those addresses by the IPv4 inside.
- `network({ v4, v6 })`: the `IP.Range` the address sits in at the prefix length for its version, clamped to the version's width.
- `equals(other)`: same version and same address.
- `toString()`: canonical text, dotted decimal or [RFC 5952](https://www.rfc-editor.org/rfc/rfc5952) IPv6 without brackets. Every spelling of one address prints one string.
- `toJSON()`: the same string, so `JSON.stringify({ ip })` writes `{"ip":"2001:db8::1"}`.

A structured clone (`postMessage`, Durable Object storage) drops the methods, so store `toString()` and parse it back.

### `IP.Range.parse(text: string): Result<IP.Range, IP.Error>`

Parses `network/prefix` text. An address with bits set past the prefix fails with `host-bits-set`; other malformed text fails with `invalid-range`.

### `IP.Range`

An immutable network, obtainable only from `IP.Range.parse` or `ip.network()`.

- `network`: the first address, as an `IP`.
- `prefix`: the prefix length.
- `version`: `4` or `6`.
- `contains(ip)`: whether the address shares the range's leading bits; an address of the other version is never a member.
- `equals(other)`, `toString()`, `toJSON()`: as on `IP`, with the text written `network/prefix`, such as `2001:db8::/32`.

### `IP.Error`

The failure both parsers answer inside a `Result`. `code` is `"invalid-address"`, `"invalid-range"` or `"host-bits-set"`, `input` is the rejected text, and `error instanceof IP.Error` narrows it.

### Types

`IP.Range`, `IP.Error`, `IP.ErrorCode`, `IP.Classification` and `IP.Prefixes` (`{ v4: number; v6: number }`) are types under the same `IP` name.

## Pattern: Refusing A Name That Resolves Inside The Network

Checking the URL host stops `http://127.0.0.1`; classifying every DNS answer before fetching also stops a public name whose record points at an internal address.

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

allPublic(["93.184.215.14"]); // true
allPublic(["93.184.215.14", "10.0.0.5"]); // false
```

## Pattern: An Allowlist Of Networks

Parse the ranges once and test each request's address against them.

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

let allowed = ["203.0.113.0/24", "2001:db8:42::/48"].flatMap((text) => {
	let range = IP.Range.parse(text);
	return isSuccess(range) ? [range.data] : [];
});

function isAllowed(text: string): boolean {
	let ip = IP.parse(text);
	return isSuccess(ip) && allowed.some((range) => range.contains(ip.data));
}

isAllowed("203.0.113.9"); // true
isAllowed("2001:db8:42:7::1"); // true
isAllowed("198.51.100.1"); // false
```

## Pattern: Keying A Rate Limit On The Client's Network

An IPv6 client is usually assigned a whole `/64`, so keying on the full address counts each address it rotates through separately. Key on the network instead, and the canonical text keeps every spelling of one client on one key.

```typescript
import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

function rateLimitKey(text: string): string | null {
	let ip = IP.parse(text);
	if (isFailure(ip)) return null;
	return ip.data.network({ v4: 32, v6: 64 }).toString();
}

rateLimitKey("2001:DB8:1:2::abcd"); // "2001:db8:1:2::/64"
rateLimitKey("2001:db8:1:2:ffff::1"); // "2001:db8:1:2::/64"
rateLimitKey("203.0.113.7"); // "203.0.113.7/32"
```

## Pattern: Reporting Why Input Was Refused

`IP.Error` carries a code to map to your own wording and the text that arrived.

```typescript
import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

let messages: Record<IP.ErrorCode, string> = {
	"invalid-address": "Enter an IPv4 or IPv6 address",
	"invalid-range": "Enter a range such as 10.0.0.0/8",
	"host-bits-set": "Use the network's first address, such as 10.0.0.0/8",
};

function validateRange(text: string): string | null {
	let range = IP.Range.parse(text.trim());
	return isFailure(range) ? messages[range.error.code] : null;
}

validateRange("10.0.0.1/8"); // "Use the network's first address, such as 10.0.0.0/8"
```

## Pattern: Functions That Only Accept A Checked Address

Taking `IP` instead of `string` moves validation to the edge, and `toString()` stores the canonical form.

```typescript
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

function recordProbe(target: IP, at: number) {
	return { target: target.toString(), version: target.version, at };
}

let target = IP.parse("[2001:db8::0:1]");
if (isSuccess(target)) recordProbe(target.data, Date.now()); // { target: "2001:db8::1", ... }

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
