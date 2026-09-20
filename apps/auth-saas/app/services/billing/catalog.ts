/**
 * The plan and add-on catalog: `PLANS` and `ADDONS` are the one place the
 * price, the cap, the retention and the feature set a slug grants are written
 * down, so the number a page would render and the number a gate enforces stay
 * the same number. `app/lib/billing.ts` merges these slugs with the sandbox
 * or production Polar organization's own ids to construct the provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Money } from "@sdxc/billing";

/** A base tier every tenant carries one of. */
export interface Plan {
	/** The name a pricing page or an invoice shows. */
	name: string;
	/** Price per tenant per month. */
	price: Money;
	/** Distinct subjects authenticating within a UTC day this tier admits. */
	dauCap: number;
	/** Days the audit log is retained at this tier. */
	auditRetentionDays: number;
	/** Feature slugs this tier's subscription grants, beyond what every tier carries. */
	features: readonly string[];
}

/** An add-on sold per tenant, on top of any plan. */
export interface Addon {
	/** The name a pricing page or an invoice shows. */
	name: string;
	/** Price per tenant per month; a metered add-on bills its overage separately. */
	price: Money;
	/** The one feature slug this add-on's subscription grants. */
	feature: string;
}

/** The three base tiers, keyed by the slug a checkout opens and a subscription reads back. */
export const PLANS: Readonly<Record<"free" | "pro" | "premium", Plan>> = {
	free: {
		name: "Free",
		price: { amount: 0, currency: "usd" },
		dauCap: 100,
		auditRetentionDays: 7,
		features: [],
	},
	pro: {
		name: "Pro",
		price: { amount: 2900, currency: "usd" },
		dauCap: 2500,
		auditRetentionDays: 30,
		features: ["custom_domain", "session_policy", "unbranded_pages"],
	},
	premium: {
		name: "Premium",
		price: { amount: 9900, currency: "usd" },
		dauCap: 10000,
		auditRetentionDays: 90,
		features: ["custom_domain", "session_policy", "unbranded_pages", "branding"],
	},
} as const;

/**
 * The eight add-ons, keyed by the slug a checkout opens and a subscription reads
 * back. `sso_connections` prices its first five connections; the $10-per-extra
 * metering above that runs through `usage.ingest` and is not modeled here.
 */
export const ADDONS: Readonly<
	Record<
		| "sso_connections"
		| "scim"
		| "organizations"
		| "custom_roles"
		| "outbound_webhooks"
		| "machine_access"
		| "device_grant"
		| "audit_streaming",
		Addon
	>
> = {
	sso_connections: {
		name: "Enterprise SSO connections",
		price: { amount: 4900, currency: "usd" },
		feature: "sso_connections",
	},
	scim: {
		name: "SCIM provisioning",
		price: { amount: 2900, currency: "usd" },
		feature: "scim",
	},
	organizations: {
		name: "Organizations",
		price: { amount: 2900, currency: "usd" },
		feature: "organizations",
	},
	custom_roles: {
		name: "Custom roles and permissions",
		price: { amount: 1900, currency: "usd" },
		feature: "custom_roles",
	},
	outbound_webhooks: {
		name: "Outbound webhooks",
		price: { amount: 1900, currency: "usd" },
		feature: "outbound_webhooks",
	},
	machine_access: {
		name: "Machine-to-machine access and API keys",
		price: { amount: 2900, currency: "usd" },
		feature: "machine_access",
	},
	device_grant: {
		name: "Device authorization grant",
		price: { amount: 900, currency: "usd" },
		feature: "device_grant",
	},
	audit_streaming: {
		name: "Audit streaming and export",
		price: { amount: 2900, currency: "usd" },
		feature: "audit_streaming",
	},
} as const;

/** Every slug a checkout can open against: every plan, then every add-on. */
function catalogSlugs(): readonly string[] {
	return [...Object.keys(PLANS), ...Object.keys(ADDONS)];
}

/** Every feature slug a held plan or add-on can grant, deduplicated. */
function featureSlugs(): readonly string[] {
	let slugs = new Set<string>();

	for (let plan of Object.values(PLANS)) {
		for (let feature of plan.features) slugs.add(feature);
	}

	for (let addon of Object.values(ADDONS)) slugs.add(addon.feature);

	return [...slugs];
}

/**
 * Narrows a raw slug-to-id map to the slugs named, skipping a slug with no
 * configured id rather than passing `undefined` through: a checkout or a
 * catalog read against a slug this leaves out gets the "unknown product"
 * failure `@sdxc/billing` already produces for it.
 */
function narrowToConfigured(
	slugs: readonly string[],
	ids: Readonly<Record<string, string>>,
): Record<string, string> {
	let configured: Record<string, string> = {};

	for (let slug of slugs) {
		let id = ids[slug];
		if (id !== undefined) configured[slug] = id;
	}

	return configured;
}

/**
 * Builds the `products` map `PolarBilling` is constructed with, from the
 * organization's own `POLAR_PRODUCT_IDS` secret.
 *
 * @param ids - The parsed `POLAR_PRODUCT_IDS` secret, our own slugs to Polar's ids.
 * @returns Every plan and add-on slug that has a configured id.
 */
export function buildProductMap(ids: Readonly<Record<string, string>>): Record<string, string> {
	return narrowToConfigured(catalogSlugs(), ids);
}

/**
 * Builds the `features` map `PolarBilling` is constructed with, from the
 * organization's own `POLAR_FEATURE_IDS` secret.
 *
 * @param ids - The parsed `POLAR_FEATURE_IDS` secret, our own slugs to Polar's benefit ids.
 * @returns Every feature slug a plan or add-on grants that has a configured id.
 */
export function buildFeatureMap(ids: Readonly<Record<string, string>>): Record<string, string> {
	return narrowToConfigured(featureSlugs(), ids);
}
