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
import { generateUUID } from "@sdxc/uuid/v4";

import type { AnyEmailDeclaration } from "./emails.js";
import type { DeliveryFor, EmailDelivery, Mail, QueuedEmail } from "./mail.js";
import type {
	Address,
	Email,
	Message,
	NormalizedMessage,
	SentMessage,
	Transport,
} from "./types.js";

import { isEmailDeclaration } from "./emails.js";
import { MailError } from "./errors.js";
import { isValidAddress, toAddressList } from "./lib/address.js";
import { htmlToText } from "./lib/html-to-text.js";
import { buildListHeaders } from "./lib/list-headers.js";
import { render } from "./render.js";

/** An iTIP method is an iana-token or x-name, which is all a `method=` parameter may hold. */
const METHOD = /^[A-Za-z0-9-]+$/;

/**
 * Printable ASCII without quotes, backslashes or path separators, so the name travels in
 * a quoted `filename` parameter unchanged and no client reads a directory into it.
 */
const FILENAME = /^[\x20-\x21\x23-\x2E\x30-\x5B\x5D-\x7E]+$/;

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
	/**
	 * The app's `createMail()` instance, which resolves a declared email to its template; what
	 * lets `send()`, `later()` and `queue()` take a declaration.
	 */
	mail?: Mail;
	/**
	 * Hands a declared email's delivery to the app's queue, which is what `queue()` calls; the
	 * job that receives it sends it with `ctx.email.deliver(ctx.input)`.
	 */
	queue?: (delivery: QueuedEmail) => Promise<void>;
}

/** A send handed to `later()`, held as the call that performs it until the queue is flushed. */
type DeferredSend = () => Promise<Result<SentMessage, MailError>>;

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
	return `<${generateUUID()}@${domain}>`;
}

/**
 * Rejects messages no transport could deliver, so the failure names the mistake instead of
 * a provider error: a missing sender or recipient, an unroutable address, no body at all,
 * or a calendar method or filename that would break the header it is written into.
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

	if (message.calendar) {
		let { method, filename } = message.calendar;
		if (!METHOD.test(method)) {
			return failure(new MailError(`"${method}" is not a calendar method.`));
		}
		if (filename !== undefined && !FILENAME.test(filename)) {
			return failure(new MailError(`"${filename}" is not a calendar attachment filename.`));
		}
	}

	return success(message);
}

/** The failure a declared email meets on a mailer opened without the app's mail instance. */
function noRegistry(): MailError {
	return new MailError(
		"This mailer sends declared emails only when configured with the app's `createMail()` instance.",
	);
}

/**
 * Sends mail through a transport, applying one app's sender identity to every
 * message. The instance is request-scoped when `later()` is used, because the
 * queue it fills belongs to whoever flushes it.
 */
export class Mailer {
	/** Configuration shared by every message this mailer sends. */
	#options: MailerOptions;

	/** Sends deferred by `later()`, drained by `flush()`. */
	#queue: DeferredSend[] = [];

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
	 * @param input - A declared email, a plain message, or an email object that renders its own body.
	 * @param overrides - For a declared email, the delivery: recipient, locale and props; otherwise
	 *   fields that replace what the input provides for this send.
	 * @returns The provider's identifier on success, a `MailError` on failure.
	 * @example let result = await ctx.email.send(emails.teams.invite, { to, locale, props: { team, url } });
	 */
	send<Declaration extends AnyEmailDeclaration>(
		input: Declaration,
		delivery: DeliveryFor<Declaration>,
	): Promise<Result<SentMessage, MailError>>;
	send(input: Message | Email, overrides?: SendOptions): Promise<Result<SentMessage, MailError>>;
	async send(
		input: Message | Email | AnyEmailDeclaration,
		overrides?: SendOptions | EmailDelivery,
	): Promise<Result<SentMessage, MailError>> {
		if (isEmailDeclaration(input))
			return await this.#sendDeclared(input, overrides as EmailDelivery);
		let prepared = await this.#normalize(input, overrides as SendOptions | undefined);
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
	 * @param input - A declared email, a plain message, or an email object that renders its own body.
	 * @param overrides - For a declared email, the delivery; otherwise fields that replace what
	 *   the input provides for this send.
	 * @example ctx.email.later(emails.passwordReset, { to: user.email, locale, props: { url } });
	 */
	later<Declaration extends AnyEmailDeclaration>(
		input: Declaration,
		delivery: DeliveryFor<Declaration>,
	): void;
	later(input: Message | Email, overrides?: SendOptions): void;
	later(
		input: Message | Email | AnyEmailDeclaration,
		overrides?: SendOptions | EmailDelivery,
	): void {
		this.#queue.push(() =>
			isEmailDeclaration(input)
				? this.#sendDeclared(input, overrides as EmailDelivery)
				: this.send(input, overrides as SendOptions | undefined),
		);
	}

	/**
	 * Hands a declared email to the app's queue, so a job sends it with retries on its own
	 * schedule. The props are validated here, so a caller learns about bad props where it wrote
	 * them; they render, translated, when the job delivers them.
	 *
	 * @param email - The declared email.
	 * @param delivery - The recipient, the locale and the props, all plain JSON.
	 * @returns Success once the queue accepted the delivery; an `EmailRefusedError` for props the
	 *   schema refuses, or a `MailError` when no queue is configured or it threw.
	 * @example await ctx.email.queue(emails.teams.invite, { to, locale, props: { team, url } });
	 */
	async queue<Declaration extends AnyEmailDeclaration>(
		email: Declaration,
		delivery: DeliveryFor<Declaration>,
	): Promise<Result<void, MailError>> {
		let { mail, queue } = this.#options;
		if (mail === undefined) return failure(noRegistry());
		if (queue === undefined) {
			return failure(new MailError("This mailer has no `queue` to hand deliveries to."));
		}
		let props = await mail.validate(email, delivery.props);
		if (isFailure(props)) return props;
		let queued = await wrap(() => queue({ ...delivery, email: email.name }));
		if (isFailure(queued)) {
			return failure(
				new MailError(`Failed to queue the "${email.name}" email.`, { cause: queued.error }),
			);
		}
		return success(undefined);
	}

	/**
	 * Sends a delivery `queue()` handed to the app's queue, which is the whole of the job that
	 * receives it. An `EmailRefusedError` means no retry can send it; any other failure can.
	 *
	 * @param queued - The delivery as the job received it.
	 * @returns The provider's identifier on success, a `MailError` on failure.
	 * @example let sent = await ctx.email.deliver(ctx.input);
	 */
	async deliver(queued: QueuedEmail): Promise<Result<SentMessage, MailError>> {
		let { email, ...delivery } = queued;
		return await this.#sendDeclared(email, delivery);
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
		return await Promise.all(queued.map((deferred) => deferred()));
	}

	/**
	 * Composes a declared email through the app's mail instance and sends it, with the
	 * delivery's sender and copies applied over the mailer's.
	 */
	async #sendDeclared(
		email: AnyEmailDeclaration | string,
		delivery: EmailDelivery,
	): Promise<Result<SentMessage, MailError>> {
		let mail = this.#options.mail;
		if (mail === undefined) return failure(noRegistry());
		let composed = await mail.compose(email, delivery);
		if (isFailure(composed)) return composed;
		let overrides: SendOptions = {};
		if (delivery.from !== undefined) overrides.from = delivery.from;
		if (delivery.cc !== undefined) overrides.cc = delivery.cc;
		if (delivery.bcc !== undefined) overrides.bcc = delivery.bcc;
		return await this.send(composed.data, overrides);
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
			unsubscribe: input.unsubscribe,
			list: input.list,
			calendar: input.calendar,
			html: rendered.data.html,
			text: rendered.data.text,
		});
	}

	/**
	 * Produces the shape transports read: configured defaults filled in, address
	 * lists coerced, a plain-text part derived, the `List-*` headers generated from
	 * their options, and the source email recorded for type-based lookup. Validation
	 * runs last, so a failure describes the final message.
	 */
	async #normalize(
		input: Message | Email,
		overrides?: SendOptions,
	): Promise<Result<NormalizedMessage, MailError>> {
		let converted = await this.#toMessage(input);
		if (isFailure(converted)) return converted;

		let message = { ...converted.data, ...overrides };
		let from = message.from ?? this.#options.from;
		let headers = { ...this.#options.headers, ...message.headers };
		let unsubscribe = message.unsubscribe ?? null;
		let list = message.list ?? null;

		let listHeaders = buildListHeaders(headers, { unsubscribe, list });
		if (isFailure(listHeaders)) return listHeaders;

		return validate({
			from,
			to: toAddressList(message.to),
			cc: toAddressList(message.cc),
			bcc: toAddressList(message.bcc),
			replyTo: toAddressList(message.replyTo ?? this.#options.replyTo),
			subject: message.subject,
			html: message.html,
			text: derivePlainText(converted.data, overrides),
			headers: { ...headers, ...listHeaders.data },
			date: message.date ?? new Date(),
			messageId: message.messageId ?? generateMessageId(from),
			unsubscribe,
			list,
			calendar: message.calendar,
			email: isEmail(input) ? input : undefined,
		});
	}
}
