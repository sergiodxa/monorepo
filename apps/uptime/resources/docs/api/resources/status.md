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

## GET /api/v1/status

Returns the overall status of all monitors in your team, along with a summary and details for each monitor.

### Required Scope

`monitors:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/status \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"status": {
			"overall": "partial_outage",
			"monitors": [
				{
					"id": "mon_abc123",
					"name": "Production API",
					"status": "up",
					"enabled": true,
					"lastCheck": 1771065000000,
					"responseTimeMs": 142
				},
				{
					"id": "mon_def456",
					"name": "Marketing Website",
					"status": "down",
					"enabled": true,
					"lastCheck": 1771064985000,
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
				"total": 2,
				"up": 1,
				"down": 1,
				"degraded": 0,
				"unknown": 0
			}
		}
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-02-14T10:30:00.000Z"
	}
}
```

### Response Fields

All fields live under `data.status`.

| Field                       | Type           | Description                                                                                  |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `overall`                   | string         | Overall team status: `operational`, `partial_outage`, `major_outage`, or `unknown`           |
| `monitors`                  | array          | Every HTTP monitor on the team, enabled or not, newest first                                 |
| `monitors[].id`             | string         | Unique monitor identifier                                                                    |
| `monitors[].name`           | string         | Display name of the monitor                                                                  |
| `monitors[].status`         | string         | `up`, `down`, or `unknown`, from the monitor's latest completed check                        |
| `monitors[].enabled`        | boolean        | Whether the monitor is actively checking                                                     |
| `monitors[].lastCheck`      | number \| null | When the latest check completed, in milliseconds since the epoch, or `null` if never checked |
| `monitors[].responseTimeMs` | number \| null | Response time of the latest check in milliseconds, or `null` if unavailable                  |
| `summary`                   | object         | Aggregate counts of monitor states                                                           |
| `summary.total`             | number         | Number of enabled monitors, the set `overall` is computed from; the other counts sum to it   |
| `summary.up`                | number         | Count of enabled monitors with `up` status                                                   |
| `summary.down`              | number         | Count of enabled monitors with `down` status                                                 |
| `summary.degraded`          | number         | Always `0`; monitors on this endpoint report `up`, `down`, or `unknown`                      |
| `summary.unknown`           | number         | Count of enabled monitors with `unknown` status                                              |

### Monitor Status Calculation

A monitor is `up` when its latest completed check returned the monitor's expected status code, `down` when it returned any other status code, and `unknown` when it has no completed check with a status code (never checked, or the latest check got no response).

### Overall Status Calculation

The `overall` field considers enabled monitors only:

- **operational** - No enabled monitor is `down`
- **partial_outage** - Some enabled monitors are `down`, but not all
- **major_outage** - All enabled monitors are `down`
- **unknown** - The team has no enabled monitors

### Possible Errors

| Status | Type           | Description                                |
| ------ | -------------- | ------------------------------------------ |
| 401    | `unauthorized` | Missing or invalid API key                 |
| 403    | `forbidden`    | API key doesn't have `monitors:read` scope |

### Response Schema

Use this schema to validate the response in your integration:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["status"],
			"properties": {
				"status": {
					"type": "object",
					"required": ["overall", "monitors", "summary"],
					"properties": {
						"overall": {
							"type": "string",
							"enum": ["operational", "degraded", "partial_outage", "major_outage", "unknown"]
						},
						"monitors": {
							"type": "array",
							"items": {
								"type": "object",
								"required": ["id", "name", "status", "enabled", "lastCheck", "responseTimeMs"],
								"properties": {
									"id": { "type": "string", "pattern": "^mon_" },
									"name": { "type": "string" },
									"status": {
										"type": "string",
										"enum": ["up", "down", "degraded", "unknown"]
									},
									"enabled": { "type": "boolean" },
									"lastCheck": {
										"type": ["integer", "null"],
										"description": "Milliseconds since the epoch"
									},
									"responseTimeMs": { "type": ["integer", "null"], "minimum": 0 }
								}
							}
						},
						"summary": {
							"type": "object",
							"required": ["total", "up", "down", "degraded", "unknown"],
							"properties": {
								"total": { "type": "integer", "minimum": 0 },
								"up": { "type": "integer", "minimum": 0 },
								"down": { "type": "integer", "minimum": 0 },
								"degraded": { "type": "integer", "minimum": 0 },
								"unknown": { "type": "integer", "minimum": 0 }
							}
						}
					}
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```
