---
title: Understanding OAuth Redirect URI Security
excerpt: Why validating redirect URIs matters and the security principles behind it.
---

OAuth 2.0 redirect URIs represent one of the most critical security surfaces in any authorization flow. When a user completes authentication, the authorization server sends them back to the client application with sensitive tokens or authorization codes. If attackers can manipulate where that redirect goes, they can steal credentials. Understanding **why** certain URI schemes are dangerous and **how** the RFC requirements protect users is essential for building secure OAuth implementations.

## The Open Redirect Vulnerability

The OAuth authorization flow depends on the `redirect_uri` parameter to send users back to the client application. This creates a potential attack vector: if the authorization server accepts arbitrary redirect URIs, attackers can craft malicious authorization URLs that redirect victims to phishing sites.

The attack works like this:

1. An attacker creates a link to your legitimate authorization server, but with their malicious site as the redirect URI
2. A victim clicks the link, sees your real login page, and authenticates
3. Your server redirects to the attacker's site, sending valid tokens along with it
4. The attacker captures those tokens and impersonates the victim

RFC 6749 Section 10.15 explicitly warns about this. Open redirectors turn your trusted authentication flow into a tool for credential theft. Even without capturing tokens directly, open redirects enable sophisticated phishing: users trust your domain, complete a real login, then land on a convincing fake that harvests additional credentials.

## Why Certain URI Schemes Are Dangerous

Not all URI schemes behave the same way. Some exist specifically to execute code in the browser, which makes them inherently dangerous for redirects.

The `javascript:` scheme executes arbitrary JavaScript when a browser navigates to it. A redirect URI of `javascript:alert(document.cookie)` runs that code in the context of your authorization server. This enables XSS attacks even when your application otherwise sanitizes output correctly.

The `data:` scheme embeds content directly in the URL. A redirect to `data:text/html,<script>...</script>` renders that HTML, again enabling code execution. Modern browsers have mitigated some of these attacks, but the scheme remains dangerous.

The `vbscript:` and `file:` schemes pose similar risks on specific platforms.

```ts
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];
```

Blocking these schemes costs nothing and prevents entire categories of attacks. There is no legitimate reason for an OAuth redirect to use any of them.

## RFC Requirements and Their Rationale

RFC 6749 Section 3.1.2.1 requires TLS for redirect URIs in production. This is not just a best practice; it is a direct security requirement. Without HTTPS, attackers can perform man in the middle attacks and intercept authorization codes as they travel between the authorization server and the client.

However, development environments present a practical challenge. Requiring HTTPS for `localhost` would force developers to set up local certificates for every project. The practical solution is to allow HTTP for localhost addresses while enforcing HTTPS for everything else:

```ts
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
```

This exception recognizes that local development happens on a trusted machine where network interception is not a realistic threat.

## Mobile Applications and Custom Schemes

Native mobile applications cannot receive HTTP or HTTPS redirects directly. They need alternative approaches: custom URI schemes like `myapp://callback` or platform specific mechanisms like Universal Links on iOS and App Links on Android.

RFC 8252 (OAuth 2.0 for Native Apps) addresses this challenge. Section 7.1 recommends using claimed HTTPS redirect URIs when possible because they provide stronger security guarantees. Universal Links and App Links verify that the app legitimately controls the domain, preventing malicious apps from registering the same scheme.

Custom schemes remain necessary for some platforms, but they carry risks. Any app can register any custom scheme, so an attacker could potentially register `myapp://` and intercept tokens. This is why RFC 8252 recommends PKCE (Proof Key for Code Exchange) for all native apps: it ensures that even if an attacker intercepts an authorization code, they cannot exchange it for tokens.

When supporting native apps, the authorization server should:

- Prefer Universal/App Links over custom schemes when possible
- Require PKCE for all native app clients
- Still block dangerous schemes like `javascript:` and `data:`
- Validate custom schemes at client registration time

## Exact Match vs. Pattern Matching

RFC 6749 does not specify exactly how to compare redirect URIs, but Section 10.6 warns against partial matches that could be exploited. This creates a design decision for every OAuth implementation.

**Exact string matching** is the safest approach. The redirect URI in the authorization request must match a pre-registered URI character for character, including trailing slashes.

**Pattern matching** offers convenience but introduces risk. A wildcard like `https://*.example.com/callback` might seem helpful for multi-tenant applications, but it could match `https://attacker.example.com/callback` if an attacker controls a subdomain. Prefix matching has similar issues: a registered prefix of `https://example.com/callback` would match `https://example.com/callback?evil=param`, which might be acceptable, but could also match `https://example.com/callback/../attacker` depending on implementation.

The trade-off is clear: exact matching requires more configuration but eliminates ambiguity. If developers need multiple redirect URIs, they should register each one separately. The small inconvenience is worth the security guarantee.

## Validation at Two Points

Redirect URI validation should happen at two distinct points in the OAuth lifecycle.

**At registration time**, when a developer configures their OAuth client. This prevents accidentally storing dangerous URIs in the first place. The validation catches mistakes early and provides clear feedback to developers.

**At authorization time**, when processing each request. Even if all stored URIs are valid, the authorization endpoint must verify that the requested redirect URI matches one that was pre-registered. This prevents attackers from injecting arbitrary destinations.

The token endpoint adds a third check. RFC 6749 Section 4.1.3 requires that the `redirect_uri` used to exchange an authorization code must exactly match the one used in the original authorization request. This prevents code interception attacks where an attacker obtains an authorization code issued for one redirect URI and tries to exchange it at a different destination.

## Security Monitoring

When redirect URI validation fails, log it. These rejections might indicate an active attack or a misconfigured client. Either way, your security team should know.

Do not include the full redirect URI in user facing error messages. Attackers could use detailed errors to probe which URIs are registered. A generic "Invalid redirect_uri" error is sufficient for users while logs capture details for investigation.

## Conclusion

URI scheme validation is foundational to OAuth security. The principles are straightforward:

- Block dangerous schemes unconditionally
- Require HTTPS in production, allow HTTP only for localhost
- Prefer exact matching over patterns
- Validate at both registration and authorization time
- Log rejections for security monitoring

Getting redirect URI validation wrong opens the door to credential theft and phishing attacks. The implementation is not complex, but understanding **why** each rule exists helps you apply them correctly and recognize new threats as they emerge.
