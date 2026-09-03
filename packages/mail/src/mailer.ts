/**
 * The mailer: it owns normalization (defaults, address coercion, plain-text
 * derivation, validation) and hands the result to a transport. Delivery is a
 * value, so `send()` reports failure as a `Result` and never throws, and
 * `later()` gives fire-and-forget mail a defined lifetime instead of an
 * unawaited promise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type {
	Address,
	Email,
	Message,
	NormalizedMessage,
	SentMessage,
	Transport,
} from "./types.js";

import { MailError } from "./errors.js";
import { isValidAddress, toAddressList } from "./lib/address.js";
import { htmlToText } from "./lib/html-to-text.js";
import { render } from "./render.js";

/**
 * Fields that replace what a `Message` or an `Email` already provides for a single
 * send, such as redirecting an email to a forwarded address.
 */
export type SendOptions = Partial<Message>;

/** Configuration every message a mailer sends inherits. */
export interface MailerOptions {
	transport: Transport;
	/** Sender identity for the app; a message may override it. */
	from: Address;
	/** Where replies go by default; a message or email may override it. */
	replyTo?: Address | Address[];
	/** Headers added to every message, with per-message headers winning. */
	headers?: Record<string, string>;
}

/** A message handed to `later()`, kept with its overrides until the queue is flushed. */
interface QueuedMessage {
	input: Message | Email;
	/** Overrides recorded at queue time, applied when the queue is flushed. */
	overrides?: SendOptions;
}

/**
 * Reports whether a value is an `Email` rather than a plain `Message`.
 * Discrimination is structural: a callable `body` is the one member only an email
 * has, so anything else is a message.
 *
 * @param value - The value handed to `send()` or `later()`.
 * @returns `true` when the value carries a callable `body`.
 */
export function isEmail(value: Message | Email): value is Email {
	return typeof (value as Email).body === "function";
}

/**
 * Chooses the plain-text part. An explicit one always wins, so a caller can
 * replace a derived version that reads badly; otherwise it derives from the
 * HTML actually sent, keeping the two parts from disagreeing on an override.
 */
function derivePlainText(message: Message, overrides?: SendOptions): string | undefined {
	if (overrides?.text !== undefined) return overrides.text;
	if (overrides?.html !== undefined) return htmlToText(overrides.html);
	if (message.text !== undefined) return message.text;
	if (message.html !== undefined) return htmlToText(message.html);
	return undefined;
}

/**
 * Builds a `Message-ID` inside the sender's domain, which is what receivers expect
 * of a generated identifier. Callers that need a stable value set `messageId` on
 * the message instead of reaching for a clock or id seam.
 */
function generateMessageId(from: Address): string {
	let domain = from.email.split("@").at(1) ?? "localhost";
	return `<${crypto.randomUUID()}@${domain}>`;
}

/**
 * Rejects messages no transport could deliver, so the failure names the mistake
 * instead of surfacing as a provider error later: a missing sender or recipient,
 * an address that cannot be routed, or a message with no body at all.
 */
function validate(message: NormalizedMessage): Result<NormalizedMessage, MailError> {
	if (!message.from.email) return failure(new MailError("A message needs a sender address."));
	if (message.to.length === 0) {
		return failure(new MailError("A message needs at least one recipient."));
	}

	let addresses = [message.from, ...message.to, ...message.cc, ...message.bcc, ...message.replyTo];
	for (let address of addresses) {
		if (isValidAddress(address)) continue;
		return failure(new MailError(`"${address.email}" is not a valid email address.`));
	}

	if (!message.html && !message.text) {
		return failure(new MailError("A message needs an HTML or a plain-text body."));
	}

	return success(message);
}

/**
 * Sends mail through a transport, applying one app's sender identity to every
 * message. The instance is request-scoped when `later()` is used, because the
 * queue it fills belongs to whoever flushes it.
 */
export class Mailer {
	/** Configuration shared by every message this mailer sends. */
	#options: MailerOptions;

	/** Messages queued by `later()`, drained by `flush()`. */
	#queue: QueuedMessage[] = [];

	/**
	 * Creates a mailer.
	 *
	 * @param options - Transport and sender configuration; see {@link MailerOptions}.
	 */
	constructor(options: MailerOptions) {
		this.#options = options;
	}

	/** Number of messages waiting for the next `flush()`. */
	get pending(): number {
		return this.#queue.length;
	}

	/**
	 * Normalizes and delivers a message, awaiting the outcome. Never throws: a
	 * render failure, an invalid message, a rejected delivery, and a transport
	 * that throws all arrive as a `MailError` failure for the caller to inspect.
	 *
	 * @param input - A plain message, or an email object that renders its own body.
	 * @param overrides - Fields that replace what the input provides for this send.
	 * @returns The provider's identifier on success, a `MailError` on failure.
	 * @example let result = await mailer.send(new TeamInviteEmail(invite));
	 */
	async send(
		input: Message | Email,
		overrides?: SendOptions,
	): Promise<Result<SentMessage, MailError>> {
		let prepared = await this.#normalize(input, overrides);
		if (isFailure(prepared)) return prepared;

		let message = prepared.data;
		let outcome = await wrap(() => this.#options.transport.send(message));
		if (isFailure(outcome)) {
			return failure(
				new MailError("The transport threw while sending the message.", {
					cause: outcome.error,
				}),
			);
		}

		return outcome.data;
	}

	/**
	 * Queues a message to be sent once the caller flushes, which is how a send whose
	 * failure must not affect the response gets a defined lifetime. Nothing is
	 * rendered or validated yet; that happens at flush time.
	 *
	 * @param input - A plain message, or an email object that renders its own body.
	 * @param overrides - Fields that replace what the input provides for this send.
	 * @example ctx.email.later(new PasswordResetEmail(user));
	 */
	later(input: Message | Email, overrides?: SendOptions): void {
		this.#queue.push({ input, overrides });
	}

	/**
	 * Sends everything `later()` queued and empties the queue. Results come back in
	 * queue order for the caller to log; like `send()`, it never throws, so a failed
	 * deferred message cannot break whoever is flushing.
	 *
	 * @returns One result per queued message, in the order they were queued.
	 */
	async flush(): Promise<Result<SentMessage, MailError>[]> {
		let queued = this.#queue.splice(0, this.#queue.length);
		return await Promise.all(queued.map((entry) => this.send(entry.input, entry.overrides)));
	}

	/**
	 * Turns an email object into a plain message by reading its addressing and
	 * rendering its body to both parts. Plain messages pass through untouched.
	 */
	async #toMessage(input: Message | Email): Promise<Result<Message, MailError>> {
		if (!isEmail(input)) return success(input);

		let rendered = await wrap(() => render(input.body()));
		if (isFailure(rendered)) {
			return failure(new MailError("Failed to render the email body.", { cause: rendered.error }));
		}

		return success({
			to: input.to,
			subject: input.subject,
			replyTo: input.replyTo,
			headers: input.headers,
			html: rendered.data.html,
			text: rendered.data.text,
		});
	}

	/**
	 * Produces the shape transports read: configured defaults filled in, address
	 * lists coerced, a plain-text part derived, and the source email recorded for
	 * type-based lookup. Validation runs last, so a failure describes the final message.
	 */
	async #normalize(
		input: Message | Email,
		overrides?: SendOptions,
	): Promise<Result<NormalizedMessage, MailError>> {
		let converted = await this.#toMessage(input);
		if (isFailure(converted)) return converted;

		let message = { ...converted.data, ...overrides };
		let from = message.from ?? this.#options.from;

		return validate({
			from,
			to: toAddressList(message.to),
			cc: toAddressList(message.cc),
			bcc: toAddressList(message.bcc),
			replyTo: toAddressList(message.replyTo ?? this.#options.replyTo),
			subject: message.subject,
			html: message.html,
			text: derivePlainText(converted.data, overrides),
			headers: { ...this.#options.headers, ...message.headers },
			date: message.date ?? new Date(),
			messageId: message.messageId ?? generateMessageId(from),
			email: isEmail(input) ? input : undefined,
		});
	}
}
