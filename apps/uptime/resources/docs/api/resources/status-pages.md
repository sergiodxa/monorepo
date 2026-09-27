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

<!-- operation: statusPagesIndex -->

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

## POST /api/v1/status-pages

Creates a new status page.

<!-- operation: statusPagesCreate -->

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

## GET /api/v1/status-pages/:id

Returns a single status page with the ids of its attached HTTP monitors and cron jobs.

<!-- operation: statusPageShow -->

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

## PUT /api/v1/status-pages/:id

Updates an existing status page.

<!-- operation: statusPageUpdate -->

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

## DELETE /api/v1/status-pages/:id

Deletes a status page and its monitor and cron job attachments.

<!-- operation: statusPageDestroy -->

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

## PUT /api/v1/status-pages/:id/monitors

Replaces the HTTP monitors and cron jobs attached to a status page. The lists you send become the page's full set of attachments: a list you omit, or send empty, detaches everything of that kind.

<!-- operation: statusPageMonitors -->

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
