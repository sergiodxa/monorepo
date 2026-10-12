# @sdxc/hostname

Cloudflare for SaaS custom-hostname client: register, poll and delete customer domains.

A SaaS that lets customers bring their own domain registers each one as a
[custom hostname](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
on a Cloudflare zone, shows the customer a DNS TXT record that proves ownership, and waits for
the certificate to issue. `HostnameClient` is bound to one zone and validates every response
before returning it.

## Installation

```sh
npm add @sdxc/hostname
```

The client needs a Cloudflare API token allowed to edit the zone's custom hostnames, and the
id of that zone.

## Usage

### Create a client

```typescript
import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	metadataKey: "account_id",
});
```

`metadataKey` names the `custom_metadata` field that tags each hostname with its owner; it
defaults to `"tenant_id"`.

### Register a domain and show the TXT record

```typescript
let hostname = await client.create("www.customer.com", accountId);

let record = HostnameClient.getValidationTxtRecord(hostname);
if (record) {
	record.name; // TXT record name the customer adds to their DNS
	record.value; // TXT record value
}
```

### Poll until it goes live

```typescript
let latest = await client.status(hostname.id);

HostnameClient.isActive(latest); // true once hostname and certificate are both active
HostnameClient.getStatusMessage(latest); // "Pending DNS validation"
```

### Handle a failed call

Every method throws a `HostnameApiError` when Cloudflare answers with an error or with a
payload that fails validation.

```typescript
import { HostnameApiError } from "@sdxc/hostname";

try {
	await client.delete(id);
} catch (error) {
	if (!(error instanceof HostnameApiError) || error.statusCode !== 404) throw error;
}
```

## API

### `new HostnameClient(options: HostnameClientOptions)`

A client bound to one Cloudflare zone.

- `options.apiToken`: Cloudflare API token with custom-hostname edit permission.
- `options.zoneId`: the zone that owns the custom hostnames.
- `options.platformDomain`: your own apex, used by `createDefaultSubdomain`.
- `options.metadataKey`: the `custom_metadata` key `create` writes the entity id under and
  `listByEntity` filters on. Defaults to `"tenant_id"`.

### `client.create(hostname: string, entityId: string, region?: string): Promise<HostnameResult>`

Registers a custom hostname with a DV certificate validated over TXT and a minimum TLS version
of 1.2, storing `entityId` under the metadata key and `region` (default `"wnam"`) under
`custom_metadata.region`.

### `client.status(id: string): Promise<HostnameResult>`

Reads one custom hostname by its Cloudflare id.

### `client.getByName(hostname: string): Promise<HostnameResult | null>`

Looks a custom hostname up by the domain itself, or `null` when the zone has none.

### `client.listByEntity(entityId: string): Promise<HostnameResult[]>`

Every custom hostname tagged with that entity id. It reads every page of the zone, so its cost
grows with the zone's size.

### `client.delete(id: string): Promise<void>`

Removes a custom hostname from the zone.

### `client.refresh(id: string): Promise<HostnameResult>`

Re-arms TXT validation and returns the hostname with its current validation records.

### `client.createDefaultSubdomain(slug: string): string`

`` `${slug}.${platformDomain}` ``. A subdomain of your own apex is already served by the zone,
so it needs no custom hostname. Throws a `TypeError` when the client has no `platformDomain`.

### `HostnameClient.isActive(result: HostnameResult): boolean`

`true` when both `status` and `sslStatus` are `"active"`, the point the domain serves traffic.

### `HostnameClient.isPendingValidation(result: HostnameResult): boolean`

`true` when `status` is `"pending"` or `sslStatus` is `"pending_validation"`: the customer
still has DNS work to do.

### `HostnameClient.getValidationTxtRecord(result: HostnameResult): { name: string; value: string } | null`

The TXT record to publish while `sslStatus` is `"pending_validation"`, and `null` otherwise.

### `HostnameClient.getStatusMessage(result: HostnameResult): string`

One line for the customer: `"Active"`, `"Validation failed: …"` with Cloudflare's first
validation error, a pending stage (`"Pending DNS validation"`, `"SSL certificate being issued"`,
`"SSL certificate being deployed"`, `"Pending activation"`), or the raw statuses.

### `HostnameApiError`

`statusCode` is the HTTP status, `errors` carries Cloudflare's `{ code, message }` entries when
the response had them, and `name` is `"CloudflareApiError"`.

### Types

#### `HostnameResult`

What every call answers with: the fields a status screen reads, plus a nested `ssl` view of the
same data.

```typescript
interface HostnameResult {
	id: string;
	hostname: string;
	status: string;
	sslStatus: string | null;
	validationTxtName: string | null;
	validationTxtValue: string | null;
	sslValidationErrors: Array<{ message: string }>;
	createdAt: string | null;
	entityId: string | null;
	region: string | null;
	ssl: {
		status: string | null;
		validationRecords: SSLValidationRecord[];
		validationErrors: Array<{ message: string }>;
	};
}
```

`validationTxtName` and `validationTxtValue` come from the first SSL validation record, or from
Cloudflare's ownership-verification record when there is none.

#### `HostnameClientOptions`

The constructor's options, listed above.

#### `SSLValidationRecord`

One DV record as Cloudflare names it: `{ txt_name: string; txt_value: string }`.

#### `CustomHostname`

The raw hostname object the API returns: `id`, `hostname`, `status`, `ssl`, and the optional
`custom_metadata`, `ownership_verification` and `created_at`.

## Pattern: Walking A Customer Through Setup

Registration and activation are separated by the customer editing their DNS: one call registers
the domain and returns instructions, another runs on a schedule until the domain is live, and
a third issues a fresh record when the customer lost the first.

```typescript
import type { HostnameResult } from "@sdxc/hostname";

import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({ apiToken: env.CF_API_TOKEN, zoneId: env.CF_ZONE_ID });

function describe(result: HostnameResult) {
	let record = HostnameClient.getValidationTxtRecord(result);
	return {
		id: result.id,
		live: HostnameClient.isActive(result),
		needsDns: HostnameClient.isPendingValidation(result),
		message: HostnameClient.getStatusMessage(result),
		instructions: record && `Add a TXT record ${record.name} with the value ${record.value}`,
	};
}

export async function startDomainSetup(accountId: string, domain: string) {
	return describe(await client.create(domain, accountId));
}

export async function checkDomainSetup(id: string) {
	return describe(await client.status(id));
}

export async function resendInstructions(id: string) {
	return describe(await client.refresh(id));
}
```

## Pattern: Connecting A Domain Once

A customer may submit the same domain twice, or one another account already connected.
`getByName` finds the existing registration, and its `entityId` says who owns it.

```typescript
import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	metadataKey: "account_id",
});

export async function connectDomain(accountId: string, domain: string) {
	let existing = await client.getByName(domain);
	if (existing === null) return client.create(domain, accountId, "weur");
	if (existing.entityId === accountId) return existing;
	return new Response("Domain already connected to another account", { status: 409 });
}
```

## Pattern: Default Subdomain Or Custom Domain

Every account gets a subdomain of your apex for free and may add its own domain on top. The
subdomain is served by your zone already; only the custom domain goes through Cloudflare for
SaaS.

```typescript
import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	platformDomain: "app-platform.com",
	metadataKey: "account_id",
});

export async function publicHost(account: { id: string; slug: string }) {
	let [custom] = await client.listByEntity(account.id);
	if (custom && HostnameClient.isActive(custom)) return custom.hostname;
	return client.createDefaultSubdomain(account.slug); // "acme.app-platform.com"
}
```

## Pattern: Removing An Account's Domains

Closing an account releases every domain it registered. `listByEntity` finds them through the
metadata key, and a 404 means another process already removed that one.

```typescript
import { HostnameApiError, HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	metadataKey: "account_id",
});

export async function releaseDomains(accountId: string) {
	for (let hostname of await client.listByEntity(accountId)) {
		try {
			await client.delete(hostname.id);
		} catch (error) {
			if (!(error instanceof HostnameApiError) || error.statusCode !== 404) throw error;
		}
	}
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
		"@sdxc/hostname": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
