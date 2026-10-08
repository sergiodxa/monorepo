/**
 * Telegram destination: `TelegramBot` sends as a bot to one chat or forum topic, in
 * Telegram's HTML `parse_mode` with links as inline URL buttons, and can edit or reply
 * to what it sent. The bot token sits in the request path, so no error ever names it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { failure, isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent, SentRef } from "../destination.js";
import type { MessagingErrorCode } from "../error.js";
import type { Message } from "../message.js";

import { answerError, deliver, readSecret, record, refError } from "../deliver.js";
import { MessagingError } from "../error.js";
import { fitText, telegramHtml, writeText } from "../text.js";

/** Telegram's message length, past which it rejects the whole message. */
const MAX_TEXT_LENGTH = 4096;

/** How much of the message the title, a field label and a field value may each take. */
const PART_LIMITS = { title: 256, fieldLabel: 128, fieldValue: 1024 } as const;

/** Between the title, the text and the fields. */
const SECTION_SEPARATOR = "\n\n";

/** Lowercased fragments of Telegram's descriptions that mean the chat is closed to the bot for good. */
const GONE_DESCRIPTIONS: readonly string[] = [
	"chat not found",
	"bot was blocked by the user",
	"user is deactivated",
	"bot was kicked",
];

/** The edit answer for a message whose text and buttons already read that way. */
const NOT_MODIFIED_DESCRIPTION = "message is not modified";

/** The fields a `TelegramBot` ref needs to edit or reply to a message. */
const REF_FIELDS = ["chatId", "messageId"] as const;

/** An inline keyboard button that opens a URL. */
export interface TelegramUrlButton {
	text: string;
	url: string;
}

/** The body `sendMessage` receives, which `editMessageText` and a reply extend. */
export interface TelegramPayload {
	chat_id: string | number;
	/** The forum topic, when the bot posts into one. */
	message_thread_id?: number;
	text: string;
	parse_mode: "HTML";
	link_preview_options: { is_disabled: true };
	/** The message's links, as one row of URL buttons. */
	reply_markup?: { inline_keyboard: TelegramUrlButton[][] };
}

/** How a `TelegramBot` is configured. */
export interface TelegramBotOptions {
	/** The token BotFather issued, read on every send. */
	token: Secret;
	/** The chat's numeric id, or a channel's `@username`. */
	chatId: string | number;
	/** The forum topic every message goes to, in a chat with topics enabled. */
	messageThreadId?: number;
}

/** A message's fields as `label: value` lines, bold labels, kept within `room` characters. */
function fieldLines(message: Message, room: number): string {
	let lines: string[] = [];
	let used = 0;
	for (let field of message.fields ?? []) {
		let label = fitText(field.label, PART_LIMITS.fieldLabel, telegramHtml.escape);
		let value = fitText(field.value, PART_LIMITS.fieldValue, telegramHtml.escape);
		let line = `${telegramHtml.strong(label)}: ${value}`;
		let cost = line.length + (lines.length > 0 ? 1 : 0);
		if (used + cost > room) break;
		lines.push(line);
		used += cost;
	}
	return lines.join("\n");
}

/**
 * Writes a message as Telegram HTML: the bold title, the text, then the fields. The
 * fields are kept first and the text is cut, so the whole stays within 4,096 characters.
 *
 * @param message - The message.
 * @returns The HTML text.
 */
export function telegramText(message: Message): string {
	let title = telegramHtml.strong(fitText(message.title, PART_LIMITS.title, telegramHtml.escape));
	let fields = fieldLines(message, MAX_TEXT_LENGTH - title.length - SECTION_SEPARATOR.length);

	let used = title.length + (fields === "" ? 0 : SECTION_SEPARATOR.length + fields.length);
	let room = MAX_TEXT_LENGTH - used - SECTION_SEPARATOR.length;
	let text = message.text && room > 0 ? writeText(message.text, telegramHtml, room) : "";

	return [title, text, fields].filter((part) => part !== "").join(SECTION_SEPARATOR);
}

/** Reads Telegram's description, with the token removed in case an answer ever echoed it. */
function answerDetail(answer: Answer, token: string): string {
	let description = record(answer.json)["description"];
	if (typeof description !== "string" || description === "") return `answered ${answer.status}`;
	return `answered ${description.replaceAll(token, "[token]")}`;
}

/**
 * Reads Telegram's `{ ok: false, error_code, description }` answer: a chat that is gone
 * or blocked the bot is `gone`, whatever status carried it; otherwise the code decides.
 */
function classifyTelegram(
	exchange: { provider: string; host: string },
	answer: Answer,
	token: string,
): MessagingError | null {
	let body = record(answer.json);
	if (body["ok"] === true) return null;

	let description = typeof body["description"] === "string" ? body["description"] : "";
	let lowered = description.toLowerCase();
	let status = typeof body["error_code"] === "number" ? body["error_code"] : answer.status;
	if (status >= 200 && status < 300) return null;

	let code: MessagingErrorCode = "rejected";
	if (GONE_DESCRIPTIONS.some((fragment) => lowered.includes(fragment))) code = "gone";
	else if (status === 401 || status === 403) code = "unauthorized";
	else if (status === 429) code = "rate-limited";
	else if (status >= 500) code = "unavailable";

	return answerError(exchange, answer, code, answerDetail(answer, token));
}

/**
 * The Bot API path for a method. It starts at the root, so the token's colon is read
 * as part of the path, where a relative `bot<token>` would parse as a URL scheme.
 */
function methodPath(token: string, method: string): string {
	return `/bot${token}/${method}`;
}

/** Whether an edit failed only because the message already reads that way. */
function isNotModified(answer: Answer): boolean {
	let description = record(answer.json)["description"];
	return typeof description === "string" && description.includes(NOT_MODIFIED_DESCRIPTION);
}

/** Reads where Telegram put the message, from the `Message` its `result` holds. */
function telegramRef(answer: Answer, fallbackChatId: string | number): SentRef | null {
	let result = record(record(answer.json)["result"]);
	let messageId = result["message_id"];
	if (typeof messageId !== "number") return null;
	let chatId = record(result["chat"])["id"];
	return {
		provider: "telegram-bot",
		chatId: String(
			typeof chatId === "number" || typeof chatId === "string" ? chatId : fallbackChatId,
		),
		messageId: String(messageId),
	};
}

/**
 * Sends as a Telegram bot to one chat, in HTML with link previews off and links as
 * inline URL buttons. Telegram has no color, so the title carries the state in words.
 *
 * @example await new TelegramBot({ token: () => env.TELEGRAM_BOT_TOKEN, chatId: config.chatId }).send(message);
 */
export class TelegramBot extends APIClient implements Destination {
	readonly provider = "telegram-bot";

	/** Telegram is outside the caller's trace, so no trace header reaches it. */
	protected override readonly propagateTrace = "none";

	#token: Secret;
	#chatId: string | number;
	#messageThreadId: number | undefined;

	/** @param options - The bot token, the chat and the optional forum topic. */
	constructor(options: TelegramBotOptions) {
		super(new URL("https://api.telegram.org/"));
		this.#token = options.token;
		this.#chatId = options.chatId;
		this.#messageThreadId = options.messageThreadId;
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): TelegramPayload {
		let payload: TelegramPayload = {
			chat_id: this.#chatId,
			text: telegramText(message),
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
		};
		if (this.#messageThreadId !== undefined) payload.message_thread_id = this.#messageThreadId;

		let links = message.links ?? [];
		if (links.length > 0) {
			payload.reply_markup = {
				inline_keyboard: [links.map((link) => ({ text: link.label, url: link.url }))],
			};
		}
		return payload;
	}

	/**
	 * Sends the message with `sendMessage`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref holding the chat id and the message id.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		return await this.#call("sendMessage", this.render(message), options);
	}

	/**
	 * Rewrites the sent message and its buttons with `editMessageText`. An edit to the
	 * text it already has succeeds, so a repeated recovery is harmless.
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
		let invalid = refError(this.provider, ref, REF_FIELDS);
		if (invalid) return failure(invalid);

		let rendered = this.render(message);
		let body = {
			chat_id: ref["chatId"],
			message_id: Number(ref["messageId"]),
			text: rendered.text,
			parse_mode: rendered.parse_mode,
			link_preview_options: rendered.link_preview_options,
			reply_markup: rendered.reply_markup,
		};
		return await this.#call("editMessageText", body, options, (answer) =>
			isNotModified(answer) ? { ref } : null,
		);
	}

	/**
	 * Sends the message as a reply to the sent one with `reply_parameters`.
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
		let invalid = refError(this.provider, ref, REF_FIELDS);
		if (invalid) return failure(invalid);

		let body = {
			...this.render(message),
			chat_id: ref["chatId"],
			reply_parameters: { message_id: Number(ref["messageId"]) },
		};
		return await this.#call("sendMessage", body, options);
	}

	/**
	 * Reads the token and calls one Bot API method. `settle` names an error answer that
	 * still leaves the message reading as asked.
	 */
	async #call(
		method: string,
		body: object,
		options: SendOptions | undefined,
		settle?: (answer: Answer) => Sent | null,
	): Promise<Result<Sent, MessagingError>> {
		let token = await readSecret(this.provider, this.#token);
		if (isFailure(token)) return token;
		if (token.data === "") {
			return failure(
				new MessagingError(`${this.provider} has no token`, {
					code: "unauthorized",
					provider: this.provider,
					host: this.baseURL.host,
				}),
			);
		}

		let secret = token.data;
		let json = JSON.stringify(body);
		let exchange = { provider: this.provider, host: this.baseURL.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					this.post(methodPath(secret, method), {
						headers: { "Content-Type": "application/json" },
						body: json,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyTelegram(exchange, answer, secret),
				ref: (answer) => telegramRef(answer, this.#chatId),
				...(settle ? { settle } : {}),
			},
			options,
		);
	}
}
