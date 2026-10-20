/**
 * Draws the explorer face each `@sdxc/ui` tile shows. Live frames clip inside a card;
 * these compact Apple HIG–style silhouettes stay legible at tile size — soft wash,
 * elevated surfaces, and the site's brand accent — rendered through `@sdxc/raster`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Raster } from "@sdxc/raster";

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
export const COMPONENT_FACE_VERSION = "6";

/** Material role a silhouette piece paints with. */
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
	/** Full stroke width in design space. */
	weight?: number;
}

interface PathShape {
	kind: "path";
	d: string;
	tone: Tone;
}

/**
 * An open M/L polyline painted as a thick round-capped stroke. Use this for checks and
 * chevrons — a filled open path reads as a wedge, not a mark.
 */
interface StrokeShape {
	kind: "stroke";
	d: string;
	tone: Tone;
	/** Full stroke width in design space. */
	weight?: number;
}

type Shape = RectShape | CircleShape | LineShape | PathShape | StrokeShape;

/** Quiet wash in the site's brand hue — materials stay secondary to the silhouette. */
const WASH = {
	from: color("oklch(0.975 0.006 275)"),
	mid: color("oklch(0.95 0.012 275)"),
	to: color("oklch(0.925 0.018 275)"),
};

/** Elevated white panel. */
const SURFACE = color("#ffffff");
/** Resting fill from the site's near-neutral ramp. */
const LABEL = color("oklch(0.91 0.01 275)");
/** Rules and marks. */
const INK = color("oklch(0.32 0.01 275)");
/** Primary action / selected state from `--ui-color-brand-600`. */
const ACCENT = color("oklch(0.52 0.17 275)");
/** Soft contact shadow under elevated surface pieces. */
const SHADOW = withAlpha(color("oklch(0.35 0.03 260)"), 0.12);

/** A soft fallback when a slug has no hand-tuned silhouette yet. */
const FALLBACK: Shape[] = [{ kind: "rect", x: 48, y: 28, w: 64, h: 44, r: 12, tone: "surface" }];

/** Catalogue of silhouettes keyed by component slug. */
const FACES: Record<string, Shape[]> = {
	accordion: [
		{ kind: "rect", x: 40, y: 22, w: 80, h: 16, r: 6, tone: "surface" },
		{ kind: "stroke", d: "M104.5 28.6 L108 31.8 L111.5 28.6", weight: 1.6, tone: "ink" },
		{ kind: "rect", x: 40, y: 42, w: 80, h: 16, r: 6, tone: "label" },
		{ kind: "rect", x: 40, y: 62, w: 80, h: 16, r: 6, tone: "label" },
	],
	alert: [
		{ kind: "rect", x: 40, y: 36, w: 80, h: 28, r: 10, tone: "surface" },
		{ kind: "circle", cx: 54, cy: 50, r: 6, tone: "accent" },
		{ kind: "line", x1: 68, y1: 46, x2: 108, y2: 46, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 68, y1: 54, x2: 98, y2: 54, tone: "label", weight: 1.6 },
	],
	"alert-dialog": [
		{ kind: "rect", x: 48, y: 20, w: 64, h: 60, r: 12, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 36, r: 7, tone: "accent" },
		{ kind: "line", x1: 58, y1: 52, x2: 102, y2: 52, tone: "label", weight: 1.6 },
		{ kind: "rect", x: 54, y: 62, w: 22, h: 10, r: 5, tone: "surface" },
		{ kind: "rect", x: 84, y: 62, w: 22, h: 10, r: 5, tone: "accent" },
	],
	"aspect-ratio": [
		{ kind: "rect", x: 52, y: 22, w: 56, h: 56, r: 8, tone: "surface" },
		{ kind: "line", x1: 60, y1: 34, x2: 100, y2: 34, tone: "label", weight: 1.5 },
		{ kind: "line", x1: 60, y1: 66, x2: 100, y2: 66, tone: "label", weight: 1.5 },
	],
	attachment: [
		{ kind: "rect", x: 44, y: 32, w: 72, h: 36, r: 10, tone: "surface" },
		{ kind: "rect", x: 52, y: 40, w: 22, h: 20, r: 4, tone: "label" },
		{ kind: "line", x1: 82, y1: 46, x2: 104, y2: 46, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 82, y1: 56, x2: 96, y2: 56, tone: "label", weight: 1.5 },
	],
	avatar: [
		{ kind: "circle", cx: 80, cy: 40, r: 14, tone: "surface" },
		{ kind: "rect", x: 58, y: 60, w: 44, h: 12, r: 6, tone: "label" },
	],
	badge: [
		{ kind: "rect", x: 60, y: 43, w: 40, h: 14, r: 7, tone: "label" },
		{ kind: "line", x1: 72, y1: 50, x2: 88, y2: 50, tone: "ink", weight: 1.5 },
	],
	breadcrumbs: [
		{ kind: "rect", x: 36, y: 44, w: 24, h: 12, r: 6, tone: "surface" },
		{ kind: "stroke", d: "M65.5 47.5 L68 50 L65.5 52.5", weight: 1.4, tone: "label" },
		{ kind: "rect", x: 73, y: 44, w: 24, h: 12, r: 6, tone: "surface" },
		{ kind: "stroke", d: "M102.5 47.5 L105 50 L102.5 52.5", weight: 1.4, tone: "label" },
		{ kind: "rect", x: 110, y: 44, w: 20, h: 12, r: 6, tone: "accent" },
	],
	bubble: [
		{
			kind: "path",
			d: "M64 34 H96 Q104 34 104 42 V52 Q104 60 96 60 H86 L80 65 L74 60 H64 Q56 60 56 52 V42 Q56 34 64 34 Z",
			tone: "surface",
		},
		{ kind: "line", x1: 66, y1: 44, x2: 94, y2: 44, tone: "ink", weight: 1.5 },
		{ kind: "line", x1: 66, y1: 52, x2: 86, y2: 52, tone: "label", weight: 1.4 },
	],
	button: [
		{ kind: "rect", x: 52, y: 40, w: 56, h: 20, r: 10, tone: "accent" },
		{ kind: "line", x1: 66, y1: 50, x2: 94, y2: 50, tone: "surface", weight: 1.8 },
	],
	calendar: [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 12, r: 6, tone: "surface" },
		{ kind: "line", x1: 56, y1: 24, x2: 104, y2: 24, tone: "ink", weight: 1.6 },
		{ kind: "circle", cx: 50.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 60.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 70.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 80.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 90.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 100.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 110.0, cy: 40, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 50.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 60.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 70.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 80.0, cy: 50, r: 2.6, tone: "accent" },
		{ kind: "circle", cx: 90.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 100.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 110.0, cy: 50, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 50.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 60.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 70.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 80.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 90.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 100.0, cy: 60, r: 2.6, tone: "label" },
		{ kind: "circle", cx: 110.0, cy: 60, r: 2.6, tone: "label" },
	],
	card: [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 12, tone: "surface" },
		{ kind: "rect", x: 56, y: 30, w: 48, h: 22, r: 6, tone: "label" },
		{ kind: "line", x1: 56, y1: 60, x2: 104, y2: 60, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 56, y1: 68, x2: 92, y2: 68, tone: "label", weight: 1.5 },
	],
	carousel: [
		{ kind: "rect", x: 32, y: 30, w: 28, h: 40, r: 8, tone: "label" },
		{ kind: "rect", x: 56, y: 26, w: 48, h: 48, r: 10, tone: "surface" },
		{ kind: "rect", x: 100, y: 30, w: 28, h: 40, r: 8, tone: "label" },
	],
	chart: [
		{ kind: "rect", x: 44, y: 64, w: 10, h: 12, r: 3, tone: "accent" },
		{ kind: "rect", x: 60, y: 48, w: 10, h: 28, r: 3, tone: "accent" },
		{ kind: "rect", x: 76, y: 36, w: 10, h: 40, r: 3, tone: "accent" },
		{ kind: "rect", x: 92, y: 52, w: 10, h: 24, r: 3, tone: "accent" },
		{ kind: "rect", x: 108, y: 30, w: 10, h: 46, r: 3, tone: "accent" },
	],
	checkbox: [
		{ kind: "rect", x: 48, y: 43, w: 14, h: 14, r: 3.5, tone: "accent" },
		{ kind: "stroke", d: "M51.2 50.2 L53.8 52.6 L58.8 47.2", weight: 1.6, tone: "surface" },
		{ kind: "line", x1: 70, y1: 50, x2: 112, y2: 50, tone: "ink", weight: 1.6 },
	],
	"checkbox-group": [
		{ kind: "rect", x: 48, y: 28, w: 12, h: 12, r: 3, tone: "accent" },
		{ kind: "stroke", d: "M50.8 34.2 L53 36.2 L57.2 31.6", weight: 1.4, tone: "surface" },
		{ kind: "line", x1: 68, y1: 34, x2: 112, y2: 34, tone: "ink", weight: 1.5 },
		{ kind: "rect", x: 48, y: 44, w: 12, h: 12, r: 3, tone: "surface" },
		{ kind: "line", x1: 68, y1: 50, x2: 108, y2: 50, tone: "label", weight: 1.5 },
		{ kind: "rect", x: 48, y: 60, w: 12, h: 12, r: 3, tone: "surface" },
		{ kind: "line", x1: 68, y1: 66, x2: 104, y2: 66, tone: "label", weight: 1.5 },
	],
	"color-area": [
		{ kind: "rect", x: 54, y: 26, w: 52, h: 48, r: 10, tone: "accent" },
		{ kind: "circle", cx: 70, cy: 58, r: 4, tone: "surface" },
	],
	"color-field": [
		{ kind: "rect", x: 44, y: 40, w: 72, h: 20, r: 8, tone: "surface" },
		{ kind: "rect", x: 52, y: 45, w: 10, h: 10, r: 3, tone: "accent" },
		{ kind: "line", x1: 70, y1: 50, x2: 104, y2: 50, tone: "label", weight: 1.5 },
	],
	"color-picker": [
		{ kind: "rect", x: 50, y: 30, w: 40, h: 40, r: 10, tone: "accent" },
		{ kind: "rect", x: 98, y: 30, w: 8, h: 12, r: 3, tone: "surface" },
		{ kind: "rect", x: 98, y: 44, w: 8, h: 12, r: 3, tone: "label" },
		{ kind: "rect", x: 98, y: 58, w: 8, h: 12, r: 3, tone: "accent" },
	],
	"color-slider": [
		{ kind: "rect", x: 44, y: 46, w: 72, h: 8, r: 4, tone: "accent" },
		{ kind: "circle", cx: 96, cy: 50, r: 6, tone: "surface" },
	],
	"color-swatch": [{ kind: "rect", x: 66, y: 36, w: 28, h: 28, r: 8, tone: "accent" }],
	"color-swatch-picker": [
		{ kind: "rect", x: 49, y: 30, w: 16, h: 16, r: 4, tone: "accent" },
		{ kind: "rect", x: 72, y: 30, w: 16, h: 16, r: 4, tone: "surface" },
		{ kind: "rect", x: 95, y: 30, w: 16, h: 16, r: 4, tone: "label" },
		{ kind: "rect", x: 49, y: 54, w: 16, h: 16, r: 4, tone: "label" },
		{ kind: "rect", x: 72, y: 54, w: 16, h: 16, r: 4, tone: "surface" },
		{ kind: "rect", x: 95, y: 54, w: 16, h: 16, r: 4, tone: "accent" },
	],
	"color-wheel": [
		{ kind: "circle", cx: 80, cy: 50, r: 20, tone: "accent" },
		{ kind: "circle", cx: 80, cy: 50, r: 9, tone: "surface" },
		{ kind: "circle", cx: 94, cy: 40, r: 3.5, tone: "surface" },
	],
	combobox: [
		{ kind: "rect", x: 40, y: 24, w: 80, h: 18, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 33, x2: 96, y2: 33, tone: "ink", weight: 1.5 },
		{ kind: "stroke", d: "M104 30.8 L108 34.2 L112 30.8", weight: 1.5, tone: "ink" },
		{ kind: "rect", x: 40, y: 48, w: 80, h: 30, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 58, x2: 104, y2: 58, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 50, y1: 68, x2: 94, y2: 68, tone: "label", weight: 1.4 },
	],
	command: [
		{ kind: "rect", x: 44, y: 20, w: 72, h: 60, r: 12, tone: "surface" },
		{ kind: "rect", x: 52, y: 28, w: 56, h: 14, r: 6, tone: "label" },
		{ kind: "line", x1: 56, y1: 54, x2: 104, y2: 54, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 56, y1: 66, x2: 92, y2: 66, tone: "label", weight: 1.5 },
	],
	confirm: [
		{ kind: "rect", x: 48, y: 20, w: 64, h: 60, r: 12, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 36, r: 7, tone: "accent" },
		{ kind: "line", x1: 58, y1: 52, x2: 102, y2: 52, tone: "label", weight: 1.6 },
		{ kind: "rect", x: 54, y: 62, w: 22, h: 10, r: 5, tone: "surface" },
		{ kind: "rect", x: 84, y: 62, w: 22, h: 10, r: 5, tone: "accent" },
	],
	"context-menu": [
		{ kind: "rect", x: 52, y: 20, w: 56, h: 60, r: 10, tone: "surface" },
		{ kind: "line", x1: 62, y1: 34, x2: 98, y2: 34, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 62, y1: 46, x2: 92, y2: 46, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 62, y1: 58, x2: 98, y2: 58, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 62, y1: 70, x2: 86, y2: 70, tone: "label", weight: 1.6 },
	],
	"date-field": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 78, y2: 50, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 84, y1: 50, x2: 110, y2: 50, tone: "label", weight: 1.8 },
	],
	"date-picker": [
		{ kind: "rect", x: 44, y: 16, w: 72, h: 16, r: 7, tone: "surface" },
		{ kind: "line", x1: 54, y1: 24, x2: 96, y2: 24, tone: "ink", weight: 1.6 },
		{ kind: "stroke", d: "M100.5 22.6 L104 25.8 L107.5 22.6", weight: 1.5, tone: "ink" },
		{ kind: "circle", cx: 53, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 71, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 89, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 98, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 53, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 71, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 51, r: 2.4, tone: "accent" },
		{ kind: "circle", cx: 89, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 98, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 53, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 71, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 89, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 98, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 60, r: 2.4, tone: "label" },
	],
	"date-range-picker": [
		{ kind: "rect", x: 36, y: 16, w: 40, h: 14, r: 6, tone: "surface" },
		{ kind: "rect", x: 84, y: 16, w: 40, h: 14, r: 6, tone: "surface" },
		{ kind: "line", x1: 44, y1: 23, x2: 68, y2: 23, tone: "ink", weight: 1.5 },
		{ kind: "line", x1: 92, y1: 23, x2: 116, y2: 23, tone: "ink", weight: 1.5 },
		{ kind: "circle", cx: 53, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 71, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 89, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 98, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 42, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 53, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 51, r: 2.4, tone: "accent" },
		{ kind: "circle", cx: 89, cy: 51, r: 2.4, tone: "accent" },
		{ kind: "circle", cx: 98, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 51, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 53, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 62, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 71, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 89, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 98, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 107, cy: 60, r: 2.4, tone: "label" },
		{ kind: "rect", x: 58.6, y: 47.6, w: 33.8, h: 6.8, r: 3.4, tone: "accent" },
	],
	description: [
		{ kind: "line", x1: 44, y1: 42, x2: 116, y2: 42, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 44, y1: 54, x2: 104, y2: 54, tone: "label", weight: 1.8 },
	],
	dialog: [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 12, tone: "surface" },
		{ kind: "line", x1: 58, y1: 36, x2: 102, y2: 36, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 58, y1: 46, x2: 90, y2: 46, tone: "label", weight: 1.6 },
		{ kind: "rect", x: 58, y: 58, w: 24, h: 10, r: 5, tone: "accent" },
	],
	disclosure: [
		{ kind: "stroke", d: "M44.4 46 L48.0 50 L44.4 54", weight: 1.8, tone: "ink" },
		{ kind: "line", x1: 58, y1: 50, x2: 118, y2: 50, tone: "ink", weight: 2.0 },
	],
	drawer: [
		{ kind: "rect", x: 72, y: 16, w: 56, h: 68, r: 12, tone: "surface" },
		{ kind: "line", x1: 84, y1: 32, x2: 116, y2: 32, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 84, y1: 44, x2: 108, y2: 44, tone: "label", weight: 1.6 },
	],
	"drop-indicator": [
		{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50, tone: "accent", weight: 2.2 },
		{ kind: "circle", cx: 80, cy: 50, r: 3.5, tone: "surface" },
	],
	"drop-zone": [
		{ kind: "rect", x: 44, y: 26, w: 72, h: 48, r: 12, tone: "label" },
		{ kind: "line", x1: 80, y1: 40, x2: 80, y2: 60, tone: "ink", weight: 2.0 },
		{ kind: "line", x1: 70, y1: 50, x2: 90, y2: 50, tone: "ink", weight: 2.0 },
	],
	empty: [
		{ kind: "rect", x: 52, y: 26, w: 56, h: 40, r: 10, tone: "surface" },
		{ kind: "line", x1: 66, y1: 74, x2: 94, y2: 74, tone: "label", weight: 1.5 },
	],
	"field-error": [
		{ kind: "rect", x: 44, y: 30, w: 72, h: 18, r: 8, tone: "surface" },
		{ kind: "line", x1: 54, y1: 39, x2: 100, y2: 39, tone: "label", weight: 1.5 },
		{ kind: "line", x1: 44, y1: 54, x2: 116, y2: 54, tone: "accent", weight: 1.8 },
		{ kind: "line", x1: 44, y1: 64, x2: 78, y2: 64, tone: "accent", weight: 1.5 },
	],
	"file-trigger": [
		{ kind: "rect", x: 48, y: 28, w: 64, h: 44, r: 10, tone: "surface" },
		{ kind: "line", x1: 80, y1: 40, x2: 80, y2: 56, tone: "ink", weight: 2.0 },
		{ kind: "line", x1: 72, y1: 48, x2: 88, y2: 48, tone: "ink", weight: 2.0 },
	],
	form: [
		{ kind: "rect", x: 44, y: 24, w: 72, h: 14, r: 6, tone: "surface" },
		{ kind: "rect", x: 44, y: 44, w: 72, h: 14, r: 6, tone: "surface" },
		{ kind: "rect", x: 44, y: 64, w: 40, h: 14, r: 6, tone: "accent" },
	],
	"grid-list": [
		{ kind: "rect", x: 40, y: 24, w: 36, h: 24, r: 6, tone: "surface" },
		{ kind: "rect", x: 84, y: 24, w: 36, h: 24, r: 6, tone: "surface" },
		{ kind: "rect", x: 40, y: 56, w: 36, h: 24, r: 6, tone: "surface" },
		{ kind: "rect", x: 84, y: 56, w: 36, h: 24, r: 6, tone: "accent" },
	],
	group: [
		{ kind: "rect", x: 40, y: 28, w: 80, h: 44, r: 10, tone: "label" },
		{ kind: "rect", x: 52, y: 40, w: 56, h: 20, r: 8, tone: "surface" },
	],
	header: [
		{ kind: "rect", x: 36, y: 34, w: 88, h: 16, r: 6, tone: "surface" },
		{ kind: "line", x1: 46, y1: 42, x2: 100, y2: 42, tone: "ink", weight: 1.6 },
	],
	heading: [
		{ kind: "line", x1: 44, y1: 40, x2: 116, y2: 40, tone: "ink", weight: 3.0 },
		{ kind: "line", x1: 44, y1: 56, x2: 96, y2: 56, tone: "label", weight: 1.8 },
	],
	"heading-scope": [
		{ kind: "line", x1: 44, y1: 40, x2: 116, y2: 40, tone: "ink", weight: 3.0 },
		{ kind: "line", x1: 44, y1: 56, x2: 96, y2: 56, tone: "label", weight: 1.8 },
	],
	highlight: [
		{ kind: "rect", x: 48, y: 42, w: 64, h: 16, r: 4, tone: "accent" },
		{ kind: "line", x1: 56, y1: 50, x2: 104, y2: 50, tone: "ink", weight: 1.8 },
	],
	"hover-card": [
		{ kind: "rect", x: 48, y: 26, w: 64, h: 48, r: 12, tone: "surface" },
		{ kind: "line", x1: 58, y1: 42, x2: 102, y2: 42, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 58, y1: 54, x2: 92, y2: 54, tone: "label", weight: 1.6 },
	],
	"image-placeholder": [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 10, tone: "label" },
		{ kind: "path", d: "M56 64 L72 44 L86 56 L96 48 L112 64 Z", tone: "surface" },
		{ kind: "circle", cx: 68, cy: 36, r: 4, tone: "surface" },
	],
	input: [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 100, y2: 50, tone: "label", weight: 1.8 },
	],
	item: [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 100, y2: 50, tone: "label", weight: 1.8 },
	],
	keyboard: [
		{ kind: "rect", x: 44, y: 36, w: 20, h: 20, r: 5, tone: "surface" },
		{ kind: "rect", x: 70, y: 36, w: 20, h: 20, r: 5, tone: "surface" },
		{ kind: "rect", x: 96, y: 36, w: 20, h: 20, r: 5, tone: "surface" },
	],
	label: [{ kind: "line", x1: 52, y1: 50, x2: 108, y2: 50, tone: "ink", weight: 2.0 }],
	link: [
		{ kind: "line", x1: 56, y1: 48, x2: 104, y2: 48, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 56, y1: 54, x2: 104, y2: 54, tone: "accent", weight: 1.4 },
	],
	"link-button": [
		{ kind: "rect", x: 52, y: 40, w: 56, h: 20, r: 10, tone: "accent" },
		{ kind: "line", x1: 66, y1: 50, x2: 94, y2: 50, tone: "surface", weight: 1.8 },
	],
	listbox: [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 10, tone: "surface" },
		{ kind: "rect", x: 54, y: 30, w: 52, h: 14, r: 5, tone: "accent" },
		{ kind: "line", x1: 62, y1: 52, x2: 98, y2: 52, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 62, y1: 64, x2: 90, y2: 64, tone: "label", weight: 1.6 },
	],
	logo: [{ kind: "rect", x: 56, y: 34, w: 48, h: 32, r: 10, tone: "accent" }],
	marker: [
		{ kind: "circle", cx: 52, cy: 50, r: 5, tone: "accent" },
		{ kind: "line", x1: 66, y1: 50, x2: 118, y2: 50, tone: "ink", weight: 2.0 },
	],
	menu: [
		{ kind: "rect", x: 52, y: 20, w: 56, h: 60, r: 10, tone: "surface" },
		{ kind: "line", x1: 62, y1: 34, x2: 98, y2: 34, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 62, y1: 46, x2: 92, y2: 46, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 62, y1: 58, x2: 98, y2: 58, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 62, y1: 70, x2: 86, y2: 70, tone: "label", weight: 1.6 },
	],
	menubar: [
		{ kind: "rect", x: 36, y: 28, w: 22, h: 14, r: 5, tone: "accent" },
		{ kind: "rect", x: 62, y: 28, w: 22, h: 14, r: 5, tone: "label" },
		{ kind: "rect", x: 88, y: 28, w: 22, h: 14, r: 5, tone: "label" },
		{ kind: "rect", x: 44, y: 48, w: 56, h: 32, r: 8, tone: "surface" },
		{ kind: "line", x1: 54, y1: 58, x2: 90, y2: 58, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 54, y1: 68, x2: 82, y2: 68, tone: "label", weight: 1.5 },
	],
	message: [
		{ kind: "rect", x: 40, y: 34, w: 80, h: 32, r: 12, tone: "surface" },
		{ kind: "line", x1: 52, y1: 46, x2: 104, y2: 46, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 52, y1: 56, x2: 88, y2: 56, tone: "label", weight: 1.5 },
	],
	"message-scroller": [
		{ kind: "rect", x: 40, y: 24, w: 52, h: 14, r: 7, tone: "surface" },
		{ kind: "rect", x: 68, y: 44, w: 52, h: 14, r: 7, tone: "label" },
		{ kind: "rect", x: 40, y: 64, w: 52, h: 14, r: 7, tone: "label" },
	],
	meter: [
		{ kind: "rect", x: 40, y: 46, w: 80, h: 8, r: 4, tone: "label" },
		{ kind: "rect", x: 40, y: 46, w: 52, h: 8, r: 4, tone: "accent" },
	],
	modal: [
		{ kind: "rect", x: 48, y: 22, w: 64, h: 56, r: 12, tone: "surface" },
		{ kind: "line", x1: 58, y1: 36, x2: 102, y2: 36, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 58, y1: 46, x2: 90, y2: 46, tone: "label", weight: 1.6 },
		{ kind: "rect", x: 58, y: 58, w: 24, h: 10, r: 5, tone: "accent" },
	],
	"navigation-menu": [
		{ kind: "rect", x: 36, y: 40, w: 24, h: 16, r: 6, tone: "surface" },
		{ kind: "rect", x: 66, y: 40, w: 24, h: 16, r: 6, tone: "accent" },
		{ kind: "rect", x: 96, y: 40, w: 24, h: 16, r: 6, tone: "surface" },
	],
	"nav-link": [
		{ kind: "line", x1: 48, y1: 50, x2: 100, y2: 50, tone: "accent", weight: 2.0 },
		{ kind: "line", x1: 48, y1: 54, x2: 100, y2: 54, tone: "accent", weight: 1.4 },
	],
	"number-field": [
		{ kind: "rect", x: 40, y: 40, w: 56, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 84, y2: 50, tone: "label", weight: 1.8 },
		{ kind: "rect", x: 102, y: 40, w: 16, h: 8, r: 3, tone: "label" },
		{ kind: "rect", x: 102, y: 52, w: 16, h: 8, r: 3, tone: "label" },
	],
	"otp-field": [
		{ kind: "rect", x: 38, y: 40, w: 18, h: 20, r: 6, tone: "surface" },
		{ kind: "rect", x: 60, y: 40, w: 18, h: 20, r: 6, tone: "surface" },
		{ kind: "rect", x: 82, y: 40, w: 18, h: 20, r: 6, tone: "accent" },
		{ kind: "rect", x: 104, y: 40, w: 18, h: 20, r: 6, tone: "surface" },
	],
	"overlay-arrow": [
		{
			kind: "path",
			d: "M70 36 H90 Q98 36 98 44 V48 Q98 54 90 54 H86 L80 60 L74 54 H70 Q62 54 62 48 V44 Q62 36 70 36 Z",
			tone: "surface",
		},
	],
	pagination: [
		{ kind: "rect", x: 40, y: 40, w: 16, h: 16, r: 5, tone: "label" },
		{ kind: "rect", x: 62, y: 40, w: 16, h: 16, r: 5, tone: "accent" },
		{ kind: "rect", x: 84, y: 40, w: 16, h: 16, r: 5, tone: "label" },
		{ kind: "rect", x: 106, y: 40, w: 16, h: 16, r: 5, tone: "label" },
	],
	popover: [
		{
			kind: "path",
			d: "M64 30 H96 Q106 30 106 40 V52 Q106 62 96 62 H86 L80 68 L74 62 H64 Q54 62 54 52 V40 Q54 30 64 30 Z",
			tone: "surface",
		},
		{ kind: "line", x1: 66, y1: 42, x2: 94, y2: 42, tone: "ink", weight: 1.5 },
		{ kind: "line", x1: 66, y1: 52, x2: 86, y2: 52, tone: "label", weight: 1.4 },
	],
	"progress-bar": [
		{ kind: "rect", x: 40, y: 46, w: 80, h: 8, r: 4, tone: "label" },
		{ kind: "rect", x: 40, y: 46, w: 52, h: 8, r: 4, tone: "accent" },
	],
	"radio-group": [
		{ kind: "circle", cx: 54, cy: 34, r: 6, tone: "surface" },
		{ kind: "circle", cx: 54, cy: 34, r: 3, tone: "accent" },
		{ kind: "line", x1: 68, y1: 34, x2: 112, y2: 34, tone: "ink", weight: 1.5 },
		{ kind: "circle", cx: 54, cy: 50, r: 6, tone: "surface" },
		{ kind: "line", x1: 68, y1: 50, x2: 108, y2: 50, tone: "label", weight: 1.5 },
		{ kind: "circle", cx: 54, cy: 66, r: 6, tone: "surface" },
		{ kind: "line", x1: 68, y1: 66, x2: 104, y2: 66, tone: "label", weight: 1.5 },
	],
	"range-calendar": [
		{ kind: "rect", x: 44, y: 18, w: 72, h: 12, r: 6, tone: "surface" },
		{ kind: "line", x1: 56, y1: 24, x2: 104, y2: 24, tone: "ink", weight: 1.5 },
		{ kind: "rect", x: 57.4, y: 46.4, w: 35.2, h: 7.2, r: 3.6, tone: "accent" },
		{ kind: "circle", cx: 50, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 60, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 70, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 90, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 100, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 110, cy: 40, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 50, cy: 50, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 60, cy: 50, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 70, cy: 50, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 50, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 90, cy: 50, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 100, cy: 50, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 110, cy: 50, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 50, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 60, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 70, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 80, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 90, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 100, cy: 60, r: 2.4, tone: "label" },
		{ kind: "circle", cx: 110, cy: 60, r: 2.4, tone: "label" },
	],
	resizable: [
		{ kind: "rect", x: 38, y: 28, w: 36, h: 44, r: 8, tone: "surface" },
		{ kind: "rect", x: 86, y: 28, w: 36, h: 44, r: 8, tone: "label" },
		{ kind: "line", x1: 80, y1: 32, x2: 80, y2: 68, tone: "accent", weight: 2.0 },
	],
	"scroll-area": [
		{ kind: "rect", x: 52, y: 24, w: 56, h: 52, r: 10, tone: "surface" },
		{ kind: "rect", x: 98, y: 36, w: 3, h: 24, r: 1.5, tone: "accent" },
	],
	"search-field": [
		{ kind: "rect", x: 44, y: 40, w: 72, h: 20, r: 10, tone: "surface" },
		{ kind: "circle", cx: 56, cy: 50, r: 3.5, tone: "label" },
		{ kind: "line", x1: 58.8, y1: 52.8, x2: 62, y2: 56, tone: "label", weight: 1.5 },
		{ kind: "line", x1: 68, y1: 50, x2: 104, y2: 50, tone: "label", weight: 1.5 },
	],
	section: [
		{ kind: "line", x1: 40, y1: 36, x2: 120, y2: 36, tone: "ink", weight: 2.0 },
		{ kind: "line", x1: 40, y1: 52, x2: 108, y2: 52, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 40, y1: 64, x2: 96, y2: 64, tone: "label", weight: 1.8 },
	],
	select: [
		{ kind: "rect", x: 44, y: 40, w: 72, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 54, y1: 50, x2: 94, y2: 50, tone: "ink", weight: 1.5 },
		{ kind: "stroke", d: "M102 47.8 L106 51.2 L110 47.8", weight: 1.5, tone: "ink" },
	],
	"selection-indicator": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 8, tone: "surface" },
		{ kind: "rect", x: 54, y: 44, w: 20, h: 12, r: 5, tone: "accent" },
	],
	"sentinel-row": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "label" },
		{ kind: "line", x1: 52, y1: 50, x2: 108, y2: 50, tone: "label", weight: 1.6 },
	],
	separator: [{ kind: "line", x1: 44, y1: 50, x2: 116, y2: 50, tone: "label", weight: 1.5 }],
	"shared-element": [
		{ kind: "rect", x: 40, y: 32, w: 36, h: 36, r: 10, tone: "label" },
		{ kind: "rect", x: 84, y: 32, w: 36, h: 36, r: 10, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 50, r: 6, tone: "accent" },
	],
	sheet: [
		{ kind: "rect", x: 40, y: 36, w: 80, h: 48, r: 14, tone: "surface" },
		{ kind: "line", x1: 72, y1: 44, x2: 88, y2: 44, tone: "label", weight: 2.0 },
		{ kind: "line", x1: 52, y1: 58, x2: 108, y2: 58, tone: "ink", weight: 1.8 },
	],
	"shortcut-list": [
		{ kind: "line", x1: 40, y1: 36, x2: 90, y2: 36, tone: "ink", weight: 1.8 },
		{ kind: "rect", x: 100, y: 30, w: 20, h: 12, r: 4, tone: "label" },
		{ kind: "line", x1: 40, y1: 56, x2: 84, y2: 56, tone: "ink", weight: 1.8 },
		{ kind: "rect", x: 100, y: 50, w: 20, h: 12, r: 4, tone: "label" },
		{ kind: "line", x1: 40, y1: 76, x2: 96, y2: 76, tone: "ink", weight: 1.8 },
		{ kind: "rect", x: 100, y: 70, w: 20, h: 12, r: 4, tone: "label" },
	],
	sidebar: [
		{ kind: "rect", x: 40, y: 24, w: 28, h: 52, r: 8, tone: "surface" },
		{ kind: "rect", x: 46, y: 32, w: 16, h: 8, r: 3, tone: "accent" },
		{ kind: "line", x1: 48, y1: 50, x2: 60, y2: 50, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 48, y1: 60, x2: 60, y2: 60, tone: "label", weight: 1.4 },
		{ kind: "rect", x: 76, y: 24, w: 44, h: 52, r: 8, tone: "label" },
	],
	skeleton: [
		{ kind: "rect", x: 44, y: 30, w: 72, h: 12, r: 5, tone: "label" },
		{ kind: "rect", x: 44, y: 48, w: 56, h: 12, r: 5, tone: "label" },
		{ kind: "rect", x: 44, y: 66, w: 64, h: 12, r: 5, tone: "label" },
	],
	slider: [
		{ kind: "line", x1: 40, y1: 50, x2: 120, y2: 50, tone: "label", weight: 3.0 },
		{ kind: "line", x1: 40, y1: 50, x2: 88, y2: 50, tone: "accent", weight: 3.0 },
		{ kind: "circle", cx: 88, cy: 50, r: 7, tone: "surface" },
	],
	spinner: [
		{
			kind: "stroke",
			d: "M91.3 41.8 L93.7 46.9 L93.8 52.6 L91.6 57.9 L87.5 61.8 L82.2 63.8 L76.5 63.6 L71.4 61.1 L67.7 56.7 L66.1 51.3 L66.7 45.7",
			weight: 2.8,
			tone: "accent",
		},
	],
	switch: [
		{ kind: "rect", x: 56, y: 40, w: 48, h: 20, r: 10, tone: "accent" },
		{ kind: "circle", cx: 92, cy: 50, r: 7, tone: "surface" },
	],
	table: [
		{ kind: "rect", x: 40, y: 24, w: 80, h: 52, r: 8, tone: "surface" },
		{ kind: "line", x1: 40, y1: 40, x2: 120, y2: 40, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 40, y1: 54, x2: 120, y2: 54, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 66, y1: 24, x2: 66, y2: 76, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 94, y1: 24, x2: 94, y2: 76, tone: "label", weight: 1.4 },
	],
	tabs: [
		{ kind: "rect", x: 40, y: 28, w: 24, h: 14, r: 6, tone: "accent" },
		{ kind: "rect", x: 68, y: 28, w: 24, h: 14, r: 6, tone: "label" },
		{ kind: "rect", x: 96, y: 28, w: 24, h: 14, r: 6, tone: "label" },
		{ kind: "rect", x: 40, y: 46, w: 80, h: 28, r: 8, tone: "surface" },
	],
	"tag-group": [
		{ kind: "rect", x: 36, y: 42, w: 28, h: 16, r: 8, tone: "surface" },
		{ kind: "rect", x: 68, y: 42, w: 28, h: 16, r: 8, tone: "surface" },
		{ kind: "rect", x: 100, y: 42, w: 28, h: 16, r: 8, tone: "accent" },
	],
	text: [
		{ kind: "line", x1: 48, y1: 40, x2: 112, y2: 40, tone: "ink", weight: 2.0 },
		{ kind: "line", x1: 48, y1: 52, x2: 100, y2: 52, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 48, y1: 64, x2: 88, y2: 64, tone: "label", weight: 1.8 },
	],
	textarea: [
		{ kind: "rect", x: 44, y: 28, w: 72, h: 44, r: 10, tone: "surface" },
		{ kind: "line", x1: 54, y1: 40, x2: 104, y2: 40, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 54, y1: 50, x2: 96, y2: 50, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 54, y1: 60, x2: 88, y2: 60, tone: "label", weight: 1.8 },
	],
	"text-field": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 100, y2: 50, tone: "label", weight: 1.8 },
	],
	"time-field": [
		{ kind: "rect", x: 40, y: 40, w: 80, h: 20, r: 8, tone: "surface" },
		{ kind: "line", x1: 50, y1: 50, x2: 78, y2: 50, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 84, y1: 50, x2: 110, y2: 50, tone: "label", weight: 1.8 },
	],
	toast: [
		{ kind: "rect", x: 44, y: 38, w: 72, h: 24, r: 10, tone: "surface" },
		{ kind: "line", x1: 56, y1: 50, x2: 104, y2: 50, tone: "ink", weight: 1.8 },
	],
	"toggle-button": [
		{ kind: "rect", x: 48, y: 38, w: 64, h: 24, r: 12, tone: "accent" },
		{ kind: "line", x1: 62, y1: 50, x2: 98, y2: 50, tone: "surface", weight: 2.0 },
	],
	toolbar: [
		{ kind: "rect", x: 36, y: 40, w: 18, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 58, y: 40, w: 18, h: 18, r: 5, tone: "surface" },
		{ kind: "rect", x: 80, y: 40, w: 18, h: 18, r: 5, tone: "accent" },
		{ kind: "rect", x: 102, y: 40, w: 18, h: 18, r: 5, tone: "surface" },
	],
	tooltip: [
		{
			kind: "path",
			d: "M64 32 H96 Q108 32 108 44 V48 Q108 60 96 60 H86.0 L80.0 66 L74.0 60 H64 Q52 60 52 48 V44 Q52 32 64 32 Z",
			tone: "surface",
		},
		{ kind: "line", x1: 62, y1: 46, x2: 98, y2: 46, tone: "ink", weight: 1.8 },
	],
	tree: [
		{ kind: "stroke", d: "M39 30.8 L42 33.5 L45 30.8", weight: 1.4, tone: "ink" },
		{ kind: "line", x1: 52, y1: 32, x2: 116, y2: 32, tone: "ink", weight: 1.8 },
		{ kind: "line", x1: 60, y1: 48, x2: 116, y2: 48, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 60, y1: 64, x2: 104, y2: 64, tone: "label", weight: 1.6 },
	],
	typeset: [
		{ kind: "line", x1: 44, y1: 32, x2: 80, y2: 32, tone: "ink", weight: 2.4 },
		{ kind: "line", x1: 44, y1: 46, x2: 116, y2: 46, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 44, y1: 58, x2: 108, y2: 58, tone: "label", weight: 1.8 },
		{ kind: "line", x1: 44, y1: 70, x2: 92, y2: 70, tone: "label", weight: 1.8 },
	],
	"youtube-embed": [
		{ kind: "rect", x: 48, y: 26, w: 64, h: 48, r: 12, tone: "surface" },
		{ kind: "path", d: "M70 42 L94 50 L70 58 Z", tone: "accent" },
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
				[0.55, WASH.mid],
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
			canvas.fillPath(Path.roundedRect(x, y + 1.5 * SCALE, w, h, r), SHADOW);
		}
		canvas.fillPath(Path.roundedRect(x, y, w, h, r), paint);
		return;
	}

	if (shape.kind === "circle") {
		let x = (shape.cx - shape.r) * SCALE;
		let y = (shape.cy - shape.r) * SCALE;
		let size = shape.r * 2 * SCALE;
		if (shape.tone === "surface") {
			canvas.fillPath(Path.roundedRect(x, y + 1.5 * SCALE, size, size, size), SHADOW);
		}
		canvas.fillPath(Path.roundedRect(x, y, size, size, size), paint);
		return;
	}

	if (shape.kind === "line") {
		drawCapsule(
			canvas,
			shape.x1 * SCALE,
			shape.y1 * SCALE,
			shape.x2 * SCALE,
			shape.y2 * SCALE,
			((shape.weight ?? 2) * SCALE) / 2,
			paint,
		);
		return;
	}

	if (shape.kind === "stroke") {
		drawStroke(canvas, shape);
		return;
	}

	let path = Path.fromSVG(shape.d, { transform: [SCALE, 0, 0, SCALE, 0, 0] });
	if (shape.tone === "surface") {
		canvas.fillPath(
			Path.fromSVG(shape.d, { transform: [SCALE, 0, 0, SCALE, 0, 1.5 * SCALE] }),
			SHADOW,
		);
	}
	canvas.fillPath(path, paint);
}

/**
 * A round-capped polyline stroke so checks and chevrons stay legible at tile size.
 */
function drawStroke(canvas: Canvas, shape: StrokeShape): void {
	let points = parsePolyline(shape.d);
	if (points.length < 2) return;
	let paint = paintFor(shape.tone);
	let half = ((shape.weight ?? 2.2) * SCALE) / 2;
	for (let index = 0; index < points.length - 1; index++) {
		let from = points[index]!;
		let to = points[index + 1]!;
		drawCapsule(canvas, from.x * SCALE, from.y * SCALE, to.x * SCALE, to.y * SCALE, half, paint);
	}
	for (let point of points) {
		let size = half * 2;
		canvas.fillPath(
			Path.roundedRect(point.x * SCALE - half, point.y * SCALE - half, size, size, size),
			paint,
		);
	}
}

/**
 * Absolute `M`/`L` vertices from a short SVG path. Relative commands and curves stay on
 * filled {@link PathShape}s — strokes only need polylines.
 */
function parsePolyline(d: string): Array<{ x: number; y: number }> {
	let tokens = d.match(/[ML]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
	let points: Array<{ x: number; y: number }> = [];
	let index = 0;
	while (index < tokens.length) {
		let token = tokens[index]!;
		if (token === "M" || token === "L" || token === "m" || token === "l") {
			index += 1;
			continue;
		}
		let x = Number(token);
		let y = Number(tokens[index + 1]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) break;
		points.push({ x, y });
		index += 2;
	}
	return points;
}

/**
 * A capsule between two pixel points. Round caps come from the caller when a stroke needs
 * joints; a lone line already reads as a rule without them.
 */
function drawCapsule(
	canvas: Canvas,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	half: number,
	paint: Raster.Paint,
): void {
	let dx = x2 - x1;
	let dy = y2 - y1;
	let length = Math.hypot(dx, dy);
	if (length === 0) return;
	let nx = (-dy / length) * half;
	let ny = (dx / length) * half;
	let path = new Path()
		.moveTo(x1 + nx, y1 + ny)
		.lineTo(x2 + nx, y2 + ny)
		.lineTo(x2 - nx, y2 - ny)
		.lineTo(x1 - nx, y1 - ny)
		.close();
	canvas.fillPath(path, paint);
}
