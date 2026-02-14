---
title: DNS Monitors
description: Create and manage DNS monitors. Check DNS records and get resolution history.
section:
  title: API Resources
  order: 5
order: 3
lastUpdated: 2026-02-14
---

DNS monitors check that your DNS records resolve correctly and match expected values. Use these endpoints to create, update, and retrieve DNS monitor data programmatically.

## List All DNS Monitors

Retrieves all DNS monitors for your team.

```
GET /v1/dns-monitors
```

**Required Scope:** `dns-monitors:read`

### cURL

```bash
curl https://uptime.example.com/api/v1/dns-monitors \
  -H "Authorization: Bearer uptime_your_api_key"
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://uptime.example.com/api/v1/dns-monitors", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});
const { data } = await response.json();
```

### Response

```json
{
	"data": [
		{
			"id": "dns_abc123",
			"name": "Production A Record",
			"domain": "example.com",
			"recordType": "A",
			"expectedValue": "192.0.2.1",
			"intervalSeconds": 3600,
			"isEnabled": true,
			"lastCheckedAt": "2026-02-14T10:30:00Z",
			"lastStatus": "ok",
			"lastValue": "192.0.2.1",
			"createdAt": "2026-01-15T08:00:00Z",
			"updatedAt": "2026-02-10T14:22:00Z"
		}
	]
}
```

### Errors

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |

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
					"id": {
						"type": "string",
						"description": "Unique identifier for the DNS monitor"
					},
					"name": {
						"type": "string",
						"minLength": 1,
						"maxLength": 255,
						"description": "Human-readable name for the monitor"
					},
					"domain": {
						"type": "string",
						"minLength": 1,
						"maxLength": 255,
						"description": "Domain name to query"
					},
					"recordType": {
						"type": "string",
						"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
						"description": "DNS record type to check"
					},
					"expectedValue": {
						"type": ["string", "null"],
						"maxLength": 1024,
						"description": "Expected value for the DNS record"
					},
					"intervalSeconds": {
						"type": "integer",
						"minimum": 60,
						"maximum": 86400,
						"default": 3600,
						"description": "Check interval in seconds"
					},
					"isEnabled": {
						"type": "boolean",
						"default": true,
						"description": "Whether the monitor is active"
					},
					"lastCheckedAt": {
						"type": ["string", "null"],
						"format": "date-time",
						"description": "Timestamp of the last check"
					},
					"lastStatus": {
						"type": ["string", "null"],
						"enum": ["ok", "changed", "error", null],
						"description": "Status from the last check"
					},
					"lastValue": {
						"type": ["string", "null"],
						"description": "Value returned from the last check"
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
					"domain",
					"recordType",
					"intervalSeconds",
					"isEnabled",
					"createdAt",
					"updatedAt"
				]
			}
		}
	},
	"required": ["data"]
}
```

## Create a DNS Monitor

Creates a new DNS monitor.

```
POST /v1/dns-monitors
```

**Required Scope:** `dns-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                                 |
| ----------------- | ------- | -------- | ----------------------------------------------------------- |
| `name`            | string  | Yes      | Monitor name (1-255 characters)                             |
| `domain`          | string  | Yes      | Domain to query (1-255 characters)                          |
| `recordType`      | string  | Yes      | DNS record type: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, or `NS` |
| `expectedValue`   | string  | No       | Expected record value (max 1024 characters)                 |
| `intervalSeconds` | integer | No       | Check interval in seconds (60-86400, default: 3600)         |
| `isEnabled`       | boolean | No       | Whether the monitor is active (default: true)               |

### cURL

```bash
curl https://uptime.example.com/api/v1/dns-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production A Record",
    "domain": "example.com",
    "recordType": "A",
    "expectedValue": "192.0.2.1",
    "intervalSeconds": 3600
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://uptime.example.com/api/v1/dns-monitors", {
	method: "POST",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		name: "Production A Record",
		domain: "example.com",
		recordType: "A",
		expectedValue: "192.0.2.1",
		intervalSeconds: 3600,
	}),
});
const { data } = await response.json();
```

### Response

```json
{
	"data": {
		"id": "dns_abc123",
		"name": "Production A Record",
		"domain": "example.com",
		"recordType": "A",
		"expectedValue": "192.0.2.1",
		"intervalSeconds": 3600,
		"isEnabled": true,
		"lastCheckedAt": null,
		"lastStatus": null,
		"lastValue": null,
		"createdAt": "2026-02-14T12:00:00Z",
		"updatedAt": "2026-02-14T12:00:00Z"
	}
}
```

### Errors

| Status | Code             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body                     |
| 400    | LIMIT_EXCEEDED   | Maximum number of DNS monitors reached   |
| 401    | UNAUTHORIZED     | Missing or invalid API key               |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:write` scope |

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
			"description": "Human-readable name for the monitor"
		},
		"domain": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Domain name to query"
		},
		"recordType": {
			"type": "string",
			"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
			"description": "DNS record type to check"
		},
		"expectedValue": {
			"type": "string",
			"maxLength": 1024,
			"description": "Expected value for the DNS record"
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 60,
			"maximum": 86400,
			"default": 3600,
			"description": "Check interval in seconds"
		},
		"isEnabled": {
			"type": "boolean",
			"default": true,
			"description": "Whether the monitor is active"
		}
	},
	"required": ["name", "domain", "recordType"]
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
					"description": "Unique identifier for the DNS monitor"
				},
				"name": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Human-readable name for the monitor"
				},
				"domain": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Domain name to query"
				},
				"recordType": {
					"type": "string",
					"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
					"description": "DNS record type to check"
				},
				"expectedValue": {
					"type": ["string", "null"],
					"maxLength": 1024,
					"description": "Expected value for the DNS record"
				},
				"intervalSeconds": {
					"type": "integer",
					"minimum": 60,
					"maximum": 86400,
					"default": 3600,
					"description": "Check interval in seconds"
				},
				"isEnabled": {
					"type": "boolean",
					"default": true,
					"description": "Whether the monitor is active"
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["ok", "changed", "error", null],
					"description": "Status from the last check"
				},
				"lastValue": {
					"type": ["string", "null"],
					"description": "Value returned from the last check"
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
				"domain",
				"recordType",
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

## Get a DNS Monitor

Retrieves a single DNS monitor by ID.

```
GET /v1/dns-monitors/:id
```

**Required Scope:** `dns-monitors:read`

### cURL

```bash
curl https://uptime.example.com/api/v1/dns-monitors/dns_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://uptime.example.com/api/v1/dns-monitors/dns_abc123", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});
const { data } = await response.json();
```

### Response

```json
{
	"data": {
		"id": "dns_abc123",
		"name": "Production A Record",
		"domain": "example.com",
		"recordType": "A",
		"expectedValue": "192.0.2.1",
		"intervalSeconds": 3600,
		"isEnabled": true,
		"lastCheckedAt": "2026-02-14T10:30:00Z",
		"lastStatus": "ok",
		"lastValue": "192.0.2.1",
		"createdAt": "2026-01-15T08:00:00Z",
		"updatedAt": "2026-02-10T14:22:00Z"
	}
}
```

### Errors

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |
| 404    | NOT_FOUND    | DNS monitor not found                   |

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
					"description": "Unique identifier for the DNS monitor"
				},
				"name": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Human-readable name for the monitor"
				},
				"domain": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Domain name to query"
				},
				"recordType": {
					"type": "string",
					"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
					"description": "DNS record type to check"
				},
				"expectedValue": {
					"type": ["string", "null"],
					"maxLength": 1024,
					"description": "Expected value for the DNS record"
				},
				"intervalSeconds": {
					"type": "integer",
					"minimum": 60,
					"maximum": 86400,
					"default": 3600,
					"description": "Check interval in seconds"
				},
				"isEnabled": {
					"type": "boolean",
					"default": true,
					"description": "Whether the monitor is active"
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["ok", "changed", "error", null],
					"description": "Status from the last check"
				},
				"lastValue": {
					"type": ["string", "null"],
					"description": "Value returned from the last check"
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
				"domain",
				"recordType",
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

## Update a DNS Monitor

Updates an existing DNS monitor. All fields are optional; only provided fields are updated.

```
PUT /v1/dns-monitors/:id
```

**Required Scope:** `dns-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                                 |
| ----------------- | ------- | -------- | ----------------------------------------------------------- |
| `name`            | string  | No       | Monitor name (1-255 characters)                             |
| `domain`          | string  | No       | Domain to query (1-255 characters)                          |
| `recordType`      | string  | No       | DNS record type: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, or `NS` |
| `expectedValue`   | string  | No       | Expected record value (max 1024 characters)                 |
| `intervalSeconds` | integer | No       | Check interval in seconds (60-86400)                        |
| `isEnabled`       | boolean | No       | Whether the monitor is active                               |

### cURL

```bash
curl https://uptime.example.com/api/v1/dns-monitors/dns_abc123 \
  -X PUT \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "expectedValue": "192.0.2.2",
    "intervalSeconds": 1800
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://uptime.example.com/api/v1/dns-monitors/dns_abc123", {
	method: "PUT",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		expectedValue: "192.0.2.2",
		intervalSeconds: 1800,
	}),
});
const { data } = await response.json();
```

### Response

```json
{
	"data": {
		"id": "dns_abc123",
		"name": "Production A Record",
		"domain": "example.com",
		"recordType": "A",
		"expectedValue": "192.0.2.2",
		"intervalSeconds": 1800,
		"isEnabled": true,
		"lastCheckedAt": "2026-02-14T10:30:00Z",
		"lastStatus": "ok",
		"lastValue": "192.0.2.1",
		"createdAt": "2026-01-15T08:00:00Z",
		"updatedAt": "2026-02-14T12:00:00Z"
	}
}
```

### Errors

| Status | Code             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body                     |
| 401    | UNAUTHORIZED     | Missing or invalid API key               |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:write` scope |
| 404    | NOT_FOUND        | DNS monitor not found                    |

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
			"description": "Human-readable name for the monitor"
		},
		"domain": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Domain name to query"
		},
		"recordType": {
			"type": "string",
			"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
			"description": "DNS record type to check"
		},
		"expectedValue": {
			"type": ["string", "null"],
			"maxLength": 1024,
			"description": "Expected value for the DNS record"
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 60,
			"maximum": 86400,
			"description": "Check interval in seconds"
		},
		"isEnabled": {
			"type": "boolean",
			"description": "Whether the monitor is active"
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
				"id": {
					"type": "string",
					"description": "Unique identifier for the DNS monitor"
				},
				"name": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Human-readable name for the monitor"
				},
				"domain": {
					"type": "string",
					"minLength": 1,
					"maxLength": 255,
					"description": "Domain name to query"
				},
				"recordType": {
					"type": "string",
					"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
					"description": "DNS record type to check"
				},
				"expectedValue": {
					"type": ["string", "null"],
					"maxLength": 1024,
					"description": "Expected value for the DNS record"
				},
				"intervalSeconds": {
					"type": "integer",
					"minimum": 60,
					"maximum": 86400,
					"default": 3600,
					"description": "Check interval in seconds"
				},
				"isEnabled": {
					"type": "boolean",
					"default": true,
					"description": "Whether the monitor is active"
				},
				"lastCheckedAt": {
					"type": ["string", "null"],
					"format": "date-time",
					"description": "Timestamp of the last check"
				},
				"lastStatus": {
					"type": ["string", "null"],
					"enum": ["ok", "changed", "error", null],
					"description": "Status from the last check"
				},
				"lastValue": {
					"type": ["string", "null"],
					"description": "Value returned from the last check"
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
				"domain",
				"recordType",
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

## Delete a DNS Monitor

Permanently deletes a DNS monitor and all its historical results.

```
DELETE /v1/dns-monitors/:id
```

**Required Scope:** `dns-monitors:write`

### cURL

```bash
curl https://uptime.example.com/api/v1/dns-monitors/dns_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://uptime.example.com/api/v1/dns-monitors/dns_abc123", {
	method: "DELETE",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});
```

### Response

Returns `204 No Content` on success.

### Errors

| Status | Code         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key               |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:write` scope |
| 404    | NOT_FOUND    | DNS monitor not found                    |

### Response Schema

Returns `204 No Content` with an empty response body on success.

## Get DNS Monitor Results

Retrieves the check history for a DNS monitor.

```
GET /v1/dns-monitors/:id/results
```

**Required Scope:** `dns-monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                                      |
| --------- | ------- | -------- | ------------------------------------------------ |
| `limit`   | integer | No       | Number of results to return (1-200, default: 50) |

### cURL

```bash
curl "https://uptime.example.com/api/v1/dns-monitors/dns_abc123/results?limit=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### JavaScript (fetch)

```javascript
const response = await fetch(
	"https://uptime.example.com/api/v1/dns-monitors/dns_abc123/results?limit=10",
	{
		headers: {
			Authorization: "Bearer uptime_your_api_key",
		},
	},
);
const { data } = await response.json();
```

### Response

```json
{
	"data": [
		{
			"id": "res_xyz789",
			"status": "ok",
			"value": "192.0.2.1",
			"checkedAt": "2026-02-14T10:30:00Z"
		},
		{
			"id": "res_xyz788",
			"status": "ok",
			"value": "192.0.2.1",
			"checkedAt": "2026-02-14T09:30:00Z"
		}
	]
}
```

### Errors

| Status | Code             | Description                             |
| ------ | ---------------- | --------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid query parameters                |
| 401    | UNAUTHORIZED     | Missing or invalid API key              |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:read` scope |
| 404    | NOT_FOUND        | DNS monitor not found                   |

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
					"id": {
						"type": "string",
						"description": "Unique identifier for the result"
					},
					"status": {
						"type": "string",
						"enum": ["ok", "changed", "error"],
						"description": "Check result status"
					},
					"value": {
						"type": ["string", "null"],
						"description": "Resolved DNS value"
					},
					"checkedAt": {
						"type": "string",
						"format": "date-time",
						"description": "Timestamp when the check was performed"
					}
				},
				"required": ["id", "status", "checkedAt"]
			}
		}
	},
	"required": ["data"]
}
```
