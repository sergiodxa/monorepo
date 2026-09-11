/**
 * The shared conformance suite against a real Polar sandbox, which is the run
 * that proves this provider maps live payloads.
 *
 * Run it by supplying the sandbox organization's access token and webhook
 * secret, the product ids of a $49 monthly plan and a ¥5000 one, and the id of
 * a `pings` meter. The suite skips while any of the five is unset.
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
	accessToken: process.env["POLAR_SANDBOX_ACCESS_TOKEN"] ?? "",
	webhookSecret: process.env["POLAR_SANDBOX_WEBHOOK_SECRET"] ?? "",
	proProduct: process.env["POLAR_SANDBOX_PRO_PRODUCT_ID"] ?? "",
	tokyoProduct: process.env["POLAR_SANDBOX_TOKYO_PRODUCT_ID"] ?? "",
	pingsMeter: process.env["POLAR_SANDBOX_PINGS_METER_ID"] ?? "",
};

/** Whether the environment names every sandbox value the suite needs. */
const CONFIGURED = Object.values(SANDBOX).every((value) => value !== "");

/** Builds a provider pointed at the sandbox, which every test in the suite calls. */
function create(): PolarBilling {
	return new PolarBilling({
		accessToken: SANDBOX.accessToken,
		webhookSecret: SANDBOX.webhookSecret,
		products: { pro: SANDBOX.proProduct, tokyo: SANDBOX.tokyoProduct },
		meters: { pings: SANDBOX.pingsMeter },
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

describe.skipIf(!CONFIGURED)("PolarBilling against a Polar sandbox", () => {
	conformance(CONFORMANCE_OPTIONS);
	portalConformance(CONFORMANCE_OPTIONS);
	discountConformance(CONFORMANCE_OPTIONS);
	usageConformance(CONFORMANCE_OPTIONS);
	meterConformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
