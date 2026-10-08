/**
 * The generic webhook destination: posts the portable envelope to any public URL,
 * signed with Standard Webhooks so a receiver verifies it with any compliant library.
 * A subclass keeps an older contract by overriding the body and the signature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { sign as signStandard } from "@sdxc/webhooks";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent } from "../destination.js";
import type {
	Message,
	MessageData,
	MessageField,
	MessageLink,
	MessageState,
	Severity,
} from "../message.js";

import {
	admitDestination,
	answerError,
	checkDestination,
	deliver,
	readSecret,
} from "../deliver.js";
import { MessagingError } from "../error.js";

/** The body a `Webhook` posts: every field the message states, with an ISO timestamp. */
export interface WebhookEnvelope {
	/** Lets a receiver that shares one endpoint with other events tell this one apart. */
	type: "message";
	title: string;
	text?: string;
	severity?: Severity;
	fields?: MessageField[];
	links?: MessageLink[];
	/** ISO 8601, the form `MESSAGE_SCHEMA` reads back into a `Date`. */
	timestamp?: string;
	key?: string;
	state?: MessageState;
	data?: { [key: string]: MessageData };
}

/** One delivery's identity, the same for its body and its signature. */
export interface WebhookDelivery {
	/** `SendOptions.id`, or a generated `msg_<uuid>`; a receiver deduplicates retries by it. */
	id: string;
	/** When this attempt was signed. */
	timestamp: Date;
}

/** What signing a delivery needs: its identity and the secret read for this send. */
export interface WebhookSignContext extends WebhookDelivery {
	secret: string;
}

/** How a `Webhook` is configured. */
export interface WebhookOptions {
	/** Any URL the public policy accepts. */
	url: string;
	/** The signing secret shared with the receiver, read on every send. */
	secret: Secret;
	/**
	 * Also resolve the host before each send and refuse it unless every address is
	 * public, so a public name pointing inside a network is caught.
	 */
	resolve?: boolean;
}

/**
 * Writes a message as the portable envelope, leaving out every field the message
 * leaves out, so a receiver reads an absent field as absent.
 *
 * @param message - The message.
 * @returns The envelope.
 */
export function webhookEnvelope(message: Message): WebhookEnvelope {
	let envelope: WebhookEnvelope = { type: "message", title: message.title };
	if (message.text !== undefined) envelope.text = message.text;
	if (message.severity !== undefined) envelope.severity = message.severity;
	if (message.fields !== undefined) envelope.fields = message.fields;
	if (message.links !== undefined) envelope.links = message.links;
	if (message.timestamp !== undefined) envelope.timestamp = message.timestamp.toISOString();
	if (message.key !== undefined) envelope.key = message.key;
	if (message.state !== undefined) envelope.state = message.state;
	if (message.data !== undefined) envelope.data = message.data;
	return envelope;
}

/** Maps `410 Gone` to `gone`, the one status a receiver uses to say the hook was removed. */
function classifyWebhook(exchange: { provider: string; host: string }, answer: Answer) {
	if (answer.status !== 410) return null;
	return answerError(exchange, answer, "gone", "answered 410");
}

/**
 * Posts the portable envelope to a URL, signed with Standard Webhooks. A subclass
 * overrides `render` for its own body and `sign` for its own signature headers.
 *
 * @example await new Webhook({ url: config.url, secret: () => config.secret }).send(message, { id: eventId });
 */
export class Webhook implements Destination {
	readonly provider: string = "webhook";

	#url: string;
	#secret: Secret;
	#resolve: boolean;

	/** @param options - The URL, the signing secret and whether to resolve the host. */
	constructor(options: WebhookOptions) {
		this.#url = options.url;
		this.#secret = options.secret;
		this.#resolve = options.resolve ?? false;
	}

	/**
	 * Validates a pasted URL with the rule a send applies; the DNS check of `resolve`
	 * runs only at send time.
	 *
	 * @param url - The URL as pasted.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("webhook", url);
	}

	/**
	 * The exact body a send posts, serialized once and signed as sent. A subclass
	 * overrides it to keep its own payload, reading the delivery when the body names it.
	 *
	 * @param message - The message.
	 * @param _delivery - The delivery id and send time, the same ones the signature covers.
	 * @returns A JSON-serializable body.
	 */
	render(message: Message, _delivery: WebhookDelivery): object {
		return webhookEnvelope(message);
	}

	/**
	 * Answers the headers that authenticate a body: Standard Webhooks' `webhook-id`,
	 * `webhook-timestamp` and `webhook-signature`. A subclass overrides it to emit its
	 * own scheme; a secret it cannot use is an `invalid-destination`.
	 *
	 * @param body - The exact text that is sent.
	 * @param context - The delivery id, send time and secret.
	 * @returns The signature headers; `send` adds the content type.
	 */
	protected async sign(
		body: string,
		context: WebhookSignContext,
	): Promise<Result<Headers, MessagingError>> {
		let signed = await signStandard(body, {
			secret: context.secret,
			id: context.id,
			timestamp: context.timestamp,
		});
		if (isFailure(signed)) {
			return failure(
				new MessagingError(
					`${this.provider} could not sign the delivery: ${signed.error.message}`,
					{
						code: "invalid-destination",
						provider: this.provider,
					},
				),
			);
		}
		return success(signed.data.headers);
	}

	/**
	 * Posts the message once. Receivers have no message to edit, so the ref is always
	 * `null`; a retry reusing `options.id` lets the receiver drop the duplicate.
	 *
	 * @param message - The message.
	 * @param options - The delivery id, timeout and signal.
	 */
	async send(message: Message, options: SendOptions = {}): Promise<Result<Sent, MessagingError>> {
		let url = await admitDestination(
			this.provider,
			this.#url,
			{ resolve: this.#resolve },
			options.signal,
		);
		if (isFailure(url)) return url;

		let secret = await readSecret(this.provider, this.#secret);
		if (isFailure(secret)) return secret;

		let delivery: WebhookDelivery = {
			id: options.id ?? `msg_${crypto.randomUUID()}`,
			timestamp: new Date(),
		};
		let body = JSON.stringify(this.render(message, delivery));
		let headers = await this.sign(body, { ...delivery, secret: secret.data });
		if (isFailure(headers)) return headers;
		headers.data.set("Content-Type", "application/json");

		let exchange = { provider: this.provider, host: url.data.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(url.data, {
						method: "POST",
						headers: headers.data,
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyWebhook(exchange, answer),
			},
			options,
		);
	}
}
