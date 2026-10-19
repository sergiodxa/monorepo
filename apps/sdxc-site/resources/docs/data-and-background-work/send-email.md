---
title: Send email
description: Declare emails in a registry, translate them when they render, send, defer or queue them by name from requests, jobs and commands, and test what was sent with an in-memory transport.
section:
    title: Data & background work
    order: 7
order: 5
lastUpdated: 2026-10-19
---

This guide sends the message a job board owes someone who just published a position: a short
confirmation, in the language they posted in, delivered through Cloudflare's email binding. The
email is declared by the props it takes, its copy comes from your message bundles when it
renders, and it is queued, so a slow provider never delays the page the poster lands on and a
failed delivery is retried.

[`@sdxc/mail`](/api/mail) provides the registry, the mailers, the layout components and the
transports, [`@sdxc/i18n`](/api/i18n) the translated copy, and [`@sdxc/jobs`](/api/jobs) the job
that delivers queued email.

Each message here goes to one person because of something they did. Mail to a list of readers
belongs on a newsletter platform, which keeps their consent, their unsubscribe links and the
sending reputation; [Run a newsletter list](/docs/data-and-background-work/newsletter) puts
readers on one.

```bash
npm add @sdxc/http @sdxc/i18n @sdxc/jobs @sdxc/logger @sdxc/mail @sdxc/result remix
```

[`sdxc make email`](/docs/sdxc/make-email) writes the declaration, the template, its mapping
and a test in one step; this guide writes each piece by hand.

## Declare the email

Every email the app sends is declared in one map, with the schema of its props:

```typescript {% title="app/emails/index.ts" %}
import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	postings: {
		published: email({
			props: s.object({
				title: s.string(),
				company: s.string(),
				url: s.string(),
			}),
		}),
	},
});
```

Each declaration is named by its path, `postings.published`, and that name travels with every
queued delivery, so rename it only when no delivery under the old name is waiting. Importing
the map costs the schemas alone, so a controller sends an email without loading the module that
renders it, and the props are parsed by the schema on every send.

## Write the template

One template per email pairs the declaration with a subject and a `remix/component` body:

```tsx {% title="app/emails/postings/published.tsx" %}
import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.postings.published, {
	subject: ({ title, t }) => t("emails.postingPublished.subject", { title }),
	body: (handle) => () => {
		let { locale, t, title, company, url } = handle.props;
		return (
			<Email.Layout
				lang={locale}
				preview={t("emails.postingPublished.heading")}
				title={title}
			>
				<Email.Heading>{t("emails.postingPublished.heading")}</Email.Heading>
				<Email.Text>
					{t("emails.postingPublished.body", { title, company })}
				</Email.Text>
				<Email.Button href={url}>
					{t("emails.postingPublished.action")}
				</Email.Button>
				<Email.Footer>{t("emails.postingPublished.footer")}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		title: "Staff engineer",
		company: "Acme",
		url: "https://example.com/postings/1",
	}),
});
```

Every member receives the parsed props with `locale` and `t` beside them, bound to the
language of the delivery. `replyTo`, `headers`, `unsubscribe`, `list` and `calendar` are
optional members of the same shape, for mail that needs them, and `preview` supplies sample
props for previews alone.

`Email` is the layout kit. It renders tables with inline styles, the one layout every mail
client agrees on, and takes every color as a prop so it carries no brand of its own.
`Email.Link`, `Email.Table` and `Email.Img` cover the rest of a transactional message. The
mailer renders the body to HTML and derives the plain-text part from that same HTML, so every
message ships both parts from one source.

The copy lives in the same bundles your pages read:

```json {% title="resources/locales/en.json" %}
{
	"emails": {
		"postingPublished": {
			"subject": "{$title} is live",
			"heading": "Your position is live",
			"body": "{$title} at {$company} is now on the board for thirty days.",
			"action": "View the posting",
			"footer": "You received this because this address was listed as the contact."
		}
	}
}
```

## Map it on the registry

The registry maps each declaration onto its template through `lazy()`, so a send imports only
the template it renders. It translates with the translator you give it, `createTranslator` from
`@sdxc/i18n` over the app's bundles:

```typescript {% title="app/initializers/mail.ts" %}
import { createMail, lazy } from "@sdxc/mail";

import emails from "~/app/emails";
import { translate } from "~/app/initializers/i18n";

export const mail = createMail({ translator: translate });

mail.map(
	emails.postings.published,
	lazy(() => import("~/app/emails/postings/published")),
);

declare module "@sdxc/mail" {
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
```

`translate` is the translator
[Translate your app](/docs/building-remix-apps/translate-your-app) builds for work outside a
request; a language the app does not ship renders in the fallback. The `MailTypes` block types
the `t` every template receives with the keys of your bundles, so a misspelled key fails the
type check. The registry holds no transport, so the Worker and the command line, which runs on
Bun, share it.

## Publish a mailer to requests and jobs

A `Mailer` applies your sender identity and delivers through a transport, the only part that
knows a provider. Given the registry as `mail`, it sends a declared email by its declaration,
and given a `queue` function, it hands queued deliveries to a job. Both live in one module the
Worker alone imports:

```typescript {% title="app/initializers/mail-transport.ts" %}
import type { QueuedEmail } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";

export const transport = new CloudflareTransport(env.EMAIL);

export async function queue(delivery: QueuedEmail): Promise<void> {
	let { dispatcher } = await import("~/app/initializers/dispatcher");
	await dispatcher.enqueue(jobs.email, delivery);
}
```

`CloudflareTransport` delivers through the Workers email sending binding, so the Worker needs a
`send_email` binding named `EMAIL` and a verified sending domain. Each transport ships from its
own subpath, so importing this one never pulls another provider into your bundle. The
dispatcher loads when the first email is queued, since its own middleware imports this module.

`@sdxc/mail/middleware` publishes a request-scoped mailer as `ctx.email`:

```typescript {% title="app/initializers/router.ts" %}
import { log } from "@sdxc/logger/middleware";
import mailer from "@sdxc/mail/middleware";
import { createRouter } from "remix/router";

import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queue, transport } from "~/app/initializers/mail-transport";
import { MAIL_FROM } from "~/config/constants";

export function createWebRouter() {
	return createRouter({
		middleware: [
			log(logger),
			mailer({ transport, from: MAIL_FROM, mail, queue }),
		],
	});
}
```

`MAIL_FROM` is your sender, such as `{ email: "jobs@example.com", name: "Example Jobs" }`.
`@sdxc/mail/middleware/jobs` takes the same options and publishes `ctx.email` to every job, so
add it to the chain of the dispatcher from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), with a `transport`
option a test can replace:

```typescript {% title="app/initializers/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Transport } from "@sdxc/mail";
import type { Database } from "remix/data-table";

import { createJobDispatcher } from "@sdxc/jobs";
import mailer from "@sdxc/mail/middleware/jobs";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queue as mailQueue, transport } from "~/app/initializers/mail-transport";
import { queue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";
import { database } from "~/app/jobs/middleware/database";
import { MAIL_FROM } from "~/config/constants";

interface DispatcherOptions {
	queue?: JobQueue;
	openDb?: () => Database;
	transport?: Transport;
}

export function createDispatcher(options: DispatcherOptions = {}) {
	let dispatcher = createJobDispatcher({
		logger,
		queue: options.queue ?? queue,
		middleware: [
			database(options.openDb ?? openDatabase),
			mailer({
				transport: options.transport ?? transport,
				from: MAIL_FROM,
				mail,
				queue: mailQueue,
			}),
		] as const,
		timeout: "2 minutes",
	});

	dispatcher.map(jobs.email, () => import("~/app/jobs/email"));
	return dispatcher;
}

export const dispatcher = createDispatcher();
```

A command gets the same `ctx.email` from `@sdxc/mail/middleware/cli`, as
[Your app's command line](/docs/operations-and-testing/your-apps-command-line) sets up.

## Send it

The request that publishes the posting queues the confirmation by its declaration, with the
recipient, the language the poster was reading and the props:

```typescript {% title="app/http/controllers/publish-posting.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import emails from "~/app/emails";
import { publishPosting } from "~/app/models/posting";
import { SITE_URL } from "~/config/constants";
import routes from "~/routes/web";

export default createAction(routes.postings.create, async (ctx) => {
	let posting = await publishPosting(ctx.formData);
	let url = new URL(routes.postings.show.href({ id: posting.id }), SITE_URL);

	let queued = await ctx.email.queue(emails.postings.published, {
		to: posting.contact_email,
		locale: ctx.locale,
		props: {
			title: posting.title,
			company: posting.company,
			url: url.href,
		},
	});
	if (isFailure(queued)) {
		ctx.log.warn("posting.confirmation_not_queued", {
			error: queued.error.message,
		});
	}

	return redirect(routes.postings.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`publishPosting` is your own model function, `SITE_URL` your site's origin, and `ctx.locale`
the language the [`@sdxc/i18n`](/api/i18n) middleware detected.

A mailer sends a declared email three ways:

| Call                              | When it sends                    | What you get back                                   |
| --------------------------------- | -------------------------------- | --------------------------------------------------- |
| `await ctx.email.send(email, …)`  | now, while the handler waits     | a `Result` with the provider's message id           |
| `ctx.email.later(email, …)`       | once the response is produced    | nothing; each outcome lands on the invocation's log |
| `await ctx.email.queue(email, …)` | in the `email` job, with retries | a `Result` saying the queue accepted it             |

Await `send()` when the response depends on whether the email went out, such as a password
reset. `queue()` validates the props before the delivery enters the queue, so a refused prop
fails here, where the caller can fix it, and the queue carries only plain JSON. Every delivery
also accepts `from`, `cc`, `bcc`, `replyTo` and `headers`. None of them throws: a render
failure, an invalid address and a provider refusal all arrive as a `MailError` failure.

## Deliver queued email

One job delivers every queued email, whatever its declaration:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import { EMAIL_DELIVERY } from "@sdxc/mail";

export default jobs({
	email: job({ input: EMAIL_DELIVERY }),
});
```

```typescript {% title="app/jobs/email.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { EmailRefusedError } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.email, async (ctx) => {
	let sent = await ctx.email.deliver(ctx.input);
	if (isFailure(sent) && sent.error instanceof EmailRefusedError)
		ctx.exit(sent.error.message);
	if (isFailure(sent)) ctx.retry({ cause: sent.error });
});
```

An `EmailRefusedError` is a delivery no retry can send, a name nothing maps or props the schema
refuses, so the job exits. Any other failure, such as the provider being down, is retried,
bounded by the queue's retry limit. The email renders when the job runs, in the delivery's
`locale`.

Any other job sends through the same `ctx.email`: the nightly sweep that expires postings can
`ctx.email.later(emails.postings.expired, { to, locale, props })` for each one, and the mailer
sends them once the handler returns, logging each outcome.

## Preview an email

An app from `sdxc create` lists every email at `/_emails` while `bun dev` runs, with an HTML and
a text link for each supported language, and renders one from its template's `preview` props.
The router mounts it from `@sdxc/mail/previews`, serving it only in development:

```typescript {% title="app/initializers/router.tsx" %}
previews(mail, { locales: SUPPORTED_LANGUAGES, enabled: import.meta.env.DEV }),
```

The same email prints in a terminal, its subject and text part, or the HTML with `--html`:

```sh
sdxc run emails preview postings.published --locale es
```

`sdxc doctor` fails on an email `app/emails/index.ts` declares and nothing maps, and warns on a
template without a test or without `preview`.

`mail.preview()` renders an email with its template's `preview` props, in the language you
name, and `mail.mapped` lists every declaration the registry maps, for code of your own that
shows them. `emails` is the map from `app/emails/index.ts`:

```typescript
import { mail } from "~/app/initializers/mail";

let rendered = await mail.preview(emails.postings.published, "es");
let names = mail.mapped.map((email) => email.name);
```

`mail.preview("postings.published")` takes the name as well. `mail.render(email, { locale,
props })` renders any props you pass. Both answer a `Result` holding the `subject`, `html` and
`text`, and a template with no `preview` answers a failure from `preview()`.

## Test with the memory transport

A template's test renders it through the registry, so it reads the real bundles:

```typescript {% title="app/emails/postings/published.test.tsx" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

test("tells the poster in Spanish that the posting is live", async () => {
	let rendered = unwrap(
		await mail.render(emails.postings.published, {
			locale: "es",
			props: {
				title: "Staff engineer",
				company: "Acme",
				url: "https://example.com/p/1",
			},
		}),
	);

	expect(rendered.subject).toContain("Staff engineer");
	expect(rendered.text).toContain("https://example.com/p/1");
});
```

`MemoryTransport` from `@sdxc/mail/memory` records every message instead of sending it. What it
records is the normalized message a provider would have received, with defaults applied and the
text part derived. Queue through a mailer whose `queue` enqueues on a memory queue, drain it
through the dispatcher, and pick the message out with `isComposedEmail`:

```typescript {% title="app/jobs/email.test.ts" %}
import * as memory from "@sdxc/jobs/memory";
import { isComposedEmail, Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { expect, test } from "vitest";

import emails from "~/app/emails";
import { createDispatcher } from "~/app/initializers/dispatcher";
import { mail } from "~/app/initializers/mail";
import jobs from "~/app/jobs";
import { createTestDatabase } from "~/app/test/database";
import { MAIL_FROM } from "~/config/constants";

test("delivers the queued confirmation to the contact", async () => {
	let db = await createTestDatabase();
	let transport = new MemoryTransport();
	let queue = memory.queue();
	let dispatcher = createDispatcher({ queue, openDb: () => db, transport });
	let mailer = new Mailer({
		transport,
		from: MAIL_FROM,
		mail,
		queue: async (delivery) => {
			await dispatcher.enqueue(jobs.email, delivery);
		},
	});

	await mailer.queue(emails.postings.published, {
		to: "ada@example.com",
		locale: "es",
		props: {
			title: "Staff engineer",
			company: "Acme",
			url: "https://example.com/p/1",
		},
	});
	await queue.drain((delivery) => dispatcher.deliver(delivery));

	let sent = transport.find((message) =>
		isComposedEmail(message.email, emails.postings.published),
	);
	expect(sent?.to).toEqual([{ email: "ada@example.com" }]);
	expect(sent?.subject).toContain("Staff engineer");
});
```

`createTestDatabase` is the in-memory D1 from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases).
`transport.messages` lists everything sent, oldest first, and `transport.clear()` resets it
between tests. To read messages in a terminal instead, `PrintTransport` from `@sdxc/mail/print`
writes each one to a function you give it, which is how
[Your app's command line](/docs/operations-and-testing/your-apps-command-line) resends an email
from a laptop without reaching a real inbox.

## Where to go next

- [Make an email](/docs/sdxc/make-email) — declare, write, map and test an email in one
  command.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher the
  delivery job runs in.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the request side of the
  same message bundles.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) — the
  component model the email body uses.
- [Run a newsletter list](/docs/data-and-background-work/newsletter) — mail to subscribers,
  sent by the platform that holds the list.
- [Test Workers apps](/docs/operations-and-testing/testing) — more on driving the app in a test.
