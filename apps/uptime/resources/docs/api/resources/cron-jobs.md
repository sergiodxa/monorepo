---
title: Cron Jobs
description: Create and manage cron job monitors. Record pings and get execution history.
section:
  title: API Resources
  order: 5
order: 5
lastUpdated: 2026-08-02
---

Cron job monitors track scheduled tasks by receiving pings when jobs complete. If a ping is not received within the expected window, the job is marked as late and alerts are triggered.

## GET /api/v1/cron-jobs

Returns all cron job monitors for your team.

### Required Scope

`cron-jobs:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/cron-jobs \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": [
		{
			"id": "cron_abc123",
			"name": "Daily Backup",
			"description": "Runs database backup every night",
			"cronExpression": "0 2 * * *",
			"gracePeriodSeconds": 300,
			"timezone": "America/New_York",
			"status": "healthy",
			"alertOnLate": true,
			"lastPingAt": "2026-02-14T07:00:12Z",
			"nextExpectedAt": "2026-02-15T07:00:00Z",
			"enabledAt": "2026-01-10T14:30:00Z",
			"createdAt": "2026-01-10T14:30:00Z",
			"updatedAt": "2026-02-01T09:15:00Z"
		}
	]
}
```

### Possible Errors

| Status | Code           | Description                                 |
| ------ | -------------- | ------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                  |
| 403    | FORBIDDEN      | API key doesn't have `cron-jobs:read` scope |
| 429    | RATE_LIMITED   | Too many requests                           |
| 500    | INTERNAL_ERROR | Server error                                |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": {
			"type": "array",
			"items": { "$ref": "#/$defs/cronJob" }
		}
	},
	"$defs": {
		"cronJob": {
			"type": "object",
			"required": [
				"id",
				"name",
				"description",
				"cronExpression",
				"gracePeriodSeconds",
				"timezone",
				"status",
				"alertOnLate",
				"lastPingAt",
				"nextExpectedAt",
				"enabledAt",
				"createdAt",
				"updatedAt"
			],
			"properties": {
				"id": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 100 },
				"description": { "type": ["string", "null"], "maxLength": 500 },
				"cronExpression": { "type": "string" },
				"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400 },
				"timezone": { "type": "string" },
				"status": { "type": "string", "enum": ["healthy", "late", "missed", "new"] },
				"alertOnLate": { "type": "boolean" },
				"lastPingAt": { "type": ["string", "null"], "format": "date-time" },
				"nextExpectedAt": { "type": ["string", "null"], "format": "date-time" },
				"enabledAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## POST /api/v1/cron-jobs

Creates a new cron job monitor.

### Required Scope

`cron-jobs:write`

### Request Body

| Field                | Type    | Required | Description                                                                                   |
| -------------------- | ------- | -------- | --------------------------------------------------------------------------------------------- |
| `name`               | string  | Yes      | Display name (1-100 characters)                                                               |
| `cronExpression`     | string  | Yes      | Valid cron expression (e.g., `0 * * * *`)                                                     |
| `description`        | string  | No       | Optional description (max 500 characters)                                                     |
| `gracePeriodSeconds` | integer | No       | Seconds to wait before marking late (60-86400, default 300)                                   |
| `timezone`           | string  | No       | IANA timezone, or `UTC` (default `UTC`). Any other value is rejected with `VALIDATION_ERROR`. |
| `alertOnLate`        | boolean | No       | Send alerts when job is late (default `false`)                                                |
| `enabled`            | boolean | No       | Whether the monitor is active (default `true`)                                                |

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
		"id": "cron_abc123",
		"name": "Daily Backup",
		"description": "Runs database backup every night",
		"cronExpression": "0 2 * * *",
		"gracePeriodSeconds": 600,
		"timezone": "America/New_York",
		"status": "unknown",
		"alertOnLate": true,
		"lastPingAt": null,
		"nextExpectedAt": "2026-02-15T07:00:00Z",
		"enabledAt": "2026-02-14T15:30:00Z",
		"createdAt": "2026-02-14T15:30:00Z",
		"updatedAt": "2026-02-14T15:30:00Z"
	}
}
```

### Possible Errors

| Status | Code             | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or cron expression      |
| 401    | UNAUTHORIZED     | Missing or invalid API key                   |
| 403    | FORBIDDEN        | API key doesn't have `cron-jobs:write` scope |
| 429    | RATE_LIMITED     | Too many requests                            |
| 500    | INTERNAL_ERROR   | Server error                                 |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "cronExpression"],
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 100 },
		"cronExpression": { "type": "string" },
		"description": { "type": "string", "maxLength": 500 },
		"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400, "default": 300 },
		"timezone": { "type": "string", "default": "UTC" },
		"alertOnLate": { "type": "boolean", "default": false },
		"enabled": { "type": "boolean", "default": true }
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": { "$ref": "#/$defs/cronJob" }
	},
	"$defs": {
		"cronJob": {
			"type": "object",
			"required": [
				"id",
				"name",
				"description",
				"cronExpression",
				"gracePeriodSeconds",
				"timezone",
				"status",
				"alertOnLate",
				"lastPingAt",
				"nextExpectedAt",
				"enabledAt",
				"createdAt",
				"updatedAt"
			],
			"properties": {
				"id": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 100 },
				"description": { "type": ["string", "null"], "maxLength": 500 },
				"cronExpression": { "type": "string" },
				"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400 },
				"timezone": { "type": "string" },
				"status": { "type": "string", "enum": ["healthy", "late", "missed", "new"] },
				"alertOnLate": { "type": "boolean" },
				"lastPingAt": { "type": ["string", "null"], "format": "date-time" },
				"nextExpectedAt": { "type": ["string", "null"], "format": "date-time" },
				"enabledAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## GET /api/v1/cron-jobs/:id

Returns a single cron job monitor by ID.

### Required Scope

`cron-jobs:read`

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
		"id": "cron_abc123",
		"name": "Daily Backup",
		"description": "Runs database backup every night",
		"cronExpression": "0 2 * * *",
		"gracePeriodSeconds": 600,
		"timezone": "America/New_York",
		"status": "healthy",
		"alertOnLate": true,
		"lastPingAt": "2026-02-14T07:00:12Z",
		"nextExpectedAt": "2026-02-15T07:00:00Z",
		"enabledAt": "2026-01-10T14:30:00Z",
		"createdAt": "2026-01-10T14:30:00Z",
		"updatedAt": "2026-02-01T09:15:00Z"
	}
}
```

### Possible Errors

| Status | Code           | Description                                 |
| ------ | -------------- | ------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                  |
| 403    | FORBIDDEN      | API key doesn't have `cron-jobs:read` scope |
| 404    | NOT_FOUND      | Cron job not found                          |
| 429    | RATE_LIMITED   | Too many requests                           |
| 500    | INTERNAL_ERROR | Server error                                |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": { "$ref": "#/$defs/cronJob" }
	},
	"$defs": {
		"cronJob": {
			"type": "object",
			"required": [
				"id",
				"name",
				"description",
				"cronExpression",
				"gracePeriodSeconds",
				"timezone",
				"status",
				"alertOnLate",
				"lastPingAt",
				"nextExpectedAt",
				"enabledAt",
				"createdAt",
				"updatedAt"
			],
			"properties": {
				"id": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 100 },
				"description": { "type": ["string", "null"], "maxLength": 500 },
				"cronExpression": { "type": "string" },
				"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400 },
				"timezone": { "type": "string" },
				"status": { "type": "string", "enum": ["healthy", "late", "missed", "new"] },
				"alertOnLate": { "type": "boolean" },
				"lastPingAt": { "type": ["string", "null"], "format": "date-time" },
				"nextExpectedAt": { "type": ["string", "null"], "format": "date-time" },
				"enabledAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## PUT /api/v1/cron-jobs/:id

Updates an existing cron job monitor.

### Required Scope

`cron-jobs:write`

### Request Body

All fields are optional. Only provided fields will be updated.

| Field                | Type    | Description                                                                   |
| -------------------- | ------- | ----------------------------------------------------------------------------- |
| `name`               | string  | Display name (1-100 characters)                                               |
| `cronExpression`     | string  | Valid cron expression                                                         |
| `description`        | string  | Optional description (max 500 characters)                                     |
| `gracePeriodSeconds` | integer | Seconds to wait before marking late (60-86400)                                |
| `timezone`           | string  | IANA timezone, or `UTC`. Any other value is rejected with `VALIDATION_ERROR`. |
| `alertOnLate`        | boolean | Send alerts when job is late                                                  |
| `enabled`            | boolean | Whether the monitor is active                                                 |

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "gracePeriodSeconds": 900,
    "alertOnLate": false
  }'
```

### Response

```json
{
	"data": {
		"id": "cron_abc123",
		"name": "Daily Backup",
		"description": "Runs database backup every night",
		"cronExpression": "0 2 * * *",
		"gracePeriodSeconds": 900,
		"timezone": "America/New_York",
		"status": "healthy",
		"alertOnLate": false,
		"lastPingAt": "2026-02-14T07:00:12Z",
		"nextExpectedAt": "2026-02-15T07:00:00Z",
		"enabledAt": "2026-01-10T14:30:00Z",
		"createdAt": "2026-01-10T14:30:00Z",
		"updatedAt": "2026-02-14T16:45:00Z"
	}
}
```

### Possible Errors

| Status | Code             | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or cron expression      |
| 401    | UNAUTHORIZED     | Missing or invalid API key                   |
| 403    | FORBIDDEN        | API key doesn't have `cron-jobs:write` scope |
| 404    | NOT_FOUND        | Cron job not found                           |
| 429    | RATE_LIMITED     | Too many requests                            |
| 500    | INTERNAL_ERROR   | Server error                                 |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 100 },
		"cronExpression": { "type": "string" },
		"description": { "type": "string", "maxLength": 500 },
		"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400 },
		"timezone": { "type": "string" },
		"alertOnLate": { "type": "boolean" },
		"enabled": { "type": "boolean" }
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": { "$ref": "#/$defs/cronJob" }
	},
	"$defs": {
		"cronJob": {
			"type": "object",
			"required": [
				"id",
				"name",
				"description",
				"cronExpression",
				"gracePeriodSeconds",
				"timezone",
				"status",
				"alertOnLate",
				"lastPingAt",
				"nextExpectedAt",
				"enabledAt",
				"createdAt",
				"updatedAt"
			],
			"properties": {
				"id": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 100 },
				"description": { "type": ["string", "null"], "maxLength": 500 },
				"cronExpression": { "type": "string" },
				"gracePeriodSeconds": { "type": "integer", "minimum": 60, "maximum": 86400 },
				"timezone": { "type": "string" },
				"status": { "type": "string", "enum": ["healthy", "late", "missed", "new"] },
				"alertOnLate": { "type": "boolean" },
				"lastPingAt": { "type": ["string", "null"], "format": "date-time" },
				"nextExpectedAt": { "type": ["string", "null"], "format": "date-time" },
				"enabledAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## DELETE /api/v1/cron-jobs/:id

Deletes a cron job monitor. This action cannot be undone.

### Required Scope

`cron-jobs:write`

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `204 No Content` on success with an empty response body.

### Possible Errors

| Status | Code           | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                   |
| 403    | FORBIDDEN      | API key doesn't have `cron-jobs:write` scope |
| 404    | NOT_FOUND      | Cron job not found                           |
| 429    | RATE_LIMITED   | Too many requests                            |
| 500    | INTERNAL_ERROR | Server error                                 |

### Response Schema

Returns `204 No Content` with an empty response body on success.

## GET /api/v1/cron-jobs/:id/ping

Returns the ping history for a cron job monitor.

### Required Scope

`cron-jobs:read`

### Query Parameters

| Parameter | Type    | Required | Description                           |
| --------- | ------- | -------- | ------------------------------------- |
| `limit`   | integer | No       | Number of results (1-100, default 20) |
| `offset`  | integer | No       | Pagination offset (default 0)         |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123/ping?limit=10&offset=0" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": [
		{
			"id": "ping_xyz789",
			"cronJobId": "cron_abc123",
			"receivedAt": "2026-02-14T07:00:12Z",
			"status": "on_time"
		},
		{
			"id": "ping_xyz788",
			"cronJobId": "cron_abc123",
			"receivedAt": "2026-02-13T07:00:08Z",
			"status": "on_time"
		},
		{
			"id": "ping_xyz787",
			"cronJobId": "cron_abc123",
			"receivedAt": "2026-02-12T07:10:45Z",
			"status": "late"
		}
	],
	"pagination": {
		"total": 45,
		"limit": 10,
		"offset": 0
	}
}
```

### Possible Errors

| Status | Code             | Description                                 |
| ------ | ---------------- | ------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid query parameters                    |
| 401    | UNAUTHORIZED     | Missing or invalid API key                  |
| 403    | FORBIDDEN        | API key doesn't have `cron-jobs:read` scope |
| 404    | NOT_FOUND        | Cron job not found                          |
| 429    | RATE_LIMITED     | Too many requests                           |
| 500    | INTERNAL_ERROR   | Server error                                |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "pagination"],
	"properties": {
		"data": {
			"type": "array",
			"items": { "$ref": "#/$defs/ping" }
		},
		"pagination": {
			"type": "object",
			"required": ["total", "limit", "offset"],
			"properties": {
				"total": { "type": "integer", "minimum": 0 },
				"limit": { "type": "integer", "minimum": 1, "maximum": 100 },
				"offset": { "type": "integer", "minimum": 0 }
			}
		}
	},
	"$defs": {
		"ping": {
			"type": "object",
			"required": ["id", "cronJobId", "receivedAt", "status"],
			"properties": {
				"id": { "type": "string", "pattern": "^ping_[a-zA-Z0-9]+$" },
				"cronJobId": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"receivedAt": { "type": "string", "format": "date-time" },
				"status": { "type": "string", "enum": ["on_time", "late"] }
			}
		}
	}
}
```

## POST /api/v1/cron-jobs/:id/ping

Records a ping for a cron job monitor. Call this endpoint when your scheduled task completes successfully.

Like every other endpoint on this page, it requires an API key: send it as `Authorization: Bearer <key>`. A key reaches only the monitors of the team that owns it—pinging another team's monitor returns `404`, exactly as an id that doesn't exist does, so the endpoint can't be used to discover which ids are real.

**Rate Limit:** This endpoint is rate limited to 1 request per minute per cron job. Additional requests within the same minute will be rejected with a `429` error. A separate abuse limit caps how many requests one caller may send for one monitor per minute, whether or not they are accepted; exceeding it also returns `429`, and it applies before the key is checked.

### Required Scope

`cron-jobs:ping`

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/cron_abc123/ping \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"id": "ping_xyz790",
		"cronJobId": "cron_abc123",
		"receivedAt": "2026-02-14T07:00:12Z",
		"status": "on_time"
	}
}
```

### Possible Errors

| Status | Code           | Description                                                      |
| ------ | -------------- | ---------------------------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing, invalid, or expired API key                             |
| 403    | FORBIDDEN      | API key doesn't have `cron-jobs:ping` scope                      |
| 404    | NOT_FOUND      | Cron job not found, or owned by another team                     |
| 409    | CONFLICT       | Cron job is disabled                                             |
| 429    | RATE_LIMITED   | More than 1 ping per minute for this job, or caller budget spent |
| 500    | INTERNAL_ERROR | Server error                                                     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": { "$ref": "#/$defs/ping" }
	},
	"$defs": {
		"ping": {
			"type": "object",
			"required": ["id", "cronJobId", "receivedAt", "status"],
			"properties": {
				"id": { "type": "string", "pattern": "^ping_[a-zA-Z0-9]+$" },
				"cronJobId": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
				"receivedAt": { "type": "string", "format": "date-time" },
				"status": { "type": "string", "enum": ["on_time", "late"] }
			}
		}
	}
}
```

## Response Fields

All cron job responses include these fields:

| Field                | Type           | Description                                             |
| -------------------- | -------------- | ------------------------------------------------------- |
| `id`                 | string         | Unique identifier (prefixed with `cron_`)               |
| `name`               | string         | Display name                                            |
| `description`        | string \| null | Optional description                                    |
| `cronExpression`     | string         | Cron schedule expression                                |
| `gracePeriodSeconds` | integer        | Seconds to wait before marking late                     |
| `timezone`           | string         | IANA timezone for the schedule                          |
| `status`             | string         | Current status: `healthy`, `late`, or `unknown`         |
| `alertOnLate`        | boolean        | Whether alerts are sent when the job is late            |
| `lastPingAt`         | string \| null | ISO 8601 timestamp of the last ping, or `null` if never |
| `nextExpectedAt`     | string \| null | ISO 8601 timestamp of the next expected ping            |
| `enabledAt`          | string \| null | ISO 8601 timestamp when enabled, or `null` if disabled  |
| `createdAt`          | string         | ISO 8601 timestamp when created                         |
| `updatedAt`          | string         | ISO 8601 timestamp when last updated                    |
