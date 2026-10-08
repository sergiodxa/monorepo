# @sdxc/messaging

Send one portable message to Slack, Discord, Microsoft Teams, Google Chat, Telegram, WhatsApp, ntfy, Pushover, PagerDuty, Opsgenie or a signed webhook.

A message is plain data: a title, Markdown text, a severity, fields, link buttons, and an optional incident key. Each provider renders it in the platform's native format (Block Kit, a Discord embed, an Adaptive Card, Telegram HTML, a PagerDuty event) and sends it with one call to the global `fetch`. Every send answers a `Result`, never throws, and makes exactly one attempt, so retrying stays with the caller's job queue. No vendor SDK and no Node built-in is involved, so it runs on Cloudflare Workers as is.

## Installation

```bash
npm add @sdxc/messaging
```

Every send answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package. The `@sdxc/messaging/conformance` entry needs [`vitest`](https://www.npmjs.com/package/vitest).

## Usage

### Sending A Message

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

### Choosing A Destination From Configuration

Constructing a provider does no I/O, so build one wherever a stored configuration is read:

```typescript
import type { Destination } from "@sdxc/messaging";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { TelegramBot } from "@sdxc/messaging/telegram";

function destinationFor(config: ChannelConfig): Destination {
	switch (config.kind) {
		case "slack":
			return new SlackWebhook({ url: config.url });
		case "discord":
			return new DiscordWebhook({ url: config.url });
		case "pagerduty":
			return new PagerDuty({ routingKey: config.routingKey });
		case "telegram":
			return new TelegramBot({ token: () => env.TELEGRAM_BOT_TOKEN, chatId: config.chatId });
	}
}
```

A credential is a string or a function answering one, so a secret is read at send time.

### Validating A Pasted URL

Every URL provider has a static `check` that applies the rule a send applies, so a settings form refuses a bad URL before it is saved:

```typescript
import { SlackWebhook } from "@sdxc/messaging/slack";
import { isFailure } from "@sdxc/result";

let checked = SlackWebhook.check(form.get("url"));
if (isFailure(checked)) return { error: "Paste a Slack incoming webhook URL" };
```

### Editing Or Threading The Original Message

`update` and `reply` exist only on providers whose platform can do them; `supports` narrows them:

```typescript
import { supports } from "@sdxc/messaging";
import { isSuccess } from "@sdxc/result";

let sent = await destination.send(downMessage);
if (isSuccess(sent) && sent.data.ref) await saveRef(incidentId, sent.data.ref);

let ref = await loadRef(incidentId);
if (ref && supports(destination, "update")) await destination.update(ref, resolvedMessage);
else await destination.send(resolvedMessage);
```

### Resolving An Incident

PagerDuty and Opsgenie read `key` and `state`: the same `key` with `state: "resolved"` resolves or closes what `state: "open"` triggered.

```typescript
import { PagerDuty } from "@sdxc/messaging/pagerduty";

let pagerduty = new PagerDuty({ routingKey: () => env.PAGERDUTY_ROUTING_KEY });

await pagerduty.send({ title: "Checkout is failing", severity: "critical", key: "checkout" });
await pagerduty.send({ title: "Checkout recovered", key: "checkout", state: "resolved" });
```

## API

### `Message`

| Field       | Meaning                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `title`     | Required. The push preview, the incident summary and every card's header.                               |
| `text`      | Portable Markdown: emphasis, strikethrough, code, links, lists, quotes. Headings become bold lines.     |
| `severity`  | `"info"` (default), `"success"`, `"warning"` or `"critical"`: a color, a card style or a priority.      |
| `fields`    | `{ label, value, inline? }[]`, drawn as embed fields, a fact set or `label: value` lines.               |
| `links`     | `{ label, url }[]`: URL buttons where the platform has them, a line of links where it does not.         |
| `timestamp` | When it happened.                                                                                       |
| `key`       | What the message is about: PagerDuty's `dedup_key`, Opsgenie's `alias`, Google Chat's `threadKey`.      |
| `state`     | `"open"` (default) or `"resolved"`, which resolves the incident on PagerDuty and closes it on Opsgenie. |
| `data`      | JSON for the webhook body, PagerDuty's `custom_details` and Opsgenie's `details`.                       |

Every limit a platform sets is met by truncating with an ellipsis, never by failing; the cut lands at a grapheme boundary before escaping.

### `MESSAGE_SCHEMA`

A `remix/data-schema` schema that parses a message's JSON form (an ISO `timestamp`) back into a `Message`, for a job payload:

```typescript
import { MESSAGE_SCHEMA } from "@sdxc/messaging";
import * as s from "remix/data-schema";

let DeliverInput = s.object({ alertId: s.string(), message: MESSAGE_SCHEMA });
```

### `Destination`

`send(message, options?)` always; `update(ref, message, options?)` and `reply(ref, message, options?)` where the platform supports them. `options` takes `id` (stable across retries of one delivery), `timeout` (default `"10 seconds"`) and `signal`. A success answers `{ ref }`: a `SentRef` to store as JSON for a later `update` or `reply`, or `null` when the platform answers no message id. An `update` given another provider's ref fails `invalid-ref` before any request.

### `supports(destination, capability)`

Whether the destination implements `"update"` or `"reply"`, narrowing the method to present.

### `MessagingError`

The failure inside every `Result`, with `code`, `provider`, `host`, `status`, `retryable` and `retryAfter` (milliseconds, from `Retry-After` or the body). It names the host and never the URL or a token.

| `code`                | Retryable | When                                                                    |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| `invalid-message`     | No        | The provider cannot express it, such as a resolve without a `key`       |
| `invalid-destination` | No        | The URL fails `check`, or names a private or reserved host              |
| `invalid-ref`         | No        | `update` or `reply` was given another provider's ref                    |
| `unauthorized`        | No        | A rejected token or routing key                                         |
| `gone`                | No        | The channel, webhook or chat no longer exists: stop sending, tell owner |
| `outside-window`      | No        | WhatsApp refused a message outside the customer-service window          |
| `rejected`            | No        | Any other `4xx`, or a redirect                                          |
| `rate-limited`        | Yes       | `429`                                                                   |
| `unavailable`         | Yes       | `5xx`                                                                   |
| `timeout`             | Yes       | The deadline passed                                                     |
| `network`             | Yes       | `fetch` rejected                                                        |

A chat platform has no idempotency key, so a retry after a `timeout` whose request did land posts the message twice.

### Dialect Writers

`writeText(markdown, dialect, maxLength?)` writes portable Markdown in a platform's dialect, escaping literal text so a name like `<prod>_api*` arrives as typed: `mrkdwn` (Slack, Google Chat), `discordMarkdown`, `teamsMarkdown`, `telegramHtml`, `whatsappText`, `pushoverHtml` and `plainText`. `fitText(text, maxLength, escape?)` cuts literal text to a limit. `SEVERITY_COLORS` holds the color each severity is drawn in. A `render` override reuses them.

### Providers

Each provider lives behind its own subpath, and each has a public, pure `render(message)` answering the exact body it sends.

| Import                        | Class               | Configured with                                  | `update`, `reply`             |
| ----------------------------- | ------------------- | ------------------------------------------------ | ----------------------------- |
| `@sdxc/messaging/slack`       | `SlackWebhook`      | `url` on `hooks.slack.com`                       | No                            |
| `@sdxc/messaging/slack`       | `SlackBot`          | `token`, `channel`                               | `chat.update`, `thread_ts`    |
| `@sdxc/messaging/discord`     | `DiscordWebhook`    | `url` on `discord.com`, `threadId?`              | Edit; reply with a `threadId` |
| `@sdxc/messaging/teams`       | `TeamsWorkflow`     | A Workflows webhook `url`                        | No                            |
| `@sdxc/messaging/google-chat` | `GoogleChatWebhook` | `url` on `chat.googleapis.com`                   | No; `key` threads             |
| `@sdxc/messaging/telegram`    | `TelegramBot`       | `token`, `chatId`, `messageThreadId?`            | `editMessageText`, reply      |
| `@sdxc/messaging/whatsapp`    | `WhatsAppCloud`     | `accessToken`, `phoneNumberId`, `to`, `template` | No                            |
| `@sdxc/messaging/ntfy`        | `Ntfy`              | `topic`, `server?`, `token?`                     | No                            |
| `@sdxc/messaging/pushover`    | `Pushover`          | `token`, `user`, `emergency?`                    | No                            |
| `@sdxc/messaging/pagerduty`   | `PagerDuty`         | `routingKey`                                     | Resolves by `key`             |
| `@sdxc/messaging/opsgenie`    | `Opsgenie`          | `apiKey`, `region?`                              | Closes by `key`               |
| `@sdxc/messaging/webhook`     | `Webhook`           | `url`, `secret`                                  | No                            |

`SlackWebhook`, `DiscordWebhook` and `GoogleChatWebhook` accept only their platform's own host. `TeamsWorkflow`, `Ntfy` and `Webhook` accept any URL on the public internet, refusing private and reserved hosts, and take `resolve: true` to also refuse a name that resolves to a private address. A redirect is a failure and is never followed.

`WhatsAppCloud` sends approved templates only, since WhatsApp accepts free-form text only inside the 24 hours after the recipient last wrote. `template.parameters(message)` maps the message onto the template's body parameters.

`Webhook` posts the message as JSON (`{ "type": "message", "title": …, "timestamp": "…" }`), signed with [Standard Webhooks](https://www.standardwebhooks.com/) headers, using `SendOptions.id` as the `webhook-id` so a receiver drops a retried delivery.

### `MemoryDestination`

From `@sdxc/messaging/memory`: a destination for an app's tests. It records each successful call in `messages` (and `last`), declares whichever capabilities it is given, and fails on cue:

```typescript
import { MemoryDestination } from "@sdxc/messaging/memory";

let destination = new MemoryDestination({ capabilities: ["update"] });
destination.failNext({ code: "rate-limited", retryAfter: 30_000 });

await destination.send(message); // failure: rate-limited, retryable
await destination.send(message); // success: { ref: { provider: "memory", id: "1" } }
destination.messages.length; // 1
```

### `describeDestination(options)`

From `@sdxc/messaging/conformance`: registers Vitest tests every destination must pass. It sends, checks the declared capabilities, refuses a foreign ref, and expects a rate limit to be retryable with the delay the platform named. `rateLimitNext(delayMs)` arranges the platform's next answer, such as an MSW handler.

## Patterns

### Pattern: Retrying From A Job

A provider makes one attempt. Retry from the job that sends, so the delay survives the isolate and only the caller decides how long a message stays worth sending. Keep the destination's URL or token out of the queue payload by sending only an id:

```typescript
import type { Message } from "@sdxc/messaging";

import { isSuccess } from "@sdxc/result";

const MAX_ATTEMPTS = 6;

async function deliver(
	input: { channelId: string; deliveryId: string; message: Message },
	attempt: number,
) {
	let destination = destinationFor(await loadChannel(input.channelId));
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

### Pattern: Changing A Platform's Layout

Subclass the provider and override `render`; the send, checks and error mapping stay the same:

```typescript
import type { Message } from "@sdxc/messaging";

import { SlackWebhook } from "@sdxc/messaging/slack";

class CompactSlack extends SlackWebhook {
	override render(message: Message) {
		let payload = super.render(message);
		payload.attachments[0].blocks = payload.attachments[0].blocks.filter(
			(block) => block.type !== "context",
		);
		return payload;
	}
}
```

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
