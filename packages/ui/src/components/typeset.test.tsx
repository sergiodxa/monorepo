/**
 * Regression tests for the wide-table edge fade's `@keyframes` rule. Its stops
 * are percentages, and `remix/component`'s serializer only reads keyframe stops as
 * stop selectors while the `@keyframes` rule sits outside any selector block —
 * nested inside the table's own selector, every stop serialized as a dropped
 * `0%: [object Object]` declaration and the animation did nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vite-plus/test";

import { Typeset } from "./typeset.js";

/** The stylesheet {@link Typeset} emits, with every `<style>` tag joined. */
async function typesetCss(): Promise<string> {
	let html = await renderToString(<Typeset />);
	return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
}

describe(Typeset.name, () => {
	test("emits the table fade keyframes as real stop blocks", async () => {
		let css = await typesetCss();

		expect(css).toContain("@keyframes ui-typeset-table-fade");
		expect(css).toMatch(/\b0%\s*\{/);
		expect(css).toMatch(/\b100%\s*\{/);
		expect(css).toMatch(/\b10%,\s*90%\s*\{/);
		/** The stops are only worth emitting if they actually carry the mask. */
		expect(css).toContain("mask-image");
	});

	test("never serializes a nested style block as a declaration value", async () => {
		expect(await typesetCss()).not.toContain("[object Object]");
	});

	test("drives the animation it defines", async () => {
		let css = await typesetCss();

		expect(css).toContain("animation-name: ui-typeset-table-fade");
		expect(css).toContain("animation-timeline: scroll(self inline)");
	});

	test("sets long-form body copy at 18px for docs and 20px for reading", async () => {
		let css = await typesetCss();

		expect(css).toContain("--ui-typeset-size: 1.125rem");
		expect(css).toContain("--ui-typeset-size: 1.25rem");
		expect(css).toContain("--ui-typeset-size: 0.9375rem");
		expect(css).not.toContain("--ui-typeset-size: 1rem");
		expect(css).toContain("font-size: var(--ui-typeset-size, 1.125rem)");
		expect(css).toContain("font-size: calc(var(--ui-typeset-size, 1.125rem) * 2)");
	});

	test("lets a vertical wheel over a code block chain to the page", async () => {
		let css = await typesetCss();

		expect(css).toContain("overflow-inline: auto");
		expect(css).toContain("overflow-block: hidden");
		expect(css).toContain("overscroll-behavior-inline: contain");
		expect(css).toContain("overscroll-behavior-x: contain");
		expect(css).not.toMatch(/overscroll-behavior:\s*contain/);
	});
});
