/**
 * Exercises `openPortal` against `MemoryBilling` (ADR-018): a tenant with a
 * joined provider customer opens the hosted portal; one without either answers
 * why not, rather than reaching the platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { ensureProviderCustomer } from "~/app/services/billing-customer";
import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";

import { openPortal } from "./billing-portal";

let db: Database;
let models: Models;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);
	billing = new MemoryBilling();
});

describe("openPortal", () => {
	test("opens the hosted portal for a tenant's owning customer", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		await ensureProviderCustomer(models, billing, customer, { email: "jane@example.com" });

		let opened = await openPortal(models, billing, { tenantId: tenant.id });

		expect(opened.ok).toBe(true);
		if (!opened.ok) throw new Error("unreachable");
		expect(opened.url).toMatch(/^https:\/\//);
	});

	test("answers no_provider_customer for a tenant with no billing relationship yet", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);

		let opened = await openPortal(models, billing, { tenantId: tenant.id });

		expect(opened).toEqual({ ok: false, reason: "no_provider_customer" });
	});

	test("answers tenant_not_found for an unknown tenant", async () => {
		let opened = await openPortal(models, billing, { tenantId: "ten_missing" });

		expect(opened).toEqual({ ok: false, reason: "tenant_not_found" });
	});
});
