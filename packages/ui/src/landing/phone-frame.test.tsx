/**
 * Covers {@link PhoneFrame} bezel chrome and {@link screenCorners} clipping the screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { PhoneFrame, screenCorners } from "./phone-frame.js";

describe("PhoneFrame", () => {
	test("draws an ink bezel around the screen with the default token", async () => {
		let html = await renderToString(
			<PhoneFrame>
				<img src="/shot.webp" alt="Path" />
			</PhoneFrame>,
		);

		expect(html).toContain('data-slot="phone-frame"');
		expect(html).toContain("var(--app-bezel, #161412)");
		expect(html).toContain("border-radius: 15% / 7%");
		expect(html).toContain('src="/shot.webp"');
	});

	test("lets a page override the bezel colour", async () => {
		let html = await renderToString(
			<PhoneFrame bezel="#1a0830">
				<img src="/shot.webp" alt="" />
			</PhoneFrame>,
		);

		expect(html).toContain("background-color: #1a0830");
	});
});

describe("screenCorners", () => {
	test("clips the screen to the phone's inner radius", async () => {
		let html = await renderToString(<img src="/shot.webp" alt="" mix={[screenCorners()]} />);

		expect(html).toContain("overflow: hidden");
		expect(html).toContain("border-radius: 12.5% / 5.8%");
	});
});
