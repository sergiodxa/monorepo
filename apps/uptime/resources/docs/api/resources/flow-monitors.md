---
title: Flow Monitors
description: Create and manage flow monitors. Run a multi-request spec on a schedule and read what each run asserted.
section:
  title: API Resources
  order: 5
order: 5
lastUpdated: 2026-08-31
---

A flow monitor asks a question one HTTP check cannot: does a **sequence** still work? It holds a spec — several HTTP requests with assertions between them — and runs it on a schedule. A run makes HTTP requests, parses URLs, and reads JWTs. Nothing else: there is no browser, no page to render, no script of yours to execute.

Every response on this resource carries the standard envelope — `data` alongside `meta`, which holds the `requestId` to quote in a support request and the `timestamp` the response was written. The schema blocks below describe `data` only.

## The spec is never returned

**`source` is write-only.** You send it on create and update; no endpoint gives it back. A sign-in flow writes a real password into its spec, so a key that may list monitors is not thereby a key that may read the credentials they sign in with — the same reading this API already applies to an alert's webhook URL and secret.

Read a monitor's spec in the dashboard, where a signed-in member is standing in front of it. To keep a copy alongside your own configuration, keep the text you sent.

## What a flow may reach

**A flow only drives a domain your team has verified.** The hosts a spec names are resolved against the team's verified domains on every write and again on every run: verifying `example.com` covers `app.example.com`, but nothing at `example.net`. Two things follow, and both are refusals rather than warnings:

- A spec naming a host no verified domain covers is refused, naming the host.
- A spec naming **no** host at all is refused too. Every URL a flow requests has to be written into the spec, because a URL assembled at run time cannot be checked against anything.

The check runs on `POST` and on a `PUT` that carries a new `source`, so a monitor cannot be edited onto a host it could not have been created on. Un-verifying a domain closes this endpoint to it on the very next call.

## Intervals are a fixed list

A flow run costs orders of magnitude more than a single ping, so `intervalSeconds` is one of seven priced values rather than any number in a range:

`900`, `1800`, `3600`, `10800`, `21600`, `43200`, `86400`

Anything else is refused. Nothing is rounded to the nearest allowed value — a monitor you believed ran every minute and actually ran hourly is a worse outcome than a `400`.

## Scopes

Flow monitors are read with `flow-monitors:read` and written with `flow-monitors:write`.

## The flow monitor object

```json
{
	"id": "flow_abc123",
	"name": "Sign in and read profile",
	"intervalSeconds": 3600,
	"isEnabled": true,
	"lastCheckedAt": 1787000000000,
	"lastStatus": "up",
	"createdAt": 1786300000000,
	"updatedAt": 1786400000000
}
```

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"id": { "type": "string", "description": "Unique identifier for the flow monitor" },
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Human-readable name for the monitor"
		},
		"intervalSeconds": {
			"type": "integer",
			"enum": [900, 1800, 3600, 10800, 21600, 43200, 86400],
			"default": 3600,
			"description": "How often the flow runs"
		},
		"isEnabled": {
			"type": "boolean",
			"default": true,
			"description": "Whether the flow runs on its interval"
		},
		"lastCheckedAt": {
			"type": ["integer", "null"],
			"description": "When the flow last ran, in milliseconds since the epoch"
		},
		"lastStatus": {
			"type": ["string", "null"],
			"enum": ["up", "down", "error", null],
			"description": "What the last run concluded. `up` means every assertion held; `down` means one failed, so the flow is broken; `error` means the run could not find out — a spec that will not parse, or a host outside the team's verified domains. Null until the first run."
		},
		"createdAt": { "type": "integer", "description": "When the monitor was created" },
		"updatedAt": { "type": "integer", "description": "When the monitor was last updated" }
	},
	"required": [
		"id",
		"name",
		"intervalSeconds",
		"isEnabled",
		"lastCheckedAt",
		"lastStatus",
		"createdAt",
		"updatedAt"
	]
}
```

`source` is absent from this object by design. See [The spec is never returned](#the-spec-is-never-returned).

## List All Flow Monitors

Retrieves all flow monitors for your team, most recently created first.

```
GET /api/v1/flow-monitors
```

**Required Scope:** `flow-monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"flowMonitors": [
			{
				"id": "flow_abc123",
				"name": "Sign in and read profile",
				"intervalSeconds": 3600,
				"isEnabled": true,
				"lastCheckedAt": 1787000000000,
				"lastStatus": "up",
				"createdAt": 1786300000000,
				"updatedAt": 1786400000000
			}
		]
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

The response is not paginated: a team's flow monitors are its configuration, not its history.

### Errors

| Status | Code         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key               |
| 403    | FORBIDDEN    | API key lacks `flow-monitors:read` scope |

## Create a Flow Monitor

Creates a flow monitor. The spec is checked before anything is stored: it has to parse, and every host it names has to be covered by one of the team's verified domains. A refused create leaves no row behind.

A new monitor is scheduled for its first run on the next cron tick, so it reports a status straight away rather than after one silent interval.

The response is `201 Created`.

```
POST /api/v1/flow-monitors
```

**Required Scope:** `flow-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                                        |
| ----------------- | ------- | -------- | ------------------------------------------------------------------ |
| `name`            | string  | Yes      | Monitor name (1-255 characters)                                    |
| `source`          | string  | Yes      | The spec text, up to 20000 characters. Stored, never returned.     |
| `intervalSeconds` | integer | No       | One of 900, 1800, 3600, 10800, 21600, 43200, 86400 (default: 3600) |
| `isEnabled`       | boolean | No       | Whether the flow runs on its interval (default: true)              |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sign in and read profile",
    "source": "use http\ntest \"a member can sign in and read their profile\" {\n\twhen {\n\t\tlet session = http.post \"https://app.example.com/login\" { email: \"probe@example.com\", password: \"redacted\" }\n\t\tlet profile = http.get \"https://app.example.com/me\"\n\t}\n\tthen {\n\t\texpect session.status == 200\n\t\texpect profile.body.email == \"probe@example.com\"\n\t}\n}",
    "intervalSeconds": 3600
  }'
```

### Response

```json
{
	"data": {
		"flowMonitor": {
			"id": "flow_abc123",
			"name": "Sign in and read profile",
			"intervalSeconds": 3600,
			"isEnabled": true,
			"lastCheckedAt": null,
			"lastStatus": null,
			"createdAt": 1786400000000,
			"updatedAt": 1786400000000
		}
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

The spec you just sent is not echoed back.

### Rejected: an interval that is not on the list

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Every minute", "source": "...", "intervalSeconds": 60 }'
```

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Expected one of: 900, 1800, 3600, 10800, 21600, 43200, 86400"
	}
}
```

### Rejected: a host no verified domain covers

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Somebody else s site",
    "source": "use http\ntest \"reaches elsewhere\" {\n\twhen {\n\t\tlet response = http.get \"https://victim.example.net/login\"\n\t}\n}"
  }'
```

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "This flow reaches victim.example.net, which no verified domain on this team covers. A flow monitor can only drive a domain the team has verified."
	}
}
```

A spec that names no host at all is refused the same way, with:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "This flow names no host to reach. Every URL it requests has to be written in the spec, so it can be checked against the team's verified domains."
	}
}
```

### Errors

| Status | Code             | Description                                                                            |
| ------ | ---------------- | -------------------------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid body, an unlisted interval, a spec that will not parse, or an unreachable host |
| 401    | UNAUTHORIZED     | Missing or invalid API key                                                             |
| 403    | FORBIDDEN        | API key lacks `flow-monitors:write` scope                                              |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"source": {
			"type": "string",
			"minLength": 1,
			"maxLength": 20000,
			"description": "The spec text. Stored so the flow can be run, and never returned by any endpoint."
		},
		"intervalSeconds": {
			"type": "integer",
			"enum": [900, 1800, 3600, 10800, 21600, 43200, 86400],
			"default": 3600
		},
		"isEnabled": { "type": "boolean", "default": true }
	},
	"required": ["name", "source"]
}
```

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"flowMonitor": { "$comment": "See “The flow monitor object” above" }
			},
			"required": ["flowMonitor"]
		}
	},
	"required": ["data"]
}
```

## Get a Flow Monitor

Retrieves a single flow monitor by ID.

```
GET /api/v1/flow-monitors/:flowMonitorId
```

**Required Scope:** `flow-monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors/flow_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"flowMonitor": {
			"id": "flow_abc123",
			"name": "Sign in and read profile",
			"intervalSeconds": 3600,
			"isEnabled": true,
			"lastCheckedAt": 1787000000000,
			"lastStatus": "up",
			"createdAt": 1786300000000,
			"updatedAt": 1786400000000
		}
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

The detail response carries no more than the list response does: `source` is withheld from both, so neither is the place to read a spec back.

### Errors

| Status | Code         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key               |
| 403    | FORBIDDEN    | API key lacks `flow-monitors:read` scope |
| 404    | NOT_FOUND    | Flow monitor not found                   |

A monitor belonging to another team is `404`, not `403`: an id you may not read is an id that does not exist.

## Update a Flow Monitor

Updates a flow monitor's editable fields. Every field is optional; only the ones you send change.

Sending `source` replaces the spec, and the replacement goes through the same verified-domain check a create does. Sending `intervalSeconds` or `isEnabled` reschedules the monitor in the same write, so the next run honours the new setting rather than the old one.

```
PUT /api/v1/flow-monitors/:flowMonitorId
```

**Required Scope:** `flow-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                        |
| ----------------- | ------- | -------- | -------------------------------------------------- |
| `name`            | string  | No       | Monitor name (1-255 characters)                    |
| `source`          | string  | No       | Replacement spec text, up to 20000 characters      |
| `intervalSeconds` | integer | No       | One of 900, 1800, 3600, 10800, 21600, 43200, 86400 |
| `isEnabled`       | boolean | No       | Whether the flow runs on its interval              |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors/flow_abc123 \
  -X PUT \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ "intervalSeconds": 21600, "isEnabled": false }'
```

### Response

```json
{
	"data": {
		"flowMonitor": {
			"id": "flow_abc123",
			"name": "Sign in and read profile",
			"intervalSeconds": 21600,
			"isEnabled": false,
			"lastCheckedAt": 1787000000000,
			"lastStatus": "up",
			"createdAt": 1786300000000,
			"updatedAt": 1787003600000
		}
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

A refused update changes nothing: the stored spec, interval and schedule are exactly what they were before the call.

### Errors

| Status | Code             | Description                                                                           |
| ------ | ---------------- | ------------------------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid body, an unlisted interval, or a replacement spec reaching an unverified host |
| 401    | UNAUTHORIZED     | Missing or invalid API key                                                            |
| 403    | FORBIDDEN        | API key lacks `flow-monitors:write` scope                                             |
| 404    | NOT_FOUND        | Flow monitor not found                                                                |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"source": { "type": "string", "minLength": 1, "maxLength": 20000 },
		"intervalSeconds": {
			"type": "integer",
			"enum": [900, 1800, 3600, 10800, 21600, 43200, 86400]
		},
		"isEnabled": { "type": "boolean" }
	}
}
```

## Delete a Flow Monitor

Permanently deletes a flow monitor, its spec, and its run history.

```
DELETE /api/v1/flow-monitors/:flowMonitorId
```

**Required Scope:** `flow-monitors:write`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/flow-monitors/flow_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": { "deleted": true },
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

### Errors

| Status | Code         | Description                               |
| ------ | ------------ | ----------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key                |
| 403    | FORBIDDEN    | API key lacks `flow-monitors:write` scope |
| 404    | NOT_FOUND    | Flow monitor not found                    |

## Get Flow Monitor Results

Retrieves the run history for a flow monitor: **one row per run**, however many requests that run made. Newest first.

```
GET /api/v1/flow-monitors/:flowMonitorId/results
```

**Required Scope:** `flow-monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                                      |
| --------- | ------- | -------- | ------------------------------------------------ |
| `limit`   | integer | No       | Number of results to return (1-200, default: 50) |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/flow-monitors/flow_abc123/results?limit=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"results": [
			{
				"id": "flowres_xyz789",
				"status": "down",
				"testsTotal": 2,
				"testsPassed": 1,
				"testsFailed": 1,
				"requestsMade": 2,
				"failedTest": "a member can sign in and read their profile",
				"failedAtLine": 9,
				"failureDetail": "expected 200, got 500",
				"durationMs": 812,
				"errorMessage": null,
				"checkedAt": 1787000000000
			},
			{
				"id": "flowres_xyz788",
				"status": "up",
				"testsTotal": 2,
				"testsPassed": 2,
				"testsFailed": 0,
				"requestsMade": 3,
				"failedTest": null,
				"failedAtLine": null,
				"failureDetail": null,
				"durationMs": 640,
				"errorMessage": null,
				"checkedAt": 1786996400000
			}
		]
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-31T10:30:00.000Z"
	}
}
```

Only the **first** failure of a run is recorded, in `failedTest`, `failedAtLine` and `failureDetail`. That is the one worth reading during an incident: once a sign-in breaks, everything after it fails for the same reason.

`requestsMade` is what the run cost. A flow is metered as one ping per request it performed, so a three-request flow on the hourly interval bills like three hourly HTTP monitors.

`durationMs` is the wall-clock of the whole run, which is also this monitor's latency series.

### Errors

`limit` is clamped rather than refused: anything unreadable or below 1 falls back to 50, and anything above 200 is truncated to 200.

| Status | Code         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key               |
| 403    | FORBIDDEN    | API key lacks `flow-monitors:read` scope |
| 404    | NOT_FOUND    | Flow monitor not found                   |

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"results": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"id": { "type": "string", "description": "Unique identifier for the run" },
							"status": {
								"type": "string",
								"enum": ["up", "down", "error"],
								"description": "What the run concluded. `down` is a failed assertion; `error` is a run that could not be performed."
							},
							"testsTotal": { "type": "integer", "description": "Tests the spec declares" },
							"testsPassed": { "type": "integer" },
							"testsFailed": { "type": "integer" },
							"requestsMade": {
								"type": "integer",
								"description": "HTTP requests the run performed, and the quantity it is billed on"
							},
							"failedTest": {
								"type": ["string", "null"],
								"description": "Title of the first failing test"
							},
							"failedAtLine": {
								"type": ["integer", "null"],
								"description": "1-based line of the spec the first failure happened on, when it is known"
							},
							"failureDetail": {
								"type": ["string", "null"],
								"description": "The first failure formatted: what was expected, what was observed"
							},
							"durationMs": {
								"type": ["integer", "null"],
								"description": "Wall-clock of the whole run"
							},
							"errorMessage": {
								"type": ["string", "null"],
								"description": "Why the run could not be performed. Only set alongside an `error` status."
							},
							"checkedAt": {
								"type": "integer",
								"description": "When the run happened, in milliseconds since the epoch"
							}
						},
						"required": ["id", "status", "checkedAt"]
					}
				}
			},
			"required": ["results"]
		}
	},
	"required": ["data"]
}
```
