/**
 * Asserts the entitlement namespace is a real boundary: a key under it reads
 * the tenant's own context rather than a rule set, and a key outside it
 * reaches the wrapped engine provider, proven by seeding that provider with a
 * flag no entitlement code path could ever answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { describe, expect, test } from "vitest";

import { EntitlementProvider } from "./entitlement-provider";

/** Builds an initialized provider over an engine seeded with `flags`. */
async function providerOver(flags: Record<string, unknown>): Promise<EntitlementProvider> {
	let provider = new EntitlementProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore({ flags }) })),
	);
	await provider.initialize();
	return provider;
}

describe("resolveBoolean", () => {
	test("answers an entitlement key from the context's own entitlement map", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveBoolean("entitlement.custom-domain", false, {
			entitlement: { custom_domain: true },
		});

		expect(details.value).toBe(true);
	});

	test("denies an entitlement key absent from the context's entitlement map", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveBoolean("entitlement.custom-domain", false, {
			entitlement: { branding: true },
		});

		expect(details.value).toBe(false);
	});

	test("denies every entitlement key for a context that carries no entitlement map at all", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveBoolean("entitlement.custom-domain", false, {});

		expect(details.value).toBe(false);
	});

	test("falls through a non-entitlement key to the wrapped engine provider", async () => {
		let provider = await providerOver({
			"release-flag": { variants: { on: true, off: false }, defaultVariant: "on" },
		});

		let details = await provider.resolveBoolean("release-flag", false, {
			entitlement: { custom_domain: true },
		});

		expect(details.value).toBe(true);
		expect(details.reason).toBe("STATIC");
	});
});

describe("resolveNumber", () => {
	test("answers the dau cap of the plan tier the context names", async () => {
		let provider = await providerOver({});

		let free = await provider.resolveNumber("entitlement.dau-cap", 0, { plan: { tier: "free" } });
		let pro = await provider.resolveNumber("entitlement.dau-cap", 0, { plan: { tier: "pro" } });

		expect(free.value).toBe(100);
		expect(pro.value).toBe(2500);
	});

	test("answers the audit retention of the plan tier the context names", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveNumber("entitlement.audit-retention-days", 0, {
			plan: { tier: "premium" },
		});

		expect(details.value).toBe(90);
	});

	test("falls back to Free's limits for a context naming no plan or an unrecognized one", async () => {
		let provider = await providerOver({});

		let noPlan = await provider.resolveNumber("entitlement.dau-cap", 0, {});
		let unknownTier = await provider.resolveNumber("entitlement.dau-cap", 0, {
			plan: { tier: "made-up" },
		});

		expect(noPlan.value).toBe(100);
		expect(unknownTier.value).toBe(100);
	});

	test("falls through a non-entitlement numeric key to the wrapped engine provider", async () => {
		let provider = await providerOver({
			"sweep-concurrency": { variants: { default: 5 }, defaultVariant: "default" },
		});

		let details = await provider.resolveNumber("sweep-concurrency", 1, {});

		expect(details.value).toBe(5);
	});
});

describe("resolveString", () => {
	test("answers TYPE_MISMATCH for an entitlement key", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveString("entitlement.custom-domain", "fallback", {});

		expect(details.value).toBe("fallback");
		expect(details.errorCode).toBe("TYPE_MISMATCH");
	});

	test("falls through a non-entitlement key to the wrapped engine provider", async () => {
		let provider = await providerOver({
			"welcome-copy": { variants: { standard: "hi" }, defaultVariant: "standard" },
		});

		let details = await provider.resolveString("welcome-copy", "fallback", {});

		expect(details.value).toBe("hi");
	});
});

describe("resolveObject", () => {
	test("answers TYPE_MISMATCH for an entitlement key", async () => {
		let provider = await providerOver({});

		let details = await provider.resolveObject("entitlement.custom-domain", {}, {});

		expect(details.value).toEqual({});
		expect(details.errorCode).toBe("TYPE_MISMATCH");
	});

	test("falls through a non-entitlement key to the wrapped engine provider", async () => {
		let provider = await providerOver({
			"checkout-copy": {
				variants: { standard: { title: "Checkout" } },
				defaultVariant: "standard",
			},
		});

		let details = await provider.resolveObject("checkout-copy", {}, {});

		expect(details.value).toEqual({ title: "Checkout" });
	});
});
