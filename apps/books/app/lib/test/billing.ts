/**
 * Test-only billing platform: a real in-memory implementation seeded with this
 * funnel's own catalog, so a test drives the same flow production does and
 * asserts on what the platform recorded rather than on a scripted answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Order } from "@sdxc/billing";
import type { MemoryBillingOptions } from "@sdxc/billing/providers/memory";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";

import { Product } from "~/app/data/product";

/** The two live prices, in cents, as the platform states them. */
export const ESSENTIALS_CENTS = 4900;
export const COMPLETE_CENTS = 9900;

/**
 * Builds a platform selling both packages outright, which is what every page
 * that quotes a price needs before it can render.
 *
 * @param options - Discounts, connection, or a catalog replacing the packages.
 * @returns The seeded platform, ready to bill against.
 * @example let billing = memoryBilling({ discounts: [{ id: Discounts.UPGRADE }] });
 */
export function memoryBilling(options: MemoryBillingOptions = {}): MemoryBilling {
	return new MemoryBilling({
		catalog: {
			[Product.Essentials]: { amount: ESSENTIALS_CENTS, name: "The Book" },
			[Product.Complete]: { amount: COMPLETE_CENTS, name: "Complete Package" },
		},
		...options,
	});
}

/**
 * A platform whose campaigns cannot be read, which is the degraded path every
 * page that quotes a price has to survive: the sale goes through at list price.
 *
 * @param billing - The platform to answer everything else.
 * @returns The same platform, reporting an unreadable campaign list.
 */
export function withUnreadableDiscounts(billing: MemoryBilling): MemoryBilling {
	billing.fail("discounts.list", "unknown");

	return billing;
}

/**
 * Buys a package outright, which is how a test gets a customer with a real
 * order behind them for the upgrade gate and the paid-order delivery.
 *
 * @param billing - The platform to buy on.
 * @param product - The package to buy, by its catalog slug.
 * @param email - The buyer's address, which the customer is created with.
 * @returns The paid order.
 */
export async function purchase(
	billing: MemoryBilling,
	product: string,
	email: string,
): Promise<Order> {
	let customer = await unwrap(billing.customers.create({ email, externalId: email }));
	let opened = await unwrap(billing.checkouts.create({ product, customer: { id: customer.id } }));
	let checkout = await unwrap(billing.checkouts.finish(opened.id));

	return await unwrap(billing.orders.find(checkout.orderId ?? ""));
}
