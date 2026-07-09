---
title: Rate Limits
description: Understand API rate limits and how to handle them. Implement backoff strategies for reliable integrations.
section:
  title: API Reference
  order: 4
order: 4
lastUpdated: 2026-02-14
---

Rate limits protect the service from abuse and ensure fair usage for all users. Understanding these limits helps you build reliable integrations.

## Rate Limit Details

### General API

All API endpoints are limited to **100 requests per minute per API key**. This limit applies across all endpoints combined.

### Cron Job Ping Endpoint

The ping endpoint has a stricter limit: **1 ping per minute per cron job**. This matches the minimum cron job interval and prevents unnecessary load.

## Rate Limit Headers

Every API response includes headers to help you track your usage:

| Header                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed per window      |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets    |

## Exceeding the Limit

When you exceed the rate limit, the API returns:

- **HTTP Status**: `429 Too Many Requests`
- **Error Code**: `RATE_LIMITED`

```json
{
	"error": {
		"code": "RATE_LIMITED",
		"message": "Rate limit exceeded. Please retry after 45 seconds."
	}
}
```

## Best Practices

1. **Implement exponential backoff** - When you receive a 429 response, wait before retrying. Double the wait time with each subsequent failure.

2. **Cache responses when possible** - Store data locally to reduce API calls, especially for data that doesn't change frequently.

3. **Batch operations** - Where the API supports it, combine multiple operations into a single request.

4. **Monitor your usage** - Use the rate limit headers to track consumption and adjust your request patterns before hitting limits.
