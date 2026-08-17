/**
 * Rendering tests for {@link "./seo"}: the head markup is checked as the HTML a crawler
 * actually receives, since a missing canonical link or an `og:url` pointing at the wrong
 * origin is invisible to anything that only asserts on props. Structured data is checked
 * for surviving the script element intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { createSeo } from "../create-seo";

import { Seo } from "./seo";

/** An instance standing in for a site's single configured registration. */
function seo() {
	return createSeo({
		baseUrl: "https://example.com",
		siteName: "Example",
		defaultDescription: "A site used by the tests.",
		twitter: { site: "@example" },
	});
}

describe("Seo.Meta", () => {
	test("emits the title, description, and canonical link", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.Meta
				title="Monitors"
				description="Everything the API can do."
				canonical={instance.canonical("https://preview.workers.dev/features/monitors/")}
				site={instance.site}
			/>,
		);

		expect(html).toContain("<title>Monitors</title>");
		expect(html).toContain('<meta name="description" content="Everything the API can do." />');
		expect(html).toContain('<link rel="canonical" href="https://example.com/features/monitors" />');
	});

	test("points og:url at the canonical URL, never at the serving host", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.Meta
				title="Monitors"
				canonical={instance.canonical("https://preview.workers.dev/features/monitors/")}
				site={instance.site}
			/>,
		);

		expect(html).toContain(
			'<meta property="og:url" content="https://example.com/features/monitors" />',
		);
		expect(html).not.toContain("preview.workers.dev");
	});

	test("restates the title and description in both social namespaces", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.Meta
				title="Monitors"
				description="Everything the API can do."
				canonical={instance.canonical("/features/monitors")}
				site={instance.site}
				og={{ type: "article", image: instance.absolute("/og/monitors.png") }}
			/>,
		);

		expect(html).toContain('<meta property="og:type" content="article" />');
		expect(html).toContain('<meta property="og:title" content="Monitors" />');
		expect(html).toContain(
			'<meta property="og:description" content="Everything the API can do." />',
		);
		expect(html).toContain('<meta property="og:site_name" content="Example" />');
		expect(html).toContain(
			'<meta property="og:image" content="https://example.com/og/monitors.png" />',
		);
		expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
		expect(html).toContain('<meta name="twitter:site" content="@example" />');
		expect(html).toContain('<meta name="twitter:title" content="Monitors" />');
		expect(html).toContain(
			'<meta name="twitter:description" content="Everything the API can do." />',
		);
		expect(html).toContain(
			'<meta name="twitter:image" content="https://example.com/og/monitors.png" />',
		);
	});

	test("falls back to the site's default description", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.Meta canonical={instance.canonical("/")} site={instance.site} />,
		);

		expect(html).toContain('<meta name="description" content="A site used by the tests." />');
	});

	test("defaults og:type to website", async () => {
		let html = await renderToString(<Seo.Meta canonical="https://example.com/" />);

		expect(html).toContain('<meta property="og:type" content="website" />');
	});

	test("skips the tags whose input is missing", async () => {
		let html = await renderToString(<Seo.Meta canonical="https://example.com/" />);

		expect(html).not.toContain("<title>");
		expect(html).not.toContain('name="description"');
		expect(html).not.toContain('property="og:site_name"');
		expect(html).not.toContain('property="og:image"');
		expect(html).not.toContain('name="robots"');
	});

	test("emits per-page robots directives", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.Meta
				canonical={instance.canonical("/app/dashboard")}
				robots={instance.robotsTag({ index: false, follow: true })}
			/>,
		);

		expect(html).toContain('<meta name="robots" content="noindex, follow" />');
	});

	test("escapes the copy it is handed", async () => {
		let html = await renderToString(
			<Seo.Meta title='Alerts & "escalation"' canonical="https://example.com/alerts" />,
		);

		expect(html).not.toContain('Alerts & "escalation"');
		expect(html).toContain("Alerts &amp;");
	});
});

describe("Seo.JsonLd", () => {
	test("emits one script carrying the serialized nodes", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.JsonLd
				schema={[instance.schema.website(), instance.schema.organization({ name: "Example Inc" })]}
			/>,
		);

		expect(html).toContain('<script type="application/ld+json">');
		expect(html.match(/<script/g)).toHaveLength(1);
		expect(html).toContain('"@type":"WebSite"');
		expect(html).toContain('"@type":"Organization"');
	});

	test("keeps the JSON parseable, with no entity-escaped quotes", async () => {
		let instance = seo();
		let html = await renderToString(<Seo.JsonLd schema={instance.schema.website()} />);
		let body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));

		expect(body).not.toContain("&quot;");
		expect(JSON.parse(body)).toMatchObject({ "@type": "WebSite", name: "Example" });
	});

	test("cannot be closed early by content", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo.JsonLd
				schema={instance.schema.webPage({
					name: "Docs",
					description: 'Closes the tag: </script><script>alert("xss")</script>',
					url: "/docs",
				})}
			/>,
		);

		expect(html.match(/<script/g)).toHaveLength(1);
		expect(html.match(/<\/script>/g)).toHaveLength(1);
		expect(html).toContain("\\u003c/script");
	});
});

describe("Seo", () => {
	test("emits the metadata tags and the structured-data script together", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo
				title="Example"
				canonical={instance.canonical("/")}
				site={instance.site}
				schema={instance.schema.website()}
			/>,
		);

		expect(html).toContain("<title>Example</title>");
		expect(html).toContain('<link rel="canonical" href="https://example.com/" />');
		expect(html).toContain('<script type="application/ld+json">');
	});

	test("emits no script when the page has no structured data", async () => {
		let instance = seo();
		let html = await renderToString(
			<Seo title="Example" canonical={instance.canonical("/")} site={instance.site} />,
		);

		expect(html).not.toContain("<script");
	});
});
