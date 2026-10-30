---
title: Send alerts to chat and paging services
description: Write one message, deliver it to Slack, Discord, Telegram, PagerDuty, Opsgenie or a signed webhook from a job with retries, and test it without a network.
section:
    title: Data & background work
    order: 7
order: 13
lastUpdated: 2026-10-25
outcomes:
    - "How to write one message and deliver it to Slack, Discord, Telegram, PagerDuty or Opsgenie"
    - "How to deliver from a job with retries and fan out by severity"
    - "How to sign webhooks for your customers and test delivery without a network"
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
npm add @sdxc/backoff @sdxc/database-middleware @sdxc/jobs @sdxc/messaging @sdxc/result remix
```

## Write the message once

A `Message` is plain data: a required `title`, Markdown `text`, a `severity`, labelled
`fields`, `links` drawn as buttons, and a `timestamp`. Build it from your domain state in
one module, so every channel says the same thing:

```typescript {% title="app/services/notifications/messages.ts" %}
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

`text` is portable Markdown, written in each platform's dialect and truncated to its limits
on the way out. `key` says what the message is about and `state` where that stands; both
messages share a key, which lets a paging service resolve the incident the failure opened.

## Configure a destination per channel

Every provider implements one `Destination` contract and lives behind its own subpath, so a
bundle carries only the platforms you import. Constructing one makes no request, which makes
it cheap to build from a stored channel at the moment of sending:

```typescript {% title="app/services/notifications/destinations.ts" %}
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

`SlackWebhook` posts to a pasted incoming-webhook URL, while `SlackBot` posts as your app's
bot and can edit what it sent. Shared credentials such as a bot token are a string or a
function read on every send, so a rotated Worker secret applies from the next message on.
The [`@sdxc/messaging` reference](/api/messaging) lists the other providers (Teams, Google Chat, ntfy,
Pushover and more).

## Check a pasted URL before saving it

Each URL provider has a static `check` applying the rule a send applies: `SlackWebhook`
accepts only `hooks.slack.com`, `DiscordWebhook` only `discord.com`, and `Webhook` any public
URL. Run it in the settings form before storing what a person pasted:

```typescript {% title="app/services/notifications/check-url.ts" %}
import { DiscordWebhook } from "@sdxc/messaging/discord";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { Webhook } from "@sdxc/messaging/webhook";

export function checkChannelUrl(kind: "slack" | "discord" | "webhook", url: string) {
	if (kind === "slack") return SlackWebhook.check(url);
	if (kind === "discord") return DiscordWebhook.check(url);
	return Webhook.check(url);
}
```

Each answers a `Result` holding the parsed `URL`, or an `invalid-destination` failure to show
beside the field.

> [!WARNING]
> A URL that passes `check` can later resolve somewhere else. `resolve: true` on the `Webhook`
> above adds a DNS check at send time, so a public name later pointed at a private address is
> refused too.

## Deliver from a job

Every send makes exactly one attempt and answers a `Result`, so retrying belongs to the job
that sends. Declare the job with `MESSAGE_SCHEMA`, which reads the message's JSON form back.
The payload carries only the channel's id, so its URL and token stay in your database:

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

The handler builds the destination through `ctx.destinations`, published by job middleware
so a test can hand in its own:

```typescript {% title="app/jobs/middleware/destinations.ts" %}
import type { JobMiddleware } from "@sdxc/jobs";
import type { Destination } from "@sdxc/messaging";
import type { ChannelConfig } from "~/app/services/notifications/destinations";

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

```typescript {% title="app/initializers/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Database } from "remix/data-table";
import type { DestinationFactory } from "~/app/jobs/middleware/destinations";

import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { queue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";
import { destinations } from "~/app/jobs/middleware/destinations";
import { destinationFor } from "~/app/services/notifications/destinations";

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

import jobs from "~/app/jobs";
import Channels from "~/app/models/channel";

const MAX_ATTEMPTS = 4;

const RETRY_BACKOFF = createBackoff({
	base: "30 seconds",
	max: "30 minutes",
	jitter: 0.2,
});

export default createJobHandler(jobs.deliverMessage, async (ctx) => {
	let channel = await Channels.find(ctx.db, ctx.input.channelId);
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
		await Channels.markBroken(ctx.db, channel.id, error.message);
	}
	return ctx.exit(error.message, { cause: error });
});
```

`Channels` is your own model, storing each channel's `ChannelConfig`. A `retryable` failure
(rate limit, outage, timeout) retries after the delay the platform asked for, or the backoff
when it named none. `gone` means the webhook or chat no longer exists, so the channel is
marked broken for its owner to fix; every other code repeats on each attempt, so the job
exits. `MAX_ATTEMPTS` matches a queue consumer's `maxRetries` of 3, so the last delivery
exits with the failure on its log before the queue would dead-letter it.

> [!WARNING]
> Chat platforms have no idempotency key, so a retry after a `timeout` whose request did land
> posts the message a second time.

## Fan out by severity

Chat channels hear about every failure. Paging channels wake someone up, so they get only
critical messages, and the recovery that resolves them:

```typescript {% title="app/services/notifications/notify-team.ts" %}
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Message } from "@sdxc/messaging";
import type { Database } from "remix/data-table";

import jobs from "~/app/jobs";
import Channels from "~/app/models/channel";

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

A request passes `ctx.jobs` as the enqueuer, and a job passes the dispatcher. One job per
channel means a Slack outage retries the Slack delivery alone, while PagerDuty has already
paged.

`key` becomes PagerDuty's `dedup_key` and Opsgenie's `alias`, so a second failure of the same
sync updates the open incident, and `state: "resolved"` with the same key closes it. A message
without a `key` fails `invalid-message` on both services before any request.

## Sign webhooks for your customers' systems

The `webhook` channel above posts the message as JSON for a team that wants alerts in its own
tooling, signed with [Standard Webhooks](https://www.standardwebhooks.com/) headers using the
channel's secret. The delivery's `id` is the `webhook-id`, the same on every retry, so a
receiver that stores ids drops a repeat. A receiver verifies it with any Standard Webhooks
library, and `MESSAGE_SCHEMA` reads the body back into a `Message`;
[Receive and send webhooks](/docs/identity-and-security/webhooks) covers the receiving side.

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

import { createDispatcher } from "~/app/initializers/dispatcher";
import jobs from "~/app/jobs";
import { insertChannel } from "~/app/models/channel";
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
it, and `failNext` queues in order, so a test scripts a whole sequence.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  `ctx.retry`, `ctx.exit` and the consumer's `maxRetries`.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — the receiving side of a
  signed delivery, with replay protection.
- [`@sdxc/messaging`](/api/messaging) — every provider's options and error codes.
