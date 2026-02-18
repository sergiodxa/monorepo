# ADR-005: OAuth 2.0 and OpenID Connect Specification Compliance

## Status

Proposed

## Context

The auth server (`apps/auth`) advertises itself as an OAuth 2.0 Authorization Server and OpenID Connect Provider through its discovery document at `/.well-known/oauth-authorization-server`. However, a comprehensive review against the relevant specifications reveals several gaps between what is advertised and what is actually implemented.

### Specifications Reviewed

This section provides a comprehensive catalog of all OAuth 2.0 and OpenID Connect related specifications. Specifications are categorized by type and marked with their relevance to this auth server implementation.

#### OAuth 2.0 Core Specifications (IETF RFCs)

| Specification                                             | Description                             | Relevance |
| --------------------------------------------------------- | --------------------------------------- | --------- |
| [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) | OAuth 2.0 Authorization Framework       | Core      |
| [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) | Bearer Token Usage                      | Core      |
| [RFC 6755](https://datatracker.ietf.org/doc/html/rfc6755) | IETF URN Sub-Namespace for OAuth        | Reference |
| [RFC 6819](https://datatracker.ietf.org/doc/html/rfc6819) | OAuth 2.0 Threat Model & Security       | Reference |
| [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) | Proof Key for Code Exchange (PKCE)      | Core      |
| [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252) | OAuth 2.0 for Native Apps (BCP 212)     | Guidance  |
| [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) | OAuth 2.0 Authorization Server Metadata | Core      |

#### OAuth 2.0 Extension Specifications (IETF RFCs)

| Specification                                             | Description                                  | Relevance |
| --------------------------------------------------------- | -------------------------------------------- | --------- |
| [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009) | OAuth 2.0 Token Revocation                   | High      |
| [RFC 7521](https://datatracker.ietf.org/doc/html/rfc7521) | Assertion Framework for OAuth 2.0            | Medium    |
| [RFC 7522](https://datatracker.ietf.org/doc/html/rfc7522) | SAML 2.0 Profile for OAuth 2.0               | Low       |
| [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | JWT Profile for Client Auth and Grants       | Medium    |
| [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) | OAuth 2.0 Dynamic Client Registration        | Medium    |
| [RFC 7592](https://datatracker.ietf.org/doc/html/rfc7592) | OAuth 2.0 Dynamic Client Registration Mgmt   | Low       |
| [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662) | OAuth 2.0 Token Introspection                | High      |
| [RFC 7800](https://datatracker.ietf.org/doc/html/rfc7800) | Proof-of-Possession Key Semantics for JWTs   | Medium    |
| [RFC 8176](https://datatracker.ietf.org/doc/html/rfc8176) | Authentication Method Reference Values (amr) | Medium    |
| [RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628) | Device Authorization Grant                   | Medium    |
| [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | OAuth 2.0 Token Exchange                     | Low       |
| [RFC 8705](https://datatracker.ietf.org/doc/html/rfc8705) | Mutual-TLS Client Auth & Certificate-Bound   | Low       |
| [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) | Resource Indicators for OAuth 2.0            | Medium    |
| [RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068) | JWT Profile for Access Tokens                | High      |
| [RFC 9101](https://datatracker.ietf.org/doc/html/rfc9101) | JWT-Secured Authorization Request (JAR)      | Medium    |
| [RFC 9126](https://datatracker.ietf.org/doc/html/rfc9126) | Pushed Authorization Requests (PAR)          | High      |
| [RFC 9207](https://datatracker.ietf.org/doc/html/rfc9207) | Authorization Server Issuer Identification   | High      |
| [RFC 9278](https://datatracker.ietf.org/doc/html/rfc9278) | JWK Thumbprint URI                           | Low       |
| [RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396) | OAuth 2.0 Rich Authorization Requests (RAR)  | Medium    |
| [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) | Demonstrating Proof of Possession (DPoP)     | Medium    |
| [RFC 9470](https://datatracker.ietf.org/doc/html/rfc9470) | OAuth 2.0 Step Up Authentication Challenge   | Medium    |
| [RFC 9701](https://datatracker.ietf.org/doc/html/rfc9701) | JWT Response for OAuth Token Introspection   | Medium    |
| [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) | OAuth 2.0 Protected Resource Metadata        | Low       |

#### JWT Specifications (IETF RFCs)

| Specification                                             | Description                   | Relevance |
| --------------------------------------------------------- | ----------------------------- | --------- |
| [RFC 7515](https://datatracker.ietf.org/doc/html/rfc7515) | JSON Web Signature (JWS)      | Core      |
| [RFC 7516](https://datatracker.ietf.org/doc/html/rfc7516) | JSON Web Encryption (JWE)     | Low       |
| [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517) | JSON Web Key (JWK)            | Core      |
| [RFC 7518](https://datatracker.ietf.org/doc/html/rfc7518) | JSON Web Algorithms (JWA)     | Core      |
| [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) | JSON Web Token (JWT)          | Core      |
| [RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725) | JWT Best Current Practices    | Guidance  |
| [RFC 9901](https://datatracker.ietf.org/doc/html/rfc9901) | Selective Disclosure for JWTs | Low       |

#### Security Best Practices (IETF RFCs/BCPs)

| Specification                                             | Description                                        | Relevance |
| --------------------------------------------------------- | -------------------------------------------------- | --------- |
| [RFC 6819](https://datatracker.ietf.org/doc/html/rfc6819) | OAuth 2.0 Threat Model and Security Considerations | Reference |
| [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700) | OAuth 2.0 Security Best Current Practice (BCP 240) | Core      |

#### OAuth 2.0 IETF Drafts (In Progress)

| Specification                                                                                                      | Description                            | Status              |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------- |
| [draft-ietf-oauth-v2-1](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)                                   | OAuth 2.1 Authorization Framework      | WG Document         |
| [draft-ietf-oauth-browser-based-apps](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/)       | OAuth 2.0 for Browser-Based Apps (BCP) | RFC Editor Queue    |
| [draft-ietf-oauth-cross-device-security](https://datatracker.ietf.org/doc/draft-ietf-oauth-cross-device-security/) | Cross-Device Flows Security BCP        | IESG Evaluation     |
| [draft-ietf-oauth-identity-chaining](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-chaining/)         | Identity and Authorization Chaining    | Publication Request |
| [draft-ietf-oauth-status-list](https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/)                     | Token Status List                      | IESG Evaluation     |
| [draft-ietf-oauth-sd-jwt-vc](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)                         | SD-JWT-based Verifiable Credentials    | WG Last Call        |
| [draft-ietf-oauth-transaction-tokens](https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/)       | Transaction Tokens                     | WG Document         |
| [draft-ietf-oauth-first-party-apps](https://datatracker.ietf.org/doc/draft-ietf-oauth-first-party-apps/)           | OAuth 2.0 for First-Party Applications | WG Document         |

#### OpenID Connect Core Specifications

| Specification                                                                                           | Description                 | Relevance |
| ------------------------------------------------------------------------------------------------------- | --------------------------- | --------- |
| [OIDC Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)                                  | OpenID Connect Core         | Core      |
| [OIDC Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)                        | OpenID Connect Discovery    | Core      |
| [OIDC Dynamic Registration 1.0](https://openid.net/specs/openid-connect-registration-1_0.html)          | Dynamic Client Registration | Medium    |
| [OAuth 2.0 Multiple Response Types](https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html) | Multiple Response Types     | Medium    |
| [OAuth 2.0 Form Post Response Mode](https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html) | Form Post Response Mode     | Medium    |

#### OpenID Connect Session & Logout Specifications

| Specification                                                                                  | Description          | Relevance |
| ---------------------------------------------------------------------------------------------- | -------------------- | --------- |
| [OIDC RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)   | RP-Initiated Logout  | High      |
| [OIDC Front-Channel Logout 1.0](https://openid.net/specs/openid-connect-frontchannel-1_0.html) | Front-Channel Logout | Medium    |
| [OIDC Back-Channel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)   | Back-Channel Logout  | High      |
| [OIDC Session Management 1.0](https://openid.net/specs/openid-connect-session-1_0.html)        | Session Management   | Medium    |

#### OpenID Connect Extension Specifications

| Specification                                                                                                                | Description                             | Relevance |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------- |
| [OIDC Prompt Create](https://openid.net/specs/openid-connect-prompt-create-1_0.html)                                         | Initiating User Registration            | Low       |
| [OIDC Unmet Authentication Requirements](https://openid.net/specs/openid-connect-unmet-authentication-requirements-1_0.html) | unmet_authentication_requirements error | Medium    |
| [EAP ACR Values](https://openid.net/specs/openid-connect-eap-acr-values-1_0.html)                                            | Authentication Context Class References | Low       |
| [OpenID Connect Native SSO](https://openid.net/specs/openid-connect-native-sso-1_0.html)                                     | Native SSO for Mobile Apps              | Low       |
| [Self-Issued OP v2 (SIOP v2)](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html)                               | User-Controlled OpenID Providers        | Low       |
| [OpenID Federation 1.0](https://openid.net/specs/openid-federation-1_0.html)                                                 | Trust Establishment in Federations      | Low       |

#### OpenID Connect CIBA (Client-Initiated Backchannel Authentication)

| Specification                                                                                              | Description                   | Relevance |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------- | --------- |
| [CIBA Core 1.0](https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html) | Decoupled Authentication Flow | Medium    |

#### Financial-grade API (FAPI) Specifications

| Specification                                                                              | Description                             | Relevance |
| ------------------------------------------------------------------------------------------ | --------------------------------------- | --------- |
| [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-security-profile-2_0-final.html) | High-Security OAuth Profile             | Low       |
| [FAPI 2.0 Attacker Model](https://openid.net/specs/fapi-attacker-model-2_0-final.html)     | Security Threat Model                   | Reference |
| [FAPI 1.0 Part 1: Baseline](https://openid.net/specs/openid-financial-api-part-1-1_0.html) | Secured OAuth Baseline Profile          | Low       |
| [FAPI 1.0 Part 2: Advanced](https://openid.net/specs/openid-financial-api-part-2-1_0.html) | High-Security OAuth Profile             | Low       |
| [JARM](https://openid.net/specs/oauth-v2-jarm.html)                                        | JWT Secured Authorization Response Mode | Medium    |
| [Grant Management](https://openid.net/specs/fapi-grant-management.html)                    | OAuth 2.0 Grant Management              | Low       |

#### Identity Assurance Specifications

| Specification                                                                                                  | Description                       | Relevance |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------- |
| [OIDC for Identity Assurance 1.0](https://openid.net/specs/openid-connect-4-identity-assurance-1_0-final.html) | Verified Claims for KYC           | Low       |
| [Identity Assurance Schema](https://openid.net/specs/openid-ida-verified-claims-1_0-final.html)                | Verified Claims Schema Definition | Low       |
| [Identity Assurance Claims](https://openid.net/specs/openid-connect-4-ida-claims-1_0-final.html)               | Claims Registration for IDA       | Low       |

#### Shared Signals and Events Specifications

| Specification                                                                                          | Description                            | Relevance |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------- | --------- |
| [RFC 8417](https://datatracker.ietf.org/doc/html/rfc8417)                                              | Security Event Token (SET)             | Low       |
| [Shared Signals Framework 1.0](https://openid.net/specs/openid-sharedsignals-framework-1_0-final.html) | Event Sharing Framework                | Low       |
| [CAEP 1.0](https://openid.net/specs/openid-caep-1_0-final.html)                                        | Continuous Access Evaluation Profile   | Low       |
| [RISC 1.0](https://openid.net/specs/openid-risc-1_0-final.html)                                        | Risk Incident Sharing and Coordination | Low       |

#### Verifiable Credentials (Emerging Standards)

| Specification                                                                           | Description                    | Relevance |
| --------------------------------------------------------------------------------------- | ------------------------------ | --------- |
| [OpenID4VCI](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) | Verifiable Credential Issuance | Low       |
| [OpenID4VP](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)        | Verifiable Presentations       | Low       |

#### Relevance Key

- **Core**: Essential for basic OAuth 2.0/OIDC compliance - must implement
- **High**: Important for a complete auth server implementation - should implement
- **Medium**: Useful extensions that add significant value - consider implementing
- **Low**: Specialized use cases or emerging standards - implement if needed
- **Guidance**: Best practices documentation for clients/implementers
- **Reference**: Background/security information, not directly implemented

### Current State

The discovery document (`app/config.ts`) advertises the following capabilities:

```typescript
{
  revocation_endpoint: "/oauth/revoke",        // NOT IMPLEMENTED
  token_introspection_endpoint: "/oauth/introspect",  // NOT IMPLEMENTED
  userinfo_endpoint: "/userinfo",              // NOT IMPLEMENTED
  registration_endpoint: "/oidc/register",     // NOT IMPLEMENTED
  response_types_supported: ["code", "token"], // "token" NOT IMPLEMENTED
  scopes_supported: ["openid", "email"],       // NOT VALIDATED
}
```

This violates OIDC Discovery 1.0 which states that advertised endpoints MUST be functional.

### What Is Already Compliant

The following specifications are correctly implemented:

| Specification                     | Status       | Notes                                                      |
| --------------------------------- | ------------ | ---------------------------------------------------------- |
| RFC 6749 Authorization Code Grant | ✅ Compliant | Core flow works correctly                                  |
| RFC 6749 Client Credentials Grant | ✅ Compliant | Implemented in token endpoint                              |
| RFC 6749 Refresh Token Grant      | ✅ Compliant | Sessions used as refresh tokens                            |
| RFC 6750 Bearer Token Usage       | ✅ Compliant | JWTs issued as Bearer tokens                               |
| RFC 7636 PKCE                     | ✅ Compliant | Required for public clients                                |
| RFC 8414 AS Metadata              | ⚠️ Partial   | Endpoint exists but advertises non-existent features       |
| OIDC Core ID Token                | ✅ Compliant | ES256-signed JWTs with required claims                     |
| OIDC Core JWKS                    | ✅ Compliant | `/.well-known/jwks.json` endpoint                          |
| OIDC RP-Initiated Logout          | ⚠️ Partial   | `/oidc/logout` endpoint exists but missing some parameters |

## Decision

Complete the OAuth 2.0/OIDC implementation by addressing each specification systematically. This section documents the implementation status and requirements for every relevant specification.

---

## OAuth 2.0 Core Specifications

### RFC 6749 - OAuth 2.0 Authorization Framework

**Link:** https://datatracker.ietf.org/doc/html/rfc6749

**Description:** The foundational OAuth 2.0 specification defining the authorization framework, grant types, and core protocol flows.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Authorization Code Grant (`app/routes/authorize.tsx`, `app/routes/oauth.token.ts`)
- Client Credentials Grant (`app/routes/oauth.token.ts`)
- Refresh Token Grant (`app/routes/oauth.token.ts`)
- Error responses with `error` and `error_description`

**What's Missing:**

- Authorization code lifetime exceeds recommended 10 minutes (currently uses ACCESS_TOKEN_TTL of 1 hour)
- Scope validation against `scopes_supported`
- Implicit Grant advertised but not implemented (should be removed per RFC 9700)

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/config.ts`

**Required Changes:**

1. Change authorization code TTL from `ACCESS_TOKEN_TTL` to 10 minutes max in `app/entities/authz-code.ts`
2. Add scope validation in `app/routes/authorize.tsx`
3. Remove `"token"` from `response_types_supported` in `app/config.ts`

---

### RFC 6750 - Bearer Token Usage

**Link:** https://datatracker.ietf.org/doc/html/rfc6750

**Description:** Defines how to use Bearer tokens in HTTP requests and the `WWW-Authenticate` response header format for protected resources.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Bearer tokens issued as JWTs
- `Authorization: Bearer` header accepted

**What's Missing:**

- `WWW-Authenticate` header with proper error codes on 401/403 responses
- `Cache-Control: no-store` and `Pragma: no-cache` headers on token responses

**Relevant Files:**

- `app/routes/oauth.token.ts`
- `app/routes/userinfo.ts` (to be created)

**Required Changes:**

1. Add `Cache-Control: no-store` and `Pragma: no-cache` headers to token endpoint responses
2. Return proper `WWW-Authenticate: Bearer` headers on protected endpoints with `error`, `error_description`, and `scope` attributes

---

### RFC 6755 - IETF URN Sub-Namespace for OAuth

**Link:** https://datatracker.ietf.org/doc/html/rfc6755

**Description:** Defines the `urn:ietf:params:oauth:` URN namespace for OAuth-related identifiers (grant types, token types, etc.).

**Status:** ✅ Reference Only

**Notes:** This is a namespace registration spec. The URNs are used implicitly when referencing grant types like `urn:ietf:params:oauth:grant-type:device_code`.

**Required Changes:** None

---

### RFC 6819 - OAuth 2.0 Threat Model and Security Considerations

**Link:** https://datatracker.ietf.org/doc/html/rfc6819

**Description:** Comprehensive threat model and security considerations for OAuth 2.0 deployments. Superseded by RFC 9700 for best practices.

**Status:** ✅ Reference Only

**Notes:** Use RFC 9700 (Security BCP) as the primary security reference. RFC 6819 provides background threat analysis.

**Required Changes:** None (reference document)

---

### RFC 7636 - Proof Key for Code Exchange (PKCE)

**Link:** https://datatracker.ietf.org/doc/html/rfc7636

**Description:** Extension to prevent authorization code interception attacks by using a code verifier and challenge.

**Status:** ✅ Implemented

**What's Implemented:**

- `code_challenge` and `code_challenge_method` parameters accepted
- S256 and plain methods supported
- Code verifier validation in token endpoint

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/modules/oauth2.ts` (CodeChallenge class)

**Required Changes:** None

---

### RFC 8252 - OAuth 2.0 for Native Apps (BCP 212)

**Link:** https://datatracker.ietf.org/doc/html/rfc8252

**Description:** Best Current Practice for implementing OAuth in native applications, recommending custom URL schemes and claimed HTTPS URLs.

**Status:** ✅ Guidance Document

**Notes:** This is client-side guidance. The auth server should:

- Support custom URI schemes as redirect URIs
- Support `http://localhost` and `http://127.0.0.1` for development
- Require PKCE for public clients

**Relevant Files:**

- `app/routes/authorize.tsx` (redirect URI validation)

**Required Changes:** Ensure localhost/loopback redirect URIs are allowed for native app development.

---

### RFC 8414 - OAuth 2.0 Authorization Server Metadata

**Link:** https://datatracker.ietf.org/doc/html/rfc8414

**Description:** Defines the `/.well-known/oauth-authorization-server` endpoint for publishing AS capabilities.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Metadata endpoint exists at `/.well-known/oauth-authorization-server`
- Most required fields present

**What's Missing:**

- `grant_types_supported` field not advertised
- Advertises non-existent endpoints (revoke, introspect, userinfo, register)
- Advertises `"token"` response type which isn't implemented

**Relevant Files:**

- `app/config.ts`
- `app/routes/[.]well-known.oauth-authorization-server.ts`

**Required Changes:**

1. Add `grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"]`
2. Remove endpoints that aren't implemented OR implement them
3. Remove `"token"` from `response_types_supported`

---

## OAuth 2.0 Extension Specifications

### RFC 7009 - OAuth 2.0 Token Revocation

**Link:** https://datatracker.ietf.org/doc/html/rfc7009

**Description:** Defines an endpoint for clients to notify the AS that a token is no longer needed and should be invalidated.

**Status:** ❌ Not Implemented (but advertised)

**What's Needed:**

- POST `/oauth/revoke` endpoint
- Accept `token` and `token_type_hint` parameters
- Client authentication via `client_secret_basic`
- Return 200 OK even for invalid/unknown tokens (prevents probing)

**Relevant Files:**

- `app/routes/oauth.revoke.ts` (to be created)
- `app/modules/oauth2.ts` (`OAuth2Provider.revoke()` method exists but incomplete)
- `app/config.ts`

**Required Changes:**

1. Create `app/routes/oauth.revoke.ts` route handler
2. Complete `OAuth2Provider.revoke()` implementation
3. For refresh tokens: delete session from database
4. For access tokens (JWTs): cannot truly revoke, but return 200 OK

---

### RFC 7521 - Assertion Framework for OAuth 2.0

**Link:** https://datatracker.ietf.org/doc/html/rfc7521

**Description:** Abstract framework for using assertions (like SAML or JWT) as authorization grants or client authentication.

**Status:** ❌ Not Implemented

**Notes:** This is the base framework. RFC 7522 (SAML) and RFC 7523 (JWT) provide concrete profiles.

**Required Changes:** Implement RFC 7523 for JWT-based client authentication if needed.

---

### RFC 7522 - SAML 2.0 Profile for OAuth 2.0

**Link:** https://datatracker.ietf.org/doc/html/rfc7522

**Description:** Defines using SAML 2.0 assertions for OAuth client authentication and authorization grants.

**Status:** ❌ Not Implemented

**Notes:** Only implement if SAML federation is required. Low priority for most deployments.

**Required Changes:** None unless SAML support is needed.

---

### RFC 7523 - JWT Profile for OAuth 2.0 Client Authentication

**Link:** https://datatracker.ietf.org/doc/html/rfc7523

**Description:** Allows clients to authenticate using signed JWTs instead of client secrets (`private_key_jwt` method).

**Status:** ❌ Not Implemented

**What's Needed:**

- Support `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`
- Support `client_assertion` parameter containing signed JWT
- Validate JWT signature against client's registered public key
- Add `private_key_jwt` to `token_endpoint_auth_methods_supported`

**Relevant Files:**

- `app/routes/oauth.token.ts`
- `app/config.ts`
- `db/schema.ts` (store client public keys)

**Required Changes:**

1. Add `jwks_uri` or `jwks` field to clients table
2. Implement JWT assertion validation in token endpoint
3. Update discovery metadata

---

### RFC 7591 - OAuth 2.0 Dynamic Client Registration

**Link:** https://datatracker.ietf.org/doc/html/rfc7591

**Description:** Defines an endpoint for clients to register themselves programmatically without manual intervention.

**Status:** ❌ Not Implemented (but advertised)

**Notes:** Currently `registration_endpoint` is advertised in discovery but not implemented. Either implement or remove from discovery.

**Relevant Files:**

- `app/routes/oidc.register.ts` (to be created)
- `app/config.ts`

**Required Changes:**

1. Either implement `/oidc/register` endpoint OR
2. Remove `registration_endpoint` from discovery document

---

### RFC 7592 - OAuth 2.0 Dynamic Client Registration Management

**Link:** https://datatracker.ietf.org/doc/html/rfc7592

**Description:** Extends RFC 7591 with endpoints for reading, updating, and deleting dynamically registered clients.

**Status:** ❌ Not Implemented

**Notes:** Only relevant if RFC 7591 is implemented.

**Required Changes:** None unless dynamic registration is needed.

---

### RFC 7662 - OAuth 2.0 Token Introspection

**Link:** https://datatracker.ietf.org/doc/html/rfc7662

**Description:** Defines an endpoint for resource servers to query token metadata and validity.

**Status:** ❌ Not Implemented (but advertised)

**What's Needed:**

- POST `/oauth/introspect` endpoint
- Accept `token` and `token_type_hint` parameters
- Client authentication for the requesting resource server
- Return `{ active: true, sub, client_id, scope, exp, iat, iss, aud }` for valid tokens
- Return `{ active: false }` for invalid/expired tokens (never reveal why)

**Relevant Files:**

- `app/routes/oauth.introspect.ts` (to be created)
- `app/modules/oauth2.ts` (`OAuth2Provider.introspect()` throws "not implemented yet")
- `app/config.ts`

**Required Changes:**

1. Create `app/routes/oauth.introspect.ts` route handler
2. Implement `OAuth2Provider.introspect()` method
3. For JWT access tokens: decode and validate, return claims
4. For refresh tokens (session IDs): look up session in database

---

### RFC 7800 - Proof-of-Possession Key Semantics for JWTs

**Link:** https://datatracker.ietf.org/doc/html/rfc7800

**Description:** Defines the `cnf` (confirmation) claim for binding tokens to cryptographic keys.

**Status:** ❌ Not Implemented

**Notes:** Used by DPoP (RFC 9449) and mTLS (RFC 8705). Implement if proof-of-possession is needed.

**Required Changes:** None unless DPoP or mTLS is implemented.

---

### RFC 8176 - Authentication Method Reference Values

**Link:** https://datatracker.ietf.org/doc/html/rfc8176

**Description:** Defines standard values for the `amr` (Authentication Methods References) claim in ID tokens.

**Status:** ❌ Not Implemented

**What's Needed:**

- Include `amr` claim in ID tokens indicating how the user authenticated
- Values like `pwd` (password), `otp`, `mfa`, `hwk` (hardware key), etc.

**Relevant Files:**

- `app/entities/id-token.ts`

**Required Changes:**

1. Track authentication method during login
2. Include `amr` claim in ID tokens with appropriate values

---

### RFC 8628 - Device Authorization Grant

**Link:** https://datatracker.ietf.org/doc/html/rfc8628

**Description:** Enables authorization on devices with limited input capabilities (TVs, CLIs, IoT) using a user code.

**Status:** ❌ Not Implemented

**What's Needed:**

- POST `/oauth/device` endpoint returning `device_code`, `user_code`, `verification_uri`
- User verification page at `verification_uri`
- Token endpoint support for `grant_type=urn:ietf:params:oauth:grant-type:device_code`
- Polling with `authorization_pending`, `slow_down`, `expired_token` errors

**Relevant Files:**

- `app/routes/oauth.device.ts` (to be created)
- `app/routes/device.tsx` (to be created)
- `app/routes/oauth.token.ts`
- `app/config.ts`

**Required Changes:**

1. Create device authorization endpoint
2. Create user verification page
3. Add device code grant type to token endpoint
4. Store device codes in KV with expiration
5. Add `device_authorization_endpoint` to discovery

---

### RFC 8693 - OAuth 2.0 Token Exchange

**Link:** https://datatracker.ietf.org/doc/html/rfc8693

**Description:** Enables exchanging one token for another, useful for delegation and impersonation scenarios.

**Status:** ❌ Not Implemented

**Notes:** Complex feature, implement only if token exchange/delegation is needed.

**Required Changes:** None unless token exchange is required.

---

### RFC 8705 - Mutual-TLS Client Authentication and Certificate-Bound Access Tokens

**Link:** https://datatracker.ietf.org/doc/html/rfc8705

**Description:** Client authentication using TLS client certificates and binding access tokens to certificates.

**Status:** ❌ Not Implemented

**Notes:** Requires TLS termination that exposes client certificates. Complex to implement on Cloudflare Workers.

**Required Changes:** None (infrastructure limitation).

---

### RFC 8707 - Resource Indicators for OAuth 2.0

**Link:** https://datatracker.ietf.org/doc/html/rfc8707

**Description:** Allows clients to specify the intended resource server(s) for the requested token using the `resource` parameter.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- `resource` parameter accepted in client credentials grant

**What's Missing:**

- `resource` parameter support in authorization request
- `resource` parameter support in token request for other grant types
- Audience restriction based on resource parameter

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/access-token.ts`

**Required Changes:**

1. Accept `resource` parameter in authorization requests
2. Store resource with authorization code
3. Set access token `aud` claim based on resource parameter

---

### RFC 9068 - JWT Profile for OAuth 2.0 Access Tokens

**Link:** https://datatracker.ietf.org/doc/html/rfc9068

**Description:** Standardizes JWT access token format with required claims and header parameters.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Access tokens are JWTs with `iss`, `sub`, `aud`, `exp`, `iat` claims
- ES256 signing

**What's Missing:**

- `client_id` claim (REQUIRED)
- `jti` claim (REQUIRED for replay protection)
- `typ: "at+jwt"` header parameter (REQUIRED)

**Relevant Files:**

- `app/entities/access-token.ts`

**Required Changes:**

1. Add `client_id` claim to access tokens
2. Add `jti` claim with unique identifier
3. Set `typ: "at+jwt"` in JWT header

---

### RFC 9101 - JWT-Secured Authorization Request (JAR)

**Link:** https://datatracker.ietf.org/doc/html/rfc9101

**Description:** Allows authorization request parameters to be sent as a signed/encrypted JWT for integrity and confidentiality.

**Status:** ❌ Not Implemented

**Notes:** Discovery already indicates `request_parameter_supported: false` and `request_uri_parameter_supported: false`.

**Required Changes:** None unless JAR support is needed.

---

### RFC 9126 - Pushed Authorization Requests (PAR)

**Link:** https://datatracker.ietf.org/doc/html/rfc9126

**Description:** Clients push authorization parameters to AS before redirect, receiving a `request_uri` to use in the authorization request.

**Status:** ❌ Not Implemented

**What's Needed:**

- POST `/oauth/par` endpoint
- Accept all authorization request parameters
- Return `{ request_uri: "urn:ietf:params:oauth:request_uri:...", expires_in: 60 }`
- Accept `request_uri` parameter in authorization endpoint
- Store PAR data in KV with expiration

**Relevant Files:**

- `app/routes/oauth.par.ts` (to be created)
- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Create PAR endpoint
2. Modify authorization endpoint to accept `request_uri`
3. Add `pushed_authorization_request_endpoint` to discovery

---

### RFC 9207 - Authorization Server Issuer Identification

**Link:** https://datatracker.ietf.org/doc/html/rfc9207

**Description:** Includes `iss` parameter in authorization responses to prevent mix-up attacks.

**Status:** ❌ Not Implemented

**What's Needed:**

- Include `iss` parameter in authorization response redirects
- Add `authorization_response_iss_parameter_supported: true` to discovery

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Add `iss` parameter to authorization response: `redirect_uri?code=...&state=...&iss=...`
2. Update discovery metadata

---

### RFC 9278 - JWK Thumbprint URI

**Link:** https://datatracker.ietf.org/doc/html/rfc9278

**Description:** Defines `urn:ietf:params:oauth:jwk-thumbprint:` URI for referencing keys by their thumbprint.

**Status:** ✅ Reference Only

**Notes:** Used when referencing keys in DPoP or other contexts. No direct implementation needed.

**Required Changes:** None

---

### RFC 9396 - OAuth 2.0 Rich Authorization Requests (RAR)

**Link:** https://datatracker.ietf.org/doc/html/rfc9396

**Description:** Enables fine-grained authorization using structured `authorization_details` parameter instead of simple scopes.

**Status:** ❌ Not Implemented

**Notes:** Useful for complex authorization scenarios (banking, healthcare). Implement if needed.

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`

**Required Changes:** None unless fine-grained authorization is needed.

---

### RFC 9449 - Demonstrating Proof of Possession (DPoP)

**Link:** https://datatracker.ietf.org/doc/html/rfc9449

**Description:** Binds access tokens to a client's key pair, preventing token theft and replay.

**Status:** ❌ Not Implemented

**Notes:** High-security feature. Implement if proof-of-possession is required.

**Required Changes:** None unless DPoP is needed.

---

### RFC 9470 - Step Up Authentication Challenge Protocol

**Link:** https://datatracker.ietf.org/doc/html/rfc9470

**Description:** Allows resource servers to challenge for stronger authentication using `insufficient_user_authentication` error.

**Status:** ❌ Not Implemented

**What's Needed:**

- Support `acr_values` and `max_age` in authorization requests
- Include `acr` and `auth_time` claims in access tokens and introspection
- Resource servers can return `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="...", max_age="..."`

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/entities/access-token.ts`
- `app/routes/oauth.introspect.ts`

**Required Changes:**

1. Accept and process `acr_values` and `max_age` parameters
2. Track `auth_time` in sessions
3. Include `acr` and `auth_time` in tokens

---

### RFC 9701 - JWT Response for OAuth Token Introspection

**Link:** https://datatracker.ietf.org/doc/html/rfc9701

**Description:** Allows introspection responses to be returned as signed/encrypted JWTs instead of plain JSON.

**Status:** ❌ Not Implemented

**Notes:** Implement after basic introspection (RFC 7662) is working.

**Required Changes:** None until basic introspection is implemented.

---

### RFC 9728 - OAuth 2.0 Protected Resource Metadata

**Link:** https://datatracker.ietf.org/doc/html/rfc9728

**Description:** Defines `/.well-known/oauth-protected-resource` for resource servers to publish their metadata.

**Status:** ❌ Not Applicable

**Notes:** This is for resource servers, not authorization servers.

**Required Changes:** None

---

## JWT Specifications

### RFC 7515 - JSON Web Signature (JWS)

**Link:** https://datatracker.ietf.org/doc/html/rfc7515

**Description:** Defines the structure and processing of signed JWTs.

**Status:** ✅ Implemented

**Notes:** Used via `@edgefirst-dev/jwt` library for signing ID tokens and access tokens.

**Required Changes:** None

---

### RFC 7516 - JSON Web Encryption (JWE)

**Link:** https://datatracker.ietf.org/doc/html/rfc7516

**Description:** Defines the structure and processing of encrypted JWTs.

**Status:** ❌ Not Implemented

**Notes:** Only needed if token encryption is required. Currently not used.

**Required Changes:** None unless encryption is needed.

---

### RFC 7517 - JSON Web Key (JWK)

**Link:** https://datatracker.ietf.org/doc/html/rfc7517

**Description:** Defines the JSON format for representing cryptographic keys.

**Status:** ✅ Implemented

**What's Implemented:**

- JWKS endpoint at `/.well-known/jwks.json`
- ES256 key pair publication

**Relevant Files:**

- `app/routes/[.]well-known.jwks[.]json.ts`
- `app/modules/jwks.ts`

**Required Changes:** None

---

### RFC 7518 - JSON Web Algorithms (JWA)

**Link:** https://datatracker.ietf.org/doc/html/rfc7518

**Description:** Defines cryptographic algorithms for JWS, JWE, and JWK.

**Status:** ✅ Implemented

**Notes:** ES256 algorithm used for signing. Algorithm support provided by `@edgefirst-dev/jwt`.

**Required Changes:** None

---

### RFC 7519 - JSON Web Token (JWT)

**Link:** https://datatracker.ietf.org/doc/html/rfc7519

**Description:** Defines the JWT format and standard claims.

**Status:** ✅ Implemented

**Notes:** ID tokens and access tokens are JWTs with standard claims.

**Required Changes:** None

---

### RFC 8725 - JWT Best Current Practices

**Link:** https://datatracker.ietf.org/doc/html/rfc8725

**Description:** Security recommendations for JWT implementations.

**Status:** ⚠️ Guidance Document

**Key Recommendations:**

- Always validate `alg` header against expected algorithms ✅
- Validate `iss` and `aud` claims ✅
- Use short expiration times ✅
- Don't use `none` algorithm ✅

**Required Changes:** Ensure all JWT validation follows BCP recommendations.

---

### RFC 9901 - Selective Disclosure for JWTs (SD-JWT)

**Link:** https://datatracker.ietf.org/doc/html/rfc9901

**Description:** Allows selective disclosure of JWT claims for privacy-preserving credential presentation.

**Status:** ❌ Not Implemented

**Notes:** Emerging standard for verifiable credentials. Implement if needed.

**Required Changes:** None unless SD-JWT support is needed.

---

## Security Best Practices

### RFC 9700 - OAuth 2.0 Security Best Current Practice (BCP 240)

**Link:** https://datatracker.ietf.org/doc/html/rfc9700

**Description:** Comprehensive security recommendations for OAuth 2.0 implementations, superseding RFC 6819.

**Status:** ⚠️ Partially Compliant

**Key Requirements & Status:**

| Requirement                       | Status | Notes                                                  |
| --------------------------------- | ------ | ------------------------------------------------------ |
| PKCE required for public clients  | ✅     | Implemented                                            |
| Implicit grant deprecated         | ⚠️     | Advertised but not implemented - remove from discovery |
| Exact redirect URI matching       | ✅     | Implemented                                            |
| Authorization code one-time use   | ✅     | Code deleted after exchange                            |
| Short authorization code lifetime | ❌     | Currently 1 hour, should be 10 min max                 |
| Refresh token rotation            | ❌     | Not implemented                                        |
| Rate limiting                     | ❌     | Not implemented                                        |
| Client secret hashing             | ❌     | Stored as plain UUID                                   |

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/modules/oauth2.ts`
- `db/schema.ts`

**Required Changes:**

1. Reduce authorization code TTL to 10 minutes
2. Implement refresh token rotation
3. Add rate limiting middleware
4. Hash client secrets with bcrypt

---

## OpenID Connect Core Specifications

### OIDC Core 1.0

**Link:** https://openid.net/specs/openid-connect-core-1_0.html

**Description:** Core OpenID Connect specification defining authentication on top of OAuth 2.0.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- ID Token issuance with required claims (`iss`, `sub`, `aud`, `exp`, `iat`)
- Authorization code flow with OIDC
- `openid` scope handling

**What's Missing:**

- UserInfo endpoint (advertised but not implemented)
- `nonce` parameter support
- `auth_time` claim
- `acr` claim
- Standard scopes (`profile`, `email`, `address`, `phone`) claim mapping

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/routes/userinfo.ts` (to be created)
- `app/entities/id-token.ts`
- `app/modules/oauth2.ts`

**Required Changes:**

1. Create `/userinfo` endpoint
2. Add `nonce` support (accept in authz request, include in ID token)
3. Track and include `auth_time` in ID tokens
4. Implement scope-based claim filtering

---

### OIDC Discovery 1.0

**Link:** https://openid.net/specs/openid-connect-discovery-1_0.html

**Description:** Defines `/.well-known/openid-configuration` for OIDC Provider metadata discovery.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- OAuth AS metadata at `/.well-known/oauth-authorization-server`

**What's Missing:**

- OIDC-specific endpoint at `/.well-known/openid-configuration`

**Relevant Files:**

- `app/routes/[.]well-known.openid-configuration.ts` (to be created)
- `app/config.ts`

**Required Changes:**

1. Create `/.well-known/openid-configuration` endpoint (can return same content as OAuth AS metadata)

---

### OIDC Dynamic Registration 1.0

**Link:** https://openid.net/specs/openid-connect-registration-1_0.html

**Description:** Extends RFC 7591 with OIDC-specific client metadata.

**Status:** ❌ Not Implemented (but advertised)

**Notes:** `registration_endpoint` is advertised. Either implement or remove.

**Required Changes:** See RFC 7591 section.

---

### OAuth 2.0 Multiple Response Types

**Link:** https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html

**Description:** Defines additional response types like `code token`, `code id_token`, `id_token token`, etc.

**Status:** ❌ Not Implemented

**Notes:** Only `code` response type is implemented. Hybrid flows (`code id_token`, etc.) not supported.

**Required Changes:** None unless hybrid flows are needed.

---

### OAuth 2.0 Form Post Response Mode

**Link:** https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html

**Description:** Returns authorization response via HTTP POST using auto-submitting form.

**Status:** ❌ Not Implemented

**What's Needed:**

- Accept `response_mode=form_post` parameter
- Return HTML page with auto-submitting form instead of redirect
- Add `form_post` to `response_modes_supported`

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Implement form post response mode in authorization endpoint
2. Update discovery metadata

---

## OpenID Connect Session & Logout Specifications

### OIDC RP-Initiated Logout 1.0

**Link:** https://openid.net/specs/openid-connect-rpinitiated-1_0.html

**Description:** Allows Relying Parties to request End-User logout from the OpenID Provider.

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- `/oidc/logout` endpoint
- `id_token_hint` parameter
- `post_logout_redirect_uri` parameter
- `state` parameter

**What's Missing:**

- `logout_hint` parameter
- `client_id` parameter (for when `id_token_hint` not provided)
- `ui_locales` parameter

**Relevant Files:**

- `app/routes/oidc.logout.tsx`

**Required Changes:**

1. Accept `logout_hint`, `client_id`, and `ui_locales` parameters
2. Validate `client_id` matches `id_token_hint` audience when both provided

---

### OIDC Front-Channel Logout 1.0

**Link:** https://openid.net/specs/openid-connect-frontchannel-1_0.html

**Description:** Logout mechanism using browser redirects and iframes.

**Status:** ❌ Not Implemented

**What's Needed:**

- Store `frontchannel_logout_uri` per client
- On logout, render hidden iframes to each RP's logout URI
- Include `iss` and `sid` parameters
- Add `frontchannel_logout_supported` to discovery

**Relevant Files:**

- `db/schema.ts`
- `app/routes/oidc.logout.tsx`
- `app/config.ts`

**Required Changes:**

1. Add `frontchannel_logout_uri` column to clients table
2. Modify logout page to include logout iframes
3. Update discovery metadata

---

### OIDC Back-Channel Logout 1.0

**Link:** https://openid.net/specs/openid-connect-backchannel-1_0.html

**Description:** Server-to-server logout notification using Logout Tokens.

**Status:** ❌ Not Implemented

**What's Needed:**

- Store `backchannel_logout_uri` per client
- Generate Logout Tokens (JWTs with special `events` claim)
- POST logout tokens to each RP on user logout
- Add `backchannel_logout_supported` to discovery

**Relevant Files:**

- `db/schema.ts`
- `app/entities/logout-token.ts` (to be created)
- `app/routes/oidc.logout.tsx`
- `app/config.ts`

**Required Changes:**

1. Add `backchannel_logout_uri` column to clients table
2. Create `LogoutToken` entity for generating logout JWTs
3. Send logout tokens to RPs during logout
4. Update discovery metadata

---

### OIDC Session Management 1.0

**Link:** https://openid.net/specs/openid-connect-session-1_0.html

**Description:** Allows RPs to monitor login status via postMessage with check_session_iframe.

**Status:** ❌ Not Implemented

**What's Needed:**

- `/oidc/check-session` endpoint returning HTML/JS page
- `session_state` parameter in authorization response
- Browser state tracking via cookies

**Relevant Files:**

- `app/routes/oidc.check-session.ts` (to be created)
- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Create check session iframe endpoint
2. Add `session_state` to authorization responses
3. Add `check_session_iframe` to discovery

---

## OpenID Connect Extension Specifications

### OIDC Prompt Create 1.0

**Link:** https://openid.net/specs/openid-connect-prompt-create-1_0.html

**Description:** Allows RPs to request user registration via `prompt=create`.

**Status:** ❌ Not Implemented

**What's Needed:**

- Accept `prompt=create` in authorization requests
- Redirect to registration page when `prompt=create`
- Add `create` to `prompt_values_supported`

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Handle `prompt=create` by redirecting to registration
2. Update discovery metadata

---

### OIDC Unmet Authentication Requirements

**Link:** https://openid.net/specs/openid-connect-unmet-authentication-requirements-1_0.html

**Description:** Defines `unmet_authentication_requirements` error for when requested `acr` cannot be met.

**Status:** ❌ Not Implemented

**Notes:** Implement alongside Step Up Authentication (RFC 9470).

**Required Changes:** Return `unmet_authentication_requirements` error when requested `acr_values` cannot be satisfied.

---

### EAP ACR Values

**Link:** https://openid.net/specs/openid-connect-eap-acr-values-1_0.html

**Description:** Defines standard Authentication Context Class Reference values.

**Status:** ❌ Not Implemented

**Notes:** Reference for `acr` claim values when implementing step-up authentication.

**Required Changes:** None directly, use as reference.

---

### OpenID Connect Native SSO

**Link:** https://openid.net/specs/openid-connect-native-sso-1_0.html

**Description:** Enables SSO between native apps from the same vendor.

**Status:** ❌ Not Implemented

**Notes:** Specialized use case. Implement if native app SSO is needed.

**Required Changes:** None unless native SSO is needed.

---

### Self-Issued OP v2 (SIOP v2)

**Link:** https://openid.net/specs/openid-connect-self-issued-v2-1_0.html

**Description:** User-controlled OpenID Providers (wallet-based authentication).

**Status:** ❌ Not Implemented

**Notes:** Emerging standard for decentralized identity. Not applicable to centralized auth server.

**Required Changes:** None

---

### OpenID Federation 1.0

**Link:** https://openid.net/specs/openid-federation-1_0.html

**Description:** Trust establishment mechanism for federations of identity providers.

**Status:** ❌ Not Implemented

**Notes:** Only needed for multi-organization federation scenarios.

**Required Changes:** None unless federation is needed.

---

## OpenID Connect CIBA

### CIBA Core 1.0

**Link:** https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html

**Description:** Decoupled authentication where the authentication device is separate from the consumption device.

**Status:** ❌ Not Implemented

**Notes:** Useful for scenarios like TV login, call center authentication. Complex to implement.

**Required Changes:** None unless decoupled authentication is needed.

---

## Financial-grade API (FAPI) Specifications

### FAPI 2.0 Security Profile

**Link:** https://openid.net/specs/fapi-security-profile-2_0-final.html

**Description:** High-security OAuth profile for financial and other sensitive APIs.

**Status:** ❌ Not Implemented

**Notes:** Requires PAR, signed requests, and other security measures. Implement if targeting financial sector.

**Required Changes:** None unless FAPI compliance is needed.

---

### FAPI 2.0 Attacker Model

**Link:** https://openid.net/specs/fapi-attacker-model-2_0-final.html

**Description:** Threat model informing FAPI security requirements.

**Status:** ✅ Reference Only

**Required Changes:** None (reference document)

---

### JARM - JWT Secured Authorization Response Mode

**Link:** https://openid.net/specs/oauth-v2-jarm.html

**Description:** Returns authorization response as a signed/encrypted JWT.

**Status:** ❌ Not Implemented

**Notes:** Security feature from FAPI. Implement if high-security responses needed.

**Required Changes:** None unless JARM is needed.

---

### Grant Management for OAuth 2.0

**Link:** https://openid.net/specs/fapi-grant-management.html

**Description:** APIs for managing user consent/grants programmatically.

**Status:** ❌ Not Implemented

**Notes:** Useful for consent management UIs. Consider implementing for user control.

**Required Changes:** None unless grant management is needed.

---

## Identity Assurance Specifications

### OIDC for Identity Assurance 1.0

**Link:** https://openid.net/specs/openid-connect-4-identity-assurance-1_0-final.html

**Description:** Extends OIDC with verified claims for KYC/identity proofing.

**Status:** ❌ Not Implemented

**Notes:** Specialized for identity verification scenarios.

**Required Changes:** None unless identity assurance is needed.

---

## Shared Signals and Events

### RFC 8417 - Security Event Token (SET)

**Link:** https://datatracker.ietf.org/doc/html/rfc8417

**Description:** JWT format for security events like logout, account changes.

**Status:** ❌ Not Implemented

**Notes:** Foundation for RISC and CAEP. Logout Tokens (OIDC Back-Channel Logout) are a form of SET.

**Required Changes:** Implement as part of back-channel logout.

---

### Shared Signals Framework 1.0

**Link:** https://openid.net/specs/openid-sharedsignals-framework-1_0-final.html

**Description:** Framework for sharing security signals between services.

**Status:** ❌ Not Implemented

**Notes:** For advanced security event sharing. Low priority.

**Required Changes:** None unless signal sharing is needed.

---

### CAEP 1.0 - Continuous Access Evaluation Profile

**Link:** https://openid.net/specs/openid-caep-1_0-final.html

**Description:** Real-time access evaluation and revocation signals.

**Status:** ❌ Not Implemented

**Notes:** Enterprise feature for continuous security evaluation.

**Required Changes:** None unless CAEP is needed.

---

### RISC 1.0 - Risk Incident Sharing and Coordination

**Link:** https://openid.net/specs/openid-risc-1_0-final.html

**Description:** Sharing risk and security incidents between identity providers.

**Status:** ❌ Not Implemented

**Notes:** For security incident coordination between providers.

**Required Changes:** None unless RISC is needed.

---

## Verifiable Credentials (Emerging)

### OpenID4VCI - Verifiable Credential Issuance

**Link:** https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html

**Description:** Protocol for issuing verifiable credentials via OAuth.

**Status:** ❌ Not Implemented

**Notes:** Emerging standard for digital credentials.

**Required Changes:** None unless VC issuance is needed.

---

### OpenID4VP - Verifiable Presentations

**Link:** https://openid.net/specs/openid-4-verifiable-presentations-1_0.html

**Description:** Protocol for presenting verifiable credentials.

**Status:** ❌ Not Implemented

**Notes:** Emerging standard for credential presentation.

**Required Changes:** None unless VP support is needed.

---

## IETF Drafts (In Progress)

### draft-ietf-oauth-v2-1 - OAuth 2.1

**Link:** https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/

**Description:** Consolidation of OAuth 2.0 core + security BCPs into single spec.

**Status:** 📋 Future Consideration

**Notes:** When finalized, will be the new baseline. Currently incorporates:

- RFC 6749 (core)
- RFC 7636 (PKCE)
- RFC 9700 (security BCP)
- Deprecates implicit and password grants

**Required Changes:** Track progress; no immediate action needed.

---

### draft-ietf-oauth-browser-based-apps - OAuth for SPAs

**Link:** https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/

**Description:** Best practices for browser-based (SPA) OAuth applications.

**Status:** 📋 Guidance for Clients

**Notes:** Client-side guidance. Auth server should support recommended patterns (PKCE, token handler, etc.).

**Required Changes:** None (guidance document for clients).

---

### draft-ietf-oauth-cross-device-security

**Link:** https://datatracker.ietf.org/doc/draft-ietf-oauth-cross-device-security/

**Description:** Security considerations for cross-device OAuth flows.

**Status:** 📋 Security Guidance

**Notes:** Relevant to Device Authorization Grant security.

**Required Changes:** Review when implementing device flow.

### Phase 3: Security Improvements

#### 3.1 Authorization Code Lifetime

**Spec Reference:** [RFC 6749 Section 4.1.2](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2)

**Files to modify:**

- `app/config.ts`
- `app/entities/authz-code.ts`

**Change:**

```typescript
// Current: Uses ACCESS_TOKEN_TTL (1 hour)
// Required: "maximum authorization code lifetime of 10 minutes is RECOMMENDED"
export const AUTHZ_CODE_TTL = ms("10 minutes");
```

#### 3.2 Client Secrets and Redirect URIs Refactoring

**Spec Reference:** [RFC 6749 Section 10.1](https://datatracker.ietf.org/doc/html/rfc6749#section-10.1), [RFC 9700 Section 2.5](https://datatracker.ietf.org/doc/html/rfc9700#section-2.5)

**Files to modify:**

- `db/schema.ts` (new tables)
- `app/models/client.ts`
- `app/models/client-secret.ts` (new)
- `app/models/client-redirect-uri.ts` (new)
- `app/routes/oauth.token.ts`

**Database Schema Changes:**

Create two new tables to support multiple secrets and redirect URIs per client (similar to GitHub's approach):

```typescript
// db/schema.ts

// New table: client_secrets
export const clientSecrets = sqliteTable("client_secrets", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	secretHash: text("secret_hash").notNull(), // bcrypt hash
	name: text("name"), // Optional label (e.g., "Production", "Local Dev")
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(), // Updated on each use
});

// New table: client_redirect_uris
export const clientRedirectUris = sqliteTable("client_redirect_uris", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	uri: text("uri").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Remove from clients table:
// - secret (moved to client_secrets)
// - redirectUri (moved to client_redirect_uris)
```

**Implementation Requirements:**

1. **Multiple Secrets per Client:**
   - Allow clients to have multiple active secrets (useful for local/staging/production environments)
   - Hash secrets with bcrypt before storing
   - Compare using constant-time comparison
   - Track last usage by updating `updated_at` when a secret is used for authentication
   - Admin UI to create, list, and revoke secrets
   - Show secret value only once on creation (cannot be retrieved later)

2. **Multiple Redirect URIs per Client:**
   - Allow clients to register multiple redirect URIs
   - Validate `redirect_uri` parameter against all registered URIs for the client
   - Admin UI to manage redirect URIs

3. **Secret Usage Tracking:**
   - On successful client authentication, update `updated_at` on the matched secret
   - Enables identifying unused secrets for revocation
   - Useful for security audits

**Example Usage Tracking:**

```typescript
// In token endpoint after successful client authentication
async function authenticateClient(clientId: string, clientSecret: string) {
	const secrets = await db.query.clientSecrets.findMany({
		where: eq(clientSecrets.clientId, clientId),
	});

	for (const secret of secrets) {
		if (await bcrypt.compare(clientSecret, secret.secretHash)) {
			// Update last used timestamp
			await db
				.update(clientSecrets)
				.set({ updatedAt: new Date() })
				.where(eq(clientSecrets.id, secret.id));

			return { success: true, client };
		}
	}

	return { success: false };
}
```

**Migration Strategy:**

1. Create new `client_secrets` and `client_redirect_uris` tables via Drizzle migration
2. Run data migration script to:
   - Hash existing `secret` values with bcrypt and insert into `client_secrets` table
   - Set `name` to "Legacy (migrated)" for identification
   - Copy existing `redirectUri` values to `client_redirect_uris` table
3. Deploy updated code that reads from new tables
4. Verify all existing client integrations continue to work (secrets remain valid)
5. In a subsequent migration, remove old `secret` and `redirectUri` columns from `clients` table
6. Update admin UI to manage multiple secrets and redirect URIs

**Note:** This is a non-breaking migration. Existing secrets are hashed and moved to the new table, so all current client integrations continue to work without any changes on the client side.

#### 3.3 Scope Validation

**Spec Reference:** [RFC 6749 Section 3.3](https://datatracker.ietf.org/doc/html/rfc6749#section-3.3), [OIDC Core 5.4](https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims)

**Files to modify:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/id-token.ts`

**Change:**

- Validate `scope` parameter against `scopes_supported`
- Store granted scopes with authorization code
- Filter ID Token and UserInfo claims based on granted scopes:
  - `openid`: Required, enables OIDC (sub, iss, aud, exp, iat)
  - `email`: email, email_verified
  - `profile`: name, preferred_username, picture (future)

### Phase 4: OIDC Compliance

#### 4.1 Nonce Support

**Spec Reference:** [OIDC Core 3.1.2.1](https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest)

**Files to modify:**

- `app/routes/authorize.tsx`
- `app/entities/authz-code.ts`
- `app/entities/id-token.ts`

**Change:**

- Accept `nonce` parameter in authorization request
- Store nonce with authorization code
- Include `nonce` claim in ID Token

#### 4.2 Additional ID Token Claims

**Spec Reference:** [OIDC Core 2](https://openid.net/specs/openid-connect-core-1_0.html#IDToken)

**Files to modify:**

- `app/entities/id-token.ts`
- `app/entities/session.ts` (track auth_time)

**Claims to add:**

- `auth_time`: Time of authentication (required when `max_age` used)
- `nonce`: Echo back from authorization request
- `at_hash`: Access token hash (for hybrid flows, optional for now)

#### 4.3 OIDC Discovery Endpoint

**Spec Reference:** [OIDC Discovery 4](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig)

**New file:** `app/routes/[.]well-known.openid-configuration.ts`

**Implementation:**

- Return same content as OAuth AS metadata
- OIDC clients expect this endpoint

### Phase 5: RFC 6750 Bearer Token Compliance

#### 5.1 WWW-Authenticate Response Header

**Spec Reference:** [RFC 6750 Section 3](https://datatracker.ietf.org/doc/html/rfc6750#section-3)

**Files to modify:**

- `app/routes/userinfo.ts` (new)
- Any protected resource endpoints

**Requirements:**

- Return `WWW-Authenticate: Bearer` header on 401 responses
- Include `realm` attribute (OPTIONAL)
- Include `error` attribute with values: `invalid_request`, `invalid_token`, `insufficient_scope`
- Include `error_description` for developer debugging (OPTIONAL)
- Include `scope` attribute indicating required scope on `insufficient_scope` errors

**Example responses:**

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="auth.example.com"

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="auth.example.com", error="invalid_token", error_description="The access token expired"

HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer realm="auth.example.com", error="insufficient_scope", scope="openid email"
```

#### 5.2 Token Response Headers

**Spec Reference:** [RFC 6750 Section 4](https://datatracker.ietf.org/doc/html/rfc6750#section-4)

**Files to modify:**

- `app/routes/oauth.token.ts`

**Requirements:**

- Include `Cache-Control: no-store` header in token responses
- Include `Pragma: no-cache` header in token responses

### Phase 6: RFC 8414 Authorization Server Metadata Compliance

#### 6.1 Required Metadata Fields

**Spec Reference:** [RFC 8414 Section 2](https://datatracker.ietf.org/doc/html/rfc8414#section-2)

**Files to modify:**

- `app/config.ts`

**Currently missing REQUIRED/RECOMMENDED fields:**

- `grant_types_supported` - JSON array of supported grant types (currently not advertised)

**Implementation:**

```typescript
grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"];
```

#### 6.2 Issuer Validation

**Spec Reference:** [RFC 8414 Section 3.3](https://datatracker.ietf.org/doc/html/rfc8414#section-3.3)

**Note:** The `issuer` value in metadata response MUST exactly match the authorization server's issuer identifier URL used to retrieve it. This is already implemented correctly.

### Phase 7: OIDC RP-Initiated Logout Compliance

#### 7.1 Logout Endpoint Parameters

**Spec Reference:** [OIDC RP-Initiated Logout Section 2](https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout)

**Files to modify:**

- `app/routes/oidc.logout.tsx`

**Currently supported parameters:**

- `id_token_hint` - ✅ Implemented
- `post_logout_redirect_uri` - ✅ Implemented
- `state` - ✅ Implemented

**Missing parameters to add:**

- `logout_hint` - Hint about the End-User logging out (OPTIONAL)
- `client_id` - OAuth 2.0 Client Identifier (OPTIONAL, useful when `id_token_hint` not provided)
- `ui_locales` - Preferred languages for logout UI (OPTIONAL)

**Implementation:**

```typescript
// Accept additional parameters
const logoutHint = url.searchParams.get("logout_hint");
const clientId = url.searchParams.get("client_id");
const uiLocales = url.searchParams.get("ui_locales");

// When client_id is provided with id_token_hint, verify they match
if (clientId && idTokenHint) {
	const decoded = decodeIdToken(idTokenHint);
	if (decoded.aud !== clientId) {
		return error("Client ID does not match ID Token audience");
	}
}
```

#### 7.2 Discovery Metadata for Logout

**Spec Reference:** [OIDC RP-Initiated Logout Section 2.1](https://openid.net/specs/openid-connect-rpinitiated-1_0.html#OPMetadata)

**Files to modify:**

- `app/config.ts`

**Required metadata:**

- `end_session_endpoint` - ✅ Already advertised as `/oidc/logout`

### Phase 8: OIDC Back-Channel Logout

**Spec Reference:** [OIDC Back-Channel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)

Back-channel logout provides a more reliable logout mechanism than front-channel, as it doesn't depend on the user's browser session being active.

#### 8.1 OP Support for Back-Channel Logout

**New files:**

- `app/routes/api.backchannel-logout.ts` (internal endpoint to send logout tokens)

**Files to modify:**

- `app/config.ts` (discovery metadata)
- `db/schema.ts` (track logged-in RPs per session)

**Discovery metadata to add:**

```typescript
backchannel_logout_supported: true,
backchannel_logout_session_supported: true, // We can include sid in logout tokens
```

**Implementation:**

1. Track which RPs have active sessions for each user (visited sites)
2. When user logs out, send Logout Tokens to all RPs' `backchannel_logout_uri`
3. Logout Token is a JWT containing:
   - `iss`, `aud`, `iat`, `exp`, `jti` (standard claims)
   - `sub` and/or `sid` (to identify the session)
   - `events: { "http://schemas.openid.net/event/backchannel-logout": {} }`
   - Must NOT contain `nonce` (prevents misuse as ID Token)

#### 8.2 Client Registration for Back-Channel Logout

**Files to modify:**

- `db/schema.ts` (add columns to clients table)
- `app/models/client.ts`

**New client metadata:**

```typescript
// In clients table
backchannel_logout_uri: text("backchannel_logout_uri"), // RP's logout endpoint
backchannel_logout_session_required: integer("backchannel_logout_session_required"), // boolean
```

#### 8.3 Logout Token Generation

**New file:** `app/entities/logout-token.ts`

**Implementation:**

```typescript
interface LogoutTokenPayload {
	iss: string;
	sub?: string;
	aud: string;
	iat: number;
	exp: number; // Short expiration, max 2 minutes
	jti: string;
	sid?: string;
	events: {
		"http://schemas.openid.net/event/backchannel-logout": {};
	};
}

// Sign with ES256, same keys as ID Tokens
// Recommended: Include typ: "logout+jwt" header
```

#### 8.4 Sending Logout Requests

**Implementation:**

```typescript
// POST to each RP's backchannel_logout_uri
// Content-Type: application/x-www-form-urlencoded
// Body: logout_token=<JWT>
// Expected response: 200 OK or 204 No Content
// On error: 400 Bad Request with optional JSON error body
```

### Phase 9: OIDC Front-Channel Logout

**Spec Reference:** [OIDC Front-Channel Logout 1.0](https://openid.net/specs/openid-connect-frontchannel-1_0.html)

Front-channel logout uses the browser to notify RPs via hidden iframes. Less reliable than back-channel due to third-party cookie blocking.

#### 9.1 OP Support for Front-Channel Logout

**Files to modify:**

- `app/config.ts`
- `app/routes/oidc.logout.tsx`

**Discovery metadata to add:**

```typescript
frontchannel_logout_supported: true,
frontchannel_logout_session_supported: true, // Can include iss and sid
```

**Implementation:**

When rendering the logout page, include hidden iframes for each RP:

```html
<iframe src="https://rp.example.com/logout?iss=...&sid=..." style="display:none"></iframe>
```

#### 9.2 Client Registration for Front-Channel Logout

**Files to modify:**

- `db/schema.ts`
- `app/models/client.ts`

**New client metadata:**

```typescript
frontchannel_logout_uri: text("frontchannel_logout_uri"),
frontchannel_logout_session_required: integer("frontchannel_logout_session_required"), // boolean
```

**Note:** The `frontchannel_logout_uri` domain MUST match one of the registered redirect URIs.

### Phase 10: OIDC Session Management

**Spec Reference:** [OIDC Session Management 1.0](https://openid.net/specs/openid-connect-session-1_0.html)

Session management allows RPs to monitor the user's login status at the OP without network requests, using postMessage between iframes.

#### 10.1 Check Session Iframe

**New file:** `app/routes/oidc.check-session.ts`

**Files to modify:**

- `app/config.ts`

**Discovery metadata to add:**

```typescript
check_session_iframe: "/oidc/check-session",
```

**Implementation:**

The check_session_iframe endpoint returns an HTML page with JavaScript that:

1. Listens for postMessage from RP iframes
2. Receives: `client_id + " " + session_state`
3. Recalculates session state from: `SHA256(client_id + " " + origin + " " + op_browser_state + " " + salt)`
4. Responds with: `"changed"`, `"unchanged"`, or `"error"`

```typescript
// GET /oidc/check-session
export function loader() {
	const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Check Session</title></head>
    <body>
    <script>
      window.addEventListener("message", function(e) {
        var client_id = e.data.substr(0, e.data.lastIndexOf(' '));
        var session_state = e.data.substr(e.data.lastIndexOf(' ') + 1);
        var salt = session_state.split('.')[1];
        
        // Get OP browser state from cookie
        var opuas = getOpBrowserState();
        
        var ss = sha256(client_id + ' ' + e.origin + ' ' + opuas + ' ' + salt) + '.' + salt;
        
        var stat = (session_state === ss) ? 'unchanged' : 'changed';
        e.source.postMessage(stat, e.origin);
      });
    </script>
    </body>
    </html>
  `;
	return new Response(html, { headers: { "Content-Type": "text/html" } });
}
```

#### 10.2 Session State in Authorization Response

**Files to modify:**

- `app/routes/authorize.tsx`

**Implementation:**

Include `session_state` parameter in successful authorization responses:

```typescript
// Calculate session_state
const salt = generateRandomString();
const opBrowserState = getOpBrowserState(); // From cookie
const sessionState = sha256(`${clientId} ${redirectOrigin} ${opBrowserState} ${salt}`) + "." + salt;

// Include in redirect
redirect_uri + `?code=${code}&state=${state}&session_state=${sessionState}`;
```

### Phase 11: OIDC Dynamic Client Registration (Optional)

**Spec Reference:** [OIDC Dynamic Client Registration 1.0](https://openid.net/specs/openid-connect-registration-1_0.html)

**Note:** Dynamic registration is currently advertised but not implemented. This phase is OPTIONAL - we can either implement it or remove it from discovery.

#### 11.1 Client Registration Endpoint

**New file:** `app/routes/oidc.register.ts`

**Implementation (if implementing):**

```typescript
// POST /oidc/register
// Accept: application/json
// Optional: Authorization header with Initial Access Token

// Request body: Client Metadata (redirect_uris, client_name, etc.)
// Response: client_id, client_secret, registration_access_token, etc.
```

**Alternative (if not implementing):**

Remove `registration_endpoint` from discovery document in `app/config.ts`.

### Phase 12: Additional OAuth 2.0 Extensions

#### 12.1 JWT Profile for Client Authentication (RFC 7523)

**Spec Reference:** [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)

Allows clients to authenticate using signed JWTs instead of client secrets.

**Files to modify:**

- `app/routes/oauth.token.ts`
- `app/config.ts`

**Implementation:**

```typescript
// Support client_assertion_type: urn:ietf:params:oauth:client-assertion-type:jwt-bearer
// Support client_assertion: <signed JWT>

// Discovery metadata
token_endpoint_auth_methods_supported: [
	"client_secret_basic",
	"client_secret_post",
	"private_key_jwt", // Add this
];
```

#### 12.2 Pushed Authorization Requests - PAR (RFC 9126)

**Spec Reference:** [RFC 9126](https://datatracker.ietf.org/doc/html/rfc9126)

Allows clients to push authorization request parameters directly to the AS before redirecting the user, improving security.

**New file:** `app/routes/oauth.par.ts`

**Files to modify:**

- `app/config.ts`
- `app/routes/authorize.tsx`

**Implementation:**

```typescript
// POST /oauth/par
// Returns: { request_uri: "urn:ietf:params:oauth:request_uri:...", expires_in: 60 }

// Discovery metadata
pushed_authorization_request_endpoint: "/oauth/par",
require_pushed_authorization_requests: false, // Optional enforcement
```

#### 12.3 Authorization Server Issuer Identification (RFC 9207)

**Spec Reference:** [RFC 9207](https://datatracker.ietf.org/doc/html/rfc9207)

Prevents mix-up attacks by including the issuer in authorization responses.

**Files to modify:**

- `app/routes/authorize.tsx`

**Implementation:**

Include `iss` parameter in authorization response:

```typescript
// Redirect with iss parameter
redirect_uri + `?code=${code}&state=${state}&iss=${encodeURIComponent(issuer)}`;
```

**Discovery metadata:**

```typescript
authorization_response_iss_parameter_supported: true;
```

#### 12.4 Device Authorization Grant (RFC 8628)

**Spec Reference:** [RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)

Enables authorization on devices with limited input capabilities (TVs, CLI tools, IoT).

**New files:**

- `app/routes/oauth.device.ts` (device authorization endpoint)
- `app/routes/device.tsx` (user verification page)

**Implementation:**

```typescript
// POST /oauth/device
// Returns: { device_code, user_code, verification_uri, expires_in, interval }

// User visits verification_uri and enters user_code
// Client polls token endpoint with grant_type=urn:ietf:params:oauth:grant-type:device_code
```

**Discovery metadata:**

```typescript
device_authorization_endpoint: "/oauth/device";
```

#### 12.5 Form Post Response Mode

**Spec Reference:** [OAuth 2.0 Form Post Response Mode](https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html)

Returns authorization response parameters via HTTP POST instead of URL fragments/query.

**Files to modify:**

- `app/routes/authorize.tsx`
- `app/config.ts`

**Implementation:**

When `response_mode=form_post`, return an HTML page that auto-submits a form:

```html
<form method="post" action="redirect_uri">
	<input type="hidden" name="code" value="..." />
	<input type="hidden" name="state" value="..." />
</form>
<script>
	document.forms[0].submit();
</script>
```

**Discovery metadata:**

```typescript
response_modes_supported: ["query", "fragment", "form_post"];
```

#### 12.6 Prompt Create (User Registration)

**Spec Reference:** [OIDC Prompt Create 1.0](https://openid.net/specs/openid-connect-prompt-create-1_0.html)

Allows RPs to request the OP to show a registration page instead of login.

**Files to modify:**

- `app/routes/authorize.tsx`

**Implementation:**

```typescript
// When prompt=create, redirect to registration page instead of login
if (prompt === "create") {
	return redirect("/register?" + preserveParams);
}
```

**Discovery metadata:**

```typescript
prompt_values_supported: ["none", "login", "consent", "select_account", "create"];
```

### Phase 13: Security Best Practices (RFC 9700)

#### 13.1 State Parameter Validation

**Spec Reference:** [RFC 6749 Section 10.12](https://datatracker.ietf.org/doc/html/rfc6749#section-10.12), [RFC 9700 Section 2.1](https://datatracker.ietf.org/doc/html/rfc9700#section-2.1)

**Note:** While `state` validation is the CLIENT's responsibility, the server should:

- Always echo back `state` in authorization response (already implemented)
- Log when `state` is missing for security monitoring

#### 13.2 Rate Limiting

**Spec Reference:** [RFC 9700 Section 2.5](https://datatracker.ietf.org/doc/html/rfc9700#section-2.5)

**Files to modify:**

- `app/routes/oauth.token.ts`
- `app/middleware/` (new rate limit middleware)

**Implementation:**

- Use Cloudflare Rate Limiting or KV-based counter
- Limit by client_id and IP
- Return `429 Too Many Requests` with `Retry-After` header

#### 13.3 Refresh Token Rotation

**Spec Reference:** [RFC 9700 Section 4.14](https://datatracker.ietf.org/doc/html/rfc9700#section-4.14)

**Files to modify:**

- `app/modules/oauth2.ts` (refreshTokenGrant)

**Change:**

- Issue new refresh token on each use
- Invalidate old refresh token
- Detect refresh token reuse (possible token theft)

## Implementation Priority

| Priority | Item                                                                             | Effort | Impact | Spec               |
| -------- | -------------------------------------------------------------------------------- | ------ | ------ | ------------------ |
| P0       | Fix discovery document (remove false endpoints)                                  | Low    | High   | RFC 8414           |
| P0       | Implement `/userinfo`                                                            | Medium | High   | OIDC Core          |
| P0       | Reduce auth code TTL to 10 minutes                                               | Low    | Medium | RFC 6749           |
| P0       | Add `Cache-Control: no-store` to token responses                                 | Low    | Medium | RFC 6750           |
| P1       | Implement `/oauth/revoke`                                                        | Medium | Medium | RFC 7009           |
| P1       | Implement `/oauth/introspect`                                                    | Medium | Medium | RFC 7662           |
| P1       | Add nonce support                                                                | Medium | Medium | OIDC Core          |
| P1       | Add `WWW-Authenticate` header to protected resources                             | Low    | Medium | RFC 6750           |
| P1       | Add `grant_types_supported` to discovery                                         | Low    | Low    | RFC 8414           |
| P1       | Back-channel logout support                                                      | High   | High   | OIDC Back-Channel  |
| P1       | Add `iss` to authorization response                                              | Low    | Medium | RFC 9207           |
| P2       | Client secrets/redirect URIs refactoring (multi-secret, hashing, usage tracking) | High   | High   | RFC 9700           |
| P2       | Implement scope validation                                                       | Medium | Medium | RFC 6749           |
| P2       | Add rate limiting                                                                | Medium | High   | RFC 9700           |
| P2       | Add `logout_hint`, `client_id`, `ui_locales` to logout                           | Low    | Low    | OIDC RP-Logout     |
| P2       | Front-channel logout support                                                     | Medium | Medium | OIDC Front-Channel |
| P2       | Session management (check_session_iframe)                                        | Medium | Medium | OIDC Session       |
| P2       | Form post response mode                                                          | Low    | Medium | OAuth Form Post    |
| P2       | Prompt=create support                                                            | Low    | Low    | OIDC Prompt Create |
| P3       | Add `auth_time` claim                                                            | Low    | Low    | OIDC Core          |
| P3       | Refresh token rotation                                                           | Medium | Medium | RFC 9700           |
| P3       | OIDC discovery endpoint (`/.well-known/openid-configuration`)                    | Low    | Low    | OIDC Discovery     |
| P3       | Dynamic client registration (or remove from discovery)                           | High   | Low    | OIDC Registration  |
| P3       | JWT client authentication (private_key_jwt)                                      | Medium | Medium | RFC 7523           |
| P3       | Pushed Authorization Requests (PAR)                                              | Medium | High   | RFC 9126           |
| P3       | Device Authorization Grant                                                       | High   | Medium | RFC 8628           |

## Consequences

### Positive

- Full compliance with OAuth 2.0 and OIDC specifications
- Resource servers can validate tokens via introspection
- Clients can properly revoke tokens on logout
- Improved security posture per RFC 9700
- No more false advertising in discovery document
- Multiple secrets per client enables separate credentials for different environments (local/staging/production)
- Multiple redirect URIs per client provides flexibility for different deployment scenarios
- Secret usage tracking enables security audits and identification of unused credentials

### Negative

- Significant implementation effort
- Database migration needed for client secrets and redirect URIs refactoring
- Breaking change if clients depend on implicit grant (unlikely)
- Rate limiting adds operational complexity
- Existing clients will need to regenerate secrets after migration

### Migration Notes

1. **Client Secrets and Redirect URIs Migration:**
   - Create new `client_secrets` and `client_redirect_uris` tables
   - Migrate existing `secret` values from `clients` table to `client_secrets` (hash with bcrypt)
   - Migrate existing `redirectUri` values from `clients` table to `client_redirect_uris`
   - **Non-breaking:** Existing secrets will be hashed and migrated, so current client integrations continue to work without changes
   - After confirming migration success, remove deprecated columns from `clients` table
   - Admin UI updates needed to manage multiple secrets and redirect URIs
   - Migrated secrets will have `name` set to "Migrated from legacy" or similar for identification

2. **Discovery Document:** Clients caching the discovery document may need cache invalidation after changes.

3. **Token Introspection:** Resource servers currently validating tokens locally will benefit from introspection endpoint but no migration required.

4. **Secret Rotation Workflow:**
   - Create new secret in admin UI (shown once)
   - Update client application with new secret
   - Monitor `updated_at` on old secret to confirm it's no longer used
   - Revoke old secret once confirmed unused

## References

### Specification Links

#### OAuth 2.0 Core

- RFC 6749 (Authorization Framework): https://datatracker.ietf.org/doc/html/rfc6749
- RFC 6750 (Bearer Token Usage): https://datatracker.ietf.org/doc/html/rfc6750
- RFC 7636 (PKCE): https://datatracker.ietf.org/doc/html/rfc7636
- RFC 8414 (AS Metadata): https://datatracker.ietf.org/doc/html/rfc8414

#### OAuth 2.0 Extensions

- RFC 7009 (Token Revocation): https://datatracker.ietf.org/doc/html/rfc7009
- RFC 7662 (Token Introspection): https://datatracker.ietf.org/doc/html/rfc7662
- RFC 7521 (Assertion Framework): https://datatracker.ietf.org/doc/html/rfc7521
- RFC 7523 (JWT Profile for Client Auth): https://datatracker.ietf.org/doc/html/rfc7523
- RFC 8628 (Device Authorization Grant): https://datatracker.ietf.org/doc/html/rfc8628
- RFC 9126 (Pushed Authorization Requests): https://datatracker.ietf.org/doc/html/rfc9126
- RFC 9207 (AS Issuer Identification): https://datatracker.ietf.org/doc/html/rfc9207

#### Security

- RFC 9700 (Security BCP): https://datatracker.ietf.org/doc/html/rfc9700

#### OpenID Connect

- OIDC Core 1.0: https://openid.net/specs/openid-connect-core-1_0.html
- OIDC Discovery 1.0: https://openid.net/specs/openid-connect-discovery-1_0.html
- OIDC Dynamic Registration 1.0: https://openid.net/specs/openid-connect-registration-1_0.html
- OIDC RP-Initiated Logout 1.0: https://openid.net/specs/openid-connect-rpinitiated-1_0.html
- OIDC Front-Channel Logout 1.0: https://openid.net/specs/openid-connect-frontchannel-1_0.html
- OIDC Back-Channel Logout 1.0: https://openid.net/specs/openid-connect-backchannel-1_0.html
- OIDC Session Management 1.0: https://openid.net/specs/openid-connect-session-1_0.html
- OAuth 2.0 Multiple Response Types: https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html
- OAuth 2.0 Form Post Response Mode: https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html
- OIDC Prompt Create 1.0: https://openid.net/specs/openid-connect-prompt-create-1_0.html
- OIDC Unmet Authentication Requirements: https://openid.net/specs/openid-connect-unmet-authentication-requirements-1_0.html

### Relevant Files

- `apps/auth/app/config.ts` - Discovery document configuration
- `apps/auth/app/modules/oauth2.ts` - OAuth2Provider and OIDCProvider classes
- `apps/auth/app/routes/authorize.tsx` - Authorization endpoint
- `apps/auth/app/routes/oauth.token.ts` - Token endpoint
- `apps/auth/app/entities/access-token.ts` - Access token generation
- `apps/auth/app/entities/id-token.ts` - ID token generation
- `apps/auth/app/entities/authz-code.ts` - Authorization code handling
- `apps/auth/db/schema.ts` - Database schema
