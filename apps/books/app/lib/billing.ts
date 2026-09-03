/**
 * The billing platform this funnel sells through: one Polar connection built at
 * module scope, mapping each package slug onto the live product it bills. It is
 * the only place a vendor identifier appears, so no call site names one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

import { Product } from "~/app/data/product";

/**
 * The live Polar product behind each package slug. Every id names a product
 * that already has orders against it, so each one is copied verbatim: changing
 * one re-points the catalog, the checkout, and the paid-order webhook at once.
 */
const PRODUCTS = {
	[Product.Essentials]: "ae57a87c-0ba0-4757-9cf5-22d2f4bd33bf",
	[Product.Complete]: "297b3608-87f2-415c-ac42-185f34838540",
};

/**
 * Reads a required secret, naming the variable when it is empty, so a missing
 * credential is diagnosable before it reaches Polar as an opaque 401. Both
 * secrets are read lazily, so an isolate still boots and answers `/healthcheck`.
 *
 * @param name - The environment variable to read.
 * @returns The secret's value.
 * @throws {Error} When the variable is unset or empty.
 */
function requireSecret(name: "POLAR_ACCESS_TOKEN" | "POLAR_WEBHOOK_SECRET"): string {
	let value = env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

/**
 * The configured Polar connection. Routes reach this same instance through
 * `context.billing`, which the billing middleware publishes.
 *
 * @example
 * let product = await polar.catalog.find(Product.Complete);
 */
export const polar = new PolarBilling({
	accessToken: () => requireSecret("POLAR_ACCESS_TOKEN"),
	webhookSecret: () => requireSecret("POLAR_WEBHOOK_SECRET"),
	products: PRODUCTS,
});
