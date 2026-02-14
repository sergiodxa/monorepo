---
title: API Keys
description: Create and manage API keys for programmatic access. Configure scopes to control what each key can do.
section:
  title: Team & Settings
  order: 3
order: 4
lastUpdated: 2026-02-14
---

API keys allow you to access the Uptime API programmatically. Use them to integrate monitoring data into your own tools, automate monitor management, or build custom dashboards.

## Creating an API Key

To create a new API key:

1. Navigate to **Settings** > **API Keys**
2. Click **Create API Key**
3. Enter a **name** to identify this key (e.g., "CI/CD Pipeline" or "Dashboard Integration")
4. Select the **scopes** that define what the key can access
5. Optionally set an **expiration date** for the key
6. Click **Create**

After creation, you'll see the full API key exactly once. Copy it immediately and store it securely—you won't be able to view it again.

API keys follow the format `uptime_` followed by hexadecimal characters (e.g., `uptime_a1b2c3d4...`).

## Available Scopes

Scopes control what actions an API key can perform. Choose only the scopes your integration actually needs.

### Monitoring

| Scope                | Description                                   |
| -------------------- | --------------------------------------------- |
| `monitors:read`      | List and view HTTP monitors and their results |
| `monitors:write`     | Create, update, and delete HTTP monitors      |
| `dns-monitors:read`  | List and view DNS monitors and their results  |
| `dns-monitors:write` | Create, update, and delete DNS monitors       |
| `tcp-monitors:read`  | List and view TCP monitors and their results  |
| `tcp-monitors:write` | Create, update, and delete TCP monitors       |

### Scheduled Tasks

| Scope             | Description                                         |
| ----------------- | --------------------------------------------------- |
| `cron-jobs:read`  | List and view cron jobs and their execution history |
| `cron-jobs:write` | Create, update, and delete cron jobs                |
| `cron-jobs:ping`  | Send pings to cron job endpoints                    |

### Alerts & Status

| Scope                | Description                                    |
| -------------------- | ---------------------------------------------- |
| `alerts:read`        | List and view alert configurations             |
| `alerts:write`       | Create, update, and delete alerts              |
| `status-pages:read`  | List and view status pages                     |
| `status-pages:write` | Create, update, and delete status pages        |
| `maintenance:read`   | List and view maintenance windows              |
| `maintenance:write`  | Create, update, and delete maintenance windows |

### Team Management

| Scope                | Description                       |
| -------------------- | --------------------------------- |
| `teams:read`         | View team details and member list |
| `teams:write`        | Update team settings              |
| `invites:read`       | List pending invitations          |
| `invites:write`      | Create and revoke invitations     |
| `team-domains:read`  | List verified domains             |
| `team-domains:write` | Add and remove verified domains   |

### API Key Management

| Scope            | Description                                     |
| ---------------- | ----------------------------------------------- |
| `api-keys:read`  | List API keys (excluding the secret key itself) |
| `api-keys:write` | Create and delete API keys                      |

## Viewing API Keys

The API Keys page shows all keys for your team:

- **Name** — The identifier you assigned when creating the key
- **Prefix** — The first characters of the key (e.g., `uptime_a1b2c3d4`) for identification
- **Scopes** — The permissions granted to the key
- **Last Used** — When the key was last used to make an API request
- **Expires** — The expiration date, if one was set

The full key is never displayed after creation. If you lose a key, delete it and create a new one.

## Deleting an API Key

To revoke an API key:

1. Navigate to **Settings** > **API Keys**
2. Find the key you want to delete
3. Click the **Delete** button
4. Confirm the deletion

Deletion is immediate. Any applications using the key will stop working as soon as the key is deleted.

## Limits and Permissions

- Each team can have a maximum of **10 API keys**
- Only users with the **Admin** or **Owner** role can create, view, and delete API keys
- Members cannot access the API Keys settings page

If you need more than 10 keys, consider consolidating integrations or using keys with broader scopes for related services.
