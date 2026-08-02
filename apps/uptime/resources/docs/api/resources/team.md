---
title: Team
description: Get and update team settings. Manage team domains for custom status page URLs.
section:
  title: API Resources
  order: 5
order: 9
lastUpdated: 2026-02-14
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
	"ownerId": "user_xyz789",
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
	"ownerId": "user_xyz789",
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

Returns all memberships for the current team.

### Required Scope

`teams:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/memberships \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"memberships": [
		{
			"id": "mem_abc123",
			"subjectId": "user_xyz789",
			"teamId": "team_abc123",
			"role": "owner",
			"createdAt": "2025-06-15T08:00:00Z",
			"updatedAt": "2025-06-15T08:00:00Z"
		},
		{
			"id": "mem_def456",
			"subjectId": "user_def456",
			"teamId": "team_abc123",
			"role": "admin",
			"createdAt": "2025-08-20T14:30:00Z",
			"updatedAt": "2025-12-01T09:15:00Z"
		},
		{
			"id": "mem_ghi789",
			"subjectId": "user_ghi789",
			"teamId": "team_abc123",
			"role": "member",
			"createdAt": "2026-01-10T11:00:00Z",
			"updatedAt": "2026-01-10T11:00:00Z"
		}
	]
}
```

### Response Fields

| Field                     | Type   | Description                                             |
| ------------------------- | ------ | ------------------------------------------------------- |
| `memberships`             | array  | List of team memberships                                |
| `memberships[].id`        | string | Unique membership identifier                            |
| `memberships[].subjectId` | string | User ID of the team member                              |
| `memberships[].teamId`    | string | Team ID this membership belongs to                      |
| `memberships[].role`      | string | Member's role: `owner`, `admin`, or `member`            |
| `memberships[].createdAt` | string | ISO 8601 timestamp when the membership was created      |
| `memberships[].updatedAt` | string | ISO 8601 timestamp when the membership was last updated |

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
						"type": "string",
						"format": "date-time"
					},
					"updatedAt": {
						"type": "string",
						"format": "date-time"
					}
				}
			}
		}
	}
}
```

## GET /api/v1/team-domains

Returns all custom domains configured for the team's status pages.

### Required Scope

`team-domains:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/team-domains \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"domains": [
		{
			"id": "dom_abc123",
			"hostname": "status.acme.com",
			"teamId": "team_abc123",
			"createdAt": "2025-09-01T12:00:00Z",
			"updatedAt": "2025-09-01T12:00:00Z"
		},
		{
			"id": "dom_def456",
			"hostname": "uptime.acme.io",
			"teamId": "team_abc123",
			"createdAt": "2026-01-15T09:30:00Z",
			"updatedAt": "2026-01-15T09:30:00Z"
		}
	]
}
```

### Response Fields

| Field                 | Type   | Description                                         |
| --------------------- | ------ | --------------------------------------------------- |
| `domains`             | array  | List of team domains                                |
| `domains[].id`        | string | Unique domain identifier                            |
| `domains[].hostname`  | string | The custom domain hostname                          |
| `domains[].teamId`    | string | Team ID this domain belongs to                      |
| `domains[].createdAt` | string | ISO 8601 timestamp when the domain was added        |
| `domains[].updatedAt` | string | ISO 8601 timestamp when the domain was last updated |

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `team-domains:read` scope |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["domains"],
	"properties": {
		"domains": {
			"type": "array",
			"items": {
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
