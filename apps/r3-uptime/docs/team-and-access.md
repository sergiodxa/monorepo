# Team and Access

## Purpose

Team and access features let multiple people share one monitoring workspace while controlling who can manage settings, invite members, and use the API.

## Teams

Each team acts as an isolated workspace for:

- Monitors
- Alerts
- Status pages
- Maintenance windows
- API keys
- Domains
- Billing and subscription state

Users can belong to multiple teams and switch between them.

## Roles

The product uses three user-facing roles:

- Owner
- Admin
- Member

### Owner

- Full team control
- Billing access
- Team deletion access
- Ownership transfer access

### Admin

- Can manage operational team features
- Can invite or remove members
- Can manage most settings
- Does not own the team

### Member

- Can work with day-to-day monitoring features
- Does not manage team administration, billing, or API keys

## Invites

### Purpose

Invites let admins and owners add people by email.

### How It Works

1. An admin or owner sends an email invite.
2. The invited person opens the invite link.
3. The invited person must sign in with the same email address.
4. Accepting the invite adds that user to the team as a member.

### Invite States

- Pending
- Accepted
- Revoked
- Expired

## Team Domains

### Purpose

Verified domains let new users join a team automatically based on their email domain.

### How It Works

1. The team adds a domain.
2. The team verifies ownership through DNS.
3. After verification, new signups with matching email domains are automatically added to the team.

### Domain States

- Pending verification
- Verified
- Removed

## API Keys

### Purpose

API keys provide programmatic access to the product on behalf of a team.

### What Users Configure

- Name
- Scopes
- Optional expiration

### Key Rules

- The full key is shown only once when created.
- Keys authenticate API requests.
- Expired or revoked keys stop working immediately.
- Keys use explicit scopes rather than full access by default.

## Authentication Model

- The web app requires signed-in users.
- Team routes require team membership.
- The API requires a bearer API key.
- Missing or invalid credentials must produce unauthorized responses.
- Valid credentials without permission must produce forbidden responses.

## Scope Model

API scopes allow least-privilege access to features such as:

- Teams
- Invites
- Team domains
- Monitors
- Alerts
- Maintenance
- Status pages
- Cron jobs
- API keys

## Defaults and Limits

- New members join as `member`.
- Auto-provisioned users from verified domains also join as `member`.
- Teams support up to `10` API keys.

## Important Behavior Notes

- Team roles govern the app UI.
- API scopes govern programmatic access.
- These are separate permission systems and both are part of the product.

## Reimplementation Guidance

Preserve these product rules:

- Team isolation is fundamental.
- Roles and API scopes must remain separate concerns.
- Invites, domain-based auto-join, and API keys are core onboarding and integration features, not optional extras.
