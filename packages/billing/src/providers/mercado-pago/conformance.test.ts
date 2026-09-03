/**
 * The shared conformance suite pointed at a real Mercado Pago account. It
 * stays skipped because every assertion in it creates payers, opens hosted
 * pages, and reads plans back, which needs live sandbox credentials and a
 * dashboard where the two products below already exist.
 *
 * Enable it by supplying `MERCADO_PAGO_ACCESS_TOKEN` for a test account, then
 * creating a monthly `preapproval_plan` priced in ARS and another priced in
 * CLP, and naming their identifiers in the catalog below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe } from "vitest";

import type { ConformanceOptions } from "../../testing/conformance.js";

import { capabilityConformance, conformance } from "../../testing/conformance.js";

import { MercadoPagoBilling } from "./index.js";

/** The sandbox credential the suite bills against when it is enabled. */
const ACCESS_TOKEN = process.env["MERCADO_PAGO_ACCESS_TOKEN"] ?? "";

/** The recurring plan the suite subscribes to, as the sandbox dashboard issued it. */
const ARS_PLAN = process.env["MERCADO_PAGO_ARS_PLAN"] ?? "";

/** The recurring plan priced with no minor unit, which is the rounding assertion. */
const CLP_PLAN = process.env["MERCADO_PAGO_CLP_PLAN"] ?? "";

/** Minor units the ARS plan is expected to charge. */
const ARS_AMOUNT = 10_050;

/** Whole units the CLP plan is expected to charge. */
const CLP_AMOUNT = 5000;

/** Builds a provider against the sandbox account, configured with both plans. */
function create(): MercadoPagoBilling {
	return new MercadoPagoBilling({
		accessToken: ACCESS_TOKEN,
		products: {
			pro: { kind: "recurring", plan: ARS_PLAN },
			andes: { kind: "recurring", plan: CLP_PLAN },
		},
	});
}

const CONFORMANCE_OPTIONS: ConformanceOptions = {
	name: "MercadoPagoBilling",
	create,
	subscription: { slug: "pro", amount: ARS_AMOUNT, currency: "ars" },
	zeroDecimal: { slug: "andes", amount: CLP_AMOUNT, currency: "clp" },
};

describe.skip("MercadoPagoBilling conformance against a sandbox account", () => {
	conformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
