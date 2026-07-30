/**
 * Unit tests for {@link "./create-seo"}: the configured origin is what every URL the
 * instance returns is built from, the site identity it exposes is exactly what the head
 * components need, and the schema builders it hands back are bound to the same
 * configuration rather than to whichever host served the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createSeo } from "./create-seo";

/** An instance standing in for a site's single configured registration. */
function seo() {
	return createSeo({
		baseUrl: "https://example.com/",
		siteName: "Example",
		defaultDescription: "A site used by the tests.",
		twitter: { site: "@example" },
	});
}

describe("createSeo", () => {
	test("normalizes the configured base URL once", () => {
		expect(seo().baseUrl).toBe("https://example.com");
	});

	test("exposes the site identity the head components need", () => {
		expect(seo().site).toEqual({
			name: "Example",
			description: "A site used by the tests.",
			twitter: { site: "@example" },
		});
	});

	test("omits Twitter entirely when the site has no presence there", () => {
		let instance = createSeo({
			baseUrl: "https://example.com",
			siteName: "Example",
			defaultDescription: "A site used by the tests.",
		});

		expect(instance.site).not.toHaveProperty("twitter");
	});

	test("canonicalizes against the configured origin, not the serving host", () => {
		expect(seo().canonical("https://preview.workers.dev/features/monitors/")).toBe(
			"https://example.com/features/monitors",
		);
	});

	test("resolves asset paths absolute", () => {
		expect(seo().absolute("/og/cover.png")).toBe("https://example.com/og/cover.png");
	});

	test("builds robots directives", () => {
		expect(seo().robotsTag({ index: false, follow: true })).toBe("noindex, follow");
	});

	test("serializes structured data through the escaping serializer", () => {
		let instance = seo();
		let serialized = instance.jsonLdString(
			instance.schema.webPage({
				name: "Docs",
				description: "Closes the tag: </script>",
				url: "/docs",
			}),
		);

		expect(serialized).not.toInclude("</script");
		expect(serialized).toInclude("\\u003c/script");
	});

	test("binds the schema builders to the same configuration", () => {
		let node = seo().schema.website();

		expect(node.name).toBe("Example");
		expect(node.url).toBe("https://example.com");
		expect(node.description).toBe("A site used by the tests.");
	});

	test("accepts a URL instance as the configured base URL", () => {
		let instance = createSeo({
			baseUrl: new URL("https://example.com/ignored/path"),
			siteName: "Example",
			defaultDescription: "A site used by the tests.",
		});

		expect(instance.canonical("/pricing")).toBe("https://example.com/pricing");
	});
});
