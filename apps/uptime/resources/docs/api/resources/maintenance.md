---
title: Maintenance Windows
description: Schedule and manage maintenance windows. Suppress alerts during planned downtime.
section:
  title: API Resources
  order: 5
order: 9
lastUpdated: 2026-09-05
---

Maintenance windows allow you to schedule planned downtime for your monitors. During a maintenance window, alerts can be suppressed and the status page can display a maintenance notice.

## Scope

`monitorType` and `monitorId` are the window's scope, and together they mean one of three things:

- Neither — every monitor the team has, of every kind.
- `monitorType` alone — every monitor of that kind, including ones created later.
- `monitorType` and `monitorId` — that one monitor, looked up in that kind's monitors.

A `monitorId` sent on its own is read as an HTTP monitor, which is what it has always meant, so clients written before the other monitor kinds arrived keep working untouched.

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers a `404` `not-found` problem with "Monitor not found" — the window is never quietly widened to the whole team instead.

## GET /api/v1/maintenance

Returns the maintenance windows for your team. This endpoint is paginated; see [Pagination](/docs/api/pagination) for how to page through the full list.

<!-- operation: maintenanceIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/maintenance?perPage=25" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"maintenanceWindows": [
			{
				"id": "mnt_abc123",
				"teamId": "team_xyz789",
				"monitorType": "http",
				"monitorId": "mon_def456",
				"name": "Database Migration",
				"startsAt": 1771120800000,
				"endsAt": 1771128000000,
				"endedEarlyAt": null,
				"suppressAlerts": true,
				"showOnStatusPage": true,
				"createdAt": 1771070400000,
				"updatedAt": 1771070400000
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
			"total": 31
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
| `meta.pagination.total`   | integer        | Maintenance windows matching, across every page    |

## POST /api/v1/maintenance

Creates a new maintenance window and answers `201 Created`.

<!-- operation: maintenanceCreate -->

### Request Body

| Field              | Type           | Required | Description                                                                                                                                                                                                                        |
| ------------------ | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | string         | Yes      | Name of the maintenance window (at least 1 character)                                                                                                                                                                              |
| `startsAt`         | string         | Yes      | Start time in ISO 8601 format                                                                                                                                                                                                      |
| `endsAt`           | string         | Yes      | End time in ISO 8601 format (must be after `startsAt`)                                                                                                                                                                             |
| `monitorType`      | string         | No       | Limit the window to one kind of monitor: `http`, `dns`, `tcp`, `cron` or `flow`. Sent on its own, the window covers every monitor of that kind, including ones created later.                                                      |
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
		"maintenanceWindow": {
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorType": "http",
			"monitorId": "mon_def456",
			"name": "Database Migration",
			"startsAt": 1771120800000,
			"endsAt": 1771128000000,
			"endedEarlyAt": null,
			"suppressAlerts": true,
			"showOnStatusPage": true,
			"createdAt": 1771063200000,
			"updatedAt": 1771063200000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## GET /api/v1/maintenance/:id

Returns a single maintenance window by ID.

<!-- operation: maintenanceShow -->

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
		"maintenanceWindow": {
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorType": "http",
			"monitorId": "mon_def456",
			"name": "Database Migration",
			"startsAt": 1771120800000,
			"endsAt": 1771128000000,
			"endedEarlyAt": null,
			"suppressAlerts": true,
			"showOnStatusPage": true,
			"createdAt": 1771063200000,
			"updatedAt": 1771063200000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## PATCH /api/v1/maintenance/:id

Updates an existing maintenance window with a [JSON merge patch](/docs/api/overview#updating-resources).

<!-- operation: maintenancePatch -->

### Request Body

Include only the fields you want to change. `null` clears the scope and resets `suppressAlerts` and `showOnStatusPage` to `true`; `name`, `startsAt` and `endsAt` cannot be removed.

| Field              | Type            | Required | Description                                                                          |
| ------------------ | --------------- | -------- | ------------------------------------------------------------------------------------ |
| `name`             | string          | No       | Name of the maintenance window (at least 1 character)                                |
| `startsAt`         | string          | No       | Start time in ISO 8601 format                                                        |
| `endsAt`           | string          | No       | End time in ISO 8601 format (must be after the window's start, sent or stored)       |
| `monitorType`      | string \| null  | No       | The kind of monitor the window is limited to: `http`, `dns`, `tcp`, `cron` or `flow` |
| `monitorId`        | string \| null  | No       | The single monitor the window is limited to, or `null` for all monitors              |
| `suppressAlerts`   | boolean \| null | No       | Whether to suppress alerts during maintenance; `null` resets it to `true`            |
| `showOnStatusPage` | boolean \| null | No       | Whether to show maintenance on status page; `null` resets it to `true`               |

`monitorType` and `monitorId` are the window's scope, and they move as a pair: change either one and both are rewritten, so narrowing a window to a whole kind of monitor cannot leave the previous monitor's id behind it. Mention neither and the scope is left exactly as it is.

- `{"monitorType": "dns"}` — every DNS monitor
- `{"monitorType": "dns", "monitorId": "..."}` — that one DNS monitor
- `{"monitorId": null}` or `{"monitorType": null}` — back to team-wide
- `{"monitorId": "..."}` — that one HTTP monitor

A `monitorId` that does not belong to the team, or that belongs to a different kind of monitor than `monitorType` names, answers a `404` `not-found` problem.

### Example Request

#### cURL

```bash
curl -X PATCH https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{
    "name": "Extended Database Migration",
    "endsAt": "2026-02-15T06:00:00Z"
  }'
```

### Response

```json
{
	"data": {
		"maintenanceWindow": {
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorType": "http",
			"monitorId": "mon_def456",
			"name": "Extended Database Migration",
			"startsAt": 1771120800000,
			"endsAt": 1771135200000,
			"endedEarlyAt": null,
			"suppressAlerts": true,
			"showOnStatusPage": true,
			"createdAt": 1771063200000,
			"updatedAt": 1771068600000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Update With PUT

`PUT /api/v1/maintenance/:id` takes the same fields, for integrations written before `PATCH` existed. A field you leave out keeps its value, and `null` is refused everywhere except `monitorId`, where it widens the window back to team-wide. Sending either scope field rewrites both, and the window's `endsAt` must still follow its `startsAt`.

<!-- operation: maintenanceUpdate -->

## DELETE /api/v1/maintenance/:id

Deletes a maintenance window.

<!-- operation: maintenanceDestroy -->

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/maintenance/mnt_abc123 \
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

## POST /api/v1/maintenance/:id/end

Ends a maintenance window early. Sets the `endedEarlyAt` timestamp to the current time.

<!-- operation: maintenanceEnd -->

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
		"maintenanceWindow": {
			"id": "mnt_abc123",
			"teamId": "team_xyz789",
			"monitorType": "http",
			"monitorId": "mon_def456",
			"name": "Database Migration",
			"startsAt": 1771120800000,
			"endsAt": 1771128000000,
			"endedEarlyAt": 1771125300000,
			"suppressAlerts": true,
			"showOnStatusPage": true,
			"createdAt": 1771063200000,
			"updatedAt": 1771125300000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

## Response Fields

| Field              | Type            | Description                                                                     |
| ------------------ | --------------- | ------------------------------------------------------------------------------- |
| `id`               | string          | Unique maintenance window identifier                                            |
| `teamId`           | string          | Team that owns this maintenance window                                          |
| `monitorType`      | string \| null  | Kind of monitor the window is limited to, or `null` if it applies to every kind |
| `monitorId`        | string \| null  | Associated monitor ID, or `null` if applies to all monitors                     |
| `name`             | string          | Display name of the maintenance window                                          |
| `startsAt`         | integer         | Scheduled start time as a Unix timestamp in milliseconds                        |
| `endsAt`           | integer         | Scheduled end time as a Unix timestamp in milliseconds                          |
| `endedEarlyAt`     | integer \| null | When maintenance was ended early, in milliseconds, or `null`                    |
| `suppressAlerts`   | boolean         | Whether alerts are suppressed during maintenance                                |
| `showOnStatusPage` | boolean         | Whether maintenance is displayed on the status page                             |
| `createdAt`        | integer         | Creation time as a Unix timestamp in milliseconds                               |
| `updatedAt`        | integer         | Last update time as a Unix timestamp in milliseconds                            |
