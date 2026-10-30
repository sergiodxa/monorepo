/**
 * The demo landings `/demo/:slug` serves, discovered from `resources/views/demos/<slug>/index.tsx`
 * and each loaded only when its own URL is asked for, so one demo's page never weighs on
 * another's request or on the rest of the site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

/** What a demo's `index.tsx` default-exports: its head metadata and the whole page. */
export interface DemoLanding {
	/** The document title, naming the invented product. */
	title: string;
	/** One sentence for the meta description. */
	description: string;
	/** The page, from its own header to its own footer. */
	render: () => RemixNode;
}

/**
 * Every demo folder's entry, keyed by its path relative to this file. A new demo is one
 * folder holding an `index.tsx`; its folder name is its slug.
 */
const DEMO_MODULES = import.meta.glob<DemoLanding>("./*/index.tsx", { import: "default" });

/**
 * Loads the demo a slug names.
 *
 * @param slug The `:slug` the request carried.
 * @returns The demo, or `null` for a slug no demo folder answers to.
 */
export async function findDemoLanding(slug: string): Promise<DemoLanding | null> {
	let key = `./${slug}/index.tsx`;
	if (!Object.hasOwn(DEMO_MODULES, key)) return null;
	return (await DEMO_MODULES[key]?.()) ?? null;
}

/**
 * The slugs `/demo/:slug` answers, in folder-name order.
 *
 * @returns One slug per demo folder.
 */
export function listDemoSlugs(): string[] {
	return Object.keys(DEMO_MODULES)
		.map((key) => key.slice(2, -"/index.tsx".length))
		.sort();
}
