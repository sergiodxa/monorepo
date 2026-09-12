# @sdxc/mail

Transport-agnostic transactional email: pluggable transports, one mailer that normalizes
every message, and a `remix/ui` layout kit that renders both body parts.

A `Mailer` owns normalization — sender defaults, address coercion, plain-text derivation,
validation — and hands the result to a `Transport`, the only piece that knows a provider.
Delivery is a value rather than an exception: `send()` returns a `Result` and never throws.

## Installation

```bash
npm add @sdxc/mail
```

Send outcomes are reported as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure`
and `unwrap` come from, and bodies are `remix/ui` trees from
[`remix`](https://www.npmjs.com/package/remix). The middleware records deferred sends on
the current log from [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), and
`@sdxc/mail/markdown` renders documents parsed by
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), painted by
[`@sdxc/highlight`](https://www.npmjs.com/package/@sdxc/highlight). All four install
alongside this package.

Entry points: `@sdxc/mail` for the mailer, renderer, MIME builder and layout kit;
`@sdxc/mail/markdown` for markdown bodies; `@sdxc/mail/memory` and `@sdxc/mail/cloudflare`
for transports; `@sdxc/mail/middleware` for the router middleware. A transport ships from
its own subpath, so importing one never pulls another's platform dependency into a bundle.

## Usage

### Send A Message

```typescript
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { isFailure } from "@sdxc/result";

let mailer = new Mailer({
	transport: new MemoryTransport(),
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});

let result = await mailer.send({
	to: { email: "user@example.com" },
	subject: "You have been invited",
	html: "<p>Welcome aboard.</p>",
});

if (isFailure(result)) console.warn(result.error.message);
```

The plain-text part is derived from the HTML, so a message ships both parts without a
second authoring step.

### Author An Email As A Class

```tsx
import type { Email as EmailContract } from "@sdxc/mail";
import type { Handle } from "remix/ui";

import { Email } from "@sdxc/mail";

function InviteBody(handle: Handle<{ team: string; url: string }>) {
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

export class TeamInviteEmail implements EmailContract {
	constructor(private invite: { team: string; email: string; url: string; subject: string }) {}

	get to() {
		return { email: this.invite.email };
	}

	get subject() {
		return this.invite.subject;
	}

	body() {
		return <InviteBody team={this.invite.team} url={this.invite.url} />;
	}
}
```

`Email` names both the contract in type space and the layout kit in value space, so
`implements Email` and `<Email.Layout>` come from one import. Hand the class straight to
`send()`: `await mailer.send(new TeamInviteEmail(invite))`.

### Publish A Mailer On The Request Context

```typescript
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import mail from "@sdxc/mail/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		mail({
			transport: new CloudflareTransport(env.EMAIL),
			from: { email: "no-reply@example.com", name: "Example" },
		}),
	],
});

router.post("/invites", async (context) => {
	context.email.later(new TeamInviteEmail(invite));
	return new Response(null, { status: 204 });
});
```

`context.email` is a request-scoped `Mailer`. Whatever `later()` queued is flushed after
the response is produced, and each outcome lands on the invocation's log.

### Test Without Mocking A Provider

```typescript
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

let transport = new MemoryTransport();
let mailer = new Mailer({ transport, from: { email: "no-reply@example.com" } });

await mailer.send(new TeamInviteEmail(invite));

expect(transport.messages).toHaveLength(1);
expect(transport.last?.email).toBeInstanceOf(TeamInviteEmail);
expect(transport.last?.text).toContain(invite.url);
```

Recorded messages are the normalized ones a provider would have received, so defaults,
coerced address lists and the derived text part are all visible.

## API

### `new Mailer(options: MailerOptions)`

Sends mail through a transport, applying one app's sender identity to every message.
`options` carries `transport`, `from`, and optionally `replyTo` and `headers` — the last
added to every message, with per-message headers winning.

### `mailer.send(input, overrides?): Promise<Result<SentMessage, MailError>>`

Normalizes and delivers one message, awaiting the outcome. Never throws: a render
failure, an invalid message, a rejected delivery and a transport that throws all arrive as
a `MailError` failure. `input` is a plain `Message` or an `Email`; `overrides` replace
fields for this send only.

### `mailer.later(input, overrides?): void`

Queues a message for the next `flush()`. Nothing is rendered or validated yet, which is
what gives a fire-and-forget send a defined lifetime.

### `mailer.flush(): Promise<Result<SentMessage, MailError>[]>`

Sends everything `later()` queued and empties the queue, returning one result per message
in queue order. Never throws. The middleware calls this for you.

### `mailer.pending: number`

How many messages wait for the next `flush()`.

### `render(element: RemixElement): Promise<RenderedEmail>`

Renders a body tree to `{ html, text }`, deriving the text part from that same HTML. A
whole document is given an XHTML 1.0 Transitional doctype and a fragment is left alone,
since Outlook hands the document to Word, which drops into a quirks mode that collapses
table cell heights without it.

### `buildMimeMessage(message: NormalizedMessage): string`

Assembles a normalized message into a raw RFC 5322 message, for a transport whose
provider takes MIME instead of structured fields. It ships from the root because it is
plain string assembly with no platform import; see
[MIME Guarantees](#mime-guarantees) for what it produces.

### `isEmail(value: Message | Email): value is Email`

Reports whether a value is an `Email` rather than a plain `Message`. Discrimination is
structural: a callable `body` is the one member only an email has.

### `formatAddress(address: Address): string`

Formats an address as an RFC 5322 mailbox — `user@example.com` without a display name,
`Name <user@example.com>` with one — quoting the name only when it holds characters that
would change how the mailbox parses.

### `toAddressList(value: Address | Address[] | undefined): Address[]`

Coerces the single-or-list shape callers write into the list shape transports read,
treating a missing value as no recipients. Returns a new array, so later mutation of the
caller's array cannot leak into a message.

### `htmlToText(html: string): string`

Derives the plain-text alternative from rendered HTML: link targets survive as
`label (href)`, an image becomes its alt text, lists number or bullet their items, blocks
become blank lines, and table rows become single lines. Anything marked
`data-skip-in-text` is dropped, which is how an element says it belongs to the HTML part
alone. `render()` applies this for you.

### `MailError`

The single error type the package reports. The original provider or render error is kept
as `cause`, so one log line can name the root problem.

### `Email` (layout kit)

Unbranded components for email bodies. Every rule is an inline style on a table, which is
the only layout mail clients agree on, and every color is a prop so the kit ships no
product identity.

- **`Email.Layout`** — the full HTML document, wrapping the body in a centered card. It
  renders the only `<head>` and the only `<style>`, which is why web fonts and the dark
  stylesheet are its props. Props: `children?`, `preview?` (inbox preheader, hidden in
  the body), `logo?`, `title?`, `lang?`, `background?`, `surface?`, `color?`,
  `fontFamily?`, `fonts?`, `width?`, `darkStyles?`.
- **`Email.Heading`** — Props: `children?`, `level?` (`1 | 2 | 3`), `color?`, `align?`.
- **`Email.Text`** — Props: `children?`, `color?`, `muted?`, `size?`, `align?`.
- **`Email.Link`** — an inline link opening in a new tab, inheriting the color around it
  so the underline carries the meaning. Props: `href`, `children?`, `color?`,
  `underline?`.
- **`Email.CodeInline`** — a short run of code inside a sentence, sized in `em`. Props:
  `children?`.
- **`Email.Section`** — a full-width band as a single-cell table, padding on the cell and
  everything else on the table. Props: `children?`, `padding?`, `background?`, `align?`.
- **`Email.Row`** — puts its columns side by side as one table row, which is what an
  email uses instead of flex or grid. It does not wrap, so keep the count low. Props:
  `children?`, `gap?`.
- **`Email.Column`** — one cell of a `Row`. A numeric width is written bare to the
  attribute and in pixels to the style, because Outlook reads the first and everything
  newer reads the second. Props: `children?`, `width?`, `align?`, `valign?`, `padding?`.
- **`Email.Button`** — a link in a single-cell table, padding on the cell, so it stays a
  button in Outlook, where Word supports neither `display:inline-block` nor padding on an
  inline element. Props: `href`, `children?`, `background?`, `color?`, `radius?`.
- **`Email.Table`** — a set of facts as label/value rows. Props: `rows`
  (`EmailTableRow[]`), `borderColor?`.
- **`Email.Img`** — an image with the resets an inbox needs. `alt` is required because
  most readers see it: every major client blocks remote images until asked. Props: `src`,
  `alt`, `width?`, `height?`, `radius?`, `gap?`.
- **`Email.Hr`** — a rule drawn as a top border rather than the native element, which
  several clients render as an inset two-tone groove. Props: `color?`, `gap?`.
- **`Email.Footer`** — de-emphasized content under a hairline. Props: `children?`,
  `color?`, `borderColor?`.

### Types

`Result` below comes from `@sdxc/result` and `RemixElement` from `remix/ui`.

```typescript
interface Address {
	email: string;
	name?: string;
}

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
	/** Explicit values; omitted means "now" and a generated id. Set both to keep tests deterministic. */
	date?: Date;
	messageId?: string;
}

interface Email {
	readonly to: Address | Address[];
	readonly subject: string;
	body(): RemixElement;
	readonly replyTo?: Address | Address[];
	readonly headers?: Record<string, string>;
}

interface Transport {
	send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>>;
}

interface SentMessage {
	/** Provider identifier when it returns one, otherwise the message's own `Message-ID`. */
	messageId: string;
}
```

`NormalizedMessage` is what a transport receives: every field of `Message` with defaults
applied, address fields as lists, `date` and `messageId` always present, a derived `text`
part, and `email` carrying the source `Email` when the message came from one — which
transports ignore and tests use to identify a send by type. `RenderedEmail` is
`{ html, text }`, `SendOptions` is `Partial<Message>`, `MailerOptions` is the
constructor's options object, `EmailTableRow` is one `{ label, value }` row of an
`Email.Table`, and `EmailFont` is one web font for `Email.Layout` to declare: `family`, a
required `fallback` stack, and optional `src`, `weight` and `style`.

### `@sdxc/mail/markdown`

#### `Markdown`

Renders a parsed document through the layout kit. Props: `document`. Parsing stays with
the caller, so one document renders in an inbox and on a page, and mail that carries no
markdown pays for no parser.

The mapping is lossy where an inbox cannot lay out what markdown expresses: headings stop
at level three, a table becomes a real `<table>`, an alert becomes a labelled block quote,
and a footnote's body becomes a labelled block under the prose pointing at it. Raw HTML,
block and inline alike, arrives as escaped text, which keeps a document from any source
safe to send.

#### `CodeBlock`

A fenced block of code, highlighted, inside a single-cell table — Outlook paints a `<pre>`
with a background to the width of its text rather than the column. Props: `code`,
`language?`, `tokens?`. A painted document carries its runs on the code node and
`Markdown` passes them through as `tokens`; given `code` alone the block tokenizes itself,
and an unknown language renders unpainted.

### `@sdxc/mail/memory`

#### `new MemoryTransport(options?: MemoryTransportOptions)`

Records every delivery instead of sending it, so tests assert on real behavior rather than
on a mocked SDK module. `options.mime` also records the assembled raw message; it is off
by default because most tests read the normalized one.

- **`transport.messages`** — every recorded normalized message, oldest first
- **`transport.last`** — the most recent message, or `undefined`
- **`transport.deliveries`** — every delivery as `{ message, mime? }`, oldest first
- **`transport.lastMime`** — the raw MIME of the most recent delivery, or `undefined`
- **`transport.find(predicate)`** — the first message matching a predicate
- **`transport.clear()`** — forgets every delivery, so one instance serves several tests

### `@sdxc/mail/cloudflare`

#### `new CloudflareTransport(binding: SendEmailBinding)`

Delivers through the Workers email sending binding, which composes the message from
structured fields, so the transport assembles no MIME and the app imports no platform
class. Success carries the identifier the platform assigned; a refusal arrives as a
`MailError` carrying the platform's rejection as `cause`.

The binding writes its own `Date` and `Message-ID`, so the values a normalized message
carries stay local, and it takes one `replyTo` mailbox rather than a list, so the first is
the one that ships. `SendEmailBinding`, `SendEmailMessage` and `SendEmailResult` are
exported as the seam those platform assumptions live behind, declared locally so this
package typechecks outside a Workers project. See the
[Cloudflare email routing docs](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)
for declaring the binding and verifying a sending domain.

### `@sdxc/mail/middleware`

#### `mail(options: MailMiddlewareOptions): Middleware`

Publishes a request-scoped `Mailer` as `context.email` and flushes its deferred queue once
`next()` resolves. `options` carries `transport` — a `Transport`, or a
`(context) => Transport` factory when it is resolved per request — plus `from`, and
optionally `replyTo` and `headers`.

A delivered message sets `mail.sent` on the invocation's log and notes the provider's
message id; a failed one is a `mail.send_failed` warning, since the response is already
out. With no log current the outcomes are dropped. The module augments `RequestContext`,
so `context.email` is typed wherever the middleware is imported. Despite the name, it is
the object that _sends_ mail, not the current user's address.

## MIME Guarantees

What `buildMimeMessage` produces, for a transport that speaks raw messages:

- **Structure** — both body parts produce `multipart/alternative` with the plain-text part
  first, which RFC 2046 reads as least to most preferred; a single part produces a
  single-part message with no boundary.
- **Headers** — `From`, `To`, `Cc`, `Reply-To`, `Subject`, `Date`, `Message-ID`,
  `MIME-Version`, then custom headers, then the `Content-*` headers. `Bcc` is absent,
  since those recipients are addressed by the envelope, and a custom header repeating a
  derived name is dropped rather than emitted twice.
- **Folding** — a header past 78 characters folds at an existing space and the
  continuation keeps that space, so unfolding restores the value character for character.
  A longer run with no space in it is left long, since folding inside a token corrupts it.
- **Encoded words** — a non-ASCII subject or display name becomes base64 RFC 2047 encoded
  words, chunked on character boundaries and sized so the line still fits the limit. A
  display name is encoded rather than quoted, because a quoted encoded word reaches the
  reader literally.
- **Part encoding** — quoted-printable while text stays mostly ASCII, keeping the raw
  message readable, and base64 once escaping would inflate the body more than base64 does.
- **Boundaries** — the boundary carries a random UUID and is checked against the encoded
  bodies; base64's alphabet has no `-` and quoted-printable escapes a leading one, so no
  body line reads as a delimiter.
- **Line endings** — every break is CRLF, whatever the caller's bodies used, and both
  encodings wrap at 76 characters.

## Dark Mode

`Email.Layout` declares `color-scheme: light dark` and ships the dark half of it, because
declaring one without shipping it is worse than declaring nothing: Apple Mail reads the
declaration as a promise the message paints its own dark mode and stops remapping colors.

Every element therefore carries two things. The inline style is the light baseline, kept
by clients that strip `<style>`. A class — `mail-page`, `mail-surface`, `mail-text`,
`mail-muted`, `mail-rule`, `mail-action`, `mail-action-label` — is what the layout's
`prefers-color-scheme: dark` block overrides with `!important`. A class is emitted only
where the caller left that color to the kit, so passing `color` to a `Heading` opts it out
of the dark rule.

Components of your own that paint inside the card pass their rules as `darkStyles`,
appended inside that same media query:

```tsx
<Email.Layout darkStyles=".status-down{color:#f87171 !important;}">
```

That stylesheet is a text node and therefore escaped, so CSS passed here uses descendant
and class selectors rather than `>` or `&`.

## Pattern: Deciding Between `send()` And `later()`

`send()` when the outcome must be known before responding, so the caller branches on the
`Result` and changes the response:

```typescript
import { isFailure } from "@sdxc/result";

let result = await mailer.send(new PasswordResetEmail(user));
if (isFailure(result)) return new Response("Could not send the reset email", { status: 502 });
```

`later()` when a failed send must not fail the operation. Queued messages flush after the
response is produced, so they cannot influence it, and their failures are logged:

```typescript
context.email.later(new TeamInviteEmail(invite));
return new Response(null, { status: 204 });
```

That gives a fire-and-forget send a defined lifetime, which an unawaited promise does not
have.

## Pattern: Translating A Subject For The Recipient

A subject belongs in the _reader's_ language, which is not always the request language: an
invite is composed by one person and read by another. The package resolves no locales — a
subject reaches it as a string the application already translated — so the application
picks the language and hands the translator to the constructor:

```typescript
let translate = await translatorFor(invite.locale);
let subject = translate("invite.subject", { team: invite.team });

await mailer.send(new TeamInviteEmail({ ...invite, subject }));
```

Choose that locale in this order: the recipient's stored preference, the locale recorded
on the record being acted on, then the app's fallback. The requester's own locale is the
last resort, since the common mistake is sending in the sender's language rather than the
reader's.

## Pattern: Rendering Markdown As A Body

A document parsed elsewhere renders into the same card as a hand-authored body, with its
code fences painted:

```tsx
import { highlight } from "@sdxc/highlight/markdown";
import { Email, render } from "@sdxc/mail";
import { Markdown as MarkdownBody } from "@sdxc/mail/markdown";
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";

let { document } = unwrap(Markdown.parse(notes));
let painted = unwrap(Markdown.walk(document, highlight));

let { html, text } = await render(
	<Email.Layout title="Release notes">
		<MarkdownBody document={painted} />
	</Email.Layout>,
);

await mailer.send({ to: { email: "user@example.com" }, subject: "Release notes", html, text });
```

Highlighting is optional: a document handed over unpainted still renders, with each block
tokenized as it is drawn.

## Pattern: Switching Providers

Sender configuration is a plain object and the transport is the only provider-aware piece,
so a switch is one construction site:

```typescript
let mailer = new Mailer({
	transport: new CloudflareTransport(env.EMAIL), // the only line that changes
	from: { email: "no-reply@example.com", name: "Example" },
	replyTo: { email: "hello@example.com" },
});
```

Emails, services and tests are untouched, which also makes a switch reversible. Providers
differ in what they carry, though: check any field a new transport is quiet about, and
verify the first deliveries for real, since headers, both body parts and spam placement
are only observable end to end.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/mail": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
