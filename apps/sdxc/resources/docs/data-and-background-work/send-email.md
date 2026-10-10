---
title: Send email
description: Write emails as remix/component classes, translate them for the reader, send them from a job, and assert on them with an in-memory transport.
section:
    title: Data & background work
    order: 6
order: 5
lastUpdated: 2026-10-08
---

This guide sends the message a job board owes someone who just published a position: a short
confirmation, in the language they posted in, delivered through Cloudflare's email binding. The
email is a class with a `remix/component` body, the copy comes from your message bundles, and the send
happens in a background job so a slow provider never delays the page the poster lands on.

[`@sdxc/mail`](/api/mail) provides the mailer, the layout components and the transports,
[`@sdxc/i18n`](/api/i18n) the translated copy, and [`@sdxc/jobs`](/api/jobs) the job it runs in.

Each message here goes to one person because of something they did. Mail to a list of readers
belongs on a newsletter platform, which keeps their consent, their unsubscribe links and the
sending reputation; [Run a newsletter list](/docs/data-and-background-work/newsletter) puts
readers on one.

```bash
npm add @sdxc/mail @sdxc/i18n @sdxc/jobs @sdxc/result
```

## Build the mailer

A `Mailer` applies your sender identity to every message and delivers through a transport. The
transport is the only part that knows about a provider, so it is the one argument worth making
replaceable:

```typescript {% title="app/lib/mail.ts" %}
import type { Transport } from "@sdxc/mail";

import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

export const MAIL_FROM = { email: "jobs@example.com", name: "Example Jobs" };

export function createMailTransport(): Transport {
	return new CloudflareTransport(env.EMAIL);
}

export function createMailer(transport: Transport = createMailTransport()): Mailer {
	return new Mailer({ transport, from: MAIL_FROM });
}
```

`CloudflareTransport` delivers through the Workers email sending binding, so the Worker needs a
`send_email` binding named `EMAIL` and a verified sending domain. Each transport ships from its
own subpath, so importing this one never pulls another provider into your bundle.

## Write the email as a class

An email is anything with a `to`, a `subject` and a `body()` returning a `remix/component` element. A
class that implements the `Email` contract keeps the data an email needs in its constructor and
the markup beside it:

```tsx {% title="app/emails/posting-published.tsx" %}
import type { Email as EmailContract } from "@sdxc/mail";
import type { Handle } from "remix/component";

import { Email } from "@sdxc/mail";

export interface PostingPublishedCopy {
	subject: string;
	heading: string;
	body: string;
	footer: string;
}

function PostingPublishedBody(handle: Handle<PostingPublishedCopy>) {
	return () => (
		<Email.Layout preview={handle.props.heading} title={handle.props.heading}>
			<Email.Heading>{handle.props.heading}</Email.Heading>
			<Email.Text>{handle.props.body}</Email.Text>
			<Email.Footer>{handle.props.footer}</Email.Footer>
		</Email.Layout>
	);
}
```

`Email` names the contract in type space and the layout kit in value space, which is why the type
import is renamed. The kit renders tables with inline styles, the one layout every mail client
agrees on, and takes every color as a prop so it carries no brand of its own. `Email.Button`,
`Email.Link`, `Email.Table` and `Email.Img` cover the rest of a transactional message.

The class itself, further down the same file, holds the recipient and the already-translated
copy:

```tsx {% title="app/emails/posting-published.tsx" %}
export class PostingPublishedEmail implements EmailContract {
	constructor(
		private recipient: string,
		private copy: PostingPublishedCopy,
	) {}

	get to() {
		return { email: this.recipient };
	}

	get subject() {
		return this.copy.subject;
	}

	body() {
		return <PostingPublishedBody {...this.copy} />;
	}
}
```

The mailer renders `body()` to HTML and derives the plain-text part from that same HTML, so
every message ships both parts from one source.

## Translate for the reader

The subject belongs in the reader's language, which is not always the language of the request
that caused the email. The package resolves no locale; you hand it strings you already
translated. Store the locale on the job's payload and build a translator for it:

```typescript {% title="app/lib/i18n.ts" %}
import type { I18n, Messages } from "@sdxc/i18n";

import { createI18n } from "@sdxc/i18n";

import en from "~/app/locales/en.json";
import es from "~/app/locales/es.json";

export const resources: Record<string, Messages> = { en, es };

export function translatorFor(locale: string): I18n {
	return createI18n({ locale, fallbackLanguage: "en", resources });
}
```

```json {% title="app/locales/en.json" %}
{
	"email": {
		"subject": "{$title} is live",
		"heading": "Your position is live",
		"body": "{$title} at {$company} is now on the board for thirty days.",
		"footer": "You received this because this address was listed as the contact."
	}
}
```

The same `resources` object feeds the request middleware, so a page and an email read one set of
bundles.

## Publish the mailer to jobs

A job reads its mailer off the context, the way it reads `ctx.database`. Job middleware
publishes it:

```typescript {% title="app/jobs/middleware/mailer.ts" %}
import type { JobMiddleware } from "@sdxc/jobs";
import type { Mailer as MailerService } from "@sdxc/mail";

import { createContextKey } from "remix/router";

export const Mailer = createContextKey<MailerService>();

interface MailerEffect {
	key: typeof Mailer;
	value: MailerService;
	property: "mailer";
}

export function mailer(source: () => MailerService): JobMiddleware<MailerEffect> {
	return async (ctx, next) => {
		ctx.set(Mailer, source(), { property: "mailer" });
		await next();
	};
}
```

Add it to the chain of the dispatcher factory from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), with an `openMailer`
option beside its database source:

```typescript {% title="app/jobs/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Mailer } from "@sdxc/mail";
import type { Database } from "remix/data-table";

import { createJobDispatcher } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { database } from "~/app/jobs/middleware/database";
import { mailer } from "~/app/jobs/middleware/mailer";
import { queue } from "~/app/jobs/queue";
import { openDatabase } from "~/app/lib/database";
import { createMailer } from "~/app/lib/mail";
import { logger } from "~/app/logger";

interface DispatcherOptions {
	queue?: JobQueue;
	openDb?: () => Database;
	openMailer?: () => Mailer;
}

export function createDispatcher(options: DispatcherOptions = {}) {
	let dispatcher = createJobDispatcher({
		logger,
		queue: options.queue ?? queue,
		middleware: [
			database(options.openDb ?? openDatabase),
			mailer(options.openMailer ?? (() => createMailer())),
		] as const,
		timeout: "2 minutes",
	});

	dispatcher.map(
		jobs.sendConfirmation,
		() => import("~/app/jobs/send-confirmation"),
	);
	dispatcher.map(jobs.expirePostings, () => import("~/app/jobs/expire-postings"));
	return dispatcher;
}

export const dispatcher = createDispatcher();
```

Without the option the chain builds `createMailer()`, which sends through Cloudflare, and a test
hands in a mailer over its own transport.

## Send it from a job

The job carries only ids and the locale. The handler loads the rest, so the email describes the
posting as it is when the message runs:

```typescript {% title="app/jobs/send-confirmation.tsx" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import { findPosting } from "~/app/data/posting";
import { PostingPublishedEmail } from "~/app/emails/posting-published";
import jobs from "~/app/jobs";
import { translatorFor } from "~/app/lib/i18n";

export default createJobHandler(jobs.sendConfirmation, async (ctx) => {
	let posting = await findPosting(ctx.database, ctx.input.postingId);
	if (!posting) return ctx.exit("The posting no longer exists");

	let intl = translatorFor(ctx.input.locale);
	let vars = { title: posting.title, company: posting.company };

	let sent = await ctx.mailer.send(
		new PostingPublishedEmail(posting.contact_email, {
			subject: intl.t("email.subject", vars),
			heading: intl.t("email.heading"),
			body: intl.t("email.body", vars),
			footer: intl.t("email.footer"),
		}),
	);

	if (isFailure(sent)) return ctx.retry({ delay: "5 minutes", cause: sent.error });
	ctx.log.set({ confirmation: { posting: posting.id } });
});
```

`send()` never throws. A render failure, an invalid address and a provider refusal all arrive as
a `MailError` failure, with the provider's own error as `cause`. Here that becomes a retry in five
minutes, bounded by the queue's retry limit. A posting that was deleted in the meantime is an
`exit`, because redelivering the message would find the same nothing.

`findPosting` is your own model function. The request that published the posting only enqueues
the job, through the `ctx.jobs` that `jobEnqueuer` from `@sdxc/jobs/router` publishes over the
same shared queue, as
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) sets up under "Enqueue
from a request".

## Send from a request when you have to

Some mail has no reason to be a job, such as a password-changed notice after a form succeeds.
`@sdxc/mail/middleware` publishes a request-scoped mailer as `ctx.email`:

```typescript {% title="app/router.ts" %}
import { log } from "@sdxc/logger/middleware";
import mail from "@sdxc/mail/middleware";
import { createRouter } from "remix/router";

import { createMailTransport, MAIL_FROM } from "~/app/lib/mail";
import { logger } from "~/app/logger";

export default createRouter({
	middleware: [
		log(logger),
		mail({ transport: createMailTransport, from: MAIL_FROM }),
	],
});
```

`transport` takes a transport or a function that builds one per request. In a handler, `later()`
queues a message that is sent once the response has been produced:

```typescript {% title="app/http/controllers/change-password.ts" %}
import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { changePassword } from "~/app/data/account";
import { PasswordChangedEmail } from "~/app/emails/password-changed";
import routes from "~/routes/web";

export default createAction(routes.account.password, async (ctx) => {
	let user = await changePassword(ctx.formData);
	ctx.email.later(new PasswordChangedEmail(user.email));

	return redirect(routes.account.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`changePassword` is your own model function, and `PasswordChangedEmail` another email class
written like the one above.

Each outcome is recorded on the request's log, so a failed send leaves a trace without failing
a response that is already out. Use `await ctx.email.send(...)` instead when the response depends
on whether the email went out.

## Test with the memory transport

`MemoryTransport` from `@sdxc/mail/memory` records every message instead of sending it. What it
records is the normalized message a provider would have received, with defaults applied and the
text part derived, so a test asserts on the real output. `createTestDatabase` is the in-memory D1
from [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), and
`insertPosting` your own model function:

```typescript {% title="app/jobs/send-confirmation.test.ts" %}
import * as memory from "@sdxc/jobs/memory";
import { MemoryTransport } from "@sdxc/mail/memory";
import { expect, test } from "vitest";

import { insertPosting } from "~/app/data/posting";
import jobs from "~/app/jobs";
import { createDispatcher } from "~/app/jobs/dispatcher";
import { createMailer } from "~/app/lib/mail";
import { createTestDatabase } from "~/app/test/database";

test("mails the contact in the language they posted in", async () => {
	let db = await createTestDatabase();
	let posting = await insertPosting(db, {
		title: "Staff engineer",
		company: "Acme",
		contact_email: "ada@example.com",
	});

	let transport = new MemoryTransport();
	let queue = memory.queue();
	let openMailer = () => createMailer(transport);
	let dispatcher = createDispatcher({ queue, openDb: () => db, openMailer });

	await dispatcher.enqueue(jobs.sendConfirmation, {
		postingId: posting.id,
		locale: "es",
	});
	await queue.drain((delivery) => dispatcher.deliver(delivery));

	expect(transport.last?.to).toEqual([{ email: "ada@example.com" }]);
	expect(transport.last?.subject).toContain("Staff engineer");
	expect(transport.last?.text).toContain("Acme");
});
```

`transport.messages` lists everything sent, oldest first, and `transport.clear()` resets it
between tests. The same transport makes a useful development outbox: point the mailer at one
locally and render its messages on a page.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher this
  job runs in.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the request side of the
  same message bundles.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) — the
  component model the email body uses.
- [Run a newsletter list](/docs/data-and-background-work/newsletter) — mail to subscribers,
  sent by the platform that holds the list.
- [Test Workers apps](/docs/operations-and-testing/testing) — more on driving the app in a test.
