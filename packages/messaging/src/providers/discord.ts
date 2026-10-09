/**
 * Discord destinations: `DiscordWebhook` posts one embed colored by severity to a webhook
 * URL a user pasted, waiting for the message id so the message can be edited later, and
 * replies into a thread when one is configured.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, SendOptions, Sent, SentRef } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message } from "../message.js";

import { answerError, checkDestination, deliver, record, refError } from "../deliver.js";
import { SEVERITY_COLORS, severityOf } from "../severity.js";
import { discordMarkdown, fitText, writeText } from "../text.js";

/** The embed limits, past which Discord rejects the whole message. */
const LIMITS = {
	title: 256,
	description: 4096,
	fields: 25,
	fieldName: 256,
	fieldValue: 1024,
	total: 6000,
} as const;

/** Discord's error code for a webhook that was deleted. */
const UNKNOWN_WEBHOOK = 10015;

/** Discord refuses an empty field name or value, so an empty one is drawn as a zero-width space. */
const EMPTY_FIELD = "​";

/** Separates the text from the line of links in the description. */
const LINKS_SEPARATOR = "\n\n";

/** Separates one link from the next on the line of links. */
const LINK_JOINER = " · ";

/** One embed field. */
export interface DiscordEmbedField {
	name: string;
	value: string;
	inline: boolean;
}

/** The embed a webhook message carries. */
export interface DiscordEmbed {
	title: string;
	description?: string;
	/** The severity color as a `0xRRGGBB` integer. */
	color: number;
	fields?: DiscordEmbedField[];
	/** ISO 8601, which Discord draws in the reader's own time zone. */
	timestamp?: string;
}

/** The body a webhook execution receives. */
export interface DiscordWebhookPayload {
	embeds: [DiscordEmbed];
	/** Empty, so a message naming `@everyone` or a role pings nobody. */
	allowed_mentions: { parse: [] };
}

/**
 * Writes the description: the text, then a line of Markdown links, together within
 * `maxLength`. Webhooks without an application cannot send link buttons, so links are
 * written in the text; a link that does not fit is dropped whole, never cut.
 */
function discordDescription(message: Message, maxLength: number): string {
	let links: string[] = [];
	let linksLength = 0;
	for (let link of message.links ?? []) {
		let written = discordMarkdown.link(discordMarkdown.escape(link.label), link.url);
		let next = linksLength + (links.length > 0 ? LINK_JOINER.length : 0) + written.length;
		if (next + LINKS_SEPARATOR.length > maxLength) break;
		links.push(written);
		linksLength = next;
	}
	let linkLine = links.join(LINK_JOINER);

	let room = maxLength - (linkLine ? linkLine.length + LINKS_SEPARATOR.length : 0);
	let text = message.text ? writeText(message.text, discordMarkdown, Math.max(0, room)) : "";
	return [text, linkLine].filter((part) => part !== "").join(LINKS_SEPARATOR);
}

/**
 * Writes a message as one Discord embed, each part cut to Discord's limits. The whole
 * embed stays within its 6,000-character total: fields past it are dropped and the
 * description takes what remains.
 *
 * @param message - The message.
 * @returns The embed.
 */
export function discordEmbed(message: Message): DiscordEmbed {
	let title = fitText(message.title, LIMITS.title) || EMPTY_FIELD;
	let used = title.length;
	let fields: DiscordEmbedField[] = [];
	for (let field of (message.fields ?? []).slice(0, LIMITS.fields)) {
		let name = fitText(field.label, LIMITS.fieldName, discordMarkdown.escape) || EMPTY_FIELD;
		let value = fitText(field.value, LIMITS.fieldValue, discordMarkdown.escape) || EMPTY_FIELD;
		if (used + name.length + value.length > LIMITS.total) break;
		fields.push({ name, value, inline: field.inline ?? false });
		used += name.length + value.length;
	}

	let description = discordDescription(
		message,
		Math.max(0, Math.min(LIMITS.description, LIMITS.total - used)),
	);

	return {
		title,
		...(description ? { description } : {}),
		color: Number.parseInt(SEVERITY_COLORS[severityOf(message)].slice(1), 16),
		...(fields.length > 0 ? { fields } : {}),
		...(message.timestamp ? { timestamp: message.timestamp.toISOString() } : {}),
	};
}

/** Reads Discord's JSON error, mapping a deleted webhook or a `404` to `gone`. */
function classifyDiscordWebhook(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	if (answer.status >= 200 && answer.status < 300) return null;
	if (record(answer.json)["code"] === UNKNOWN_WEBHOOK) {
		return answerError(exchange, answer, "gone", "answered Unknown Webhook");
	}
	if (answer.status === 404) return answerError(exchange, answer, "gone", "answered 404");
	return null;
}

/** How a `DiscordWebhook` is configured. */
export interface DiscordWebhookOptions {
	/** The webhook URL, which is itself the credential. */
	url: string;
	/**
	 * A thread in the webhook's channel to post into. With it, every message lands in
	 * that thread and the destination declares `reply`.
	 */
	threadId?: string;
}

/**
 * Posts to a Discord webhook and edits what it posted. The URL must be on
 * `https://discord.com/api/webhooks/` or `https://discordapp.com/api/webhooks/`, so a
 * pasted URL can never point a send anywhere else.
 *
 * @example await new DiscordWebhook({ url: config.webhookUrl }).send(message);
 */
export class DiscordWebhook implements Destination {
	readonly provider = "discord-webhook";

	/** Posts into the configured thread; declared only when `threadId` is set. */
	reply?: (
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	) => Promise<Result<Sent, MessagingError>>;

	#url: string;
	#threadId: string | undefined;

	/** @param options - The webhook URL and the thread to post into. */
	constructor(options: DiscordWebhookOptions) {
		this.#url = options.url;
		this.#threadId = options.threadId;
		if (options.threadId !== undefined) {
			this.reply = async (ref, message, sendOptions) => {
				let invalid = refError(this.provider, ref, ["id"]);
				if (invalid) return failure(invalid);
				return await this.send(message, sendOptions);
			};
		}
	}

	/**
	 * Validates a pasted URL with the rule a send applies.
	 *
	 * @param url - The URL as pasted.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("discord-webhook", url, {
			prefixes: ["https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"],
		});
	}

	/**
	 * The exact body a send or update posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): DiscordWebhookPayload {
		return { embeds: [discordEmbed(message)], allowed_mentions: { parse: [] } };
	}

	/**
	 * Posts the message with `?wait=true`, so Discord answers the message it created.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref with the message `id`, and the `threadId` it was posted into.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let checked = DiscordWebhook.check(this.#url);
		if (isFailure(checked)) return checked;

		let url = new URL(checked.data);
		url.searchParams.set("wait", "true");
		if (this.#threadId !== undefined) url.searchParams.set("thread_id", this.#threadId);

		return await this.#request("POST", url, message, options, (answer) => {
			let id = record(answer.json)["id"];
			if (typeof id !== "string" || id === "") return null;
			return {
				provider: this.provider,
				id,
				...(this.#threadId === undefined ? {} : { threadId: this.#threadId }),
			};
		});
	}

	/**
	 * Edits a message this webhook posted, in the thread its ref names.
	 *
	 * @param ref - The ref `send` answered.
	 * @param message - The message to show instead.
	 * @param options - Timeout and signal.
	 * @returns The same ref, or `invalid-ref` for another provider's ref.
	 */
	async update(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>> {
		let invalid = refError(this.provider, ref, ["id"]);
		if (invalid) return failure(invalid);

		let checked = DiscordWebhook.check(this.#url);
		if (isFailure(checked)) return checked;

		let url = new URL(checked.data);
		url.pathname = `${withoutTrailingSlashes(url.pathname)}/messages/${encodeURIComponent(ref["id"] ?? "")}`;
		let threadId = ref["threadId"];
		if (threadId) url.searchParams.set("thread_id", threadId);

		return await this.#request("PATCH", url, message, options, () => ref);
	}

	/** Shared body of `send` and `update`: one JSON request, never following a redirect. */
	async #request(
		method: "POST" | "PATCH",
		url: URL,
		message: Message,
		options: SendOptions | undefined,
		ref: (answer: Answer) => SentRef | null,
	): Promise<Result<Sent, MessagingError>> {
		let body = JSON.stringify(this.render(message));
		let exchange = { provider: this.provider, host: url.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(url, {
						method,
						headers: { "Content-Type": "application/json" },
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyDiscordWebhook(exchange, answer),
				ref,
			},
			options,
		);
	}
}

/**
 * The path without its trailing slashes, so the message path joins with exactly one;
 * scanned from the end so a path holding thousands of slashes still costs linear time.
 */
function withoutTrailingSlashes(pathname: string): string {
	let end = pathname.length;
	while (end > 0 && pathname[end - 1] === "/") end--;
	return pathname.slice(0, end);
}
