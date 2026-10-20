/**
 * Draws the explorer face each `@sdxc/ui` tile shows. Live frames clip inside a card;
 * these Apple HIG–style silhouettes stay legible at tile size — elevated surfaces,
 * label and accent fills on a soft wash — rendered through `@sdxc/raster` as PNG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Canvas, color, linearGradient, Path, withAlpha } from "@sdxc/raster";

/** Design space every silhouette is authored in; the canvas is this times {@link SCALE}. */
const VIEW_WIDTH = 160;
const VIEW_HEIGHT = 100;

/** Retina factor so a ~10 rem tile stays sharp. */
const SCALE = 2;

/** Pixel size of a served face. */
export const COMPONENT_FACE_SIZE = {
	width: VIEW_WIDTH * SCALE,
	height: VIEW_HEIGHT * SCALE,
} as const;

/**
 * Bumped when a silhouette or the wash changes, so cards can cache-bust without waiting
 * for a year-long `max-age` to expire.
 */
export const COMPONENT_FACE_VERSION = "2";

/** Material role a silhouette piece paints with, matching HIG elevated / label / accent. */
type Tone = "surface" | "label" | "ink" | "accent";

interface RectShape {
	kind: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
	r?: number;
	tone: Tone;
}

interface CircleShape {
	kind: "circle";
	cx: number;
	cy: number;
	r: number;
	tone: Tone;
}

interface LineShape {
	kind: "line";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	tone: Tone;
}

interface PathShape {
	kind: "path";
	d: string;
	tone: Tone;
}

type Shape = RectShape | CircleShape | LineShape | PathShape;

/** Soft sky wash behind the materials, the cool field Apple's component cards use. */
const WASH = {
	from: color("oklch(0.94 0.03 230)"),
	mid: color("oklch(0.88 0.05 225)"),
	to: color("oklch(0.82 0.06 240)"),
};

/** Elevated white panel — primary chrome on the wash. */
const SURFACE = color("#ffffff");
/** Soft secondary fill for resting or inactive chrome. */
const LABEL = color("oklch(0.9 0.01 250)");
/** Dark rule and label stroke that reads as ink at tile size. */
const INK = withAlpha(color("oklch(0.28 0.02 260)"), 0.75);
/** System-blue accent for primary actions and selected state. */
const ACCENT = color("oklch(0.62 0.17 250)");
/** Soft contact shadow under elevated surface pieces. */
const SHADOW = withAlpha(color("oklch(0.35 0.04 250)"), 0.14);

/** A soft fallback when a slug has no hand-tuned silhouette yet. */
const FALLBACK: Shape[] = [{ kind: "rect", x: 40, y: 24, w: 80, h: 52, r: 14, tone: "surface" }];

/** Catalogue of silhouettes keyed by component slug. */
const FACES: Record<string, Shape[]> = {
	accordion: [
		{ kind: "rect", x: 26, y: 14, w: 108, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 118, y1: 21, x2: 124, y2: 25, tone: "ink" },
		{ kind: "line", x1: 124, y1: 25, x2: 118, y2: 29, tone: "ink" },
		{ kind: "rect", x: 26, y: 42, w: 108, h: 22, r: 8, tone: "label" },
		{ kind: "rect", x: 26, y: 70, w: 108, h: 22, r: 8, tone: "label" },
	],
	alert: [
		{ kind: "rect", x: 26, y: 30, w: 108, h: 44, r: 12, tone: "surface" },
		{ kind: "circle", cx: 48, cy: 52, r: 9, tone: "accent" },
		{ kind: "line", x1: 66, y1: 46, x2: 118, y2: 46, tone: "ink" },
		{ kind: "line", x1: 66, y1: 58, x2: 102, y2: 58, tone: "label" },
	],
	"alert-dialog": [
		{ kind: "rect", x: 38, y: 16, w: 84, h: 68, r: 14, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 36, r: 9, tone: "accent" },
		{ kind: "line", x1: 52, y1: 54, x2: 108, y2: 54, tone: "label" },
		{ kind: "rect", x: 50, y: 70, w: 28, h: 10, r: 5, tone: "surface" },
		{ kind: "rect", x: 86, y: 70, w: 28, h: 10, r: 5, tone: "accent" },
	],
	"aspect-ratio": [
		{ kind: "rect", x: 44, y: 14, w: 72, h: 72, r: 10, tone: "surface" },
		{ kind: "line", x1: 54, y1: 28, x2: 106, y2: 28, tone: "label" },
		{ kind: "line", x1: 54, y1: 72, x2: 106, y2: 72, tone: "label" },
	],
	attachment: [
		{ kind: "rect", x: 34, y: 26, w: 92, h: 48, r: 12, tone: "surface" },
		{ kind: "rect", x: 46, y: 38, w: 30, h: 24, r: 6, tone: "label" },
		{ kind: "line", x1: 86, y1: 46, x2: 114, y2: 46, tone: "ink" },
		{ kind: "line", x1: 86, y1: 58, x2: 104, y2: 58, tone: "label" },
	],
	avatar: [
		{ kind: "circle", cx: 80, cy: 40, r: 20, tone: "surface" },
		{ kind: "rect", x: 54, y: 64, w: 52, h: 18, r: 9, tone: "label" },
	],
	badge: [
		{ kind: "rect", x: 60, y: 42, w: 40, h: 16, r: 8, tone: "label" },
		{ kind: "line", x1: 70, y1: 50, x2: 90, y2: 50, tone: "ink" },
	],
	breadcrumbs: [
		{ kind: "rect", x: 14, y: 40, w: 32, h: 20, r: 10, tone: "surface" },
		{ kind: "line", x1: 52, y1: 46, x2: 58, y2: 50, tone: "label" },
		{ kind: "line", x1: 58, y1: 50, x2: 52, y2: 54, tone: "label" },
		{ kind: "rect", x: 64, y: 40, w: 32, h: 20, r: 10, tone: "surface" },
		{ kind: "line", x1: 102, y1: 46, x2: 108, y2: 50, tone: "label" },
		{ kind: "line", x1: 108, y1: 50, x2: 102, y2: 54, tone: "label" },
		{ kind: "rect", x: 114, y: 40, w: 34, h: 20, r: 10, tone: "accent" },
	],
	bubble: [
		{
			kind: "path",
			d: "M44 26 H112 Q128 26 128 42 V54 Q128 70 112 70 H68 L54 86 L60 70 H44 Q28 70 28 54 V42 Q28 26 44 26 Z",
			tone: "surface",
		},
		{ kind: "line", x1: 48, y1: 42, x2: 100, y2: 42, tone: "ink" },
		{ kind: "line", x1: 48, y1: 54, x2: 88, y2: 54, tone: "label" },
	],
	button: [
		{ kind: "rect", x: 40, y: 34, w: 80, h: 32, r: 16, tone: "accent" },
		{ kind: "line", x1: 58, y1: 50, x2: 102, y2: 50, tone: "surface" },
	],
	calendar: [
		{ kind: "rect", x: 36, y: 12, w: 88, h: 18, r: 8, tone: "surface" },
		{ kind: "line", x1: 48, y1: 21, x2: 100, y2: 21, tone: "ink" },
		{ kind: "circle", cx: 42, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 52, r: 3.8, tone: "accent" },
		{ kind: "circle", cx: 90, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 76, r: 3.8, tone: "label" },
	],
	card: [
		{ kind: "rect", x: 34, y: 14, w: 92, h: 72, r: 14, tone: "surface" },
		{ kind: "rect", x: 46, y: 26, w: 68, h: 30, r: 8, tone: "label" },
		{ kind: "line", x1: 46, y1: 68, x2: 110, y2: 68, tone: "ink" },
		{ kind: "line", x1: 46, y1: 80, x2: 92, y2: 80, tone: "label" },
	],
	carousel: [
		{ kind: "rect", x: 20, y: 28, w: 42, h: 48, r: 10, tone: "label" },
		{ kind: "rect", x: 50, y: 18, w: 60, h: 64, r: 12, tone: "surface" },
		{ kind: "rect", x: 98, y: 28, w: 42, h: 48, r: 10, tone: "label" },
	],
	chart: [
		{ kind: "rect", x: 34, y: 68, w: 14, h: 18, r: 4, tone: "accent" },
		{ kind: "rect", x: 56, y: 48, w: 14, h: 38, r: 4, tone: "accent" },
		{ kind: "rect", x: 78, y: 34, w: 14, h: 52, r: 4, tone: "accent" },
		{ kind: "rect", x: 100, y: 54, w: 14, h: 32, r: 4, tone: "accent" },
		{ kind: "rect", x: 122, y: 28, w: 14, h: 58, r: 4, tone: "accent" },
	],
	checkbox: [
		{ kind: "rect", x: 36, y: 38, w: 24, h: 24, r: 6, tone: "surface" },
		{ kind: "path", d: "M43 50 L48 55 L57 43", tone: "accent" },
		{ kind: "line", x1: 70, y1: 50, x2: 128, y2: 50, tone: "ink" },
	],
	"checkbox-group": [
		{ kind: "rect", x: 36, y: 22, w: 18, h: 18, r: 5, tone: "surface" },
		{ kind: "path", d: "M41 31 L44 34 L50 27", tone: "accent" },
		{ kind: "line", x1: 64, y1: 31, x2: 128, y2: 31, tone: "ink" },
		{ kind: "rect", x: 36, y: 46, w: 18, h: 18, r: 5, tone: "surface" },
		{ kind: "line", x1: 64, y1: 55, x2: 120, y2: 55, tone: "label" },
		{ kind: "rect", x: 36, y: 70, w: 18, h: 18, r: 5, tone: "surface" },
		{ kind: "line", x1: 64, y1: 79, x2: 112, y2: 79, tone: "label" },
	],
	"color-area": [
		{ kind: "rect", x: 44, y: 14, w: 72, h: 72, r: 14, tone: "accent" },
		{ kind: "circle", cx: 64, cy: 70, r: 8, tone: "surface" },
	],
	"color-field": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 28, r: 10, tone: "surface" },
		{ kind: "circle", cx: 46, cy: 52, r: 8, tone: "accent" },
		{ kind: "line", x1: 62, y1: 52, x2: 116, y2: 52, tone: "label" },
	],
	"color-picker": [
		{ kind: "rect", x: 26, y: 16, w: 68, h: 68, r: 12, tone: "accent" },
		{ kind: "rect", x: 102, y: 22, w: 34, h: 16, r: 6, tone: "surface" },
		{ kind: "rect", x: 102, y: 48, w: 34, h: 16, r: 6, tone: "label" },
		{ kind: "rect", x: 102, y: 74, w: 34, h: 16, r: 6, tone: "accent" },
	],
	"color-slider": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, tone: "accent" },
		{ kind: "circle", cx: 100, cy: 51, r: 10, tone: "surface" },
	],
	"color-swatch": [{ kind: "rect", x: 56, y: 26, w: 48, h: 48, r: 12, tone: "accent" }],
	"color-swatch-picker": [
		{ kind: "rect", x: 26, y: 26, w: 30, h: 30, r: 8, tone: "accent" },
		{ kind: "rect", x: 66, y: 26, w: 30, h: 30, r: 8, tone: "surface" },
		{ kind: "rect", x: 106, y: 26, w: 30, h: 30, r: 8, tone: "label" },
		{ kind: "rect", x: 26, y: 64, w: 30, h: 22, r: 8, tone: "label" },
		{ kind: "rect", x: 66, y: 64, w: 30, h: 22, r: 8, tone: "surface" },
		{ kind: "rect", x: 106, y: 64, w: 30, h: 22, r: 8, tone: "accent" },
	],
	"color-wheel": [
		{ kind: "circle", cx: 80, cy: 50, r: 30, tone: "accent" },
		{ kind: "circle", cx: 80, cy: 50, r: 14, tone: "surface" },
		{ kind: "circle", cx: 100, cy: 36, r: 6, tone: "surface" },
	],
	combobox: [
		{ kind: "rect", x: 28, y: 20, w: 104, h: 24, r: 8, tone: "surface" },
		{ kind: "line", x1: 118, y1: 28, x2: 124, y2: 34, tone: "ink" },
		{ kind: "line", x1: 124, y1: 34, x2: 118, y2: 40, tone: "ink" },
		{ kind: "rect", x: 40, y: 50, w: 80, h: 40, r: 10, tone: "surface" },
		{ kind: "line", x1: 52, y1: 64, x2: 104, y2: 64, tone: "label" },
		{ kind: "line", x1: 52, y1: 76, x2: 92, y2: 76, tone: "label" },
	],
	command: [
		{ kind: "rect", x: 30, y: 14, w: 100, h: 74, r: 14, tone: "surface" },
		{ kind: "rect", x: 42, y: 26, w: 76, h: 18, r: 8, tone: "label" },
		{ kind: "line", x1: 50, y1: 56, x2: 114, y2: 56, tone: "ink" },
		{ kind: "line", x1: 50, y1: 70, x2: 100, y2: 70, tone: "label" },
	],
	confirm: [
		{ kind: "rect", x: 40, y: 20, w: 80, h: 60, r: 14, tone: "surface" },
		{ kind: "line", x1: 52, y1: 40, x2: 108, y2: 40, tone: "ink" },
		{ kind: "rect", x: 50, y: 64, w: 30, h: 12, r: 6, tone: "surface" },
		{ kind: "rect", x: 88, y: 64, w: 30, h: 12, r: 6, tone: "accent" },
	],
	"context-menu": [
		{ kind: "rect", x: 48, y: 16, w: 72, h: 70, r: 12, tone: "surface" },
		{ kind: "line", x1: 60, y1: 32, x2: 108, y2: 32, tone: "ink" },
		{ kind: "line", x1: 60, y1: 46, x2: 100, y2: 46, tone: "label" },
		{ kind: "line", x1: 60, y1: 60, x2: 108, y2: 60, tone: "label" },
		{ kind: "line", x1: 60, y1: 74, x2: 92, y2: 74, tone: "label" },
	],
	"date-field": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 42, y1: 52, x2: 74, y2: 52, tone: "label" },
		{ kind: "line", x1: 84, y1: 52, x2: 108, y2: 52, tone: "label" },
	],
	"date-picker": [
		{ kind: "rect", x: 36, y: 16, w: 88, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 112, y1: 24, x2: 118, y2: 29, tone: "ink" },
		{ kind: "line", x1: 118, y1: 29, x2: 112, y2: 34, tone: "ink" },
		{ kind: "rect", x: 44, y: 46, w: 72, h: 42, r: 10, tone: "label" },
		{ kind: "circle", cx: 56, cy: 64, r: 3.5, tone: "accent" },
		{ kind: "circle", cx: 68, cy: 64, r: 3.5, tone: "label" },
		{ kind: "circle", cx: 80, cy: 64, r: 3.5, tone: "label" },
		{ kind: "circle", cx: 92, cy: 64, r: 3.5, tone: "label" },
	],
	"date-range-picker": [
		{ kind: "rect", x: 22, y: 26, w: 52, h: 22, r: 8, tone: "surface" },
		{ kind: "rect", x: 86, y: 26, w: 52, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 76, y1: 37, x2: 84, y2: 37, tone: "label" },
		{ kind: "rect", x: 40, y: 58, w: 80, h: 30, r: 10, tone: "label" },
	],
	description: [
		{ kind: "line", x1: 36, y1: 38, x2: 124, y2: 38, tone: "label" },
		{ kind: "line", x1: 36, y1: 50, x2: 112, y2: 50, tone: "label" },
		{ kind: "line", x1: 36, y1: 62, x2: 96, y2: 62, tone: "label" },
	],
	dialog: [
		{ kind: "rect", x: 38, y: 18, w: 84, h: 64, r: 14, tone: "surface" },
		{ kind: "line", x1: 52, y1: 36, x2: 108, y2: 36, tone: "ink" },
		{ kind: "line", x1: 52, y1: 48, x2: 96, y2: 48, tone: "label" },
		{ kind: "rect", x: 52, y: 66, w: 34, h: 10, r: 5, tone: "accent" },
	],
	disclosure: [
		{ kind: "rect", x: 26, y: 26, w: 108, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 118, y1: 33, x2: 124, y2: 37, tone: "ink" },
		{ kind: "line", x1: 124, y1: 37, x2: 118, y2: 41, tone: "ink" },
		{ kind: "rect", x: 36, y: 54, w: 88, h: 32, r: 10, tone: "label" },
	],
	drawer: [
		{ kind: "rect", x: 68, y: 12, w: 76, h: 76, r: 14, tone: "surface" },
		{ kind: "line", x1: 82, y1: 28, x2: 128, y2: 28, tone: "ink" },
		{ kind: "line", x1: 82, y1: 44, x2: 120, y2: 44, tone: "label" },
		{ kind: "line", x1: 82, y1: 60, x2: 112, y2: 60, tone: "label" },
	],
	"drop-indicator": [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, tone: "accent" },
		{ kind: "circle", cx: 80, cy: 50, r: 6, tone: "surface" },
	],
	"drop-zone": [
		{ kind: "rect", x: 34, y: 16, w: 92, h: 68, r: 14, tone: "label" },
		{ kind: "line", x1: 80, y1: 36, x2: 80, y2: 60, tone: "ink" },
		{ kind: "line", x1: 68, y1: 48, x2: 92, y2: 48, tone: "ink" },
	],
	empty: [
		{ kind: "circle", cx: 80, cy: 40, r: 18, tone: "label" },
		{ kind: "line", x1: 48, y1: 72, x2: 112, y2: 72, tone: "label" },
	],
	"field-error": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 40, y1: 52, x2: 100, y2: 52, tone: "label" },
		{ kind: "circle", cx: 122, cy: 34, r: 7, tone: "accent" },
	],
	"file-trigger": [
		{ kind: "rect", x: 48, y: 16, w: 64, h: 60, r: 10, tone: "surface" },
		{ kind: "rect", x: 64, y: 36, w: 32, h: 12, r: 5, tone: "accent" },
		{ kind: "line", x1: 60, y1: 60, x2: 100, y2: 60, tone: "label" },
	],
	form: [
		{ kind: "rect", x: 36, y: 18, w: 88, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 48, y1: 28, x2: 100, y2: 28, tone: "label" },
		{ kind: "rect", x: 36, y: 46, w: 88, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 48, y1: 56, x2: 100, y2: 56, tone: "label" },
		{ kind: "rect", x: 36, y: 74, w: 52, h: 16, r: 8, tone: "accent" },
	],
	"grid-list": [
		{ kind: "rect", x: 26, y: 16, w: 50, h: 32, r: 10, tone: "surface" },
		{ kind: "rect", x: 84, y: 16, w: 50, h: 32, r: 10, tone: "surface" },
		{ kind: "rect", x: 26, y: 56, w: 50, h: 32, r: 10, tone: "surface" },
		{ kind: "rect", x: 84, y: 56, w: 50, h: 32, r: 10, tone: "accent" },
	],
	group: [
		{ kind: "rect", x: 26, y: 20, w: 108, h: 60, r: 12, tone: "label" },
		{ kind: "rect", x: 40, y: 34, w: 80, h: 32, r: 10, tone: "surface" },
	],
	header: [
		{ kind: "rect", x: 22, y: 24, w: 116, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 36, y1: 56, x2: 124, y2: 56, tone: "ink" },
		{ kind: "line", x1: 36, y1: 70, x2: 100, y2: 70, tone: "label" },
	],
	heading: [
		{ kind: "line", x1: 36, y1: 38, x2: 124, y2: 38, tone: "ink" },
		{ kind: "line", x1: 36, y1: 56, x2: 92, y2: 56, tone: "label" },
	],
	"heading-scope": [
		{ kind: "line", x1: 36, y1: 30, x2: 124, y2: 30, tone: "ink" },
		{ kind: "line", x1: 36, y1: 46, x2: 104, y2: 46, tone: "label" },
		{ kind: "line", x1: 36, y1: 62, x2: 112, y2: 62, tone: "label" },
	],
	highlight: [
		{ kind: "rect", x: 40, y: 36, w: 80, h: 28, r: 4, tone: "accent" },
		{ kind: "line", x1: 50, y1: 50, x2: 110, y2: 50, tone: "ink" },
	],
	"hover-card": [
		{ kind: "rect", x: 34, y: 16, w: 92, h: 68, r: 14, tone: "surface" },
		{ kind: "line", x1: 48, y1: 34, x2: 110, y2: 34, tone: "ink" },
		{ kind: "line", x1: 48, y1: 48, x2: 100, y2: 48, tone: "label" },
		{ kind: "line", x1: 48, y1: 62, x2: 88, y2: 62, tone: "label" },
	],
	"image-placeholder": [
		{ kind: "rect", x: 40, y: 16, w: 80, h: 68, r: 12, tone: "label" },
		{ kind: "path", d: "M52 70 L72 44 L88 58 L100 46 L116 70 Z", tone: "surface" },
		{ kind: "circle", cx: 64, cy: 36, r: 6, tone: "surface" },
	],
	input: [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 40, y1: 52, x2: 96, y2: 52, tone: "label" },
	],
	item: [
		{ kind: "rect", x: 28, y: 34, w: 104, h: 32, r: 10, tone: "surface" },
		{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50, tone: "ink" },
	],
	keyboard: [
		{ kind: "rect", x: 28, y: 30, w: 22, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 54, y: 30, w: 22, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 80, y: 30, w: 22, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 106, y: 30, w: 28, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 40, y: 56, w: 80, h: 18, r: 5, tone: "accent" },
	],
	label: [
		{ kind: "line", x1: 36, y1: 40, x2: 108, y2: 40, tone: "ink" },
		{ kind: "line", x1: 36, y1: 56, x2: 80, y2: 56, tone: "label" },
	],
	link: [
		{ kind: "line", x1: 48, y1: 50, x2: 112, y2: 50, tone: "accent" },
		{ kind: "line", x1: 48, y1: 54, x2: 100, y2: 54, tone: "label" },
	],
	"link-button": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12, tone: "surface" },
		{ kind: "line", x1: 60, y1: 50, x2: 100, y2: 50, tone: "accent" },
	],
	listbox: [
		{ kind: "rect", x: 40, y: 14, w: 80, h: 72, r: 12, tone: "surface" },
		{ kind: "line", x1: 52, y1: 30, x2: 108, y2: 30, tone: "label" },
		{ kind: "line", x1: 52, y1: 46, x2: 100, y2: 46, tone: "label" },
		{ kind: "rect", x: 48, y: 58, w: 64, h: 18, r: 6, tone: "accent" },
	],
	logo: [
		{ kind: "circle", cx: 80, cy: 50, r: 24, tone: "accent" },
		{ kind: "circle", cx: 80, cy: 50, r: 12, tone: "surface" },
	],
	marker: [
		{ kind: "circle", cx: 48, cy: 50, r: 11, tone: "accent" },
		{ kind: "line", x1: 66, y1: 50, x2: 128, y2: 50, tone: "ink" },
	],
	menu: [
		{ kind: "rect", x: 48, y: 14, w: 72, h: 74, r: 12, tone: "surface" },
		{ kind: "line", x1: 60, y1: 30, x2: 108, y2: 30, tone: "ink" },
		{ kind: "line", x1: 60, y1: 44, x2: 100, y2: 44, tone: "label" },
		{ kind: "line", x1: 60, y1: 58, x2: 108, y2: 58, tone: "label" },
		{ kind: "line", x1: 60, y1: 72, x2: 92, y2: 72, tone: "label" },
	],
	menubar: [
		{ kind: "rect", x: 22, y: 36, w: 116, h: 28, r: 8, tone: "surface" },
		{ kind: "line", x1: 38, y1: 50, x2: 54, y2: 50, tone: "ink" },
		{ kind: "line", x1: 68, y1: 50, x2: 88, y2: 50, tone: "label" },
		{ kind: "line", x1: 102, y1: 50, x2: 122, y2: 50, tone: "label" },
	],
	message: [
		{ kind: "rect", x: 24, y: 20, w: 92, h: 30, r: 14, tone: "surface" },
		{ kind: "rect", x: 44, y: 58, w: 92, h: 26, r: 14, tone: "label" },
	],
	"message-scroller": [
		{ kind: "rect", x: 34, y: 10, w: 92, h: 24, r: 12, tone: "surface" },
		{ kind: "rect", x: 34, y: 40, w: 92, h: 24, r: 12, tone: "label" },
		{ kind: "rect", x: 34, y: 70, w: 92, h: 24, r: 12, tone: "label" },
	],
	meter: [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, tone: "label" },
		{ kind: "rect", x: 28, y: 44, w: 82, h: 14, r: 7, tone: "accent" },
	],
	modal: [
		{ kind: "rect", x: 30, y: 14, w: 100, h: 72, r: 14, tone: "label" },
		{ kind: "rect", x: 46, y: 26, w: 68, h: 48, r: 12, tone: "surface" },
	],
	"navigation-menu": [
		{ kind: "rect", x: 22, y: 24, w: 38, h: 18, r: 8, tone: "label" },
		{ kind: "rect", x: 66, y: 24, w: 38, h: 18, r: 8, tone: "accent" },
		{ kind: "rect", x: 110, y: 24, w: 30, h: 18, r: 8, tone: "label" },
		{ kind: "rect", x: 48, y: 50, w: 84, h: 36, r: 10, tone: "surface" },
	],
	"nav-link": [
		{ kind: "line", x1: 40, y1: 50, x2: 124, y2: 50, tone: "accent" },
		{ kind: "rect", x: 40, y: 44, w: 6, h: 12, r: 2, tone: "accent" },
	],
	"number-field": [
		{ kind: "rect", x: 32, y: 36, w: 78, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 44, y1: 50, x2: 90, y2: 50, tone: "label" },
		{ kind: "rect", x: 116, y: 38, w: 14, h: 10, r: 3, tone: "label" },
		{ kind: "rect", x: 116, y: 52, w: 14, h: 10, r: 3, tone: "label" },
	],
	"otp-field": [
		{ kind: "rect", x: 26, y: 36, w: 24, h: 30, r: 8, tone: "surface" },
		{ kind: "rect", x: 54, y: 36, w: 24, h: 30, r: 8, tone: "surface" },
		{ kind: "rect", x: 82, y: 36, w: 24, h: 30, r: 8, tone: "accent" },
		{ kind: "rect", x: 110, y: 36, w: 24, h: 30, r: 8, tone: "surface" },
	],
	"overlay-arrow": [
		{ kind: "rect", x: 50, y: 24, w: 60, h: 36, r: 10, tone: "surface" },
		{ kind: "path", d: "M70 60 L80 76 L90 60", tone: "surface" },
	],
	pagination: [
		{ kind: "rect", x: 28, y: 38, w: 24, h: 24, r: 8, tone: "label" },
		{ kind: "rect", x: 58, y: 38, w: 24, h: 24, r: 8, tone: "accent" },
		{ kind: "rect", x: 88, y: 38, w: 24, h: 24, r: 8, tone: "label" },
		{ kind: "rect", x: 118, y: 38, w: 24, h: 24, r: 8, tone: "label" },
	],
	popover: [
		{
			kind: "path",
			d: "M48 20 H112 Q128 20 128 36 V56 Q128 72 112 72 H92 L80 86 L68 72 H48 Q32 72 32 56 V36 Q32 20 48 20 Z",
			tone: "surface",
		},
	],
	"progress-bar": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, tone: "label" },
		{ kind: "rect", x: 28, y: 44, w: 68, h: 14, r: 7, tone: "accent" },
	],
	"radio-group": [
		{ kind: "circle", cx: 44, cy: 28, r: 9, tone: "surface" },
		{ kind: "circle", cx: 44, cy: 28, r: 4, tone: "accent" },
		{ kind: "line", x1: 62, y1: 28, x2: 128, y2: 28, tone: "ink" },
		{ kind: "circle", cx: 44, cy: 52, r: 9, tone: "surface" },
		{ kind: "line", x1: 62, y1: 52, x2: 120, y2: 52, tone: "label" },
		{ kind: "circle", cx: 44, cy: 76, r: 9, tone: "surface" },
		{ kind: "line", x1: 62, y1: 76, x2: 112, y2: 76, tone: "label" },
	],
	"range-calendar": [
		{ kind: "rect", x: 36, y: 12, w: 88, h: 18, r: 8, tone: "surface" },
		{ kind: "line", x1: 48, y1: 21, x2: 100, y2: 21, tone: "ink" },
		{ kind: "circle", cx: 42, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 40, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 52, r: 3.8, tone: "accent" },
		{ kind: "circle", cx: 78, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 52, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 64, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 42, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 54, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 66, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 78, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 90, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 102, cy: 76, r: 3.8, tone: "label" },
		{ kind: "circle", cx: 114, cy: 76, r: 3.8, tone: "label" },
		{ kind: "rect", x: 54, y: 46, w: 36, h: 10, r: 5, tone: "accent" },
	],
	resizable: [
		{ kind: "rect", x: 22, y: 20, w: 54, h: 60, r: 10, tone: "surface" },
		{ kind: "rect", x: 86, y: 20, w: 54, h: 60, r: 10, tone: "label" },
		{ kind: "line", x1: 80, y1: 28, x2: 80, y2: 72, tone: "accent" },
	],
	"scroll-area": [
		{ kind: "rect", x: 38, y: 12, w: 84, h: 76, r: 12, tone: "surface" },
		{ kind: "rect", x: 114, y: 28, w: 8, h: 44, r: 4, tone: "accent" },
	],
	"search-field": [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 28, r: 14, tone: "surface" },
		{ kind: "circle", cx: 46, cy: 50, r: 6, tone: "label" },
		{ kind: "line", x1: 51, y1: 55, x2: 58, y2: 62, tone: "label" },
		{ kind: "line", x1: 70, y1: 50, x2: 114, y2: 50, tone: "label" },
	],
	section: [
		{ kind: "rect", x: 26, y: 16, w: 108, h: 68, r: 12, tone: "label" },
		{ kind: "line", x1: 44, y1: 38, x2: 116, y2: 38, tone: "ink" },
		{ kind: "line", x1: 44, y1: 54, x2: 100, y2: 54, tone: "label" },
	],
	select: [
		{ kind: "rect", x: 36, y: 36, w: 88, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 48, y1: 50, x2: 96, y2: 50, tone: "ink" },
		{ kind: "line", x1: 112, y1: 44, x2: 118, y2: 50, tone: "ink" },
		{ kind: "line", x1: 118, y1: 50, x2: 112, y2: 56, tone: "ink" },
	],
	"selection-indicator": [
		{ kind: "rect", x: 44, y: 34, w: 72, h: 32, r: 10, tone: "surface" },
		{ kind: "rect", x: 52, y: 42, w: 24, h: 16, r: 6, tone: "accent" },
	],
	"sentinel-row": [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 28, r: 10, tone: "label" },
		{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50, tone: "label" },
	],
	separator: [{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, tone: "label" }],
	"shared-element": [
		{ kind: "rect", x: 26, y: 26, w: 50, h: 50, r: 12, tone: "label" },
		{ kind: "rect", x: 84, y: 26, w: 50, h: 50, r: 12, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 51, r: 9, tone: "accent" },
	],
	sheet: [
		{ kind: "rect", x: 26, y: 34, w: 108, h: 58, r: 16, tone: "surface" },
		{ kind: "rect", x: 68, y: 42, w: 24, h: 5, r: 2, tone: "label" },
		{ kind: "line", x1: 44, y1: 62, x2: 116, y2: 62, tone: "ink" },
	],
	"shortcut-list": [
		{ kind: "rect", x: 26, y: 18, w: 108, h: 18, r: 6, tone: "surface" },
		{ kind: "line", x1: 38, y1: 27, x2: 90, y2: 27, tone: "ink" },
		{ kind: "rect", x: 110, y: 24, w: 16, h: 8, r: 3, tone: "label" },
		{ kind: "rect", x: 26, y: 44, w: 108, h: 18, r: 6, tone: "surface" },
		{ kind: "line", x1: 38, y1: 53, x2: 84, y2: 53, tone: "ink" },
		{ kind: "rect", x: 110, y: 50, w: 16, h: 8, r: 3, tone: "label" },
		{ kind: "rect", x: 26, y: 70, w: 108, h: 18, r: 6, tone: "surface" },
		{ kind: "line", x1: 38, y1: 79, x2: 96, y2: 79, tone: "ink" },
		{ kind: "rect", x: 110, y: 76, w: 16, h: 8, r: 3, tone: "label" },
	],
	sidebar: [
		{ kind: "rect", x: 20, y: 12, w: 44, h: 76, r: 12, tone: "surface" },
		{ kind: "line", x1: 30, y1: 30, x2: 54, y2: 30, tone: "ink" },
		{ kind: "line", x1: 30, y1: 46, x2: 54, y2: 46, tone: "label" },
		{ kind: "line", x1: 30, y1: 62, x2: 50, y2: 62, tone: "label" },
		{ kind: "rect", x: 72, y: 12, w: 68, h: 76, r: 12, tone: "label" },
	],
	skeleton: [
		{ kind: "rect", x: 28, y: 26, w: 104, h: 14, r: 7, tone: "label" },
		{ kind: "rect", x: 28, y: 48, w: 80, h: 14, r: 7, tone: "label" },
		{ kind: "rect", x: 28, y: 70, w: 64, h: 14, r: 7, tone: "label" },
	],
	slider: [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, tone: "label" },
		{ kind: "rect", x: 28, y: 47, w: 70, h: 6, r: 3, tone: "accent" },
		{ kind: "circle", cx: 98, cy: 50, r: 10, tone: "surface" },
	],
	spinner: [
		{ kind: "circle", cx: 80, cy: 50, r: 20, tone: "label" },
		{ kind: "circle", cx: 80, cy: 50, r: 14, tone: "surface" },
		{ kind: "circle", cx: 96, cy: 38, r: 4, tone: "accent" },
	],
	switch: [
		{ kind: "rect", x: 50, y: 38, w: 60, h: 24, r: 12, tone: "accent" },
		{ kind: "circle", cx: 94, cy: 50, r: 9, tone: "surface" },
	],
	table: [
		{ kind: "rect", x: 26, y: 16, w: 108, h: 68, r: 10, tone: "surface" },
		{ kind: "line", x1: 26, y1: 34, x2: 134, y2: 34, tone: "label" },
		{ kind: "line", x1: 26, y1: 52, x2: 134, y2: 52, tone: "label" },
		{ kind: "line", x1: 26, y1: 70, x2: 134, y2: 70, tone: "label" },
		{ kind: "line", x1: 62, y1: 16, x2: 62, y2: 84, tone: "label" },
		{ kind: "line", x1: 98, y1: 16, x2: 98, y2: 84, tone: "label" },
	],
	tabs: [
		{ kind: "rect", x: 26, y: 24, w: 34, h: 18, r: 8, tone: "accent" },
		{ kind: "rect", x: 64, y: 24, w: 34, h: 18, r: 8, tone: "label" },
		{ kind: "rect", x: 102, y: 24, w: 34, h: 18, r: 8, tone: "label" },
		{ kind: "rect", x: 26, y: 46, w: 110, h: 40, r: 10, tone: "surface" },
	],
	"tag-group": [
		{ kind: "rect", x: 20, y: 38, w: 40, h: 24, r: 12, tone: "surface" },
		{ kind: "rect", x: 66, y: 38, w: 36, h: 24, r: 12, tone: "accent" },
		{ kind: "rect", x: 108, y: 38, w: 36, h: 24, r: 12, tone: "surface" },
	],
	text: [
		{ kind: "line", x1: 36, y1: 34, x2: 124, y2: 34, tone: "ink" },
		{ kind: "line", x1: 36, y1: 48, x2: 112, y2: 48, tone: "label" },
		{ kind: "line", x1: 36, y1: 62, x2: 96, y2: 62, tone: "label" },
	],
	textarea: [
		{ kind: "rect", x: 36, y: 20, w: 88, h: 60, r: 12, tone: "surface" },
		{ kind: "line", x1: 48, y1: 36, x2: 108, y2: 36, tone: "label" },
		{ kind: "line", x1: 48, y1: 48, x2: 100, y2: 48, tone: "label" },
		{ kind: "line", x1: 48, y1: 60, x2: 88, y2: 60, tone: "label" },
	],
	"text-field": [
		{ kind: "rect", x: 28, y: 28, w: 104, h: 22, r: 8, tone: "surface" },
		{ kind: "line", x1: 40, y1: 39, x2: 96, y2: 39, tone: "label" },
		{ kind: "line", x1: 36, y1: 64, x2: 90, y2: 64, tone: "label" },
	],
	"time-field": [
		{ kind: "rect", x: 42, y: 38, w: 76, h: 28, r: 10, tone: "surface" },
		{ kind: "line", x1: 56, y1: 52, x2: 74, y2: 52, tone: "label" },
		{ kind: "circle", cx: 86, cy: 52, r: 2, tone: "ink" },
		{ kind: "circle", cx: 94, cy: 52, r: 2, tone: "ink" },
		{ kind: "line", x1: 102, y1: 52, x2: 112, y2: 52, tone: "label" },
	],
	toast: [
		{ kind: "rect", x: 34, y: 34, w: 92, h: 34, r: 12, tone: "surface" },
		{ kind: "line", x1: 50, y1: 48, x2: 104, y2: 48, tone: "ink" },
		{ kind: "line", x1: 50, y1: 60, x2: 86, y2: 60, tone: "label" },
	],
	"toggle-button": [
		{ kind: "rect", x: 40, y: 36, w: 80, h: 28, r: 14, tone: "accent" },
		{ kind: "line", x1: 56, y1: 50, x2: 104, y2: 50, tone: "ink" },
	],
	toolbar: [
		{ kind: "rect", x: 22, y: 36, w: 116, h: 28, r: 10, tone: "surface" },
		{ kind: "rect", x: 34, y: 42, w: 16, h: 16, r: 5, tone: "label" },
		{ kind: "rect", x: 56, y: 42, w: 16, h: 16, r: 5, tone: "label" },
		{ kind: "rect", x: 78, y: 42, w: 16, h: 16, r: 5, tone: "label" },
		{ kind: "rect", x: 108, y: 42, w: 22, h: 16, r: 5, tone: "accent" },
	],
	tooltip: [
		{
			kind: "path",
			d: "M52 28 H108 Q120 28 120 40 V48 Q120 60 108 60 H88 L80 72 L72 60 H52 Q40 60 40 48 V40 Q40 28 52 28 Z",
			tone: "surface",
		},
		{ kind: "line", x1: 56, y1: 40, x2: 104, y2: 40, tone: "ink" },
	],
	tree: [
		{ kind: "line", x1: 38, y1: 24, x2: 38, y2: 80, tone: "label" },
		{ kind: "line", x1: 38, y1: 38, x2: 68, y2: 38, tone: "label" },
		{ kind: "line", x1: 38, y1: 56, x2: 68, y2: 56, tone: "label" },
		{ kind: "line", x1: 38, y1: 74, x2: 68, y2: 74, tone: "label" },
		{ kind: "rect", x: 68, y: 30, w: 52, h: 16, r: 5, tone: "surface" },
		{ kind: "rect", x: 68, y: 48, w: 52, h: 16, r: 5, tone: "accent" },
		{ kind: "rect", x: 68, y: 66, w: 52, h: 16, r: 5, tone: "surface" },
	],
	typeset: [
		{ kind: "line", x1: 36, y1: 28, x2: 84, y2: 28, tone: "ink" },
		{ kind: "line", x1: 36, y1: 44, x2: 124, y2: 44, tone: "label" },
		{ kind: "line", x1: 36, y1: 56, x2: 118, y2: 56, tone: "label" },
		{ kind: "line", x1: 36, y1: 68, x2: 100, y2: 68, tone: "label" },
	],
	"youtube-embed": [
		{ kind: "rect", x: 34, y: 18, w: 92, h: 64, r: 14, tone: "surface" },
		{ kind: "path", d: "M70 40 L96 50 L70 60 Z", tone: "accent" },
	],
};

/**
 * Whether a slug has a hand-tuned face. Unknown components still render {@link FALLBACK},
 * so a new export shows an elevated card rather than a blank plane.
 */
export function hasComponentFace(slug: string): boolean {
	return slug in FACES;
}

/**
 * The URL a tile's `<img>` points at. The version query busts caches when a silhouette
 * or the wash changes.
 */
export function componentFaceHref(slug: string): string {
	return `/frames/faces/${slug}?v=${COMPONENT_FACE_VERSION}`;
}

/**
 * Renders one component's explorer face as PNG bytes.
 *
 * @param slug - The component's URL segment
 */
export async function renderComponentFace(slug: string): Promise<Uint8Array> {
	let { height, width } = COMPONENT_FACE_SIZE;
	let canvas = new Canvas(width, height);

	canvas.fillRect(
		0,
		0,
		width,
		height,
		linearGradient({
			from: [0, 0],
			to: [width, height],
			stops: [
				[0, WASH.from],
				[0.5, WASH.mid],
				[1, WASH.to],
			],
		}),
	);

	let shapes = FACES[slug] ?? FALLBACK;
	for (let shape of shapes) drawShape(canvas, shape);

	return canvas.toPNG();
}

/**
 * Resolves the fill for a material tone so every silhouette piece shares one palette.
 *
 * @param tone - The material role on the piece
 */
function paintFor(tone: Tone) {
	if (tone === "surface") return SURFACE;
	if (tone === "label") return LABEL;
	if (tone === "ink") return INK;
	return ACCENT;
}

/**
 * Paints one HIG material piece into the canvas, scaled from design space. Surface
 * pieces cast a soft contact shadow so elevated chrome lifts off the wash.
 */
function drawShape(canvas: Canvas, shape: Shape): void {
	let paint = paintFor(shape.tone);

	if (shape.kind === "rect") {
		let x = shape.x * SCALE;
		let y = shape.y * SCALE;
		let w = shape.w * SCALE;
		let h = shape.h * SCALE;
		let r = (shape.r ?? 8) * SCALE;
		if (shape.tone === "surface") {
			canvas.fillPath(Path.roundedRect(x, y + 2 * SCALE, w, h, r), SHADOW);
		}
		canvas.fillPath(Path.roundedRect(x, y, w, h, r), paint);
		return;
	}

	if (shape.kind === "circle") {
		let x = (shape.cx - shape.r) * SCALE;
		let y = (shape.cy - shape.r) * SCALE;
		let size = shape.r * 2 * SCALE;
		if (shape.tone === "surface") {
			canvas.fillPath(Path.roundedRect(x, y + 2 * SCALE, size, size, size), SHADOW);
		}
		canvas.fillPath(Path.roundedRect(x, y, size, size, size), paint);
		return;
	}

	if (shape.kind === "line") {
		drawLine(canvas, shape);
		return;
	}

	let path = Path.fromSVG(shape.d, { transform: [SCALE, 0, 0, SCALE, 0, 0] });
	if (shape.tone === "surface") {
		canvas.fillPath(
			Path.fromSVG(shape.d, { transform: [SCALE, 0, 0, SCALE, 0, 2 * SCALE] }),
			SHADOW,
		);
	}
	canvas.fillPath(path, paint);
}

/**
 * A 2.5 px capsule between two points. Thin enough to read as a rule, thick enough
 * that antialiasing keeps it visible at tile size.
 */
function drawLine(canvas: Canvas, shape: LineShape): void {
	let x1 = shape.x1 * SCALE;
	let y1 = shape.y1 * SCALE;
	let x2 = shape.x2 * SCALE;
	let y2 = shape.y2 * SCALE;
	let dx = x2 - x1;
	let dy = y2 - y1;
	let length = Math.hypot(dx, dy);
	if (length === 0) return;
	let half = 1.25;
	let nx = (-dy / length) * half;
	let ny = (dx / length) * half;
	let path = new Path()
		.moveTo(x1 + nx, y1 + ny)
		.lineTo(x2 + nx, y2 + ny)
		.lineTo(x2 - nx, y2 - ny)
		.lineTo(x1 - nx, y1 - ny)
		.close();
	canvas.fillPath(path, paintFor(shape.tone));
}
