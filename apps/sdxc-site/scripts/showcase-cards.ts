/**
 * Reads a showcase item's social-card palette out of its own cover screenshot: the colour the
 * page is mostly painted in becomes the card's background, its most vivid colour the accent,
 * so each card wears the item's art direction rather than the site's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ImageSize } from "~/scripts/showcase-usage";

/** Decoded straight-alpha RGBA pixels, as `@sdxc/png`'s `decode` returns them. */
export interface Pixels extends ImageSize {
	data: Uint8ClampedArray;
}

/** A card's colours as `#rrggbb`, each pair chosen to read against the other. */
export interface CardPalette {
	background: string;
	/** Text on the background. */
	foreground: string;
	accent: string;
	/** Text on the accent, as a chip filled with it sets its label. */
	onAccent: string;
}

/** Dark text, for a light background or accent. */
const INK = "#14141a";

/** Light text, for a dark background or accent. */
const PAPER = "#f6f6f8";

/**
 * What a colour must meet to be the accent, strictest first: the share of the image it covers,
 * so a stray pixel never wins, and how vivid it is as an 8-bit channel spread. A muted brand
 * colour on a mostly grey screen still wins the second pass when nothing passes the first.
 */
const ACCENT_PASSES = [
	{ share: 0.0004, chroma: 64 },
	{ share: 0.0001, chroma: 36 },
];

/** How far, in summed 8-bit channel distance, the accent must sit from the background. */
const ACCENT_DISTANCE = 90;

/**
 * Picks the card palette from an image. Colours are grouped by their top five bits per channel
 * and each group averaged, so antialiased edges fall in with the fill they belong to. A
 * screenshot with no vivid colour gets a quiet accent mixed from its text and background.
 *
 * @param accent The item's own accent as 0–255 channels, used in place of the one read.
 */
export function readPalette(image: Pixels, accent?: RGB): CardPalette {
	let groups = new Map<number, { count: number; r: number; g: number; b: number }>();
	let { data } = image;
	for (let index = 0; index < data.length; index += 4) {
		let r = data[index] ?? 0;
		let g = data[index + 1] ?? 0;
		let b = data[index + 2] ?? 0;
		let key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
		let group = groups.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
		group.count++;
		group.r += r;
		group.g += g;
		group.b += b;
		groups.set(key, group);
	}
	let colors = [...groups.values()]
		.map((group) => ({
			count: group.count,
			rgb: [group.r / group.count, group.g / group.count, group.b / group.count] as RGB,
		}))
		.sort((left, right) => right.count - left.count);
	let background = colors[0]?.rgb ?? [255, 255, 255];
	let foreground = readableOn(background);
	let pixels = data.length / 4;
	let vivid = ACCENT_PASSES.map(
		(pass) =>
			colors
				.filter(
					(entry) =>
						entry.count / pixels >= pass.share &&
						chroma(entry.rgb) >= pass.chroma &&
						distance(entry.rgb, background) >= ACCENT_DISTANCE,
				)
				.sort((left, right) => score(right) - score(left))[0],
	).find((entry) => entry !== undefined);
	let chosen = accent ?? vivid?.rgb ?? mix(background, parse(foreground), 0.55);
	return {
		background: hex(background),
		foreground,
		accent: hex(chosen),
		onAccent: readableOn(chosen),
	};
}

/** An sRGB colour as three 0–255 channels. */
export type RGB = [r: number, g: number, b: number];

/** Ranks accent candidates: vividness first, with coverage breaking near-ties. */
function score(entry: { count: number; rgb: RGB }): number {
	return chroma(entry.rgb) * Math.log2(2 + entry.count);
}

/** The spread between a colour's strongest and weakest channel, a cheap stand-in for chroma. */
function chroma([r, g, b]: RGB): number {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Summed per-channel distance. */
function distance(left: RGB, right: RGB): number {
	return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]);
}

/** Whichever of the dark and light text reaches the higher WCAG contrast against `rgb`. */
function readableOn(rgb: RGB): string {
	let surface = luminance(rgb);
	let contrast = (text: string) => {
		let other = luminance(parse(text));
		return (Math.max(surface, other) + 0.05) / (Math.min(surface, other) + 0.05);
	};
	return contrast(INK) >= contrast(PAPER) ? INK : PAPER;
}

/** WCAG relative luminance, 0 for black to 1 for white. */
function luminance(rgb: RGB): number {
	let [r = 0, g = 0, b = 0] = rgb.map((channel) => {
		let value = channel / 255;
		return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `from` moved `amount` of the way toward `to`. */
function mix(from: RGB, to: RGB, amount: number): RGB {
	return [0, 1, 2].map(
		(channel) => (from[channel] ?? 0) + ((to[channel] ?? 0) - (from[channel] ?? 0)) * amount,
	) as RGB;
}

/** A `#rrggbb` string's channels. */
function parse(value: string): RGB {
	return [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16)) as RGB;
}

/** Channels as `#rrggbb`. */
function hex(rgb: RGB): string {
	return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}
