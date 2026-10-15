/**
 * Transport that prints each message instead of delivering it, for development and command
 * lines run against local data: the message shows where the developer is looking and never
 * reaches a real inbox. It writes through a function it is given, so it runs on any runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { MailError } from "./errors.js";
import type { Address, NormalizedMessage, SentMessage, Transport } from "./types.js";

import { buildMimeMessage } from "./mime.js";

/** Where a print transport writes, and in which form. */
export interface PrintTransportOptions {
	/**
	 * Receives each printed message as one string ending in a newline, such as `ctx.stderr`
	 * in a command or `(text) => process.stderr.write(text)` in a script.
	 */
	write(text: string): void;
	/**
	 * Print the raw MIME message, headers and every part, instead of the readable summary.
	 * @default false
	 */
	mime?: boolean;
}

/**
 * Transport that writes each message to `options.write` and reports it sent. The summary lists
 * the envelope, the subject, the date, the `Message-ID` and any extra headers, then the
 * plain-text body (the HTML one when a message has no text).
 *
 * @example new Mailer({ transport: new PrintTransport({ write: (text) => ctx.stderr(text) }), from: SENDER });
 * @example new PrintTransport({ write: (text) => process.stderr.write(text), mime: true });
 */
export class PrintTransport implements Transport {
	/** The function each printed message goes to. */
	#write: (text: string) => void;

	/** Whether messages print as raw MIME. */
	#mime: boolean;

	/**
	 * Creates the transport.
	 *
	 * @param options - Where to write and in which form; see {@link PrintTransportOptions}.
	 */
	constructor(options: PrintTransportOptions) {
		this.#write = options.write;
		this.#mime = options.mime ?? false;
	}

	/**
	 * Prints the message and reports success.
	 *
	 * @param message - The normalized message to print.
	 * @returns Success carrying the message's own `Message-ID`, since no provider assigned one.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		this.#write(this.#mime ? ensureNewline(buildMimeMessage(message)) : summarize(message));
		return success({ messageId: message.messageId });
	}
}

/** The readable form of a message: one header per line, a blank line, then the body. */
function summarize(message: NormalizedMessage): string {
	let lines = [`From: ${formatAddresses([message.from])}`, `To: ${formatAddresses(message.to)}`];
	if (message.cc.length > 0) lines.push(`Cc: ${formatAddresses(message.cc)}`);
	if (message.bcc.length > 0) lines.push(`Bcc: ${formatAddresses(message.bcc)}`);
	if (message.replyTo.length > 0) lines.push(`Reply-To: ${formatAddresses(message.replyTo)}`);
	lines.push(`Subject: ${message.subject}`);
	lines.push(`Date: ${message.date.toUTCString()}`);
	lines.push(`Message-ID: ${message.messageId}`);
	for (let [name, value] of Object.entries(message.headers)) lines.push(`${name}: ${value}`);
	let body = message.text ?? message.html ?? "";
	return `${lines.join("\n")}\n\n${ensureNewline(body)}`;
}

/** Mailboxes as a mail client shows them: `Name <email>`, or the bare address without a name. */
function formatAddresses(addresses: readonly Address[]): string {
	return addresses
		.map((address) =>
			address.name === undefined || address.name === ""
				? address.email
				: `${address.name} <${address.email}>`,
		)
		.join(", ");
}

/** `text` ending in exactly one newline, so consecutive messages never run together. */
function ensureNewline(text: string): string {
	return text.endsWith("\n") ? text : `${text}\n`;
}
