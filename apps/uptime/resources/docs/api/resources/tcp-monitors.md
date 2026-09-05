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

**Required scope:** `tcp-monitors:read`

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

### Errors

| Status | Code         | Description                               |
| ------ | ------------ | ----------------------------------------- |
| 400    | BAD_REQUEST  | Invalid or malformed cursor               |
| 401    | UNAUTHORIZED | Missing or invalid API key                |
| 403    | FORBIDDEN    | API key missing `tcp-monitors:read` scope |

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
					"items": {
						"type": "object",
						"properties": {
							"id": {
								"type": "string",
								"description": "Unique identifier",
								"pattern": "^tcpm_[a-zA-Z0-9]+$"
							},
							"name": {
								"type": "string",
								"description": "Monitor name",
								"minLength": 1,
								"maxLength": 255
							},
							"host": {
								"type": "string",
								"description": "Hostname or IP address",
								"minLength": 1,
								"maxLength": 255
							},
							"port": {
								"type": "integer",
								"description": "TCP port number",
								"minimum": 1,
								"maximum": 65535
							},
							"timeoutMs": {
								"type": "integer",
								"description": "Connection timeout in milliseconds",
								"minimum": 100,
								"maximum": 60000,
								"default": 5000
							},
							"intervalSeconds": {
								"type": "integer",
								"description": "Check interval in seconds",
								"minimum": 10,
								"maximum": 86400,
								"default": 60
							},
							"isEnabled": {
								"type": "boolean",
								"description": "Whether the monitor is active",
								"default": true
							},
							"lastCheckedAt": {
								"type": ["integer", "null"],
								"description": "When the last check ran, in milliseconds since the epoch"
							},
							"lastStatus": {
								"type": ["string", "null"],
								"enum": ["up", "down", "timeout", null],
								"description": "Status from the last check"
							},
							"lastResponseTimeMs": {
								"type": ["integer", "null"],
								"description": "Response time from the last check in milliseconds"
							},
							"createdAt": {
								"type": "integer",
								"description": "When the monitor was created, in milliseconds since the epoch"
							},
							"updatedAt": {
								"type": "integer",
								"description": "When the monitor was last updated, in milliseconds since the epoch"
							}
						},
						"required": [
							"id",
							"name",
							"host",
							"port",
							"timeoutMs",
							"intervalSeconds",
							"isEnabled",
							"createdAt",
							"updatedAt"
						]
					}
				}
			},
			"required": ["monitors"]
		}
	},
	"required": ["data"]
}
```

## Create a TCP Monitor

Create a new TCP monitor to check port connectivity.

```
POST /api/v1/tcp-monitors
```

**Required scope:** `tcp-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                                   |
| ----------------- | ------- | -------- | ------------------------------------------------------------- |
| `name`            | string  | Yes      | Monitor name (1-255 characters)                               |
| `host`            | string  | Yes      | Hostname or IP address (1-255 characters)                     |
| `port`            | integer | Yes      | TCP port number (1-65535)                                     |
| `timeoutMs`       | integer | No       | Connection timeout in milliseconds (100-60000, default: 5000) |
| `intervalSeconds` | integer | No       | Check interval in seconds (10-86400, default: 60)             |
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
		"createdAt": "2026-02-14T12:00:00Z",
		"updatedAt": "2026-02-14T12:00:00Z"
	}
}
```

### Errors

| Status | Code             | Description                                |
| ------ | ---------------- | ------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid request body                       |
| 401    | UNAUTHORIZED     | Missing or invalid API key                 |
| 403    | FORBIDDEN        | API key missing `tcp-monitors:write` scope |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"description": "Monitor name",
			"minLength": 1,
			"maxLength": 255
		},
		"host": {
			"type": "string",
			"description": "Hostname or IP address",
			"minLength": 1,
			"maxLength": 255
		},
		"port": {
			"type": "integer",
			"description": "TCP port number",
			"minimum": 1,
			"maximum": 65535
		},
		"timeoutMs": {
			"type": "integer",
			"description": "Connection timeout in milliseconds",
			"minimum": 100,
			"maximum": 60000,
			"default": 5000
		},
		"intervalSeconds": {
			"type": "integer",
			"description": "Check interval in seconds",
			"minimum": 10,
			"maximum": 86400,
			"default": 60
		},
		"isEnabled": {
			"type": "boolean",
			"description": "Whether the monitor is active",
			"default": true
		}
	},
	"required": ["name", "host", "port"],
	"additionalProperties": false
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
				"id": {
					"type": "string",
					"description": "Unique identifier",
					"pattern": "^tcpm_[a-zA-Z0-9]+$"
				},
				"name": {
					"type": "string",
					"description": "Monitor name",
					"minLength": 1,
					"maxLength": 255
				},
				"host": {
					"type": "string",
					"description": "Hostname or IP address",
					"minLength": 1,
					"maxLength": 255
				},
				"port": {
					"type": "integer",
					"description": "TCP port number",
					"minimum": 1,
					"maximum": 65535
				},
				"timeoutMs": {
					"type": "integer",
					"description": "Connection timeout in milliseconds",
					"minimum": 100,
					"maximum": 60000,
					"default": 5000
				},
				"intervalSeconds": {
					"type": "integer",
					"description": "Check interval in seconds",
					"minimum": 10,
					"maximum": 86400,
					"default": 60
				},
				"isEnabled": {
					"type": "boolean",
					"description": "Whether the monitor is active",
					"default": true
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["up", "down", "timeout", null],
					"description": "Status from the last check"
				},
				"lastResponseTimeMs": {
					"type": ["integer", "null"],
					"description": "Response time from the last check in milliseconds"
				},
				"createdAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was created"
				},
				"updatedAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was last updated"
				}
			},
			"required": [
				"id",
				"name",
				"host",
				"port",
				"timeoutMs",
				"intervalSeconds",
				"isEnabled",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Get a TCP Monitor

Retrieve a single TCP monitor by ID.

```
GET /api/v1/tcp-monitors/:id
```

**Required scope:** `tcp-monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"id": "tcpm_abc123",
		"name": "PostgreSQL Production",
		"host": "db.example.com",
		"port": 5432,
		"timeoutMs": 5000,
		"intervalSeconds": 60,
		"isEnabled": true,
		"lastCheckedAt": "2026-02-14T12:00:00Z",
		"lastStatus": "up",
		"lastResponseTimeMs": 45,
		"createdAt": "2026-01-15T10:30:00Z",
		"updatedAt": "2026-02-10T14:20:00Z"
	}
}
```

### Errors

| Status | Code         | Description                               |
| ------ | ------------ | ----------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key                |
| 403    | FORBIDDEN    | API key missing `tcp-monitors:read` scope |
| 404    | NOT_FOUND    | TCP monitor not found                     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"id": {
					"type": "string",
					"description": "Unique identifier",
					"pattern": "^tcpm_[a-zA-Z0-9]+$"
				},
				"name": {
					"type": "string",
					"description": "Monitor name",
					"minLength": 1,
					"maxLength": 255
				},
				"host": {
					"type": "string",
					"description": "Hostname or IP address",
					"minLength": 1,
					"maxLength": 255
				},
				"port": {
					"type": "integer",
					"description": "TCP port number",
					"minimum": 1,
					"maximum": 65535
				},
				"timeoutMs": {
					"type": "integer",
					"description": "Connection timeout in milliseconds",
					"minimum": 100,
					"maximum": 60000,
					"default": 5000
				},
				"intervalSeconds": {
					"type": "integer",
					"description": "Check interval in seconds",
					"minimum": 10,
					"maximum": 86400,
					"default": 60
				},
				"isEnabled": {
					"type": "boolean",
					"description": "Whether the monitor is active",
					"default": true
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["up", "down", "timeout", null],
					"description": "Status from the last check"
				},
				"lastResponseTimeMs": {
					"type": ["integer", "null"],
					"description": "Response time from the last check in milliseconds"
				},
				"createdAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was created"
				},
				"updatedAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was last updated"
				}
			},
			"required": [
				"id",
				"name",
				"host",
				"port",
				"timeoutMs",
				"intervalSeconds",
				"isEnabled",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Update a TCP Monitor

Update an existing TCP monitor. Only include fields you want to change.

```
PUT /api/v1/tcp-monitors/:id
```

**Required scope:** `tcp-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                    |
| ----------------- | ------- | -------- | ---------------------------------------------- |
| `name`            | string  | No       | Monitor name (1-255 characters)                |
| `host`            | string  | No       | Hostname or IP address (1-255 characters)      |
| `port`            | integer | No       | TCP port number (1-65535)                      |
| `timeoutMs`       | integer | No       | Connection timeout in milliseconds (100-60000) |
| `intervalSeconds` | integer | No       | Check interval in seconds (10-86400)           |
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
		"id": "tcpm_abc123",
		"name": "PostgreSQL Production",
		"host": "db.example.com",
		"port": 5432,
		"timeoutMs": 15000,
		"intervalSeconds": 60,
		"isEnabled": false,
		"lastCheckedAt": "2026-02-14T12:00:00Z",
		"lastStatus": "up",
		"lastResponseTimeMs": 45,
		"createdAt": "2026-01-15T10:30:00Z",
		"updatedAt": "2026-02-14T12:30:00Z"
	}
}
```

### Errors

| Status | Code             | Description                                |
| ------ | ---------------- | ------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid request body                       |
| 401    | UNAUTHORIZED     | Missing or invalid API key                 |
| 403    | FORBIDDEN        | API key missing `tcp-monitors:write` scope |
| 404    | NOT_FOUND        | TCP monitor not found                      |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"description": "Monitor name",
			"minLength": 1,
			"maxLength": 255
		},
		"host": {
			"type": "string",
			"description": "Hostname or IP address",
			"minLength": 1,
			"maxLength": 255
		},
		"port": {
			"type": "integer",
			"description": "TCP port number",
			"minimum": 1,
			"maximum": 65535
		},
		"timeoutMs": {
			"type": "integer",
			"description": "Connection timeout in milliseconds",
			"minimum": 100,
			"maximum": 60000
		},
		"intervalSeconds": {
			"type": "integer",
			"description": "Check interval in seconds",
			"minimum": 10,
			"maximum": 86400
		},
		"isEnabled": {
			"type": "boolean",
			"description": "Whether the monitor is active"
		}
	},
	"additionalProperties": false
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
				"id": {
					"type": "string",
					"description": "Unique identifier",
					"pattern": "^tcpm_[a-zA-Z0-9]+$"
				},
				"name": {
					"type": "string",
					"description": "Monitor name",
					"minLength": 1,
					"maxLength": 255
				},
				"host": {
					"type": "string",
					"description": "Hostname or IP address",
					"minLength": 1,
					"maxLength": 255
				},
				"port": {
					"type": "integer",
					"description": "TCP port number",
					"minimum": 1,
					"maximum": 65535
				},
				"timeoutMs": {
					"type": "integer",
					"description": "Connection timeout in milliseconds",
					"minimum": 100,
					"maximum": 60000,
					"default": 5000
				},
				"intervalSeconds": {
					"type": "integer",
					"description": "Check interval in seconds",
					"minimum": 10,
					"maximum": 86400,
					"default": 60
				},
				"isEnabled": {
					"type": "boolean",
					"description": "Whether the monitor is active",
					"default": true
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["up", "down", "timeout", null],
					"description": "Status from the last check"
				},
				"lastResponseTimeMs": {
					"type": ["integer", "null"],
					"description": "Response time from the last check in milliseconds"
				},
				"createdAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was created"
				},
				"updatedAt": {
					"type": "string",
					"format": "date-time",
					"description": "Timestamp when the monitor was last updated"
				}
			},
			"required": [
				"id",
				"name",
				"host",
				"port",
				"timeoutMs",
				"intervalSeconds",
				"isEnabled",
				"createdAt",
				"updatedAt"
			]
		}
	},
	"required": ["data"]
}
```

## Delete a TCP Monitor

Permanently delete a TCP monitor and all its check history.

```
DELETE /api/v1/tcp-monitors/:id
```

**Required scope:** `tcp-monitors:write`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/tcp-monitors/tcpm_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `204 No Content` on success with no response body.

### Errors

| Status | Code         | Description                                |
| ------ | ------------ | ------------------------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid API key                 |
| 403    | FORBIDDEN    | API key missing `tcp-monitors:write` scope |
| 404    | NOT_FOUND    | TCP monitor not found                      |

### Response Schema

Returns `204 No Content` with no response body on success.

## Get Check Results

Retrieve the connection check history for a TCP monitor.

Results arrive newest first, a page at a time. See [Pagination](/docs/api/pagination) for how to walk the whole history.

```
GET /api/v1/tcp-monitors/:id/results
```

**Required scope:** `tcp-monitors:read`

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

### Errors

| Status | Code         | Description                               |
| ------ | ------------ | ----------------------------------------- |
| 400    | BAD_REQUEST  | Invalid or malformed cursor               |
| 401    | UNAUTHORIZED | Missing or invalid API key                |
| 403    | FORBIDDEN    | API key missing `tcp-monitors:read` scope |
| 404    | NOT_FOUND    | TCP monitor not found                     |

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
							"id": {
								"type": "string",
								"description": "Unique identifier",
								"pattern": "^tcpr_[a-zA-Z0-9]+$"
							},
							"status": {
								"type": "string",
								"enum": ["up", "down", "timeout"],
								"description": "Result status"
							},
							"responseTimeMs": {
								"type": ["integer", "null"],
								"description": "Connection time in milliseconds"
							},
							"errorMessage": {
								"type": ["string", "null"],
								"description": "Error message when status is down or timeout"
							},
							"checkedAt": {
								"type": "integer",
								"description": "When the check ran, in milliseconds since the epoch"
							}
						},
						"required": ["id", "status", "checkedAt"]
					}
				}
			},
			"required": ["results"]
		}
	},
	"required": ["data"]
}
```
