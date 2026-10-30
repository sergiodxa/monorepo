---
title: Send email
description: Declare emails in a registry, translate them when they render, send, defer or queue them by name from requests, jobs and commands, and test what was sent with an in-memory transport.
section:
    title: Data & background work
    order: 7
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to declare emails in a `@sdxc/mail` registry and write their templates"
    - "How to send, defer or queue an email by name from requests, jobs and commands"
    - "How to preview an email and test what was sent with the memory transport"
---

This guide sends the message a job board owes someone who just published a position: a short
confirmation, in the language they posted in, delivered through Cloudflare's email binding. It
is queued, so a slow provider never delays the page the poster lands on and a failed delivery
is retried.

[`@sdxc/mail`](/api/mail) provides the registry, the mailers, the layout components and the
transports, [`@sdxc/i18n`](/api/i18n) the translated copy, and [`@sdxc/jobs`](/api/jobs) the job
that delivers queued email.

Each message here goes to one person because of something they did; mail to a list of
readers belongs on a newsletter platform, as
[Run a newsletter list](/docs/data-and-background-work/newsletter) shows.

```bash
npm add @sdxc/database-middleware @sdxc/http @sdxc/i18n @sdxc/jobs @sdxc/logger @sdxc/mail \
	@sdxc/result remix
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

Each declaration is named by its path, `postings.published`. Importing the map costs the
schemas alone, so a controller sends an email without loading the module that renders it.

> [!WARNING]
> The declaration's name travels with every queued delivery, so rename it only when no delivery
> under the old name is waiting: the job exits on a name nothing maps.

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

Every member receives the parsed props with `locale` and `t` bound to the delivery's
language, and `preview` supplies sample props for previews. `Email` renders tables with inline
styles, the one layout every mail client agrees on, and the mailer derives the plain-text part
from the same HTML.

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
the template it renders, and translates with the translator you give it:

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
request. The `MailTypes` block types `t` with the keys of your bundles, so a misspelled key
fails the type check.

## Publish a mailer to requests and jobs

A `Mailer` applies your sender identity and delivers through a transport, the only part that
knows a provider, and hands queued deliveries to a job through a `queue` function. Both live in
one module the Worker alone imports:

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

> [!NOTE]
> `CloudflareTransport` delivers through the Workers email sending binding, so the Worker needs a
> `send_email` binding named `EMAIL` and a verified sending domain.
> [Check a domain's email authentication](/docs/data-and-background-work/email-authentication)
> reads the DMARC, SPF and DKIM records receivers judge that domain by.

`queue` imports the dispatcher lazily, because the dispatcher's own middleware imports this
module.

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
`@sdxc/mail/middleware/jobs` publishes the same `ctx.email` to every job, so add it to the
dispatcher from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), with a `transport`
option a test can replace:

```typescript {% title="app/initializers/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Transport } from "@sdxc/mail";
import type { Database } from "remix/data-table";

import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import mailer from "@sdxc/mail/middleware/jobs";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queue as mailQueue, transport } from "~/app/initializers/mail-transport";
import { queue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";
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
fails where the caller can fix it.

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
refuses, so the job exits; any other failure is retried up to the queue's limit. The email
renders when the job runs, in the delivery's `locale`.

## Preview an email

An app from `sdxc create` serves an inbox of its emails at `/_emails` while `bun dev` runs,
each rendered from its template's `preview` props in the language you pick. The same email
prints in a terminal, its subject and text part, or the HTML with `--html`:

```bash
sdxc run emails preview postings.published --locale es
```

## Test with the memory transport

`MemoryTransport` from `@sdxc/mail/memory` records the message a provider would have received
instead of sending it. Queue through a mailer whose `queue` enqueues on a memory queue, drain
it through the dispatcher, and pick the message out with `isComposedEmail`:

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
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), and
`transport.messages` lists everything sent, oldest first.

## Where to go next

- [Make an email](/docs/sdxc/make-email) — declare, write, map and test an email in one
  command.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher the
  delivery job runs in.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the request side of the
  same message bundles.
