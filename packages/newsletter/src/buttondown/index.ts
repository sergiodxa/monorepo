/**
 * The Buttondown provider: one class over Buttondown's REST API, pinned to a
 * dated API version and authenticated once, answering the newsletter contract
 * in our own models and verifying `X-Buttondown-Signature` deliveries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { Hex, hmac, timingSafeEqual } from "@sdxc/crypto";
import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Newsletter, SubscriberApi, WebhookApi } from "../contract.js";
import type { ConfirmationPolicy } from "../memory.js";
import type {
	ListSubscribersQuery,
	NewsletterEvent,
	NewsletterEventPayload,
	Page,
	SubscribeInput,
	SubscribeOutcome,
	Subscriber,
	SubscriberRef,
	UpdateSubscriberInput,
} from "../types.js";

import { NewsletterError, reportSkipped } from "../errors.js";
import { DEFAULT_PAGE_SIZE } from "../types.js";

import type { ButtondownSubscriber } from "./map.js";

import { toMappingError, toNewsletterError, toTransportError } from "./errors.js";
import { mapSubscriber, TYPES_BY_STATUS } from "./map.js";
import { SUBSCRIBER_PAGE_SCHEMA, SUBSCRIBER_SCHEMA, WEBHOOK_EVENT_SCHEMA } from "./schemas.js";

/** Buttondown's API root; every path below resolves against it. */
const API_URL = "https://api.buttondown.com/v1/";

/**
 * The dated API surface every request asks for. Buttondown transforms requests
 * and responses to the version a request names, and the schemas here read
 * exactly this one: `email_address` and `type` on subscribers, TypeID ids.
 */
export const API_VERSION = "2026-04-01";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "buttondown";

/** Header Buttondown carries a delivery's signature in, as `sha256=<hex>`. */
const SIGNATURE_HEADER = "X-Buttondown-Signature";

/** Prefix naming the signature's algorithm inside the header value. */
const SIGNATURE_PREFIX = "sha256=";

/** Buttondown's first page, since its lists are windowed by a 1-based page number. */
const FIRST_PAGE = 1;

/** Largest page Buttondown serves for a numbered list. */
const MAX_PAGE_SIZE = 1000;

/**
 * Oldest-first, so a reader created during a walk lands on a later page rather
 * than shifting every row a numbered page has already served.
 */
const LIST_ORDERING = "creation_date";

/** Buttondown codes meaning the address is already on the list, in any status. */
const ALREADY_EXISTS_CODES: ReadonlySet<string> = new Set([
	"email_already_exists",
	"subscriber_already_exists",
]);

/** An event name this provider maps a delivery onto. */
type MappedEventType = Exclude<NewsletterEventPayload["type"], "unrecognized">;

/**
 * Our event for each Buttondown event type. Everything absent arrives as
 * `unrecognized`, so an event Buttondown adds is a no-op for an endpoint.
 */
const EVENT_TYPES: Readonly<Record<string, MappedEventType>> = {
	"subscriber.created": "subscriber.created",
	"subscriber.confirmed": "subscriber.confirmed",
	"subscriber.unsubscribed": "subscriber.unsubscribed",
	"subscriber.updated": "subscriber.updated",
	"subscriber.deleted": "subscriber.deleted",
	"subscriber.bounced": "subscriber.suppressed",
	"subscriber.complained": "subscriber.suppressed",
	"subscriber.tags.changed": "subscriber.updated",
	"subscriber.type.changed": "subscriber.updated",
};

/** How a Buttondown newsletter is configured. */
export interface ButtondownNewsletterOptions {
	/**
	 * API key, sent as `Authorization: Token <key>`. An empty string answers
	 * every call `unauthenticated` without reaching the network, so an isolate
	 * missing the secret still boots.
	 */
	apiKey: string;

	/**
	 * Signing key configured on the Buttondown webhook. Unset or empty, every
	 * delivery is unproven, which is what an app mounting no webhook route wants.
	 */
	webhookSecret?: string;

	/**
	 * Whether a new reader must confirm (`unactivated`) or starts `regular`.
	 *
	 * @default "double"
	 */
	confirmation?: ConfirmationPolicy;

	/** @default "buttondown" */
	connection?: string;

	/**
	 * The newsletter this instance serves. Deliveries naming another newsletter
	 * of the same account normalize to no events, so they are acknowledged and
	 * skipped.
	 */
	newsletterId?: string;
}

/** The path addressing one subscriber, which Buttondown resolves by id or by address. */
function subscriberPath(ref: SubscriberRef | string): string {
	let key = typeof ref === "string" ? ref : "id" in ref ? ref.id : ref.email.address;
	return `subscribers/${encodeURIComponent(key)}`;
}

/** Drops keys whose value is unset, so the body carries only what the caller supplied. */
function compact(fields: Record<string, string | undefined>): Record<string, string> {
	let kept: Record<string, string> = {};
	for (let [key, value] of Object.entries(fields)) if (value !== undefined) kept[key] = value;
	return kept;
}

/**
 * The create body for a subscribe. Attribution fields Buttondown has a column
 * for go there; `term` and `content` travel as metadata keys, and the caller's
 * own metadata wins a key both name.
 */
function subscribeBody(input: SubscribeInput, confirmation: ConfirmationPolicy): unknown {
	let attribution = input.attribution ?? {};
	let metadata = {
		...compact({ utm_term: attribution.term, utm_content: attribution.content }),
		...input.metadata,
	};

	return {
		email_address: input.email.address,
		type: confirmation === "single" ? "regular" : "unactivated",
		tags: input.tags === undefined ? undefined : [...new Set(input.tags)],
		metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		...compact({
			utm_source: attribution.source,
			utm_medium: attribution.medium,
			utm_campaign: attribution.campaign,
			referrer_url: attribution.referrer ?? attribution.landingPage,
			ip_address: input.ipAddress ?? undefined,
		}),
	};
}

/**
 * A Buttondown newsletter answering the whole contract over Buttondown's REST
 * API. Construction reaches no network, so it is built once at module scope.
 *
 * @example
 * export let newsletter: Newsletter = new ButtondownNewsletter({
 * 	apiKey: env.BUTTONDOWN_API_KEY,
 * 	webhookSecret: env.BUTTONDOWN_WEBHOOK_SECRET,
 * });
 */
export class ButtondownNewsletter extends APIClient implements Newsletter {
	readonly connection: string;

	readonly subscribers: SubscriberApi;

	readonly webhooks: WebhookApi;

	#apiKey: string;

	#webhookSecret: string;

	#confirmation: ConfirmationPolicy;

	#newsletterId: string | null;

	/**
	 * Creates the provider; nothing is requested until a call needs it.
	 *
	 * @param options - Credentials, confirmation policy and the newsletter served.
	 */
	constructor(options: ButtondownNewsletterOptions) {
		super(new URL(API_URL));

		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#apiKey = options.apiKey;
		this.#webhookSecret = options.webhookSecret ?? "";
		this.#confirmation = options.confirmation ?? "double";
		this.#newsletterId = options.newsletterId ?? null;

		this.subscribers = this.#buildSubscriberApi();
		this.webhooks = this.#buildWebhookApi();
	}

	/** This client, whose verb methods reach any endpoint the contract omits. */
	get native(): this {
		return this;
	}

	/**
	 * Puts the API key and the pinned version on every request, so no call site
	 * can send one without them.
	 *
	 * @param request - Request about to be sent.
	 * @returns The request to send.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Token ${this.#apiKey}`);
		request.headers.set("X-API-Version", API_VERSION);
		request.headers.set("Accept", "application/json");
		if (request.body !== null) request.headers.set("Content-Type", "application/json");

		return request;
	}

	#error(code: NewsletterError["code"], message: string): Result<never, NewsletterError> {
		return failure(new NewsletterError(message, { code, connection: this.connection }));
	}

	/**
	 * Sends one request and reads its body as JSON, reporting every failure as
	 * ours: a missing key as unauthenticated, a lost answer as unknown, and a
	 * Buttondown refusal through its status and code.
	 */
	async #request(
		path: string,
		method: string,
		body?: unknown,
	): Promise<Result<unknown, NewsletterError>> {
		if (this.#apiKey === "") {
			return this.#error("unauthenticated", "no Buttondown API key is configured");
		}

		let response: Response;
		let text: string;

		try {
			response = await this.fetch(path, {
				method,
				body: body === undefined ? undefined : JSON.stringify(body),
			});
			text = await response.text();
		} catch (error) {
			return failure(toTransportError(this.connection, error));
		}

		if (!response.ok) return failure(toNewsletterError(this.connection, response, text));

		if (text.trim() === "") return success(null);

		try {
			return success(JSON.parse(text) as unknown);
		} catch {
			return failure(
				toMappingError(this.connection, `Buttondown answered ${path} with unreadable JSON`),
			);
		}
	}

	/** Parses a record without mapping its type, for reads that need only its fields. */
	#record(raw: unknown): Result<ButtondownSubscriber, NewsletterError> {
		let parsed = s.parseSafe(SUBSCRIBER_SCHEMA, raw);
		if (parsed.success) return success(parsed.value);
		return failure(toMappingError(this.connection, "unreadable Buttondown subscriber"));
	}

	/** Parses and maps a record, so an unmapped type reports `invalid_response`. */
	#subscriber(raw: unknown): Result<Subscriber, NewsletterError> {
		let record = this.#record(raw);
		return isFailure(record) ? record : mapSubscriber(this.connection, record.data);
	}

	async #read(ref: SubscriberRef | string): Promise<Result<ButtondownSubscriber, NewsletterError>> {
		let raw = await this.#request(subscriberPath(ref), "GET");
		return isFailure(raw) ? raw : this.#record(raw.data);
	}

	#buildSubscriberApi(): SubscriberApi {
		return {
			subscribe: async (input: SubscribeInput) => await this.#subscribe(input),

			find: async (ref: SubscriberRef) => {
				let raw = await this.#request(subscriberPath(ref), "GET");
				return isFailure(raw) ? raw : this.#subscriber(raw.data);
			},

			list: async (query: ListSubscribersQuery = {}) => await this.#list(query),

			tags: async (ref: SubscriberRef) => {
				let record = await this.#read(ref);
				return isFailure(record) ? record : success([...record.data.tags]);
			},

			update: async (ref: SubscriberRef, input: UpdateSubscriberInput) =>
				await this.#update(ref, input),

			unsubscribe: async (ref: SubscriberRef) => await this.#unsubscribe(ref),
		};
	}

	/**
	 * Creates the reader, or answers the one Buttondown already holds. The
	 * collision header stays unsent, since its merge resubscribes a reader who
	 * left; an existing address is read back unchanged instead.
	 */
	async #subscribe(input: SubscribeInput): Promise<Result<SubscribeOutcome, NewsletterError>> {
		let created = await this.#request(
			"subscribers",
			"POST",
			subscribeBody(input, this.#confirmation),
		);

		if (isFailure(created)) {
			let providerCode = created.error.providerCode;
			if (providerCode === null || !ALREADY_EXISTS_CODES.has(providerCode)) return created;

			let existing = await this.#request(subscriberPath(input.email.address), "GET");
			if (isFailure(existing)) return existing;

			let subscriber = this.#subscriber(existing.data);
			if (isFailure(subscriber)) return subscriber;

			currentLog()?.note("newsletter.subscribe", { connection: this.connection, created: false });
			return success({ subscriber: subscriber.data, created: false });
		}

		let subscriber = this.#subscriber(created.data);
		if (isFailure(subscriber)) return subscriber;

		currentLog()?.note("newsletter.subscribe", { connection: this.connection, created: true });
		return success({ subscriber: subscriber.data, created: true });
	}

	/**
	 * Pages by Buttondown's page number, carried as the opaque cursor. A row
	 * whose type has no mapping is skipped and reported, so one reader in a new
	 * state costs that row rather than the walk.
	 */
	async #list(query: ListSubscribersQuery): Promise<Result<Page<Subscriber>, NewsletterError>> {
		let page = query.cursor === undefined ? FIRST_PAGE : Number(query.cursor);

		if (!Number.isSafeInteger(page) || page < FIRST_PAGE) {
			return this.#error(
				"invalid_request",
				`"${query.cursor}" is not a cursor this provider issued`,
			);
		}

		let limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
		let params = new URLSearchParams({
			page: String(page),
			page_size: String(limit),
			ordering: LIST_ORDERING,
		});

		if (query.status !== undefined) {
			for (let type of TYPES_BY_STATUS[query.status]) params.append("type", type);
		}

		if (query.tag !== undefined) params.append("tag", query.tag);

		let raw = await this.#request(`subscribers?${params}`, "GET");
		if (isFailure(raw)) return raw;

		let parsed = s.parseSafe(SUBSCRIBER_PAGE_SCHEMA, raw.data);
		if (!parsed.success) {
			return failure(toMappingError(this.connection, "unreadable Buttondown subscriber page"));
		}

		let items: Subscriber[] = [];

		for (let row of parsed.value.results) {
			let record = this.#record(row);
			if (isFailure(record)) return record;

			let mapped = mapSubscriber(this.connection, record.data);
			if (isFailure(mapped)) {
				reportSkipped(this.connection, record.data.id, record.data.type);
				continue;
			}

			items.push(mapped.data);
		}

		let hasNext = parsed.value.next !== null && parsed.value.next !== undefined;

		return success({ items, cursor: hasNext ? String(page + 1) : null });
	}

	/**
	 * Reads the reader, applies the change and writes tags and metadata back in
	 * one PATCH, so add, remove and `null`-removes hold whether Buttondown
	 * replaces or merges those fields. Nested metadata values are kept as stored.
	 */
	async #update(
		ref: SubscriberRef,
		input: UpdateSubscriberInput,
	): Promise<Result<Subscriber, NewsletterError>> {
		let current = await this.#read(ref);
		if (isFailure(current)) return current;

		let record = current.data;
		let patch: Record<string, unknown> = {};

		if (input.tags !== undefined) {
			let removed = new Set(input.tags.remove ?? []);
			let tags = record.tags.filter((tag) => !removed.has(tag));
			for (let tag of input.tags.add ?? []) if (!tags.includes(tag)) tags.push(tag);
			patch["tags"] = tags;
		}

		if (input.metadata !== undefined) {
			let metadata: Record<string, unknown> = { ...record.metadata };
			for (let [key, value] of Object.entries(input.metadata)) {
				if (value === null) delete metadata[key];
				else metadata[key] = value;
			}
			patch["metadata"] = metadata;
		}

		if (Object.keys(patch).length === 0) return mapSubscriber(this.connection, record);

		let written = await this.#request(subscriberPath(record.id), "PATCH", patch);
		return isFailure(written) ? written : this.#subscriber(written.data);
	}

	/**
	 * Marks the reader `unsubscribed` with a PATCH, keeping the record. Buttondown
	 * refuses that type change for a suppressed reader, so a refused change is
	 * read back and answered as success when the reader is already off the list.
	 */
	async #unsubscribe(ref: SubscriberRef): Promise<Result<Subscriber, NewsletterError>> {
		let written = await this.#request(subscriberPath(ref), "PATCH", { type: "unsubscribed" });
		if (!isFailure(written)) return this.#subscriber(written.data);
		if (written.error.code !== "invalid_request") return written;

		let current = await this.#request(subscriberPath(ref), "GET");
		if (isFailure(current)) return written;

		let subscriber = this.#subscriber(current.data);
		if (isFailure(subscriber)) return subscriber;

		let status = subscriber.data.status;
		return status === "unsubscribed" || status === "suppressed" ? subscriber : written;
	}

	#buildWebhookApi(): WebhookApi {
		return {
			verify: async (request: Request, rawBody: string) => await this.#verify(request, rawBody),
			events: (_request: Request, rawBody: string) => this.#eventsOf(rawBody),
		};
	}

	/**
	 * Recomputes HMAC-SHA256 of the exact body with the signing key and compares
	 * it in constant time with the header's hex value. Buttondown signs no
	 * timestamp, so a replay is bounded by the endpoint's replay store.
	 */
	async #verify(request: Request, rawBody: string): Promise<boolean> {
		if (this.#webhookSecret === "") return false;

		let header = request.headers.get(SIGNATURE_HEADER)?.trim() ?? "";
		if (!header.startsWith(SIGNATURE_PREFIX)) return false;

		let provided = Hex.decode(header.slice(SIGNATURE_PREFIX.length));
		if (isFailure(provided)) return false;

		let expected = await hmac.sign(this.#webhookSecret, rawBody);
		if (isFailure(expected)) return false;

		return timingSafeEqual(expected.data, provided.data);
	}

	/**
	 * One delivery is one event about the subscriber it names. A delivery about
	 * no subscriber, or about another newsletter of the account, carries no
	 * event here, so the endpoint acknowledges it and moves on.
	 */
	#eventsOf(rawBody: string): Result<NewsletterEvent[], NewsletterError> {
		let raw: unknown;

		try {
			raw = JSON.parse(rawBody);
		} catch {
			return this.#error("invalid_request", "Buttondown delivery body is not JSON");
		}

		let parsed = s.parseSafe(WEBHOOK_EVENT_SCHEMA, raw);
		if (!parsed.success) return this.#error("invalid_request", "unreadable Buttondown delivery");

		let delivery = parsed.value;
		let newsletter = delivery.data.newsletter ?? null;
		let subscriberId = delivery.data.subscriber ?? null;

		if (this.#newsletterId !== null && newsletter !== null && newsletter !== this.#newsletterId) {
			return success([]);
		}

		if (subscriberId === null) return success([]);

		let mapped = Object.hasOwn(EVENT_TYPES, delivery.event_type)
			? EVENT_TYPES[delivery.event_type]
			: undefined;
		let payload: NewsletterEventPayload =
			mapped === undefined
				? { type: "unrecognized", providerType: delivery.event_type }
				: { type: mapped };

		return success([
			{ ...payload, id: delivery.id, occurredAt: null, subscriberId, subscriber: null, raw },
		]);
	}
}
