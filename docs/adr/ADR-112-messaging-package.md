# ADR-112: Messaging Package

## Status

**Accepted** - 2026-10-07

## Background

Apps in the repo tell people that something happened: a monitor went down, a feed published, a
support request arrived. Email has a package (`@sdxc/mail`) and browser push has its own
protocol code. Every other destination people ask for is a chat or paging service: Slack,
Discord, Microsoft Teams, Google Chat, Telegram, WhatsApp, PagerDuty, Opsgenie, ntfy, Pushover,
or a plain HTTP endpoint.

Today only `uptime` sends to any of them. It does that with three bare `fetch` calls that post
plain text, sign one of them by hand, never retry and never read what the service answered.
Its marketing pages promise PagerDuty and Opsgenie, which it reaches only through a generic
JSON webhook neither service accepts. Before a second app writes its own Slack call, this ADR
decides what a shared package for sending looks like, and whether that package is the send
half of a full chat-bot SDK such as Vercel's Chat SDK.

## Context

### Current senders

| Location                                              | Destination     | Body                                                      | Retry | Reads the answer       |
| ----------------------------------------------------- | --------------- | --------------------------------------------------------- | ----- | ---------------------- |
| `apps/uptime/app/services/alerts.ts` `deliverSlack`   | Slack webhook   | `{ text: "*subject*\nlines" }`, plus a `channel` override | No    | Status only            |
| `apps/uptime/app/services/alerts.ts` `deliverDiscord` | Discord webhook | `{ content: "**subject**\nlines" }`                       | No    | Status only            |
| `apps/uptime/app/services/alerts.ts` `deliverWebhook` | Any URL         | Uptime's JSON, `Webhook-Signature: sha256=<hex>`          | No    | Status only            |
| `apps/uptime/app/services/alerts.ts` `hmacSha256Hex`  | n/a             | A local HMAC helper beside `@sdxc/webhooks`' `sign`       | n/a   | n/a                    |
| `apps/uptime/database/schema.ts` alert `config`       | n/a             | `webhook`, `email`, `slack`, `discord` strategies         | n/a   | n/a                    |
| `apps/reader/database/notify.ts`                      | Web push, email | New-post summaries, with gap and quiet-hour rules         | n/a   | Push status per device |
| `apps/blog/app/http/middleware/support-desk.ts`       | Email           | Encore support requests to an inbox                       | n/a   | n/a                    |

`uptime`'s ADR-002 records that alert delivery failures are written to `alert_events` as
`failed` and **never retried**. `uptime`'s marketing copy
(`apps/uptime/resources/content/marketing.ts`) says alerts integrate with "Slack, Discord,
PagerDuty, and more" and that signed JSON payloads reach "PagerDuty, Opsgenie, or your own
service".

### Issues identified

| Issue                                              | Impact                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Alerts are plain text                              | No color, no fields, no button to the dashboard; each platform shows the same flat paragraph                                     |
| No retries                                         | A Slack `429` or a Discord blip during an outage loses the alert that mattered most                                              |
| The answer is never read                           | A deleted Slack channel or Discord webhook fails every alert forever, and nobody is told the channel is dead                     |
| Slack's `channel` override                         | Slack app webhooks ignore it; only legacy custom-integration webhooks honor it, so the field is configuration that does nothing  |
| PagerDuty and Opsgenie are promised but not spoken | PagerDuty Events v2 needs `routing_key`, `event_action` and `dedup_key`; a generic JSON body is rejected                         |
| Recovery is a second, unrelated message            | Nothing ties "back up" to "down": no edit in place, no thread reply, no PagerDuty `resolve`                                      |
| Webhook URLs are credentials and user-supplied     | Anyone holding the URL can post to the channel, and the URL is whatever the user typed, so it is both a secret and an SSRF input |

### What the platforms require

| Platform        | Send endpoint                              | Credential                        | Rich format                              | Edit later                 | Thread                         |
| --------------- | ------------------------------------------ | --------------------------------- | ---------------------------------------- | -------------------------- | ------------------------------ |
| Slack (webhook) | The webhook URL                            | The URL                           | Block Kit, `mrkdwn`                      | No (answers `ok`, no `ts`) | No                             |
| Slack (bot)     | `chat.postMessage`                         | Bot token + channel id            | Block Kit, `mrkdwn`                      | `chat.update` by `ts`      | `thread_ts`                    |
| Discord         | The webhook URL, `?wait=true`              | The URL                           | Embeds (color, fields), Discord markdown | `PATCH …/messages/{id}`    | `thread_id` in thread channels |
| Microsoft Teams | A Workflows webhook URL                    | The URL                           | Adaptive Card in a `message` envelope    | No                         | No                             |
| Google Chat     | The space webhook URL                      | The URL (`key` and `token` query) | `cardsV2`, Google Chat text format       | No (needs app auth)        | `threadKey`, caller-chosen     |
| Telegram        | `api.telegram.org/bot<token>/sendMessage`  | Bot token + `chat_id`             | `parse_mode: "HTML"`, URL inline buttons | `editMessageText`          | `reply_parameters`, topics     |
| WhatsApp Cloud  | `graph.facebook.com/…/{phone-id}/messages` | Access token + phone number id    | Approved templates outside a 24h window  | No                         | No                             |
| ntfy            | `<server>/<topic>`                         | Optional bearer token             | Markdown, `Priority`, `Click`, `Actions` | No                         | No                             |
| Pushover        | `api.pushover.net/1/messages.json`         | App token + user key              | HTML subset, one URL, priority           | No                         | No                             |
| PagerDuty       | `events.pagerduty.com/v2/enqueue`          | Integration routing key           | `summary`, `custom_details`, `links`     | `resolve` by `dedup_key`   | n/a                            |
| Opsgenie        | `api.opsgenie.com/v2/alerts`               | API key                           | `message`, `description`, `details`      | `close` by `alias`         | n/a                            |

Two shapes recur. Webhook-URL platforms (Slack and Discord webhooks, Teams, Google Chat, ntfy)
take a URL that is the credential, and the URL changes per destination. Token platforms (Slack
bot, Telegram, WhatsApp, Pushover, PagerDuty, Opsgenie) are a fixed origin plus a credential
and a recipient id, which is the shape `@sdxc/api-client` already gives `billing`'s providers.

Microsoft is retiring Office 365 Connectors, the old Teams Incoming Webhook, in favor of
Workflows webhooks, so only the Workflows shape is worth building. Atlassian has stopped
selling Opsgenie and announced its end of support for April 2027, moving customers to Jira
Service Management.

### Vercel's Chat SDK

[Chat SDK](https://chat-sdk.dev) (`chat` on npm, 4.41 at the time of writing, MIT) is a
framework for **bots**: a `Chat` instance takes a map of adapters and a state adapter, routes
inbound webhooks (`bot.webhooks.slack(request, { waitUntil })`) to handlers such as
`onNewMention` and `onSubscribedMessage`, and hands each handler a `Thread` to `post`,
`subscribe`, stream into, edit and react on. Proactive sends go through
`bot.channel("slack:C123").post(…)` and `bot.openDM(…)`. Messages are a string, `{ markdown }`,
an mdast AST, or a card written in JSX with its own runtime (`jsxImportSource: "chat"`:
`Card`, `CardText`, `Fields`, `Field`, `Button`, `LinkButton`, `Actions`, `Image`, `Divider`)
or with the equivalent `Card({ … })` functions. Each adapter renders a card natively (Block
Kit, Adaptive Cards, Discord embeds, Google Chat cards) and falls back to `fallbackText`
elsewhere. Streaming uses a platform's native streaming or falls back to post-then-edit.

What it would bring into a Worker, read from the published manifests:

| Package                              | Dependencies                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `chat`                               | `unified`, `remark-*`, `@workflow/serde`; peers `ai`, `zod`, `workflow`; `node >= 20` |
| `@chat-adapter/slack`                | `@slack/web-api`, `@slack/socket-mode`                                                |
| `@chat-adapter/discord`              | `discord.js`, `discord-interactions`                                                  |
| `@chat-adapter/teams`                | `@microsoft/teams.api`, `.apps`, `.cards`, `.graph-endpoints`                         |
| `@chat-adapter/gchat`                | `@googleapis/chat`, `@googleapis/workspaceevents`                                     |
| `@chat-adapter/telegram`, `whatsapp` | Only the shared adapter helpers                                                       |
| State                                | `state-redis` (`redis`), `state-ioredis`, `state-pg` (`pg`), `state-memory`           |

`state` is a required option of `Chat`, used for subscriptions, locks and deduplication of
inbound events; none of the shipped state adapters is a KV, D1 or Durable Object store.
Adapters are configured with a bot token or app credentials the operator owns
(`SLACK_BOT_TOKEN`, `DISCORD_BOT_TOKEN`); none takes a Slack or Discord incoming-webhook URL,
which is what `uptime`'s users paste. There is no PagerDuty, Opsgenie, ntfy, Pushover or
generic-webhook adapter, since those services are not chats.

## Decision

Add `@sdxc/messaging`: one portable `Message`, one `Destination` contract with a provider per
service behind its own subpath, and pure renderers that turn the message into each service's
native payload. Sending is the whole scope. Receiving events, bots and interactive callbacks
are not part of it.

### The name

`@sdxc/messaging` names the medium, the way `@sdxc/mail` does: messages to people on messaging
services. The placeholder `notify` is a verb, and "notification" is already what `reader` and a
future `@sdxc/web-push` call a browser push, so the two would read as one feature.

| Candidate  | Why not                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notify`   | A verb, and "notification" is the push channel's word                                                                                                  |
| `chat`     | Promises a bidirectional bot SDK and shadows Vercel's `chat`; PagerDuty and Pushover are not chats. Left free for a bot package, should one ever exist |
| `alerts`   | `reader`'s new-post summaries and the support desk are not alerts                                                                                      |
| `channels` | "Channel" is a field inside Slack, Discord and Telegram destinations, and a Web platform type                                                          |
| `dispatch` | `@sdxc/jobs` already has a dispatcher                                                                                                                  |
| `webhooks` | Taken, and it is the signing and verifying layer this package uses for one of its providers                                                            |

"Message" also names a queue message in `@sdxc/jobs`. Inside this package the word only ever
means the portable message, and a job that delivers one carries it as a field of its payload.

### The message

A message is plain data: it is built from a monitor's state in a job, carried in a queue
payload, and stored beside the delivery it produced, so it is a JSON-serializable object and
not a component tree.

```ts
import type { Message } from "@sdxc/messaging";

let message: Message = {
	title: "api.example.com is down",
	text: "The check from **São Paulo** timed out after `30s`.\n\n[Runbook](https://wiki.example.com/api)",
	severity: "critical", // "info" | "success" | "warning" | "critical"; default "info"
	fields: [
		{ label: "Monitor", value: "api.example.com", inline: true },
		{ label: "Region", value: "gru", inline: true },
	],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/monitors/m_1" }],
	timestamp: new Date(),
	key: "incident_8f1c", // what the message is about, for providers that group by it
	state: "open", // "open" | "resolved"
	data: { monitorId: "m_1", status: "timeout" }, // machine-readable, for webhook and incident providers
};
```

- `title` is required. It is the push preview on ntfy and Pushover, the `summary` on PagerDuty,
  the `message` on Opsgenie and the header of every card, so every provider has one.
- `text` is portable Markdown: emphasis, strikethrough, inline code, code blocks, links,
  lists and quotes. It is parsed once with `@sdxc/markdown` and written in each platform's
  dialect. A heading becomes a bold line; a table or image is written as its plain text.
- `links` are URL buttons where the platform has them and a line of links where it does not.
  They only open a URL, since a button that calls back needs an inbound endpoint.
- `key` and `state` describe an incident lifecycle. Incident providers turn them into
  `dedup_key` + `resolve` (PagerDuty) or `alias` + `close` (Opsgenie); Google Chat uses `key`
  as its `threadKey`, so every message about one incident lands in one thread with nothing
  stored.
- `data` goes to providers that carry structured data: the generic webhook body,
  PagerDuty `custom_details`, Opsgenie `details`.

`MESSAGE_SCHEMA`, built with `remix/data-schema` through `@sdxc/validate`, parses the JSON form
(an ISO `timestamp`) back into a `Message`, so a job declares `input: s.object({ message:
MESSAGE_SCHEMA, … })`.

### Destinations

A destination is one place a message goes, built from that place's configuration. A
provider is a class; constructing one does no I/O, so an app builds one per stored
configuration wherever it needs it.

```ts
import type { Destination } from "@sdxc/messaging";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { TelegramBot } from "@sdxc/messaging/telegram";

let slack: Destination = new SlackWebhook({ url: config.webhookUrl });
let discord: Destination = new DiscordWebhook({ url: config.webhookUrl });
let pagerduty: Destination = new PagerDuty({ routingKey: config.routingKey });
let telegram: Destination = new TelegramBot({
	token: () => env.TELEGRAM_BOT_TOKEN,
	chatId: config.chatId,
});

let sent = await slack.send(message, { id: deliveryId, timeout: "10 seconds" });
// Result<Sent, MessagingError>
```

The contract:

```ts
export interface Destination {
	readonly provider: string;
	send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>>;
	update?(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>>;
	reply?(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>>;
}

export interface SendOptions {
	/** Stable across retries of one delivery; the webhook's `webhook-id`, Opsgenie's request id. */
	id?: string;
	timeout?: DurationInput; // default "10 seconds"
	signal?: AbortSignal;
}

export interface Sent {
	/** What `update` and `reply` need later, or `null` when the platform answers no message id. */
	ref: SentRef | null;
}

export interface SentRef {
	provider: string;
	[field: string]: string; // { provider: "slack-bot", channel: "C123", ts: "1728…" }
}
```

A credential is a string or a function answering one (`token: () => env.X`), as in
`billing`, so a secret is read at send time and never held where a log could print the
instance.

Providers:

| Subpath                       | Class                 | Notes                                                                            |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `@sdxc/messaging/slack`       | `SlackWebhook`        | Block Kit inside one colored attachment; URL must be `hooks.slack.com`           |
| `@sdxc/messaging/slack`       | `SlackBot`            | `chat.postMessage`, `chat.update`, `thread_ts`                                   |
| `@sdxc/messaging/discord`     | `DiscordWebhook`      | One embed; `?wait=true` so the message id comes back; `threadId` option          |
| `@sdxc/messaging/teams`       | `TeamsWorkflow`       | Adaptive Card 1.4 in the Workflows `message` envelope, `Action.OpenUrl` links    |
| `@sdxc/messaging/google-chat` | `GoogleChatWebhook`   | `cardsV2` with a `buttonList`; `key` becomes `threadKey`                         |
| `@sdxc/messaging/telegram`    | `TelegramBot`         | `parse_mode: "HTML"`, inline URL buttons, `messageThreadId` for forum topics     |
| `@sdxc/messaging/whatsapp`    | `WhatsAppCloud`       | Approved templates only, see below                                               |
| `@sdxc/messaging/ntfy`        | `Ntfy`                | Any server, default `https://ntfy.sh`; up to three `view` actions                |
| `@sdxc/messaging/pushover`    | `Pushover`            | `html=1`, the first link as `url`/`url_title`                                    |
| `@sdxc/messaging/pagerduty`   | `PagerDuty`           | Events API v2; requires `key`                                                    |
| `@sdxc/messaging/opsgenie`    | `Opsgenie`            | Alert API v2, `region: "us" \| "eu"`; requires `key`                             |
| `@sdxc/messaging/webhook`     | `Webhook`             | The portable envelope, signed with Standard Webhooks                             |
| `@sdxc/messaging/memory`      | `MemoryDestination`   | Records messages; scripted failures; declares whichever capabilities a test asks |
| `@sdxc/messaging/conformance` | `describeDestination` | Vitest suite every provider passes                                               |

A provider is never re-exported from the root, so a bundle resolves only the providers it
imports.

### Updates, replies and incidents

Editing a message in place and replying in its thread are optional capabilities, declared the
way `billing` declares optional groups: a provider that can do it has the method, and
`supports()` narrows it.

```ts
import { supports } from "@sdxc/messaging";

let sent = await destination.send(downMessage, { id: event.id });
if (isSuccess(sent) && sent.data.ref) await AlertEvent.saveRef(db, event.id, sent.data.ref);

/** Later, on recovery. */
let ref = await AlertEvent.refFor(db, incidentId);
if (ref && supports(destination, "update")) await destination.update(ref, resolvedMessage);
if (ref && supports(destination, "reply")) await destination.reply(ref, recoveryNote);
if (!ref || !supports(destination, "update")) await destination.send(resolvedMessage);
```

| Provider            | `update`            | `reply`                         | Uses `key` / `state`                    |
| ------------------- | ------------------- | ------------------------------- | --------------------------------------- |
| `SlackWebhook`      | No                  | No                              | No                                      |
| `SlackBot`          | `chat.update`       | `thread_ts`                     | No                                      |
| `DiscordWebhook`    | `PATCH` the message | Into `threadId` when configured | No                                      |
| `TeamsWorkflow`     | No                  | No                              | No                                      |
| `GoogleChatWebhook` | No                  | No                              | `key` as `threadKey`                    |
| `TelegramBot`       | `editMessageText`   | `reply_parameters`              | No                                      |
| `WhatsAppCloud`     | No                  | No                              | No                                      |
| `Ntfy`, `Pushover`  | No                  | No                              | No                                      |
| `PagerDuty`         | n/a                 | n/a                             | `dedup_key`; `resolved` sends `resolve` |
| `Opsgenie`          | n/a                 | n/a                             | `alias`; `resolved` closes the alert    |
| `Webhook`           | n/a                 | n/a                             | Carried in the envelope                 |

A `SentRef` is a flat string map tagged with its provider, so the caller stores it as JSON and
an `update` given another provider's ref fails with `invalid-ref` before any request.

### Rendering

Each provider has a public, pure `render(message)` answering the exact body it would send, so
an app can preview an alert and a test can assert on Block Kit without a network. A subclass
overrides `render` to change a platform's layout, which is the escape hatch for anything the
portable message does not express.

Markdown dialects:

| Portable     | Slack / Google Chat | Discord      | Teams card | Telegram HTML       | WhatsApp     | Pushover HTML       | PagerDuty, Opsgenie |
| ------------ | ------------------- | ------------ | ---------- | ------------------- | ------------ | ------------------- | ------------------- |
| `**bold**`   | `*bold*`            | `**bold**`   | `**bold**` | `<b>bold</b>`       | `*bold*`     | `<b>bold</b>`       | Plain               |
| `_italic_`   | `_italic_`          | `*italic*`   | `_italic_` | `<i>italic</i>`     | `_italic_`   | `<i>italic</i>`     | Plain               |
| `~~strike~~` | `~strike~`          | `~~strike~~` | Plain      | `<s>strike</s>`     | `~strike~`   | Plain               | Plain               |
| `` `code` `` | `` `code` ``        | `` `code` `` | Plain      | `<code>code</code>` | `` `code` `` | Plain               | Plain               |
| `[t](u)`     | `<u\|t>`            | `[t](u)`     | `[t](u)`   | `<a href="u">t</a>` | `t: u`       | `<a href="u">t</a>` | `t: u`              |

Telegram is written as HTML rather than MarkdownV2: HTML needs `&`, `<` and `>` escaped,
while MarkdownV2 rejects the whole message over any of eighteen unescaped characters. Each
writer escapes literal text for its dialect, so a monitor named `<prod>_api*` arrives as typed.

Severity:

| `severity` | Slack, Discord color | Teams container style | ntfy `Priority` | Pushover `priority` | PagerDuty  | Opsgenie |
| ---------- | -------------------- | --------------------- | --------------- | ------------------- | ---------- | -------- |
| `info`     | Gray                 | `emphasis`            | 3               | 0                   | `info`     | `P5`     |
| `success`  | Green                | `good`                | 3               | 0                   | `info`     | `P5`     |
| `warning`  | Amber                | `warning`             | 4               | 0                   | `warning`  | `P3`     |
| `critical` | Red                  | `attention`           | 5               | 1                   | `critical` | `P1`     |

Telegram and WhatsApp have no color; the title carries the state in words. Pushover's
emergency priority (`2`) needs `retry` and `expire`, so it is a provider option and never
inferred.

Limits are enforced by truncating, never by failing: the renderer cuts the source text at a
grapheme boundary before escaping, so a cut never splits an entity or a tag, and ends it with
an ellipsis. Examples: Slack section text 3,000 and header 150; Discord embed description
4,096, 25 fields, 6,000 in total; Telegram 4,096; PagerDuty summary 1,024; Opsgenie message
130; Pushover message 1,024 and title 250.

### WhatsApp

A notification is a business-initiated message. WhatsApp accepts free-form text only inside
the 24 hours after the recipient last wrote to the business, and a send-only package never
sees that message, so `WhatsAppCloud` sends **approved templates only**. The caller names the
template and maps the message onto its parameters:

```ts
import { WhatsAppCloud } from "@sdxc/messaging/whatsapp";

let whatsapp = new WhatsAppCloud({
	accessToken: () => env.WHATSAPP_ACCESS_TOKEN,
	phoneNumberId: "106540352242922",
	to: "15551234567",
	template: {
		name: "monitor_alert",
		language: "en",
		parameters: (message) => [message.title, message.fields?.[0]?.value ?? ""],
	},
});
```

Parameters are normalized the way Meta requires (no newlines or tabs, no runs of more than
four spaces). Links come from the template's own URL buttons, which are fixed when the
template is approved. Recipient opt-in and the per-message price are the app's concern.

### Delivery

Every request is one call to the global `fetch`, with `redirect: "manual"`, a deadline from
`timeout` combined with the caller's `signal`, and the answer read through
`@sdxc/outbound`'s `readText` with a 64 KiB cap, so an id or an error body is read and a
hostile endpoint cannot stream forever.

- **Token providers** (`SlackBot`, `TelegramBot`, `WhatsAppCloud`, `Pushover`, `PagerDuty`,
  `Opsgenie`) extend `APIClient` from `@sdxc/api-client`: a fixed origin and
  `propagateTrace = "none"` since these services are outside the trace. The credential is read
  per send and set on that request (a header, the Telegram path, or Pushover's form body), so a
  secret store that fails answers `unavailable` as a `Result` before any request.
- **URL providers** pass the URL through `checkUrl` from `@sdxc/outbound` before the request.
  `SlackWebhook` accepts only `https://hooks.slack.com/`, `DiscordWebhook` only
  `https://discord.com/api/webhooks/` (and `discordapp.com`), `GoogleChatWebhook` only
  `https://chat.googleapis.com/`. `TeamsWorkflow`, `Ntfy` and `Webhook` take any URL the public
  policy accepts, with `resolve: true` available for the DNS check. A redirect is a failure;
  it is never followed.
- Each URL provider has a static `check(url)` answering `Result<URL, MessagingError>`, so a
  settings form validates a pasted URL with the rule the send will apply.
- **Secrets stay out of errors and logs.** A webhook URL and a Telegram token in a path are
  credentials, so a `MessagingError` names the provider and the host only, and `OutboundError`s
  are mapped at the boundary to drop their `url`.
- Each send records one event on `currentLog()` from `@sdxc/logger` when a log is bound:
  provider, outcome, status, duration.

`Webhook` sends this envelope, signed with `sign` from `@sdxc/webhooks` (`webhook-id`,
`webhook-timestamp`, `webhook-signature`), using `SendOptions.id` as the delivery id so a
receiver deduplicates a retry:

```json
{
	"type": "message",
	"title": "api.example.com is down",
	"text": "…",
	"severity": "critical",
	"fields": [{ "label": "Region", "value": "gru", "inline": true }],
	"links": [{ "label": "Open dashboard", "url": "https://…" }],
	"timestamp": "2026-10-06T12:00:00.000Z",
	"key": "incident_8f1c",
	"state": "open",
	"data": { "monitorId": "m_1" }
}
```

### Errors

`MessagingError` carries `code`, `provider`, `status` (the HTTP status, when there was one),
`retryable` and `retryAfter` (milliseconds, from `Retry-After` or the body's `retry_after`).

| `code`                | `retryable` | When                                                                                                                                           |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-message`     | No          | A message the provider cannot express, such as `state: "resolved"` without a `key` on PagerDuty                                                |
| `invalid-destination` | No          | The URL fails `check`, or `checkUrl` refuses it                                                                                                |
| `invalid-ref`         | No          | `update` or `reply` was given another provider's ref                                                                                           |
| `unauthorized`        | No          | `401`/`403`, or a rejected token or routing key                                                                                                |
| `gone`                | No          | The destination no longer exists: Slack `no_service` or `channel_is_archived`, Discord Unknown Webhook, Telegram chat not found or bot blocked |
| `outside-window`      | No          | WhatsApp refused a message outside the customer-service window                                                                                 |
| `rejected`            | No          | Any other `4xx`, or a `3xx`                                                                                                                    |
| `rate-limited`        | Yes         | `429`                                                                                                                                          |
| `unavailable`         | Yes         | `5xx`                                                                                                                                          |
| `timeout`             | Yes         | The deadline passed                                                                                                                            |
| `network`             | Yes         | `fetch` rejected                                                                                                                               |

`gone` is its own code because the right response is different: stop sending to that
destination and tell its owner, which `reader` already does for push subscriptions past
`PUSH_FAILURE_LIMIT`.

### Retries belong to the job

A provider makes one attempt. Retrying is the caller's, through `@sdxc/jobs` and
`@sdxc/backoff`, because only the caller knows how long a message stays worth sending, and a
job survives an isolate that a sleeping `send` does not. Chat platforms have no idempotency
key, so a retry after a timeout whose request did land posts twice; the package says so rather
than hiding it.

```ts
const RETRY_BACKOFF = createBackoff({ base: "30 seconds", max: "30 minutes", jitter: 0.2 });
const MAX_ATTEMPTS = 6;

export default createJobHandler(jobs.alerts.deliver, async (ctx) => {
	let alert = await Alert.find(ctx.db, ctx.input.alertId);
	if (!alert) return ctx.ack("The alert no longer exists");

	let destination = destinationFor(alert.config);
	let sent = await destination.send(ctx.input.message, { id: ctx.input.eventId });

	if (isSuccess(sent)) return await AlertEvent.sent(ctx.db, ctx.input.eventId, sent.data.ref);

	let error = sent.error;
	if (error.retryable && ctx.attempts < MAX_ATTEMPTS) {
		return ctx.retry({
			delay: error.retryAfter ?? RETRY_BACKOFF.delay(ctx.attempts),
			cause: error,
		});
	}
	if (error.code === "gone") await Alert.markBroken(ctx.db, alert.id, error.code);
	await AlertEvent.failed(ctx.db, ctx.input.eventId, error.code);
	return ctx.ack(error.message);
});
```

The queue payload carries the alert id and the message, never the webhook URL or token, so a
credential stays in the database and out of the queue.

### Testing

`MemoryDestination` is a full destination: it records each message with the ref it answered,
declares whichever optional capabilities the test passes, and fails on cue.

```ts
import { MemoryDestination } from "@sdxc/messaging/memory";

let destination = new MemoryDestination({ capabilities: ["update"] });
destination.failNext({ code: "rate-limited", retryAfter: 30_000 });

let first = await destination.send(message); // failure: rate-limited, retryable
let second = await destination.send(message); // success, ref { provider: "memory", id: "1" }

expect(destination.messages).toHaveLength(1);
expect(destination.last?.message.severity).toBe("critical");
```

Inside the package each provider is tested over MSW against its real endpoint shapes: the
rendered body, the error mapping per status and body, the ref it answers, and that no error
or log entry contains the URL or token. `@sdxc/messaging/conformance` holds the contract half
of those tests (a declared capability works, a foreign ref fails, a `429` is retryable with
its delay), and every provider and `MemoryDestination` runs it.

### Dependencies

| Package                   | For                                             |
| ------------------------- | ----------------------------------------------- |
| `@sdxc/result`            | Every send answers a `Result`                   |
| `@sdxc/markdown`          | Parsing `text` once before writing each dialect |
| `@sdxc/outbound`          | `checkUrl`, `resolveHost`, bounded reads        |
| `@sdxc/api-client`        | The base of every token provider                |
| `@sdxc/webhooks`          | Signing the generic webhook                     |
| `@sdxc/validate`, `remix` | `MESSAGE_SCHEMA`, and parsing platform answers  |
| `@sdxc/duration`          | `timeout`                                       |
| `@sdxc/logger`            | One event per send on the current log           |
| `vitest` (optional peer)  | The conformance entry                           |

No vendor SDK. Every platform above is a JSON POST, which is what lets the package run on
Workers without `nodejs_compat`. The package stays `private: true` until its first two
consumers have used it.

## Usage Examples

### `uptime`'s alerts

The four-way switch becomes a mapping from stored configuration to a destination, and email
stays on `@sdxc/mail` with its own templates:

```ts
function destinationFor(config: AlertConfig): Destination {
	switch (config.strategy) {
		case "slack":
			return new SlackWebhook({ url: config.config.webhookUrl });
		case "discord":
			return new DiscordWebhook({ url: config.config.webhookUrl });
		case "pagerduty":
			return new PagerDuty({ routingKey: config.config.routingKey });
		case "webhook":
			return new UptimeWebhook({ url: config.config.url, secret: config.config.secret });
	}
}

function alertMessage(params: DispatchAlertsParams): Message {
	let recovered = params.eventType === "up";
	return {
		title: `${params.monitorName} is ${statusWord(params.eventType)}`,
		text: snapshotLines(params.snapshot).join("\n"),
		severity: recovered ? "success" : params.eventType === "degraded" ? "warning" : "critical",
		fields: [{ label: "Type", value: params.monitorType, inline: true }],
		links: [{ label: "Open dashboard", url: params.dashboardUrl }],
		timestamp: new Date(),
		key: `${params.monitorType}:${params.monitorId}`,
		state: recovered ? "resolved" : "open",
		data: { monitorId: params.monitorId, eventType: params.eventType, snapshot: params.snapshot },
	};
}
```

`UptimeWebhook` is `uptime`'s subclass of `Webhook` that overrides `render` and `sign` to keep
the payload and `Webhook-Signature: sha256=…` header its customers verify today. Moving those
customers to the Standard Webhooks envelope is a product decision for `uptime`, made when it
versions its webhook, and the subclass is where its current contract lives until then.

### The support desk and `reader`

The blog's support desk can post each admitted request to the operator's own Slack or
Telegram beside the inbox email, and `reader` can offer ntfy or Telegram as a channel beside
web push and email, reusing its gap and quiet-hour rules. Neither is part of this ADR's plan;
both are the shape the package is designed to make one constructor and one `send` call.

## Consequences

### Positive

- **Native messages everywhere:** a color, fields and a dashboard button on Slack, Discord,
  Teams and Google Chat, from one `Message`.
- **Alerts that survive a blip:** delivery runs as a job with backoff, honoring `Retry-After`.
- **Dead destinations are visible:** `gone` lets an app mark a channel broken instead of
  failing silently on every alert.
- **Recovery closes the loop:** PagerDuty resolves its incident, Google Chat threads by key,
  and Slack bot, Discord and Telegram can edit the original message.
- **The marketing promise becomes true:** PagerDuty Events v2 is a real provider.
- **Workers-native:** no vendor SDKs, no Node built-ins, no state store, one `fetch` per send.
- **Safe with user-supplied URLs:** host allowlists where a platform has one, `@sdxc/outbound`
  where it does not, and secrets kept out of errors, logs and queue payloads.

### Negative

- **Twelve payload formats to maintain:** every platform's rich format changes on its own
  schedule, and this package owns the renderers that Chat SDK's adapters would otherwise own.
- **Retries can duplicate:** Slack, Discord, Teams, Google Chat, Telegram and ntfy have no
  idempotency key, so a retry after a timeout that did land posts the message twice.
- **No interactive buttons:** "Acknowledge" from Slack needs an inbound endpoint, which this
  package does not have.
- **`uptime` stops being "never retried":** ADR-002's retry exposure for alerts is no longer
  zero; it is bounded by `MAX_ATTEMPTS` per delivery.
- **WhatsApp needs setup outside code:** an approved template, a business number and per-message
  pricing.

### Neutral

- **Email and web push stay separate.** `@sdxc/mail` keeps its component templates and its
  transports, and browser push keeps its own protocol package; a `Destination` adapting either
  can be added if an app wants every channel behind one interface.
- **Slack's `channel` override is dropped** because app webhooks ignore it. `SlackBot` is the
  provider that chooses a channel.
- **The portable model is deliberately small.** Anything beyond title, text, fields, links and
  severity goes through a `render` override in the app.

## Implementation Plan

### Phase 1: Core

**Priority:** High
**Estimated Effort:** 5 hours

1. Create `packages/messaging`, private, with `Message`, `MESSAGE_SCHEMA`, `Destination`,
   `Sent`, `SentRef`, `MessagingError` and `supports`.
2. Dialect writers over the `@sdxc/markdown` AST: Slack `mrkdwn`, Discord, Teams, Telegram
   HTML, WhatsApp, Pushover HTML, plain; escaping and truncation tests for each.
3. `MemoryDestination` and the conformance suite.
4. README following the package documentation guide, including the secret-handling and
   duplicate-on-retry notes.

### Phase 2: What `uptime` needs

**Priority:** High
**Estimated Effort:** 5 hours

1. `SlackWebhook`, `DiscordWebhook`, `Webhook` and `PagerDuty`, each over MSW and through the
   conformance suite.

Depends on Phase 1.

### Phase 3: `uptime` adoption

**Priority:** High
**Estimated Effort:** 6 hours

1. An `alerts.deliver` job with `@sdxc/backoff`, replacing inline delivery in `dispatchAlerts`.
2. A migration adding the delivery ref to `alert_events` and a `pagerduty` strategy; drop
   Slack's `channel` from the config.
3. `UptimeWebhook` keeping the current payload and signature; remove `hmacSha256Hex`.
4. Mark an alert broken on `gone` and show it in the alert list.
5. Update ADR-002's retry exposure. Build, migrate, deploy.

### Phase 4: More providers

**Priority:** Medium
**Estimated Effort:** 8 hours

1. `SlackBot`, `TelegramBot`, `TeamsWorkflow`, `GoogleChatWebhook`, `Ntfy`, `Pushover`.
2. Add them as `uptime` strategies one at a time, each a commit in `uptime`.

### Phase 5: On demand

**Priority:** Low
**Estimated Effort:** 4 hours

1. `WhatsAppCloud` when an app has an approved template and a business number.
2. `Opsgenie` only if a customer asks before its end of support.
3. Make the package public once two apps use it.

## Alternatives Considered

### 1. A full Chat-SDK-like package, sending and receiving

Build the bot framework: inbound webhooks verified per platform (Slack signing secret, Discord
Ed25519, Teams and Google Chat JWTs, Telegram's secret token, WhatsApp's
`X-Hub-Signature-256`), app installation and per-workspace tokens, thread subscriptions,
locks and deduplication in a Durable Object, interactive actions, modals and streaming.

**Rejected because**: no app in the repo receives chat events, and every consumer named above
sends. It multiplies the scope several times over, and part of it is a poor fit for Workers:
Discord delivers ordinary messages only over a persistent Gateway WebSocket. The send-only
design keeps that door open: the message model and the renderers are pure, and a future bot
package (the `chat` name is left free for it) would add the inbound half on top of them. The
trigger to revisit is a feature that needs a callback, such as acknowledging an `uptime`
incident from Slack.

### 2. Adopt Vercel's Chat SDK on Workers

Use `chat` with its adapters, posting through `bot.channel(id).post(card)`.

**Rejected because**:

- It is a bot framework whose `Chat` requires a state adapter, and the shipped ones are Redis,
  ioredis, Postgres and an in-memory store; on Workers that means writing a Durable Object
  state adapter to send a one-way alert.
- Its Slack, Discord, Teams and Google Chat adapters wrap `@slack/web-api`, `discord.js`, the
  `@microsoft/teams.*` SDK and `@googleapis/*`, which target Node (`engines: node >= 20`) and
  would need `nodejs_compat` at best, at a bundle cost far above a JSON POST.
- Adapters authenticate as the operator's bot. `uptime`'s users paste their own incoming-webhook
  URLs, which no adapter accepts, and PagerDuty, Opsgenie, ntfy, Pushover and plain webhooks
  have no adapter at all, since they are not chats.
- Its cards are JSX on its own runtime (`jsxImportSource: "chat"`), a second JSX runtime beside
  `remix/component` in the same app; it throws instead of answering a `Result`; it peers on
  `zod`, which new code here does not use; and its logger is its own.

What the package takes from it is the model: one portable message with a small card
vocabulary, each adapter rendering natively, edit and thread as capabilities that vary by
platform.

### 3. Rich messages as `remix/component` JSX

Write a message as `<Card><Fields>…</Fields><Button href={…} /></Card>`, as Chat SDK does and
as `@sdxc/mail` does for email bodies.

**Rejected because**: a message here is built from data in a job and travels in a queue
payload, and plain data serializes, validates with `MESSAGE_SCHEMA` and diffs in a test with
nothing in between. The vocabulary is five fields, not a layout. `remix/component`'s renderer
targets HTML; turning its element tree into Block Kit means a second interpreter of that tree,
and a separate JSX runtime collides with `remix/component`'s `jsxImportSource`.

### 4. One function per platform

`postToSlack(url, text)`, `postToDiscord(url, text)` and so on, with no shared message.

**Rejected because**: it is what `uptime` has today, and every caller rebuilds the same
mapping from its domain to each platform. A destination built from configuration is what lets
`uptime` store "where" in a row and send "what" once.

### 5. Telegram as MarkdownV2

**Rejected because**: MarkdownV2 fails the entire message on any unescaped character from a
set of eighteen, so one monitor name with a `.` or `-` loses an alert. HTML needs three
escapes.

## References

- [Chat SDK documentation](https://chat-sdk.dev/docs) and [vercel/chat](https://github.com/vercel/chat)
- [Slack incoming webhooks](https://api.slack.com/messaging/webhooks), [Block Kit](https://api.slack.com/block-kit), [`chat.update`](https://api.slack.com/methods/chat.update)
- [Discord webhook resource](https://discord.com/developers/docs/resources/webhook)
- [Microsoft Teams: create incoming webhooks with Workflows](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498), [Adaptive Cards](https://adaptivecards.io/)
- [Google Chat incoming webhooks](https://developers.google.com/workspace/chat/quickstart/webhooks)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Cloud API: template messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)
- [ntfy publishing](https://docs.ntfy.sh/publish/), [Pushover API](https://pushover.net/api)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/events-api-v2/overview/), [Opsgenie Alert API](https://docs.opsgenie.com/docs/alert-api)
- [Standard Webhooks](https://www.standardwebhooks.com/)
- [ADR-106: Backoff Package](./ADR-106-backoff-package.md)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)
- [uptime ADR-002: Infrastructure Cost per Monitor Type](./uptime/ADR-002-infrastructure-cost-per-monitor-type.md)

## Current Progress

- [x] Phase 1: Core
- [x] Phase 2: What `uptime` needs
- [x] Phase 3: `uptime` adoption (`MAX_ATTEMPTS` is 4, the queue's `max_retries` plus one)
- [x] Phase 4: More providers (provider classes; `uptime` strategies follow Phase 3)
- [ ] Phase 5: On demand (`WhatsAppCloud` and `Opsgenie` are built; the package stays private
      until two apps use it)

## Notes

- `uptime` stores webhook URLs and the webhook secret in the alert's `config` column as plain
  JSON. They are credentials; encrypting them at rest is outside this ADR and worth its own.
- Platform limits and rate limits (Slack about one message per second per webhook, Discord's
  per-webhook bucket, Telegram's per-chat limits) surface as `rate-limited` with a delay; the
  package does not queue or pace sends itself.
- Chat SDK's adapter list and dependencies were read from its published manifests (version
  4.41.1) when this ADR was written.
