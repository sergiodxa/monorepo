/**
 * Tests the root document shell's fixed contributions — the ones no page opts into, so
 * no page test would notice them going missing. Chiefly the Cloudflare Web Analytics
 * beacon: it is the site's only measurement, it ships from this one place, and it fails
 * silently, so its `src`, `type`, and `data-cf-beacon` payload are asserted verbatim.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import DocumentLayout from "./document";

/** Renders the shell around a trivial body, which is all these assertions need. */
function renderDocument() {
	return renderToString(
		<DocumentLayout title="Test">
			<p>Body</p>
		</DocumentLayout>,
	);
}

describe("DocumentLayout", () => {
	test("loads the Cloudflare Web Analytics beacon", async () => {
		let html = await renderDocument();

		expect(html).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
	});

	test("hands the beacon the site token in the shape it parses", async () => {
		let html = await renderDocument();

		// The renderer escapes the quotes inside the attribute value; the browser unescapes
		// them before the beacon ever reads it, so the JSON it parses is
		// `{"token": "2e915da0d572432eb502c32794ac1da6"}`.
		expect(html).toContain(
			'data-cf-beacon="{&quot;token&quot;: &quot;2e915da0d572432eb502c32794ac1da6&quot;}"',
		);
	});

	test("renders the beacon inside the body, after the page content", async () => {
		let html = await renderDocument();

		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("<body"));
		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("Body"));
	});
});
