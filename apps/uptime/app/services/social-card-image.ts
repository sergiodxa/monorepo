/**
 * Draws Uptime's social cards on the product's dark field with its emerald accent and brand
 * mark. A marketing card leads with the page's headline; a status card reports the page's
 * overall status, when it began, and each service's last 90 days as a bar per day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";
import type { Raster } from "@sdxc/raster";

import { Canvas, color, Path, radialGradient, TRANSPARENT, withAlpha } from "@sdxc/raster";

import type { SocialCard } from "~/app/services/social-card";
import type { ServiceStatus } from "~/app/services/status-page";

import { SOCIAL_CARD_SIZE } from "~/app/services/social-card";
import { BRAND_MARK_PATHS, BRAND_MARK_TRANSFORM } from "~/config/brand";

export namespace SocialCardImage {
	/** The faces a card is set in: the product's sans for text, its mono for figures. */
	export interface Fonts {
		regular: Font;
		semibold: Font;
		mono: Font;
	}
}

/** The product's dark theme, from the same oklch scale its stylesheet declares. */
const PALETTE = {
	background: color("oklch(0.16 0.006 250)"),
	panel: color("oklch(0.2 0.007 250)"),
	border: color("oklch(0.32 0.01 250)"),
	title: color("oklch(0.96 0.005 250)"),
	description: color("oklch(0.73 0.013 250)"),
	quiet: color("oklch(0.62 0.014 250)"),
	accent: color("oklch(0.73 0.155 162)"),
	up: color("oklch(0.73 0.18 142)"),
	degraded: color("oklch(0.73 0.15 85)"),
	down: color("oklch(0.73 0.16 25)"),
	noData: color("oklch(0.32 0.01 250)"),
};

/** The colour each status reads in, the page's own status scale. */
const STATUS_COLOR: Record<ServiceStatus, Raster.Color> = {
	operational: PALETTE.up,
	degraded: PALETTE.degraded,
	down: PALETTE.down,
	unknown: PALETTE.up,
};

/** The banner's wording for each overall status, as the status page's banner states it. */
const STATUS_HEADLINE: Record<ServiceStatus, string> = {
	operational: "All systems operational",
	degraded: "Some systems degraded",
	down: "Major outage",
	unknown: "All systems operational",
};

/** The card's side margin, which every line of text starts or ends on. */
const MARGIN = 80;

/**
 * Renders the card as PNG bytes. Drawing is CPU work in the tens of milliseconds, so the
 * caller stores the result and serves it again rather than drawing per request.
 */
export async function renderSocialCard(
	content: SocialCard.Content,
	fonts: SocialCardImage.Fonts,
): Promise<Uint8Array> {
	let canvas = new Canvas(SOCIAL_CARD_SIZE.width, SOCIAL_CARD_SIZE.height);
	canvas.fillRect(0, 0, canvas.width, canvas.height, PALETTE.background);
	canvas.fillRect(
		0,
		0,
		canvas.width,
		canvas.height,
		radialGradient({
			center: [canvas.width * 0.1, 0],
			radius: [canvas.width * 0.8, canvas.height * 0.9],
			stops: [
				[0, withAlpha(PALETTE.accent, 0.12)],
				[1, TRANSPARENT],
			],
		}),
	);
	if (content.kind === "marketing") drawMarketing(canvas, content, fonts);
	else drawStatus(canvas, content, fonts);
	return canvas.toPNG();
}

/** The brand mark at `size` pixels with its top-left corner at `(x, y)`. */
function drawMark(canvas: Canvas, x: number, y: number, size: number, paint: Raster.Paint): void {
	let scale = size / 1024;
	let [a, b, c, d, e, f] = BRAND_MARK_TRANSFORM;
	let transform: Raster.Matrix = [
		a * scale,
		b * scale,
		c * scale,
		d * scale,
		e * scale + x,
		f * scale + y,
	];
	for (let data of BRAND_MARK_PATHS) canvas.fillPath(Path.fromSVG(data, { transform }), paint);
}

/**
 * The marketing card: the mark and name top left with the page's address, a pill naming the
 * kind of page, the headline with its highlighted phrase in emerald, and the summary.
 */
function drawMarketing(
	canvas: Canvas,
	content: SocialCard.MarketingContent,
	fonts: SocialCardImage.Fonts,
): void {
	let right = canvas.width - MARGIN;
	drawMark(canvas, MARGIN, 62, 44, PALETTE.title);
	canvas.text("Uptime", {
		font: fonts.semibold,
		size: 30,
		x: MARGIN + 58,
		y: 95,
		paint: PALETTE.title,
	});
	canvas.text(content.url, {
		font: fonts.mono,
		size: 20,
		maxWidth: 640,
		maxLines: 1,
		x: right,
		y: 92,
		align: "end",
		paint: PALETTE.quiet,
	});
	drawPill(canvas, content.eyebrow, MARGIN, 168, fonts);

	let width = right - MARGIN;
	let title = canvas.text(content.title, {
		font: fonts.semibold,
		size: 76,
		minSize: 52,
		tracking: -2,
		lineHeight: 1.1,
		maxWidth: width,
		maxLines: content.accent ? 2 : 3,
		x: MARGIN,
		y: 296,
		paint: PALETTE.title,
	});
	let baseline = 296 + (title.lines.length - 1) * title.size * 1.1;
	if (content.accent) {
		let accent = canvas.text(content.accent, {
			font: fonts.semibold,
			size: title.size,
			tracking: -2,
			lineHeight: 1.1,
			maxWidth: width,
			maxLines: 1,
			x: MARGIN,
			y: baseline + title.size * 1.1,
			paint: PALETTE.accent,
		});
		baseline += accent.size * 1.1;
	}
	let next = baseline + 72;
	if (content.description && next < 570) {
		canvas.text(content.description, {
			font: fonts.mono,
			size: 24,
			lineHeight: 1.5,
			maxWidth: width,
			maxLines: next + 36 < 570 ? 2 : 1,
			x: MARGIN,
			y: next,
			paint: PALETTE.description,
		});
	}
}

/** A rounded pill with the page kind, tinted like the landing page's hero badge. */
function drawPill(
	canvas: Canvas,
	label: string,
	x: number,
	y: number,
	fonts: SocialCardImage.Fonts,
): void {
	let text = { font: fonts.semibold, size: 18, x: 0, y: 0 };
	let width = canvas.measureText(label, text).width + 40;
	let height = 38;
	canvas.fillPath(
		Path.roundedRect(x, y, width, height, height / 2),
		withAlpha(PALETTE.accent, 0.45),
	);
	canvas.fillPath(
		Path.roundedRect(x + 2, y + 2, width - 4, height - 4, height / 2 - 2),
		PALETTE.background,
	);
	canvas.fillPath(
		Path.roundedRect(x, y, width, height, height / 2),
		withAlpha(PALETTE.accent, 0.12),
	);
	canvas.text(label, {
		...text,
		x: x + width / 2,
		y: y + 25,
		align: "center",
		paint: PALETTE.accent,
	});
}

/**
 * The status card: the page's title, a banner with the overall status and when it began,
 * and up to three services, each with its uptime and a bar per day of the last 90.
 */
function drawStatus(
	canvas: Canvas,
	content: SocialCard.StatusContent,
	fonts: SocialCardImage.Fonts,
): void {
	let right = canvas.width - MARGIN;
	let width = right - MARGIN;
	canvas.text(content.title, {
		font: fonts.semibold,
		size: 44,
		minSize: 32,
		tracking: -1,
		maxWidth: width - 260,
		maxLines: 1,
		x: MARGIN,
		y: 100,
		paint: PALETTE.title,
	});
	let powered = { font: fonts.mono, size: 18, x: right, y: 97 };
	let poweredWidth = canvas.measureText("Powered by Uptime", powered).width;
	drawMark(canvas, right - poweredWidth - 34, 76, 26, PALETTE.quiet);
	canvas.text("Powered by Uptime", {
		font: fonts.mono,
		size: 18,
		x: right,
		y: 97,
		align: "end",
		paint: PALETTE.quiet,
	});

	let tone = STATUS_COLOR[content.status];
	let bannerTop = 136;
	canvas.fillPath(Path.roundedRect(MARGIN, bannerTop, width, 96, 14), withAlpha(tone, 0.4));
	canvas.fillPath(
		Path.roundedRect(MARGIN + 2, bannerTop + 2, width - 4, 92, 12),
		PALETTE.background,
	);
	canvas.fillPath(Path.roundedRect(MARGIN, bannerTop, width, 96, 14), withAlpha(tone, 0.1));
	canvas.fillPath(Path.roundedRect(MARGIN + 30, bannerTop + 34, 28, 28, 14), tone);
	canvas.text(STATUS_HEADLINE[content.status], {
		font: fonts.semibold,
		size: 34,
		maxWidth: width - 400,
		maxLines: 1,
		x: MARGIN + 78,
		y: bannerTop + 60,
		paint: tone,
	});
	canvas.text(content.since, {
		font: fonts.mono,
		size: 20,
		maxWidth: 360,
		maxLines: 1,
		x: right - 30,
		y: bannerTop + 58,
		align: "end",
		paint: PALETTE.description,
	});

	let rowTop = 276;
	let rowHeight = content.services.length > 2 ? 96 : 120;
	content.services.forEach((service, index) => {
		drawService(canvas, service, rowTop + index * rowHeight, fonts);
	});
	if (content.services.length === 0) {
		canvas.text("No services listed yet", {
			font: fonts.mono,
			size: 22,
			x: MARGIN,
			y: rowTop + 40,
			paint: PALETTE.quiet,
		});
	}
	let footer = content.more > 0 ? `and ${content.more} more · last 90 days` : "Last 90 days";
	canvas.text(footer, { font: fonts.mono, size: 18, x: MARGIN, y: 600, paint: PALETTE.quiet });
	canvas.text(content.url, {
		font: fonts.mono,
		size: 18,
		maxWidth: 560,
		maxLines: 1,
		x: right,
		y: 600,
		align: "end",
		paint: PALETTE.quiet,
	});
}

/** One service: its name and uptime over a row of bars, one per day, coloured by its status. */
function drawService(
	canvas: Canvas,
	service: SocialCard.Service,
	top: number,
	fonts: SocialCardImage.Fonts,
): void {
	let right = canvas.width - MARGIN;
	canvas.text(service.name, {
		font: fonts.semibold,
		size: 24,
		maxWidth: 700,
		maxLines: 1,
		x: MARGIN,
		y: top + 24,
		paint: PALETTE.title,
	});
	canvas.text(service.uptime ?? "No data", {
		font: fonts.mono,
		size: 20,
		x: right,
		y: top + 24,
		align: "end",
		paint: PALETTE.description,
	});
	let count = Math.max(1, service.days.length);
	let gap = 3;
	let barWidth = (right - MARGIN - gap * (count - 1)) / count;
	service.days.forEach((day, index) => {
		let x = MARGIN + index * (barWidth + gap);
		let paint =
			day === "up"
				? PALETTE.up
				: day === "degraded"
					? PALETTE.degraded
					: day === "down"
						? PALETTE.down
						: PALETTE.noData;
		canvas.fillPath(Path.roundedRect(x, top + 40, barWidth, 36, Math.min(2, barWidth / 2)), paint);
	});
}
