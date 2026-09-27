---
title: TCP Monitors
description: Create and manage TCP monitors. Check port connectivity and get connection history.
section:
  title: API Resources
  order: 5
order: 4
lastUpdated: 2026-09-05
---

TCP monitors verify that services are accepting connections on specific ports. Use them to monitor databases, mail servers, game servers, and any TCP-based service.

## List All TCP Monitors

Retrieve your team's TCP monitors, newest first.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page through the full list.

```
GET /api/v1/tcp-monitors
```

<!-- operation: tcpMonitorsIndex -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/tcp-monitors?perPage=25" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitors": [
			{
				"id": "tcpm_abc123",
				"name": "PostgreSQL Production",
				"host": "db.example.com",
				"port": 5432,
				"timeoutMs": 5000,
				"intervalSeconds": 60,
				"isEnabled": true,
				"lastCheckedAt": 1771070400000,
				"lastStatus": "up",
				"lastResponseTimeMs": 45,
				"createdAt": 1768473000000,
				"updatedAt": 1770733200000
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
			"total": 34
		}
	}
}
```

## Create a TCP Monitor

Create a new TCP monitor to check port connectivity.

```
POST /api/v1/tcp-monitors
```

<!-- operation: tcpMonitorsCreate -->

### Request Body

| Field             | Type    | Required | Description                                                   |
| ----------------- | ------- | -------- | ------------------------------------------------------------- |
| `name`            | string  | Yes      | Monitor name (1-255 characters)                               |
| `host`            | string  | Yes      | Hostname or IP address (1-255 characters)                     |
| `port`            | integer | Yes      | TCP port number (1-65535)                                     |
| `timeoutMs`       | integer | No       | Connection timeout in milliseconds (100-60000, default: 5000) |
| `intervalSeconds` | integer | No       | Check interval in seconds (60-86400, default: 60)             |
| `isEnabled`       | boolean | No       | Whether the monitor is active (default: true)                 |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PostgreSQL Production",
    "host": "db.example.com",
    "port": 5432,
    "timeoutMs": 10000,
    "intervalSeconds": 60
  }'
```

### Response

```json
{
	"data": {
		"monitor": {
			"id": "tcpm_abc123",
			"name": "PostgreSQL Production",
			"host": "db.example.com",
			"port": 5432,
			"timeoutMs": 10000,
			"intervalSeconds": 60,
			"isEnabled": true,
			"lastCheckedAt": null,
			"lastStatus": null,
			"lastResponseTimeMs": null,
			"createdAt": 1771070400000,
			"updatedAt": 1771070400000
		}
	}
}
```

## Get a TCP Monitor

Retrieve a single TCP monitor by ID.

```
GET /api/v1/tcp-monitors/:id
```

<!-- operation: tcpMonitorShow -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitor": {
			"id": "tcpm_abc123",
			"name": "PostgreSQL Production",
			"host": "db.example.com",
			"port": 5432,
			"timeoutMs": 5000,
			"intervalSeconds": 60,
			"isEnabled": true,
			"lastCheckedAt": 1771070400000,
			"lastStatus": "up",
			"lastResponseTimeMs": 45,
			"createdAt": 1768473000000,
			"updatedAt": 1770733200000
		}
	}
}
```

## Update a TCP Monitor

Update an existing TCP monitor. Only include fields you want to change.

```
PUT /api/v1/tcp-monitors/:id
```

<!-- operation: tcpMonitorUpdate -->

### Request Body

| Field             | Type    | Required | Description                                    |
| ----------------- | ------- | -------- | ---------------------------------------------- |
| `name`            | string  | No       | Monitor name (1-255 characters)                |
| `host`            | string  | No       | Hostname or IP address (1-255 characters)      |
| `port`            | integer | No       | TCP port number (1-65535)                      |
| `timeoutMs`       | integer | No       | Connection timeout in milliseconds (100-60000) |
| `intervalSeconds` | integer | No       | Check interval in seconds (60-86400)           |
| `isEnabled`       | boolean | No       | Whether the monitor is active                  |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123 \
  -X PUT \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "timeoutMs": 15000,
    "isEnabled": false
  }'
```

### Response

```json
{
	"data": {
		"monitor": {
			"id": "tcpm_abc123",
			"name": "PostgreSQL Production",
			"host": "db.example.com",
			"port": 5432,
			"timeoutMs": 15000,
			"intervalSeconds": 60,
			"isEnabled": false,
			"lastCheckedAt": 1771070400000,
			"lastStatus": "up",
			"lastResponseTimeMs": 45,
			"createdAt": 1768473000000,
			"updatedAt": 1771072200000
		}
	}
}
```

## Delete a TCP Monitor

Permanently delete a TCP monitor and all its check history.

```
DELETE /api/v1/tcp-monitors/:id
```

<!-- operation: tcpMonitorDestroy -->

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{ "data": { "deleted": true } }
```

## Get Check Results

Retrieve the connection check history for a TCP monitor.

Results arrive newest first, a page at a time. See [Pagination](/docs/api/pagination) for how to walk the whole history.

```
GET /api/v1/tcp-monitors/:id/results
```

<!-- operation: tcpMonitorResults -->

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123/results?perPage=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"results": [
			{
				"id": "tcpr_xyz789",
				"status": "up",
				"responseTimeMs": 42,
				"errorMessage": null,
				"checkedAt": 1771070400000
			},
			{
				"id": "tcpr_xyz788",
				"status": "up",
				"responseTimeMs": 38,
				"errorMessage": null,
				"checkedAt": 1771070340000
			},
			{
				"id": "tcpr_xyz787",
				"status": "down",
				"responseTimeMs": null,
				"errorMessage": "Connection refused",
				"checkedAt": 1771070280000
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
