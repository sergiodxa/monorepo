/**
 * Tests for {@link ToggleButton}: a glyph at either edge of a label is marked so that
 * side's padding drops a step, an icon-only toggle marks neither edge, and the host
 * carries an inset-free pointer target box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vite-plus/test";

import { ToggleButton } from "./toggle-button.js";

describe(ToggleButton.name, () => {
	test("marks a leading glyph beside a label", async () => {
		let html = await renderToString(
			<ToggleButton aria-pressed={false}>
				<svg />
				Bold
			</ToggleButton>,
		);

		expect(html).toMatch(/<button [^>]*data-glyph-start/);
		expect(html).not.toMatch(/<button [^>]*data-glyph-end/);
	});

	test("marks neither edge on an icon-only toggle", async () => {
		let html = await renderToString(
			<ToggleButton aria-pressed={false} aria-label="Bold">
				<svg />
			</ToggleButton>,
		);

		expect(html).not.toMatch(/<button [^>]*data-glyph-/);
	});

	test("draws a target-size box that holds however the toggle is positioned", async () => {
		let html = await renderToString(
			<ToggleButton aria-pressed={false} size="sm" aria-label="Bold">
				<svg />
			</ToggleButton>,
		);

		expect(html).toMatch(
			/&::after \{[^}]*position: absolute;[^}]*inline-size: var\(--ui-target-size, 1\.5rem\);/,
		);
	});
});
