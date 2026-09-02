/**
 * The Polar provider: one class over Polar's REST API, pinned to an API version
 * and authenticated once, that answers the whole contract in our own models.
 * Both of Polar's list envelopes and both of its failure bodies arrive normalized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { APIClient } from "@pkg/api-client";
import { failure, isFailure, success } from "@pkg/result";
import * as Webhooks from "@pkg/webhooks";
import * as s from "remix/data-schema";

import type {
	Billing,
	CatalogApi,
	CheckoutApi,
	CreateCheckoutInput,
	CreateCustomerInput,
	CreatePortalInput,
	CustomerApi,
	DiscountApi,
	EntitlementApi,
	ListCustomersQuery,
	ListDiscountsQuery,
	ListOrdersQuery,
	ListProductsQuery,
	ListSubscriptionsQuery,
	ListUsageQuery,
	MeterApi,
	MeterQuantityQuery,
	OrderApi,
	PortalApi,
	SubscriptionApi,
	UpdateCustomerInput,
	UsageApi,
	WebhookApi,
	WebhookReference,
} from "../../core/contract";
import type { BillingErrorCode } from "../../core/errors";
import type {
	BillingEvent,
	BillingEventPayload,
	CustomerRef,
	Page,
	SubscriptionStatus,
	UsageEvent,
} from "../../core/types";

import { BillingError } from "../../core/errors";

import type { PolarErrorOptions } from "./errors";
import type { PolarMapping } from "./map";

import { toBillingError, toMappingError, toTransportError } from "./errors";
import {
	mapCheckout,
	mapCustomer,
	mapDiscount,
	mapEntitlementState,
	mapMeterQuantity,
	mapOrder,
	mapPortalSession,
	mapProduct,
	mapSubscription,
	mapUsageRecord,
} from "./map";
import { EVENTS_INGEST_SCHEMA, PAGE_ENVELOPE_SCHEMA, WEBHOOK_ENVELOPE_SCHEMA } from "./schemas";

/** Polar's live API, which is where money moves. */
const PRODUCTION_ORIGIN = "https://api.polar.sh";

/** Polar's sandbox, a separate instance sharing no token and no identifier with production. */
const SANDBOX_ORIGIN = "https://sandbox-api.polar.sh";

/**
 * The dated API surface every request asks for. Polar resolves an omitted
 * header to whatever its current default is, so the version is stated here and
 * moves when this provider is updated to match.
 */
const API_VERSION = "2026-04";

/** Header Polar reads the requested API version from. */
const VERSION_HEADER = "polar-version";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "polar";

/** Content type on every request carrying a body. */
const JSON_HEADERS: Readonly<Record<string, string>> = { "content-type": "application/json" };

/** Largest page Polar serves, which a larger request is clamped to. */
const MAX_PAGE_SIZE = 100;

/**
 * Usage events sent per request. Polar publishes no batch ceiling, so this one
 * keeps a request under any body-size or gateway limit while the deduplication
 * key on every event makes a resend of an oversized array free.
 */
const INGEST_CHUNK_SIZE = 100;

/** Polar's first page, since its lists are windowed by a 1-based page number. */
const FIRST_PAGE = 1;

/** Accepted clock skew on an inbound delivery, applied in both directions. */
const WEBHOOK_TOLERANCE = "5 minutes";

/** Header Polar's signing scheme carries the per-delivery identifier in. */
const DELIVERY_ID_HEADER = "webhook-id";

/** Quantity a checkout buys, since a Polar checkout sells one unit of its product. */
const SINGLE_UNIT = 1;

/** The states Polar counts as entitling, which is the only status narrowing its lists offer. */
const SUBSCRIPTION_ENTITLING_STATUSES: readonly string[] = ["active", "trialing"];

/**
 * Narrows a status filter to the one boolean Polar accepts. A filter spanning
 * both sides of that boolean cannot be expressed, so it is left to the
 * client-side pass that runs over every mapped page.
 */
function activeFilter(wanted: readonly SubscriptionStatus[] | undefined): boolean | undefined {
	if (wanted === undefined || wanted.length === 0) return undefined;

	let entitling = wanted.filter((status) => SUBSCRIPTION_ENTITLING_STATUSES.includes(status));

	if (entitling.length === wanted.length) return true;
	if (entitling.length === 0) return false;

	return undefined;
}

/** An event name this provider maps a delivery onto, which is every name but the open arm. */
type MappedEventType = Exclude<BillingEventPayload["type"], "unrecognized">;

/**
 * Our event name for each delivery Polar sends. Everything absent arrives as
 * `unrecognized`, which is what makes an event type Polar adds a no-op here
 * rather than a failing endpoint Polar disables.
 */
const EVENT_TYPES: Readonly<Record<string, MappedEventType>> = {
	"customer.created": "customer.created",
	"customer.updated": "customer.updated",
	"customer.state_changed": "customer.updated",
	"checkout.updated": "checkout.completed",
	"order.paid": "order.paid",
	"order.refunded": "order.refunded",
	"subscription.active": "subscription.activated",
	"subscription.created": "subscription.updated",
	"subscription.updated": "subscription.updated",
	"subscription.cycled": "subscription.updated",
	"subscription.uncanceled": "subscription.updated",
	"subscription.past_due": "subscription.updated",
	"subscription.paused": "subscription.updated",
	"subscription.resumed": "subscription.updated",
	"subscription.canceled": "subscription.canceled",
	"subscription.revoked": "subscription.revoked",
};

/** Checkout states in which a session has produced what it was opened for. */
const CHECKOUT_COMPLETED_STATUSES: readonly string[] = ["confirmed", "succeeded"];

/** The one field a delivery is identified and routed by. */
const IDENTIFIED_SCHEMA = s.object({ id: s.string() });

/** The state a checkout delivery reports, which says whether the session completed. */
const CHECKOUT_STATE_SCHEMA = s.object({ status: s.string() });

/** One query parameter, which repeats to express a filter over several values. */
type QueryEntry = readonly [string, string | number | boolean | undefined];

/** How a Polar connection is configured. */
export interface PolarBillingOptions {
	/**
	 * Organization access token, or a function resolving one. The function form
	 * is resolved once and remembered, so a token read from a secret store costs
	 * one await for the life of the instance.
	 */
	accessToken: string | (() => string | Promise<string>);

	/** Signing secret for this endpoint's deliveries, exactly as Polar issued it. */
	webhookSecret: string;

	/** Polar product id for each of our own slugs, which is how a call site names a product. */
	products: Record<string, string>;

	/** Polar meter id for each of our own meter slugs. */
	meters?: Record<string, string>;

	/** Polar benefit id for each of our own feature slugs, which is what a granted benefit unlocks. */
	features?: Record<string, string>;

	/**
	 * Code stored beside every Polar id this instance issues, naming the
	 * credential set rather than the vendor.
	 *
	 * @default "polar"
	 */
	connection?: string;

	/** Whether to bill against Polar's sandbox, which shares nothing with production. */
	sandbox?: boolean;
}

/** Reverses a slug-to-id configuration into the id-to-slug lookup a mapping reads. */
function byId(configured: Record<string, string>): ReadonlyMap<string, string> {
	return new Map(Object.entries(configured).map(([slug, id]) => [id, slug]));
}

/**
 * Re-encodes a Polar signing secret as key material. Polar's senders
 * base64-encode the secret's UTF-8 bytes before signing, so the same
 * encoding happens here, byte by byte, and a secret holding non-Latin-1 text
 * encodes too.
 */
function toSigningSecret(secret: string): string {
	let binary = "";
	for (let byte of new TextEncoder().encode(secret)) binary += String.fromCharCode(byte);

	return btoa(binary);
}

/**
 * Rebuilds a delivery as a request whose body is unread, since a stream reads
 * once and verification covers the exact bytes received. The headers are copied
 * entry by entry, which is the form every interceptor in the stack accepts.
 */
function toVerifiableRequest(request: Request, rawBody: string): Request {
	let headers = new Headers();
	for (let [name, value] of request.headers.entries()) headers.set(name, value);

	return new Request(request.url, { method: "POST", headers, body: rawBody });
}

/** Splits events into the batches one request each carries. */
function chunked(events: readonly UsageEvent[], size: number): UsageEvent[][] {
	let batches: UsageEvent[][] = [];
	for (let index = 0; index < events.length; index += size) {
		batches.push(events.slice(index, index + size));
	}

	return batches;
}

/**
 * Polar's deduplication key for a usage event: the caller's own key when it
 * supplied one, and otherwise the meter, customer, and moment it names, so a
 * resent batch is counted once.
 */
function usageKey(event: UsageEvent): string | undefined {
	if (event.externalId !== undefined) return event.externalId;
	if (event.timestamp === undefined) return undefined;

	let customer = "id" in event.customer ? event.customer.id : event.customer.externalId;

	return `${event.name}:${customer}:${event.timestamp.toISOString()}`;
}

/**
 * A configured Polar organization, answering every operation the contract names
 * over Polar's REST API. It is constructed at module scope and read from a
 * request context or imported by a job, so both bill the same way.
 *
 * @example
 * export let billing = new PolarBilling({
 * 	accessToken: () => env.POLAR_ACCESS_TOKEN.get(),
 * 	webhookSecret: env.POLAR_WEBHOOK_SECRET,
 * 	products: { pro: "019..." },
 * });
 */
export class PolarBilling extends APIClient implements Billing {
	readonly connection: string;

	/** Customer records, addressed by our own subject id as readily as by Polar's. */
	readonly customers: CustomerApi;

	/** The configured products, read-only and addressed by our own slugs. */
	readonly catalog: CatalogApi;

	/** Hosted checkout sessions, which is how every purchase is made. */
	readonly checkouts: CheckoutApi;

	/** The hosted portal, where plan changes and cancellations happen. */
	readonly portal: PortalApi;

	/** Subscription reads; a subscription comes into existence through a checkout. */
	readonly subscriptions: SubscriptionApi;

	/** The one read an app syncs its own tables from. */
	readonly entitlements: EntitlementApi;

	/** Paid-order reads. */
	readonly orders: OrderApi;

	/** Discount reads, by id or by the code a customer types. */
	readonly discounts: DiscountApi;

	/** Consumption reporting and its read-back. */
	readonly usage: UsageApi;

	/** The questions a webhook endpoint asks, verification included. */
	readonly webhooks: WebhookApi;

	/** Meter readings, which Polar serves from its own meters. */
	readonly meters: MeterApi;

	/** This client, whose verb methods reach any endpoint the contract omits. */
	readonly native: unknown = this;

	#accessToken: string | (() => string | Promise<string>);

	#resolvedToken: string | undefined;

	#pendingToken: Promise<string> | undefined;

	#signingSecret: string;

	#mapping: PolarMapping;

	#productIds: ReadonlyMap<string, string>;

	#meterIds: ReadonlyMap<string, string>;

	/**
	 * Creates the provider. Nothing is requested here, so an instance at module
	 * scope costs no startup work and a token read is deferred to the first call.
	 *
	 * @param options - Credentials, the configured slugs, and which Polar instance to bill against.
	 */
	constructor(options: PolarBillingOptions) {
		super(new URL(options.sandbox === true ? SANDBOX_ORIGIN : PRODUCTION_ORIGIN));

		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#accessToken = options.accessToken;
		this.#signingSecret = toSigningSecret(options.webhookSecret);

		this.#productIds = new Map(Object.entries(options.products));
		this.#meterIds = new Map(Object.entries(options.meters ?? {}));

		this.#mapping = {
			connection: this.connection,
			products: byId(options.products),
			meters: byId(options.meters ?? {}),
			features: byId(options.features ?? {}),
		};

		this.customers = this.#buildCustomerApi();
		this.catalog = this.#buildCatalogApi();
		this.checkouts = this.#buildCheckoutApi();
		this.portal = this.#buildPortalApi();
		this.subscriptions = this.#buildSubscriptionApi();
		this.entitlements = this.#buildEntitlementApi();
		this.orders = this.#buildOrderApi();
		this.discounts = this.#buildDiscountApi();
		this.usage = this.#buildUsageApi();
		this.webhooks = this.#buildWebhookApi();
		this.meters = this.#buildMeterApi();
	}

	/**
	 * Puts the bearer token and the pinned API version on every request, so no
	 * call site can send one without them.
	 *
	 * @param request - Request about to be sent.
	 * @returns The request to send.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${await this.#token()}`);
		request.headers.set("Accept", "application/json");
		request.headers.set(VERSION_HEADER, API_VERSION);

		return request;
	}

	/**
	 * Resolves the access token once. A rejected resolution is not remembered, so
	 * a secret store that was briefly unavailable is asked again on the next call.
	 */
	async #token(): Promise<string> {
		if (this.#resolvedToken !== undefined) return this.#resolvedToken;

		this.#pendingToken ??= this.#resolveToken().catch((error: unknown) => {
			this.#pendingToken = undefined;
			throw error;
		});

		return await this.#pendingToken;
	}

	async #resolveToken(): Promise<string> {
		let token =
			typeof this.#accessToken === "function" ? await this.#accessToken() : this.#accessToken;

		this.#resolvedToken = token;

		return token;
	}

	/**
	 * Sends one request and reads its body as JSON, reporting every failure as
	 * ours: an unresolvable token as unauthenticated, a lost answer as an unknown
	 * outcome, and a Polar failure through whichever body shape it arrived in.
	 */
	async #json(
		path: string,
		init?: RequestInit,
		options?: PolarErrorOptions,
	): Promise<Result<unknown, BillingError>> {
		try {
			await this.#token();
		} catch (error) {
			return failure(
				new BillingError("the Polar access token could not be resolved", {
					code: "unauthenticated",
					connection: this.connection,
					cause: error,
				}),
			);
		}

		let response: Response;
		try {
			response = await this.fetch(path, init);
		} catch (error) {
			return failure(toTransportError(this.connection, error));
		}

		let body: string;
		try {
			body = await response.text();
		} catch (error) {
			return failure(toTransportError(this.connection, error));
		}

		if (!response.ok) {
			return failure(toBillingError(this.connection, response, body, options));
		}

		try {
			return success(JSON.parse(body) as unknown);
		} catch {
			return failure(
				toMappingError(this.connection, `Polar answered ${path} with unreadable JSON`),
			);
		}
	}

	/** Sends a request carrying a JSON body. */
	async #send(
		path: string,
		method: string,
		body: unknown,
		options?: PolarErrorOptions,
	): Promise<Result<unknown, BillingError>> {
		return await this.#json(
			path,
			{ method, headers: JSON_HEADERS, body: JSON.stringify(body) },
			options,
		);
	}

	/** Builds a query string, dropping what the caller left unset and repeating a filter's keys. */
	#query(entries: readonly QueryEntry[]): string {
		let params = new URLSearchParams();

		for (let [key, value] of entries) {
			if (value === undefined) continue;
			params.append(key, String(value));
		}

		let query = params.toString();

		return query.length > 0 ? `?${query}` : "";
	}

	/** Reads the page a cursor asks for, since Polar windows a list by page number. */
	#pageNumber(cursor: string | undefined): Result<number, BillingError> {
		if (cursor === undefined) return success(FIRST_PAGE);

		let page = Number(cursor);
		if (Number.isSafeInteger(page) && page >= FIRST_PAGE) return success(page);

		return failure(
			new BillingError(`"${cursor}" is not a cursor this provider issued`, {
				code: "invalid_request",
				connection: this.connection,
			}),
		);
	}

	/** Clamps a requested page size to the largest Polar serves. */
	#pageSize(limit: number | undefined): number | undefined {
		if (limit === undefined) return undefined;

		return Math.min(Math.max(limit, FIRST_PAGE), MAX_PAGE_SIZE);
	}

	/**
	 * Normalizes either list envelope into one page: the offset one counts pages
	 * and the cursor one only says whether another exists, and a caller reading
	 * the result cannot tell which arrived.
	 */
	#pageOf<Item>(
		raw: unknown,
		page: number,
		map: (item: unknown) => Result<Item, BillingError>,
	): Result<Page<Item>, BillingError> {
		let parsed = s.parseSafe(PAGE_ENVELOPE_SCHEMA, raw);
		if (!parsed.success) {
			return failure(toMappingError(this.connection, "unmappable Polar list envelope"));
		}

		let items: Item[] = [];
		for (let item of parsed.value.items) {
			let mapped = map(item);
			if (isFailure(mapped)) return mapped;
			items.push(mapped.data);
		}

		let pagination = parsed.value.pagination;
		let hasNext =
			pagination?.has_next_page ??
			(pagination?.max_page === undefined ? false : page < pagination.max_page);

		return success({ items, cursor: hasNext ? String(page + 1) : null });
	}

	/** The page a list with no configured products can only answer with. */
	#emptyPage<Item>(): Result<Page<Item>, BillingError> {
		return success({ items: [], cursor: null });
	}

	/** Addresses a customer by whichever identifier the caller named. */
	#customerPath(customer: CustomerRef, suffix = ""): string {
		if ("id" in customer) return `/v1/customers/${encodeURIComponent(customer.id)}${suffix}`;

		return `/v1/customers/external/${encodeURIComponent(customer.externalId)}${suffix}`;
	}

	/**
	 * Filters a list by customer without resolving one first, since Polar's list
	 * endpoints accept our own identifier as readily as theirs.
	 */
	#customerFilter(customer: CustomerRef | undefined): QueryEntry[] {
		if (customer === undefined) return [];
		if ("id" in customer) return [["customer_id", customer.id]];

		return [["external_customer_id", customer.externalId]];
	}

	/** Translates one of our slugs into the Polar product id it was configured with. */
	#productId(slug: string, code: BillingErrorCode): Result<string, BillingError> {
		let id = this.#productIds.get(slug);
		if (id !== undefined) return success(id);

		return failure(
			new BillingError(`no product named "${slug}" is configured for this connection`, {
				code,
				connection: this.connection,
			}),
		);
	}

	#buildCustomerApi(): CustomerApi {
		return {
			create: async (input: CreateCustomerInput) => {
				let created = await this.#send(
					"/v1/customers/",
					"POST",
					{
						email: input.email,
						external_id: input.externalId,
						name: input.name,
						metadata: input.metadata,
					},
					{ conflictOn: "external_id" },
				);

				if (isFailure(created)) return created;

				return mapCustomer(created.data, this.#mapping);
			},

			update: async (customer: CustomerRef, input: UpdateCustomerInput) => {
				let updated = await this.#send(this.#customerPath(customer), "PATCH", {
					email: input.email,
					name: input.name,
					metadata: input.metadata,
				});

				if (isFailure(updated)) return updated;

				return mapCustomer(updated.data, this.#mapping);
			},

			find: async (customer: CustomerRef) => {
				let found = await this.#json(this.#customerPath(customer));
				if (isFailure(found)) return found;

				return mapCustomer(found.data, this.#mapping);
			},

			findByEmail: async (email: string) => {
				let query = this.#query([
					["email", email],
					["limit", FIRST_PAGE],
				]);

				let found = await this.#json(`/v1/customers/${query}`);
				if (isFailure(found)) return found;

				let page = this.#pageOf(found.data, FIRST_PAGE, (item) => mapCustomer(item, this.#mapping));

				if (isFailure(page)) return page;

				let customer = page.data.items.at(0);
				if (customer !== undefined) return success(customer);

				return failure(
					new BillingError(`no customer holds the address ${email}`, {
						code: "not_found",
						connection: this.connection,
					}),
				);
			},

			list: async (query?: ListCustomersQuery) => {
				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let search = this.#query([
					["email", query?.email],
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/customers/${search}`);
				if (isFailure(listed)) return listed;

				return this.#pageOf(listed.data, page.data, (item) => mapCustomer(item, this.#mapping));
			},
		};
	}

	#buildCatalogApi(): CatalogApi {
		return {
			find: async (slug: string) => {
				let id = this.#productId(slug, "not_found");
				if (isFailure(id)) return id;

				let found = await this.#json(`/v1/products/${encodeURIComponent(id.data)}`);
				if (isFailure(found)) return found;

				return mapProduct(found.data, this.#mapping);
			},

			list: async (query?: ListProductsQuery) => {
				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let configured = [...this.#mapping.products.keys()];
				if (configured.length === 0) return this.#emptyPage();

				let search = this.#query([
					...configured.map((id): QueryEntry => ["id", id]),
					["is_archived", query?.archived === true ? undefined : false],
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/products/${search}`);
				if (isFailure(listed)) return listed;

				return this.#pageOf(listed.data, page.data, (item) => mapProduct(item, this.#mapping));
			},
		};
	}

	#buildCheckoutApi(): CheckoutApi {
		let find = async (checkout: string) => {
			let found = await this.#json(`/v1/checkouts/${encodeURIComponent(checkout)}`);
			if (isFailure(found)) return found;

			return mapCheckout(found.data, this.#mapping);
		};

		return {
			create: async (input: CreateCheckoutInput) => {
				if (input.quantity !== undefined && input.quantity !== SINGLE_UNIT) {
					return failure(
						new BillingError("a Polar checkout sells one unit of its product", {
							code: "unsupported",
							connection: this.connection,
						}),
					);
				}

				let product = this.#productId(input.product, "invalid_request");
				if (isFailure(product)) return product;

				let customer = input.customer;

				let created = await this.#send("/v1/checkouts/", "POST", {
					products: [product.data],
					customer_id: customer !== undefined && "id" in customer ? customer.id : undefined,
					external_customer_id:
						customer !== undefined && "externalId" in customer ? customer.externalId : undefined,
					customer_email: input.email,
					success_url: input.returnTo,
					discount_id: input.discount,
					metadata: input.metadata,
				});

				if (isFailure(created)) return created;

				return mapCheckout(created.data, this.#mapping);
			},

			find,

			finish: find,
		};
	}

	#buildPortalApi(): PortalApi {
		return {
			create: async (input: CreatePortalInput) => {
				let customer = input.customer;

				let created = await this.#send("/v1/customer-sessions/", "POST", {
					customer_id: "id" in customer ? customer.id : undefined,
					external_customer_id: "externalId" in customer ? customer.externalId : undefined,
					return_url: input.returnTo,
				});

				if (isFailure(created)) return created;

				return mapPortalSession(created.data, this.#mapping);
			},
		};
	}

	#buildSubscriptionApi(): SubscriptionApi {
		return {
			find: async (subscription: string) => {
				let found = await this.#json(`/v1/subscriptions/${encodeURIComponent(subscription)}`);
				if (isFailure(found)) return found;

				return mapSubscription(found.data, this.#mapping);
			},

			list: async (query?: ListSubscriptionsQuery) => {
				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let product: string | undefined;
				if (query?.product !== undefined) {
					let id = this.#productId(query.product, "invalid_request");
					if (isFailure(id)) return id;
					product = id.data;
				}

				let wanted = query?.status;

				let search = this.#query([
					...this.#customerFilter(query?.customer),
					["product_id", product],
					["active", activeFilter(wanted)],
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/subscriptions/${search}`);
				if (isFailure(listed)) return listed;

				let mapped = this.#pageOf(listed.data, page.data, (item) =>
					mapSubscription(item, this.#mapping),
				);

				if (isFailure(mapped) || wanted === undefined) return mapped;

				return success({
					items: mapped.data.items.filter((subscription) => wanted.includes(subscription.status)),
					cursor: mapped.data.cursor,
				});
			},

			cancel: async (subscription: string, options?: { atPeriodEnd?: boolean }) => {
				let path = `/v1/subscriptions/${encodeURIComponent(subscription)}`;

				let answered =
					options?.atPeriodEnd === true
						? await this.#send(path, "PATCH", { cancel_at_period_end: true })
						: await this.#json(path, { method: "DELETE" });

				if (isFailure(answered)) return answered;

				return mapSubscription(answered.data, this.#mapping);
			},
		};
	}

	#buildEntitlementApi(): EntitlementApi {
		return {
			of: async (customer: CustomerRef) => {
				let read = await this.#json(this.#customerPath(customer, "/state"));
				if (isFailure(read)) return read;

				return mapEntitlementState(read.data, this.#mapping);
			},
		};
	}

	#buildOrderApi(): OrderApi {
		return {
			find: async (order: string) => {
				let found = await this.#json(`/v1/orders/${encodeURIComponent(order)}`);
				if (isFailure(found)) return found;

				return mapOrder(found.data, this.#mapping);
			},

			list: async (query?: ListOrdersQuery) => {
				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let product: string | undefined;
				if (query?.product !== undefined) {
					let id = this.#productId(query.product, "invalid_request");
					if (isFailure(id)) return id;
					product = id.data;
				}

				let search = this.#query([
					...this.#customerFilter(query?.customer),
					["product_id", product],
					["subscription_id", query?.subscription],
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/orders/${search}`);
				if (isFailure(listed)) return listed;

				return this.#pageOf(listed.data, page.data, (item) => mapOrder(item, this.#mapping));
			},
		};
	}

	#buildDiscountApi(): DiscountApi {
		return {
			find: async (discount: string) => {
				let found = await this.#json(`/v1/discounts/${encodeURIComponent(discount)}`);
				if (isFailure(found)) return found;

				return mapDiscount(found.data, this.#mapping);
			},

			findByCode: async (code: string) => {
				let search = this.#query([
					["query", code],
					["limit", MAX_PAGE_SIZE],
				]);

				let listed = await this.#json(`/v1/discounts/${search}`);
				if (isFailure(listed)) return listed;

				let page = this.#pageOf(listed.data, FIRST_PAGE, (item) =>
					mapDiscount(item, this.#mapping),
				);

				if (isFailure(page)) return page;

				let matched = page.data.items.find((discount) => discount.code === code);
				if (matched !== undefined) return success(matched);

				return failure(
					new BillingError(`no discount redeems the code ${code}`, {
						code: "not_found",
						connection: this.connection,
					}),
				);
			},

			list: async (query?: ListDiscountsQuery) => {
				if (query?.product !== undefined) {
					return failure(
						new BillingError("Polar lists discounts across the whole organization", {
							code: "unsupported",
							connection: this.connection,
						}),
					);
				}

				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let search = this.#query([
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/discounts/${search}`);
				if (isFailure(listed)) return listed;

				return this.#pageOf(listed.data, page.data, (item) => mapDiscount(item, this.#mapping));
			},
		};
	}

	#buildUsageApi(): UsageApi {
		return {
			ingest: async (events: readonly UsageEvent[]) => {
				let accepted = 0;

				for (let batch of chunked(events, INGEST_CHUNK_SIZE)) {
					let sent = await this.#send("/v1/events/ingest", "POST", {
						events: batch.map((event) => ({
							name: event.name,
							customer_id: "id" in event.customer ? event.customer.id : undefined,
							external_customer_id:
								"externalId" in event.customer ? event.customer.externalId : undefined,
							external_id: usageKey(event),
							timestamp: event.timestamp?.toISOString(),
							metadata: {
								...event.metadata,
								...(event.cost === undefined
									? {}
									: { _cost: { amount: event.cost.amount, currency: event.cost.currency } }),
							},
						})),
					});

					if (isFailure(sent)) return sent;

					let parsed = s.parseSafe(EVENTS_INGEST_SCHEMA, sent.data);
					if (!parsed.success) {
						return failure(toMappingError(this.connection, "unmappable Polar ingest answer"));
					}

					accepted += parsed.value.inserted;
				}

				return success({ accepted });
			},

			list: async (query?: ListUsageQuery) => {
				let page = this.#pageNumber(query?.cursor);
				if (isFailure(page)) return page;

				let search = this.#query([
					...this.#customerFilter(query?.customer),
					["name", query?.name],
					["start_timestamp", query?.from?.toISOString()],
					["end_timestamp", query?.to?.toISOString()],
					["page", page.data],
					["limit", this.#pageSize(query?.limit)],
				]);

				let listed = await this.#json(`/v1/events/${search}`);
				if (isFailure(listed)) return listed;

				return this.#pageOf(listed.data, page.data, (item) => mapUsageRecord(item, this.#mapping));
			},
		};
	}

	#buildMeterApi(): MeterApi {
		return {
			quantities: async (query: MeterQuantityQuery) => {
				let meter = this.#meterIds.get(query.meter);

				if (meter === undefined) {
					return failure(
						new BillingError(`no meter named "${query.meter}" is configured for this connection`, {
							code: "invalid_request",
							connection: this.connection,
						}),
					);
				}

				let customerId: string | null = null;
				if (query.customer !== undefined) {
					let customer = await this.customers.find(query.customer);
					if (isFailure(customer)) return customer;
					customerId = customer.data.id;
				}

				let search = this.#query([
					["start_timestamp", query.from.toISOString()],
					["end_timestamp", query.to.toISOString()],
					["interval", query.interval],
					["customer_id", customerId ?? undefined],
				]);

				let read = await this.#json(`/v1/meters/${encodeURIComponent(meter)}/quantities${search}`);

				if (isFailure(read)) return read;

				return mapMeterQuantity(
					read.data,
					{ meter: query.meter, customerId, from: query.from, to: query.to },
					this.#mapping,
				);
			},
		};
	}

	#buildWebhookApi(): WebhookApi {
		return {
			verify: async (request: Request, rawBody: string) => {
				let verified = await Webhooks.verify(toVerifiableRequest(request, rawBody), {
					secret: this.#signingSecret,
					tolerance: WEBHOOK_TOLERANCE,
				});

				if (isFailure(verified)) {
					return verified.error instanceof Webhooks.PayloadValidationError;
				}

				return true;
			},

			reference: (request: Request, rawBody: string) => this.#referenceOf(request, rawBody),

			event: async (_request: Request, rawBody: string) => this.#eventOf(rawBody),
		};
	}

	/**
	 * Reads which resource a delivery is about. Polar carries its delivery id in
	 * a header rather than in the body, so the resource the payload names is
	 * what a body alone can be keyed and routed by.
	 */
	/**
	 * Reads the delivery id from the signing header, because the body names only
	 * the object that changed and one object produces many distinct deliveries.
	 */
	#referenceOf(request: Request, rawBody: string): WebhookReference | null {
		let deliveryId = request.headers.get(DELIVERY_ID_HEADER);
		if (deliveryId === null) return null;

		let delivery = this.#deliveryOf(rawBody);
		if (delivery === null) return { deliveryId, object: null };

		return { deliveryId, object: { id: delivery.id, type: delivery.type } };
	}

	/** Keeps the parsed payload beside the exact bytes, so an event carries `raw` untouched. */
	#deliveryOf(rawBody: string): { id: string; type: string; data: unknown; raw: unknown } | null {
		let raw: unknown;

		try {
			raw = JSON.parse(rawBody);
		} catch {
			return null;
		}

		let envelope = s.parseSafe(WEBHOOK_ENVELOPE_SCHEMA, raw);
		if (!envelope.success) return null;

		let identified = s.parseSafe(IDENTIFIED_SCHEMA, envelope.value.data);
		if (!identified.success) return null;

		return {
			id: identified.value.id,
			type: envelope.value.type,
			data: envelope.value.data,
			raw,
		};
	}

	/**
	 * Normalizes a delivery. An authentic body outside this vocabulary — a type
	 * Polar added, or a payload these models cannot express — arrives as
	 * `unrecognized` carrying its payload, so an endpoint keeps acknowledging
	 * deliveries and a handler can still reach what it needs.
	 */
	#eventOf(rawBody: string): Result<BillingEvent, BillingError> {
		let delivery = this.#deliveryOf(rawBody);
		if (delivery === null) {
			return failure(toMappingError(this.connection, "unreadable Polar delivery body"));
		}

		let { id, raw, data, type } = delivery;
		let unrecognized: BillingEvent = { id, raw, type: "unrecognized", providerType: type };
		let mapped = EVENT_TYPES[type];

		if (mapped === undefined) return success(unrecognized);

		if (mapped === "customer.created" || mapped === "customer.updated") {
			let customer = mapCustomer(data, this.#mapping);
			if (isFailure(customer)) return success(unrecognized);

			return success({ id, raw, type: mapped, customer: customer.data });
		}

		if (mapped === "checkout.completed") {
			let state = s.parseSafe(CHECKOUT_STATE_SCHEMA, data);
			if (!state.success || !CHECKOUT_COMPLETED_STATUSES.includes(state.value.status)) {
				return success(unrecognized);
			}

			let checkout = mapCheckout(data, this.#mapping);
			if (isFailure(checkout)) return success(unrecognized);

			return success({ id, raw, type: mapped, checkout: checkout.data });
		}

		if (mapped === "order.paid" || mapped === "order.refunded") {
			let order = mapOrder(data, this.#mapping);
			if (isFailure(order)) return success(unrecognized);

			return success({ id, raw, type: mapped, order: order.data });
		}

		let subscription = mapSubscription(data, this.#mapping);
		if (isFailure(subscription)) return success(unrecognized);

		return success({ id, raw, type: mapped, subscription: subscription.data });
	}
}
