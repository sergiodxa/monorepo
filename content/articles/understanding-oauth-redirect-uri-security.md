---
title: Understanding OAuth Redirect URI Security
excerpt: Why validating redirect URIs matters and the security principles behind it.
---

OAuth redirect URIs sit at a trust boundary. After authentication, the authorization server sends the user, and sometimes sensitive values, back to a client-controlled destination. If that destination is not tightly constrained, the redirect step can become a path to token leakage, phishing, or code execution.

The details matter because redirect URI validation is not a single rule. Scheme choice, transport security, native app support, and URI matching each address a different failure mode. The RFC guidance makes more sense when you read it as defense against specific attacks instead of a checklist.

## The Trust Boundary

The `redirect_uri` parameter tells the authorization server where to send the user after consent or authentication. That sounds simple, but it also means the server is delegating control over the next navigation step.

If the server accepts arbitrary redirect URIs, an attacker can send a victim through a real authorization flow and then receive the result on an attacker-controlled endpoint. RFC 6749 Section 10.15 calls out this class of issue because an open redirector can turn a trusted login surface into part of an attack.

Sometimes the goal is direct token theft. In other cases, the attacker uses the trusted redirect to move the user from a legitimate login page to a convincing phishing page. The damage depends on the flow and the client type, but the core problem is the same: the authorization server must not redirect to an untrusted destination.

## Why Scheme Choice Matters

Not every URI scheme behaves like `https:`. Some schemes tell the browser to execute code or interpret inline content, which changes a redirect from a navigation step into an execution surface.

The `javascript:` scheme runs script when the browser navigates to it. A redirect such as `javascript:alert(document.cookie)` can become an XSS vector tied to the authorization flow rather than to template rendering.

The `data:` scheme is different, but the outcome can be similar. A value such as `data:text/html,<script>...</script>` can render attacker-controlled content directly from the URI. `vbscript:` and `file:` have narrower relevance today, but they still expand the attack surface on some platforms.

```ts
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];
```

Blocking these schemes is a low cost safeguard. OAuth redirect URIs rarely have a valid reason to use them, and allowing them creates risk that is disproportionate to any convenience they provide.

## Why HTTPS Is the Default

RFC 6749 Section 3.1.2.1 requires TLS for redirect URIs in production. That requirement protects the authorization response in transit. Without HTTPS, an attacker on the network may be able to observe or alter an authorization code before the client receives it.

Local development changes the trade-off. Requiring HTTPS for every `localhost` callback adds friction, while the threat model is usually different on a developer machine.

```ts
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
```

That is why many implementations allow `http://localhost` and its loopback variants while requiring HTTPS elsewhere. The exception is narrow, and it should stay narrow. A general HTTP allowance weakens the protection that redirect URI validation is supposed to provide.

## When Native Apps Change the Rules

Native apps do not fit the browser callback model perfectly. They often rely on custom schemes such as `myapp://callback`, or on platform features such as Universal Links on iOS and App Links on Android.

RFC 8252 prefers claimed HTTPS redirect URIs when the platform supports them. Those links tie the app to a domain it controls, which reduces the risk of another app registering the same callback target.

Custom schemes are sometimes necessary, but they are weaker. Another app may be able to register the same scheme and intercept the authorization response. That is one reason RFC 8252 recommends PKCE (Proof Key for Code Exchange) for native apps. PKCE does not stop interception, but it can stop an intercepted authorization code from being redeemed by the wrong party.

This is also why scheme filtering is not the whole story. A custom scheme like `myapp:` may be valid for a native client, while `javascript:` should still be rejected. Validation needs to account for both the client type and the scheme semantics.

## The Matching Strategy

Once a URI passes structural validation, the next question is how strictly to compare it against what the client registered. This is where convenience often competes with clarity.

Exact string matching is the safest default. The redirect URI in the authorization request must match a pre-registered URI character for character, including path, query, and trailing slash details when those are part of the registration.

Pattern matching can reduce configuration overhead, but it also increases ambiguity. A wildcard such as `https://*.example.com/callback` may help a multi-tenant system, yet it can also authorize subdomains the client did not intend to trust. Prefix matching has similar problems because small parsing differences can create unexpected matches.

The trade-off is straightforward: looser matching reduces setup friction, but it broadens the space for mistakes. Many systems are better served by registering each allowed redirect URI explicitly, even if that means more configuration.

## Validation Happens at Multiple Stages

Redirect URI validation is usually discussed as if it happens only at the authorization endpoint, but that misses part of the model.

At client registration time, validation helps prevent dangerous or malformed redirect URIs from being stored at all. That makes misconfiguration easier to catch and narrows what later requests are allowed to reference.

At authorization time, the server must verify that the requested `redirect_uri` matches one of the registered values for that client. This protects against attackers substituting a different destination during the flow.

The token endpoint performs another related check. RFC 6749 Section 4.1.3 requires the `redirect_uri` in the token request to exactly match the one used during authorization when that parameter was included earlier. That requirement helps bind the authorization code to the same redirect target used in the original request.

## Failed Validation Is a Security Signal

Rejected redirect URIs are often treated as routine input errors, but they can also reveal active probing. A failed validation event might be a developer mistake, or it might be an attempt to discover weak matching rules or accepted domains.

That makes logging useful, but the audience matters. User-facing errors should stay generic, such as `Invalid redirect_uri`, while operational logs can capture the details needed for investigation. Detailed public errors can make URI enumeration easier for an attacker.

## Conclusion

Redirect URI validation works best when it is treated as a set of related constraints, not a single allow-or-deny check. Scheme filtering, HTTPS requirements, strict matching, and repeated validation each cover a different part of the attack surface. When those rules are applied together, the redirect step stays aligned with the client the authorization server intended to trust.
