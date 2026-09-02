/**
 * The shared conformance suite pointed at Stripe, kept ready for a run against
 * a real test-mode account. It stays skipped because it needs Stripe test-mode
 * credentials and a catalog created in that account's dashboard, which CI has
 * neither of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe } from "vitest";

import type { ConformanceOptions } from "../../testing/conformance";

import { capabilityConformance, conformance, portalConformance } from "../../testing/conformance";

import { StripeBilling } from "./index";

/**
 * Credentials and catalog the remote run is configured with. A run supplies a
 * test-mode secret key, the endpoint signing secret of a listener pointed at
 * the run, and the two products the suite bills against; the required core also
 * covers the order, discount, and usage groups this connection answers with
 * `not_implemented`, so those assertions describe the work still to do.
 */
const STRIPE_TEST_MODE = {
	secretKey: process.env.STRIPE_TEST_SECRET_KEY ?? "",
	webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET ?? "",
	subscription: { slug: "pro", product: "prod_pro", price: "price_pro", amount: 4900 },
	zeroDecimal: { slug: "tokyo", product: "prod_tokyo", price: "price_tokyo", amount: 5000 },
};

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

describe.skip("StripeBilling against Stripe test mode", () => {
	conformance(CONFORMANCE_OPTIONS);
	portalConformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
