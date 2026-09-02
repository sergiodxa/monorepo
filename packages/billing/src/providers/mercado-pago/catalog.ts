/**
 * The configured catalog: what each of our slugs sells, and how to get back
 * from a platform identifier to the slug that named it. A one-time sale is
 * priced here because the platform stores no product for it, while a recurring
 * sale names a stored plan and is priced by reading that plan back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Money } from "../../core/types";

/**
 * A one-time sale. The price, title, and description are configuration because
 * a hosted checkout carries its line items inline and the platform keeps no
 * product object to read them from.
 */
export interface MercadoPagoOneTimeProduct {
	kind: "one_time";
	name: string;
	description?: string;
	/** What the hosted page charges, in minor units. */
	price: Money;
	/** Units sold per checkout when a caller names no quantity. @default 1 */
	quantity?: number;
	/** Entitlement flags a completed purchase grants, by our own feature slugs. */
	features?: Record<string, boolean>;
}

/**
 * A recurring sale, naming the stored plan that prices it. Everything a
 * catalog read reports comes from that plan, so a price change made in the
 * platform's dashboard needs no deployment here.
 */
export interface MercadoPagoRecurringProduct {
	kind: "recurring";
	/** The plan's own identifier, as the platform's dashboard issued it. */
	plan: string;
	/** Name to report when the plan carries none. */
	name?: string;
	description?: string;
	/** Entitlement flags an authorized subscription grants, by our own feature slugs. */
	features?: Record<string, boolean>;
}

/** What one slug sells. */
export type MercadoPagoProduct = MercadoPagoOneTimeProduct | MercadoPagoRecurringProduct;

/** Units sold per checkout when neither the caller nor the configuration says. */
const SINGLE_UNIT = 1;

/**
 * Resolves between our slugs and the platform identifiers behind them, which
 * is what keeps a plan id out of every call site and lets a subscription read
 * report the slug that sold it.
 */
export class MercadoPagoCatalog {
	readonly #products: Map<string, MercadoPagoProduct>;

	readonly #slugsByPlan = new Map<string, string>();

	/**
	 * Indexes a configured catalog in both directions.
	 *
	 * @param products - What each slug sells, keyed by the slug.
	 */
	constructor(products: Readonly<Record<string, MercadoPagoProduct>>) {
		this.#products = new Map(Object.entries(products));

		for (let [slug, product] of this.#products) {
			if (product.kind === "recurring") this.#slugsByPlan.set(product.plan, slug);
		}
	}

	/** Every configured slug, in configuration order, which is the order a list pages through. */
	get slugs(): string[] {
		return [...this.#products.keys()];
	}

	/**
	 * Reads what a slug sells.
	 *
	 * @param slug - Our own name for the product.
	 * @returns The configuration, or `undefined` when nothing is configured under it.
	 */
	find(slug: string): MercadoPagoProduct | undefined {
		return this.#products.get(slug);
	}

	/**
	 * Names the slug a stored plan was configured under, so a subscription read
	 * reports our vocabulary rather than the platform's identifier.
	 *
	 * @param plan - The plan's own identifier.
	 * @returns The slug, or `null` when no slug names that plan.
	 */
	slugForPlan(plan: string | null | undefined): string | null {
		if (plan === null || plan === undefined) return null;

		return this.#slugsByPlan.get(plan) ?? null;
	}

	/**
	 * Names the stored plan a slug sells, which is the filter a subscription
	 * search carries.
	 *
	 * @param slug - Our own name for the product.
	 * @returns The plan's identifier, or `undefined` for a one-time sale.
	 */
	planFor(slug: string | undefined): string | undefined {
		if (slug === undefined) return undefined;

		let product = this.find(slug);

		return product?.kind === "recurring" ? product.plan : undefined;
	}

	/**
	 * Unions the feature flags a set of held products grants, so a snapshot
	 * reports one map rather than one map per product.
	 *
	 * @param slugs - Products the customer currently holds.
	 * @returns The granted flags, keyed by our own feature slugs.
	 */
	featuresOf(slugs: readonly string[]): Record<string, boolean> {
		let features: Record<string, boolean> = {};

		for (let slug of slugs) {
			for (let [feature, granted] of Object.entries(this.find(slug)?.features ?? {})) {
				features[feature] = granted || (features[feature] ?? false);
			}
		}

		return features;
	}

	/**
	 * How many units a one-time checkout sells, preferring the caller's request
	 * over the configured default.
	 *
	 * @param product - The configured product.
	 * @param requested - Quantity the caller asked for, when it named one.
	 * @returns The quantity to put on the hosted page.
	 */
	static quantityOf(product: MercadoPagoOneTimeProduct, requested?: number): number {
		return requested ?? product.quantity ?? SINGLE_UNIT;
	}
}
