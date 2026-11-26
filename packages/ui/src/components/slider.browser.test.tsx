/**
 * Draws a slider in a real browser and reads the pixels of its thumb, so the thumb sits on the
 * rail's centre line even though its input grows past the thumb to a full pointer target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Slider } from "./slider.js";

/** Paints the thumb red and the rail blue, so a pixel scan finds each centre line. */
const PAINT = `
	[data-test-slider] input::-webkit-slider-thumb { background: rgb(255 0 0); border: 0; box-shadow: none; }
	[data-test-slider] [data-slot="slider"] > div::before { background: rgb(0 0 255); }
	[data-test-slider] [data-slot="slider"] > div::after { background: transparent; }
`;

let cleanup: Array<() => void> = [];

afterEach(() => {
	for (let step of cleanup) step();
	cleanup = [];
});

/** The middle row of the pixels `match` picks in a PNG screenshot. */
async function centreRow(
	base64: string,
	match: (red: number, green: number, blue: number) => boolean,
): Promise<number> {
	let bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	let bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
	let canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	let context = canvas.getContext("2d")!;
	context.drawImage(bitmap, 0, 0);
	let { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
	let rows: number[] = [];
	for (let y = 0; y < bitmap.height; y += 1) {
		for (let x = 0; x < bitmap.width; x += 1) {
			let at = (y * bitmap.width + x) * 4;
			if (match(data[at]!, data[at + 1]!, data[at + 2]!)) {
				rows.push(y);
				break;
			}
		}
	}
	return ((rows[0] ?? 0) + (rows.at(-1) ?? 0)) / 2;
}

test("centres the thumb on the track when its pointer target is taller than the thumb", async () => {
	let style = document.createElement("style");
	style.textContent = PAINT;
	document.head.appendChild(style);
	let host = document.createElement("div");
	host.setAttribute("data-test-slider", "");
	host.style.cssText =
		"width: 200px; padding: 20px; --ui-slider-thumb-size: 20px; --ui-target-size: 40px;";
	document.body.appendChild(host);
	let mounted = render(
		<Slider min={0} max={100} value={50}>
			<Slider.Track>
				<Slider.Thumb aria-label="Volume" />
			</Slider.Track>
		</Slider>,
		{ container: host },
	);
	cleanup.push(
		() => mounted.cleanup(),
		() => host.remove(),
		() => style.remove(),
	);

	let shot: unknown = await page.screenshot({ element: host, base64: true, save: false });
	let base64 = typeof shot === "string" ? shot : (shot as { base64: string }).base64;
	let thumb = await centreRow(base64, (red, green, blue) => red > 200 && green < 60 && blue < 60);
	let rail = await centreRow(base64, (red, green, blue) => blue > 200 && red < 60 && green < 60);

	expect(Math.abs(thumb - rail)).toBeLessThanOrEqual(devicePixelRatio);
});
