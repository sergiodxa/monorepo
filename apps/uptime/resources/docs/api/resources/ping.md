---
title: Ping
description: Run a one-off HTTP, DNS, or TCP probe without creating a monitor. Built for CI checks against ephemeral deployments.
section:
  title: API Resources
  order: 5
order: 13
lastUpdated: 2026-08-01
---

The ping endpoint runs a single probe against a target you describe in the request and returns the result. No monitor is created, no check history is stored, and no alerts are sent. Use it when the target is not worth monitoring continuously — a preview deployment that lives for the length of a build, a freshly provisioned subdomain, a smoke test in a release pipeline.

Every probe uses the same regions, timeouts, and status rules as the equivalent monitor, so an ad-hoc result predicts what continuous monitoring of the same target would report.

## Request Failures Versus Target Failures

**A target that is down still returns `200`.** The outcome of the probe is in `data.ping.status`, never in the HTTP status of the API response.

A non-2xx response from this endpoint means the _request_ failed — a bad key, a missing scope, an inactive subscription, an invalid body, the rate limit, or the endpoint being unavailable to your team. It never means your target is down. Collapsing the two would make "your service is unreachable" indistinguishable from "we could not check", and only the first should fail a build.

Branch on the payload, not on the transport:

```bash
status=$(curl -s https://uptime.sergiodxa.com/api/v1/ping \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"type":"http","url":"https://preview-1234.example.com/healthz"}' \
  | jq -r '.data.ping.status')

case "$status" in
  up)       echo "healthy" ;;
  degraded) echo "slow but correct" ;;
  *)        echo "unhealthy: $status"; exit 1 ;;
esac
```

## Run an HTTP Ping

Probe an HTTP endpoint once and classify the response.

```
POST /api/v1/ping
```

**Required scope:** `ping:trigger`

### Request Body

| Field             | Type    | Required | Description                                                                                                         |
| ----------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `type`            | string  | Yes      | Must be `http`                                                                                                      |
| `url`             | string  | Yes      | Absolute URL to probe                                                                                               |
| `method`          | string  | No       | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, or `HEAD` (default: `GET`)                                                 |
| `expectedStatus`  | integer | No       | Response status that counts as healthy (100-599, default: 200)                                                      |
| `timeoutSeconds`  | integer | No       | Probe timeout in seconds (1-60, default: 10)                                                                        |
| `degradedAfterMs` | integer | No       | Response time above which a correct response is `degraded` (1-60000, default: 5000)                                 |
| `region`          | string  | No       | Region to probe from (default: `wnam`)                                                                              |
| `headers`         | object  | No       | Request headers, as string values keyed by header name                                                              |
| `body`            | string  | No       | Request body, up to 10,000 characters. Rejected with `400` when `method` is `GET` or `HEAD`, which cannot carry one |
| `contentChecks`   | array   | No       | Assertions run against the response body; all must pass for the status to be `up`                                   |

Each entry in `contentChecks` is an object with `type` (`contains`, `not_contains`, or `regex`), `value` (1-1000 characters), and an optional `caseSensitive` flag (default: false).

Valid regions are `wnam`, `enam`, `sam`, `weur`, `eeur`, `apac`, `oc`, `afr`, and `me`.

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/ping \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "http",
    "url": "https://preview-1234.example.com/healthz",
    "method": "GET",
    "expectedStatus": 200,
    "timeoutSeconds": 10,
    "degradedAfterMs": 5000,
    "region": "wnam",
    "headers": { "X-Deploy": "preview-1234" },
    "contentChecks": [{ "type": "contains", "value": "\"status\":\"ok\"" }]
  }'
```

### Response

```json
{
	"data": {
		"ping": {
			"id": "ping_abc123",
			"type": "http",
			"status": "up",
			"responseStatus": 200,
			"responseTimeMs": 143,
			"contentChecksPassed": true,
			"checkedAt": "2026-08-01T12:00:00Z"
		}
	},
	"meta": {
		"requestId": "9f1c5f0e-4d1a-4a51-9d3f-1a2b3c4d5e6f",
		"timestamp": "2026-08-01T12:00:00Z"
	}
}
```

A target that fails returns the same `200` envelope with a different status:

```json
{
	"data": {
		"ping": {
			"id": "ping_abc124",
			"type": "http",
			"status": "down",
			"responseStatus": 503,
			"responseTimeMs": 87,
			"contentChecksPassed": false,
			"checkedAt": "2026-08-01T12:00:05Z"
		}
	},
	"meta": {
		"requestId": "0c7a6e11-2b8d-4f6c-88a1-77e3d2b91c04",
		"timestamp": "2026-08-01T12:00:05Z"
	}
}
```

### Errors

| Status | Type                    | Description                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| 400    | `validation-error`      | Invalid request body                               |
| 401    | `unauthorized`          | Missing or invalid API key                         |
| 402    | `subscription-required` | The team owner has no active subscription          |
| 403    | `forbidden`             | API key missing `ping:trigger` scope               |
| 429    | `rate-limited`          | More than 60 requests in a minute for this API key |
| 503    | `endpoint-unavailable`  | Ad-hoc pings are unavailable to this team          |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"type": {
			"const": "http",
			"description": "Probe type discriminator"
		},
		"url": {
			"type": "string",
			"format": "uri",
			"description": "Absolute URL to probe"
		},
		"method": {
			"type": "string",
			"enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
			"description": "HTTP method",
			"default": "GET"
		},
		"expectedStatus": {
			"type": "integer",
			"description": "Response status that counts as healthy",
			"minimum": 100,
			"maximum": 599,
			"default": 200
		},
		"timeoutSeconds": {
			"type": "integer",
			"description": "Probe timeout in seconds",
			"minimum": 1,
			"maximum": 60,
			"default": 10
		},
		"degradedAfterMs": {
			"type": "integer",
			"description": "Response time above which a correct response is degraded",
			"minimum": 1,
			"maximum": 60000,
			"default": 5000
		},
		"region": {
			"type": "string",
			"enum": ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"],
			"description": "Region the probe runs from",
			"default": "wnam"
		},
		"headers": {
			"type": "object",
			"description": "Request headers",
			"additionalProperties": { "type": "string" }
		},
		"body": {
			"type": "string",
			"maxLength": 10000,
			"description": "Request body. Refused when `method` is `GET` or `HEAD`"
		},
		"contentChecks": {
			"type": "array",
			"description": "Assertions run against the response body",
			"items": {
				"type": "object",
				"properties": {
					"type": {
						"type": "string",
						"enum": ["contains", "not_contains", "regex"],
						"description": "Assertion kind"
					},
					"value": {
						"type": "string",
						"minLength": 1,
						"maxLength": 1000,
						"description": "Text or pattern to assert against"
					},
					"caseSensitive": {
						"type": "boolean",
						"description": "Whether the assertion is case sensitive",
						"default": false
					}
				},
				"required": ["type", "value"]
			}
		}
	},
	"required": ["type", "url"]
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
				"ping": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "Identifier for this ping. Not addressable; pings are not stored",
							"pattern": "^ping_[a-zA-Z0-9]+$"
						},
						"type": {
							"const": "http",
							"description": "Probe type"
						},
						"status": {
							"type": "string",
							"enum": ["up", "degraded", "down"],
							"description": "Outcome of the probe"
						},
						"responseStatus": {
							"type": ["integer", "null"],
							"description": "HTTP status returned by the target"
						},
						"responseTimeMs": {
							"type": ["integer", "null"],
							"description": "Response time in milliseconds"
						},
						"contentChecksPassed": {
							"type": "boolean",
							"description": "Whether every content check passed. True when none were supplied"
						},
						"checkedAt": {
							"type": "string",
							"format": "date-time",
							"description": "Timestamp when the probe ran"
						}
					},
					"required": [
						"id",
						"type",
						"status",
						"responseStatus",
						"responseTimeMs",
						"contentChecksPassed",
						"checkedAt"
					]
				}
			},
			"required": ["ping"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": {
					"type": "string",
					"description": "Identifier for this API request"
				},
				"timestamp": {
					"type": "string",
					"format": "date-time",
					"description": "Time the response was produced"
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Run a DNS Ping

Resolve a DNS record once and optionally compare it against an expected value.

```
POST /api/v1/ping
```

**Required scope:** `ping:trigger`

### Request Body

| Field           | Type   | Required | Description                                                                               |
| --------------- | ------ | -------- | ----------------------------------------------------------------------------------------- |
| `type`          | string | Yes      | Must be `dns`                                                                             |
| `domain`        | string | Yes      | Domain to resolve (1-255 characters)                                                      |
| `recordType`    | string | No       | Record type (default: `A`)                                                                |
| `expectedValue` | string | No       | Value the record must resolve to (up to 1000 characters); comma-separated for multi-value |

Valid record types are `A`, `AAAA`, `CNAME`, `MX`, `TXT`, and `NS`.

Without `expectedValue` there is nothing to compare against, so a successful resolution is always `ok` and the `changed` status cannot occur.

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/ping \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "dns",
    "domain": "preview-1234.example.com",
    "recordType": "A",
    "expectedValue": "203.0.113.10"
  }'
```

### Response

```json
{
	"data": {
		"ping": {
			"id": "ping_def456",
			"type": "dns",
			"status": "ok",
			"resolvedValue": "203.0.113.10",
			"responseTimeMs": 31,
			"errorMessage": null,
			"checkedAt": "2026-08-01T12:00:00Z"
		}
	},
	"meta": {
		"requestId": "1d4c9a72-6f0b-4e2d-9c31-58a0f4c7e2b9",
		"timestamp": "2026-08-01T12:00:00Z"
	}
}
```

### Errors

| Status | Type                    | Description                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| 400    | `validation-error`      | Invalid request body                               |
| 401    | `unauthorized`          | Missing or invalid API key                         |
| 402    | `subscription-required` | The team owner has no active subscription          |
| 403    | `forbidden`             | API key missing `ping:trigger` scope               |
| 429    | `rate-limited`          | More than 60 requests in a minute for this API key |
| 503    | `endpoint-unavailable`  | Ad-hoc pings are unavailable to this team          |

A domain that does not resolve is not an error. It returns `200` with status `error` and an `errorMessage`.

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"type": {
			"const": "dns",
			"description": "Probe type discriminator"
		},
		"domain": {
			"type": "string",
			"description": "Domain to resolve",
			"minLength": 1,
			"maxLength": 255
		},
		"recordType": {
			"type": "string",
			"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
			"description": "DNS record type",
			"default": "A"
		},
		"expectedValue": {
			"type": "string",
			"maxLength": 1000,
			"description": "Value the record must resolve to, comma-separated for multi-value records"
		}
	},
	"required": ["type", "domain"]
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
				"ping": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "Identifier for this ping. Not addressable; pings are not stored",
							"pattern": "^ping_[a-zA-Z0-9]+$"
						},
						"type": {
							"const": "dns",
							"description": "Probe type"
						},
						"status": {
							"type": "string",
							"enum": ["ok", "changed", "error"],
							"description": "Outcome of the probe. `changed` only occurs when `expectedValue` was supplied and did not match"
						},
						"resolvedValue": {
							"type": ["string", "null"],
							"description": "Value the record resolved to, comma-separated for multi-value records"
						},
						"responseTimeMs": {
							"type": ["integer", "null"],
							"description": "Resolution time in milliseconds"
						},
						"errorMessage": {
							"type": ["string", "null"],
							"description": "Why resolution failed, when status is error"
						},
						"checkedAt": {
							"type": "string",
							"format": "date-time",
							"description": "Timestamp when the probe ran"
						}
					},
					"required": [
						"id",
						"type",
						"status",
						"resolvedValue",
						"responseTimeMs",
						"errorMessage",
						"checkedAt"
					]
				}
			},
			"required": ["ping"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": {
					"type": "string",
					"description": "Identifier for this API request"
				},
				"timestamp": {
					"type": "string",
					"format": "date-time",
					"description": "Time the response was produced"
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Run a TCP Ping

Open a TCP connection to a host and port once, and report whether it was accepted.

```
POST /api/v1/ping
```

**Required scope:** `ping:trigger`

### Request Body

| Field       | Type    | Required | Description                                                   |
| ----------- | ------- | -------- | ------------------------------------------------------------- |
| `type`      | string  | Yes      | Must be `tcp`                                                 |
| `host`      | string  | Yes      | Hostname or IP address (1-255 characters)                     |
| `port`      | integer | Yes      | TCP port number (1-65535)                                     |
| `timeoutMs` | integer | No       | Connection timeout in milliseconds (100-60000, default: 5000) |

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/ping \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tcp",
    "host": "db.preview-1234.example.com",
    "port": 5432,
    "timeoutMs": 5000
  }'
```

### Response

```json
{
	"data": {
		"ping": {
			"id": "ping_ghi789",
			"type": "tcp",
			"status": "up",
			"responseTimeMs": 42,
			"errorMessage": null,
			"checkedAt": "2026-08-01T12:00:00Z"
		}
	},
	"meta": {
		"requestId": "5b2e8f30-91cd-4a77-b0a4-6c1e9d3f8210",
		"timestamp": "2026-08-01T12:00:00Z"
	}
}
```

### Errors

| Status | Type                    | Description                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| 400    | `validation-error`      | Invalid request body                               |
| 401    | `unauthorized`          | Missing or invalid API key                         |
| 402    | `subscription-required` | The team owner has no active subscription          |
| 403    | `forbidden`             | API key missing `ping:trigger` scope               |
| 429    | `rate-limited`          | More than 60 requests in a minute for this API key |
| 503    | `endpoint-unavailable`  | Ad-hoc pings are unavailable to this team          |

A refused connection returns `200` with status `down`; a connection that never completes returns `200` with status `timeout`.

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"type": {
			"const": "tcp",
			"description": "Probe type discriminator"
		},
		"host": {
			"type": "string",
			"description": "Hostname or IP address",
			"minLength": 1,
			"maxLength": 255
		},
		"port": {
			"type": "integer",
			"description": "TCP port number",
			"minimum": 1,
			"maximum": 65535
		},
		"timeoutMs": {
			"type": "integer",
			"description": "Connection timeout in milliseconds",
			"minimum": 100,
			"maximum": 60000,
			"default": 5000
		}
	},
	"required": ["type", "host", "port"]
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
				"ping": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "Identifier for this ping. Not addressable; pings are not stored",
							"pattern": "^ping_[a-zA-Z0-9]+$"
						},
						"type": {
							"const": "tcp",
							"description": "Probe type"
						},
						"status": {
							"type": "string",
							"enum": ["up", "down", "timeout"],
							"description": "Outcome of the probe"
						},
						"responseTimeMs": {
							"type": ["integer", "null"],
							"description": "Connection time in milliseconds"
						},
						"errorMessage": {
							"type": ["string", "null"],
							"description": "Why the connection failed, when status is down or timeout"
						},
						"checkedAt": {
							"type": "string",
							"format": "date-time",
							"description": "Timestamp when the probe ran"
						}
					},
					"required": ["id", "type", "status", "responseTimeMs", "errorMessage", "checkedAt"]
				}
			},
			"required": ["ping"]
		},
		"meta": {
			"type": "object",
			"properties": {
				"requestId": {
					"type": "string",
					"description": "Identifier for this API request"
				},
				"timestamp": {
					"type": "string",
					"format": "date-time",
					"description": "Time the response was produced"
				}
			},
			"required": ["requestId", "timestamp"]
		}
	},
	"required": ["data", "meta"]
}
```

## Rate Limits

Ad-hoc pings are limited to **60 requests per minute per API key**. The limit is per key rather than per source address, so pipelines sharing an egress address do not consume each other's budget. Exceeding it returns a `429` `rate-limited` problem; no probe is performed and nothing is billed. See [Rate Limits](/docs/api/rate-limits) for the `RateLimit` headers this endpoint sends.

## Billing

Every accepted ping is billable and counts against the same metered ping allowance as monitor checks: the pings included in your subscription first, then whole blocks of additional pings. Requests refused before the probe runs — invalid body, missing scope, inactive subscription, rate limited — are not counted.

Ad-hoc pings belong to a team but to no monitor, so they appear in your team's monthly usage total and on no individual monitor's usage figure.
