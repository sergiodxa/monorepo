---
title: Team
description: Get and update team settings. Manage team domains for custom status page URLs.
section:
  title: API Resources
  order: 5
order: 10
lastUpdated: 2026-09-05
---

Manage your team settings, memberships, and custom domains for status pages.

## GET /api/v1/team

Returns the current team's details.

### Required Scope

`teams:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/team \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"id": "team_abc123",
	"name": "Acme Inc",
	"slug": "acme-inc",
	"logo": "https://cdn.example.com/logos/acme.png",
	"ownerId": "usr_xyz789",
	"createdAt": "2025-06-15T08:00:00Z",
	"updatedAt": "2026-01-20T14:30:00Z"
}
```

### Response Fields

| Field       | Type           | Description                                       |
| ----------- | -------------- | ------------------------------------------------- |
| `id`        | string         | Unique team identifier                            |
| `name`      | string         | Display name of the team                          |
| `slug`      | string         | URL-friendly team identifier                      |
| `logo`      | string \| null | URL to the team's logo image                      |
| `ownerId`   | string         | User ID of the team owner                         |
| `createdAt` | string         | ISO 8601 timestamp when the team was created      |
| `updatedAt` | string         | ISO 8601 timestamp when the team was last updated |

### Possible Errors

| Status | Code           | Description                             |
| ------ | -------------- | --------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key              |
| 403    | FORBIDDEN      | API key doesn't have `teams:read` scope |
| 429    | RATE_LIMITED   | Too many requests                       |
| 500    | INTERNAL_ERROR | Server error                            |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "name", "slug", "logo", "ownerId", "createdAt", "updatedAt"],
	"properties": {
		"id": {
			"type": "string"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"slug": {
			"type": "string"
		},
		"logo": {
			"type": ["string", "null"],
			"format": "uri"
		},
		"ownerId": {
			"type": "string"
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

## PUT /api/v1/team

Updates the current team's settings. At least one field must be provided.

### Required Scope

`teams:write`

### Request Body

| Field     | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `name`    | string | No       | Team display name (1-255 characters)               |
| `logoUrl` | string | No       | URL to the team's logo image (must be a valid URL) |

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/team \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "logoUrl": "https://cdn.example.com/logos/acme-new.png"
  }'
```

### Response

```json
{
	"id": "team_abc123",
	"name": "Acme Corporation",
	"slug": "acme-inc",
	"logo": "https://cdn.example.com/logos/acme-new.png",
	"ownerId": "usr_xyz789",
	"createdAt": "2025-06-15T08:00:00Z",
	"updatedAt": "2026-02-14T10:45:00Z"
}
```

### Possible Errors

| Status | Code             | Description                                |
| ------ | ---------------- | ------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid request body or no fields provided |
| 401    | UNAUTHORIZED     | Missing or invalid API key                 |
| 403    | FORBIDDEN        | API key doesn't have `teams:write` scope   |
| 429    | RATE_LIMITED     | Too many requests                          |
| 500    | INTERNAL_ERROR   | Server error                               |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"minProperties": 1,
	"properties": {
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"logoUrl": {
			"type": "string",
			"format": "uri"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "name", "slug", "logo", "ownerId", "createdAt", "updatedAt"],
	"properties": {
		"id": {
			"type": "string"
		},
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"slug": {
			"type": "string"
		},
		"logo": {
			"type": ["string", "null"],
			"format": "uri"
		},
		"ownerId": {
			"type": "string"
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

## GET /api/v1/memberships

Returns the memberships of the current team.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page through the full list.

### Required Scope

`teams:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/memberships?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"memberships": [
			{
				"id": "mem_abc123",
				"subjectId": "usr_xyz789",
				"teamId": "team_abc123",
				"role": "owner",
				"createdAt": 1750060800000,
				"updatedAt": 1750060800000
			},
			{
				"id": "mem_def456",
				"subjectId": "usr_def456",
				"teamId": "team_abc123",
				"role": "admin",
				"createdAt": 1755700200000,
				"updatedAt": 1764580500000
			},
			{
				"id": "mem_ghi789",
				"subjectId": "usr_ghi789",
				"teamId": "team_abc123",
				"role": "member",
				"createdAt": 1768042800000,
				"updatedAt": 1768042800000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 100,
			"total": 142
		}
	}
}
```

### Response Fields

| Field                          | Type           | Description                                        |
| ------------------------------ | -------------- | -------------------------------------------------- |
| `data.memberships`             | array          | One page of team memberships                       |
| `data.memberships[].id`        | string         | Unique membership identifier                       |
| `data.memberships[].subjectId` | string         | User ID of the team member                         |
| `data.memberships[].teamId`    | string         | Team ID this membership belongs to                 |
| `data.memberships[].role`      | string         | Member's role: `owner`, `admin`, or `member`       |
| `data.memberships[].createdAt` | integer        | Unix timestamp in milliseconds of the creation     |
| `data.memberships[].updatedAt` | integer        | Unix timestamp in milliseconds of the last update  |
| `meta.requestId`               | string         | Identifier for this request                        |
| `meta.timestamp`               | string         | ISO 8601 timestamp of the response                 |
| `meta.pagination.next`         | string \| null | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`         | string \| null | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage`      | integer        | Results this page was built with                   |
| `meta.pagination.total`        | integer        | Memberships matching, across every page            |

### Possible Errors

| Status | Code           | Description                             |
| ------ | -------------- | --------------------------------------- |
| 400    | BAD_REQUEST    | Invalid or malformed cursor             |
| 401    | UNAUTHORIZED   | Missing or invalid API key              |
| 403    | FORBIDDEN      | API key doesn't have `teams:read` scope |
| 429    | RATE_LIMITED   | Too many requests                       |
| 500    | INTERNAL_ERROR | Server error                            |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["memberships"],
			"properties": {
				"memberships": {
					"type": "array",
					"items": {
						"type": "object",
						"required": ["id", "subjectId", "teamId", "role", "createdAt", "updatedAt"],
						"properties": {
							"id": {
								"type": "string"
							},
							"subjectId": {
								"type": "string"
							},
							"teamId": {
								"type": "string"
							},
							"role": {
								"type": "string",
								"enum": ["owner", "admin", "member"]
							},
							"createdAt": {
								"type": "integer"
							},
							"updatedAt": {
								"type": "integer"
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

## GET /api/v1/team-domains

Returns the custom domains configured for the team's status pages.

Results arrive a page at a time; follow the `Link` header as described in [Pagination](/docs/api/pagination) to reach every domain.

### Required Scope

`team-domains:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/team-domains?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"teamDomains": [
			{
				"id": "dom_abc123",
				"hostname": "status.acme.com",
				"verifiedAt": 1756728000000,
				"teamId": "team_abc123",
				"createdAt": 1756641600000,
				"updatedAt": 1756728000000
			},
			{
				"id": "dom_def456",
				"hostname": "uptime.acme.io",
				"verifiedAt": null,
				"teamId": "team_abc123",
				"createdAt": 1768469400000,
				"updatedAt": 1768469400000
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

| Field                           | Type            | Description                                        |
| ------------------------------- | --------------- | -------------------------------------------------- |
| `data.teamDomains`              | array           | One page of team domains                           |
| `data.teamDomains[].id`         | string          | Unique domain identifier                           |
| `data.teamDomains[].hostname`   | string          | The custom domain hostname                         |
| `data.teamDomains[].verifiedAt` | integer \| null | Unix timestamp in milliseconds of the verification |
| `data.teamDomains[].teamId`     | string          | Team ID this domain belongs to                     |
| `data.teamDomains[].createdAt`  | integer         | Unix timestamp in milliseconds of the creation     |
| `data.teamDomains[].updatedAt`  | integer         | Unix timestamp in milliseconds of the last update  |
| `meta.requestId`                | string          | Identifier for this request                        |
| `meta.timestamp`                | string          | ISO 8601 timestamp of the response                 |
| `meta.pagination.next`          | string \| null  | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`          | string \| null  | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage`       | integer         | Results this page was built with                   |
| `meta.pagination.total`         | integer         | Domains matching, across every page                |

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 400    | BAD_REQUEST    | Invalid or malformed cursor                    |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `team-domains:read` scope |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["teamDomains"],
			"properties": {
				"teamDomains": {
					"type": "array",
					"items": {
						"type": "object",
						"required": ["id", "hostname", "verifiedAt", "teamId", "createdAt", "updatedAt"],
						"properties": {
							"id": {
								"type": "string"
							},
							"hostname": {
								"type": "string",
								"minLength": 1,
								"maxLength": 255
							},
							"verifiedAt": {
								"type": ["integer", "null"]
							},
							"teamId": {
								"type": "string"
							},
							"createdAt": {
								"type": "integer"
							},
							"updatedAt": {
								"type": "integer"
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

## POST /api/v1/team-domains

Adds a custom domain for the team's status pages.

### Required Scope

`team-domains:write`

### Request Body

| Field      | Type   | Required | Description                                   |
| ---------- | ------ | -------- | --------------------------------------------- |
| `hostname` | string | Yes      | The custom domain hostname (1-255 characters) |

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/team-domains \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "status.example.com"
  }'
```

### Response

```json
{
	"id": "dom_ghi789",
	"hostname": "status.example.com",
	"teamId": "team_abc123",
	"createdAt": "2026-02-14T10:00:00Z",
	"updatedAt": "2026-02-14T10:00:00Z"
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid hostname or missing required field      |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `team-domains:write` scope |
| 409    | CONFLICT         | Domain already exists                           |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["hostname"],
	"properties": {
		"hostname": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "hostname", "teamId", "createdAt", "updatedAt"],
	"properties": {
		"id": {
			"type": "string"
		},
		"hostname": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"teamId": {
			"type": "string"
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

## DELETE /api/v1/team-domains

Removes a custom domain from the team.

### Required Scope

`team-domains:write`

### Request Body

| Field | Type   | Required | Description                           |
| ----- | ------ | -------- | ------------------------------------- |
| `id`  | string | Yes      | The domain ID to remove (UUID format) |

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/team-domains \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dom_ghi789"
  }'
```

### Response

```json
{
	"success": true
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid or missing domain ID                    |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `team-domains:write` scope |
| 404    | NOT_FOUND        | Domain not found                                |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id"],
	"properties": {
		"id": {
			"type": "string",
			"format": "uuid"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["success"],
	"properties": {
		"success": {
			"type": "boolean",
			"const": true
		}
	}
}
```
