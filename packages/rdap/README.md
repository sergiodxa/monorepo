# @sdxc/rdap

Domain registration data over RDAP: a domain's expiry date, status, registrar and nameservers, read from the registry that holds it.

## Installation

```sh
npm add @sdxc/rdap
```

A client keeps the IANA bootstrap file in a cache from [`@sdxc/cache`](https://www.npmjs.com/package/@sdxc/cache), and every lookup answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

### Looking Up A Domain

```typescript
import { MemoryCache } from "@sdxc/cache/memory";
import { RDAP } from "@sdxc/rdap";
import { isFailure } from "@sdxc/result";

let rdap = new RDAP({
	cache: new MemoryCache(),
	userAgent: "ExampleMonitor/1.0 (+https://monitor.example.com)",
});

let looked = await rdap.domain("example.com");
if (isFailure(looked)) return looked;

looked.data.expiresAt; // 1786694400000
looked.data.status; // ["clientDeleteProhibited", "clientTransferProhibited"]
looked.data.registrar; // { name: "Example Registrar, LLC", ianaId: "9999", abuseEmail: null }
```

### In A Cloudflare Worker

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { RDAP } from "@sdxc/rdap";

const RDAP_CLIENT = new RDAP({
	cache: new WorkerKVCache(env.CACHE),
	userAgent: "ExampleMonitor/1.0 (+https://monitor.example.com)",
});
```

The constructor only stores its options, so a client built at module scope does no work at import.

### Asking The Registrar Too

```typescript
let looked = await rdap.domain("example.com", { related: true });
```

`.com` and `.net` are thin registries: they link to the registrar's own RDAP server. With `related: true` the client queries that link and fills the registrar fields the registry left empty. The registry's dates and statuses always stand.

### Handling Failures

```typescript
let looked = await rdap.domain(name);
if (isFailure(looked)) {
	let { code, retryable, retryAfter } = looked.error;
	if (code === "not-found") return markUnregistered(name);
	if (code === "unsupported-tld") return markUnavailable(name);
	if (retryable) return scheduleRetry(name, retryAfter ?? 60_000);
	return markBroken(name, looked.error.message);
}
```

## API

### `new RDAP(options: RDAP.Options)`

- `cache` (required): where the parsed bootstrap file is kept between isolates, under `rdap:bootstrap:dns`.
- `userAgent` (required): sent on every request. A registry that rate-limits identifies the operator by it.
- `bootstrap`: the DNS bootstrap file's URL, for a mirror. Default `https://data.iana.org/rdap/dns.json`.
- `servers`: base URLs by TLD or label sequence, such as `{ "co.uk": "https://rdap.example-registry.com/" }`, matched before the bootstrap file.
- `bootstrapTtl`: how long a fetched bootstrap copy is trusted before a refresh. Default `"1 day"`. An older copy is still served when the refresh fails.
- `timeout`: one deadline per request chain, covering its redirects and the body. Default `"10 seconds"`.
- `maxBytes`: the largest registry response read. Default 1 MiB.

### `rdap.domain(name, options?): Promise<Result<RDAP.Domain, RDAPError>>`

Looks up a registered domain at its registry. The name is trimmed, loses one trailing dot, is lowercased and converted to its A-label form the way a browser converts a host, so `Bücher.com.` queries `xn--bcher-kva.com`.

Pass the **registration**, `example.co.uk` rather than `www.example.co.uk`: a registry answers `not-found` for a name below one. The package ships no public suffix list.

A lookup is one request chain with no retry and no throttle. Every hop is checked by [`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound), so a redirect cannot reach a private address, and the chain stops after three redirects.

### `rdap.server(name): Promise<Result<URL | null, RDAPError>>`

The registry base URL for a name: a `servers` override first, then the bootstrap file, by the longest matching suffix. An entry's HTTPS URL is preferred, and an HTTP one is used only when it is the entry's only URL. `null` means nothing lists the TLD.

### `RDAPError`

Every failure, with a `code`, `retryable`, and the fields the code fills:

| `code`                  | `retryable` | When                                                                          | Fields              |
| ----------------------- | ----------- | ----------------------------------------------------------------------------- | ------------------- |
| `invalid-domain`        | No          | The name is not a multi-label host name                                       | `domain`            |
| `unsupported-tld`       | No          | Neither `servers` nor the bootstrap file lists the TLD                        | `tld`               |
| `not-found`             | No          | The registry answered `404`                                                   | `url`, `status`     |
| `rate-limited`          | Yes         | `429`; `retryAfter` in milliseconds when `Retry-After` was sent               | `url`, `retryAfter` |
| `server-error`          | Yes         | `5xx`                                                                         | `url`, `status`     |
| `refused`               | No          | Any other non-`2xx`, a hop that fails the public-host check, or too many hops | `url`, `status`     |
| `invalid-response`      | No          | The body is not JSON, fails the schema, or is not a domain object             | `url`               |
| `too-large`             | No          | The body passed `maxBytes`                                                    | `url`               |
| `timeout`               | Yes         | The deadline passed                                                           | `url`               |
| `network`               | Yes         | The connection failed or the body broke off                                   | `url`               |
| `bootstrap-unavailable` | Yes         | The bootstrap file could not be fetched and no copy is cached                 | `url`, `cause`      |

A field a code does not fill is `null`.

### `EPP_STATUSES`

Every status value the model names, in EPP spelling: the RFC 8056 codes such as `clientTransferProhibited`, `redemptionPeriod` and `pendingDelete`, plus RDAP's own `active`, `inactive`, `locked`, `associated`, `removed` and `obscured`.

### Types

#### `RDAP.Domain`

| Field                                    | Value                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `name`                                   | A-label form, lowercased, no trailing dot                                              |
| `unicodeName`                            | The U-label form the registry published, or `null`                                     |
| `handle`                                 | The registry's object id, or `null`                                                    |
| `expiresAt`, `registeredAt`, `updatedAt` | Epoch milliseconds of the latest `expiration`, `registration` and `last changed` event |
| `status`                                 | `RDAP.Status[]`: EPP spelling, an unknown value kept as written                        |
| `registrar`                              | `{ name, ianaId, abuseEmail }`, each `string \| null`, or `null`                       |
| `nameservers`                            | Lowercased, no trailing dot, in the order published                                    |
| `dnssec`                                 | `secureDNS.delegationSigned`, or `null` when the registry does not say                 |
| `relatedUrl`                             | The `related` RDAP link, the registrar's record on a thin registry                     |
| `server`                                 | The URL that answered, after redirects                                                 |
| `document`                               | The response as sent, for fields the model omits                                       |

A date the registry omits, or writes in a form that does not parse, is `null`; some ccTLD registries publish no expiry at all.

#### `RDAP.Status`, `RDAP.EppStatus`, `RDAP.Registrar`, `RDAP.Options`, `RDAP.LookupOptions`

The status union, the known statuses, the registrar shape, and the two options objects above.

## Patterns

### Pattern: A Daily Expiry Check Paced Per Registry

Registries rate-limit without documenting it, so a batch groups its domains by registry and runs each group with low concurrency, while different registries run side by side.

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { RDAP } from "@sdxc/rdap";
import { isFailure } from "@sdxc/result";

let rdap = new RDAP({ cache: new WorkerKVCache(env.CACHE), userAgent: "ExampleMonitor/1.0" });

async function checkAll(domains: string[]) {
	let groups = new Map<string, string[]>();
	for (let domain of domains) {
		let server = await rdap.server(domain);
		let key = isFailure(server) || server.data === null ? "none" : server.data.host;
		groups.set(key, [...(groups.get(key) ?? []), domain]);
	}

	await Promise.all([...groups.values()].map((group) => inBatches(group, 2, check)));
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
	for (let start = 0; start < items.length; start += size) {
		await Promise.all(items.slice(start, start + size).map(run));
	}
}

async function check(domain: string) {
	let looked = await rdap.domain(domain);
	if (isFailure(looked)) return recordFailure(domain, looked.error);
	await saveExpiry(domain, looked.data.expiresAt, looked.data.status);
}
```

The bootstrap file is read once per client, so the grouping costs no extra requests.

### Pattern: Honoring `Retry-After` From A Queue

A lookup never waits inside the call, since a `Retry-After` can be minutes. The caller re-enqueues with the server's delay, or its own backoff when the server named none.

```typescript
import { RDAP } from "@sdxc/rdap";
import { isFailure } from "@sdxc/result";

async function handle(message: { domain: string; attempt: number }) {
	let looked = await rdap.domain(message.domain);
	if (isFailure(looked) && looked.error.retryable) {
		let delayMs = looked.error.retryAfter ?? 2 ** message.attempt * 60_000;
		await queue.send(
			{ ...message, attempt: message.attempt + 1 },
			{ delaySeconds: delayMs / 1000 },
		);
		return;
	}
	// store the domain or the permanent failure
}
```

### Pattern: Alerting On Statuses That Stop Resolution

```typescript
import type { RDAP } from "@sdxc/rdap";

const STOPS_RESOLVING = new Set<RDAP.Status>([
	"redemptionPeriod",
	"pendingDelete",
	"clientHold",
	"serverHold",
]);

function needsAlert(domain: RDAP.Domain, warningDays: number): boolean {
	if (domain.status.some((status) => STOPS_RESOLVING.has(status))) return true;
	if (domain.expiresAt === null) return false;
	return domain.expiresAt - Date.now() <= warningDays * 86_400_000;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/rdap": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
