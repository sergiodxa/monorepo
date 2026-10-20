/**
 * Draws the frosted-glass face each `@sdxc/ui` explorer tile shows. A live frame would
 * clip inside a tile; these silhouettes stay legible at card size and match the soft
 * wash React Aria uses for its catalogue, rendered through `@sdxc/raster` so a Worker
 * can serve them as PNG.
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
export const COMPONENT_FACE_VERSION = "1";

interface RectShape {
	kind: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
	r?: number;
	solid?: boolean;
}

interface CircleShape {
	kind: "circle";
	cx: number;
	cy: number;
	r: number;
	solid?: boolean;
}

interface LineShape {
	kind: "line";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

interface PathShape {
	kind: "path";
	d: string;
	solid?: boolean;
}

type Shape = RectShape | CircleShape | LineShape | PathShape;

/** Soft cool wash behind the glass, on the same indigo family the site already uses. */
const WASH = {
	from: color("oklch(0.93 0.035 245)"),
	to: color("oklch(0.86 0.045 230)"),
	glow: color("oklch(0.78 0.08 250)"),
};

const GLASS = withAlpha(color("#ffffff"), 0.55);
const GLASS_SOLID = withAlpha(color("#ffffff"), 0.9);
const GLASS_EDGE = withAlpha(color("#ffffff"), 0.35);

/** A soft fallback when a slug has no hand-tuned silhouette yet. */
const FALLBACK: Shape[] = [{ kind: "rect", x: 40, y: 24, w: 80, h: 52, r: 12 }];

/** Catalogue of silhouettes keyed by component slug. */
const FACES: Record<string, Shape[]> = {
	accordion: [
		{ kind: "rect", x: 28, y: 18, w: 104, h: 20, r: 8 },
		{ kind: "path", d: "M116 24 L122 28 L116 32", solid: true },
		{ kind: "rect", x: 28, y: 44, w: 104, h: 20, r: 8 },
		{ kind: "rect", x: 28, y: 70, w: 104, h: 20, r: 8 },
	],
	alert: [
		{ kind: "rect", x: 28, y: 32, w: 104, h: 40, r: 10 },
		{ kind: "circle", cx: 48, cy: 52, r: 8 },
		{ kind: "line", x1: 64, y1: 46, x2: 116, y2: 46 },
		{ kind: "line", x1: 64, y1: 58, x2: 100, y2: 58 },
	],
	"alert-dialog": [
		{ kind: "rect", x: 40, y: 20, w: 80, h: 64, r: 12 },
		{ kind: "circle", cx: 80, cy: 38, r: 10 },
		{ kind: "line", x1: 52, y1: 58, x2: 108, y2: 58 },
		{ kind: "rect", x: 52, y: 70, w: 28, h: 8, r: 4 },
		{ kind: "rect", x: 86, y: 70, w: 28, h: 8, r: 4, solid: true },
	],
	"aspect-ratio": [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 68, r: 8 },
		{ kind: "line", x1: 52, y1: 30, x2: 108, y2: 30 },
		{ kind: "line", x1: 52, y1: 74, x2: 108, y2: 74 },
	],
	attachment: [
		{ kind: "rect", x: 36, y: 30, w: 88, h: 44, r: 10 },
		{ kind: "rect", x: 48, y: 42, w: 28, h: 20, r: 4 },
		{ kind: "line", x1: 84, y1: 48, x2: 110, y2: 48 },
		{ kind: "line", x1: 84, y1: 58, x2: 100, y2: 58 },
	],
	avatar: [
		{ kind: "circle", cx: 80, cy: 42, r: 18 },
		{ kind: "rect", x: 52, y: 64, w: 56, h: 18, r: 9 },
	],
	badge: [{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 }],
	breadcrumbs: [
		{ kind: "rect", x: 16, y: 40, w: 30, h: 20, r: 10 },
		{ kind: "path", d: "M50 44 L58 50 L50 56", solid: true },
		{ kind: "rect", x: 64, y: 40, w: 30, h: 20, r: 10 },
		{ kind: "path", d: "M98 44 L106 50 L98 56", solid: true },
		{ kind: "rect", x: 112, y: 40, w: 32, h: 20, r: 10 },
	],
	bubble: [
		{ kind: "rect", x: 36, y: 28, w: 88, h: 40, r: 16 },
		{ kind: "path", d: "M56 68 L48 84 L72 68", solid: true },
	],
	button: [{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 }],
	calendar: [
		{ kind: "rect", x: 36, y: 16, w: 88, h: 16, r: 6 },
		{ kind: "circle", cx: 42, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 52, r: 3.5, solid: true },
		{ kind: "circle", cx: 90, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 76, r: 3.5 },
	],
	card: [
		{ kind: "rect", x: 36, y: 18, w: 88, h: 68, r: 12 },
		{ kind: "rect", x: 48, y: 30, w: 64, h: 28, r: 6 },
		{ kind: "line", x1: 48, y1: 70, x2: 108, y2: 70 },
		{ kind: "line", x1: 48, y1: 80, x2: 90, y2: 80 },
	],
	carousel: [
		{ kind: "rect", x: 24, y: 28, w: 40, h: 48, r: 8 },
		{ kind: "rect", x: 52, y: 22, w: 56, h: 60, r: 10, solid: true },
		{ kind: "rect", x: 96, y: 28, w: 40, h: 48, r: 8 },
	],
	chart: [
		{ kind: "rect", x: 36, y: 70, w: 12, h: 16, r: 3, solid: true },
		{ kind: "rect", x: 56, y: 52, w: 12, h: 34, r: 3, solid: true },
		{ kind: "rect", x: 76, y: 40, w: 12, h: 46, r: 3, solid: true },
		{ kind: "rect", x: 96, y: 58, w: 12, h: 28, r: 3, solid: true },
		{ kind: "rect", x: 116, y: 34, w: 12, h: 52, r: 3, solid: true },
	],
	checkbox: [
		{ kind: "rect", x: 36, y: 40, w: 22, h: 22, r: 5 },
		{ kind: "path", d: "M41 51 L46 56 L55 44", solid: true },
		{ kind: "line", x1: 68, y1: 51, x2: 124, y2: 51 },
	],
	"checkbox-group": [
		{ kind: "rect", x: 36, y: 24, w: 16, h: 16, r: 4 },
		{ kind: "path", d: "M40 32 L43 35 L48 28", solid: true },
		{ kind: "line", x1: 62, y1: 32, x2: 124, y2: 32 },
		{ kind: "rect", x: 36, y: 46, w: 16, h: 16, r: 4 },
		{ kind: "line", x1: 62, y1: 54, x2: 118, y2: 54 },
		{ kind: "rect", x: 36, y: 68, w: 16, h: 16, r: 4 },
		{ kind: "line", x1: 62, y1: 76, x2: 110, y2: 76 },
	],
	"color-area": [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 68, r: 12 },
		{ kind: "circle", cx: 62, cy: 68, r: 7, solid: true },
	],
	"color-field": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "circle", cx: 44, cy: 52, r: 7, solid: true },
		{ kind: "line", x1: 58, y1: 52, x2: 112, y2: 52 },
	],
	"color-picker": [
		{ kind: "rect", x: 28, y: 20, w: 64, h: 60, r: 10 },
		{ kind: "rect", x: 100, y: 24, w: 32, h: 16, r: 6 },
		{ kind: "rect", x: 100, y: 48, w: 32, h: 16, r: 6 },
		{ kind: "rect", x: 100, y: 72, w: 32, h: 16, r: 6, solid: true },
	],
	"color-slider": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7 },
		{ kind: "circle", cx: 96, cy: 51, r: 9, solid: true },
	],
	"color-swatch": [{ kind: "rect", x: 56, y: 30, w: 48, h: 48, r: 10, solid: true }],
	"color-swatch-picker": [
		{ kind: "rect", x: 28, y: 30, w: 28, h: 28, r: 6, solid: true },
		{ kind: "rect", x: 66, y: 30, w: 28, h: 28, r: 6 },
		{ kind: "rect", x: 104, y: 30, w: 28, h: 28, r: 6 },
		{ kind: "rect", x: 28, y: 66, w: 28, h: 20, r: 6 },
		{ kind: "rect", x: 66, y: 66, w: 28, h: 20, r: 6 },
		{ kind: "rect", x: 104, y: 66, w: 28, h: 20, r: 6 },
	],
	"color-wheel": [
		{ kind: "circle", cx: 80, cy: 50, r: 28 },
		{ kind: "circle", cx: 80, cy: 50, r: 12 },
		{ kind: "circle", cx: 98, cy: 38, r: 6, solid: true },
	],
	combobox: [
		{ kind: "rect", x: 28, y: 24, w: 104, h: 22, r: 8 },
		{ kind: "path", d: "M116 30 L122 36 L128 30", solid: true },
		{ kind: "rect", x: 40, y: 50, w: 80, h: 40, r: 8 },
		{ kind: "line", x1: 50, y1: 62, x2: 100, y2: 62 },
		{ kind: "line", x1: 50, y1: 74, x2: 90, y2: 74 },
	],
	command: [
		{ kind: "rect", x: 32, y: 18, w: 96, h: 72, r: 12 },
		{ kind: "rect", x: 42, y: 28, w: 76, h: 16, r: 6 },
		{ kind: "line", x1: 48, y1: 56, x2: 112, y2: 56 },
		{ kind: "line", x1: 48, y1: 68, x2: 100, y2: 68 },
	],
	confirm: [
		{ kind: "rect", x: 40, y: 24, w: 80, h: 56, r: 12 },
		{ kind: "line", x1: 52, y1: 42, x2: 108, y2: 42 },
		{ kind: "rect", x: 52, y: 62, w: 28, h: 10, r: 5 },
		{ kind: "rect", x: 88, y: 62, w: 28, h: 10, r: 5, solid: true },
	],
	"context-menu": [
		{ kind: "rect", x: 48, y: 22, w: 72, h: 64, r: 10 },
		{ kind: "line", x1: 58, y1: 36, x2: 108, y2: 36 },
		{ kind: "line", x1: 58, y1: 48, x2: 100, y2: 48 },
		{ kind: "line", x1: 58, y1: 60, x2: 108, y2: 60 },
		{ kind: "line", x1: 58, y1: 72, x2: 90, y2: 72 },
	],
	"date-field": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 70, y2: 52 },
		{ kind: "line", x1: 78, y1: 52, x2: 100, y2: 52 },
	],
	"date-picker": [
		{ kind: "rect", x: 36, y: 22, w: 88, h: 20, r: 8 },
		{ kind: "path", d: "M106 28 L112 34 L118 28", solid: true },
		{ kind: "rect", x: 44, y: 48, w: 72, h: 40, r: 8 },
		{ kind: "circle", cx: 56, cy: 64, r: 3, solid: true },
		{ kind: "circle", cx: 68, cy: 64, r: 3 },
		{ kind: "circle", cx: 80, cy: 64, r: 3 },
		{ kind: "circle", cx: 92, cy: 64, r: 3 },
	],
	"date-range-picker": [
		{ kind: "rect", x: 24, y: 28, w: 50, h: 20, r: 8 },
		{ kind: "rect", x: 86, y: 28, w: 50, h: 20, r: 8 },
		{ kind: "line", x1: 78, y1: 38, x2: 82, y2: 38 },
		{ kind: "rect", x: 40, y: 58, w: 80, h: 28, r: 8 },
	],
	description: [
		{ kind: "line", x1: 36, y1: 40, x2: 120, y2: 40 },
		{ kind: "line", x1: 36, y1: 52, x2: 108, y2: 52 },
		{ kind: "line", x1: 36, y1: 64, x2: 90, y2: 64 },
	],
	dialog: [
		{ kind: "rect", x: 40, y: 22, w: 80, h: 60, r: 12 },
		{ kind: "line", x1: 52, y1: 40, x2: 108, y2: 40 },
		{ kind: "line", x1: 52, y1: 52, x2: 96, y2: 52 },
		{ kind: "rect", x: 52, y: 66, w: 36, h: 10, r: 5 },
	],
	disclosure: [
		{ kind: "rect", x: 28, y: 30, w: 104, h: 20, r: 8 },
		{ kind: "path", d: "M116 36 L122 40 L116 44", solid: true },
		{ kind: "rect", x: 36, y: 56, w: 88, h: 28, r: 8 },
	],
	drawer: [
		{ kind: "rect", x: 70, y: 16, w: 70, h: 72, r: 10 },
		{ kind: "line", x1: 82, y1: 28, x2: 124, y2: 28 },
		{ kind: "line", x1: 82, y1: 42, x2: 116, y2: 42 },
		{ kind: "line", x1: 82, y1: 56, x2: 108, y2: 56 },
	],
	"drop-indicator": [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50 },
		{ kind: "circle", cx: 80, cy: 50, r: 5, solid: true },
	],
	"drop-zone": [
		{ kind: "rect", x: 36, y: 20, w: 88, h: 64, r: 12 },
		{ kind: "line", x1: 80, y1: 40, x2: 80, y2: 60 },
		{ kind: "line", x1: 70, y1: 50, x2: 90, y2: 50 },
	],
	empty: [
		{ kind: "circle", cx: 80, cy: 42, r: 16 },
		{ kind: "line", x1: 48, y1: 72, x2: 112, y2: 72 },
	],
	"field-error": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 100, y2: 52 },
		{ kind: "circle", cx: 118, cy: 36, r: 6, solid: true },
	],
	"file-trigger": [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 8 },
		{ kind: "rect", x: 64, y: 38, w: 32, h: 10, r: 4 },
		{ kind: "line", x1: 60, y1: 58, x2: 100, y2: 58 },
	],
	form: [
		{ kind: "rect", x: 36, y: 22, w: 88, h: 18, r: 8 },
		{ kind: "rect", x: 36, y: 46, w: 88, h: 18, r: 8 },
		{ kind: "rect", x: 36, y: 70, w: 56, h: 16, r: 8 },
	],
	"grid-list": [
		{ kind: "rect", x: 28, y: 18, w: 48, h: 30, r: 8 },
		{ kind: "rect", x: 84, y: 18, w: 48, h: 30, r: 8 },
		{ kind: "rect", x: 28, y: 56, w: 48, h: 30, r: 8 },
		{ kind: "rect", x: 84, y: 56, w: 48, h: 30, r: 8 },
	],
	group: [
		{ kind: "rect", x: 28, y: 24, w: 104, h: 56, r: 10 },
		{ kind: "rect", x: 40, y: 36, w: 80, h: 32, r: 8, solid: true },
	],
	header: [
		{ kind: "rect", x: 24, y: 28, w: 112, h: 20, r: 6 },
		{ kind: "line", x1: 36, y1: 56, x2: 124, y2: 56 },
		{ kind: "line", x1: 36, y1: 70, x2: 100, y2: 70 },
	],
	heading: [
		{ kind: "line", x1: 36, y1: 40, x2: 120, y2: 40 },
		{ kind: "line", x1: 36, y1: 58, x2: 90, y2: 58 },
	],
	"heading-scope": [
		{ kind: "line", x1: 36, y1: 32, x2: 120, y2: 32 },
		{ kind: "line", x1: 36, y1: 48, x2: 100, y2: 48 },
		{ kind: "line", x1: 36, y1: 64, x2: 110, y2: 64 },
	],
	highlight: [
		{ kind: "rect", x: 40, y: 38, w: 80, h: 24, r: 4, solid: true },
		{ kind: "line", x1: 48, y1: 50, x2: 112, y2: 50 },
	],
	"hover-card": [
		{ kind: "rect", x: 36, y: 20, w: 88, h: 64, r: 12 },
		{ kind: "line", x1: 48, y1: 38, x2: 108, y2: 38 },
		{ kind: "line", x1: 48, y1: 50, x2: 96, y2: 50 },
		{ kind: "line", x1: 48, y1: 62, x2: 84, y2: 62 },
	],
	"image-placeholder": [
		{ kind: "rect", x: 40, y: 20, w: 80, h: 64, r: 10 },
		{ kind: "path", d: "M52 68 L72 44 L88 58 L100 48 L116 68 Z", solid: true },
		{ kind: "circle", cx: 64, cy: 36, r: 6, solid: true },
	],
	input: [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 90, y2: 52 },
	],
	item: [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 30, r: 8 },
		{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50 },
	],
	keyboard: [
		{ kind: "rect", x: 30, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 54, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 78, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 102, y: 34, w: 28, h: 16, r: 4 },
		{ kind: "rect", x: 42, y: 56, w: 76, h: 16, r: 4 },
	],
	label: [
		{ kind: "line", x1: 36, y1: 42, x2: 100, y2: 42 },
		{ kind: "line", x1: 36, y1: 58, x2: 78, y2: 58 },
	],
	link: [{ kind: "line", x1: 50, y1: 50, x2: 110, y2: 50 }],
	"link-button": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 },
		{ kind: "line", x1: 60, y1: 50, x2: 100, y2: 50 },
	],
	listbox: [
		{ kind: "rect", x: 40, y: 18, w: 80, h: 68, r: 10 },
		{ kind: "line", x1: 52, y1: 34, x2: 108, y2: 34 },
		{ kind: "line", x1: 52, y1: 48, x2: 100, y2: 48 },
		{ kind: "rect", x: 48, y: 58, w: 64, h: 16, r: 4, solid: true },
	],
	logo: [
		{ kind: "circle", cx: 80, cy: 50, r: 22 },
		{ kind: "circle", cx: 80, cy: 50, r: 10, solid: true },
	],
	marker: [
		{ kind: "circle", cx: 48, cy: 50, r: 10, solid: true },
		{ kind: "line", x1: 64, y1: 50, x2: 124, y2: 50 },
	],
	menu: [
		{ kind: "rect", x: 48, y: 20, w: 72, h: 68, r: 10 },
		{ kind: "line", x1: 58, y1: 34, x2: 108, y2: 34 },
		{ kind: "line", x1: 58, y1: 46, x2: 100, y2: 46 },
		{ kind: "line", x1: 58, y1: 58, x2: 108, y2: 58 },
		{ kind: "line", x1: 58, y1: 70, x2: 92, y2: 70 },
	],
	menubar: [
		{ kind: "rect", x: 24, y: 34, w: 112, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 43, x2: 52, y2: 43 },
		{ kind: "line", x1: 64, y1: 43, x2: 80, y2: 43 },
		{ kind: "line", x1: 92, y1: 43, x2: 112, y2: 43 },
	],
	message: [
		{ kind: "rect", x: 28, y: 24, w: 90, h: 32, r: 12 },
		{ kind: "rect", x: 42, y: 64, w: 90, h: 24, r: 12 },
	],
	"message-scroller": [
		{ kind: "rect", x: 36, y: 14, w: 88, h: 24, r: 10 },
		{ kind: "rect", x: 36, y: 42, w: 88, h: 24, r: 10 },
		{ kind: "rect", x: 36, y: 70, w: 88, h: 24, r: 10 },
	],
	meter: [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7 },
		{ kind: "rect", x: 28, y: 44, w: 78, h: 14, r: 7, solid: true },
	],
	modal: [
		{ kind: "rect", x: 34, y: 18, w: 92, h: 68, r: 12 },
		{ kind: "rect", x: 48, y: 28, w: 64, h: 48, r: 10, solid: true },
	],
	"navigation-menu": [
		{ kind: "rect", x: 24, y: 28, w: 36, h: 16, r: 6 },
		{ kind: "rect", x: 66, y: 28, w: 36, h: 16, r: 6, solid: true },
		{ kind: "rect", x: 108, y: 28, w: 28, h: 16, r: 6 },
		{ kind: "rect", x: 50, y: 52, w: 80, h: 36, r: 8 },
	],
	"nav-link": [
		{ kind: "line", x1: 40, y1: 50, x2: 120, y2: 50 },
		{ kind: "rect", x: 40, y: 44, w: 8, h: 12, r: 2, solid: true },
	],
	"number-field": [
		{ kind: "rect", x: 36, y: 38, w: 88, h: 26, r: 10 },
		{ kind: "line", x1: 48, y1: 51, x2: 90, y2: 51 },
		{ kind: "rect", x: 108, y: 40, w: 12, h: 10, r: 3 },
		{ kind: "rect", x: 108, y: 52, w: 12, h: 10, r: 3 },
	],
	"otp-field": [
		{ kind: "rect", x: 28, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 56, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 84, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 112, y: 38, w: 22, h: 28, r: 6 },
	],
	"overlay-arrow": [
		{ kind: "rect", x: 50, y: 28, w: 60, h: 36, r: 8 },
		{ kind: "path", d: "M72 64 L80 80 L88 64", solid: true },
	],
	pagination: [
		{ kind: "rect", x: 28, y: 40, w: 22, h: 22, r: 6 },
		{ kind: "rect", x: 56, y: 40, w: 22, h: 22, r: 6, solid: true },
		{ kind: "rect", x: 84, y: 40, w: 22, h: 22, r: 6 },
		{ kind: "rect", x: 112, y: 40, w: 22, h: 22, r: 6 },
	],
	popover: [
		{ kind: "rect", x: 44, y: 22, w: 72, h: 48, r: 10 },
		{ kind: "path", d: "M72 70 L80 84 L88 70", solid: true },
	],
	"progress-bar": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7 },
		{ kind: "rect", x: 28, y: 44, w: 62, h: 14, r: 7, solid: true },
	],
	"radio-group": [
		{ kind: "circle", cx: 44, cy: 30, r: 8 },
		{ kind: "circle", cx: 44, cy: 30, r: 3.5, solid: true },
		{ kind: "line", x1: 62, y1: 30, x2: 124, y2: 30 },
		{ kind: "circle", cx: 44, cy: 52, r: 8 },
		{ kind: "line", x1: 62, y1: 52, x2: 118, y2: 52 },
		{ kind: "circle", cx: 44, cy: 74, r: 8 },
		{ kind: "line", x1: 62, y1: 74, x2: 110, y2: 74 },
	],
	"range-calendar": [
		{ kind: "rect", x: 36, y: 16, w: 88, h: 16, r: 6 },
		{ kind: "circle", cx: 42, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 40, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 52, r: 3.5, solid: true },
		{ kind: "circle", cx: 78, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 52, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 64, r: 3.5 },
		{ kind: "circle", cx: 42, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 54, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 66, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 78, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 90, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 102, cy: 76, r: 3.5 },
		{ kind: "circle", cx: 114, cy: 76, r: 3.5 },
		{ kind: "rect", x: 54, y: 48, w: 36, h: 8, r: 4 },
	],
	resizable: [
		{ kind: "rect", x: 24, y: 24, w: 52, h: 56, r: 8 },
		{ kind: "rect", x: 84, y: 24, w: 52, h: 56, r: 8 },
		{ kind: "line", x1: 80, y1: 30, x2: 80, y2: 74 },
	],
	"scroll-area": [
		{ kind: "rect", x: 40, y: 16, w: 80, h: 72, r: 10 },
		{ kind: "rect", x: 112, y: 28, w: 6, h: 40, r: 3, solid: true },
	],
	"search-field": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 26, r: 13 },
		{ kind: "circle", cx: 46, cy: 51, r: 7 },
		{ kind: "line", x1: 51, y1: 56, x2: 58, y2: 63 },
		{ kind: "line", x1: 70, y1: 51, x2: 112, y2: 51 },
	],
	section: [
		{ kind: "rect", x: 28, y: 20, w: 104, h: 64, r: 10 },
		{ kind: "line", x1: 44, y1: 40, x2: 116, y2: 40 },
		{ kind: "line", x1: 44, y1: 54, x2: 100, y2: 54 },
	],
	select: [
		{ kind: "rect", x: 36, y: 38, w: 88, h: 26, r: 8 },
		{ kind: "path", d: "M106 44 L112 50 L118 44", solid: true },
		{ kind: "line", x1: 48, y1: 51, x2: 90, y2: 51 },
	],
	"selection-indicator": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 28, r: 8 },
		{ kind: "rect", x: 56, y: 46, w: 20, h: 12, r: 4, solid: true },
	],
	"sentinel-row": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 24, r: 8 },
		{ kind: "line", x1: 40, y1: 50, x2: 120, y2: 50 },
	],
	separator: [{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50 }],
	"shared-element": [
		{ kind: "rect", x: 28, y: 28, w: 48, h: 48, r: 10 },
		{ kind: "rect", x: 84, y: 28, w: 48, h: 48, r: 10, solid: true },
		{ kind: "circle", cx: 80, cy: 52, r: 8, solid: true },
	],
	sheet: [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 56, r: 12 },
		{ kind: "rect", x: 68, y: 44, w: 24, h: 4, r: 2 },
		{ kind: "line", x1: 44, y1: 60, x2: 116, y2: 60 },
	],
	"shortcut-list": [
		{ kind: "rect", x: 28, y: 22, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 31, x2: 90, y2: 31 },
		{ kind: "rect", x: 108, y: 28, w: 16, h: 8, r: 3 },
		{ kind: "rect", x: 28, y: 46, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 55, x2: 84, y2: 55 },
		{ kind: "rect", x: 108, y: 52, w: 16, h: 8, r: 3 },
		{ kind: "rect", x: 28, y: 70, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 79, x2: 96, y2: 79 },
		{ kind: "rect", x: 108, y: 76, w: 16, h: 8, r: 3 },
	],
	sidebar: [
		{ kind: "rect", x: 24, y: 16, w: 40, h: 72, r: 8 },
		{ kind: "line", x1: 34, y1: 32, x2: 54, y2: 32 },
		{ kind: "line", x1: 34, y1: 46, x2: 54, y2: 46 },
		{ kind: "line", x1: 34, y1: 60, x2: 50, y2: 60 },
		{ kind: "rect", x: 72, y: 16, w: 64, h: 72, r: 8 },
	],
	skeleton: [
		{ kind: "rect", x: 28, y: 28, w: 104, h: 14, r: 7 },
		{ kind: "rect", x: 28, y: 50, w: 80, h: 14, r: 7 },
		{ kind: "rect", x: 28, y: 72, w: 64, h: 14, r: 7 },
	],
	slider: [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50 },
		{ kind: "circle", cx: 88, cy: 50, r: 9, solid: true },
	],
	spinner: [
		{ kind: "circle", cx: 80, cy: 50, r: 18 },
		{ kind: "circle", cx: 80, cy: 50, r: 12 },
	],
	switch: [
		{ kind: "rect", x: 52, y: 40, w: 56, h: 22, r: 11 },
		{ kind: "circle", cx: 90, cy: 51, r: 8, solid: true },
	],
	table: [
		{ kind: "rect", x: 28, y: 20, w: 104, h: 64, r: 8 },
		{ kind: "line", x1: 28, y1: 36, x2: 132, y2: 36 },
		{ kind: "line", x1: 28, y1: 52, x2: 132, y2: 52 },
		{ kind: "line", x1: 28, y1: 68, x2: 132, y2: 68 },
		{ kind: "line", x1: 62, y1: 20, x2: 62, y2: 84 },
		{ kind: "line", x1: 98, y1: 20, x2: 98, y2: 84 },
	],
	tabs: [
		{ kind: "rect", x: 28, y: 28, w: 32, h: 16, r: 6, solid: true },
		{ kind: "rect", x: 64, y: 28, w: 32, h: 16, r: 6 },
		{ kind: "rect", x: 100, y: 28, w: 32, h: 16, r: 6 },
		{ kind: "rect", x: 28, y: 48, w: 104, h: 36, r: 8 },
	],
	"tag-group": [
		{ kind: "rect", x: 24, y: 38, w: 36, h: 24, r: 12 },
		{ kind: "rect", x: 66, y: 38, w: 32, h: 24, r: 12 },
		{ kind: "rect", x: 104, y: 38, w: 36, h: 24, r: 12 },
	],
	text: [
		{ kind: "line", x1: 36, y1: 36, x2: 124, y2: 36 },
		{ kind: "line", x1: 36, y1: 50, x2: 110, y2: 50 },
		{ kind: "line", x1: 36, y1: 64, x2: 96, y2: 64 },
	],
	textarea: [
		{ kind: "rect", x: 36, y: 24, w: 88, h: 56, r: 10 },
		{ kind: "line", x1: 48, y1: 40, x2: 108, y2: 40 },
		{ kind: "line", x1: 48, y1: 52, x2: 100, y2: 52 },
		{ kind: "line", x1: 48, y1: 64, x2: 88, y2: 64 },
	],
	"text-field": [
		{ kind: "rect", x: 28, y: 32, w: 104, h: 20, r: 8 },
		{ kind: "line", x1: 40, y1: 42, x2: 96, y2: 42 },
		{ kind: "line", x1: 36, y1: 62, x2: 90, y2: 62 },
	],
	"time-field": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 24, r: 10 },
		{ kind: "line", x1: 56, y1: 52, x2: 72, y2: 52 },
		{ kind: "circle", cx: 92, cy: 52, r: 2, solid: true },
		{ kind: "circle", cx: 100, cy: 52, r: 2, solid: true },
	],
	toast: [
		{ kind: "rect", x: 36, y: 36, w: 88, h: 32, r: 10 },
		{ kind: "line", x1: 50, y1: 48, x2: 100, y2: 48 },
		{ kind: "line", x1: 50, y1: 58, x2: 84, y2: 58 },
	],
	"toggle-button": [
		{ kind: "rect", x: 42, y: 38, w: 76, h: 24, r: 12 },
		{ kind: "line", x1: 58, y1: 50, x2: 102, y2: 50 },
	],
	toolbar: [
		{ kind: "rect", x: 24, y: 38, w: 112, h: 26, r: 8 },
		{ kind: "rect", x: 34, y: 44, w: 16, h: 14, r: 4 },
		{ kind: "rect", x: 56, y: 44, w: 16, h: 14, r: 4 },
		{ kind: "rect", x: 78, y: 44, w: 16, h: 14, r: 4 },
		{ kind: "rect", x: 108, y: 44, w: 20, h: 14, r: 4, solid: true },
	],
	tooltip: [
		{ kind: "rect", x: 48, y: 30, w: 64, h: 28, r: 8 },
		{ kind: "path", d: "M72 58 L80 72 L88 58", solid: true },
	],
	tree: [
		{ kind: "line", x1: 40, y1: 28, x2: 40, y2: 78 },
		{ kind: "line", x1: 40, y1: 40, x2: 70, y2: 40 },
		{ kind: "line", x1: 40, y1: 58, x2: 70, y2: 58 },
		{ kind: "line", x1: 40, y1: 76, x2: 70, y2: 76 },
		{ kind: "rect", x: 70, y: 32, w: 50, h: 16, r: 4 },
		{ kind: "rect", x: 70, y: 50, w: 50, h: 16, r: 4 },
		{ kind: "rect", x: 70, y: 68, w: 50, h: 16, r: 4 },
	],
	typeset: [
		{ kind: "line", x1: 36, y1: 30, x2: 80, y2: 30 },
		{ kind: "line", x1: 36, y1: 46, x2: 124, y2: 46 },
		{ kind: "line", x1: 36, y1: 58, x2: 118, y2: 58 },
		{ kind: "line", x1: 36, y1: 70, x2: 100, y2: 70 },
	],
	"youtube-embed": [
		{ kind: "rect", x: 36, y: 22, w: 88, h: 56, r: 12 },
		{ kind: "path", d: "M72 42 L94 50 L72 58 Z", solid: true },
	],
};

/**
 * Whether a slug has a hand-tuned face. Unknown components still render {@link FALLBACK},
 * so a new export shows a glass card rather than a blank plane.
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
				[0.55, WASH.glow],
				[1, WASH.to],
			],
		}),
	);

	let shapes = FACES[slug] ?? FALLBACK;
	for (let shape of shapes) drawShape(canvas, shape);

	return canvas.toPNG();
}

/** Paints one frosted piece into the canvas, scaled from design space. */
function drawShape(canvas: Canvas, shape: Shape): void {
	let paint = shape.kind !== "line" && "solid" in shape && shape.solid ? GLASS_SOLID : GLASS;

	if (shape.kind === "rect") {
		let path = Path.roundedRect(
			shape.x * SCALE,
			shape.y * SCALE,
			shape.w * SCALE,
			shape.h * SCALE,
			(shape.r ?? 8) * SCALE,
		);
		canvas.fillPath(
			Path.roundedRect(
				shape.x * SCALE - 1,
				shape.y * SCALE - 1,
				shape.w * SCALE + 2,
				shape.h * SCALE + 2,
				((shape.r ?? 8) + 1) * SCALE,
			),
			GLASS_EDGE,
		);
		canvas.fillPath(path, paint);
		return;
	}

	if (shape.kind === "circle") {
		let x = (shape.cx - shape.r) * SCALE;
		let y = (shape.cy - shape.r) * SCALE;
		let size = shape.r * 2 * SCALE;
		canvas.fillPath(Path.roundedRect(x - 1, y - 1, size + 2, size + 2, size), GLASS_EDGE);
		canvas.fillPath(Path.roundedRect(x, y, size, size, size), paint);
		return;
	}

	if (shape.kind === "line") {
		drawLine(canvas, shape);
		return;
	}

	canvas.fillPath(
		Path.fromSVG(shape.d, { transform: [SCALE, 0, 0, SCALE, 0, 0] }),
		shape.solid ? GLASS_SOLID : GLASS,
	);
}

/**
 * A 3 px glass capsule between two points. Thin enough to read as a rule, thick enough
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
	let nx = (-dy / length) * 1.5;
	let ny = (dx / length) * 1.5;
	let path = new Path()
		.moveTo(x1 + nx, y1 + ny)
		.lineTo(x2 + nx, y2 + ny)
		.lineTo(x2 - nx, y2 - ny)
		.lineTo(x1 - nx, y1 - ny)
		.close();
	canvas.fillPath(path, GLASS);
}
