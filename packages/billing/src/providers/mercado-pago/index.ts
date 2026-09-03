/**
 * The Mercado Pago provider: one class over the platform's REST API, answering
 * the contract in our own models. The API prices in a currency's own units, so
 * every amount is converted at the edge and no decimal reaches a call site.
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
	CustomerApi,
	EntitlementApi,
	ListCustomersQuery,
	ListOrdersQuery,
	ListProductsQuery,
	ListSubscriptionsQuery,
	OrderApi,
	SubscriptionApi,
	UpdateCustomerInput,
	WebhookApi,
	WebhookReference,
} from "../../core/contract";
import type { BillingErrorCode } from "../../core/errors";
import type { Secret } from "../../core/secret";
import type {
	BillingEvent,
	Checkout,
	Customer,
	CustomerRef,
	EntitlementState,
	EntitlementSubscription,
	Order,
	Page,
	Product,
	Subscription,
} from "../../core/types";

import { BillingError, reportSkipped } from "../../core/errors";
import { secretReader, verificationSecret } from "../../core/secret";
import { DEFAULT_PAGE_SIZE } from "../../core/types";

import type { MercadoPagoProduct } from "./catalog";
import type { ProviderData } from "./map";
import type { NotificationPayload } from "./schemas";

import { MercadoPagoCatalog } from "./catalog";
import {
	EXTERNAL_REFERENCE_KEY,
	PRODUCT_SLUG_KEY,
	checkoutFromPreapproval,
	checkoutFromPreference,
	customerFrom,
	errorFrom,
	isPaid,
	itemsFor,
	orderFrom,
	productFromConfig,
	productFromPlan,
	subscriptionFrom,
} from "./map";
import { decodeCursor, encodeCursor } from "./money";
import {
	CustomerBody,
	ErrorBody,
	MerchantOrderBody,
	NotificationBody,
	PaymentBody,
	PreapprovalBody,
	PreapprovalPlanBody,
	PreferenceBody,
	SearchBody,
} from "./schemas";
import {
	DATA_ID_PARAM,
	LEGACY_ID_PARAM,
	REQUEST_ID_HEADER,
	SIGNATURE_HEADER,
	parseSignature,
	signedManifest,
	verifyManifest,
} from "./signature";

/** The platform's API, which every path here is resolved against. */
const BASE_URL = "https://api.mercadopago.com";

/** Connection code reported when the caller names none. */
const DEFAULT_CONNECTION = "mercado-pago";

/** Largest page the platform's search endpoints serve, which a larger ask is clamped to. */
const MAX_PAGE_SIZE = 100;

/** Marks a checkout identifier as a one-time hosted sale. */
const PREFERENCE_PREFIX = "pref_";

/** Marks a checkout identifier as a subscription authorization. */
const PREAPPROVAL_PREFIX = "sub_";

/**
 * What the platform accepts as our own reference on a hosted checkout: at most
 * sixty-four characters, and only letters, digits, hyphens, and underscores.
 */
const EXTERNAL_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Delivery families whose resource this provider reads back and maps. A
 * subscription's own recurring charge is announced as a `payment` too, so the
 * authorized-payment family stays unrecognized and no charge is missed.
 */
const RESOLVABLE_TYPES: ReadonlySet<string> = new Set(["payment", "subscription_preapproval"]);

/** Where the buyer is sent back to once a hosted page is done. */
export interface MercadoPagoBackURLs {
	success?: string;
	failure?: string;
	pending?: string;
}

/** How one Mercado Pago account is configured. */
export interface MercadoPagoBillingOptions {
	/**
	 * The account's access token, or a function resolving it. A function is
	 * called once, on the first call that reaches the API, and a rejection is not
	 * memoized, so one failed read leaves the instance able to bill later.
	 */
	accessToken: Secret;

	/**
	 * The credential set this instance bills against, stored beside every
	 * identifier it hands back.
	 * @default "mercado-pago"
	 */
	connection?: string;

	/**
	 * What each of our slugs sells. A one-time sale is priced here because the
	 * platform stores no product for it; a recurring sale names a stored plan.
	 */
	products?: Readonly<Record<string, MercadoPagoProduct>>;

	/**
	 * The application's webhook signing secret, from the platform's dashboard,
	 * or a function resolving it. A function is called once, on the first
	 * delivery verified, and a rejection is not memoized, so one failed read
	 * leaves the endpoint able to verify later. Deliveries fail closed while the
	 * secret is unset.
	 */
	webhookSecret?: Secret;

	/** Where the platform posts deliveries for the checkouts this instance opens. */
	notificationURL?: string;

	/** Where a hosted page returns a buyer to, when a call names no destination. */
	backURLs?: MercadoPagoBackURLs;
}

/** A payload alongside the exact bytes it was parsed from. */
interface Parsed<Output> {
	value: Output;
	raw: ProviderData;
}

/** What one request to the API is made with. */
interface CallInit {
	method?: string;
	body?: unknown;
	/** Value for the platform's idempotency header, derived from our own identifiers. */
	idempotencyKey?: string;
}

/** A stored payer alongside the raw payload a model keeps. */
type ParsedCustomer = Parsed<s.InferOutput<typeof CustomerBody>>;

/**
 * One configured Mercado Pago account.
 *
 * @example
 * export const mercadoPago = new MercadoPagoBilling({
 * 	accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
 * 	products: { pro: { kind: "recurring", plan: "2c93808..." } },
 * });
 */
export class MercadoPagoBilling extends APIClient implements Billing {
	readonly connection: string;

	readonly customers: CustomerApi;

	readonly catalog: CatalogApi;

	readonly checkouts: CheckoutApi;

	readonly subscriptions: SubscriptionApi;

	readonly entitlements: EntitlementApi;

	readonly orders: OrderApi;

	readonly webhooks: WebhookApi;

	/** This client, for the endpoints the contract does not model. */
	readonly native: unknown;

	readonly #accessToken: () => Promise<string>;

	readonly #catalog: MercadoPagoCatalog;

	readonly #webhookSecret: () => Promise<string>;

	readonly #notificationURL: string | null;

	readonly #backURLs: MercadoPagoBackURLs;

	/**
	 * Creates the provider. Nothing here reaches the network, so an instance can
	 * be built at module scope and imported by a job as easily as by a route.
	 *
	 * @param options - Credentials, the configured catalog, and hosted-page destinations.
	 */
	constructor(options: MercadoPagoBillingOptions) {
		super(new URL(BASE_URL));

		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#accessToken = secretReader(options.accessToken);
		this.#catalog = new MercadoPagoCatalog(options.products ?? {});
		this.#webhookSecret = secretReader(options.webhookSecret ?? "");
		this.#notificationURL = options.notificationURL ?? null;
		this.#backURLs = options.backURLs ?? {};

		this.customers = this.#buildCustomerApi();
		this.catalog = this.#buildCatalogApi();
		this.checkouts = this.#buildCheckoutApi();
		this.subscriptions = this.#buildSubscriptionApi();
		this.entitlements = this.#buildEntitlementApi();
		this.orders = this.#buildOrderApi();
		this.webhooks = this.#buildWebhookApi();

		this.native = this;
	}

	/**
	 * Attaches the account's credential to every request from one place.
	 *
	 * @param request - Request about to be sent.
	 * @returns The request to send.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${await this.#accessToken()}`);
		request.headers.set("Accept", "application/json");

		return request;
	}

	#fail(
		code: BillingErrorCode,
		message: string,
		providerCode?: string,
	): Result<never, BillingError> {
		return failure(new BillingError(message, { code, connection: this.connection, providerCode }));
	}

	#unsupported(what: string): Result<never, BillingError> {
		return this.#fail("unsupported", `Mercado Pago has no ${what}`);
	}

	/**
	 * Reads the credential before a call is sent, so an unreadable one is
	 * reported as a failed operation rather than as an unauthenticated request.
	 */
	async #authorize(): Promise<Result<string, BillingError>> {
		try {
			return success(await this.#accessToken());
		} catch {
			return this.#fail("unauthenticated", "the access token could not be resolved");
		}
	}

	/**
	 * Renders the request options one call is sent with. The idempotency header
	 * is documented on the platform's payment and refund endpoints; a hosted
	 * checkout is instead recognized by the reference in its body.
	 *
	 * UNVERIFIED: whether a hosted-checkout create honours `X-Idempotency-Key`.
	 */
	#init(init: CallInit | undefined): RequestInit {
		let headers = new Headers();
		if (init?.body !== undefined) headers.set("Content-Type", "application/json");
		if (init?.idempotencyKey !== undefined) {
			headers.set("X-Idempotency-Key", init.idempotencyKey);
		}

		return {
			method: init?.method ?? "GET",
			headers,
			body: init?.body === undefined ? undefined : JSON.stringify(init.body),
		};
	}

	/**
	 * Sends one request and validates what came back, so no mapper ever sees an
	 * unchecked payload. A transport failure and a `5xx` both resolve to
	 * `unknown`, because a write may have taken effect before the answer stopped.
	 */
	async #call<Output>(
		path: string,
		schema: Schema<unknown, Output>,
		init?: CallInit,
	): Promise<Result<Parsed<Output>, BillingError>> {
		let authorized = await this.#authorize();
		if (isFailure(authorized)) return authorized;

		let response: Response;
		try {
			response = await this.fetch(path, this.#init(init));
		} catch {
			return this.#fail("unknown", `the request to ${path} did not complete`);
		}

		let body: unknown = null;
		try {
			body = await response.json();
		} catch {
			body = null;
		}

		if (!response.ok) {
			let reported = s.parseSafe(ErrorBody, body);

			return failure(
				errorFrom(response, reported.success ? reported.value : null, this.connection),
			);
		}

		let parsed = s.parseSafe(schema, body);
		if (!parsed.success) {
			return this.#fail("invalid_response", `${path} answered a payload this provider cannot read`);
		}

		return success({ value: parsed.value, raw: (body ?? {}) as ProviderData });
	}

	/** Renders the query a request carries, dropping the parameters a caller left out. */
	static #query(params: Record<string, string | number | undefined>): string {
		let search = new URLSearchParams();

		for (let [key, value] of Object.entries(params)) {
			if (value !== undefined) search.set(key, String(value));
		}

		let rendered = search.toString();

		return rendered.length > 0 ? `?${rendered}` : "";
	}

	/** Reads the page size a list asked for, within what one request may fetch. */
	#pageSize(limit: number | undefined): Result<number, BillingError> {
		let size = limit ?? DEFAULT_PAGE_SIZE;
		if (!Number.isInteger(size) || size < 1) {
			return this.#fail("invalid_request", "limit must be a positive integer");
		}

		return success(Math.min(size, MAX_PAGE_SIZE));
	}

	/**
	 * Reads one page of a search endpoint, mapping each result on its own so a
	 * model keeps the exact payload it came from. The platform pages by offset,
	 * and the offset is carried in the returned cursor so a caller never sees it.
	 */
	async #search<Item>(
		path: string,
		params: Record<string, string | number | undefined>,
		query: { limit?: number; cursor?: string } | undefined,
		map: (payload: ProviderData) => Result<Item | null, BillingError>,
	): Promise<Result<Page<Item>, BillingError>> {
		let offset = decodeCursor(query?.cursor);
		if (offset === null) return this.#fail("invalid_request", "unusable cursor");

		let limit = this.#pageSize(query?.limit);
		if (isFailure(limit)) return limit;

		let response = await this.#call(
			`${path}${MercadoPagoBilling.#query({ ...params, offset, limit: limit.data })}`,
			SearchBody,
		);
		if (isFailure(response)) return response;

		let items: Item[] = [];
		for (let result of response.data.value.results) {
			let mapped = map(result);
			if (isFailure(mapped)) return mapped;
			if (mapped.data !== null) items.push(mapped.data);
		}

		let read = response.data.value.results.length;
		let next = offset + read;
		let total = response.data.value.paging?.total;
		let more = total === null || total === undefined ? read === limit.data : next < total;

		return success({ items, cursor: more && read > 0 ? encodeCursor(next) : null });
	}

	/** Parses one result of a search envelope, keeping the payload beside it. */
	#parse<Output>(
		schema: Schema<unknown, Output>,
		payload: ProviderData,
	): Result<Parsed<Output>, BillingError> {
		let parsed = s.parseSafe(schema, payload);
		if (!parsed.success) {
			return this.#fail(
				"invalid_response",
				"a search result carried a shape this provider cannot read",
			);
		}

		return success({ value: parsed.value, raw: payload });
	}

	async #findCustomerById(id: string): Promise<Result<ParsedCustomer, BillingError>> {
		return await this.#call(`/v1/customers/${encodeURIComponent(id)}`, CustomerBody);
	}

	/**
	 * Resolves whichever identifier a caller named. The stored payer carries our
	 * own reference in metadata but exposes no filter for it, so naming a payer
	 * by our subject id would mean scanning the merchant's whole payer list and
	 * reporting a false absence past the point the scan stops: an app keeps that
	 * mapping in its own table and names the payer by the platform's id.
	 */
	async #resolveCustomer(customer: CustomerRef): Promise<Result<ParsedCustomer, BillingError>> {
		if ("id" in customer) return await this.#findCustomerById(customer.id);

		return this.#unsupported("filter that names a payer by our own reference");
	}

	#buildCustomerApi(): CustomerApi {
		return {
			/**
			 * Creates a payer. The platform refuses a second payer for one email
			 * address, which is the only uniqueness it enforces; our own reference
			 * travels in the metadata and stays the app's to keep unique.
			 */
			create: async (input: CreateCustomerInput) => {
				let [first, ...rest] = (input.name ?? "").split(" ");

				let created = await this.#call(`/v1/customers`, CustomerBody, {
					method: "POST",
					idempotencyKey: input.externalId,
					body: {
						email: input.email,
						first_name: first === "" ? undefined : first,
						last_name: rest.length > 0 ? rest.join(" ") : undefined,
						description: input.externalId,
						/** UNVERIFIED: `metadata` is documented on a payer read, not on a payer write. */
						metadata: { ...input.metadata, [EXTERNAL_REFERENCE_KEY]: input.externalId },
					},
				});
				if (isFailure(created)) return created;

				return success(customerFrom(created.data.value, created.data.raw));
			},

			/**
			 * Changes the fields named. Our own reference is a field of the payer
			 * record here rather than something the platform keys on, so adopting a
			 * payer that carries none is the same write as any other field.
			 */
			update: async (customer: CustomerRef, input: UpdateCustomerInput) => {
				let record = await this.#resolveCustomer(customer);
				if (isFailure(record)) return record;

				let [first, ...rest] = (input.name ?? "").split(" ");
				let reference = input.externalId ?? record.data.value.description;

				let updated = await this.#call(
					`/v1/customers/${encodeURIComponent(record.data.value.id)}`,
					CustomerBody,
					{
						method: "PUT",
						body: {
							email: input.email,
							first_name: input.name === undefined || first === "" ? undefined : first,
							last_name: rest.length > 0 ? rest.join(" ") : undefined,
							description: input.externalId,
							metadata:
								input.metadata === undefined
									? undefined
									: { ...input.metadata, [EXTERNAL_REFERENCE_KEY]: reference },
						},
					},
				);
				if (isFailure(updated)) return updated;

				return success(customerFrom(updated.data.value, updated.data.raw));
			},

			find: async (customer: CustomerRef) => {
				let record = await this.#resolveCustomer(customer);
				if (isFailure(record)) return record;

				return success(customerFrom(record.data.value, record.data.raw));
			},

			findByEmail: async (email: string) => {
				let page = await this.#search<Customer>(
					`/v1/customers/search`,
					{ email },
					{ limit: 1 },
					(payload) => {
						let parsed = this.#parse(CustomerBody, payload);
						if (isFailure(parsed)) return parsed;

						return success(customerFrom(parsed.data.value, parsed.data.raw));
					},
				);
				if (isFailure(page)) return page;

				let found = page.data.items.at(0);
				if (found === undefined) return this.#fail("not_found", `no customer for ${email}`);

				return success(found);
			},

			list: async (query?: ListCustomersQuery) => {
				return await this.#search<Customer>(
					`/v1/customers/search`,
					{ email: query?.email },
					query,
					(payload) => {
						let parsed = this.#parse(CustomerBody, payload);
						if (isFailure(parsed)) return parsed;

						return success(customerFrom(parsed.data.value, parsed.data.raw));
					},
				);
			},
		};
	}

	/**
	 * Reads one configured slug. A one-time sale is answered from configuration,
	 * since the platform stores no product for it, while a recurring sale is
	 * answered by reading the plan that prices it.
	 */
	async #product(slug: string): Promise<Result<Product, BillingError>> {
		let configured = this.#catalog.find(slug);
		if (configured === undefined)
			return this.#fail("not_found", `no product configured as ${slug}`);

		if (configured.kind === "one_time") return success(productFromConfig(slug, configured));

		let plan = await this.#call(
			`/preapproval_plan/${encodeURIComponent(configured.plan)}`,
			PreapprovalPlanBody,
		);
		if (isFailure(plan)) return plan;

		return success(productFromPlan(slug, plan.data.value, plan.data.raw, configured));
	}

	#buildCatalogApi(): CatalogApi {
		return {
			find: async (slug: string) => await this.#product(slug),

			list: async (query?: ListProductsQuery) => {
				let offset = decodeCursor(query?.cursor);
				if (offset === null) return this.#fail("invalid_request", "unusable cursor");

				let limit = this.#pageSize(query?.limit);
				if (isFailure(limit)) return limit;

				let slugs = this.#catalog.slugs;
				let items: Product[] = [];

				for (let slug of slugs.slice(offset, offset + limit.data)) {
					let product = await this.#product(slug);
					if (isFailure(product)) return product;
					if (product.data.archived && query?.archived !== true) continue;

					items.push(product.data);
				}

				let next = offset + limit.data;

				return success({ items, cursor: next < slugs.length ? encodeCursor(next) : null });
			},
		};
	}

	/** Names which hosted flow a checkout identifier belongs to. */
	static #checkoutKind(checkout: string): { kind: "preference" | "preapproval"; id: string } {
		if (checkout.startsWith(PREAPPROVAL_PREFIX)) {
			return { kind: "preapproval", id: checkout.slice(PREAPPROVAL_PREFIX.length) };
		}

		if (checkout.startsWith(PREFERENCE_PREFIX)) {
			return { kind: "preference", id: checkout.slice(PREFERENCE_PREFIX.length) };
		}

		return { kind: "preference", id: checkout };
	}

	/**
	 * The hosted page a buyer is sent to. One URL serves a live account and a
	 * test one alike, because the platform issues test credentials that publish
	 * their checkouts under this same field.
	 */
	static #hostedURL(payload: { init_point?: string | null }): string | null {
		return payload.init_point ?? null;
	}

	/** Reads a hosted one-time checkout, and whether a payment has settled it. */
	async #preference(id: string, settle: boolean): Promise<Result<Checkout, BillingError>> {
		let preference = await this.#call(
			`/checkout/preferences/${encodeURIComponent(id)}`,
			PreferenceBody,
		);
		if (isFailure(preference)) return preference;

		let url = MercadoPagoBilling.#hostedURL(preference.data.value);
		if (url === null) {
			return this.#fail("invalid_request", `preference ${id} reported no hosted page`);
		}

		let checkoutId = `${PREFERENCE_PREFIX}${preference.data.value.id}`;
		if (!settle) {
			return success(
				checkoutFromPreference(checkoutId, preference.data.value, preference.data.raw, url),
			);
		}

		let reference = preference.data.value.external_reference;
		if (reference === null || reference === undefined) {
			return success(
				checkoutFromPreference(checkoutId, preference.data.value, preference.data.raw, url),
			);
		}

		let payments = await this.#search<Order>(
			`/v1/payments/search`,
			{ external_reference: reference },
			{ limit: MAX_PAGE_SIZE },
			(payload) => {
				let parsed = this.#parse(PaymentBody, payload);
				if (isFailure(parsed)) return parsed;
				if (!isPaid(parsed.data.value.status)) return success(null);

				return success(orderFrom(parsed.data.value, parsed.data.raw, this.#catalog));
			},
		);
		if (isFailure(payments)) return payments;

		let paid = payments.data.items.at(0);

		return success(
			checkoutFromPreference(checkoutId, preference.data.value, preference.data.raw, url, {
				status: paid === undefined ? "open" : "completed",
				orderId: paid?.id ?? null,
			}),
		);
	}

	/** Reads a subscription authorization as the checkout that opened it. */
	async #authorization(id: string): Promise<Result<Checkout, BillingError>> {
		let preapproval = await this.#call(`/preapproval/${encodeURIComponent(id)}`, PreapprovalBody);
		if (isFailure(preapproval)) return preapproval;

		let url = MercadoPagoBilling.#hostedURL(preapproval.data.value);
		if (url === null) {
			return this.#fail("invalid_request", `preapproval ${id} reported no hosted page`);
		}

		let slug = this.#catalog.slugForPlan(preapproval.data.value.preapproval_plan_id);
		if (slug === null) {
			return this.#fail("invalid_request", `no configured slug for the plan behind ${id}`);
		}

		return success(
			checkoutFromPreapproval(
				`${PREAPPROVAL_PREFIX}${preapproval.data.value.id}`,
				slug,
				preapproval.data.value,
				preapproval.data.raw,
				url,
			),
		);
	}

	#buildCheckoutApi(): CheckoutApi {
		return {
			create: async (input: CreateCheckoutInput) => {
				let configured = this.#catalog.find(input.product);
				if (configured === undefined) {
					return this.#fail("not_found", `no product configured as ${input.product}`);
				}

				if (input.discount !== undefined) {
					return this.#unsupported("discount an API-opened checkout can apply");
				}

				if (input.allowDiscountCodes === true) {
					return this.#unsupported("code field on its hosted page for a buyer to type into");
				}

				let buyer =
					input.customer === undefined ? null : await this.#resolveCustomer(input.customer);
				if (buyer !== null && isFailure(buyer)) return buyer;

				let email = buyer?.data.value.email ?? input.email;
				let reference =
					buyer === null
						? input.metadata?.[EXTERNAL_REFERENCE_KEY]
						: (customerFrom(buyer.data.value, buyer.data.raw).externalId ?? undefined);

				if (reference !== undefined && !EXTERNAL_REFERENCE_PATTERN.test(reference)) {
					return this.#fail(
						"invalid_request",
						`${reference} cannot be our reference: the platform accepts at most 64 letters, digits, hyphens, and underscores`,
					);
				}

				if (configured.kind === "recurring") {
					if (email === undefined) {
						return this.#fail(
							"invalid_request",
							"a subscription authorization needs the payer's email address",
						);
					}

					let created = await this.#call(`/preapproval`, PreapprovalBody, {
						method: "POST",
						idempotencyKey: input.idempotencyKey ?? reference,
						body: {
							preapproval_plan_id: configured.plan,
							payer_email: email,
							back_url: input.returnTo ?? this.#backURLs.success,
							external_reference: reference,
							status: "pending",
						},
					});
					if (isFailure(created)) return created;

					let url = MercadoPagoBilling.#hostedURL(created.data.value);
					if (url === null) {
						return this.#fail("invalid_request", "the authorization reported no hosted page");
					}

					return success(
						checkoutFromPreapproval(
							`${PREAPPROVAL_PREFIX}${created.data.value.id}`,
							input.product,
							created.data.value,
							created.data.raw,
							url,
						),
					);
				}

				let successURL = input.returnTo ?? this.#backURLs.success;

				let created = await this.#call(`/checkout/preferences`, PreferenceBody, {
					method: "POST",
					idempotencyKey: input.idempotencyKey ?? reference,
					body: {
						items: itemsFor(
							input.product,
							configured,
							MercadoPagoCatalog.quantityOf(configured, input.quantity),
						),
						payer: email === undefined ? undefined : { email },
						back_urls: {
							success: successURL,
							failure: input.returnTo ?? this.#backURLs.failure,
							pending: input.returnTo ?? this.#backURLs.pending,
						},
						auto_return: successURL === undefined ? undefined : "approved",
						external_reference: reference,
						notification_url: this.#notificationURL ?? undefined,
						metadata: {
							...input.metadata,
							[PRODUCT_SLUG_KEY]: input.product,
							customer_id: buyer?.data.value.id,
						},
					},
				});
				if (isFailure(created)) return created;

				let url = MercadoPagoBilling.#hostedURL(created.data.value);
				if (url === null) {
					return this.#fail("invalid_request", "the checkout reported no hosted page");
				}

				return success(
					checkoutFromPreference(
						`${PREFERENCE_PREFIX}${created.data.value.id}`,
						created.data.value,
						created.data.raw,
						url,
					),
				);
			},

			find: async (checkout: string) => {
				let target = MercadoPagoBilling.#checkoutKind(checkout);

				if (target.kind === "preapproval") return await this.#authorization(target.id);

				return await this.#preference(target.id, false);
			},

			finish: async (checkout: string) => {
				let target = MercadoPagoBilling.#checkoutKind(checkout);

				if (target.kind === "preapproval") return await this.#authorization(target.id);

				return await this.#preference(target.id, true);
			},
		};
	}

	#buildSubscriptionApi(): SubscriptionApi {
		return {
			find: async (subscription: string) => {
				let preapproval = await this.#call(
					`/preapproval/${encodeURIComponent(subscription)}`,
					PreapprovalBody,
				);
				if (isFailure(preapproval)) return preapproval;

				return subscriptionFrom(
					preapproval.data.value,
					preapproval.data.raw,
					this.#catalog,
					this.connection,
				);
			},

			/**
			 * Reads one page. A row this connection cannot express costs that row
			 * and is logged, since an account authorizes plans beyond the ones a
			 * single connection was configured with.
			 */
			list: async (query?: ListSubscriptionsQuery) => {
				let filter = await this.#subscriptionFilter(query?.customer);
				if (isFailure(filter)) return filter;

				return await this.#search<Subscription>(
					`/preapproval/search`,
					{ ...filter.data, preapproval_plan_id: this.#catalog.planFor(query?.product) },
					query,
					(payload) => {
						let mapped = this.#mapSearchedSubscription(payload);
						if (isFailure(mapped)) return mapped;
						if (mapped.data === null) return success(null);
						if (query?.status !== undefined && !query.status.includes(mapped.data.status)) {
							return success(null);
						}

						return success(mapped.data);
					},
				);
			},

			/**
			 * Cancels an authorization. The platform stops it at once and refunds
			 * nothing, so there is no state that keeps access to the end of a paid
			 * period and asking for one is answered as unsupported.
			 */
			cancel: async (subscription: string, options?: { atPeriodEnd?: boolean }) => {
				if (options?.atPeriodEnd === true) {
					return this.#unsupported("cancellation that takes effect at the end of a paid period");
				}

				let canceled = await this.#call(
					`/preapproval/${encodeURIComponent(subscription)}`,
					PreapprovalBody,
					{ method: "PUT", body: { status: "cancelled" } },
				);
				if (isFailure(canceled)) return canceled;

				return subscriptionFrom(
					canceled.data.value,
					canceled.data.raw,
					this.#catalog,
					this.connection,
				);
			},
		};
	}

	/**
	 * Renders the payer filter a subscription search carries. A subscription
	 * search matches on the payer's email address, so naming a customer means
	 * reading that customer first, whichever identifier the caller used.
	 */
	async #subscriptionFilter(
		customer: CustomerRef | undefined,
	): Promise<Result<Record<string, string | undefined>, BillingError>> {
		if (customer === undefined) return success({});

		let record = await this.#resolveCustomer(customer);
		if (isFailure(record)) return record;

		return success({ payer_email: record.data.value.email });
	}

	/**
	 * Maps one authorization a search returned, answering `null` for a row this
	 * connection cannot express and logging it, so a plan configured elsewhere in
	 * the account costs the row it authorized rather than the whole page.
	 */
	#mapSearchedSubscription(payload: ProviderData): Result<Subscription | null, BillingError> {
		let parsed = this.#parse(PreapprovalBody, payload);
		if (isFailure(parsed)) return parsed;

		let mapped = subscriptionFrom(
			parsed.data.value,
			parsed.data.raw,
			this.#catalog,
			this.connection,
		);

		if (isFailure(mapped)) {
			reportSkipped(this.connection, mapped.error.message);
			return success(null);
		}

		return success(mapped.data);
	}

	#buildEntitlementApi(): EntitlementApi {
		return {
			of: async (customer: CustomerRef) => {
				let record = await this.#resolveCustomer(customer);
				if (isFailure(record)) return record;

				let held = customerFrom(record.data.value, record.data.raw);

				let subscriptions = await this.#search<EntitlementSubscription>(
					`/preapproval/search`,
					{ payer_email: held.email ?? undefined },
					{ limit: MAX_PAGE_SIZE },
					(payload) => {
						let mapped = this.#mapSearchedSubscription(payload);
						if (isFailure(mapped)) return mapped;
						if (mapped.data === null) return success(null);

						return success({
							subscriptionId: mapped.data.id,
							productSlug: mapped.data.productSlug,
							status: mapped.data.status,
							currentPeriodStart: mapped.data.currentPeriodStart,
							currentPeriodEnd: mapped.data.currentPeriodEnd,
							cancelAtPeriodEnd: mapped.data.cancelAtPeriodEnd,
						});
					},
				);
				if (isFailure(subscriptions)) return subscriptions;

				let purchased = await this.#purchasedSlugs(held.externalId);
				if (isFailure(purchased)) return purchased;

				let entitling = subscriptions.data.items.filter(
					(entry) => entry.status === "active" || entry.status === "trialing",
				);

				let products = [
					...new Set([
						...entitling.flatMap((entry) =>
							entry.productSlug === null ? [] : [entry.productSlug],
						),
						...purchased.data,
					]),
				];

				let state: EntitlementState = {
					customerId: held.id,
					externalId: held.externalId,
					products,
					features: this.#catalog.featuresOf(products),
					meters: [],
					subscriptions: subscriptions.data.items,
					readAt: new Date(),
					providerData: record.data.raw,
				};

				return success(state);
			},
		};
	}

	/**
	 * Names the one-time products a payer has already paid for, which stay held
	 * indefinitely and so belong in the snapshot beside the subscriptions.
	 */
	async #purchasedSlugs(externalId: string | null): Promise<Result<string[], BillingError>> {
		if (externalId === null) return success([]);

		let page = await this.#search<string>(
			`/v1/payments/search`,
			{ external_reference: externalId },
			{ limit: MAX_PAGE_SIZE },
			(payload) => {
				let parsed = this.#parse(PaymentBody, payload);
				if (isFailure(parsed)) return parsed;
				if (!isPaid(parsed.data.value.status)) return success(null);

				let order = orderFrom(parsed.data.value, parsed.data.raw, this.#catalog);
				if (order.productSlug === null) return success(null);
				if (this.#catalog.find(order.productSlug)?.kind !== "one_time") return success(null);

				return success(order.productSlug);
			},
		);
		if (isFailure(page)) return page;

		return success(page.data.items);
	}

	#buildOrderApi(): OrderApi {
		return {
			find: async (order: string) => {
				let payment = await this.#call(`/v1/payments/${encodeURIComponent(order)}`, PaymentBody);
				if (isFailure(payment)) return payment;

				return success(orderFrom(payment.data.value, payment.data.raw, this.#catalog));
			},

			list: async (query?: ListOrdersQuery) => {
				let reference = await this.#orderReference(query);
				if (isFailure(reference)) return reference;

				return await this.#search<Order>(
					`/v1/payments/search`,
					{ external_reference: reference.data },
					query,
					(payload) => {
						let parsed = this.#parse(PaymentBody, payload);
						if (isFailure(parsed)) return parsed;

						let order = orderFrom(parsed.data.value, parsed.data.raw, this.#catalog);
						if (query?.product !== undefined && order.productSlug !== query.product) {
							return success(null);
						}
						if (query?.subscription !== undefined && order.subscriptionId !== query.subscription) {
							return success(null);
						}

						return success(order);
					},
				);
			},
		};
	}

	/**
	 * The reference a payment search filters a customer's charges by, which is
	 * the only filter that names a buyer in our own vocabulary.
	 *
	 * UNVERIFIED: a payment search documents `offset` and `limit` on the
	 * envelope it answers with rather than as parameters it accepts.
	 */
	async #orderReference(
		query: ListOrdersQuery | undefined,
	): Promise<Result<string | undefined, BillingError>> {
		if (query?.customer === undefined) return success(undefined);
		if ("externalId" in query.customer) return success(query.customer.externalId);

		let record = await this.#findCustomerById(query.customer.id);
		if (isFailure(record)) return record;

		let externalId = customerFrom(record.data.value, record.data.raw).externalId;
		if (externalId === null) {
			return this.#fail(
				"invalid_request",
				`customer ${query.customer.id} carries no reference a payment search can filter on`,
			);
		}

		return success(externalId);
	}

	/** Reads a delivery body, answering `null` for anything unparsable. */
	#notification(rawBody: string): Parsed<NotificationPayload> | null {
		let body: unknown;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return null;
		}

		let parsed = s.parseSafe(NotificationBody, body);
		if (!parsed.success) return null;

		return { value: parsed.value, raw: (body ?? {}) as ProviderData };
	}

	/** The delivery family a notification names, whichever field carries it. */
	static #familyOf(payload: NotificationPayload): string {
		return payload.action ?? payload.type ?? payload.topic ?? "unknown";
	}

	#buildWebhookApi(): WebhookApi {
		return {
			verify: async (request: Request, rawBody: string) => {
				let secret = await verificationSecret(this.#webhookSecret);
				if (secret.length === 0) return false;

				let signature = parseSignature(request.headers.get(SIGNATURE_HEADER));
				if (signature === null) return false;

				let search = new URL(request.url).searchParams;
				let dataId =
					search.get(DATA_ID_PARAM) ??
					search.get(LEGACY_ID_PARAM) ??
					this.#notification(rawBody)?.value.data?.id ??
					null;

				let manifest = signedManifest({
					dataId: dataId === null ? null : dataId.toLowerCase(),
					requestId: request.headers.get(REQUEST_ID_HEADER),
					timestamp: signature.timestamp,
				});

				return await verifyManifest(secret, manifest, signature.digest);
			},

			/**
			 * Names the delivery by the notification's own id, falling back to the
			 * transport's request id, since the resource id names the object a
			 * platform sends many separate deliveries about.
			 */
			reference: (request: Request, rawBody: string): WebhookReference | null => {
				let notification = this.#notification(rawBody);
				if (notification === null) return null;

				let deliveryId = notification.value.id ?? request.headers.get(REQUEST_ID_HEADER);
				if (deliveryId === null) return null;

				let resource = notification.value.data?.id;

				return {
					deliveryId,
					object:
						resource === null || resource === undefined
							? null
							: { id: resource, type: MercadoPagoBilling.#familyOf(notification.value) },
				};
			},

			event: async (_request: Request, rawBody: string) => await this.#resolveEvent(rawBody),
		};
	}

	/**
	 * Reads back the resource a delivery names and maps it into our vocabulary.
	 * A notification carries an id and nothing else, so the resource's state has
	 * to be fetched before an event can say what happened, and that request has
	 * to fit inside the twenty-two seconds the platform waits for an answer.
	 */
	async #resolveEvent(rawBody: string): Promise<Result<BillingEvent, BillingError>> {
		let notification = this.#notification(rawBody);
		if (notification === null) {
			return this.#fail("invalid_request", "the delivery body is not a notification");
		}

		let family = notification.value.type ?? notification.value.topic ?? "";
		let providerType = MercadoPagoBilling.#familyOf(notification.value);
		let id = notification.value.id ?? notification.value.data?.id ?? "";
		let resource = notification.value.data?.id;

		if (resource === null || resource === undefined || !RESOLVABLE_TYPES.has(family)) {
			return success<BillingEvent>({
				id,
				raw: notification.raw,
				type: "unrecognized",
				providerType,
			});
		}

		if (family === "subscription_preapproval") {
			let preapproval = await this.#call(
				`/preapproval/${encodeURIComponent(resource)}`,
				PreapprovalBody,
			);
			if (isFailure(preapproval)) return preapproval;

			let mapped = subscriptionFrom(
				preapproval.data.value,
				preapproval.data.raw,
				this.#catalog,
				this.connection,
			);
			if (isFailure(mapped)) return mapped;

			return success<BillingEvent>({
				id,
				raw: notification.raw,
				type: MercadoPagoBilling.#subscriptionEventType(mapped.data.providerStatus),
				subscription: mapped.data,
			});
		}

		let payment = await this.#call(`/v1/payments/${encodeURIComponent(resource)}`, PaymentBody);
		if (isFailure(payment)) return payment;

		let order = orderFrom(payment.data.value, payment.data.raw, this.#catalog);

		return success<BillingEvent>({
			id,
			raw: notification.raw,
			type: payment.data.value.status === "refunded" ? "order.refunded" : "order.paid",
			order,
		});
	}

	/** Which subscription event a read-back authorization amounts to. */
	static #subscriptionEventType(
		status: string,
	): "subscription.activated" | "subscription.canceled" | "subscription.updated" {
		if (status === "authorized") return "subscription.activated";
		if (status === "cancelled") return "subscription.canceled";

		return "subscription.updated";
	}

	/**
	 * Reads the merchant order one hosted checkout produced, which is the one
	 * read that names every payment a single preference collected.
	 *
	 * @param order - The merchant order's own identifier.
	 * @returns The payload as received, validated.
	 */
	async merchantOrder(
		order: string,
	): Promise<Result<Parsed<s.InferOutput<typeof MerchantOrderBody>>, BillingError>> {
		return await this.#call(`/merchant_orders/${encodeURIComponent(order)}`, MerchantOrderBody);
	}
}
