/**
 * Draws a page's social card in the landing page's closing band: a dark field with a brand
 * glow, a grid fading out from the middle, dashed rails and rules framed by indigo markers,
 * and the page's eyebrow, title and description centred inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";
import type { Raster } from "@sdxc/raster";

import { Canvas, color, radialGradient, TRANSPARENT, withAlpha } from "@sdxc/raster";

import type { SocialCard } from "~/app/services/social-card";

import { SOCIAL_CARD_SIZE } from "~/app/services/social-card";

export namespace SocialCardImage {
	/** The three faces a card is set in. */
	export interface Fonts {
		/** Descriptions. */
		regular: Font;
		/** The title and the wordmark. */
		semibold: Font;
		/** The eyebrow, the address and the footer. */
		mono: Font;
	}
}

/** The site's dark theme, from the same oklch scale its stylesheet declares. */
const PALETTE = {
	background: color("oklch(0.155 0.006 275)"),
	rule: color("oklch(0.32 0.01 275)"),
	grid: color("oklch(0.42 0.012 275)"),
	marker: color("oklch(0.52 0.17 275)"),
	eyebrow: color("oklch(0.71 0.14 275)"),
	title: color("oklch(0.965 0.005 275)"),
	description: color("oklch(0.73 0.013 275)"),
	quiet: color("oklch(0.62 0.014 275)"),
};

/**
 * The frame, in card pixels: rails and rules sit where the landing page's content column
 * meets its bands, scaled to a 1200 px card, with every line two pixels wide so it survives
 * the halving most platforms display a card at.
 */
const FRAME = {
	railLeft: 96,
	railRight: 1104,
	ruleTop: 96,
	ruleBottom: 534,
	line: 2,
	marker: 10,
	dash: 8,
	cell: 48,
};

/** Where the home card's stats band begins, as the landing page's band follows its hero. */
const HOME_BAND = 470;

/** The widest a line of centred text may run, leaving the rails room to breathe. */
const TEXT_WIDTH = 880;

/**
 * Renders the card as PNG bytes. Drawing is CPU work in the tens of milliseconds, so the
 * caller stores the result and serves it again rather than drawing per request.
 */
export async function renderSocialCard(
	content: SocialCard.Content,
	fonts: SocialCardImage.Fonts,
): Promise<Uint8Array> {
	let { height, width } = SOCIAL_CARD_SIZE;
	let canvas = new Canvas(width, height);
	canvas.fillRect(0, 0, width, height, PALETTE.background);
	canvas.fillRect(
		0,
		0,
		width,
		height,
		radialGradient({
			center: [width * 0.85, 0],
			radius: [width * 0.6, height * 0.7],
			stops: [
				[0, withAlpha(PALETTE.marker, 0.22)],
				[0.7, TRANSPARENT],
			],
		}),
	);
	if (content.kind === "home") {
		drawGrid(canvas, 0, HOME_BAND);
		drawFrame(canvas, [HOME_BAND]);
		drawHome(canvas, content, fonts);
		return canvas.toPNG();
	}
	drawGrid(canvas, FRAME.ruleTop, FRAME.ruleBottom);
	drawFrame(canvas, [FRAME.ruleTop, FRAME.ruleBottom]);
	drawHeader(canvas, content, fonts);
	drawBody(canvas, content, fonts);
	canvas.text(content.footer, {
		font: fonts.mono,
		size: 20,
		x: width / 2,
		y: 590,
		align: "center",
		maxWidth: TEXT_WIDTH,
		maxLines: 1,
		paint: PALETTE.quiet,
	});
	return canvas.toPNG();
}

/**
 * The grid behind the text, centred on the card so its lines fall symmetrically, faded by a
 * radial mask so it reads as texture near the middle and disappears toward the frame.
 */
function drawGrid(canvas: Canvas, top: number, bottom: number): void {
	let { height, width } = canvas;
	let mask = radialGradient({
		center: [width / 2, height / 2],
		radius: [width * 0.6, height * 0.75],
		stops: [
			[0, withAlpha(PALETTE.title, 0.9)],
			[0.75, TRANSPARENT],
		],
	});
	canvas.mask(mask, () => {
		for (let x = (width / 2) % FRAME.cell; x < width; x += FRAME.cell) {
			canvas.fillRect(x - 0.75, top, 1.5, bottom - top, PALETTE.grid);
		}
		for (
			let y = top + ((((height / 2 - top) % FRAME.cell) + FRAME.cell) % FRAME.cell);
			y < bottom;
			y += FRAME.cell
		) {
			canvas.fillRect(0, y - 0.75, width, 1.5, PALETTE.grid);
		}
	});
}

/** The rules across the card, the dashed rails down it, and a marker on every crossing. */
function drawFrame(canvas: Canvas, rules: number[]): void {
	let half = FRAME.line / 2;
	for (let y of rules) {
		canvas.fillRect(0, y - half, canvas.width, FRAME.line, PALETTE.rule);
	}
	for (let x of [FRAME.railLeft, FRAME.railRight]) {
		for (let y = 0; y < canvas.height; y += FRAME.dash * 2) {
			canvas.fillRect(x - half, y, FRAME.line, FRAME.dash, PALETTE.rule);
		}
	}
	let size = FRAME.marker;
	for (let x of [FRAME.railLeft, FRAME.railRight]) {
		for (let y of rules) {
			canvas.fillRect(x - size / 2, y - size / 2, size, size, PALETTE.marker);
		}
	}
}

/** The wordmark and the page's address above the top rule, as the site's header sets them. */
function drawHeader(
	canvas: Canvas,
	content: SocialCard.PageContent,
	fonts: SocialCardImage.Fonts,
): void {
	canvas.text("sdxc", {
		font: fonts.semibold,
		size: 32,
		tracking: -1,
		x: FRAME.railLeft + 40,
		y: 60,
		paint: PALETTE.title,
	});
	canvas.text(content.url, {
		font: fonts.mono,
		size: 20,
		x: FRAME.railRight - 40,
		y: 58,
		align: "end",
		maxWidth: 640,
		maxLines: 1,
		paint: PALETTE.quiet,
	});
}

/**
 * The eyebrow, title and description as one block centred between the rules. The title
 * shrinks to fit two lines before it truncates, and the block is measured first so a
 * one-line title and a two-line one both sit in the middle.
 */
function drawBody(
	canvas: Canvas,
	content: SocialCard.PageContent,
	fonts: SocialCardImage.Fonts,
): void {
	let x = canvas.width / 2;
	let eyebrow = textOptions(fonts.mono, 24, x, { maxLines: 1, paint: PALETTE.eyebrow });
	let title = textOptions(fonts.semibold, 76, x, {
		tracking: -3,
		lineHeight: 1.08,
		maxLines: 2,
		minSize: 52,
		paint: PALETTE.title,
	});
	let description = textOptions(fonts.regular, 28, x, {
		lineHeight: 1.45,
		maxLines: 2,
		paint: PALETTE.description,
	});
	let eyebrowGap = 28;
	let descriptionGap = 30;
	let titleMetrics = canvas.measureText(content.title, title);
	let descriptionMetrics = content.description
		? canvas.measureText(content.description, description)
		: { height: 0, size: description.size };
	let blockHeight =
		eyebrow.size +
		eyebrowGap +
		titleMetrics.height +
		(descriptionMetrics.height ? descriptionGap + descriptionMetrics.height : 0);
	let top = (FRAME.ruleTop + FRAME.ruleBottom) / 2 - blockHeight / 2;

	canvas.text(content.eyebrow, { ...eyebrow, y: top + eyebrow.size * 0.8 });
	let titleTop = top + eyebrow.size + eyebrowGap;
	canvas.text(content.title, { ...title, y: titleTop + titleMetrics.size * 0.82 });
	if (content.description) {
		let descriptionTop = titleTop + titleMetrics.height + descriptionGap;
		canvas.text(content.description, { ...description, y: descriptionTop + description.size });
	}
}

/** Centred text options with the card's text width, ready to measure and then draw. */
function textOptions(
	font: Font,
	size: number,
	x: number,
	rest: Partial<Raster.TextOptions>,
): Raster.TextOptions {
	return { font, size, x, y: 0, align: "center", maxWidth: TEXT_WIDTH, ...rest };
}

/**
 * The home card, set like the landing page's hero: the wordmark large and centred with the
 * pitch under it in the space above the frame's rule, and the collection's counts in a band
 * below, divided like the page's stats band.
 */
function drawHome(
	canvas: Canvas,
	content: SocialCard.HomeContent,
	fonts: SocialCardImage.Fonts,
): void {
	let x = canvas.width / 2;
	canvas.text("sdxc", {
		font: fonts.semibold,
		size: 176,
		tracking: -8,
		x,
		y: 228,
		align: "center",
		paint: PALETTE.title,
	});
	canvas.text(content.tagline, {
		font: fonts.semibold,
		size: 40,
		tracking: -0.75,
		maxWidth: TEXT_WIDTH,
		maxLines: 1,
		x,
		y: 314,
		align: "center",
		paint: PALETTE.title,
	});
	canvas.text(content.description, {
		font: fonts.regular,
		size: 26,
		lineHeight: 1.45,
		maxWidth: 760,
		maxLines: 2,
		x,
		y: 372,
		align: "center",
		paint: PALETTE.description,
	});
	drawStats(canvas, content.stats, fonts);
}

/** The counts band between the rails, one cell per figure, divided by the frame's rule. */
function drawStats(canvas: Canvas, stats: SocialCard.Stat[], fonts: SocialCardImage.Fonts): void {
	if (stats.length === 0) return;
	let cell = (FRAME.railRight - FRAME.railLeft) / stats.length;
	stats.forEach((stat, index) => {
		let x = FRAME.railLeft + index * cell;
		if (index > 0) {
			canvas.fillRect(
				x - FRAME.line / 2,
				HOME_BAND,
				FRAME.line,
				canvas.height - HOME_BAND,
				PALETTE.rule,
			);
		}
		canvas.text(stat.value, {
			font: fonts.semibold,
			size: 56,
			tracking: -1.5,
			x: x + 36,
			y: HOME_BAND + 90,
			paint: PALETTE.title,
		});
		canvas.text(stat.label, {
			font: fonts.regular,
			size: 20,
			maxWidth: cell - 48,
			maxLines: 1,
			x: x + 36,
			y: HOME_BAND + 126,
			paint: PALETTE.quiet,
		});
	});
}
