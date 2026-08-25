/**
 * The container key both mailers resolve their delivery transport from,
 * keeping the provider a single choice for the whole app.
 *
 * There are two mailers — the request-scoped one the mail middleware publishes
 * and the background one the container registers for jobs and queue messages —
 * and they must agree on how mail leaves the worker. Declared as an abstract
 * class, since `@pkg/service-container` keys services by a runtime class, which only a class provides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MailError, NormalizedMessage, SentMessage, Transport } from "@pkg/mail";
import type { Result } from "@pkg/result";

/**
 * Delivery transport for this app's mail, keyed for the container. Registered
 * in `app/lib/container.ts` with a `@pkg/mail` transport that satisfies this
 * shape structurally; a test registers a recording one the same way.
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
