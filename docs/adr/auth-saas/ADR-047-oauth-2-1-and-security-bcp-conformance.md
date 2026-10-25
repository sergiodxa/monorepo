# ADR-047: OAuth 2.1 and Security BCP Conformance

## Status

**Accepted** - 2026-10-24

## Background

Every auth-saas tenant is an OAuth 2.0 / OpenID Connect provider. OAuth 2.1
([draft-ietf-oauth-v2-1-16](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/), 3 September 2026) consolidates OAuth 2.0 with the practices the OAuth Security Best Current Practice
([RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)) made mandatory. Clients written today target
2.1, and a provider that only speaks 2.0 strictly turns some of them away. The provider also gained
step-up authentication (RFC 9470), DPoP (RFC 9449), token exchange (RFC 8693), token introspection
with signed responses (RFC 7662, RFC 9701) and token revocation (RFC 7009) in the same round of
work, which changes what "conformant" covers.

This ADR records how a tenant measures against both documents, the small gaps closed while
auditing, and the larger gaps left open with the reason for each, so the next change starts from a
known baseline instead of a fresh audit.

## Context

The tenant's provider runs inside its Durable Object (`app/models/tenant/`), with the HTTP surface
in `app/http/controllers/` (`authorize.tsx`, `hosted/`, `oauth/`, `userinfo.ts`). The audit read
draft -16 and RFC 9700 against that code.

### What conforms

| Requirement                                                                        | Where it holds                                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Only `response_type=code`; no implicit or password grant (2.1 §10, BCP §2.1.2)     | `responseTypesSupported: ["code"]`; the token endpoint has no `password` grant                             |
| PKCE `S256` on every authorization request, `plain` refused (2.1 §4.1.1)           | `validateAuthorizationRequest` refuses a request without an `S256` challenge, for confidential clients too |
| Exact redirect URI matching, loopback port excepted (2.1 §2.3.1)                   | `redirectUriMatches` in `clients.ts`                                                                       |
| `https` redirect URIs except loopback; no fragment (2.1 §2.3)                      | `validateRedirectUri`                                                                                      |
| Codes single-use and short-lived; a replay revokes what the code issued            | 60-second codes; a second redemption revokes the token family (`exchangeCode`)                             |
| Public clients' refresh tokens sender-constrained or rotated (2.1 §4.3.1)          | Every refresh rotates, reuse revokes the family and ends the session; a DPoP-bound one needs its key       |
| Mix-up defense with `iss` in the authorization response (RFC 9207, BCP §4.4)       | `authorization_response_iss_parameter_supported: true`                                                     |
| Bearer tokens never read from a query string (2.1 §5.1)                            | `/userinfo` and the management API read only the `Authorization` header                                    |
| `303`, never `307`, out of a form that carried credentials (2.1 §7.5.4, BCP §4.12) | The hosted flow and the authorization response answer `303` (fixed in this round)                          |
| Token responses not cached                                                         | `Cache-Control: no-store` on the token, introspection and revocation endpoints                             |
| Clickjacking and referrer leaks (BCP §4.16, §4.2)                                  | `frame-ancestors 'none'` and `Referrer-Policy: no-referrer` (`config/security-policy.ts`)                  |
| No open redirector at the authorization endpoint (BCP §4.11)                       | An unverified redirect target renders the error inline and never redirects                                 |
| Sender-constrained access tokens (BCP §2.2)                                        | DPoP on every grant, `/userinfo` and `@sdxc/auth`'s resource server                                        |
| Authorization request integrity (BCP §2.1, RFC 9126, RFC 9101)                     | PAR and signed request objects, enforceable per client or per tenant                                       |
| Client secrets stored hashed, rotation with an overlap window                      | `client_secrets` holds hashes; `rotateClientSecret`                                                        |

### Small gaps closed in this round

- **`redirect_uri` in the token request.** Draft -16 §4.1.3 drops it, since PKCE binds the code;
  §10.2 still has the server enforce it when sent. The token endpoint refused a code exchange that
  left it out, so a client written to 2.1 could not finish a login. It is now optional and checked
  when present.
- **Redirect status.** The hosted screens and the authorization response answered `302`. They now
  answer `303`.
- **Revocation.** There was no RFC 7009 endpoint, so neither a client nor `@sdxc/auth`'s `revoke()`
  could end a refresh token. `POST /oauth/revoke` now ends a refresh token's whole family for the
  client holding it.
- **`client_id` beside `Basic`.** A body `client_id` sent alongside matching `Basic` credentials
  was refused, which `@sdxc/auth`'s own `ServiceClient` sends. It is accepted when it names the same
  client.
- **Discovery.** Both documents now publish the revocation and introspection endpoints, the DPoP
  and introspection signing algorithms, the token exchange grant, and `acr_values_supported`.

## Decision

A tenant targets OAuth 2.1 (draft -16) and RFC 9700. Every new provider feature states which
section of either it implements or departs from, and a departure is either fixed or listed under
the gaps below with its reason. The provider keeps accepting OAuth 2.0 clients wherever 2.1 asks a
server to stay compatible (§10), such as enforcing a `redirect_uri` a client still sends.

The gaps still open, each larger than this round:

1. **CORS on the token, revocation and introspection endpoints.** Draft -16 §3.2 says a server
   supporting browser-based apps needs it. A tenant answers no CORS preflight, so a single-page app
   must exchange its code through its own backend. Adding it means an `OPTIONS` route per endpoint
   and an origin policy per client.
2. **Audience-restricted access tokens from the authorization code flow.** §7.1.3.6 recommends it.
   Those tokens always name the tenant's `/userinfo` as `aud`, and `/authorize` does not read RFC
   8707 `resource` parameters, so an API trusting a tenant's tokens accepts a token meant for another
   API of the same tenant. `client_credentials` accepts one `resource`, and token exchange narrows
   the audience on request.
3. **Asymmetric client authentication.** RFC 9700 §2.5 recommends `private_key_jwt` (RFC 7523) or
   mutual TLS (RFC 8705). Confidential clients authenticate only with shared secrets.
4. **DPoP gaps.** The provider issues no `DPoP-Nonce` and does not read `dpop_jkt` at `/authorize`
   (RFC 9449 §10) to bind the code to the key. Proofs are still single-use through the replay
   store and fresh within five minutes.
5. **Step-up for dashboard sessions.** The management API holds a member's bearer token to a fresh
   second factor before exporting password hashes; a dashboard session reaching the same route is
   not held to it.
6. **Introspection reach.** Any authenticated confidential client of a tenant may introspect that
   tenant's access tokens (refresh tokens only their own). RFC 7662 §4 suggests limiting which
   protected resources may introspect which tokens.
7. **Access token revocation.** Access tokens are self-contained JWTs and live an hour; revocation
   ends the refresh token and the token family, not tokens already handed out.

## Consequences

### Positive

- A client written to OAuth 2.1 completes the authorization code flow against a tenant, including
  one that omits `redirect_uri` from the token request.
- Every endpoint the 2.1 and BCP feature set relies on exists and is advertised in discovery:
  revocation, introspection (JSON or signed), DPoP, PAR, token exchange.
- The open gaps are named with their size, so each can be scheduled on its own.

### Negative

- A browser-only client still needs a backend to reach the token endpoint until gap 1 closes.
- Tokens from the authorization code flow stay tenant-wide in audience until gap 2 closes.

### Neutral

- OAuth 2.0 clients see no change: a sent `redirect_uri` is still enforced, a `302` and a `303` are
  followed alike, and a bearer request still works wherever DPoP is optional.

## References

- [draft-ietf-oauth-v2-1-16](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700)
- [RFC 9449: DPoP](https://www.rfc-editor.org/rfc/rfc9449),
  [RFC 9470: Step-Up Authentication Challenge](https://www.rfc-editor.org/rfc/rfc9470),
  [RFC 8693: Token Exchange](https://www.rfc-editor.org/rfc/rfc8693),
  [RFC 7662: Token Introspection](https://www.rfc-editor.org/rfc/rfc7662),
  [RFC 9701: JWT Response for Token Introspection](https://www.rfc-editor.org/rfc/rfc9701),
  [RFC 7009: Token Revocation](https://www.rfc-editor.org/rfc/rfc7009)
