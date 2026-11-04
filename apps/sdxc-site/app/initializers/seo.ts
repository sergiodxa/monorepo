/**
 * The site's `@sdxc/seo` instance, built over the one origin and description in
 * `config/constants.ts`, so every canonical URL, absolute asset URL and head tag a page emits
 * names the same address whichever host served it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { createSeo } from "@sdxc/seo";

import { socialCardUrl } from "~/app/services/social-card";
import {
	AUTHOR_NAME,
	AUTHOR_URL,
	AUTHOR_X_HANDLE,
	NPM_ORG_URL,
	REPOSITORY_URL,
	SITE_DESCRIPTION,
	SITE_NAME,
	SITE_URL,
} from "~/config/constants";

/** Resolves every canonical URL, absolute asset URL and head tag the site emits. */
export const seo = createSeo({
	baseUrl: SITE_URL,
	siteName: SITE_NAME,
	defaultDescription: SITE_DESCRIPTION,
	twitter: { site: AUTHOR_X_HANDLE, creator: AUTHOR_X_HANDLE },
});

/**
 * Leaves a page out of search results while still following its links, which is what a
 * missing page and a filtered view ask for.
 */
export const NOINDEX = seo.robotsTag({ index: false });

/**
 * Leaves a specimen page out of results and asks crawlers not to follow its links, since
 * those links document an invented product.
 */
export const NOINDEX_NOFOLLOW = seo.robotsTag({ index: false, follow: false });

/** The person a dated page names, whose profile is the author's own site. */
const AUTHOR_BYLINE = { name: AUTHOR_NAME, url: AUTHOR_URL };

/** The publisher an article names. The site ships no logo file, so the node names the project alone. */
const ARTICLE_PUBLISHER = { name: SITE_NAME };

/** One step of a visible breadcrumb trail that has a page of its own. */
export interface TrailCrumb {
	name: string;
	url: string;
}

/** The copy a structured-data node and its social card are built from. */
export interface PageSchemaInput {
	/** The page's own heading, which is the node's name. */
	name: string;
	description: string;
	/** A request URL or root-relative path, resolved through the canonical rules. */
	url: string;
	/**
	 * The document title the social card is drawn from. It carries the site suffix the
	 * heading does not, and the card image is hashed from it, so passing the document
	 * title keeps this image and the Open Graph image the same file.
	 */
	cardTitle?: string;
}

/**
 * The project behind the site. There is no logo file to point at, so the node names the
 * project, its origin and the two places the collection is published.
 */
export const SITE_ORGANIZATION = seo.schema.organization({
	name: SITE_NAME,
	description: SITE_DESCRIPTION,
	sameAs: [REPOSITORY_URL, NPM_ORG_URL],
});

/**
 * The home page's nodes: the project, and the site with the search box that opens
 * `/search`.
 *
 * @returns The organization and the website, in that order.
 */
export function homeSchema(): SchemaOrg.Node[] {
	return [
		SITE_ORGANIZATION,
		seo.schema.website({
			searchAction: { urlTemplate: "/search?q={search_term_string}" },
		}),
	];
}

/**
 * A page with no more specific type. The image is the page's social card, the same file
 * the Open Graph tag names.
 *
 * @param input - The heading, summary and canonical URL the page already shows.
 * @returns The web page node.
 */
export function pageSchema(input: PageSchemaInput): SchemaOrg.WebPage {
	return seo.schema.webPage({
		name: input.name,
		description: input.description,
		url: input.url,
		inLanguage: "en",
		image: cardImage(input),
	});
}

/**
 * A guide. The page records one date, the day it was last updated, and that is the date
 * it shows, so the node uses that day as both published and modified.
 *
 * @param input - The guide's heading, summary, canonical URL, section and last-updated day.
 * @returns The article node.
 */
export function articleSchema(
	input: PageSchemaInput & { updated: string; section?: string },
): SchemaOrg.Article {
	return seo.schema.article({
		headline: input.name,
		description: input.description,
		datePublished: input.updated,
		dateModified: input.updated,
		author: AUTHOR_BYLINE,
		publisher: ARTICLE_PUBLISHER,
		section: input.section,
		inLanguage: "en",
		url: input.url,
		image: cardImage(input),
	});
}

/**
 * One package, as a free developer application. The offer's price is zero because the
 * manifest's licence is the only term, and the offer's address is this page, which is
 * where a reader installs it.
 *
 * @param input - The published name, the manifest description and licence, and the page URL.
 * @returns The software application node.
 */
export function packageSchema(input: {
	name: string;
	description: string;
	url: string;
	license: string | null;
}): SchemaOrg.SoftwareApplication {
	return seo.schema.softwareApplication({
		name: input.name,
		description: input.description,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Any",
		url: input.url,
		offers: {
			price: "0",
			priceCurrency: "USD",
			...(input.license ? { description: `${input.license} license` } : {}),
			url: input.url,
		},
	});
}

/**
 * The breadcrumb trail a page actually renders, limited to the steps that link somewhere.
 * A section label with no page of its own is left out, because the list would otherwise
 * invent an address the page does not show.
 *
 * @param parents - The linked ancestors, in the order the page shows them.
 * @param current - The page itself, last.
 * @returns The breadcrumb list.
 */
export function trailSchema(parents: TrailCrumb[], current: TrailCrumb): SchemaOrg.BreadcrumbList {
	return seo.schema.breadcrumbs([...parents, current]);
}

/**
 * The social card the layout advertises for this page, so a node's image and the Open
 * Graph image name one file.
 *
 * @param input - The page's copy, whose card title defaults to its heading.
 * @returns The card's absolute URL.
 */
function cardImage(input: PageSchemaInput): string {
	let canonical = seo.canonical(input.url);
	return socialCardUrl({
		title: input.cardTitle ?? input.name,
		description: input.description,
		path: new URL(canonical).pathname,
	});
}
