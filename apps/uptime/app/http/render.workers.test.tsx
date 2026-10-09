/**
 * Tests frame resolution through the app's rendering chain on workerd, where a response body is
 * read in pieces: the renderer inlines a frame's first piece in place and streams the rest after
 * it, so a fragment past one piece's size must still land whole inside its frame's template.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css, Frame } from "remix/component";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { htmlRendering } from "./render";

/** How many rows the fragment renders, enough to run its markup well past 4 KB. */
const ROWS = 200;

/** A page with one deferred frame, and the fragment behind it rendered as a frame route does. */
async function visit() {
	let router = createRouter({ middleware: htmlRendering() });

	router.get("/fragment", (ctx) =>
		ctx.render(
			<ul mix={[css({ display: "grid", gap: "8px" })]}>
				{Array.from({ length: ROWS }, (_, index) => (
					<li mix={[css({ padding: `${index % 7}px` })]}>Row {index} of the fragment</li>
				))}
				<li id="last-row">Last row</li>
			</ul>,
		),
	);
	router.get("/", (ctx) =>
		ctx.render(
			<html lang="en">
				<body>
					<Frame name="fragment" src="/fragment" fallback={<p>Loading</p>} />
				</body>
			</html>,
		),
	);

	return await (await router.fetch(new Request("https://uptime.test/"))).text();
}

describe("a frame rendered through htmlRendering() on workerd", () => {
	test("lands its whole fragment inside its template", async () => {
		let html = await visit();
		let template = /<template id="[^"]+">([\s\S]*?)<\/template>/.exec(html);

		expect(template?.[1]?.length).toBeGreaterThan(4096);
		expect(template?.[1]).toContain('<li id="last-row">Last row</li>');
		expect(html.slice((template?.index ?? 0) + (template?.[0].length ?? 0))).not.toContain("Row ");
	});
});
