/**
 * The suite that says what a provider is: the universal core every platform
 * must answer the same way, registered as Vitest tests against whatever the
 * caller constructs. Optional groups are asserted by their own functions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Billing } from "../core/contract.js";
import type { OptionalCapability } from "../core/supports.js";
import type { Currency, Price } from "../core/types.js";

import { BillingError } from "../core/errors.js";
import { OPTIONAL_CAPABILITIES, supports } from "../core/supports.js";
import { minorUnitDigits } from "../core/types.js";

/** Page size the paging assertions ask for, small enough to force a second page. */
const SMALL_PAGE = 2;

/** Records the paging assertions create, one more than a page holds. */
const PAGED_RECORDS = 3;

/** Pages a walk follows before it gives up, so a populated account cannot hang a run. */
const MAX_WALKED_PAGES = 50;

/** The window a meter read asks about, wide enough to cover a run's own ingestion. */
const METER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Factor a provider that mistook whole units for minor units would be off by. */
const MINOR_UNIT_SCALE = 100;

/** A product the suite expects to find in the provider's catalog, at a known price. */
export interface ConformanceProduct {
	/** Our own name for it, as the provider under test is configured. */
	slug: string;
	/** Minor units the catalog prices it at. */
	amount: number;
	currency: Currency;
	/**
	 * Which price carries that amount, by its own id. A catalog whose product
	 * sells several prices has to name one, since the contract defines no order
	 * for them; omitting it asserts that some price carries the amount.
	 */
	priceId?: string;
}

/**
 * Identifiers that are well-formed for the platform under test and name
 * nothing on it, which is what a missing-resource assertion needs: a malformed
 * id is refused as a bad request long before the platform looks anything up.
 */
export interface ConformanceMissingIds {
	customer?: string;
	checkout?: string;
	subscription?: string;
	order?: string;
	discount?: string;
}

/** What the suite needs to exercise a provider. */
export interface ConformanceOptions {
	/** Provider name, which labels the registered suites. */
	name: string;

	/**
	 * Builds the provider under test. It is called for every test, so a provider
	 * backed by mutable state starts each one clean.
	 */
	create(): Billing | Promise<Billing>;

	/** A recurring product in the catalog. */
	subscription: ConformanceProduct;

	/**
	 * A product priced in a currency with no minor units, so a provider that
	 * assumes cents fails here, where a suite catches it.
	 */
	zeroDecimal: ConformanceProduct;

	/** Meter to ask about; required of a provider that declares the meters group. */
	meter?: string;

	/**
	 * Ids the platform accepts the shape of and holds no record for. The default
	 * is a fresh UUID per call, which every platform in scope reads as absent
	 * rather than malformed.
	 */
	missing?: ConformanceMissingIds;

	/**
	 * Builds an unused email address. The default is unique per call, which is
	 * what keeps a run against a shared sandbox from colliding with the last one.
	 */
	email?(): string;
}

/** Unique enough that two runs against the same organization stay distinct. */
function uniqueSuffix(): string {
	return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Reads the email factory the caller supplied, or the unique default. */
function emailFrom(options: ConformanceOptions): string {
	return options.email?.() ?? `conformance-${uniqueSuffix()}@example.com`;
}

/** Reads the absent id the caller named for one resource, or a fresh UUID. */
function missingId(options: ConformanceOptions, resource: keyof ConformanceMissingIds): string {
	return options.missing?.[resource] ?? crypto.randomUUID();
}

/** A provider with every optional group present, which is what a probe needs. */
type FullBilling = Billing & Required<Pick<Billing, OptionalCapability>>;

/**
 * The cheapest real call each capability group offers, so a declaration can be
 * checked against behavior. Adding a group to the contract without a probe
 * here fails to typecheck, which keeps the check honest as the contract grows.
 */
const CAPABILITY_PROBES: {
	[Capability in OptionalCapability]: (
		billing: FullBilling,
		options: ConformanceOptions,
	) => Promise<Result<unknown, BillingError>>;
} = {
	portal: async (billing, options) =>
		billing.portal.create({ customer: { id: missingId(options, "customer") } }),

	discounts: async (billing) => billing.discounts.list({ limit: 1 }),

	usage: async (billing) => billing.usage.list({ limit: 1 }),

	meters: async (billing, options) => {
		if (options.meter === undefined) {
			throw new Error(`${options.name} declares "meters", so the options must name a meter`);
		}

		let to = new Date();

		return billing.meters.quantities({
			meter: options.meter,
			from: new Date(to.getTime() - METER_WINDOW_MS),
			to,
			interval: "day",
		});
	},
};

/** Asserts a failing call reported the expected normalized code and connection. */
function expectFailure(
	billing: Billing,
	result: Result<unknown, BillingError>,
	code: BillingError["code"],
): void {
	expect(result.status).toBe("failure");
	if (!isFailure(result)) return;

	expect(result.error).toBeInstanceOf(BillingError);
	expect(result.error.code).toBe(code);
	expect(result.error.connection).toBe(billing.connection);
	expect(result.error.retryable).toBe(false);
}

/**
 * Reads the price carrying a product's expected amount, by its own id rather
 * than by where it sits in the list, since the contract orders prices nowhere.
 *
 * @param prices - Every price the product sells, in whatever order it reported them.
 * @param expected - The product the suite was configured with.
 * @returns The price, or `undefined` when none of them carries the amount.
 */
function priceOf(prices: readonly Price[], expected: ConformanceProduct): Price | undefined {
	if (expected.priceId !== undefined) {
		return prices.find((price) => price.id === expected.priceId);
	}

	return prices.find((price) => price.amount?.amount === expected.amount);
}

/**
 * Registers the required core: the assertions every provider must pass, and
 * nothing that depends on a platform-specific shape or an optional group.
 *
 * @param options - The provider factory plus the catalog it is configured with.
 *
 * @example
 * conformance({ name: "memory", create: () => new MemoryBilling({ catalog: CATALOG }), ... });
 */
export function conformance(options: ConformanceOptions): void {
	describe(`${options.name} billing conformance`, () => {
		test("states the connection it bills against", async () => {
			let billing = await options.create();

			expect(billing.connection.length).toBeGreaterThan(0);
			expect(billing.native).toBeDefined();
		});

		test("round-trips a customer by both of its identifiers", async () => {
			let billing = await options.create();
			let externalId = `subject_${uniqueSuffix()}`;
			let email = emailFrom(options);

			let created = await unwrap(billing.customers.create({ email, externalId }));

			expect(created.externalId).toBe(externalId);
			expect(created.email).toBe(email);
			expect(created.createdAt).toBeInstanceOf(Date);

			let byId = await unwrap(billing.customers.find({ id: created.id }));

			expect(byId.id).toBe(created.id);

			// The external-id arm is optional, so a platform holding no reference
			// field of its own answers `unsupported` instead of a record.
			let byExternalId = await billing.customers.find({ externalId });

			if (isFailure(byExternalId)) expect(byExternalId.error.code).toBe("unsupported");
			else expect(byExternalId.data.id).toBe(created.id);
		});

		test("reports a missing customer as a not_found failure", async () => {
			let billing = await options.create();

			expectFailure(
				billing,
				await billing.customers.find({ id: missingId(options, "customer") }),
				"not_found",
			);
		});

		test("reads the catalog by our own slugs", async () => {
			let billing = await options.create();

			let product = await unwrap(billing.catalog.find(options.subscription.slug));

			expect(product.slug).toBe(options.subscription.slug);
			expect(product.prices.length).toBeGreaterThan(0);

			let price = priceOf(product.prices, options.subscription);

			expect(price).toBeDefined();
			expect(price?.amount).toEqual({
				amount: options.subscription.amount,
				currency: options.subscription.currency,
			});

			let page = await unwrap(billing.catalog.list({ limit: 1 }));

			expect(page.items.length).toBeLessThanOrEqual(1);
			expectFailure(billing, await billing.catalog.find(`missing_${uniqueSuffix()}`), "not_found");
		});

		test("round-trips money through a zero-decimal currency without scaling it", async () => {
			let billing = await options.create();
			let expected = options.zeroDecimal;

			expect(minorUnitDigits(expected.currency)).toBe(0);

			let product = await unwrap(billing.catalog.find(expected.slug));
			let price = priceOf(product.prices, expected);

			expect(price?.amount).toEqual({ amount: expected.amount, currency: expected.currency });

			// A provider that treated the platform's whole units as minor units, or
			// the other way around, reports the amount off by exactly this factor.
			expect(price?.amount?.amount).not.toBe(expected.amount * MINOR_UNIT_SCALE);
			expect(price?.amount?.amount).not.toBe(expected.amount / MINOR_UNIT_SCALE);

			let customer = await unwrap(
				billing.customers.create({
					email: emailFrom(options),
					externalId: `subject_${uniqueSuffix()}`,
				}),
			);

			let checkout = await unwrap(
				billing.checkouts.create({ product: expected.slug, customer: { id: customer.id } }),
			);

			if (checkout.amount !== null) {
				expect(Number.isInteger(checkout.amount.amount)).toBe(true);
				expect(checkout.amount.amount).toBe(expected.amount);
				expect(checkout.amount.currency).toBe(expected.currency);
			}
		});

		test("opens a hosted checkout and reads it back", async () => {
			let billing = await options.create();

			let customer = await unwrap(
				billing.customers.create({
					email: emailFrom(options),
					externalId: `subject_${uniqueSuffix()}`,
				}),
			);

			let checkout = await unwrap(
				billing.checkouts.create({
					product: options.subscription.slug,
					customer: { id: customer.id },
					returnTo: "https://example.com/thanks",
				}),
			);

			expect(checkout.status).toBe("open");
			expect(checkout.productSlug).toBe(options.subscription.slug);
			expect(checkout.url).not.toBeNull();
			if (checkout.url !== null) expect(new URL(checkout.url).protocol).toBe("https:");

			let read = await unwrap(billing.checkouts.find(checkout.id));

			expect(read.id).toBe(checkout.id);
			expectFailure(
				billing,
				await billing.checkouts.find(missingId(options, "checkout")),
				"not_found",
			);
		});

		test("answers one snapshot of what a customer holds", async () => {
			let billing = await options.create();

			let customer = await unwrap(
				billing.customers.create({
					email: emailFrom(options),
					externalId: `subject_${uniqueSuffix()}`,
				}),
			);

			let state = await unwrap(billing.entitlements.of({ id: customer.id }));

			expect(state.customerId).toBe(customer.id);
			expect(Array.isArray(state.products)).toBe(true);
			expect(Array.isArray(state.meters)).toBe(true);
			expect(Array.isArray(state.subscriptions)).toBe(true);
			expect(typeof state.features).toBe("object");
			expect(state.readAt).toBeInstanceOf(Date);

			expectFailure(
				billing,
				await billing.entitlements.of({ id: missingId(options, "customer") }),
				"not_found",
			);
		});

		test("lists one page at a time, and walks every page on request", async () => {
			let billing = await options.create();

			let created: string[] = [];
			for (let index = 0; index < PAGED_RECORDS; index++) {
				let customer = await unwrap(
					billing.customers.create({
						email: emailFrom(options),
						externalId: `subject_${uniqueSuffix()}`,
					}),
				);

				created.push(customer.id);
			}

			let page = await unwrap(billing.customers.list({ limit: SMALL_PAGE }));

			expect(page.items.length).toBeLessThanOrEqual(SMALL_PAGE);
			expect(page.cursor).not.toBeNull();

			let seen = new Set(page.items.map((customer) => customer.id));
			let cursor = page.cursor ?? undefined;

			for (let walked = 0; walked < MAX_WALKED_PAGES && cursor !== undefined; walked++) {
				let next = await unwrap(billing.customers.list({ limit: SMALL_PAGE, cursor }));
				for (let customer of next.items) seen.add(customer.id);
				cursor = next.cursor ?? undefined;
				if (created.every((id) => seen.has(id))) break;
			}

			for (let id of created) expect(seen.has(id)).toBe(true);
		});

		test("reports orders and subscriptions as pages of our own models", async () => {
			let billing = await options.create();

			for (let page of [
				await unwrap(billing.orders.list({ limit: 1 })),
				await unwrap(billing.subscriptions.list({ limit: 1 })),
			]) {
				expect(Array.isArray(page.items)).toBe(true);
				expect(page.items.length).toBeLessThanOrEqual(1);
			}

			expectFailure(billing, await billing.orders.find(missingId(options, "order")), "not_found");
			expectFailure(
				billing,
				await billing.subscriptions.find(missingId(options, "subscription")),
				"not_found",
			);
		});

		test("reports cancelling a subscription nobody holds as not_found", async () => {
			let billing = await options.create();
			let missing = missingId(options, "subscription");

			expectFailure(billing, await billing.subscriptions.cancel(missing), "not_found");

			// A platform that can only end a subscription at once says so rather
			// than pretending the paid period will be honoured.
			let deferred = await billing.subscriptions.cancel(missing, { atPeriodEnd: true });

			expect(deferred.status).toBe("failure");
			if (isFailure(deferred)) {
				expect(["not_found", "unsupported"]).toContain(deferred.error.code);
			}
		});

		test("fails an unproven delivery closed, and reports an unreadable payload", async () => {
			let billing = await options.create();
			let body = JSON.stringify({ type: "order.paid", id: "evt_unsigned" });

			let unsigned = new Request("https://example.com/webhooks/billing", {
				method: "POST",
				body,
			});

			let unreadable = new Request("https://example.com/webhooks/billing", {
				method: "POST",
				body: "not-json",
			});

			expect(await billing.webhooks.verify(unsigned, body)).toBe(false);
			expect(billing.webhooks.reference(unreadable, "not-json")).toBeNull();
			expectFailure(
				billing,
				await billing.webhooks.event(unreadable, "not-json"),
				"invalid_request",
			);
		});
	});
}

/**
 * Registers the portal group's own assertions, which only a provider declaring
 * `portal` runs.
 *
 * @param options - The provider factory plus whatever the group needs.
 */
export function portalConformance(options: ConformanceOptions): void {
	describe(`${options.name} portal conformance`, () => {
		test("opens a hosted portal session for a known customer", async () => {
			let billing = await options.create();

			expect(supports(billing, "portal")).toBe(true);
			if (!supports(billing, "portal")) return;

			let customer = await unwrap(
				billing.customers.create({
					email: emailFrom(options),
					externalId: `subject_${uniqueSuffix()}`,
				}),
			);

			let session = await unwrap(billing.portal.create({ customer: { id: customer.id } }));

			expect(new URL(session.url).protocol).toBe("https:");
			expectFailure(
				billing,
				await billing.portal.create({ customer: { id: missingId(options, "customer") } }),
				"not_found",
			);
		});
	});
}

/**
 * Registers the discount group's own assertions, which only a provider
 * declaring `discounts` runs.
 *
 * @param options - The provider factory plus whatever the group needs.
 */
export function discountConformance(options: ConformanceOptions): void {
	describe(`${options.name} discount conformance`, () => {
		test("reports discounts as a page, and a missing one as not_found", async () => {
			let billing = await options.create();

			expect(supports(billing, "discounts")).toBe(true);
			if (!supports(billing, "discounts")) return;

			let page = await unwrap(billing.discounts.list({ limit: 1 }));

			expect(Array.isArray(page.items)).toBe(true);
			expect(page.items.length).toBeLessThanOrEqual(1);

			expectFailure(
				billing,
				await billing.discounts.find(missingId(options, "discount")),
				"not_found",
			);
		});
	});
}

/**
 * Registers the usage group's own assertions, which only a provider declaring
 * `usage` runs.
 *
 * @param options - The provider factory plus whatever the group needs.
 */
export function usageConformance(options: ConformanceOptions): void {
	describe(`${options.name} usage conformance`, () => {
		test("counts a resent usage event once", async () => {
			let billing = await options.create();
			let externalId = `subject_${uniqueSuffix()}`;
			let meter = `conformance_${uniqueSuffix()}`;

			expect(supports(billing, "usage")).toBe(true);
			if (!supports(billing, "usage")) return;

			await unwrap(billing.customers.create({ email: emailFrom(options), externalId }));

			let event = { name: meter, customer: { externalId }, externalId: `use_${uniqueSuffix()}` };

			let first = await unwrap(billing.usage.ingest([event]));

			expect(first.accepted).toBe(1);

			await unwrap(billing.usage.ingest([event]));

			let counted = await unwrap(billing.usage.list({ customer: { externalId }, name: meter }));

			expect(counted.items).toHaveLength(1);
			expect(counted.items.at(0)?.externalId).toBe(event.externalId);
		});
	});
}

/**
 * Registers the meter group's own assertions, which only a provider declaring
 * `meters` runs.
 *
 * @param options - The provider factory plus the meter to ask about.
 */
export function meterConformance(options: ConformanceOptions): void {
	describe(`${options.name} meter conformance`, () => {
		test("reads a quantity for a customer, and rejects an unknown one", async () => {
			let billing = await options.create();
			let externalId = `subject_${uniqueSuffix()}`;
			let meter = options.meter;
			let to = new Date();
			let window = { from: new Date(to.getTime() - METER_WINDOW_MS), to, interval: "day" } as const;

			expect(meter).toBeDefined();
			expect(supports(billing, "meters")).toBe(true);
			if (meter === undefined || !supports(billing, "meters")) return;

			let customer = await unwrap(
				billing.customers.create({ email: emailFrom(options), externalId }),
			);

			let reading = await unwrap(
				billing.meters.quantities({ meter, customer: { id: customer.id }, ...window }),
			);

			expect(reading.meter).toBe(meter);
			expect(reading.quantity).toBeGreaterThanOrEqual(0);

			expectFailure(
				billing,
				await billing.meters.quantities({
					meter,
					customer: { id: missingId(options, "customer") },
					...window,
				}),
				"not_found",
			);
		});
	});
}

/**
 * Asks the capability question in both directions: a declared group must
 * actually work, and an undeclared one must actually be absent, so no provider
 * can declare what it stubs.
 *
 * @param options - The provider factory plus whatever a declared group needs.
 */
export function capabilityConformance(options: ConformanceOptions): void {
	describe(`${options.name} capability declarations`, () => {
		test.each(OPTIONAL_CAPABILITIES)("agrees with a real call about %s", async (capability) => {
			let billing = await options.create();

			if (!supports(billing, capability)) {
				expect(billing[capability]).toBeUndefined();
				return;
			}

			let result = await CAPABILITY_PROBES[capability](billing, options);

			if (isFailure(result)) {
				expect(["unsupported", "not_implemented"]).not.toContain(result.error.code);
			}
		});
	});
}
