/**
 * The webhook endpoint as a class: it verifies a delivery, records it before
 * trusting it, deduplicates a replay, and hands the normalized event to one
 * handler, so an app writes handlers and none of the plumbing around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext, RequestHandler } from "remix/router";

import { isFailure } from "@sdxc/result";

import type { Billing } from "../core/contract";
import type { BillingEvent } from "../core/types";

import { BillingError } from "../core/errors";

/**
 * Splits an arm naming several deliveries into one arm per name, so a handler
 * key selects exactly the payload that key's delivery carries.
 */
type PerType<Event> = Event extends { type: infer Type extends string }
	? Type extends Type
		? Omit<Event, "type"> & { type: Type }
		: never
	: never;

/** Every delivery name a handler can be keyed by. */
export type BillingEventType = BillingEvent["type"];

/**
 * The event one handler receives, narrowed to its own key, so a handler keyed
 * `order.paid` reaches `event.order` and nothing else.
 */
export type BillingEventOf<Type extends BillingEventType> = Extract<
	PerType<BillingEvent>,
	{ type: Type }
>;

/**
 * What an app does about one kind of delivery. Throwing reports the failure,
 * which the endpoint logs and turns into a retry when the error is retryable.
 */
export interface BillingWebhookHandler<Type extends BillingEventType> {
	(event: BillingEventOf<Type>, context: RequestContext): void | Promise<void>;
}

/**
 * Handlers keyed by delivery name, derived from the event union so a misspelled
 * key is a type error and every handler sees a narrowed event. A name with no
 * handler is still acknowledged.
 */
export type BillingWebhookHandlers = {
	[Type in BillingEventType]?: BillingWebhookHandler<Type>;
};

/**
 * The dispatch signature a name has already narrowed, so one lookup serves
 * every arm instead of a branch per delivery name.
 */
type BillingEventDispatch = (event: BillingEvent, context: RequestContext) => void | Promise<void>;

/** One delivery as the store holds it, which is the row an audit reads. */
export interface WebhookDelivery {
	/** The platform's delivery id, which is the deduplication key. */
	id: string;
	/** Type of the object the delivery named, or `unknown` when it named none. */
	type: string;
	/** The body exactly as received, so a replay runs against the same bytes. */
	payload: string;
	/** Whether the signing secret proved this delivery. */
	valid: boolean;
	/** Whether a handler has already run to completion for it. */
	processed: boolean;
}

/**
 * Where deliveries are kept, so idempotency has a durable key while the table
 * stays the app's own. A row survives the request that wrote it, which is what
 * makes a replay cheap to detect and a wrong handler visible afterwards.
 */
export interface WebhookStore {
	/**
	 * Reads a recorded delivery.
	 *
	 * @param id - The platform's delivery id.
	 * @returns The row, or `null` when this delivery has never arrived.
	 */
	find(id: string): Promise<WebhookDelivery | null>;

	/**
	 * Writes a delivery, replacing any row sharing its id, before it is trusted.
	 *
	 * @param delivery - The delivery and the signature verdict on it.
	 */
	record(delivery: WebhookDelivery): Promise<void>;

	/**
	 * Marks a delivery handled, which is what a later replay is measured against.
	 *
	 * @param id - The platform's delivery id.
	 */
	markProcessed(id: string): Promise<void>;
}

/**
 * The part of a logger the endpoint needs, kept structural so it reports
 * through whichever logger an app already exposes on the context.
 */
export interface WebhookLogger {
	/** Records an event that was acknowledged without a handler running. */
	info(event: string, payload?: Record<string, unknown>): void;
	/** Records a rejected delivery or a handler failure. */
	error(event: string, payload?: Record<string, unknown>): void;
}

/** What an endpoint is configured with beyond its provider and its handlers. */
export interface BillingWebhookOptions {
	/**
	 * Where deliveries are recorded. Omitting it dispatches every delivery,
	 * including a replay, so an app without a store makes its handlers idempotent.
	 */
	store?: WebhookStore | null;
	/**
	 * Resolves the logger the endpoint reports through. Defaults to
	 * `context.logger` when the app installed one.
	 */
	logger?: (context: RequestContext) => WebhookLogger | undefined;
	/**
	 * Decides whether a handler failure should be delivered again. Defaults to
	 * retrying a {@link BillingError} the platform marked retryable, since every
	 * other failure would repeat verbatim.
	 */
	retry?: (error: unknown, event: BillingEvent) => boolean;
}

/** Acknowledgement, which is the answer to everything except a forged delivery. */
const OK = 200;

/** A forged delivery, and the only closed door here. */
const UNAUTHORIZED = 401;

/** Asks the platform to deliver again, for a failure a retry can resolve. */
const RETRY_LATER = 503;

/** Stands in for the object type of a delivery that named no object. */
const UNNAMED_OBJECT = "unknown";

/** Reads a logger off the request context, accepting anything that can record an event. */
function contextLogger(context: RequestContext): WebhookLogger | undefined {
	let candidate: unknown = (context as { logger?: unknown }).logger;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	if (!("info" in candidate) || typeof candidate.info !== "function") return undefined;
	if (!("error" in candidate) || typeof candidate.error !== "function") return undefined;
	return candidate as WebhookLogger;
}

/**
 * Whether the same delivery can usefully arrive again: a platform that named a
 * rate limit will succeed on a later attempt.
 */
function retryableFailure(error: unknown): boolean {
	return error instanceof BillingError && error.retryable;
}

/**
 * Keeps deliveries for the life of the process, which is what a test drives a
 * redelivery against without standing up a table.
 *
 * @example
 * let store = new MemoryWebhookStore();
 * let endpoint = new BillingWebhook(billing, handlers, { store });
 */
export class MemoryWebhookStore implements WebhookStore {
	#deliveries = new Map<string, WebhookDelivery>();

	/** Every delivery recorded so far, in arrival order, for an assertion on the trail. */
	get deliveries(): readonly WebhookDelivery[] {
		return [...this.#deliveries.values()];
	}

	/**
	 * Reads a recorded delivery.
	 *
	 * @param id - The platform's delivery id.
	 * @returns A copy of the row, or `null` when this delivery has never arrived.
	 */
	async find(id: string): Promise<WebhookDelivery | null> {
		let delivery = this.#deliveries.get(id);
		return delivery === undefined ? null : { ...delivery };
	}

	/**
	 * Writes a delivery, replacing any row sharing its id.
	 *
	 * @param delivery - The delivery and the signature verdict on it.
	 */
	async record(delivery: WebhookDelivery): Promise<void> {
		this.#deliveries.set(delivery.id, { ...delivery });
	}

	/**
	 * Marks a delivery handled, ignoring an id that was never recorded.
	 *
	 * @param id - The platform's delivery id.
	 */
	async markProcessed(id: string): Promise<void> {
		let delivery = this.#deliveries.get(id);
		if (delivery !== undefined) this.#deliveries.set(id, { ...delivery, processed: true });
	}
}

/**
 * A billing webhook endpoint. It mounts as a route action and answers `200` to
 * everything it can account for, because an error response is how a platform
 * decides an endpoint is broken and stops calling it.
 *
 * @example
 * export default new BillingWebhook(polar, {
 * 	async "order.paid"(event) { await grantAccess(event.order); },
 * });
 */
export class BillingWebhook {
	/**
	 * Answers one delivery: verifies it, records it with the verdict, skips a
	 * replay that already ran, and dispatches the normalized event. Bound to the
	 * instance, so `router.map(route, endpoint)` mounts it directly.
	 */
	readonly handler: RequestHandler;

	#provider: Billing;

	#handlers: BillingWebhookHandlers;

	#store: WebhookStore | null;

	#logger: (context: RequestContext) => WebhookLogger | undefined;

	#retry: (error: unknown, event: BillingEvent) => boolean;

	/**
	 * Creates the endpoint at module scope, so a misconfigured store or logger
	 * surfaces at boot rather than on the first delivery.
	 *
	 * @param provider - The configured platform, which answers whether a delivery is authentic.
	 * @param handlers - What to do per delivery name; see {@link BillingWebhookHandlers}.
	 * @param options - Store, logger, and retry policy; see {@link BillingWebhookOptions}.
	 */
	constructor(
		provider: Billing,
		handlers: BillingWebhookHandlers,
		options: BillingWebhookOptions = {},
	) {
		this.#provider = provider;
		this.#handlers = handlers;
		this.#store = options.store ?? null;
		this.#logger = options.logger ?? contextLogger;
		this.#retry = options.retry ?? retryableFailure;

		this.handler = (context) => this.#respond(context);
	}

	/**
	 * Reads the body once, since the signature covers the exact bytes received
	 * and a second read of a consumed request yields nothing.
	 */
	async #respond(context: RequestContext): Promise<Response> {
		let log = this.#logger(context);
		let rawBody = await context.request.text();

		let reference = this.#provider.webhooks.reference(context.request, rawBody);
		let valid = await this.#provider.webhooks.verify(context.request, rawBody);
		let objectType = reference?.object?.type ?? UNNAMED_OBJECT;

		// The key is the delivery, never the object: one object produces many
		// distinct deliveries, and keying on it would drop all but the first.
		if (this.#store !== null && reference !== null) {
			let recorded = await this.#store.find(reference.deliveryId);

			if (recorded !== null && recorded.processed) {
				log?.info("billing.webhook.duplicate", {
					delivery: reference.deliveryId,
					type: objectType,
				});

				return new Response(null, { status: OK });
			}

			await this.#store.record({
				id: reference.deliveryId,
				type: objectType,
				payload: rawBody,
				valid,
				processed: false,
			});
		}

		if (!valid) {
			log?.error("billing.webhook.invalid_signature", {
				connection: this.#provider.connection,
				delivery: reference?.deliveryId,
			});

			return new Response("invalid signature", { status: UNAUTHORIZED });
		}

		let event = await this.#provider.webhooks.event(context.request, rawBody);

		if (isFailure(event)) {
			log?.error("billing.webhook.unreadable", {
				connection: this.#provider.connection,
				delivery: reference?.deliveryId,
				error: event.error.message,
			});

			return new Response(null, { status: OK });
		}

		return this.#dispatch(event.data, reference?.deliveryId ?? null, context, log);
	}

	/**
	 * Runs the handler for a delivery, acknowledging a name nothing handles so
	 * the platform keeps the endpoint enabled, and leaving a failed delivery
	 * unprocessed so the trail shows which handler was wrong.
	 */
	async #dispatch(
		event: BillingEvent,
		key: string | null,
		context: RequestContext,
		log: WebhookLogger | undefined,
	): Promise<Response> {
		let handler = this.#handlers[event.type] as BillingEventDispatch | undefined;

		if (handler === undefined) {
			log?.info("billing.webhook.unhandled", { delivery: event.id, type: event.type });
			await this.#settle(key);
			return new Response(null, { status: OK });
		}

		try {
			await handler(event, context);
		} catch (error) {
			log?.error("billing.webhook.handler_failed", {
				delivery: event.id,
				type: event.type,
				error: error instanceof Error ? error.message : String(error),
			});

			if (this.#retry(error, event)) return new Response(null, { status: RETRY_LATER });

			return new Response(null, { status: OK });
		}

		await this.#settle(key);

		return new Response(null, { status: OK });
	}

	/** Records that a delivery ran to completion, when a store is keeping the trail. */
	async #settle(key: string | null): Promise<void> {
		if (key !== null) await this.#store?.markProcessed(key);
	}
}
