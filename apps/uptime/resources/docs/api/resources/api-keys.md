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

<!-- operation: apiKeysIndex -->

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
				"keyPrefix": "uptime_a1b2c3d4"
			},
			{
				"id": "key_def456",
				"name": "CI/CD Pipeline",
				"scopes": ["monitors:read"],
				"createdAt": 1770301320000,
				"lastUsedAt": null,
				"expiresAt": 1785974400000,
				"keyPrefix": "uptime_d4e5f6a7"
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
| `data.apiKeys`              | array           | One page of API keys                               |
| `data.apiKeys[].id`         | string          | Unique identifier for the API key                  |
| `data.apiKeys[].name`       | string          | Display name of the API key                        |
| `data.apiKeys[].scopes`     | array           | List of permission scopes granted to this key      |
| `data.apiKeys[].createdAt`  | integer         | Unix timestamp in milliseconds of the creation     |
| `data.apiKeys[].lastUsedAt` | integer \| null | Unix timestamp in milliseconds of the last use     |
| `data.apiKeys[].expiresAt`  | integer \| null | Unix timestamp in milliseconds of the expiration   |
| `data.apiKeys[].keyPrefix`  | string          | First 15 characters of the key, for identification |
| `meta.requestId`            | string          | Identifier for this request                        |
| `meta.timestamp`            | string          | ISO 8601 timestamp of the response                 |
| `meta.pagination.next`      | string \| null  | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`      | string \| null  | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage`   | integer         | Results this page was built with                   |
| `meta.pagination.total`     | integer         | API keys matching, across every page               |

## POST /api/v1/api-keys

Creates a new API key for your team and answers `201 Created`. A key can grant only scopes it holds itself.

> **Warning:** The `key` field in the response contains the full API key value. This is the **only time** the complete key will be shown. Copy and store it in a secure location immediately. If you lose the key, you must delete it and create a new one.

<!-- operation: apiKeysCreate -->

### Request Body

| Field       | Type   | Required | Description                                        |
| ----------- | ------ | -------- | -------------------------------------------------- |
| `name`      | string | Yes      | Display name for the key (1-255 characters)        |
| `scopes`    | array  | Yes      | Permission scopes to grant (at least one required) |
| `expiresAt` | string | No       | Date/time for key expiration (e.g. ISO 8601)       |

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
	"data": {
		"apiKey": {
			"id": "key_ghi789",
			"name": "GitHub Actions",
			"scopes": ["monitors:read", "monitors:write"],
			"createdAt": 1771066800000,
			"lastUsedAt": null,
			"expiresAt": 1802563200000,
			"keyPrefix": "uptime_9f8e7d6c"
		},
		"key": "uptime_9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0"
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T11:00:00.000Z"
	}
}
```

> **Store the `key` value immediately!** It will never be returned again in any API response.

### Response Fields

| Field                    | Type            | Description                                                       |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `data.apiKey.id`         | string          | Unique identifier for the API key                                 |
| `data.apiKey.name`       | string          | Display name of the API key                                       |
| `data.apiKey.scopes`     | array           | List of permission scopes granted to this key                     |
| `data.apiKey.createdAt`  | integer         | Unix timestamp in milliseconds of the creation                    |
| `data.apiKey.lastUsedAt` | integer \| null | Always `null` for newly created keys                              |
| `data.apiKey.expiresAt`  | integer \| null | Unix timestamp in milliseconds of the expiration, `null` for none |
| `data.apiKey.keyPrefix`  | string          | First 15 characters of the key, for identification                |
| `data.key`               | string          | **The full API key value. Only returned once at creation.**       |
| `meta.requestId`         | string          | Identifier for this request                                       |
| `meta.timestamp`         | string          | ISO 8601 timestamp of the response                                |

## DELETE /api/v1/api-keys/:id

Permanently deletes an API key. This action cannot be undone. Any integrations using this key will immediately lose access.

<!-- operation: apiKeyDestroy -->

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
	"data": {
		"deleted": true
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z"
	}
}
```

### Response Fields

| Field          | Type    | Description                          |
| -------------- | ------- | ------------------------------------ |
| `data.deleted` | boolean | Always `true` on successful deletion |
