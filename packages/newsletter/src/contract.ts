/**
 * The provider contract every newsletter platform is reached through: one
 * subscriber list, grouped into subscriber and webhook questions, each answered
 * as a `Result` so a caller branches on a normalized code instead of catching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import type { NewsletterError } from "./errors.js";
import type {
	ListSubscribersQuery,
	NewsletterEvent,
	Page,
	SubscribeInput,
	SubscribeOutcome,
	Subscriber,
	SubscriberRef,
	UpdateSubscriberInput,
} from "./types.js";

/**
 * One subscriber list on one platform. Construction reaches no network, so a
 * provider is built once at module scope and a missing credential fails the
 * call that needed it.
 */
export interface Newsletter {
	/** The configured credential set, stored beside any subscriber id kept locally. */
	readonly connection: string;
	readonly subscribers: SubscriberApi;
	readonly webhooks: WebhookApi;
	/** The underlying client, for endpoints the contract omits. */
	readonly native: unknown;
}

/**
 * Questions about the list's readers. Every write is safe to repeat after an
 * `unknown` failure: an existing address subscribes as a success, tag changes
 * are idempotent, and unsubscribing an unsubscribed reader succeeds.
 */
export interface SubscriberApi {
	/**
	 * Ensures an address is on the list. An address the platform already holds,
	 * in any status, answers `created: false` with its record unchanged; a new
	 * one answers `pending` when a confirmation email went out.
	 */
	subscribe(input: SubscribeInput): Promise<Result<SubscribeOutcome, NewsletterError>>;

	/** Reads one reader; a reader the platform does not hold is `not_found`. */
	find(subscriber: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>;

	/** Reads one page of readers in the platform's own order. */
	list(query?: ListSubscribersQuery): Promise<Result<Page<Subscriber>, NewsletterError>>;

	/** Reads a reader's tag names, which the {@link Subscriber} model leaves out. */
	tags(subscriber: SubscriberRef): Promise<Result<string[], NewsletterError>>;

	/** Adds and removes tags by name and merges metadata, answering the stored result. */
	update(
		subscriber: SubscriberRef,
		input: UpdateSubscriberInput,
	): Promise<Result<Subscriber, NewsletterError>>;

	/** Marks a reader unsubscribed, keeping the record; a resubscribe is the reader's own act. */
	unsubscribe(subscriber: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>;
}

/**
 * Inbound deliveries. Both questions take the body as received, since the
 * signature covers those exact bytes, and both stay off the network, so a
 * forged delivery never costs an API request.
 */
export interface WebhookApi {
	/**
	 * Whether the configured secret proves the delivery. An unset or empty
	 * secret answers `false`, so an endpoint fails closed.
	 */
	verify(request: Request, rawBody: string): Promise<boolean>;

	/** Normalizes an authentic delivery into the events it carries. */
	events(request: Request, rawBody: string): Result<NewsletterEvent[], NewsletterError>;
}
