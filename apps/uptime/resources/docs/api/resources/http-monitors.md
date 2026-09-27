---
title: HTTP Monitors
description: Create, update, delete, and query HTTP monitors. Get check results and performance statistics.
section:
  title: API Resources
  order: 5
order: 2
lastUpdated: 2026-09-05
---

HTTP monitors check your websites and APIs for availability, performance, and content validity.

## List Monitors

Retrieve all HTTP monitors for your team.

Monitors arrive a page at a time. See [Pagination](/docs/api/pagination) for how to walk the whole list.

```
GET /api/v1/monitors
```

<!-- operation: monitorsIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitors": [
			{
				"id": "mon_abc123",
				"name": "Production API",
				"url": "https://api.example.com/health",
				"method": "GET",
				"expectedStatus": 200,
				"intervalSeconds": 60,
				"degradedAfterMs": 5000,
				"timeoutSeconds": 10,
				"locationHint": "wnam",
				"enabledAt": 1767225600000,
				"sslMonitoringEnabled": true,
				"sslExpiryWarningDays": 30,
				"sslExpiresAt": 1773748800000,
				"sslIssuer": "Let's Encrypt",
				"sslStatus": "valid",
				"sslLastCheckedAt": 1771070400000,
				"createdAt": 1767225600000,
				"updatedAt": 1768473000000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 50,
			"total": 128
		}
	}
}
```

## Create Monitor

Create a new HTTP monitor.

```
POST /api/v1/monitors
```

<!-- operation: monitorsCreate -->

### Request Body

| Field                  | Type    | Required | Description                                       |
| ---------------------- | ------- | -------- | ------------------------------------------------- |
| `name`                 | string  | Yes      | Monitor name (1-255 characters)                   |
| `url`                  | string  | Yes      | URL to monitor (must be valid URL)                |
| `method`               | string  | No       | HTTP method (default: `HEAD`)                     |
| `expectedStatus`       | integer | No       | Expected status code 100-599 (default: `200`)     |
| `intervalSeconds`      | integer | No       | Check interval 60-3600 (default: `60`)            |
| `degradedAfterMs`      | integer | No       | Degraded threshold 1000-30000ms (default: `5000`) |
| `timeoutSeconds`       | integer | No       | Request timeout 1-60 (default: `10`)              |
| `locationHint`         | string  | No       | Region hint (default: `wnam`)                     |
| `sslMonitoringEnabled` | boolean | No       | Enable SSL monitoring (default: `false`)          |
| `sslExpiryWarningDays` | integer | No       | SSL warning threshold 1-365 days (default: `30`)  |

**Supported HTTP methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`

**Location hints:** `wnam` (Western North America), `enam` (Eastern North America), `sam` (South America), `weur` (Western Europe), `eeur` (Eastern Europe), `apac` (Asia-Pacific), `oc` (Oceania), `afr` (Africa), `me` (Middle East)

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API",
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatus": 200,
    "intervalSeconds": 60,
    "degradedAfterMs": 3000,
    "sslMonitoringEnabled": true,
    "sslExpiryWarningDays": 30
  }'
```

### Response

Returns `201 Created` on success.

```json
{
	"data": {
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 60,
			"degradedAfterMs": 3000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1771070400000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": null,
			"sslIssuer": null,
			"sslStatus": "unknown",
			"sslLastCheckedAt": null,
			"createdAt": 1771070400000,
			"updatedAt": 1771070400000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## Get Monitor

Retrieve a single HTTP monitor by ID.

```
GET /api/v1/monitors/:id
```

<!-- operation: monitorShow -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 60,
			"degradedAfterMs": 5000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1767225600000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": 1773748800000,
			"sslIssuer": "Let's Encrypt",
			"sslStatus": "valid",
			"sslLastCheckedAt": 1771070400000,
			"createdAt": 1767225600000,
			"updatedAt": 1768473000000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## Update Monitor

Update an existing HTTP monitor with a [JSON merge patch](/docs/api/overview#updating-resources).

```
PATCH /api/v1/monitors/:id
```

<!-- operation: monitorPatch -->

### Request Body

All fields from [Create Monitor](#create-monitor) are accepted, plus `enabled`, with the same limits. Include only the fields you want to change; `null` resets a field to its default, and `name` and `url` cannot be removed.

| Field     | Type    | Required | Description                                                                              |
| --------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| `enabled` | boolean | No       | `false` pauses checks and clears `enabledAt`; `true` resumes them and sets it, if paused |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -X PATCH \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{
    "name": "Production API v2",
    "intervalSeconds": 120
  }'
```

### Response

```json
{
	"data": {
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API v2",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 120,
			"degradedAfterMs": 5000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1767225600000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": 1773748800000,
			"sslIssuer": "Let's Encrypt",
			"sslStatus": "valid",
			"sslLastCheckedAt": 1771070400000,
			"createdAt": 1767225600000,
			"updatedAt": 1771072200000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Update With PUT

`PUT /api/v1/monitors/:id` takes the same fields, for integrations written before `PATCH` existed. A field you leave out keeps its value, `null` is refused, and `enabled: true` sets `enabledAt` to now on every request.

<!-- operation: monitorUpdate -->

## Delete Monitor

Permanently delete an HTTP monitor and all its check history.

```
DELETE /api/v1/monitors/:id
```

<!-- operation: monitorDestroy -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `200 OK` on success.

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

## Get Check Results

Retrieve the check history for a monitor.

A check result's `id` pairs the monitor it belongs to with the minute the check was
scheduled for, which is what makes each scheduled check appear once. Treat it as an
opaque string.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page back
through the history.

```
GET /api/v1/monitors/:id/results
```

<!-- operation: monitorResults -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"results": [
			{
				"id": "8e03978e-40d5-43e8-bc93-6894a57f9324:29387451",
				"responseStatus": 200,
				"responseTimeMs": 245,
				"completedAt": 1771070400000,
				"createdAt": 1771070400000
			},
			{
				"id": "8e03978e-40d5-43e8-bc93-6894a57f9324:29387450",
				"responseStatus": 200,
				"responseTimeMs": 5200,
				"completedAt": 1771070340000,
				"createdAt": 1771070340000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 100
		}
	}
}
```

## Get Alert Events

Retrieve the alert delivery history for a monitor.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page back
through the history.

```
GET /api/v1/monitors/:id/alert-events
```

<!-- operation: monitorAlertEvents -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/alert-events?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"events": [
			{
				"id": "evt_01h455vb4pex5vsknk084sn02q",
				"alertId": "alt_01h455vb4pex5vsknk084sn031",
				"monitorId": "mon_abc123",
				"eventType": "down",
				"status": "sent",
				"sentAt": 1771070400000,
				"errorMessage": null,
				"createdAt": 1771070400000
			},
			{
				"id": "evt_01h455vb4pex5vsknk084sn02p",
				"alertId": "alt_01h455vb4pex5vsknk084sn031",
				"monitorId": "mon_abc123",
				"eventType": "up",
				"status": "skipped_cooldown",
				"sentAt": 1771066800000,
				"errorMessage": null,
				"createdAt": 1771066800000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 50
		}
	}
}
```

**Event types:** `down`, `up`, `degraded`

**Delivery statuses:** `sent`, `skipped_cooldown`, `skipped_cap`, `failed`

## Get Monitor Stats

Retrieve performance statistics for a single monitor.

```
GET /api/v1/monitors/:id/stats
```

<!-- operation: monitorStats -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/stats \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"stats": {
			"total": 43200,
			"uptime": 99.95,
			"lastCheck": 1771070400000,
			"p99": 780
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

`total` counts completed checks. `uptime` is the percentage of those checks that answered the monitor's expected status, and `lastCheck` is when the most recent one completed (epoch milliseconds); both are `null` until a check completes. `p99` is the 99th-percentile response time in milliseconds over the last 24 hours, `null` when that window holds no checks.

## Get Aggregated Stats

Retrieve aggregated statistics across all monitors.

```
GET /api/v1/monitors/stats
```

<!-- operation: monitorsStats -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/stats \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"stats": {
			"total": 648000,
			"uptime": 99.3,
			"lastCheck": 1771070400000,
			"p99": 780
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

`total` counts completed checks across every monitor on the team. `uptime` is the percentage of those checks that answered the monitor's expected status, and `lastCheck` is when the most recent one completed (epoch milliseconds); both are `null` until a check completes. `p99` is the 99th-percentile response time in milliseconds over the last 24 hours, `null` when that window holds no checks.

## Backfill Daily Stats

Enqueue a daily-stats aggregation job for your team's monitors.

The job runs in the background, so the response confirms that it was queued rather than
that it has finished.

```
POST /api/v1/backfill-daily-stats
```

<!-- operation: backfillDailyStatsCreate -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/backfill-daily-stats \
  -X POST \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `202 Accepted` on success.

```json
{
	"data": {
		"status": "queued"
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## Content Checks

Manage content validation rules for a monitor. Content checks verify that responses contain (or don't contain) specific text or patterns. See [Content Checks](/docs/concepts/http-monitors#content-checks) for usage details.

## List Content Checks

Retrieve the content checks configured on a monitor.

Content checks arrive a page at a time. See [Pagination](/docs/api/pagination) for how to
walk the whole list.

```
GET /api/v1/monitors/:id/content-checks
```

<!-- operation: monitorContentChecksIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/content-checks?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"contentChecks": [
			{
				"id": "chk_01h455vb4pex5vsknk084sn02q",
				"monitorId": "mon_abc123",
				"type": "contains",
				"value": "\"status\":\"ok\"",
				"caseSensitive": false,
				"isEnabled": true,
				"createdAt": 1767225600000,
				"updatedAt": 1768473000000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": null,
			"prev": null,
			"perPage": 50,
			"total": 1
		}
	}
}
```

## Create Content Check

```
POST /api/v1/monitors/:id/content-checks
```

<!-- operation: monitorContentChecksCreate -->

### Request Body

| Field           | Type    | Required | Description                                                                |
| --------------- | ------- | -------- | -------------------------------------------------------------------------- |
| `type`          | string  | Yes      | Check type: `contains`, `not_contains`, `regex`                            |
| `value`         | string  | Yes      | Text or pattern to match (at least 1 character; a valid regex for `regex`) |
| `caseSensitive` | boolean | No       | Enable case-sensitive matching (default: false)                            |
| `isEnabled`     | boolean | No       | Whether the check runs (default: true)                                     |

### Response

Returns `201 Created` on success.

```json
{
	"data": {
		"contentCheck": {
			"id": "chk_01h455vb4pex5vsknk084sn02q",
			"monitorId": "mon_abc123",
			"type": "contains",
			"value": "\"status\":\"ok\"",
			"caseSensitive": false,
			"isEnabled": true,
			"createdAt": 1767225600000,
			"updatedAt": 1767225600000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## Delete Content Check

```
DELETE /api/v1/monitors/:id/content-checks/:contentCheckId
```

<!-- operation: monitorContentCheckDestroy -->

### Response

Returns `200 OK` on success.

```json
{
	"data": {
		"success": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```
