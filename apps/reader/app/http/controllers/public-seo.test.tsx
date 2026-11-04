/**
 * Reads the public pages back the way a crawler and an IndieWeb consumer do: the
 * head tags and schema.org JSON-LD from `@sdxc/seo`, and the h-card and h-entry
 * from `@sdxc/microformats`. A missing class or a question that the page does not
 * show fails here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { findItem, parse } from "@sdxc/microformats";
import { postType, readEntry, representativeCard } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import docsIndex from "~/app/http/controllers/docs/index";
import docsShow from "~/app/http/controllers/docs/show";
import home from "~/app/http/controllers/home";
import comparison from "~/app/http/controllers/marketing/comparison";
import feature from "~/app/http/controllers/marketing/feature";
import useCase from "~/app/http/controllers/marketing/use-case";
import { createTestRouter, fetchRoute, ORIGIN } from "~/app/test/controller";
import { PUBLISHER, SITE_URL } from "~/config/site";
import en from "~/resources/locales/en";
import routes from "~/routes/web";

/** A router with the public pages mapped and nobody signed in. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.home, home);
	router.map(routes.marketing.feature, feature);
	router.map(routes.marketing.useCase, useCase);
	router.map(routes.marketing.comparison, comparison);
	router.map(routes.docs.index, docsIndex);
	router.map(routes.docs.show, docsShow);
	return router;
}

/** The JSON-LD nodes in `html`, in the order the page emitted them. */
function jsonLd(html: string): SchemaOrg.Node[] {
	let match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
	if (!match?.[1]) throw new Error("Expected an application/ld+json script");
	let parsed: unknown = JSON.parse(match[1]);
	if (Array.isArray(parsed)) return parsed as SchemaOrg.Node[];
	return [parsed as SchemaOrg.Node];
}

/** The `@type` of each node, for assertions that care which nodes a page carries. */
function typesOf(html: string): string[] {
	return jsonLd(html).map((node) => node["@type"]);
}

describe("public page metadata", () => {
	test("the home page describes the site, the publisher, the product and its questions", async () => {
		let response = await fetchRoute(createRouter(), `/?utm_source=newsletter`);
		let html = await response.text();
		let nodes = jsonLd(html);
		let faq = nodes.find((node) => node["@type"] === "FAQPage");

		expect(response.status).toBe(200);
		expect(typesOf(html)).toEqual(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]);
		expect(html).toContain(`rel="canonical" href="${SITE_URL}/"`);
		expect(html).not.toContain("utm_source");
		expect(html).toContain('property="og:site_name" content="Reader"');
		expect(html).toContain('name="twitter:card" content="summary"');
		expect(html).toContain('property="og:locale" content="en_US"');
		expect(html).not.toContain("noindex");
		expect(html).not.toContain('property="og:image"');
		if (!faq || faq["@type"] !== "FAQPage") throw new Error("Expected an FAQPage");
		expect(faq.mainEntity[0]?.name).toBe(en.landing.faq.anyFeed.q);
		expect(html).toContain(en.landing.faq.anyFeed.q);
		expect(html).toContain(en.landing.faq.anyFeed.a);
	});

	test("the home page's representative h-card is the publisher", async () => {
		let url = new URL(routes.home.href(), ORIGIN).href;
		let response = await createRouter().fetch(new Request(url));
		let document = unwrap(parse(await response.text(), url));
		let card = representativeCard(document, url);

		expect(card?.name).toBe(PUBLISHER.name);
		expect(card?.urls).toContain(PUBLISHER.url);
		expect(document.rels.me).toEqual([...PUBLISHER.sameAs]);
	});

	test("a feature page marks up the capability it shows and the questions under it", async () => {
		let response = await fetchRoute(
			createRouter(),
			routes.marketing.feature.href({ slug: "search" }),
		);
		let html = await response.text();
		let nodes = jsonLd(html);
		let product = nodes.find((node) => node["@type"] === "SoftwareApplication");

		expect(typesOf(html)).toEqual(["SoftwareApplication", "FAQPage"]);
		expect(html).toContain(`rel="canonical" href="${SITE_URL}/features/search"`);
		if (!product || product["@type"] !== "SoftwareApplication") {
			throw new Error("Expected a SoftwareApplication");
		}
		expect(product.offers).toBeUndefined();
		expect(product.featureList).toEqual([
			en.landing.features.pages.search.facts.one.title,
			en.landing.features.pages.search.facts.two.title,
			en.landing.features.pages.search.facts.three.title,
		]);
		expect(html).toContain(en.landing.features.pages.search.faq.one.q);
	});

	test("a way of reading and a comparison each describe the product and their questions", async () => {
		let router = createRouter();
		let useCaseHtml = await (
			await fetchRoute(router, routes.marketing.useCase.href({ slug: "news" }))
		).text();
		let comparisonHtml = await (
			await fetchRoute(router, routes.marketing.comparison.href({ slug: "feedly" }))
		).text();

		expect(typesOf(useCaseHtml)).toEqual(["SoftwareApplication", "FAQPage"]);
		expect(typesOf(comparisonHtml)).toEqual(["SoftwareApplication", "FAQPage"]);
		expect(useCaseHtml).toContain(`rel="canonical" href="${SITE_URL}/for/news"`);
		expect(comparisonHtml).toContain(`rel="canonical" href="${SITE_URL}/vs/feedly"`);
	});

	test("the help hub is a web page in the request's language", async () => {
		let response = await createRouter().fetch(
			new Request(new URL(routes.docs.index.href(), ORIGIN), {
				headers: { "accept-language": "es" },
			}),
		);
		let html = await response.text();
		let [page] = jsonLd(html);

		expect(html).toContain('lang="es"');
		expect(html).toContain('property="og:locale" content="es_ES"');
		if (!page || page["@type"] !== "WebPage") throw new Error("Expected a WebPage");
		expect(page.inLanguage).toBe("es");
		expect(page.url).toBe(`${SITE_URL}/docs`);
	});

	test("a help article is an h-entry under a breadcrumb trail", async () => {
		let path = routes.docs.show.href({ slug: "getting-started" });
		let url = new URL(`${path}?feedback=sent`, ORIGIN).href;
		let response = await createRouter().fetch(new Request(url));
		let html = await response.text();
		let document = unwrap(parse(html, url));
		let item = findItem(document, "h-entry");
		if (!item) throw new Error("Expected an h-entry");
		let entry = unwrap(readEntry(item));
		let nodes = jsonLd(html);

		expect(html).toContain(`rel="canonical" href="${SITE_URL}/docs/getting-started"`);
		expect(html).not.toContain("feedback=sent");
		expect(html).toContain('property="og:type" content="article"');
		expect(entry.name).toBe(en.docs.pages["getting-started"].title);
		expect(entry.summary).toBe(en.docs.pages["getting-started"].description);
		expect(entry.url).toBe(new URL(path, url).href);
		expect(entry.author?.name).toBe(PUBLISHER.name);
		expect(entry.content?.value).toContain("Reader keeps one list");
		expect(postType(item)).toBe("article");
		expect(nodes.map((node) => node["@type"])).toEqual(["WebPage", "BreadcrumbList"]);
		let trail = nodes[1];
		if (!trail || trail["@type"] !== "BreadcrumbList") throw new Error("Expected breadcrumbs");
		expect(trail.itemListElement.map((crumb) => crumb.name)).toEqual([
			en.docs.eyebrow,
			en.docs.pages["getting-started"].title,
		]);
	});
});
