---
name: sdxc-mail
description: "@sdxc/mail is transactional email: a Mailer that normalizes every message, pluggable Transports, a remix/ui layout kit that renders the HTML and text parts, and a MIME builder. Use when sending transactional mail from a worker, authoring an email body as a component or from parsed markdown, deferring sends until after the response, or asserting on sent mail in a test without mocking a provider."
---

# @sdxc/mail

Transport-agnostic transactional email. A `Mailer` owns normalization — sender defaults, address coercion, plain-text derivation, validation — and hands the result to a `Transport`, the only piece that knows a provider. Delivery is a value rather than an exception: `send()` and `flush()` return a `Result` and never throw. `Email` names both the contract an email class implements and the unbranded `remix/ui` layout kit its body is built from, so `implements Email` and `<Email.Layout>` come from one import. Transports ship from their own subpaths, so importing one never pulls another's platform dependency into a bundle.

Full API, options and examples: [packages/mail/README.md](packages/mail/README.md)

## When to reach for it

- A worker has to send an invite, a password reset or a receipt, and the send should not be able to throw its way into the response.
- Email HTML is being hand-written with tables and inline styles, and the plain-text part is being maintained separately.
- A send should happen after the response is produced and its failure must not fail the operation.
- A test asserts that mail went out and currently mocks the provider's SDK module.
- A transport takes raw RFC 5322 rather than structured fields and something has to assemble the MIME.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/mail": "workspace:*" } }
```

```ts
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

An email authored as a class carries its own recipient, subject and body, and goes straight to `send()`:

```tsx
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

### Entry points

- `@sdxc/mail` — `Mailer`, the `Email` contract and layout kit, `render`, `buildMimeMessage`, `htmlToText`, `formatAddress`, `toAddressList`, `isEmail`, `MailError`.
- `@sdxc/mail/markdown` — `Markdown` and `CodeBlock`, rendering a parsed document through the layout kit.
- `@sdxc/mail/memory` — `MemoryTransport`, which records deliveries instead of sending them.
- `@sdxc/mail/cloudflare` — `CloudflareTransport`, over the Workers email sending binding.
- `@sdxc/mail/middleware` — `mail()`, publishing a request-scoped `Mailer` as `context.email` and flushing its deferred queue.

## Suggestions

- Reach for `send()` when the outcome must be known before responding and the caller branches on the `Result`; reach for `later()` when a failed send must not fail the operation. Deferred messages flush after the response is produced, which gives a fire-and-forget send a defined lifetime an unawaited promise does not have.
- Build bodies from the layout kit rather than raw HTML: every rule is an inline style on a table, which is the only layout mail clients agree on, and the plain-text part is derived from that same HTML so there is no second authoring step.
- `Email.Layout` renders the only `<head>` and the only `<style>`, which is why web fonts and the dark stylesheet are its props. Components of your own pass their dark rules as `darkStyles`, using descendant and class selectors — that stylesheet is a text node and therefore escaped, so `>` and `&` do not survive.
- Passing an explicit `color` to a kit component opts that element out of the dark-mode rule, since the class is only emitted where the color was left to the kit.
- The Cloudflare transport needs the email sending binding and a verified sending domain; it writes its own `Date` and `Message-ID` and takes one `replyTo` mailbox rather than a list.
- A subject belongs in the reader's language, not the request's. The package resolves no locales — translate the subject in the application and hand it in.
- In tests, assert against `transport.messages` / `transport.last`: those are the normalized messages a provider would have received, with defaults, coerced address lists and the derived text part all visible, and `last.email` carries the source `Email` so a send can be identified by type.

## Related

- `@sdxc/markdown` — parses the documents `@sdxc/mail/markdown` renders; skill `sdxc-markdown`
- `@sdxc/result` — the `Result` every send answers with, and where `isFailure` and `unwrap` come from; skill `sdxc-result`
- `@sdxc/logger` — the invocation log the middleware records `mail.sent` and `mail.send_failed` on; skill `sdxc-logger`
