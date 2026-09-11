/**
 * The delivery transport both mailers send through, keeping the provider a
 * single choice for the whole app.
 *
 * There are two mailers — the request-scoped one the mail middleware publishes
 * and the background one a job or queue message builds — and they must agree on
 * how mail leaves the worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MailError, NormalizedMessage, SentMessage, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";

/**
 * Delivery transport for this app's mail. `app/lib/mail.ts` opens a `@sdxc/mail`
 * transport that satisfies this shape structurally; a test hands the app a
 * recording one the same way.
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
