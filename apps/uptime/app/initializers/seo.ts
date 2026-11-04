/**
 * The product's own SEO instance: one `@sdxc/seo` configuration holding the canonical
 * origin, site name, and default description every head URL and schema.org node is built
 * from, plus the builders whose defaults are product facts rather than page copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { createSeo } from "@sdxc/seo";

import { SITE_OWNER, SITE_OWNER_PROFILES, SITE_OWNER_X_HANDLE } from "~/config/site";
import routes from "~/routes/web";

/**
 * The site's one configured SEO instance: resolves canonical URLs onto the product's
 * origin regardless of which host served the request, and binds the schema.org builders
 * to the same identity. Twitter cards name {@link SITE_OWNER_X_HANDLE} as both the site
 * and the creator, the profile the head also links with `rel="me"`.
 *
 * @example SEO.canonical(ctx.url) // "https://uptime.sergiodxa.com/features/monitors"
 */
export const SEO = createSeo({
	baseUrl: "https://uptime.sergiodxa.com",
	siteName: "Uptime",
	defaultDescription:
		"Usage-based uptime monitoring service. Monitor websites, APIs, DNS, SSL certificates, and cron jobs from multiple global regions.",
	twitter: { card: "summary_large_image", site: SITE_OWNER_X_HANDLE, creator: SITE_OWNER_X_HANDLE },
});

/** What a page contributes to its `SoftwareApplication` node — everything else is a product fact. */
export interface ProductSchemaInput {
	/** The product or capability the page is about, as the schema's `name`. */
	name: string;
	/** The page's own meta description, reused as the node's description. */
	description: string;
	/** The page being described, a path or the request URL, canonicalized onto the product origin. */
	url: string | URL;
	/** The capabilities the page itself lists, so the node never claims features it doesn't show. */
	featureList?: string[];
}

/** A product page's schema: the application node, plus the FAQ when the page renders one. */
export interface ProductPageSchemaInput extends ProductSchemaInput {
	/** The questions the page renders, copied into `FAQPage` so the two stay the same text. */
	faqs?: readonly SchemaOrg.QuestionInput[];
}

/** A documentation page's article and the breadcrumb trail the header shows. */
export interface DocPageSchemaInput {
	title: string;
	description: string;
	/** The page path or request URL; canonicalized onto the product origin. */
	url: string | URL;
	/** The docs root crumb, already translated, matching the visible trail. */
	rootLabel: string;
	/** The section the sidebar files the page under. */
	section: string;
	/** The date-only `YYYY-MM-DD` the page states as its last update. */
	updated: string;
	keywords?: readonly string[];
}

/** A legal page's article: the visible title, the revision date, and the page URL. */
export interface LegalArticleSchemaInput {
	title: string;
	description: string;
	url: string | URL;
	/** Date-only `YYYY-MM-DD` revision the page's "last updated" line states. */
	updated: string;
	/** The request locale, because the legal prose itself is translated. */
	inLanguage: string;
}

/**
 * The publisher node for the home page: the product brand, described the way the site
 * is, with the operator's public profiles as `sameAs`. No logo, because the mark only
 * exists as inline path data.
 *
 * @returns The organization node bound to the configured origin.
 */
export function siteOrganization(): SchemaOrg.Organization {
	return SEO.schema.organization({
		name: "Uptime",
		description: SEO.site.description,
		sameAs: [...SITE_OWNER_PROFILES],
	});
}

/**
 * The site node for the home page. The search action lands on the docs search field's
 * own results URL, which is the only public search the site offers.
 *
 * @returns The website node, including that search action.
 */
export function siteWebsite(): SchemaOrg.WebSite {
	return SEO.schema.website({
		searchAction: {
			urlTemplate: `${routes.docs.search.href()}?q={search_term_string}`,
		},
	});
}

/**
 * Builds the `SoftwareApplication` node for a page whose subject is the product or one
 * of its capabilities. It's a web application, it runs anywhere, and the one
 * usage-based plan starts at the try-it page.
 *
 * @param input - The page's own name, description, URL, and rendered feature list.
 * @returns The node, with page URLs and prices already in schema.org's shapes.
 * @example getSoftwareApplicationSchema({ name: "Monitors", description: content.metaDescription, url: ctx.url })
 */
export function getSoftwareApplicationSchema(
	input: ProductSchemaInput,
): SchemaOrg.SoftwareApplication {
	return SEO.schema.softwareApplication({
		name: input.name,
		description: input.description,
		url: pageUrl(input.url),
		applicationCategory: "WebApplication",
		operatingSystem: "Any",
		offers: {
			price: "0",
			priceCurrency: "USD",
			description: "Usage-based pricing starting at $0/month",
			url: routes.trial.check.index.href(),
		},
		...(input.featureList && input.featureList.length > 0
			? { featureList: input.featureList }
			: {}),
	});
}

/**
 * The structured data for a page that sells the product or one capability: the
 * application node, and the FAQ when that page actually renders the questions.
 *
 * @param input - The page's product facts and its rendered FAQ, when it has one.
 * @returns The nodes, application first.
 */
export function productPageSchema(input: ProductPageSchemaInput): SchemaOrg.Node[] {
	return [
		getSoftwareApplicationSchema(input),
		...(input.faqs && input.faqs.length > 0 ? [SEO.schema.faq([...input.faqs])] : []),
	];
}

/**
 * The article and breadcrumb list for one documentation page. The prose is English
 * even when the chrome is translated, so the article's language stays `en`. The
 * section crumb in the header has no URL of its own, so the trail is the docs root
 * and this page; the section name is `articleSection`.
 *
 * @param input - The frontmatter and the translated docs-root label.
 * @returns The article node, then the breadcrumb list.
 */
export function docPageSchema(input: DocPageSchemaInput): SchemaOrg.Node[] {
	return [
		SEO.schema.article({
			headline: input.title,
			description: input.description,
			datePublished: input.updated,
			dateModified: input.updated,
			author: { name: SITE_OWNER.name, url: SITE_OWNER.url },
			publisher: { name: "Uptime" },
			section: input.section,
			keywords: input.keywords && input.keywords.length > 0 ? [...input.keywords] : undefined,
			inLanguage: "en",
			url: pageUrl(input.url),
		}),
		SEO.schema.breadcrumbs([
			{ name: input.rootLabel, url: routes.docs.index.href() },
			{ name: input.title, url: pageUrl(input.url) },
		]),
	];
}

/**
 * The article node for a legal page. The one date the page states is both the
 * published and modified date, and the author is the person the prose names.
 *
 * @param input - The visible title, description, revision, and request locale.
 * @returns The article node.
 */
export function legalArticleSchema(input: LegalArticleSchemaInput): SchemaOrg.Article {
	return SEO.schema.article({
		headline: input.title,
		description: input.description,
		datePublished: input.updated,
		dateModified: input.updated,
		author: { name: SITE_OWNER.name, url: SITE_OWNER.url },
		publisher: { name: "Uptime" },
		inLanguage: input.inLanguage,
		url: pageUrl(input.url),
	});
}

/**
 * The URL string a schema builder accepts. A request `URL` keeps its href, and the
 * builder applies the canonical rules on top of that.
 *
 * @param url - A path, an absolute URL string, or the request URL.
 * @returns That URL as a string.
 */
function pageUrl(url: string | URL): string {
	return typeof url === "string" ? url : url.href;
}
