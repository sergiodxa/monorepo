---
title: API Keys
description: Create and manage API keys programmatically. Keys can only be viewed once at creation.
section:
  title: API Resources
  order: 5
order: 12
lastUpdated: 2026-09-05
---

Manage API keys for your team programmatically. Each team can have a maximum of 10 API keys.

> **Important:** The full API key value is only returned once when the key is created. Store it securely immediately, as it cannot be retrieved again.

## GET /api/v1/api-keys

Returns the API keys for your team. The key values themselves stay with you from creation; a listing carries the prefix, which is enough to identify a key.

This list is paginated. See [Pagination](/docs/api/pagination) for following the `Link` header to the next page.

### Required Scope

`api-keys:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/api-keys?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"apiKeys": [
			{
				"id": "key_abc123",
				"name": "Production Integration",
				"scopes": ["monitors:read", "monitors:write"],
				"createdAt": 1768467600000,
				"lastUsedAt": 1771065000000,
				"expiresAt": null,
				"keyPrefix": "uptime_a1b2c3"
			},
			{
				"id": "key_def456",
				"name": "CI/CD Pipeline",
				"scopes": ["monitors:read"],
				"createdAt": 1770301320000,
				"lastUsedAt": null,
				"expiresAt": 1785974400000,
				"keyPrefix": "uptime_d4e5f6"
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": null,
			"prev": null,
			"perPage": 100,
			"total": 2
		}
	}
}
```

### Response Fields

| Field                       | Type            | Description                                             |
| --------------------------- | --------------- | ------------------------------------------------------- |
| `data.apiKeys`              | array           | One page of API keys                                    |
| `data.apiKeys[].id`         | string          | Unique identifier for the API key                       |
| `data.apiKeys[].name`       | string          | Display name of the API key                             |
| `data.apiKeys[].scopes`     | array           | List of permission scopes granted to this key           |
| `data.apiKeys[].createdAt`  | integer         | Unix timestamp in milliseconds of the creation          |
| `data.apiKeys[].lastUsedAt` | integer \| null | Unix timestamp in milliseconds of the last use          |
| `data.apiKeys[].expiresAt`  | integer \| null | Unix timestamp in milliseconds of the expiration        |
| `data.apiKeys[].keyPrefix`  | string          | First characters of the key for identification purposes |
| `meta.requestId`            | string          | Identifier for this request                             |
| `meta.timestamp`            | string          | ISO 8601 timestamp of the response                      |
| `meta.pagination.next`      | string \| null  | Cursor for the following page, `null` on the last       |
| `meta.pagination.prev`      | string \| null  | Cursor for the preceding page, `null` on the first      |
| `meta.pagination.perPage`   | integer         | Results this page was built with                        |
| `meta.pagination.total`     | integer         | API keys matching, across every page                    |

### Possible Errors

| Status | Code           | Description                                |
| ------ | -------------- | ------------------------------------------ |
| 400    | BAD_REQUEST    | Invalid or malformed cursor                |
| 401    | UNAUTHORIZED   | Missing or invalid API key                 |
| 403    | FORBIDDEN      | API key doesn't have `api-keys:read` scope |
| 429    | RATE_LIMITED   | Too many requests                          |
| 500    | INTERNAL_ERROR | Server error                               |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["apiKeys"],
			"properties": {
				"apiKeys": {
					"type": "array",
					"items": {
						"type": "object",
						"required": [
							"id",
							"name",
							"scopes",
							"createdAt",
							"lastUsedAt",
							"expiresAt",
							"keyPrefix"
						],
						"properties": {
							"id": {
								"type": "string",
								"pattern": "^key_[a-zA-Z0-9]+$"
							},
							"name": {
								"type": "string",
								"minLength": 1,
								"maxLength": 255
							},
							"scopes": {
								"type": "array",
								"minItems": 1,
								"items": {
									"type": "string",
									"enum": [
										"teams:read",
										"teams:write",
										"invites:read",
										"invites:write",
										"team-domains:read",
										"team-domains:write",
										"monitors:read",
										"monitors:write",
										"maintenance:read",
										"maintenance:write",
										"dns-monitors:read",
										"dns-monitors:write",
										"alerts:read",
										"alerts:write",
										"status-pages:read",
										"status-pages:write",
										"cron-jobs:read",
										"cron-jobs:write",
										"cron-jobs:ping",
										"api-keys:read",
										"api-keys:write"
									]
								}
							},
							"createdAt": {
								"type": "integer"
							},
							"lastUsedAt": {
								"type": ["integer", "null"]
							},
							"expiresAt": {
								"type": ["integer", "null"]
							},
							"keyPrefix": {
								"type": "string",
								"pattern": "^uptime_[a-zA-Z0-9]+$"
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
				"requestId": {
					"type": "string",
					"format": "uuid"
				},
				"timestamp": {
					"type": "string",
					"format": "date-time"
				},
				"pagination": {
					"type": "object",
					"required": ["next", "prev", "perPage"],
					"properties": {
						"next": {
							"type": ["string", "null"]
						},
						"prev": {
							"type": ["string", "null"]
						},
						"perPage": {
							"type": "integer"
						},
						"total": {
							"type": "integer"
						}
					}
				}
			}
		}
	}
}
```

---

## POST /api/v1/api-keys

Creates a new API key for your team.

> **Warning:** The `key` field in the response contains the full API key value. This is the **only time** the complete key will be shown. Copy and store it in a secure location immediately. If you lose the key, you must delete it and create a new one.

### Required Scope

`api-keys:write`

### Request Body

| Field       | Type   | Required | Description                                        |
| ----------- | ------ | -------- | -------------------------------------------------- |
| `name`      | string | Yes      | Display name for the key (1-255 characters)        |
| `scopes`    | array  | Yes      | Permission scopes to grant (at least one required) |
| `expiresAt` | string | No       | ISO 8601 timestamp for key expiration              |

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/api-keys \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Actions",
    "scopes": ["monitors:read", "monitors:write"],
    "expiresAt": "2027-02-14T00:00:00Z"
  }'
```

### Response

```json
{
	"id": "key_ghi789",
	"name": "GitHub Actions",
	"scopes": ["monitors:read", "monitors:write"],
	"createdAt": "2026-02-14T11:00:00Z",
	"lastUsedAt": null,
	"expiresAt": "2027-02-14T00:00:00Z",
	"keyPrefix": "uptime_g7h8i9",
	"key": "uptime_g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

> **Store the `key` value immediately!** It will never be returned again in any API response.

### Response Fields

| Field        | Type           | Description                                                         |
| ------------ | -------------- | ------------------------------------------------------------------- |
| `id`         | string         | Unique identifier for the API key                                   |
| `name`       | string         | Display name of the API key                                         |
| `scopes`     | array          | List of permission scopes granted to this key                       |
| `createdAt`  | string         | ISO 8601 timestamp when the key was created                         |
| `lastUsedAt` | string \| null | Always `null` for newly created keys                                |
| `expiresAt`  | string \| null | ISO 8601 timestamp when the key expires, or `null` if no expiration |
| `keyPrefix`  | string         | First characters of the key for identification purposes             |
| `key`        | string         | **The full API key value. Only returned once at creation.**         |

### Possible Errors

| Status | Code             | Description                                               |
| ------ | ---------------- | --------------------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body (missing name, invalid scopes, etc.) |
| 401    | UNAUTHORIZED     | Missing or invalid API key                                |
| 403    | FORBIDDEN        | API key doesn't have `api-keys:write` scope               |
| 400    | LIMIT_EXCEEDED   | Team already has 10 API keys (maximum limit reached)      |
| 429    | RATE_LIMITED     | Too many requests                                         |
| 500    | INTERNAL_ERROR   | Server error                                              |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "scopes"],
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"scopes": {
			"type": "array",
			"minItems": 1,
			"items": {
				"type": "string",
				"enum": [
					"teams:read",
					"teams:write",
					"invites:read",
					"invites:write",
					"team-domains:read",
					"team-domains:write",
					"monitors:read",
					"monitors:write",
					"maintenance:read",
					"maintenance:write",
					"dns-monitors:read",
					"dns-monitors:write",
					"alerts:read",
					"alerts:write",
					"status-pages:read",
					"status-pages:write",
					"cron-jobs:read",
					"cron-jobs:write",
					"cron-jobs:ping",
					"api-keys:read",
					"api-keys:write"
				]
			}
		},
		"expiresAt": {
			"type": "string",
			"format": "date-time"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "name", "scopes", "createdAt", "lastUsedAt", "expiresAt", "keyPrefix", "key"],
	"properties": {
		"id": {
			"type": "string",
			"pattern": "^key_[a-zA-Z0-9]+$"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"scopes": {
			"type": "array",
			"minItems": 1,
			"items": {
				"type": "string",
				"enum": [
					"teams:read",
					"teams:write",
					"invites:read",
					"invites:write",
					"team-domains:read",
					"team-domains:write",
					"monitors:read",
					"monitors:write",
					"maintenance:read",
					"maintenance:write",
					"dns-monitors:read",
					"dns-monitors:write",
					"alerts:read",
					"alerts:write",
					"status-pages:read",
					"status-pages:write",
					"cron-jobs:read",
					"cron-jobs:write",
					"cron-jobs:ping",
					"api-keys:read",
					"api-keys:write"
				]
			}
		},
		"createdAt": {
			"type": "string",
			"format": "date-time"
		},
		"lastUsedAt": {
			"type": ["string", "null"],
			"format": "date-time"
		},
		"expiresAt": {
			"type": ["string", "null"],
			"format": "date-time"
		},
		"keyPrefix": {
			"type": "string",
			"pattern": "^uptime_[a-zA-Z0-9]+$"
		},
		"key": {
			"type": "string",
			"description": "The full API key value. Only returned once at creation.",
			"pattern": "^uptime_[a-zA-Z0-9]+$"
		}
	}
}
```

---

## DELETE /api/v1/api-keys/:id

Permanently deletes an API key. This action cannot be undone. Any integrations using this key will immediately lose access.

### Required Scope

`api-keys:write`

### Path Parameters

| Parameter | Type   | Description                                    |
| --------- | ------ | ---------------------------------------------- |
| `id`      | string | The unique identifier of the API key to delete |

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/api-keys/key_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"deleted": true
}
```

### Response Fields

| Field     | Type    | Description                          |
| --------- | ------- | ------------------------------------ |
| `deleted` | boolean | Always `true` on successful deletion |

### Possible Errors

| Status | Code           | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                   |
| 403    | FORBIDDEN      | API key doesn't have `api-keys:write` scope  |
| 404    | NOT_FOUND      | API key with the specified ID does not exist |
| 429    | RATE_LIMITED   | Too many requests                            |
| 500    | INTERNAL_ERROR | Server error                                 |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["deleted"],
	"properties": {
		"deleted": {
			"type": "boolean",
			"const": true
		}
	}
}
```
