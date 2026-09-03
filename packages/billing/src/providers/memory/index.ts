/**
 * A billing provider whose platform is a set of maps: it implements the whole
 * contract, signs the deliveries it emits, and passes the same conformance
 * suite, so a test bills against something real and a new provider has a template.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { sign, verify } from "@sdxc/webhooks";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

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
	BillingInterval,
	Checkout,
	Currency,
	Customer,
	CustomerRef,
	Discount,
	EntitlementState,
	MeterBalance,
	Money,
	Order,
	Page,
	Price,
	Product,
	Subscription,
	UsageEvent,
	UsageRecord,
} from "../../core/types";

import { BillingError } from "../../core/errors";
import { DEFAULT_PAGE_SIZE } from "../../core/types";

/** Connection code the provider reports when the caller names none. */
const DEFAULT_CONNECTION = "memory";

/** Currency a seeded product is priced in when the seed names none. */
const DEFAULT_CURRENCY = "usd";

/**
 * Signing secret used when the caller configures none. Standard Webhooks keys
 * on the secret's decoded bytes, so it is base64 like a real one.
 */
/** Header the signing scheme carries the per-delivery identifier in. */
const DELIVERY_ID_HEADER = "webhook-id";

const DEFAULT_WEBHOOK_SECRET = "bWVtb3J5LWJpbGxpbmctd2ViaG9vay1zZWNyZXQ";

/** Origin the hosted pages this provider hands back are addressed under. */
const HOSTED_ORIGIN = "https://memory.test";

/** How long a checkout session stays open, matching the shortest window a platform gives. */
const CHECKOUT_TTL_MS = 30 * 60 * 1000;

/** Days in a week, for advancing a weekly billing period. */
const DAYS_PER_WEEK = 7;

/** Percent the whole of an amount represents, for applying a percentage discount. */
const WHOLE_PERCENT = 100;

/** One product to put in the catalog, priced the way a caller wants to bill it. */
export interface MemoryProductSeed {
	name?: string;
	description?: string;
	/** Minor units of the currency below, as {@link Money} carries them. */
	amount: number;
	/** @default "usd" */
	currency?: Currency;
	/** How often it renews; omitted prices it as a one-time sale. */
	interval?: BillingInterval;
	/** Meter it consumes; naming one prices it as metered. */
	meter?: string;
	/** Feature flags a customer holding it is entitled to. */
	features?: Record<string, boolean>;
	/** Meter credits a customer holding it is granted, keyed by meter. */
	credits?: Record<string, number>;
	archived?: boolean;
}

/** One discount to put in the catalog for a checkout to apply. */
export interface MemoryDiscountSeed {
	id?: string;
	/** What a customer types to redeem it. */
	code?: string;
	name?: string;
	/** Whole percent off, 1 to 100. Supply this or `amount`. */
	percentage?: number;
	/** Minor units off. Supply this or `percentage`. */
	amount?: number;
	/** @default "usd" */
	currency?: Currency;
	/** Products it applies to, by slug; omitted applies it to every product. */
	products?: string[];
	maxRedemptions?: number;
	/** Redemptions already spent, for a campaign a test starts part-way through. */
	redemptions?: number;
	/** When it starts applying; omitted has it apply from the beginning. */
	startsAt?: Date;
	/** When it stops applying; omitted leaves it open-ended. */
	endsAt?: Date;
}

/** How a memory provider is configured. */
export interface MemoryBillingOptions {
	/**
	 * Connection code stored beside every id this provider issues.
	 *
	 * @default "memory"
	 */
	connection?: string;
	/** Products to start with, keyed by the slug a call site addresses them by. */
	catalog?: Record<string, MemoryProductSeed>;
	/** Discounts to start with. */
	discounts?: MemoryDiscountSeed[];
	/**
	 * Base64 secret the emitted deliveries are signed with, so a test can point
	 * an endpoint at the same value it configures for a real provider.
	 */
	webhookSecret?: string;
	/**
	 * Failures armed from the first call, keyed by the group or method they
	 * cover. {@link MemoryBilling.fail} arms one later and
	 * {@link MemoryBilling.heal} takes it away.
	 */
	faults?: MemoryFaults;
}

/** An envelope read off the wire, kept beside the exact payload it came from. */
interface Delivery {
	id: string;
	type: string;
	data: unknown;
	raw: unknown;
}

/** A signed delivery, ready to hand to a webhook endpoint. */
export interface MemoryDelivery {
	/** The inbound request an endpoint receives, body included. */
	request: Request;
	/** Exact body text the signature covers. */
	body: string;
	/** The three Standard Webhooks headers the request carries. */
	headers: Headers;
	/** The delivery as the provider itself normalizes it. */
	event: BillingEvent;
}

/**
 * An event to deliver. The envelope fields are supplied for you, so a test
 * states only what the delivery is about.
 */
export type MemoryEmitEvent = BillingEventPayload & {
	/** Delivery id; omitted issues one, and reusing one models a redelivery. */
	id?: string;
};

/** Webhook questions plus the emitter that produces something to ask them about. */
export interface MemoryWebhookApi extends WebhookApi {
	/**
	 * Signs and returns a delivery for an event, without sending it anywhere.
	 *
	 * @param payload - What the delivery is about.
	 * @returns The signed delivery, or a failure when the configured secret is unusable.
	 */
	emit(payload: MemoryEmitEvent): Promise<Result<MemoryDelivery, BillingError>>;
}

/**
 * The resource groups a fault is armed on. `webhooks` is absent because its
 * questions answer a verdict rather than a `Result`, so a failure has nowhere
 * to go there.
 */
interface MemoryFaultGroups {
	customers: CustomerApi;
	catalog: CatalogApi;
	checkouts: CheckoutApi;
	portal: PortalApi;
	subscriptions: SubscriptionApi;
	entitlements: EntitlementApi;
	orders: OrderApi;
	discounts: DiscountApi;
	usage: UsageApi;
	meters: MeterApi;
}

/**
 * What a fault covers: a whole group, or one of its methods. It is derived from
 * the contract's own groups, so a method the contract gains is armable without
 * a list here being updated.
 *
 * @example
 * billing.fail("customers");
 * billing.fail("subscriptions.list", "rate_limited");
 */
export type MemoryFaultTarget = {
	[Group in keyof MemoryFaultGroups]:
		| Group
		| `${Group}.${Extract<keyof MemoryFaultGroups[Group], string>}`;
}[keyof MemoryFaultGroups];

/** Faults armed from the start, as the failure each target reports. */
export type MemoryFaults = Partial<Record<MemoryFaultTarget, BillingErrorCode>>;

/**
 * Groups a view answers differently. Naming an optional group as `undefined`
 * leaves it absent, so a `supports()` guard takes its false branch.
 */
export interface MemoryBillingOverrides {
	customers?: CustomerApi;
	catalog?: CatalogApi;
	checkouts?: CheckoutApi;
	subscriptions?: SubscriptionApi;
	entitlements?: EntitlementApi;
	orders?: OrderApi;
	webhooks?: WebhookApi;
	portal?: PortalApi | undefined;
	discounts?: DiscountApi | undefined;
	usage?: UsageApi | undefined;
	meters?: MeterApi | undefined;
}

/** Envelope every emitted delivery carries, and the shape a parse starts from. */
const ENVELOPE_SCHEMA = s.object({ id: s.string(), type: s.string(), data: s.any() });

/** Free-form provider payload, carried through whole. */
const PROVIDER_DATA_SCHEMA = s.record(s.string(), s.any());

/** An amount as the wire carries it, before it becomes {@link Money}. */
const MONEY_SCHEMA = s.object({ amount: s.number(), currency: s.string() });

/** Our subscription vocabulary, so an unmapped status fails the parse. */
const SUBSCRIPTION_STATUS_SCHEMA = s.enum_([
	"trialing",
	"active",
	"past_due",
	"canceled",
	"revoked",
	"incomplete",
]);

const CUSTOMER_SCHEMA = s.object({
	id: s.string(),
	externalId: s.nullable(s.string()),
	email: s.string(),
	name: s.nullable(s.string()),
	metadata: s.record(s.string(), s.string()),
	createdAt: coerce.date(),
	providerData: PROVIDER_DATA_SCHEMA,
});

const CHECKOUT_SCHEMA = s.object({
	id: s.string(),
	url: s.string(),
	status: s.enum_(["open", "completed", "expired"]),
	productSlug: s.string(),
	customerId: s.nullable(s.string()),
	customerExternalId: s.nullable(s.string()),
	amount: s.nullable(MONEY_SCHEMA),
	discountId: s.nullable(s.string()),
	subscriptionId: s.nullable(s.string()),
	orderId: s.nullable(s.string()),
	expiresAt: s.nullable(coerce.date()),
	createdAt: coerce.date(),
	providerData: PROVIDER_DATA_SCHEMA,
});

const SUBSCRIPTION_SCHEMA = s.object({
	id: s.string(),
	customerId: s.string(),
	productSlug: s.string(),
	priceId: s.nullable(s.string()),
	status: SUBSCRIPTION_STATUS_SCHEMA,
	providerStatus: s.string(),
	amount: s.nullable(MONEY_SCHEMA),
	interval: s.nullable(s.enum_(["day", "week", "month", "year"])),
	currentPeriodStart: s.nullable(coerce.date()),
	currentPeriodEnd: s.nullable(coerce.date()),
	cancelAtPeriodEnd: s.boolean(),
	canceledAt: s.nullable(coerce.date()),
	endsAt: s.nullable(coerce.date()),
	metadata: s.record(s.string(), s.string()),
	createdAt: coerce.date(),
	providerData: PROVIDER_DATA_SCHEMA,
});

const ORDER_SCHEMA = s.object({
	id: s.string(),
	customerId: s.nullable(s.string()),
	customerEmail: s.nullable(s.string()),
	customerExternalId: s.nullable(s.string()),
	productSlug: s.nullable(s.string()),
	subscriptionId: s.nullable(s.string()),
	total: MONEY_SCHEMA,
	subtotal: MONEY_SCHEMA,
	tax: s.nullable(MONEY_SCHEMA),
	discountId: s.nullable(s.string()),
	paid: s.boolean(),
	refunded: s.nullable(MONEY_SCHEMA),
	createdAt: coerce.date(),
	providerData: PROVIDER_DATA_SCHEMA,
});

/**
 * Advances a date by one billing period, so a subscription's next period end
 * lands on the calendar date a platform would bill on.
 */
function addInterval(date: Date, interval: BillingInterval): Date {
	let next = new Date(date);

	if (interval === "day") next.setUTCDate(next.getUTCDate() + 1);
	else if (interval === "week") next.setUTCDate(next.getUTCDate() + DAYS_PER_WEEK);
	else if (interval === "month") next.setUTCMonth(next.getUTCMonth() + 1);
	else next.setUTCFullYear(next.getUTCFullYear() + 1);

	return next;
}

/** Reads what kind of price a seed describes from which fields it carries. */
function priceKind(seed: MemoryProductSeed): Price["kind"] {
	if (seed.meter !== undefined) return "metered";
	if (seed.interval !== undefined) return "recurring";
	return "one_time";
}

/**
 * Takes a discount off an amount, staying in minor units so a zero-decimal
 * currency stays whole.
 */
function applyDiscount(amount: Money, discount: Discount): Money {
	let off =
		discount.percentage === null
			? (discount.amount?.amount ?? 0)
			: Math.round((amount.amount * discount.percentage) / WHOLE_PERCENT);

	return { amount: Math.max(0, amount.amount - off), currency: amount.currency };
}

/** The page a filtered list returns when the customer it filters on is unknown. */
function emptyPage<T>(): Page<T> {
	return { items: [], cursor: null };
}

/** Whether a stored usage record was reported for a given customer. */
function recordMatchesCustomer(record: UsageRecord, customer: Customer): boolean {
	if (record.customerId === customer.id) return true;
	return customer.externalId !== null && record.customerExternalId === customer.externalId;
}

/**
 * A billing platform held in memory. Every operation the contract names is
 * implemented against maps, so state a call writes is state the next call
 * reads, and a test asserts on the outcome of a flow it drove.
 *
 * @example
 * let billing = new MemoryBilling({ catalog: { pro: { amount: 4900, currency: "usd" } } });
 * await billing.customers.create({ email: "jane@example.com", externalId: "u_1" });
 *
 * @example
 * let delivery = await billing.webhooks.emit({ type: "order.paid", order });
 * if (isSuccess(delivery)) await endpoint.fetch(delivery.data.request);
 */
export class MemoryBilling implements Billing {
	readonly connection: string;

	readonly customers: CustomerApi;

	readonly catalog: CatalogApi;

	readonly checkouts: CheckoutApi;

	readonly portal: PortalApi;

	readonly subscriptions: SubscriptionApi;

	readonly entitlements: EntitlementApi;

	readonly orders: OrderApi;

	readonly discounts: DiscountApi;

	readonly usage: UsageApi;

	readonly webhooks: MemoryWebhookApi;

	readonly meters: MeterApi;

	/** The maps this provider keeps its state in, for an assertion no method covers. */
	readonly native: unknown;

	#sequence = 0;

	#webhookSecret: string;

	#faults: Map<string, BillingErrorCode>;

	#customerRecords = new Map<string, Customer>();

	#productRecords = new Map<string, Product>();

	#creditGrants = new Map<string, Record<string, number>>();

	#discountRecords = new Map<string, Discount>();

	#checkoutRecords = new Map<string, Checkout>();

	#subscriptionRecords = new Map<string, Subscription>();

	#orderRecords = new Map<string, Order>();

	#usageRecords: UsageRecord[] = [];

	#usageKeys = new Set<string>();

	/**
	 * Creates the provider and applies its seed, so a test that only reads the
	 * catalog needs no setup call.
	 *
	 * @param options - Connection code, catalog, discounts, and signing secret.
	 */
	constructor(options: MemoryBillingOptions = {}) {
		this.connection = options.connection ?? DEFAULT_CONNECTION;
		this.#webhookSecret = options.webhookSecret ?? DEFAULT_WEBHOOK_SECRET;
		this.#faults = new Map(Object.entries(options.faults ?? {}));

		this.seed(options.catalog ?? {});
		for (let discount of options.discounts ?? []) this.#seedDiscount(discount);

		this.customers = this.#faultable("customers", this.#buildCustomerApi());
		this.catalog = this.#faultable("catalog", this.#buildCatalogApi());
		this.checkouts = this.#faultable("checkouts", this.#buildCheckoutApi());
		this.portal = this.#faultable("portal", this.#buildPortalApi());
		this.subscriptions = this.#faultable("subscriptions", this.#buildSubscriptionApi());
		this.entitlements = this.#faultable("entitlements", this.#buildEntitlementApi());
		this.orders = this.#faultable("orders", this.#buildOrderApi());
		this.discounts = this.#faultable("discounts", this.#buildDiscountApi());
		this.usage = this.#faultable("usage", this.#buildUsageApi());
		this.webhooks = this.#buildWebhookApi();
		this.meters = this.#faultable("meters", this.#buildMeterApi());

		this.native = {
			customers: this.#customerRecords,
			products: this.#productRecords,
			discounts: this.#discountRecords,
			checkouts: this.#checkoutRecords,
			subscriptions: this.#subscriptionRecords,
			orders: this.#orderRecords,
			usage: this.#usageRecords,
		};
	}

	/**
	 * Adds products to the catalog, replacing any sharing a slug, so a test can
	 * price what it is about to sell without constructing another provider.
	 *
	 * @param catalog - Products keyed by the slug call sites address them by.
	 */
	seed(catalog: Record<string, MemoryProductSeed>): void {
		for (let [slug, seed] of Object.entries(catalog)) this.#seedProduct(slug, seed);
	}

	/**
	 * Arms a failure on a group or one method of it, checked on every call from
	 * now on, so a test drives the path an outage takes without building a second
	 * provider. A method-level fault wins over one armed on its group.
	 *
	 * @param target - The group, or `"group.method"` for a single call.
	 * @param code - The failure the armed calls report.
	 *
	 * @example
	 * billing.fail("subscriptions.list", "unknown");
	 * expect(isFailure(await billing.subscriptions.list())).toBe(true);
	 */
	fail(target: MemoryFaultTarget, code: BillingErrorCode = "unknown"): void {
		this.#faults.set(target, code);
	}

	/**
	 * Takes an armed failure away, so the call answers from memory again.
	 *
	 * @param target - What to disarm; omitted disarms everything.
	 */
	heal(target?: MemoryFaultTarget): void {
		if (target === undefined) this.#faults.clear();
		else this.#faults.delete(target);
	}

	/**
	 * Builds the platform a call site sees, with the named groups answered by
	 * something else. It is a plain object rather than this instance, so a group
	 * can be recorded through or left absent while every other group still
	 * answers from memory.
	 *
	 * @param overrides - Groups to answer differently; an optional group named as `undefined` is absent.
	 * @returns The platform as a route or a job sees it.
	 *
	 * @example
	 * let portalless = billing.with({ portal: undefined });
	 * expect(supports(portalless, "portal")).toBe(false);
	 */
	with(overrides: MemoryBillingOverrides): Billing {
		return {
			connection: this.connection,
			customers: overrides.customers ?? this.customers,
			catalog: overrides.catalog ?? this.catalog,
			checkouts: overrides.checkouts ?? this.checkouts,
			subscriptions: overrides.subscriptions ?? this.subscriptions,
			entitlements: overrides.entitlements ?? this.entitlements,
			orders: overrides.orders ?? this.orders,
			webhooks: overrides.webhooks ?? this.webhooks,
			portal: "portal" in overrides ? overrides.portal : this.portal,
			discounts: "discounts" in overrides ? overrides.discounts : this.discounts,
			usage: "usage" in overrides ? overrides.usage : this.usage,
			meters: "meters" in overrides ? overrides.meters : this.meters,
			native: this.native,
		};
	}

	#seedProduct(slug: string, seed: MemoryProductSeed): void {
		let currency = seed.currency ?? DEFAULT_CURRENCY;

		let price: Price = {
			id: this.#nextId("price"),
			kind: priceKind(seed),
			interval: seed.interval ?? null,
			amount: { amount: seed.amount, currency },
			meter: seed.meter ?? null,
			providerData: {},
		};

		this.#productRecords.set(slug, {
			id: this.#nextId("prod"),
			slug,
			name: seed.name ?? slug,
			description: seed.description ?? null,
			prices: [price],
			features: seed.features ?? {},
			archived: seed.archived ?? false,
			createdAt: new Date(),
			providerData: {},
		});

		this.#creditGrants.set(slug, seed.credits ?? {});
	}

	#seedDiscount(seed: MemoryDiscountSeed): void {
		let id = seed.id ?? this.#nextId("disc");
		let currency = seed.currency ?? DEFAULT_CURRENCY;

		this.#discountRecords.set(id, {
			id,
			code: seed.code ?? null,
			name: seed.name ?? seed.code ?? id,
			kind: seed.percentage === undefined ? "fixed" : "percentage",
			percentage: seed.percentage ?? null,
			amount: seed.amount === undefined ? null : { amount: seed.amount, currency },
			productSlugs: seed.products ?? [],
			maxRedemptions: seed.maxRedemptions ?? null,
			redemptions: seed.redemptions ?? 0,
			startsAt: seed.startsAt ?? null,
			endsAt: seed.endsAt ?? null,
			createdAt: new Date(),
			providerData: {},
		});
	}

	/**
	 * Wraps a group so every call reports the failure armed for it, if any, before
	 * reaching the maps. Only groups whose methods answer a `Result` are wrapped.
	 */
	#faultable<Api extends object>(group: string, api: Api): Api {
		let faultable: Record<string, unknown> = {};

		for (let [method, implementation] of Object.entries<unknown>(api as Record<string, unknown>)) {
			faultable[method] = async (...args: unknown[]) => {
				let armed = this.#faults.get(`${group}.${method}`) ?? this.#faults.get(group);

				if (armed !== undefined) {
					return this.#fail(armed, `the memory platform is failing ${group}.${method}`);
				}

				return await (implementation as (...called: unknown[]) => unknown)(...args);
			};
		}

		return faultable as Api;
	}

	#nextId(prefix: string): string {
		this.#sequence += 1;
		return `${prefix}_${this.#sequence}`;
	}

	#fail(code: BillingErrorCode, message: string): Result<never, BillingError> {
		return failure(new BillingError(message, { code, connection: this.connection }));
	}

	#pageOf<T>(
		items: T[],
		query: { limit?: number; cursor?: string } | undefined,
	): Result<Page<T>, BillingError> {
		let limit = query?.limit ?? DEFAULT_PAGE_SIZE;
		if (!Number.isInteger(limit) || limit < 1) {
			return this.#fail("invalid_request", "limit must be a positive integer");
		}

		let offset = 0;
		if (query?.cursor !== undefined) {
			offset = Number(query.cursor);
			if (!Number.isInteger(offset) || offset < 0) {
				return this.#fail("invalid_request", `unusable cursor: ${query.cursor}`);
			}
		}

		let next = offset + limit;

		return success({
			items: items.slice(offset, next),
			cursor: next < items.length ? String(next) : null,
		});
	}

	#lookupCustomer(customer: CustomerRef): Customer | undefined {
		if ("id" in customer) return this.#customerRecords.get(customer.id);

		for (let record of this.#customerRecords.values()) {
			if (record.externalId === customer.externalId) return record;
		}

		return undefined;
	}

	#requireCustomer(customer: CustomerRef): Result<Customer, BillingError> {
		let found = this.#lookupCustomer(customer);
		if (found === undefined) {
			let named = "id" in customer ? customer.id : customer.externalId;
			return this.#fail("not_found", `no customer for ${named}`);
		}

		return success(found);
	}

	/**
	 * Resolves the customer a list filters on: `null` when the list is unfiltered,
	 * and `undefined` when the filter names someone the platform holds no record
	 * of, which answers an empty page.
	 */
	#filterCustomer(customer: CustomerRef | undefined): Customer | null | undefined {
		if (customer === undefined) return null;
		return this.#lookupCustomer(customer);
	}

	#emailTaken(email: string, except?: string): boolean {
		for (let record of this.#customerRecords.values()) {
			if (record.email === email && record.id !== except) return true;
		}

		return false;
	}

	/** Settles what a record's own id becomes, refusing to move one already set. */
	#adoptExternalId(
		customer: Customer,
		wanted: string | undefined,
	): Result<string | null, BillingError> {
		if (wanted === undefined || wanted === customer.externalId) return success(customer.externalId);

		if (customer.externalId !== null) {
			return this.#fail("conflict", `externalId is already ${customer.externalId}`);
		}

		if (this.#lookupCustomer({ externalId: wanted }) !== undefined) {
			return this.#fail("conflict", `externalId already taken: ${wanted}`);
		}

		return success(wanted);
	}

	#buildCustomerApi(): CustomerApi {
		return {
			/** Rejects a repeated `externalId` or email, so either identifier stays a key. */
			create: async (input: CreateCustomerInput) => {
				if (this.#lookupCustomer({ externalId: input.externalId }) !== undefined) {
					return this.#fail("conflict", `externalId already taken: ${input.externalId}`);
				}

				if (this.#emailTaken(input.email)) {
					return this.#fail("conflict", `email already taken: ${input.email}`);
				}

				let customer: Customer = {
					id: this.#nextId("cus"),
					externalId: input.externalId,
					email: input.email,
					name: input.name ?? null,
					metadata: { ...input.metadata },
					createdAt: new Date(),
					providerData: {},
				};

				this.#customerRecords.set(customer.id, customer);

				return success(customer);
			},

			/**
			 * Applies only the named fields. Our own id is adopted by a record that
			 * carries none, which is how an existing platform customer becomes
			 * re-resolvable; a record already holding a different one reports a
			 * conflict, as a platform treating the join key as immutable does.
			 */
			update: async (customer: CustomerRef, input: UpdateCustomerInput) => {
				let found = this.#requireCustomer(customer);
				if (isFailure(found)) return found;

				if (input.email !== undefined && this.#emailTaken(input.email, found.data.id)) {
					return this.#fail("conflict", `email already taken: ${input.email}`);
				}

				let externalId = this.#adoptExternalId(found.data, input.externalId);
				if (isFailure(externalId)) return externalId;

				let updated: Customer = {
					...found.data,
					externalId: externalId.data,
					email: input.email ?? found.data.email,
					name: input.name ?? found.data.name,
					metadata: input.metadata ?? found.data.metadata,
				};

				this.#customerRecords.set(updated.id, updated);

				return success(updated);
			},

			find: async (customer: CustomerRef) => this.#requireCustomer(customer),

			findByEmail: async (email: string) => {
				for (let record of this.#customerRecords.values()) {
					if (record.email === email) return success(record);
				}

				return this.#fail("not_found", `no customer for ${email}`);
			},

			/** Oldest first, which is the order the records were created in. */
			list: async (query?: ListCustomersQuery) => {
				let items = [...this.#customerRecords.values()].filter(
					(record) => query?.email === undefined || record.email === query.email,
				);

				return this.#pageOf(items, query);
			},
		};
	}

	#buildCatalogApi(): CatalogApi {
		return {
			find: async (slug: string) => {
				let product = this.#productRecords.get(slug);
				if (product === undefined) return this.#fail("not_found", `no product for ${slug}`);
				return success(product);
			},

			/** Archived products stay out of the page unless asked for, as a storefront wants. */
			list: async (query?: ListProductsQuery) => {
				let items = [...this.#productRecords.values()].filter(
					(product) => (query?.archived ?? false) || !product.archived,
				);

				return this.#pageOf(items, query);
			},
		};
	}

	#buildCheckoutApi(): CheckoutApi {
		return {
			/** Prices the session from the catalog and the discount, in minor units. */
			create: async (input: CreateCheckoutInput) => {
				let product = this.#productRecords.get(input.product);
				if (product === undefined) {
					return this.#fail("not_found", `no product for ${input.product}`);
				}

				let customer =
					input.customer === undefined ? undefined : this.#lookupCustomer(input.customer);
				if (input.customer !== undefined && "id" in input.customer && customer === undefined) {
					return this.#fail("not_found", `no customer for ${input.customer.id}`);
				}

				let discount = this.#resolveCheckoutDiscount(input, product.slug);
				if (isFailure(discount)) return discount;

				let price = product.prices.at(0);
				let listed = price?.amount ?? null;
				let amount =
					listed === null || discount.data === null ? listed : applyDiscount(listed, discount.data);

				let now = new Date();
				let id = this.#nextId("chk");

				let checkout: Checkout = {
					id,
					url: `${HOSTED_ORIGIN}/checkout/${id}`,
					status: "open",
					productSlug: product.slug,
					customerId: customer?.id ?? null,
					customerExternalId: this.#externalIdFor(input, customer),
					amount,
					discountId: discount.data?.id ?? null,
					subscriptionId: null,
					orderId: null,
					expiresAt: new Date(now.getTime() + CHECKOUT_TTL_MS),
					createdAt: now,
					providerData: {
						returnTo: input.returnTo ?? null,
						email: input.email ?? null,
						quantity: input.quantity ?? 1,
						metadata: input.metadata ?? {},
						/** A hosted page collects a typed code unless the caller closed that door. */
						allowDiscountCodes: input.allowDiscountCodes ?? true,
						idempotencyKey: input.idempotencyKey ?? null,
					},
				};

				this.#checkoutRecords.set(checkout.id, checkout);

				return success(checkout);
			},

			find: async (checkout: string) => this.#requireCheckout(checkout),

			/**
			 * Settles an open session, since a customer coming back from this
			 * provider's hosted page is a customer who paid: it provisions the
			 * customer, the order, and any subscription the price implies.
			 */
			finish: async (checkout: string) => {
				let found = this.#requireCheckout(checkout);
				if (isFailure(found)) return found;
				if (found.data.status !== "open") return success(found.data);

				return this.#settleCheckout(found.data);
			},
		};
	}

	#externalIdFor(input: CreateCheckoutInput, customer: Customer | undefined): string | null {
		if (input.customer !== undefined && "externalId" in input.customer) {
			return input.customer.externalId;
		}

		return customer?.externalId ?? null;
	}

	#resolveCheckoutDiscount(
		input: CreateCheckoutInput,
		slug: string,
	): Result<Discount | null, BillingError> {
		if (input.discount === undefined) return success(null);

		let discount = this.#discountRecords.get(input.discount);
		if (discount === undefined) return this.#fail("not_found", `no discount for ${input.discount}`);

		if (discount.productSlugs.length > 0 && !discount.productSlugs.includes(slug)) {
			return this.#fail("invalid_request", `discount ${discount.id} does not apply to ${slug}`);
		}

		return success(discount);
	}

	#requireCheckout(checkout: string): Result<Checkout, BillingError> {
		let found = this.#checkoutRecords.get(checkout);
		if (found === undefined) return this.#fail("not_found", `no checkout for ${checkout}`);
		return success(found);
	}

	#settleCheckout(checkout: Checkout): Result<Checkout, BillingError> {
		let product =
			checkout.productSlug === null ? undefined : this.#productRecords.get(checkout.productSlug);
		if (product === undefined) {
			return this.#fail("not_found", `no product for ${checkout.productSlug}`);
		}

		let customer = this.#provisionCheckoutCustomer(checkout);
		if (isFailure(customer)) return customer;

		let price = product.prices.at(0);
		let total = checkout.amount ?? { amount: 0, currency: DEFAULT_CURRENCY };
		let now = new Date();

		let subscription =
			price === undefined || price.kind === "one_time"
				? null
				: this.#openSubscription(checkout, customer.data, price, now);

		let order: Order = {
			id: this.#nextId("ord"),
			customerId: customer.data.id,
			customerEmail: customer.data.email,
			customerExternalId: customer.data.externalId,
			productSlug: checkout.productSlug,
			subscriptionId: subscription?.id ?? null,
			total,
			subtotal: price?.amount ?? total,
			tax: null,
			discountId: checkout.discountId,
			paid: true,
			refunded: null,
			createdAt: now,
			providerData: { checkoutId: checkout.id },
		};

		this.#orderRecords.set(order.id, order);

		let settled: Checkout = {
			...checkout,
			status: "completed",
			customerId: customer.data.id,
			customerExternalId: customer.data.externalId,
			orderId: order.id,
			subscriptionId: subscription?.id ?? null,
		};

		this.#checkoutRecords.set(settled.id, settled);

		return success(settled);
	}

	#provisionCheckoutCustomer(checkout: Checkout): Result<Customer, BillingError> {
		if (checkout.customerId !== null) {
			return this.#requireCustomer({ id: checkout.customerId });
		}

		let existing =
			checkout.customerExternalId === null
				? undefined
				: this.#lookupCustomer({ externalId: checkout.customerExternalId });

		if (existing !== undefined) return success(existing);

		let email = checkout.providerData.email;
		let customer: Customer = {
			id: this.#nextId("cus"),
			externalId: checkout.customerExternalId,
			email: typeof email === "string" ? email : `${checkout.id}@memory.test`,
			name: null,
			metadata: {},
			createdAt: new Date(),
			providerData: { checkoutId: checkout.id },
		};

		this.#customerRecords.set(customer.id, customer);

		return success(customer);
	}

	#openSubscription(checkout: Checkout, customer: Customer, price: Price, now: Date): Subscription {
		let subscription: Subscription = {
			id: this.#nextId("sub"),
			customerId: customer.id,
			productSlug: checkout.productSlug,
			priceId: price.id,
			status: "active",
			providerStatus: "active",
			amount: checkout.amount,
			interval: price.interval,
			currentPeriodStart: now,
			currentPeriodEnd: price.interval === null ? null : addInterval(now, price.interval),
			cancelAtPeriodEnd: false,
			canceledAt: null,
			endsAt: null,
			metadata: {},
			createdAt: now,
			providerData: { checkoutId: checkout.id },
		};

		this.#subscriptionRecords.set(subscription.id, subscription);

		return subscription;
	}

	#buildPortalApi(): PortalApi {
		return {
			create: async (input: CreatePortalInput) => {
				let customer = this.#requireCustomer(input.customer);
				if (isFailure(customer)) return customer;

				return success({
					url: `${HOSTED_ORIGIN}/portal/${customer.data.id}`,
					expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
					providerData: { returnTo: input.returnTo ?? null },
				});
			},
		};
	}

	#buildSubscriptionApi(): SubscriptionApi {
		return {
			find: async (subscription: string) => {
				let found = this.#subscriptionRecords.get(subscription);
				if (found === undefined) {
					return this.#fail("not_found", `no subscription for ${subscription}`);
				}

				return success(found);
			},

			list: async (query?: ListSubscriptionsQuery) => {
				let customer = this.#filterCustomer(query?.customer);
				if (customer === undefined) return success(emptyPage());

				let items = [...this.#subscriptionRecords.values()].filter((subscription) => {
					if (customer !== null && subscription.customerId !== customer.id) return false;
					if (query?.product !== undefined && subscription.productSlug !== query.product) {
						return false;
					}

					return query?.status === undefined || query.status.includes(subscription.status);
				});

				return this.#pageOf(items, query);
			},

			cancel: async (subscription: string, options?: { atPeriodEnd?: boolean }) => {
				let found = this.#subscriptionRecords.get(subscription);
				if (found === undefined) {
					return this.#fail("not_found", `no subscription for ${subscription}`);
				}

				let now = new Date();
				let atPeriodEnd = options?.atPeriodEnd ?? false;

				let canceled: Subscription = atPeriodEnd
					? { ...found, cancelAtPeriodEnd: true, canceledAt: now, endsAt: found.currentPeriodEnd }
					: {
							...found,
							status: "canceled",
							providerStatus: "canceled",
							cancelAtPeriodEnd: false,
							canceledAt: now,
							endsAt: now,
						};

				this.#subscriptionRecords.set(canceled.id, canceled);

				return success(canceled);
			},
		};
	}

	#buildEntitlementApi(): EntitlementApi {
		return {
			/** Computed from what is stored, so it reflects every write made so far. */
			of: async (customer: CustomerRef) => {
				let found = this.#requireCustomer(customer);
				if (isFailure(found)) return found;

				return success(this.#entitlementFor(found.data));
			},
		};
	}

	#entitlementFor(customer: Customer): EntitlementState {
		let subscriptions = [...this.#subscriptionRecords.values()].filter(
			(subscription) =>
				subscription.customerId === customer.id &&
				(subscription.status === "active" || subscription.status === "trialing"),
		);

		let purchases = [...this.#orderRecords.values()].filter(
			(order) => order.customerId === customer.id && order.paid && order.subscriptionId === null,
		);

		let held = new Set<string>();
		for (let subscription of subscriptions) {
			if (subscription.productSlug !== null) held.add(subscription.productSlug);
		}
		for (let order of purchases) if (order.productSlug !== null) held.add(order.productSlug);

		let features: Record<string, boolean> = {};
		let credits: Record<string, number> = {};

		for (let slug of held) {
			Object.assign(features, this.#productRecords.get(slug)?.features ?? {});

			for (let [meter, granted] of Object.entries(this.#creditGrants.get(slug) ?? {})) {
				credits[meter] = (credits[meter] ?? 0) + granted;
			}
		}

		return {
			customerId: customer.id,
			externalId: customer.externalId,
			products: [...held],
			features,
			meters: this.#meterBalances(customer, credits),
			subscriptions: subscriptions.map((subscription) => ({
				subscriptionId: subscription.id,
				productSlug: subscription.productSlug,
				status: subscription.status,
				currentPeriodStart: subscription.currentPeriodStart,
				currentPeriodEnd: subscription.currentPeriodEnd,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			})),
			readAt: new Date(),
			providerData: {},
		};
	}

	/** Every meter the customer was granted or has reported against, credits net of use. */
	#meterBalances(customer: Customer, credits: Record<string, number>): MeterBalance[] {
		let meters = new Set(Object.keys(credits));
		for (let record of this.#usageRecords) {
			if (recordMatchesCustomer(record, customer)) meters.add(record.name);
		}

		return [...meters].map((meter) => {
			let credited = credits[meter] ?? 0;
			let consumed = this.#consumption(customer, meter);

			return { meter, credited, consumed, balance: credited - consumed };
		});
	}

	/** Each ingested event counts as one unit, which is the count a meter reads. */
	#consumption(customer: Customer, meter: string, from?: Date, to?: Date): number {
		return this.#usageRecords.filter((record) => {
			if (record.name !== meter || !recordMatchesCustomer(record, customer)) return false;
			if (from !== undefined && record.timestamp < from) return false;

			return to === undefined || record.timestamp <= to;
		}).length;
	}

	#buildOrderApi(): OrderApi {
		return {
			find: async (order: string) => {
				let found = this.#orderRecords.get(order);
				if (found === undefined) return this.#fail("not_found", `no order for ${order}`);
				return success(found);
			},

			list: async (query?: ListOrdersQuery) => {
				let customer = this.#filterCustomer(query?.customer);
				if (customer === undefined) return success(emptyPage());

				let items = [...this.#orderRecords.values()].filter((order) => {
					if (customer !== null && order.customerId !== customer.id) return false;
					if (query?.product !== undefined && order.productSlug !== query.product) return false;

					return query?.subscription === undefined || order.subscriptionId === query.subscription;
				});

				return this.#pageOf(items, query);
			},
		};
	}

	#buildDiscountApi(): DiscountApi {
		return {
			find: async (discount: string) => {
				let found = this.#discountRecords.get(discount);
				if (found === undefined) return this.#fail("not_found", `no discount for ${discount}`);
				return success(found);
			},

			findByCode: async (code: string) => {
				for (let discount of this.#discountRecords.values()) {
					if (discount.code === code) return success(discount);
				}

				return this.#fail("not_found", `no discount for ${code}`);
			},

			list: async (query?: ListDiscountsQuery) => {
				let items = [...this.#discountRecords.values()].filter(
					(discount) =>
						query?.product === undefined ||
						discount.productSlugs.length === 0 ||
						discount.productSlugs.includes(query.product),
				);

				return this.#pageOf(items, query);
			},
		};
	}

	#buildUsageApi(): UsageApi {
		return {
			/** A repeated `externalId` is dropped, so a retried report is counted once. */
			ingest: async (events: readonly UsageEvent[]) => {
				let accepted = 0;

				for (let event of events) {
					if (event.name.length === 0) {
						return this.#fail("invalid_request", "a usage event must name a meter");
					}

					if (event.externalId !== undefined && this.#usageKeys.has(event.externalId)) continue;
					if (event.externalId !== undefined) this.#usageKeys.add(event.externalId);

					this.#usageRecords.push(this.#toUsageRecord(event));
					accepted += 1;
				}

				return success({ accepted });
			},

			/** Oldest first, which is the order the events were ingested in. */
			list: async (query?: ListUsageQuery) => {
				let customer = this.#filterCustomer(query?.customer);
				if (customer === undefined) return success(emptyPage());

				let items = this.#usageRecords.filter((record) => {
					if (customer !== null && !recordMatchesCustomer(record, customer)) return false;
					if (query?.name !== undefined && record.name !== query.name) return false;
					if (query?.from !== undefined && record.timestamp < query.from) return false;

					return query?.to === undefined || record.timestamp <= query.to;
				});

				return this.#pageOf(items, query);
			},
		};
	}

	#toUsageRecord(event: UsageEvent): UsageRecord {
		let customer = this.#lookupCustomer(event.customer);

		return {
			id: this.#nextId("evt"),
			name: event.name,
			customerId: customer?.id ?? ("id" in event.customer ? event.customer.id : null),
			customerExternalId:
				"externalId" in event.customer ? event.customer.externalId : (customer?.externalId ?? null),
			externalId: event.externalId ?? null,
			timestamp: event.timestamp ?? new Date(),
			metadata: { ...event.metadata },
			cost: event.cost ?? null,
			providerData: {},
		};
	}

	#buildMeterApi(): MeterApi {
		return {
			quantities: async (query: MeterQuantityQuery) => {
				let matched: Customer | null = null;

				if (query.customer !== undefined) {
					let found = this.#requireCustomer(query.customer);
					if (isFailure(found)) return found;
					matched = found.data;
				}

				let quantity =
					matched === null
						? this.#usageRecords.filter((record) => record.name === query.meter).length
						: this.#consumption(matched, query.meter, query.from, query.to);

				return success({
					meter: query.meter,
					customerId: matched?.id ?? null,
					quantity,
					cost: null,
					from: query.from,
					to: query.to,
					providerData: {},
				});
			},
		};
	}

	#buildWebhookApi(): MemoryWebhookApi {
		return {
			/** Standard Webhooks headers over the exact bytes received. */
			verify: async (request: Request, rawBody: string) => {
				let replayed = new Request(request.url, {
					method: "POST",
					headers: request.headers,
					body: rawBody,
				});

				let verified = await verify(replayed, { secret: this.#webhookSecret });

				return !isFailure(verified);
			},

			reference: (request: Request, rawBody: string) => this.#referenceOf(request, rawBody),

			event: async (_request: Request, rawBody: string) => this.#eventOf(rawBody),

			emit: async (payload: MemoryEmitEvent) => {
				let envelope = this.#envelopeFor(payload);

				let signed = await sign(envelope, {
					secret: this.#webhookSecret,
					id: envelope.id,
					timestamp: new Date(),
				});

				if (isFailure(signed)) {
					return this.#fail("invalid_request", `unusable webhook secret: ${signed.error.message}`);
				}

				let event = this.#eventOf(signed.data.body);
				if (isFailure(event)) return event;

				return success({
					request: new Request(`${HOSTED_ORIGIN}/webhooks/billing`, {
						method: "POST",
						headers: signed.data.headers,
						body: signed.data.body,
					}),
					body: signed.data.body,
					headers: signed.data.headers,
					event: event.data,
				});
			},
		};
	}

	#envelopeFor(payload: MemoryEmitEvent): { id: string; type: string; data: unknown } {
		let id = payload.id ?? this.#nextId("whk");

		if (payload.type === "unrecognized") return { id, type: payload.providerType, data: {} };
		if ("customer" in payload) return { id, type: payload.type, data: payload.customer };
		if ("checkout" in payload) return { id, type: payload.type, data: payload.checkout };
		if ("subscription" in payload) return { id, type: payload.type, data: payload.subscription };

		return { id, type: payload.type, data: payload.order };
	}

	/**
	 * Reads the delivery id from the signing header the emitter sets, so a
	 * redelivery of one object is told apart from a fresh change to it.
	 */
	#referenceOf(request: Request, rawBody: string): WebhookReference | null {
		let delivery = this.#parseEnvelope(rawBody);
		if (delivery === null) return null;

		let deliveryId = request.headers.get(DELIVERY_ID_HEADER) ?? delivery.id;

		return { deliveryId, object: { id: delivery.id, type: delivery.type } };
	}

	/** Keeps the parsed body beside the envelope, so an event carries `raw` untouched. */
	#parseEnvelope(rawBody: string): Delivery | null {
		let raw: unknown;

		try {
			raw = JSON.parse(rawBody);
		} catch {
			return null;
		}

		let parsed = s.parseSafe(ENVELOPE_SCHEMA, raw);
		if (!parsed.success) return null;

		return { id: parsed.value.id, type: parsed.value.type, data: parsed.value.data, raw };
	}

	/**
	 * Normalizes a delivery, keeping its payload on the event so a handler that
	 * needs a field this contract omits can still reach it.
	 */
	#eventOf(rawBody: string): Result<BillingEvent, BillingError> {
		let delivery = this.#parseEnvelope(rawBody);
		if (delivery === null) return this.#fail("invalid_request", "unreadable delivery body");

		let { id, raw, data, type } = delivery;

		switch (type) {
			case "customer.created":
			case "customer.updated": {
				let customer = s.parseSafe(CUSTOMER_SCHEMA, data);
				if (!customer.success) return this.#unmappable(type);

				return success({ id, raw, type, customer: customer.value });
			}

			case "checkout.completed": {
				let checkout = s.parseSafe(CHECKOUT_SCHEMA, data);
				if (!checkout.success) return this.#unmappable(type);

				return success({ id, raw, type, checkout: checkout.value });
			}

			case "subscription.activated":
			case "subscription.updated":
			case "subscription.canceled":
			case "subscription.revoked": {
				let subscription = s.parseSafe(SUBSCRIPTION_SCHEMA, data);
				if (!subscription.success) return this.#unmappable(type);

				return success({ id, raw, type, subscription: subscription.value });
			}

			case "order.paid":
			case "order.refunded": {
				let order = s.parseSafe(ORDER_SCHEMA, data);
				if (!order.success) return this.#unmappable(type);

				return success({ id, raw, type, order: order.value });
			}

			default: {
				return success({ id, raw, type: "unrecognized", providerType: type });
			}
		}
	}

	#unmappable(type: string): Result<never, BillingError> {
		return this.#fail("invalid_request", `unmappable ${type} payload`);
	}
}
