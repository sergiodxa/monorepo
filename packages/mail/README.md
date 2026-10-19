# @sdxc/mail

Transport-agnostic transactional email with pluggable transports and `remix/component` rendering.

A `Mailer` applies sender defaults, coerces addresses, derives the plain-text part and validates
each message, then hands it to a `Transport`, the only piece that knows a provider. `send()`
answers a `Result` and never throws.

## Installation

```sh
npm add @sdxc/mail
```

Outcomes are `Result`s from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and
bodies are `remix/component` trees from [`remix`](https://www.npmjs.com/package/remix). The
middleware logs through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), and
`./markdown` renders documents from [`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown)
painted by [`@sdxc/highlight`](https://www.npmjs.com/package/@sdxc/highlight).

## Usage

### Send a message

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

The plain-text part is derived from the HTML, so every message ships both.

### Declare emails in a registry

An app declares every email it sends, and the schema of its props, in one map. Importing the
map costs the schemas alone, so a sender never loads the module that renders an email:

```tsx
// app/emails/index.ts
import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	teams: { invite: email({ props: s.object({ team: s.string(), url: s.string() }) }) },
});

// app/emails/teams/invite.tsx
import { createEmail, Email } from "@sdxc/mail";

export default createEmail(emails.teams.invite, {
	subject: ({ team, t }) => t("emails.teamInvite.subject", { team }),
	body: (handle) => () => (
		<Email.Layout lang={handle.props.locale} title={handle.props.team}>
			<Email.Button href={handle.props.url}>
				{handle.props.t("emails.teamInvite.action")}
			</Email.Button>
		</Email.Layout>
	),
	preview: () => ({ team: "Acme", url: "https://example.com/invite/1" }),
});

// app/initializers/mail.ts
import { createMail, lazy } from "@sdxc/mail";

export const mail = createMail({ translator: translate });
mail.map(
	emails.teams.invite,
	lazy(() => import("~/app/emails/teams/invite")),
);
```

A mailer configured with the registry as `mail` sends a declared email by its declaration, with
the recipient, the reader's language and the props:

```typescript
await ctx.email.send(emails.teams.invite, { to, locale, props: { team, url } });
ctx.email.later(emails.teams.invite, { to, locale, props: { team, url } });
await ctx.email.queue(emails.teams.invite, { to, locale, props: { team, url } });
```

The props are parsed by the declared schema first, and copy is translated when the email
renders: `subject`, `body` and the other members receive the props with `locale` and `t` beside
them, from the registry's `translator` (`createTranslator()` from `@sdxc/i18n` fits). Augment
`MailTypes` with `translate` so `t()` checks message keys. `preview()` is optional and only feeds
`mail.preview()`.

`queue()` hands the delivery, as plain JSON, to the mailer's `queue` option. One job delivers
every queued email:

```typescript
// app/jobs/index.ts
export default jobs({ email: job({ input: EMAIL_DELIVERY }) });

// app/jobs/email.ts
export default createJobHandler(jobs.email, async (ctx) => {
	let sent = await ctx.email.deliver(ctx.input);
	if (isFailure(sent) && sent.error instanceof EmailRefusedError) ctx.exit(sent.error.message);
	if (isFailure(sent)) ctx.retry({ cause: sent.error });
});
```

### An email outside the registry

Mail that is no declared email, such as a message to the app's own inbox, can be an email
object: `defineEmail()` builds its class from props, a subject and a body.

```tsx
import { defineEmail, Email } from "@sdxc/mail";

interface TeamInvite {
	team: string;
	url: string;
}

export const TeamInviteEmail = defineEmail<TeamInvite>({
	subject: (invite) => `Join ${invite.team}`,
	body: (handle) => () => (
		<Email.Layout preview={`Join ${handle.props.team}`} title="Invite">
			<Email.Heading>You have been invited</Email.Heading>
			<Email.Text>Join {handle.props.team} to start collaborating.</Email.Text>
			<Email.Button href={handle.props.url}>Accept invite</Email.Button>
			<Email.Footer>You received this because someone invited you to a team.</Email.Footer>
		</Email.Layout>
	),
});

await mailer.send(new TeamInviteEmail(invite.email, invite));
```

`defineEmail()` returns a class built with the recipient (a string, an `Address` or a list) and
the props; `replyTo`, `headers`, `unsubscribe`, `list` and `calendar` are optional functions of
the props. The subject arrives as a string, already in the recipient's language. Any object
with `to`, `subject` and `body()` also satisfies the `Email` contract, for an email whose
addressing needs more than its props.

### Publish a mailer on the request context

```typescript
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import mailer from "@sdxc/mail/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		mailer({
			transport: new CloudflareTransport(env.EMAIL),
			from: { email: "no-reply@example.com", name: "Example" },
			mail,
			queue,
		}),
	],
});

router.post("/invites", async (context) => {
	context.email.later(emails.teams.invite, { to: invite.email, props: invite });
	return new Response(null, { status: 204 });
});
```

`context.email` is a request-scoped `Mailer`; what `later()` queued is sent once the response
is produced, and each outcome lands on the invocation's log.

### Test against the memory transport

```typescript
import { isComposedEmail, Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

let transport = new MemoryTransport();
let mailer = new Mailer({ transport, from: { email: "no-reply@example.com" }, mail });

await mailer.send(emails.teams.invite, { to: invite.email, props: invite });

let sent = transport.find((message) => isComposedEmail(message.email, emails.teams.invite));
expect(sent?.text).toContain(invite.url);
```

Recorded messages are the normalized ones a provider receives: defaults applied, address
lists coerced and the text part derived.

## API

### `new Mailer(options: MailerOptions)`

A mailer bound to one transport and sender identity. `options` holds `transport`, `from`, and
optionally `replyTo` and `headers`; per-message headers win over `headers`.

### `mailer.send(input: Message | Email, overrides?: SendOptions): Promise<Result<SentMessage, MailError>>`

Normalizes and delivers one message. A render failure, an invalid message, a rejected delivery
and a throwing transport all answer a `MailError` failure. `overrides` replace fields for this
send only.

### `mailer.later(input: Message | Email, overrides?: SendOptions): void`

Queues a message for the next `flush()`; rendering and validation happen at flush time.

### `mailer.flush(): Promise<Result<SentMessage, MailError>[]>`

Sends and empties the queue, answering one result per message in queue order. The middleware
calls it for you.

### `mailer.pending: number`

How many messages wait for the next `flush()`.

### `mailer.queue(email, delivery): Promise<Result<void, MailError>>`

Validates a declared email's props and hands the delivery, with the email's name, to the
`queue` option. Fails without a `mail` registry or a `queue`.

### `mailer.deliver(queued: QueuedEmail): Promise<Result<SentMessage, MailError>>`

Sends a delivery `queue()` produced. An `EmailRefusedError` (unmapped name, refused props) means
no retry can send it.

### `email({ props })` and `emails(tree)`

Declare emails by the schema of their props; each declaration is named by its path
(`teams.invite`), which a queued delivery carries.

### `createEmail(email, options): EmailTemplate`

Pairs a template with its declaration: `subject`, `body`, and optional `replyTo`, `headers`,
`unsubscribe`, `list`, `calendar` and `preview`.

### `createMail(options?: MailOptions): Mail`

The registry: `map(email, template | lazy(load))`, `mapped`, `compose()`, `render(email, { locale, props })`,
`preview(email, locale?)` and `validate(email, props)`. It holds no transport, so a command run
on Bun and the Worker share it.

### `EMAIL_DELIVERY`

The input schema of the job that delivers queued email.

### `isComposedEmail(email, declaration?)`

Whether a sent message's `email` was composed from a declaration, for picking it out of a
memory transport in a test.

### `render(element: RemixElement): Promise<RenderedEmail>`

Renders a body tree to `{ html, text }`, deriving `text` from the HTML. A whole document gets
an XHTML 1.0 Transitional doctype, which keeps Outlook out of quirks mode.

### `buildMimeMessage(message: NormalizedMessage): string`

Assembles a raw RFC 5322 message for a provider that takes MIME. Bodies go into
`multipart/alternative` ordered text, HTML, calendar (a single part ships without a boundary);
headers fold at 78 characters, non-ASCII names and subjects become RFC 2047 encoded words, each
part is quoted-printable or base64, whichever is smaller, line endings are CRLF, and `Bcc` is
left to the envelope.

### `defineEmail<Props>(definition: EmailDefinition<Props>): EmailClass<Props>`

Builds an email class from `subject(props)` and a `body` component. Each call returns its own
class, so `instanceof` tells two emails apart; an instance exposes the `props` it was built with.

### `isEmail(value: Message | Email): value is Email`

`true` when the value has a callable `body`, the one member only an `Email` has.

### `formatAddress(address: Address): string`

An RFC 5322 mailbox: `user@example.com`, or `Name <user@example.com>` with the name quoted when
it needs to be.

### `toAddressList(value: Address | Address[] | undefined): Address[]`

A new array from the single-or-list shape callers write; `undefined` becomes `[]`.

### `htmlToText(html: string): string`

The plain-text alternative of rendered HTML: links become `label (href)`, images their alt
text, lists keep numbers or bullets, and table rows become lines. Elements marked
`data-skip-in-text` are dropped.

### `MailError`

The error of every failed send, with the provider or render error kept as `cause`.

### `Email` layout kit

Unbranded components laid out with inline-styled tables, every color a prop.

| Component          | Props                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Email.Layout`     | `preview?`, `logo?`, `title?`, `lang?`, `background?`, `surface?`, `color?`, `fontFamily?`, `fonts?`, `width?`, `darkStyles?`, `children?` |
| `Email.Heading`    | `level?` (`1 \| 2 \| 3`), `color?`, `align?`, `children?`                                                                                  |
| `Email.Text`       | `color?`, `muted?`, `size?`, `align?`, `children?`                                                                                         |
| `Email.Link`       | `href`, `color?`, `underline?`, `children?`                                                                                                |
| `Email.CodeInline` | `children?`                                                                                                                                |
| `Email.Section`    | `padding?`, `background?`, `align?`, `children?`                                                                                           |
| `Email.Row`        | `gap?`, `children?` (`Email.Column`s side by side, no wrapping)                                                                            |
| `Email.Column`     | `width?`, `align?`, `valign?`, `padding?`, `children?`                                                                                     |
| `Email.Button`     | `href`, `background?`, `color?`, `radius?`, `children?`                                                                                    |
| `Email.Table`      | `rows` (`EmailTableRow[]`), `borderColor?`                                                                                                 |
| `Email.Img`        | `src`, `alt`, `width?`, `height?`, `radius?`, `gap?`                                                                                       |
| `Email.Hr`         | `color?`, `gap?`                                                                                                                           |
| `Email.Footer`     | `color?`, `borderColor?`, `children?`                                                                                                      |

`Email.Layout` renders the document, its only `<head>` and `<style>`, the hidden `preview`
preheader, and a dark-mode stylesheet. `Email.MONO_FAMILY` and `Email.CODE_COLOR` are the font
stack and fill the code components use.

### Types

- `Message`: what a caller writes: `to`, `subject`, `html` and/or `text`, and optionally `from`,
  `cc`, `bcc`, `replyTo`, `headers`, `date`, `messageId`, `unsubscribe`, `list` and `calendar`.
  Address fields take an `Address` or a list.
- `Email`: an email class: `to`, `subject` and `body(): RemixElement`, plus optional `replyTo`,
  `headers`, `unsubscribe`, `list` and `calendar`.
- `NormalizedMessage`: what a transport receives: address fields as lists, `date` and
  `messageId` always set, the derived `text`, the generated `List-*` headers, `unsubscribe` and
  `list` as the option or `null`, and `email` holding the source `Email` when there was one.
- `Transport`: `{ send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> }`.
- `SentMessage`: `{ messageId }`, the provider's id or the message's own `Message-ID`.
- `Address`: `{ email, name? }`.
- `Unsubscribe`: `{ url, mailto?, oneClick? }`; `url` must be `https:`, `mailto` is an address
  or a `mailto:` URI, and `oneClick` (default `true`) writes `List-Unsubscribe-Post`.
- `MailingList`: `{ id, name? }`, written as `List-Id`.
- `CalendarPart`: `{ method, content, filename? }`, an iCalendar object whose `method` matches
  its `METHOD`; `filename` also attaches it as a file.
- `MailerOptions`, `SendOptions` (`Partial<Message>`), `RenderedEmail` (`{ html, text }`),
  `EmailTableRow` (`{ label, value }`) and `EmailFont` (`family`, `fallback`, and optional
  `src: { url, format }`, `weight` and `style`).

### `@sdxc/mail/markdown`

#### `Markdown`

Renders a parsed `@sdxc/markdown` document (`document` prop) through the layout kit. Headings
stop at level three, alerts become labelled quotes, footnotes become labelled blocks, and raw
HTML arrives as escaped text.

#### `CodeBlock`

A highlighted code block in a single-cell table. Props: `code`, `language?`, `tokens?`; without
`tokens` it highlights itself, and an unknown language renders unpainted.

### `@sdxc/mail/memory`

#### `new MemoryTransport(options?: MemoryTransportOptions)`

Records every delivery instead of sending it. `options.mime: true` also records the raw
message. Members: `messages`, `last`, `deliveries` (`RecordedDelivery[]`, each
`{ message, mime? }`), `lastMime`, `find(predicate)` and `clear()`.

### `@sdxc/mail/print`

#### `new PrintTransport(options: PrintTransportOptions)`

Writes each message to `options.write` instead of sending it, and reports it sent: the envelope,
subject, date, `Message-ID` and extra headers, then the plain-text body. `options.mime: true`
writes the raw MIME message instead. It writes only through the function it is given, so it runs
anywhere: `ctx.stderr` in a command, `(text) => process.stderr.write(text)` in a script.

### `@sdxc/mail/cloudflare`

#### `new CloudflareTransport(binding: SendEmailBinding)`

Delivers through the Workers
[`send_email` binding](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/).
The binding writes its own `Date` and `Message-ID`, ships the first `replyTo` only, and receives
a `calendar` as a `text/calendar` attachment named by `filename` or `invite.ics`.
`SendEmailBinding`, `SendEmailMessage`, `SendEmailAttachment` and `SendEmailResult` type the
binding.

### `@sdxc/mail/middleware`

#### `mail(options: MailMiddlewareOptions): Middleware` (default export)

Publishes a request-scoped `Mailer` as `context.email` and flushes its queue after `next()`.
`options` takes `transport` (a `Transport`, or `(context) => Transport` per request), `from`,
`replyTo?`, `headers?`, and `mail?` (the `createMail()` registry) with `queue?` for declared emails. Each deferred send logs `mail.sent` or a `mail.send_failed` warning
on the current log. It publishes under the `CurrentMailer` context key, exported here and from
`./middleware/cli`, so `ctx.get(CurrentMailer)` reads the same mailer in a route or a command.

### `@sdxc/mail/middleware/cli`

#### `mail(options: MailCommandOptions): CommandMiddleware` (default export)

Publishes a `Mailer` as `ctx.email` on an [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli)
command, so an admin command resends a message with the templates a route uses. `options` takes
the router entry's fields, with `transport` a `Transport` or `(ctx) => Transport` per run. The
queue flushes after the handler and each send is logged as in the router entry; a failed deferred
send also fails the run with its error. On a laptop, pass a `PrintTransport` writing to the
command's stderr, so a local run shows each message and never emails a real user.

```typescript
import { createCLI } from "@sdxc/cli";
import mail from "@sdxc/mail/middleware/cli";
import { PrintTransport } from "@sdxc/mail/print";

let cli = createCLI({
	name: "app",
	commands,
	middleware: [
		mail({
			transport: (ctx) => new PrintTransport({ write: (text) => ctx.stderr(text) }),
			from: { email: "no-reply@example.com" },
		}),
	],
});
```

### `@sdxc/mail/middleware/jobs`

#### `mail(options: MailJobOptions): JobMiddleware` (default export)

Publishes a `Mailer` as `ctx.email` on every [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs)
run, with the router entry's options and `transport` a `Transport` or `(ctx) => Transport`. The
queue flushes after the handler; a failed deferred send is a `mail.send_failed` warning.

### `@sdxc/mail/unsubscribe`

#### `signUnsubscribeToken(secret: string, claims: { subject: string; list: string }, options?: UnsubscribeToken.SignOptions): Promise<Result<string, MailError>>`

A URL-safe token: hex HMAC-SHA-256 then the base64url payload. `subject` is an opaque id (an
email address is refused) and `list` holds no colon. `options.expiresAt` sets an expiry;
`options.purpose` (default `"unsubscribe:v1:"`) separates this secret's use from others.

#### `verifyUnsubscribeToken(secret: string, token: string, options?: UnsubscribeToken.Options): Promise<Result<UnsubscribeToken.Claims, InvalidUnsubscribeTokenError>>`

Checks the MAC in constant time and answers `{ subject, list, issuedAt }`. Every bad token
(malformed, tampered, other secret or purpose, expired) fails with the same
`InvalidUnsubscribeTokenError`. `issuedAt` is `null` for a payload holding only `list:subject`.

#### `isOneClickUnsubscribe(form: FormData): boolean`

`true` for RFC 8058's `List-Unsubscribe=One-Click` body, telling the provider's POST apart from
a person submitting a confirmation form.

## Pattern: Choosing Between `send()` And `later()`

Await `send()` when the response depends on the outcome; queue with `later()` when a failed
send must not fail the request.

```typescript
import { isFailure } from "@sdxc/result";

router.post("/password-reset", async (context) => {
	let result = await context.email.send(emails.passwordReset, { to: user.email, props: { url } });
	if (isFailure(result)) return new Response("Could not send the email", { status: 502 });
	return new Response(null, { status: 204 });
});

router.post("/invites", async (context) => {
	context.email.later(emails.teams.invite, { to: invite.email, props: invite }); // after the response, failures logged
	return new Response(null, { status: 204 });
});
```

Use `queue()` when the email must survive a failed send: a job delivers it and retries. Outside
the middleware, call `mailer.flush()` yourself.

## Pattern: One-Click Unsubscribe For Bulk Mail

Gmail and Yahoo require one-click unsubscribe on subscribed and marketing mail. An email declares
its target and list, and the mailer writes the headers:

```tsx
import { defineEmail, Email } from "@sdxc/mail";
import { signUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { unwrap } from "@sdxc/result";

const DailyDigestEmail = defineEmail<{ token: string }>({
	subject: () => "Your daily digest",
	unsubscribe: (props) => ({
		url: `https://example.com/unsubscribe/${props.token}`,
		mailto: "unsubscribe@example.com",
	}),
	list: () => ({ id: "daily-digest.example.com", name: "Daily digest" }),
	body: () => () => (
		<Email.Layout title="Daily digest">
			<Email.Text>Here is what happened today.</Email.Text>
		</Email.Layout>
	),
});

let token = unwrap(await signUnsubscribeToken(secret, { subject: member.id, list: "digest" }));
await mailer.send(new DailyDigestEmail(member.email, { token }));
```

```text
List-Unsubscribe: <https://example.com/unsubscribe/…>, <mailto:unsubscribe@example.com?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
List-Id: Daily digest <daily-digest.example.com>
```

The provider POSTs to the URL with no cookies, so the endpoint sits outside any auth guard and
trusts only the token. `GET` shows a confirmation and changes nothing, since link scanners
follow every URL:

```typescript
import { isOneClickUnsubscribe, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { isFailure } from "@sdxc/result";

router.post("/unsubscribe/:token", async (context) => {
	let claims = await verifyUnsubscribeToken(secret, context.params.token);
	if (isFailure(claims)) return new Response("Link expired", { status: 400 });

	await removeSubscription(claims.data.subject, claims.data.list);

	let form = await context.request.formData();
	if (isOneClickUnsubscribe(form)) return new Response(null, { status: 200 });
	return new Response("You are unsubscribed.");
});
```

A send fails with a `MailError` when the URL is not `https:` or a `List-*` header is also set by
hand. Rotating the secret invalidates every delivered link.

## Pattern: Calendar Invitations

A message or email carrying `calendar` reaches Gmail, Outlook and Apple Mail as an invitation
with accept and decline buttons. Write the content with any iCalendar library:

```typescript
await mailer.send({
	to: { email: "ada@example.com" },
	subject: "Scheduled maintenance on Saturday",
	html: "<p>The database is read-only from 02:00 to 04:00 UTC.</p>",
	calendar: { method: "REQUEST", content: ics, filename: "invite.ics" },
});
```

```text
multipart/mixed
├── multipart/alternative
│   ├── text/plain; charset=utf-8
│   ├── text/html; charset=utf-8
│   └── text/calendar; method=REQUEST; charset=UTF-8
└── application/ics; name="invite.ics"  (attachment)
```

Keep a body beside the calendar for clients that show no invitation; `filename` adds the
attachment for clients that only offer files.

## Pattern: Rendering Markdown As A Body

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

Highlighting is optional: an unpainted document still renders, each code block highlighting
itself.

## Pattern: Brand Fonts And Dark Mode

`Email.Layout` declares `color-scheme: light dark` and paints its own dark variant. Inline styles
are the light baseline; the kit's classes (`mail-page`, `mail-surface`, `mail-text`,
`mail-muted`, `mail-rule`, `mail-action`, `mail-action-label`) carry the dark overrides, and only
where a color was left to the kit. Your own components add rules through `darkStyles`:

```tsx
import { Email } from "@sdxc/mail";

<Email.Layout
	fonts={[
		{
			family: "Inter",
			fallback: "Helvetica, Arial, sans-serif",
			src: { url: "https://example.com/inter.woff2", format: "woff2" },
			weight: 400,
		},
	]}
	fontFamily="Inter, Helvetica, Arial, sans-serif"
	darkStyles=".status-down{color:#f87171 !important;}"
>
	<Email.Text>
		Status: <span class="status-down">down</span>
	</Email.Text>
	<Email.Row gap={16}>
		<Email.Column width={120}>
			<Email.Img src="https://example.com/chart.png" alt="Uptime chart" width={120} />
		</Email.Column>
		<Email.Column>
			<Email.Table rows={[{ label: "Since", value: "02:14 UTC" }]} />
		</Email.Column>
	</Email.Row>
</Email.Layout>;
```

`fallback` is the font most readers see, since Gmail, Yahoo and Outlook ignore `@font-face`.
`darkStyles` is escaped as text, so use descendant and class selectors, not `>` or `&`.

## Pattern: A Transport For Another Provider

A transport turns a `NormalizedMessage` into one provider call. For a provider that takes raw
MIME, `buildMimeMessage` does the assembly:

```typescript
import type { NormalizedMessage, SentMessage, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";

import { buildMimeMessage, MailError, Mailer } from "@sdxc/mail";
import { failure, success } from "@sdxc/result";

class RawMimeTransport implements Transport {
	constructor(
		private endpoint: string,
		private apiKey: string,
	) {}

	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		let response = await fetch(this.endpoint, {
			method: "POST",
			headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "message/rfc822" },
			body: buildMimeMessage(message),
		});
		if (!response.ok) {
			return failure(new MailError("Provider rejected the message", { cause: response.status }));
		}
		return success({ messageId: message.messageId });
	}
}

let mailer = new Mailer({
	transport: new RawMimeTransport("https://mail.example.com/send", apiKey),
	from: { email: "no-reply@example.com", name: "Example" },
});
```

Emails, handlers and tests stay the same when the transport changes; verify the first real
deliveries, since headers and spam placement are observable only end to end.

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
