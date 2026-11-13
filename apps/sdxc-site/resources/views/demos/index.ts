/**
 * The demo landings `/demo/:slug` serves, discovered from `resources/views/demos/<slug>/index.tsx`
 * and each loaded only when its own URL is asked for, so one demo's page never weighs on
 * another's request or on the rest of the site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import routes from "~/routes/web";

/** What a demo's `index.tsx` default-exports: its head metadata and the whole page. */
export interface DemoLanding {
	/** The document title, naming the invented product. */
	title: string;
	/** One sentence for the meta description. */
	description: string;
	/** Which kind of landing the demo shows ("SaaS landing"), for the gallery card. */
	kind: string;
	/** A few words on what the invented product is, for the gallery card. */
	tagline: string;
	/** A few words on the palette, type and shapes the page commits to, for the gallery card. */
	artDirection: string;
	/** A small scene of the page in its own art direction, for the gallery card. */
	thumbnail: () => RemixNode;
	/**
	 * The page, from its own header to its own footer. It receives the requested URL, so a
	 * GET form on the page (a pricing calculator, a filter) renders its answer server-side.
	 */
	render: (url: URL) => RemixNode;
	/**
	 * The content of one of the page's named frames, for a request carrying its name in
	 * `X-Remix-Target`, such as a live calculator's bill; `null` for a name the page lacks.
	 */
	target?: (name: string, url: URL) => RemixNode | null;
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

/** One demo as a page links to it: its slug and what its module declares about itself. */
export interface DemoSummary {
	slug: string;
	title: string;
	description: string;
	kind: string;
	tagline: string;
	artDirection: string;
	thumbnail: () => RemixNode;
}

/**
 * Every demo with the title and description its own module declares, so a page linking to
 * the demos lists a new one as soon as its folder exists.
 *
 * @returns One summary per demo, in slug order.
 */
export async function listDemoLandings(): Promise<DemoSummary[]> {
	let demos = await Promise.all(
		listDemoSlugs().map(async (slug) => {
			let demo = await findDemoLanding(slug);
			if (demo === null) return null;
			let { title, description, kind, tagline, artDirection, thumbnail } = demo;
			return { slug, title, description, kind, tagline, artDirection, thumbnail };
		}),
	);
	return demos.filter((demo): demo is DemoSummary => demo !== null);
}

/**
 * Every demo as a card linking to it: the product's name from the title before its dash,
 * the description it declares, and its address.
 *
 * @returns One card per demo, in slug order.
 */
export async function demoLandingLinks(): Promise<
	Array<{ href: string; title: string; description: string }>
> {
	return (await listDemoLandings()).map((demo) => ({
		href: routes.demo.href({ slug: demo.slug }),
		title: demo.title.split(" — ")[0] ?? demo.title,
		description: demo.description,
	}));
}
