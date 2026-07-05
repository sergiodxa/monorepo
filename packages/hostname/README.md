# @pkg/hostname

Cloudflare for SaaS custom-hostname client for the platform apps.

## Overview

This package wraps the [Cloudflare custom hostnames API](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
so tenant/blog apps can register, poll, and delete customer domains without each
one re-implementing the HTTP calls. It consolidates the two copies that used to
live in `apps/auth-saas` and `apps/blog-saas` into a single client.

Every API response is validated with [`remix/data-schema`](https://remix.run)
before it is returned, so a malformed or unexpected Cloudflare payload throws a
typed `HostnameApiError` instead of silently producing `undefined` fields. The
client is an instance class configured through its constructor, which keeps it
constructor-injectable via [`@pkg/service-container`](/packages/service-container)
(ADR-008) and free of any `cloudflare:workers` `env` coupling — callers pass the
zone id, API token, and platform domain in explicitly.

Cloudflare cannot filter custom hostnames by `custom_metadata`, so the client
tags each hostname with an entity id under a configurable metadata key
(`tenant_id` for auth-saas, `blog_id` for blog-saas) and filters client-side when
listing. The metadata key is the only per-app difference, so nothing about the
data stored on Cloudflare changes when an app adopts this package.

## Usage

### Basic Example

```typescript
import { HostnameClient } from "@pkg/hostname";
import { env } from "cloudflare:workers";

let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	platformDomain: env.PLATFORM_DOMAIN,
	metadataKey: "tenant_id",
});

// Register a customer domain (DV/TXT SSL validation).
let result = await client.create("blog.example.com", tenantId, "wnam");

if (HostnameClient.isPendingValidation(result)) {
	let record = HostnameClient.getValidationTxtRecord(result);
	// Show `record.name` / `record.value` to the customer to add as a DNS TXT.
}
```

### Polling for activation

```typescript
let latest = await client.status(hostnameId);
if (HostnameClient.isActive(latest)) {
	// Both the hostname and its SSL certificate are active.
}
```

## API

### `HostnameClient`

Instance client for the Cloudflare custom hostnames API.

#### `new HostnameClient(options: HostnameClientOptions)`

Creates a client bound to a single Cloudflare zone.

**Parameters:**

- `options.apiToken`: Cloudflare API token with custom-hostname edit permission
- `options.zoneId`: Cloudflare zone id that owns the custom hostnames
- `options.platformDomain?`: Platform apex used by `createDefaultSubdomain` (e.g. `auth.sergiodxa.com`)
- `options.metadataKey?`: `custom_metadata` key that tags the owning entity; defaults to `"tenant_id"`

#### `client.create(hostname: string, entityId: string, region?: string): Promise<HostnameResult>`

Creates a custom hostname tagged with `{ [metadataKey]: entityId, region }` and DV/TXT SSL validation.

**Parameters:**

- `hostname`: The hostname to create
- `entityId`: Owning-entity id stored under the configured metadata key
- `region?`: DO location hint stored in `custom_metadata.region` (defaults to `"wnam"`)

**Returns:**

- The created hostname as a `HostnameResult`

**Example:**

```typescript
let result = await client.create("blog.example.com", tenantId, "wnam");
```

#### `client.status(id: string): Promise<HostnameResult>`

Fetches the current status of a custom hostname by its Cloudflare id.

**Parameters:**

- `id`: The hostname id

**Returns:**

- The hostname as a `HostnameResult`

#### `client.getByName(hostname: string): Promise<HostnameResult | null>`

Looks up a custom hostname by its hostname string.

**Parameters:**

- `hostname`: The hostname string to look up

**Returns:**

- The matching `HostnameResult`, or `null` when none matches

#### `client.listByEntity(entityId: string): Promise<HostnameResult[]>`

Lists every custom hostname owned by an entity. Fetches all pages and filters client-side on the configured metadata key.

**Parameters:**

- `entityId`: The owning-entity id to filter by

**Returns:**

- The matching hostnames

#### `client.delete(id: string): Promise<void>`

Deletes a custom hostname.

**Parameters:**

- `id`: The hostname id to delete

#### `client.refresh(id: string): Promise<HostnameResult>`

Re-triggers SSL validation for a hostname to obtain fresh validation records.

**Parameters:**

- `id`: The hostname id to refresh

**Returns:**

- The refreshed `HostnameResult`

#### `client.createDefaultSubdomain(slug: string): string`

Builds the default subdomain for a slug under the configured `platformDomain`. Default subdomains do not need a custom hostname because they already live under the platform zone.

**Parameters:**

- `slug`: The entity slug

**Returns:**

- The full subdomain, e.g. `"acme.auth.sergiodxa.com"`

**Example:**

```typescript
client.createDefaultSubdomain("acme"); // "acme.auth.sergiodxa.com"
```

#### `HostnameClient.isActive(result: HostnameResult): boolean`

Returns `true` only when both the hostname status and SSL status are `"active"`.

#### `HostnameClient.isPendingValidation(result: HostnameResult): boolean`

Returns `true` when the hostname is `"pending"` or the SSL is `"pending_validation"`.

#### `HostnameClient.getValidationTxtRecord(result: HostnameResult): { name: string; value: string } | null`

Returns the DNS TXT record required for validation, or `null` when validation is not pending or no record is available.

#### `HostnameClient.getStatusMessage(result: HostnameResult): string`

Builds a human-readable status string (e.g. `"Pending DNS validation"`, `"Active"`, `"Validation failed: …"`).

### `HostnameApiError`

Error thrown when a Cloudflare request fails or a response fails schema validation.

**Properties:**

- `statusCode`: `number` - HTTP status code from the API response
- `errors?`: `Array<{ code: number; message: string }>` - Cloudflare error details, when present
- `name`: always `"CloudflareApiError"`

**Example:**

```typescript
try {
	await client.create(hostname, tenantId);
} catch (error) {
	if (error instanceof HostnameApiError && error.statusCode === 404) {
		// Already gone — treat as success.
	}
}
```

### Types

#### `HostnameResult`

Normalized result carrying both the flat validation fields (used by polling jobs)
and a nested `ssl` view / `hostname` / `createdAt` (used by the D1-backed models).

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
		validationRecords: Array<{ txt_name: string; txt_value: string }>;
		validationErrors: Array<{ message: string }>;
	};
}
```

#### `HostnameClientOptions`

```typescript
interface HostnameClientOptions {
	apiToken: string;
	zoneId: string;
	platformDomain?: string;
	metadataKey?: string;
}
```

## Pattern: Service-container registration (ADR-008)

Register the client as a singleton constructed from `env`, then resolve it in jobs
and controllers instead of constructing it ad hoc.

```typescript
import { HostnameClient } from "@pkg/hostname";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";

container.singleton(
	HostnameClient,
	() =>
		new HostnameClient({
			apiToken: env.CF_API_TOKEN,
			zoneId: env.CF_ZONE_ID,
			platformDomain: env.PLATFORM_DOMAIN,
			metadataKey: "blog_id",
		}),
);
```

## Pattern: Wrapping in an app model

Apps keep their own D1-backed model and delegate the Cloudflare side to the client,
translating results into local rows.

```typescript
let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	metadataKey: "tenant_id",
});

let cf = await client.create(hostname, tenantId, region);
let record = HostnameClient.getValidationTxtRecord(cf);

await db.create(Hostname.table, {
	id: cf.id,
	tenant_id: tenantId,
	hostname: cf.hostname,
	status: cf.status === "active" ? "active" : "pending_validation",
	ssl_status: cf.sslStatus,
	validation_txt_name: record?.name ?? null,
	validation_txt_value: record?.value ?? null,
});
```

## Related Packages

- [`@pkg/service-container`](/packages/service-container) - DI container the client is registered with (ADR-008)

## Tips

1. **Pass the right `metadataKey`** - auth-saas uses `"tenant_id"`, blog-saas uses `"blog_id"`; mismatching it breaks `listByEntity` filtering and the stored metadata the worker reads to route domains.
2. **`platformDomain` is only for default subdomains** - it is optional and unused by the API calls; `createDefaultSubdomain` throws a `TypeError` if you call it without one.
3. **Static helpers take a `HostnameResult`** - `isActive`, `isPendingValidation`, `getValidationTxtRecord`, and `getStatusMessage` are pure and never hit the network.
4. **Catch `HostnameApiError` and inspect `statusCode`** - a `404` on `delete` usually means the hostname is already gone and can be treated as success.
5. **`listByEntity` fetches every page** - it exists because Cloudflare cannot filter by `custom_metadata`; prefer `getByName` when you already know the hostname.
