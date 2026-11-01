/**
 * The demo docs sites `/demo/docs/:site` serves, discovered from
 * `resources/views/demo-docs/<site>/index.tsx` and each loaded only when one of its own
 * pages is asked for, so a docs demo never weighs on another request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsHub, DocsTree, NextSteps, TableOfContents } from "@sdxc/ui/docs";
import type { RemixNode } from "remix/component";

import type { PaletteScale } from "~/resources/components/demo-theme";

import routes from "~/routes/web";

/** What a page's body reads from the request it renders for. */
export interface DemoDocsRequest {
	/**
	 * The value a remembered tab strip opens on, so a page renders the reader's last choice
	 * of language or package manager on the server.
	 */
	tab: (syncKey: string) => string | undefined;
}

/** One page of a docs demo: its header, its headings for the rail, and its body. */
export interface DemoDocsPage {
	title: string;
	/** The lead under the title and the page's meta description. */
	description: string;
	/** Sets the title in the monospace face, for a page named after something a reader types. */
	mono?: boolean;
	/** When the page last changed, as `YYYY-MM-DD`. */
	updated: string;
	/** Every `AnchorHeading` the body draws, in order, which the rail and search both read. */
	toc: TableOfContents.Item[];
	/** Where the page hands the reader on, drawn under the body before the pager. */
	next?: NextSteps.Item[];
	render: (request: DemoDocsRequest) => RemixNode;
}

/** One docs demo: its invented product, its art direction, its tree and its pages. */
export interface DemoDocsSite {
	/** The product the docs are about, which the header's wordmark and the titles name. */
	name: string;
	/** Which kind of docs the demo shows ("Content docs"), for the cards that link to it. */
	kind: string;
	/** One sentence for the meta description and the card linking to the demo. */
	description: string;
	/** The product's mark, drawn before its name in the header. */
	mark: () => RemixNode;
	/** The palettes and tokens the whole site is themed with. */
	theme: {
		brand: PaletteScale;
		neutral?: PaletteScale;
		tokens?: Record<`--${string}`, string>;
	};
	/** The sidebar; every `href` in it is a page of {@link pages} or the hub. */
	tree: DocsTree;
	/** The hub at the site's root, which routes a reader by task. */
	hub: Omit<DocsHub.Props, "labels" | "search">;
	/** Every page keyed by its path under the site, such as `guides/quickstart`. */
	pages: Record<string, DemoDocsPage>;
	/** Links in the footer's row besides the docs home, such as a status page or changelog. */
	footerLinks?: Array<{ label: string; href: string }>;
}

/** One docs demo as a page linking to it lists it. */
export interface DemoDocsSummary {
	slug: string;
	name: string;
	kind: string;
	description: string;
}

/**
 * Every docs demo folder's entry, keyed by its path relative to this file. A new demo is one
 * folder holding an `index.tsx`; its folder name is its slug.
 */
const SITE_MODULES = import.meta.glob<DemoDocsSite>("./*/index.tsx", { import: "default" });

/**
 * Loads the docs demo a slug names.
 *
 * @param slug The `:site` the request carried.
 * @returns The site, or `null` for a slug no folder answers to.
 */
export async function findDemoDocsSite(slug: string): Promise<DemoDocsSite | null> {
	let key = `./${slug}/index.tsx`;
	if (!Object.hasOwn(SITE_MODULES, key)) return null;
	return (await SITE_MODULES[key]?.()) ?? null;
}

/**
 * The slugs `/demo/docs/:site` answers, in folder-name order.
 *
 * @returns One slug per docs demo folder.
 */
export function listDemoDocsSlugs(): string[] {
	return Object.keys(SITE_MODULES)
		.map((key) => key.slice(2, -"/index.tsx".length))
		.sort();
}

/**
 * Every docs demo with the name, kind and description its own module declares, so a page
 * linking to the demos lists a new one as soon as its folder exists.
 *
 * @returns One summary per docs demo, in slug order.
 */
export async function listDemoDocsSites(): Promise<DemoDocsSummary[]> {
	let sites = await Promise.all(
		listDemoDocsSlugs().map(async (slug) => {
			let site = await findDemoDocsSite(slug);
			return site === null
				? null
				: { slug, name: site.name, kind: site.kind, description: site.description };
		}),
	);
	return sites.filter((site): site is DemoDocsSummary => site !== null);
}

/**
 * Builds the addresses of one docs demo, so a site's tree, hub and cross-links name its
 * pages by their path under the site.
 *
 * @param slug The demo's folder name.
 * @returns A function from a page path (none for the hub) to its address.
 * @example demoDocsHref("driftwood")("guides/quickstart") // "/demo/docs/driftwood/guides/quickstart"
 */
export function demoDocsHref(slug: string): (page?: string) => string {
	return (page) => routes.demoDocs.show.href({ site: slug, page });
}

/**
 * Every docs demo as a card linking to its hub, headed by the kind of docs it shows.
 *
 * @returns One card per docs demo, in slug order.
 */
export async function demoDocsLinks(): Promise<
	Array<{ href: string; title: string; description: string; eyebrow: string }>
> {
	return (await listDemoDocsSites()).map((site) => ({
		href: demoDocsHref(site.slug)(),
		title: `${site.name} Docs`,
		description: site.description,
		eyebrow: site.kind,
	}));
}
