---
title: Status
description: Get the overall status of all your monitors with a single API call. Returns aggregate health and individual monitor states.
section:
  title: API Resources
  order: 5
order: 1
lastUpdated: 2026-02-14
---

The Status endpoint provides a consolidated view of your team's monitoring health, including the overall status and individual monitor states.

## GET /v1/status

Returns the overall status of all monitors in your team, along with a summary and details for each monitor.

### Required Scope

`monitors:read`

### Example Request

#### cURL

```bash
curl https://api.uptime.example.com/v1/status \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"status": "degraded",
	"monitors": [
		{
			"id": "mon_abc123",
			"name": "Production API",
			"status": "up",
			"enabled": true,
			"lastCheck": "2026-02-14T10:30:00Z",
			"responseTimeMs": 142
		},
		{
			"id": "mon_def456",
			"name": "Marketing Website",
			"status": "degraded",
			"enabled": true,
			"lastCheck": "2026-02-14T10:29:45Z",
			"responseTimeMs": 2340
		},
		{
			"id": "mon_ghi789",
			"name": "Staging Environment",
			"status": "unknown",
			"enabled": false,
			"lastCheck": null,
			"responseTimeMs": null
		}
	],
	"summary": {
		"total": 3,
		"up": 1,
		"down": 0,
		"degraded": 1,
		"unknown": 1
	}
}
```

### Response Fields

| Field                       | Type           | Description                                                                                    |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `status`                    | string         | Overall team status: `operational`, `degraded`, `partial_outage`, `major_outage`, or `unknown` |
| `monitors`                  | array          | List of all monitors with their current state                                                  |
| `monitors[].id`             | string         | Unique monitor identifier                                                                      |
| `monitors[].name`           | string         | Display name of the monitor                                                                    |
| `monitors[].status`         | string         | Current status: `up`, `down`, `degraded`, or `unknown`                                         |
| `monitors[].enabled`        | boolean        | Whether the monitor is actively checking                                                       |
| `monitors[].lastCheck`      | string \| null | ISO 8601 timestamp of the last check, or `null` if never checked                               |
| `monitors[].responseTimeMs` | number \| null | Response time in milliseconds, or `null` if unavailable                                        |
| `summary`                   | object         | Aggregate counts of monitor states                                                             |
| `summary.total`             | number         | Total number of monitors                                                                       |
| `summary.up`                | number         | Count of monitors with `up` status                                                             |
| `summary.down`              | number         | Count of monitors with `down` status                                                           |
| `summary.degraded`          | number         | Count of monitors with `degraded` status                                                       |
| `summary.unknown`           | number         | Count of monitors with `unknown` status                                                        |

### Overall Status Calculation

The overall `status` field is calculated based on monitor states:

- **operational** - All enabled monitors are `up`
- **degraded** - At least one monitor is `degraded`, but none are `down`
- **partial_outage** - Some monitors are `down`, but not all
- **major_outage** - All enabled monitors are `down`
- **unknown** - No enabled monitors, or all monitors have `unknown` status

### Possible Errors

| Status | Code           | Description                                |
| ------ | -------------- | ------------------------------------------ |
| 401    | UNAUTHORIZED   | Missing or invalid API key                 |
| 403    | FORBIDDEN      | API key doesn't have `monitors:read` scope |
| 429    | RATE_LIMITED   | Too many requests                          |
| 500    | INTERNAL_ERROR | Server error                               |

### Response Schema

Use this schema to validate the response in your integration:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["status", "monitors", "summary"],
	"properties": {
		"status": {
			"type": "string",
			"enum": ["operational", "degraded", "partial_outage", "major_outage", "unknown"]
		},
		"monitors": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["id", "name", "status", "enabled", "lastCheck", "responseTimeMs"],
				"properties": {
					"id": {
						"type": "string"
					},
					"name": {
						"type": "string"
					},
					"status": {
						"type": "string",
						"enum": ["up", "down", "degraded", "unknown"]
					},
					"enabled": {
						"type": "boolean"
					},
					"lastCheck": {
						"type": ["string", "null"],
						"format": "date-time"
					},
					"responseTimeMs": {
						"type": ["number", "null"],
						"minimum": 0
					}
				}
			}
		},
		"summary": {
			"type": "object",
			"required": ["total", "up", "down", "degraded", "unknown"],
			"properties": {
				"total": {
					"type": "integer",
					"minimum": 0
				},
				"up": {
					"type": "integer",
					"minimum": 0
				},
				"down": {
					"type": "integer",
					"minimum": 0
				},
				"degraded": {
					"type": "integer",
					"minimum": 0
				},
				"unknown": {
					"type": "integer",
					"minimum": 0
				}
			}
		}
	}
}
```
