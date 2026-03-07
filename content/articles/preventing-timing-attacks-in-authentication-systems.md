---
title: Understanding Timing Attacks in Authentication Systems
excerpt: How response time differences leak secrets and what makes constant time operations essential for security.
---

Computers are predictable. When comparing two strings, most programming languages check character by character and stop at the first mismatch. This optimization, harmless in normal code, becomes a vulnerability when comparing secrets. An attacker who can measure response times can extract secrets one character at a time. This is the essence of a timing attack.

## Why Timing Attacks Work

The vulnerability stems from a fundamental truth: different code paths take different amounts of time. When you compare a user provided API key against a stored one using `===`, the comparison returns immediately upon finding a mismatch. If the first character is wrong, it takes a few nanoseconds. If the first twenty characters match, it takes longer.

```ts
// This comparison leaks timing information
if (providedKey === storedKey) {
	// grant access
}
```

An attacker exploits this by sending many requests with different guesses and measuring response times. A guess that takes slightly longer means more characters matched. By iterating through each position, they reconstruct the secret character by character.

The math is compelling. Instead of brute forcing a 32 character API key (which would require trying every possible combination), an attacker only needs to guess each position independently. For a key using alphanumeric characters, that reduces the search space from impossible to trivial: at most 62 guesses per position times 32 positions equals roughly 2,000 attempts.

## The Threat Model

Not every system is equally vulnerable. Timing attacks require precision, and several factors affect their practicality.

**Network proximity matters.** An attacker on the same local network or within the same data center can measure microsecond differences reliably. Over the public internet, network jitter adds noise, but statistical analysis across thousands of requests can filter it out. Researchers have demonstrated successful timing attacks across continents.

**Request volume is essential.** Extracting a secret requires many requests. Rate limiting provides some protection, but determined attackers can work slowly over extended periods. A system allowing 100 requests per minute still permits 144,000 requests per day.

**The secret must be valuable.** Timing attacks require effort. Attackers target high value secrets: API keys, session tokens, HMAC signatures, OAuth client secrets. A timing vulnerability in a less critical comparison may not be worth exploiting.

**Server side timing is most exploitable.** The attack measures server processing time. Client side JavaScript comparisons are harder to exploit remotely, though not impossible with techniques like cache timing.

## Where Timing Attacks Apply

The classic example is string comparison, but timing vulnerabilities appear in several authentication contexts.

### Secret Comparison

Any direct comparison of secrets is vulnerable: API keys, bearer tokens, webhook signatures, password reset tokens. The fix is constant time comparison, which we will discuss shortly.

### User Enumeration

Consider a login endpoint that returns the same error message whether the email exists or not. Good practice. But if the code only runs password hashing when the user exists, the timing differs dramatically:

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

Bcrypt intentionally takes around 100 milliseconds. An attacker can distinguish existing users from nonexistent ones purely by measuring response time, enabling targeted phishing or credential stuffing.

### Signature Verification

HMAC verification is particularly sensitive. If you compare signatures byte by byte with early exit, an attacker can forge valid signatures incrementally. For a 32 byte signature, this requires roughly 256 guesses per byte times 32 bytes: about 8,000 requests instead of 2^256 possibilities.

### Multiple Secrets

Systems that support multiple valid secrets (like OAuth clients with rotated credentials) can leak information if they compare sequentially and return on the first match. The timing reveals which secret matched, or that none did.

## The Defense: Constant Time Operations

The solution is to ensure comparisons take the same amount of time regardless of where the strings differ. This is called constant time comparison.

```ts
import { timingSafeEqual } from "node:crypto";

function secureCompare(a: Buffer, b: Buffer): boolean {
	if (a.length !== b.length) {
		timingSafeEqual(a, a); // Still perform work to maintain constant time
		return false;
	}
	return timingSafeEqual(a, b);
}
```

The `timingSafeEqual` function compares every byte, accumulating differences without returning early. The execution time depends only on the length of the inputs, not their contents.

For user enumeration, the fix is to always perform the expensive operation:

```ts
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye...";

async function login(email: string, password: string) {
	let user = await findUserByEmail(email);
	let hashToCompare = user?.hash ?? DUMMY_HASH;
	let valid = await bcrypt.compare(password, hashToCompare);
	return user && valid ? { user } : { error: "Invalid credentials" };
}
```

Both code paths now run bcrypt, taking approximately the same time regardless of whether the user exists.

## Practical vs Theoretical

Security practitioners sometimes debate whether timing attacks are practical threats or academic curiosities. The answer depends on context.

**Clearly practical:**

Local network attacks where nanosecond precision is achievable. HMAC signature forgery against APIs without rate limiting. User enumeration where the timing difference is measured in hundreds of milliseconds.

**Requires effort but demonstrated:**

Cross internet timing attacks using statistical analysis. Cache timing attacks against cryptographic implementations.

**Mostly theoretical:**

Timing attacks requiring sub nanosecond precision. Attacks against systems with aggressive rate limiting and anomaly detection.

The consensus among security researchers is clear: implement constant time operations regardless. The cost is minimal (a few extra CPU cycles), and the protection is meaningful. Why leave the door cracked when closing it is trivial?

## When Timing Does Not Matter

Not every comparison needs to be timing safe. Use constant time operations when:

1. The value being compared is secret
2. An attacker could benefit from learning it incrementally
3. The comparison happens server side where timing is measurable

Regular comparison is fine for public identifiers like usernames or email addresses, for payload contents after signature verification succeeds, and for any non secret data.

## Conclusion

Timing attacks exploit the fundamental property that different code paths take different amounts of time. In authentication systems, this allows attackers to extract secrets incrementally rather than guessing them entirely.

The defenses are well understood: use `timingSafeEqual` for secret comparison, always run expensive operations regardless of user existence, and compare all secrets in parallel rather than returning on the first match.

These patterns add negligible overhead while closing a real attack vector. The question to ask when writing authentication code is simple: could an attacker learn something by timing this operation? If so, make it constant time.
