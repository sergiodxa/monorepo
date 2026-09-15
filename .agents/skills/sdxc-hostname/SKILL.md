---
name: sdxc-hostname
description: "@sdxc/hostname is a Cloudflare for SaaS custom-hostname client: `HostnameClient` registers a customer's domain on a zone, hands back the DNS TXT record proving ownership, polls certificate status, and deletes it. Use when building bring-your-own-domain setup, showing a customer their validation record or activation progress, reconciling domains with `listByEntity`, re-arming validation with `refresh`, or handling a `HostnameApiError` from the Cloudflare API."
---

# @sdxc/hostname

A SaaS that lets customers bring their own domain registers each one as a Cloudflare for SaaS custom hostname, hands the customer a DNS TXT record to prove ownership, and waits for the certificate to issue. This package is that conversation with the API: one `HostnameClient` bound to one zone, every response validated before it is returned as a `HostnameResult`, plus static helpers (`isActive`, `isPendingValidation`, `getValidationTxtRecord`, `getStatusMessage`) that read a result for a status screen. It talks to the Cloudflare API over `fetch`, so it runs on any fetch runtime.

Full API, options and examples: [packages/hostname/README.md](packages/hostname/README.md)

## When to reach for it

- Building the bring-your-own-domain flow: register the domain, show the TXT record, poll until the certificate issues.
- Turning Cloudflare's two status fields into one sentence a customer can act on, validation errors included.
- Issuing a fresh TXT record for a customer who never published the first one.
- Listing or reconciling every domain an account owns, which Cloudflare cannot filter on directly because it filters by hostname rather than by `custom_metadata`.
- Deleting a domain and treating an already-gone one as success.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/hostname": "workspace:*" } }
```

```ts
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

## Suggestions

- Build the client once in a module and export it. It holds configuration rather than connections, and the `metadataKey` belongs there because `create` writes it and `listByEntity` filters on it — one place to set it keeps those two agreeing. It defaults to `"tenant_id"`.
- The API token must be allowed to edit the zone's custom hostnames, and you need that zone's id.
- `create` asks for DV certificates validated over TXT with a minimum TLS version of 1.2, so the record it returns is exactly what the customer publishes.
- `getValidationTxtRecord` answers `null` once the certificate leaves `pending_validation`, so branch on it rather than assuming a record is always there.
- `createDefaultSubdomain(slug)` throws a `TypeError` without a `platformDomain`. A subdomain of your own apex is served by the zone already, so it needs no custom hostname.
- `HostnameApiError` carries `statusCode` and Cloudflare's own `{ code, message }` entries; its `name` is `"CloudflareApiError"`. A `404` on `delete` means the hostname is already gone.

## Related

- `@sdxc/api-client` — the HTTP client the requests and response validation are built on; skill `sdxc-api-client`
