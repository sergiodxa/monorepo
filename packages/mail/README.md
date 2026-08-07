# @pkg/mail

Transport-agnostic transactional email: a mailer that normalizes messages, pluggable transports, a middleware that publishes `context.email`, and a `remix/ui` rendering layer that produces both body parts.

## Overview

Sending mail from an application service means re-deciding three things at every call site: which provider client to resolve, how to render the body, and what to do when delivery fails. This package makes each of those a single decision. A `Mailer` owns normalization — sender defaults, address coercion, plain-text derivation, and validation — and hands the result to a `Transport`, which is the only piece that knows about a provider. Swapping providers is one construction site, not every send.

Delivery is a value rather than an exception. `Mailer.send()` returns a [`Result`](/packages/result) and never throws, so a failed alert email is an explicit branch instead of an unhandled rejection, and `Mailer.later()` gives fire-and-forget mail a defined lifetime: it is flushed after the response is produced, and its failures are logged instead of thrown.

An email can be a plain `Message` object or an `Email` class. The class form keeps a recipient, a subject, and a body together with the data they were derived from, which makes the directory holding them the inventory of what an app can send. The package has no i18n dependency: a subject reaches it as a string that the application has already translated for the recipient, so nothing here resolves locales.

Bodies are `remix/ui` trees. `render()` serializes one with `renderToString` and derives the plain-text alternative from the same tree, so every message ships both parts without a second authoring step. An unbranded layout kit covers the constraints mail clients impose: table layout, inline styles, and no external stylesheet. Markdown, with highlighted code fences, renders through the same kit from a separate entry point.

### Entry points

| Entry                  | Contents                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `@pkg/mail`            | Contracts, `Mailer`, `render()`, `buildMimeMessage()`, the `Email` contract and kit |
| `@pkg/mail/markdown`   | `Markdown` and `CodeBlock`, which carry a parser and a highlighter                  |
| `@pkg/mail/memory`     | `MemoryTransport`, the recording fake for tests                                     |
| `@pkg/mail/cloudflare` | `CloudflareTransport`, for the Workers email sending binding                        |
| `@pkg/mail/middleware` | The router middleware that publishes `context.email`                                |

Transports are separate subpaths and are never re-exported from the root, so importing one never pulls another's runtime-specific import into a bundle: a build for a non-Workers context that never imports `@pkg/mail/cloudflare` never resolves a platform type. `@pkg/mail/markdown` is split off for the same reason and a different cost: Markdoc and Prism are the only heavy dependencies here, and most mail is not markdown.

The MIME builder is the exception to that split: it ships from the root rather than from a transport subpath, because it is plain string assembly with no runtime-specific import. Both shipped transports hand structured fields to their destination, so neither needs it; it exists for a transport whose provider takes a raw message, and for `MemoryTransport` to record the wire form a test wants to assert on.

## Usage

### Middleware

```typescript
import { CloudflareTransport } from "@pkg/mail/cloudflare";
import mail from "@pkg/mail/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/fetch-router";

let router = createRouter({
	middleware: [
		mail({
			transport: () => new CloudflareTransport(env.EMAIL),
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
import { CloudflareTransport } from "@pkg/mail/cloudflare";
import { env } from "cloudflare:workers";

let mailer = new Mailer({
	transport: new CloudflareTransport(env.EMAIL),
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});

let result = await mailer.send(new TeamInviteEmail(invite));
```

### Sending through the Workers binding

The Cloudflare transport takes the binding and nothing else. The binding composes the message from structured fields, so the transport assembles no MIME and the app imports no platform class:

```typescript
import { CloudflareTransport } from "@pkg/mail/cloudflare";
import { env } from "cloudflare:workers";

let transport = new CloudflareTransport(env.EMAIL);
```

The app declares the binding in `wrangler.jsonc`, where the name is the app's choice and must match the property read above:

```jsonc
{
	"send_email": [{ "name": "EMAIL", "remote": true }],
}
```

`remote: true` makes a `wrangler dev` send a real send. Without it the local implementation only logs the message it would have sent, which exercises none of the things that decide whether a message arrives: sender verification, the destination limits, and the identifier the send returns.

The binding form decides what the transport may send: an entry with only a `name` allows any verified address, while `destination_address`, `allowed_destination_addresses`, and `allowed_sender_addresses` restrict recipients or senders, and a message outside those limits is refused at send time rather than at deploy time. Before the first real delivery the sending domain has to be verified for the zone, with SPF, DKIM, and DMARC records in place; without that, mail is either refused or silently filtered.

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
expect(transport.last?.email).toBeInstanceOf(TeamInviteEmail);
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

A whole document is given an XHTML 1.0 Transitional doctype; a fragment is left alone, so rendering one component on its own returns just that component. The doctype is the one the renderers that read a doctype at all were built for — Outlook hands the document to Word, which drops into a quirks mode that collapses table cell heights without it.

**Example:**

```typescript
let { html, text } = await render(<TeamInviteBody invite={invite} />);
```

#### `buildMimeMessage(message: NormalizedMessage): string`

Assembles a normalized message into a raw RFC 5322 message, for transports whose provider takes MIME instead of structured fields. It is a pure function of the message, so it is unit-testable on its own and reusable by any future raw-MIME transport.

**Parameters:**

- `message`: The normalized message a transport received

**Returns:**

- The complete message: folded headers, a blank line, and the body, with CRLF line endings throughout including the last line

**Example:**

```typescript
let raw = buildMimeMessage(message); // "From: Example <no-reply@example.com>\r\n…"
```

What it guarantees:

- **Structure** — both body parts produce `multipart/alternative` with the plain-text part first, which RFC 2046 reads as least to most preferred; a single part produces a single-part message with no boundary at all.
- **Headers** — `From`, `To`, `Cc`, `Reply-To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, then the message's custom headers, then the `Content-*` headers. `Bcc` is deliberately absent, because those recipients are addressed by the envelope and writing them into the message would expose them to everyone else. A custom header repeating a derived name is dropped rather than emitted twice.
- **Folding** — a header longer than 78 characters folds at an existing space, and the continuation line keeps that space, so unfolding restores the value character for character. A run longer than the limit with no space in it is left long, since folding inside a token would corrupt it.
- **Encoded words** — a non-ASCII subject or display name becomes base64 RFC 2047 encoded words, chunked on character boundaries so no multi-byte character is split across two words, and sized so the line they sit on still fits the limit. A display name is encoded instead of quoted, because a quoted encoded word reaches the reader literally.
- **Part encoding** — quoted-printable while text stays mostly ASCII, since the raw message then stays readable, and base64 once escaping would inflate the body more than base64 does.
- **Boundaries** — the boundary carries a random UUID, is checked against the encoded bodies, and cannot be produced by either encoding: base64's alphabet has no `-`, and quoted-printable escapes a leading one, so no body line can be read as a delimiter.
- **Line endings** — every break is CRLF, whatever the caller's bodies used, and both encodings wrap their output to 76 characters.

#### `isEmail(value: Message | Email): value is Email`

Reports whether a value is an `Email` rather than a plain `Message`. Discrimination is structural: a callable `body` is the one member only an email has.

#### `formatAddress(address: Address): string`

Formats an address as an RFC 5322 mailbox — `user@example.com` without a display name, `Name <user@example.com>` with one — quoting the name only when it contains characters that would change how the mailbox parses. Transports use this to speak a provider's address strings.

#### `toAddressList(value: Address | Address[] | undefined): Address[]`

Coerces the single-or-list shape callers write into the list shape transports read, treating a missing value as no recipients. Returns a new array, so later mutation of the caller's array cannot leak into a message.

#### `htmlToText(html: string): string`

Derives the plain-text alternative of an email from its rendered HTML. Link targets survive as `label (href)`, an image becomes its alt text, an ordered list numbers its items while an unordered one bullets them, block elements become blank lines while table rows become single lines, and hidden preheader blocks are dropped. Anything marked `data-skip-in-text` is dropped whether it is hidden or not, which is how an element says it belongs to the HTML part alone. `render()` applies this for you; call it directly only to post-process a text part.

#### `MailError`

The single error type the package reports. The original provider or render error is kept as `cause`, so a log line can name the root problem.

#### `Email` (layout kit)

Unbranded components for email bodies. Every rule is an inline style on a table, which is the only layout mail clients agree on, and every color is a prop so the kit ships no product identity.

**The document**

- **`Email.Layout`** — a full HTML document wrapping the body in a centered card. It renders the only `<head>` and the only `<style>`, which is why web fonts and the dark stylesheet are its props rather than components of their own.
  **Props:** `children?`, `preview?` (inbox preheader, hidden in the body and padded so the body copy cannot leak into the snippet), `logo?` (`{ src, alt, width? }`), `title?`, `lang?`, `background?`, `surface?`, `color?`, `fontFamily?`, `fonts?` (`EmailFont[]`), `width?`, `darkStyles?`

**Copy**

- **`Email.Heading`** — **Props:** `children?`, `level?` (`1 | 2 | 3`), `color?`, `align?`
- **`Email.Text`** — **Props:** `children?`, `color?`, `muted?`, `size?`, `align?`
- **`Email.Link`** — an inline link, opening in a new tab. The colour is inherited rather than declared, so it is already whatever dark mode made the copy around it, leaving the underline to say it is a link. **Props:** `href`, `children?`, `color?`, `underline?`
- **`Email.CodeInline`** — a short run of code inside a sentence, sized in `em` so it tracks whatever it is set inside. **Props:** `children?`

**Layout**

- **`Email.Section`** — a full-width band, as a single-cell table. Padding goes on the cell and everything else on the table, which is the split Outlook needs and what keeps a background painting the whole band. **Props:** `children?`, `padding?`, `background?`, `align?`
- **`Email.Row`** — puts its columns side by side as one table row. This is what an email uses instead of flex or grid, both of which collapse to a stacked column in Outlook. It does not wrap, so keep the count low. **Props:** `children?`, `gap?`
- **`Email.Column`** — one cell of a `Row`. A numeric width is written to the attribute bare and to the style in pixels, because Outlook reads the first and everything newer reads the second. **Props:** `children?`, `width?`, `align?`, `valign?`, `padding?`

**Furniture**

- **`Email.Button`** — a link in a single-cell table, so the fill survives clients that drop CSS backgrounds on anchors. The padding is on the cell, which is what makes it a button in Outlook: Word supports neither `display:inline-block` nor padding on an inline element, so a padded anchor arrives as bare text on a coloured strip. **Props:** `href`, `children?`, `background?`, `color?`, `radius?`
- **`Email.Table`** — a set of facts as label/value rows. **Props:** `rows`, `borderColor?`
- **`Email.Img`** — an image with the resets an inbox needs: `display:block` so no gap opens under it, and a cleared border, outline and underline. `alt` is required because most readers see it — every major client blocks remote images until asked. **Props:** `src`, `alt`, `width?`, `height?`, `radius?`, `gap?`
- **`Email.Hr`** — a rule drawn as a top border rather than the native element, which several clients render as an inset two-tone groove. **Props:** `color?`, `gap?`
- **`Email.Footer`** — de-emphasized content under a hairline. **Props:** `children?`, `color?`, `borderColor?`

#### Web fonts

`Email.Layout` takes `fonts` and emits an `@font-face` for each, plus `mso-font-alt` — Outlook's own fallback declaration, which Word reads even though it ignores the rule around it, and without which an unavailable family lands on Times New Roman instead of the chosen stack.

```typescript
<Email.Layout fonts={[{ family: "Inter", fallback: "Helvetica, Arial, sans-serif", src: { url, format: "woff2" } }]}>
```

`fallback` is required, and is the font the email is actually set in for most readers: `@font-face` is unsupported in Gmail, Yahoo, and Outlook on Windows. With `fonts` set and `fontFamily` omitted, the document stack is built from the first entry.

#### Dark mode

The layout declares `color-scheme: light dark` and ships the dark half of it, because declaring one without shipping it is worse than declaring nothing: Apple Mail reads the declaration as a promise the message paints its own dark mode and stops remapping colors, so on macOS the card darkens under near-black copy and on iOS a dark inbox gets a white email.

Every element therefore carries two things. The inline style is the light baseline, and the one clients that strip `<style>` keep. A class — `mail-page`, `mail-surface`, `mail-text`, `mail-muted`, `mail-rule`, `mail-action`, `mail-action-label` — is what the layout's `prefers-color-scheme: dark` block overrides, with `!important`, since it is overriding an inline style.

A class is emitted only when the caller left that color to the kit. Pass `color` to a `Heading` and it opts out of the dark rule for it, because the kit has no dark counterpart for a color it never chose.

Apps whose own components paint inside the card pass their rules as `darkStyles`, appended inside that same media query:

```typescript
<Email.Layout darkStyles=".app-status-down{color:#f87171 !important;}">
```

The stylesheet is a text node, so it is escaped: CSS passed here cannot use `>` or `&`, which rules out child combinators. Descendant and class selectors cover everything a mail body contains.

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

### `@pkg/mail/markdown`

Markdown as an email body, and the highlighted code block it renders fences with. Behind its own entry point because it carries the only heavy dependencies in the package — Markdoc and Prism — and most mail is not markdown.

Both build a component tree rather than an HTML string, which is why neither is a thin wrapper over an existing renderer: Markdoc renders to HTML, Prism highlights to HTML, and `remix/ui` escapes a text node, so a string of markup would arrive in the inbox as its own source. The tree is walked here instead, and every node comes out as a component from the kit with its styles already inline.

#### `Markdown`

Renders markdown through the layout kit.

**Props:** `children` (the markdown source)

```tsx
import { Markdown } from "@pkg/mail/markdown";

<Email.Layout title="Release notes">
	<Markdown>{notes}</Markdown>
</Email.Layout>;
```

The mapping is deliberately lossy, because markdown can express things an inbox cannot lay out and the honest response is to render the content in a form that reads rather than one that half-works. Headings stop at level three, which is as many sizes as fit inside a card before the smallest is body copy again. Anything with no email-safe counterpart keeps its content and loses its box. Loose list items lose the paragraph markdown wraps them in, whose bottom margin would otherwise turn a five-item list into five separated blocks.

#### `CodeBlock`

A fenced block of code, highlighted, inside a single-cell table — a `<pre>` with a background is painted to the width of the text by Outlook rather than the width of the column. Long lines wrap rather than scroll, because an inbox has no horizontal scrollbar to offer.

**Props:** `code`, `language?`

Prism's token types collapse to six buckets — comment, keyword, string, number, function, punctuation — which is enough for code to read as code in a notification, and few enough that the dark half stays six rules. An unknown language renders unpainted rather than failing.

### `@pkg/mail/memory`

#### `MemoryTransport`

Records every delivery instead of sending it, so tests assert on real behavior rather than on a mocked SDK module.

##### `new MemoryTransport(options?: MemoryTransportOptions)`

**Parameters:**

- `options.mime?`: Assemble and record the raw MIME message for every delivery; off by default

What an instance exposes:

- **`transport.messages`** — every recorded delivery, oldest first
- **`transport.last`** — the most recent delivery, or `undefined`
- **`transport.deliveries`** — every delivery as `{ message, mime? }`, oldest first
- **`transport.lastMime`** — the raw MIME of the most recent delivery, or `undefined`
- **`transport.find(predicate)`** — the first delivery matching a predicate
- **`transport.clear()`** — forgets every delivery, so one instance serves several tests

Recorded messages are the normalized ones a provider would have received, so defaults, coerced address lists, and the derived text part are all visible.

A delivery that came from an email class carries that object as `message.email`, so `transport.last?.email` identifies a send by its type rather than by copy that will change. A message written inline is recorded like any other, it just has no email object to assert on.

With `{ mime: true }` each delivery also carries the assembled MIME message, which makes a MIME regression assertable without a provider or a Workers environment:

```typescript
let transport = new MemoryTransport({ mime: true });
let mailer = new Mailer({ transport, from: { email: "no-reply@example.com" } });

await mailer.send(new TeamInviteEmail(invite));

expect(transport.lastMime).toContain("Content-Type: multipart/alternative;");
```

It is off by default because most tests assert on the normalized message, and assembling MIME for a test that never reads it is wasted work.

### `@pkg/mail/cloudflare`

#### `CloudflareTransport`

##### `new CloudflareTransport(binding: SendEmailBinding)`

Delivers through the Workers email sending binding. That binding composes the message from structured fields, so the transport maps a normalized message onto them and assembles no MIME of its own.

**Parameters:**

- `binding`: The `send_email` binding declared in the app's Wrangler configuration

**Returns:**

- Success carrying the identifier the platform assigned, or a `MailError` failure carrying the platform's rejection as `cause`

**Example:**

```typescript
let transport = new CloudflareTransport(env.EMAIL);
```

**What the binding cannot express.** `Date` and `Message-ID` are written by the platform, so the values a normalized message carries do not reach the wire; the identifier reported back is the platform's, which is the one its delivery logs are keyed by. `replyTo` is one mailbox rather than a list, so only the first survives — the rest are dropped rather than folded into a header, since a message should never ship a `Reply-To` the platform did not write.

#### What this package assumes about the platform

```typescript
interface SendEmailBinding {
	send(message: SendEmailMessage): Promise<SendEmailResult>;
}
```

The binding surface is written from the platform's own generated types, not from a verified deployment of this package. Three things are assumed:

- **The binding name and shape** — an app-chosen name under `send_email` in `wrangler.jsonc`, exposed on `env` as an object with a single `send` method.
- **The `send` signature** — structured fields in, `{ messageId }` out, rejecting on refusal rather than reporting the refusal in the result.
- **Recipient rules** — the sending domain verified for the zone, and destination or sender allowlists enforced at send time by the binding's declaration form.

`SendEmailBinding`, `SendEmailMessage`, and `SendEmailResult` in `src/cloudflare.ts` are the single seam those assumptions live behind, and they are declared locally rather than taken from an ambient global for exactly that reason: the platform's types only resolve inside a Workers project, so a bare import would fail this package's typecheck and make the transport's tests need a Workers environment. If the platform's surface turns out to differ, the correction is those three declarations and the one `send()` call that uses them.

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
	transport: new CloudflareTransport(env.EMAIL), // the only line that changes
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});
```

Emails, services, and tests are untouched, which also makes a switch reversible. Providers do not fail identically, though, and they do not carry identical fields either: the binding takes one `replyTo` mailbox rather than a list, and writes its own `Date` and `Message-ID` over whatever the normalized message holds. Custom headers do survive — `List-Unsubscribe` and the rest reach the composed message — but check any field a new transport is quiet about rather than assuming it maps. Verify the first deliveries for real; headers, both body parts, and spam placement are only observable end to end.

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
9. **Assert MIME with `MemoryTransport({ mime: true })`** — it is the only way to catch a header or encoding regression in a test, and it needs no provider and no Workers environment.
10. **Do not hand-assemble MIME beside the builder** — CRLF endings, folding, and encoded words are exactly where a hand-rolled message breaks, and a broken message is delivered wrong rather than reported wrong.
11. **Watch a local send land** — `wrangler dev` writes messages sent through the binding to its temporary email directory, which is how the raw message gets read once before a real delivery.
12. **Expect stricter refusals after the provider switch** — the binding enforces domain verification and its own recipient allowlists at send time, so branch on the `Result` at every send site before switching an app over.
