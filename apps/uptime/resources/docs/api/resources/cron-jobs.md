---
title: Cron Jobs
description: Create and manage cron job monitors, and record pings from your scheduled jobs.
section:
  title: API Resources
  order: 5
order: 6
lastUpdated: 2026-09-05
---

Cron job monitors track scheduled tasks by receiving pings when jobs complete. If a ping is not received within the expected window, the job is marked as late and alerts are triggered.

## GET /api/v1/cron-jobs

Returns the cron job monitors for your team. This endpoint is paginated; see [Pagination](/docs/api/pagination) for how to page through the full list.

<!-- operation: cronJobsIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/cron-jobs?perPage=25" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"cronJobs": [
			{
				"id": "cron_abc123",
				"name": "Daily Backup",
				"description": "Runs database backup every night",
				"cronExpression": "0 2 * * *",
				"gracePeriodSeconds": 300,
				"timezone": "America/New_York",
				"status": "healthy",
				"alertOnLate": true,
				"lastPingAt": 1771052412000,
				"nextExpectedAt": 1771138800000,
				"enabledAt": 1768055400000,
				"createdAt": 1768055400000,
				"updatedAt": 1770282900000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 25,
			"total": 34
		}
	}
}
```

The cursors for this page arrive in `meta.pagination`:

| Field                     | Type           | Description                                        |
| ------------------------- | -------------- | -------------------------------------------------- |
| `meta.pagination.next`    | string \| null | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`    | string \| null | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage` | integer        | Results this page was built with                   |
| `meta.pagination.total`   | integer        | Cron jobs matching, across every page              |

## POST /api/v1/cron-jobs

Creates a new cron job monitor and answers `201 Created`.

<!-- operation: cronJobsCreate -->

### Request Body

| Field                | Type    | Required | Description                                                                                             |
| -------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `name`               | string  | Yes      | Display name (1-100 characters)                                                                         |
| `cronExpression`     | string  | Yes      | Valid cron expression (e.g., `0 * * * *`)                                                               |
| `description`        | string  | No       | Optional description (max 500 characters)                                                               |
| `gracePeriodSeconds` | integer | No       | Seconds to wait before marking late (60-86400, default 300)                                             |
| `timezone`           | string  | No       | IANA timezone, or `UTC` (default `UTC`). Any other value is rejected with a `validation-error` problem. |
| `alertOnLate`        | boolean | No       | Send alerts when job is late (default `false`)                                                          |
| `enabled`            | boolean | No       | Whether the monitor is active (default `true`)                                                          |

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Backup",
    "cronExpression": "0 2 * * *",
    "description": "Runs database backup every night",
    "gracePeriodSeconds": 600,
    "timezone": "America/New_York",
    "alertOnLate": true
  }'
```

### Response

```json
{
	"data": {
		"cronJob": {
			"id": "cron_abc123",
			"name": "Daily Backup",
			"description": "Runs database backup every night",
			"cronExpression": "0 2 * * *",
			"gracePeriodSeconds": 600,
			"timezone": "America/New_York",
			"status": "new",
			"alertOnLate": true,
			"lastPingAt": null,
			"nextExpectedAt": 1771138800000,
			"enabledAt": 1771083000000,
			"createdAt": 1771083000000,
			"updatedAt": 1771083000000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## GET /api/v1/cron-jobs/:id

Returns a single cron job monitor by ID.

<!-- operation: cronJobShow -->

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"cronJob": {
			"id": "cron_abc123",
			"name": "Daily Backup",
			"description": "Runs database backup every night",
			"cronExpression": "0 2 * * *",
			"gracePeriodSeconds": 600,
			"timezone": "America/New_York",
			"status": "healthy",
			"alertOnLate": true,
			"lastPingAt": 1771052412000,
			"nextExpectedAt": 1771138800000,
			"enabledAt": 1768055400000,
			"createdAt": 1768055400000,
			"updatedAt": 1770282900000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## PATCH /api/v1/cron-jobs/:id

Updates an existing cron job monitor with a [JSON merge patch](/docs/api/overview#updating-resources).

<!-- operation: cronJobPatch -->

### Request Body

All fields are optional, with the same limits as a create; only the ones you send change. `null` clears `description` and resets `gracePeriodSeconds`, `timezone`, `alertOnLate` and `enabled` to their defaults; `name` and `cronExpression` cannot be removed.

| Field                | Type    | Description                                                                             |
| -------------------- | ------- | --------------------------------------------------------------------------------------- |
| `name`               | string  | Display name (1-100 characters)                                                         |
| `cronExpression`     | string  | Valid cron expression                                                                   |
| `description`        | string  | Optional description (max 500 characters)                                               |
| `gracePeriodSeconds` | integer | Seconds to wait before marking late (60-86400)                                          |
| `timezone`           | string  | IANA timezone, or `UTC`. Any other value is rejected with a `validation-error` problem. |
| `alertOnLate`        | boolean | Send alerts when job is late                                                            |
| `enabled`            | boolean | Whether the monitor is active                                                           |

### Example Request

#### cURL

```bash
curl -X PATCH https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{
    "gracePeriodSeconds": 900,
    "alertOnLate": false
  }'
```

### Response

```json
{
	"data": {
		"cronJob": {
			"id": "cron_abc123",
			"name": "Daily Backup",
			"description": "Runs database backup every night",
			"cronExpression": "0 2 * * *",
			"gracePeriodSeconds": 900,
			"timezone": "America/New_York",
			"status": "healthy",
			"alertOnLate": false,
			"lastPingAt": 1771052412000,
			"nextExpectedAt": 1771138800000,
			"enabledAt": 1768055400000,
			"createdAt": 1768055400000,
			"updatedAt": 1771087500000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Update With PUT

`PUT /api/v1/cron-jobs/:id` takes the same fields, for integrations written before `PATCH` existed. A field you leave out keeps its value, `null` is refused, `enabled: true` sets `enabledAt` to now on every request, and a `cronExpression` you send recomputes `nextExpectedAt` even when it is unchanged.

<!-- operation: cronJobUpdate -->

## DELETE /api/v1/cron-jobs/:id

Deletes a cron job monitor. This action cannot be undone.

<!-- operation: cronJobDestroy -->

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"deleted": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## POST /api/v1/cron-jobs/:id/ping

Records a ping for a cron job monitor. Call this endpoint when your scheduled task completes successfully.

Like every other endpoint on this page, it requires an API key: send it as `Authorization: Bearer <key>`. A key reaches only the monitors of the team that owns it—pinging another team's monitor returns `404`, exactly as an id that doesn't exist does, so the endpoint can't be used to discover which ids are real.

Because this URL lives in crontabs and deploy scripts, it also accepts the monitor's plain UUID in place of its `cron_` id, so an address saved before the id got its prefix keeps working. Both forms name the same monitor and share the same rate limits. An id in neither form answers `404` `not-found`. Use the `cron_` id shown by [List Cron Jobs](#get-apiv1cron-jobs) for anything new.

**Rate Limits:** Two limits apply, and both answer a `429` `rate-limited` problem with a `Retry-After` header giving the seconds to wait:

- **Caller budget:** 60 requests per minute for each calling IP address (`CF-Connecting-IP`) and monitor pair, where every IPv6 address in one /64 network counts as one caller, counted whether or not the ping is accepted. It is spent before the API key is checked, so requests with a missing or invalid key count against it too. Responses from this limit also carry the quota headers.
- **Minimum interval:** a monitor accepts one ping every 30 seconds. A ping that arrives sooner after the previous accepted one is rejected.

<!-- operation: cronJobPing -->

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123/ping \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `201 Created`:

```json
{
	"wasOnTime": true
}
```

Unlike the rest of `/api/v1`, this endpoint answers with the bare object above rather than the `{ data, meta }` envelope, so a shell script can read the result without unwrapping it.

`wasOnTime` is `true` when the ping arrived within the job's grace period, and `false` when it arrived after it — a late ping is still recorded and still answers `201`.

## Response Fields

All cron job responses include these fields:

| Field                | Type            | Description                                                         |
| -------------------- | --------------- | ------------------------------------------------------------------- |
| `id`                 | string          | Unique identifier (prefixed with `cron_`)                           |
| `name`               | string          | Display name                                                        |
| `description`        | string \| null  | Optional description                                                |
| `cronExpression`     | string          | Cron schedule expression                                            |
| `gracePeriodSeconds` | integer         | Seconds to wait before marking late                                 |
| `timezone`           | string          | IANA timezone for the schedule                                      |
| `status`             | string          | Current status: `healthy`, `late`, `missed`, or `new`               |
| `alertOnLate`        | boolean         | Whether alerts are sent when the job is late                        |
| `lastPingAt`         | integer \| null | Unix timestamp in milliseconds of the last ping, or `null` if never |
| `nextExpectedAt`     | integer \| null | Unix timestamp in milliseconds of the next expected ping            |
| `enabledAt`          | integer \| null | Unix timestamp in milliseconds when enabled, or `null` if disabled  |
| `createdAt`          | integer         | Unix timestamp in milliseconds when created                         |
| `updatedAt`          | integer         | Unix timestamp in milliseconds when last updated                    |
