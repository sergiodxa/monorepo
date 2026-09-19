# ADR-017: Transactional Email

## Status

**Proposed** - 2026-09-18

## Background

Every message the platform sends is part of an authentication decision: a verification that turns
a typed string into a proven mailbox, a password reset that hands back an account, a magic link
that is itself a sign-in, and a security notice that a credential changed. A message that does not
arrive is a person locked out; one from the wrong sender trains a person to trust a phishing page.

`@sdxc/mail` already settles the mechanics: a `Mailer` normalizes a message and hands it to a
`Transport`, delivery is a `Result` rather than an exception, bodies are `remix/ui` trees rendered
through an unbranded layout kit with a derived plain-text part, and its middleware publishes a
request-scoped mailer on `context.email`. What it leaves open is who the mail comes from, what
happens when it bounces, and how often one mailbox may be written to.

## Context

### The sender is a tenant, not the platform

A verification message for a tenant's end user is the tenant's message, and it has to say so in
the `From` header: an end user has no relationship with this platform, and a message from a name
they do not recognize is one they report as spam, which costs the shared sending reputation every
other tenant depends on.

Saying so credibly is DNS work. DMARC passes when the `From` domain aligns with a DKIM signature
or an SPF-authorized return path, so a tenant sending as `acme.com` needs records under a domain
it controls — a provisioning flow with a verification state, not a text field. The Workers email
binding sends only to addresses verified on the account's own routing and offers no per-tenant
signing identity, so delivery goes through an email service provider whose API creates sending
domains and reports their state.

### One mailbox is a shared resource

Every message here is triggered by an unauthenticated request naming an address. Left alone that
is a mail bomb aimed at anyone whose address an attacker knows, and it burns the sending
reputation on the way. The cap has to sit where the decision to send is made and hold across every
feature, because per-feature limits compose into the total they were meant to prevent.

## Decision

Mail is sent through `@sdxc/mail` over an ESP transport, from a per-tenant verified sending
domain, with the per-recipient budget enforced inside the tenant object alongside the token it
mints.

### The messages

| Kind | Trigger | Carries |
| --- | --- | --- |
| `verify_address` | Sign-up, and a change of address | A single-use link and its code |
| `reset_password` | The reset request form | A single-use link |
| `sign_in` | A magic link request | A single-use link and its code |
| `no_account` | A request for an address with no subject | No credential; prose only |
| `security_notice` | Password, passkey, factor or address changed | No credential; prose only |

`no_account` keeps the HTTP response for an unknown address identical to a known one's.

### Transport and sender identity

A `Transport` for the ESP ships from `@sdxc/mail` as its own subpath, keeping the provider
dependency out of a bundle that does not send. Each tenant registers a sending domain and the
control plane stores what the provider's API gives back:

```sql
tenant_mail_domain(tenant_id PK, domain, provider_domain_id, from_local_part, from_name,
                   reply_to, dns_records_json, status, verified_at, last_checked_at)
tenant_email_template(tenant_id, kind, locale, subject, markdown_body, updated_at,
                      PRIMARY KEY(tenant_id, kind, locale))
```

`dns_records_json` is the set the dashboard shows the tenant to publish: a DKIM key, an
SPF-authorized return path on the sending subdomain, and the DMARC policy for its organizational
domain. A scheduled job re-reads verification state until the provider reports the domain
verified, and the `From` domain aligns with the DKIM signature, since alignment is what DMARC
evaluates. Until then mail goes from the platform's own verified domain with the tenant's display
name and `reply_to`, so a Free tenant that never configures DNS still sends.

### Template customization is Markdown, on Pro and above

Every message ships with a platform-authored body per locale, rendered through `Email.Layout` and
painted from the brand record: `logo`, `background`, `surface`, `color` and `fontFamily` come from
the same `tenant_brand` row the hosted screens read, so one brand styles the pages and the mail.

A Pro or Premium tenant overrides the subject and body per kind per locale. The body is Markdown
rendered by `@sdxc/mail/markdown` into that same card, and Markdown is the whole customization
language: raw HTML arrives as escaped text, so a tenant-authored body cannot inject markup into a
message the platform signs. Interpolation is a fixed placeholder set per kind — `{{url}}`,
`{{code}}`, `{{tenant}}`, `{{email}}`, `{{expires}}` — substituted before parsing and checked on
save, so an unknown placeholder or a missing credential placeholder is a save-time error. An
override is stored on every tier and rendered where *Entitlements as Feature Flags* grants it.

### Rate limiting is per recipient

| Layer | Budget | Where |
| --- | --- | --- |
| Per address per tenant, all credential kinds | 5 per hour, 15 per day | The tenant object |
| Per connecting address per tenant | 10 per hour | The Worker route |
| `security_notice`, per subject per kind | 1 per hour | The object, counted apart |

The envelope is spent inside the same object method that mints the token, because the check and
the issuance are one read-modify-write with no `await` between them; it uses `@sdxc/rate-limit`'s
`DataTableAdapter` over the object's own SqlStorage, exact at one write. Security notices count
apart, since suppressing "your password was changed" is the one omission that helps an attacker.
The Worker layer is that package's middleware keyed on `@sdxc/get-client-ip`.

### Bounces, complaints, and a failed send

The provider posts delivery events to a platform route, verified with `@sdxc/webhooks`. Each
message carries a tag naming the tenant and the kind and nothing else, so an event resolves to a
tenant without the provider holding a subject id, and becomes one object call. A hard bounce
suppresses the address for that tenant until it verifies again; a complaint suppresses everything
except `security_notice`, since marking a reset mail as spam is not agreement to stop being told a
password changed; soft bounces suppress after five in a day. Suppression is per tenant.

A sign-up uses `send()` rather than `later()`, because the screen has to say something true. The
subject is created either way and a failed send does not roll it back: losing an account because a
provider had a bad minute is worse than an unverified account that can be verified later. The
screen renders "check your email" with an explicit "we could not send it" and a resend control
that spends the same envelope. A hard bounce later turns that into "this address cannot receive
mail", which leaks nothing, since the person typed the address.

### Tenant object RPC

- `issueEmailToken({ address, kind, locale, at })` — checks suppression, spends the envelope,
  invalidates any outstanding token for that address and kind, and mints a new one into the
  object's `email_token(token_hash PK, address, kind, expires_at, consumed_at, created_at)`.
  Returns `{ message: "verify_address" | "reset_password" | "sign_in", token, code, expiresAt }`,
  `{ message: "no_account" }`, or `{ message: "none", retryAfterSeconds }`. The Worker renders and
  sends whichever message the object named.
- `recordDeliveryOutcome({ address, kind, outcome, providerMessageId, at })` — records the event,
  returning `{ suppressed: boolean }`.
- `clearSuppression({ address, actor, at })` — an administrator lifting a suppression.

The token is the one bearer value that crosses the boundary, because its purpose is to be carried
to a mailbox; `token_hash` is a SHA-256 digest, so the object holds nothing replayable.
Security notices need no method: the operations owned by *Password Credentials*, *Passkeys* and
*TOTP Second Factor and Recovery Codes* return an optional `notice: { kind, address, locale }`, so
the judgement that a change is notable stays where the change happened.

### Cost

At the rate card's `emailSent` rate of $0.35 per 1,000 messages and the series' assumption of 0.2
messages per DAU-month, a Pro tenant at its 2,500 DAU cap sends about 500 messages for roughly
$0.18 a month and a Premium tenant at 10,000 DAU about 2,000 for $0.70, with Free well under a
cent. Every tier absorbs it: mail is not metered, not an add-on and not capped by tier. Several
times that price would not change the arithmetic — infrastructure cost is immaterial against these
prices, so metering exists for lifetime-value and cost-of-goods visibility and for spotting abuse
rather than margin.

## Consequences

### Positive

- An end user sees a message from a name they recognize, signed under a domain the tenant owns.
- No combination of features can write to one mailbox faster than the envelope allows.
- Customization ships no templating language: Markdown's escaping makes a body safe to sign.
- One brand record paints the screens and the mail, and an outage during sign-up costs a resend
  rather than an account.

### Negative

- Sender verification is DNS work a customer has to do, and mail sent before it lands misaligns,
  on a platform domain that carries every unverified tenant's reputation.
- A token crosses the Worker-object boundary, a deliberate exception to ADR-001's rule.
- Suppression can lock a person out of recovery on a mailbox that bounced once.

### Neutral

- Delivery depends on a third party, and the transport is the one site where that choice lives.
- Per-locale overrides are the tenant's to translate, over bodies shipped in the screens' locales.

## Alternatives Considered

**One platform sending domain for every tenant.** No provisioning flow, no verification state, no
DNS instructions. It also means every end user sees mail from a name they have no relationship
with, and one tenant's complaints degrade delivery for all. Rejected as the destination, kept as
the pre-verification fallback.

**A templating language for message bodies.** Liquid or Handlebars with conditionals and filters,
which customers migrating from an incumbent expect. It is a language to parse, sandbox and version
inside a document the platform signs. Rejected for Markdown and a checked placeholder set.

**Rate limiting per route in the Worker alone.** Simpler, no object round trip, reuses mounted
middleware. It counts requests rather than messages, so generous per-feature limits compose into a
mail bomb. Rejected as the envelope; kept as the spraying defence.

**Queueing every send and retrying.** Better delivery under a flaky provider, and the sign-up
screen never mentions a failure. It also makes arrival time unbounded at the moment a person is
watching an inbox. Rejected: a failure here is better reported than deferred.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-016: Hosted Sign-In UI and Branding](./ADR-016-hosted-sign-in-ui-and-branding.md) — the brand record these messages are painted from
- [ADR-040: Magic Link Sign-In](./ADR-040-magic-link-sign-in.md) — the `sign_in` kind's semantics
- [root ADR-018: Mail Package With Pluggable Transports](../ADR-018-mail-package-with-pluggable-transports.md) — the mailer, transport contract and layout kit this builds on
