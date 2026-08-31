---
title: Alerts
description: Create and manage alerts for email, Slack, Discord, and webhook notifications. Maximum 10 per team.
section:
  title: API Resources
  order: 5
order: 7
lastUpdated: 2026-08-04
---

Alerts notify you when monitors detect issues. Each team can have up to 10 alerts with different notification strategies: email, webhook, Slack, or Discord.

Sensitive data such as webhook URLs and secrets are never returned in API responses for security.

## Repeat Behaviour

`cooldownMinutes` controls how far apart _repeat_ notifications are spaced while a monitor stays broken. For one outage an alert notifies:

1. **Immediately** on the first failing check. The first notification of an outage ignores `cooldownMinutes` entirely, so no value you set can delay it.
2. **Again every `cooldownMinutes`** for as long as the monitor stays broken. Nothing bounds the total number of notifications one outage produces.
3. **Once on recovery**, when `notifyOnRecovery` is `true`.

Repeats are additionally floored at **five minutes**: however low `cooldownMinutes` is, repeats are never sent more often than once every five minutes. A `cooldownMinutes` of `0` therefore means "as often as allowed" (at most 12 notifications an hour), not one notification per check. The floor does not apply to the recovery notification, which is spaced only by the `cooldownMinutes` you set.

Omitting `cooldownMinutes` defaults it to `60` — one hour — matching the default an alert created in the dashboard gets. Send `0` explicitly if you want repeats as often as the floor allows.

## GET /api/v1/alerts

Returns all alerts for your team.

### Required Scope

`alerts:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/alerts \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"alerts": [
		{
			"id": "alt_abc123",
			"name": "Email Alert",
			"strategy": "email",
			"notifyOnRecovery": true,
			"cooldownMinutes": 5,
			"monitorType": null,
			"monitorId": null,
			"createdAt": "2026-02-14T10:00:00Z",
			"updatedAt": "2026-02-14T10:00:00Z"
		},
		{
			"id": "alt_def456",
			"name": "Slack Notifications",
			"strategy": "slack",
			"notifyOnRecovery": true,
			"cooldownMinutes": 0,
			"monitorType": "http",
			"monitorId": "mon_abc123",
			"createdAt": "2026-02-14T11:00:00Z",
			"updatedAt": "2026-02-14T11:00:00Z"
		}
	]
}
```

### Possible Errors

| Status | Code           | Description                              |
| ------ | -------------- | ---------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key               |
| 403    | FORBIDDEN      | API key doesn't have `alerts:read` scope |
| 429    | RATE_LIMITED   | Too many requests                        |
| 500    | INTERNAL_ERROR | Server error                             |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["alerts"],
	"properties": {
		"alerts": {
			"type": "array",
			"items": {
				"type": "object",
				"required": [
					"id",
					"name",
					"strategy",
					"notifyOnRecovery",
					"cooldownMinutes",
					"monitorId",
					"createdAt",
					"updatedAt"
				],
				"properties": {
					"id": {
						"type": "string",
						"pattern": "^alt_[a-zA-Z0-9]+$"
					},
					"name": {
						"type": "string",
						"minLength": 1,
						"maxLength": 100
					},
					"strategy": {
						"type": "string",
						"enum": ["email", "webhook", "slack", "discord"]
					},
					"notifyOnRecovery": {
						"type": "boolean"
					},
					"cooldownMinutes": {
						"type": "integer",
						"minimum": 0,
						"maximum": 1440
					},
					"monitorType": {
						"type": ["string", "null"],
						"enum": ["http", "dns", "tcp", "cron", null]
					},
					"monitorId": {
						"type": ["string", "null"],
						"pattern": "^mon_[a-zA-Z0-9]+$"
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
}
```

## POST /api/v1/alerts

Creates a new alert. The request body varies based on the notification strategy.

### Required Scope

`alerts:write`

### Common Fields

| Field              | Type    | Required | Description                                                                                                                                                                                                                       |
| ------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | string  | Yes      | Display name for the alert                                                                                                                                                                                                        |
| `strategy`         | string  | Yes      | One of: `email`, `webhook`, `slack`, `discord`                                                                                                                                                                                    |
| `notifyOnRecovery` | boolean | No       | Send notification when monitor recovers (default: `true`)                                                                                                                                                                         |
| `cooldownMinutes`  | integer | No       | Minutes between repeat notifications while a monitor stays broken, 0-1440 (default: `60`; repeats are floored at 5 minutes, and the first notification of an outage is never delayed — see [Repeat Behaviour](#repeat-behaviour)) |
| `monitorType`      | string  | No       | Limit the alert to one kind of monitor: `http`, `dns`, `tcp` or `cron`. Sent on its own, the alert covers every monitor of that kind, including ones created later.                                                               |
| `monitorId`        | string  | No       | Limit the alert to a single monitor. Sent together with `monitorType`, the id is looked up in that kind's monitors; sent on its own it is read as an HTTP monitor, which is what it has always meant.                             |

### Strategy: Email

| Field           | Type   | Required | Description                    |
| --------------- | ------ | -------- | ------------------------------ |
| `email`         | string | Yes      | Email address to notify        |
| `subjectPrefix` | string | No       | Prefix for email subject lines |

### Strategy: Webhook

| Field    | Type   | Required | Description                            |
| -------- | ------ | -------- | -------------------------------------- |
| `url`    | string | Yes      | Webhook URL to POST notifications to   |
| `secret` | string | No       | Secret for HMAC signature verification |

### Strategy: Slack

| Field        | Type   | Required | Description                  |
| ------------ | ------ | -------- | ---------------------------- |
| `webhookUrl` | string | Yes      | Slack incoming webhook URL   |
| `channel`    | string | No       | Override the default channel |

### Strategy: Discord

| Field        | Type   | Required | Description         |
| ------------ | ------ | -------- | ------------------- |
| `webhookUrl` | string | Yes      | Discord webhook URL |

### Example Request (Email)

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/alerts \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team Email Alert",
    "strategy": "email",
    "email": "alerts@example.com",
    "subjectPrefix": "[Uptime]",
    "notifyOnRecovery": true,
    "cooldownMinutes": 5
  }'
```

### Example Request (Webhook)

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/alerts \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PagerDuty Integration",
    "strategy": "webhook",
    "url": "https://events.pagerduty.com/integration/abc123/enqueue",
    "secret": "whsec_your_secret_key"
  }'
```

### Example Request (Slack)

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/alerts \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack #incidents",
    "strategy": "slack",
    "webhookUrl": "https://hooks.slack.com/services/T00/B00/xxx",
    "channel": "#incidents"
  }'
```

### Example Request (Discord)

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/alerts \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discord Server Alert",
    "strategy": "discord",
    "webhookUrl": "https://discord.com/api/webhooks/123/abc"
  }'
```

### Response

```json
{
	"id": "alt_abc123",
	"name": "Team Email Alert",
	"strategy": "email",
	"notifyOnRecovery": true,
	"cooldownMinutes": 5,
	"monitorType": null,
	"monitorId": null,
	"createdAt": "2026-02-14T12:00:00Z",
	"updatedAt": "2026-02-14T12:00:00Z"
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or missing required fields |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `alerts:write` scope       |
| 400    | LIMIT_EXCEEDED   | Team already has 10 alerts                      |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

### Request Body Schema (Email)

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "strategy", "email"],
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"const": "email"
		},
		"email": {
			"type": "string",
			"format": "email"
		},
		"subjectPrefix": {
			"type": "string",
			"maxLength": 50
		},
		"notifyOnRecovery": {
			"type": "boolean",
			"default": true
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440,
			"default": 60
		},
		"monitorType": {
			"type": "string",
			"enum": ["http", "dns", "tcp", "cron"]
		},
		"monitorId": {
			"type": "string",
			"pattern": "^mon_[a-zA-Z0-9]+$"
		}
	}
}
```

### Request Body Schema (Webhook)

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "strategy", "url"],
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"const": "webhook"
		},
		"url": {
			"type": "string",
			"format": "uri"
		},
		"secret": {
			"type": "string"
		},
		"notifyOnRecovery": {
			"type": "boolean",
			"default": true
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440,
			"default": 60
		},
		"monitorType": {
			"type": "string",
			"enum": ["http", "dns", "tcp", "cron"]
		},
		"monitorId": {
			"type": "string",
			"pattern": "^mon_[a-zA-Z0-9]+$"
		}
	}
}
```

### Request Body Schema (Slack)

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "strategy", "webhookUrl"],
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"const": "slack"
		},
		"webhookUrl": {
			"type": "string",
			"format": "uri"
		},
		"channel": {
			"type": "string"
		},
		"notifyOnRecovery": {
			"type": "boolean",
			"default": true
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440,
			"default": 60
		},
		"monitorType": {
			"type": "string",
			"enum": ["http", "dns", "tcp", "cron"]
		},
		"monitorId": {
			"type": "string",
			"pattern": "^mon_[a-zA-Z0-9]+$"
		}
	}
}
```

### Request Body Schema (Discord)

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "strategy", "webhookUrl"],
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"const": "discord"
		},
		"webhookUrl": {
			"type": "string",
			"format": "uri"
		},
		"notifyOnRecovery": {
			"type": "boolean",
			"default": true
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440,
			"default": 60
		},
		"monitorType": {
			"type": "string",
			"enum": ["http", "dns", "tcp", "cron"]
		},
		"monitorId": {
			"type": "string",
			"pattern": "^mon_[a-zA-Z0-9]+$"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": [
		"id",
		"name",
		"strategy",
		"notifyOnRecovery",
		"cooldownMinutes",
		"monitorId",
		"createdAt",
		"updatedAt"
	],
	"properties": {
		"id": {
			"type": "string",
			"pattern": "^alt_[a-zA-Z0-9]+$"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"type": "string",
			"enum": ["email", "webhook", "slack", "discord"]
		},
		"notifyOnRecovery": {
			"type": "boolean"
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440
		},
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
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

## GET /api/v1/alerts/:id

Returns a single alert by ID.

### Required Scope

`alerts:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"id": "alt_abc123",
	"name": "Team Email Alert",
	"strategy": "email",
	"notifyOnRecovery": true,
	"cooldownMinutes": 5,
	"monitorType": null,
	"monitorId": null,
	"createdAt": "2026-02-14T12:00:00Z",
	"updatedAt": "2026-02-14T12:00:00Z"
}
```

### Possible Errors

| Status | Code           | Description                              |
| ------ | -------------- | ---------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key               |
| 403    | FORBIDDEN      | API key doesn't have `alerts:read` scope |
| 404    | NOT_FOUND      | Alert not found                          |
| 429    | RATE_LIMITED   | Too many requests                        |
| 500    | INTERNAL_ERROR | Server error                             |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": [
		"id",
		"name",
		"strategy",
		"notifyOnRecovery",
		"cooldownMinutes",
		"monitorId",
		"createdAt",
		"updatedAt"
	],
	"properties": {
		"id": {
			"type": "string",
			"pattern": "^alt_[a-zA-Z0-9]+$"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"type": "string",
			"enum": ["email", "webhook", "slack", "discord"]
		},
		"notifyOnRecovery": {
			"type": "boolean"
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440
		},
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
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

## PUT /api/v1/alerts/:id

Updates an existing alert. You cannot change the `strategy` field.

### Required Scope

`alerts:write`

### Request Body

Include only the fields you want to update. The `strategy` field cannot be changed.

`monitorType` and `monitorId` are the alert's scope, and they move as a pair: send either one and both are rewritten, so narrowing an alert to a whole kind of monitor cannot leave the previous monitor's id behind it. Mention neither and the scope is left exactly as it is.

- `{"monitorType": "dns"}` — every DNS monitor
- `{"monitorType": "dns", "monitorId": "..."}` — that one DNS monitor
- `{"monitorId": null}` — back to team-wide
- `{"monitorId": "..."}` — that one HTTP monitor

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers `404 NOT_FOUND`.

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Alert Name",
    "cooldownMinutes": 10,
    "notifyOnRecovery": false
  }'
```

### Response

```json
{
	"id": "alt_abc123",
	"name": "Updated Alert Name",
	"strategy": "email",
	"notifyOnRecovery": false,
	"cooldownMinutes": 10,
	"monitorType": null,
	"monitorId": null,
	"createdAt": "2026-02-14T12:00:00Z",
	"updatedAt": "2026-02-14T13:00:00Z"
}
```

### Possible Errors

| Status | Code             | Description                                          |
| ------ | ---------------- | ---------------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or attempted to change strategy |
| 401    | UNAUTHORIZED     | Missing or invalid API key                           |
| 403    | FORBIDDEN        | API key doesn't have `alerts:write` scope            |
| 404    | NOT_FOUND        | Alert not found                                      |
| 429    | RATE_LIMITED     | Too many requests                                    |
| 500    | INTERNAL_ERROR   | Server error                                         |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"email": {
			"type": "string",
			"format": "email"
		},
		"subjectPrefix": {
			"type": "string",
			"maxLength": 50
		},
		"url": {
			"type": "string",
			"format": "uri"
		},
		"secret": {
			"type": "string"
		},
		"webhookUrl": {
			"type": "string",
			"format": "uri"
		},
		"channel": {
			"type": "string"
		},
		"notifyOnRecovery": {
			"type": "boolean"
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440
		},
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": [
		"id",
		"name",
		"strategy",
		"notifyOnRecovery",
		"cooldownMinutes",
		"monitorId",
		"createdAt",
		"updatedAt"
	],
	"properties": {
		"id": {
			"type": "string",
			"pattern": "^alt_[a-zA-Z0-9]+$"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 100
		},
		"strategy": {
			"type": "string",
			"enum": ["email", "webhook", "slack", "discord"]
		},
		"notifyOnRecovery": {
			"type": "boolean"
		},
		"cooldownMinutes": {
			"type": "integer",
			"minimum": 0,
			"maximum": 1440
		},
		"monitorType": {
			"type": ["string", "null"],
			"enum": ["http", "dns", "tcp", "cron", null]
		},
		"monitorId": {
			"type": ["string", "null"],
			"pattern": "^mon_[a-zA-Z0-9]+$"
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

## DELETE /api/v1/alerts/:id

Deletes an alert.

### Required Scope

`alerts:write`

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `204 No Content` on success.

### Possible Errors

| Status | Code           | Description                               |
| ------ | -------------- | ----------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                |
| 403    | FORBIDDEN      | API key doesn't have `alerts:write` scope |
| 404    | NOT_FOUND      | Alert not found                           |
| 429    | RATE_LIMITED   | Too many requests                         |
| 500    | INTERNAL_ERROR | Server error                              |

### Response Schema

Returns `204 No Content` with no response body on success.

## GET /api/v1/alerts/:id/events

Returns the event history for an alert.

### Required Scope

`alerts:read`

### Query Parameters

| Parameter | Type    | Required | Description                                     |
| --------- | ------- | -------- | ----------------------------------------------- |
| `limit`   | integer | No       | Number of events to return, 1-200 (default: 50) |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123/events?limit=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"events": [
		{
			"id": "evt_abc123",
			"alertId": "alt_abc123",
			"monitorId": "mon_def456",
			"type": "triggered",
			"status": "delivered",
			"createdAt": "2026-02-14T10:30:00Z"
		},
		{
			"id": "evt_def456",
			"alertId": "alt_abc123",
			"monitorId": "mon_def456",
			"type": "recovered",
			"status": "delivered",
			"createdAt": "2026-02-14T10:35:00Z"
		}
	]
}
```

### Event Fields

| Field       | Type   | Description                                          |
| ----------- | ------ | ---------------------------------------------------- |
| `id`        | string | Unique event identifier                              |
| `alertId`   | string | The alert that was triggered                         |
| `monitorId` | string | The monitor that caused the event                    |
| `type`      | string | Event type: `triggered` or `recovered`               |
| `status`    | string | Delivery status: `pending`, `delivered`, or `failed` |
| `createdAt` | string | ISO 8601 timestamp of when the event occurred        |

### Possible Errors

| Status | Code             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid limit parameter                  |
| 401    | UNAUTHORIZED     | Missing or invalid API key               |
| 403    | FORBIDDEN        | API key doesn't have `alerts:read` scope |
| 404    | NOT_FOUND        | Alert not found                          |
| 429    | RATE_LIMITED     | Too many requests                        |
| 500    | INTERNAL_ERROR   | Server error                             |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["events"],
	"properties": {
		"events": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["id", "alertId", "monitorId", "type", "status", "createdAt"],
				"properties": {
					"id": {
						"type": "string",
						"pattern": "^evt_[a-zA-Z0-9]+$"
					},
					"alertId": {
						"type": "string",
						"pattern": "^alt_[a-zA-Z0-9]+$"
					},
					"monitorId": {
						"type": "string",
						"pattern": "^mon_[a-zA-Z0-9]+$"
					},
					"type": {
						"type": "string",
						"enum": ["triggered", "recovered"]
					},
					"status": {
						"type": "string",
						"enum": ["pending", "delivered", "failed"]
					},
					"createdAt": {
						"type": "string",
						"format": "date-time"
					}
				}
			}
		}
	}
}
```
