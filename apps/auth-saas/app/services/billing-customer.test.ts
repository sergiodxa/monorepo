/**
 * Exercises `ensureProviderCustomer`'s three paths (ADR-018): a fresh join, a
 * conflict resolved by re-reading the provider's own record, and an adoption
 * of a provider customer the platform already held under this email. Drives
 * `MemoryBilling` directly rather than mocking, per the package's own testing
 * pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import Customer from "~/app/models/customer";
import { createTestDatabase } from "~/app/test/db";

import { ensureProviderCustomer } from "./billing-customer";

let db: Database;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	billing = new MemoryBilling({
		catalog: { pro: { amount: 4900, currency: "usd", interval: "month" } },
	});
});

describe("ensureProviderCustomer", () => {
	test("creates a provider customer and joins it when the customer has none yet", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		let joined = await ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" });
		expect(isSuccess(joined)).toBe(true);
		if (isFailure(joined)) throw new Error("unreachable");

		let providerCustomer = await unwrap(billing.customers.find({ externalId: customer.id }));
		expect(providerCustomer.id).toBe(joined.data.providerCustomerId);
		expect(providerCustomer.email).toBe("jane@example.com");

		let row = await Customer.findById(db, customer.id);
		expect(row?.provider_customer_id).toBe(joined.data.providerCustomerId);
		expect(row?.provider_connection).toBe("memory");
	});

	test("skips creating another provider customer once already joined", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		await Customer.joinProviderCustomer(db, customer.id, {
			connection: "memory",
			providerCustomerId: "cus_existing",
		});
		let joinedCustomer = await Customer.findById(db, customer.id);
		if (!joinedCustomer) throw new Error("unreachable");

		billing.fail("customers.create");

		let joined = await ensureProviderCustomer(db, billing, joinedCustomer, {
			email: "jane@example.com",
		});

		expect(joined).toEqual({ status: "success", data: { providerCustomerId: "cus_existing" } });
	});

	test("re-reads by externalId when create conflicts with its own retry", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		// A first attempt that reached the provider but never made it back to D1.
		let precreated = await unwrap(
			billing.customers.create({ email: "jane@example.com", externalId: customer.id }),
		);

		let joined = await ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" });
		expect(isSuccess(joined)).toBe(true);
		if (isFailure(joined)) throw new Error("unreachable");

		expect(joined.data.providerCustomerId).toBe(precreated.id);

		let row = await Customer.findById(db, customer.id);
		expect(row?.provider_customer_id).toBe(precreated.id);
	});

	test("adopts a provider customer already holding this email but no externalId", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		// An out-of-band checkout with no customer/externalId provisions a bare
		// provider customer under this email, the way a record a support agent
		// created directly on the platform would.
		let opened = await unwrap(
			billing.checkouts.create({ product: "pro", email: "jane@example.com" }),
		);
		await unwrap(billing.checkouts.finish(opened.id));

		let joined = await ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" });
		expect(isSuccess(joined)).toBe(true);
		if (isFailure(joined)) throw new Error("unreachable");

		let providerCustomer = await unwrap(billing.customers.find({ externalId: customer.id }));
		expect(providerCustomer.id).toBe(joined.data.providerCustomerId);
		expect(providerCustomer.email).toBe("jane@example.com");
	});
});
