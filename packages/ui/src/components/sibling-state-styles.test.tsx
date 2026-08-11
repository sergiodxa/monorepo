/**
 * Guards the components that paint a state read off a *preceding sibling*
 * rather than off the styled element itself — a radio's indicator, a colour
 * swatch's selection ring, a tooltip's hover-open — by asserting the CSS they
 * actually serialize to. Those rules are invisible to a render-only test: the
 * markup is identical whether or not the selector survived serialization.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { ColorSwatchPicker } from "./color-swatch-picker";
import { RadioGroup } from "./radio-group";
import { Tooltip } from "./tooltip";

/**
 * The fingerprint of the bug this file exists for: the style serializer only
 * accepts a style-tree key as a nested selector when it starts with `&`, `@`,
 * `:`, `[` or `.`. A key leading with an element name (`input:checked ~ &`)
 * falls through to the declaration path instead, where its object of styles is
 * stringified — so the rule reaches the stylesheet as
 * `input:checked ~ &: [object Object];` and every browser drops it.
 */
const DROPPED_RULE_FINGERPRINT = "[object Object]";

describe("styles driven by a preceding sibling's state", () => {
	test("a radio's indicator carries real checked and focus rules", async () => {
		let html = await renderToString(
			<RadioGroup aria-label="Shipping">
				<RadioGroup.Radio value="standard">Standard</RadioGroup.Radio>
			</RadioGroup>,
		);

		expect(html).not.toContain(DROPPED_RULE_FINGERPRINT);
		expect(html).toContain(":is(input:checked) ~ &");
		expect(html).toContain(":is(input:focus-visible) ~ &");
		// The filled dot, the ring around it, and the focus outline are three
		// separate rules; a fix that only restored one would still leave a radio
		// looking unchecked.
		expect(html).toContain("background-color: var(--ui-brand-bg-solid)");
		expect(html).toContain("border-color: var(--ui-brand-bg-solid)");
		expect(html).toContain("outline-color: var(--ui-brand-ring)");
	});

	test("a colour swatch carries a real selected border and ring", async () => {
		let html = await renderToString(
			<ColorSwatchPicker aria-label="Accent">
				<ColorSwatchPicker.Swatch value="#ffffff" aria-label="White" />
			</ColorSwatchPicker>,
		);

		expect(html).not.toContain(DROPPED_RULE_FINGERPRINT);
		expect(html).toContain(":is(input:checked) ~ &");
		expect(html).toContain(":is(input:focus-visible) ~ &");
		expect(html).toContain("--ui-box-shadow-ring: 0 0 0 2px var(--ui-brand-bg-solid)");
	});

	test("a tooltip opens on its trigger's hover under a fine pointer", async () => {
		let html = await renderToString(<Tooltip id="tip">Copy</Tooltip>);

		expect(html).not.toContain(DROPPED_RULE_FINGERPRINT);
		expect(html).toContain(":is(*:hover) ~ &");
		// The hover path is deliberately the only one gated on pointer capability,
		// so the coarse-pointer fallback stays the focus/popover path.
		expect(html).toContain("@media (hover: hover)");
	});
});
