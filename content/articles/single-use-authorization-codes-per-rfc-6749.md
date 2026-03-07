---
title: Why OAuth Authorization Codes Must Be Single Use
excerpt: Understanding the security requirement behind RFC 6749's single use authorization code mandate.
---

OAuth 2.0 authorization codes are meant to be used exactly once. This is not a suggestion or best practice. It is a requirement in RFC 6749, and understanding **why** this requirement exists is essential for building secure authorization servers.

## The Threat Model

An authorization code represents a user's explicit consent to grant access to a client application. The code travels through the user's browser as a query parameter in a redirect URL, making it visible in browser history, server logs, and potentially network traffic.

If that code can be used multiple times, an attacker who intercepts it can exchange it for tokens even after the legitimate client has already done so. This is a **replay attack**, one of the oldest and most straightforward attack patterns in security.

Consider a realistic scenario: a user authorizes an application on a public WiFi network. An attacker on the same network captures the redirect URL containing the authorization code. Without single use enforcement, the attacker simply sends their own token exchange request and receives valid tokens. The attack requires no sophistication, just the ability to observe network traffic.

## What RFC 6749 Requires

Section 4.1.2 of RFC 6749 is explicit about this:

> The authorization code MUST expire shortly after it is issued to mitigate the risk of leaks. A maximum authorization code lifetime of 10 minutes is RECOMMENDED. The client MUST NOT use the authorization code more than once. If an authorization code is used more than once, the authorization server MUST deny the request and SHOULD revoke (when possible) all tokens previously issued based on that authorization code.

Three distinct requirements emerge from this paragraph:

1. **Short expiration**: Codes must be short lived (10 minutes maximum)
2. **Single use**: Codes must be consumed on first use
3. **Revocation on reuse**: If a code is reused, deny the request AND revoke any tokens already issued from that code

The third requirement is particularly important. A second use of the same code indicates either a replay attack or a serious bug in the client application. Either way, the tokens issued from that code can no longer be trusted.

## Why Short Expiration Alone Is Not Enough

You might wonder why short expiration times are not sufficient protection. If codes expire in 10 minutes, why does single use matter?

The answer is that 10 minutes is an eternity in security terms. An attacker who captures a code can attempt to exchange it within seconds. The legitimate client might experience network latency, giving the attacker time to win the race. Short expiration limits the window of vulnerability but does not close it.

Single use enforcement is what actually prevents the attack. Once the code is consumed, whether by the legitimate client or the attacker, it cannot be used again. The attacker's window shrinks from 10 minutes to the time between code interception and legitimate exchange, often milliseconds.

## The Atomic Consumption Pattern

Implementing single use correctly requires understanding a subtle point: **the check and the consumption must be atomic**.

Consider what happens if your implementation first checks whether a code exists, then deletes it:

```ts
// VULNERABLE: gap between check and delete
let code = await db.find(codes, { where: { value: codeValue } });
if (!code) throw new Error("Code not found");
await db.delete(codes, { value: codeValue });
```

An attacker sending concurrent requests could slip through the gap. Both requests find the code, both proceed to delete it, and one or both successfully exchange for tokens.

The correct pattern uses deletion as the consumption mechanism:

```ts
// SECURE: deletion IS the consumption
let code = await db.find(codes, { where: { value: codeValue } });
if (!code) throw new Error("Already consumed");
await db.delete(codes, { value: codeValue });
// Only one request can reach here with valid code data
```

In SQL databases with proper isolation, a `DELETE ... RETURNING` statement makes this truly atomic. The database guarantees that exactly one request succeeds.

## Token Revocation on Reuse

RFC 6749's recommendation to revoke all tokens issued from a reused code provides **defense in depth**. If an attacker somehow won the race and obtained tokens before the legitimate client, detecting the reuse attempt allows you to invalidate those tokens.

Implementing this requires tracking which tokens came from which authorization code:

```ts
interface TokenRecord {
	token: string;
	authorizationCodeHash: string;
	// ... other fields
}
```

When a reuse attempt is detected, you query for all tokens with matching `authorizationCodeHash` and revoke them. This adds complexity, but it transforms a successful attack into a temporary compromise.

In practice, many implementations skip this complexity. If single use enforcement works correctly, reuse attempts always fail, so there are no tokens to revoke. The primary defense is preventing the second exchange from succeeding at all. Revocation provides a safety net for implementation bugs.

## Why Identical Error Responses Matter

Both "already consumed" and "expired" conditions should return the same error to clients: `invalid_grant`. Providing different responses leaks information that could help an attacker probe the system.

If an attacker knows that "code expired" is different from "code already used," they can determine whether a code was legitimate but expired versus already consumed by someone else. This information helps them time future attacks or confirm that their interception was successful.

Internally, distinguishing these conditions helps with debugging and monitoring. Every "already consumed" error represents either a client bug or a potential attack. Logging these events with context enables security monitoring.

## Defense in Depth with PKCE

Single use codes work alongside other protections. PKCE (Proof Key for Code Exchange) adds another layer by binding the authorization request to the token exchange request using a cryptographic challenge.

Even if an attacker captures a code, they cannot exchange it without the `code_verifier` that was generated on the client. Single use prevents replay attacks; PKCE prevents interception attacks. Together, they make authorization code interception largely impractical.

## Monitoring for Replay Attempts

While replay attacks are prevented by single use enforcement, detecting attempts is valuable. Every "already consumed" error warrants investigation. A spike in reuse attempts targeting a specific client or redirect URI pattern could indicate:

- An active attack against your users
- A misconfigured client making duplicate requests
- Network issues causing request retries

Rate limiting token exchange requests by client ID provides additional protection against brute force attempts to exploit race conditions.

## Conclusion

Single use authorization codes are a fundamental OAuth2 security requirement designed to prevent replay attacks. The implementation relies on atomic consumption, ensuring that only one request can successfully exchange a code for tokens.

Understanding the threat model helps you appreciate why short expiration alone is insufficient, why error responses should be identical, and why token revocation on reuse provides valuable defense in depth. Combined with PKCE and short expiration times, single use codes make authorization code attacks impractical even in hostile network environments.
