/**
 * A destination that records what it is asked to send, for an app's tests: it answers
 * a ref per message, declares whichever optional capabilities a test asks for, and
 * fails on cue with any code, so retry and `gone` handling run without a network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type {
	Destination,
	OptionalCapability,
	SendOptions,
	Sent,
	SentRef,
} from "../destination.js";
import type { MessagingErrorCode } from "../error.js";
import type { Message } from "../message.js";

import { refError } from "../deliver.js";
import { MessagingError } from "../error.js";

/** How a `MemoryDestination` is set up. */
export interface MemoryDestinationOptions {
	/** The optional methods it declares. @default [] */
	capabilities?: readonly OptionalCapability[];
	/** The provider name its refs and errors carry. @default "memory" */
	provider?: string;
}

/** A failure a test scripts for the next call. */
export interface ScriptedFailure {
	code: MessagingErrorCode;
	status?: number;
	retryAfter?: number;
	message?: string;
}

/** One recorded call. */
export interface Recorded {
	kind: "send" | "update" | "reply";
	message: Message;
	/** The ref this call answered. */
	ref: SentRef;
	/** The ref `update` or `reply` was given. */
	parent?: SentRef;
	options?: SendOptions;
}

/**
 * Records every successful call, in order; a scripted failure records nothing, the
 * way a platform that refused a message never shows it.
 *
 * @example
 * let destination = new MemoryDestination({ capabilities: ["update"] });
 * destination.failNext({ code: "rate-limited", retryAfter: 30_000 });
 */
export class MemoryDestination implements Destination {
	readonly provider: string;

	/** Every successful call, oldest first. */
	readonly messages: Recorded[] = [];

	/** Edits the recorded message in place, when declared. */
	update?: (
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	) => Promise<Result<Sent, MessagingError>>;

	/** Records a reply under the recorded message, when declared. */
	reply?: (
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	) => Promise<Result<Sent, MessagingError>>;

	#failures: ScriptedFailure[] = [];
	#nextId = 1;

	/** @param options - The capabilities to declare and the provider name. */
	constructor(options: MemoryDestinationOptions = {}) {
		this.provider = options.provider ?? "memory";
		let capabilities = new Set(options.capabilities ?? []);
		if (capabilities.has("update")) {
			this.update = (ref, message, sendOptions) =>
				this.#follow("update", ref, message, sendOptions);
		}
		if (capabilities.has("reply")) {
			this.reply = (ref, message, sendOptions) => this.#follow("reply", ref, message, sendOptions);
		}
	}

	/** The most recent successful call, or `undefined` before any. */
	get last(): Recorded | undefined {
		return this.messages.at(-1);
	}

	/**
	 * Makes the next call fail; several queue in order.
	 *
	 * @param scripted - The code, status, delay and wording of the failure.
	 */
	failNext(scripted: ScriptedFailure): void {
		this.#failures.push(scripted);
	}

	/**
	 * Records the message and answers a fresh ref, unless a failure was scripted.
	 *
	 * @param message - The message.
	 * @param options - Recorded beside it.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let scripted = this.#takeFailure();
		if (scripted) return failure(scripted);
		return success({ ref: this.#record("send", message, undefined, options) });
	}

	/** Shared body of `update` and `reply`: the ref is checked before any scripted failure. */
	async #follow(
		kind: "update" | "reply",
		ref: SentRef,
		message: Message,
		options: SendOptions | undefined,
	): Promise<Result<Sent, MessagingError>> {
		let invalid = refError(this.provider, ref, ["id"]);
		if (invalid) return failure(invalid);
		if (!this.messages.some((entry) => entry.ref.id === ref["id"])) {
			return failure(
				new MessagingError(`${this.provider} has no message ${ref["id"]}`, {
					code: "invalid-ref",
					provider: this.provider,
				}),
			);
		}

		let scripted = this.#takeFailure();
		if (scripted) return failure(scripted);

		if (kind === "update") {
			this.messages.push({ kind, message, ref, parent: ref, ...withOptions(options) });
			return success({ ref });
		}

		return success({ ref: this.#record(kind, message, ref, options) });
	}

	/** Appends a call and answers the ref it was given. */
	#record(
		kind: Recorded["kind"],
		message: Message,
		parent: SentRef | undefined,
		options: SendOptions | undefined,
	): SentRef {
		let ref: SentRef = { provider: this.provider, id: String(this.#nextId) };
		this.#nextId += 1;
		this.messages.push({
			kind,
			message,
			ref,
			...(parent ? { parent } : {}),
			...withOptions(options),
		});
		return ref;
	}

	/** The next scripted failure as an error, or `undefined` when none is queued. */
	#takeFailure(): MessagingError | undefined {
		let scripted = this.#failures.shift();
		if (!scripted) return undefined;
		return new MessagingError(scripted.message ?? `${this.provider} failed on cue`, {
			code: scripted.code,
			provider: this.provider,
			status: scripted.status ?? null,
			retryAfter: scripted.retryAfter ?? null,
		});
	}
}

/** The `options` entry of a record, present only when the caller passed options. */
function withOptions(options: SendOptions | undefined): { options?: SendOptions } {
	return options ? { options } : {};
}
