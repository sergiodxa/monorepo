---
title: Reports
description: Read uptime reports as JSON or download them as CSV, for a month, a quarter or any range of days.
section:
  title: API Resources
  order: 5
order: 14
lastUpdated: 2026-09-29
---

Reports return a team's uptime history per monitor, computed from the daily roll-up: a summary over a range, or one row per monitor per day. Both need an API key with the `reports:read` permission.

## Range and Filters

Both endpoints take the same query parameters.

| Parameter        | Type   | Required | Description                                                        |
| ---------------- | ------ | -------- | ------------------------------------------------------------------ |
| `from`           | string | No       | First UTC day, `YYYY-MM-DD`, included                              |
| `to`             | string | No       | Last UTC day, `YYYY-MM-DD`, included; yesterday at the latest      |
| `status_page_id` | string | No       | Only the monitors attached to this status page (`sp_…`)            |
| `monitor_type`   | string | No       | Only monitors of this type: `http`, `dns`, `tcp`, `cron` or `flow` |

Without `from` and `to`, a report covers last month. Give both or neither; a range covers at most 366 days. Every response echoes the `from` and `to` it covers.

Uptime is successful checks divided by all checks, unrounded, from 0 to 100, and `null` for a monitor with no checks. A day with no recorded checks has no row and is left out of the summary. For HTTP monitors, degraded checks count as failed. Maintenance minutes are listed per monitor and are part of uptime.

## CSV

Send `Accept: text/csv` to receive the report as a CSV download covering the whole range, unpaginated. Columns are separated by commas, headers are the snake_case form of the JSON fields (`uptime_percent`), and decimals use a dot. The `Content-Disposition` header names the file after the team, the report and the range.

```bash
curl "https://uptime.sergiodxa.com/api/v1/reports/uptime-summary?from=2026-08-01&to=2026-08-31" \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Accept: text/csv" \
  -o uptime-summary.csv
```

Any other `Accept`, including none, returns JSON.

## GET /api/v1/reports/uptime-summary

One entry per monitor for the whole range, ordered by monitor type (HTTP, DNS, TCP, cron, flow) and then by name.

<!-- operation: reportsUptimeSummary -->

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/reports/uptime-summary?monitor_type=http" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"from": "2026-08-01",
		"to": "2026-08-31",
		"monitors": [
			{
				"monitorId": "mon_abc123",
				"monitor": "Production API",
				"type": "http",
				"target": "https://api.example.com/health",
				"daysWithData": 31,
				"totalChecks": 44640,
				"successfulChecks": 44618,
				"failedChecks": 22,
				"uptimePercent": 99.95071684587814,
				"avgResponseTimeMs": 142.3,
				"maxResponseTimeMs": 2340,
				"daysDown": 0,
				"daysDegraded": 2,
				"maintenanceMinutes": 120
			}
		]
	}
}
```

## GET /api/v1/reports/uptime-daily

One entry per monitor per day, in the summary's monitor order and then by date. JSON responses are paginated with `perPage` and `cursor`, as described in [Pagination](/docs/api/pagination).

<!-- operation: reportsUptimeDaily -->

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/reports/uptime-daily?from=2026-08-01&to=2026-08-07&perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"from": "2026-08-01",
		"to": "2026-08-07",
		"days": [
			{
				"date": "2026-08-01",
				"monitorId": "mon_abc123",
				"monitor": "Production API",
				"type": "http",
				"totalChecks": 1440,
				"successfulChecks": 1440,
				"failedChecks": 0,
				"uptimePercent": 100,
				"avgResponseTimeMs": 138.2,
				"maxResponseTimeMs": 410,
				"status": "up",
				"maintenanceMinutes": 0
			}
		]
	},
	"meta": {
		"pagination": { "next": null, "prev": null, "perPage": 100 }
	}
}
```
