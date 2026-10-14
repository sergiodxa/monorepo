/**
 * Frosted-glass preview glyphs for the `@sdxc/ui` explorer grid. Each slug gets a small
 * silhouette of the pattern so the catalogue scans as a gallery without mounting live
 * frames that clip inside a tile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { absolute, inset } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

/** Shared canvas every glyph is drawn into. */
const VIEW_WIDTH = 160;
const VIEW_HEIGHT = 100;

interface RectShape {
	kind: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
	r?: number;
	o?: number;
}

interface CircleShape {
	kind: "circle";
	cx: number;
	cy: number;
	r: number;
	o?: number;
	solid?: boolean;
}

interface LineShape {
	kind: "line";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	o?: number;
}

interface PathShape {
	kind: "path";
	d: string;
	o?: number;
}

type Shape = RectShape | CircleShape | LineShape | PathShape;

/**
 * Frosted fill for ordinary glass pieces. Solid pieces (selected dots, thumbs) use a
 * brighter white so the mark reads against the wash.
 */
const GLASS_FILL = "color-mix(in oklch, white 62%, transparent)";
const GLASS_STROKE = "color-mix(in oklch, white 78%, transparent)";
const SOLID_FILL = "color-mix(in oklch, white 92%, transparent)";

/** Catalogue of silhouettes keyed by component slug. */
const GLYPHS: Record<string, Shape[]> = {
	accordion: [
		{ kind: "rect", x: 28, y: 18, w: 104, h: 20, r: 8 },
		{ kind: "path", d: "M118 24 L122 28 L118 32", o: 0.5 },
		{ kind: "rect", x: 28, y: 44, w: 104, h: 20, r: 8, o: 0.45 },
		{ kind: "rect", x: 28, y: 70, w: 104, h: 20, r: 8, o: 0.45 },
	],
	alert: [
		{ kind: "rect", x: 28, y: 32, w: 104, h: 40, r: 10 },
		{ kind: "circle", cx: 48, cy: 52, r: 8, o: 0.6 },
		{ kind: "line", x1: 64, y1: 46, x2: 116, y2: 46, o: 0.4 },
		{ kind: "line", x1: 64, y1: 58, x2: 100, y2: 58, o: 0.3 },
	],
	"alert-dialog": [
		{ kind: "rect", x: 40, y: 20, w: 80, h: 64, r: 12 },
		{ kind: "circle", cx: 80, cy: 38, r: 10, o: 0.6 },
		{ kind: "line", x1: 52, y1: 58, x2: 108, y2: 58, o: 0.35 },
		{ kind: "rect", x: 52, y: 70, w: 28, h: 8, r: 4, o: 0.5 },
		{ kind: "rect", x: 86, y: 70, w: 28, h: 8, r: 4, o: 0.7 },
	],
	"aspect-ratio": [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 68, r: 8 },
		{ kind: "line", x1: 52, y1: 30, x2: 108, y2: 30, o: 0.25 },
		{ kind: "line", x1: 52, y1: 74, x2: 108, y2: 74, o: 0.25 },
	],
	attachment: [
		{ kind: "rect", x: 36, y: 30, w: 88, h: 44, r: 10 },
		{ kind: "rect", x: 48, y: 42, w: 28, h: 20, r: 4, o: 0.5 },
		{ kind: "line", x1: 84, y1: 48, x2: 110, y2: 48, o: 0.35 },
		{ kind: "line", x1: 84, y1: 58, x2: 100, y2: 58, o: 0.3 },
	],
	avatar: [
		{ kind: "circle", cx: 80, cy: 42, r: 18 },
		{ kind: "rect", x: 52, y: 64, w: 56, h: 18, r: 9, o: 0.5 },
	],
	badge: [{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 }],
	breadcrumbs: [
		{ kind: "rect", x: 16, y: 40, w: 30, h: 20, r: 10 },
		{ kind: "path", d: "M52 45 L58 50 L52 55", o: 0.45 },
		{ kind: "rect", x: 64, y: 40, w: 30, h: 20, r: 10 },
		{ kind: "path", d: "M100 45 L106 50 L100 55", o: 0.45 },
		{ kind: "rect", x: 112, y: 40, w: 32, h: 20, r: 10 },
	],
	bubble: [
		{ kind: "rect", x: 36, y: 28, w: 88, h: 40, r: 16 },
		{ kind: "path", d: "M56 68 L48 82 L72 68", o: 0.7 },
	],
	button: [{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 }],
	calendar: [
		{ kind: "rect", x: 36, y: 16, w: 88, h: 16, r: 6, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 52, r: 3.5, solid: true },
		{ kind: "circle", cx: 90, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 76, r: 3.5, o: 0.45 },
	],
	card: [
		{ kind: "rect", x: 36, y: 18, w: 88, h: 68, r: 12 },
		{ kind: "rect", x: 48, y: 30, w: 64, h: 28, r: 6, o: 0.4 },
		{ kind: "line", x1: 48, y1: 70, x2: 108, y2: 70, o: 0.35 },
		{ kind: "line", x1: 48, y1: 80, x2: 90, y2: 80, o: 0.25 },
	],
	carousel: [
		{ kind: "rect", x: 24, y: 28, w: 40, h: 48, r: 8, o: 0.4 },
		{ kind: "rect", x: 52, y: 22, w: 56, h: 60, r: 10 },
		{ kind: "rect", x: 96, y: 28, w: 40, h: 48, r: 8, o: 0.4 },
	],
	chart: [
		{ kind: "rect", x: 36, y: 70, w: 12, h: 16, r: 3 },
		{ kind: "rect", x: 56, y: 52, w: 12, h: 34, r: 3 },
		{ kind: "rect", x: 76, y: 40, w: 12, h: 46, r: 3 },
		{ kind: "rect", x: 96, y: 58, w: 12, h: 28, r: 3 },
		{ kind: "rect", x: 116, y: 34, w: 12, h: 52, r: 3 },
	],
	checkbox: [
		{ kind: "rect", x: 36, y: 40, w: 22, h: 22, r: 5 },
		{ kind: "path", d: "M42 51 L46 55 L54 45", o: 0.85 },
		{ kind: "line", x1: 68, y1: 51, x2: 124, y2: 51, o: 0.4 },
	],
	"checkbox-group": [
		{ kind: "rect", x: 36, y: 24, w: 16, h: 16, r: 4 },
		{ kind: "path", d: "M40 32 L43 35 L48 28", o: 0.8 },
		{ kind: "line", x1: 62, y1: 32, x2: 124, y2: 32, o: 0.35 },
		{ kind: "rect", x: 36, y: 46, w: 16, h: 16, r: 4 },
		{ kind: "line", x1: 62, y1: 54, x2: 118, y2: 54, o: 0.35 },
		{ kind: "rect", x: 36, y: 68, w: 16, h: 16, r: 4 },
		{ kind: "line", x1: 62, y1: 76, x2: 110, y2: 76, o: 0.35 },
	],
	"color-area": [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 68, r: 12 },
		{ kind: "circle", cx: 62, cy: 68, r: 7 },
	],
	"color-field": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "circle", cx: 44, cy: 52, r: 7, o: 0.7, solid: true },
		{ kind: "line", x1: 58, y1: 52, x2: 112, y2: 52, o: 0.3 },
	],
	"color-picker": [
		{ kind: "rect", x: 28, y: 20, w: 64, h: 60, r: 10 },
		{ kind: "rect", x: 100, y: 24, w: 32, h: 16, r: 6 },
		{ kind: "rect", x: 100, y: 48, w: 32, h: 16, r: 6, o: 0.6 },
		{ kind: "rect", x: 100, y: 72, w: 32, h: 16, r: 6, o: 0.75 },
	],
	"color-slider": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, o: 0.5 },
		{ kind: "circle", cx: 96, cy: 51, r: 9, solid: true },
	],
	"color-swatch": [{ kind: "rect", x: 56, y: 30, w: 48, h: 48, r: 10, o: 0.75 }],
	"color-swatch-picker": [
		{ kind: "rect", x: 28, y: 30, w: 28, h: 28, r: 6 },
		{ kind: "rect", x: 66, y: 30, w: 28, h: 28, r: 6, o: 0.7 },
		{ kind: "rect", x: 104, y: 30, w: 28, h: 28, r: 6, o: 0.5 },
		{ kind: "rect", x: 28, y: 66, w: 28, h: 20, r: 6, o: 0.4 },
		{ kind: "rect", x: 66, y: 66, w: 28, h: 20, r: 6, o: 0.55 },
		{ kind: "rect", x: 104, y: 66, w: 28, h: 20, r: 6, o: 0.65 },
	],
	"color-wheel": [
		{ kind: "circle", cx: 80, cy: 50, r: 28, o: 0.4 },
		{ kind: "circle", cx: 80, cy: 50, r: 12, o: 0.25 },
		{ kind: "circle", cx: 98, cy: 38, r: 6, solid: true },
	],
	combobox: [
		{ kind: "rect", x: 28, y: 24, w: 104, h: 22, r: 8 },
		{ kind: "path", d: "M118 32 L122 36 L126 32", o: 0.55 },
		{ kind: "rect", x: 40, y: 50, w: 80, h: 40, r: 8, o: 0.45 },
		{ kind: "line", x1: 50, y1: 62, x2: 100, y2: 62, o: 0.3 },
		{ kind: "line", x1: 50, y1: 74, x2: 90, y2: 74, o: 0.3 },
	],
	command: [
		{ kind: "rect", x: 32, y: 18, w: 96, h: 72, r: 12 },
		{ kind: "rect", x: 42, y: 28, w: 76, h: 16, r: 6 },
		{ kind: "line", x1: 48, y1: 56, x2: 112, y2: 56, o: 0.3 },
		{ kind: "line", x1: 48, y1: 68, x2: 100, y2: 68, o: 0.3 },
	],
	confirm: [
		{ kind: "rect", x: 40, y: 24, w: 80, h: 56, r: 12 },
		{ kind: "line", x1: 52, y1: 42, x2: 108, y2: 42, o: 0.4 },
		{ kind: "rect", x: 52, y: 62, w: 28, h: 10, r: 5, o: 0.45 },
		{ kind: "rect", x: 88, y: 62, w: 28, h: 10, r: 5, o: 0.75 },
	],
	"context-menu": [
		{ kind: "rect", x: 48, y: 22, w: 72, h: 64, r: 10 },
		{ kind: "line", x1: 58, y1: 36, x2: 108, y2: 36, o: 0.35 },
		{ kind: "line", x1: 58, y1: 48, x2: 100, y2: 48, o: 0.35 },
		{ kind: "line", x1: 58, y1: 60, x2: 108, y2: 60, o: 0.35 },
		{ kind: "line", x1: 58, y1: 72, x2: 90, y2: 72, o: 0.35 },
	],
	"date-field": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 70, y2: 52, o: 0.35 },
		{ kind: "line", x1: 78, y1: 52, x2: 100, y2: 52, o: 0.25 },
	],
	"date-picker": [
		{ kind: "rect", x: 36, y: 22, w: 88, h: 20, r: 8 },
		{ kind: "path", d: "M108 28 L112 32 L116 28", o: 0.5 },
		{ kind: "rect", x: 44, y: 48, w: 72, h: 40, r: 8, o: 0.4 },
		{ kind: "circle", cx: 56, cy: 64, r: 3, o: 0.5, solid: true },
		{ kind: "circle", cx: 68, cy: 64, r: 3 },
		{ kind: "circle", cx: 80, cy: 64, r: 3 },
		{ kind: "circle", cx: 92, cy: 64, r: 3 },
	],
	"date-range-picker": [
		{ kind: "rect", x: 24, y: 28, w: 50, h: 20, r: 8 },
		{ kind: "rect", x: 86, y: 28, w: 50, h: 20, r: 8 },
		{ kind: "line", x1: 78, y1: 38, x2: 82, y2: 38, o: 0.4 },
		{ kind: "rect", x: 40, y: 58, w: 80, h: 28, r: 8, o: 0.4 },
	],
	description: [
		{ kind: "line", x1: 36, y1: 40, x2: 120, y2: 40, o: 0.35 },
		{ kind: "line", x1: 36, y1: 52, x2: 108, y2: 52, o: 0.3 },
		{ kind: "line", x1: 36, y1: 64, x2: 90, y2: 64, o: 0.25 },
	],
	dialog: [
		{ kind: "rect", x: 40, y: 22, w: 80, h: 60, r: 12 },
		{ kind: "line", x1: 52, y1: 40, x2: 108, y2: 40, o: 0.4 },
		{ kind: "line", x1: 52, y1: 52, x2: 96, y2: 52, o: 0.3 },
		{ kind: "rect", x: 52, y: 66, w: 36, h: 10, r: 5, o: 0.55 },
	],
	disclosure: [
		{ kind: "rect", x: 28, y: 30, w: 104, h: 20, r: 8 },
		{ kind: "path", d: "M118 36 L122 40 L118 44", o: 0.5 },
		{ kind: "rect", x: 36, y: 56, w: 88, h: 28, r: 8, o: 0.4 },
	],
	drawer: [
		{ kind: "rect", x: 70, y: 16, w: 70, h: 72, r: 10 },
		{ kind: "line", x1: 82, y1: 28, x2: 124, y2: 28, o: 0.35 },
		{ kind: "line", x1: 82, y1: 42, x2: 116, y2: 42, o: 0.3 },
		{ kind: "line", x1: 82, y1: 56, x2: 108, y2: 56, o: 0.25 },
	],
	"drop-indicator": [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, o: 0.55 },
		{ kind: "circle", cx: 80, cy: 50, r: 5, solid: true },
	],
	"drop-zone": [
		{ kind: "rect", x: 36, y: 20, w: 88, h: 64, r: 12, o: 0.35 },
		{ kind: "path", d: "M80 40 L80 60 M70 50 L90 50", o: 0.55 },
	],
	empty: [
		{ kind: "circle", cx: 80, cy: 42, r: 16, o: 0.35 },
		{ kind: "line", x1: 48, y1: 72, x2: 112, y2: 72, o: 0.3 },
	],
	"field-error": [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 100, y2: 52, o: 0.3 },
		{ kind: "circle", cx: 118, cy: 36, r: 6, o: 0.7, solid: true },
	],
	"file-trigger": [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 8 },
		{ kind: "rect", x: 64, y: 38, w: 32, h: 10, r: 4, o: 0.55 },
		{ kind: "line", x1: 60, y1: 58, x2: 100, y2: 58, o: 0.35 },
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
		{ kind: "rect", x: 28, y: 24, w: 104, h: 56, r: 10, o: 0.4 },
		{ kind: "rect", x: 40, y: 36, w: 80, h: 32, r: 8 },
	],
	header: [
		{ kind: "rect", x: 24, y: 28, w: 112, h: 20, r: 6 },
		{ kind: "line", x1: 36, y1: 56, x2: 124, y2: 56, o: 0.3 },
		{ kind: "line", x1: 36, y1: 70, x2: 100, y2: 70, o: 0.25 },
	],
	heading: [
		{ kind: "line", x1: 36, y1: 40, x2: 120, y2: 40, o: 0.55 },
		{ kind: "line", x1: 36, y1: 58, x2: 90, y2: 58, o: 0.3 },
	],
	"heading-scope": [
		{ kind: "line", x1: 36, y1: 32, x2: 120, y2: 32, o: 0.55 },
		{ kind: "line", x1: 36, y1: 48, x2: 100, y2: 48, o: 0.35 },
		{ kind: "line", x1: 36, y1: 64, x2: 110, y2: 64, o: 0.3 },
	],
	highlight: [
		{ kind: "rect", x: 40, y: 38, w: 80, h: 24, r: 4, o: 0.55 },
		{ kind: "line", x1: 48, y1: 50, x2: 112, y2: 50, o: 0.45 },
	],
	"hover-card": [
		{ kind: "rect", x: 36, y: 20, w: 88, h: 64, r: 12 },
		{ kind: "line", x1: 48, y1: 38, x2: 108, y2: 38, o: 0.35 },
		{ kind: "line", x1: 48, y1: 50, x2: 96, y2: 50, o: 0.3 },
		{ kind: "line", x1: 48, y1: 62, x2: 84, y2: 62, o: 0.25 },
	],
	"image-placeholder": [
		{ kind: "rect", x: 40, y: 20, w: 80, h: 64, r: 10 },
		{ kind: "path", d: "M52 68 L72 44 L88 58 L100 48 L116 68 Z", o: 0.45 },
		{ kind: "circle", cx: 64, cy: 36, r: 6, o: 0.5, solid: true },
	],
	input: [
		{ kind: "rect", x: 28, y: 40, w: 104, h: 24, r: 10 },
		{ kind: "line", x1: 40, y1: 52, x2: 90, y2: 52, o: 0.35 },
	],
	item: [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 28, r: 8 },
		{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50, o: 0.35 },
	],
	keyboard: [
		{ kind: "rect", x: 30, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 54, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 78, y: 34, w: 20, h: 16, r: 4 },
		{ kind: "rect", x: 102, y: 34, w: 28, h: 16, r: 4 },
		{ kind: "rect", x: 42, y: 56, w: 76, h: 16, r: 4 },
	],
	label: [
		{ kind: "line", x1: 36, y1: 42, x2: 100, y2: 42, o: 0.55 },
		{ kind: "line", x1: 36, y1: 58, x2: 78, y2: 58, o: 0.3 },
	],
	link: [
		{ kind: "line", x1: 50, y1: 50, x2: 110, y2: 50 },
		{ kind: "line", x1: 50, y1: 50, x2: 58, y2: 42, o: 0.5 },
		{ kind: "line", x1: 50, y1: 50, x2: 58, y2: 58, o: 0.5 },
	],
	"link-button": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12 },
		{ kind: "line", x1: 60, y1: 50, x2: 100, y2: 50, o: 0.4 },
	],
	listbox: [
		{ kind: "rect", x: 40, y: 18, w: 80, h: 68, r: 10 },
		{ kind: "line", x1: 52, y1: 34, x2: 108, y2: 34, o: 0.35 },
		{ kind: "line", x1: 52, y1: 48, x2: 100, y2: 48, o: 0.35 },
		{ kind: "rect", x: 48, y: 58, w: 64, h: 16, r: 4, o: 0.55 },
	],
	logo: [
		{ kind: "circle", cx: 80, cy: 50, r: 22 },
		{ kind: "circle", cx: 80, cy: 50, r: 10, o: 0.5, solid: true },
	],
	marker: [
		{ kind: "circle", cx: 48, cy: 50, r: 10, o: 0.7, solid: true },
		{ kind: "line", x1: 64, y1: 50, x2: 124, y2: 50, o: 0.35 },
	],
	menu: [
		{ kind: "rect", x: 48, y: 20, w: 72, h: 68, r: 10 },
		{ kind: "line", x1: 58, y1: 34, x2: 108, y2: 34, o: 0.35 },
		{ kind: "line", x1: 58, y1: 46, x2: 100, y2: 46, o: 0.35 },
		{ kind: "line", x1: 58, y1: 58, x2: 108, y2: 58, o: 0.35 },
		{ kind: "line", x1: 58, y1: 70, x2: 92, y2: 70, o: 0.35 },
	],
	menubar: [
		{ kind: "rect", x: 24, y: 34, w: 112, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 43, x2: 52, y2: 43, o: 0.5 },
		{ kind: "line", x1: 64, y1: 43, x2: 80, y2: 43, o: 0.5 },
		{ kind: "line", x1: 92, y1: 43, x2: 112, y2: 43, o: 0.5 },
	],
	message: [
		{ kind: "rect", x: 28, y: 24, w: 90, h: 32, r: 12 },
		{ kind: "rect", x: 42, y: 64, w: 90, h: 24, r: 12, o: 0.55 },
	],
	"message-scroller": [
		{ kind: "rect", x: 36, y: 14, w: 88, h: 24, r: 10 },
		{ kind: "rect", x: 36, y: 42, w: 88, h: 24, r: 10, o: 0.55 },
		{ kind: "rect", x: 36, y: 70, w: 88, h: 24, r: 10, o: 0.35 },
	],
	meter: [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, o: 0.35 },
		{ kind: "rect", x: 28, y: 44, w: 78, h: 14, r: 7, o: 0.7 },
	],
	modal: [
		{ kind: "rect", x: 34, y: 18, w: 92, h: 68, r: 12, o: 0.35 },
		{ kind: "rect", x: 48, y: 28, w: 64, h: 48, r: 10 },
	],
	"navigation-menu": [
		{ kind: "rect", x: 24, y: 28, w: 36, h: 16, r: 6 },
		{ kind: "rect", x: 66, y: 28, w: 36, h: 16, r: 6, o: 0.75 },
		{ kind: "rect", x: 108, y: 28, w: 28, h: 16, r: 6 },
		{ kind: "rect", x: 50, y: 52, w: 80, h: 36, r: 8, o: 0.45 },
	],
	"nav-link": [
		{ kind: "line", x1: 40, y1: 50, x2: 120, y2: 50, o: 0.45 },
		{ kind: "rect", x: 40, y: 44, w: 8, h: 12, r: 2, o: 0.7 },
	],
	"number-field": [
		{ kind: "rect", x: 36, y: 38, w: 88, h: 26, r: 10 },
		{ kind: "line", x1: 48, y1: 51, x2: 90, y2: 51, o: 0.35 },
		{ kind: "rect", x: 108, y: 40, w: 12, h: 10, r: 3, o: 0.45 },
		{ kind: "rect", x: 108, y: 52, w: 12, h: 10, r: 3, o: 0.45 },
	],
	"otp-field": [
		{ kind: "rect", x: 28, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 56, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 84, y: 38, w: 22, h: 28, r: 6 },
		{ kind: "rect", x: 112, y: 38, w: 22, h: 28, r: 6 },
	],
	"overlay-arrow": [
		{ kind: "rect", x: 50, y: 28, w: 60, h: 36, r: 8 },
		{ kind: "path", d: "M72 64 L80 78 L88 64", o: 0.75 },
	],
	pagination: [
		{ kind: "rect", x: 28, y: 40, w: 22, h: 22, r: 6 },
		{ kind: "rect", x: 56, y: 40, w: 22, h: 22, r: 6, o: 0.75 },
		{ kind: "rect", x: 84, y: 40, w: 22, h: 22, r: 6 },
		{ kind: "rect", x: 112, y: 40, w: 22, h: 22, r: 6 },
	],
	popover: [
		{ kind: "rect", x: 44, y: 22, w: 72, h: 48, r: 10 },
		{ kind: "path", d: "M72 70 L80 82 L88 70", o: 0.7 },
	],
	"progress-bar": [
		{ kind: "rect", x: 28, y: 44, w: 104, h: 14, r: 7, o: 0.35 },
		{ kind: "rect", x: 28, y: 44, w: 62, h: 14, r: 7, o: 0.75 },
	],
	"radio-group": [
		{ kind: "circle", cx: 44, cy: 30, r: 8 },
		{ kind: "circle", cx: 44, cy: 30, r: 3.5, solid: true },
		{ kind: "line", x1: 62, y1: 30, x2: 124, y2: 30, o: 0.35 },
		{ kind: "circle", cx: 44, cy: 52, r: 8 },
		{ kind: "line", x1: 62, y1: 52, x2: 118, y2: 52, o: 0.35 },
		{ kind: "circle", cx: 44, cy: 74, r: 8 },
		{ kind: "line", x1: 62, y1: 74, x2: 110, y2: 74, o: 0.35 },
	],
	"range-calendar": [
		{ kind: "rect", x: 36, y: 16, w: 88, h: 16, r: 6, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 40, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 52, r: 3.5, solid: true },
		{ kind: "circle", cx: 78, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 52, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 64, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 42, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 54, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 66, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 78, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 90, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 102, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "circle", cx: 114, cy: 76, r: 3.5, o: 0.45 },
		{ kind: "rect", x: 54, y: 48, w: 36, h: 8, r: 4, o: 0.35 },
	],
	resizable: [
		{ kind: "rect", x: 24, y: 24, w: 52, h: 56, r: 8 },
		{ kind: "rect", x: 84, y: 24, w: 52, h: 56, r: 8 },
		{ kind: "line", x1: 80, y1: 30, x2: 80, y2: 74, o: 0.55 },
	],
	"scroll-area": [
		{ kind: "rect", x: 40, y: 16, w: 80, h: 72, r: 10 },
		{ kind: "rect", x: 112, y: 28, w: 6, h: 40, r: 3, o: 0.55 },
	],
	"search-field": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 26, r: 13 },
		{ kind: "circle", cx: 46, cy: 51, r: 7, o: 0.55 },
		{ kind: "line", x1: 52, y1: 57, x2: 58, y2: 63, o: 0.55 },
		{ kind: "line", x1: 70, y1: 51, x2: 112, y2: 51, o: 0.3 },
	],
	section: [
		{ kind: "rect", x: 28, y: 20, w: 104, h: 64, r: 10, o: 0.35 },
		{ kind: "line", x1: 44, y1: 40, x2: 116, y2: 40, o: 0.4 },
		{ kind: "line", x1: 44, y1: 54, x2: 100, y2: 54, o: 0.3 },
	],
	select: [
		{ kind: "rect", x: 36, y: 38, w: 88, h: 26, r: 8 },
		{ kind: "path", d: "M108 46 L112 50 L116 46", o: 0.55 },
		{ kind: "line", x1: 48, y1: 51, x2: 90, y2: 51, o: 0.35 },
	],
	"selection-indicator": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 28, r: 8 },
		{ kind: "rect", x: 56, y: 46, w: 20, h: 12, r: 4, o: 0.85 },
	],
	"sentinel-row": [
		{ kind: "rect", x: 28, y: 38, w: 104, h: 24, r: 8, o: 0.35 },
		{ kind: "line", x1: 40, y1: 50, x2: 120, y2: 50, o: 0.25 },
	],
	separator: [{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, o: 0.45 }],
	"shared-element": [
		{ kind: "rect", x: 28, y: 28, w: 48, h: 48, r: 10, o: 0.45 },
		{ kind: "rect", x: 84, y: 28, w: 48, h: 48, r: 10 },
		{ kind: "circle", cx: 80, cy: 52, r: 8, o: 0.7, solid: true },
	],
	sheet: [
		{ kind: "rect", x: 28, y: 36, w: 104, h: 56, r: 12 },
		{ kind: "rect", x: 68, y: 44, w: 24, h: 4, r: 2, o: 0.5 },
		{ kind: "line", x1: 44, y1: 60, x2: 116, y2: 60, o: 0.3 },
	],
	"shortcut-list": [
		{ kind: "rect", x: 28, y: 22, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 31, x2: 90, y2: 31, o: 0.35 },
		{ kind: "rect", x: 108, y: 28, w: 16, h: 8, r: 3, o: 0.55 },
		{ kind: "rect", x: 28, y: 46, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 55, x2: 84, y2: 55, o: 0.35 },
		{ kind: "rect", x: 108, y: 52, w: 16, h: 8, r: 3, o: 0.55 },
		{ kind: "rect", x: 28, y: 70, w: 104, h: 18, r: 6 },
		{ kind: "line", x1: 40, y1: 79, x2: 96, y2: 79, o: 0.35 },
		{ kind: "rect", x: 108, y: 76, w: 16, h: 8, r: 3, o: 0.55 },
	],
	sidebar: [
		{ kind: "rect", x: 24, y: 16, w: 40, h: 72, r: 8 },
		{ kind: "line", x1: 34, y1: 32, x2: 54, y2: 32, o: 0.4 },
		{ kind: "line", x1: 34, y1: 46, x2: 54, y2: 46, o: 0.4 },
		{ kind: "line", x1: 34, y1: 60, x2: 50, y2: 60, o: 0.4 },
		{ kind: "rect", x: 72, y: 16, w: 64, h: 72, r: 8, o: 0.3 },
	],
	skeleton: [
		{ kind: "rect", x: 28, y: 28, w: 104, h: 14, r: 7, o: 0.45 },
		{ kind: "rect", x: 28, y: 50, w: 80, h: 14, r: 7, o: 0.4 },
		{ kind: "rect", x: 28, y: 72, w: 64, h: 14, r: 7, o: 0.35 },
	],
	slider: [
		{ kind: "line", x1: 28, y1: 50, x2: 132, y2: 50, o: 0.4 },
		{ kind: "circle", cx: 88, cy: 50, r: 9, solid: true },
	],
	spinner: [
		{ kind: "circle", cx: 80, cy: 50, r: 18, o: 0.25 },
		{ kind: "path", d: "M80 32 A18 18 0 0 1 98 50", o: 0.85 },
	],
	switch: [
		{ kind: "rect", x: 52, y: 40, w: 56, h: 22, r: 11 },
		{ kind: "circle", cx: 90, cy: 51, r: 8, solid: true },
	],
	table: [
		{ kind: "rect", x: 28, y: 20, w: 104, h: 64, r: 8 },
		{ kind: "line", x1: 28, y1: 36, x2: 132, y2: 36, o: 0.35 },
		{ kind: "line", x1: 28, y1: 52, x2: 132, y2: 52, o: 0.35 },
		{ kind: "line", x1: 28, y1: 68, x2: 132, y2: 68, o: 0.35 },
		{ kind: "line", x1: 62, y1: 20, x2: 62, y2: 84, o: 0.25 },
		{ kind: "line", x1: 98, y1: 20, x2: 98, y2: 84, o: 0.25 },
	],
	tabs: [
		{ kind: "rect", x: 28, y: 28, w: 32, h: 16, r: 6, o: 0.75 },
		{ kind: "rect", x: 64, y: 28, w: 32, h: 16, r: 6, o: 0.4 },
		{ kind: "rect", x: 100, y: 28, w: 32, h: 16, r: 6, o: 0.4 },
		{ kind: "rect", x: 28, y: 48, w: 104, h: 36, r: 8, o: 0.45 },
	],
	"tag-group": [
		{ kind: "rect", x: 24, y: 38, w: 36, h: 24, r: 12 },
		{ kind: "rect", x: 66, y: 38, w: 32, h: 24, r: 12 },
		{ kind: "rect", x: 104, y: 38, w: 36, h: 24, r: 12 },
	],
	text: [
		{ kind: "line", x1: 36, y1: 36, x2: 124, y2: 36, o: 0.4 },
		{ kind: "line", x1: 36, y1: 50, x2: 110, y2: 50, o: 0.35 },
		{ kind: "line", x1: 36, y1: 64, x2: 96, y2: 64, o: 0.3 },
	],
	textarea: [
		{ kind: "rect", x: 36, y: 24, w: 88, h: 56, r: 10 },
		{ kind: "line", x1: 48, y1: 40, x2: 108, y2: 40, o: 0.3 },
		{ kind: "line", x1: 48, y1: 52, x2: 100, y2: 52, o: 0.3 },
		{ kind: "line", x1: 48, y1: 64, x2: 88, y2: 64, o: 0.3 },
	],
	"text-field": [
		{ kind: "rect", x: 28, y: 32, w: 104, h: 20, r: 8 },
		{ kind: "line", x1: 40, y1: 42, x2: 96, y2: 42, o: 0.35 },
		{ kind: "line", x1: 36, y1: 62, x2: 90, y2: 62, o: 0.3 },
	],
	"time-field": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 24, r: 10 },
		{ kind: "line", x1: 56, y1: 52, x2: 72, y2: 52, o: 0.4 },
		{ kind: "circle", cx: 92, cy: 52, r: 2, o: 0.5, solid: true },
		{ kind: "circle", cx: 100, cy: 52, r: 2, o: 0.5, solid: true },
	],
	toast: [
		{ kind: "rect", x: 36, y: 36, w: 88, h: 32, r: 10 },
		{ kind: "line", x1: 50, y1: 48, x2: 100, y2: 48, o: 0.4 },
		{ kind: "line", x1: 50, y1: 58, x2: 84, y2: 58, o: 0.3 },
	],
	"toggle-button": [
		{ kind: "rect", x: 42, y: 38, w: 76, h: 24, r: 12 },
		{ kind: "line", x1: 58, y1: 50, x2: 102, y2: 50, o: 0.45 },
	],
	toolbar: [
		{ kind: "rect", x: 24, y: 38, w: 112, h: 26, r: 8 },
		{ kind: "rect", x: 34, y: 44, w: 16, h: 14, r: 4, o: 0.6 },
		{ kind: "rect", x: 56, y: 44, w: 16, h: 14, r: 4, o: 0.6 },
		{ kind: "rect", x: 78, y: 44, w: 16, h: 14, r: 4, o: 0.6 },
		{ kind: "rect", x: 108, y: 44, w: 20, h: 14, r: 4, o: 0.75 },
	],
	tooltip: [
		{ kind: "rect", x: 48, y: 30, w: 64, h: 28, r: 8 },
		{ kind: "path", d: "M72 58 L80 70 L88 58", o: 0.7 },
	],
	tree: [
		{ kind: "line", x1: 40, y1: 28, x2: 40, y2: 78, o: 0.3 },
		{ kind: "line", x1: 40, y1: 40, x2: 70, y2: 40, o: 0.3 },
		{ kind: "line", x1: 40, y1: 58, x2: 70, y2: 58, o: 0.3 },
		{ kind: "line", x1: 40, y1: 76, x2: 70, y2: 76, o: 0.3 },
		{ kind: "rect", x: 70, y: 32, w: 50, h: 16, r: 4 },
		{ kind: "rect", x: 70, y: 50, w: 50, h: 16, r: 4 },
		{ kind: "rect", x: 70, y: 68, w: 50, h: 16, r: 4 },
	],
	typeset: [
		{ kind: "line", x1: 36, y1: 30, x2: 80, y2: 30, o: 0.55 },
		{ kind: "line", x1: 36, y1: 46, x2: 124, y2: 46, o: 0.35 },
		{ kind: "line", x1: 36, y1: 58, x2: 118, y2: 58, o: 0.3 },
		{ kind: "line", x1: 36, y1: 70, x2: 100, y2: 70, o: 0.25 },
	],
	"youtube-embed": [
		{ kind: "rect", x: 36, y: 22, w: 88, h: 56, r: 12 },
		{ kind: "path", d: "M72 42 L92 50 L72 58 Z", o: 0.85 },
	],
};

/** A soft fallback when a slug has no hand-tuned silhouette yet. */
const FALLBACK: Shape[] = [{ kind: "rect", x: 40, y: 24, w: 80, h: 52, r: 12 }];

namespace UiComponentGlyph {
	export interface Props {
		/** Component slug, matching the reference URL segment. */
		slug: string;
	}
}

/** Opacity a shape carries, defaulting to full glass when unset. */
function opacityOf(shape: Shape): number {
	return shape.o ?? 1;
}

/**
 * Draws the frosted silhouette for one component. Unknown slugs get a plain glass card so
 * a new export still shows a face rather than an empty plane.
 */
export default function UiComponentGlyph(handle: Handle<UiComponentGlyph.Props>) {
	return () => {
		let shapes = GLYPHS[handle.props.slug] ?? FALLBACK;

		return (
			<svg
				viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
				role="presentation"
				focusable="false"
				mix={[absolute(), inset(0), is("100%"), bs("100%"), raw({ display: "block" })]}
			>
				{shapes.map((shape, index) => {
					let o = opacityOf(shape);

					if (shape.kind === "rect") {
						return (
							<rect
								key={index}
								x={shape.x}
								y={shape.y}
								width={shape.w}
								height={shape.h}
								rx={shape.r ?? 8}
								ry={shape.r ?? 8}
								fill={GLASS_FILL}
								stroke={GLASS_STROKE}
								strokeWidth="1"
								opacity={o}
							/>
						);
					}

					if (shape.kind === "circle") {
						return (
							<circle
								key={index}
								cx={shape.cx}
								cy={shape.cy}
								r={shape.r}
								fill={shape.solid ? SOLID_FILL : GLASS_FILL}
								stroke={GLASS_STROKE}
								strokeWidth="1"
								opacity={o}
							/>
						);
					}

					if (shape.kind === "line") {
						return (
							<line
								key={index}
								x1={shape.x1}
								y1={shape.y1}
								x2={shape.x2}
								y2={shape.y2}
								stroke={GLASS_STROKE}
								strokeWidth="2"
								strokeLinecap="round"
								opacity={o}
							/>
						);
					}

					return (
						<path
							key={index}
							d={shape.d}
							fill="none"
							stroke={GLASS_STROKE}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							opacity={o}
						/>
					);
				})}
			</svg>
		);
	};
}
