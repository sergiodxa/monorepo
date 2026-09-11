/**
 * The shared conformance suite pointed at a real Mercado Pago account, which is
 * the run that proves this provider maps live payloads: every assertion in it
 * creates payers, opens hosted pages, and reads plans back.
 *
 * Run it by supplying `MERCADO_PAGO_ACCESS_TOKEN` for a test account, then
 * creating a monthly `preapproval_plan` priced at 100.50 ARS and another priced
 * at 5000 CLP, and naming their identifiers in `MERCADO_PAGO_ARS_PLAN` and
 * `MERCADO_PAGO_CLP_PLAN`. The suite skips while any of the three is unset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe } from "vitest";

import type { ConformanceOptions } from "../../testing/conformance.js";

import { capabilityConformance, conformance } from "../../testing/conformance.js";

import { MercadoPagoBilling } from "./index.js";

/** The sandbox credential the suite bills against. */
const ACCESS_TOKEN = process.env["MERCADO_PAGO_ACCESS_TOKEN"] ?? "";

/** The recurring plan the suite subscribes to, as the sandbox dashboard issued it. */
const ARS_PLAN = process.env["MERCADO_PAGO_ARS_PLAN"] ?? "";

/** The recurring plan priced with no minor unit, which is the rounding assertion. */
const CLP_PLAN = process.env["MERCADO_PAGO_CLP_PLAN"] ?? "";

/** Whether the environment names the credential and both plans. */
const CONFIGURED = [ACCESS_TOKEN, ARS_PLAN, CLP_PLAN].every((value) => value !== "");

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

describe.skipIf(!CONFIGURED)("MercadoPagoBilling conformance against a sandbox account", () => {
	conformance(CONFORMANCE_OPTIONS);
	capabilityConformance(CONFORMANCE_OPTIONS);
});
