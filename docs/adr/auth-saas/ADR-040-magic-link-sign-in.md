# ADR-040: Magic Link Sign-In

## Status

**Proposed** - 2026-09-18

## Background

A person types an address, receives a message, and is signed in. There is nothing to remember,
nothing to enrol, and nothing for a phishing page to capture that it could reuse elsewhere, which
makes it the cheapest first credential a tenant can offer. It is a base feature on every tier,
Free included: no add-on gates it, and nothing about it is withheld to sell a higher plan.

It is also the flow with the widest gap between the naive implementation and a safe one. A URL
that signs somebody in is a bearer credential travelling through a channel full of automated
readers — mail scanners that fetch every link, proxies that rewrite them, clients that unfurl
them — each a third party that can reach the credential before the person does.

## Context

### The link is a credential in a hostile channel

Prefetching is the default behaviour of the systems mail passes through, so an implementation
where a `GET` on the link consumes the token is one where the person's own employer's mail filter
reliably burns it before they click.

The token is also a URL, so it reaches the browser's history, the `Referer` of anything the
landing page loads, and any extension with tab access; its lifetime has to be short enough that
none of those holds a usable credential for long.

### Same browser or any browser is the whole design

Requiring the link to open in the browser that asked for it defeats a forwarded link, a scanner
that follows it, and an attacker who persuades somebody to paste one. It also breaks the most
ordinary case there is: a person asks on a laptop and reads mail on a phone.

Relaxing the requirement fixes that case by giving up the property that made the link safe. The
way out is to keep the binding absolute and change what travels, so the secret that crosses
devices is one a person carries back to the bound browser rather than one that authenticates the
device it landed on.

## Decision

A request mints a 256-bit token and an 8-character code, both delivered to the mailbox and both
usable only in the browser that asked. Consumption is a single conditional write inside the tenant
object.

### Token, code and expiry

| | Value | Why |
| --- | --- | --- |
| Link token | `randomToken({ bytes: 32 })` from `@sdxc/crypto` | 256 bits, URL-safe base64url |
| Stored form | `sha256` hex of the token | The object holds nothing replayable |
| Typed code | 8 characters, unambiguous base32, grouped `XXXX-XXXX` | 40 bits, readable aloud |
| Code attempts | 5, then the attempt is destroyed | Five tries against 2^40 values |
| Expiry | 10 minutes | Long enough to switch apps, short enough not to sit in a backup |
| Outstanding | One live attempt per address per tenant | A new request invalidates the old |

A 256-bit random value has no guessable structure, so a fast digest is the right primitive and a
slow KDF would add latency without adding security. Password hashing stays as the repo's existing
decision settles it.

### Single use is one statement

Consumption is:

```sql
UPDATE email_token SET consumed_at = ?1
 WHERE token_hash = ?2 AND consumed_at IS NULL AND expires_at > ?1
```

The completion proceeds only when that statement changed one row. The check and the consume are
one write with no `await` between them, so two requests arriving together cannot both pass — the
failure a `SELECT` then an `UPDATE` would have, since every `await` in a Durable Object is an
interleaving point.

The token is delivered by the mechanism *Transactional Email* owns, as the `sign_in` purpose of
its `email_token` table; this ADR owns what that purpose means.

### The browser binding, and the decision on a different browser

The request that asks for a link sets a `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax`
cookie holding a fresh 256-bit nonce with a ten-minute lifetime. The object stores that nonce's
hash beside the token, and completion requires both.

**A link opened in a different browser does not sign that browser in**, and that is not relaxed
for convenience. What makes it liveable is the code in the same message: the person reading mail
on a phone types `XXXX-XXXX` into the laptop page still open, and the laptop is the bound browser.
The binding never loosens — only the transport of the secret changes.

The link's `GET` consumes nothing. It renders a page whose form holds the token in a hidden field
and a `POST` does the work, so a scanner, a proxy or an unfurler that fetches the URL burns
nothing. That route sends `Referrer-Policy: no-referrer`, and the `POST` redirects, so the token
leaves the address bar.

The destination the person resumes into — the pending authorization request, its client and its
redirect target — lives on the server against the attempt, so no part of the flow can be steered
by editing the URL.

### Rate limiting, and an address with no subject

Per address per tenant: a burst limit of 3 requests per 15 minutes, spent inside the object in
the same method that mints, nested under the 5-per-hour envelope *Transactional Email* sets across
every credential kind. Per connecting address: 10 per hour on the Worker route through
`@sdxc/rate-limit` keyed on `@sdxc/get-client-ip`, which stops one client spraying many addresses.

Every response on this path — the page, the status, the timing band, the budget spent — is
identical whether or not the address belongs to a subject, because anything that differs turns the
form into a membership query against the tenant's user list. What differs is only what lands in
the mailbox: an address with no subject gets a `no_account` message telling its real owner that a
sign-in was attempted and no account exists, which is what makes the uniform answer honest rather
than a fiction.

Whether an unknown address may become a subject is the tenant's setting, off by default. When it
is on, the subject is created at successful completion rather than at request, so a mailbox that
never completes leaves nothing behind.

Completing a magic link satisfies the first factor only: a subject with a second factor enrolled
still answers the challenge owned by *TOTP Second Factor and Recovery Codes*.

### Tenant object RPC

- `beginMagicLinkSignIn({ address, locale, browserNonceHash, at })` — resolves the address, checks
  suppression, spends the budget, invalidates any outstanding attempt, mints the token and code
  and stores their hashes against the nonce hash. Returns
  `{ message: "sign_in", token, code, expiresAt }`, `{ message: "no_account" }`, or
  `{ message: "none", retryAfterSeconds }`. The Worker sends whichever message it names and
  renders one page for all three.
- `completeMagicLinkSignIn({ credential, browserNonce, at, userAgentHash })` — `credential` is
  `{ kind: "link", token }` or `{ kind: "code", code }`. Verifies the binding, consumes the
  attempt in the one statement above, creates the subject when the tenant allows it, opens the
  session, and returns `{ outcome: "signed_in", subject, session, secondFactorRequired }`,
  `{ outcome: "invalid" }`, `{ outcome: "wrong_browser" }`, or
  `{ outcome: "bad_code", attemptsLeft }`.
- `cancelMagicLinkAttempt({ browserNonce, at })` — abandons the outstanding attempt when a person
  starts over.

`session` is the verified session claim *Sessions* returns, not a cookie value; the Worker writes
the cookie. `invalid` covers expired, already consumed and never existed alike, because
distinguishing them tells a caller something only an attacker wants.

### Email only

There is no SMS equivalent here and there will not be one. The verified mailbox is already the
ownership credential an account is anchored to, so a link delivered there proves exactly what the
account claims. Sending the same secret to a phone number adds the carrier, SIM swap and SS7 to
the attack surface of that strongest claim, and a per-message cost to a feature every tier gets
free, for no security the mailbox does not already provide. Passkeys and TOTP cover the cases
wanting a factor that is not the mailbox.

## Consequences

### Positive

- A mail scanner, a link rewriter and an unfurler can all fetch the URL without burning the
  attempt, because nothing is consumed by a `GET`.
- The cross-device case works without weakening the binding, since the code is completed in the
  bound browser rather than authenticating a new one.
- Every answer is identical for a known and an unknown address, and the real mailbox owner still
  learns that someone tried.
- Single use survives concurrency by construction rather than by a lock, in one statement, and a
  tenant on Free gets the same flow and the same binding as one on Premium.

### Negative

- A person who asks on one device and cannot return to it has to start over, which is worse than a
  link that works anywhere.
- The code is a second secret to render, explain and type, in a longer message.
- Mailbox compromise is full account compromise here, mitigated only by a factor the subject
  chose to enrol.
- Delivery latency is sign-in latency, so a slow provider minute reads as a broken product.

### Neutral

- A tenant may leave just-in-time subject creation off, in which case this is a sign-in path only
  and registration stays its own flow.

## Alternatives Considered

**A link that works in any browser.** The lowest-friction version, and what most people mean by a
magic link. It signs in whoever holds the URL, which is any forwarding recipient, any scanner
that follows links, and anyone who talks a person into pasting one. Rejected: the binding is the
property that makes an emailed URL safe to treat as a credential.

**A code only, with no link.** One mechanism, no prefetch problem, no URL in history. It also
makes the common same-device case a transcription task rather than a click. Rejected; the link is
kept and the code is the fallback.

**Consuming the token on `GET`.** One request, no interstitial, the shortest possible flow. Every
automated reader between the sender and the person then burns the attempt, and the failure looks
to the customer like a product that does not work. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — places this in M3 and states the no-phone rule
- [ADR-016: Hosted Sign-In UI and Branding](./ADR-016-hosted-sign-in-ui-and-branding.md) — the screens this flow is entered and completed on
- [ADR-017: Transactional Email](./ADR-017-transactional-email.md) — the token table, delivery and the per-recipient envelope
