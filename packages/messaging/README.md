# @sdxc/messaging

Send one portable message to Slack, Discord, Teams, Google Chat, Telegram, WhatsApp, ntfy, Pushover, PagerDuty, Opsgenie, browser push or a signed webhook.

A message is plain data: a title, Markdown text, a severity, fields, link buttons and an optional incident key. Each provider renders it in the platform's native format (Block Kit, a Discord embed, an Adaptive Card, Telegram HTML, a PagerDuty event) and sends it with one `fetch`. Every send answers a `Result` and makes exactly one attempt, so retrying belongs to the caller's job queue. It runs on Cloudflare Workers as is.

## Installation

```sh
npm add @sdxc/messaging
```

Sends answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The `./web-push` entry needs [`@sdxc/web-push`](https://www.npmjs.com/package/@sdxc/web-push) and `./conformance` needs [`vitest`](https://www.npmjs.com/package/vitest), both optional peers.

## Usage

### Send a message

```typescript
import type { Message } from "@sdxc/messaging";

import { SlackWebhook } from "@sdxc/messaging/slack";
import { isFailure } from "@sdxc/result";

let message: Message = {
	title: "api.example.com is down",
	text: "The check from **São Paulo** timed out after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "gru", inline: true }],
	links: [{ label: "Open dashboard", url: "https://status.example.com/monitors/1" }],
	timestamp: new Date(),
};

let sent = await new SlackWebhook({ url: webhookUrl }).send(message, { timeout: "10 seconds" });
if (isFailure(sent)) console.error(sent.error.code, sent.error.retryable);
```

### Build a destination from stored configuration

Constructing a provider does no I/O, and a credential is a string or a function answering one, so a secret is read at send time:

```typescript
import type { Destination } from "@sdxc/messaging";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { TelegramBot } from "@sdxc/messaging/telegram";
import { env } from "cloudflare:workers";

type Channel =
	| { kind: "slack" | "discord"; url: string }
	| { kind: "pagerduty"; routingKey: string }
	| { kind: "telegram"; chatId: string };

function destinationFor(channel: Channel): Destination {
	switch (channel.kind) {
		case "slack":
			return new SlackWebhook({ url: channel.url });
		case "discord":
			return new DiscordWebhook({ url: channel.url });
		case "pagerduty":
			return new PagerDuty({ routingKey: channel.routingKey });
		case "telegram":
			return new TelegramBot({ token: () => env.TELEGRAM_BOT_TOKEN, chatId: channel.chatId });
	}
}
```

### Validate a pasted URL

Every URL provider has a static `check` applying the rule a send applies, so a settings form refuses a bad URL before saving it:

```typescript
import { SlackWebhook } from "@sdxc/messaging/slack";
import { isFailure } from "@sdxc/result";

let checked = SlackWebhook.check(String(form.get("url")));
if (isFailure(checked)) return { error: "Paste a Slack incoming webhook URL" };
```

### Edit or thread under the original message

`update` and `reply` exist only where the platform can do them; `supports` narrows them. Store the `ref` a send answers as JSON:

```typescript
import { supports } from "@sdxc/messaging";
import { isSuccess } from "@sdxc/result";

let sent = await destination.send(downMessage);
if (isSuccess(sent) && sent.data.ref) await saveRef(incidentId, sent.data.ref);

let ref = await loadRef(incidentId);
if (ref && supports(destination, "update")) await destination.update(ref, recoveredMessage);
else if (ref && supports(destination, "reply")) await destination.reply(ref, recoveredMessage);
else await destination.send(recoveredMessage);
```

## API

### `Message`

| Field       | Meaning                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `title`     | Required. The push preview, the incident summary and every card's header.                                 |
| `text`      | Portable Markdown: emphasis, strikethrough, code, links, lists, quotes. Headings become bold lines.       |
| `severity`  | `"info"` (default), `"success"`, `"warning"` or `"critical"`: a color, a card style or a priority.        |
| `fields`    | `{ label, value, inline? }[]`, drawn as embed fields, a fact set or `label: value` lines.                 |
| `links`     | `{ label, url }[]`: URL buttons where the platform has them, a line of links where it does not.           |
| `timestamp` | When it happened.                                                                                         |
| `key`       | What the message is about: PagerDuty's `dedup_key`, Opsgenie's `alias`, Google Chat's thread, push `tag`. |
| `state`     | `"open"` (default) or `"resolved"`, which resolves the incident on PagerDuty and closes it on Opsgenie.   |
| `data`      | JSON for the webhook body, PagerDuty's `custom_details` and Opsgenie's `details`.                         |

Every platform limit is met by truncating with an ellipsis at a grapheme boundary.

### `MESSAGE_SCHEMA`

A `remix/data-schema` schema parsing a message's JSON form (an ISO `timestamp`) back into a `Message`, for a job or queue payload.

### `Destination`

`send(message, options?)` always; `update(ref, message, options?)` and `reply(ref, message, options?)` where the platform supports them. `SendOptions` takes `id` (stable across retries of one delivery), `timeout` (default `"10 seconds"`) and `signal`. A success answers `{ ref }`: a `SentRef` to store for a later `update` or `reply`, or `null` when the platform answers no message id. A ref from another provider fails `invalid-ref` before any request.

### `supports(destination, capability)`

Whether the destination implements `"update"` or `"reply"`, narrowing that method to present.

### `MessagingError`

The failure inside every `Result`, with `code`, `provider`, `host`, `status`, `retryAfter` (milliseconds, from `Retry-After` or the body) and `retryable`. It names the host, never the URL or a token.

| `code`                | Retryable | When                                                              |
| --------------------- | --------- | ----------------------------------------------------------------- |
| `invalid-message`     | No        | The provider cannot express it, such as a resolve without a `key` |
| `invalid-destination` | No        | The URL fails `check`, or names a private or reserved host        |
| `invalid-ref`         | No        | `update` or `reply` was given another provider's ref              |
| `unauthorized`        | No        | A rejected token or routing key                                   |
| `gone`                | No        | The channel, webhook, chat or subscription no longer exists       |
| `outside-window`      | No        | WhatsApp refused a message outside the customer-service window    |
| `rejected`            | No        | Any other `4xx`, or a redirect                                    |
| `rate-limited`        | Yes       | `429`                                                             |
| `unavailable`         | Yes       | `5xx`, or a credential function that threw                        |
| `timeout`             | Yes       | The deadline passed                                               |
| `network`             | Yes       | `fetch` rejected                                                  |

Chat platforms have no idempotency key, so a retry after a `timeout` whose request did land posts the message twice.

### `writeText(markdown, dialect, maxLength?)` and `fitText(text, maxLength, escape?)`

`writeText` writes portable Markdown in a platform's dialect, escaping literal text so `<prod>_api*` arrives as typed, and cuts it to fit `maxLength`. `fitText` cuts literal text, such as a title, to a limit and escapes it. The dialects are `mrkdwn` (Slack, Google Chat), `discordMarkdown`, `teamsMarkdown`, `telegramHtml`, `whatsappText`, `pushoverHtml` and `plainText`, plus `ntfyMarkdown` from `./ntfy`.

### `SEVERITY_COLORS`

The `#rrggbb` color each severity is drawn in, shared by every platform that colors a message.

### Providers

Each provider lives behind its own subpath and has a public, pure `render(message)` answering the exact body it sends, which a subclass overrides.

| Import                        | Class               | Configured with                                                 | `update`, `reply`                  |
| ----------------------------- | ------------------- | --------------------------------------------------------------- | ---------------------------------- |
| `@sdxc/messaging/slack`       | `SlackWebhook`      | `url` on `hooks.slack.com`                                      | No                                 |
| `@sdxc/messaging/slack`       | `SlackBot`          | `token`, `channel`                                              | `chat.update`, `thread_ts`         |
| `@sdxc/messaging/discord`     | `DiscordWebhook`    | `url` on `discord.com`, `threadId?`                             | Edit; reply when `threadId` is set |
| `@sdxc/messaging/teams`       | `TeamsWorkflow`     | A Workflows webhook `url`, `resolve?`                           | No                                 |
| `@sdxc/messaging/google-chat` | `GoogleChatWebhook` | `url` on `chat.googleapis.com`                                  | No; `key` threads                  |
| `@sdxc/messaging/telegram`    | `TelegramBot`       | `token`, `chatId`, `messageThreadId?`                           | `editMessageText`, reply           |
| `@sdxc/messaging/whatsapp`    | `WhatsAppCloud`     | `accessToken`, `phoneNumberId`, `to`, `template`, `apiVersion?` | No                                 |
| `@sdxc/messaging/ntfy`        | `Ntfy`              | `topic`, `server?`, `token?`, `resolve?`                        | No                                 |
| `@sdxc/messaging/pushover`    | `Pushover`          | `token`, `user`, `device?`, `sound?`, `emergency?`              | No                                 |
| `@sdxc/messaging/pagerduty`   | `PagerDuty`         | `routingKey`, `source?`, `component?`, `group?`, `class?`       | Resolves by `key`                  |
| `@sdxc/messaging/opsgenie`    | `Opsgenie`          | `apiKey`, `region?`, `responders?`, `tags?`, `source?`          | Closes by `key`                    |
| `@sdxc/messaging/web-push`    | `BrowserPush`       | `push` (a `WebPush`), `subscription`, `ttl?`                    | No; `key` replaces                 |
| `@sdxc/messaging/webhook`     | `Webhook`           | `url`, `secret`, `resolve?`                                     | No                                 |

`SlackWebhook`, `DiscordWebhook` and `GoogleChatWebhook` accept only their platform's host. `TeamsWorkflow`, `Ntfy` and `Webhook` accept any public URL and refuse private and reserved hosts; `resolve: true` also refuses a name that resolves to a private address. Redirects fail.

`Pushover` sends a `critical` message at high priority, or at emergency priority repeating until acknowledged when `emergency: { retry, expire }` is set. `WhatsAppCloud` sends approved templates only. `Webhook` posts the message as JSON signed with [Standard Webhooks](https://www.standardwebhooks.com/) headers, using `SendOptions.id` as the `webhook-id`; a subclass overrides `render(message, delivery)` and the protected `sign(body, context)`.

The builders each `render` uses are exported beside its class for an override to reuse: `slackBlocks`, `discordEmbed`, `teamsCard`, `googleChatCard`, `telegramText`, `webhookEnvelope` and WhatsApp's `normalizeParameter`.

### `MemoryDestination`

From `@sdxc/messaging/memory`: a destination for an app's tests. It records each successful call in `messages` (and `last`) with its `kind`, `message`, `ref` and `parent`, declares the `capabilities` it is given, and fails on cue with `failNext({ code, status?, retryAfter? })`.

### `describeDestination(options)`

From `@sdxc/messaging/conformance`: registers the Vitest suite every destination passes. It sends, checks the declared `capabilities`, refuses a foreign ref, and expects a rate limit arranged by `rateLimitNext(delayMs)` to be retryable with that delay.

### Types

`Message`, `MessageField`, `MessageLink`, `MessageData`, `MessageState` and `Severity` describe a message. `Destination`, `SendOptions`, `Sent`, `SentRef`, `OptionalCapability` and `Secret` (a string or a function answering one) describe a provider. `MessagingErrorCode`, `MessagingErrorOptions` and `Dialect` round out the main entry. Each provider subpath also exports its options and payload types, such as `SlackWebhookOptions` and `SlackWebhookPayload`.

## Pattern: Retrying From A Job

A provider makes one attempt. Retry from the job that sends, so the delay survives the isolate, and keep the destination's URL or token out of the payload by queuing only an id:

```typescript
import type { Destination, Message } from "@sdxc/messaging";

import { isSuccess } from "@sdxc/result";

/** Reads the stored channel and builds its provider, as `destinationFor` above does. */
declare function loadDestination(channelId: string): Promise<Destination>;
declare function markChannelBroken(id: string): Promise<void>;

const MAX_ATTEMPTS = 6;

async function deliver(
	input: { channelId: string; deliveryId: string; message: Message },
	attempt: number,
) {
	let destination = await loadDestination(input.channelId);
	let sent = await destination.send(input.message, { id: input.deliveryId });
	if (isSuccess(sent)) return { done: true };

	let error = sent.error;
	if (error.retryable && attempt < MAX_ATTEMPTS) {
		return { retryIn: error.retryAfter ?? 30_000 * 2 ** attempt };
	}
	if (error.code === "gone") await markChannelBroken(input.channelId);
	return { done: true, failed: error.code };
}
```

Parse the payload back with `MESSAGE_SCHEMA`, which turns the ISO `timestamp` into a `Date`:

```typescript
import { MESSAGE_SCHEMA } from "@sdxc/messaging";
import * as s from "remix/data-schema";

let DeliverInput = s.object({
	channelId: s.string(),
	deliveryId: s.string(),
	message: MESSAGE_SCHEMA,
});
```

## Pattern: Opening And Resolving An Incident

PagerDuty and Opsgenie read `key` and `state`: the same `key` with `state: "resolved"` resolves or closes what `state: "open"` opened. A message without a `key` fails `invalid-message`.

```typescript
import type { Message } from "@sdxc/messaging";

import { Opsgenie } from "@sdxc/messaging/opsgenie";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { env } from "cloudflare:workers";

let destinations = [
	new PagerDuty({ routingKey: () => env.PAGERDUTY_ROUTING_KEY, source: "checkout-api" }),
	new Opsgenie({ apiKey: () => env.OPSGENIE_API_KEY, region: "eu", tags: ["checkout"] }),
];

let down: Message = {
	title: "Checkout is failing",
	severity: "critical",
	key: "checkout",
	data: { errorRate: 0.42 },
};
let recovered: Message = { title: "Checkout recovered", key: "checkout", state: "resolved" };

for (let destination of destinations) await destination.send(down);
for (let destination of destinations) await destination.send(recovered);
```

## Pattern: Notifying A Browser

Build one `WebPush` sender per batch, so browsers on one push service share one VAPID signature. The `key` is the push's `tag` and `Topic`, so a resolved message replaces the open one and an offline browser receives only the latest; a `critical` message goes out with high urgency. A `gone` failure means the browser unsubscribed.

```typescript
import { BrowserPush } from "@sdxc/messaging/web-push";
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";
import { env } from "cloudflare:workers";

let push = new WebPush({
	vapid: {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: "mailto:ops@example.com",
	},
});

for (let subscription of subscriptions) {
	let sent = await new BrowserPush({ push, subscription, ttl: "1 day" }).send(message);
	if (isFailure(sent) && sent.error.code === "gone") await deleteSubscription(subscription);
}
```

The service worker receives `{ title, body, url?, tag?, severity, timestamp? }`, with the text and fields as plain text in `body`, and draws it:

```typescript
declare let self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
	let payload = event.data?.json();
	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			data: { url: payload.url },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	let url = event.notification.data?.url;
	if (url) event.waitUntil(self.clients.openWindow(url));
});
```

## Pattern: Sending A WhatsApp Template

WhatsApp accepts free-form text only within 24 hours of the recipient's last message, so `WhatsAppCloud` sends an approved template. `parameters` maps the message onto the template body's `{{1}}`, `{{2}}`… in order, and links come from the template's own buttons.

```typescript
import { WhatsAppCloud } from "@sdxc/messaging/whatsapp";
import { env } from "cloudflare:workers";

let whatsapp = new WhatsAppCloud({
	accessToken: () => env.WHATSAPP_ACCESS_TOKEN,
	phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
	to: "+5511999990000",
	template: {
		name: "incident_alert",
		language: "en",
		parameters: (message) => [message.title, message.fields?.[0]?.value ?? "unknown"],
	},
});

let sent = await whatsapp.send(message);
```

A `parameters` function that throws fails the send as `invalid-message`.

## Pattern: Changing A Platform's Layout

Subclass the provider and override `render`; the send, checks and error mapping stay as they are. The dialect writers keep a custom layout within the platform's escaping and limits:

```typescript
import type { Message } from "@sdxc/messaging";

import { fitText, telegramHtml, writeText } from "@sdxc/messaging";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { TelegramBot } from "@sdxc/messaging/telegram";

class CompactSlack extends SlackWebhook {
	override render(message: Message) {
		let payload = super.render(message);
		payload.attachments[0].blocks = payload.attachments[0].blocks.filter(
			(block) => block.type !== "context",
		);
		return payload;
	}
}

class TerseTelegram extends TelegramBot {
	override render(message: Message) {
		let payload = super.render(message);
		let title = telegramHtml.strong(fitText(message.title, 120, telegramHtml.escape));
		let text = message.text ? writeText(message.text, telegramHtml, 1_000) : "";
		payload.text = text === "" ? title : `${title}\n\n${text}`;
		return payload;
	}
}
```

## Pattern: A Webhook With Its Own Signature

`Webhook` signs with Standard Webhooks. A receiver expecting another scheme gets a subclass overriding `sign`, and a body of its own by overriding `render`:

```typescript
import type { Message } from "@sdxc/messaging";
import type { WebhookDelivery, WebhookSignContext } from "@sdxc/messaging/webhook";

import { webhookEnvelope, Webhook } from "@sdxc/messaging/webhook";
import { success } from "@sdxc/result";

class HmacWebhook extends Webhook {
	override render(message: Message, delivery: WebhookDelivery) {
		return { event: "alert", id: delivery.id, ...webhookEnvelope(message) };
	}

	protected override async sign(body: string, context: WebhookSignContext) {
		let encoder = new TextEncoder();
		let key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(context.secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		let mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
		let hex = Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
		return success(new Headers({ "X-Signature": `sha256=${hex}` }));
	}
}

await new HmacWebhook({ url: endpoint, secret: () => env.WEBHOOK_SECRET }).send(message, {
	id: deliveryId,
});
```

## Pattern: Testing Code That Sends

`MemoryDestination` stands in for any provider in an app's tests, and `describeDestination` checks a provider of your own against the contract every destination keeps:

```typescript
import { describeDestination } from "@sdxc/messaging/conformance";
import { MemoryDestination } from "@sdxc/messaging/memory";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

test("sends the alert once the platform recovers", async () => {
	let destination = new MemoryDestination();
	destination.failNext({ code: "rate-limited", retryAfter: 30_000 });

	let first = await destination.send(message);
	expect(isFailure(first) && first.error.retryAfter).toBe(30_000);

	await destination.send(message);
	expect(destination.messages).toHaveLength(1);
	expect(destination.last?.message.title).toBe(message.title);
});

let current: MemoryDestination;

describeDestination({
	name: "memory",
	create: () => (current = new MemoryDestination({ capabilities: ["update", "reply"] })),
	capabilities: ["update", "reply"],
	rateLimitNext: (delayMs) => current.failNext({ code: "rate-limited", retryAfter: delayMs }),
});
```

For an HTTP provider, `rateLimitNext` installs a handler answering `429` with `Retry-After`, such as an [MSW](https://mswjs.io/) handler.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/messaging": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
