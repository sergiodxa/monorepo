---
title: Alerts
description: Create and manage alerts for email, Slack, Discord, and webhook notifications. Maximum 10 per team.
section:
  title: API Resources
  order: 5
order: 7
lastUpdated: 2026-09-05
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

Returns the alerts for your team. This endpoint is paginated; see [Pagination](/docs/api/pagination) for how to walk the whole list.

<!-- operation: alertsIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/alerts?perPage=25" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"alerts": [
			{
				"id": "alt_abc123",
				"name": "Email Alert",
				"notifyOnRecovery": true,
				"cooldownMinutes": 5,
				"config": {
					"strategy": "email",
					"to": "ops@example.com",
					"subjectPrefix": "[Uptime]"
				},
				"monitorType": null,
				"monitorId": null,
				"createdAt": 1771070400000,
				"updatedAt": 1771070400000
			},
			{
				"id": "alt_def456",
				"name": "Slack Notifications",
				"notifyOnRecovery": true,
				"cooldownMinutes": 0,
				"config": {
					"strategy": "slack",
					"channel": "#incidents"
				},
				"monitorType": "http",
				"monitorId": "mon_abc123",
				"createdAt": 1771074000000,
				"updatedAt": 1771074000000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": null,
			"prev": null,
			"perPage": 25,
			"total": 2
		}
	}
}
```

Webhook URLs and secrets stay out of `config`, so a webhook or Discord alert reports only its `strategy`.

## POST /api/v1/alerts

Creates a new alert. The request body varies based on the notification strategy.

<!-- operation: alertsCreate -->

### Common Fields

| Field              | Type    | Required | Description                                                                                                                                                                                                                                                                                      |
| ------------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`             | string  | Yes      | Display name for the alert, 1-255 characters                                                                                                                                                                                                                                                     |
| `strategy`         | string  | Yes      | One of: `email`, `webhook`, `slack`, `discord`                                                                                                                                                                                                                                                   |
| `notifyOnRecovery` | boolean | No       | Send notification when monitor recovers (default: `true`)                                                                                                                                                                                                                                        |
| `cooldownMinutes`  | integer | No       | Minutes between repeat notifications while a monitor stays broken, 0-1440 (default: `60`; repeats are floored at 5 minutes, and the first notification of an outage is never delayed — see [Repeat Behaviour](#repeat-behaviour))                                                                |
| `monitorType`      | string  | No       | Limit the alert to one kind of monitor: `http`, `dns`, `tcp`, `cron` or `flow`. Sent on its own, the alert covers every monitor of that kind, including ones created later.                                                                                                                      |
| `monitorId`        | string  | No       | Limit the alert to a single monitor. Sent together with `monitorType`, the id is looked up in that kind's monitors; sent on its own it is read as an HTTP monitor, which is what it has always meant. The id carries the prefix of its kind: `mon_` (HTTP), `dns_`, `tcpm_`, `cron_` or `flow_`. |

### Strategy: Email

| Field           | Type   | Required | Description                                          |
| --------------- | ------ | -------- | ---------------------------------------------------- |
| `email`         | string | Yes      | Email address to notify                              |
| `subjectPrefix` | string | No       | Prefix for email subject lines, up to 100 characters |

### Strategy: Webhook

| Field    | Type   | Required | Description                                                  |
| -------- | ------ | -------- | ------------------------------------------------------------ |
| `url`    | string | Yes      | Webhook URL to POST notifications to                         |
| `secret` | string | No       | Secret for HMAC signature verification, up to 255 characters |

### Strategy: Slack

| Field        | Type   | Required | Description                                        |
| ------------ | ------ | -------- | -------------------------------------------------- |
| `webhookUrl` | string | Yes      | Slack incoming webhook URL                         |
| `channel`    | string | No       | Override the default channel, up to 100 characters |

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

Returns `201 Created`. The alert's `config` reports only its `strategy`.

```json
{
	"data": {
		"alert": {
			"id": "alt_abc123",
			"name": "Team Email Alert",
			"notifyOnRecovery": true,
			"cooldownMinutes": 5,
			"monitorType": null,
			"monitorId": null,
			"config": { "strategy": "email" },
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

## GET /api/v1/alerts/:id

Returns a single alert by ID.

<!-- operation: alertShow -->

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"alert": {
			"id": "alt_abc123",
			"name": "Team Email Alert",
			"notifyOnRecovery": true,
			"cooldownMinutes": 5,
			"monitorType": null,
			"monitorId": null,
			"config": {
				"strategy": "email",
				"to": "alerts@example.com",
				"subjectPrefix": "[Uptime]"
			},
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

Webhook URLs and secrets stay out of `config`, so a webhook or Discord alert reports only its `strategy`.

## PUT /api/v1/alerts/:id

Updates an existing alert. The notification channel is fixed at creation; to change it, delete the alert and create a new one.

<!-- operation: alertUpdate -->

### Request Body

Include only the fields you want to update: `name`, `notifyOnRecovery`, `cooldownMinutes`, `monitorType` and `monitorId`. Any other field, including `strategy` and the channel settings, is ignored.

`monitorType` and `monitorId` are the alert's scope, and they move as a pair: send either one and both are rewritten, so narrowing an alert to a whole kind of monitor cannot leave the previous monitor's id behind it. Mention neither and the scope is left exactly as it is.

- `{"monitorType": "dns"}` — every DNS monitor
- `{"monitorType": "dns", "monitorId": "..."}` — that one DNS monitor
- `{"monitorId": null}` — back to team-wide
- `{"monitorId": "..."}` — that one HTTP monitor

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers a `404` `not-found` problem.

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

The alert's `config` reports only its `strategy`.

```json
{
	"data": {
		"alert": {
			"id": "alt_abc123",
			"name": "Updated Alert Name",
			"notifyOnRecovery": false,
			"cooldownMinutes": 10,
			"monitorType": null,
			"monitorId": null,
			"config": { "strategy": "email" },
			"createdAt": 1771070400000,
			"updatedAt": 1771074000000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## DELETE /api/v1/alerts/:id

Deletes an alert.

<!-- operation: alertDestroy -->

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `200 OK`:

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

## GET /api/v1/alerts/:id/events

Returns the event history for an alert, newest first. The history is paginated; see [Pagination](/docs/api/pagination) for how to walk further back.

<!-- operation: alertEvents -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/alerts/alt_abc123/events?perPage=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"events": [
			{
				"id": "evt_abc123",
				"alertId": "alt_abc123",
				"monitorId": "mon_def456",
				"eventType": "down",
				"status": "sent",
				"sentAt": 1771072200000,
				"errorMessage": null,
				"createdAt": 1771072200000
			},
			{
				"id": "evt_def456",
				"alertId": "alt_abc123",
				"monitorId": "mon_def456",
				"eventType": "up",
				"status": "sent",
				"sentAt": 1771072500000,
				"errorMessage": null,
				"createdAt": 1771072500000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 10
		}
	}
}
```

### Event Fields

| Field          | Type           | Description                                                              |
| -------------- | -------------- | ------------------------------------------------------------------------ |
| `id`           | string         | Unique event identifier                                                  |
| `alertId`      | string         | The alert the event belongs to                                           |
| `monitorId`    | string         | The monitor that caused the event                                        |
| `eventType`    | string         | What the monitor did: `down`, `up`, or `degraded`                        |
| `status`       | string         | Delivery outcome: `sent`, `skipped_cooldown`, `skipped_cap`, or `failed` |
| `sentAt`       | integer        | Unix timestamp in milliseconds of when the notification was sent         |
| `errorMessage` | string \| null | Why delivery failed, or `null` when it succeeded                         |
| `createdAt`    | integer        | Unix timestamp in milliseconds of when the event was recorded            |
