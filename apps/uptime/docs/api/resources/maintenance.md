---
title: Maintenance Windows
description: Schedule and manage maintenance windows. Suppress alerts during planned downtime.
section:
  title: API Resources
  order: 5
order: 8
lastUpdated: 2026-02-14
---

Maintenance windows allow you to schedule planned downtime for your monitors. During a maintenance window, alerts can be suppressed and the status page can display a maintenance notice.

## GET /v1/maintenance

Returns a list of all maintenance windows for your team.

### Required Scope

`maintenance:read`

### Example Request

#### cURL

```bash
curl https://api.uptime.example.com/v1/maintenance \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"data": [
		{
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorId": "mon_def456",
			"name": "Database Migration",
			"startsAt": "2026-02-15T02:00:00Z",
			"endsAt": "2026-02-15T04:00:00Z",
			"endedEarlyAt": null,
			"suppressAlerts": true,
			"showOnStatusPage": true,
			"createdAt": "2026-02-14T10:00:00Z",
			"updatedAt": "2026-02-14T10:00:00Z"
		}
	]
}
```

### Possible Errors

| Status | Code           | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                    |
| 403    | FORBIDDEN      | API key doesn't have `maintenance:read` scope |
| 429    | RATE_LIMITED   | Too many requests                             |
| 500    | INTERNAL_ERROR | Server error                                  |

## POST /v1/maintenance

Creates a new maintenance window.

### Required Scope

`maintenance:write`

### Request Body

| Field              | Type           | Required | Description                                                     |
| ------------------ | -------------- | -------- | --------------------------------------------------------------- |
| `name`             | string         | Yes      | Name of the maintenance window (1-255 characters)               |
| `startsAt`         | string         | Yes      | Start time in ISO 8601 format                                   |
| `endsAt`           | string         | Yes      | End time in ISO 8601 format (must be after `startsAt`)          |
| `monitorId`        | string \| null | No       | Monitor ID to apply maintenance to, or `null` for all monitors  |
| `suppressAlerts`   | boolean        | No       | Whether to suppress alerts during maintenance (default: `true`) |
| `showOnStatusPage` | boolean        | No       | Whether to show maintenance on status page (default: `true`)    |

### Example Request

#### cURL

```bash
curl -X POST https://api.uptime.example.com/v1/maintenance \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Database Migration",
    "startsAt": "2026-02-15T02:00:00Z",
    "endsAt": "2026-02-15T04:00:00Z",
    "monitorId": "mon_def456",
    "suppressAlerts": true,
    "showOnStatusPage": true
  }'
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance", {
	method: "POST",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		name: "Database Migration",
		startsAt: "2026-02-15T02:00:00Z",
		endsAt: "2026-02-15T04:00:00Z",
		monitorId: "mon_def456",
		suppressAlerts: true,
		showOnStatusPage: true,
	}),
});

const data = await response.json();
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorId": "mon_def456",
		"name": "Database Migration",
		"startsAt": "2026-02-15T02:00:00Z",
		"endsAt": "2026-02-15T04:00:00Z",
		"endedEarlyAt": null,
		"suppressAlerts": true,
		"showOnStatusPage": true,
		"createdAt": "2026-02-14T10:00:00Z",
		"updatedAt": "2026-02-14T10:00:00Z"
	}
}
```

### Possible Errors

| Status | Code               | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| 400    | VALIDATION_ERROR   | Invalid request body or validation failed      |
| 400    | INVALID_DATE_RANGE | `endsAt` must be after `startsAt`              |
| 401    | UNAUTHORIZED       | Missing or invalid API key                     |
| 403    | FORBIDDEN          | API key doesn't have `maintenance:write` scope |
| 404    | NOT_FOUND          | Monitor with specified `monitorId` not found   |
| 429    | RATE_LIMITED       | Too many requests                              |
| 500    | INTERNAL_ERROR     | Server error                                   |

## GET /v1/maintenance/:id

Returns a single maintenance window by ID.

### Required Scope

`maintenance:read`

### Example Request

#### cURL

```bash
curl https://api.uptime.example.com/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance/mnt_abc123", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorId": "mon_def456",
		"name": "Database Migration",
		"startsAt": "2026-02-15T02:00:00Z",
		"endsAt": "2026-02-15T04:00:00Z",
		"endedEarlyAt": null,
		"suppressAlerts": true,
		"showOnStatusPage": true,
		"createdAt": "2026-02-14T10:00:00Z",
		"updatedAt": "2026-02-14T10:00:00Z"
	}
}
```

### Possible Errors

| Status | Code           | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                    |
| 403    | FORBIDDEN      | API key doesn't have `maintenance:read` scope |
| 404    | NOT_FOUND      | Maintenance window not found                  |
| 429    | RATE_LIMITED   | Too many requests                             |
| 500    | INTERNAL_ERROR | Server error                                  |

## PUT /v1/maintenance/:id

Updates an existing maintenance window.

### Required Scope

`maintenance:write`

### Request Body

| Field              | Type           | Required | Description                                                    |
| ------------------ | -------------- | -------- | -------------------------------------------------------------- |
| `name`             | string         | No       | Name of the maintenance window (1-255 characters)              |
| `startsAt`         | string         | No       | Start time in ISO 8601 format                                  |
| `endsAt`           | string         | No       | End time in ISO 8601 format (must be after `startsAt`)         |
| `monitorId`        | string \| null | No       | Monitor ID to apply maintenance to, or `null` for all monitors |
| `suppressAlerts`   | boolean        | No       | Whether to suppress alerts during maintenance                  |
| `showOnStatusPage` | boolean        | No       | Whether to show maintenance on status page                     |

### Example Request

#### cURL

```bash
curl -X PUT https://api.uptime.example.com/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Extended Database Migration",
    "endsAt": "2026-02-15T06:00:00Z"
  }'
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance/mnt_abc123", {
	method: "PUT",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		name: "Extended Database Migration",
		endsAt: "2026-02-15T06:00:00Z",
	}),
});

const data = await response.json();
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorId": "mon_def456",
		"name": "Extended Database Migration",
		"startsAt": "2026-02-15T02:00:00Z",
		"endsAt": "2026-02-15T06:00:00Z",
		"endedEarlyAt": null,
		"suppressAlerts": true,
		"showOnStatusPage": true,
		"createdAt": "2026-02-14T10:00:00Z",
		"updatedAt": "2026-02-14T11:30:00Z"
	}
}
```

### Possible Errors

| Status | Code               | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| 400    | VALIDATION_ERROR   | Invalid request body or validation failed      |
| 400    | INVALID_DATE_RANGE | `endsAt` must be after `startsAt`              |
| 401    | UNAUTHORIZED       | Missing or invalid API key                     |
| 403    | FORBIDDEN          | API key doesn't have `maintenance:write` scope |
| 404    | NOT_FOUND          | Maintenance window or monitor not found        |
| 429    | RATE_LIMITED       | Too many requests                              |
| 500    | INTERNAL_ERROR     | Server error                                   |

## DELETE /v1/maintenance/:id

Deletes a maintenance window.

### Required Scope

`maintenance:write`

### Example Request

#### cURL

```bash
curl -X DELETE https://api.uptime.example.com/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance/mnt_abc123", {
	method: "DELETE",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

// 204 No Content on success
```

### Response

Returns `204 No Content` on success.

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `maintenance:write` scope |
| 404    | NOT_FOUND      | Maintenance window not found                   |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

## POST /v1/maintenance/:id/end

Ends a maintenance window early. Sets the `endedEarlyAt` timestamp to the current time.

### Required Scope

`maintenance:write`

### Example Request

#### cURL

```bash
curl -X POST https://api.uptime.example.com/v1/maintenance/mnt_abc123/end \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/maintenance/mnt_abc123/end", {
	method: "POST",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorId": "mon_def456",
		"name": "Database Migration",
		"startsAt": "2026-02-15T02:00:00Z",
		"endsAt": "2026-02-15T04:00:00Z",
		"endedEarlyAt": "2026-02-15T03:15:00Z",
		"suppressAlerts": true,
		"showOnStatusPage": true,
		"createdAt": "2026-02-14T10:00:00Z",
		"updatedAt": "2026-02-15T03:15:00Z"
	}
}
```

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 400    | ALREADY_ENDED  | Maintenance window has already ended           |
| 400    | NOT_STARTED    | Maintenance window has not started yet         |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `maintenance:write` scope |
| 404    | NOT_FOUND      | Maintenance window not found                   |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

## Response Fields

| Field              | Type           | Description                                                 |
| ------------------ | -------------- | ----------------------------------------------------------- |
| `id`               | string         | Unique maintenance window identifier                        |
| `teamId`           | string         | Team that owns this maintenance window                      |
| `monitorId`        | string \| null | Associated monitor ID, or `null` if applies to all monitors |
| `name`             | string         | Display name of the maintenance window                      |
| `startsAt`         | string         | Scheduled start time in ISO 8601 format                     |
| `endsAt`           | string         | Scheduled end time in ISO 8601 format                       |
| `endedEarlyAt`     | string \| null | Time when maintenance was ended early, or `null`            |
| `suppressAlerts`   | boolean        | Whether alerts are suppressed during maintenance            |
| `showOnStatusPage` | boolean        | Whether maintenance is displayed on the status page         |
| `createdAt`        | string         | Creation timestamp in ISO 8601 format                       |
| `updatedAt`        | string         | Last update timestamp in ISO 8601 format                    |

## JSON Schema

Use this schema to validate maintenance window objects in your integration:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": [
		"id",
		"teamId",
		"monitorId",
		"name",
		"startsAt",
		"endsAt",
		"endedEarlyAt",
		"suppressAlerts",
		"showOnStatusPage",
		"createdAt",
		"updatedAt"
	],
	"properties": {
		"id": {
			"type": "string",
			"pattern": "^mnt_[a-zA-Z0-9]+$"
		},
		"teamId": {
			"type": "string",
			"pattern": "^team_[a-zA-Z0-9]+$"
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"startsAt": {
			"type": "string",
			"format": "date-time"
		},
		"endsAt": {
			"type": "string",
			"format": "date-time"
		},
		"endedEarlyAt": {
			"type": ["string", "null"],
			"format": "date-time"
		},
		"suppressAlerts": {
			"type": "boolean"
		},
		"showOnStatusPage": {
			"type": "boolean"
		},
		"createdAt": {
			"type": "string",
			"format": "date-time"
		},
		"updatedAt": {
			"type": "string",
			"format": "date-time"
		}
	}
}
```

### Create/Update Request Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"startsAt": {
			"type": "string",
			"format": "date-time"
		},
		"endsAt": {
			"type": "string",
			"format": "date-time"
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
		},
		"suppressAlerts": {
			"type": "boolean",
			"default": true
		},
		"showOnStatusPage": {
			"type": "boolean",
			"default": true
		}
	},
	"required": ["name", "startsAt", "endsAt"]
}
```
