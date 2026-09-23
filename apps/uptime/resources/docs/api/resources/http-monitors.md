---
title: HTTP Monitors
description: Create, update, delete, and query HTTP monitors. Get check results and performance statistics.
section:
  title: API Resources
  order: 5
order: 2
lastUpdated: 2026-09-05
---

HTTP monitors check your websites and APIs for availability, performance, and content validity.

## List Monitors

Retrieve all HTTP monitors for your team.

Monitors arrive a page at a time. See [Pagination](/docs/api/pagination) for how to walk the whole list.

```
GET /api/v1/monitors
```

**Required scope:** `monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"monitors": [
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
				"enabledAt": 1767225600000,
				"sslMonitoringEnabled": true,
				"sslExpiryWarningDays": 30,
				"sslExpiresAt": 1773748800000,
				"sslIssuer": "Let's Encrypt",
				"sslStatus": "valid",
				"sslLastCheckedAt": 1771070400000,
				"createdAt": 1767225600000,
				"updatedAt": 1768473000000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 50,
			"total": 128
		}
	}
}
```

### Errors

| Status | Type           | Description                                             |
| ------ | -------------- | ------------------------------------------------------- |
| 400    | `bad-request`  | Invalid or malformed cursor, or `perPage` outside 1-200 |
| 401    | `unauthorized` | Missing or invalid API key                              |
| 403    | `forbidden`    | API key doesn't have `monitors:read`                    |
| 500    | `internal`     | A page of results could not be read                     |

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
					"type": "array",
					"items": { "$ref": "#/$defs/Monitor" }
				}
			},
			"required": ["monitors"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" },
				"pagination": {
					"type": "object",
					"properties": {
						"next": { "type": ["string", "null"] },
						"prev": { "type": ["string", "null"] },
						"perPage": { "type": "integer" },
						"total": { "type": "integer" }
					},
					"required": ["next", "prev", "perPage"]
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"],
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
				"enabledAt": { "type": ["integer", "null"] },
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"sslExpiresAt": { "type": ["integer", "null"] },
				"sslIssuer": { "type": ["string", "null"] },
				"sslStatus": {
					"type": ["string", "null"],
					"enum": ["unknown", "valid", "expiring", "expired", "error", null]
				},
				"sslLastCheckedAt": { "type": ["integer", "null"] },
				"createdAt": { "type": "integer" },
				"updatedAt": { "type": "integer" }
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
				"enabledAt",
				"sslMonitoringEnabled",
				"sslExpiryWarningDays",
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
| `sslMonitoringEnabled` | boolean | No       | Enable SSL monitoring (default: `false`)          |
| `sslExpiryWarningDays` | integer | No       | SSL warning threshold 1-365 days (default: `30`)  |

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

Returns `201 Created` on success.

```json
{
	"data": {
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 60,
			"degradedAfterMs": 3000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1771070400000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": null,
			"sslIssuer": null,
			"sslStatus": "unknown",
			"sslLastCheckedAt": null,
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

### Errors

| Status | Type               | Description                           |
| ------ | ------------------ | ------------------------------------- |
| 400    | `validation-error` | Invalid request body                  |
| 401    | `unauthorized`     | Missing or invalid API key            |
| 403    | `forbidden`        | API key doesn't have `monitors:write` |

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
			"default": false,
			"description": "Enable SSL certificate monitoring"
		},
		"sslExpiryWarningDays": {
			"type": "integer",
			"minimum": 1,
			"maximum": 365,
			"default": 30,
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
				"monitor": { "$ref": "#/$defs/Monitor" }
			},
			"required": ["monitor"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"],
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
				"enabledAt": { "type": ["integer", "null"] },
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"sslExpiresAt": { "type": ["integer", "null"] },
				"sslIssuer": { "type": ["string", "null"] },
				"sslStatus": {
					"type": ["string", "null"],
					"enum": ["unknown", "valid", "expiring", "expired", "error", null]
				},
				"sslLastCheckedAt": { "type": ["integer", "null"] },
				"createdAt": { "type": "integer" },
				"updatedAt": { "type": "integer" }
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
				"enabledAt",
				"sslMonitoringEnabled",
				"sslExpiryWarningDays",
				"createdAt",
				"updatedAt"
			]
		}
	}
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
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 60,
			"degradedAfterMs": 5000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1767225600000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": 1773748800000,
			"sslIssuer": "Let's Encrypt",
			"sslStatus": "valid",
			"sslLastCheckedAt": 1771070400000,
			"createdAt": 1767225600000,
			"updatedAt": 1768473000000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Errors

| Status | Type               | Description                          |
| ------ | ------------------ | ------------------------------------ |
| 400    | `validation-error` | Malformed monitor id                 |
| 401    | `unauthorized`     | Missing or invalid API key           |
| 403    | `forbidden`        | API key doesn't have `monitors:read` |
| 404    | `not-found`        | Monitor not found                    |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"monitor": { "$ref": "#/$defs/Monitor" }
			},
			"required": ["monitor"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"],
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
				"enabledAt": { "type": ["integer", "null"] },
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"sslExpiresAt": { "type": ["integer", "null"] },
				"sslIssuer": { "type": ["string", "null"] },
				"sslStatus": {
					"type": ["string", "null"],
					"enum": ["unknown", "valid", "expiring", "expired", "error", null]
				},
				"sslLastCheckedAt": { "type": ["integer", "null"] },
				"createdAt": { "type": "integer" },
				"updatedAt": { "type": "integer" }
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
				"enabledAt",
				"sslMonitoringEnabled",
				"sslExpiryWarningDays",
				"createdAt",
				"updatedAt"
			]
		}
	}
}
```

## Update Monitor

Update an existing HTTP monitor.

```
PUT /api/v1/monitors/:id
```

**Required scope:** `monitors:write`

### Request Body

All fields from [Create Monitor](#create-monitor) are accepted, plus `enabled`. Only include fields you want to change.

| Field     | Type    | Required | Description                                                                          |
| --------- | ------- | -------- | ------------------------------------------------------------------------------------ |
| `enabled` | boolean | No       | `true` resumes checks and sets `enabledAt` to now; `false` pauses them and clears it |

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
		"monitor": {
			"id": "mon_abc123",
			"name": "Production API v2",
			"url": "https://api.example.com/health",
			"method": "GET",
			"expectedStatus": 200,
			"intervalSeconds": 120,
			"degradedAfterMs": 5000,
			"timeoutSeconds": 10,
			"locationHint": "wnam",
			"enabledAt": 1767225600000,
			"sslMonitoringEnabled": true,
			"sslExpiryWarningDays": 30,
			"sslExpiresAt": 1773748800000,
			"sslIssuer": "Let's Encrypt",
			"sslStatus": "valid",
			"sslLastCheckedAt": 1771070400000,
			"createdAt": 1767225600000,
			"updatedAt": 1771072200000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Errors

| Status | Type               | Description                           |
| ------ | ------------------ | ------------------------------------- |
| 400    | `validation-error` | Malformed monitor id                  |
| 400    | `validation-error` | Invalid request body                  |
| 401    | `unauthorized`     | Missing or invalid API key            |
| 403    | `forbidden`        | API key doesn't have `monitors:write` |
| 404    | `not-found`        | Monitor not found                     |

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
		"enabled": {
			"type": "boolean",
			"description": "Resume (true) or pause (false) checks"
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
				"monitor": { "$ref": "#/$defs/Monitor" }
			},
			"required": ["monitor"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"],
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
				"enabledAt": { "type": ["integer", "null"] },
				"sslMonitoringEnabled": { "type": "boolean" },
				"sslExpiryWarningDays": { "type": "integer", "minimum": 1, "maximum": 365 },
				"sslExpiresAt": { "type": ["integer", "null"] },
				"sslIssuer": { "type": ["string", "null"] },
				"sslStatus": {
					"type": ["string", "null"],
					"enum": ["unknown", "valid", "expiring", "expired", "error", null]
				},
				"sslLastCheckedAt": { "type": ["integer", "null"] },
				"createdAt": { "type": "integer" },
				"updatedAt": { "type": "integer" }
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
				"enabledAt",
				"sslMonitoringEnabled",
				"sslExpiryWarningDays",
				"createdAt",
				"updatedAt"
			]
		}
	}
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

Returns `200 OK` on success.

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

### Errors

| Status | Type               | Description                           |
| ------ | ------------------ | ------------------------------------- |
| 400    | `validation-error` | Malformed monitor id                  |
| 401    | `unauthorized`     | Missing or invalid API key            |
| 403    | `forbidden`        | API key doesn't have `monitors:write` |
| 404    | `not-found`        | Monitor not found                     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"deleted": { "const": true }
			},
			"required": ["deleted"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Get Check Results

Retrieve the check history for a monitor.

A check result's `id` pairs the monitor it belongs to with the minute the check was
scheduled for, which is what makes each scheduled check appear once. Treat it as an
opaque string.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page back
through the history.

```
GET /api/v1/monitors/:id/results
```

**Required scope:** `monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"results": [
			{
				"id": "8e03978e-40d5-43e8-bc93-6894a57f9324:29387451",
				"responseStatus": 200,
				"responseTimeMs": 245,
				"completedAt": 1771070400000,
				"createdAt": 1771070400000
			},
			{
				"id": "8e03978e-40d5-43e8-bc93-6894a57f9324:29387450",
				"responseStatus": 200,
				"responseTimeMs": 5200,
				"completedAt": 1771070340000,
				"createdAt": 1771070340000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 100
		}
	}
}
```

### Errors

| Status | Type               | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| 400    | `bad-request`      | Invalid or malformed cursor, or `perPage` outside 1-200 |
| 400    | `validation-error` | Malformed monitor id                                    |
| 401    | `unauthorized`     | Missing or invalid API key                              |
| 403    | `forbidden`        | API key doesn't have `monitors:read`                    |
| 404    | `not-found`        | Monitor not found                                       |
| 500    | `internal`         | A page of results could not be read                     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"results": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"id": { "type": "string", "pattern": "^[0-9a-f-]{36}:[0-9]+$" },
							"responseStatus": { "type": ["integer", "null"] },
							"responseTimeMs": { "type": ["integer", "null"] },
							"completedAt": { "type": ["integer", "null"] },
							"createdAt": { "type": "integer" }
						},
						"required": ["id", "responseStatus", "responseTimeMs", "completedAt", "createdAt"]
					}
				}
			},
			"required": ["results"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" },
				"pagination": {
					"type": "object",
					"properties": {
						"next": { "type": ["string", "null"] },
						"prev": { "type": ["string", "null"] },
						"perPage": { "type": "integer" }
					},
					"required": ["next", "prev", "perPage"]
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Get Alert Events

Retrieve the alert delivery history for a monitor.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page back
through the history.

```
GET /api/v1/monitors/:id/alert-events
```

**Required scope:** `alerts:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/alert-events?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"events": [
			{
				"id": "evt_01h455vb4pex5vsknk084sn02q",
				"alertId": "alt_01h455vb4pex5vsknk084sn031",
				"monitorId": "mon_abc123",
				"eventType": "down",
				"status": "sent",
				"sentAt": 1771070400000,
				"errorMessage": null,
				"createdAt": 1771070400000
			},
			{
				"id": "evt_01h455vb4pex5vsknk084sn02p",
				"alertId": "alt_01h455vb4pex5vsknk084sn031",
				"monitorId": "mon_abc123",
				"eventType": "up",
				"status": "skipped_cooldown",
				"sentAt": 1771066800000,
				"errorMessage": null,
				"createdAt": 1771066800000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 50
		}
	}
}
```

**Event types:** `down`, `up`, `degraded`

**Delivery statuses:** `sent`, `skipped_cooldown`, `skipped_cap`, `failed`

### Errors

| Status | Type               | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| 400    | `bad-request`      | Invalid or malformed cursor, or `perPage` outside 1-200 |
| 400    | `validation-error` | Malformed monitor id                                    |
| 401    | `unauthorized`     | Missing or invalid API key                              |
| 403    | `forbidden`        | API key doesn't have `alerts:read`                      |
| 404    | `not-found`        | Monitor not found                                       |
| 500    | `internal`         | A page of results could not be read                     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"events": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"id": { "type": "string", "pattern": "^evt_[a-zA-Z0-9]+$" },
							"alertId": { "type": "string", "pattern": "^alt_[a-zA-Z0-9]+$" },
							"monitorId": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
							"eventType": { "type": "string", "enum": ["down", "up", "degraded"] },
							"status": {
								"type": "string",
								"enum": ["sent", "skipped_cooldown", "skipped_cap", "failed"]
							},
							"sentAt": { "type": "integer" },
							"errorMessage": { "type": ["string", "null"] },
							"createdAt": { "type": "integer" }
						},
						"required": [
							"id",
							"alertId",
							"monitorId",
							"eventType",
							"status",
							"sentAt",
							"errorMessage",
							"createdAt"
						]
					}
				}
			},
			"required": ["events"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" },
				"pagination": {
					"type": "object",
					"properties": {
						"next": { "type": ["string", "null"] },
						"prev": { "type": ["string", "null"] },
						"perPage": { "type": "integer" }
					},
					"required": ["next", "prev", "perPage"]
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
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
		"stats": {
			"total": 43200,
			"uptime": 99.95,
			"lastCheck": 1771070400000,
			"p99": 780
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

`total` counts completed checks. `uptime` is the percentage of those checks that answered the monitor's expected status, and `lastCheck` is when the most recent one completed (epoch milliseconds); both are `null` until a check completes. `p99` is the 99th-percentile response time in milliseconds over the last 24 hours, `null` when that window holds no checks.

### Errors

| Status | Type               | Description                          |
| ------ | ------------------ | ------------------------------------ |
| 400    | `validation-error` | Malformed monitor id                 |
| 401    | `unauthorized`     | Missing or invalid API key           |
| 403    | `forbidden`        | API key doesn't have `monitors:read` |
| 404    | `not-found`        | Monitor not found                    |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"stats": {
					"type": "object",
					"properties": {
						"total": { "type": "integer" },
						"uptime": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
						"lastCheck": { "type": ["integer", "null"] },
						"p99": { "type": ["number", "null"] }
					},
					"required": ["total", "uptime", "lastCheck", "p99"]
				}
			},
			"required": ["stats"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
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
		"stats": {
			"total": 648000,
			"uptime": 99.3,
			"lastCheck": 1771070400000,
			"p99": 780
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

`total` counts completed checks across every monitor on the team. `uptime` is the percentage of those checks that answered the monitor's expected status, and `lastCheck` is when the most recent one completed (epoch milliseconds); both are `null` until a check completes. `p99` is the 99th-percentile response time in milliseconds over the last 24 hours, `null` when that window holds no checks.

### Errors

| Status | Type           | Description                          |
| ------ | -------------- | ------------------------------------ |
| 401    | `unauthorized` | Missing or invalid API key           |
| 403    | `forbidden`    | API key doesn't have `monitors:read` |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"stats": {
					"type": "object",
					"properties": {
						"total": { "type": "integer" },
						"uptime": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
						"lastCheck": { "type": ["integer", "null"] },
						"p99": { "type": ["number", "null"] }
					},
					"required": ["total", "uptime", "lastCheck", "p99"]
				}
			},
			"required": ["stats"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Backfill Daily Stats

Enqueue a daily-stats aggregation job for your team's monitors.

The job runs in the background, so the response confirms that it was queued rather than
that it has finished.

```
POST /api/v1/backfill-daily-stats
```

**Required scope:** `monitors:write`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/backfill-daily-stats \
  -X POST \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `202 Accepted` on success.

```json
{
	"data": {
		"status": "queued"
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Errors

| Status | Type           | Description                           |
| ------ | -------------- | ------------------------------------- |
| 401    | `unauthorized` | Missing or invalid API key            |
| 403    | `forbidden`    | API key doesn't have `monitors:write` |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"status": { "type": "string", "enum": ["queued"] }
			},
			"required": ["status"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Content Checks

Manage content validation rules for a monitor. Content checks verify that responses contain (or don't contain) specific text or patterns.

### List Content Checks

Retrieve the content checks configured on a monitor.

Content checks arrive a page at a time. See [Pagination](/docs/api/pagination) for how to
walk the whole list.

```
GET /api/v1/monitors/:id/content-checks
```

**Required scope:** `monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/content-checks?perPage=50" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"contentChecks": [
			{
				"id": "chk_01h455vb4pex5vsknk084sn02q",
				"monitorId": "mon_abc123",
				"type": "contains",
				"value": "\"status\":\"ok\"",
				"caseSensitive": false,
				"isEnabled": true,
				"createdAt": 1767225600000,
				"updatedAt": 1768473000000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": null,
			"prev": null,
			"perPage": 50,
			"total": 1
		}
	}
}
```

### Errors

| Status | Type               | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| 400    | `bad-request`      | Invalid or malformed cursor, or `perPage` outside 1-200 |
| 400    | `validation-error` | Malformed monitor id                                    |
| 401    | `unauthorized`     | Missing or invalid API key                              |
| 403    | `forbidden`        | API key doesn't have `monitors:read`                    |
| 404    | `not-found`        | Monitor not found                                       |
| 500    | `internal`         | A page of results could not be read                     |

### Create Content Check

```
POST /api/v1/monitors/:id/content-checks
```

**Required scope:** `monitors:write`

### Request Body

| Field           | Type    | Required | Description                                                                |
| --------------- | ------- | -------- | -------------------------------------------------------------------------- |
| `type`          | string  | Yes      | Check type: `contains`, `not_contains`, `regex`                            |
| `value`         | string  | Yes      | Text or pattern to match (at least 1 character; a valid regex for `regex`) |
| `caseSensitive` | boolean | No       | Enable case-sensitive matching (default: false)                            |
| `isEnabled`     | boolean | No       | Whether the check runs (default: true)                                     |

### Response

Returns `201 Created` on success.

```json
{
	"data": {
		"contentCheck": {
			"id": "chk_01h455vb4pex5vsknk084sn02q",
			"monitorId": "mon_abc123",
			"type": "contains",
			"value": "\"status\":\"ok\"",
			"caseSensitive": false,
			"isEnabled": true,
			"createdAt": 1767225600000,
			"updatedAt": 1767225600000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Errors

| Status | Type               | Description                                                        |
| ------ | ------------------ | ------------------------------------------------------------------ |
| 400    | `validation-error` | Invalid request body, or an invalid regular expression for `regex` |
| 400    | `validation-error` | Malformed monitor id                                               |
| 401    | `unauthorized`     | Missing or invalid API key                                         |
| 403    | `forbidden`        | API key doesn't have `monitors:write`                              |
| 404    | `not-found`        | Monitor not found                                                  |

### Delete Content Check

```
DELETE /api/v1/monitors/:id/content-checks/:contentCheckId
```

**Required scope:** `monitors:write`

### Response

Returns `200 OK` on success.

```json
{
	"data": {
		"success": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Errors

| Status | Type               | Description                             |
| ------ | ------------------ | --------------------------------------- |
| 400    | `validation-error` | Malformed monitor or content check id   |
| 401    | `unauthorized`     | Missing or invalid API key              |
| 403    | `forbidden`        | API key doesn't have `monitors:write`   |
| 404    | `not-found`        | Monitor not found                       |
| 404    | `not-found`        | Content check not found on this monitor |

See [Content Checks](/docs/concepts/http-monitors#content-checks) for usage details.

### List Content Checks Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"contentChecks": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"id": { "type": "string", "pattern": "^chk_[a-zA-Z0-9]+$" },
							"monitorId": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
							"type": { "type": "string", "enum": ["contains", "not_contains", "regex"] },
							"value": { "type": "string" },
							"caseSensitive": { "type": "boolean" },
							"isEnabled": { "type": "boolean" },
							"createdAt": { "type": "integer" },
							"updatedAt": { "type": "integer" }
						},
						"required": [
							"id",
							"monitorId",
							"type",
							"value",
							"caseSensitive",
							"isEnabled",
							"createdAt",
							"updatedAt"
						]
					}
				}
			},
			"required": ["contentChecks"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" },
				"pagination": {
					"type": "object",
					"properties": {
						"next": { "type": ["string", "null"] },
						"prev": { "type": ["string", "null"] },
						"perPage": { "type": "integer" },
						"total": { "type": "integer" }
					},
					"required": ["next", "prev", "perPage"]
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

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
		"value": {
			"type": "string",
			"minLength": 1,
			"description": "Text or pattern to match; a valid regular expression when type is regex"
		},
		"caseSensitive": {
			"type": "boolean",
			"default": false,
			"description": "Enable case-sensitive matching"
		},
		"isEnabled": {
			"type": "boolean",
			"default": true,
			"description": "Whether the check runs"
		}
	},
	"required": ["type", "value"]
}
```

### Create Content Check Response Schema

The body is `{ "data": { "contentCheck": ContentCheck }, "meta": { requestId, timestamp } }`, where `ContentCheck` is the item shape from the [List Content Checks Response Schema](#list-content-checks-response-schema).

### Delete Content Check Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"success": { "const": true }
			},
			"required": ["success"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```
