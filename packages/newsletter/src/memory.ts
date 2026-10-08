/**
 * The in-memory newsletter: a full implementation of the contract that passes
 * the conformance suite, so state one call writes is what the next reads, plus
 * seeding, scripted failures and Standard Webhooks deliveries for app tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { parseEmailAddress } from "@sdxc/email-address";
import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";
import { sign, verify } from "@sdxc/webhooks";
import * as s from "remix/data-schema";

import type { Newsletter, SubscriberApi, WebhookApi } from "./contract.js";
import type { NewsletterErrorCode } from "./errors.js";
import type {
	ListSubscribersQuery,
	NewsletterEvent,
	NewsletterEventPayload,
	Page,
	SubscribeInput,
	SubscribeOutcome,
	Subscriber,
	SubscriberAttribution,
	SubscriberRef,
	SubscriberStatus,
	UpdateSubscriberInput,
} from "./types.js";

import { NewsletterError } from "./errors.js";
import { DEFAULT_PAGE_SIZE } from "./types.js";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "memory";

/**
 * Signing secret used when the caller configures none. Standard Webhooks keys
 * on the secret's decoded bytes, so it is base64 like a real one.
 */
const DEFAULT_WEBHOOK_SECRET = "bWVtb3J5LW5ld3NsZXR0ZXItd2ViaG9vay1zZWNyZXQ";

/** Origin the emitted deliveries are addressed to. */
const DELIVERY_URL = "https://memory.test/webhooks/newsletter";

/** Whether a new reader must click a confirmation link before they are `active`. */
export type ConfirmationPolicy = "single" | "double";

/** The single contract group a fault can be armed on. */
type MemoryFaultGroups = { subscribers: SubscriberApi };

/**
 * What a fault covers: every subscriber call, or one method by its contract
 * name, so a method the contract gains is armable without a list here.
 *
 * @example
 * newsletter.fail("subscribers.subscribe", "suppressed");
 */
export type MemoryFaultTarget = {
	[Group in keyof MemoryFaultGroups]:
		| Group
		| `${Group}.${Extract<keyof MemoryFaultGroups[Group], string>}`;
}[keyof MemoryFaultGroups];

/** Faults armed from the start, as the failure each target reports. */
export type MemoryFaults = Partial<Record<MemoryFaultTarget, NewsletterErrorCode>>;

/** How a memory provider is configured. */
export interface MemoryNewsletterOptions {
	/** @default "memory" */
	connection?: string;
	/**
	 * Whether a new reader starts `pending` (`double`) or `active` (`single`).
	 *
	 * @default "double"
	 */
	confirmation?: ConfirmationPolicy;
	/**
	 * Base64 Standard Webhooks secret deliveries are signed and verified with.
	 * An empty string makes every delivery unproven, which is how a test asserts
	 * that an endpoint fails closed.
	 */
	webhookSecret?: string;
	/** Failures armed from the first call; see {@link MemoryNewsletter.fail}. */
	faults?: MemoryFaults;
}

/** A reader to start with; `status` defaults to `active`. */
export interface MemorySubscriberSeed {
	email: string;
	id?: string;
	status?: SubscriberStatus;
	tags?: readonly string[];
	metadata?: Readonly<Record<string, string>>;
	createdAt?: Date;
}

/** An event to deliver; the envelope is filled in, so a test states only what happened. */
export type MemoryEmitEvent = NewsletterEventPayload & {
	subscriberId: string;
	/** Event id; omitted issues one, and reusing one models a redelivery. */
	id?: string;
	occurredAt?: Date;
};

/** A signed delivery, ready to hand to a webhook endpoint. */
export interface MemoryDelivery {
	/** The inbound request an endpoint receives, body included. */
	request: Request;
	/** Exact body text the signature covers. */
	body: string;
	/** The events the provider itself normalizes the delivery into. */
	events: NewsletterEvent[];
}

/** Webhook questions plus the emitter that produces something to ask them about. */
export interface MemoryWebhookApi extends WebhookApi {
	/**
	 * Signs a delivery for one event without sending it anywhere. The delivery
	 * carries the subscriber's current record when the provider holds it.
	 *
	 * @param payload - What the delivery is about.
	 * @returns The delivery, or `invalid_request` when the configured secret is unusable.
	 */
	emit(payload: MemoryEmitEvent): Promise<Result<MemoryDelivery, NewsletterError>>;
}

/** A reader as this provider holds it, including what a subscribe recorded. */
interface StoredSubscriber {
	id: string;
	email: string;
	canonical: string;
	status: SubscriberStatus;
	metadata: Record<string, string>;
	tags: string[];
	createdAt: Date;
	attribution: SubscriberAttribution | null;
	ipAddress: string | null;
}

/** Our status vocabulary, so a delivery naming any other fails the parse. */
const STATUS_SCHEMA = s.enum_(["pending", "active", "unsubscribed", "suppressed"]);

/** A subscriber as an emitted delivery serializes it. */
const DELIVERED_SUBSCRIBER_SCHEMA = s.object({
	id: s.string(),
	email: s.string(),
	status: STATUS_SCHEMA,
	metadata: s.record(s.string(), s.string()),
	created_at: s.string(),
});

/** The body every emitted delivery carries. */
const DELIVERY_SCHEMA = s.object({
	id: s.string(),
	type: s.string(),
	occurred_at: s.string(),
	subscriber_id: s.string(),
	subscriber: s.nullable(DELIVERED_SUBSCRIBER_SCHEMA),
});

/** The event types this provider delivers under their own names. */
const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set([
	"subscriber.created",
	"subscriber.confirmed",
	"subscriber.unsubscribed",
	"subscriber.suppressed",
	"subscriber.updated",
	"subscriber.deleted",
]);

/**
 * The comparison key for an address handed over as text: the parsed canonical
 * form, or the lowercased input when it does not parse, so a seed of an address
 * the parser refuses is still found by the same text.
 */
function canonicalOf(email: string): string {
	let parsed = parseEmailAddress(email);
	return isFailure(parsed) ? email.toLowerCase() : parsed.data.canonical;
}

/** A frozen snapshot of a stored reader, so a caller holding it sees no later write. */
function toSubscriber(record: StoredSubscriber): Subscriber {
	return {
		id: record.id,
		email: record.email,
		status: record.status,
		providerStatus: record.status,
		metadata: Object.freeze({ ...record.metadata }),
		createdAt: new Date(record.createdAt),
	};
}

/**
 * A complete newsletter held in memory. App tests install it as
 * `context.newsletter` and assert on its state rather than on outbound HTTP.
 *
 * @example
 * let newsletter = new MemoryNewsletter({ confirmation: "single" });
 * newsletter.seed([{ email: "reader@example.com" }]);
 * newsletter.fail("subscribers.subscribe", "suppressed");
 */
export class MemoryNewsletter implements Newsletter {
	readonly connection: string;

	readonly subscribers: SubscriberApi;

	readonly webhooks: MemoryWebhookApi;

	#confirmation: ConfirmationPolicy;

	#webhookSecret: string;

	#faults = new Map<MemoryFaultTarget, NewsletterErrorCode>();

	#records = new Map<string, StoredSubscriber>();

	#sequence = 0;

	/**
	 * Creates an empty list.
	 *
	 * @param options - Connection, confirmation policy, signing secret and armed faults.
	 */
	constructor(options: MemoryNewsletterOptions = {}) {
		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#confirmation = options.confirmation ?? "double";
		this.#webhookSecret = options.webhookSecret ?? DEFAULT_WEBHOOK_SECRET;

		for (let [target, code] of Object.entries(options.faults ?? {})) {
			this.#faults.set(target as MemoryFaultTarget, code);
		}

		this.subscribers = this.#buildSubscriberApi();
		this.webhooks = this.#buildWebhookApi();
	}

	/** The provider itself, since it has no client beneath it. */
	get native(): this {
		return this;
	}

	/**
	 * Adds readers directly, bypassing confirmation and faults.
	 *
	 * @param records - The readers to hold; an address already held is replaced.
	 * @returns The stored readers, in the order given.
	 */
	seed(records: readonly MemorySubscriberSeed[]): Subscriber[] {
		return records.map((seed) => {
			let canonical = canonicalOf(seed.email);
			let previous = this.#records.get(canonical);

			let record: StoredSubscriber = {
				id: seed.id ?? previous?.id ?? this.#nextId(),
				email: seed.email,
				canonical,
				status: seed.status ?? "active",
				metadata: { ...seed.metadata },
				tags: [...(seed.tags ?? [])],
				createdAt: seed.createdAt ?? new Date(),
				attribution: null,
				ipAddress: null,
			};

			this.#records.set(canonical, record);
			return toSubscriber(record);
		});
	}

	/**
	 * Models a reader clicking the confirmation link: a `pending` reader becomes
	 * `active`, and a reader in any other status is answered unchanged.
	 *
	 * @param email - The reader's address.
	 * @returns The reader, or `not_found` when the address is not held.
	 */
	confirm(email: string): Result<Subscriber, NewsletterError> {
		let record = this.#records.get(canonicalOf(email));
		if (record === undefined) return this.#error("not_found", `no subscriber ${email}`);

		if (record.status === "pending") record.status = "active";

		return success(toSubscriber(record));
	}

	/**
	 * Arms a failure every call under `target` reports until it is healed.
	 *
	 * @param target - The whole subscriber group, or one method of it.
	 * @param code - The failure to report; a timeout's `unknown` when omitted.
	 */
	fail(target: MemoryFaultTarget, code: NewsletterErrorCode = "unknown"): void {
		this.#faults.set(target, code);
	}

	/**
	 * Disarms the failure on `target`, or every failure when none is named.
	 *
	 * @param target - The fault to take away.
	 */
	heal(target?: MemoryFaultTarget): void {
		if (target === undefined) this.#faults.clear();
		else this.#faults.delete(target);
	}

	/**
	 * Reads back the attribution the subscribe that created a reader recorded.
	 *
	 * @param email - The reader's address.
	 * @returns The attribution, or `null` for a seeded or unknown reader or one subscribed without it.
	 */
	attribution(email: string): SubscriberAttribution | null {
		let attribution = this.#records.get(canonicalOf(email))?.attribution;
		return attribution ? { ...attribution } : null;
	}

	/**
	 * Reads back the visitor address the subscribe that created a reader recorded.
	 *
	 * @param email - The reader's address.
	 * @returns The address, or `null` when none was recorded.
	 */
	ipAddress(email: string): string | null {
		return this.#records.get(canonicalOf(email))?.ipAddress ?? null;
	}

	#nextId(): string {
		this.#sequence += 1;
		return `sub_${this.#sequence}`;
	}

	#error(code: NewsletterErrorCode, message: string): Result<never, NewsletterError> {
		return failure(new NewsletterError(message, { code, connection: this.connection }));
	}

	/** The failure armed on a method or its group, the method's own fault winning. */
	#fault(method: keyof SubscriberApi): Result<never, NewsletterError> | null {
		let code = this.#faults.get(`subscribers.${method}`) ?? this.#faults.get("subscribers");
		if (code === undefined) return null;
		return this.#error(code, `armed fault on subscribers.${method}`);
	}

	#resolve(ref: SubscriberRef): Result<StoredSubscriber, NewsletterError> {
		let record =
			"id" in ref
				? [...this.#records.values()].find((candidate) => candidate.id === ref.id)
				: this.#records.get(ref.email.canonical);

		if (record === undefined) {
			return this.#error("not_found", `no subscriber ${"id" in ref ? ref.id : ref.email.address}`);
		}

		return success(record);
	}

	#buildSubscriberApi(): SubscriberApi {
		return {
			subscribe: async (input: SubscribeInput) => this.#subscribe(input),

			find: async (ref: SubscriberRef) => {
				let fault = this.#fault("find");
				if (fault) return fault;

				let record = this.#resolve(ref);
				return isFailure(record) ? record : success(toSubscriber(record.data));
			},

			list: async (query: ListSubscribersQuery = {}) => this.#list(query),

			tags: async (ref: SubscriberRef) => {
				let fault = this.#fault("tags");
				if (fault) return fault;

				let record = this.#resolve(ref);
				return isFailure(record) ? record : success([...record.data.tags]);
			},

			update: async (ref: SubscriberRef, input: UpdateSubscriberInput) => {
				let fault = this.#fault("update");
				if (fault) return fault;

				let record = this.#resolve(ref);
				if (isFailure(record)) return record;

				let stored = record.data;
				let removed = new Set(input.tags?.remove ?? []);
				let tags = stored.tags.filter((tag) => !removed.has(tag));

				for (let tag of input.tags?.add ?? []) if (!tags.includes(tag)) tags.push(tag);

				stored.tags = tags;

				for (let [key, value] of Object.entries(input.metadata ?? {})) {
					if (value === null) delete stored.metadata[key];
					else stored.metadata[key] = value;
				}

				return success(toSubscriber(stored));
			},

			unsubscribe: async (ref: SubscriberRef) => {
				let fault = this.#fault("unsubscribe");
				if (fault) return fault;

				let record = this.#resolve(ref);
				if (isFailure(record)) return record;

				if (record.data.status !== "suppressed") record.data.status = "unsubscribed";

				return success(toSubscriber(record.data));
			},
		};
	}

	/** An address already held answers its record untouched, whatever the input carried. */
	#subscribe(input: SubscribeInput): Result<SubscribeOutcome, NewsletterError> {
		let fault = this.#fault("subscribe");
		if (fault) return fault;

		let existing = this.#records.get(input.email.canonical);

		if (existing !== undefined) {
			currentLog()?.note("newsletter.subscribe", { connection: this.connection, created: false });
			return success({ subscriber: toSubscriber(existing), created: false });
		}

		let record: StoredSubscriber = {
			id: this.#nextId(),
			email: input.email.address,
			canonical: input.email.canonical,
			status: this.#confirmation === "double" ? "pending" : "active",
			metadata: { ...input.metadata },
			tags: [...new Set(input.tags ?? [])],
			createdAt: new Date(),
			attribution: input.attribution ? { ...input.attribution } : null,
			ipAddress: input.ipAddress ?? null,
		};

		this.#records.set(record.canonical, record);
		currentLog()?.note("newsletter.subscribe", { connection: this.connection, created: true });

		return success({ subscriber: toSubscriber(record), created: true });
	}

	/** Pages in insertion order; the cursor is the offset of the next page. */
	#list(query: ListSubscribersQuery): Result<Page<Subscriber>, NewsletterError> {
		let fault = this.#fault("list");
		if (fault) return fault;

		let offset = query.cursor === undefined ? 0 : Number(query.cursor);

		if (!Number.isInteger(offset) || offset < 0) {
			return this.#error("invalid_request", `unreadable cursor ${query.cursor}`);
		}

		let limit = query.limit ?? DEFAULT_PAGE_SIZE;

		let matching = [...this.#records.values()].filter(
			(record) =>
				(query.status === undefined || record.status === query.status) &&
				(query.tag === undefined || record.tags.includes(query.tag)),
		);

		let next = offset + limit;

		return success({
			items: matching.slice(offset, next).map(toSubscriber),
			cursor: next < matching.length ? String(next) : null,
		});
	}

	#buildWebhookApi(): MemoryWebhookApi {
		return {
			verify: async (request: Request, rawBody: string) => {
				if (this.#webhookSecret === "") return false;

				let replayed = new Request(request.url, {
					method: "POST",
					headers: request.headers,
					body: rawBody,
				});

				return !isFailure(await verify(replayed, { secret: this.#webhookSecret }));
			},

			events: (_request: Request, rawBody: string) => this.#eventsOf(rawBody),

			emit: async (payload: MemoryEmitEvent) => this.#emit(payload),
		};
	}

	async #emit(payload: MemoryEmitEvent): Promise<Result<MemoryDelivery, NewsletterError>> {
		let id = payload.id ?? `evt_${crypto.randomUUID()}`;
		let record = [...this.#records.values()].find(
			(candidate) => candidate.id === payload.subscriberId,
		);

		let body = {
			id,
			type: payload.type === "unrecognized" ? payload.providerType : payload.type,
			occurred_at: (payload.occurredAt ?? new Date()).toISOString(),
			subscriber_id: payload.subscriberId,
			subscriber:
				record === undefined
					? null
					: {
							id: record.id,
							email: record.email,
							status: record.status,
							metadata: record.metadata,
							created_at: record.createdAt.toISOString(),
						},
		};

		let signed = await sign(body, {
			secret: this.#webhookSecret,
			id,
			timestamp: new Date(),
		});

		if (isFailure(signed)) {
			return this.#error("invalid_request", `unusable webhook secret: ${signed.error.message}`);
		}

		let events = this.#eventsOf(signed.data.body);
		if (isFailure(events)) return events;

		signed.data.headers.set("content-type", "application/json");

		return success({
			request: new Request(DELIVERY_URL, {
				method: "POST",
				headers: signed.data.headers,
				body: signed.data.body,
			}),
			body: signed.data.body,
			events: events.data,
		});
	}

	/** One delivery carries one event, keeping the parsed body on it as `raw`. */
	#eventsOf(rawBody: string): Result<NewsletterEvent[], NewsletterError> {
		let raw: unknown;

		try {
			raw = JSON.parse(rawBody);
		} catch {
			return this.#error("invalid_request", "delivery body is not JSON");
		}

		let parsed = s.parseSafe(DELIVERY_SCHEMA, raw);
		if (!parsed.success) return this.#error("invalid_request", "unreadable delivery body");

		let delivery = parsed.value;
		let subscriber: Subscriber | null =
			delivery.subscriber === null
				? null
				: {
						id: delivery.subscriber.id,
						email: delivery.subscriber.email,
						status: delivery.subscriber.status,
						providerStatus: delivery.subscriber.status,
						metadata: delivery.subscriber.metadata,
						createdAt: new Date(delivery.subscriber.created_at),
					};

		let common = {
			id: delivery.id,
			occurredAt: new Date(delivery.occurred_at),
			subscriberId: delivery.subscriber_id,
			subscriber,
			raw,
		};

		let payload: NewsletterEventPayload = KNOWN_EVENT_TYPES.has(delivery.type)
			? ({ type: delivery.type } as NewsletterEventPayload)
			: { type: "unrecognized", providerType: delivery.type };

		return success([{ ...payload, ...common }]);
	}
}
