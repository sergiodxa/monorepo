/**
 * Draws a page's social card in the landing page's closing band: a dark field with a brand
 * glow, a grid fading out from the middle, dashed rails and rules framed by indigo markers, and
 * the page's eyebrow, title and description centred inside. A showcase item's card instead
 * wears the item's own colours, with its cover in a window bleeding off the card's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";
import type { Raster } from "@sdxc/raster";

import {
	Canvas,
	color,
	imagePattern,
	Path,
	radialGradient,
	TRANSPARENT,
	withAlpha,
} from "@sdxc/raster";

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
 * How strongly a showcase card's tagline and its address are set against the background:
 * dimmed so the name leads, and kept above WCAG AA contrast on every palette the showcase uses.
 */
export const TAGLINE_ALPHA = 0.78;

/** {@link TAGLINE_ALPHA} for the address in the corner, the quietest text on the card. */
export const ADDRESS_ALPHA = 0.62;

/**
 * A showcase card's layout, in card pixels: the text column on the left and the window on the
 * right, sized so the screenshot draws at its source's own size and runs off the right and
 * bottom edges, and every text size readable when a platform shows the card at half width.
 */
const SHOWCASE = {
	gutter: 72,
	column: 460,
	window: { x: 584, y: 150, width: 720, bar: 40, radius: 18 },
	chip: { height: 44, padding: 20, gap: 10, size: 22 },
};

/**
 * Renders the card as PNG bytes. Drawing is CPU work in the tens of milliseconds, so the
 * caller stores the result and serves it again rather than drawing per request.
 *
 * @param screenshot A showcase card's cover, decoded; without it the window shows its frame alone.
 */
export async function renderSocialCard(
	content: SocialCard.Content,
	fonts: SocialCardImage.Fonts,
	screenshot?: Raster.ImageSource,
): Promise<Uint8Array> {
	let { height, width } = SOCIAL_CARD_SIZE;
	let canvas = new Canvas(width, height);
	if (content.kind === "showcase") {
		drawShowcase(canvas, content, fonts, screenshot ?? null);
		return canvas.toPNG();
	}
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

/**
 * A showcase item's card: the item's background with a glow of its accent, its chips, name and
 * tagline down the left, the showcase's address in the corner, and its cover in a browser
 * window that runs off the right and bottom edges, so the card reads as that item at a glance.
 */
function drawShowcase(
	canvas: Canvas,
	content: SocialCard.ShowcaseContent,
	fonts: SocialCardImage.Fonts,
	screenshot: Raster.ImageSource | null,
): void {
	let { height, width } = canvas;
	let background = color(content.background);
	let foreground = color(content.foreground);
	let accent = color(content.accent);
	canvas.fillRect(0, 0, width, height, background);
	canvas.fillRect(
		0,
		0,
		width,
		height,
		radialGradient({
			center: [width * 0.86, height * 0.62],
			radius: [width * 0.46, height * 0.78],
			stops: [
				[0, withAlpha(accent, 0.38)],
				[0.8, TRANSPARENT],
			],
		}),
	);
	canvas.fillRect(0, 0, width, 10, accent);
	drawWindow(canvas, content, screenshot);
	drawChips(canvas, content, fonts);

	let x = SHOWCASE.gutter;
	let title = canvas.text(content.title, {
		font: fonts.semibold,
		size: 92,
		minSize: 60,
		tracking: -3.5,
		lineHeight: 1.02,
		maxWidth: SHOWCASE.column,
		maxLines: 2,
		x,
		y: 248,
		paint: foreground,
	});
	canvas.text(content.tagline, {
		font: fonts.regular,
		size: 34,
		minSize: 26,
		lineHeight: 1.3,
		maxWidth: SHOWCASE.column,
		maxLines: 3,
		x,
		y: 248 + title.height - title.size * 0.15 + 30,
		paint: withAlpha(foreground, TAGLINE_ALPHA),
	});
	canvas.text(content.url, {
		font: fonts.mono,
		size: 22,
		x,
		y: height - 56,
		maxWidth: SHOWCASE.column,
		maxLines: 1,
		paint: withAlpha(foreground, ADDRESS_ALPHA),
	});
}

/**
 * The status chip filled with the item's accent and the category chip outlined, as the
 * showcase's tiles set them, measured so each pill hugs its label.
 */
function drawChips(
	canvas: Canvas,
	content: SocialCard.ShowcaseContent,
	fonts: SocialCardImage.Fonts,
): void {
	let { gap, height, padding, size } = SHOWCASE.chip;
	let foreground = color(content.foreground);
	let top = 78;
	let x = SHOWCASE.gutter;
	content.chips.forEach((label, index) => {
		let text = { font: fonts.semibold, size, x: 0, y: 0 };
		let chipWidth = canvas.measureText(label, text).width + padding * 2;
		let outline = roundedRectData(x, top, chipWidth, height, height / 2);
		if (index === 0) {
			canvas.fillPath(Path.fromSVG(outline), color(content.accent));
		} else {
			let inner = roundedRectData(x + 2, top + 2, chipWidth - 4, height - 4, height / 2 - 2);
			canvas.fillPath(Path.fromSVG(`${outline}${inner}`), withAlpha(foreground, 0.42), {
				rule: "evenodd",
			});
		}
		canvas.text(label, {
			...text,
			x: x + padding,
			y: top + height / 2 + size * 0.36,
			paint: index === 0 ? color(content.onAccent) : foreground,
		});
		x += chipWidth + gap;
	});
}

/**
 * The cover in a browser window: a soft shadow stepped out in translucent layers, a hairline
 * edge, a title bar with its three dots, and the screenshot at its own size beneath, cut off by
 * the card's right and bottom edges.
 */
function drawWindow(
	canvas: Canvas,
	content: SocialCard.ShowcaseContent,
	screenshot: Raster.ImageSource | null,
): void {
	let { bar, radius, width, x, y } = SHOWCASE.window;
	let height = canvas.height - y + radius * 2;
	let foreground = color(content.foreground);
	let dark = foreground.r + foreground.g + foreground.b > 1.5;
	for (let step = 1; step <= 12; step++) {
		canvas.fillPath(
			Path.roundedRect(x - step, y + step * 2, width + step * 2, height, radius + step),
			withAlpha(color("#000"), (dark ? 0.05 : 0.018) * (1 - step / 13)),
		);
	}
	canvas.fillPath(
		Path.roundedRect(x - 1.5, y - 1.5, width + 3, height + 3, radius + 1.5),
		withAlpha(foreground, dark ? 0.22 : 0.14),
	);
	canvas.fillPath(
		Path.roundedRect(x, y, width, height, radius),
		color(dark ? "#1c1c21" : "#ffffff"),
	);
	[0, 1, 2].forEach((index) => {
		canvas.fillPath(
			Path.fromSVG(circleData(x + 26 + index * 22, y + bar / 2, 6)),
			withAlpha(foreground, 0.22),
		);
	});
	canvas.fillRect(x, y + bar - 1, width, 1, withAlpha(foreground, 0.12));
	if (screenshot === null) return;
	canvas.fillPath(
		Path.rect(x, y + bar, width, screenshot.height),
		imagePattern({ image: screenshot, transform: [1, 0, 0, 1, x, y + bar] }),
	);
}

/** One rounded rectangle as SVG path data, so several combine into one path with holes. */
function roundedRectData(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): string {
	let r = Math.min(radius, width / 2, height / 2);
	return `M${x + r} ${y}H${x + width - r}A${r} ${r} 0 0 1 ${x + width} ${y + r}V${y + height - r}A${r} ${r} 0 0 1 ${x + width - r} ${y + height}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + height - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** A circle as SVG path data. */
function circleData(cx: number, cy: number, r: number): string {
	return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}
