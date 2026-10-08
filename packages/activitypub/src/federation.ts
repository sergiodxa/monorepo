/**
 * The ActivityPub runtime of one local actor: its documents and inbox served from `fetch`,
 * every queued step (inbox processing, fan-out, delivery) run by `process`, and the app's
 * handlers registered with `on`, so the actor, keys, stores and queue are wired once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Backoff } from "@sdxc/backoff";
import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import type { CollectionItem } from "./collections.js";
import type { ActivityPubFetchError } from "./errors.js";
import type { ActorKeys } from "./keys.js";
import type { Delivered } from "./lib/delivery-post.js";
import type { InboxError } from "./lib/inbox-error.js";
import type {
	DeleteInbound,
	FollowDecision,
	Handlers,
	HandleOutcome,
	Inbound,
} from "./lib/inbox-handle.js";
import type { BlockedCheck, VerifiedFetch } from "./lib/inbox-receive.js";
import type { Summary } from "./lib/inbox-summarize.js";
import type {
	DeliverMessage,
	FanOutMessage,
	InboxMessage,
	Message as QueueMessage,
} from "./lib/messages.js";
import type { RespondOptions as DocumentRespondOptions } from "./lib/response.js";
import type { ActivityPub } from "./lib/types.js";
import type { ResolverTtl } from "./remote.js";
import type { FollowerStore, KeyProvider, LocalObjects, SeenActivities } from "./store.js";

import { orderedCollection, orderedCollectionPage } from "./collections.js";
import { lookup } from "./discovery.js";
import { ActivityPubError, FederationError } from "./errors.js";
import { fanOut, MAX_ACTIVITY_BYTES } from "./lib/delivery-fan-out.js";
import { deliver, DELIVERY_BACKOFF } from "./lib/delivery-post.js";
import { handle } from "./lib/inbox-handle.js";
import { receive, verifyFetch } from "./lib/inbox-receive.js";
import { summarize } from "./lib/inbox-summarize.js";
import { MESSAGE } from "./lib/messages.js";
import { respond, wantsActivity } from "./lib/response.js";
import { stringify } from "./lib/stringify.js";
import { RemoteResolver } from "./remote.js";

/** Followers listed per page of the followers collection. */
const DEFAULT_COLLECTION_PAGE_SIZE = 50;

/** The handler key of `handle` each registrable activity type reaches. */
const HANDLER_KEYS: Record<Federation.HandledType, keyof Handlers> = {
	Follow: "follow",
	Undo: "undo",
	Create: "create",
	Update: "update",
	Delete: "delete",
	Like: "like",
	Announce: "announce",
	Accept: "accept",
	Reject: "reject",
	Move: "move",
};

/** Any registered handler, called with the context its activity type receives. */
interface AnyHandler {
	(ctx: Federation.Context | Federation.DeleteContext): Federation.HandlerReturn<unknown>;
}

/**
 * Federates one local actor. Construct it wherever the stores are at hand (per request or
 * per job is fine: it holds no state beyond its options and handlers), route the actor's
 * URLs through `fetch`, and hand every queued message to `process`.
 *
 * @example
 * let federation = new Federation({ actor, keys, stores, cache, userAgent, queue });
 * federation.on("Create", async (ctx) => saveReply(ctx.summary()));
 */
export class Federation {
	/**
	 * The Standard Schema of every message federation enqueues (`inbox`, `fanOut` and
	 * `deliver`, told apart by `kind`), so one job declared with it carries all three.
	 *
	 * @example federation: job({ input: Federation.MESSAGE })
	 */
	static readonly MESSAGE: Schema<unknown, Federation.Message> = MESSAGE;

	/**
	 * Fetches remote actors, keys and objects through the app's cache, signing every GET
	 * with the local actor's keys unless `resolver.signed` is `false`.
	 */
	readonly resolver: RemoteResolver;

	#options: Federation.Options;
	#keys: KeyProvider;
	#blocked: BlockedCheck;
	#backoff: Backoff;
	#now: () => Date;
	#handlers = new Map<Federation.HandledType, AnyHandler>();

	/** @param options - The local actor, its keys, the stores, the cache and the queue. */
	constructor(options: Federation.Options) {
		this.#options = options;
		this.#keys = providerOf(options.keys);
		this.#blocked = options.blocked ?? (() => false);
		this.#backoff = options.backoff ?? DELIVERY_BACKOFF;
		this.#now = options.now ?? (() => new Date());
		this.resolver = new RemoteResolver({
			cache: options.cache,
			userAgent: options.userAgent,
			...(options.resolver?.signed === false
				? {}
				: { signer: { actor: options.actor.id, keys: options.keys } }),
			...(options.resolver?.ttl === undefined ? {} : { ttl: options.resolver.ttl }),
			...(options.resolver?.timeout === undefined ? {} : { timeout: options.resolver.timeout }),
			...(options.resolver?.maxBytes === undefined ? {} : { maxBytes: options.resolver.maxBytes }),
		});
	}

	/**
	 * Registers the app's handler for one or more activity types, called once the package
	 * has done the work the protocol requires (followers kept, Accept sent, ownership and
	 * relevance checked). A later registration for a type replaces the earlier one.
	 *
	 * A handler answers nothing or a `Result`; a failure, or an exception, retries the
	 * message, so a handler tolerates seeing an activity twice. A `Follow` handler may
	 * answer `"accept"`, `"reject"` or `"pending"`. `Like` handlers also receive Pleroma's
	 * `EmojiReact`.
	 *
	 * @param type - The activity type, or several sharing one handler.
	 * @param handler - Receives the verified activity and its `summary()`.
	 * @returns The federation, so registrations chain.
	 * @example federation.on(["Like", "Announce"], async (ctx) => saveResponse(ctx.summary()));
	 */
	on<T extends Federation.HandledType>(
		type: T | readonly T[],
		handler: (ctx: Federation.ContextOf<T>) => Federation.HandlerReturn<Federation.AnswerOf<T>>,
	): this {
		let types: readonly T[] = typeof type === "string" ? [type] : type;
		for (let one of types) this.#handlers.set(one, handler as AnyHandler);
		return this;
	}

	/**
	 * Answers the local actor's own URLs, as its document names them: the actor (with
	 * `publicKey` from its keys), a `POST` to `inbox` or `endpoints.sharedInbox`, `outbox`,
	 * `followers` and `following`. Any other URL answers `null`, so the app routes it on.
	 *
	 * An inbox `POST` is verified here, inside the request, and answers `202` once its
	 * message is queued, or the status of the check it failed. With `authorizedFetch`, the
	 * collections require a signed GET; the actor document always answers unsigned.
	 *
	 * @param request - Any incoming request.
	 * @returns The response, or `null` for a URL that is not one of the actor's.
	 * @example let response = await federation.fetch(request); if (response) return response;
	 */
	async fetch(request: Request): Promise<Response | null> {
		let actor = this.#options.actor;
		let path = pathOf(request.url);
		if (path === null) return null;
		let method = request.method.toUpperCase();
		let reads = method === "GET" || method === "HEAD";

		let isInbox = path === pathOf(actor.inbox) || path === pathOf(actor.endpoints.sharedInbox);
		if (isInbox && method === "POST") return this.#receive(request);

		let route = this.#documentRoute(path);
		if (route !== null && reads) {
			if (route !== "actor" && this.#options.authorizedFetch === true) {
				let verified = await this.verify(request);
				if (isFailure(verified)) return verified.error.toResponse();
			}
			return this.#serve(route, request);
		}

		if (isInbox) return notAllowed("POST");
		if (route !== null) return notAllowed("GET, HEAD");
		return null;
	}

	/**
	 * Answers `document` as ActivityStreams when the request prefers it over HTML, for a
	 * URL that serves both, such as a post's page. The response carries `Vary: Accept`, an
	 * `ETag` with `304` revalidation, a public 5-minute cache unless stated, and `410` for a
	 * `Tombstone`. With `authorizedFetch`, the request must carry a valid signature.
	 *
	 * @param request - The incoming request.
	 * @param document - The object, actor or collection the URL names.
	 * @param options - The cache policy, extra headers and status.
	 * @returns The response, or `null` when HTML wins and the app renders its page.
	 * @example let response = await federation.respond(request, article); if (response) return response;
	 */
	async respond(
		request: Request,
		document: ActivityPub.Draft<ActivityPub.Document>,
		options: Federation.RespondOptions = {},
	): Promise<Response | null> {
		if (!wantsActivity(request)) return null;
		if (this.#options.authorizedFetch === true) {
			let verified = await this.verify(request);
			if (isFailure(verified)) return verified.error.toResponse();
		}
		return respond(document, { ...options, request, vary: true });
	}

	/**
	 * Verifies the signature on a GET (authorized fetch): the blocked host of the key, the
	 * signature's age, and the key, refetched once when it no longer verifies. The local
	 * actor's document passes unsigned, because remote servers read its key from there.
	 *
	 * @param request - The GET.
	 * @returns The signer, or an `InboxError` whose `toResponse()` refuses the request.
	 * @example let verified = await federation.verify(request); if (isFailure(verified)) return verified.error.toResponse();
	 */
	verify(request: Request): Promise<Result<VerifiedFetch, InboxError>> {
		let maxAge = this.#options.inbox?.maxAge;
		return verifyFetch(request, {
			resolver: this.resolver,
			blocked: this.#blocked,
			actors: [this.#options.actor.id],
			now: this.#now(),
			...(maxAge === undefined ? {} : { maxAge }),
		});
	}

	/**
	 * Runs one queued message: an inbox activity through the protocol's checks and the
	 * app's handlers, a fan-out into one `deliver` message per distinct inbox, or one signed
	 * delivery. Accept and Reject replies are queued as deliveries, and an inbox answering
	 * `410` drops every follower reached through it.
	 *
	 * @param message - What the queue handed back, read through `Federation.MESSAGE`.
	 * @param options - The job's attempt, starting at 1, which spaces retries.
	 * @returns What happened, or a `FederationError` whose `retryable` and `delay` say
	 *   whether and when to retry.
	 * @example
	 * let processed = await federation.process(ctx.input, { attempts: ctx.attempts });
	 * if (isFailure(processed) && processed.error.retryable) ctx.retry({ delay: processed.error.delay });
	 */
	async process(
		message: Federation.Message,
		options: Federation.ProcessOptions = {},
	): Promise<Result<Federation.Outcome, FederationError>> {
		let attempts = options.attempts ?? 1;
		if (message.kind === "inbox") return this.#processInbox(message, attempts);
		if (message.kind === "fanOut") return this.#processFanOut(message, attempts);
		return this.#processDelivery(message, attempts);
	}

	/**
	 * Queues the fan-out of an activity by the local actor to everyone it addresses: its
	 * followers when the followers collection is in `to` or `cc`, and every other addressed
	 * actor's inbox.
	 *
	 * @param activity - The activity, as a document or as JSON text already serialized.
	 * @returns `too-large` for an activity over 120 KB, which no delivery message can carry,
	 *   or a retryable `enqueue` failure.
	 * @example await federation.publish({ id: `${post.url}#create`, type: "Create", actor: ACTOR_ID, object: article, to: [PUBLIC], cc: [FOLLOWERS_ID] });
	 */
	async publish(
		activity: ActivityPub.Draft<ActivityPub.Activity> | string,
	): Promise<Result<void, ActivityPubError>> {
		let text = typeof activity === "string" ? activity : stringify(activity);
		let size = new TextEncoder().encode(text).byteLength;
		if (size > MAX_ACTIVITY_BYTES) {
			return failure(
				new ActivityPubError(
					"too-large",
					`The activity is ${size} bytes, over the ${MAX_ACTIVITY_BYTES} a delivery can carry`,
				),
			);
		}
		return this.#enqueue([{ kind: "fanOut", actor: this.#options.actor.id, activity: text }]);
	}

	/**
	 * Resolves a handle to its actor the way Mastodon does: WebFinger on the handle's host,
	 * the `self` link typed as ActivityStreams, then the actor, whose own host must confirm
	 * the handle when it differs from the actor's canonical one.
	 *
	 * @param handle - `@user@host`, `user@host` or `acct:user@host`.
	 * @returns The actor; `not-found` when WebFinger names no actor, `id-mismatch` when the
	 *   actor's host does not confirm the handle.
	 * @example let actor = await federation.lookup("@someone@mastodon.social");
	 */
	lookup(handle: string): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>> {
		let timeout = this.#options.resolver?.timeout;
		return lookup(handle, {
			resolver: this.resolver,
			userAgent: this.#options.userAgent,
			...(timeout === undefined ? {} : { timeout }),
		});
	}

	/** Verifies an inbox POST and queues it; the status says what the sender does next. */
	async #receive(request: Request): Promise<Response> {
		let inbox = this.#options.inbox;
		let received = await receive(request, {
			resolver: this.resolver,
			blocked: this.#blocked,
			cache: this.#options.cache,
			now: this.#now(),
			...(inbox?.maxBytes === undefined ? {} : { maxBytes: inbox.maxBytes }),
			...(inbox?.maxAge === undefined ? {} : { maxAge: inbox.maxAge }),
		});
		if (isFailure(received)) {
			currentLog()?.note("activitypub.inbox.refused", {
				code: received.error.code,
				reason: received.error.message,
			});
			return received.error.toResponse();
		}

		let queued = await this.#enqueue([{ kind: "inbox", ...received.data }]);
		if (isFailure(queued)) {
			currentLog()?.warn("activitypub.inbox.unqueued", { reason: queued.error.message });
			return unavailable();
		}
		return new Response(null, { status: 202 });
	}

	/** Which of the actor's documents `path` names, or `null` for none. */
	#documentRoute(path: string): DocumentRoute | null {
		let actor = this.#options.actor;
		if (path === pathOf(actor.id)) return "actor";
		if (path === pathOf(actor.outbox)) return "outbox";
		if (path === pathOf(actor.followers)) return "followers";
		if (path === pathOf(actor.following)) return "following";
		return null;
	}

	/** Answers one of the actor's documents; a failing store answers `503`. */
	async #serve(route: DocumentRoute, request: Request): Promise<Response> {
		let document = await this.#document(route, new URL(request.url));
		if (isFailure(document)) {
			currentLog()?.warn("activitypub.document.unavailable", {
				route,
				reason: document.error.message,
			});
			return unavailable();
		}
		return respond(document.data, { request });
	}

	/** The document a route answers with, built from the actor, its keys and the stores. */
	async #document(
		route: DocumentRoute,
		url: URL,
	): Promise<Result<ActivityPub.Draft<ActivityPub.Document>, Error>> {
		let actor = this.#options.actor;
		if (route === "actor") {
			let keys = await this.#keys.keysOf(actor.id);
			let publicKey =
				!isFailure(keys) && keys.data !== null ? keys.data.publicKey : actor.publicKey;
			return success({ ...actor, publicKey });
		}

		let id = url.origin + url.pathname;
		let paged = url.searchParams.has("page") || url.searchParams.has("cursor");
		let cursor = url.searchParams.get("cursor");

		if (route === "following") return success(orderedCollection({ id, totalItems: 0 }));

		if (route === "followers") {
			if (!paged) {
				let count = await this.#options.stores.followers.count(actor.id);
				if (isFailure(count)) return count;
				return success(orderedCollection({ id, totalItems: count.data, first: pageUrl(id, null) }));
			}
			let listed = await this.#options.stores.followers.list(actor.id, {
				cursor,
				limit: this.#options.collections?.pageSize ?? DEFAULT_COLLECTION_PAGE_SIZE,
			});
			if (isFailure(listed)) return listed;
			return success(
				orderedCollectionPage({
					id: pageUrl(id, cursor),
					partOf: id,
					orderedItems: listed.data.items.map((follower) => follower.id),
					next: listed.data.next === null ? null : pageUrl(id, listed.data.next),
				}),
			);
		}

		let outbox = this.#options.outbox;
		if (outbox === undefined) return success(orderedCollection({ id, totalItems: 0 }));
		let page = await outbox(paged ? cursor : null);
		if (isFailure(page)) return page;
		if (!paged) {
			return success(
				orderedCollection({
					id,
					totalItems: page.data.totalItems ?? null,
					first: pageUrl(id, null),
				}),
			);
		}
		return success(
			orderedCollectionPage({
				id: pageUrl(id, cursor),
				partOf: id,
				orderedItems: page.data.items,
				next: page.data.next === null ? null : pageUrl(id, page.data.next),
			}),
		);
	}

	/** Runs an inbox activity through `handle` with the app's handlers. */
	async #processInbox(
		message: InboxMessage,
		attempts: number,
	): Promise<Result<Federation.Outcome, FederationError>> {
		let stores = this.#options.stores;
		let handled = await handle(message, {
			actor: this.#options.actor,
			keys: this.#keys,
			followers: stores.followers,
			seen: stores.seen,
			objects: stores.objects,
			resolver: this.resolver,
			blocked: this.#blocked,
			send: (activity, inbox) =>
				this.#enqueue([{ kind: "deliver", actor: this.#options.actor.id, activity, inbox }]),
			on: this.#handlerTable(),
			attempts,
			...(this.#options.seenTtl === undefined ? {} : { seenTtl: this.#options.seenTtl }),
		});
		if (isFailure(handled)) return this.#failed("inbox", handled.error, attempts, null);
		return success({ kind: "inbox", ...handled.data });
	}

	/** Turns a published activity into one `deliver` message per distinct inbox. */
	async #processFanOut(
		message: FanOutMessage,
		attempts: number,
	): Promise<Result<Federation.Outcome, FederationError>> {
		let pageSize = this.#options.delivery?.pageSize;
		let planned = await fanOut(
			{ actor: message.actor, activity: message.activity },
			{
				actor: this.#options.actor,
				followers: this.#options.stores.followers,
				resolver: this.resolver,
				blocked: this.#blocked,
				cache: this.#options.cache,
				enqueue: (deliveries) =>
					this.#enqueue(deliveries.map((delivery) => ({ kind: "deliver", ...delivery }))),
				now: this.#now,
				...(pageSize === undefined ? {} : { pageSize }),
			},
		);
		if (isFailure(planned)) return this.#failed("fanOut", planned.error, attempts, null);
		return success({ kind: "fanOut", ...planned.data });
	}

	/** Signs and POSTs one delivery, dropping the followers behind an inbox that is gone. */
	async #processDelivery(
		message: DeliverMessage,
		attempts: number,
	): Promise<Result<Federation.Outcome, FederationError>> {
		let timeout = this.#options.delivery?.timeout;
		let sent = await deliver(
			{ actor: message.actor, activity: message.activity, inbox: message.inbox },
			{
				keys: this.#keys,
				cache: this.#options.cache,
				userAgent: this.#options.userAgent,
				now: this.#now,
				...(timeout === undefined ? {} : { timeout }),
			},
		);
		if (!isFailure(sent)) return success({ kind: "deliver", ...sent.data });

		if (sent.error.code === "gone") {
			let removed = await this.#options.stores.followers.removeInbox(message.inbox);
			if (isFailure(removed)) {
				let error = new ActivityPubError("store", removed.error.message, {
					retryable: true,
					cause: removed.error,
				});
				return this.#failed("deliver", error, attempts, null);
			}
		}
		return this.#failed("deliver", sent.error, attempts, sent.error.retryAfter);
	}

	/**
	 * A failed message, with the wait before its retry: the backoff step for this attempt,
	 * or the inbox's `Retry-After` when that is longer.
	 */
	#failed(
		kind: FederationError["kind"],
		error: ActivityPubError,
		attempts: number,
		retryAfter: number | null,
	): Result<never, FederationError> {
		let delay = Math.max(retryAfter ?? 0, this.#backoff.delay(attempts));
		return failure(new FederationError(kind, error, delay));
	}

	/**
	 * Writes messages to the app's queue, through `enqueueMany` when it has one. A failure,
	 * or an exception, answers a retryable `enqueue` error.
	 */
	async #enqueue(messages: QueueMessage[]): Promise<Result<void, ActivityPubError>> {
		let queue = this.#options.queue;
		let written: Result<void, Error> | void = undefined;
		try {
			if (queue.enqueueMany !== undefined && messages.length > 1) {
				written = await queue.enqueueMany(messages);
			} else {
				for (let message of messages) {
					written = await queue.enqueue(message);
					if (isResult(written) && isFailure(written)) break;
				}
			}
		} catch (cause) {
			return failure(enqueueFailed(cause));
		}
		if (isResult(written) && isFailure(written)) return failure(enqueueFailed(written.error));
		return success(undefined);
	}

	/** The registered handlers in the shape `handle` calls, each given its context. */
	#handlerTable(): Partial<Handlers> {
		let table: Partial<Handlers> = {};
		for (let [type, handler] of this.#handlers) {
			let call = (inbound: Inbound | DeleteInbound) => invoke(handler, contextOf(inbound));
			Object.assign(table, { [HANDLER_KEYS[type]]: call });
		}
		return table;
	}
}

export namespace Federation {
	/** What a `Federation` is built from. */
	export interface Options {
		/**
		 * The local actor's document. Its `inbox`, `endpoints.sharedInbox`, `outbox`,
		 * `followers`, `following` and `id` are the URLs `fetch` answers, and Follows of it
		 * are what the inbox keeps followers for.
		 */
		actor: ActivityPub.Actor;
		/** The actor's keys, or a provider holding the keys of every actor the app hosts. */
		keys: ActorKeys | KeyProvider;
		stores: Stores;
		/** Remote documents, accepted signature schemes and failing origins; a failing cache costs a fetch. */
		cache: Cache;
		/** Sent on every outbound request; some instances refuse requests without one. */
		userAgent: string;
		/** Where inbox, fan-out and delivery messages go; the app hands each back to `process`. */
		queue: Queue;
		/**
		 * Whether requests from a host are refused: it cannot deliver, follow, or receive.
		 * @default () => false
		 */
		blocked?: BlockedCheck;
		/** Pages of the outbox collection; without it the outbox is empty. */
		outbox?: (cursor: string | null) => Promise<Result<OutboxPage, Error>>;
		/** Requires a signed GET for the collections and for `respond` (secure mode). @default false */
		authorizedFetch?: boolean;
		inbox?: InboxOptions;
		resolver?: ResolverOptions;
		delivery?: DeliveryOptions;
		collections?: CollectionOptions;
		/**
		 * The wait before each retry of a failed message, by attempt. The default covers about
		 * 21 hours over five retries.
		 * @default DELIVERY_BACKOFF
		 */
		backoff?: Backoff;
		/** How long a processed activity id is remembered to skip redeliveries. @default "1 day" */
		seenTtl?: DurationInput;
		/** The clock signatures, failure windows and `receivedAt` are read from. @default () => new Date() */
		now?: () => Date;
	}

	/** The app's storage, each implementing the interface the package calls. */
	export interface Stores {
		followers: FollowerStore;
		seen: SeenActivities;
		objects: LocalObjects;
	}

	/**
	 * The app's queue. Each message is plain JSON under 128 KB, and a job declared with
	 * `Federation.MESSAGE` reads it back. A failure or an exception makes the step that
	 * enqueued it fail as retryable.
	 */
	export interface Queue {
		enqueue(message: Message): Promise<Result<void, Error> | void>;
		/** Writes a fan-out's deliveries in one call; without it they go one by one. */
		enqueueMany?(messages: Message[]): Promise<Result<void, Error> | void>;
	}

	/** One page of the outbox, newest first. */
	export interface OutboxPage {
		/** Activities, usually each post's `Create`, or their IRIs. */
		items: CollectionItem[];
		/** The cursor of the following page, `null` on the last one. */
		next: string | null;
		/** The outbox's size, published on the collection. */
		totalItems?: number | null;
	}

	/** How the inbox reads a POST. */
	export interface InboxOptions {
		/** Bodies past this answer `413`. @default 102400 */
		maxBytes?: number;
		/** How old a signature may be, plus five minutes of clock skew. @default "1 hour" */
		maxAge?: DurationInput;
	}

	/** How remote documents are fetched. */
	export interface ResolverOptions {
		/** Signs every GET with the actor's keys, as GoToSocial and secure-mode Mastodon require. @default true */
		signed?: boolean;
		ttl?: ResolverTtl;
		/** @default "10 seconds" */
		timeout?: DurationInput;
		/** @default 1048576 */
		maxBytes?: number;
	}

	/** How activities are delivered. */
	export interface DeliveryOptions {
		/** The deadline of each POST. @default "15 seconds" */
		timeout?: DurationInput;
		/** Followers' inboxes read per store page, and the most deliveries per enqueue. @default 100 */
		pageSize?: number;
	}

	/** How the actor's collections are served. */
	export interface CollectionOptions {
		/** Followers per page of the followers collection. @default 50 */
		pageSize?: number;
	}

	/** How `process` runs a message. */
	export interface ProcessOptions {
		/** The job's attempt, starting at 1. Past the first, a redelivery check is skipped. @default 1 */
		attempts?: number;
	}

	/** How `respond` answers a document. */
	export type RespondOptions = Pick<DocumentRespondOptions, "cache" | "headers" | "status">;

	/** Every message federation enqueues, told apart by `kind`. */
	export type Message = QueueMessage;

	/** The activity types the app can register a handler for. */
	export type HandledType =
		| "Follow"
		| "Undo"
		| "Create"
		| "Update"
		| "Delete"
		| "Like"
		| "Announce"
		| "Accept"
		| "Reject"
		| "Move";

	/** A verified activity as a handler receives it, with its response summary. */
	export interface Context<
		A extends ActivityPub.Activity = ActivityPub.Activity,
	> extends Inbound<A> {
		/**
		 * A reply, mention, like or boost of local content in the shape a Webmention is
		 * stored in, with remote HTML sanitized; `null` for any other activity.
		 */
		summary(): Summary | null;
	}

	/** A verified `Delete`; `actor` is `null` when the deleted account's document is gone. */
	export interface DeleteContext extends DeleteInbound {
		/** A deletion summarizes as nothing, so this is always `null`. */
		summary(): Summary | null;
	}

	/** The context a handler for `T` receives. */
	export type ContextOf<T extends HandledType> = T extends "Delete" ? DeleteContext : Context;

	/** What a handler for `T` answers: a Follow decision, or nothing. */
	export type AnswerOf<T extends HandledType> = T extends "Follow" ? FollowDecision | null : void;

	/** A handler's return: the answer or a `Result` of it, sync or async. */
	export type HandlerReturn<T> = T | Result<T, Error> | Promise<T | Result<T, Error>>;

	/** What `process` did with a message. */
	export type Outcome =
		| ({ kind: "inbox" } & HandleOutcome)
		| { kind: "fanOut"; inboxes: number; skipped: number }
		| ({ kind: "deliver" } & Delivered);
}

/** The documents `fetch` serves besides the inbox. */
type DocumentRoute = "actor" | "outbox" | "followers" | "following";

/** The provider every internal step reads keys through, built from a single actor's keys. */
function providerOf(keys: ActorKeys | KeyProvider): KeyProvider {
	if ("keysOf" in keys) return keys;
	return { keysOf: async (actor) => success(actor === keys.actor ? keys : null) };
}

/** The origin and path an IRI names, which is what a request URL is routed by. */
function pathOf(iri: string | null): string | null {
	if (iri === null) return null;
	let url = URL.parse(iri);
	return url === null ? null : url.origin + url.pathname;
}

/** The URL of a collection page: `?page=true`, plus the store's cursor past the first. */
function pageUrl(id: string, cursor: string | null): string {
	let url = new URL(id);
	url.searchParams.set("page", "true");
	if (cursor !== null) url.searchParams.set("cursor", cursor);
	return url.href;
}

/** The answer to a method the URL does not serve. */
function notAllowed(allow: string): Response {
	return new Response(null, { status: 405, headers: { allow } });
}

/** The answer when a store or the queue failed, which a sender or crawler retries. */
function unavailable(): Response {
	return new Response("The server could not complete the request.", {
		status: 503,
		headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
	});
}

/** Whether a value is a `Result`, which handlers and queues may answer instead of nothing. */
function isResult(value: unknown): value is Result<unknown, Error> {
	if (typeof value !== "object" || value === null || !("status" in value)) return false;
	return (
		(value.status === "success" && "data" in value) ||
		(value.status === "failure" && "error" in value)
	);
}

/** A retryable `enqueue` failure wrapping what the queue raised. */
function enqueueFailed(cause: unknown): ActivityPubError {
	let reason = cause instanceof Error ? cause.message : String(cause);
	return new ActivityPubError("enqueue", `Could not enqueue: ${reason}`, {
		retryable: true,
		cause,
	});
}

/**
 * The context a handler receives: the inbound activity and its summary. A `Delete`
 * summarizes as nothing.
 */
function contextOf(
	inbound: Inbound | DeleteInbound,
): Federation.Context | Federation.DeleteContext {
	if ("deleted" in inbound) return { ...inbound, summary: () => null };
	return { ...inbound, summary: () => summarize(inbound) };
}

/**
 * Calls a handler and reads its answer as a `Result`: a plain value succeeds and an
 * exception fails, which `handle` retries like any handler failure.
 */
async function invoke(
	handler: AnyHandler,
	ctx: Federation.Context | Federation.DeleteContext,
): Promise<Result<unknown, Error>> {
	let returned: unknown;
	try {
		returned = await handler(ctx);
	} catch (cause) {
		return failure(cause instanceof Error ? cause : new Error(String(cause)));
	}
	if (isResult(returned)) return returned;
	return success(returned ?? null);
}
