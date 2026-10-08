/**
 * The Kit provider: one class over Kit's API v4 that answers the whole
 * newsletter contract in our own models, subscribing through a configured form
 * so attribution and double opt-in follow Kit's own rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

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
	Page,
	SubscribeInput,
	SubscribeOutcome,
	Subscriber,
	SubscriberRef,
	UpdateSubscriberInput,
} from "../types.js";

import { NewsletterError, reportSkipped } from "../errors.js";
import { DEFAULT_PAGE_SIZE } from "../types.js";

import type { KitSubscriber } from "./schemas.js";

import { toMappingError, toNewsletterError, toTransportError } from "./errors.js";
import {
	attributionFieldsOf,
	eventPayloadOf,
	statusFilterOf,
	toFormReferrer,
	toSubscriber,
} from "./map.js";
import {
	CUSTOM_FIELD_PAGE_SCHEMA,
	DELIVERY_SCHEMA,
	SUBSCRIBER_ENVELOPE_SCHEMA,
	SUBSCRIBER_PAGE_SCHEMA,
	TAG_ENVELOPE_SCHEMA,
	TAG_PAGE_SCHEMA,
} from "./schemas.js";

/** Kit's API v4, which every path is resolved against. */
const BASE_URL = "https://api.kit.com/v4/";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "kit";

/** Header Kit reads an API key from. */
const API_KEY_HEADER = "X-Kit-Api-Key";

/** Header Kit signs every webhook delivery in. */
const SIGNATURE_HEADER = "X-Kit-Signature";

/**
 * Accepted distance between a delivery's signing time and now, in seconds.
 * Kit re-signs a retry when it sends it, so a late retry still falls inside.
 */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Largest page Kit serves, which a larger request is clamped to. */
const MAX_PAGE_SIZE = 1000;

/** The smallest page a caller can ask for. */
const MIN_PAGE_SIZE = 1;

/** Content type on every request carrying a body. */
const JSON_HEADERS: Readonly<Record<string, string>> = { "content-type": "application/json" };

/**
 * Kit ids and signature timestamps are unsigned integers, so an id in any other
 * form names no subscriber on Kit.
 */
const DIGITS_PATTERN = /^\d+$/;

/** States in which a reader already receives nothing, so an unsubscribe has nothing to do. */
const UNMAILABLE_STATES: ReadonlySet<string> = new Set(["cancelled", "bounced", "complained"]);

/** The form every subscription goes through. */
export interface KitForm {
	/** Kit's id for the form. */
	id: string;
	/**
	 * Whether the form is double opt-in in Kit. It must match the form's own
	 * setting, which is what decides whether the incentive email goes out.
	 */
	confirmation: ConfirmationPolicy;
}

/** How a Kit connection is configured. */
export interface KitNewsletterOptions {
	/** V4 API key, sent as `X-Kit-Api-Key`; an empty key fails every call as `unauthenticated`. */
	apiKey: string;
	/** Signing secret of the webhook endpoint; unset or empty, every delivery is unproven. */
	webhookSecret?: string;
	/**
	 * The form a subscription is added through, which is where Kit records
	 * attribution and decides double opt-in. Without it subscribers are created
	 * `active` and attribution is dropped.
	 */
	form?: KitForm;
	/** @default "kit" */
	connection?: string;
}

/** A Kit tag as its id and name, which is what removing one by name needs. */
interface KitTag {
	id: number;
	name: string;
}

/** A query string from its entries, dropping those left unset. */
function queryOf(entries: Record<string, string | number | undefined>): string {
	let params = new URLSearchParams();

	for (let [key, value] of Object.entries(entries)) {
		if (value !== undefined) params.set(key, String(value));
	}

	return params.size > 0 ? `?${params.toString()}` : "";
}

/** The comparison key for a tag name, since Kit matches tag names case-insensitively. */
function tagKey(name: string): string {
	return name.toLowerCase();
}

/**
 * A configured Kit account, answering the newsletter contract over Kit's API
 * v4. Construction reaches no network, so it is built once at module scope.
 *
 * @example
 * export let newsletter: Newsletter = new KitNewsletter({
 * 	apiKey: env.KIT_API_KEY,
 * 	webhookSecret: env.KIT_WEBHOOK_SECRET,
 * 	form: { id: "55", confirmation: "double" },
 * });
 */
export class KitNewsletter extends APIClient implements Newsletter {
	readonly connection: string;

	readonly subscribers: SubscriberApi;

	readonly webhooks: WebhookApi;

	#apiKey: string;

	#webhookSecret: string;

	#form: KitForm | null;

	/** Tag ids by lowercased name; a tag's id never changes, so an entry stays valid. */
	#tagIds = new Map<string, number>();

	/** The account's custom-field keys, read on first need and again when a key is missing. */
	#fieldKeys: Set<string> | null = null;

	/**
	 * Creates the provider. Nothing is requested here, so a missing key fails
	 * the call that needed it rather than the isolate.
	 *
	 * @param options - Credentials, the subscription form and the connection name.
	 */
	constructor(options: KitNewsletterOptions) {
		super(new URL(BASE_URL));

		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#apiKey = options.apiKey;
		this.#webhookSecret = options.webhookSecret ?? "";
		this.#form = options.form ?? null;

		this.subscribers = this.#buildSubscriberApi();
		this.webhooks = this.#buildWebhookApi();
	}

	/** This client, whose verb methods reach any endpoint the contract omits. */
	get native(): this {
		return this;
	}

	/**
	 * Puts the API key on every request, so no call site can send one without it.
	 *
	 * @param request - Request about to be sent.
	 * @returns The request to send.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set(API_KEY_HEADER, this.#apiKey);
		request.headers.set("Accept", "application/json");

		return request;
	}

	#error(code: NewsletterError["code"], message: string): Result<never, NewsletterError> {
		return failure(new NewsletterError(message, { code, connection: this.connection }));
	}

	/**
	 * Sends one request and reads its body, reporting every failure as ours: an
	 * empty key before the network, a lost answer as unknown, and a Kit failure
	 * by its status. A `204` answers `null`.
	 */
	async #call(path: string, init?: RequestInit): Promise<Result<unknown, NewsletterError>> {
		if (this.#apiKey === "") return this.#error("unauthenticated", "no Kit API key configured");

		let response: Response;
		let body: string;

		try {
			response = await this.fetch(path, init);
			body = await response.text();
		} catch (error) {
			return failure(toTransportError(this.connection, error));
		}

		if (!response.ok) return failure(toNewsletterError(this.connection, response, body));
		if (body === "") return success(null);

		try {
			return success(JSON.parse(body) as unknown);
		} catch {
			return failure(toMappingError(this.connection, `Kit answered ${path} with unreadable JSON`));
		}
	}

	/** Sends a request and parses its answer, reporting a shape the schema refuses as `invalid_response`. */
	async #read<Output>(
		schema: Schema<unknown, Output>,
		path: string,
		init?: RequestInit,
	): Promise<Result<Output, NewsletterError>> {
		let answer = await this.#call(path, init);
		if (isFailure(answer)) return answer;

		let parsed = s.parseSafe(schema, answer.data);
		if (!parsed.success) {
			return failure(toMappingError(this.connection, `unmappable Kit answer to ${path}`));
		}

		return success(parsed.value);
	}

	/** The init of a request carrying a JSON body. */
	#json(method: string, body: unknown): RequestInit {
		return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
	}

	/** Maps a record, reporting a state this provider has no mapping for as `invalid_response`. */
	#map(record: KitSubscriber): Result<Subscriber, NewsletterError> {
		let subscriber = toSubscriber(record);
		if (subscriber === null) {
			return failure(
				toMappingError(
					this.connection,
					`Kit subscriber ${record.id} is in unmapped state ${record.state}`,
				),
			);
		}

		return success(subscriber);
	}

	/**
	 * Looks an address up in every state, since Kit's list answers only active
	 * readers unless told otherwise.
	 *
	 * @returns The record, or `null` when Kit holds no such address.
	 */
	async #lookup(email: EmailAddress): Promise<Result<KitSubscriber | null, NewsletterError>> {
		let page = await this.#read(
			SUBSCRIBER_PAGE_SCHEMA,
			`subscribers${queryOf({ email_address: email.address, status: "all" })}`,
		);

		return isFailure(page) ? page : success(page.data.subscribers[0] ?? null);
	}

	/** Reads the record a ref names, `not_found` when Kit holds none. */
	async #record(ref: SubscriberRef): Promise<Result<KitSubscriber, NewsletterError>> {
		if ("email" in ref) {
			let found = await this.#lookup(ref.email);
			if (isFailure(found)) return found;
			if (found.data === null)
				return this.#error("not_found", `no subscriber ${ref.email.address}`);

			return success(found.data);
		}

		if (!DIGITS_PATTERN.test(ref.id)) return this.#error("not_found", `no subscriber ${ref.id}`);

		let envelope = await this.#read(SUBSCRIBER_ENVELOPE_SCHEMA, `subscribers/${ref.id}`);
		return isFailure(envelope) ? envelope : success(envelope.data.subscriber);
	}

	/** Kit's id for a ref, reading the address only when the ref is one. */
	async #idOf(ref: SubscriberRef): Promise<Result<string, NewsletterError>> {
		if ("id" in ref) {
			return DIGITS_PATTERN.test(ref.id)
				? success(ref.id)
				: this.#error("not_found", `no subscriber ${ref.id}`);
		}

		let record = await this.#record(ref);
		return isFailure(record) ? record : success(String(record.data.id));
	}

	/**
	 * Resolves a tag name to Kit's id. Creating is idempotent on the name in
	 * Kit, so a write resolves with one request; a read walks the account's tags
	 * instead, so looking a tag up never creates it.
	 *
	 * @returns The id, or `null` when reading and the account has no such tag.
	 */
	async #tagId(name: string, create: boolean): Promise<Result<number | null, NewsletterError>> {
		let cached = this.#tagIds.get(tagKey(name));
		if (cached !== undefined) return success(cached);

		if (create) {
			let created = await this.#read(TAG_ENVELOPE_SCHEMA, "tags", this.#json("POST", { name }));
			if (isFailure(created)) return created;

			this.#tagIds.set(tagKey(name), created.data.tag.id);
			return success(created.data.tag.id);
		}

		let tags = await this.#walkTags("tags");
		return isFailure(tags) ? tags : success(this.#tagIds.get(tagKey(name)) ?? null);
	}

	/** Reads every page of a tag list, remembering each id it learns. */
	async #walkTags(path: string): Promise<Result<KitTag[], NewsletterError>> {
		let tags: KitTag[] = [];
		let after: string | undefined;

		do {
			let page = await this.#read(
				TAG_PAGE_SCHEMA,
				`${path}${queryOf({ per_page: MAX_PAGE_SIZE, after })}`,
			);
			if (isFailure(page)) return page;

			for (let tag of page.data.tags) {
				this.#tagIds.set(tagKey(tag.name), tag.id);
				tags.push(tag);
			}

			after = page.data.pagination.has_next_page
				? (page.data.pagination.end_cursor ?? undefined)
				: undefined;
		} while (after !== undefined);

		return success(tags);
	}

	/**
	 * Names the keys the account has no custom field for. The cached keys are
	 * read again before a key is called unknown, so a field created after the
	 * first read is found.
	 */
	async #unknownFields(keys: readonly string[]): Promise<Result<string[], NewsletterError>> {
		if (this.#fieldKeys === null || keys.some((key) => !this.#fieldKeys?.has(key))) {
			let fields = new Set<string>();
			let after: string | undefined;

			do {
				let page = await this.#read(
					CUSTOM_FIELD_PAGE_SCHEMA,
					`custom_fields${queryOf({ per_page: MAX_PAGE_SIZE, after })}`,
				);
				if (isFailure(page)) return page;

				for (let field of page.data.custom_fields) fields.add(field.key);

				after = page.data.pagination.has_next_page
					? (page.data.pagination.end_cursor ?? undefined)
					: undefined;
			} while (after !== undefined);

			this.#fieldKeys = fields;
		}

		let known = this.#fieldKeys ?? new Set<string>();
		return success(keys.filter((key) => !known.has(key)));
	}

	/** Applies one tag to a subscriber; Kit answers a tag already applied as a success. */
	async #tag(subscriberId: string, name: string): Promise<Result<void, NewsletterError>> {
		let id = await this.#tagId(name, true);
		if (isFailure(id)) return id;

		let tagged = await this.#call(
			`tags/${id.data}/subscribers/${subscriberId}`,
			this.#json("POST", {}),
		);
		return isFailure(tagged) ? tagged : success(undefined);
	}

	#buildSubscriberApi(): SubscriberApi {
		return {
			subscribe: async (input: SubscribeInput) => this.#subscribe(input),

			find: async (ref: SubscriberRef) => {
				let record = await this.#record(ref);
				return isFailure(record) ? record : this.#map(record.data);
			},

			list: async (query: ListSubscribersQuery = {}) => this.#list(query),

			tags: async (ref: SubscriberRef) => {
				let id = await this.#idOf(ref);
				if (isFailure(id)) return id;

				let tags = await this.#walkTags(`subscribers/${id.data}/tags`);
				return isFailure(tags) ? tags : success(tags.data.map((tag) => tag.name));
			},

			update: async (ref: SubscriberRef, input: UpdateSubscriberInput) => this.#update(ref, input),

			unsubscribe: async (ref: SubscriberRef) => this.#unsubscribe(ref),
		};
	}

	/**
	 * Looks the address up first, because Kit's create is an upsert that would
	 * rewrite a held reader. A new reader is created, added to the form with its
	 * attribution as the `referrer`, then tagged.
	 */
	async #subscribe(input: SubscribeInput): Promise<Result<SubscribeOutcome, NewsletterError>> {
		let log = currentLog();
		let existing = await this.#lookup(input.email);
		if (isFailure(existing)) return existing;

		if (existing.data !== null) {
			let subscriber = this.#map(existing.data);
			if (isFailure(subscriber)) return subscriber;

			log?.note("newsletter.subscribe", { connection: this.connection, created: false });
			return success({ subscriber: subscriber.data, created: false });
		}

		let metadata = input.metadata ?? {};
		let created = await this.#read(
			SUBSCRIBER_ENVELOPE_SCHEMA,
			"subscribers",
			this.#json("POST", {
				email_address: input.email.address,
				state: this.#form?.confirmation === "double" ? "inactive" : "active",
				...(Object.keys(metadata).length > 0 ? { fields: metadata } : {}),
			}),
		);
		if (isFailure(created)) return created;

		let warnings = created.data.warnings ?? [];
		if (warnings.length > 0) {
			log?.note("newsletter.metadata_dropped", {
				connection: this.connection,
				warnings: warnings.join("; "),
			});
		}

		let record = created.data.subscriber;
		let added = await this.#addToForm(input);
		if (isFailure(added)) return added;
		if (added.data !== null) record = added.data;

		for (let name of new Set(input.tags ?? [])) {
			let tagged = await this.#tag(String(record.id), name);
			if (isFailure(tagged)) return tagged;
		}

		let subscriber = this.#map(record);
		if (isFailure(subscriber)) return subscriber;

		log?.note("newsletter.subscribe", { connection: this.connection, created: true });
		return success({ subscriber: subscriber.data, created: true });
	}

	/**
	 * Adds a new reader to the configured form, which is where Kit records the
	 * landing page and its `utm_*` parameters. Attribution Kit has no place for
	 * is logged as dropped.
	 *
	 * @returns The record as the form add answered it, or `null` with no form configured.
	 */
	async #addToForm(input: SubscribeInput): Promise<Result<KitSubscriber | null, NewsletterError>> {
		let form = this.#form;
		let { referrer, dropped } =
			form === null
				? { referrer: null, dropped: attributionFieldsOf(input.attribution) }
				: toFormReferrer(input.attribution);

		if (dropped.length > 0) {
			currentLog()?.note("newsletter.attribution_dropped", {
				connection: this.connection,
				fields: dropped.join(","),
				reason: form === null ? "no_form" : referrer === null ? "no_landing_page" : "no_field",
			});
		}

		if (form === null) return success(null);

		let added = await this.#read(
			SUBSCRIBER_ENVELOPE_SCHEMA,
			`forms/${form.id}/subscribers`,
			this.#json("POST", {
				email_address: input.email.address,
				...(referrer === null ? {} : { referrer }),
			}),
		);

		return isFailure(added) ? added : success(added.data.subscriber);
	}

	/**
	 * Pages one of Kit's subscriber lists by its cursor. A tag filter reads the
	 * tag's own list, and a row whose state has no mapping is skipped and
	 * reported, so one odd record costs that row rather than the page.
	 */
	async #list(query: ListSubscribersQuery): Promise<Result<Page<Subscriber>, NewsletterError>> {
		let path = "subscribers";

		if (query.tag !== undefined) {
			let tag = await this.#tagId(query.tag, false);
			if (isFailure(tag)) return tag;
			if (tag.data === null) return success({ items: [], cursor: null });

			path = `tags/${tag.data}/subscribers`;
		}

		let limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
		let page = await this.#read(
			SUBSCRIBER_PAGE_SCHEMA,
			`${path}${queryOf({ status: statusFilterOf(query.status), per_page: limit, after: query.cursor })}`,
		);
		if (isFailure(page)) return page;

		let items: Subscriber[] = [];
		for (let record of page.data.subscribers) {
			let subscriber = toSubscriber(record);

			if (subscriber === null) {
				reportSkipped(this.connection, String(record.id), record.state);
				continue;
			}

			if (query.status === undefined || subscriber.status === query.status) items.push(subscriber);
		}

		let { has_next_page: more, end_cursor: cursor } = page.data.pagination;

		return success({ items, cursor: more ? (cursor ?? null) : null });
	}

	/**
	 * Applies tag removals, then additions, then the metadata merge, and answers
	 * the stored record. Metadata keys are checked before anything is written,
	 * since Kit stores values only under custom fields that already exist.
	 */
	async #update(
		ref: SubscriberRef,
		input: UpdateSubscriberInput,
	): Promise<Result<Subscriber, NewsletterError>> {
		let record = await this.#record(ref);
		if (isFailure(record)) return record;

		let stored = record.data;
		let id = String(stored.id);
		let fields = input.metadata ?? {};
		let keys = Object.keys(fields);

		if (keys.length > 0) {
			let unknown = await this.#unknownFields(keys);
			if (isFailure(unknown)) return unknown;

			if (unknown.data.length > 0) {
				return this.#error(
					"invalid_request",
					`Kit has no custom field ${unknown.data.join(", ")}; create it in Kit first`,
				);
			}
		}

		let removed = new Set((input.tags?.remove ?? []).map(tagKey));

		if (removed.size > 0) {
			let current = await this.#walkTags(`subscribers/${id}/tags`);
			if (isFailure(current)) return current;

			for (let tag of current.data) {
				if (!removed.has(tagKey(tag.name))) continue;

				let untagged = await this.#call(`tags/${tag.id}/subscribers/${id}`, { method: "DELETE" });
				if (isFailure(untagged)) return untagged;
			}
		}

		for (let name of new Set(input.tags?.add ?? [])) {
			let tagged = await this.#tag(id, name);
			if (isFailure(tagged)) return tagged;
		}

		if (keys.length > 0) {
			let updated = await this.#read(
				SUBSCRIBER_ENVELOPE_SCHEMA,
				`subscribers/${id}`,
				this.#json("PUT", { email_address: stored.email_address, fields }),
			);
			if (isFailure(updated)) return updated;

			let warnings = updated.data.warnings ?? [];
			if (warnings.length > 0) return this.#error("invalid_request", warnings.join("; "));

			stored = updated.data.subscriber;
		}

		return this.#map(stored);
	}

	/**
	 * Moves a reader to `cancelled`. A reader Kit already mails nothing to is
	 * answered as held, so repeating the call succeeds and a bounced address
	 * stays suppressed.
	 */
	async #unsubscribe(ref: SubscriberRef): Promise<Result<Subscriber, NewsletterError>> {
		let record = await this.#record(ref);
		if (isFailure(record)) return record;

		if (UNMAILABLE_STATES.has(record.data.state)) return this.#map(record.data);

		let unsubscribed = await this.#call(
			`subscribers/${record.data.id}/unsubscribe`,
			this.#json("POST", {}),
		);
		if (isFailure(unsubscribed)) return unsubscribed;

		return this.#map({ ...record.data, state: "cancelled" });
	}

	#buildWebhookApi(): WebhookApi {
		return {
			verify: async (request: Request, rawBody: string) => this.#verify(request, rawBody),
			events: (_request: Request, rawBody: string) => this.#eventsOf(rawBody),
		};
	}

	/**
	 * Checks `X-Kit-Signature`: a fresh `t` and an HMAC-SHA256 of `t.body` that
	 * matches any `v1` entry, which is how a delivery signed during a secret
	 * rotation verifies under either secret.
	 */
	async #verify(request: Request, rawBody: string): Promise<boolean> {
		if (this.#webhookSecret === "") return false;

		let parts = (request.headers.get(SIGNATURE_HEADER) ?? "").split(",").map((part) => part.trim());
		let timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
		let candidates = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

		if (timestamp === undefined || !DIGITS_PATTERN.test(timestamp)) return false;
		if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

		let mac = await hmac.sign(this.#webhookSecret, `${timestamp}.${rawBody}`);
		if (isFailure(mac)) return false;

		let expected = Hex.encode(mac.data);
		return candidates.some((candidate) => timingSafeEqual(expected, candidate.toLowerCase()));
	}

	/**
	 * One event per entry of the delivery's `events` array that names a
	 * subscriber; a resource event such as `tag.created` concerns no reader of
	 * the list, so it is left out and the endpoint acknowledges the delivery.
	 */
	#eventsOf(rawBody: string): Result<NewsletterEvent[], NewsletterError> {
		let raw: unknown;

		try {
			raw = JSON.parse(rawBody);
		} catch {
			return this.#error("invalid_request", "delivery body is not JSON");
		}

		let parsed = s.parseSafe(DELIVERY_SCHEMA, raw);
		if (!parsed.success) return this.#error("invalid_request", "unreadable Kit delivery body");

		let rawEvents = (raw as { events: unknown[] }).events;
		let events: NewsletterEvent[] = [];

		for (let [index, event] of parsed.value.events.entries()) {
			let record = event.data?.subscriber ?? null;
			if (record === null) continue;

			events.push({
				...eventPayloadOf(event.type),
				id: event.id,
				occurredAt: event.created ? new Date(event.created) : null,
				subscriberId: String(record.id),
				subscriber: toSubscriber(record),
				raw: rawEvents[index],
			});
		}

		return success(events);
	}
}
