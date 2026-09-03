/**
 * In-memory transport that captures every delivery for assertions. As a full
 * implementation of the transport contract, it lets tests assert on the message
 * a caller actually produced — including the email object it came from, and
 * the assembled MIME when it is asked for one — using state held in memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { MailError } from "./errors.js";
import type { NormalizedMessage, SentMessage, Transport } from "./types.js";

import { buildMimeMessage } from "./mime.js";

/** Configuration for what a memory transport records beyond the message itself. */
export interface MemoryTransportOptions {
	/**
	 * Assemble and record the raw MIME message for every delivery. Off by default,
	 * because most tests assert on the normalized message, and MIME only matters to
	 * the transports whose provider takes it.
	 */
	mime?: boolean;
}

/** One recorded delivery: the message a provider would have received, and its wire form. */
export interface RecordedDelivery {
	/** The normalized message the transport was handed. */
	message: NormalizedMessage;
	/** The assembled MIME message, present only when MIME recording is enabled. */
	mime?: string;
}

/**
 * Transport that keeps deliveries in memory for assertions.
 *
 * Recorded messages are the normalized ones a provider receives; `message.email`
 * keeps the original when a send came from one, so matching by type survives a copy.
 *
 * @example
 * let transport = new MemoryTransport();
 * await new Mailer({ transport, from: SENDER }).send(new TeamInviteEmail(invite));
 * expect(transport.find((message) => message.email instanceof TeamInviteEmail)).toBeDefined();
 *
 * @example
 * let transport = new MemoryTransport({ mime: true });
 * await new Mailer({ transport, from: SENDER }).send(message);
 * expect(transport.lastMime).toContain("Content-Type: multipart/alternative");
 */
export class MemoryTransport implements Transport {
	/** Deliveries recorded so far, oldest first. */
	#deliveries: RecordedDelivery[] = [];

	/** Whether each delivery is recorded with its assembled MIME message. */
	#mime: boolean;

	/**
	 * Creates the transport.
	 *
	 * @param options - What to record; see {@link MemoryTransportOptions}.
	 */
	constructor(options: MemoryTransportOptions = {}) {
		this.#mime = options.mime ?? false;
	}

	/** Every recorded delivery with its wire form, oldest first. */
	get deliveries(): readonly RecordedDelivery[] {
		return this.#deliveries;
	}

	/** Every recorded delivery, oldest first. */
	get messages(): readonly NormalizedMessage[] {
		return this.#deliveries.map((delivery) => delivery.message);
	}

	/** Most recent delivery, or `undefined` when nothing has been sent yet. */
	get last(): NormalizedMessage | undefined {
		return this.#deliveries.at(-1)?.message;
	}

	/**
	 * Raw MIME message of the most recent delivery. It is `undefined` when nothing has
	 * been sent, and also when the transport was not asked to record MIME, since
	 * assembling it for every test that never looks at it is wasted work.
	 */
	get lastMime(): string | undefined {
		return this.#deliveries.at(-1)?.mime;
	}

	/**
	 * Finds the first recorded delivery matching a predicate.
	 *
	 * @param predicate - Test applied to each message in delivery order.
	 * @returns The first matching message, or `undefined` when none matches.
	 */
	find(predicate: (message: NormalizedMessage) => boolean): NormalizedMessage | undefined {
		return this.messages.find(predicate);
	}

	/** Forgets every recorded delivery, so one instance can be reused between tests. */
	clear(): void {
		this.#deliveries.length = 0;
	}

	/**
	 * Records the message and reports success.
	 *
	 * @param message - The normalized message to record.
	 * @returns Success carrying the message's own `Message-ID`, since no provider assigned one.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		this.#deliveries.push({ message, mime: this.#mime ? buildMimeMessage(message) : undefined });
		return success({ messageId: message.messageId });
	}
}
