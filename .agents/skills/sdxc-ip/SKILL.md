---
name: sdxc-ip
description: "@sdxc/ip parses IPv4 and IPv6 addresses and CIDR ranges into immutable value objects: `IP.parse(text)` and `IP.Range.parse(text)` answer a `Result`, an `IP` reports `classification`/`isPublic` against the IANA special-purpose registries (unwrapping IPv4-mapped, NAT64 and 6to4), `embeddedIPv4`, `network({ v4, v6 })`, `equals` and RFC 5952 `toString()`. Use when deciding whether a URL host or DNS answer is on the public internet (SSRF guards), keying a rate limit on a client's network, validating a stored address, testing an allowlist range, or when you catch yourself splitting an address on `.` or `:` by hand."
---

# @sdxc/ip

One export, `IP`, carries the address value object, `IP.Range`, `IP.Error` and the types merged under the same name. An `IP` only comes from `IP.parse`, so holding one means holding a checked address. Classification is a longest-prefix match against one table of the IANA IPv4 and IPv6 special-purpose registries, each row citing its RFC. No I/O, no hostname policy, no DNS.

Full API, options and examples: [packages/ip/README.md](packages/ip/README.md)

## When to reach for it

- Refusing to fetch a URL, or a resolved address, that points inside a private network.
- Building a rate-limit key: `ip.network({ v4: 32, v6: 64 }).toString()` puts a client's whole IPv6 `/64` in one bucket.
- Validating or normalizing an address before storing or logging it.
- Testing an address against an allowlist of CIDR ranges.

## Using it

```json
{ "dependencies": { "@sdxc/ip": "workspace:*" } }
```

```ts
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

function isPublicHost(url: URL): boolean {
	let ip = IP.parse(url.hostname); // brackets accepted
	return isSuccess(ip) && ip.data.isPublic;
}

let key = ip.network({ v4: 32, v6: 64 }).toString(); // "2001:db8:1:2::/64"
```

## Suggestions

- Compare with `ip.equals(other)`, key maps and columns on `ip.toString()`; `===` compares identity.
- Store `toString()` across a structured clone (Durable Object storage) and parse it back; the clone drops methods.
- Only canonical dotted-decimal IPv4 parses. Run a URL host through `new URL(...).hostname` first, which normalizes octal and hex.
- Whether a hostname like `printer.local` is public is naming policy, not this package's job.

## Related

- `@sdxc/get-client-ip` — `getClientIP(request)` answers an `IP | null`; skill `sdxc-get-client-ip`
- `@sdxc/rate-limit` — key a limit on `ip.network(...)`; skill `sdxc-rate-limit`
- `@sdxc/doh` — resolve a name before classifying every answer
