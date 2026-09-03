/**
 * End-to-end tests rendering real `<div mix={...}>` elements through
 * `remix/ui`'s server renderer, asserting on the generated CSS text and class
 * attribute in the rendered HTML, so merging, nesting, and dedupe are observed
 * the way a real consumer sees them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { border } from "../color/border.js";
import { var as varUtility } from "../general/var.js";
import { at } from "../responsive/at.js";
import { p } from "../size/p.js";
import { hover } from "../state/hover.js";
import { rotate } from "../transform/rotate.js";
import { scale } from "../transform/scale.js";
import { translateX } from "../transform/translate-x.js";

describe("rendering a real <div mix={...}>", () => {
	test("an atomic utility renders its declaration in a <style> tag and applies a class", async () => {
		let html = await renderToString(<div mix={p(4)} />);

		expect(html).toContain("<style");
		expect(html).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 4);");
		expect(html.match(/class="[^"]+"/)).not.toBeNull();
	});

	test("multiple utilities in a mix array each render their own declaration without overwriting the other", async () => {
		let html = await renderToString(<div mix={[p(4), bg("brand.tint")]} />);

		expect(html).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 4);");
		expect(html).toContain("background-color: var(--ui-brand-bg-tint);");
	});

	test("a wrapper utility merges its inputs into one nested rule instead of two separate classes", async () => {
		let html = await renderToString(<div mix={hover([bg("brand.tint"), border("brand")])} />);

		expect(html).toContain("&:hover");
		expect(html).toContain("background-color: var(--ui-brand-bg-tint);");
		expect(html).toContain("border-color: var(--ui-brand-border);");
	});

	test("nested wrappers compose: a container query around a plain declaration and a merged &:hover block", async () => {
		let html = await renderToString(<div mix={at("md", [p(4), hover(p(6))])} />);

		expect(html).toContain("@container (min-width: 36rem)");
		expect(html).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 4);");
		expect(html).toContain("&:hover");
		expect(html).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 6);");
	});

	test("var() composes into another utility as a raw CSS value", async () => {
		let html = await renderToString(<div mix={p(varUtility("gap", "1rem"))} />);

		expect(html).toContain("padding: var(--gap, 1rem);");
	});

	test("independent transform utilities combine on the same element instead of overwriting each other", async () => {
		let html = await renderToString(<div mix={[translateX(4), rotate(45), scale(1.2)]} />);

		expect(html).toContain("--ui-translate-x: calc(var(--ui-spacing, 0.25rem) * 4);");
		expect(html).toContain("--ui-rotate: 45deg;");
		expect(html).toContain("--ui-scale-x: 1.2;");
		expect(html).toContain("--ui-scale-y: 1.2;");
		let transformDeclarations = [...html.matchAll(/transform: ([^;]+);/g)].map((match) => match[1]);
		expect(transformDeclarations).toHaveLength(3);
		expect(new Set(transformDeclarations).size).toBe(1);
		expect(html.match(/class="[^"]*\s[^"]*\s[^"]*"/)).not.toBeNull();
	});

	test("two elements with structurally identical utilities share the same generated class", async () => {
		let html = await renderToString(
			<div>
				<div mix={p(4)} />
				<div mix={p(4)} />
			</div>,
		);

		let classes = [...html.matchAll(/class="([^"]+)"/g)].map((match) => match[1]);
		expect(classes).toHaveLength(2);
		expect(classes[0]).toBe(classes[1]);
	});
});
