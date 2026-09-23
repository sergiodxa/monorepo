---
title: Invites
description: Create and manage team invitations. Invite new members via email.
section:
  title: API Resources
  order: 5
order: 11
lastUpdated: 2026-09-05
---

Manage team invitations to onboard new members. An invite stays open for its email address until it is accepted or revoked.

## GET /api/v1/invites

Returns the pending and accepted invitations for your team.

The list is paginated. See [Pagination](/docs/api/pagination) for how to walk it a page at a time.

### Required Scope

`invites:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl -i "https://uptime.sergiodxa.com/api/v1/invites?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"invites": [
			{
				"id": "inv_abc123",
				"email": "alice@example.com",
				"senderId": "usr_xyz789",
				"teamId": "team_def456",
				"acceptedAt": 1770733800000,
				"createdAt": 1770542100000,
				"updatedAt": 1770733800000
			},
			{
				"id": "inv_def456",
				"email": "bob@example.com",
				"senderId": "usr_xyz789",
				"teamId": "team_def456",
				"acceptedAt": null,
				"createdAt": 1770894000000,
				"updatedAt": 1770894000000
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

| Field                       | Type            | Description                                        |
| --------------------------- | --------------- | -------------------------------------------------- |
| `data.invites`              | array           | One page of invites                                |
| `data.invites[].id`         | string          | Unique invite identifier                           |
| `data.invites[].email`      | string          | Email address of the invited user                  |
| `data.invites[].senderId`   | string          | User ID of the team member who sent the invite     |
| `data.invites[].teamId`     | string          | Team ID the invite is for                          |
| `data.invites[].acceptedAt` | integer \| null | Unix timestamp in milliseconds of the acceptance   |
| `data.invites[].createdAt`  | integer         | Unix timestamp in milliseconds of the creation     |
| `data.invites[].updatedAt`  | integer         | Unix timestamp in milliseconds of the last update  |
| `meta.requestId`            | string          | Identifier for this request                        |
| `meta.timestamp`            | string          | ISO 8601 timestamp of the response                 |
| `meta.pagination.next`      | string \| null  | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`      | string \| null  | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage`   | integer         | Results this page was built with                   |
| `meta.pagination.total`     | integer         | Invites matching, across every page                |

### Possible Errors

| Status | Type           | Description                               |
| ------ | -------------- | ----------------------------------------- |
| 400    | `bad-request`  | Invalid `perPage` or malformed cursor     |
| 401    | `unauthorized` | Missing or invalid API key                |
| 403    | `forbidden`    | API key doesn't have `invites:read` scope |
| 500    | `internal`     | The page of results could not be read     |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["invites"],
			"properties": {
				"invites": {
					"type": "array",
					"items": {
						"type": "object",
						"required": [
							"id",
							"email",
							"senderId",
							"teamId",
							"acceptedAt",
							"createdAt",
							"updatedAt"
						],
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
								"type": ["integer", "null"]
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

## POST /api/v1/invites

Creates a pending invitation for the specified email address. The API records the invite; the invited person joins the team by accepting it. Answers `201 Created`.

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
	"data": {
		"invite": {
			"id": "inv_ghi789",
			"email": "newuser@example.com",
			"senderId": "usr_xyz789",
			"teamId": "team_def456",
			"acceptedAt": null,
			"createdAt": 1771087500000,
			"updatedAt": 1771087500000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T16:45:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                          |
| ------ | ------------------ | ---------------------------------------------------- |
| 400    | `validation-error` | Missing or invalid email address                     |
| 401    | `unauthorized`     | Missing or invalid API key                           |
| 403    | `forbidden`        | API key doesn't have `invites:write` scope           |
| 409    | `conflict`         | This email was already invited (pending or accepted) |

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
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["invite"],
			"properties": {
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
							"type": ["integer", "null"]
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
				}
			}
		}
	}
}
```

## DELETE /api/v1/invites/:id

Revokes a pending invitation, so the invited user can no longer join the team with it. An invite that was already accepted stays in place and answers `409 conflict`.

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
	"data": {
		"deleted": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T17:00:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                |
| ------ | ------------------ | ------------------------------------------ |
| 400    | `validation-error` | Malformed invite id                        |
| 401    | `unauthorized`     | Missing or invalid API key                 |
| 403    | `forbidden`        | API key doesn't have `invites:write` scope |
| 404    | `not-found`        | Invite not found                           |
| 409    | `conflict`         | The invite was already accepted            |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["deleted"],
			"properties": {
				"deleted": {
					"type": "boolean",
					"const": true
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
				}
			}
		}
	}
}
```
