---
title: Error Handling
description: Understand API error responses, status codes, and error codes. Handle errors gracefully in your integration.
section:
  title: API Reference
  order: 4
order: 3
lastUpdated: 2026-02-14
---

All API errors return a consistent JSON structure, making it easy to handle failures programmatically.

## Error Response Format

```json
{
	"error": {
		"code": "ERROR_CODE",
		"message": "Human readable description"
	}
}
```

The `code` field contains a machine-readable identifier for programmatic handling, while `message` provides a human-readable explanation.

## HTTP Status Codes

| Status | Code               | Description                                       |
| ------ | ------------------ | ------------------------------------------------- |
| 400    | VALIDATION_ERROR   | Request body validation failed                    |
| 400    | LIMIT_EXCEEDED     | Resource limit reached (e.g., max 10 alerts)      |
| 401    | UNAUTHORIZED       | Missing or invalid API key                        |
| 403    | FORBIDDEN          | API key doesn't have required scope               |
| 404    | NOT_FOUND          | Resource not found                                |
| 405    | METHOD_NOT_ALLOWED | HTTP method not supported                         |
| 409    | CONFLICT           | Resource state conflict (e.g., cron job disabled) |
| 429    | RATE_LIMITED       | Too many requests                                 |
| 500    | INTERNAL_ERROR     | Server error                                      |

## Validation Errors

When a request fails validation, the response includes field-level details:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Request validation failed",
		"details": [
			{
				"field": "url",
				"message": "Must be a valid URL"
			},
			{
				"field": "interval",
				"message": "Must be at least 60 seconds"
			}
		]
	}
}
```

Use the `details` array to display specific feedback for each invalid field in your UI.

## Best Practices

### Always Check Status Codes

```typescript
let response = await fetch("/api/monitors", {
	method: "POST",
	headers: { Authorization: `Bearer ${apiKey}` },
	body: JSON.stringify(data),
});

if (!response.ok) {
	let error = await response.json();
	// Handle based on error.error.code
}
```

### Log Error Codes for Debugging

Store the `code` value in your logs to quickly identify issues:

```typescript
if (!response.ok) {
	let { error } = await response.json();
	console.error(`API Error: ${error.code} - ${error.message}`);
}
```

### Show User-Friendly Messages

Map error codes to user-friendly messages instead of displaying raw API responses:

```typescript
let userMessages: Record<string, string> = {
	VALIDATION_ERROR: "Please check your input and try again.",
	LIMIT_EXCEEDED: "You've reached the maximum number of resources.",
	UNAUTHORIZED: "Please sign in to continue.",
	FORBIDDEN: "You don't have permission to perform this action.",
	NOT_FOUND: "The requested resource could not be found.",
	RATE_LIMITED: "Too many requests. Please wait a moment.",
	INTERNAL_ERROR: "Something went wrong. Please try again later.",
};
```

### Implement Retry Logic

For transient errors (429 and 5xx), implement exponential backoff:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		let response = await fetch(url, options);

		if (response.ok) return response;

		// Retry on rate limit or server errors
		if (response.status === 429 || response.status >= 500) {
			let delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
			await new Promise((resolve) => setTimeout(resolve, delay));
			continue;
		}

		// Don't retry client errors (4xx except 429)
		throw new Error(`API error: ${response.status}`);
	}

	throw new Error("Max retries exceeded");
}
```

For 429 responses, check the `Retry-After` header if present to determine the optimal wait time.
