/**
 * Remix fetch-router middleware that builds a mailer for the request and
 * publishes it on the request context, so handlers send mail by calling
 * `context.email`, using whichever transport the app configured. Messages
 * queued with `later()` flush after the handler returns, with failures
 * recorded through the logger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";

import type { Address, Transport } from "./types";

import { Mailer } from "./mailer";

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

/**
 * The part of a logger this middleware needs, kept structural so the package
 * reports deferred-send failures through whichever logger an app already
 * exposes on the context.
 */
export interface MailLogger {
	/**
	 * Records a failure event.
	 *
	 * @param event - Event name, e.g. `mail.send_failed`.
	 * @param payload - Structured details about the failure.
	 */
	error(event: string, payload?: Record<string, unknown>): void;
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
	/**
	 * Resolves the logger used to report deferred-send failures. Defaults to
	 * `context.logger` when the app installed one; when no logger is found the
	 * failures are dropped, because the response has already been produced.
	 */
	logger?: (context: RequestContext) => MailLogger | undefined;
}

/** Reads a logger off the request context, accepting anything that can record an error event. */
function contextLogger(context: RequestContext): MailLogger | undefined {
	let candidate: unknown = (context as { logger?: unknown }).logger;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	if (!("error" in candidate) || typeof candidate.error !== "function") return undefined;
	return candidate as MailLogger;
}

/**
 * Creates a middleware that publishes a request-scoped mailer as `context.email`,
 * resolving a container-based transport once per request. The `later()` queue
 * flushes in a `finally` after `next()`, recording each failure through the logger.
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
			let results = await mailer.flush();
			let logger = options.logger?.(context) ?? contextLogger(context);
			for (let result of results) {
				if (isFailure(result)) logger?.error("mail.send_failed", { error: result.error.message });
			}
		}
	};
}
