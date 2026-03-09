---
title: Understanding Timing Attacks in Authentication Systems
excerpt: Why response time differences leak secrets and when constant time checks are worth the extra work.
---

Timing attacks turn small response time differences into information about a secret. A comparison that exits on the first mismatch does less work for an incorrect prefix than for a correct one. In authentication code, that difference can be enough to guide an attacker toward the right value.

This does not mean every equality check becomes an urgent security issue. The risk depends on what is being compared, how much timing noise exists, and whether an attacker can send enough requests to average that noise out. The important part is understanding where timing matters, and where the extra care adds little value.

## Why Timing Attacks Work

The core issue is simple: different code paths take different amounts of time. A direct string comparison usually stops at the first mismatch. If the first character is wrong, the work ends quickly. If many characters match before the mismatch appears, the comparison takes slightly longer.

```ts
// This comparison leaks timing information
if (providedKey === storedKey) {
	// grant access
}
```

An attacker can exploit that difference by sending many guesses and measuring the response time for each one. A single request rarely proves much, especially over a noisy network. Across enough samples, though, longer responses can indicate that more of the secret matched.

That changes the problem from guessing an entire secret at once to learning it a piece at a time. For a 32 character key drawn from 62 alphanumeric characters, the attacker no longer faces `62^32` combinations. In the ideal case, they only need to identify the best candidate for each position, which makes the search dramatically smaller.

## The Threat Model

Timing attacks are sensitive to context. Whether they are realistic depends less on the existence of a timing difference and more on whether an attacker can measure it reliably.

Network proximity matters because it affects noise. On the same machine, local network, or data center, small differences are easier to observe. Across the public internet, jitter can overwhelm a tiny leak, but large timing gaps or enough samples can still make the signal usable.

Request volume matters just as much. Timing attacks usually need repeated measurements, which makes rate limits, anomaly detection, and short lived secrets more useful. Those controls do not remove the underlying leak, but they can raise the cost of exploiting it.

The value of the secret also changes the calculation. API keys, reset tokens, HMAC signatures, and OAuth client secrets justify more effort than low value identifiers. A measurable leak in a high value path deserves more attention than the same pattern in a non sensitive comparison.

Server side checks are usually the most relevant because the attacker is measuring server behavior. Client side timing issues exist too, but they tend to depend on different attack techniques and are less central to everyday authentication code.

## Where Timing Attacks Apply

The classic example is string comparison, but the same pattern appears in several authentication flows.

### Secret Comparison

Direct comparisons of API keys, bearer tokens, webhook signatures, and password reset tokens all have the same shape. When the compared value is secret, early exit creates a leak even if the rest of the system looks correct.

### User Enumeration

User enumeration often shows up even when the response body is identical. A login route can return the same error for both cases and still reveal whether the account exists if only one path performs password verification.

```ts
async function login(email: string, password: string) {
	let user = await findUserByEmail(email);
	if (!user) {
		return { error: "Invalid credentials" }; // Returns in ~5ms
	}
	let valid = await bcrypt.compare(password, user.hash);
	return valid ? { user } : { error: "Invalid credentials" }; // Returns in ~100ms
}
```

Because password hashing is intentionally slow, the difference can be large enough to survive ordinary network noise. That does not immediately expose the password, but it can help with targeted phishing, credential stuffing, or account discovery.

### Signature Verification

HMAC verification is especially sensitive because the signature itself proves authenticity. If verification leaks how many bytes match, an attacker may be able to build a valid signature incrementally instead of guessing the full value at once.

### Multiple Secrets

Systems with rotated keys or multiple valid client secrets have a similar problem. Sequentially checking each candidate and returning on the first match can reveal whether a match exists and sometimes which credential matched.

## Why Constant Time Checks Help

Constant time comparison tries to make the work depend on input length, not on where the first mismatch appears. That removes the most direct signal an attacker can measure.

```ts
import { timingSafeEqual } from "node:crypto";

function secureCompare(a: Buffer, b: Buffer): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}
```

`timingSafeEqual` avoids the early exit behavior, but it only applies when both inputs have the same length. That makes it a good fit for fixed length secrets such as hashes, HMAC digests, and many generated tokens. For variable length values, you usually need to normalize them first or compare a derived fixed length representation.

The same idea applies to user enumeration. If one path performs expensive password verification, the other path should do comparable work too.

```ts
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye...";

async function login(email: string, password: string) {
	let user = await findUserByEmail(email);
	let hashToCompare = user?.hash ?? DUMMY_HASH;
	let valid = await bcrypt.compare(password, hashToCompare);
	return user && valid ? { user } : { error: "Invalid credentials" };
}
```

Both branches now pay roughly the same bcrypt cost. That reduces the timing gap, although it also means the endpoint does more work for nonexistent users. In practice, that trade off is usually acceptable for login flows because the cost is predictable and the security benefit is clear.

## Where the Risk Is Real

The practical question is not whether timing leaks exist in theory. The question is whether the signal is strong enough, and the environment stable enough, for an attacker to recover useful information.

Large timing gaps are often exploitable. User enumeration differences measured in tens or hundreds of milliseconds can remain visible even through network jitter. HMAC verification without constant time comparison is also a well understood risk because the attacker gets repeated chances to refine the same guess.

Smaller leaks are less predictable. A nanosecond scale difference over the public internet may be buried under noise unless the attacker has patience, favorable conditions, or a very high request budget. That does not make the issue imaginary, but it does affect how urgently it should be prioritized relative to more direct weaknesses.

This is where balanced language matters. Constant time protections are usually inexpensive, so they are often worth applying even when exploitation is uncertain. At the same time, rate limits, anomaly detection, and secret rotation still matter because constant time comparison addresses only one part of the attack surface.

## When Timing Does Not Matter

Not every comparison needs constant time handling. The extra care is most useful when three conditions are true: the value is secret, an attacker benefits from learning it incrementally, and the comparison happens in a place where timing can be observed.

That usually includes authentication tokens, signature checks, and account existence checks hidden behind uniform error messages. It usually does not include public identifiers, ordinary feature flags, or application data that is not secret even if the comparison exits early.

There is also a performance trade off, even if it is often modest. Constant time work may keep expensive paths alive for requests that would otherwise fail early. That cost is justified when the comparison protects a secret, but applying the same pattern everywhere can add complexity without much security value.

## Conclusion

Timing attacks matter because authentication code often compares secrets or reveals account state through work that takes different amounts of time. Constant time comparison reduces that leak, but it works best when paired with a clear threat model and supporting controls such as rate limits.

The useful habit is to treat timing as one more observable output. If a code path handles secrets and its runtime reveals information about them, it deserves the same care as the response body or status code.
