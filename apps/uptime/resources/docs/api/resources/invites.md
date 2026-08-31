---
title: Invites
description: Create and manage team invitations. Invite new members via email.
section:
  title: API Resources
  order: 5
order: 11
lastUpdated: 2026-02-14
---

Manage team invitations to onboard new members. Invites are sent via email and expire after 7 days if not accepted.

## GET /api/v1/invites

Returns all pending and accepted invitations for your team.

### Required Scope

`invites:read`

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/invites \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
[
	{
		"id": "inv_abc123",
		"email": "alice@example.com",
		"senderId": "usr_xyz789",
		"teamId": "team_def456",
		"acceptedAt": "2026-02-10T14:30:00Z",
		"createdAt": "2026-02-08T09:15:00Z",
		"updatedAt": "2026-02-10T14:30:00Z"
	},
	{
		"id": "inv_def456",
		"email": "bob@example.com",
		"senderId": "usr_xyz789",
		"teamId": "team_def456",
		"acceptedAt": null,
		"createdAt": "2026-02-12T11:00:00Z",
		"updatedAt": "2026-02-12T11:00:00Z"
	}
]
```

### Response Fields

| Field        | Type           | Description                                                           |
| ------------ | -------------- | --------------------------------------------------------------------- |
| `id`         | string         | Unique invite identifier                                              |
| `email`      | string         | Email address of the invited user                                     |
| `senderId`   | string         | User ID of the team member who sent the invite                        |
| `teamId`     | string         | Team ID the invite is for                                             |
| `acceptedAt` | string \| null | ISO 8601 timestamp when the invite was accepted, or `null` if pending |
| `createdAt`  | string         | ISO 8601 timestamp when the invite was created                        |
| `updatedAt`  | string         | ISO 8601 timestamp when the invite was last updated                   |

### Possible Errors

| Status | Code           | Description                               |
| ------ | -------------- | ----------------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid API key                |
| 403    | FORBIDDEN      | API key doesn't have `invites:read` scope |
| 429    | RATE_LIMITED   | Too many requests                         |
| 500    | INTERNAL_ERROR | Server error                              |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "array",
	"items": {
		"$ref": "#/$defs/invite"
	},
	"$defs": {
		"invite": {
			"type": "object",
			"required": ["id", "email", "senderId", "teamId", "acceptedAt", "createdAt", "updatedAt"],
			"properties": {
				"id": {
					"type": "string"
				},
				"email": {
					"type": "string",
					"format": "email"
				},
				"senderId": {
					"type": "string"
				},
				"teamId": {
					"type": "string"
				},
				"acceptedAt": {
					"type": ["string", "null"],
					"format": "date-time"
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
```

## POST /api/v1/invites

Create a new invitation and send it to the specified email address. The invite expires after 7 days.

### Required Scope

`invites:write`

### Request Body

| Field   | Type   | Required | Description                                 |
| ------- | ------ | -------- | ------------------------------------------- |
| `email` | string | Yes      | Valid email address of the person to invite |

### Example Request

#### cURL

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/invites \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com"}'
```

### Response

```json
{
	"id": "inv_ghi789",
	"email": "newuser@example.com",
	"senderId": "usr_xyz789",
	"teamId": "team_def456",
	"acceptedAt": null,
	"createdAt": "2026-02-14T16:45:00Z",
	"updatedAt": "2026-02-14T16:45:00Z"
}
```

### Possible Errors

| Status | Code             | Description                                |
| ------ | ---------------- | ------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid email address                      |
| 401    | UNAUTHORIZED     | Missing or invalid API key                 |
| 403    | FORBIDDEN        | API key doesn't have `invites:write` scope |
| 409    | CONFLICT         | An invite for this email already exists    |
| 429    | RATE_LIMITED     | Too many requests                          |
| 500    | INTERNAL_ERROR   | Server error                               |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["email"],
	"properties": {
		"email": {
			"type": "string",
			"format": "email"
		}
	}
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["id", "email", "senderId", "teamId", "acceptedAt", "createdAt", "updatedAt"],
	"properties": {
		"id": {
			"type": "string"
		},
		"email": {
			"type": "string",
			"format": "email"
		},
		"senderId": {
			"type": "string"
		},
		"teamId": {
			"type": "string"
		},
		"acceptedAt": {
			"type": ["string", "null"],
			"format": "date-time"
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

## DELETE /api/v1/invites/:id

Revoke a pending invitation. This prevents the invited user from joining the team using this invite.

### Required Scope

`invites:write`

### Path Parameters

| Parameter | Type   | Description             |
| --------- | ------ | ----------------------- |
| `id`      | string | The invite ID to delete |

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/invites/inv_ghi789 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"deleted": true
}
```

### Possible Errors

| Status | Code           | Description                                |
| ------ | -------------- | ------------------------------------------ |
| 401    | UNAUTHORIZED   | Missing or invalid API key                 |
| 403    | FORBIDDEN      | API key doesn't have `invites:write` scope |
| 404    | NOT_FOUND      | Invite not found                           |
| 429    | RATE_LIMITED   | Too many requests                          |
| 500    | INTERNAL_ERROR | Server error                               |

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
