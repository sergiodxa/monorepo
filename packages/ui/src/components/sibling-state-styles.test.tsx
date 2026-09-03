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

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { ColorSwatchPicker } from "./color-swatch-picker.js";
import { RadioGroup } from "./radio-group.js";
import { Tooltip } from "./tooltip.js";

/**
 * The fingerprint of the bug this file exists for: a style-tree key not
 * starting with `&`, `@`, `:`, `[`, or `.` falls through to the declaration
 * path, where the rule serializes as `input:checked ~ &: [object Object];`.
 */
const DROPPED_RULE_FINGERPRINT = "[object Object]";

describe("styles driven by a preceding sibling's state", () => {
	/**
	 * The filled dot, the ring, and the focus outline are three separate
	 * rules; asserting all three catches a fix that only restores one and
	 * still leaves the radio looking unchecked.
	 */
	test("a radio's indicator carries real checked and focus rules", async () => {
		let html = await renderToString(
			<RadioGroup aria-label="Shipping">
				<RadioGroup.Radio value="standard">Standard</RadioGroup.Radio>
			</RadioGroup>,
		);

		expect(html).not.toContain(DROPPED_RULE_FINGERPRINT);
		expect(html).toContain(":is(input:checked) ~ &");
		expect(html).toContain(":is(input:focus-visible) ~ &");
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

	/**
	 * The hover path is the only one gated on pointer capability, so a
	 * coarse-pointer device falls back to the focus/popover path instead.
	 */
	test("a tooltip opens on its trigger's hover under a fine pointer", async () => {
		let html = await renderToString(<Tooltip id="tip">Copy</Tooltip>);

		expect(html).not.toContain(DROPPED_RULE_FINGERPRINT);
		expect(html).toContain(":is(*:hover) ~ &");
		expect(html).toContain("@media (hover: hover)");
	});
});
