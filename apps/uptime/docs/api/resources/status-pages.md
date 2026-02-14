---
title: Status Pages
description: Create and manage public status pages. Associate monitors and customize appearance.
section:
  title: API Resources
  order: 5
order: 7
lastUpdated: 2026-02-14
---

Status pages provide a public-facing view of your service health. Associate monitors and cron jobs to display their status to your users.

## GET /v1/status-pages

Returns all status pages for your team.

### Required Scope

`status-pages:read`

### Example Request

#### cURL

```bash
curl https://api.uptime.example.com/v1/status-pages \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"statusPages": [
		{
			"id": "sp_abc123",
			"name": "Production Status",
			"slug": "production-status",
			"title": "Production Status",
			"description": "Real-time status of our production services",
			"logoUrl": "https://example.com/logo.png",
			"customDomain": "status.example.com",
			"isPublic": true,
			"showOverallStatus": true,
			"createdAt": "2026-02-10T08:00:00Z",
			"updatedAt": "2026-02-14T12:30:00Z",
			"monitors": [],
			"cronJobs": []
		}
	]
}
```

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `status-pages:read` scope |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

## POST /v1/status-pages

Creates a new status page.

### Required Scope

`status-pages:write`

### Request Body

| Field               | Type    | Required | Description                                                        |
| ------------------- | ------- | -------- | ------------------------------------------------------------------ |
| `name`              | string  | Yes      | Internal name (1-255 characters)                                   |
| `slug`              | string  | Yes      | URL-friendly identifier (lowercase letters, numbers, hyphens only) |
| `title`             | string  | No       | Display title (1-255 characters, defaults to `name`)               |
| `description`       | string  | No       | Page description (max 500 characters)                              |
| `logoUrl`           | string  | No       | URL to your logo image                                             |
| `customDomain`      | string  | No       | Custom domain for the status page                                  |
| `isPublic`          | boolean | No       | Whether the page is publicly accessible (default: `true`)          |
| `showOverallStatus` | boolean | No       | Whether to display the overall status indicator (default: `true`)  |

### Example Request

#### cURL

```bash
curl -X POST https://api.uptime.example.com/v1/status-pages \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Status",
    "slug": "production-status",
    "title": "Service Status",
    "description": "Real-time status of our production services",
    "logoUrl": "https://example.com/logo.png",
    "isPublic": true,
    "showOverallStatus": true
  }'
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages", {
	method: "POST",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		name: "Production Status",
		slug: "production-status",
		title: "Service Status",
		description: "Real-time status of our production services",
		logoUrl: "https://example.com/logo.png",
		isPublic: true,
		showOverallStatus: true,
	}),
});

const data = await response.json();
```

### Response

```json
{
	"id": "sp_abc123",
	"name": "Production Status",
	"slug": "production-status",
	"title": "Service Status",
	"description": "Real-time status of our production services",
	"logoUrl": "https://example.com/logo.png",
	"customDomain": null,
	"isPublic": true,
	"showOverallStatus": true,
	"createdAt": "2026-02-14T12:00:00Z",
	"updatedAt": "2026-02-14T12:00:00Z",
	"monitors": [],
	"cronJobs": []
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or validation failed       |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `status-pages:write` scope |
| 409    | CONFLICT         | A status page with this slug already exists     |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

## GET /v1/status-pages/:id

Returns a single status page with its associated monitors and cron jobs.

### Required Scope

`status-pages:read`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Example Request

#### cURL

```bash
curl https://api.uptime.example.com/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages/sp_abc123", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});

const data = await response.json();
```

### Response

```json
{
	"id": "sp_abc123",
	"name": "Production Status",
	"slug": "production-status",
	"title": "Service Status",
	"description": "Real-time status of our production services",
	"logoUrl": "https://example.com/logo.png",
	"customDomain": "status.example.com",
	"isPublic": true,
	"showOverallStatus": true,
	"createdAt": "2026-02-10T08:00:00Z",
	"updatedAt": "2026-02-14T12:30:00Z",
	"monitors": [
		{
			"id": "mon_def456",
			"name": "Production API",
			"status": "up"
		},
		{
			"id": "mon_ghi789",
			"name": "Marketing Website",
			"status": "up"
		}
	],
	"cronJobs": [
		{
			"id": "cron_jkl012",
			"name": "Daily Backup",
			"status": "healthy"
		}
	]
}
```

### Possible Errors

| Status | Code           | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                     |
| 403    | FORBIDDEN      | API key doesn't have `status-pages:read` scope |
| 404    | NOT_FOUND      | Status page not found                          |
| 429    | RATE_LIMITED   | Too many requests                              |
| 500    | INTERNAL_ERROR | Server error                                   |

## PUT /v1/status-pages/:id

Updates an existing status page.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Request Body

All fields are optional. Only provided fields will be updated.

| Field               | Type    | Description                                                        |
| ------------------- | ------- | ------------------------------------------------------------------ |
| `name`              | string  | Internal name (1-255 characters)                                   |
| `slug`              | string  | URL-friendly identifier (lowercase letters, numbers, hyphens only) |
| `title`             | string  | Display title (1-255 characters)                                   |
| `description`       | string  | Page description (max 500 characters)                              |
| `logoUrl`           | string  | URL to your logo image                                             |
| `customDomain`      | string  | Custom domain for the status page                                  |
| `isPublic`          | boolean | Whether the page is publicly accessible                            |
| `showOverallStatus` | boolean | Whether to display the overall status indicator                    |

### Example Request

#### cURL

```bash
curl -X PUT https://api.uptime.example.com/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Service Status",
    "description": "Current status of all our services",
    "customDomain": "status.example.com"
  }'
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages/sp_abc123", {
	method: "PUT",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		title: "Updated Service Status",
		description: "Current status of all our services",
		customDomain: "status.example.com",
	}),
});

const data = await response.json();
```

### Response

```json
{
	"id": "sp_abc123",
	"name": "Production Status",
	"slug": "production-status",
	"title": "Updated Service Status",
	"description": "Current status of all our services",
	"logoUrl": "https://example.com/logo.png",
	"customDomain": "status.example.com",
	"isPublic": true,
	"showOverallStatus": true,
	"createdAt": "2026-02-10T08:00:00Z",
	"updatedAt": "2026-02-14T14:00:00Z",
	"monitors": [],
	"cronJobs": []
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or validation failed       |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `status-pages:write` scope |
| 404    | NOT_FOUND        | Status page not found                           |
| 409    | CONFLICT         | A status page with this slug already exists     |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

## DELETE /v1/status-pages/:id

Deletes a status page.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Example Request

#### cURL

```bash
curl -X DELETE https://api.uptime.example.com/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages/sp_abc123", {
	method: "DELETE",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});
```

### Response

Returns `204 No Content` on success.

### Possible Errors

| Status | Code           | Description                                     |
| ------ | -------------- | ----------------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                      |
| 403    | FORBIDDEN      | API key doesn't have `status-pages:write` scope |
| 404    | NOT_FOUND      | Status page not found                           |
| 429    | RATE_LIMITED   | Too many requests                               |
| 500    | INTERNAL_ERROR | Server error                                    |

## PUT /v1/status-pages/:id/monitors

Updates the monitors and cron jobs associated with a status page.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Request Body

| Field        | Type  | Required | Description                          |
| ------------ | ----- | -------- | ------------------------------------ |
| `monitorIds` | array | Yes      | Array of monitor UUIDs to associate  |
| `cronJobIds` | array | Yes      | Array of cron job UUIDs to associate |

### Example Request

#### cURL

```bash
curl -X PUT https://api.uptime.example.com/v1/status-pages/sp_abc123/monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "monitorIds": ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
    "cronJobIds": ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
  }'
```

#### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/status-pages/sp_abc123/monitors", {
	method: "PUT",
	headers: {
		Authorization: "Bearer uptime_your_api_key",
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		monitorIds: ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
		cronJobIds: ["7c9e6679-7425-40de-944b-e07fc1f90ae7"],
	}),
});

const data = await response.json();
```

### Response

```json
{
	"id": "sp_abc123",
	"name": "Production Status",
	"slug": "production-status",
	"title": "Service Status",
	"description": "Real-time status of our production services",
	"logoUrl": "https://example.com/logo.png",
	"customDomain": "status.example.com",
	"isPublic": true,
	"showOverallStatus": true,
	"createdAt": "2026-02-10T08:00:00Z",
	"updatedAt": "2026-02-14T15:00:00Z",
	"monitors": [
		{
			"id": "mon_def456",
			"name": "Production API",
			"status": "up"
		},
		{
			"id": "mon_ghi789",
			"name": "Marketing Website",
			"status": "up"
		}
	],
	"cronJobs": [
		{
			"id": "cron_jkl012",
			"name": "Daily Backup",
			"status": "healthy"
		}
	]
}
```

### Possible Errors

| Status | Code             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body or invalid UUIDs           |
| 401    | UNAUTHORIZED     | Missing or invalid API key                      |
| 403    | FORBIDDEN        | API key doesn't have `status-pages:write` scope |
| 404    | NOT_FOUND        | Status page, monitor, or cron job not found     |
| 429    | RATE_LIMITED     | Too many requests                               |
| 500    | INTERNAL_ERROR   | Server error                                    |

## Response Fields

| Field               | Type           | Description                                       |
| ------------------- | -------------- | ------------------------------------------------- |
| `id`                | string         | Unique status page identifier                     |
| `name`              | string         | Internal name                                     |
| `slug`              | string         | URL-friendly identifier                           |
| `title`             | string         | Display title                                     |
| `description`       | string \| null | Page description                                  |
| `logoUrl`           | string \| null | URL to the logo image                             |
| `customDomain`      | string \| null | Custom domain if configured                       |
| `isPublic`          | boolean        | Whether the page is publicly accessible           |
| `showOverallStatus` | boolean        | Whether the overall status indicator is displayed |
| `createdAt`         | string         | ISO 8601 timestamp of creation                    |
| `updatedAt`         | string         | ISO 8601 timestamp of last update                 |
| `monitors`          | array          | Associated monitors with their current status     |
| `cronJobs`          | array          | Associated cron jobs with their current status    |

## JSON Schema

Use this schema to validate status page responses:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": [
		"id",
		"name",
		"slug",
		"title",
		"description",
		"logoUrl",
		"customDomain",
		"isPublic",
		"showOverallStatus",
		"createdAt",
		"updatedAt",
		"monitors",
		"cronJobs"
	],
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
			"type": "string",
			"pattern": "^[a-z0-9-]+$"
		},
		"title": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255
		},
		"description": {
			"type": ["string", "null"],
			"maxLength": 500
		},
		"logoUrl": {
			"type": ["string", "null"],
			"format": "uri"
		},
		"customDomain": {
			"type": ["string", "null"]
		},
		"isPublic": {
			"type": "boolean"
		},
		"showOverallStatus": {
			"type": "boolean"
		},
		"createdAt": {
			"type": "string",
			"format": "date-time"
		},
		"updatedAt": {
			"type": "string",
			"format": "date-time"
		},
		"monitors": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["id", "name", "status"],
				"properties": {
					"id": {
						"type": "string"
					},
					"name": {
						"type": "string"
					},
					"status": {
						"type": "string",
						"enum": ["up", "down", "degraded", "unknown"]
					}
				}
			}
		},
		"cronJobs": {
			"type": "array",
			"items": {
				"type": "object",
				"required": ["id", "name", "status"],
				"properties": {
					"id": {
						"type": "string"
					},
					"name": {
						"type": "string"
					},
					"status": {
						"type": "string",
						"enum": ["healthy", "unhealthy", "unknown"]
					}
				}
			}
		}
	}
}
```
