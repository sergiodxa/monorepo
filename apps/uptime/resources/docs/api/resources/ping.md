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

## Run a Ping

Run one probe and get its result back. The body's `type` selects the kind of probe, and each kind's fields are described below.

```
POST /api/v1/ping
```

<!-- operation: pingCreate -->

## Run an HTTP Ping

Probe an HTTP endpoint once and classify the response.

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

## Run a DNS Ping

Resolve a DNS record once and optionally compare it against an expected value.

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

A domain that does not resolve is not an error. It returns `200` with status `error` and an `errorMessage`.

## Run a TCP Ping

Open a TCP connection to a host and port once, and report whether it was accepted.

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

A refused connection returns `200` with status `down`; a connection that never completes returns `200` with status `timeout`.

## Rate Limits

Ad-hoc pings are limited to **60 requests per minute per API key**. The limit is per key rather than per source address, so pipelines sharing an egress address do not consume each other's budget. Exceeding it returns a `429` `rate-limited` problem; no probe is performed and nothing is billed. See [Rate Limits](/docs/api/rate-limits) for the `RateLimit` headers this endpoint sends.

## Billing

Every accepted ping is billable and counts against the same metered ping allowance as monitor checks: the pings included in your subscription first, then whole blocks of additional pings. Requests refused before the probe runs — invalid body, missing scope, inactive subscription, rate limited — are not counted.

Ad-hoc pings belong to a team but to no monitor, so they appear in your team's monthly usage total and on no individual monitor's usage figure.
