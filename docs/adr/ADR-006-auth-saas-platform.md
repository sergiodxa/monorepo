# ADR-006: Auth SaaS Platform

## Status

**In Progress** - 2026-02-26 (Updated: 2026-03-02)

### Implementation Progress

#### Completed

- [x] Tenant Durable Object with embedded SQLite
  - [x] All models (Subject, Client, Session, Passkey, Resource, Grant, etc.)
  - [x] All controllers for OIDC endpoints
  - [x] Management API for tenant administration
  - [x] 68 tests passing for model layer
- [x] Platform D1 schema and models (tenants, hostnames, subscriptions, mau_tracking)
- [x] D1 database adapter for platform
- [x] Dashboard controllers
  - [x] Landing page with marketing content
  - [x] Onboarding page with WebAuthn authentication flow
  - [x] Tenant list/create/edit/delete
  - [x] Client management (CRUD + secrets, redirect URIs, logout URIs)
  - [x] User management (list, view, edit, delete with sessions/passkeys/grants)
  - [x] Resource management (CRUD + scopes)
  - [x] Branding configuration
  - [x] Hostname configuration for custom domains
- [x] TenantApiService for dashboard-to-DO communication
- [x] Session middleware for platform authentication
- [x] Tenant-owner middleware for access control
- [x] Auto-generated management client on tenant creation
- [x] Logger middleware for platform routes
- [x] WebAuthn proxy endpoints for platform onboarding
- [x] OIDC flows (authorize, token, userinfo, logout, discovery)
- [x] WebAuthn server implementation (simplewebauthn integration)
- [x] DO alarm for cleanup tasks (expired sessions, codes, challenges, tokens, unverified users)
- [x] Email verification controller
- [x] Email sending integration (Resend)
  - [x] EmailService with send, sendVerificationEmail, sendPasswordResetEmail methods
- [x] Billing integration (Polar)
  - [x] PolarService with customer, subscription, meter, checkout, and portal methods
- [x] MAU tracking and reporting
  - [x] AnalyticsService for tracking events via Analytics Engine
  - [x] trackAuthentication, trackRegistration, trackVerification, trackLogout methods
  - [x] queryMAU, queryAllTenantsMAU for querying Analytics Engine
  - [x] Daily MAU reporting job (scheduled handler)
  - [x] MAU tracking in auth-verify and register-verify controllers
- [x] Cloudflare for SaaS custom hostname provisioning
  - [x] HostnameService with create, get, list, delete, refresh methods
  - [x] SSL validation helpers (getValidationRecord, isActive, isPendingValidation)

- [x] Dashboard service integrations
  - [x] Hostname model uses HostnameService (real Cloudflare for SaaS API)
  - [x] Subscription model uses PolarService (billing integration)
  - [x] Billing page shows actual MAU from Analytics Engine
  - [x] Subscription created on tenant creation
- [x] Polar webhook handler
  - [x] checkout.completed - links subscription after checkout
  - [x] subscription.active/updated/canceled - syncs status
  - [x] Optional webhook signature verification

#### Pending

- [ ] Test end-to-end flows in production
- [ ] Subscription status enforcement (block access for unpaid)

## Background

The monorepo contains `apps/auth`, a comprehensive OAuth 2.0 Authorization Server and OpenID Connect (OIDC) Provider. Currently, this application serves as a single-tenant authentication service for internal applications.

There is an opportunity to transform this into a multi-tenant authentication-as-a-service platform, allowing external companies to use the OIDC provider for their own applications. This would leverage Cloudflare's edge infrastructure (Durable Objects, Workers for Platforms, CF for SaaS) to provide isolated, low-latency authentication services globally.

## Context

### Current Architecture (apps/auth)

The existing auth application is a fully-featured OIDC provider with:

| Feature          | Implementation                                                                     |
| ---------------- | ---------------------------------------------------------------------------------- |
| OAuth 2.0 Grants | Authorization Code (PKCE), Refresh Token, Client Credentials                       |
| OIDC Core        | ID Tokens, UserInfo, Discovery                                                     |
| OIDC Extensions  | RP-Initiated Logout, Back-Channel Logout, Front-Channel Logout, Session Management |
| Token Signing    | ES256 (ECDSA P-256)                                                                |
| Storage          | D1 (SQLite), KV (auth codes), R2 (signing keys)                                    |
| Authentication   | GitHub OAuth, Credentials (email/password)                                         |

### Limitations of Current Architecture

| Limitation        | Impact                                      |
| ----------------- | ------------------------------------------- |
| Single-tenant     | Only usable by internal applications        |
| Shared database   | No data isolation between clients           |
| Fixed issuer      | Hardcoded to `auth.sergiodxa.com`           |
| No custom domains | External users cannot use their own domains |
| No billing        | Cannot monetize the service                 |

### Multi-Tenancy Requirements

1. **Data Isolation**: Each tenant must have completely isolated data (users, clients, sessions, keys)
2. **Custom Domains**: Tenants must be able to use their own domains (e.g., `auth.acme.com`)
3. **Geographic Placement**: Tenants should be able to choose their data location for compliance/latency
4. **Scalability**: Each tenant should scale independently
5. **Self-Service**: Tenants should manage their own configuration via dashboard and API

### Technology Choices

| Requirement          | Technology                  | Rationale                                                                   |
| -------------------- | --------------------------- | --------------------------------------------------------------------------- |
| Tenant Isolation     | Cloudflare Durable Objects  | Each DO instance has its own embedded SQLite, providing true data isolation |
| Custom Domains       | Cloudflare for SaaS         | Manages custom hostnames with TLS certificates and routes to our worker     |
| Geographic Placement | DO locationHint             | Allows placing tenant data in specific regions                              |
| Analytics            | Cloudflare Analytics Engine | High-cardinality metrics for usage tracking and billing                     |
| Billing              | Polar                       | Usage-based billing with meters for MAU tracking                            |
| Email                | Resend                      | Transactional emails for verification (CF Email Sending later)              |

## Decision

Build a new application `apps/auth-saas` that provides multi-tenant authentication-as-a-service using Cloudflare Durable Objects for tenant isolation.

### Core Architecture

```
+-----------------------------------------------------------------------------+
|                              Request Flow                                   |
+-----------------------------------------------------------------------------+

 auth.acme.com                           auth.sergiodxa.com
 (Custom hostname)                       (Platform domain)
        |                                       |
        | cf.hostMetadata.tenant_id             | no hostMetadata
        |                                       |
        v                                       v
+----------------+                    +------------------------------+
| Worker Entry   |                    |       Worker Entry           |
|                |                    |                              |
| tenant_id?     |                    | /dashboard/* or / ?          |
| -> DO.fetch()  |                    | -> Remix v3                  |
+----------------+                    | else                         |
        |                             | -> DO.fetch("platform")      |
        |                             +------------------------------+
        |                                    |              |
        v                                    v              v
+----------------+                    +-----------+  +----------------+
| Tenant DO      |                    | Remix v3  |  | Platform DO    |
| (UUID)         |                    | Dashboard |  | ("platform")   |
+----------------+                    +-----------+  +----------------+
```

### Key Design Decisions

| Decision                      | Choice                               | Rationale                                           |
| ----------------------------- | ------------------------------------ | --------------------------------------------------- |
| DO Identifier                 | Tenant UUID                          | Allows hostname changes without data migration      |
| Default Hostname              | `{slug}.auth.sergiodxa.com`          | Tenants get working auth immediately                |
| Platform DO ID                | `"platform"`                         | Special case for dogfooding                         |
| Authentication                | Email + Passkey (WebAuthn)           | Modern, phishing-resistant, passwordless            |
| Dashboard Framework           | Remix v3                             | Waiting for release with required features          |
| DO UI                         | Server-rendered HTML                 | Simple, fast, no JS framework overhead              |
| Client Secret Prefix          | `sdx_auth_`                          | Easy identification in logs                         |
| Multiple Secrets/Client       | Yes                                  | Enables zero-downtime rotation                      |
| Multiple Redirect URIs/Client | Yes                                  | Supports multiple environments (prod/staging/local) |
| Multiple Logout URIs/Client   | Yes                                  | Same reasoning as redirect URIs                     |
| Hostnames per Tenant          | One                                  | Simplifies routing and billing                      |
| Region Selection              | Auto-detect + user choice, immutable | DO locationHint only works on first instantiation   |

### Directory Structure

```
apps/auth-saas/
|-- app/dashboard/
|   |-- index.ts
|   |-- components/
|   |-- routes/
|-- app/jobs/
|   +-- report-mau.ts
|-- app/tenant/
|   |-- index.ts
|   |-- router.ts
|   |-- components/
|   |-- controllers/
|   |-- db/
|   |-- entities/
|   |-- migrations/
|   |-- models/
|   +-- modules/
|-- app/entry.client.tsx
+-- app/entry.worker.ts
```

```
apps/auth-saas/
|-- app/                              # Remix v3 app (Control Plane Dashboard)
|   |-- components/
|   |   |-- ui/                       # Shared UI components
|   |   +-- forms/                    # Form components
|   |-- routes/
|   |   |-- _index/                   # Landing page
|   |   |-- dashboard/
|   |   |   |-- _layout.tsx           # Dashboard layout (auth required)
|   |   |   |-- _index/               # Overview (list tenants)
|   |   |   |-- tenants.$id/          # Tenant detail
|   |   |   |-- tenants.$id.clients/  # Manage clients
|   |   |   |-- tenants.$id.users/    # View users
|   |   |   |-- tenants.$id.resources/# Manage APIs/scopes
|   |   |   |-- tenants.$id.branding/ # Customize UI
|   |   |   |-- tenants.$id.hostname/ # Custom domain
|   |   |   +-- tenants.$id.settings/ # Tenant settings
|   |   |-- onboarding/               # New tenant creation
|   |   |   |-- _index/               # Step 1: Company info
|   |   |   |-- region/               # Step 2: Select region
|   |   |   +-- complete/             # Step 3: Show credentials
|   |   +-- _setup/                   # One-time bootstrap (remove after)
|   |-- services/
|   |   |-- tenant.server.ts          # Tenant CRUD
|   |   |-- hostname.server.ts        # CF for SaaS API
|   |   |-- polar.server.ts           # Billing integration
|   |   |-- resend.server.ts          # Email sending
|   |   +-- analytics.server.ts       # Analytics Engine queries
|   |-- middleware/
|   |   +-- auth.ts                   # Dashboard auth via platform tenant
|   |-- jobs/
|   |   +-- report-mau.ts             # Daily MAU reporting to Polar
|   |-- entry.worker.ts               # Worker entry (routing logic)
|   +-- entry.server.tsx              # Remix server entry
|
|-- tenant/                           # Durable Object (OIDC Provider)
|   |-- index.ts                      # OIDCProvider DO class
|   |-- router.ts                     # Internal request routing
|   |
|   |-- handlers/                     # Route handlers
|   |   |-- authorize.ts              # GET/POST /authorize
|   |   |-- token.ts                  # POST /oauth/token
|   |   |-- revoke.ts                 # POST /oauth/revoke
|   |   |-- introspect.ts             # POST /oauth/introspect
|   |   |-- userinfo.ts               # GET/POST /userinfo
|   |   |-- logout.ts                 # GET /oidc/logout
|   |   |-- discovery.ts              # /.well-known/* endpoints
|   |   |-- webauthn.ts               # /webauthn/* endpoints
|   |   |-- verify-email.ts           # GET /verify-email
|   |   +-- management/               # /api/* Management API
|   |       |-- clients.ts
|   |       |-- secrets.ts
|   |       |-- redirect-uris.ts
|   |       |-- logout-uris.ts
|   |       |-- users.ts
|   |       |-- resources.ts
|   |       |-- branding.ts
|   |       +-- stats.ts
|   |
|   |-- modules/                      # Core logic
|   |   |-- oauth2.ts                 # OIDC implementation (ported)
|   |   |-- webauthn.ts               # WebAuthn server logic
|   |   |-- jwks.ts                   # Key generation/management
|   |   +-- email.ts                  # Email templates + sending
|   |
|   |-- entities/                     # Token classes
|   |   |-- access-token.ts
|   |   |-- id-token.ts
|   |   +-- logout-token.ts
|   |
|   |-- db/                           # SQLite schema
|   |   |-- schema.sql                # Full schema
|   |   +-- migrations.ts             # Version-based migrations
|   |
|   +-- ui/                           # Server-rendered HTML
|       |-- templates/
|       |   |-- layout.ts             # Base HTML layout
|       |   |-- login.ts              # Email input page
|       |   |-- passkey-register.ts   # Passkey registration
|       |   |-- passkey-auth.ts       # Passkey authentication
|       |   |-- verify-email.ts       # Email verification page
|       |   |-- logout.ts             # Logout confirmation
|       |   +-- error.ts              # Error page
|       |-- styles.ts                 # CSS (with branding support)
|       +-- scripts.ts                # Vanilla JS (WebAuthn API)
|
|-- db/                               # Control Plane D1
|   |-- schema.ts                     # Drizzle schema
|   +-- migrations/
|
|-- wrangler.jsonc
|-- package.json
|-- tsconfig.json
+-- AGENTS.md
```

### Worker Entry Routing

```typescript
// app/entry.worker.ts
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		let url = new URL(request.url);
		let hostname = url.hostname;
		let metadata = request.cf?.hostMetadata as { tenant_id?: string; region?: string };

		// Custom hostname with tenant metadata -> Tenant DO
		if (metadata?.tenant_id) {
			let stub = env.OIDC.getByName(metadata.tenant_id);
			return stub.fetch(request);
		}

		// Platform domain (auth.sergiodxa.com)
		if (hostname === env.PLATFORM_DOMAIN) {
			// Dashboard routes -> Remix v3
			if (
				url.pathname === "/" ||
				url.pathname.startsWith("/dashboard") ||
				url.pathname.startsWith("/onboarding")
			) {
				return requestHandler(request, env, ctx);
			}

			// OIDC routes -> Platform tenant DO
			let stub = env.OIDC.getByName("platform");
			return stub.fetch(request);
		}

		return new Response("Not found", { status: 404 });
	},
};
```

### Durable Object Structure

```typescript
// tenant/index.ts
import { DurableObject } from "cloudflare:workers";

export class OIDCProvider extends DurableObject<Env> {
	private initialized = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(() => this.migrate());
	}

	async fetch(request: Request): Promise<Response> {
		await this.ensureInitialized();
		return this.router.handle(request);
	}

	async alarm(): Promise<void> {
		await this.cleanup();
		// Reschedule for tomorrow
		await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
	}

	private async migrate() {
		let version = this.ctx.storage.sql
			.exec<{ user_version: number }>("PRAGMA user_version")
			.one().user_version;

		if (version < 1) {
			// Initial schema
			this.ctx.storage.sql.exec(SCHEMA_V1);
			this.ctx.storage.sql.exec("PRAGMA user_version = 1");
		}
		// Future migrations...
	}

	private async ensureInitialized() {
		if (this.initialized) return;

		// Check if signing keys exist, generate if not
		let keys = this.ctx.storage.sql
			.exec<{ id: string }>("SELECT id FROM signing_keys WHERE is_current = 1")
			.toArray();

		if (keys.length === 0) {
			await this.generateSigningKey();
		}

		// Schedule cleanup alarm if not set
		let alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
		}

		this.initialized = true;
	}

	private async cleanup() {
		let now = Date.now();
		let oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

		// Delete unverified users older than 7 days
		this.ctx.storage.sql.exec(
			"DELETE FROM subjects WHERE email_verified_at IS NULL AND created_at < ?",
			oneWeekAgo,
		);

		// Delete expired authorization codes
		this.ctx.storage.sql.exec("DELETE FROM authorization_codes WHERE expires_at < ?", now);

		// Delete expired sessions
		this.ctx.storage.sql.exec("DELETE FROM sessions WHERE expires_at < ?", now);

		// Delete expired WebAuthn challenges
		this.ctx.storage.sql.exec("DELETE FROM webauthn_challenges WHERE expires_at < ?", now);

		// Delete expired email verification tokens
		this.ctx.storage.sql.exec("DELETE FROM email_verification_tokens WHERE expires_at < ?", now);
	}
}
```

### DO SQLite Schema

```sql
-- ============================================================================
-- SUBJECTS & AUTHENTICATION
-- ============================================================================

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified_at INTEGER,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_subjects_email ON subjects(email);
CREATE INDEX idx_subjects_created_unverified ON subjects(created_at)
  WHERE email_verified_at IS NULL;

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up INTEGER DEFAULT 0,
  transports TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_passkeys_subject ON passkeys(subject_id);

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX idx_connections_subject ON connections(subject_id);

-- ============================================================================
-- SESSIONS
-- ============================================================================

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_subject ON sessions(subject_id);
CREATE INDEX idx_sessions_client ON sessions(client_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- OAUTH CLIENTS
-- ============================================================================

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  type TEXT NOT NULL,                -- public, confidential, m2m
  allowed_scopes TEXT,               -- JSON array, null = all
  allowed_resources TEXT,            -- JSON array of resource IDs
  is_management_client INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE client_secrets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL,
  name TEXT,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_client_secrets_client ON client_secrets(client_id);

CREATE TABLE client_redirect_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  environment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(client_id, uri)
);
CREATE INDEX idx_client_redirect_uris_client ON client_redirect_uris(client_id);

CREATE TABLE client_logout_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  type TEXT NOT NULL,                -- post_logout, backchannel, frontchannel
  session_required INTEGER DEFAULT 0,
  environment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(client_id, uri, type)
);
CREATE INDEX idx_client_logout_uris_client ON client_logout_uris(client_id);

-- ============================================================================
-- RESOURCES & GRANTS
-- ============================================================================

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  scopes TEXT NOT NULL,              -- JSON array of { name, description }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scopes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(subject_id, client_id)
);
CREATE INDEX idx_grants_subject ON grants(subject_id);
CREATE INDEX idx_grants_client ON grants(client_id);

-- ============================================================================
-- SHORT-LIVED TOKENS
-- ============================================================================

CREATE TABLE authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  nonce TEXT,
  pkce_challenge TEXT,
  pkce_method TEXT,
  auth_time INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_authz_codes_expires ON authorization_codes(expires_at);

CREATE TABLE webauthn_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL,                -- registration, authentication
  subject_id TEXT,
  email TEXT,
  client_id TEXT,
  redirect_uri TEXT,
  state TEXT,
  nonce TEXT,
  scope TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_webauthn_expires ON webauthn_challenges(expires_at);

CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_email_tokens_expires ON email_verification_tokens(expires_at);
CREATE INDEX idx_email_tokens_token ON email_verification_tokens(token);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

CREATE TABLE signing_keys (
  id TEXT PRIMARY KEY,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'ES256',
  is_current INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  logo_url TEXT,
  primary_color TEXT,
  background_color TEXT,
  custom_css TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- github, google, etc.
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  scopes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE tenant_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: tenant_id, issuer, region, created_at
```

### Control Plane D1 Schema

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,               -- UUID
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,         -- For default subdomain
  owner_subject_id TEXT NOT NULL,    -- Subject in platform tenant
  region TEXT NOT NULL,              -- wnam, enam, weur, etc.
  status TEXT DEFAULT 'active',      -- active, suspended, deleted
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_tenants_owner ON tenants(owner_subject_id);
CREATE INDEX idx_tenants_slug ON tenants(slug);

CREATE TABLE hostnames (
  id TEXT PRIMARY KEY,               -- CF custom hostname ID
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  is_default INTEGER DEFAULT 0,      -- The auto-generated subdomain
  status TEXT NOT NULL,              -- pending_validation, active, deleted
  ssl_status TEXT,
  validation_txt_name TEXT,
  validation_txt_value TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_hostnames_tenant ON hostnames(tenant_id);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  polar_customer_id TEXT,
  polar_subscription_id TEXT,
  status TEXT NOT NULL,              -- active, canceled, past_due
  current_period_start INTEGER,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);

CREATE TABLE mau_tracking (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,          -- Subject ID from tenant's DO
  month TEXT NOT NULL,               -- YYYY-MM format
  first_auth_at INTEGER NOT NULL,
  UNIQUE(tenant_id, subject_id, month)
);
CREATE INDEX idx_mau_tenant_month ON mau_tracking(tenant_id, month);
```

### Authentication Flows

#### Passkey Registration (New User)

```
+----------+     +------------+     +----------+     +------------+
|  Client  |     |    DO      |     | Browser  |     |   Resend   |
+----+-----+     +-----+------+     +----+-----+     +-----+------+
     |                 |                 |                 |
     | GET /authorize  |                 |                 |
     | ?client_id=...  |                 |                 |
     |---------------->|                 |                 |
     |                 |                 |                 |
     |    Login Page   |                 |                 |
     |<----------------|                 |                 |
     |                 |                 |                 |
     | POST /authorize |                 |                 |
     | email=new@...   |                 |                 |
     |---------------->|                 |                 |
     |                 |                 |                 |
     |                 | No subject found|                 |
     |                 | Create subject  |                 |
     |                 | (unverified)    |                 |
     |                 |                 |                 |
     | Registration    |                 |                 |
     | Options Page    |                 |                 |
     |<----------------|                 |                 |
     |                 |                 |                 |
     |                 |  JS: navigator  |                 |
     |                 |  .credentials   |                 |
     |                 |  .create()      |                 |
     |                 |<--------------->|                 |
     |                 |                 |                 |
     | POST /webauthn/ |                 |                 |
     | register/verify |                 |                 |
     |---------------->|                 |                 |
     |                 |                 |                 |
     |                 | Store passkey   |                 |
     |                 | Create session  |                 |
     |                 |----------------------------------->|
     |                 |                 |  Send verify    |
     |                 |                 |  email          |
     |                 |                 |                 |
     | Redirect with   |                 |                 |
     | code            |                 |                 |
     |<----------------|                 |                 |
     |                 |                 |                 |
```

#### Passkey Authentication (Existing User)

```
+----------+     +------------+     +----------+
|  Client  |     |    DO      |     | Browser  |
+----+-----+     +-----+------+     +----+-----+
     |                 |                 |
     | GET /authorize  |                 |
     |---------------->|                 |
     |                 |                 |
     | POST /authorize |                 |
     | email=user@...  |                 |
     |---------------->|                 |
     |                 |                 |
     |                 | Subject found   |
     |                 | Has passkey     |
     |                 | Email verified  |
     |                 |                 |
     | Auth Options    |                 |
     | Page            |                 |
     |<----------------|                 |
     |                 |                 |
     |                 |  JS: navigator  |
     |                 |  .credentials   |
     |                 |  .get()         |
     |                 |<--------------->|
     |                 |                 |
     | POST /webauthn/ |                 |
     | auth/verify     |                 |
     |---------------->|                 |
     |                 |                 |
     |                 | Verify signature|
     |                 | Create session  |
     |                 | Track MAU       |
     |                 |                 |
     | Redirect with   |                 |
     | code            |                 |
     |<----------------|                 |
```

#### Client Credentials (M2M)

```
+----------+     +------------+
|  Client  |     |    DO      |
+----+-----+     +-----+------+
     |                 |
     | POST /oauth/    |
     | token           |
     | grant_type=     |
     | client_creds    |
     | Authorization:  |
     | Basic ...       |
     |---------------->|
     |                 |
     |                 | Validate client
     |                 | Check secret
     |                 | (any valid one)
     |                 |
     | access_token    |
     |<----------------|
```

#### Email Verification

```
+----------+     +------------+     +----------+
|  User    |     |    DO      |     |  Resend  |
+----+-----+     +-----+------+     +----+-----+
     |                 |                 |
     |                 | (after passkey  |
     |                 |  registration)  |
     |                 |---------------->|
     |                 |                 | Send email with
     |                 |                 | verification link
     |                 |                 |
     | Click link      |                 |
     | /verify-email   |                 |
     | ?token=xxx      |                 |
     |---------------->|                 |
     |                 |                 |
     |                 | Validate token  |
     |                 | Mark verified   |
     |                 | Delete token    |
     |                 |                 |
     | Success page    |                 |
     |<----------------|                 |
```

#### Unverified User Flow

```
User has registered but not verified email:

1. User tries to log in
2. DO finds subject with passkey
3. Check email_verified_at -> NULL
4. Return error: "Please verify your email address"
5. User cannot authenticate until verified

After 7 days without verification:
1. Daily cleanup alarm runs
2. Deletes subjects where:
   - email_verified_at IS NULL
   - created_at < 7 days ago
3. User must register again
```

### OIDC Endpoints (DO Routes)

| Path                                      | Method   | Description                                       |
| ----------------------------------------- | -------- | ------------------------------------------------- |
| `/authorize`                              | GET      | Show login UI                                     |
| `/authorize`                              | POST     | Process email submission                          |
| `/oauth/token`                            | POST     | Token endpoint (auth_code, refresh, client_creds) |
| `/oauth/revoke`                           | POST     | Revoke tokens                                     |
| `/oauth/introspect`                       | POST     | Introspect tokens                                 |
| `/userinfo`                               | GET/POST | Get user claims                                   |
| `/oidc/logout`                            | GET      | RP-Initiated Logout                               |
| `/.well-known/openid-configuration`       | GET      | OIDC Discovery                                    |
| `/.well-known/oauth-authorization-server` | GET      | OAuth 2.0 Metadata                                |
| `/.well-known/jwks.json`                  | GET      | Public signing keys                               |
| `/webauthn/register/options`              | POST     | Get passkey registration options                  |
| `/webauthn/register/verify`               | POST     | Verify passkey registration                       |
| `/webauthn/authenticate/options`          | POST     | Get passkey authentication options                |
| `/webauthn/authenticate/verify`           | POST     | Verify passkey authentication                     |
| `/verify-email`                           | GET      | Email verification callback                       |

### Management API

All endpoints require `Authorization: Bearer <access_token>` from a management client (using client_credentials grant).

#### Clients

```
GET    /api/clients                      - List clients
POST   /api/clients                      - Create client
GET    /api/clients/:id                  - Get client
PATCH  /api/clients/:id                  - Update client
DELETE /api/clients/:id                  - Delete client
```

#### Client Secrets

```
GET    /api/clients/:id/secrets          - List secrets (id, name, created_at, last_used_at)
POST   /api/clients/:id/secrets          - Create secret (returns plain secret ONCE)
DELETE /api/clients/:id/secrets/:sid     - Delete secret
```

#### Client Redirect URIs

```
GET    /api/clients/:id/redirect-uris    - List redirect URIs
POST   /api/clients/:id/redirect-uris    - Add redirect URI
DELETE /api/clients/:id/redirect-uris/:uid - Remove redirect URI
```

#### Client Logout URIs

```
GET    /api/clients/:id/logout-uris      - List logout URIs
POST   /api/clients/:id/logout-uris      - Add logout URI
DELETE /api/clients/:id/logout-uris/:uid - Remove logout URI
```

#### Users

```
GET    /api/users                        - List users (paginated)
GET    /api/users/:id                    - Get user
PATCH  /api/users/:id                    - Update user
DELETE /api/users/:id                    - Delete user
GET    /api/users/:id/sessions           - List user sessions
DELETE /api/users/:id/sessions/:sid      - Revoke session
```

#### Resources

```
GET    /api/resources                    - List resources
POST   /api/resources                    - Create resource
GET    /api/resources/:id                - Get resource
PATCH  /api/resources/:id                - Update resource
DELETE /api/resources/:id                - Delete resource
```

#### Branding

```
GET    /api/branding                     - Get branding config
PATCH  /api/branding                     - Update branding
```

#### Stats

```
GET    /api/stats                        - Get tenant statistics
       Response: { mau, total_users, total_sessions, total_clients }
```

### Dashboard UI Wireframes

#### Tenant List (Dashboard Home)

```
+-------------------------------------------------------------------+
|  Auth SaaS                                    [user@email.com v]  |
+-------------------------------------------------------------------+
|                                                                   |
|  Your Tenants                               [+ Create Tenant]     |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Acme Corp                                                  |  |
|  |  acme-corp-7x3k.auth.sergiodxa.com                         |  |
|  |  MAU: 1,234 | Users: 5,678 | Region: Western US             |  |
|  |                                               [Manage ->]   |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Startup Inc                                                |  |
|  |  auth.startup.io (custom)                                   |  |
|  |  MAU: 456 | Users: 890 | Region: Western Europe             |  |
|  |                                               [Manage ->]   |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
+-------------------------------------------------------------------+
```

#### Client Management

```
+-------------------------------------------------------------------+
|  Auth SaaS > Acme Corp > Clients                                  |
+-------------------------------------------------------------------+
|                                                                   |
|  OAuth Clients                                  [+ Create Client] |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  My Web App                              Type: Confidential  |  |
|  |  Client ID: clnt_abc123xyz789                       [Copy]  |  |
|  |  Created: Jan 15, 2026                                      |  |
|  |                                               [Manage ->]   |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Mobile App                                   Type: Public   |  |
|  |  Client ID: clnt_def456uvw012                       [Copy]  |  |
|  |  Created: Feb 1, 2026                                       |  |
|  |                                               [Manage ->]   |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
+-------------------------------------------------------------------+
```

#### Client Detail

```
+-------------------------------------------------------------------+
|  Auth SaaS > Acme Corp > Clients > My Web App                     |
+-------------------------------------------------------------------+
|                                                                   |
|  Client: My Web App                                               |
|  Client ID: clnt_abc123xyz789                             [Copy]  |
|  Type: Confidential                                               |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Secrets                                         [+ Add]    |  |
|  |  -----------------------------------------------------------  |
|  |  | Name        | Created    | Last Used  |                |  |
|  |  |-------------|------------|------------|----------------|  |
|  |  | Production  | Jan 15     | 2h ago     | [Delete]       |  |
|  |  | Staging     | Jan 10     | 5d ago     | [Delete]       |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Redirect URIs                                   [+ Add]    |  |
|  |  -----------------------------------------------------------  |
|  |  | URI                               | Environment |       |  |
|  |  |-----------------------------------|-------------|-------|  |
|  |  | https://app.com/callback          | production  | [Del] |  |
|  |  | https://staging.app.com/callback  | staging     | [Del] |  |
|  |  | http://localhost:3000/callback    | development | [Del] |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Logout URIs                                     [+ Add]    |  |
|  |  -----------------------------------------------------------  |
|  |  | URI                       | Type         | Env        |  |  |
|  |  |---------------------------|--------------|------------|  |  |
|  |  | https://app.com/logout    | post_logout  | production |  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  [Delete Client]                                                  |
|                                                                   |
+-------------------------------------------------------------------+
```

#### New Secret Modal

```
+-------------------------------------------------------------------+
|                                                                   |
|  +-----------------------------------------------------------+   |
|  |                                                           |   |
|  |  New Client Secret Created                                |   |
|  |                                                           |   |
|  |  (!) Copy this secret now. You won't see it again.        |   |
|  |                                                           |   |
|  |  +-----------------------------------------------------+  |   |
|  |  | sdx_auth_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789abcdef  |  |   |
|  |  |                                            [Copy]   |  |   |
|  |  +-----------------------------------------------------+  |   |
|  |                                                           |   |
|  |  Name: Production (optional)                              |   |
|  |                                                           |   |
|  |                                         [Done]            |   |
|  |                                                           |   |
|  +-----------------------------------------------------------+   |
|                                                                   |
+-------------------------------------------------------------------+
```

#### Custom Domain Setup

```
+-------------------------------------------------------------------+
|  Auth SaaS > Acme Corp > Custom Domain                            |
+-------------------------------------------------------------------+
|                                                                   |
|  Current Hostname                                                 |
|  +-------------------------------------------------------------+  |
|  |  acme-corp-7x3k.auth.sergiodxa.com                          |  |
|  |  Status: Active                                    [Remove]  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Add Custom Domain                                                |
|  +-------------------------------------------------------------+  |
|  |                                                             |  |
|  |  Hostname: [auth.acme.com                    ]              |  |
|  |                                                             |  |
|  |  [Add Domain]                                               |  |
|  |                                                             |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Pending Validation                                               |
|  +-------------------------------------------------------------+  |
|  |  auth.acme.com                                              |  |
|  |  Status: Pending DNS validation                             |  |
|  |                                                             |  |
|  |  Add this TXT record to your DNS:                           |  |
|  |                                                             |  |
|  |  Name:  _cf-custom-hostname.auth                            |  |
|  |  Value: ca3-abcdef123456789                                 |  |
|  |                                                             |  |
|  |  [Check Status]                            [Cancel]         |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
+-------------------------------------------------------------------+
```

#### Branding Configuration

```
+-------------------------------------------------------------------+
|  Auth SaaS > Acme Corp > Branding                                 |
+-------------------------------------------------------------------+
|                                                                   |
|  Login Page Customization                                         |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Logo                                                       |  |
|  |  +-------------------+                                      |  |
|  |  |                   |  [Upload Logo]                       |  |
|  |  |    [ACME LOGO]    |                                      |  |
|  |  |                   |  Recommended: 200x50px, PNG/SVG      |  |
|  |  +-------------------+                                      |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Colors                                                     |  |
|  |                                                             |  |
|  |  Primary Color:     [#3B82F6] [====]                        |  |
|  |  Background Color:  [#FFFFFF] [====]                        |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |  Custom CSS (Advanced)                                      |  |
|  |                                                             |  |
|  |  +-------------------------------------------------------+  |  |
|  |  | .login-form {                                         |  |  |
|  |  |   border-radius: 8px;                                 |  |  |
|  |  | }                                                     |  |  |
|  |  +-------------------------------------------------------+  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Preview                                                          |
|  +-------------------------------------------------------------+  |
|  |  +-------------------------------------------------------+  |  |
|  |  |                                                       |  |  |
|  |  |                    [ACME LOGO]                        |  |  |
|  |  |                                                       |  |  |
|  |  |           +-----------------------------+             |  |  |
|  |  |           | Email                       |             |  |  |
|  |  |           +-----------------------------+             |  |  |
|  |  |                                                       |  |  |
|  |  |              [Continue with Passkey]                  |  |  |
|  |  |                                                       |  |  |
|  |  +-------------------------------------------------------+  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  [Save Changes]                                                   |
|                                                                   |
+-------------------------------------------------------------------+
```

### Login UI (DO Server-Rendered)

#### Email Input Page

```html
<!DOCTYPE html>
<html>
	<head>
		<title>Sign In - {tenant_name}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<style>
			/* Base styles + branding variables */
			:root {
			  --primary: {primary_color};
			  --background: {background_color};
			}
			/* ... styles ... */
			{custom_css}
		</style>
	</head>
	<body>
		<div class="container">
			<div class="logo">
				<img src="{logo_url}" alt="{tenant_name}" />
			</div>

			<form method="POST" action="/authorize" class="login-form">
				<input type="hidden" name="client_id" value="{client_id}" />
				<input type="hidden" name="redirect_uri" value="{redirect_uri}" />
				<input type="hidden" name="state" value="{state}" />
				<input type="hidden" name="scope" value="{scope}" />
				<input type="hidden" name="response_type" value="code" />

				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					autocomplete="email"
					placeholder="you@example.com"
				/>

				{error &&
				<p class="error">{error}</p>
				}

				<button type="submit">Continue</button>
			</form>
		</div>
	</body>
</html>
```

#### Passkey Authentication Page

```html
<!DOCTYPE html>
<html>
	<head>
		<title>Authenticate - {tenant_name}</title>
		<style>
			/* ... */
		</style>
	</head>
	<body>
		<div class="container">
			<div class="logo">
				<img src="{logo_url}" alt="{tenant_name}" />
			</div>

			<div class="auth-prompt">
				<p>Signing in as <strong>{email}</strong></p>
				<p>Use your passkey to continue</p>

				<div id="status" class="status">Waiting for passkey...</div>

				<button id="retry" style="display:none">Try Again</button>
			</div>
		</div>

		<script>
			(async function () {
				const options = { challenge_options_json };

				try {
					const credential = await navigator.credentials.get({
						publicKey: {
							challenge: base64urlToBuffer(options.challenge),
							rpId: options.rpId,
							allowCredentials: options.allowCredentials.map((c) => ({
								id: base64urlToBuffer(c.id),
								type: c.type,
								transports: c.transports,
							})),
							userVerification: options.userVerification,
							timeout: options.timeout,
						},
					});

					const response = {
						id: credential.id,
						rawId: bufferToBase64url(credential.rawId),
						response: {
							clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
							authenticatorData: bufferToBase64url(credential.response.authenticatorData),
							signature: bufferToBase64url(credential.response.signature),
							userHandle: credential.response.userHandle
								? bufferToBase64url(credential.response.userHandle)
								: null,
						},
						type: credential.type,
						authenticatorAttachment: credential.authenticatorAttachment,
					};

					// Submit to server
					const form = document.createElement("form");
					form.method = "POST";
					form.action = "/webauthn/authenticate/verify";

					const input = document.createElement("input");
					input.type = "hidden";
					input.name = "credential";
					input.value = JSON.stringify(response);
					form.appendChild(input);

					const challengeId = document.createElement("input");
					challengeId.type = "hidden";
					challengeId.name = "challenge_id";
					challengeId.value = "{challenge_id}";
					form.appendChild(challengeId);

					document.body.appendChild(form);
					form.submit();
				} catch (error) {
					document.getElementById("status").textContent = "Authentication failed: " + error.message;
					document.getElementById("status").classList.add("error");
					document.getElementById("retry").style.display = "block";
				}
			})();

			document.getElementById("retry").addEventListener("click", () => location.reload());

			function base64urlToBuffer(base64url) {
				const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
				const padding = "=".repeat((4 - (base64.length % 4)) % 4);
				const binary = atob(base64 + padding);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) {
					bytes[i] = binary.charCodeAt(i);
				}
				return bytes.buffer;
			}

			function bufferToBase64url(buffer) {
				const bytes = new Uint8Array(buffer);
				let binary = "";
				for (let i = 0; i < bytes.length; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
			}
		</script>
	</body>
</html>
```

### Wrangler Configuration

```jsonc
{
	"name": "auth-saas",
	"main": "app/entry.worker.ts",
	"compatibility_date": "2024-12-01",
	"compatibility_flags": ["nodejs_compat"],

	"durable_objects": {
		"bindings": [{ "name": "OIDC", "class_name": "OIDCProvider" }],
	},

	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["OIDCProvider"] }],

	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "auth-saas",
			"database_id": "...",
		},
	],

	"analytics_engine_datasets": [{ "binding": "AUTH_EVENTS", "dataset": "auth_events" }],

	"vars": {
		"PLATFORM_DOMAIN": "auth.sergiodxa.com",
		"PLATFORM_TENANT_ID": "platform",
	},

	"triggers": {
		"crons": ["0 0 * * *"],
	},
}
```

### Pricing Model

| Component      | Amount      |
| -------------- | ----------- |
| Base Price     | $5/month    |
| Included MAU   | 1,000       |
| Additional MAU | TBD per MAU |

All features included for all customers:

- Unlimited OAuth clients
- Custom domains
- Branding customization
- Management API access
- All authentication methods
- All OIDC features

### MAU Tracking

Monthly Active Users are tracked on first authentication of the month:

```typescript
// In DO authentication handler
async trackMAU(tenantId: string, subjectId: string) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Track in Analytics Engine
  this.env.AUTH_EVENTS.writeDataPoint({
    blobs: [tenantId, 'mau', subjectId, month],
    doubles: [1],
    indexes: [tenantId]
  });
}
```

Query for MAU count:

```sql
SELECT
  blob1 AS tenant_id,
  COUNT(DISTINCT blob3) AS mau
FROM auth_events
WHERE
  blob2 = 'mau'
  AND blob4 = '2026-02'
GROUP BY tenant_id
```

Daily cron reports to Polar meters.

### Scheduled Jobs

#### Daily Cleanup (DO Alarm)

Each DO runs at its scheduled alarm time:

1. Delete unverified subjects older than 7 days
2. Delete expired authorization codes
3. Delete expired sessions
4. Delete expired WebAuthn challenges
5. Delete expired email verification tokens
6. Reschedule alarm for next day

#### Daily MAU Report (Worker Cron)

Runs at midnight UTC:

1. Query Analytics Engine for each tenant's MAU this month
2. Query D1 mau_tracking table for counts
3. Report to Polar meters API

### Dependencies

```json
{
	"dependencies": {
		"@simplewebauthn/server": "^11.0.0",
		"@edgefirst-dev/jwt": "workspace:*",
		"@pkg/result": "workspace:*",
		"@pkg/logger": "workspace:*",
		"@pkg/validate": "workspace:*",
		"bcryptjs": "^2.4.3",
		"drizzle-orm": "^0.36.0",
		"resend": "^4.0.0",
		"zod": "^3.23.0"
	},
	"devDependencies": {
		"@cloudflare/workers-types": "^4.0.0",
		"drizzle-kit": "^0.28.0"
	}
}
```

### Files to Port from apps/auth

| Source                         | Destination                       | Changes Required                              |
| ------------------------------ | --------------------------------- | --------------------------------------------- |
| `app/modules/oauth2.ts`        | `tenant/modules/oauth2.ts`        | Adapt repository for SQLite, add MAU tracking |
| `app/entities/access-token.ts` | `tenant/entities/access-token.ts` | None                                          |
| `app/entities/id-token.ts`     | `tenant/entities/id-token.ts`     | None                                          |
| `app/entities/logout-token.ts` | `tenant/entities/logout-token.ts` | None                                          |
| `app/modules/jwks.ts`          | `tenant/modules/jwks.ts`          | Generate/store keys in SQLite                 |

## Consequences

### Positive

- **True tenant isolation**: Each tenant's data is in a separate SQLite database within their DO instance
- **Global low-latency**: DOs can be placed in regions close to tenant users
- **Self-service**: Tenants can manage their configuration without contacting support
- **Scalable**: Each tenant scales independently
- **Revenue stream**: Creates a monetizable product from existing infrastructure
- **Modern auth**: Passkeys provide phishing-resistant authentication
- **Edge-native**: Entire authentication flow happens at the edge

### Negative

- **Complexity**: Significantly more complex than single-tenant architecture
- **Data migration**: Hostname changes require new DO (complex migration needed)
- **Region lock-in**: Once a DO is placed, it cannot be moved to another region
- **Framework dependency**: Waiting on Remix v3 for dashboard
- **Operational overhead**: Managing CF for SaaS hostnames, billing integration

### Neutral

- **Separate from apps/auth**: Current auth.sergiodxa.com continues to work independently
- **WebAuthn dependency**: Using @simplewebauthn/server, but vanilla JS on client
- **Resend as interim**: Will switch to CF Email Sending when available

## Implementation Plan

### Phase 1: DO Core

**Priority:** High
**Estimated Effort:** 2 weeks

1. Create `apps/auth-saas` directory structure
2. Port `oauth2.ts` from `apps/auth`, adapt for SQLite
3. Port token entities (access-token, id-token, logout-token)
4. Implement DO class with SQLite migrations
5. Implement WebAuthn module using `@simplewebauthn/server`
6. Implement server-rendered login UI
7. Implement discovery endpoints (`.well-known/*`)
8. Implement token endpoint (authorization_code, refresh_token, client_credentials)
9. Implement email verification with Resend
10. Test with hardcoded "test" tenant

### Phase 2: Control Plane

**Priority:** High
**Estimated Effort:** 1 week

1. Set up D1 schema with Drizzle
2. Create bootstrap endpoint for platform tenant
3. Implement dashboard authentication via platform tenant
4. Create tenant CRUD API
5. Implement slug generation with uniqueness check
6. Basic dashboard UI (list tenants, create tenant)

### Phase 3: Tenant Dashboard

**Priority:** High
**Estimated Effort:** 1 week

1. Client management (CRUD, secrets, redirect URIs, logout URIs)
2. User management (list, view, delete, sessions)
3. Resource/scope management
4. Branding configuration
5. Stats/analytics view

### Phase 4: Custom Domains

**Priority:** Medium
**Estimated Effort:** 1 week

1. Implement CF for SaaS API client
2. Create default subdomain on tenant creation
3. Hostname management UI (add, validate, remove)
4. Set custom metadata on hostnames
5. Handle hostname validation flow

### Phase 5: Billing and Polish

**Priority:** Medium
**Estimated Effort:** 1 week

1. Polar integration (subscription management)
2. MAU tracking in Analytics Engine
3. MAU reporting to Polar meters
4. Cleanup jobs (unverified users, expired data)
5. Error handling and logging
6. Documentation

### Phase 6: Future Enhancements

**Priority:** Low
**Estimated Effort:** Ongoing

1. GitHub OAuth provider
2. Google OAuth provider
3. Password authentication (as alternative to passkey)
4. CF Email Sending (when available)
5. Rate limiting per tenant
6. Audit logs
7. Migration from apps/auth to be a tenant

## Alternatives Considered

### 1. Extend apps/auth with Multi-Tenancy

Add `tenant_id` column to all tables and filter all queries.

**Rejected because:**

- No true data isolation
- Complex query modifications
- Single database becomes bottleneck
- No geographic distribution

### 2. Workers for Platforms (Deploy Worker per Tenant)

Deploy a complete worker for each tenant.

**Rejected because:**

- More complex deployment management
- Higher operational overhead
- Storage still needs to be shared or replicated
- More expensive at scale

### 3. Use External Auth Provider

Integrate Auth0, Clerk, or similar and resell.

**Rejected because:**

- Lower margins
- Less control over features
- Dependency on external provider
- Already have working OIDC implementation

## References

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare for SaaS - Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [SimpleWebAuthn](https://simplewebauthn.dev/)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Polar Documentation](https://docs.polar.sh/)
- [Resend Documentation](https://resend.com/docs)
- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)
- [apps/auth AGENTS.md](/apps/auth/AGENTS.md)

## Current Progress

- [ ] Phase 1: DO Core
  - [ ] Create directory structure
  - [ ] Port oauth2.ts module
  - [ ] Port token entities
  - [ ] Implement DO class with migrations
  - [ ] Implement WebAuthn module
  - [ ] Implement login UI
  - [ ] Implement discovery endpoints
  - [ ] Implement token endpoint
  - [ ] Implement email verification
  - [ ] Test with hardcoded tenant
- [ ] Phase 2: Control Plane
  - [ ] D1 schema setup
  - [ ] Bootstrap endpoint
  - [ ] Dashboard auth
  - [ ] Tenant CRUD API
  - [ ] Slug generation
  - [ ] Basic dashboard UI
- [ ] Phase 3: Tenant Dashboard
  - [ ] Client management
  - [ ] User management
  - [ ] Resource management
  - [ ] Branding configuration
  - [ ] Stats view
- [ ] Phase 4: Custom Domains
  - [ ] CF for SaaS API client
  - [ ] Default subdomain creation
  - [ ] Hostname management UI
  - [ ] Custom metadata
  - [ ] Validation flow
- [ ] Phase 5: Billing and Polish
  - [ ] Polar integration
  - [ ] MAU tracking
  - [ ] MAU reporting
  - [ ] Cleanup jobs
  - [ ] Error handling
  - [ ] Documentation
- [ ] Phase 6: Future Enhancements
  - [ ] GitHub OAuth
  - [ ] Google OAuth
  - [ ] Password auth
  - [ ] CF Email Sending
  - [ ] Rate limiting
  - [ ] Audit logs
  - [ ] apps/auth migration

## Notes

- The platform tenant (ID: "platform") is used for dogfooding - tenant admins authenticate against it to access the dashboard
- Region selection happens only at tenant creation time because DO `locationHint` only works on first instantiation
- Client secrets use the `sdx_auth_` prefix for easy identification in logs and configs
- Multiple secrets per client enable zero-downtime secret rotation
- Multiple redirect/logout URIs per client support multiple environments (production, staging, development)
- Email verification is required for authentication; unverified accounts are deleted after 7 days
- MAU is counted on first authentication of the month, tracked in Analytics Engine and reported to Polar
- The DO alarm handles cleanup of expired data and unverified users
- Waiting for Remix v3 release before implementing the dashboard; DO implementation can proceed independently
