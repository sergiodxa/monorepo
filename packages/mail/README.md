# @pkg/mail

Transport-agnostic transactional email: a mailer that normalizes messages, pluggable transports, a middleware that publishes `context.email`, and a `remix/ui` rendering layer that produces both body parts.

## Overview

Sending mail from an application service means re-deciding three things at every call site: which provider client to resolve, how to render the body, and what to do when delivery fails. This package makes each of those a single decision. A `Mailer` owns normalization — sender defaults, address coercion, plain-text derivation, and validation — and hands the result to a `Transport`, which is the only piece that knows about a provider. Swapping providers is one construction site, not every send.

Delivery is a value rather than an exception. `Mailer.send()` returns a [`Result`](/packages/result) and never throws, so a failed alert email is an explicit branch instead of an unhandled rejection, and `Mailer.later()` gives fire-and-forget mail a defined lifetime: it is flushed after the response is produced, and its failures are logged instead of thrown.

An email can be a plain `Message` object or an `Email` class. The class form keeps a recipient, a subject, and a body together with the data they were derived from, which makes the directory holding them the inventory of what an app can send. The package has no i18n dependency: a subject reaches it as a string that the application has already translated for the recipient, so nothing here resolves locales.

Bodies are `remix/ui` trees. `render()` serializes one with `renderToString` and derives the plain-text alternative from the same tree, so every message ships both parts without a second authoring step. A small unbranded layout kit (`Email.Layout`, `Email.Heading`, `Email.Text`, `Email.Button`, `Email.Footer`) covers the constraints mail clients impose: table layout, inline styles, and no external stylesheet.

### Entry points

| Entry                  | Contents                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `@pkg/mail`            | Contracts, `Mailer`, `render()`, the `Email` contract and layout kit |
| `@pkg/mail/memory`     | `MemoryTransport`, the recording fake for tests                      |
| `@pkg/mail/resend`     | `ResendTransport`, for a provider that accepts structured fields     |
| `@pkg/mail/middleware` | The router middleware that publishes `context.email`                 |

Transports are separate subpaths and are never re-exported from the root, so importing one never pulls another's dependency into a bundle. `resend` is an **optional peer dependency**: apps that use `@pkg/mail/resend` already have it, and apps that do not never install it. Nothing outside that subpath imports it.

### Not in this package yet

A MIME builder (`buildMimeMessage()`) and a `CloudflareTransport` over the Workers email sending binding are deliberately absent. They are phases 5 and 6 of [ADR-018](/docs/adr/ADR-018-mail-package-with-pluggable-transports.md), and they depend on verifying the binding surface, recipient rules, and beta limits against current provider documentation. The `Transport` interface exists so that work stays contained: adding a raw-MIME transport later changes nothing in the mailer, the middleware, or any send site.

## Usage

### Middleware

```typescript
import mail from "@pkg/mail/middleware";
import { ResendTransport } from "@pkg/mail/resend";
import { getServiceContainer } from "@pkg/service-container";
import { createRouter } from "remix/fetch-router";
import { Resend } from "resend";

let router = createRouter({
	middleware: [
		mail({
			transport: () => new ResendTransport(getServiceContainer().get(Resend)),
			from: { email: "no-reply@example.com", name: "Example" },
			replyTo: { email: "hello@example.com" },
		}),
	],
});
```

Handlers then send without resolving a client or knowing the provider:

```typescript
import { isFailure } from "@pkg/result";

router.post("/invites", async (context) => {
	let result = await context.email.send({
		to: { email: "user@example.com" },
		subject: "You have been invited",
		html: "<p>Welcome aboard.</p>",
	});

	if (isFailure(result)) context.logger.error("mail.send_failed", { error: result.error.message });

	return new Response(null, { status: 204 });
});
```

### Outside a request

Queue consumers and scheduled handlers have no request context, so they construct the mailer with the same configuration:

```typescript
import { Mailer } from "@pkg/mail";
import { ResendTransport } from "@pkg/mail/resend";

let mailer = new Mailer({
	transport: new ResendTransport(getServiceContainer().get(Resend)),
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});

let result = await mailer.send(new TeamInviteEmail(invite));
```

### Authoring an email as a class

```tsx
import type { Email } from "@pkg/mail";

export class TeamInviteEmail implements Email {
	constructor(private invite: { team: string; email: string; url: string; t: TFunction }) {}

	get to() {
		return { email: this.invite.email };
	}

	get subject() {
		return this.invite.t("emails.teamInvite.subject", { team: this.invite.team });
	}

	body() {
		return <TeamInviteBody invite={this.invite} />;
	}
}
```

The subject is a plain string property and `body()` takes no arguments, because the application supplies the translator when it constructs the email. Emails live one per file, which makes that directory the inventory of everything an app can send.

### Composing a body with the layout kit

```tsx
import { Email } from "@pkg/mail";

function TeamInviteBody(handle: Handle<{ team: string; url: string }>) {
	return () => {
		let { team, url } = handle.props;

		return (
			<Email.Layout preview={`Join ${team}`} title="Invite">
				<Email.Heading>You have been invited</Email.Heading>
				<Email.Text>Join {team} to keep an eye on your services.</Email.Text>
				<Email.Button href={url}>Accept invite</Email.Button>
				<Email.Footer>You received this because someone invited you to a team.</Email.Footer>
			</Email.Layout>
		);
	};
}
```

### Testing without mocking a provider

```typescript
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";

let transport = new MemoryTransport();
let mailer = new Mailer({ transport, from: { email: "no-reply@example.com" } });

await mailer.send(new TeamInviteEmail(invite));

expect(transport.messages).toHaveLength(1);
expect(transport.find((message) => message.email instanceof TeamInviteEmail)).toBeDefined();
expect(transport.last?.text).toContain(invite.url);
```

## API

### `@pkg/mail`

#### `Mailer`

Sends mail through a transport, applying one app's sender identity to every message.

##### `new Mailer(options: MailerOptions)`

**Parameters:**

- `options.transport`: The `Transport` that performs delivery
- `options.from`: Sender identity for the app; a message may override it
- `options.replyTo?`: Default reply-to; a message or email may override it
- `options.headers?`: Headers added to every message, with per-message headers winning

##### `mailer.send(input: Message | Email, overrides?: SendOptions): Promise<Result<SentMessage, MailError>>`

Normalizes and delivers a message, awaiting the outcome. Never throws: a render failure, an invalid message, a provider rejection, and a transport that throws all arrive as a `MailError` failure.

**Parameters:**

- `input`: A plain `Message`, or an `Email` that renders its own body
- `overrides?`: Fields that replace what the input provides, for this send only

**Returns:**

- Success carrying the provider's `messageId`, or failure carrying a `MailError`

**Example:**

```typescript
let result = await mailer.send(new TeamInviteEmail(invite), { to: forwardedAddress });
```

##### `mailer.later(input: Message | Email, overrides?: SendOptions): void`

Queues a message for the next `flush()`. Nothing is rendered or validated yet; that happens at flush time. Use this when a failed send must not affect the response, and `send()` when it must.

##### `mailer.flush(): Promise<Result<SentMessage, MailError>[]>`

Sends everything `later()` queued and empties the queue, returning one result per message in queue order. Never throws. The middleware calls this for you; call it yourself only when you built the mailer directly.

##### `mailer.pending: number`

Number of messages waiting for the next `flush()`.

#### `render(element: RemixElement): Promise<RenderedEmail>`

Renders an email body tree to both body parts.

**Parameters:**

- `element`: The body tree to render

**Returns:**

- `{ html, text }`, where `text` is derived from that same HTML

**Example:**

```typescript
let { html, text } = await render(<TeamInviteBody invite={invite} />);
```

#### `isEmail(value: Message | Email): value is Email`

Reports whether a value is an `Email` rather than a plain `Message`. Discrimination is structural: a callable `body` is the one member only an email has.

#### `formatAddress(address: Address): string`

Formats an address as an RFC 5322 mailbox — `user@example.com` without a display name, `Name <user@example.com>` with one — quoting the name only when it contains characters that would change how the mailbox parses. Transports use this to speak a provider's address strings.

#### `toAddressList(value: Address | Address[] | undefined): Address[]`

Coerces the single-or-list shape callers write into the list shape transports read, treating a missing value as no recipients. Returns a new array, so later mutation of the caller's array cannot leak into a message.

#### `htmlToText(html: string): string`

Derives the plain-text alternative of an email from its rendered HTML. Link targets survive as `label (href)`, list items become `- ` bullets, block elements become blank lines while table rows become single lines, and hidden preheader blocks are dropped. `render()` applies this for you; call it directly only to post-process a text part.

#### `MailError`

The single error type the package reports. The original provider or render error is kept as `cause`, so a log line can name the root problem.

#### `Email` (layout kit)

Unbranded components for email bodies. Every rule is an inline style on a table, which is the only layout mail clients agree on, and every color is a prop so the kit ships no product identity.

- **`Email.Layout`** — a full HTML document wrapping the body in a centered card.
  **Props:** `children?`, `preview?` (inbox preheader, hidden in the body and dropped from the text part), `logo?` (`{ src, alt, width? }`), `title?`, `lang?`, `background?`, `surface?`, `color?`, `fontFamily?`, `width?`
- **`Email.Heading`** — **Props:** `children?`, `level?` (`1 | 2 | 3`), `color?`, `align?`
- **`Email.Text`** — **Props:** `children?`, `color?`, `muted?`, `size?`, `align?`
- **`Email.Button`** — a padded link in a single-cell table, so the fill survives clients that drop CSS backgrounds on anchors. **Props:** `href`, `children?`, `background?`, `color?`, `radius?`
- **`Email.Footer`** — de-emphasized content under a hairline. **Props:** `children?`, `color?`, `borderColor?`

### Types

#### `Message`

```typescript
interface Message {
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
```

#### `Address`

```typescript
interface Address {
	email: string;
	name?: string;
}
```

#### `Email` (contract)

```typescript
interface Email {
	readonly to: Address | Address[];
	readonly subject: string;
	body(): RemixElement;
	readonly replyTo?: Address | Address[];
	readonly headers?: Record<string, string>;
}
```

`Email` names both this contract and the layout kit above: the contract in type space, the components in value space. So `implements Email` and `<Email.Layout>` both work from one import.

#### `NormalizedMessage`

What a transport receives: defaults applied, every address field a list, and a plain-text part derived when only HTML was authored. `email` is the source `Email` when the message came from one; transports must ignore it, and tests use it to identify a send by type.

```typescript
interface NormalizedMessage {
	from: Address;
	to: Address[];
	cc: Address[];
	bcc: Address[];
	replyTo: Address[];
	subject: string;
	html?: string;
	text?: string;
	headers: Record<string, string>;
	date: Date;
	messageId: string;
	email?: Email;
}
```

#### `Transport`

```typescript
interface Transport {
	send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>>;
}
```

The mailer owns normalization and transports own the wire format. That split is what lets one provider take structured fields while another takes a raw MIME message.

#### `SentMessage`

```typescript
interface SentMessage {
	/** Provider identifier when it returns one, otherwise the message's own `Message-ID`. */
	messageId: string;
}
```

### `@pkg/mail/memory`

#### `MemoryTransport`

Records every delivery instead of sending it, so tests assert on real behavior rather than on a mocked SDK module.

- **`transport.messages`** — every recorded delivery, oldest first
- **`transport.last`** — the most recent delivery, or `undefined`
- **`transport.find(predicate)`** — the first delivery matching a predicate
- **`transport.clear()`** — forgets every delivery, so one instance serves several tests

Recorded messages are the normalized ones a provider would have received, so defaults, coerced address lists, and the derived text part are all visible.

### `@pkg/mail/resend`

#### `ResendTransport`

##### `new ResendTransport(resend: Resend)`

Maps a normalized message onto the provider's structured send call; no MIME assembly, because the provider does it. The client is injected rather than built from an API key, so credential handling and client lifetime stay in the app that already registers it through [`@pkg/service-container`](/packages/service-container).

The provider reports API errors in its response rather than by throwing, so both shapes become the same `MailError` failure. The returned `messageId` is the provider's own when it gives one, and the message's generated `Message-ID` otherwise.

### `@pkg/mail/middleware`

#### `mail(options: MailMiddlewareOptions): Middleware`

Publishes a request-scoped `Mailer` as `context.email` and flushes its deferred queue after `next()` resolves.

**Parameters:**

- `options.transport`: A `Transport`, or a `(context) => Transport` factory when it is resolved per request
- `options.from`: Sender identity for the app
- `options.replyTo?`: Default reply-to
- `options.headers?`: Headers added to every message the request sends
- `options.logger?`: `(context) => MailLogger | undefined`, resolving the logger used for deferred-send failures; defaults to `context.logger`

The module augments `RequestContext`, so `context.email` is typed in every app that imports the middleware. Despite the name, it is the object that _sends_ mail, not the current user's address.

## Pattern: Deciding between `send()` and `later()`

`send()` when the outcome must be known before responding — the caller branches on the `Result` and can change the response:

```typescript
let result = await context.email.send(new PasswordResetEmail(user));
if (isFailure(result)) return new Response("Could not send the reset email", { status: 502 });
```

`later()` when a failed send must not fail the operation. Queued messages flush after the response is produced, so they cannot influence it, and failures are logged:

```typescript
context.email.later(new TeamInviteEmail(invite));
return redirect(href("/invites"));
```

This replaces an unawaited promise with a send that has a defined lifetime.

## Pattern: Translating a subject for the recipient

The subject must be in the _reader's_ language, which is not always the request language — an invite is composed by one person and read by another. The application resolves that language and hands the translator to the constructor; the package never sees a locale.

```typescript
let t = await context.i18next.cloneInstance({ lng: invite.locale }).loadNamespaces("emails");
await context.email.send(new TeamInviteEmail({ ...invite, t }));
```

Choose the locale in this order: the recipient's stored preference, the locale recorded on the record being acted on, then the app's fallback. The requester's own locale is the last resort, since the common mistake is sending in the sender's language rather than the reader's.

## Pattern: Switching providers

Sender configuration is a plain object, and the transport is the only provider-aware piece, so a switch is one construction site:

```typescript
let mailer = new Mailer({
	transport: new ResendTransport(client), // the only line that changes
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});
```

Emails, services, and tests are untouched, which also makes the switch reversible.

## Related Packages

- [`@pkg/result`](/packages/result) — the `Result` type every send outcome is reported as
- [`@pkg/service-container`](/packages/service-container) — where an app registers the provider client a transport is constructed with
- [`@pkg/logger`](/packages/logger) — the request logger the middleware reports deferred-send failures through
- [`@pkg/i18n`](/packages/i18n) — supplies the translator an email class uses for its subject; this package never depends on it

## Tips

1. **Configure the sender once** — register it at the middleware, and reuse the same object where a mailer is built outside a request, so two services cannot disagree about `From`.
2. **Let the text part be derived** — it exists for deliverability and accessibility; only set `text` explicitly when the derived version reads badly, since derivation is heuristic.
3. **Assert by type, not by copy** — `message.email instanceof SomeEmail` fails when the wrong email is sent and survives a reworded subject, which a string assertion gets backwards.
4. **Set `date` and `messageId` in tests** — they are message fields rather than injected clock and id services, so a test stays deterministic without a constructor seam.
5. **Use `MemoryTransport` rather than mocking the provider SDK** — a module mock leaks into every later test file in the same process; a recording fake does not.
6. **Validate what a deferred send can affect** — `later()` flushes after the response, so anything whose failure must change the response has to use `send()`.
7. **Inline every style** — mail clients strip external and document stylesheets, which is why the layout kit takes colors as props instead of exposing class names.
8. **Import a transport from its own subpath** — the root entry stays free of provider dependencies, so a bundle never resolves one the app does not use.
