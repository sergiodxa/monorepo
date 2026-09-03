/**
 * Test support for the billing paths: a view over an in-memory platform whose customer
 * calls are all refused, so a test drives what this server does while billing is
 * unreachable. Every other group still answers from memory, and the platform handed in
 * stays readable through its own reference, so a test asserts on what was not written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, BillingErrorCode, CustomerApi } from "@pkg/billing";
import type { MemoryBilling } from "@pkg/billing/providers/memory";

import { BillingError } from "@pkg/billing";
import { failure } from "@pkg/result";

/**
 * Wraps a platform so every customer call answers a failure.
 *
 * @param platform - The platform answering every other group.
 * @param code - The reason the refused calls report, such as `unknown` for an outage.
 * @returns The platform as a route or a service sees it.
 */
export function refusingCustomers(platform: MemoryBilling, code: BillingErrorCode): Billing {
	let refuse = async () =>
		failure(
			new BillingError("the billing platform refused the call", {
				code,
				connection: platform.connection,
			}),
		);

	let customers: CustomerApi = {
		create: refuse,
		update: refuse,
		find: refuse,
		findByEmail: refuse,
		list: refuse,
	};

	return {
		connection: platform.connection,
		customers,
		catalog: platform.catalog,
		checkouts: platform.checkouts,
		subscriptions: platform.subscriptions,
		entitlements: platform.entitlements,
		orders: platform.orders,
		webhooks: platform.webhooks,
		portal: platform.portal,
		discounts: platform.discounts,
		usage: platform.usage,
		meters: platform.meters,
		native: platform.native,
	};
}
