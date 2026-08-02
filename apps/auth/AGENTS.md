## About the Auth App

The Auth app (`apps/auth`) is a comprehensive OAuth 2.0 and OpenID Connect (OIDC) Authorization Server built with React Router v7 and running on Cloudflare Workers. It serves as the central authentication and authorization service for the entire monorepo ecosystem.

### Core Functionality

- **OAuth 2.0 Authorization Server** - Implements complete OAuth 2.0 flow with authorization code, client credentials, and refresh token grants
- **OpenID Connect Provider** - Provides identity layer on top of OAuth 2.0 with ID tokens and userinfo endpoint
- **Multi-Provider Authentication** - Supports GitHub, Google OAuth providers and credential-based authentication
- **Client Management** - Manages OAuth clients with redirect URIs, secrets, and permissions
- **Session Management** - Handles user sessions with refresh tokens and proper expiration
- **PKCE Support** - Implements Proof Key for Code Exchange for enhanced security

### Key Endpoints

- `/authorize` - OAuth authorization endpoint
- `/oauth/token` - Token exchange endpoint
- `/oauth/revoke` - Token revocation endpoint
- `/oauth/introspect` - Token introspection endpoint
- `/userinfo` - OIDC userinfo endpoint
- `/oidc/logout` - OIDC logout endpoint
- `/.well-known/oauth-authorization-server` - OAuth discovery endpoint
- `/.well-known/jwks.json` - JSON Web Key Set endpoint

## Security Guidelines

### OAuth 2.0 & OIDC Compliance

- MUST implement OAuth 2.0 RFC 6749 and OpenID Connect Core 1.0 specifications
- MUST use ES256 algorithm for JWT signing and verification
- MUST validate all OAuth parameters according to specifications
- MUST implement proper PKCE validation for authorization code flow
- MUST validate redirect URIs against registered client redirect URIs
- SHOULD implement rate limiting on token endpoints to prevent abuse

### Token Management

- MUST use cryptographically secure random values for all tokens and codes
- MUST set appropriate expiration times for access tokens (1 hour default)
- MUST set appropriate expiration times for refresh tokens (30 days default)
- MUST revoke all sessions when user logs out
- SHOULD implement token introspection for resource servers
- MUST store refresh tokens securely and associate them with sessions

### Client Authentication

- MUST validate client credentials using HTTP Basic authentication for confidential clients
- MUST validate client redirect URIs exactly (no pattern matching)
- MUST validate client logout URIs exactly
- SHOULD implement client registration endpoint for dynamic client registration
- MUST hash and store client secrets securely (never store plaintext)

### User Authentication

- MUST hash new passwords with PBKDF2-HMAC-SHA256 through `password.hash()`, never write a bcrypt hash again
- MUST keep verifying stored bcrypt hashes, and re-hash the plaintext on a successful sign-in — the hash cannot be converted without the password, so a login is the only chance to retire it
- MUST NOT remove the bcrypt dependency until no stored hash starts with `$2`, which depends on user logins rather than on a deploy
- MUST validate user credentials securely
- SHOULD implement account lockout after failed login attempts
- MUST verify email addresses before allowing authentication
- SHOULD implement multi-factor authentication for enhanced security

## Data Model Guidelines

### Database Schema

- MUST use UUIDs for all primary keys to prevent enumeration attacks
- MUST include proper indexes on frequently queried fields (expiresAt, subjectId, clientId)
- MUST use foreign key constraints to maintain referential integrity
- SHOULD use unique constraints where business logic requires uniqueness
- MUST include created_at and updated_at timestamps on all entities

### Entity Relationships

- MUST maintain proper relationships between subjects, sessions, clients, and credentials
- SHOULD use soft deletes for audit trails where applicable
- MUST cascade deletes appropriately (e.g., sessions when client is deleted)
- SHOULD implement proper cleanup of expired sessions and codes

## Service Architecture

### Service Layer Organization

- MUST organize OAuth/OIDC logic in dedicated service modules (`services/oidc.ts`)
- SHOULD separate authentication flows into specific service modules (`services/login/`)
- MUST implement proper error handling with OAuth-specific error responses
- SHOULD use dependency injection for database and external service access
- MUST validate all inputs using Zod schemas at service boundaries

### Provider Pattern

- MUST implement OAuth2Provider and OIDCProvider classes for core functionality
- SHOULD use repository pattern for data access abstraction
- MUST implement proper error classes extending OAuth2Error for standard error responses
- SHOULD use factory pattern for creating tokens and validation objects

## Route Guidelines

### OAuth Endpoints

- MUST implement proper HTTP method restrictions (GET for authorize, POST for token)
- MUST return appropriate HTTP status codes (400 for client errors, 500 for server errors)
- MUST implement proper CORS headers for cross-origin requests
- SHOULD implement proper cache headers (no-cache for sensitive endpoints)
- MUST log all authentication events for security auditing

### Error Handling

- MUST return OAuth-compliant error responses with error codes and descriptions
- SHOULD redirect authorization errors to client redirect URI with error parameters
- MUST not expose sensitive information in error messages
- SHOULD implement structured logging for debugging without exposing secrets

### Form Handling

- MUST validate all form inputs using Zod schemas
- MUST implement CSRF protection for state-changing operations
- SHOULD provide clear error messages for validation failures
- MUST sanitize all user inputs before database operations

## UI/UX Guidelines

### Authorization Page

- MUST clearly display client name and requested permissions
- SHOULD provide clear consent interface for user authorization
- MUST implement proper dark mode support
- SHOULD provide accessibility features (ARIA labels, keyboard navigation)
- MUST implement proper loading states during authentication

### Internationalization

- MUST support multiple languages using react-i18next
- SHOULD provide proper translations for all user-facing text
- MUST use translation keys consistently across the application
- SHOULD implement proper locale detection and switching

## Configuration Management

### Environment Variables

- MUST use environment variables for all sensitive configuration (JWT keys, client secrets)
- SHOULD use Cloudflare environment bindings for production secrets
- MUST implement proper configuration validation at startup
- SHOULD use different configurations for development, staging, and production environments

### Well-Known Configuration

- MUST expose OAuth and OIDC discovery documents at standard endpoints
- SHOULD implement proper cache headers for discovery documents
- MUST keep discovery documents updated with actual server capabilities
- SHOULD implement proper versioning for configuration changes

## Integration Guidelines

### External Providers

- MUST implement proper OAuth flow for external providers (GitHub, Google)
- SHOULD handle provider-specific error cases and rate limits
- MUST validate external provider responses before trusting user data
- SHOULD implement proper user account linking for multiple providers

### Client Applications

- SHOULD provide SDKs or client libraries for easy integration
- MUST document all API endpoints with examples
- SHOULD implement webhook endpoints for real-time notifications
- MUST provide proper API versioning for backward compatibility

## Monitoring and Observability

### Logging

- MUST log all authentication events with correlation IDs
- SHOULD implement structured logging for easy parsing and analysis
- MUST never log sensitive information (passwords, tokens, secrets)
- SHOULD implement proper log levels (error, warn, info, debug)

### Metrics

- SHOULD track authentication success/failure rates
- SHOULD monitor token issuance and validation rates
- SHOULD track OAuth flow completion rates
- MUST implement health check endpoints for monitoring systems

### Security Monitoring

- MUST implement alerts for suspicious authentication patterns
- SHOULD monitor for unusual token usage patterns
- MUST track failed authentication attempts and implement countermeasures
- SHOULD implement audit logs for all administrative actions
