---
title: API Overview
description: The Uptime REST API lets you programmatically manage monitors, alerts, status pages, and more.
section:
  title: API Reference
  order: 4
order: 1
lastUpdated: 2026-09-23
---

The Uptime API is a RESTful API that allows you to manage all aspects of your monitoring infrastructure programmatically.

## Base URL

All API requests should be made to:

```
https://uptime.sergiodxa.com/api/v1
```

## Authentication

All API requests require authentication via an API key passed in the `Authorization` header. See [Authentication](/docs/api/authentication) for details on generating and using API keys.

## Response Format

All responses are returned as JSON. Successful responses include a `data` field, while a failure is an RFC 9457 problem details document served as `application/problem+json`. See [Errors](/docs/api/errors) for the format and every problem type.

## Identifiers

Every resource is identified by a prefixed string such as `mon_01h455vb4pex5vsknk084sn02q`. The prefix names the kind of resource the id points at — `mon_` for an HTTP monitor, `alt_` for an alert, `sp_` for a status page — and each resource page lists the prefix it uses.

Send these ids back exactly as you received them, in both path segments and request bodies. An id whose prefix names another resource is refused rather than resolved, so a monitor id can never be mistaken for an alert id. Endpoints answer a `400` `validation-error` problem for an id they cannot read, except where a resource page documents otherwise.

## OpenAPI Document

The whole API is described by an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.1.html) document at `https://uptime.sergiodxa.com/api/v1/openapi.json` (add `?format=yaml` for YAML). It needs no API key, and any OpenAPI tool can read it to generate a client or explore the endpoints. Each resource page's scopes, errors and schemas come from the same document.

## Available Resources

- [Status](/docs/api/resources/status) - Check API health and your account status
- [Ping](/docs/api/resources/ping) - Run a one-off HTTP, DNS or TCP check without creating a monitor
- [HTTP Monitors](/docs/api/resources/http-monitors) - Monitor websites and HTTP endpoints
- [DNS Monitors](/docs/api/resources/dns-monitors) - Watch a domain's DNS records for changes
- [TCP Monitors](/docs/api/resources/tcp-monitors) - Monitor TCP ports and services
- [Flow Monitors](/docs/api/resources/flow-monitors) - Run a multi-request spec on a schedule
- [Cron Jobs](/docs/api/resources/cron-jobs) - Monitor scheduled tasks and cron jobs
- [Alerts](/docs/api/resources/alerts) - Configure alert channels and notifications
- [Status Pages](/docs/api/resources/status-pages) - Manage public and private status pages
- [Maintenance Windows](/docs/api/resources/maintenance) - Schedule maintenance periods
- [Team](/docs/api/resources/team) - Manage team members and permissions
- [Invites](/docs/api/resources/invites) - Send and manage team invitations
- [API Keys](/docs/api/resources/api-keys) - Create and revoke API keys

## Updating Resources

Resources are updated with `PATCH` and an [RFC 7396](https://www.rfc-editor.org/rfc/rfc7396) JSON merge patch, sent as `Content-Type: application/merge-patch+json` (`application/json` is read the same way):

- A field you include is set to its new value; a field you leave out keeps its value.
- `null` removes a field: a nullable field is cleared, and a field with a default takes that default.
- The patched resource must satisfy the same rules as a new one, so a required field cannot be removed.
- Arrays are replaced whole.

Any other media type answers `415` with an `Accept-Patch` header. The `PUT` endpoints that predate `PATCH` keep working with their own rules, described on each resource's page.

## Pagination

Every endpoint that returns a list serves one page at a time and advertises the next in the `Link` header. See [Pagination](/docs/api/pagination) for how to walk a list from end to end.

## Rate Limits

The two ping endpoints are rate limited, and their responses report the quota in `RateLimit` headers. See [Rate Limits](/docs/api/rate-limits) for the limits and how to handle a `429`.
