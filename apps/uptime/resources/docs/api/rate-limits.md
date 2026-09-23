---
title: Rate Limits
description: Understand API rate limits and how to handle them. Implement backoff strategies for reliable integrations.
section:
  title: API Reference
  order: 4
order: 4
lastUpdated: 2026-09-23
---

Two endpoints are rate limited: both ping endpoints, since each accepted request runs or records a billable ping. Every other endpoint answers without a request quota.

## Rate Limit Details

### Ad-hoc Ping Endpoint

[`POST /api/v1/ping`](/docs/api/resources/ping) accepts **60 requests per minute per API key**. The budget follows the key, so pipelines sharing an egress address keep separate budgets.

### Cron Job Ping Endpoint

[`POST /api/v1/cron-jobs/:id/ping`](/docs/api/resources/cron-jobs) has two independent limits:

- **One accepted ping every 30 seconds per cron job.** A ping arriving sooner is refused with `429` and a `Retry-After` of the seconds left until the next ping is accepted.
- **60 requests per minute per caller address and cron job**, counted whether or not the ping is accepted. This budget is spent before the API key is checked, so it also covers requests that fail authentication.

Windows are fixed one-minute windows aligned to the clock, so a budget refills at the start of each minute.

## Rate Limit Headers

Responses from a rate-limited endpoint carry the quota headers, on success and on failure alike:

| Header             | Example              | Description                                                                                                                                                     |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RateLimit`        | `limit=60, reset=42` | `limit` is the requests allowed per window and `reset` the seconds until the window restarts. `remaining` joins them when the count left in the window is known |
| `RateLimit-Policy` | `60;w=60`            | The quota and its window length in seconds                                                                                                                      |
| `Retry-After`      | `42`                 | Seconds to wait before retrying, sent on a `429` response                                                                                                       |

## Exceeding the Limit

When you exceed a rate limit, the API returns:

- **HTTP Status**: `429 Too Many Requests`
- **Problem type**: `rate-limited`
- **`Retry-After`**: the seconds to wait before the next request can succeed

```json
{
	"type": "https://uptime.sergiodxa.com/docs/api/errors/rate-limited",
	"title": "Too many requests",
	"status": 429,
	"detail": "More than 60 pings in a minute for this API key. Please try again later.",
	"instance": "urn:uuid:0b6a4c1e-3f7d-4e8a-9c21-5d8f0a7b3e64"
}
```

A refused request runs no probe, records no ping and is not billed.

## Best Practices

1. **Wait for `Retry-After`** - When you receive a 429 response, wait the number of seconds it names before retrying. Fall back to exponential backoff when it is absent.

2. **Ping a cron job once per run** - The 30-second spacing already accepts every legitimate schedule, since cron jobs run at most once a minute; retry a refused ping after `Retry-After` rather than in a tight loop.

3. **Pace ad-hoc pings from `RateLimit`** - Read `reset` to know when the window restarts before sending a burst from a pipeline.
