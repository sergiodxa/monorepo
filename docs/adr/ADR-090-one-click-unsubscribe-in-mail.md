# ADR-090: One-Click Unsubscribe in Mail

## Status

**Accepted** - 2026-09-24

## Background

Since February 2024 Gmail and Yahoo require bulk senders to offer one-click unsubscribe on
subscribed and marketing mail: a `List-Unsubscribe` header ([RFC 2369](https://www.rfc-editor.org/rfc/rfc2369))
carrying an HTTPS URL, a `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header
([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058)), both covered by a DKIM signature, and an
unsubscribe honored within two days. A mailbox provider that sees these shows its own
"Unsubscribe" button next to the sender, and a recipient who uses it stops receiving mail instead
of pressing "Report spam", which is what decides a sending domain's reputation.

`@sdxc/mail` ([ADR-018](./ADR-018-mail-package-with-pluggable-transports.md),
[ADR-030](./ADR-030-email-classes-as-the-authoring-contract.md)) knows nothing about any of this.
uptime writes the headers by hand in two places, one of them correctly and one not, and the
receiving endpoint that RFC 8058 needs exists for only one of the two. The header syntax, the
HTTPS requirement, the POST body and the no-cookies rule are the same for every app that sends
optional mail, so they belong in the mail package.

## Context

### Current state

| Location                                                 | What it does                                                                                              | Problem                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/uptime/app/emails/shared/trial.tsx`                | `trialUnsubscribeHeaders(token)` returns both RFC 8058 headers for the five trial emails                  | Correct; hand-written, returned from each email's `headers` getter                          |
| `apps/uptime/app/http/controllers/trial/unsubscribe.tsx` | `GET` renders a confirmation, `POST` deletes the lead, keyed by the stored `leads.unsubscribe_token`      | Correct; cannot tell the provider's one-click POST from a person's form POST                |
| `apps/uptime/app/emails/shared/team-digest.tsx`          | `teamDigestUnsubscribeHeaders(url)` sets only `List-Unsubscribe`, pointing at the signed-in settings page | Not one-click: the target needs a session, which RFC 8058 forbids, so Gmail shows no button |
| `apps/uptime/app/emails/funnel-report.tsx`               | Operator-only report, no unsubscribe                                                                      | Correct: it goes to the deployment's own operator                                           |
| `apps/reader/app/push/copy.tsx`                          | `NotificationEmail`, the opt-in email channel for new-item notifications                                  | No unsubscribe header at all, though the reader chose to receive it and can choose to stop  |
| `apps/auth-saas/app/mail/*`, `apps/r3-auth/app/emails/*` | Verification, reset, magic-link, sign-in alerts, invitations                                              | Transactional; exempt from the bulk-sender rules, and an unsubscribe would be wrong on them |

`uptime/wrangler.jsonc` documents that the trial emails' two headers are the only custom headers
sent through the `send_email` binding.

### What the RFCs and mailbox providers ask

| Rule                                                                                                                   | Consequence for the package                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `List-Unsubscribe` is a comma-separated list of `<URI>`s, most preferred first (RFC 2369)                              | the header is generated from structured options, HTTPS first, then `mailto:`          |
| One-click needs exactly one HTTPS URI and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058 §3.1)          | the URL option must be `https:`; the POST header is written only alongside it         |
| The POST carries `List-Unsubscribe=One-Click` as a form body, no cookies, no auth (§3.2)                               | a helper recognizes the body; the endpoint is authorized by the URL alone             |
| The URL must identify the recipient and list without further interaction; it is sent by a machine, possibly much later | a signed token in the path, with no expiry by default                                 |
| Both headers must be covered by a valid DKIM signature (§3.3)                                                          | the transport, or the platform behind it, must sign them; see below                   |
| Gmail/Yahoo: honor within 2 days; transactional mail is exempt                                                         | the option lives per message, and transactional emails simply leave it unset          |
| `List-Id` names the list a message belongs to (RFC 2919)                                                               | an optional `list` option writes it, so filters and feedback loops can group the mail |

### DKIM and the Cloudflare transport

`CloudflareTransport` hands a `headers` record to the `send_email` binding, which composes the
message and signs it for the verified sending domain. The package controls which headers exist,
not which ones the platform's DKIM signature covers; the binding exposes no option for the
signed-header list. Whether `List-Unsubscribe` and `List-Unsubscribe-Post` are in the `h=` tag is
therefore a property of Cloudflare's signer, to be checked on a delivered message (Phase 3), not
something this package can enforce.

## Decision

Add one-click unsubscribe to `@sdxc/mail`: an `unsubscribe` option on `Message` and on the `Email`
contract, from which the mailer writes both headers, an optional `list` option for `List-Id`, and a
`@sdxc/mail/unsubscribe` subpath with the token and request helpers the receiving endpoint needs.

### Package name

This lands in the existing `@sdxc/mail`, as the `unsubscribe` and `list` message options and the
`@sdxc/mail/unsubscribe` subpath.

| Option                                               | Trade-off                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **`@sdxc/mail`, `unsubscribe` option** (recommended) | The mailer validates and writes the headers during normalization, so every transport, the memory one included, sees them |
| A separate `@sdxc/list-unsubscribe` package          | About 150 lines; the mailer still needs to know the option to reject a message that also sets the header by hand         |
| App-level headers, as today                          | No validation of the HTTPS rule, and the second copy in uptime already drifted into a non-compliant header               |

The mailer wins because the headers are a property of the message, the conflict with hand-written
headers is only detectable where headers are merged, and the receiving helpers are small enough
that a subpath keeps them out of apps that send no optional mail.

### Scope

The package includes:

- `Message.unsubscribe`, `Message.list`, and the same members on the `Email` contract
- Generation of `List-Unsubscribe`, `List-Unsubscribe-Post` and `List-Id` during normalization,
  with validation failures as `MailError`
- `@sdxc/mail/unsubscribe`: signing and verifying an unsubscribe token with `@sdxc/crypto`'s
  `hmac`, and recognizing an RFC 8058 one-click request body

What stays out, and where it lives:

- What unsubscribing means (deleting a lead, adding to `unsubscribed_emails`, disabling a channel)
  lives in each app's controller
- The confirmation page a person sees lives in each app, rendered with `remix/ui`
- DKIM signing lives in the transport's platform (the `send_email` binding for Cloudflare)
- `Feedback-ID` and other provider-specific headers stay in `Message.headers`

### Exports

#### `"."` — message options

```ts
export interface Unsubscribe {
	/** The one-click endpoint; must be `https:`. Receives the RFC 8058 POST and serves a GET confirmation. */
	url: string | URL;
	/** An address, or a full `mailto:` URI, written after the URL for clients that only mail. */
	mailto?: string;
	/** Writes `List-Unsubscribe-Post`. Set `false` only for a URL that cannot accept the POST. */
	oneClick?: boolean; // default true
}

export interface MailingList {
	/** RFC 2919 list-id: dot-separated labels in a domain the sender controls, e.g. `digest.uptime.example.com`. */
	id: string;
	/** A description shown before the id: `List-Id: Daily digest <digest.uptime.example.com>`. */
	name?: string;
}

export interface Message {
	// ...existing members
	unsubscribe?: Unsubscribe;
	list?: MailingList;
}

export interface Email {
	// ...existing members
	readonly unsubscribe?: Unsubscribe;
	readonly list?: MailingList;
}

export interface NormalizedMessage {
	// ...existing members; `headers` now includes the generated ones
	unsubscribe: Unsubscribe | null;
	list: MailingList | null;
}
```

`#normalize` writes, for `unsubscribe: { url, mailto }`:

```text
List-Unsubscribe: <https://uptime.example.com/unsubscribe/abc>, <mailto:unsubscribe@example.com?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

`validate` fails the send with a `MailError` when the URL is not `https:`, when `mailto` is not an
address, when the `list.id` is not a valid list-id, or when `headers` (from the mailer, the message
or the email, compared case-insensitively) already contains `List-Unsubscribe`,
`List-Unsubscribe-Post` or `List-Id` alongside the matching option. That last rule makes a
half-migrated email fail loudly instead of sending two different unsubscribe URLs. A plain
`mailto` becomes `mailto:<address>?subject=unsubscribe`, and a full `mailto:` URI is written as
given. `SendOptions` stays `Partial<Message>`, so a single send can override either option.

#### `"./unsubscribe"` — the receiving side

```ts
import type { Result } from "@sdxc/result";

export namespace UnsubscribeToken {
	interface Claims {
		/** Who is unsubscribing: an opaque id, never an email address, since the token lands in URLs and logs. */
		subject: string;
		/** What they are unsubscribing from, matching the app's own list or email-kind name. */
		list: string;
		issuedAt: Date;
	}

	interface SignOptions {
		/** When the link stops working; omitted means never, since providers may POST long after delivery. */
		expiresIn?: DurationInput;
	}
}

/** A base64url token carrying the claims and an HMAC-SHA-256 over them. */
export function signUnsubscribeToken(
	secret: string,
	claims: { subject: string; list: string },
	options?: UnsubscribeToken.SignOptions,
): Promise<Result<string, MailError>>;

export function verifyUnsubscribeToken(
	secret: string,
	token: string,
): Promise<Result<UnsubscribeToken.Claims, InvalidUnsubscribeTokenError>>;

/** Malformed, tampered, or expired; the endpoint answers every case the same way. */
export class InvalidUnsubscribeTokenError extends Error {}

/** Whether a parsed form body is RFC 8058's `List-Unsubscribe=One-Click`. */
export function isOneClickUnsubscribe(form: FormData): boolean;
```

The token is signed, not encrypted: it carries ids the recipient already knows, and signing keeps
it short enough for a header line. Verification compares with `timingSafeEqual` through `hmac.verify`.
An app with its own stored random token, such as uptime's `leads.unsubscribe_token`, keeps it and
skips these two functions; `isOneClickUnsubscribe` is the only helper such an endpoint needs.

### Usage

A digest email declares its list and its link:

```ts
import type { Email as EmailContract, MailingList, Unsubscribe } from "@sdxc/mail";

export class TeamDailyDigestEmail implements EmailContract {
	get unsubscribe(): Unsubscribe {
		return { url: this.#digest.unsubscribeUrl };
	}

	get list(): MailingList {
		return { id: "team-daily-digest.uptime.sergiodxa.com", name: "Daily digest" };
	}
}
```

The job that builds the digest signs the link, with no email address in it:

```ts
import { signUnsubscribeToken } from "@sdxc/mail/unsubscribe";

let token = await signUnsubscribeToken(env.UNSUBSCRIBE_SECRET, {
	subject: member.id,
	list: "teamDailyDigest",
});
if (isFailure(token)) return ctx.log.warn("digest.unsubscribe_token_failed");
let unsubscribeUrl = `${APP_ORIGIN}${routes.digestUnsubscribe.href({ token: token.data })}`;
```

The endpoint is a `form()` route outside the auth guard, the pattern the trial endpoint already
uses: `GET` renders a confirmation (link scanners follow every URL, so a `GET` changes nothing), and
`POST` acts, whether a person pressed the button or the mailbox provider sent the one-click request:

```ts
import { isOneClickUnsubscribe, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";

async action(ctx) {
	let { token } = s.parse(ParamsSchema, ctx.params);
	let claims = await verifyUnsubscribeToken(env.UNSUBSCRIBE_SECRET, token);
	if (isSuccess(claims)) await UserPreferences.unsubscribe(ctx.db, claims.data.subject, claims.data.list);

	/** The provider ignores the body, so a machine gets an empty 200 and a person gets the page. */
	if (isOneClickUnsubscribe(ctx.formData)) return new Response(null, { status: 200 });
	return renderDonePage(ctx);
},
```

The provider's POST arrives from its own servers with no `Origin` or `Sec-Fetch-Site`, which
`remix/cop-middleware` admits; the route needs no session, so it sits beside `trial.unsubscribe` in
`bootstrap/app.tsx`.

## Consequences

### Positive

- **Compliant headers by construction** - an HTTP URL, a missing POST header, or a stray duplicate
  is a `MailError` at send time, not a silent deliverability loss
- **Team digests get a real one-click button** - moving them from the signed-in settings page to a
  signed token endpoint is what makes Gmail show it
- **The receiving endpoint can tell a machine from a person** - the trial endpoint stops rendering a
  full page for a request nobody reads
- **No PII in unsubscribe URLs** - tokens carry opaque ids, and the helper documents why
- **Tests see the headers** - `MemoryTransport` receives the normalized message, so an email test
  asserts on `unsubscribe` directly

### Negative

- **DKIM coverage is outside the package's control** - if Cloudflare's signer leaves the headers out,
  every message fails RFC 8058 §3.3 and Gmail ignores the button, and the fix is not in this repo
- **A new secret per app** - signed tokens need `UNSUBSCRIBE_SECRET` in each adopting app's
  secrets and `.env.example`, and rotating it breaks every link already delivered
- **The `Email` contract grows** - two more optional members on an interface every email class
  implements, though existing classes compile unchanged

### Neutral

- **Transactional mail is unaffected** - auth-saas and r3-auth emails leave both options unset
- **Hand-written headers still work** - until an email sets both, the new validation never fires

## Implementation Plan

### Phase 1: Add the options and helpers to `@sdxc/mail`

**Priority:** High
**Estimated Effort:** 4 hours

1. Write tests first: header generation with and without `mailto`, `oneClick: false`, an `http:`
   URL refused, a list-id refused, each duplicate-header conflict, token round-trip, tampering,
   expiry, and `isOneClickUnsubscribe` on URL-encoded and multipart bodies
2. Add the members to `Message`, `Email`, `NormalizedMessage`; generate and validate in `mailer.ts`
3. Add `src/unsubscribe.ts` and the `./unsubscribe` export
4. Update the package README with a "Bulk mail" section covering the Gmail/Yahoo rules

### Phase 2: Adopt in uptime

**Priority:** High
**Estimated Effort:** 4 hours

| Call site                                                                             | Change                                                                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `app/emails/shared/trial.tsx`                                                         | delete `trialUnsubscribeHeaders`; keep `trialUnsubscribeUrl`                              |
| `app/emails/trial-{confirmation,change,daily-digest,weekly-digest,repeat-report}.tsx` | replace the `headers` getter with `unsubscribe` and `list`                                |
| `app/http/controllers/trial/unsubscribe.tsx`                                          | answer a one-click POST with an empty `200`                                               |
| `app/emails/shared/team-digest.tsx`                                                   | delete `teamDigestUnsubscribeHeaders`                                                     |
| `app/emails/team-{daily,weekly}-digest.tsx`                                           | `unsubscribe` pointing at a new signed-token route; the settings link stays in the footer |
| `routes/web.ts`, `bootstrap/app.tsx`, a new controller                                | `digestUnsubscribe: form("/unsubscribe/digest/:token")`, adding to `unsubscribed_emails`  |
| `wrangler.jsonc`, `.env.example`                                                      | `UNSUBSCRIBE_SECRET`; update the custom-header comment                                    |

### Phase 3: Verify delivery

**Priority:** High
**Estimated Effort:** 1 hour

1. Send a trial email and a digest to a Gmail and a Yahoo inbox from production
2. In "Show original", confirm `dkim=pass` for the sending domain and that the signature's `h=`
   tag lists `list-unsubscribe` and `list-unsubscribe-post`
3. Confirm the provider's own "Unsubscribe" button appears and that pressing it reaches the POST
4. If the headers are unsigned, record it in this ADR and raise it with Cloudflare before rollout
   to the reader app

### Phase 4: Adopt in reader

**Priority:** Medium
**Estimated Effort:** 2 hours

1. `NotificationEmail` gains `unsubscribe` with a signed token for the reader's email channel, and
   the reader's user object gains the endpoint that turns the channel off

## Alternatives Considered

### 1. A separate `@sdxc/list-unsubscribe` package

**Rejected because**: the header builder is a few lines, and the checks that matter (HTTPS, a
conflicting hand-written header) need the mailer's merged headers. The receiving helpers alone
would be a package with two functions.

### 2. Keep headers in the apps

**Rejected because**: uptime's two copies already disagree, and one of them produces a header no
mailbox provider will act on. Every app sending optional mail would write a third.

### 3. Store a random token per recipient everywhere

**Rejected because**: it needs a table and a write per recipient per list. It fits uptime's leads,
who have no account and already have a row, and the package leaves that path open; for members
with an id, a signed token needs no storage.

## References

- [RFC 2369 - The Use of URLs as Meta-Syntax for Core Mail List Commands](https://www.rfc-editor.org/rfc/rfc2369)
- [RFC 8058 - Signaling One-Click Functionality for List Email Headers](https://www.rfc-editor.org/rfc/rfc8058)
- [RFC 2919 - List-Id](https://www.rfc-editor.org/rfc/rfc2919)
- [RFC 6376 - DomainKeys Identified Mail (DKIM) Signatures](https://www.rfc-editor.org/rfc/rfc6376)
- [Google: Email sender guidelines](https://support.google.com/a/answer/81126)
- [Yahoo: Sender best practices](https://senders.yahooinc.com/best-practices/)
- [ADR-018: Mail Package with Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-030: Email Classes as the Authoring Contract](./ADR-030-email-classes-as-the-authoring-contract.md)
- [ADR-023: Web Crypto Primitives Package](./ADR-023-web-crypto-primitives-package.md)
## Current Progress

- [x] Phase 1: `unsubscribe` and `list` options, header generation and validation, and the
      `@sdxc/mail/unsubscribe` subpath in `@sdxc/mail`
- [x] Phase 2: Adopt in uptime
- [ ] Phase 3: Verify delivery (DKIM `h=` coverage on Gmail and Yahoo) — procedure ready:
      `bun scripts/verify-dkim-headers.ts <message.eml>`; Cloudflare's docs say
      `List-Unsubscribe` is always signed and are silent on `List-Unsubscribe-Post`
- [x] Phase 4: Adopt in reader

## Notes

- Implementation: `SignOptions` takes `expiresAt?: Date` in place of `expiresIn?: DurationInput`.
  `@sdxc/duration` is not a dependency of `@sdxc/mail`, and an absolute instant is unambiguous;
  adding the dependency later can bring `expiresIn` alongside it
- Implementation: the token is the hex HMAC-SHA-256 (64 characters) followed by the base64url
  payload `list:subject`, then the issue time and optional expiry in Unix seconds on their own
  lines. The MAC covers a purpose prefix plus the payload; `purpose` is an option on both
  functions (default `unsubscribe:v1:`) so a secret shared with sessions cannot mint these
  tokens. This is the scheme uptime's app-local digest unsubscribe already uses, so its
  delivered links verify with `purpose: "digest-unsubscribe:v1:"` once it adopts the package
- Implementation: `Claims.issuedAt` is `Date | null`; a payload with only `list:subject` (the
  shape uptime signs today) verifies with `null`
- Implementation: `signUnsubscribeToken` refuses a subject that parses as an email address, an
  empty field, a list containing `:`, and control characters in either field
- Implementation: `InvalidUnsubscribeTokenError` lives beside `MailError` and is exported from
  `@sdxc/mail/unsubscribe`; the `UnsubscribeToken` namespace also exports `Options`
- Implementation: a `List-Id` without a name is written `<id>`; a name with specials is quoted
  like a display name, and a name with control characters fails the send
- The Gmail and Yahoo bulk-sender threshold (about 5,000 messages a day to their users) applies to
  the sending domain as a whole; the headers earn the provider's button, and the lower spam-report
  rate that follows, at any volume
- DKIM coverage, from Cloudflare's docs (checked 2026-09-26): the
  [Email headers reference](https://developers.cloudflare.com/email-service/reference/headers/)
  lists `List-Unsubscribe`, `List-Unsubscribe-Post` and `List-Id` as allowlisted, validates
  them (HTTPS or `mailto:` URIs only; the POST header must be exactly
  `List-Unsubscribe=One-Click` and needs an HTTPS `List-Unsubscribe`), and says of
  `List-Unsubscribe` alone that it is "Always DKIM-signed per RFC 8058". Nothing documents
  the `h=` list or states that `List-Unsubscribe-Post` is signed. The one published `h=`
  list, an Email Routing ARC example in the
  [subdomains post](https://blog.cloudflare.com/email-routing-subdomains/), covers the
  RFC 2369 `List-*` headers without `list-unsubscribe-post`, but that is forwarding, not
  sending. Sent mail is signed with selector `cf-bounce` and `d=` the sending domain
  ([domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/)).
  Confidence that both headers are signed: likely, not confirmed; a delivered message settles it
- `Feedback-ID` is platform-controlled on Email Service: the platform writes its own, and a
  `headers` entry for it fails the send with `E_HEADER_NOT_ALLOWED`, so it cannot stay in
  `Message.headers` as Scope says. The same applies to any non-allowlisted header that does
  not start with `X-`, and at most 20 allowlisted non-`X-` headers go on one message
- Phase 3 procedure: `apps/uptime` trial emails already carry both headers (hand-written until
  Phase 2 lands). Run a check at `https://uptime.sergiodxa.com/try`, submit a Gmail (and a
  Yahoo) address, open the confirmation email, "Show original" then "Download original", and
  run `bun scripts/verify-dkim-headers.ts ~/Downloads/<file>.eml`. It prints each
  signature's `d=`, `s=` and `h=`, says whether `list-unsubscribe` and
  `list-unsubscribe-post` are covered by a signature aligned with the From domain (and flags
  over-signing), echoes `Authentication-Results` so `dkim=pass` can be read off, and exits 0
  on PASS, 1 on FAIL. This uses production as a visitor would, creating one lead that the
  email's own unsubscribe link removes; a local `vite dev` sends for real too, since the
  `send_email` binding is `remote: true`, but needs the same trial flow and gains nothing
- Uptime: digest tokens stay signed with `COOKIE_SESSION_SECRET` under
  `purpose: "digest-unsubscribe:v1:"` instead of a new `UNSUBSCRIBE_SECRET`, so every delivered
  link keeps verifying and no secret has to be provisioned; the route stays
  `/digests/unsubscribe/:token`. Lists carry ids only (`trial.`, `team-daily-digest.` and
  `team-weekly-digest.` under the app's host); a translated `name` would need per-recipient copy
- Reader adoption: tokens are signed with `COOKIE_SESSION_SECRET` under the purpose
  `reader-notifications-unsubscribe:v1:` and the list `notifications`, for the reader's OIDC
  subject, as uptime does, so no secret has to be provisioned. A deployment with the key unset
  sends the email without the headers and refuses every token. The endpoint is
  `/notifications/unsubscribe/:token`; the `List-Id` is `notifications.<APP_URL host>`, named
  in the reader's locale
