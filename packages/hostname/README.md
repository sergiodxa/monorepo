# @sdxc/hostname

Cloudflare for SaaS custom-hostname client: register, poll and delete customer domains.

A SaaS that lets customers bring their own domain registers each one as a
[custom hostname](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
on a Cloudflare zone, hands the customer a DNS TXT record to prove ownership, and waits for
the certificate to issue. This package is that conversation with the API: one client bound to
one zone, with every response validated before it is returned.

## Installation

```bash
npm add @sdxc/hostname
```

The client needs a Cloudflare API token allowed to edit the zone's custom hostnames, plus
the id of that zone.

## Usage

### Register A Customer Domain

```typescript
import { HostnameClient } from "@sdxc/hostname";

let client = new HostnameClient({
	apiToken: process.env.CF_API_TOKEN,
	zoneId: process.env.CF_ZONE_ID,
	metadataKey: "account_id",
});

let hostname = await client.create("www.customer.example", accountId);

let record = HostnameClient.getValidationTxtRecord(hostname);
if (record) {
	record.name; // TXT record name the customer adds to their DNS
	record.value; // TXT record value
}
```

`create` asks for DV certificates validated over TXT, so the record above is what the
customer publishes to prove they own the domain.

### Poll Until It Goes Live

```typescript
let latest = await client.status(hostname.id);

HostnameClient.isActive(latest); // hostname and certificate are both active
HostnameClient.getStatusMessage(latest); // "Pending DNS validation"
```

`getStatusMessage` turns the two status fields into one sentence you can show the
customer, including the first validation error when Cloudflare reports one.

### Find And Remove A Domain

```typescript
let existing = await client.getByName("www.customer.example");
let owned = await client.listByEntity(accountId);

if (existing) await client.delete(existing.id);
```

`getByName` asks Cloudflare for that one hostname, while `listByEntity` reads every page of
the zone and keeps the hostnames tagged with the entity id.

### Handle A Failed Call

```typescript
import { HostnameApiError, HostnameClient } from "@sdxc/hostname";

try {
	await client.delete(id);
} catch (error) {
	if (error instanceof HostnameApiError && error.statusCode === 404) {
		// the hostname is already gone
	} else throw error;
}
```

## API

### `new HostnameClient(options: HostnameClientOptions)`

A client bound to one Cloudflare zone. `apiToken` and `zoneId` are required;
`platformDomain` is the apex `createDefaultSubdomain` builds on, and `metadataKey` is the
`custom_metadata` key that tags the owning entity, defaulting to `"tenant_id"`.

### `client.create(hostname: string, entityId: string, region?: string): Promise<HostnameResult>`

Registers a custom hostname with DV/TXT SSL validation and a minimum TLS version of 1.2,
storing `entityId` under the configured metadata key. `region` is a location hint kept in
`custom_metadata.region`, defaulting to `"wnam"`.

### `client.status(id: string): Promise<HostnameResult>`

Reads one custom hostname by its Cloudflare id, which is how activation and certificate
progress are polled.

### `client.getByName(hostname: string): Promise<HostnameResult | null>`

Looks a custom hostname up by the domain itself, answering `null` when the zone carries no
such hostname.

### `client.listByEntity(entityId: string): Promise<HostnameResult[]>`

Every custom hostname tagged with that entity id. Cloudflare filters on hostname rather than
on `custom_metadata`, so this walks the zone's pages and matches the metadata key itself.

### `client.delete(id: string): Promise<void>`

Removes a custom hostname from the zone.

### `client.refresh(id: string): Promise<HostnameResult>`

Re-arms DV/TXT validation for a hostname and returns it with the current validation records,
which is what issues a fresh TXT record when the customer never published the first one.

### `client.createDefaultSubdomain(slug: string): string`

The slug's subdomain under the configured `platformDomain` — `createDefaultSubdomain("acme")`
is `"acme.saas.example"`. A subdomain of your own apex is served by the zone already, so it
needs no custom hostname. Calling this without a `platformDomain` throws a `TypeError`.

### `HostnameClient.isActive(result: HostnameResult): boolean`

Whether both the hostname status and the SSL status read `"active"`, which is the point the
domain serves traffic.

### `HostnameClient.isPendingValidation(result: HostnameResult): boolean`

Whether the hostname is still `"pending"` or the certificate is `"pending_validation"`, so
the customer still has DNS work to do.

### `HostnameClient.getValidationTxtRecord(result: HostnameResult): { name: string; value: string } | null`

The TXT record the customer publishes, available while the certificate is
`pending_validation` and `null` otherwise.

### `HostnameClient.getStatusMessage(result: HostnameResult): string`

One human-readable line for the current state: `"Active"`, a pending stage such as
`"SSL certificate being issued"`, or `"Validation failed: …"` carrying Cloudflare's first
validation error.

### `HostnameApiError`

Thrown when Cloudflare answers with an error or with a payload that fails validation.
`statusCode` is the HTTP status, `errors` carries Cloudflare's own `{ code, message }`
entries when the response had them, and `name` is `"CloudflareApiError"`.

### Types

#### `HostnameResult`

What every call answers with: the validation fields flattened for status screens, plus a
nested `ssl` view of the same data.

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

`validationTxtName` and `validationTxtValue` read the first SSL validation record, falling
back to the ownership-verification record Cloudflare returns instead for some hostnames.

#### `HostnameClientOptions`

```typescript
interface HostnameClientOptions {
	apiToken: string;
	zoneId: string;
	platformDomain?: string;
	metadataKey?: string;
}
```

#### `SSLValidationRecord`

One DV record as Cloudflare names it: `{ txt_name: string; txt_value: string }`.

#### `CustomHostname`

The raw hostname object as the API returns it — `id`, `hostname`, `status`, `ssl`, and the
optional `custom_metadata`, `ownership_verification` and `created_at` fields.

## Pattern: Walking A Customer Through Setup

Registration and activation are two moments separated by the customer editing their DNS, so
the flow is one `create` that yields a record to display, then `status` on a schedule until
it goes live:

```typescript
import { HostnameClient } from "@sdxc/hostname";

let client = new HostnameClient({
	apiToken: process.env.CF_API_TOKEN,
	zoneId: process.env.CF_ZONE_ID,
	metadataKey: "account_id",
});

export async function startDomainSetup(accountId: string, domain: string) {
	let result = await client.create(domain, accountId);
	let record = HostnameClient.getValidationTxtRecord(result);

	return {
		id: result.id,
		message: HostnameClient.getStatusMessage(result),
		instructions: record && `Add a TXT record ${record.name} with the value ${record.value}`,
	};
}

export async function checkDomainSetup(id: string) {
	let result = await client.status(id);
	if (HostnameClient.isActive(result)) return { live: true };
	return { live: false, message: HostnameClient.getStatusMessage(result) };
}
```

A customer who let the record expire before publishing it gets a new one from
`client.refresh(id)`, which returns the hostname with fresh validation records.

## Pattern: Mirroring Hostnames In Your Own Database

Cloudflare holds the certificate state and your database holds everything around it, so a
row is written from the result of the call that created the hostname and updated from each
poll:

```typescript
import { HostnameClient } from "@sdxc/hostname";

let result = await client.create(domain, accountId, "weur");
let record = HostnameClient.getValidationTxtRecord(result);

await db.domains.insert({
	id: result.id,
	accountId,
	hostname: result.hostname,
	status: result.status,
	sslStatus: result.sslStatus,
	validationTxtName: record?.name ?? null,
	validationTxtValue: record?.value ?? null,
	createdAt: result.createdAt,
});
```

`listByEntity(accountId)` reads the same set back from Cloudflare, which is what reconciles
the rows after a write that never landed.

## Pattern: One Client Per Zone

The client holds configuration rather than connections, so a module that builds it once and
exports it gives every caller the same zone and the same metadata key:

```typescript
import { HostnameClient } from "@sdxc/hostname";

export let hostnames = new HostnameClient({
	apiToken: process.env.CF_API_TOKEN,
	zoneId: process.env.CF_ZONE_ID,
	platformDomain: "saas.example",
	metadataKey: "account_id",
});
```

The metadata key belongs here because `create` writes it and `listByEntity` filters on it:
one place to set it keeps those two agreeing.

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
