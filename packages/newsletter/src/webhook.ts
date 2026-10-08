/**
 * The newsletter webhook endpoint as a class: it verifies a delivery, normalizes
 * it into events, skips an event id already handled, and hands each event to the
 * handler keyed by its type, so an app writes handlers and none of the plumbing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { ReplayStore } from "@sdxc/webhooks";
import type { RequestContext, RequestHandler } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { Newsletter } from "./contract.js";
import type { NewsletterEvent } from "./types.js";

/** Every event type a handler can be keyed by. */
export type NewsletterEventType = NewsletterEvent["type"];

/** The event one handler receives, narrowed to its own key. */
export type NewsletterEventOf<Type extends NewsletterEventType> = Extract<
	NewsletterEvent,
	{ type: Type }
>;

/**
 * What an app does about one kind of event. Throwing answers the delivery with
 * `503`, so the platform redelivers it and the events already handled are skipped.
 */
export interface NewsletterWebhookHandler<Type extends NewsletterEventType> {
	(event: NewsletterEventOf<Type>, context: RequestContext): void | Promise<void>;
}

/**
 * Handlers keyed by event type, derived from the event union so a misspelled
 * key is a type error. A type with no handler is still acknowledged.
 */
export type NewsletterWebhookHandlers = {
	[Type in NewsletterEventType]?: NewsletterWebhookHandler<Type>;
};

/** The dispatch signature a type has already narrowed, so one lookup serves every arm. */
type NewsletterEventDispatch = (
	event: NewsletterEvent,
	context: RequestContext,
) => void | Promise<void>;

/** What an endpoint is configured with beyond its provider and its handlers. */
export interface NewsletterWebhookOptions {
	/**
	 * Remembers handled event ids, which is what bounds a replay of a delivery
	 * whose signature carries no timestamp. Omitting it dispatches every
	 * delivery, so handlers without a store must be idempotent.
	 */
	store?: ReplayStore | null;
	/**
	 * How long a handled event id stays remembered.
	 *
	 * @default "7 days"
	 */
	ttl?: DurationInput;
}

/** Acknowledgement, which is the answer to everything except a forged delivery or a failed handler. */
const OK = 200;

/** A delivery the configured secret does not prove, and the only closed door. */
const UNAUTHORIZED = 401;

/** Asks the platform to deliver again after a handler failed. */
const RETRY_LATER = 503;

/** Long enough to outlast every supported platform's redelivery schedule. */
const DEFAULT_TTL: DurationInput = "7 days";

/**
 * A newsletter webhook endpoint. It mounts as a route action and answers `200`
 * to every authentic delivery it can account for, because an error response is
 * how a platform decides an endpoint is broken and stops calling it.
 *
 * @example
 * export default new NewsletterWebhook(newsletter, {
 * 	async "subscriber.confirmed"(event) { await welcome(event.subscriberId); },
 * });
 */
export class NewsletterWebhook {
	/**
	 * Answers one delivery. Bound to the instance, so `router.map(route, endpoint)`
	 * mounts it directly.
	 */
	readonly handler: RequestHandler;

	#provider: Newsletter;

	#handlers: NewsletterWebhookHandlers;

	#store: ReplayStore | null;

	#ttl: DurationInput;

	/**
	 * Creates the endpoint, typically at module scope beside the provider.
	 *
	 * @param provider - The configured platform, which answers whether a delivery is authentic.
	 * @param handlers - What to do per event type; see {@link NewsletterWebhookHandlers}.
	 * @param options - Replay store and its expiry; see {@link NewsletterWebhookOptions}.
	 */
	constructor(
		provider: Newsletter,
		handlers: NewsletterWebhookHandlers,
		options: NewsletterWebhookOptions = {},
	) {
		this.#provider = provider;
		this.#handlers = handlers;
		this.#store = options.store ?? null;
		this.#ttl = options.ttl ?? DEFAULT_TTL;

		this.handler = (context) => this.#respond(context);
	}

	/**
	 * Reads the body once, since the signature covers the exact bytes received.
	 * An authentic body that cannot be parsed is acknowledged, because a
	 * redelivery of the same bytes would fail the same way.
	 */
	async #respond(context: RequestContext): Promise<Response> {
		let log = currentLog();
		let rawBody = await context.request.text();
		let valid = await this.#provider.webhooks.verify(context.request, rawBody);

		log?.set({ "newsletter.webhook": { provider: this.#provider.connection, valid } });

		if (!valid) {
			log?.warn("newsletter.webhook.invalid_signature");
			return new Response("invalid signature", { status: UNAUTHORIZED });
		}

		let events = this.#provider.webhooks.events(context.request, rawBody);

		if (isFailure(events)) {
			log?.warn("newsletter.webhook.unreadable", { error: events.error.message });
			return new Response(null, { status: OK });
		}

		log?.set({ "newsletter.webhook": { events: events.data.length } });

		for (let event of events.data) {
			let handled = await this.#dispatch(event, context);
			if (!handled) return new Response(null, { status: RETRY_LATER });
		}

		return new Response(null, { status: OK });
	}

	/**
	 * Runs one event's handler and remembers its id once it finishes, so a
	 * redelivered batch skips what already ran and resumes at the event that failed.
	 *
	 * @returns `false` when the handler threw and the delivery should be retried.
	 */
	async #dispatch(event: NewsletterEvent, context: RequestContext): Promise<boolean> {
		let log = currentLog();

		if (this.#store !== null && (await this.#store.seen(event.id))) {
			log?.note("newsletter.webhook.duplicate", { event: event.type, id: event.id });
			return true;
		}

		let handler = this.#handlers[event.type] as NewsletterEventDispatch | undefined;

		if (handler === undefined) {
			log?.note("newsletter.webhook.unhandled", { event: event.type, id: event.id });
		} else {
			try {
				await handler(event, context);
			} catch (error) {
				log?.fail(error, { "newsletter.webhook": { event: event.type, id: event.id } });
				return false;
			}
		}

		await this.#store?.remember(event.id, this.#ttl);

		return true;
	}
}
