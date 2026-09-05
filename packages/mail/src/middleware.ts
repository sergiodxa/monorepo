/**
 * Remix fetch-router middleware that builds a mailer for the request and
 * publishes it on the request context, so handlers send mail by calling
 * `context.email`, using whichever transport the app configured. Messages
 * queued with `later()` flush after the handler returns, and each outcome is
 * recorded on the invocation's log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { Address, Transport } from "./types.js";

import { Mailer } from "./mailer.js";

/**
 * Declared here, in an imported module rather than an ambient .d.ts, so the
 * augmentation is applied in consuming projects that import the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/**
		 * The object that sends mail for the current request, configured by the
		 * mail middleware.
		 */
		email: Mailer;
	}
}

/** Options that configure the mail middleware. */
export interface MailMiddlewareOptions {
	/**
	 * Transport used for delivery, or a factory that resolves one per request. A
	 * transport built from a module-level binding needs no factory; one resolved
	 * through a service container uses the factory form.
	 */
	transport: Transport | ((context: RequestContext) => Transport);
	/** Sender identity for the app, applied to every message that does not set one. */
	from: Address;
	/** Where replies go by default; a message or email may override it. */
	replyTo?: Address | Address[];
	/** Headers added to every message the request sends. */
	headers?: Record<string, string>;
}

/**
 * Creates a middleware that publishes a request-scoped mailer as `context.email`,
 * resolving a container-based transport once per request. The `later()` queue
 * flushes in a `finally` after `next()`; the response is already decided by then,
 * so a failed deferred send is a warning on the invocation's log rather than an error.
 *
 * @param options - Transport and sender configuration; see {@link MailMiddlewareOptions}.
 * @returns A middleware that populates `context.email`.
 * @example
 * router.use(mail({ transport: new CloudflareTransport(env.EMAIL), from: SENDER }));
 */
export default function mail(options: MailMiddlewareOptions): Middleware {
	return async (context, next) => {
		let transport =
			typeof options.transport === "function" ? options.transport(context) : options.transport;

		let mailer = new Mailer({
			transport,
			from: options.from,
			replyTo: options.replyTo,
			headers: options.headers,
		});

		context.email = mailer;

		try {
			return await next();
		} finally {
			let log = currentLog();
			for (let result of await mailer.flush()) {
				if (isFailure(result)) log?.warn("mail.send_failed", { error: result.error.message });
				else
					log
						?.set({ mail: { sent: true } })
						.note("mail.sent", { message_id: result.data.messageId });
			}
		}
	};
}
