/**
 * Unit tests for the builders in {@link "./schema"}: every node declares the one
 * schema.org context and its own `@type`, nested nodes carry theirs, page URLs come out
 * canonical while asset URLs come out absolute, and optional properties are absent
 * rather than present-and-empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createSchemaBuilders } from "./schema";

const BASE_URL = "https://example.com";

/** The builder set under test, bound to a fictional site. */
function builders() {
	return createSchemaBuilders({
		baseUrl: BASE_URL,
		siteName: "Example",
		defaultDescription: "A site used by the tests.",
	});
}

describe("organization", () => {
	test("declares the context and type", () => {
		let node = builders().organization({ name: "Example Inc" });

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("Organization");
	});

	test("falls back to the configured base URL", () => {
		expect(builders().organization({ name: "Example Inc" }).url).toBe("https://example.com");
	});

	test("resolves the logo path absolute", () => {
		let node = builders().organization({ name: "Example Inc", logo: "/icon-512.png" });

		expect(node.logo).toBe("https://example.com/icon-512.png");
	});

	test("omits properties it was given none of", () => {
		let node = builders().organization({ name: "Example Inc" });

		expect(node).not.toHaveProperty("logo");
		expect(node).not.toHaveProperty("sameAs");
		expect(node).not.toHaveProperty("description");
	});

	test("passes profile URLs through untouched", () => {
		let node = builders().organization({
			name: "Example Inc",
			sameAs: ["https://github.com/example"],
		});

		expect(node.sameAs).toEqual(["https://github.com/example"]);
	});
});

describe("website", () => {
	test("declares the context and type", () => {
		let node = builders().website();

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("WebSite");
	});

	test("falls back to the configured site identity", () => {
		let node = builders().website();

		expect(node.name).toBe("Example");
		expect(node.url).toBe("https://example.com");
		expect(node.description).toBe("A site used by the tests.");
	});

	test("builds a search action with its nested entry point", () => {
		let node = builders().website({ searchAction: { urlTemplate: "/search?q={term}" } });

		expect(node.potentialAction?.["@type"]).toBe("SearchAction");
		expect(node.potentialAction?.target["@type"]).toBe("EntryPoint");
		expect(node.potentialAction?.["query-input"]).toBe("required name=search_term_string");
	});

	test("keeps the query placeholder unencoded in the search template", () => {
		let node = builders().website({
			searchAction: { urlTemplate: "/search?q={term}", queryName: "term" },
		});

		expect(node.potentialAction?.target.urlTemplate).toBe("https://example.com/search?q={term}");
		expect(node.potentialAction?.["query-input"]).toBe("required name=term");
	});
});

describe("webPage", () => {
	test("declares the context and type", () => {
		let node = builders().webPage({
			name: "Pricing",
			description: "What it costs.",
			url: "/pricing",
		});

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("WebPage");
	});

	test("canonicalizes the page URL", () => {
		let node = builders().webPage({
			name: "Monitors",
			description: "Everything the API can do.",
			url: "https://preview.workers.dev/features/monitors/",
		});

		expect(node.url).toBe("https://example.com/features/monitors");
	});

	test("wraps the primary image as an image node", () => {
		let node = builders().webPage({
			name: "Monitors",
			description: "Everything the API can do.",
			url: "/features/monitors",
			image: "/og/monitors.png",
		});

		expect(node.primaryImageOfPage).toEqual({
			"@type": "ImageObject",
			url: "https://example.com/og/monitors.png",
		});
	});

	test("normalizes a Date to an ISO string", () => {
		let node = builders().webPage({
			name: "Changelog",
			description: "What changed.",
			url: "/changelog",
			dateModified: new Date("2026-07-29T10:00:00.000Z"),
		});

		expect(node.dateModified).toBe("2026-07-29T10:00:00.000Z");
	});
});

describe("article", () => {
	test("declares the context and type", () => {
		let node = builders().article({
			headline: "How the API works",
			datePublished: "2026-07-29",
			author: { name: "Sergio" },
		});

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("Article");
	});

	test("defaults the byline to a person", () => {
		let node = builders().article({
			headline: "How the API works",
			datePublished: "2026-07-29",
			author: { name: "Sergio", url: "/about" },
		});

		expect(node.author).toEqual({
			"@type": "Person",
			name: "Sergio",
			url: "https://example.com/about",
		});
	});

	test("accepts an organizational byline", () => {
		let node = builders().article({
			headline: "Release notes",
			datePublished: "2026-07-29",
			author: { name: "Example Inc", kind: "Organization" },
		});

		expect(node.author["@type"]).toBe("Organization");
	});

	test("keeps a date-only string as given", () => {
		let node = builders().article({
			headline: "How the API works",
			datePublished: "2026-07-29",
			author: { name: "Sergio" },
		});

		expect(node.datePublished).toBe("2026-07-29");
	});

	test("normalizes one image into an absolute list", () => {
		let node = builders().article({
			headline: "How the API works",
			datePublished: "2026-07-29",
			author: { name: "Sergio" },
			image: "/og/post.png",
		});

		expect(node.image).toEqual(["https://example.com/og/post.png"]);
	});

	test("builds the publisher with a nested logo node", () => {
		let node = builders().article({
			headline: "How the API works",
			datePublished: "2026-07-29",
			author: { name: "Sergio" },
			publisher: { name: "Example Inc", logo: "/icon-512.png" },
		});

		expect(node.publisher).toEqual({
			"@type": "Organization",
			name: "Example Inc",
			logo: { "@type": "ImageObject", url: "https://example.com/icon-512.png" },
		});
	});
});

describe("breadcrumbs", () => {
	test("declares the context and type", () => {
		let node = builders().breadcrumbs([{ name: "Home", url: "/" }]);

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("BreadcrumbList");
	});

	test("numbers positions from one and canonicalizes each item", () => {
		let node = builders().breadcrumbs([
			{ name: "Home", url: "/" },
			{ name: "Docs", url: "/docs/" },
			{ name: "Alerts", url: "https://preview.workers.dev/docs/alerts" },
		]);

		expect(node.itemListElement).toEqual([
			{ "@type": "ListItem", position: 1, name: "Home", item: "https://example.com/" },
			{ "@type": "ListItem", position: 2, name: "Docs", item: "https://example.com/docs" },
			{ "@type": "ListItem", position: 3, name: "Alerts", item: "https://example.com/docs/alerts" },
		]);
	});

	test("accepts an empty trail without inventing entries", () => {
		expect(builders().breadcrumbs([]).itemListElement).toEqual([]);
	});
});

describe("faq", () => {
	test("declares the context and type", () => {
		let node = builders().faq([{ question: "Is it free?", answer: "There is a free tier." }]);

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("FAQPage");
	});

	test("pairs each question with its accepted answer node", () => {
		let node = builders().faq([{ question: "Is it free?", answer: "There is a free tier." }]);

		expect(node.mainEntity).toEqual([
			{
				"@type": "Question",
				name: "Is it free?",
				acceptedAnswer: { "@type": "Answer", text: "There is a free tier." },
			},
		]);
	});
});

describe("softwareApplication", () => {
	test("declares the context and type", () => {
		let node = builders().softwareApplication({
			name: "Example",
			applicationCategory: "WebApplication",
		});

		expect(node["@context"]).toBe("https://schema.org");
		expect(node["@type"]).toBe("SoftwareApplication");
	});

	test("builds the offer as a nested node", () => {
		let node = builders().softwareApplication({
			name: "Example",
			applicationCategory: "WebApplication",
			offers: { price: "0", priceCurrency: "USD", description: "Usage-based pricing" },
		});

		expect(node.offers).toEqual({
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			description: "Usage-based pricing",
		});
	});

	test("keeps the feature list the page passed", () => {
		let node = builders().softwareApplication({
			name: "Example",
			applicationCategory: "WebApplication",
			featureList: ["Full-text search", "Bulk export"],
		});

		expect(node.featureList).toEqual(["Full-text search", "Bulk export"]);
	});
});
