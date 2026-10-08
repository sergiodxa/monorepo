/**
 * Slack destinations as Block Kit inside one attachment colored by severity.
 * `SlackWebhook` posts to a pasted incoming-webhook URL, which answers no message id;
 * `SlackBot` posts as a bot token to a channel, so it can edit and thread its messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { failure, isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent, SentRef } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message } from "../message.js";

import {
	answerError,
	checkDestination,
	deliver,
	readSecret,
	record,
	refError,
} from "../deliver.js";
import { SEVERITY_COLORS, severityOf } from "../severity.js";
import { fitText, mrkdwn, writeText } from "../text.js";

/** Block Kit's limits, past which Slack rejects the whole payload. */
const LIMITS = {
	header: 150,
	section: 3000,
	fieldLabel: 200,
	fieldValue: 1790,
	fields: 10,
	button: 75,
	buttons: 25,
	url: 3000,
	fallback: 3000,
} as const;

/** Slack's answers that mean the webhook's channel or workspace no longer exists. */
const GONE_ANSWERS: ReadonlySet<string> = new Set([
	"no_service",
	"no_team",
	"no_active_hooks",
	"invalid_token",
	"channel_not_found",
	"channel_is_archived",
	"team_disabled",
]);

/** Web API errors that mean the bot's channel is gone or closed to it for good. */
const BOT_GONE_ERRORS: ReadonlySet<string> = new Set([
	"channel_not_found",
	"is_archived",
	"channel_is_archived",
	"account_inactive",
	"not_in_channel",
]);

/** Web API errors that mean the bot token is refused or lacks the scope to post. */
const BOT_UNAUTHORIZED_ERRORS: ReadonlySet<string> = new Set([
	"invalid_auth",
	"not_authed",
	"token_revoked",
	"missing_scope",
]);

/** The fields a `SlackBot` ref needs to edit or thread under a message. */
const BOT_REF_FIELDS = ["channel", "ts"] as const;

/** A Block Kit block, as plain data. */
export type SlackBlock = Record<string, unknown>;

/** The body an incoming webhook receives. */
export interface SlackWebhookPayload {
	/** The notification and screen-reader text. */
	text: string;
	attachments: [{ color: string; blocks: SlackBlock[] }];
}

/**
 * Writes a message as Block Kit: a header, the text, the fields, the timestamp and a
 * row of URL buttons, each cut to Slack's limits.
 *
 * @param message - The message.
 * @returns The blocks, in reading order.
 */
export function slackBlocks(message: Message): SlackBlock[] {
	let blocks: SlackBlock[] = [
		{
			type: "header",
			text: { type: "plain_text", text: fitText(message.title, LIMITS.header), emoji: true },
		},
	];

	if (message.text) {
		blocks.push({
			type: "section",
			text: { type: "mrkdwn", text: writeText(message.text, mrkdwn, LIMITS.section) },
		});
	}

	let fields = (message.fields ?? []).slice(0, LIMITS.fields);
	if (fields.length > 0) {
		blocks.push({
			type: "section",
			fields: fields.map((field) => ({
				type: "mrkdwn",
				text: `*${fitText(field.label, LIMITS.fieldLabel, mrkdwn.escape)}*\n${fitText(field.value, LIMITS.fieldValue, mrkdwn.escape)}`,
			})),
		});
	}

	if (message.timestamp) {
		let seconds = Math.floor(message.timestamp.getTime() / 1000);
		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: `<!date^${seconds}^{date_short_pretty} {time}|${message.timestamp.toISOString()}>`,
				},
			],
		});
	}

	let links = (message.links ?? []).filter((link) => link.url.length <= LIMITS.url);
	if (links.length > 0) {
		blocks.push({
			type: "actions",
			elements: links.slice(0, LIMITS.buttons).map((link) => ({
				type: "button",
				text: { type: "plain_text", text: fitText(link.label, LIMITS.button), emoji: true },
				url: link.url,
			})),
		});
	}

	return blocks;
}

/** Reads Slack's plain-text error answer, mapping a dead webhook to `gone`. */
function classifySlackWebhook(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	if (answer.status >= 200 && answer.status < 300) return null;
	let reason = answer.text.trim();
	if (GONE_ANSWERS.has(reason)) return answerError(exchange, answer, "gone", `answered ${reason}`);
	if (reason === "action_prohibited") {
		return answerError(exchange, answer, "unauthorized", `answered ${reason}`);
	}
	return null;
}

/** How a `SlackWebhook` is configured. */
export interface SlackWebhookOptions {
	/** The incoming-webhook URL, which is itself the credential. */
	url: string;
}

/**
 * Posts to a Slack incoming webhook. The URL must be on `https://hooks.slack.com/`, so a
 * pasted URL can never point a send anywhere else.
 *
 * @example await new SlackWebhook({ url: config.webhookUrl }).send(message);
 */
export class SlackWebhook implements Destination {
	readonly provider = "slack-webhook";

	#url: string;

	/** @param options - The webhook URL. */
	constructor(options: SlackWebhookOptions) {
		this.#url = options.url;
	}

	/**
	 * Validates a pasted URL with the rule a send applies.
	 *
	 * @param url - The URL as pasted.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("slack-webhook", url, { prefixes: ["https://hooks.slack.com/"] });
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): SlackWebhookPayload {
		return {
			text: fitText(message.title, LIMITS.fallback, mrkdwn.escape),
			attachments: [{ color: SEVERITY_COLORS[severityOf(message)], blocks: slackBlocks(message) }],
		};
	}

	/**
	 * Posts the message. The answer carries no message id, so the ref is always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let url = SlackWebhook.check(this.#url);
		if (isFailure(url)) return url;

		let body = JSON.stringify(this.render(message));
		let exchange = { provider: this.provider, host: url.data.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(url.data, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifySlackWebhook(exchange, answer),
			},
			options,
		);
	}
}

/** The body `chat.postMessage` receives, which `chat.update` and a reply extend. */
export interface SlackBotPayload extends SlackWebhookPayload {
	/** The channel id the bot posts to. */
	channel: string;
}

/** How a `SlackBot` is configured. */
export interface SlackBotOptions {
	/** The bot token (`xoxb-…`), read on every send. */
	token: Secret;
	/** The channel id, which the bot must be a member of. */
	channel: string;
}

/**
 * Reads Slack's Web API answer, which is `200` with `ok: false` on failure, so the
 * `error` field decides the code and the status only decides when the body names none.
 */
function classifySlackBot(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	let body = record(answer.json);
	if (body["ok"] !== false) return null;

	let reason = typeof body["error"] === "string" ? body["error"] : "an error";
	let detail = `answered ${reason}`;
	if (BOT_GONE_ERRORS.has(reason)) return answerError(exchange, answer, "gone", detail);
	if (BOT_UNAUTHORIZED_ERRORS.has(reason)) {
		return answerError(exchange, answer, "unauthorized", detail);
	}
	if (reason === "ratelimited" || answer.status === 429) {
		return answerError(exchange, answer, "rate-limited", detail);
	}
	if (answer.status >= 500) return answerError(exchange, answer, "unavailable", detail);
	return answerError(exchange, answer, "rejected", detail);
}

/** Reads where Slack put the message, which every successful post and update answers. */
function slackBotRef(answer: Answer): SentRef | null {
	let body = record(answer.json);
	let channel = body["channel"];
	let ts = body["ts"];
	if (typeof channel !== "string" || typeof ts !== "string") return null;
	return { provider: "slack-bot", channel, ts };
}

/**
 * Posts as a Slack bot through the Web API, so a sent message can be edited in place
 * with `chat.update` and answered in its thread with `thread_ts`.
 *
 * @example await new SlackBot({ token: () => env.SLACK_BOT_TOKEN, channel: "C123" }).send(message);
 */
export class SlackBot extends APIClient implements Destination {
	readonly provider = "slack-bot";

	/** Slack is outside the caller's trace, so no trace header reaches it. */
	protected override readonly propagateTrace = "none";

	#token: Secret;
	#channel: string;

	/** @param options - The bot token and the channel. */
	constructor(options: SlackBotOptions) {
		super(new URL("https://slack.com/api/"));
		this.#token = options.token;
		this.#channel = options.channel;
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): SlackBotPayload {
		return {
			channel: this.#channel,
			text: fitText(message.title, LIMITS.fallback, mrkdwn.escape),
			attachments: [{ color: SEVERITY_COLORS[severityOf(message)], blocks: slackBlocks(message) }],
		};
	}

	/**
	 * Posts the message with `chat.postMessage`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref holding the channel and the message's `ts`.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		return await this.#call("chat.postMessage", this.render(message), options);
	}

	/**
	 * Replaces the sent message with `chat.update`, keeping its place in the channel.
	 *
	 * @param ref - The ref `send` answered.
	 * @param message - The message as it reads now.
	 * @param options - Timeout and signal.
	 * @returns The same ref, or `invalid-ref` for another provider's ref, before any request.
	 */
	async update(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>> {
		let invalid = refError(this.provider, ref, BOT_REF_FIELDS);
		if (invalid) return failure(invalid);
		let body = { ...this.render(message), channel: ref["channel"], ts: ref["ts"] };
		return await this.#call("chat.update", body, options);
	}

	/**
	 * Posts the message in the sent message's thread with `thread_ts`.
	 *
	 * @param ref - The ref `send` answered.
	 * @param message - The reply.
	 * @param options - Timeout and signal.
	 * @returns The reply's own ref, or `invalid-ref` for another provider's ref, before any request.
	 */
	async reply(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>> {
		let invalid = refError(this.provider, ref, BOT_REF_FIELDS);
		if (invalid) return failure(invalid);
		let body = { ...this.render(message), channel: ref["channel"], thread_ts: ref["ts"] };
		return await this.#call("chat.postMessage", body, options);
	}

	/** Reads the token and posts one Web API method, reading `ok` to decide the outcome. */
	async #call(
		method: string,
		body: object,
		options: SendOptions | undefined,
	): Promise<Result<Sent, MessagingError>> {
		let token = await readSecret(this.provider, this.#token);
		if (isFailure(token)) return token;

		let json = JSON.stringify(body);
		let exchange = { provider: this.provider, host: this.baseURL.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					this.post(method, {
						headers: {
							Authorization: `Bearer ${token.data}`,
							"Content-Type": "application/json; charset=utf-8",
						},
						body: json,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifySlackBot(exchange, answer),
				ref: slackBotRef,
			},
			options,
		);
	}
}
