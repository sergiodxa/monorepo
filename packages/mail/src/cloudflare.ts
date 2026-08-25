/**
 * Transport for the Workers email sending binding, whose structured send call takes
 * the same fields a normalized message already holds, so it maps them across and
 * assembles no MIME of its own. The binding is injected rather than read from an
 * ambient global, which keeps the platform surface a single seam this package can be
 * tested and corrected at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success, wrap } from "@pkg/result";

import type { NormalizedMessage, SentMessage, Transport } from "./types";

import { MailError } from "./errors";
import { formatAddress } from "./lib/address";

/**
 * The send payload the binding accepts, narrowed to the fields this package fills.
 * Addresses are mailbox strings, since a formatted string carries the display name
 * just as well as a name/email object and keeps every transport's mapping alike.
 */
export interface SendEmailMessage {
	/** Sender mailbox; the domain has to be verified for the account. */
	from: string;
	/** Primary recipients; the platform needs at least one of these three lists. */
	to: string[];
	/** Carbon-copy recipients. */
	cc?: string[];
	/** Blind carbon-copy recipients, which reach the envelope but no header. */
	bcc?: string[];
	/** Where replies go; the platform takes one mailbox, not a list. */
	replyTo?: string;
	/** Subject line. */
	subject: string;
	/** Plain-text body. */
	text?: string;
	/** HTML body. */
	html?: string;
	/** Extra headers to set on the assembled message. */
	headers?: Record<string, string>;
}

/** What the binding reports back for an accepted message. */
export interface SendEmailResult {
	/** Identifier the platform assigned, which is what its delivery logs are keyed by. */
	messageId: string;
}

/**
 * The part of the send-email binding this package uses. Declared here rather than
 * taken from an ambient global so the transport can be exercised with a double, and
 * so a correction to the platform's surface lands in one place.
 */
export interface SendEmailBinding {
	/**
	 * Composes and delivers one message.
	 *
	 * @param message - The fields to build the message from; see {@link SendEmailMessage}.
	 * @returns The platform's identifier for the accepted message.
	 */
	send(message: SendEmailMessage): Promise<SendEmailResult>;
}

/** Returns the formatted list, or `undefined` when empty so an absent field is omitted. */
function optionalAddresses(addresses: NormalizedMessage["to"]): string[] | undefined {
	if (addresses.length === 0) return undefined;
	return addresses.map(formatAddress);
}

/**
 * Maps a normalized message onto the binding's send payload. Only the first
 * reply-to mailbox survives, since the platform's field holds one address, so
 * every shipped `Reply-To` is one the platform actually wrote itself.
 */
function toPayload(message: NormalizedMessage): SendEmailMessage {
	let replyTo = message.replyTo.at(0);

	return {
		from: formatAddress(message.from),
		to: message.to.map(formatAddress),
		cc: optionalAddresses(message.cc),
		bcc: optionalAddresses(message.bcc),
		replyTo: replyTo && formatAddress(replyTo),
		subject: message.subject,
		text: message.text,
		html: message.html,
		headers: message.headers,
	};
}

/**
 * Transport that delivers through the Workers email sending binding, which writes
 * its own `Date` and `Message-ID` and returns the identifier its delivery logs are
 * keyed by, enforcing sender and destination limits from its configuration on send.
 *
 * @example
 * let transport = new CloudflareTransport(env.EMAIL);
 * let mailer = new Mailer({ transport, from: SENDER });
 */
export class CloudflareTransport implements Transport {
	/**
	 * Creates the transport around an app's binding.
	 *
	 * @param binding - The `send_email` binding declared in the app's Wrangler configuration.
	 */
	constructor(private binding: SendEmailBinding) {}

	/**
	 * Hands the message's fields to the binding, which composes and delivers it.
	 *
	 * @param message - The normalized message to deliver.
	 * @returns The identifier the platform assigned on success, a `MailError` on rejection.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		let outcome = await wrap(() => this.binding.send(toPayload(message)));
		if (isFailure(outcome)) {
			return failure(
				new MailError("The mail binding rejected the message.", { cause: outcome.error }),
			);
		}

		return success({ messageId: outcome.data.messageId });
	}
}
