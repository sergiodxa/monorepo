/**
 * Draws the {@link AccentText} display treatments in a real browser: the sheen paints the
 * glyphs from the ink it inherits, the pill sets the word at half size in an outlined
 * capsule, and the chip leads its word with a dot on a brand tint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { AccentText } from "./accent-text.js";

/** Mounts a 64px headline holding `accent` and returns the accent span. */
function mount(accent: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.setProperty("--ui-brand-fg", "rgb(79 70 229)");
	host.style.setProperty("--ui-brand-bg-solid", "rgb(79 70 229)");
	document.body.appendChild(host);
	render(<h1 style="font-size: 64px; color: rgb(17 17 17)">The {accent} gateway</h1>, {
		container: host,
	});
	return host.querySelector<HTMLElement>('[data-slot="accent-text"]')!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("AccentText sheen", () => {
	test("clips a gradient of the inherited ink to the glyphs", () => {
		let span = mount(<AccentText variant="sheen">AI</AccentText>);
		let style = getComputedStyle(span);

		expect(style.backgroundImage).toContain("linear-gradient");
		expect(style.backgroundClip).toBe("text");
		expect(style.webkitTextFillColor).toBe("rgba(0, 0, 0, 0)");
		expect(style.color).toBe("rgb(17, 17, 17)");
	});
});

describe("AccentText pill", () => {
	test("sets the word at half size, uppercase, in an outlined capsule on the line", () => {
		let span = mount(<AccentText variant="pill">AI</AccentText>);
		let style = getComputedStyle(span);
		let heading = span.parentElement!.getBoundingClientRect();
		let box = span.getBoundingClientRect();

		expect(style.fontSize).toBe("32px");
		expect(style.textTransform).toBe("uppercase");
		expect(parseFloat(style.borderTopWidth)).toBeGreaterThanOrEqual(2);
		expect(box.top).toBeGreaterThanOrEqual(heading.top);
		expect(box.bottom).toBeLessThanOrEqual(heading.bottom);
	});
});

describe("AccentText chip", () => {
	test("leads the word with a dot on a brand tint, on one line", () => {
		let span = mount(<AccentText variant="chip">for teams</AccentText>);
		let dot = getComputedStyle(span, "::before");

		expect(getComputedStyle(span).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(span).color).toBe("rgb(79, 70, 229)");
		expect(parseFloat(dot.inlineSize)).toBeCloseTo(64 * 0.3, 0);
		expect(span.getClientRects()).toHaveLength(1);
	});
});
