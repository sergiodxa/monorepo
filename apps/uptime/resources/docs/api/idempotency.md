---
title: Idempotent Requests
description: Retry a create request safely with the Idempotency-Key header, and get the original response instead of a duplicate resource.
section:
  title: API Reference
  order: 4
order: 6
lastUpdated: 2026-09-26
---

Every `POST` that creates a resource accepts an `Idempotency-Key` header. Send the same key when you retry a request whose response you never received, and the API answers with the original response instead of creating the resource a second time.

## Sending a Key

The value is a quoted string, unique per operation. A UUID works well:

```
POST /api/v1/monitors
Authorization: Bearer uptime_xxxx...
Content-Type: application/json
Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"
```

The quotes are part of the header's syntax ([RFC 9651](https://www.rfc-editor.org/rfc/rfc9651) sf-string). A key without them answers `400 idempotency-key-invalid`.

```javascript
let idempotencyKey = `"${crypto.randomUUID()}"`;

async function createMonitor(data) {
	return fetch("https://uptime.sergiodxa.com/api/v1/monitors", {
		method: "POST",
		headers: {
			Authorization: "Bearer uptime_your_api_key",
			"Content-Type": "application/json",
			"Idempotency-Key": idempotencyKey,
		},
		body: JSON.stringify(data),
	});
}
```

Mint the key once per operation and reuse it on every retry of that operation.

## What a Retry Gets

| Situation                                          | Answer                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| First request with the key                         | The endpoint runs as usual                         |
| Same key and body after the first request finished | The first response again, status and body included |
| Same key while the first request is still running  | `409 idempotency-key-in-use` with `Retry-After: 1` |
| Same key with a different body, method or path     | `422 idempotency-key-reused`                       |
| No `Idempotency-Key` header                        | The endpoint runs as usual, with no protection     |

- **Window**: a response is replayed for 24 hours after the first request. After that, the key is forgotten and a request carrying it runs again.
- **Scope**: keys belong to the API key that sent them. The same key sent with another API key is a separate request.
- **What is replayed**: every response below `500`, errors included, so a retried request that failed validation fails the same way. A `5xx` means the create did not happen, and the key is released so your retry runs it.
- **Same bytes**: the body is compared byte for byte, so resend exactly what you sent the first time.
- **API keys**: `POST /api/v1/api-keys` returns the new key's secret once and the API never stores it, so its response is never replayed. The header still refuses a retry that arrives while the first request is running; a retry after it finished creates another key, which you can revoke.

## Endpoints

- `POST /api/v1/monitors`
- `POST /api/v1/monitors/{monitorId}/content-checks`
- `POST /api/v1/dns-monitors`
- `POST /api/v1/tcp-monitors`
- `POST /api/v1/flow-monitors`
- `POST /api/v1/cron-jobs`
- `POST /api/v1/alerts`
- `POST /api/v1/maintenance`
- `POST /api/v1/status-pages`
- `POST /api/v1/invites`
- `POST /api/v1/team-domains`
- `POST /api/v1/api-keys`
