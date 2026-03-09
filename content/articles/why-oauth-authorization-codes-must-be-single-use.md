---
title: Why OAuth Authorization Codes Must Be Single Use
excerpt: Why RFC 6749 requires single use authorization codes and what that requirement costs in practice.
---

Authorization codes sit in an awkward place. They are short lived, but they still pass through the browser and redirect URLs before they reach the token endpoint. That makes them useful, but it also makes them exposed in ways a server side secret is not.

RFC 6749 treats that exposure as a real security concern, not a theoretical one. A code that can be exchanged more than once turns a brief leak into a replay opportunity. A code that can be consumed only once limits the damage, but it also forces the authorization server to handle retries, races, and revocation carefully.

## The Threat Model

An authorization code represents a user's approval for a client to continue the flow. If that code is observed in browser history, logs, or network traffic, an attacker may try to exchange it at the token endpoint.

If the server accepts the same code twice, the second exchange becomes a replay attack. The attacker does not need to forge consent or break encryption. They only need to reuse a value the system already trusted once.

Short expiration reduces the window for that attack, but it does not remove it. Ten minutes, or even one minute, is still enough time for an automated client to retry a stolen code.

## What the RFC Says

Section 4.1.2 of RFC 6749 is explicit about this:

> The authorization code MUST expire shortly after it is issued to mitigate the risk of leaks. A maximum authorization code lifetime of 10 minutes is RECOMMENDED. The client MUST NOT use the authorization code more than once. If an authorization code is used more than once, the authorization server MUST deny the request and SHOULD revoke (when possible) all tokens previously issued based on that authorization code.

That paragraph separates four different ideas:

1. Codes must expire shortly after issuance.
2. A 10 minute maximum lifetime is recommended, not required.
3. The client must not use the same code more than once.
4. If reuse happens, the authorization server must deny the request and should revoke previously issued tokens when possible.

That distinction matters. Denying reuse is mandatory. Revoking already issued tokens is a recommendation, which reflects an implementation trade-off. Containment is better if you can revoke, but some systems do not have a practical way to trace every token back to the code that produced it.

## Why Expiration Is Not Enough

Expiration and single use solve different problems. Expiration limits how long a leaked code remains valuable. Single use limits how many times a leaked code can succeed.

This is the core trade-off. A short lifetime is easy to explain and easy to implement, but it still leaves a replay window. Single use closes most of that window, but only if the server treats consumption as a one time state transition.

That is why single use is the stronger guarantee. It turns a reusable credential into a race that only one side can win.

## The Real Implementation Cost

The requirement sounds simple. The implementation is not. If your token endpoint checks whether a code exists and then removes it in a separate step, concurrent requests can still slip through.

The safe pattern is to consume the code with one atomic operation:

```sql
DELETE FROM authorization_codes
WHERE code_hash = ?
  AND expires_at > NOW()
RETURNING id, client_id, user_id, scope;
```

If this statement returns one row, that request consumed the code. If it returns zero rows, the server should treat the code as invalid for the token exchange. That covers both expired and already consumed codes without exposing which case happened.

This is one of the main trade-offs in the design. Single use codes improve replay resistance, but they push you toward stateful storage and atomic database semantics. A stateless design would be simpler operationally, but it could not enforce one time consumption reliably.

## Reuse Changes the Risk

When a reused code reaches the token endpoint, something already went wrong. It may be an intercepted redirect, an aggressive retry from the client, or a bug in the client's callback handling. The server does not need to know which one it is before denying the exchange.

The harder question is what to do next. RFC 6749 says the server should revoke previously issued tokens when possible. That is useful because it limits damage if the first exchange succeeded for the wrong party. If you need a refresher on what those tokens represent, [OAuth2 Tokens Explained](/articles/oauth2-tokens-explained) covers the distinction.

The trade-off is operational complexity. Revocation requires lineage between the authorization code and every token issued from it. If your system issues self contained access tokens and does not keep server side revocation state, "should revoke when possible" becomes an important qualifier, not a loophole.

## Error Responses and Signals

OAuth 2.0 already gives you the standard public response: `invalid_grant`. Returning more detail to the client rarely helps, and it can reveal whether a code was valid, expired, or already consumed.

Internally, those cases are still worth separating. An expired code may point to latency or a client that waits too long before exchanging it. A reused code is more suspicious. It may indicate retries, but it may also indicate an interception attempt.

This is another trade-off worth making explicit. Uniform external errors reduce information leakage. Rich internal telemetry improves debugging and abuse detection.

## PKCE Is Not Enough

PKCE reduces the value of a stolen authorization code because the attacker also needs the `code_verifier`. That makes interception less useful, especially for public clients.

Still, PKCE and single use address different failure modes. PKCE binds the token exchange to the client that initiated the flow. Single use prevents the same code from succeeding twice. One strengthens the proof of possession. The other limits replay.

Using both increases implementation complexity, but the security model is clearer when each control does one job.

## Conclusion

Single use authorization codes are not a stylistic choice in OAuth 2.0. They are part of the protocol's replay defense. RFC 6749 requires denial on reuse, recommends short lifetimes, and recommends revocation when possible.

The trade-off is that this protection is stateful and operationally stricter than a simple expiration check. That cost is worth understanding because it explains why correct implementations rely on atomic consumption, uniform public errors, and layered controls such as PKCE.
