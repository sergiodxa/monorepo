---
title: DNS Monitors
description: Create and manage domain monitors. Import a zone file, choose which records are watched, and read check history.
section:
  title: API Resources
  order: 5
order: 3
lastUpdated: 2026-08-11
---

A DNS monitor watches a **domain**, not a single record. One monitor covers a domain's apex — plus every name declared by a zone file you paste — and sweeps six record types (`A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`) at each of them on every check. What it expects is the set of records it discovered, held one row per `(name, type, value)`, so a record appearing beside the ones you already have is reported as an addition rather than hidden inside a changed string.

## Breaking change

**These endpoints changed shape, and there is no deprecation window or `v2`.** Integrations written against the previous per-record-type monitor will break.

| Removed                               | Replacement                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `recordType` on create/update/read    | Every supported type is swept. Per-record control lives in the records sub-resource.           |
| `expectedValue` on create/update/read | The expectation is imported, not typed. Nothing to transcribe.                                 |
| `lastValue` on read                   | Per-record values, on the records sub-resource.                                                |
| `resolvedValue` on results            | Counters: `recordsChecked`, `recordsChanged`, `recordsMissing`, `recordsNew`, `queriesFailed`. |
| `intervalSeconds` as low as 60        | The minimum is now **900**, and the default is **86400** (once a day).                         |

The single-probe DNS check on `POST /api/v1/ping` is **unchanged**: it still takes `recordType` and `expectedValue`, because a stateless one-shot probe is the one place that shape is still the right question.

## Limits

- **We cannot list your DNS records.** DNS does not allow it. Without a zone file, a monitor covers your domain's apex and nothing else — a record at `staging.example.com` is invisible unless that name was in a zone file you pasted.
- **The zone file is a snapshot.** It is read once, parsed, and **never stored**. Names added to your zone afterwards are not tracked until you paste again.
- **One monitor may track at most 100 names.** A create carrying more is refused, because a check sweeps every tracked name in one go.
- **Six record types.** `CAA`, `SOA`, `SRV`, `PTR`, `DS`, `DNSKEY`, `HTTPS` and `SVCB` are not checked.
- **Detection latency is floored by your records' TTL**, not by the check interval.
- **One check is one ping**, however many names and types it swept.

Every response on this resource carries the standard envelope — `data` alongside `meta`, which holds the `requestId` to quote in a support request and the `timestamp` the response was written. The schema blocks below describe `data` only.

## The DNS monitor object

```json
{
	"id": "dns_abc123",
	"name": "Production domain",
	"domain": "example.com",
	"zoneFileImportedAt": 1786400000000,
	"intervalSeconds": 86400,
	"isEnabled": true,
	"lastCheckedAt": 1786430000000,
	"lastStatus": "ok",
	"createdAt": 1786300000000,
	"updatedAt": 1786400000000
}
```

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"id": { "type": "string", "description": "Unique identifier for the DNS monitor" },
		"name": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "Human-readable name for the monitor"
		},
		"domain": {
			"type": "string",
			"minLength": 1,
			"maxLength": 255,
			"description": "The domain this monitor covers"
		},
		"zoneFileImportedAt": {
			"type": ["integer", "null"],
			"description": "When a zone file was last imported, in milliseconds since the epoch. Null means every tracked name was discovered by resolution, so only the apex is covered. The pasted text itself is never stored."
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 900,
			"maximum": 86400,
			"default": 86400,
			"description": "Check interval in seconds"
		},
		"isEnabled": {
			"type": "boolean",
			"default": true,
			"description": "Whether the monitor is checked on its interval"
		},
		"lastCheckedAt": {
			"type": ["integer", "null"],
			"description": "Timestamp of the last check, in milliseconds since the epoch"
		},
		"lastStatus": {
			"type": ["string", "null"],
			"enum": ["ok", "changed", "error", null],
			"description": "Status from the last check. `changed` means at least one watched record is missing or edited, or a record nobody configured appeared; `error` means at least one query did not answer."
		},
		"createdAt": { "type": "integer", "description": "When the monitor was created" },
		"updatedAt": { "type": "integer", "description": "When the monitor was last updated" }
	},
	"required": [
		"id",
		"name",
		"domain",
		"zoneFileImportedAt",
		"intervalSeconds",
		"isEnabled",
		"createdAt",
		"updatedAt"
	]
}
```

## List All DNS Monitors

Retrieves all DNS monitors for your team.

```
GET /api/v1/dns-monitors
```

**Required Scope:** `dns-monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/dns-monitors \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"dnsMonitors": [
			{
				"id": "dns_abc123",
				"name": "Production domain",
				"domain": "example.com",
				"zoneFileImportedAt": 1786400000000,
				"intervalSeconds": 86400,
				"isEnabled": true,
				"lastCheckedAt": 1786430000000,
				"lastStatus": "ok",
				"createdAt": 1786300000000,
				"updatedAt": 1786400000000
			}
		]
	}
}
```

### Errors

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |

## Create a DNS Monitor

Creates a domain monitor and runs discovery immediately: every supported record type is queried at the domain, and at every name a pasted zone file declares.

**Everything the resolver answered with is imported and watched.** There is no review step on an API call — the dashboard's exists because a human is standing there — so a script that wants something left alone turns it off through the records sub-resource afterwards. The one exception is a record the zone file declares that the resolver does not answer for: it is imported unwatched, for the reason given below.

The response is `201 Created`.

```
POST /api/v1/dns-monitors
```

**Required Scope:** `dns-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                                                |
| ----------------- | ------- | -------- | -------------------------------------------------------------------------- |
| `name`            | string  | Yes      | Monitor name (1-255 characters)                                            |
| `domain`          | string  | Yes      | The domain to cover (1-255 characters)                                     |
| `zoneFile`        | string  | No       | A BIND zone file, up to 262144 bytes. Read once, parsed, and never stored. |
| `intervalSeconds` | integer | No       | Check interval in seconds (900-86400, default: 86400)                      |
| `isEnabled`       | boolean | No       | Whether the monitor is checked on its interval (default: true)             |

The parser reads one record per line, `<owner> [<ttl>] [IN] <TYPE> <rdata>`, with `;` comments, blank lines, absolute and relative owners, `@` for the apex, and quoted TXT character-strings. Anything it cannot use — `$ORIGIN`, `$TTL`, `$INCLUDE`, `$GENERATE`, parenthesised multi-line records, owner-inheriting continuation lines, non-`IN` classes, untracked types — is **reported, never silently dropped**, in `discovery.rejectedLines`.

A record the zone file declares but the resolver does not answer is imported **unwatched**, with status `missing`. That is a real finding at import — a stale delegation, a change that never published — and a poor standing alert, since the file is a snapshot that only gets older. Enable it through the records sub-resource if you want it watched. On a proxied zone this is the common case rather than the exceptional one: a proxied record is not in public DNS at all.

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/dns-monitors \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production domain",
    "domain": "example.com",
    "zoneFile": "www\t1\tIN\tA\t192.0.2.1\n_dmarc\t1\tIN\tTXT\t\"v=DMARC1; p=none\"",
    "intervalSeconds": 86400
  }'
```

### Response

```json
{
	"data": {
		"dnsMonitor": {
			"id": "dns_abc123",
			"name": "Production domain",
			"domain": "example.com",
			"zoneFileImportedAt": 1786400000000,
			"intervalSeconds": 86400,
			"isEnabled": true,
			"lastCheckedAt": null,
			"lastStatus": null,
			"createdAt": 1786400000000,
			"updatedAt": 1786400000000
		},
		"discovery": {
			"names": 3,
			"recordsImported": 11,
			"queriesFailed": 0,
			"rejectedLines": [{ "line": 1, "reason": "originDirective" }],
			"duplicateLines": [14]
		}
	}
}
```

`discovery.queriesFailed` counts queries that did not answer. Those names are not covered by this import and no record is inferred from them; the monitor's next scheduled check tries again.

### Errors

| Status | Code             | Description                                                                          |
| ------ | ---------------- | ------------------------------------------------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid body, a zone file over 262144 bytes, or a zone declaring more than 100 names |
| 401    | UNAUTHORIZED     | Missing or invalid API key                                                           |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:write` scope                                             |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"domain": { "type": "string", "minLength": 1, "maxLength": 255 },
		"zoneFile": {
			"type": "string",
			"description": "A BIND zone file, up to 262144 bytes. Parsed and discarded; never stored."
		},
		"intervalSeconds": {
			"type": "integer",
			"minimum": 900,
			"maximum": 86400,
			"default": 86400
		},
		"isEnabled": { "type": "boolean", "default": true }
	},
	"required": ["name", "domain"]
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
				"dnsMonitor": { "$comment": "See “The DNS monitor object” above" },
				"discovery": {
					"type": "object",
					"properties": {
						"names": { "type": "integer", "description": "Names swept, and therefore tracked" },
						"recordsImported": {
							"type": "integer",
							"description": "Records that were not already tracked"
						},
						"queriesFailed": {
							"type": "integer",
							"description": "Queries that did not answer, and whose names are therefore not covered by this import"
						},
						"rejectedLines": {
							"type": "array",
							"description": "Zone-file lines that did not become records. The line's text is never returned.",
							"items": {
								"type": "object",
								"properties": {
									"line": { "type": "integer" },
									"reason": {
										"type": "string",
										"enum": [
											"originDirective",
											"ttlDirective",
											"includeDirective",
											"generateDirective",
											"unsupportedDirective",
											"multiLineRecord",
											"blankOwnerContinuation",
											"nonInternetClass",
											"unsupportedType",
											"outOfZone",
											"malformed"
										]
									}
								},
								"required": ["line", "reason"]
							}
						},
						"duplicateLines": {
							"type": "array",
							"description": "Lines redeclaring a record an earlier line already declared. Nothing was lost: DNS answers such a set once, and so do we.",
							"items": { "type": "integer" }
						}
					},
					"required": [
						"names",
						"recordsImported",
						"queriesFailed",
						"rejectedLines",
						"duplicateLines"
					]
				}
			},
			"required": ["dnsMonitor", "discovery"]
		}
	},
	"required": ["data"]
}
```

## Get a DNS Monitor

Retrieves a single DNS monitor by ID.

```
GET /api/v1/dns-monitors/:dnsMonitorId
```

**Required Scope:** `dns-monitors:read`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123 \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"dnsMonitor": {
			"id": "dns_abc123",
			"name": "Production domain",
			"domain": "example.com",
			"zoneFileImportedAt": 1786400000000,
			"intervalSeconds": 86400,
			"isEnabled": true,
			"lastCheckedAt": 1786430000000,
			"lastStatus": "ok",
			"createdAt": 1786300000000,
			"updatedAt": 1786400000000
		}
	}
}
```

### Errors

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |
| 404    | NOT_FOUND    | DNS monitor not found                   |

## Update a DNS Monitor

Updates a DNS monitor's editable fields. All fields are optional; only provided fields are updated.

There is no `zoneFile` here, and one sent is ignored rather than refused. The pasted text is never stored, so re-importing is a deliberate act rather than something carried along by a rename — import again from the dashboard, or create a new monitor.

```
PUT /api/v1/dns-monitors/:dnsMonitorId
```

**Required Scope:** `dns-monitors:write`

### Request Body

| Field             | Type    | Required | Description                                       |
| ----------------- | ------- | -------- | ------------------------------------------------- |
| `name`            | string  | No       | Monitor name (1-255 characters)                   |
| `domain`          | string  | No       | The domain this monitor covers (1-255 characters) |
| `intervalSeconds` | integer | No       | Check interval in seconds (900-86400)             |
| `isEnabled`       | boolean | No       | Whether the monitor is checked on its interval    |

Changing `domain` does not re-run discovery: the records already tracked stay as they are, so point a monitor at a different domain only if you also mean to review its records.

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123 \
  -X PUT \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ "intervalSeconds": 3600 }'
```

### Response

```json
{
	"data": {
		"dnsMonitor": {
			"id": "dns_abc123",
			"name": "Production domain",
			"domain": "example.com",
			"zoneFileImportedAt": 1786400000000,
			"intervalSeconds": 3600,
			"isEnabled": true,
			"lastCheckedAt": 1786430000000,
			"lastStatus": "ok",
			"createdAt": 1786300000000,
			"updatedAt": 1786440000000
		}
	}
}
```

### Errors

| Status | Code             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid request body                     |
| 401    | UNAUTHORIZED     | Missing or invalid API key               |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:write` scope |
| 404    | NOT_FOUND        | DNS monitor not found                    |

### Request Body Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"name": { "type": "string", "minLength": 1, "maxLength": 255 },
		"domain": { "type": "string", "minLength": 1, "maxLength": 255 },
		"intervalSeconds": { "type": "integer", "minimum": 900, "maximum": 86400 },
		"isEnabled": { "type": "boolean" }
	}
}
```

## Delete a DNS Monitor

Permanently deletes a DNS monitor, every record it tracks, and its check history.

```
DELETE /api/v1/dns-monitors/:dnsMonitorId
```

**Required Scope:** `dns-monitors:write`

### cURL

```bash
curl https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123 \
  -X DELETE \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{ "data": { "deleted": true } }
```

### Errors

| Status | Code         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key               |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:write` scope |
| 404    | NOT_FOUND    | DNS monitor not found                    |

## Get DNS Monitor Results

Retrieves the check history for a DNS monitor: **one row per check of the monitor**, whatever the sweep cost in queries.

```
GET /api/v1/dns-monitors/:dnsMonitorId/results
```

**Required Scope:** `dns-monitors:read`

### Query Parameters

| Parameter | Type    | Required | Description                                      |
| --------- | ------- | -------- | ------------------------------------------------ |
| `limit`   | integer | No       | Number of results to return (1-200, default: 50) |

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123/results?limit=10" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"results": [
			{
				"id": "res_xyz789",
				"status": "changed",
				"recordsChecked": 18,
				"recordsChanged": 0,
				"recordsMissing": 1,
				"recordsNew": 1,
				"queriesFailed": 0,
				"responseTimeMs": 42,
				"errorMessage": null,
				"checkedAt": 1786430000000
			}
		]
	}
}
```

`responseTimeMs` is the **slowest single query** in the sweep, not the sum: it answers "how long did DNS take to answer", which is a latency figure rather than a cost one.

A value edited inside a record set holding several values reads as one missing record plus one new one. That is truthful rather than a bug: DNS gives an individual record no identity of its own, so editing one value is indistinguishable, on the wire, from removing one and adding another. `recordsChanged` counts only the case a diff can attribute without guessing — a name and type holding exactly one watched record and answering with exactly one differing value.

### Errors

`limit` is clamped rather than refused: anything unreadable or below 1 falls back to 50, and anything above 200 is truncated to 200.

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |
| 404    | NOT_FOUND    | DNS monitor not found                   |

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
							"id": { "type": "string", "description": "Unique identifier for the result" },
							"status": {
								"type": "string",
								"enum": ["ok", "changed", "error"],
								"description": "The monitor's status as of this check"
							},
							"recordsChecked": {
								"type": "integer",
								"description": "Records this check has an answer about, watched or not"
							},
							"recordsChanged": {
								"type": "integer",
								"description": "Watched records whose single value was edited"
							},
							"recordsMissing": {
								"type": "integer",
								"description": "Watched records that stopped resolving"
							},
							"recordsNew": {
								"type": "integer",
								"description": "Records that resolved without being tracked. Imported unwatched."
							},
							"queriesFailed": {
								"type": "integer",
								"description": "Queries that did not answer. No record is diffed on a failed query, so a bad resolver minute never reads as records vanishing."
							},
							"responseTimeMs": {
								"type": ["integer", "null"],
								"description": "The slowest single query in the sweep"
							},
							"errorMessage": { "type": ["string", "null"] },
							"checkedAt": {
								"type": "integer",
								"description": "When the check ran, in milliseconds since the epoch"
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

## Records

Which records a monitor watches is edited through its records sub-resource, on the same `dns-monitors:read`/`dns-monitors:write` scopes — a key that may reconfigure a domain monitor may decide which of its records are watched, since the two authorities are the same authority.

```
GET   /api/v1/dns-monitors/:dnsMonitorId/records
PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId
```

A record carries its `name`, `recordType`, `value`, how it was discovered (`source`), whether a deviation from it alerts (`isEnabled`), and its `status` (`ok`, `changed`, `missing`, `new`, `error`). `PATCH` takes `{ "isEnabled": boolean }`.

Two things about that table are worth knowing before you script against it:

- **It holds everything we have ever seen for the domain**, including records you turned off. Turning one off says only that deviations from it do not alert; deleting the row instead would make the next check rediscover it as new, forever.
- **A record discovered by a check is stored unwatched**, with status `new`. Accepting something that appeared without you putting it there should be an act, not the thing that happens by ignoring an email.

## List DNS Monitor Records

Retrieves every record the monitor tracks, including the ones you have declined to watch.
The table is the complete set of everything ever seen for the domain: `isEnabled` says only
whether a deviation from that record alerts, so a declined record stays listed rather than
being rediscovered as new on the next check.

```
GET /api/v1/dns-monitors/:dnsMonitorId/records
```

**Required Scope:** `dns-monitors:read`

The response is not paginated. A monitor's records are its configuration, not its history,
and are bounded by the names its zone-file import found.

### cURL

```bash
curl "https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123/records" \
  -H "Authorization: Bearer uptime_your_api_key"
```

### Response

```json
{
	"data": {
		"records": [
			{
				"id": "dnsrec_abc123",
				"dnsMonitorId": "dns_abc123",
				"name": "example.com",
				"recordType": "A",
				"value": "192.0.2.1",
				"source": "resolver",
				"isEnabled": true,
				"status": "ok",
				"firstSeenAt": 1770000000000,
				"lastSeenAt": 1770086400000,
				"lastCheckedAt": 1770086400000,
				"createdAt": 1770000000000,
				"updatedAt": 1770086400000
			},
			{
				"id": "dnsrec_abc124",
				"dnsMonitorId": "dns_abc123",
				"name": "mail.example.com",
				"recordType": "MX",
				"value": "10 mx.example.com",
				"source": "zone_file",
				"isEnabled": false,
				"status": "missing",
				"firstSeenAt": 1770086400000,
				"lastSeenAt": null,
				"lastCheckedAt": 1770086400000,
				"createdAt": 1770086400000,
				"updatedAt": 1770086400000
			}
		]
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-11T10:30:00.000Z"
	}
}
```

### Field Meanings

| Field           | Type                                   | Description                                                                                                           |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`          | string                                 | Absolute owner name, lowercased, no trailing dot. The apex is the monitor's `domain`.                                 |
| `recordType`    | `A` `AAAA` `CNAME` `MX` `TXT` `NS`     | The six types checked in v1.                                                                                          |
| `value`         | string                                 | Normalized RDATA. Together with `name` and `recordType` it is the record's identity, and it is never client-writable. |
| `source`        | `resolver` `zone_file`                 | How the record first entered the table.                                                                               |
| `isEnabled`     | boolean                                | Whether a deviation from this record alerts. The only writable field.                                                 |
| `status`        | `ok` `changed` `missing` `new` `error` | What the last check found. `new` and `missing` are states of the record, not of a check.                              |
| `lastSeenAt`    | integer \| null                        | Last check at which this exact record resolved. `null` for a zone-file record that has never resolved.                |
| `lastCheckedAt` | integer \| null                        | Last check that had an answer about this record. `null` until the first check.                                        |

Timestamps are epoch milliseconds.

### Errors

| Status | Code         | Description                             |
| ------ | ------------ | --------------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid API key              |
| 403    | FORBIDDEN    | API key lacks `dns-monitors:read` scope |
| 404    | NOT_FOUND    | DNS monitor not found                   |

A monitor belonging to another team returns `404`, not `403`: a `403` would confirm the id
names a real monitor somebody else owns.

### Response Schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"data": {
			"type": "object",
			"properties": {
				"records": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"id": { "type": "string", "description": "Unique identifier for the record" },
							"dnsMonitorId": {
								"type": "string",
								"description": "The monitor tracking this record"
							},
							"name": { "type": "string", "description": "Absolute owner name, lowercased" },
							"recordType": {
								"type": "string",
								"enum": ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
								"description": "DNS record type"
							},
							"value": { "type": "string", "description": "Normalized record value" },
							"source": {
								"type": "string",
								"enum": ["resolver", "zone_file"],
								"description": "How the record first entered the table"
							},
							"isEnabled": {
								"type": "boolean",
								"description": "Whether a deviation from this record alerts"
							},
							"status": {
								"type": "string",
								"enum": ["ok", "changed", "missing", "new", "error"],
								"description": "What the last check found for this record"
							},
							"firstSeenAt": {
								"type": "integer",
								"description": "When the record was first imported"
							},
							"lastSeenAt": {
								"type": ["integer", "null"],
								"description": "Last check at which this record resolved"
							},
							"lastCheckedAt": {
								"type": ["integer", "null"],
								"description": "Last check that had an answer about this record"
							},
							"createdAt": { "type": "integer" },
							"updatedAt": { "type": "integer" }
						},
						"required": [
							"id",
							"dnsMonitorId",
							"name",
							"recordType",
							"value",
							"source",
							"isEnabled",
							"status",
							"firstSeenAt"
						]
					}
				}
			},
			"required": ["records"]
		}
	},
	"required": ["data"]
}
```

## Update a DNS Monitor Record

Enables or declines one record. This is how a script decides what a monitor watches: an
API-created monitor imports and enables everything discovery found, because there is no
reviewer standing at the other end of an API call.

```
PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId
```

**Required Scope:** `dns-monitors:write`

### Request Body

```json
{
	"isEnabled": false
}
```

### Request Body Schema

| Field       | Type    | Required | Description                                       |
| ----------- | ------- | -------- | ------------------------------------------------- |
| `isEnabled` | boolean | Yes      | Whether a deviation from this record should alert |

**`isEnabled` is the only accepted field, and the request is rejected rather than filtered.**
Sending `name`, `recordType`, `value`, `status`, or any other key returns
`400 VALIDATION_ERROR` with a message naming the key — for example `value: Unknown key`.

A record's identity is `(name, recordType, value)`, and it comes from DNS or from the zone
file you imported, never from a client. It is also the key the check diffs on, so accepting
an edit to it would silently retarget the expectation instead of changing it — and a request
that was quietly ignored is worse than one that was refused, because the caller goes on
believing the edit landed. Change your DNS, or re-import your zone file.

Omitting `isEnabled` is also a `400`: a request with nothing writable in it expresses no
decision, and answering `200` would claim one was made.

### cURL

```bash
curl -X PATCH "https://uptime.sergiodxa.com/api/v1/dns-monitors/dns_abc123/records/dnsrec_abc124" \
  -H "Authorization: Bearer uptime_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": true}'
```

### Response

```json
{
	"data": {
		"record": {
			"id": "dnsrec_abc124",
			"dnsMonitorId": "dns_abc123",
			"name": "mail.example.com",
			"recordType": "MX",
			"value": "10 mx.example.com",
			"source": "zone_file",
			"isEnabled": true,
			"status": "ok",
			"firstSeenAt": 1770086400000,
			"lastSeenAt": 1770086400000,
			"lastCheckedAt": 1770086400000,
			"createdAt": 1770086400000,
			"updatedAt": 1770090000000
		}
	},
	"meta": {
		"requestId": "6b1f9d5e-4a2c-4f7e-9a10-2c8d5f3b7e41",
		"timestamp": "2026-08-11T10:30:00.000Z"
	}
}
```

Enabling a record whose `status` is `new` also settles it to `ok`: it resolved when we found
it, and you have now said you want it watched, so leaving it `new` would keep it on the
"needs your attention" list forever. Every other status survives — enabling a zone-file
record that has never resolved leaves it `missing`, which is true and is presumably why you
enabled it. Declining a record never changes its `status`.

### Errors

| Status | Code             | Description                                                         |
| ------ | ---------------- | ------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | `isEnabled` missing or not a boolean, or an unaccepted key was sent |
| 401    | UNAUTHORIZED     | Missing or invalid API key                                          |
| 403    | FORBIDDEN        | API key lacks `dns-monitors:write` scope                            |
| 404    | NOT_FOUND        | DNS monitor not found, or the record does not belong to it          |

A record id belonging to a different monitor — including one on your own team — returns
`404`. Records are addressable only through the monitor that tracks them.

### Response Schema

The `record` object has the same schema as one item of the list endpoint's `records` array.
