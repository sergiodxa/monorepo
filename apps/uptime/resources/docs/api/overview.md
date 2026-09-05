---
title: API Overview
description: The Uptime REST API lets you programmatically manage monitors, alerts, status pages, and more.
section:
  title: API Reference
  order: 4
order: 1
lastUpdated: 2026-09-05
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

All responses are returned as JSON. Successful responses include a `data` field, while error responses include an `error` field with details about what went wrong. See [Errors](/docs/api/errors) for the complete error format and status codes.

## Identifiers

Every resource is identified by a prefixed string such as `mon_01h455vb4pex5vsknk084sn02q`. The prefix names the kind of resource the id points at — `mon_` for an HTTP monitor, `alt_` for an alert, `sp_` for a status page — and each resource page lists the prefix it uses.

Send these ids back exactly as you received them, in both path segments and request bodies. An id whose prefix names another resource is refused rather than resolved, so a monitor id can never be mistaken for an alert id. Endpoints answer `400 VALIDATION_ERROR` for an id they cannot read, except where a resource page documents otherwise.

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

## Rate Limits

API requests are subject to rate limiting based on your plan. See [Rate Limits](/docs/api/rate-limits) for details on limits and how to handle rate limit errors.
