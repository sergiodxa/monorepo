/**
 * In-memory transport that records every delivery instead of sending it. It is a
 * real fake rather than a module mock, so tests assert on the message a caller
 * actually produced — including the email object it came from — without touching a
 * provider SDK.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { success } from "@pkg/result";

import type { MailError } from "./errors";
import type { NormalizedMessage, SentMessage, Transport } from "./types";

/**
 * Transport that keeps deliveries in memory for assertions.
 *
 * Recorded messages are the normalized ones a provider would have received, so
 * defaults, coerced address lists, and the derived plain-text part are all visible.
 * When a message came from an email object, `message.email` is that object, which
 * lets a test identify a send by type instead of by copy that changes.
 *
 * @example
 * let transport = new MemoryTransport();
 * await new Mailer({ transport, from: SENDER }).send(new TeamInviteEmail(invite));
 * expect(transport.find((message) => message.email instanceof TeamInviteEmail)).toBeDefined();
 */
export class MemoryTransport implements Transport {
	/** Deliveries recorded so far, oldest first. */
	#messages: NormalizedMessage[] = [];

	/** Every recorded delivery, oldest first. */
	get messages(): readonly NormalizedMessage[] {
		return this.#messages;
	}

	/** Most recent delivery, or `undefined` when nothing has been sent yet. */
	get last(): NormalizedMessage | undefined {
		return this.#messages.at(-1);
	}

	/**
	 * Finds the first recorded delivery matching a predicate.
	 *
	 * @param predicate - Test applied to each message in delivery order.
	 * @returns The first matching message, or `undefined` when none matches.
	 */
	find(predicate: (message: NormalizedMessage) => boolean): NormalizedMessage | undefined {
		return this.#messages.find(predicate);
	}

	/** Forgets every recorded delivery, so one instance can be reused between tests. */
	clear(): void {
		this.#messages.length = 0;
	}

	/**
	 * Records the message and reports success.
	 *
	 * @param message - The normalized message to record.
	 * @returns Success carrying the message's own `Message-ID`, since no provider assigned one.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		this.#messages.push(message);
		return success({ messageId: message.messageId });
	}
}
