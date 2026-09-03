/**
 * A billing provider backed by Stripe's REST API, covering customers, the
 * catalog, hosted checkout and portal, subscription reads, the entitlement
 * snapshot, and Stripe's own delivery signature. It exists to prove the
 * contract is a shape a second platform fits rather than one platform's API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { Schema } from "remix/data-schema";

import { APIClient } from "@pkg/api-client";
import { failure, isFailure, success } from "@pkg/result";
import * as s from "remix/data-schema";

import type {
	Billing,
	CatalogApi,
	CheckoutApi,
	CreateCheckoutInput,
	CreateCustomerInput,
	CreatePortalInput,
	CustomerApi,
	EntitlementApi,
	ListProductsQuery,
	ListSubscriptionsQuery,
	OrderApi,
	PortalApi,
	SubscriptionApi,
	UpdateCustomerInput,
	WebhookApi,
	WebhookReference,
} from "../../core/contract";
import type { BillingErrorCode } from "../../core/errors";
import type { Secret } from "../../core/secret";
import type {
	BillingEvent,
	BillingEventPayload,
	Checkout,
	Customer,
	CustomerRef,
	EntitlementState,
	EntitlementSubscription,
	Page,
	Product,
	Subscription,
} from "../../core/types";

import { BillingError } from "../../core/errors";
import { secretReader, verificationSecret } from "../../core/secret";
import { DEFAULT_PAGE_SIZE } from "../../core/types";

import type { FormFields, FormValue, SlugResolver } from "./map";
import type { StripeCheckoutSession, StripePrice, StripeSubscription } from "./schemas";

import {
	ENTITLED_STATUSES,
	FORM_MEDIA_TYPE,
	STRIPE_STATUSES_FOR,
	errorFrom,
	formEncode,
	idOf,
	toCheckout,
	toCustomer,
	toEntitlementSubscription,
	toPortalSession,
	toProduct,
	toSubscription,
} from "./map";
import {
	ACTIVE_ENTITLEMENT_SCHEMA,
	CHECKOUT_SESSION_SCHEMA,
	CUSTOMER_SCHEMA,
	EVENT_REFERENCE_SCHEMA,
	EVENT_SCHEMA,
	PORTAL_SESSION_SCHEMA,
	PRICE_SCHEMA,
	PRODUCT_FEATURE_SCHEMA,
	PRODUCT_SCHEMA,
	STRIPE_ERROR_SCHEMA,
	SUBSCRIPTION_SCHEMA,
	listOf,
} from "./schemas";
import { SIGNATURE_HEADER, verifyStripeSignature } from "./signature";

/** Origin and version prefix every request is resolved against. */
const DEFAULT_BASE_URL = new URL("https://api.stripe.com/v1/");

/**
 * API version every request pins, so an endpoint's shape changes when this
 * provider is updated rather than when Stripe promotes a new default.
 */
const STRIPE_VERSION = "2025-03-31.basil";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "stripe";

/** Metadata key our own customer identifier is stored under. */
const DEFAULT_EXTERNAL_ID_KEY = "external_id";

/** Metadata key a checkout session records our own name for what it sells. */
const PRODUCT_SLUG_KEY = "billing_product_slug";

/** Largest page Stripe serves, asked for where a whole collection is wanted. */
const MAX_PAGE_SIZE = 100;

/** Quantity a checkout line charges for when the caller names none. */
const DEFAULT_QUANTITY = 1;

/** Prefix that tells a customer-facing promotion code from a coupon id. */
const PROMOTION_CODE_PREFIX = "promo_";

/** Placeholder Stripe replaces with the session id on the return URL. */
const SESSION_ID_TEMPLATE = "{CHECKOUT_SESSION_ID}";

/** Query parameter the session id is handed back to a return route in. */
const SESSION_ID_PARAM = "session_id";

/** Characters refused inside a search term, since the syntax quotes with them. */
const UNSAFE_SEARCH_CHARACTERS = /['\\]/;

/** Customer events this provider normalizes, keyed by Stripe's own name. */
const CUSTOMER_EVENTS: Readonly<Record<string, "customer.created" | "customer.updated">> = {
	"customer.created": "customer.created",
	"customer.updated": "customer.updated",
};

/** The delivery announcing a customer completed a hosted checkout. */
const CHECKOUT_COMPLETED_EVENT = "checkout.session.completed";

/**
 * Subscription events this provider normalizes. A paused subscription reports
 * as revoked, since collection stopped and access along with it.
 */
const SUBSCRIPTION_EVENTS: Readonly<
	Record<
		string,
		| "subscription.activated"
		| "subscription.updated"
		| "subscription.canceled"
		| "subscription.revoked"
	>
> = {
	"customer.subscription.created": "subscription.activated",
	"customer.subscription.updated": "subscription.updated",
	"customer.subscription.deleted": "subscription.canceled",
	"customer.subscription.paused": "subscription.revoked",
};

/** One product as this provider is configured with it. */
export interface StripeCatalogEntry {
	/** The Stripe product our slug names. */
	product: string;
	/** The price a checkout charges, named because a product may hold several. */
	price: string;
}

/** How a {@link StripeBilling} instance is configured. */
export interface StripeBillingOptions {
	/**
	 * Secret API key every request is authenticated with, or a function
	 * resolving it. The function form is resolved once and remembered, so a key
	 * read from a secret store costs one await for the life of the instance.
	 */
	secretKey: Secret;

	/** @default "stripe" */
	connection?: string;

	/** Stripe products and prices, keyed by the slugs call sites address them by. */
	catalog: Record<string, StripeCatalogEntry>;

	/** Stripe meter ids, keyed by our own meter slugs. */
	meters?: Record<string, string>;

	/**
	 * Endpoint signing secret, or a function resolving it; verification fails
	 * closed without it. The function form is resolved once and remembered, so a
	 * secret read from a store costs one await for the life of the instance.
	 */
	webhookSecret?: Secret;

	/** Portal configuration a session is opened against. */
	portalConfiguration?: string;

	/** @default "external_id" */
	externalIdKey?: string;

	/** @default https://api.stripe.com/v1/ */
	baseURL?: URL;
}

/** What one request to Stripe states about itself. */
interface SendOptions<Output> {
	method: "GET" | "POST" | "DELETE";
	/** Path under the version prefix, without a leading slash. */
	path: string;
	/** Schema the answer is parsed with before any mapping runs. */
	schema: Schema<unknown, Output>;
	query?: FormFields;
	form?: FormFields;
	/** Key that makes a repeated mutation take effect once. */
	idempotencyKey?: string;
}

/** Reads a body as JSON, reporting `null` for anything unreadable. */
function readJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

/** Joins validation issues into one line a log can carry. */
function describeIssues(issues: ReadonlyArray<{ message: string }>): string {
	return issues.map((issue) => issue.message).join("; ");
}

/**
 * Appends the placeholder Stripe fills the session id into, so a return route
 * can read which session the customer came back from.
 *
 * @param returnTo - Where the customer is sent when the hosted page is done.
 */
function returnUrlWith(returnTo: string): string {
	let separator = returnTo.includes("?") ? "&" : "?";
	return `${returnTo}${separator}${SESSION_ID_PARAM}=${SESSION_ID_TEMPLATE}`;
}

/** States a discount as whichever of Stripe's two forms its id names. */
function discountField(discount: string): FormValue {
	if (discount.startsWith(PROMOTION_CODE_PREFIX)) return { promotion_code: discount };
	return { coupon: discount };
}

/** Puts the configured price first, so a catalog read reports it as the price. */
function priceFirst(prices: readonly StripePrice[], priceId: string): StripePrice[] {
	let configured = prices.filter((price) => price.id === priceId);
	let rest = prices.filter((price) => price.id !== priceId);
	return [...configured, ...rest];
}

/**
 * Stripe as a billing provider.
 *
 * @example
 * let billing = new StripeBilling({
 * 	secretKey: env.STRIPE_SECRET_KEY,
 * 	catalog: { pro: { product: "prod_1", price: "price_1" } },
 * });
 */
export class StripeBilling extends APIClient implements Billing {
	readonly connection: string;

	readonly customers: CustomerApi;

	readonly catalog: CatalogApi;

	readonly checkouts: CheckoutApi;

	readonly portal: PortalApi;

	readonly subscriptions: SubscriptionApi;

	readonly entitlements: EntitlementApi;

	readonly orders: OrderApi;

	readonly webhooks: WebhookApi;

	/** The configured HTTP client, for the endpoints the contract does not model. */
	readonly native: unknown;

	#secretKey: () => Promise<string>;

	#webhookSecret: () => Promise<string>;

	#externalIdKey: string;

	#portalConfiguration: string | undefined;

	#catalog: Map<string, StripeCatalogEntry>;

	#slugByPrice = new Map<string, string>();

	#slugByProduct = new Map<string, string>();

	#slugByMeter = new Map<string, string>();

	#resolver: SlugResolver;

	/**
	 * Creates the provider and indexes its catalog both ways, so a call site
	 * names a slug and a read of an id answers with one.
	 *
	 * @param options - Credentials, the configured catalog, and the signing secret.
	 */
	constructor(options: StripeBillingOptions) {
		super(options.baseURL ?? DEFAULT_BASE_URL);

		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#secretKey = secretReader(options.secretKey);
		this.#webhookSecret = secretReader(options.webhookSecret ?? "");
		this.#externalIdKey = options.externalIdKey ?? DEFAULT_EXTERNAL_ID_KEY;
		this.#portalConfiguration = options.portalConfiguration;
		this.#catalog = new Map(Object.entries(options.catalog));

		for (let [slug, entry] of this.#catalog) {
			this.#slugByPrice.set(entry.price, slug);
			this.#slugByProduct.set(entry.product, slug);
		}

		for (let [slug, meter] of Object.entries(options.meters ?? {})) {
			this.#slugByMeter.set(meter, slug);
		}

		this.#resolver = {
			slugForPrice: (priceId) => this.#slugByPrice.get(priceId) ?? null,
			slugForProduct: (productId) => this.#slugByProduct.get(productId) ?? null,
			slugForMeter: (meterId) => this.#slugByMeter.get(meterId) ?? null,
		};

		this.customers = this.#buildCustomerApi();
		this.catalog = this.#buildCatalogApi();
		this.checkouts = this.#buildCheckoutApi();
		this.portal = this.#buildPortalApi();
		this.subscriptions = this.#buildSubscriptionApi();
		this.entitlements = this.#buildEntitlementApi();
		this.orders = this.#buildOrderApi();
		this.webhooks = this.#buildWebhookApi();

		this.native = this;
	}

	/**
	 * Authenticates every request and pins the API version, so no call site can
	 * reach Stripe under a different version than the mappers were written for.
	 *
	 * @param request - Request about to be sent.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("authorization", `Bearer ${await this.#secretKey()}`);
		request.headers.set("stripe-version", STRIPE_VERSION);
		request.headers.set("accept", "application/json");
		return request;
	}

	#fail(
		code: BillingErrorCode,
		message: string,
		options?: { cause?: unknown; providerCode?: string | null },
	): Result<never, BillingError> {
		return failure(
			new BillingError(message, {
				code,
				connection: this.connection,
				cause: options?.cause,
				providerCode: options?.providerCode,
			}),
		);
	}

	#unimplemented(operation: string): Result<never, BillingError> {
		return this.#fail("not_implemented", `${operation} is not implemented for this connection`);
	}

	async #send<Output>(options: SendOptions<Output>): Promise<Result<Output, BillingError>> {
		try {
			await this.#secretKey();
		} catch (error) {
			return this.#fail("unauthenticated", "the Stripe secret key could not be resolved", {
				cause: error,
			});
		}

		let query = options.query === undefined ? "" : `?${formEncode(options.query).toString()}`;
		let headers = new Headers();
		let init: RequestInit = { method: options.method };

		if (options.form !== undefined) {
			init.body = formEncode(options.form);
			headers.set("content-type", FORM_MEDIA_TYPE);
		}

		if (options.idempotencyKey !== undefined) {
			headers.set("idempotency-key", options.idempotencyKey);
		}

		init.headers = headers;

		let response: Response;
		let text: string;

		try {
			response = await this.fetch(`${options.path}${query}`, init);
			text = await response.text();
		} catch (error) {
			return this.#fail("unknown", `Stripe did not answer ${options.path}`, { cause: error });
		}

		let payload = readJson(text);

		if (!response.ok) {
			let reported = s.parseSafe(STRIPE_ERROR_SCHEMA, payload);
			return failure(
				errorFrom(response, reported.success ? reported.value : null, this.connection),
			);
		}

		let parsed = s.parseSafe(options.schema, payload);
		if (!parsed.success) {
			return this.#fail(
				"invalid_response",
				`Stripe answered ${options.path} in an unreadable shape: ${describeIssues(parsed.issues)}`,
			);
		}

		return success(parsed.value);
	}

	/**
	 * Reads the customer holding one of our own identifiers. Stripe has no field
	 * for it, so the identifier is searched for in the metadata key it is stored
	 * under, and the search index lags a write by up to a minute.
	 *
	 * @param externalId - Our own identifier for the buyer.
	 */
	async #findByExternalId(externalId: string): Promise<Result<Customer, BillingError>> {
		if (UNSAFE_SEARCH_CHARACTERS.test(externalId)) {
			return this.#fail("invalid_request", "an external id may hold no quote or backslash");
		}

		let found = await this.#send({
			method: "GET",
			path: "customers/search",
			schema: listOf(CUSTOMER_SCHEMA),
			query: { query: `metadata['${this.#externalIdKey}']:'${externalId}'`, limit: 1 },
		});

		if (isFailure(found)) return found;

		let payload = found.data.data.at(0);
		if (payload === undefined) {
			return this.#fail("not_found", `no customer holds the external id ${externalId}`);
		}

		return success(toCustomer(payload, this.#externalIdKey));
	}

	async #findCustomer(customer: CustomerRef): Promise<Result<Customer, BillingError>> {
		if (!("id" in customer)) return this.#findByExternalId(customer.externalId);

		let found = await this.#send({
			method: "GET",
			path: `customers/${encodeURIComponent(customer.id)}`,
			schema: CUSTOMER_SCHEMA,
		});

		if (isFailure(found)) return found;

		if (found.data.deleted === true) {
			return this.#fail("not_found", `customer ${customer.id} is deleted`);
		}

		return success(toCustomer(found.data, this.#externalIdKey));
	}

	/**
	 * Names the Stripe customer a reference points at, reading the record only
	 * when the reference carries our own identifier instead of Stripe's.
	 *
	 * @param customer - Which customer, by either identifier.
	 */
	async #resolveCustomerId(customer: CustomerRef): Promise<Result<string, BillingError>> {
		if ("id" in customer) return success(customer.id);

		let found = await this.#findByExternalId(customer.externalId);
		if (isFailure(found)) return found;

		return success(found.data.id);
	}

	/**
	 * Assembles one catalog product from the three objects Stripe splits it
	 * across, requested together so a read costs one round trip's latency.
	 *
	 * @param slug - Our own name for the product.
	 * @param entry - The Stripe product and price the slug is configured with.
	 */
	async #readProduct(
		slug: string,
		entry: StripeCatalogEntry,
	): Promise<Result<Product, BillingError>> {
		let productId = encodeURIComponent(entry.product);

		let [product, prices, features] = await Promise.all([
			this.#send({ method: "GET", path: `products/${productId}`, schema: PRODUCT_SCHEMA }),
			this.#send({
				method: "GET",
				path: "prices",
				schema: listOf(PRICE_SCHEMA),
				query: { product: entry.product, limit: MAX_PAGE_SIZE },
			}),
			this.#send({
				method: "GET",
				path: `products/${productId}/features`,
				schema: listOf(PRODUCT_FEATURE_SCHEMA),
				query: { limit: MAX_PAGE_SIZE },
			}),
		]);

		if (isFailure(product)) return product;
		if (isFailure(prices)) return prices;
		if (isFailure(features)) return features;

		return success(
			toProduct(
				product.data,
				priceFirst(prices.data.data, entry.price),
				features.data.data,
				slug,
				this.#resolver,
			),
		);
	}

	/**
	 * Names what a checkout session sells, preferring the slug the session was
	 * opened with and falling back to the price its line items carry.
	 *
	 * @param payload - The session as Stripe reported it.
	 */
	#slugForSession(payload: StripeCheckoutSession): string | null {
		let recorded = payload.metadata?.[PRODUCT_SLUG_KEY];
		if (recorded !== undefined && this.#catalog.has(recorded)) return recorded;

		let price = payload.line_items?.data.at(0)?.price;
		if (price === null || price === undefined) return null;

		let byPrice = this.#resolver.slugForPrice(price.id);
		if (byPrice !== null) return byPrice;

		let product = price.product;
		return product === undefined ? null : this.#resolver.slugForProduct(idOf(product));
	}

	#mapSubscription(payload: StripeSubscription): Result<Subscription, BillingError> {
		let mapped = toSubscription(payload, this.#resolver);

		if (mapped === null) {
			return this.#fail(
				"invalid_request",
				`subscription ${payload.id} bills a price outside the configured catalog`,
			);
		}

		return success(mapped);
	}

	#pageSize(limit: number | undefined): Result<number, BillingError> {
		let size = limit ?? DEFAULT_PAGE_SIZE;

		if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
			return this.#fail("invalid_request", `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
		}

		return success(size);
	}

	#buildCustomerApi(): CustomerApi {
		return {
			/**
			 * Creates a customer carrying our own identifier in its metadata, after
			 * asking whether one already holds it, since Stripe enforces no
			 * uniqueness of its own on a metadata value.
			 */
			create: async (input: CreateCustomerInput) => {
				let existing = await this.#findByExternalId(input.externalId);

				if (!isFailure(existing)) {
					return this.#fail(
						"conflict",
						`customer ${existing.data.id} already holds the external id ${input.externalId}`,
					);
				}

				if (existing.error.code !== "not_found") return existing;

				let created = await this.#send({
					method: "POST",
					path: "customers",
					schema: CUSTOMER_SCHEMA,
					form: {
						email: input.email,
						name: input.name,
						metadata: { ...input.metadata, [this.#externalIdKey]: input.externalId },
					},
					idempotencyKey: `${this.connection}:customer:${input.externalId}`,
				});

				if (isFailure(created)) return created;

				return success(toCustomer(created.data, this.#externalIdKey));
			},

			/**
			 * Changes the fields named, leaving every metadata key it does not name.
			 * Our own identifier lives in metadata here, so adopting a customer that
			 * carries none is the same write as any other field.
			 */
			update: async (customer: CustomerRef, input: UpdateCustomerInput) => {
				let id = await this.#resolveCustomerId(customer);
				if (isFailure(id)) return id;

				let metadata =
					input.externalId === undefined
						? input.metadata
						: { ...input.metadata, [this.#externalIdKey]: input.externalId };

				let updated = await this.#send({
					method: "POST",
					path: `customers/${encodeURIComponent(id.data)}`,
					schema: CUSTOMER_SCHEMA,
					form: { email: input.email, name: input.name, metadata },
				});

				if (isFailure(updated)) return updated;

				return success(toCustomer(updated.data, this.#externalIdKey));
			},

			/** Reads one customer by either identifier. */
			find: async (customer: CustomerRef) => this.#findCustomer(customer),

			/** Reads the first customer Stripe holds under an address. */
			findByEmail: async (email: string) => {
				let found = await this.#send({
					method: "GET",
					path: "customers",
					schema: listOf(CUSTOMER_SCHEMA),
					query: { email, limit: 1 },
				});

				if (isFailure(found)) return found;

				let payload = found.data.data.at(0);
				if (payload === undefined) {
					return this.#fail("not_found", `no customer holds the email ${email}`);
				}

				return success(toCustomer(payload, this.#externalIdKey));
			},

			/** Enumerating customers is outside what this connection answers. */
			list: async () => this.#unimplemented("customers.list"),
		};
	}

	#buildCatalogApi(): CatalogApi {
		return {
			/** Reads the configured product a slug names. */
			find: async (slug: string) => {
				let entry = this.#catalog.get(slug);

				if (entry === undefined) {
					return this.#fail("not_found", `no product is configured under the slug ${slug}`);
				}

				return this.#readProduct(slug, entry);
			},

			/**
			 * Walks the configured slugs, since they are the index of what this
			 * connection sells, and reads each product's prices and features.
			 */
			list: async (query?: ListProductsQuery) => {
				let size = this.#pageSize(query?.limit);
				if (isFailure(size)) return size;

				let slugs = [...this.#catalog.keys()];
				let start = 0;

				if (query?.cursor !== undefined) {
					let previous = slugs.indexOf(query.cursor);
					if (previous < 0) {
						return this.#fail("invalid_request", `unusable cursor: ${query.cursor}`);
					}
					start = previous + 1;
				}

				let page = slugs.slice(start, start + size.data);
				let items: Product[] = [];

				for (let slug of page) {
					let entry = this.#catalog.get(slug);
					if (entry === undefined) continue;

					let product = await this.#readProduct(slug, entry);
					if (isFailure(product)) return product;
					if (product.data.archived && query?.archived !== true) continue;

					items.push(product.data);
				}

				let consumed = start + page.length;
				let cursor = consumed < slugs.length ? (page.at(-1) ?? null) : null;

				return success<Page<Product>>({ items, cursor });
			},
		};
	}

	#buildCheckoutApi(): CheckoutApi {
		return {
			/**
			 * Opens a session for the configured price. Stripe needs to be told
			 * whether the purchase recurs, so the price is read first and the mode
			 * follows from what it charges.
			 */
			create: async (input: CreateCheckoutInput) => {
				let entry = this.#catalog.get(input.product);

				if (entry === undefined) {
					return this.#fail(
						"not_found",
						`no product is configured under the slug ${input.product}`,
					);
				}

				let price = await this.#send({
					method: "GET",
					path: `prices/${encodeURIComponent(entry.price)}`,
					schema: PRICE_SCHEMA,
				});

				if (isFailure(price)) return price;

				let customerId: string | undefined;

				if (input.customer !== undefined) {
					let resolved = await this.#resolveCustomerId(input.customer);
					if (isFailure(resolved)) return resolved;
					customerId = resolved.data;
				}

				let externalId =
					input.customer !== undefined && "externalId" in input.customer
						? input.customer.externalId
						: undefined;

				if (input.discount !== undefined && input.allowDiscountCodes === true) {
					return this.#fail(
						"unsupported",
						"a Stripe session either applies a discount or collects a code, never both",
					);
				}

				let session = await this.#send({
					method: "POST",
					path: "checkout/sessions",
					schema: CHECKOUT_SESSION_SCHEMA,
					idempotencyKey: input.idempotencyKey,
					form: {
						mode: price.data.type === "recurring" ? "subscription" : "payment",
						line_items: [{ price: entry.price, quantity: input.quantity ?? DEFAULT_QUANTITY }],
						success_url: input.returnTo === undefined ? undefined : returnUrlWith(input.returnTo),
						customer: customerId,
						customer_email: customerId === undefined ? input.email : undefined,
						client_reference_id: externalId,
						metadata: { ...input.metadata, [PRODUCT_SLUG_KEY]: input.product },
						discounts: input.discount === undefined ? undefined : [discountField(input.discount)],
						allow_promotion_codes:
							input.discount === undefined ? input.allowDiscountCodes : undefined,
					},
				});

				if (isFailure(session)) return session;

				return success(toCheckout(session.data, input.product));
			},

			/** Reads one session, with its lines expanded so the slug can be named. */
			find: async (checkout: string) => this.#readCheckout(checkout),

			/** Reads the session a customer has just come back from. */
			finish: async (checkout: string) => this.#readCheckout(checkout),
		};
	}

	async #readCheckout(checkout: string): Promise<Result<Checkout, BillingError>> {
		let session = await this.#send({
			method: "GET",
			path: `checkout/sessions/${encodeURIComponent(checkout)}`,
			schema: CHECKOUT_SESSION_SCHEMA,
			query: { expand: ["line_items"] },
		});

		if (isFailure(session)) return session;

		let slug = this.#slugForSession(session.data);

		if (slug === null) {
			return this.#fail(
				"invalid_request",
				`checkout ${checkout} sells nothing in the configured catalog`,
			);
		}

		return success(toCheckout(session.data, slug));
	}

	#buildPortalApi(): PortalApi {
		return {
			/** Opens a single-use portal session for a customer. */
			create: async (input: CreatePortalInput) => {
				let id = await this.#resolveCustomerId(input.customer);
				if (isFailure(id)) return id;

				let session = await this.#send({
					method: "POST",
					path: "billing_portal/sessions",
					schema: PORTAL_SESSION_SCHEMA,
					form: {
						customer: id.data,
						return_url: input.returnTo,
						configuration: this.#portalConfiguration,
					},
				});

				if (isFailure(session)) return session;

				return success(toPortalSession(session.data));
			},
		};
	}

	#buildSubscriptionApi(): SubscriptionApi {
		return {
			/** Reads one subscription. */
			find: async (subscription: string) => {
				let found = await this.#send({
					method: "GET",
					path: `subscriptions/${encodeURIComponent(subscription)}`,
					schema: SUBSCRIPTION_SCHEMA,
				});

				if (isFailure(found)) return found;

				return this.#mapSubscription(found.data);
			},

			/**
			 * Reads one page. A status of ours that several Stripe statuses share is
			 * narrowed after the read, and the cursor still follows the last record
			 * Stripe returned, so paging stays continuous.
			 */
			list: async (query?: ListSubscriptionsQuery) => {
				let size = this.#pageSize(query?.limit);
				if (isFailure(size)) return size;

				let customerId: string | undefined;

				if (query?.customer !== undefined) {
					let resolved = await this.#resolveCustomerId(query.customer);
					if (isFailure(resolved)) return resolved;
					customerId = resolved.data;
				}

				let priceId: string | undefined;

				if (query?.product !== undefined) {
					let entry = this.#catalog.get(query.product);
					if (entry === undefined) {
						return this.#fail(
							"not_found",
							`no product is configured under the slug ${query.product}`,
						);
					}
					priceId = entry.price;
				}

				let statuses =
					query?.status === undefined
						? null
						: [...new Set(query.status.flatMap((status) => STRIPE_STATUSES_FOR[status]))];

				let narrowLocally = statuses !== null && statuses.length > 1;

				let found = await this.#send({
					method: "GET",
					path: "subscriptions",
					schema: listOf(SUBSCRIPTION_SCHEMA),
					query: {
						customer: customerId,
						price: priceId,
						status: statuses === null ? undefined : narrowLocally ? "all" : statuses.at(0),
						limit: size.data,
						starting_after: query?.cursor,
					},
				});

				if (isFailure(found)) return found;

				let items: Subscription[] = [];

				for (let payload of found.data.data) {
					if (narrowLocally && statuses?.includes(payload.status) !== true) continue;

					let mapped = this.#mapSubscription(payload);
					if (isFailure(mapped)) return mapped;

					items.push(mapped.data);
				}

				let last = found.data.data.at(-1);
				let cursor = found.data.has_more && last !== undefined ? last.id : null;

				return success<Page<Subscription>>({ items, cursor });
			},

			/** Ends a subscription now, or lets the paid period run out first. */
			cancel: async (subscription: string, options?: { atPeriodEnd?: boolean }) => {
				let path = `subscriptions/${encodeURIComponent(subscription)}`;

				let answered =
					options?.atPeriodEnd === true
						? await this.#send({
								method: "POST",
								path,
								schema: SUBSCRIPTION_SCHEMA,
								form: { cancel_at_period_end: true },
							})
						: await this.#send({ method: "DELETE", path, schema: SUBSCRIPTION_SCHEMA });

				if (isFailure(answered)) return answered;

				return this.#mapSubscription(answered.data);
			},
		};
	}

	#buildEntitlementApi(): EntitlementApi {
		return {
			/**
			 * Composes the snapshot from the customer's subscriptions and the
			 * features Stripe reports as active. A subscription to something this
			 * connection does not sell grants nothing, so it is left out.
			 */
			of: async (customer: CustomerRef) => {
				let record = await this.#findCustomer(customer);
				if (isFailure(record)) return record;

				let [subscriptions, entitlements] = await Promise.all([
					this.#send({
						method: "GET",
						path: "subscriptions",
						schema: listOf(SUBSCRIPTION_SCHEMA),
						query: { customer: record.data.id, status: "all", limit: MAX_PAGE_SIZE },
					}),
					this.#send({
						method: "GET",
						path: "entitlements/active_entitlements",
						schema: listOf(ACTIVE_ENTITLEMENT_SCHEMA),
						query: { customer: record.data.id, limit: MAX_PAGE_SIZE },
					}),
				]);

				if (isFailure(subscriptions)) return subscriptions;
				if (isFailure(entitlements)) return entitlements;

				let held: EntitlementSubscription[] = [];
				let products: string[] = [];

				for (let payload of subscriptions.data.data) {
					let mapped = toSubscription(payload, this.#resolver);
					if (mapped === null) continue;
					if (!ENTITLED_STATUSES.has(mapped.status)) continue;

					held.push(toEntitlementSubscription(mapped));

					if (mapped.productSlug !== null && !products.includes(mapped.productSlug)) {
						products.push(mapped.productSlug);
					}
				}

				let features: Record<string, boolean> = {};
				for (let active of entitlements.data.data) features[active.lookup_key] = true;

				return success<EntitlementState>({
					customerId: record.data.id,
					externalId: record.data.externalId,
					products,
					features,
					meters: [],
					subscriptions: held,
					readAt: new Date(),
					providerData: {
						activeEntitlements: entitlements.data.data.map((active) => active.id),
						subscriptions: held.map((entry) => entry.subscriptionId),
					},
				});
			},
		};
	}

	/**
	 * Orders stay unimplemented on purpose: this provider exists to check that the
	 * contract is a shape rather than one platform's API, and order normalization
	 * is the seam least settled, so it is not worth guessing at here.
	 */
	#buildOrderApi(): OrderApi {
		return {
			/** Order reads are outside what this connection answers. */
			find: async () => this.#unimplemented("orders.find"),

			/** Order reads are outside what this connection answers. */
			list: async () => this.#unimplemented("orders.list"),
		};
	}

	#buildWebhookApi(): WebhookApi {
		return {
			/** Answers whether the signature header proves the exact bytes received. */
			verify: async (request: Request, rawBody: string) =>
				verifyStripeSignature({
					header: request.headers.get(SIGNATURE_HEADER),
					rawBody,
					secret: await verificationSecret(this.#webhookSecret),
				}),

			/** Names the delivery, for deduplication, and the object it changed, for routing. */
			reference: (_request: Request, rawBody: string): WebhookReference | null => {
				let parsed = s.parseSafe(EVENT_REFERENCE_SCHEMA, readJson(rawBody));
				if (!parsed.success) return null;

				let object = parsed.value.data?.object?.id;

				return {
					deliveryId: parsed.value.id,
					object: object === undefined ? null : { id: object, type: parsed.value.type },
				};
			},

			/**
			 * Normalizes a delivery, reporting an authentic one this provider does
			 * not model as `unrecognized` so an endpoint acknowledges it instead of
			 * failing the delivery back to Stripe.
			 */
			event: async (
				_request: Request,
				rawBody: string,
			): Promise<Result<BillingEvent, BillingError>> => {
				let raw = readJson(rawBody);
				let parsed = s.parseSafe(EVENT_SCHEMA, raw);

				if (!parsed.success) {
					return this.#fail(
						"invalid_request",
						`unreadable webhook delivery: ${describeIssues(parsed.issues)}`,
					);
				}

				let payload = this.#payloadFor(parsed.value.type, parsed.value.data.object);

				return success({ id: parsed.value.id, raw, ...payload });
			},
		};
	}

	/**
	 * Maps one delivery onto our own event vocabulary. Anything this provider
	 * does not model, and anything whose payload arrives in a shape it cannot
	 * read, reports as `unrecognized` carrying Stripe's own event name.
	 *
	 * @param type - Stripe's own event name.
	 * @param object - The payload the delivery carried.
	 */
	#payloadFor(type: string, object: unknown): BillingEventPayload {
		let unrecognized: BillingEventPayload = { type: "unrecognized", providerType: type };

		let customerEvent = CUSTOMER_EVENTS[type];
		if (customerEvent !== undefined) {
			let parsed = s.parseSafe(CUSTOMER_SCHEMA, object);
			if (!parsed.success) return unrecognized;

			return { type: customerEvent, customer: toCustomer(parsed.value, this.#externalIdKey) };
		}

		if (type === CHECKOUT_COMPLETED_EVENT) {
			let parsed = s.parseSafe(CHECKOUT_SESSION_SCHEMA, object);
			if (!parsed.success) return unrecognized;

			let slug = this.#slugForSession(parsed.value);
			if (slug === null) return unrecognized;

			return { type: "checkout.completed", checkout: toCheckout(parsed.value, slug) };
		}

		let subscriptionEvent = SUBSCRIPTION_EVENTS[type];
		if (subscriptionEvent !== undefined) {
			let parsed = s.parseSafe(SUBSCRIPTION_SCHEMA, object);
			if (!parsed.success) return unrecognized;

			let mapped = toSubscription(parsed.value, this.#resolver);
			if (mapped === null) return unrecognized;

			return { type: subscriptionEvent, subscription: mapped };
		}

		return unrecognized;
	}
}
