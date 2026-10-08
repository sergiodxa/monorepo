/**
 * The Pushover destination: posts one form to `api.pushover.net` with Pushover's HTML
 * subset, a priority by severity and the first link as the supplementary URL. Pushover
 * answers no message an app can edit, so a send is all it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message } from "../message.js";

import { answerError, deliver, readSecret, record } from "../deliver.js";
import { severityOf } from "../severity.js";
import { fitText, pushoverHtml, writeText } from "../text.js";

/** Pushover's limits, past which it rejects the message. */
const LIMITS = { title: 250, message: 1024, url: 512, urlTitle: 100, label: 100 } as const;

/** Milliseconds in a second, for Pushover's Unix-seconds timestamp. */
const SECOND_MS = 1000;

/** When an emergency notification repeats until acknowledged, and for how long. */
export interface PushoverEmergency {
	/** Seconds between repeats; Pushover requires at least 30. */
	retry: number;
	/** Seconds before it stops repeating; Pushover allows at most 10800. */
	expire: number;
}

/** How a `Pushover` destination is configured. */
export interface PushoverOptions {
	/** The application's API token. */
	token: Secret;
	/** The user or group key the notification goes to. */
	user: Secret;
	/** Delivers to one of the user's devices by name, instead of all of them. */
	device?: string;
	/** One of Pushover's sound names. */
	sound?: string;
	/**
	 * Sends a critical message at emergency priority, repeating until acknowledged.
	 * Without it a critical message is high priority, which plays once.
	 */
	emergency?: PushoverEmergency;
}

/** The form fields a send posts, apart from the token and user key, which stay out of previews. */
export interface PushoverPayload {
	title: string;
	message: string;
	html: "1";
	priority: string;
	/** Unix seconds; without it Pushover shows when the message arrived. */
	timestamp?: string;
	url?: string;
	url_title?: string;
	device?: string;
	sound?: string;
	retry?: string;
	expire?: string;
}

/**
 * Reads Pushover's `{ status: 0, token: "invalid" }` and `user: "invalid"` answers as
 * `unauthorized`, and a `2xx` without `status: 1` as `rejected`.
 */
function classifyPushover(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	let body = record(answer.json);
	if (body["token"] === "invalid") {
		return answerError(exchange, answer, "unauthorized", "rejected the application token");
	}
	if (body["user"] === "invalid") {
		return answerError(exchange, answer, "unauthorized", "rejected the user key");
	}
	if (answer.status >= 200 && answer.status < 300 && body["status"] !== 1) {
		return answerError(exchange, answer, "rejected", "answered without status 1");
	}
	return null;
}

/**
 * Sends Pushover notifications as one application to one user or group. Emergency
 * priority is used only when `emergency` is configured and the message is critical.
 *
 * @example await new Pushover({ token: () => env.PUSHOVER_TOKEN, user: config.userKey }).send(message);
 */
export class Pushover extends APIClient implements Destination {
	readonly provider = "pushover";

	protected override readonly propagateTrace = "none";

	#token: Secret;
	#user: Secret;
	#device: string | null;
	#sound: string | null;
	#emergency: PushoverEmergency | null;

	/** @param options - The credentials, and the device, sound and emergency settings. */
	constructor(options: PushoverOptions) {
		super(new URL("https://api.pushover.net/"));
		this.#token = options.token;
		this.#user = options.user;
		this.#device = options.device ?? null;
		this.#sound = options.sound ?? null;
		this.#emergency = options.emergency ?? null;
	}

	/**
	 * The exact form a send posts, without the credentials; a subclass overrides it to
	 * change the layout. Fields are written before the text so they always fit.
	 *
	 * @param message - The message.
	 */
	render(message: Message): PushoverPayload {
		let lines: string[] = [];
		let used = 0;
		for (let field of message.fields ?? []) {
			let line = `<b>${fitText(field.label, LIMITS.label, pushoverHtml.escape)}</b>: ${fitText(field.value, LIMITS.message, pushoverHtml.escape)}`;
			if (used + line.length + 1 > LIMITS.message) break;
			lines.push(line);
			used += line.length + 1;
		}
		let tail = lines.join("\n");

		let room = LIMITS.message - tail.length - (tail === "" ? 0 : 2);
		let text = message.text && room > 0 ? writeText(message.text, pushoverHtml, room) : "";
		let body = [text, tail].filter((part) => part !== "").join("\n\n");

		let critical = severityOf(message) === "critical";
		let emergency = critical ? this.#emergency : null;
		let payload: PushoverPayload = {
			title: fitText(message.title, LIMITS.title),
			message: body === "" ? fitText(message.title, LIMITS.message, pushoverHtml.escape) : body,
			html: "1",
			priority: emergency ? "2" : critical ? "1" : "0",
		};

		if (message.timestamp) {
			payload.timestamp = String(Math.floor(message.timestamp.getTime() / SECOND_MS));
		}
		let link = (message.links ?? []).find((candidate) => candidate.url.length <= LIMITS.url);
		if (link) {
			payload.url = link.url;
			payload.url_title = fitText(link.label, LIMITS.urlTitle);
		}
		if (this.#device !== null) payload.device = this.#device;
		if (this.#sound !== null) payload.sound = this.#sound;
		if (emergency) {
			payload.retry = String(emergency.retry);
			payload.expire = String(emergency.expire);
		}
		return payload;
	}

	/**
	 * Posts the message. Pushover's `request` id identifies the call, not a message an
	 * app can edit, so the ref is always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 */
	async send(message: Message, options: SendOptions = {}): Promise<Result<Sent, MessagingError>> {
		let token = await readSecret(this.provider, this.#token);
		if (isFailure(token)) return token;
		let user = await readSecret(this.provider, this.#user);
		if (isFailure(user)) return user;

		let form = new URLSearchParams({ token: token.data, user: user.data });
		for (let [name, value] of Object.entries(this.render(message))) {
			if (typeof value === "string") form.set(name, value);
		}

		let exchange = { provider: this.provider, host: this.baseURL.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					this.post("/1/messages.json", { body: form, redirect: "manual", signal }),
				classify: (answer) => classifyPushover(exchange, answer),
			},
			options,
		);
	}
}
