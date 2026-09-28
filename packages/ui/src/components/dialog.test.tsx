/**
 * Tests for the panel's positioning scheme: a modal dialog is measured against
 * the viewport, while the page's flow keeps the containing block its dismiss
 * control pins itself to. Both come from the panel's own emitted stylesheet,
 * so these assertions read the CSS the component renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Dialog } from "./dialog.js";

/**
 * Renders a panel and returns the CSS text of every `<style>` tag it emitted,
 * joined in emission order — which is also the order the generated cascade
 * layers resolve in, so a later rule wins over an earlier one.
 */
async function panelStyles(): Promise<string> {
	let html = await renderToString(
		<Dialog id="confirm-delete">
			<Dialog.Header>
				<Dialog.Title>Delete project?</Dialog.Title>
			</Dialog.Header>
		</Dialog>,
	);

	return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
}

/**
 * Collapses whitespace so a declaration can be matched without depending on
 * how the serializer indents a nested block.
 */
function flatten(css: string): string {
	return css.replace(/\s+/g, " ");
}

describe("Dialog", () => {
	test("measures the modal panel against the viewport", async () => {
		expect(flatten(await panelStyles())).toContain("&:modal { position: fixed; }");
	});

	test("positions the modal panel after the flow scheme, which the layer order resolves in favor of", async () => {
		let css = await panelStyles();

		expect(css.indexOf("position: relative")).toBeGreaterThanOrEqual(0);
		expect(css.indexOf("position: fixed")).toBeGreaterThan(css.indexOf("position: relative"));
	});

	test("keeps the panel positioned while it sits in the page's flow, so its dismiss control has a containing block", async () => {
		expect(await panelStyles()).toContain("position: relative");
	});

	test("caps the panel's height so long content scrolls inside it", async () => {
		let css = await panelStyles();

		expect(css).toContain("max-block-size: 90vh");
		expect(css).toContain("overflow: auto");
	});
});
