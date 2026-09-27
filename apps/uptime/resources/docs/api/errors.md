---
title: Error Handling
description: API failures are RFC 9457 problem details. Learn the format, every problem type, and how to handle them in your integration.
section:
  title: API Reference
  order: 4
order: 3
lastUpdated: 2026-09-23
---

Every API failure is answered with an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details document, served as `Content-Type: application/problem+json`. Successful responses keep their `data`/`meta` envelope.

## Problem Format

```json
{
	"type": "https://uptime.sergiodxa.com/docs/api/errors/not-found",
	"title": "The resource does not exist",
	"status": 404,
	"detail": "Monitor not found",
	"instance": "urn:uuid:0b6a4c1e-3f7d-4e8a-9c21-5d8f0a7b3e64"
}
```

| Member     | Meaning                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `type`     | A URL naming the kind of failure. It is the stable identifier to branch on, and it links to this page |
| `title`    | A short summary of the type, the same for every occurrence                                            |
| `status`   | The HTTP status code, repeated from the status line                                                   |
| `detail`   | What went wrong with this request, when there is more to say than the title                           |
| `instance` | A `urn:uuid:` identifier for this one failure; quote it when you contact support                      |

Treat any `type` you do not recognize by its `status`, since new types may be added.

## Problem Types

| Status | Type                      | Meaning                                                                           |
| ------ | ------------------------- | --------------------------------------------------------------------------------- |
| 400    | `bad-request`             | A malformed query parameter, such as a `perPage` out of range or an edited cursor |
| 400    | `validation-error`        | The body or a path id failed validation; see `errors`                             |
| 400    | `limit-exceeded`          | The team reached its limit for this resource (e.g., max 10 alerts)                |
| 400    | `idempotency-key-missing` | The endpoint requires an `Idempotency-Key` header                                 |
| 400    | `idempotency-key-invalid` | The `Idempotency-Key` value is not a quoted string                                |
| 401    | `unauthorized`            | Missing, invalid, or expired API key                                              |
| 402    | `subscription-required`   | The team's owner has no active subscription                                       |
| 403    | `forbidden`               | The API key doesn't have the required scope                                       |
| 404    | `not-found`               | The resource does not exist, or belongs to another team                           |
| 409    | `conflict`                | The resource's state prevents the request (e.g., a slug already taken)            |
| 409    | `idempotency-key-in-use`  | A request with this idempotency key is still running; retry after `Retry-After`   |
| 422    | `idempotency-key-reused`  | This idempotency key was already used for a different request                     |
| 429    | `rate-limited`            | Too many requests; wait for `Retry-After` seconds                                 |
| 500    | `internal`                | The request failed on the server                                                  |
| 500    | `internal-error`          | A change was saved but could not be read back                                     |
| 503    | `endpoint-unavailable`    | The endpoint is switched off for this team                                        |

Each type is `https://uptime.sergiodxa.com/docs/api/errors/` followed by the name above, so `not-found` is `https://uptime.sergiodxa.com/docs/api/errors/not-found`.

## Validation Errors

A `validation-error` problem lists every invalid field in `errors`. Each entry's `pointer` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer into the request body, or `""` for the request as a whole:

```json
{
	"type": "https://uptime.sergiodxa.com/docs/api/errors/validation-error",
	"title": "The request failed validation",
	"status": 400,
	"instance": "urn:uuid:5f1d2c3b-8a4e-4b6f-9d7c-2e1a0b9c8d7f",
	"errors": [
		{ "pointer": "/url", "code": "invalid", "message": "Expected a valid URL" },
		{
			"pointer": "/intervalSeconds",
			"code": "invalid",
			"message": "Expected a value of at least 60"
		}
	]
}
```

Use `errors` to show feedback next to each invalid field in your UI.

## Best Practices

### Branch on the Type

```typescript
let response = await fetch("https://uptime.sergiodxa.com/api/v1/monitors", {
	method: "POST",
	headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
	body: JSON.stringify(data),
});

if (response.headers.get("Content-Type")?.startsWith("application/problem+json")) {
	let problem = await response.json();
	let name = problem.type.split("/").pop(); // "validation-error"
}
```

### Log the Instance

Store `type` and `instance` in your logs, so a failure can be traced to the exact request:

```typescript
if (!response.ok) {
	let problem = await response.json();
	console.error(
		`API error ${problem.type} (${problem.instance}): ${problem.detail ?? problem.title}`,
	);
}
```

### Show User-Friendly Messages

Map problem types to messages for your users instead of displaying raw API responses:

```typescript
let userMessages: Record<string, string> = {
	"validation-error": "Please check your input and try again.",
	"limit-exceeded": "You've reached the maximum number of resources.",
	unauthorized: "Please sign in to continue.",
	forbidden: "You don't have permission to perform this action.",
	"not-found": "The requested resource could not be found.",
	"rate-limited": "Too many requests. Please wait a moment.",
	internal: "Something went wrong. Please try again later.",
};
```

### Implement Retry Logic

For transient errors (429 and 5xx), retry with exponential backoff, honoring `Retry-After` when the response carries it:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		let response = await fetch(url, options);

		if (response.ok) return response;

		if (response.status === 429 || response.status >= 500) {
			let retryAfter = Number(response.headers.get("Retry-After"));
			let delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
			await new Promise((resolve) => setTimeout(resolve, delay));
			continue;
		}

		return response;
	}

	throw new Error("Max retries exceeded");
}
```
