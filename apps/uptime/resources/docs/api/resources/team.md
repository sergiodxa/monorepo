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

<!-- operation: teamShow -->

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/team \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"team": {
			"id": "team_abc123",
			"name": "Acme Inc",
			"slug": "acme-inc",
			"logo": "https://cdn.example.com/logos/acme.png",
			"ownerId": "usr_xyz789",
			"createdAt": 1749974400000,
			"updatedAt": 1768919400000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Response Fields

| Field                 | Type           | Description                                       |
| --------------------- | -------------- | ------------------------------------------------- |
| `data.team`           | object         | The team                                          |
| `data.team.id`        | string         | Unique team identifier                            |
| `data.team.name`      | string         | Display name of the team                          |
| `data.team.slug`      | string         | URL-friendly team identifier                      |
| `data.team.logo`      | string \| null | URL to the team's logo image                      |
| `data.team.ownerId`   | string         | User ID of the team owner                         |
| `data.team.createdAt` | integer        | Unix timestamp in milliseconds of the creation    |
| `data.team.updatedAt` | integer        | Unix timestamp in milliseconds of the last update |

## PATCH /api/v1/team

Updates the current team's settings with a [JSON merge patch](/docs/api/overview#updating-resources).

<!-- operation: teamPatch -->

### Request Body

Include only the fields you want to change. `null` on `logoUrl` removes the logo; `name` cannot be removed. A `logoUrl` that is not an `https://` URL answers `400` with a `validation-error` at `/logoUrl`.

| Field     | Type           | Required | Description                                                                 |
| --------- | -------------- | -------- | --------------------------------------------------------------------------- |
| `name`    | string         | No       | Team display name (1-255 characters)                                        |
| `logoUrl` | string \| null | No       | URL to the team's logo image (must start with `https://`); `null` clears it |

### Example Request

#### cURL

```bash
curl -X PATCH https://uptime.sergiodxa.com/api/v1/team \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{
    "name": "Acme Corporation",
    "logoUrl": "https://cdn.example.com/logos/acme-new.png"
  }'
```

### Response

```json
{
	"data": {
		"team": {
			"id": "team_abc123",
			"name": "Acme Corporation",
			"slug": "acme-inc",
			"logo": "https://cdn.example.com/logos/acme-new.png",
			"ownerId": "usr_xyz789",
			"createdAt": 1749974400000,
			"updatedAt": 1771065900000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T10:45:00.000Z"
	}
}
```

### Update With PUT

`PUT /api/v1/team` takes the same fields, for integrations written before `PATCH` existed. At least one field must be provided, a field you leave out keeps its value, and `null` is refused, so `PUT` cannot remove the logo.

<!-- operation: teamUpdate -->

## GET /api/v1/memberships

Returns the memberships of the current team.

This endpoint is paginated. See [Pagination](/docs/api/pagination) for how to page through the full list.

<!-- operation: membershipsIndex -->

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

## GET /api/v1/team-domains

Returns the custom domains configured for the team's status pages.

Results arrive a page at a time; follow the `Link` header as described in [Pagination](/docs/api/pagination) to reach every domain.

<!-- operation: teamDomainsIndex -->

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

## POST /api/v1/team-domains

Adds a custom domain for the team's status pages, pending verification. Answers `201 Created`.

<!-- operation: teamDomainsCreate -->

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
	"data": {
		"teamDomain": {
			"id": "dom_ghi789",
			"hostname": "status.example.com",
			"verifiedAt": null,
			"teamId": "team_abc123",
			"createdAt": 1771063200000,
			"updatedAt": 1771063200000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T10:00:00.000Z"
	}
}
```

## DELETE /api/v1/team-domains

Removes a custom domain from the team.

<!-- operation: teamDomainsDestroy -->

### Request Body

| Field | Type   | Required | Description                             |
| ----- | ------ | -------- | --------------------------------------- |
| `id`  | string | Yes      | The domain ID to remove (`dom_` prefix) |

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
	"data": {
		"deleted": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T10:30:00.000Z"
	}
}
```
