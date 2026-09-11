/**
 * The shared conformance suite pointed at Stripe, run against a real test-mode
 * account whenever the environment names one.
 *
 * Run it by supplying a test-mode secret key, the signing secret of a listener
 * pointed at the run, and the product and price ids of a $49 monthly plan and a
 * ¥5000 one, created in that account's dashboard. The suite skips while any of
 * the six is unset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe } from "vitest";

import type { ConformanceOptions } from "../../testing/conformance.js";

import {
	capabilityConformance,
	conformance,
	portalConformance,
} from "../../testing/conformance.js";

import { StripeBilling } from "./index.js";

/**
 * Credentials and catalog the remote run is configured with. The required core
 * also covers the order, discount, and usage groups this connection answers
 * with `not_implemented`, so those assertions describe the work still to do.
 */
const STRIPE_TEST_MODE = {
	secretKey: process.env["STRIPE_TEST_SECRET_KEY"] ?? "",
	webhookSecret: process.env["STRIPE_TEST_WEBHOOK_SECRET"] ?? "",
	subscription: {
		slug: "pro",
		product: process.env["STRIPE_TEST_PRO_PRODUCT"] ?? "",
		price: process.env["STRIPE_TEST_PRO_PRICE"] ?? "",
		amount: 4900,
	},
	zeroDecimal: {
		slug: "tokyo",
		product: process.env["STRIPE_TEST_TOKYO_PRODUCT"] ?? "",
		price: process.env["STRIPE_TEST_TOKYO_PRICE"] ?? "",
		amount: 5000,
	},
};

/** Whether the environment names both credentials and both catalog entries. */
const CONFIGURED = [
	STRIPE_TEST_MODE.secretKey,
	STRIPE_TEST_MODE.webhookSecret,
	STRIPE_TEST_MODE.subscription.product,
	STRIPE_TEST_MODE.subscription.price,
	STRIPE_TEST_MODE.zeroDecimal.product,
	STRIPE_TEST_MODE.zeroDecimal.price,
].every((value) => value !== "");

const CONFORMANCE_OPTIONS: ConformanceOptions = {
	name: "StripeBilling",
	create: () =>
		new StripeBilling({
			secretKey: STRIPE_TEST_MODE.secretKey,
			webhookSecret: STRIPE_TEST_MODE.webhookSecret,
			catalog: {
				[STRIPE_TEST_MODE.subscription.slug]: {
					product: STRIPE_TEST_MODE.subscription.product,
					price: STRIPE_TEST_MODE.subscription.price,
				},
				[STRIPE_TEST_MODE.zeroDecimal.slug]: {
					product: STRIPE_TEST_MODE.zeroDecimal.product,
					price: STRIPE_TEST_MODE.zeroDecimal.price,
				},
			},
		}),
	subscription: {
		slug: STRIPE_TEST_MODE.subscription.slug,
		amount: STRIPE_TEST_MODE.subscription.amount,
		currency: "usd",
	},
	zeroDecimal: {
		slug: STRIPE_TEST_MODE.zeroDecimal.slug,
		amount: STRIPE_TEST_MODE.zeroDecimal.amount,
		currency: "jpy",
	},
};

describe.skipIf(!CONFIGURED)("StripeBilling against Stripe test mode", () => {
	conformance(CONFORMANCE_OPTIONS);
	portalConformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
