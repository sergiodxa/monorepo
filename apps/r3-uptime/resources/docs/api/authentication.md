---
title: Authentication
description: Authenticate API requests using Bearer tokens. Learn about API key scopes and security best practices.
section:
  title: API Reference
  order: 4
order: 2
lastUpdated: 2026-02-14
---

All API requests require authentication using a Bearer token in the `Authorization` header.

## Header Format

Include your API key in the `Authorization` header with the `Bearer` prefix:

```
Authorization: Bearer uptime_xxxx...
```

## Getting an API Key

Create API keys from your team settings. See [Managing API Keys](/docs/team/api-keys) for instructions on creating, viewing, and revoking keys.

## Example Requests

### cURL

```bash
curl https://api.uptime.example.com/v1/monitors \
  -H "Authorization: Bearer uptime_your_api_key"
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://api.uptime.example.com/v1/monitors", {
	headers: {
		Authorization: "Bearer uptime_your_api_key",
	},
});
```

## Scopes

API keys have scopes that control which resources they can access. When creating a key, select only the scopes your integration requires.

### Available Scopes

| Scope                | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `monitors:read`      | View monitors and their check results                 |
| `monitors:write`     | Create, update, and delete monitors                   |
| `alerts:read`        | View alert channels and notification history          |
| `alerts:write`       | Create, update, and delete alert channels             |
| `status-pages:read`  | View status pages and incidents                       |
| `status-pages:write` | Create, update, and delete status pages and incidents |
| `maintenance:read`   | View maintenance windows                              |
| `maintenance:write`  | Create, update, and delete maintenance windows        |
| `team:read`          | View team members and invites                         |
| `team:write`         | Manage team members and send invites                  |
| `api-keys:read`      | View API keys (not the secret values)                 |
| `api-keys:write`     | Create and revoke API keys                            |

Requests that require a scope your key doesn't have return a `403 Forbidden` error.

## Key Expiration

API keys can have an optional expiration date. Once expired, requests using that key return a `401 Unauthorized` error. Set expiration dates for keys used for temporary integrations or time-limited access.

## Security Best Practices

Follow these guidelines to keep your API keys secure:

- **Never commit keys to source control** - Add `.env` files to `.gitignore` and use secrets management in CI/CD
- **Use environment variables** - Store keys in environment variables rather than hardcoding them
- **Use minimal scopes** - Only grant the scopes your integration actually needs
- **Rotate keys periodically** - Create new keys and revoke old ones on a regular schedule
- **Set expiration dates** - For temporary access or contractor integrations, always set an expiration date
- **Audit key usage** - Regularly review which keys exist and revoke any that are no longer needed
