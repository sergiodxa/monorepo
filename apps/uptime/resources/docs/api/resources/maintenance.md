---
title: Maintenance Windows
description: Schedule and manage maintenance windows. Suppress alerts during planned downtime.
section:
  title: API Resources
  order: 5
order: 8
lastUpdated: 2026-08-11
---

Maintenance windows allow you to schedule planned downtime for your monitors. During a maintenance window, alerts can be suppressed and the status page can display a maintenance notice.

## Scope

`monitorType` and `monitorId` are the window's scope, and together they mean one of three things:

- Neither — every monitor the team has, of every kind.
- `monitorType` alone — every monitor of that kind, including ones created later.
- `monitorType` and `monitorId` — that one monitor, looked up in that kind's monitors.

A `monitorId` sent on its own is read as an HTTP monitor, which is what it has always meant, so clients written before the other monitor kinds arrived keep working untouched.

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers `404 NOT_FOUND` with "Monitor not found" — the window is never quietly widened to the whole team instead.

## GET /api/v1/maintenance

Returns a list of all maintenance windows for your team.

### Required Scope

`maintenance:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/maintenance \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": [
		{
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorType": "http",
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

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": {
			"type": "array",
			"items": {
				"$ref": "#/$defs/maintenanceWindow"
			}
		}
	},
	"$defs": {
		"maintenanceWindow": {
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
				"monitorType": {
					"type": ["string", "null"],
					"enum": ["http", "dns", "tcp", "cron", null]
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
	}
}
```

## POST /api/v1/maintenance

Creates a new maintenance window.

### Required Scope

`maintenance:write`

### Request Body

| Field              | Type           | Required | Description                                                                                                                                                                                                                        |
| ------------------ | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | string         | Yes      | Name of the maintenance window (1-255 characters)                                                                                                                                                                                  |
| `startsAt`         | string         | Yes      | Start time in ISO 8601 format                                                                                                                                                                                                      |
| `endsAt`           | string         | Yes      | End time in ISO 8601 format (must be after `startsAt`)                                                                                                                                                                             |
| `monitorType`      | string \| null | No       | Limit the window to one kind of monitor: `http`, `dns`, `tcp` or `cron`. Sent on its own, the window covers every monitor of that kind, including ones created later.                                                              |
| `monitorId`        | string \| null | No       | Limit the window to a single monitor, or `null` for all monitors. Sent together with `monitorType`, the id is looked up in that kind's monitors; sent on its own it is read as an HTTP monitor, which is what it has always meant. |
| `suppressAlerts`   | boolean        | No       | Whether to suppress alerts during maintenance (default: `true`)                                                                                                                                                                    |
| `showOnStatusPage` | boolean        | No       | Whether to show maintenance on status page (default: `true`)                                                                                                                                                                       |

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/maintenance \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Database Migration",
    "startsAt": "2026-02-15T02:00:00Z",
    "endsAt": "2026-02-15T04:00:00Z",
    "monitorType": "http",
    "monitorId": "mon_def456",
    "suppressAlerts": true,
    "showOnStatusPage": true
  }'
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorType": "http",
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
| 404    | NOT_FOUND          | Monitor not found for the given scope          |
| 429    | RATE_LIMITED       | Too many requests                              |
| 500    | INTERNAL_ERROR     | Server error                                   |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "startsAt", "endsAt"],
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
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
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
		"data": {
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
				"monitorType": {
					"type": ["string", "null"],
					"enum": ["http", "dns", "tcp", "cron", null]
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
	}
}
```

## GET /api/v1/maintenance/:id

Returns a single maintenance window by ID.

### Required Scope

`maintenance:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorType": "http",
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

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": {
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
				"monitorType": {
					"type": ["string", "null"],
					"enum": ["http", "dns", "tcp", "cron", null]
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
	}
}
```

## PUT /api/v1/maintenance/:id

Updates an existing maintenance window.

### Required Scope

`maintenance:write`

### Request Body

| Field              | Type           | Required | Description                                                                  |
| ------------------ | -------------- | -------- | ---------------------------------------------------------------------------- |
| `name`             | string         | No       | Name of the maintenance window (1-255 characters)                            |
| `startsAt`         | string         | No       | Start time in ISO 8601 format                                                |
| `endsAt`           | string         | No       | End time in ISO 8601 format (must be after `startsAt`)                       |
| `monitorType`      | string \| null | No       | The kind of monitor the window is limited to: `http`, `dns`, `tcp` or `cron` |
| `monitorId`        | string \| null | No       | The single monitor the window is limited to, or `null` for all monitors      |
| `suppressAlerts`   | boolean        | No       | Whether to suppress alerts during maintenance                                |
| `showOnStatusPage` | boolean        | No       | Whether to show maintenance on status page                                   |

`monitorType` and `monitorId` are the window's scope, and they move as a pair: send either one and both are rewritten, so narrowing a window to a whole kind of monitor cannot leave the previous monitor's id behind it. Mention neither and the scope is left exactly as it is.

- `{"monitorType": "dns"}` — every DNS monitor
- `{"monitorType": "dns", "monitorId": "..."}` — that one DNS monitor
- `{"monitorId": null}` — back to team-wide
- `{"monitorId": "..."}` — that one HTTP monitor

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers `404 NOT_FOUND`.

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Extended Database Migration",
    "endsAt": "2026-02-15T06:00:00Z"
  }'
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorType": "http",
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

### Request Body Schema

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
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
		},
		"suppressAlerts": {
			"type": "boolean"
		},
		"showOnStatusPage": {
			"type": "boolean"
		}
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
		"data": {
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
				"monitorType": {
					"type": ["string", "null"],
					"enum": ["http", "dns", "tcp", "cron", null]
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
	}
}
```

## DELETE /api/v1/maintenance/:id

Deletes a maintenance window.

### Required Scope

`maintenance:write`

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
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

### Response Schema

Returns `204 No Content` with an empty response body on success.

## POST /api/v1/maintenance/:id/end

Ends a maintenance window early. Sets the `endedEarlyAt` timestamp to the current time.

### Required Scope

`maintenance:write`

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123/end \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"id": "mnt_abc123",
		"teamId": "team_xyz789",
		"monitorType": "http",
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

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data"],
	"properties": {
		"data": {
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
				"monitorType": {
					"type": ["string", "null"],
					"enum": ["http", "dns", "tcp", "cron", null]
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
	}
}
```

## Response Fields

| Field              | Type           | Description                                                                     |
| ------------------ | -------------- | ------------------------------------------------------------------------------- |
| `id`               | string         | Unique maintenance window identifier                                            |
| `teamId`           | string         | Team that owns this maintenance window                                          |
| `monitorType`      | string \| null | Kind of monitor the window is limited to, or `null` if it applies to every kind |
| `monitorId`        | string \| null | Associated monitor ID, or `null` if applies to all monitors                     |
| `name`             | string         | Display name of the maintenance window                                          |
| `startsAt`         | string         | Scheduled start time in ISO 8601 format                                         |
| `endsAt`           | string         | Scheduled end time in ISO 8601 format                                           |
| `endedEarlyAt`     | string \| null | Time when maintenance was ended early, or `null`                                |
| `suppressAlerts`   | boolean        | Whether alerts are suppressed during maintenance                                |
| `showOnStatusPage` | boolean        | Whether maintenance is displayed on the status page                             |
| `createdAt`        | string         | Creation timestamp in ISO 8601 format                                           |
| `updatedAt`        | string         | Last update timestamp in ISO 8601 format                                        |
