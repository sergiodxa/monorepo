---
title: HTTP Monitors
description: Create, update, delete, and query HTTP monitors. Get check results and performance statistics.
section:
  title: API Resources
  order: 5
order: 2
lastUpdated: 2026-02-14
---

HTTP monitors check your websites and APIs for availability, performance, and content validity.

## List Monitors

Retrieve all HTTP monitors for your team.

```
GET /api/v1/monitors
```

**Required scope:** `monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": [
		{
			"id": "mon_abc123",
			"name": "Production API",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 60,
			"degradedAfterMs": 5000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"status": "up",
			"lastCheckedAt": "2026-02-14T12:00:00Z",
			"createdAt": "2026-01-01T00:00:00Z",
			"updatedAt": "2026-01-15T10:30:00Z"
		}
	]
}
```

### Errors

| Status | Code         | Description                          |
| ------ | ------------ | ------------------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid API key           |
| 403    | FORBIDDEN    | API key doesn't have `monitors:read` |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "array",
			"items": {
				"$ref": "#/$defs/Monitor"
			}
		}
	},
	"required": ["data"],
	"$defs": {
		"Monitor": {
			"type": "object",
			"properties": {
				"id": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 255 },
				"url": { "type": "string", "format": "uri" },
				"method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
				"expectedStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
				"intervalSeconds": { "type": "integer", "minimum": 60, "maximum": 3600 },
				"degradedAfterMs": { "type": "integer", "minimum": 1000, "maximum": 30000 },
				"timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 60 },
				"locationHint": {
					"type": "string",
					"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]
				},
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"status": { "type": "string", "enum": ["pending", "up", "degraded", "down"] },
				"lastCheckedAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			},
			"required": [
				"id",
				"name",
				"url",
				"method",
				"expectedStatus",
				"intervalSeconds",
				"degradedAfterMs",
				"timeoutSeconds",
				"locationHint",
				"status",
				"createdAt",
				"updatedAt"
			]
		}
	}
}
```

## Create Monitor

Create a new HTTP monitor.

```
POST /api/v1/monitors
```

**Required scope:** `monitors:write`

### Request Body

| Field                  | Type    | Required | Description                                       |
| ---------------------- | ------- | -------- | ------------------------------------------------- |
| `name`                 | string  | Yes      | Monitor name (1-255 characters)                   |
| `url`                  | string  | Yes      | URL to monitor (must be valid URL)                |
| `method`               | string  | No       | HTTP method (default: `HEAD`)                     |
| `expectedStatus`       | integer | No       | Expected status code 100-599 (default: `200`)     |
| `intervalSeconds`      | integer | No       | Check interval 60-3600 (default: `60`)            |
| `degradedAfterMs`      | integer | No       | Degraded threshold 1000-30000ms (default: `5000`) |
| `timeoutSeconds`       | integer | No       | Request timeout 1-60 (default: `10`)              |
| `locationHint`         | string  | No       | Region hint (default: `wnam`)                     |
| `sslMonitoringEnabled` | boolean | No       | Enable SSL monitoring                             |
| `sslExpiryWarningDays` | integer | No       | SSL warning threshold 1-365 days                  |

**Supported HTTP methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`

**Location hints:** `wnam` (Western North America), `enam` (Eastern North America), `sam` (South America), `weur` (Western Europe), `eeur` (Eastern Europe), `apac` (Asia-Pacific), `oc` (Oceania), `afr` (Africa), `me` (Middle East)

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API",
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatus": 200,
    "intervalSeconds": 60,
    "degradedAfterMs": 3000,
    "sslMonitoringEnabled": true,
    "sslExpiryWarningDays": 30
  }'
```

### Response

```json
{
	"data": {
		"id": "mon_abc123",
		"name": "Production API",
		"url": "https://api.example.com/health",
		"method": "GET",
		"expectedStatus": 200,
		"intervalSeconds": 60,
		"degradedAfterMs": 3000,
		"timeoutSeconds": 10,
		"locationHint": "wnam",
		"sslMonitoringEnabled": true,
		"sslExpiryWarningDays": 30,
		"status": "pending",
		"lastCheckedAt": null,
		"createdAt": "2026-02-14T12:00:00Z",
		"updatedAt": "2026-02-14T12:00:00Z"
	}
}
```

### Errors

| Status | Code             | Description                            |
| ------ | ---------------- | -------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body                   |
| 400    | LIMIT_EXCEEDED   | Maximum monitors reached for your plan |
| 401    | UNAUTHORIZED     | Missing or invalid API key             |
| 403    | FORBIDDEN        | API key doesn't have `monitors:write`  |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Monitor display name"
		},
		"url": { "type": "string", "format": "uri", "description": "URL to monitor" },
		"method": {
			"type": "string",
			"enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
			"default": "HEAD",
			"description": "HTTP method"
		},
		"expectedStatus": {
			"type": "integer",
			"minimum": 100,
			"maximum": 599,
			"default": 200,
			"description": "Expected HTTP status code"
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 60,
			"maximum": 3600,
			"default": 60,
			"description": "Check interval in seconds"
		},
		"degradedAfterMs": {
			"type": "integer",
			"minimum": 1000,
			"maximum": 30000,
			"default": 5000,
			"description": "Response time threshold for degraded status"
		},
		"timeoutSeconds": {
			"type": "integer",
			"minimum": 1,
			"maximum": 60,
			"default": 10,
			"description": "Request timeout in seconds"
		},
		"locationHint": {
			"type": "string",
			"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"],
			"default": "wnam",
			"description": "Preferred check region"
		},
		"sslMonitoringEnabled": {
			"type": "boolean",
			"description": "Enable SSL certificate monitoring"
		},
		"sslExpiryWarningDays": {
			"type": "integer",
			"minimum": 1,
			"maximum": 365,
			"description": "Days before SSL expiry to warn"
		}
	},
	"required": ["name", "url"]
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"id": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 255 },
				"url": { "type": "string", "format": "uri" },
				"method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
				"expectedStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
				"intervalSeconds": { "type": "integer", "minimum": 60, "maximum": 3600 },
				"degradedAfterMs": { "type": "integer", "minimum": 1000, "maximum": 30000 },
				"timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 60 },
				"locationHint": {
					"type": "string",
					"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]
				},
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"status": { "type": "string", "enum": ["pending", "up", "degraded", "down"] },
				"lastCheckedAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			},
			"required": [
				"id",
				"name",
				"url",
				"method",
				"expectedStatus",
				"intervalSeconds",
				"degradedAfterMs",
				"timeoutSeconds",
				"locationHint",
				"status",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Get Monitor

Retrieve a single HTTP monitor by ID.

```
GET /api/v1/monitors/:id
```

**Required scope:** `monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"id": "mon_abc123",
		"name": "Production API",
		"url": "https://api.example.com/health",
		"method": "GET",
		"expectedStatus": 200,
		"intervalSeconds": 60,
		"degradedAfterMs": 5000,
		"timeoutSeconds": 10,
		"locationHint": "wnam",
		"sslMonitoringEnabled": true,
		"sslExpiryWarningDays": 30,
		"status": "up",
		"lastCheckedAt": "2026-02-14T12:00:00Z",
		"createdAt": "2026-01-01T00:00:00Z",
		"updatedAt": "2026-01-15T10:30:00Z"
	}
}
```

### Errors

| Status | Code         | Description                          |
| ------ | ------------ | ------------------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid API key           |
| 403    | FORBIDDEN    | API key doesn't have `monitors:read` |
| 404    | NOT_FOUND    | Monitor not found                    |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"id": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 255 },
				"url": { "type": "string", "format": "uri" },
				"method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
				"expectedStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
				"intervalSeconds": { "type": "integer", "minimum": 60, "maximum": 3600 },
				"degradedAfterMs": { "type": "integer", "minimum": 1000, "maximum": 30000 },
				"timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 60 },
				"locationHint": {
					"type": "string",
					"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]
				},
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"status": { "type": "string", "enum": ["pending", "up", "degraded", "down"] },
				"lastCheckedAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			},
			"required": [
				"id",
				"name",
				"url",
				"method",
				"expectedStatus",
				"intervalSeconds",
				"degradedAfterMs",
				"timeoutSeconds",
				"locationHint",
				"status",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Update Monitor

Update an existing HTTP monitor.

```
PUT /api/v1/monitors/:id
```

**Required scope:** `monitors:write`

### Request Body

All fields from [Create Monitor](#create-monitor) are accepted. Only include fields you want to change.

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -X PUT \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API v2",
    "intervalSeconds": 120
  }'
```

### Response

```json
{
	"data": {
		"id": "mon_abc123",
		"name": "Production API v2",
		"url": "https://api.example.com/health",
		"method": "GET",
		"expectedStatus": 200,
		"intervalSeconds": 120,
		"degradedAfterMs": 5000,
		"timeoutSeconds": 10,
		"locationHint": "wnam",
		"sslMonitoringEnabled": true,
		"sslExpiryWarningDays": 30,
		"status": "up",
		"lastCheckedAt": "2026-02-14T12:00:00Z",
		"createdAt": "2026-01-01T00:00:00Z",
		"updatedAt": "2026-02-14T12:30:00Z"
	}
}
```

### Errors

| Status | Code             | Description                           |
| ------ | ---------------- | ------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body                  |
| 401    | UNAUTHORIZED     | Missing or invalid API key            |
| 403    | FORBIDDEN        | API key doesn't have `monitors:write` |
| 404    | NOT_FOUND        | Monitor not found                     |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Monitor display name"
		},
		"url": { "type": "string", "format": "uri", "description": "URL to monitor" },
		"method": {
			"type": "string",
			"enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
			"description": "HTTP method"
		},
		"expectedStatus": {
			"type": "integer",
			"minimum": 100,
			"maximum": 599,
			"description": "Expected HTTP status code"
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 60,
			"maximum": 3600,
			"description": "Check interval in seconds"
		},
		"degradedAfterMs": {
			"type": "integer",
			"minimum": 1000,
			"maximum": 30000,
			"description": "Response time threshold for degraded status"
		},
		"timeoutSeconds": {
			"type": "integer",
			"minimum": 1,
			"maximum": 60,
			"description": "Request timeout in seconds"
		},
		"locationHint": {
			"type": "string",
			"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"],
			"description": "Preferred check region"
		},
		"sslMonitoringEnabled": {
			"type": "boolean",
			"description": "Enable SSL certificate monitoring"
		},
		"sslExpiryWarningDays": {
			"type": "integer",
			"minimum": 1,
			"maximum": 365,
			"description": "Days before SSL expiry to warn"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"id": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 255 },
				"url": { "type": "string", "format": "uri" },
				"method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
				"expectedStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
				"intervalSeconds": { "type": "integer", "minimum": 60, "maximum": 3600 },
				"degradedAfterMs": { "type": "integer", "minimum": 1000, "maximum": 30000 },
				"timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 60 },
				"locationHint": {
					"type": "string",
					"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]
				},
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"status": { "type": "string", "enum": ["pending", "up", "degraded", "down"] },
				"lastCheckedAt": { "type": ["string", "null"], "format": "date-time" },
				"createdAt": { "type": "string", "format": "date-time" },
				"updatedAt": { "type": "string", "format": "date-time" }
			},
			"required": [
				"id",
				"name",
				"url",
				"method",
				"expectedStatus",
				"intervalSeconds",
				"degradedAfterMs",
				"timeoutSeconds",
				"locationHint",
				"status",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Delete Monitor

Permanently delete an HTTP monitor and all its check history.

```
DELETE /api/v1/monitors/:id
```

**Required scope:** `monitors:write`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `204 No Content` on success.

### Errors

| Status | Code         | Description                           |
| ------ | ------------ | ------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key            |
| 403    | FORBIDDEN    | API key doesn't have `monitors:write` |
| 404    | NOT_FOUND    | Monitor not found                     |

### Response Schema

Returns `204 No Content` with an empty body on success.

## Get Check Results

Retrieve the check history for a monitor.

```
GET /api/v1/monitors/:id/results
```

**Required scope:** `monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                            |
| --------- | ------- | -------- | -------------------------------------- |
| `limit`   | integer | No       | Results to return, 1-100 (default: 20) |
| `offset`  | integer | No       | Results to skip (default: 0)           |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?limit=10&offset=0" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": [
		{
			"id": "chk_xyz789",
			"monitorId": "mon_abc123",
			"status": "up",
			"statusCode": 200,
			"responseTimeMs": 245,
			"region": "wnam",
			"checkedAt": "2026-02-14T12:00:00Z"
		},
		{
			"id": "chk_xyz788",
			"monitorId": "mon_abc123",
			"status": "degraded",
			"statusCode": 200,
			"responseTimeMs": 5200,
			"region": "wnam",
			"checkedAt": "2026-02-14T11:59:00Z"
		}
	],
	"pagination": {
		"limit": 10,
		"offset": 0,
		"total": 1440
	}
}
```

### Errors

| Status | Code             | Description                          |
| ------ | ---------------- | ------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid query parameters             |
| 401    | UNAUTHORIZED     | Missing or invalid API key           |
| 403    | FORBIDDEN        | API key doesn't have `monitors:read` |
| 404    | NOT_FOUND        | Monitor not found                    |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"id": { "type": "string", "pattern": "^chk_[a-zA-Z0-9]+$" },
					"monitorId": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
					"status": { "type": "string", "enum": ["up", "degraded", "down"] },
					"statusCode": { "type": "integer" },
					"responseTimeMs": { "type": "integer" },
					"region": { "type": "string" },
					"checkedAt": { "type": "string", "format": "date-time" }
				},
				"required": [
					"id",
					"monitorId",
					"status",
					"statusCode",
					"responseTimeMs",
					"region",
					"checkedAt"
				]
			}
		},
		"pagination": {
			"type": "object",
			"properties": {
				"limit": { "type": "integer" },
				"offset": { "type": "integer" },
				"total": { "type": "integer" }
			},
			"required": ["limit", "offset", "total"]
		}
	},
	"required": ["data", "pagination"]
}
```

## Get Monitor Stats

Retrieve performance statistics for a single monitor.

```
GET /api/v1/monitors/:id/stats
```

**Required scope:** `monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/stats \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitorId": "mon_abc123",
		"uptime": {
			"last24Hours": 99.95,
			"last7Days": 99.87,
			"last30Days": 99.92
		},
		"responseTime": {
			"avg": 245,
			"min": 120,
			"max": 890,
			"p50": 230,
			"p95": 450,
			"p99": 780
		},
		"checks": {
			"total": 43200,
			"up": 43180,
			"degraded": 15,
			"down": 5
		}
	}
}
```

### Errors

| Status | Code         | Description                          |
| ------ | ------------ | ------------------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid API key           |
| 403    | FORBIDDEN    | API key doesn't have `monitors:read` |
| 404    | NOT_FOUND    | Monitor not found                    |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"monitorId": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
				"uptime": {
					"type": "object",
					"properties": {
						"last24Hours": { "type": "number", "minimum": 0, "maximum": 100 },
						"last7Days": { "type": "number", "minimum": 0, "maximum": 100 },
						"last30Days": { "type": "number", "minimum": 0, "maximum": 100 }
					},
					"required": ["last24Hours", "last7Days", "last30Days"]
				},
				"responseTime": {
					"type": "object",
					"properties": {
						"avg": { "type": "integer" },
						"min": { "type": "integer" },
						"max": { "type": "integer" },
						"p50": { "type": "integer" },
						"p95": { "type": "integer" },
						"p99": { "type": "integer" }
					},
					"required": ["avg", "min", "max", "p50", "p95", "p99"]
				},
				"checks": {
					"type": "object",
					"properties": {
						"total": { "type": "integer" },
						"up": { "type": "integer" },
						"degraded": { "type": "integer" },
						"down": { "type": "integer" }
					},
					"required": ["total", "up", "degraded", "down"]
				}
			},
			"required": ["monitorId", "uptime", "responseTime", "checks"]
		}
	},
	"required": ["data"]
}
```

## Get Aggregated Stats

Retrieve aggregated statistics across all monitors.

```
GET /api/v1/monitors/stats
```

**Required scope:** `monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/monitors/stats \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitors": {
			"total": 15,
			"up": 12,
			"degraded": 2,
			"down": 1
		},
		"uptime": {
			"last24Hours": 98.5,
			"last7Days": 99.1,
			"last30Days": 99.3
		},
		"checks": {
			"last24Hours": 21600,
			"last7Days": 151200,
			"last30Days": 648000
		}
	}
}
```

### Errors

| Status | Code         | Description                          |
| ------ | ------------ | ------------------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid API key           |
| 403    | FORBIDDEN    | API key doesn't have `monitors:read` |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"monitors": {
					"type": "object",
					"properties": {
						"total": { "type": "integer" },
						"up": { "type": "integer" },
						"degraded": { "type": "integer" },
						"down": { "type": "integer" }
					},
					"required": ["total", "up", "degraded", "down"]
				},
				"uptime": {
					"type": "object",
					"properties": {
						"last24Hours": { "type": "number", "minimum": 0, "maximum": 100 },
						"last7Days": { "type": "number", "minimum": 0, "maximum": 100 },
						"last30Days": { "type": "number", "minimum": 0, "maximum": 100 }
					},
					"required": ["last24Hours", "last7Days", "last30Days"]
				},
				"checks": {
					"type": "object",
					"properties": {
						"last24Hours": { "type": "integer" },
						"last7Days": { "type": "integer" },
						"last30Days": { "type": "integer" }
					},
					"required": ["last24Hours", "last7Days", "last30Days"]
				}
			},
			"required": ["monitors", "uptime", "checks"]
		}
	},
	"required": ["data"]
}
```

## Content Checks

Manage content validation rules for a monitor. Content checks verify that responses contain (or don't contain) specific text or patterns.

### Create Content Check

```
POST /api/v1/monitors/:id/content-checks
```

**Required scope:** `monitors:write`

### Request Body

| Field           | Type    | Required | Description                                     |
| --------------- | ------- | -------- | ----------------------------------------------- |
| `type`          | string  | Yes      | Check type: `contains`, `not_contains`, `regex` |
| `value`         | string  | Yes      | Text or pattern to match                        |
| `caseSensitive` | boolean | No       | Enable case-sensitive matching (default: false) |

### Delete Content Check

```
DELETE /api/v1/monitors/:id/content-checks/:checkId
```

**Required scope:** `monitors:write`

See [Content Checks](/docs/concepts/http-monitors#content-checks) for usage details.

### Create Content Check Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"type": {
			"type": "string",
			"enum": ["contains", "not_contains", "regex"],
			"description": "Check type"
		},
		"value": { "type": "string", "description": "Text or pattern to match" },
		"caseSensitive": {
			"type": "boolean",
			"default": false,
			"description": "Enable case-sensitive matching"
		}
	},
	"required": ["type", "value"]
}
```

### Delete Content Check Response Schema

Returns `204 No Content` with an empty body on success.
