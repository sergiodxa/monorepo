/**
 * Renders a card with the bundled fonts and checks the PNG that comes out: its size, the
 * background and frame colours where the design puts them, and ink where the text goes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { describe, expect, test } from "vite-plus/test";

import { SOCIAL_CARD_SIZE } from "~/app/services/social-card";
import { renderSocialCard } from "~/app/services/social-card-image";

/** The bundled faces, read from disk as the Worker receives them as data modules. */
function fonts() {
	let load = (name: string) => {
		let result = parseFont(readFileSync(join(import.meta.dirname, "../../resources/fonts", name)));
		if (result.status === "failure") throw result.error;
		return result.data;
	};
	return {
		regular: load("inter-regular.ttf.bin"),
		semibold: load("inter-semibold.ttf.bin"),
		mono: load("jetbrains-mono-regular.ttf.bin"),
	};
}

/** The RGB bytes at one pixel. */
function rgb(image: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
	let offset = (y * image.width + x) * 4;
	return Array.from(image.data.slice(offset, offset + 3));
}

/** How many pixels in a horizontal band differ from the background by more than noise. */
function inkInRow(image: { width: number; data: Uint8ClampedArray }, y: number): number {
	let background = rgb(image, 20, 300);
	let count = 0;
	for (let x = 120; x < image.width - 120; x++) {
		let pixel = rgb(image, x, y);
		if (pixel.some((channel, index) => Math.abs(channel - (background[index] ?? 0)) > 60)) count++;
	}
	return count;
}

describe("renderSocialCard", () => {
	test("draws the frame and the text into a 1200×630 PNG", async () => {
		let bytes = await renderSocialCard(
			{
				kind: "page",
				eyebrow: "Package",
				title: "@sdxc/jwt",
				description: "Sign and verify JSON Web Tokens, with JWKS and key rotation.",
				url: "sdxc.dev/api/jwt",
				footer: "npm add @sdxc/jwt",
			},
			fonts(),
		);
		let result = await decode(bytes);
		if (result.status === "failure") throw result.error;
		let image = result.data;
		expect([image.width, image.height]).toEqual([SOCIAL_CARD_SIZE.width, SOCIAL_CARD_SIZE.height]);

		let background = rgb(image, 20, 300);
		expect(Math.max(...background)).toBeLessThan(30);
		let marker = rgb(image, 96, 96);
		expect(marker[2]).toBeGreaterThan(marker[0] ?? 0);
		expect(marker[2]).toBeGreaterThan(120);

		let inkedRows = 0;
		for (let y = 140; y < 500; y += 4) if (inkInRow(image, y) > 20) inkedRows++;
		expect(inkedRows).toBeGreaterThan(10);
	});

	test("a long title still fits between the rules", async () => {
		let bytes = await renderSocialCard(
			{
				kind: "page",
				eyebrow: "Guide",
				title:
					"A very long guide title that has to shrink and then wrap onto a second line to fit at all",
				description: "",
				url: "sdxc.dev/docs/long",
				footer: "sdxc.dev",
			},
			fonts(),
		);
		let result = await decode(bytes);
		if (result.status === "failure") throw result.error;
		expect(inkInRow(result.data, 100)).toBeLessThan(40);
		expect(inkInRow(result.data, 530)).toBeLessThan(40);
	});
});
