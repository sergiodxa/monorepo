/**
 * Runs the shared conformance suite against the memory provider, which is what
 * makes that provider a real one and keeps the suite itself honest: an
 * assertion nothing can satisfy would fail here first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryProductSeed } from "../providers/memory";

import { MemoryBilling } from "../providers/memory";

import type { ConformanceOptions } from "./conformance";

import {
	capabilityConformance,
	conformance,
	discountConformance,
	meterConformance,
	portalConformance,
	usageConformance,
} from "./conformance";

/** Catalog the suite is told about: a subscription, a one-time sale, and a yen price. */
const CATALOG: Record<string, MemoryProductSeed> = {
	pro: {
		amount: 4900,
		currency: "usd",
		interval: "month",
		features: { flow_monitors: true },
		credits: { pings: 1000 },
	},
	book: { amount: 2900, currency: "usd" },
	tokyo: { amount: 5000, currency: "jpy", interval: "month" },
};

/** Builds a provider whose state starts empty, as every test expects. */
function create(): MemoryBilling {
	return new MemoryBilling({ catalog: CATALOG });
}

const CONFORMANCE_OPTIONS: ConformanceOptions = {
	name: "MemoryBilling",
	create,
	subscription: { slug: "pro", amount: 4900, currency: "usd" },
	zeroDecimal: { slug: "tokyo", amount: 5000, currency: "jpy" },
	meter: "pings",
};

conformance(CONFORMANCE_OPTIONS);
portalConformance(CONFORMANCE_OPTIONS);
discountConformance(CONFORMANCE_OPTIONS);
usageConformance(CONFORMANCE_OPTIONS);
meterConformance(CONFORMANCE_OPTIONS);
capabilityConformance(CONFORMANCE_OPTIONS);
