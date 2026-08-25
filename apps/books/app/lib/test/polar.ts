/**
 * Test-only fake billing client plus the fixture builders the funnel's tests need.
 * Records every checkout it was asked to create and answers customer, order, discount,
 * and webhook lookups from a script, so a test can assert what a buyer is charged and
 * where they are sent using only scripted answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	CheckoutSessionOptions,
	CheckoutSessionResult,
	Customer,
	Discount,
	Order,
	PolarWebhookEvent,
	Product as PolarProduct,
} from "@pkg/polar";
import type { Result } from "@pkg/result";

import { PolarClient } from "@pkg/polar";

/**
 * Builds a product fixture carrying one price.
 *
 * The amount is in **cents**, as Polar reports it: a fixture written in dollars would make
 * every price assertion pass while the page rendered a hundred times the real number.
 *
 * @param cents - The product's price, in cents.
 * @returns A product the sales page can read a price off.
 */
export function makeProduct(cents: number): PolarProduct {
	return { prices: [{ priceAmount: cents }] } as unknown as PolarProduct;
}

/** The fields of a discount the selection rules actually read. */
export interface DiscountFixture {
	/** The Polar discount id, which is what the campaign allow-list matches on. */
	id: string;
	/** Display name, only ever logged. */
	name?: string;
	/** The amount taken off, in cents — the sales page subtracts it from the list price. */
	amount?: number;
	/** When the campaign opens; `null` means it always has. */
	startsAt?: Date | null;
	/** When the campaign closes; `null` means it never does. */
	endsAt?: Date | null;
	/** Redemption cap; `null` means uncapped. */
	maxRedemptions?: number | null;
	/** Redemptions used so far. */
	redemptionsCount?: number;
	/** The product ids the campaign is scoped to. */
	products?: string[];
}

/**
 * Builds a discount fixture with only the fields a selection rule reads —
 * Polar's `Discount` carries about forty unrelated fields that would
 * otherwise bury the one or two each test is actually about.
 *
 * @param fixture - The fields under test.
 * @returns A discount the selection rules can be run against.
 */
export function makeDiscount(fixture: DiscountFixture): Discount {
	return {
		id: fixture.id,
		name: fixture.name ?? "Test discount",
		amount: fixture.amount ?? 0,
		startsAt: fixture.startsAt ?? null,
		endsAt: fixture.endsAt ?? null,
		maxRedemptions: fixture.maxRedemptions ?? null,
		redemptionsCount: fixture.redemptionsCount ?? 0,
		products: (fixture.products ?? []).map((id) => ({ id })),
	} as unknown as Discount;
}

/**
 * Builds an order fixture. Only the product it is for matters, since every
 * caller checks whether a customer holds any order for that product.
 *
 * @param productId - The Polar product the order is for.
 * @returns An order the fake's `listOrders` can filter on.
 */
export function makeOrder(productId: string): Order {
	return { id: `order_${productId}`, productId } as unknown as Order;
}

/**
 * Builds a customer fixture. Only the id and email are read: the id goes onto the
 * upgrade checkout, the email is what the customer was looked up by.
 *
 * @param id - The Polar customer id.
 * @param email - The customer's email address.
 * @returns A customer the fake's `findCustomerByEmail` can answer with.
 */
export function makeCustomer(id: string, email: string): Customer {
	return { id, email } as unknown as Customer;
}

/** The fields of an `order.paid` event the webhook reads. */
export interface OrderPaidFixture {
	/** The purchased product's Polar id, or `null` to model the missing-product case. */
	productId?: string | null;
	/** The purchased product's display name, which is logged. */
	productName?: string;
	/** The buyer's address, or `null` to model the missing-email case. */
	email?: string | null;
}

/**
 * Builds an `order.paid` webhook event. Like the other fixtures it declares only the
 * fields the handler reads: a real Polar order payload nests dozens of currency and
 * timestamp fields that no branch here looks at.
 *
 * @param fixture - The fields under test.
 * @returns An event the webhook handler can be run against.
 */
export function makeOrderPaidEvent(fixture: OrderPaidFixture = {}): PolarWebhookEvent {
	let productId = fixture.productId === undefined ? "product_1" : fixture.productId;

	return {
		type: "order.paid",
		data: {
			product: productId === null ? null : { id: productId, name: fixture.productName ?? "Book" },
			customer: { email: fixture.email === undefined ? "buyer@example.com" : fixture.email },
		},
	} as unknown as PolarWebhookEvent;
}

/**
 * Builds a webhook event of an unrecognized type, so a test can confirm the
 * funnel answers it with success and Polar considers the delivery complete.
 *
 * @param type - The Polar event type to model.
 * @returns An event the webhook handler can be run against.
 */
export function makeEvent(type: string): PolarWebhookEvent {
	return { type, data: {} } as unknown as PolarWebhookEvent;
}

/** How the fake should answer each lookup. */
export interface FakePolarClientOptions {
	/** Products `getProduct` answers with, keyed by Polar product id. */
	products?: Record<string, PolarProduct>;
	/** Discounts `listDiscounts` returns, in order. */
	discounts?: Discount[];
	/** Customers `findCustomerByEmail` knows, keyed by email. */
	customers?: Record<string, Customer>;
	/** Orders `listOrders` filters, across every customer. */
	orders?: Order[];
	/** The hosted checkout URL `createCheckout` answers with. */
	checkoutUrl?: string;
	/** The result `parseWebhook` returns, letting a test script a rejected signature. */
	webhook?: Result<PolarWebhookEvent, Error>;
	/** When set, every read raises this error. */
	throws?: Error;
	/**
	 * When set, only `listDiscounts` throws, letting a test model the sales
	 * page's degraded path — prices load but the campaign lookup fails — as
	 * its own scripted case.
	 */
	discountsThrow?: Error;
}

/**
 * A {@link PolarClient} stand-in. Extends the real class so it satisfies the
 * container's class key, but overrides every method the funnel calls and
 * answers entirely from the script above.
 */
export class FakePolarClient extends PolarClient {
	/** Checkout options passed to `createCheckout`, in order. */
	readonly checkouts: CheckoutSessionOptions[] = [];
	/** Order filters passed to `listOrders`, in order. */
	readonly orderQueries: Array<{ customerId?: string; productId?: string }> = [];

	private readonly options: FakePolarClientOptions;

	/**
	 * @param options - Scripted answers for this fake.
	 */
	constructor(options: FakePolarClientOptions = {}) {
		super({ accessToken: "fake" });
		this.options = options;
	}

	/** @returns The scripted product for this id, or a product priced at zero. */
	override async getProduct(productId: string): Promise<PolarProduct> {
		if (this.options.throws) throw this.options.throws;
		return this.options.products?.[productId] ?? makeProduct(0);
	}

	/** @returns The scripted discount list. */
	override async listDiscounts(): Promise<Discount[]> {
		if (this.options.discountsThrow) throw this.options.discountsThrow;
		if (this.options.throws) throw this.options.throws;
		return this.options.discounts ?? [];
	}

	/** @returns The scripted customer for this address, or `null`. */
	override async findCustomerByEmail(email: string): Promise<Customer | null> {
		if (this.options.throws) throw this.options.throws;
		return this.options.customers?.[email] ?? null;
	}

	/** @returns The scripted orders matching the filter. */
	override async listOrders(query: { customerId?: string; productId?: string }): Promise<Order[]> {
		if (this.options.throws) throw this.options.throws;
		this.orderQueries.push(query);
		let orders = this.options.orders ?? [];
		if (!query.productId) return orders;
		return orders.filter((order) => order.productId === query.productId);
	}

	/** Records the checkout and answers with the scripted URL. */
	override async createCheckout(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
		if (this.options.throws) throw this.options.throws;
		this.checkouts.push(options);
		return { url: this.options.checkoutUrl ?? "https://polar.test/checkout", id: "checkout_1" };
	}

	/** @returns The scripted parse result, standing in for signature verification. */
	override async parseWebhook(): Promise<Result<PolarWebhookEvent, Error>> {
		let webhook = this.options.webhook;
		if (!webhook) throw new Error("FakePolarClient was not given a webhook result");
		return webhook;
	}
}
