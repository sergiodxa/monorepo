/**
 * How the showcase names what an item is: running in production or a demo, and an app, a
 * landing or a docs site. Plain values with no bundler imports, so the pages, the build-time
 * extractor and the social cards all word an item the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoKind } from "~/app/services/demos";

/** Whether an item runs for real, or is a demo for an invented product. */
export type ShowcaseKind = "production" | "demo";

/** What an item is, production or demo alike: an app, a landing or a docs site. */
export type ShowcaseCategory = DemoKind;

/** What an item's chips and labels are read from. */
export interface KindFacts {
	kind: ShowcaseKind;
	category: ShowcaseCategory;
	/** Whether it runs somewhere a reader can open; a production item without is source only. */
	live: boolean;
}

/** How a category reads on its own, as an item's second chip does. */
export const CATEGORY_LABELS: Record<ShowcaseCategory, string> = {
	app: "App",
	landing: "Landing",
	docs: "Docs",
};

/**
 * What an item is, kind and category together, as a case study's breadcrumb and facts read.
 *
 * @example kindLabel({ kind: "production", category: "app" }) // "Production app"
 * @example kindLabel({ kind: "demo", category: "docs" }) // "Docs demo"
 */
export function kindLabel(item: Pick<KindFacts, "kind" | "category">): string {
	let category = CATEGORY_LABELS[item.category];
	return item.kind === "production" ? `Production ${category.toLowerCase()}` : `${category} demo`;
}

/**
 * The chips a tile and a social card carry: whether the item is in production, source only or
 * a demo, then its category, so no demo reads as a product.
 *
 * @example kindChips({ kind: "demo", category: "landing", live: true }) // ["Demo", "Landing"]
 */
export function kindChips(item: KindFacts): [string, string] {
	return [statusChip(item), CATEGORY_LABELS[item.category]];
}

/** The first chip's wording. */
function statusChip(item: KindFacts): string {
	if (item.kind === "demo") return "Demo";
	return item.live ? "In production" : "Source only";
}
