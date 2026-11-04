/**
 * Draws the landing's Open Graph card: the same paper, teal and code-chip colors
 * the page uses, with the brand, the pitch and the production host. Platforms
 * fetch this once per share, so the route stores the PNG and serves it again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";

import { Canvas, color, Path, radialGradient, TRANSPARENT, withAlpha } from "@sdxc/raster";

import {
	OG_IMAGE_HEIGHT,
	OG_IMAGE_WIDTH,
	SITE_BRAND,
	SITE_ORIGIN,
	SITE_TAGLINE,
} from "~/config/site";

export namespace OgImage {
	/** The three faces a card is set in. */
	export interface Fonts {
		/** The pitch under the brand. */
		regular: Font;
		/** The brand. */
		semibold: Font;
		/** The eyebrow and the host chip. */
		mono: Font;
	}
}

/** Inset every line of type shares, clear of the accent bar. */
const PAD = 88;

/** The landing's colors, as the stylesheet declares them. */
const PALETTE = {
	paper: color("oklch(0.97 0.008 220)"),
	ink: color("oklch(0.18 0.02 230)"),
	inkSoft: color("oklch(0.32 0.025 230)"),
	accent: color("oklch(0.62 0.12 195)"),
	accentInk: color("oklch(0.28 0.06 195)"),
	grid: color("oklch(0.88 0.012 220)"),
	codeBg: color("oklch(0.16 0.02 230)"),
	codeFg: color("oklch(0.9 0.02 195)"),
};

/** Host printed in the chip, without the scheme. */
const HOST = new URL(SITE_ORIGIN).host;

/**
 * Renders the landing card as PNG bytes. Drawing is CPU work, so the route
 * stores the result and serves that copy until the revision in the URL changes.
 *
 * @param fonts - The faces parsed for this isolate.
 * @returns The PNG bytes.
 */
export async function renderOgImage(fonts: OgImage.Fonts): Promise<Uint8Array> {
	let canvas = new Canvas(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
	canvas.fillRect(0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, PALETTE.paper);
	canvas.fillRect(
		0,
		0,
		OG_IMAGE_WIDTH,
		OG_IMAGE_HEIGHT,
		radialGradient({
			center: [OG_IMAGE_WIDTH * 0.86, 40],
			radius: [OG_IMAGE_WIDTH * 0.55, OG_IMAGE_HEIGHT * 0.7],
			stops: [
				[0, withAlpha(PALETTE.accent, 0.34)],
				[0.72, TRANSPARENT],
			],
		}),
	);
	drawGrid(canvas);
	canvas.fillRect(0, 0, 12, OG_IMAGE_HEIGHT, PALETTE.accent);
	canvas.text("PAY PER CALL", {
		font: fonts.mono,
		size: 22,
		tracking: 4,
		x: PAD,
		y: 168,
		paint: PALETTE.accentInk,
	});
	canvas.fillRect(PAD, 196, 72, 4, PALETTE.accent);
	canvas.text(SITE_BRAND, {
		font: fonts.semibold,
		size: 92,
		tracking: -2,
		x: PAD,
		y: 310,
		paint: PALETTE.ink,
	});
	canvas.text(SITE_TAGLINE, {
		font: fonts.regular,
		size: 36,
		minSize: 28,
		maxLines: 2,
		maxWidth: 860,
		lineHeight: 1.25,
		x: PAD,
		y: 390,
		paint: PALETTE.inkSoft,
	});
	drawHost(canvas, fonts.mono);
	return canvas.toPNG();
}

/** A faint grid that fades out from the middle, so the type stays the loudest thing. */
function drawGrid(canvas: Canvas): void {
	canvas.mask(
		radialGradient({
			center: [OG_IMAGE_WIDTH * 0.42, OG_IMAGE_HEIGHT * 0.46],
			radius: 640,
			stops: [
				[0, color("#fff")],
				[0.78, TRANSPARENT],
			],
		}),
		() => {
			for (let x = 0; x <= OG_IMAGE_WIDTH; x += 48) {
				canvas.fillRect(x, 0, 1, OG_IMAGE_HEIGHT, PALETTE.grid);
			}
			for (let y = 0; y <= OG_IMAGE_HEIGHT; y += 48) {
				canvas.fillRect(0, y, OG_IMAGE_WIDTH, 1, PALETTE.grid);
			}
		},
	);
}

/** The production host, set in the landing's dark code chip. */
function drawHost(canvas: Canvas, mono: Font): void {
	let size = 26;
	let label = canvas.measureText(HOST, { font: mono, size, x: 0, y: 0 });
	let x = PAD;
	let y = 508;
	let width = label.width + 56;
	let height = 64;
	canvas.fillPath(Path.roundedRect(x, y, width, height, 14), PALETTE.codeBg);
	canvas.text(HOST, {
		font: mono,
		size,
		x: x + (width - label.width) / 2,
		y: y + 42,
		paint: PALETTE.codeFg,
	});
}
