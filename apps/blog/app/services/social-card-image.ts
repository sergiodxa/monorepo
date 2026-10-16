/**
 * Draws the blog's social cards in its own reading style: a serif face on the dark radial
 * sheen the pages sit on, the tracked author line, and the emerald accent. A post card leads
 * with its title and byline; a listing card shows its heading over its newest entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";
import type { Raster } from "@sdxc/raster";

import {
	Canvas,
	color,
	linearGradient,
	Path,
	radialGradient,
	TRANSPARENT,
	withAlpha,
} from "@sdxc/raster";

import type { SocialCard } from "~/app/services/social-card";

import { SOCIAL_CARD_SIZE } from "~/app/services/social-card";
import { PROFILE } from "~/config/profile";

export namespace SocialCardImage {
	/** The two weights of the serif a card is set in. */
	export interface Fonts {
		regular: Font;
		semibold: Font;
	}
}

/** The blog's dark theme, from the same oklch scale its stylesheet declares. */
const PALETTE = {
	sheenInner: color("oklch(0.16 0.006 250)"),
	sheenOuter: color("oklch(0.24 0.008 250)"),
	row: color("oklch(0.2 0.007 250)"),
	border: color("oklch(0.32 0.01 250)"),
	title: color("oklch(0.96 0.005 250)"),
	byline: color("oklch(0.83 0.011 250)"),
	description: color("oklch(0.73 0.013 250)"),
	quiet: color("oklch(0.62 0.014 250)"),
	accent: color("oklch(0.73 0.155 162)"),
};

/** The page's side margin, which every line of text starts or ends on. */
const MARGIN = 80;

/** The baseline of the author line and the address across the top. */
const HEADER_BASELINE = 100;

/**
 * Renders the card as PNG bytes. Drawing is CPU work in the tens of milliseconds, so the
 * caller stores the result and serves it again rather than drawing per request.
 */
export async function renderSocialCard(
	content: SocialCard.Content,
	fonts: SocialCardImage.Fonts,
): Promise<Uint8Array> {
	let canvas = new Canvas(SOCIAL_CARD_SIZE.width, SOCIAL_CARD_SIZE.height);
	let sheen = backgroundSheen(canvas);
	canvas.fillRect(0, 0, canvas.width, canvas.height, sheen);
	canvas.fillRect(
		0,
		0,
		canvas.width,
		canvas.height,
		radialGradient({
			center: [canvas.width, canvas.height],
			radius: [canvas.width * 0.6, canvas.height * 0.9],
			stops: [
				[0, withAlpha(PALETTE.accent, 0.1)],
				[1, TRANSPARENT],
			],
		}),
	);
	canvas.text(PROFILE.name.toUpperCase(), {
		font: fonts.regular,
		size: 20,
		tracking: 4,
		x: MARGIN,
		y: HEADER_BASELINE,
		paint: PALETTE.quiet,
	});
	if (content.kind === "post") drawPost(canvas, content, fonts, sheen);
	else drawListing(canvas, content, fonts);
	return canvas.toPNG();
}

/**
 * The pages' own background: dark at the top left, lifting toward the far corner, as CSS
 * `radial-gradient(circle at 10% 10%, inner 20%, outer)` draws it at this size.
 */
function backgroundSheen(canvas: Canvas): Raster.RadialGradient {
	let center: Raster.Point = [canvas.width * 0.1, canvas.height * 0.1];
	return radialGradient({
		center,
		radius: Math.hypot(canvas.width - center[0], canvas.height - center[1]),
		stops: [
			[0, PALETTE.sheenInner],
			[0.2, PALETTE.sheenInner],
			[1, PALETTE.sheenOuter],
		],
	});
}

/**
 * The post card: a pill naming the kind, the title (shrinking, then wrapping to three
 * lines), the summary under it, and the byline and site under a rule along the bottom.
 */
function drawPost(
	canvas: Canvas,
	content: SocialCard.Post,
	fonts: SocialCardImage.Fonts,
	sheen: Raster.Paint,
): void {
	let right = canvas.width - MARGIN;
	drawPill(canvas, content.eyebrow.toUpperCase(), right, fonts, sheen);

	let title = canvas.text(content.title, {
		font: fonts.semibold,
		size: 76,
		minSize: 52,
		tracking: -1,
		lineHeight: 1.12,
		maxWidth: right - MARGIN,
		maxLines: 3,
		x: MARGIN,
		y: 250,
		paint: PALETTE.title,
	});
	let descriptionBaseline = 250 + (title.lines.length - 1) * title.size * 1.12 + 68;
	if (content.description && descriptionBaseline < 480) {
		canvas.text(content.description, {
			font: fonts.regular,
			size: 30,
			lineHeight: 1.4,
			maxWidth: right - MARGIN,
			maxLines: descriptionBaseline + 42 < 480 ? 2 : 1,
			x: MARGIN,
			y: descriptionBaseline,
			paint: PALETTE.description,
		});
	}

	canvas.fillRect(MARGIN, 499, right - MARGIN, 2, PALETTE.border);
	canvas.text(content.byline, {
		font: fonts.regular,
		size: 26,
		maxWidth: 760,
		maxLines: 1,
		x: MARGIN,
		y: 560,
		paint: PALETTE.byline,
	});
	canvas.text(new URL(PROFILE.canonical.origin).host, {
		font: fonts.regular,
		size: 26,
		x: right,
		y: 560,
		align: "end",
		paint: PALETTE.accent,
	});
}

/**
 * The kind's pill in the top corner, drawn like the navigation's active pill: a tinted
 * fill inside an emerald outline, its text tracked capitals.
 */
function drawPill(
	canvas: Canvas,
	label: string,
	right: number,
	fonts: SocialCardImage.Fonts,
	sheen: Raster.Paint,
): void {
	let text = { font: fonts.semibold, size: 18, tracking: 2.5, x: 0, y: 0 };
	let width = canvas.measureText(label, text).width + 44;
	let height = 42;
	let left = right - width;
	let top = HEADER_BASELINE - 28;
	canvas.fillPath(
		Path.roundedRect(left, top, width, height, height / 2),
		withAlpha(PALETTE.accent, 0.5),
	);
	canvas.fillPath(
		Path.roundedRect(left + 2, top + 2, width - 4, height - 4, height / 2 - 2),
		sheen,
	);
	canvas.fillPath(
		Path.roundedRect(left, top, width, height, height / 2),
		withAlpha(PALETTE.accent, 0.12),
	);
	canvas.text(label, {
		...text,
		x: left + width / 2,
		y: top + 28,
		align: "center",
		paint: PALETTE.accent,
	});
}

/**
 * The listing card: the address across the top, the listing's heading and summary, and its
 * newest entries as the bordered rows the page lists them in, fading out toward the bottom.
 */
function drawListing(
	canvas: Canvas,
	content: SocialCard.Listing,
	fonts: SocialCardImage.Fonts,
): void {
	let right = canvas.width - MARGIN;
	canvas.text(content.url, {
		font: fonts.regular,
		size: 22,
		maxWidth: 560,
		maxLines: 1,
		x: right,
		y: HEADER_BASELINE,
		align: "end",
		paint: PALETTE.accent,
	});
	canvas.text(content.title, {
		font: fonts.semibold,
		size: 88,
		minSize: 56,
		tracking: -1,
		maxWidth: right - MARGIN,
		maxLines: 1,
		x: MARGIN,
		y: 228,
		paint: PALETTE.title,
	});
	if (content.description) {
		canvas.text(content.description, {
			font: fonts.regular,
			size: 30,
			maxWidth: right - MARGIN,
			maxLines: 1,
			x: MARGIN,
			y: 284,
			paint: PALETTE.description,
		});
	}

	let fade = linearGradient({
		from: [0, 330],
		to: [0, canvas.height],
		stops: [
			[0, PALETTE.title],
			[0.5, PALETTE.title],
			[1, TRANSPARENT],
		],
	});
	canvas.mask(fade, () => {
		content.entries.forEach((entry, index) => {
			drawRow(canvas, entry, 330 + index * 78, fonts);
		});
	});
}

/** One listing row: a bordered card with the entry's underlined title and its date. */
function drawRow(
	canvas: Canvas,
	entry: SocialCard.Entry,
	top: number,
	fonts: SocialCardImage.Fonts,
): void {
	let right = canvas.width - MARGIN;
	let height = 64;
	canvas.fillPath(Path.roundedRect(MARGIN, top, right - MARGIN, height, 10), PALETTE.border);
	canvas.fillPath(
		Path.roundedRect(MARGIN + 2, top + 2, right - MARGIN - 4, height - 4, 8),
		PALETTE.row,
	);
	let title = canvas.text(entry.title, {
		font: fonts.regular,
		size: 26,
		maxWidth: 780,
		maxLines: 1,
		x: MARGIN + 28,
		y: top + 41,
		paint: PALETTE.accent,
	});
	canvas.fillRect(MARGIN + 28, top + 46, title.width, 1.5, withAlpha(PALETTE.accent, 0.6));
	if (entry.date) {
		canvas.text(entry.date, {
			font: fonts.regular,
			size: 20,
			x: right - 28,
			y: top + 40,
			align: "end",
			paint: PALETTE.quiet,
		});
	}
}
