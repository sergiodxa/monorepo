/**
 * The shared conformance suite against a real Polar sandbox, which is the run
 * that proves this provider maps live payloads. It stays skipped until the
 * sandbox credentials and the ids below are supplied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe } from "vitest";

import type { ConformanceOptions } from "../../testing/conformance.js";

import {
	capabilityConformance,
	conformance,
	discountConformance,
	meterConformance,
	portalConformance,
	usageConformance,
} from "../../testing/conformance.js";

import { PolarBilling } from "./index.js";

/**
 * The sandbox organization the suite bills against. Polar's sandbox shares no
 * token and no identifier with production, so every value here is its own.
 */
const SANDBOX = {
	accessToken: "POLAR_SANDBOX_ACCESS_TOKEN",
	webhookSecret: "POLAR_SANDBOX_WEBHOOK_SECRET",
	products: { pro: "POLAR_SANDBOX_PRO_PRODUCT_ID", tokyo: "POLAR_SANDBOX_TOKYO_PRODUCT_ID" },
	meters: { pings: "POLAR_SANDBOX_PINGS_METER_ID" },
};

/** Builds a provider pointed at the sandbox, which every test in the suite calls. */
function create(): PolarBilling {
	return new PolarBilling({
		accessToken: SANDBOX.accessToken,
		webhookSecret: SANDBOX.webhookSecret,
		products: SANDBOX.products,
		meters: SANDBOX.meters,
		connection: "polar_sandbox",
		sandbox: true,
	});
}

const CONFORMANCE_OPTIONS: ConformanceOptions = {
	name: "PolarBilling",
	create,
	subscription: { slug: "pro", amount: 4900, currency: "usd" },
	zeroDecimal: { slug: "tokyo", amount: 5000, currency: "jpy" },
	meter: "pings",
};

describe.skip("PolarBilling against a Polar sandbox", () => {
	conformance(CONFORMANCE_OPTIONS);
	portalConformance(CONFORMANCE_OPTIONS);
	discountConformance(CONFORMANCE_OPTIONS);
	usageConformance(CONFORMANCE_OPTIONS);
	meterConformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
