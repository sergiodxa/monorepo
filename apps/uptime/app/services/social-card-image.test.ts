/**
 * Renders both card layouts with the bundled fonts and checks the PNGs: their size, the
 * emerald highlight on a marketing headline, and a status card's bars in their status colours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { describe, expect, test } from "vite-plus/test";

import type { SocialCard } from "~/app/services/social-card";

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

/** Draws a card and decodes it back into pixels. */
async function draw(content: SocialCard.Content) {
	let result = await decode(await renderSocialCard(content, fonts()));
	if (result.status === "failure") throw result.error;
	return result.data;
}

/** Counts the pixels in a box that `match` accepts. */
function count(
	image: { width: number; data: Uint8ClampedArray },
	box: [number, number, number, number],
	match: (r: number, g: number, b: number) => boolean,
): number {
	let total = 0;
	for (let y = box[1]; y < box[3]; y++) {
		for (let x = box[0]; x < box[2]; x++) {
			let offset = (y * image.width + x) * 4;
			if (match(image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0))
				total++;
		}
	}
	return total;
}

/** A clearly green pixel, the emerald accent or an up bar. */
const isGreen = (r: number, g: number, b: number) => g > 140 && g > r + 40 && g > b + 20;

/** A clearly red pixel, a down bar. */
const isRed = (r: number, g: number, b: number) => r > 180 && r > g + 60 && r > b + 60;

describe("renderSocialCard", () => {
	test("a marketing card draws its highlighted phrase in emerald below the headline", async () => {
		let image = await draw({
			kind: "marketing",
			eyebrow: "Uptime Monitoring",
			title: "Monitor your services",
			accent: "with confidence",
			description: "Get instant alerts.",
			url: "uptime.sergiodxa.com",
		});
		expect([image.width, image.height]).toEqual([SOCIAL_CARD_SIZE.width, SOCIAL_CARD_SIZE.height]);
		expect(count(image, [80, 320, 700, 400], isGreen)).toBeGreaterThan(500);
		expect(count(image, [80, 230, 700, 300], isGreen)).toBeLessThan(50);
	});

	test("a status card draws each day as a bar in its status colour", async () => {
		let days: SocialCard.Day[] = Array.from({ length: 90 }, (_, index) =>
			index === 89 ? "down" : "up",
		);
		let image = await draw({
			kind: "status",
			title: "Acme Status",
			status: "down",
			since: "Since Oct 16, 14:32 UTC",
			services: [{ name: "API", status: "down", uptime: "99.00%", days }],
			more: 0,
			url: "uptime.sergiodxa.com/status/acme",
		});
		expect(count(image, [80, 316, 1000, 352], isGreen)).toBeGreaterThan(1000);
		expect(count(image, [1100, 316, 1120, 352], isRed)).toBeGreaterThan(50);
	});
});
