# ADR-018: Mail Package With Pluggable Transports

## Status

**Accepted** - 2026-07-29

## Background

Transactional email is currently sent by talking to the Resend SDK directly from application services. Every send path re-decides the sender identity, the rendering strategy, and the failure policy, and each one mocks the third-party SDK in its tests.

The platform target is also changing: email should eventually be sent through Cloudflare's email sending service. That makes two separate changes, adopting a package and changing providers, and they should not have to happen at the same time. A package that ships a Resend transport can be adopted today with no infrastructure work, and the provider switch then becomes one line per app.

## Context

### Current State

| Location                                            | What it does                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/r3-uptime/app/services/invite-email.tsx`      | Renders a `remix/ui` email with `renderToString`, hardcodes sender and reply-to, fire-and-forget send |
| `apps/r3-uptime/app/services/alerts.ts`             | Sends alert email through Resend beside Slack, Discord, and webhook delivery                          |
| `apps/r3-uptime/app/lib/container.ts`               | Registers the Resend client as a container service                                                    |
| `apps/uptime/app/components/emails/team-invite.tsx` | The same invite email again, written as React components                                              |
| Controller and job tests                            | Mock the Resend SDK module per call site                                                              |

### Issues Identified

| Issue                                                                   | Impact                                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| The transport type is the API                                           | Swapping providers touches every send site                                   |
| HTML-only messages                                                      | No plain-text alternative, which hurts deliverability and accessibility      |
| Sender identity duplicated per service                                  | Two services can disagree about `From` and `Reply-To` for the same product   |
| Tests mock a third-party module                                         | Contributes to the `mock.module()` leakage that forces `--isolate`           |
| Send failures are swallowed by design in one path and thrown in another | Delivery outcome is not a value the caller can branch on                     |
| Cloudflare's binding accepts a raw MIME message, not structured fields  | Nobody currently builds RFC 5322 messages, so the migration needs that code  |
| Adoption and provider migration are coupled if only one transport ships | A refactor and an infrastructure change would land in the same step          |
| Every send site resolves its own client                                 | Handlers know which provider the app uses, and pass it down through services |

## Decision

Create `@pkg/mail`: a transport-agnostic mailer shipping three transports (memory, Resend, Cloudflare), a MIME builder, and a `remix/ui` email rendering layer.

Shipping the Resend transport alongside the Cloudflare one is deliberate. Apps adopt the package first, keeping their existing provider and secrets, and the provider switch is a later, isolated change at one construction site.

### 1. Message And Result Contract

```ts
export interface Message {
	from?: Address;
	to: Address | Address[];
	cc?: Address | Address[];
	bcc?: Address | Address[];
	replyTo?: Address | Address[];
	subject: string;
	html?: string;
	text?: string;
	headers?: Record<string, string>;
	/** Explicit `Date` header value; omitted means "now". Set it to keep tests deterministic. */
	date?: Date;
	/** Explicit `Message-ID` value; omitted means generated. Set it to keep tests deterministic. */
	messageId?: string;
}

export interface Address {
	email: string;
	name?: string;
}
```

`Mailer.send()` returns a `Result` and never throws, so a failed alert email is an explicit branch instead of an unhandled rejection:

```ts
let result = await mailer.send({ to, subject, ...body });
if (isFailure(result)) logger.error("mail.send_failed", { error: result.error.message });
```

### 2. Transport Adapter

```ts
export interface Transport {
	send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>>;
}

export interface SentMessage {
	messageId: string;
}
```

The mailer owns normalization (defaults, address coercion, text derivation, validation); transports own the wire format. That split matters because the two providers want different shapes: Resend accepts structured fields, while Cloudflare accepts a raw MIME message. The MIME builder is therefore a package module used by transports that need it, not a step every send goes through.

### 3. The Three Transports

Each transport is a separate subpath export, so importing one never pulls another's dependency or runtime-specific import into a bundle:

```ts
import { MemoryTransport } from "@pkg/mail/memory";
import { ResendTransport } from "@pkg/mail/resend";
import { CloudflareTransport } from "@pkg/mail/cloudflare";
```

#### MemoryTransport

Records every delivery so tests assert on real behavior instead of mocking a module:

```ts
let transport = new MemoryTransport();
let mailer = new Mailer({ transport, from: SENDER });

await sendInviteEmail(mailer, "Acme", "user@example.com", url);

assert.equal(transport.messages.length, 1);
assert.equal(transport.last?.subject, "You've been invited to join Acme");
assert.ok(transport.last?.text?.includes(url));
```

It exposes `messages`, `last`, `find(predicate)`, and `clear()`, and stores both the normalized message and, when a transport-specific format was produced, the assembled MIME string, so MIME regressions are testable.

#### ResendTransport

Maps a normalized message onto the provider's structured send call. No MIME assembly, because the provider does it:

```ts
export class ResendTransport implements Transport {
	constructor(private resend: Resend) {}

	async send(message: NormalizedMessage) {
		return wrap(async () => {
			let sent = await this.resend.emails.send({
				from: formatAddress(message.from),
				to: message.to.map(formatAddress),
				replyTo: message.replyTo?.map(formatAddress),
				subject: message.subject,
				html: message.html,
				text: message.text,
				headers: message.headers,
			});
			return { messageId: sent.data?.id ?? message.messageId };
		});
	}
}
```

The client is injected rather than constructed from an API key, so apps keep registering it in `@pkg/service-container` (ADR-008) exactly as they do today. `resend` is an optional peer dependency: apps that use this transport already have it, and apps that do not never install it.

#### CloudflareTransport

Wraps the Workers email sending binding. Because that binding takes a raw RFC 5322 message, it delegates to the MIME builder:

```ts
import { EmailMessage } from "cloudflare:email";

export class CloudflareTransport implements Transport {
	constructor(private binding: SendEmailBinding) {}

	async send(message: NormalizedMessage) {
		let raw = buildMimeMessage(message);
		return wrap(async () => {
			await this.binding.send(new EmailMessage(message.from.email, recipient(message), raw));
			return { messageId: message.messageId };
		});
	}
}
```

### 4. MIME Builder

`buildMimeMessage(message)` is a standalone, directly unit-testable module. It produces a `multipart/alternative` body when both `text` and `html` exist, a single part otherwise, and handles header folding, non-ASCII encoded words for display names and subjects, quoted-printable or base64 part encoding, `MIME-Version`, `Date`, and `Message-ID`.

It ships from the package root rather than from the Cloudflare subpath, so any future raw-MIME transport can reuse it and so its tests do not depend on a Workers-only import.

### 5. Rendering

```ts
export async function render(element: JSX.Element): Promise<{ html: string; text: string }>;
```

`render()` serializes a `remix/ui` tree with `renderToString` and derives a plain-text alternative from the same tree, so every email ships both parts without a second authoring step. Callers may override `text` explicitly when the derived version is not good enough.

A small layout kit ships with the package for the constraints email clients impose (table layout, inline styles, no external stylesheet): `Email.Layout`, `Email.Heading`, `Email.Text`, `Email.Button`, and `Email.Footer`. It carries no product branding; colors, logo, and footer content are props.

### 6. Middleware

Request handlers should not construct a mailer, and they should not have to know which transport an app uses. A `remix/fetch-router` middleware receives the transport, builds the `Mailer` itself, and publishes it on the request context:

```ts
import mail from "@pkg/mail/middleware";
import { ResendTransport } from "@pkg/mail/resend";

router.use(
	mail({
		transport: (ctx) => new ResendTransport(getServiceContainer().get(Resend)),
		from: { email: "no-reply@example.com", name: "Example" },
		replyTo: { email: "hello@example.com" },
	}),
);
```

The context is augmented from the middleware module, the way the i18n middleware does it, so the augmentation applies in every consuming app:

```ts
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Mailer for the current request, configured by the mail middleware. */
		email: Mailer;
	}
}
```

Handlers then send without any construction or wiring:

```ts
let result = await ctx.email.send({ to, subject, html, text });
if (isFailure(result)) ctx.logger.error("mail.send_failed", { error: result.error.message });
```

`transport` accepts either a `Transport` or a `(ctx) => Transport` factory. A transport built from a module-level binding needs no factory; one resolved per request through the service container uses the factory form. The `Mailer` itself is stateless, so only the transport resolution is per request.

#### Deferred Sends

The current invite path deliberately does not await its send, because a failed invite email should not fail the invite. An unawaited promise is the wrong way to express that, so the middleware provides the same intent with a defined lifetime:

```ts
ctx.email.later({ to, subject, html, text });
```

Queued messages are sent after the handler returns, flushed by the middleware in a `finally` block around `next()`, mirroring how the batched logger middleware flushes. Failures are logged, never thrown, because the response has already been produced. `send()` remains the awaited form for cases where the caller must know the outcome before responding.

### 7. Configuration And The Provider Switch

The package holds no sender identity of its own. Sender configuration lives at the middleware registration above, and outside a request (queue consumers, scheduled jobs) the same configuration constructs a mailer directly:

```ts
let mailer = new Mailer({
	transport: new ResendTransport(getServiceContainer().get(Resend)),
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});
```

The provider switch is the same construction with a different transport, once the domain is verified and the binding is configured:

```ts
let mailer = new Mailer({
	transport: new CloudflareTransport(env.SEND_EMAIL),
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});
```

Services, email templates, and tests are untouched.

## Consequences

### Positive

- **Adoption is decoupled from migration** - apps move onto the package with no infrastructure work, and switch providers later on their own schedule.
- **The provider switch is one line per app** - and it is reversible, which makes it safe to try on one app first.
- **Every email gets a text part** - deliverability and accessibility improve without per-email work.
- **Tests use a real fake** - `MemoryTransport` removes SDK module mocks from controller, service, and job tests.
- **Delivery is a value** - `Result` makes the fire-and-forget choice explicit per call site instead of implicit in a helper.
- **Handlers stop wiring email** - `ctx.email.send()` needs no client, no transport knowledge, and no service to pass one down.
- **Fire-and-forget gets a defined lifetime** - `later()` replaces unawaited promises with sends flushed after the response and failures that get logged.
- **One sender identity per app** - configured once at middleware registration.
- **MIME is owned and tested** - required by the Cloudflare binding, and reusable by any future raw-MIME transport.

### Negative

- **Three transports to maintain** - two of them talk to real providers with different failure shapes, and both need their own tests.
- **The Resend dependency stays for now** - as an optional peer, until every app has switched, so the dependency removal is deferred rather than achieved.
- **The package must implement MIME correctly** - encoded words, folding, and multipart boundaries are fiddly, and bugs surface as broken mail rather than exceptions.
- **Provider behavior is not identical** - Cloudflare's verification and recipient rules are stricter, so a switch can surface send-time failures that Resend accepted.
- **Plain-text derivation is heuristic** - some emails will need an explicit `text` override.

### Neutral

- **Attachments are out of scope initially** - no current email has one; the `Message` shape leaves room to add them.
- **A future HTTP transport stays possible** - the same `Transport` interface covers any other provider, including a REST-based sender for non-Workers contexts.
- **Message identifiers differ per provider** - `SentMessage.messageId` is the provider's id when it returns one, and the generated `Message-ID` otherwise.

## Implementation Plan

### Phase 1: Contract

**Priority:** High
**Estimated Effort:** 2 hours

1. Define `Message`, `NormalizedMessage`, `Transport`, `MailError`, and the `Mailer` normalization rules.
2. Set up subpath exports and the optional peer dependency on the Resend SDK.

### Phase 2: Memory And Resend Transports

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement `MemoryTransport`.
2. Implement `ResendTransport` with mapping and error tests.

### Phase 3: Middleware

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement the middleware factory, the `RequestContext` augmentation, and transport-or-factory resolution.
2. Implement `later()` queueing and the post-response flush, including failure logging.

### Phase 4: Rendering And Layout Kit

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement `render()` including plain-text derivation.
2. Implement the `Email.*` layout components.

### Phase 5: Adoption On The Current Provider

**Priority:** High
**Estimated Effort:** 3 hours

1. Register the middleware and move the invite email and alert email paths onto `ctx.email`.
2. Convert the current unawaited invite send to `later()`.
3. Replace Resend SDK mocks with `MemoryTransport` in affected tests.
4. Write the package README and add the package to the root README table (ADR-017).

### Phase 6: MIME And Cloudflare Transport

**Priority:** Medium
**Estimated Effort:** 5 hours

1. Verify the current Cloudflare email sending binding surface, recipient rules, and limits against Cloudflare documentation.
2. Implement and unit test `buildMimeMessage()`.
3. Implement `CloudflareTransport`.

### Phase 7: Provider Switch

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Verify the sending domain and add the email binding to `wrangler.jsonc`.
2. Switch one app's middleware registration, confirm real deliveries including headers and both body parts.
3. Switch the remaining apps, then drop the Resend dependency.

## Alternatives Considered

### 1. Cloudflare Transport Only

Ship the package with the target provider and migrate in one step.

**Rejected because**: it forces a package refactor and an infrastructure migration into the same change. Every app would need domain verification and a binding before it could use the package at all, and a problem with either half would block the other.

### 2. Resend Transport Only

Ship the package with the current provider and add Cloudflare later.

**Rejected because**: the platform decision is to send through Cloudflare, and designing the transport boundary without the raw-MIME case would risk a `Transport` interface that only fits structured-field providers.

### 3. React Email

Use `react-email` for authoring and rendering.

**Rejected because**: the apps that send email render `remix/ui`, not React, and pulling React in only for email would add a parallel rendering stack.

## References

- [RFC 5322 - Internet Message Format](https://datatracker.ietf.org/doc/html/rfc5322)
- [RFC 2045 - MIME Part One](https://datatracker.ietf.org/doc/html/rfc2045)
- [RFC 2047 - MIME Part Three: Message Header Extensions](https://datatracker.ietf.org/doc/html/rfc2047)
- [ADR-008: Service Container for Remix v3](./ADR-008-service-container-for-remix-v3.md)
- [ADR-024: Cloudflare Binding Mocks Package](./ADR-024-cloudflare-binding-mocks-package.md)
- [ADR-030: Email Classes As The Authoring Contract](./ADR-030-email-classes-as-the-authoring-contract.md)

## Current Progress

- [x] Phase 1: Contract
- [x] Phase 2: Memory And Resend Transports
- [x] Phase 3: Middleware
- [x] Phase 4: Rendering And Layout Kit
- [ ] Phase 5: Adoption On The Current Provider
- [ ] Phase 6: MIME And Cloudflare Transport
- [ ] Phase 7: Provider Switch

## Notes

- The exact binding name, recipient restrictions, and beta limits of Cloudflare's sending service must be confirmed in Phase 6; the `Transport` boundary exists so a surprise there stays contained and does not block Phases 1 through 5.
- The middleware covers request paths only. Queue consumers and scheduled handlers have no request context, so they construct a `Mailer` directly with the same configuration; that duplication is the reason sender configuration is a plain object rather than middleware-internal state.
- `ctx.email` reads as "the current user's email address" in an auth-heavy app. It is the name to use because it is what handlers will type, but the context augmentation's JSDoc must say plainly that it is a mailer.
- Deferred sends flush after the response, which means they cannot influence it. Anything whose failure must change the response has to use `send()` and branch on the `Result`.
- Transport subpaths are not re-exported from the package root, so a bundle for a non-Workers context never resolves `cloudflare:email` and an app without the Resend SDK never resolves it either.
- `date` and `messageId` are explicit optional message fields rather than injected clock or id services, so tests stay deterministic without adding constructor seams.
- Local development writes messages sent through the Cloudflare binding to the Wrangler temp email directory; `MemoryTransport` remains the mechanism for automated tests.
- The switch should be verified with real deliveries, not only unit tests: header correctness, both body parts, and spam placement are only observable end to end.
