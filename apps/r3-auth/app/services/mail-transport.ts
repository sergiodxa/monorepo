/**
 * The container key both mailers resolve their delivery transport from, so the provider
 * is chosen once for the whole app instead of at each construction site.
 *
 * There are two mailers — the request-scoped one the mail middleware publishes and the
 * background one the container registers for jobs and queue messages — and they must
 * agree on how mail leaves the worker. An abstract class rather than an interface,
 * because `@pkg/service-container` keys services by a runtime class; the shape is
 * `@pkg/mail`'s `Transport` and nothing here implements it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MailError, NormalizedMessage, SentMessage, Transport } from "@pkg/mail";
import type { Result } from "@pkg/result";

/**
 * Delivery transport for this app's mail, keyed for the container.
 *
 * Registered in `app/lib/container.ts` with the platform transport. Nothing extends it:
 * the registration returns a transport from `@pkg/mail`, which satisfies this shape
 * structurally, and a test registers a recording one the same way.
 */
export abstract class MailTransport implements Transport {
	/**
	 * Delivers one normalized message.
	 *
	 * @param message - The message the mailer normalized.
	 * @returns The provider's identifier, or why delivery was refused.
	 */
	abstract send(message: NormalizedMessage): Promise<Result<SentMessage, MailError>>;
}
