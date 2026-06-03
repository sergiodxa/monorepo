# Content Ideas from Codebase

This document contains potential articles and tutorials based on patterns and code found in this monorepo.

## ARTICLES (Explanations/Opinions)

### Building Multi-Tenant Applications with Cloudflare Durable Objects

Each tenant runs as a Durable Object with its own SQLite database (`SqlStorage`), providing strong data isolation. A generic example can be a project-management platform where each workspace maps to one Durable Object, with host-based routing via `cf.hostMetadata` and region-aware location hints.

**Mentions:** Durable Objects, `SqlStorage`, `blockConcurrencyWhile()`, tenant isolation patterns, `cf.hostMetadata` routing, location hints.

_Relevant Files_:

- `apps/auth-saas/src/entry.worker.ts`
- `apps/auth-saas/src/tenant/index.ts`

### Passwordless Authentication with WebAuthn/Passkeys

The auth-saas implements full WebAuthn support using `@simplewebauthn/server` with registration and authentication flows, platform authenticator preference, and implicit email verification when using passkeys.

**Mentions:** WebAuthn API, `@simplewebauthn/server`, passkey registration/authentication, platform vs roaming authenticators, implicit email verification pattern.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/webauthn/register-verify.ts`
- `apps/auth-saas/src/tenant/client/webauthn-auth.client.tsx`

### Per-Tenant Rate Limiting: Cloudflare API + In-Memory Strategies

Two-layer rate limiting: Cloudflare Rate Limiting API bindings for global protection, plus in-memory per-user rate limiting inside Durable Objects for granular control.

**Mentions:** Cloudflare `RATE_LIMITER` binding, in-memory rate limit map, per-user vs per-IP, defense in depth.

_Relevant Files_:

- `apps/auth-saas/wrangler.jsonc`
- `apps/auth-saas/src/lib/user-rate-limit.ts`

### Preventing Timing Attacks in Authentication Systems

The auth-saas uses constant-time comparison for secrets, timing-safe bcrypt comparison (even when no secrets exist to prevent user enumeration), and HMAC signatures for session tokens.

**Mentions:** Constant-time comparison, timing attacks, user enumeration prevention, dummy bcrypt comparison, `crypto.subtle.timingSafeEqual`.

_Relevant Files_:

- `apps/auth-saas/src/lib/crypto-utils.ts`
- `apps/auth-saas/src/tenant/models/client/secret.ts`

### CSS Sanitization for User-Generated Branding

When allowing tenants to customize their login page appearance, the app sanitizes CSS to prevent injection attacks while still allowing safe styling properties.

**Mentions:** CSS injection attacks, property allowlists, regex sanitization, user-generated content security.

_Relevant Files_:

- `apps/auth-saas/src/lib/css-sanitizer.ts`

### Value Objects for OAuth Tokens in TypeScript

Using classes like `AccessToken`, `IdToken`, and `ScopeSet` to encapsulate token validation, claims extraction, and scope operations rather than working with raw strings.

**Mentions:** Value Object pattern, token encapsulation, `ScopeSet` for scope operations, immutability, type safety.

_Relevant Files_:

- `apps/auth-saas/src/tenant/values/access-token.ts`
- `apps/auth-saas/src/tenant/values/id-token.ts`
- `apps/auth-saas/src/tenant/values/scope-set.ts`

### URI Scheme Validation for OAuth Redirect URIs

The app validates redirect URIs to block `javascript:`, `data:`, and `vbscript:` schemes, enforcing HTTPS in production while allowing localhost for development.

**Mentions:** Open redirect prevention, URI scheme validation, OAuth 2.0 security, `localhost` exception for development.

_Relevant Files_:

- `apps/auth-saas/src/lib/uri-validation.ts`

### Expression-Oriented Control Flow in TypeScript

JavaScript often forces a choice between expression contexts and statement-based control flow. A tiny `iife` helper can bridge that gap for JSX branching, inline value computation, and local `try`/`catch` handling, but it also introduces readability trade-offs that are worth exploring.

**Mentions:** IIFE helpers, expression-oriented code, JSX branching, `try`/`catch` as expressions, local scoping trade-offs.

_Relevant Files_:

- `packages/iife/src/index.ts`
- `packages/iife/README.md`

### Understanding Remix v3's Fetch Router Architecture

Remix v3 introduces a fetch-router based approach for building full-stack web applications. The framework provides a clean separation between route definitions, middleware configuration, and controller logic with built-in support for custom database adapters.

**Mentions:** Remix v3, fetch-router, route definitions, middleware configuration, controller pattern, database adapters.

_Relevant Files_:

- `apps/auth-saas/src/app/routes.ts`
- `apps/auth-saas/src/app/router.ts`

### Reusing Remix Route Contracts for Client-Side UI Routing

A client-side router can reuse `remix/routes` definitions and route-pattern matching to render Remix UI components, mirroring the server fetch-router shape while returning `RemixNode` instead of `Response`.

**Mentions:** Remix v3, `remix/routes`, route-pattern matching, client-side routing, Remix UI rendering, typed route params.

_Relevant Files_:

- `packages/r3-ui-router/src/index.ts`
- `packages/r3-ui-router/README.md`

### Modal Routes with URL Masking in Client-Side Routers

Instagram-style overlays can render an internal route that preserves the background UI while showing a different public URL in the address bar. The direct URL remains reload-safe because initial page loads ignore masked history state and render the standalone route.

**Mentions:** URL masking, modal routes, History API state, reload-safe direct routes, client-side routing, background preservation.

_Relevant Files_:

- `packages/r3-ui-router/src/index.ts`
- `apps/r3-gallery/src/main.tsx`

### React Router-Style Actions and Fetchers for Remix UI

Client-only Remix UI apps can reuse fetch-router route contracts for method-aware actions, middleware, request contexts, form mixins, and typed fetchers without introducing React hooks or components.

**Mentions:** Remix UI, fetch-router, route actions, form mixins, typed fetchers, client-side mutations, localStorage middleware.

_Relevant Files_:

- `packages/r3-ui-router/src/index.ts`
- `apps/r3-gallery/src/middleware/likes.ts`
- `apps/r3-gallery/src/components/photo-grid-item.tsx`

### Stateless Session Tokens with HMAC Signatures

Using HMAC-signed JWT payloads stored in cookies for session management without database lookups on every request, while maintaining security through signature verification.

**Mentions:** HMAC-SHA256, stateless sessions, cookie security, signature verification, no database round-trip.

_Relevant Files_:

- `apps/auth-saas/src/lib/internal-auth.ts`

### Single-Use Authorization Codes Per RFC 6749

Implementing proper OAuth 2.0 authorization code behavior where codes are consumed on first use and cannot be reused, with proper error handling for replay attempts.

**Mentions:** Authorization code single-use, RFC 6749 compliance, replay attack prevention, `AlreadyConsumedError`.

_Relevant Files_:

- `apps/auth-saas/src/tenant/models/authorization-code.ts`

## TUTORIALS (How-To Guides)

### How to Parse and Serialize RSS XML with DOMParser on workerd

Building a small XML tree abstraction on top of `DOMParser` and `XMLSerializer`, including declaration parsing, namespace-aware serialization, and the minimum XML features needed for RSS feeds.

**Mentions:** `DOMParser`, `XMLSerializer`, RSS 2.0 structure, namespace prefixes, CDATA handling, explicit error results.

_Relevant Files_:

- `packages/xml/src/index.ts`
- `packages/xml/src/index.test.ts`

### How to Build Custom SQLite Database Adapters for Remix

Creating adapters that compile a custom query AST to SQLite for both Cloudflare D1 (async) and Durable Object SqlStorage (sync), supporting transactions, savepoints, RETURNING clauses, and upserts.

**Mentions:** Remix data-table, query AST compilation, D1 adapter, SqlStorage adapter, transaction support, unified interface.

_Relevant Files_:

- `apps/auth-saas/src/lib/sql-storage-adapter.ts`
- `apps/auth-saas/src/lib/d1-adapter.ts`

### How to Implement WebAuthn Registration with @simplewebauthn/server

Step-by-step implementation of passkey registration including generating registration options, handling client-side WebAuthn API calls, and verifying attestation on the server.

**Mentions:** `generateRegistrationOptions`, `verifyRegistrationResponse`, attestation verification, credential storage, relying party configuration.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/webauthn/register-options.ts`
- `apps/auth-saas/src/tenant/controllers/webauthn/register-verify.ts`

### How to Implement WebAuthn Authentication with @simplewebauthn/server

Completing the passkey authentication flow from generating authentication options to verifying assertions and updating credential counters.

**Mentions:** `generateAuthenticationOptions`, `verifyAuthenticationResponse`, signature counter, credential lookup, allowCredentials.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/webauthn/auth-options.ts`
- `apps/auth-saas/src/tenant/controllers/webauthn/auth-verify.ts`

### How to Use Durable Object Alarms for Background Cleanup

Scheduling alarms at midnight UTC to clean up expired tokens, authorization codes, and other temporary data within each tenant's Durable Object.

**Mentions:** `state.storage.setAlarm()`, `alarm()` handler, cleanup scheduling, token expiration, single-flight execution.

_Relevant Files_:

- `apps/auth-saas/src/tenant/index.ts`

### How to Implement In-Memory Rate Limiting Within Durable Objects

Building per-user rate limits using a Map inside a Durable Object, with configurable limits per action type and automatic cleanup of expired entries.

**Mentions:** Per-user limits, action-specific thresholds, memory management, rate limit response headers, exponential backoff.

_Relevant Files_:

- `apps/auth-saas/src/lib/user-rate-limit.ts`

### How to Build Internal Service Authentication with HMAC-Signed JWTs

Creating secure communication between platform and tenant services using HMAC-signed JWTs with short expiration times for internal API calls.

**Mentions:** Internal auth tokens, HMAC signing, short-lived tokens, service-to-service authentication, Durable Object RPC.

_Relevant Files_:

- `apps/auth-saas/src/lib/internal-auth.ts`
- `apps/auth-saas/src/tenant/middleware/management-auth.ts`

### How to Implement OAuth 2.0 Token Introspection

Building the `/oauth/introspect` endpoint per RFC 7662 to allow resource servers to validate access tokens and retrieve metadata.

**Mentions:** RFC 7662, introspection request/response, token metadata, client authentication for introspection, active/inactive tokens.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/oauth/introspect.ts`

### How to Implement OIDC Discovery Endpoints

Creating `/.well-known/openid-configuration` and `/.well-known/jwks.json` endpoints for OpenID Connect discovery, enabling dynamic client configuration.

**Mentions:** OIDC Discovery, JWKS endpoint, metadata document, supported scopes/grants, issuer identification.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/well-known/openid-configuration.ts`
- `apps/auth-saas/src/tenant/controllers/well-known/jwks.ts`

### How to Implement OAuth 2.0 Client Credentials Grant

Building machine-to-machine authentication flow where clients exchange credentials directly for access tokens without user interaction.

**Mentions:** Client credentials flow, service accounts, scoped access, no refresh tokens, short-lived access tokens.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/oauth/token.ts`

### How to Build a Signing Key Rotation System with Caching

Managing multiple signing keys for JWT issuance with automatic rotation, caching to avoid repeated key imports, and proper `kid` header handling.

**Mentions:** Key rotation, `kid` header, key caching, async key import, multiple active keys, JWKS compatibility.

_Relevant Files_:

- `apps/auth-saas/src/tenant/models/signing-key.ts`

### How to Implement RP-Initiated Logout in OIDC

Building the `/oidc/logout` endpoint per OIDC RP-Initiated Logout spec, handling `id_token_hint`, `post_logout_redirect_uri`, and `state` parameters.

**Mentions:** RP-Initiated Logout, `id_token_hint` validation, post-logout redirect, session termination, logout confirmation.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/oidc/logout.ts`

### How to Build Island Architecture with Client Entries in Remix

Using Remix's `clientEntry` feature to create interactive islands of components that hydrate on the client while the rest of the page is server-rendered for performance and SEO benefits.

**Mentions:** Island architecture, `clientEntry`, progressive enhancement, hydration, server-rendered forms.

_Relevant Files_:

- `apps/auth-saas/src/tenant/client/webauthn-auth.client.tsx`

### How to Implement PKCE Code Challenge Verification

Server-side verification of PKCE code challenges using `S256` method, comparing the challenge stored during authorization with the verifier provided during token exchange.

**Mentions:** PKCE verification, `code_challenge_method`, SHA-256 hashing, base64url encoding, authorization code binding.

_Relevant Files_:

- `apps/auth-saas/src/tenant/controllers/oauth/token.ts`
- `apps/auth-saas/src/tenant/models/authorization-code.ts`

### How to Report Usage-Based Metrics with Polar and Analytics Engine

Implementing MAU tracking using Cloudflare Analytics Engine and reporting to Polar for usage-based billing via scheduled workers.

**Mentions:** Analytics Engine, MAU tracking, Polar SDK, usage-based billing, cron triggers, metric reporting.

_Relevant Files_:

- `apps/auth-saas/src/jobs/report-mau.ts`

### Refactoring Remix Apps to a Laravel-Inspired Folder Structure

A practical migration guide for moving a Remix + Cloudflare Worker app from `src/*`-centric layout into `app/`, `bootstrap/`, `routes/`, `resources/`, and `database/` while keeping type-safe route helpers and middleware wiring intact.

**Mentions:** incremental folder migration, route module splitting, Worker bootstrap separation, path alias compatibility, migration directory alignment.

_Relevant Files_:

- `apps/r3-blog/bootstrap/worker.ts`
- `apps/r3-blog/bootstrap/app.tsx`
- `apps/r3-blog/routes/web.ts`
- `apps/r3-blog/tsconfig.json`
