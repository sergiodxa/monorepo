/**
 * Transport for the Workers email sending binding, whose provider takes a raw RFC
 * 5322 message instead of structured fields, so it delegates to the package's MIME
 * builder and hands the result over unchanged. Both the binding and the raw-message
 * constructor arrive as options, which keeps the platform surface a single seam
 * this package can be tested and corrected at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success, wrap } from "@pkg/result";

import type { NormalizedMessage, SentMessage, Transport } from "./types";

import { MailError } from "./errors";
import { buildMimeMessage } from "./mime";

/**
 * The platform's raw message object, treated as opaque: this package constructs one
 * and hands it straight back to the binding without reading a member, so a change
 * in the platform's own shape cannot break the transport. It is an alias rather
 * than an interface because only an alias can name a shape this permissive.
 */
export type RawEmailMessage = object;

/**
 * Constructor the platform exports as `EmailMessage`. It is injected instead of
 * imported because `cloudflare:email` has no type declarations outside a Workers
 * project, and a bare import of it would fail this package's typecheck while
 * adding nothing a test could substitute.
 */
export interface RawEmailMessageConstructor {
	/**
	 * Builds the platform's raw message.
	 *
	 * @param from - Envelope sender, a bare address with no display name.
	 * @param to - Envelope recipient; one per message, so a multi-recipient send is several messages.
	 * @param raw - The complete RFC 5322 message, headers included.
	 */
	new (from: string, to: string, raw: string): RawEmailMessage;
}

/**
 * The part of the send-email binding this package uses. Declared here rather than
 * taken from an ambient global so the transport can be exercised with a double, and
 * so a correction to the platform's surface lands in one place.
 */
export interface SendEmailBinding {
	/**
	 * Hands one raw message to the platform for delivery.
	 *
	 * @param message - A raw message built with {@link RawEmailMessageConstructor}.
	 * @returns Nothing; the platform reports refusal by rejecting.
	 */
	send(message: RawEmailMessage): Promise<void>;
}

/** What the transport needs from the app: the binding, and the constructor to build for it. */
export interface CloudflareTransportOptions {
	/** The `send_email` binding declared in the app's Wrangler configuration. */
	binding: SendEmailBinding;
	/** The platform's `EmailMessage` class, imported by the app from `cloudflare:email`. */
	EmailMessage: RawEmailMessageConstructor;
}

/**
 * Envelope recipients for a message: everyone who receives it, blind copies
 * included, since the envelope is what actually routes mail. Duplicates are dropped
 * so an address listed twice is not delivered twice, and the order stays `to`,
 * `cc`, `bcc` so a failure reports the most important recipient first.
 */
function envelopeRecipients(message: NormalizedMessage): string[] {
	let addresses = [...message.to, ...message.cc, ...message.bcc];
	return [...new Set(addresses.map((address) => address.email))];
}

/**
 * Transport that delivers through the Workers email sending binding.
 *
 * The binding accepts one envelope recipient per message, so a message addressed to
 * several people is sent once per recipient with the same assembled body; the
 * `To` and `Cc` headers still list everyone, and blind copies still appear in no
 * header. Sends run in order and stop at the first rejection, which means a
 * multi-recipient failure can be partial: the returned error names the recipient it
 * stopped on.
 *
 * @example
 * import { EmailMessage } from "cloudflare:email";
 * let transport = new CloudflareTransport({ binding: env.SEND_EMAIL, EmailMessage });
 * let mailer = new Mailer({ transport, from: SENDER });
 */
export class CloudflareTransport implements Transport {
	/** The binding deliveries are handed to. */
	#binding: SendEmailBinding;

	/** The platform class a raw message must be wrapped in before the binding takes it. */
	#EmailMessage: RawEmailMessageConstructor;

	/**
	 * Creates the transport around an app's binding.
	 *
	 * @param options - The binding and the `EmailMessage` constructor; see {@link CloudflareTransportOptions}.
	 */
	constructor(options: CloudflareTransportOptions) {
		this.#binding = options.binding;
		this.#EmailMessage = options.EmailMessage;
	}

	/**
	 * Assembles the message as raw MIME and delivers it to every envelope recipient.
	 *
	 * @param message - The normalized message to deliver.
	 * @returns Success carrying the message's own `Message-ID`, since the binding assigns none.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		let recipients = envelopeRecipients(message);
		if (recipients.length === 0) {
			return failure(new MailError("A message needs at least one recipient."));
		}

		let raw = buildMimeMessage(message);

		for (let recipient of recipients) {
			let outcome = await wrap(() =>
				this.#binding.send(new this.#EmailMessage(message.from.email, recipient, raw)),
			);

			if (isFailure(outcome)) {
				return failure(
					new MailError(`The mail binding rejected the message for "${recipient}".`, {
						cause: outcome.error,
					}),
				);
			}
		}

		return success({ messageId: message.messageId });
	}
}
