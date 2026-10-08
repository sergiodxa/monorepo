/**
 * Google Chat destinations: `GoogleChatWebhook` posts a card to a space's incoming
 * webhook, threading every message that shares a `key` under one thread with nothing
 * stored. Editing needs app authentication, so a webhook message is never edited.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, SendOptions, Sent } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message } from "../message.js";

import { answerError, checkDestination, deliver } from "../deliver.js";
import { mrkdwn, writeText } from "../text.js";

/** Google Chat's limit on a message's text; the card carries the rest. */
const LIMITS = {
	text: 4096,
} as const;

/** Names the one card a message carries; Google Chat only needs it unique per message. */
const CARD_ID = "message";

/** Starts a thread for a new `threadKey` and replies into it for one already used. */
const REPLY_OPTION = "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD";

/** A card widget, as plain data. */
export type GoogleChatWidget = Record<string, unknown>;

/** The `cardsV2` card a message carries. */
export interface GoogleChatCard {
	header: { title: string; subtitle?: string };
	sections?: { widgets: GoogleChatWidget[] }[];
}

/** The body a space webhook receives. */
export interface GoogleChatWebhookPayload {
	/** The text above the card, in Google Chat's text format. */
	text?: string;
	cardsV2: [{ cardId: string; card: GoogleChatCard }];
	thread?: { threadKey: string };
}

/** Writes a timestamp as `2026-10-06 12:00 UTC`, since a card header draws no dates. */
function cardTime(timestamp: Date): string {
	return `${timestamp.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Writes a message as a `cardsV2` card: the title and timestamp in the header, a
 * decorated text per field, and a button list opening each link. Card text reads HTML,
 * so field values are escaped as typed.
 *
 * @param message - The message.
 * @returns The card.
 */
export function googleChatCard(message: Message): GoogleChatCard {
	let widgets: GoogleChatWidget[] = (message.fields ?? []).map((field) => ({
		decoratedText: {
			topLabel: mrkdwn.escape(field.label),
			text: mrkdwn.escape(field.value),
			wrapText: true,
		},
	}));

	let links = message.links ?? [];
	if (links.length > 0) {
		widgets.push({
			buttonList: {
				buttons: links.map((link) => ({
					text: link.label,
					onClick: { openLink: { url: link.url } },
				})),
			},
		});
	}

	return {
		header: {
			title: message.title,
			...(message.timestamp ? { subtitle: cardTime(message.timestamp) } : {}),
		},
		...(widgets.length > 0 ? { sections: [{ widgets }] } : {}),
	};
}

/** Maps a deleted space or webhook, which answers `404`, to `gone`. */
function classifyGoogleChatWebhook(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	if (answer.status === 404) return answerError(exchange, answer, "gone", "answered 404");
	return null;
}

/** How a `GoogleChatWebhook` is configured. */
export interface GoogleChatWebhookOptions {
	/** The space webhook URL; its `key` and `token` query parameters are the credential. */
	url: string;
}

/**
 * Posts to a Google Chat space webhook. The URL must be on `https://chat.googleapis.com/`,
 * so a pasted URL can never point a send anywhere else. A message with a `key` lands in
 * that key's thread.
 *
 * @example await new GoogleChatWebhook({ url: config.webhookUrl }).send(message);
 */
export class GoogleChatWebhook implements Destination {
	readonly provider = "google-chat-webhook";

	#url: string;

	/** @param options - The webhook URL. */
	constructor(options: GoogleChatWebhookOptions) {
		this.#url = options.url;
	}

	/**
	 * Validates a pasted URL with the rule a send applies.
	 *
	 * @param url - The URL as pasted.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("google-chat-webhook", url, {
			prefixes: ["https://chat.googleapis.com/"],
		});
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): GoogleChatWebhookPayload {
		return {
			...(message.text ? { text: writeText(message.text, mrkdwn, LIMITS.text) } : {}),
			cardsV2: [{ cardId: CARD_ID, card: googleChatCard(message) }],
			...(message.key ? { thread: { threadKey: message.key } } : {}),
		};
	}

	/**
	 * Posts the message, into the `key`'s thread when it has one. The answer's message
	 * name can only be edited with app authentication, so the ref is always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let checked = GoogleChatWebhook.check(this.#url);
		if (isFailure(checked)) return checked;

		let url = new URL(checked.data);
		if (message.key) url.searchParams.set("messageReplyOption", REPLY_OPTION);

		let body = JSON.stringify(this.render(message));
		let exchange = { provider: this.provider, host: url.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json; charset=UTF-8" },
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyGoogleChatWebhook(exchange, answer),
			},
			options,
		);
	}
}
