/**
 * Renders both card layouts with the bundled serif and checks the PNGs: their size, the dark
 * sheen behind them, and the emerald accent where each layout puts it.
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

/** Both bundled weights, read from disk as the Worker receives them as data modules. */
function fonts() {
	let load = (name: string) => {
		let result = parseFont(readFileSync(join(import.meta.dirname, "../../resources/fonts", name)));
		if (result.status === "failure") throw result.error;
		return result.data;
	};
	return {
		regular: load("source-serif-4-regular.ttf.bin"),
		semibold: load("source-serif-4-semibold.ttf.bin"),
	};
}

/** Draws a card and decodes it back into pixels. */
async function draw(content: SocialCard.Content) {
	let result = await decode(await renderSocialCard(content, fonts()));
	if (result.status === "failure") throw result.error;
	return result.data;
}

/** Counts the pixels in a box whose green clearly leads, which is the emerald accent. */
function accentPixels(
	image: { width: number; data: Uint8ClampedArray },
	box: [left: number, top: number, right: number, bottom: number],
): number {
	let count = 0;
	for (let y = box[1]; y < box[3]; y++) {
		for (let x = box[0]; x < box[2]; x++) {
			let offset = (y * image.width + x) * 4;
			let [r = 0, g = 0, b = 0] = image.data.slice(offset, offset + 3);
			if (g > 120 && g > r + 40 && g > b + 10) count++;
		}
	}
	return count;
}

describe("renderSocialCard", () => {
	test("a post card carries its kind pill and the site in emerald", async () => {
		let image = await draw({
			kind: "post",
			eyebrow: "Article",
			title: "The Remix Way",
			description: "What I learned since trying Remix v3.",
			byline: "By Sergio Xalambrí · October 2, 2026",
			url: "sergiodxa.com/articles/the-remix-way",
		});
		expect([image.width, image.height]).toEqual([SOCIAL_CARD_SIZE.width, SOCIAL_CARD_SIZE.height]);
		let corner = Array.from(image.data.slice(0, 3));
		expect(Math.max(...corner)).toBeLessThan(40);
		expect(accentPixels(image, [900, 60, 1130, 120])).toBeGreaterThan(50);
		expect(accentPixels(image, [900, 520, 1130, 580])).toBeGreaterThan(50);
	});

	test("a listing card draws its entries as emerald links", async () => {
		let image = await draw({
			kind: "listing",
			title: "Articles",
			description: "These are my articles.",
			url: "sergiodxa.com/articles",
			entries: [
				{ title: "The Remix Way", date: "Oct 02, 26" },
				{ title: "Multi-Entry Package Architecture", date: "Jul 23, 26" },
			],
		});
		expect(accentPixels(image, [100, 340, 600, 390])).toBeGreaterThan(100);
		expect(accentPixels(image, [100, 500, 600, 560])).toBe(0);
	});
});
