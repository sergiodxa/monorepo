---
title: Status Pages
description: Create and manage public status pages. Associate monitors and customize appearance.
section:
  title: API Resources
  order: 5
order: 8
lastUpdated: 2026-09-05
---

Status pages provide a public-facing view of your service health. Associate monitors and cron jobs to display their status to your users.

## GET /api/v1/status-pages

Returns the status pages for your team. This endpoint is paginated; see [Pagination](/docs/api/pagination) for how to page through the full list.

### Required Scope

`status-pages:read`

### Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

### Example Request

#### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/status-pages?perPage=25" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
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
				"createdAt": 1770710400000,
				"updatedAt": 1771079400000
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
			"total": 28
		}
	}
}
```

Fetch a single status page to see the monitors and cron jobs attached to it.

The cursors for this page arrive in `meta.pagination`:

| Field                     | Type           | Description                                        |
| ------------------------- | -------------- | -------------------------------------------------- |
| `meta.pagination.next`    | string \| null | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`    | string \| null | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage` | integer        | Results this page was built with                   |
| `meta.pagination.total`   | integer        | Status pages matching, across every page           |

### Possible Errors

| Status | Type           | Description                                             |
| ------ | -------------- | ------------------------------------------------------- |
| 400    | `bad-request`  | Invalid or malformed cursor, or `perPage` outside 1-200 |
| 401    | `unauthorized` | Missing or invalid API key                              |
| 403    | `forbidden`    | API key doesn't have `status-pages:read` scope          |
| 500    | `internal`     | The page of results could not be read                   |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["statusPages"],
			"properties": {
				"statusPages": {
					"type": "array",
					"items": {
						"$ref": "#/$defs/statusPage"
					}
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" },
				"pagination": {
					"type": "object",
					"required": ["next", "prev", "perPage"],
					"properties": {
						"next": { "type": ["string", "null"] },
						"prev": { "type": ["string", "null"] },
						"perPage": { "type": "integer" },
						"total": { "type": "integer" }
					}
				}
			}
		}
	},
	"$defs": {
		"statusPage": {
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
				"updatedAt"
			],
			"properties": {
				"id": { "type": "string", "pattern": "^sp_[a-zA-Z0-9]+$" },
				"name": { "type": "string", "minLength": 1, "maxLength": 255 },
				"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
				"title": { "type": "string", "minLength": 1, "maxLength": 255 },
				"description": { "type": ["string", "null"], "maxLength": 500 },
				"logoUrl": { "type": ["string", "null"], "format": "uri" },
				"customDomain": { "type": ["string", "null"] },
				"isPublic": { "type": "boolean" },
				"showOverallStatus": { "type": "boolean" },
				"createdAt": { "type": "integer" },
				"updatedAt": { "type": "integer" }
			}
		}
	}
}
```

## POST /api/v1/status-pages

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
curl -X POST https://uptime.sergiodxa.com/api/v1/status-pages \
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

### Response

Returns `201 Created`. Attach monitors and cron jobs afterwards with [`PUT /api/v1/status-pages/:id/monitors`](#put-apiv1status-pagesidmonitors).

```json
{
	"data": {
		"statusPage": {
			"id": "sp_abc123",
			"name": "Production Status",
			"slug": "production-status",
			"title": "Service Status",
			"description": "Real-time status of our production services",
			"logoUrl": "https://example.com/logo.png",
			"customDomain": null,
			"isPublic": true,
			"showOverallStatus": true,
			"createdAt": 1770710400000,
			"updatedAt": 1770710400000
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                     |
| ------ | ------------------ | ----------------------------------------------- |
| 400    | `validation-error` | Invalid request body or validation failed       |
| 401    | `unauthorized`     | Missing or invalid API key                      |
| 403    | `forbidden`        | API key doesn't have `status-pages:write` scope |
| 409    | `conflict`         | Another status page already uses this slug      |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["name", "slug"],
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
		"title": { "type": "string", "minLength": 1, "maxLength": 255 },
		"description": { "type": "string", "maxLength": 500 },
		"logoUrl": { "type": "string", "format": "uri" },
		"customDomain": { "type": "string" },
		"isPublic": { "type": "boolean", "default": true },
		"showOverallStatus": { "type": "boolean", "default": true }
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
			"required": ["statusPage"],
			"properties": {
				"statusPage": {
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
						"updatedAt"
					],
					"properties": {
						"id": { "type": "string", "pattern": "^sp_[a-zA-Z0-9]+$" },
						"name": { "type": "string", "minLength": 1, "maxLength": 255 },
						"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
						"title": { "type": "string", "minLength": 1, "maxLength": 255 },
						"description": { "type": ["string", "null"], "maxLength": 500 },
						"logoUrl": { "type": ["string", "null"], "format": "uri" },
						"customDomain": { "type": ["string", "null"] },
						"isPublic": { "type": "boolean" },
						"showOverallStatus": { "type": "boolean" },
						"createdAt": { "type": "integer" },
						"updatedAt": { "type": "integer" }
					}
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## GET /api/v1/status-pages/:id

Returns a single status page with the ids of its attached HTTP monitors and cron jobs.

### Required Scope

`status-pages:read`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Example Request

#### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"statusPage": {
			"id": "sp_abc123",
			"name": "Production Status",
			"slug": "production-status",
			"title": "Service Status",
			"description": "Real-time status of our production services",
			"logoUrl": "https://example.com/logo.png",
			"customDomain": "status.example.com",
			"isPublic": true,
			"showOverallStatus": true,
			"createdAt": 1770710400000,
			"updatedAt": 1771079400000,
			"monitors": ["mon_def456", "mon_ghi789"],
			"cronJobs": ["cron_jkl012"]
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| 400    | `validation-error` | Malformed status page id                       |
| 401    | `unauthorized`     | Missing or invalid API key                     |
| 403    | `forbidden`        | API key doesn't have `status-pages:read` scope |
| 404    | `not-found`        | Status page not found                          |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"required": ["data", "meta"],
	"properties": {
		"data": {
			"type": "object",
			"required": ["statusPage"],
			"properties": {
				"statusPage": {
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
						"id": { "type": "string", "pattern": "^sp_[a-zA-Z0-9]+$" },
						"name": { "type": "string", "minLength": 1, "maxLength": 255 },
						"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
						"title": { "type": "string", "minLength": 1, "maxLength": 255 },
						"description": { "type": ["string", "null"], "maxLength": 500 },
						"logoUrl": { "type": ["string", "null"], "format": "uri" },
						"customDomain": { "type": ["string", "null"] },
						"isPublic": { "type": "boolean" },
						"showOverallStatus": { "type": "boolean" },
						"createdAt": { "type": "integer" },
						"updatedAt": { "type": "integer" },
						"monitors": {
							"type": "array",
							"items": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" }
						},
						"cronJobs": {
							"type": "array",
							"items": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" }
						}
					}
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## PUT /api/v1/status-pages/:id

Updates an existing status page.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Request Body

All fields are optional. Only provided fields are updated; fields outside this table are ignored.

| Field               | Type    | Description                                                        |
| ------------------- | ------- | ------------------------------------------------------------------ |
| `name`              | string  | Internal name (1-255 characters)                                   |
| `slug`              | string  | URL-friendly identifier (lowercase letters, numbers, hyphens only) |
| `title`             | string  | Display title (1-255 characters)                                   |
| `description`       | string  | Page description (max 500 characters); `null` clears it            |
| `logoUrl`           | string  | URL to your logo image; `null` clears it                           |
| `customDomain`      | string  | Custom domain for the status page; `null` clears it                |
| `isPublic`          | boolean | Whether the page is publicly accessible                            |
| `showOverallStatus` | boolean | Whether to display the overall status indicator                    |

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Service Status",
    "description": "Current status of all our services",
    "customDomain": "status.example.com"
  }'
```

### Response

The updated status page, with the ids of its attached HTTP monitors and cron jobs.

```json
{
	"data": {
		"statusPage": {
			"id": "sp_abc123",
			"name": "Production Status",
			"slug": "production-status",
			"title": "Updated Service Status",
			"description": "Current status of all our services",
			"logoUrl": "https://example.com/logo.png",
			"customDomain": "status.example.com",
			"isPublic": true,
			"showOverallStatus": true,
			"createdAt": 1770710400000,
			"updatedAt": 1771084800000,
			"monitors": [],
			"cronJobs": []
		}
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                              |
| ------ | ------------------ | -------------------------------------------------------- |
| 400    | `validation-error` | Malformed status page id or invalid request body         |
| 401    | `unauthorized`     | Missing or invalid API key                               |
| 403    | `forbidden`        | API key doesn't have `status-pages:write` scope          |
| 404    | `not-found`        | Status page not found                                    |
| 409    | `conflict`         | Another status page already uses this slug               |
| 500    | `internal-error`   | The change was saved but the page could not be read back |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
		"title": { "type": "string", "minLength": 1, "maxLength": 255 },
		"description": { "type": ["string", "null"], "maxLength": 500 },
		"logoUrl": { "type": ["string", "null"], "format": "uri" },
		"customDomain": { "type": ["string", "null"] },
		"isPublic": { "type": "boolean" },
		"showOverallStatus": { "type": "boolean" }
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
			"required": ["statusPage"],
			"properties": {
				"statusPage": {
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
						"id": { "type": "string", "pattern": "^sp_[a-zA-Z0-9]+$" },
						"name": { "type": "string", "minLength": 1, "maxLength": 255 },
						"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
						"title": { "type": "string", "minLength": 1, "maxLength": 255 },
						"description": { "type": ["string", "null"], "maxLength": 500 },
						"logoUrl": { "type": ["string", "null"], "format": "uri" },
						"customDomain": { "type": ["string", "null"] },
						"isPublic": { "type": "boolean" },
						"showOverallStatus": { "type": "boolean" },
						"createdAt": { "type": "integer" },
						"updatedAt": { "type": "integer" },
						"monitors": {
							"type": "array",
							"items": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" }
						},
						"cronJobs": {
							"type": "array",
							"items": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" }
						}
					}
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## DELETE /api/v1/status-pages/:id

Deletes a status page and its monitor and cron job attachments.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Example Request

#### cURL

```bash
curl -X DELETE https://uptime.sergiodxa.com/api/v1/status-pages/sp_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

Returns `200 OK`:

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

### Possible Errors

| Status | Type               | Description                                     |
| ------ | ------------------ | ----------------------------------------------- |
| 400    | `validation-error` | Malformed status page id                        |
| 401    | `unauthorized`     | Missing or invalid API key                      |
| 403    | `forbidden`        | API key doesn't have `status-pages:write` scope |
| 404    | `not-found`        | Status page not found                           |

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
				"deleted": { "const": true }
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## PUT /api/v1/status-pages/:id/monitors

Replaces the HTTP monitors and cron jobs attached to a status page. The lists you send become the page's full set of attachments: a list you omit, or send empty, detaches everything of that kind.

### Required Scope

`status-pages:write`

### Path Parameters

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `id`      | string | The status page ID |

### Request Body

| Field        | Type  | Required | Description                                          |
| ------------ | ----- | -------- | ---------------------------------------------------- |
| `monitorIds` | array | No       | HTTP monitor ids (`mon_…`) to attach (default: `[]`) |
| `cronJobIds` | array | No       | Cron job ids (`cron_…`) to attach (default: `[]`)    |

An id listed more than once is attached once.

### Example Request

#### cURL

```bash
curl -X PUT https://uptime.sergiodxa.com/api/v1/status-pages/sp_abc123/monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "monitorIds": ["mon_def456", "mon_ghi789"],
    "cronJobIds": ["cron_jkl012"]
  }'
```

### Response

The status page, with the attached ids beside it in `monitors` and `cronJobs`.

```json
{
	"data": {
		"statusPage": {
			"id": "sp_abc123",
			"name": "Production Status",
			"slug": "production-status",
			"title": "Service Status",
			"description": "Real-time status of our production services",
			"logoUrl": "https://example.com/logo.png",
			"customDomain": "status.example.com",
			"isPublic": true,
			"showOverallStatus": true,
			"createdAt": 1770710400000,
			"updatedAt": 1771079400000
		},
		"monitors": ["mon_def456", "mon_ghi789"],
		"cronJobs": ["cron_jkl012"]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Possible Errors

| Status | Type               | Description                                                                                |
| ------ | ------------------ | ------------------------------------------------------------------------------------------ |
| 400    | `validation-error` | Malformed status page id, invalid request body, or an id without the `mon_`/`cron_` prefix |
| 401    | `unauthorized`     | Missing or invalid API key                                                                 |
| 403    | `forbidden`        | API key doesn't have `status-pages:write` scope                                            |
| 404    | `not-found`        | Status page not found, or a monitor or cron job id names nothing in your team              |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"monitorIds": {
			"type": "array",
			"items": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" },
			"default": []
		},
		"cronJobIds": {
			"type": "array",
			"items": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" },
			"default": []
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
			"required": ["statusPage", "monitors", "cronJobs"],
			"properties": {
				"statusPage": {
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
						"updatedAt"
					],
					"properties": {
						"id": { "type": "string", "pattern": "^sp_[a-zA-Z0-9]+$" },
						"name": { "type": "string", "minLength": 1, "maxLength": 255 },
						"slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
						"title": { "type": "string", "minLength": 1, "maxLength": 255 },
						"description": { "type": ["string", "null"], "maxLength": 500 },
						"logoUrl": { "type": ["string", "null"], "format": "uri" },
						"customDomain": { "type": ["string", "null"] },
						"isPublic": { "type": "boolean" },
						"showOverallStatus": { "type": "boolean" },
						"createdAt": { "type": "integer" },
						"updatedAt": { "type": "integer" }
					}
				},
				"monitors": {
					"type": "array",
					"items": { "type": "string", "pattern": "^mon_[a-zA-Z0-9]+$" }
				},
				"cronJobs": {
					"type": "array",
					"items": { "type": "string", "pattern": "^cron_[a-zA-Z0-9]+$" }
				}
			}
		},
		"meta": {
			"type": "object",
			"required": ["requestId", "timestamp"],
			"properties": {
				"requestId": { "type": "string", "format": "uuid" },
				"timestamp": { "type": "string", "format": "date-time" }
			}
		}
	}
}
```

## Response Fields

| Field               | Type           | Description                                        |
| ------------------- | -------------- | -------------------------------------------------- |
| `id`                | string         | Unique status page identifier                      |
| `name`              | string         | Internal name                                      |
| `slug`              | string         | URL-friendly identifier                            |
| `title`             | string         | Display title                                      |
| `description`       | string \| null | Page description                                   |
| `logoUrl`           | string \| null | URL to the logo image                              |
| `customDomain`      | string \| null | Custom domain if configured                        |
| `isPublic`          | boolean        | Whether the page is publicly accessible            |
| `showOverallStatus` | boolean        | Whether the overall status indicator is displayed  |
| `createdAt`         | integer        | Unix timestamp in milliseconds of creation         |
| `updatedAt`         | integer        | Unix timestamp in milliseconds of the last update  |
| `monitors`          | array          | Attached HTTP monitor ids, on a single status page |
| `cronJobs`          | array          | Attached cron job IDs, on a single status page     |
