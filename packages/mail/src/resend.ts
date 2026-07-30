/**
 * Transport for a provider that accepts structured fields, so it maps a normalized
 * message onto the SDK's send call and assembles no MIME of its own. The client is
 * injected rather than built from an API key, which keeps credential handling and
 * client lifetime in the app that already registers it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { CreateEmailOptions, Resend } from "resend";

import { failure, isFailure, success, wrap } from "@pkg/result";

import type { NormalizedMessage, SentMessage, Transport } from "./types";

import { MailError } from "./errors";
import { formatAddress } from "./lib/address";

/** Returns the formatted list, or `undefined` when empty so an absent field is omitted. */
function optionalAddresses(addresses: NormalizedMessage["to"]): string[] | undefined {
	if (addresses.length === 0) return undefined;
	return addresses.map(formatAddress);
}

/**
 * Maps a normalized message onto the provider's send payload. The body parts are
 * chosen as one unit because the provider requires at least one of them, and
 * normalization already guarantees that.
 */
function toPayload(message: NormalizedMessage): CreateEmailOptions {
	let content =
		message.html === undefined
			? { text: message.text ?? "" }
			: { html: message.html, text: message.text };

	return {
		...content,
		from: formatAddress(message.from),
		to: message.to.map(formatAddress),
		cc: optionalAddresses(message.cc),
		bcc: optionalAddresses(message.bcc),
		replyTo: optionalAddresses(message.replyTo),
		subject: message.subject,
		headers: message.headers,
	};
}

/**
 * Transport that delivers through an injected Resend client.
 *
 * The provider reports API errors in its response rather than by throwing, so both
 * shapes are folded into the same `MailError` failure, and the returned identifier
 * is the provider's own when it gives one.
 *
 * @example
 * let transport = new ResendTransport(getServiceContainer().get(Resend));
 * let mailer = new Mailer({ transport, from: SENDER });
 */
export class ResendTransport implements Transport {
	/**
	 * Creates the transport around an existing client.
	 *
	 * @param resend - A configured Resend client; the transport never creates one.
	 */
	constructor(private resend: Resend) {}

	/**
	 * Sends the message through the provider's structured send call.
	 *
	 * @param message - The normalized message to deliver.
	 * @returns The provider's message identifier on success, a `MailError` on rejection.
	 */
	async send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		let outcome = await wrap(() => this.resend.emails.send(toPayload(message)));
		if (isFailure(outcome)) {
			return failure(new MailError("The mail provider request failed.", { cause: outcome.error }));
		}

		let { data, error } = outcome.data;
		if (error) {
			return failure(new MailError(error.message, { cause: error }));
		}

		return success({ messageId: data?.id ?? message.messageId });
	}
}
