/**
 * The contract every provider implements: `send` always, `update` and `reply` where the
 * platform can edit a message or thread under it, and `supports` to ask which. A
 * credential is a string or a function, so a secret is read at send time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import type { MessagingError } from "./error.js";
import type { Message } from "./message.js";

/** A credential stated directly, or read on every send from wherever it lives. */
export type Secret = string | (() => string | Promise<string>);

/** Per-send options every provider reads. */
export interface SendOptions {
	/**
	 * Stable across retries of one delivery, so a receiver drops a duplicate: the
	 * webhook's `webhook-id`. A provider that needs one and is given none generates its own.
	 */
	id?: string;
	/** @default "10 seconds" */
	timeout?: DurationInput;
	signal?: AbortSignal;
}

/**
 * Where a sent message lives, as a flat string map tagged with its provider, so a
 * caller stores it as JSON and a later `update` with another provider's ref fails
 * before any request.
 *
 * @example let ref: SentRef = { provider: "slack-bot", channel: "C123", ts: "1728000000.000100" };
 */
export interface SentRef {
	provider: string;
	[field: string]: string;
}

/** What a successful send answers. */
export interface Sent {
	/** What `update` and `reply` need later, or `null` when the platform answers no message id. */
	ref: SentRef | null;
}

/** One place a message goes, built from that place's configuration with no I/O. */
export interface Destination {
	/** The provider's name, which every `SentRef` and `MessagingError` it produces carries. */
	readonly provider: string;
	/** One attempt; retrying belongs to the caller, which knows how long the message matters. */
	send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>>;
	/** Edits the sent message in place. */
	update?(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>>;
	/** Posts a message in the sent message's thread. */
	reply?(
		ref: SentRef,
		message: Message,
		options?: SendOptions,
	): Promise<Result<Sent, MessagingError>>;
}

/** The methods whose presence varies by platform. */
export type OptionalCapability = "update" | "reply";

/**
 * Narrows an optional method to present, so a recovery edits the original message
 * only on a platform that can.
 *
 * @param destination - The destination to ask.
 * @param capability - Which optional method.
 * @returns Whether the destination implements it.
 * @example if (ref && supports(destination, "update")) await destination.update(ref, resolved);
 */
export function supports<D extends Destination, C extends OptionalCapability>(
	destination: D,
	capability: C,
): destination is D & Required<Pick<Destination, C>> {
	return typeof destination[capability] === "function";
}
