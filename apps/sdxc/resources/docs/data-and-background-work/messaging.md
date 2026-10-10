---
title: Send alerts to chat and paging services
description: Write one message, deliver it to Slack, Discord, Telegram, PagerDuty, Opsgenie or a signed webhook from a job with retries, and test it without a network.
section:
    title: Data & background work
    order: 6
order: 13
lastUpdated: 2026-10-08
---

This guide tells a team when their nightly sync fails. Each team connects the places it
wants to hear from in its settings: a Slack channel, a Discord webhook, a Telegram chat, a
PagerDuty service for whoever is on call, or a webhook of their own. The app writes the
alert once, and a background job delivers it to every channel, retrying the failures that a
later attempt can clear.

[`@sdxc/messaging`](/api/messaging) holds the portable message and one provider per platform,
each rendering the message in that platform's native format (Block Kit, a Discord embed,
Telegram HTML, a PagerDuty event) and sending it with one `fetch`. [`@sdxc/jobs`](/api/jobs)
runs the delivery and [`@sdxc/backoff`](/api/backoff) spaces out its retries.

```bash
npm add @sdxc/messaging @sdxc/jobs @sdxc/backoff @sdxc/result remix
```

## Write the message once

A `Message` is plain data: a required `title`, Markdown `text`, a `severity`, labelled
`fields`, `links` drawn as buttons, and a `timestamp`. Build it from your domain state in
one module, so every channel says the same thing:

```typescript {% title="app/notifications/messages.ts" %}
import type { Message } from "@sdxc/messaging";

export interface SyncRun {
	id: string;
	teamId: string;
	source: string;
	error: string;
	failures: number;
	finishedAt: Date;
	url: string;
}

function incidentKey(run: SyncRun) {
	return `sync:${run.teamId}:${run.source}`;
}

export function syncFailedMessage(run: SyncRun): Message {
	return {
		title: `Sync from ${run.source} failed`,
		text: `The run stopped with \`${run.error}\`. Imported rows are kept.`,
		severity: run.failures > 1 ? "critical" : "warning",
		fields: [
			{ label: "Source", value: run.source, inline: true },
			{ label: "Failures in a row", value: String(run.failures), inline: true },
		],
		links: [{ label: "Open the run", url: run.url }],
		timestamp: run.finishedAt,
		key: incidentKey(run),
		data: { runId: run.id },
	};
}

export function syncRecoveredMessage(run: SyncRun): Message {
	return {
		title: `Sync from ${run.source} recovered`,
		severity: "success",
		links: [{ label: "Open the run", url: run.url }],
		timestamp: run.finishedAt,
		key: incidentKey(run),
		state: "resolved",
	};
}
```

`text` is portable Markdown: emphasis, code, links, lists and quotes, written in each
platform's dialect on the way out. Literal text is escaped, so a source named `<prod>_api*`
arrives as typed, and every length limit a platform sets is met by truncating with an
ellipsis at a grapheme boundary. `severity` becomes a color on Slack and Discord and a
priority on the paging services.

`key` says what the message is about, and `state` where that stands. Both messages above
share a key, which is what lets a paging service resolve the incident the failure opened.
`data` carries machine-readable details for the webhook body and the incident's details.

## Configure a destination per channel

Every provider implements one `Destination` contract and lives behind its own subpath, so a
bundle carries only the platforms you import. Constructing one does no I/O, which makes it
cheap to build from a stored channel at the moment of sending:

```typescript {% title="app/notifications/destinations.ts" %}
import type { Destination } from "@sdxc/messaging";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { Opsgenie } from "@sdxc/messaging/opsgenie";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { SlackBot, SlackWebhook } from "@sdxc/messaging/slack";
import { TelegramBot } from "@sdxc/messaging/telegram";
import { Webhook } from "@sdxc/messaging/webhook";
import { env } from "cloudflare:workers";

export type ChannelConfig =
	| { kind: "slack"; url: string }
	| { kind: "slack-bot"; channel: string }
	| { kind: "discord"; url: string; threadId?: string }
	| { kind: "telegram"; chatId: string }
	| { kind: "pagerduty"; routingKey: string }
	| { kind: "opsgenie"; apiKey: string; region: "us" | "eu" }
	| { kind: "webhook"; url: string; secret: string };

export function destinationFor(config: ChannelConfig): Destination {
	switch (config.kind) {
		case "slack":
			return new SlackWebhook({ url: config.url });
		case "slack-bot":
			return new SlackBot({
				token: () => env.SLACK_BOT_TOKEN,
				channel: config.channel,
			});
		case "discord":
			return new DiscordWebhook({ url: config.url, threadId: config.threadId });
		case "telegram":
			return new TelegramBot({
				token: () => env.TELEGRAM_BOT_TOKEN,
				chatId: config.chatId,
			});
		case "pagerduty":
			return new PagerDuty({ routingKey: config.routingKey, source: "sync" });
		case "opsgenie":
			return new Opsgenie({ apiKey: config.apiKey, region: config.region });
		case "webhook":
			return new Webhook({
				url: config.url,
				secret: config.secret,
				resolve: true,
			});
	}
}
```

The chat providers each take what their platform hands a person who sets up an integration:

- **Slack** offers two. `SlackWebhook` posts to a pasted incoming-webhook URL, the URL itself
  being the credential, and Slack answers it with no message id. `SlackBot` posts as your
  app's bot token to a channel id the bot is a member of, so it can edit and thread what it
  sent.
- **Discord** takes a webhook URL, plus an optional `threadId` to post into a thread of the
  webhook's channel. Every message is sent with mentions disabled, so an alert quoting
  `@everyone` pings nobody.
- **Telegram** takes the bot token BotFather issued and a chat id, and an optional
  `messageThreadId` for a forum topic. One bot serves every team, so the token is a Worker
  secret and each channel stores only its chat.

A credential is a string or a function answering one, read on every send, so a secret
rotated in the Worker's environment is used from the next message on.

The other providers follow the same shape:

| Import                        | Class               | Configured with                                  |
| ----------------------------- | ------------------- | ------------------------------------------------ |
| `@sdxc/messaging/teams`       | `TeamsWorkflow`     | A Workflows webhook `url`                        |
| `@sdxc/messaging/google-chat` | `GoogleChatWebhook` | `url` on `chat.googleapis.com`                   |
| `@sdxc/messaging/whatsapp`    | `WhatsAppCloud`     | `accessToken`, `phoneNumberId`, `to`, `template` |
| `@sdxc/messaging/ntfy`        | `Ntfy`              | `topic`, `server?`, `token?`                     |
| `@sdxc/messaging/pushover`    | `Pushover`          | `token`, `user`, `emergency?`                    |
| `@sdxc/messaging/web-push`    | `BrowserPush`       | `push`, `subscription`, `ttl?`                   |

`WhatsAppCloud` sends approved templates only, since WhatsApp accepts free-form text only in
the 24 hours after the recipient last wrote; `template.parameters(message)` maps the message
onto the template's body parameters. Google Chat threads every message with the same `key`.
`BrowserPush` notifies one browser and needs `@sdxc/web-push` installed beside it; [Send
browser push notifications](/docs/data-and-background-work/browser-push) covers subscribing
and storing the browser.

## Check a pasted URL before saving it

The settings form stores whatever URL a person pasted, and each URL provider has a static
`check` applying the rule a send applies. `SlackWebhook` accepts only `hooks.slack.com` and
`DiscordWebhook` only `discord.com`, so a stored URL can never point a send anywhere else;
`Webhook` accepts any public URL and refuses private and reserved hosts:

```typescript {% title="app/notifications/check-url.ts" %}
import { DiscordWebhook } from "@sdxc/messaging/discord";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { Webhook } from "@sdxc/messaging/webhook";

export function checkChannelUrl(kind: "slack" | "discord" | "webhook", url: string) {
	if (kind === "slack") return SlackWebhook.check(url);
	if (kind === "discord") return DiscordWebhook.check(url);
	return Webhook.check(url);
}
```

Each answers a `Result` holding the parsed `URL`, or an `invalid-destination` failure the
form shows beside the field. `resolve: true` on the `Webhook` above adds a DNS check at send
time, so a public name later pointed at a private address is refused too.

## Deliver from a job

Every send makes exactly one attempt and answers a `Result`; it never throws. Retrying
belongs to the job that sends, where the delay survives the isolate and the queue bounds
the attempts. Declare the job with `MESSAGE_SCHEMA`, which reads the message's JSON form
back, ISO `timestamp` included:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import { MESSAGE_SCHEMA } from "@sdxc/messaging";
import * as s from "remix/data-schema";

export default jobs({
	deliverMessage: job({
		input: s.object({ channelId: s.string(), message: MESSAGE_SCHEMA }),
	}),
});
```

The payload carries the channel's id and never its URL or token, which stay in your
database rather than in every queued message. The handler builds the destination through
`ctx.destinations`, published by job middleware so a test can hand in its own:

```typescript {% title="app/jobs/middleware/destinations.ts" %}
import type { JobMiddleware } from "@sdxc/jobs";
import type { Destination } from "@sdxc/messaging";
import type { ChannelConfig } from "~/app/notifications/destinations";

import { createContextKey } from "remix/router";

export interface DestinationFactory {
	(config: ChannelConfig): Destination;
}

export const Destinations = createContextKey<DestinationFactory>();

interface DestinationsEffect {
	key: typeof Destinations;
	value: DestinationFactory;
	property: "destinations";
}

export function destinations(
	factory: DestinationFactory,
): JobMiddleware<DestinationsEffect> {
	return async (ctx, next) => {
		ctx.set(Destinations, factory, { property: "destinations" });
		await next();
	};
}
```

Add it to the dispatcher factory from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), with a
`destinations` option beside its database source:

```typescript {% title="app/jobs/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Database } from "remix/data-table";
import type { DestinationFactory } from "~/app/jobs/middleware/destinations";

import { createJobDispatcher } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { database } from "~/app/jobs/middleware/database";
import { destinations } from "~/app/jobs/middleware/destinations";
import { queue } from "~/app/jobs/queue";
import { openDatabase } from "~/app/lib/database";
import { logger } from "~/app/logger";
import { destinationFor } from "~/app/notifications/destinations";

interface DispatcherOptions {
	queue?: JobQueue;
	openDb?: () => Database;
	destinations?: DestinationFactory;
}

export function createDispatcher(options: DispatcherOptions = {}) {
	let dispatcher = createJobDispatcher({
		logger,
		queue: options.queue ?? queue,
		middleware: [
			database(options.openDb ?? openDatabase),
			destinations(options.destinations ?? destinationFor),
		] as const,
		timeout: "2 minutes",
	});

	dispatcher.map(jobs.deliverMessage, () => import("~/app/jobs/deliver-message"));
	return dispatcher;
}

export const dispatcher = createDispatcher();
```

The handler sends once per delivery and decides what each failure means:

```typescript {% title="app/jobs/deliver-message.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { isSuccess } from "@sdxc/result";

import Channels from "~/app/data/channel";
import jobs from "~/app/jobs";

const MAX_ATTEMPTS = 4;

const RETRY_BACKOFF = createBackoff({
	base: "30 seconds",
	max: "30 minutes",
	jitter: 0.2,
});

export default createJobHandler(jobs.deliverMessage, async (ctx) => {
	let channel = await Channels.find(ctx.database, ctx.input.channelId);
	if (!channel) return ctx.exit("The channel was removed");

	let destination = ctx.destinations(channel.config);
	ctx.log.set({ channel: { id: channel.id, provider: destination.provider } });

	let sent = await destination.send(ctx.input.message, { id: ctx.id });
	if (isSuccess(sent)) return;

	let error = sent.error;
	if (error.retryable && ctx.attempts < MAX_ATTEMPTS) {
		let delay = error.retryAfter ?? RETRY_BACKOFF.delay(ctx.attempts);
		return ctx.retry({ delay, reason: error.message, cause: error });
	}

	if (error.code === "gone") {
		await Channels.markBroken(ctx.database, channel.id, error.message);
	}
	return ctx.exit(error.message, { cause: error });
});
```

`Channels` is your own model, storing each channel's `ChannelConfig`. A failure is a
`MessagingError` whose `code` the job branches on:

- `rate-limited`, `unavailable`, `timeout` and `network` are `retryable`. `retryAfter` holds
  the milliseconds the platform asked for, read from `Retry-After` or the body Discord and
  Telegram send, and the backoff covers a platform that named none.
- `gone` means the channel, webhook or chat no longer exists. Mark the channel broken and
  show its owner, since every later send would fail the same way.
- `unauthorized`, `rejected`, `invalid-destination` and `invalid-message` repeat on every
  attempt, so the job exits and the run is reported as failed.

`MAX_ATTEMPTS` matches a consumer `max_retries` of 3: the last delivery exits with the
failure on its log, before the queue would dead-letter it. The error names the provider and
host only, never the URL or a token, so it is safe to log and to show. Every send also
leaves a `messaging.send` note on the run's log, with the provider, the outcome and how long
it took.

`id` is the delivery's identity, the same on every retry of one message: the signed webhook
below sends it as `webhook-id`, so its receiver can drop a repeat. Chat platforms have no idempotency key, so a retry after a `timeout` whose request did land posts
the message a second time.

## Fan out by severity

Chat channels hear about every failure. Paging channels wake someone up, so they get only
critical messages, and the recovery that resolves them:

```typescript {% title="app/notifications/notify-team.ts" %}
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Message } from "@sdxc/messaging";
import type { Database } from "remix/data-table";

import Channels from "~/app/data/channel";
import jobs from "~/app/jobs";

const PAGING_KINDS: ReadonlySet<string> = new Set(["pagerduty", "opsgenie"]);

export async function notifyTeam(
	db: Database,
	enqueuer: JobEnqueuer,
	teamId: string,
	message: Message,
) {
	let pages = message.severity === "critical" || message.state === "resolved";
	let channels = await Channels.forTeam(db, teamId);
	let targets = channels.filter(
		(channel) => pages || !PAGING_KINDS.has(channel.config.kind),
	);

	await enqueuer.enqueueMany(
		jobs.deliverMessage,
		targets.map((channel) => ({ channelId: channel.id, message })),
	);
}
```

A request passes `ctx.jobs` as the enqueuer, and a job passes the dispatcher. One message
per channel means a Slack outage retries the Slack delivery alone, while PagerDuty has
already paged.

PagerDuty and Opsgenie read the two fields chat platforms only display. `key` becomes
PagerDuty's `dedup_key` and Opsgenie's `alias`, so a second failure of the same sync updates
the open incident rather than opening another. `state: "resolved"` with the same key
resolves the PagerDuty incident and closes the Opsgenie alert, which is all
`syncRecoveredMessage` has to say. A message without a `key` fails `invalid-message` before
any request, since neither service could ever resolve the incident it opened.

`critical` maps to PagerDuty's `critical` and Opsgenie's `P1`, `warning` to `warning` and
`P3`, and `info` and `success` to `info` and `P5`. `fields` and `data` land in the incident's
details. `PagerDuty` also takes fixed `component`, `group` and `class` values for the alert,
and `Opsgenie` takes `responders` and `tags` to route it past the integration's own team.

## Edit the first message on recovery

A recovery reads better as an edit to the failure it answers. `update` and `reply` exist only
on providers whose platform can do them, and `supports` narrows a destination to one that
has the method:

```typescript {% title="app/notifications/send-or-update.ts" %}
import type { Destination, Message, SendOptions, SentRef } from "@sdxc/messaging";

import { supports } from "@sdxc/messaging";

export async function sendOrUpdate(
	destination: Destination,
	message: Message,
	ref: SentRef | null,
	options: SendOptions,
) {
	if (message.state === "resolved" && ref && supports(destination, "update")) {
		return await destination.update(ref, message, options);
	}
	return await destination.send(message, options);
}
```

A successful send answers `{ ref }`: a flat, provider-tagged object to store as JSON beside
the message's `key`, or `null` for a platform that answers no message id, such as a Slack
incoming webhook. `SlackBot`, `TelegramBot` and a `DiscordWebhook` can update; a stored ref
from another provider, left over after a team switched platforms, fails `invalid-ref` before
any request, so the job falls back to `send`.

## Sign webhooks for your customers' systems

`Webhook` posts the message as JSON for a team that wants alerts in its own tooling. The body
is the message with a `type: "message"` field and an ISO `timestamp`, signed with
[Standard Webhooks](https://www.standardwebhooks.com/) headers using the channel's secret. The
delivery's `id` is the `webhook-id`, so a receiver that stores ids drops a retried delivery.

A receiver verifies the signature with any Standard Webhooks library. With
[`@sdxc/webhooks`](/api/webhooks), `MESSAGE_SCHEMA` reads the body back into a `Message`:

```typescript {% title="app/http/controllers/alerts-inbox.ts" %}
import { MESSAGE_SCHEMA } from "@sdxc/messaging";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { recordAlert } from "~/app/data/alerts";
import routes from "~/routes/web";

export default createAction(routes.alerts.inbox, async (ctx) => {
	let verified = await Webhooks.verify(ctx.request, {
		secret: env.ALERTS_WEBHOOK_SECRET,
		schema: MESSAGE_SCHEMA,
	});
	if (isFailure(verified)) return new Response(null, { status: 401 });

	await recordAlert(ctx.db, verified.data.id, verified.data.payload);
	return new Response(null, { status: 204 });
});
```

`recordAlert` is the receiver's own model function. A `Webhook` subclass that overrides
`render` and `sign` keeps an older contract a customer already parses.

## Change one platform's layout

Each provider has a public `render(message)` answering the exact body it sends. Subclass it
and override `render`; the send, the URL checks and the error mapping stay the same:

```typescript {% title="app/notifications/compact-slack.ts" %}
import type { Message } from "@sdxc/messaging";

import { SlackWebhook } from "@sdxc/messaging/slack";

export class CompactSlack extends SlackWebhook {
	override render(message: Message) {
		let payload = super.render(message);
		payload.attachments[0].blocks = payload.attachments[0].blocks.filter(
			(block) => block.type !== "context",
		);
		return payload;
	}
}
```

This one drops the timestamp line. The dialect writers the providers use, such as `mrkdwn`
and `telegramHtml` with `writeText`, are exported for an override that writes text of its own.

## Test the delivery job

`MemoryDestination` from `@sdxc/messaging/memory` records every successful call and fails on
cue, so the retry and `gone` branches run without a network. Hand it to the dispatcher through
the `destinations` option, over a memory queue whose clock the test moves.
`createTestDatabase` is the in-memory D1 from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), and
`insertChannel` your own model function:

```typescript {% title="app/jobs/deliver-message.test.ts" %}
import * as memory from "@sdxc/jobs/memory";
import { MemoryDestination } from "@sdxc/messaging/memory";
import { expect, test } from "vitest";

import { insertChannel } from "~/app/data/channel";
import jobs from "~/app/jobs";
import { createDispatcher } from "~/app/jobs/dispatcher";
import { createTestDatabase } from "~/app/test/database";

test("waits the delay a rate limit asked for, then delivers", async () => {
	let db = await createTestDatabase();
	let channel = await insertChannel(db, {
		teamId: "team_1",
		config: { kind: "discord", url: "https://discord.com/api/webhooks/1/token" },
	});

	let destination = new MemoryDestination();
	destination.failNext({ code: "rate-limited", retryAfter: 30_000 });

	let now = 0;
	let queue = memory.queue({ now: () => now });
	let dispatcher = createDispatcher({
		queue,
		openDb: () => db,
		destinations: () => destination,
	});

	await dispatcher.enqueue(jobs.deliverMessage, {
		channelId: channel.id,
		message: { title: "Sync from Stripe failed", severity: "warning" },
	});

	let run = () => queue.drain((delivery) => dispatcher.deliver(delivery));
	expect(await run()).toEqual([{ type: "retry", delay: 30_000 }]);
	expect(destination.messages).toEqual([]);

	now += 30_000;
	expect(await run()).toEqual([{ type: "ack" }]);
	expect(destination.last?.message.title).toBe("Sync from Stripe failed");
});
```

A scripted failure records nothing, the way a platform that refused a message never shows
it. `failNext` queues in order, so a test scripts a whole sequence; `capabilities: ["update"]`
makes the destination declare `update`, for testing `sendOrUpdate` against a ref it answered.

## Hold a custom provider to the contract

`describeDestination` from `@sdxc/messaging/conformance` registers the Vitest tests every
destination passes: it sends, declares exactly the capabilities it claims, refuses another
provider's ref, and answers a rate limit as retryable with the delay the platform named. Run
it against `CompactSlack`, with [MSW](https://mswjs.io) standing in for Slack:

```typescript {% title="app/notifications/compact-slack.test.ts" %}
import { describeDestination } from "@sdxc/messaging/conformance";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { CompactSlack } from "~/app/notifications/compact-slack";

const WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/test-token";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describeDestination({
	name: "CompactSlack",
	capabilities: [],
	create() {
		server.use(http.post(WEBHOOK_URL, () => new HttpResponse("ok")));
		return new CompactSlack({ url: WEBHOOK_URL });
	},
	rateLimitNext(delayMs) {
		let headers = { "Retry-After": String(delayMs / 1000) };
		let limited = () =>
			new HttpResponse("rate_limited", { status: 429, headers });
		server.use(http.post(WEBHOOK_URL, limited, { once: true }));
	},
});
```

`rateLimitNext` arranges the platform's next answer, so the suite checks the package's mapping
from Slack's real `429` to a `rate-limited` failure. The suite needs `vitest`, which is why it
ships from its own subpath.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  `ctx.retry`, `ctx.exit` and the consumer's `max_retries`.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — choosing the
  backoff behind `RETRY_BACKOFF`.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — the receiving side of a
  signed delivery, with replay protection.
- [Send email](/docs/data-and-background-work/send-email) — the same job shape for mail.
- [Send browser push notifications](/docs/data-and-background-work/browser-push) — subscribing
  a browser, and the `BrowserPush` destination.
- [`@sdxc/messaging`](/api/messaging) — every provider's options and error codes.
