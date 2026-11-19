/**
 * Draws the explorer face each `@sdxc/ui` tile shows. Live frames clip inside a card;
 * these ProductFrame-grade miniatures — hairline windows, traffic-light chrome, dense
 * UI and the site's brand accent — render once as cached PNGs through `@sdxc/raster`.
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
import { isFailure } from "@sdxc/result";

import type { SocialCardImage } from "~/app/services/social-card-image";

/** Design space every miniature is authored in; the canvas is this times {@link SCALE}. */
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
export const COMPONENT_FACE_VERSION = "12";

/** Material role a miniature piece paints with. */
type Tone = "surface" | "chrome" | "label" | "ink" | "muted" | "hairline" | "accent";

/** Which bundled face a text run is set in. */
type FaceFont = "regular" | "semibold" | "mono";

interface RectShape {
	kind: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
	r?: number;
	tone: Tone;
	/** Draws the ProductFrame hairline ring around the fill. */
	ring?: boolean;
}

interface CircleShape {
	kind: "circle";
	cx: number;
	cy: number;
	r: number;
	tone: Tone;
	ring?: boolean;
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

interface TextShape {
	kind: "text";
	text: string;
	x: number;
	y: number;
	size: number;
	tone: Tone;
	font?: FaceFont;
	align?: "start" | "center" | "end";
	tracking?: number;
	maxWidth?: number;
}

type Shape = RectShape | CircleShape | LineShape | PathShape | StrokeShape | TextShape;

/** Module a catalogue entry ships from; drives the default stage composition. */
type ModuleKind =
	| "components"
	| "app"
	| "docs"
	| "landing"
	| "chat"
	| "color"
	| "video"
	| "commerce"
	| "audio"
	| "map"
	| "travel"
	| "finance"
	| "schedule";

/** Quiet stage wash in the site's brand hue — one step off the card, like DemoMiniature. */
const WASH = {
	from: color("oklch(0.975 0.008 275)"),
	to: color("oklch(0.94 0.016 275)"),
	glow: withAlpha(color("oklch(0.52 0.17 275)"), 0.1),
};

/** Elevated white panel. */
const SURFACE = color("#ffffff");
/** Title-bar and footer fill: a hair darker than the body. */
const CHROME = color("oklch(0.965 0.004 275)");
/** Resting fill from the site's near-neutral ramp. */
const LABEL = color("oklch(0.91 0.01 275)");
/** Rules and primary marks. */
const INK = color("oklch(0.32 0.01 275)");
/** Secondary copy and quiet chrome. */
const MUTED = color("oklch(0.55 0.012 275)");
/** Hairline ring matching `--ui-landing-hairline`. */
const HAIRLINE = withAlpha(color("oklch(0.35 0.02 275)"), 0.14);
/** Primary action / selected state from `--ui-color-brand-600`. */
const ACCENT = color("oklch(0.52 0.17 275)");
/** Soft tinted lift under a framed window. */
const SHADOW = withAlpha(color("oklch(0.35 0.04 275)"), 0.16);

/** Geometry of the desktop product window every framed face sits in. */
const WIN = { x: 16, y: 10, w: 128, h: 80, r: 8, chrome: 13 } as const;

/** Geometry of the phone device some mobile-facing faces sit in. */
const PHONE = { x: 52, y: 6, w: 56, h: 88, r: 12, pad: 3 } as const;

/** Every published `@sdxc/ui` explorer slug and the module it ships from. */
const CATALOGUE = [
	{ slug: "accent-text", module: "landing" },
	{ slug: "accordion", module: "components" },
	{ slug: "activity", module: "chat" },
	{ slug: "agenda", module: "schedule" },
	{ slug: "alert", module: "components" },
	{ slug: "alert-dialog", module: "components" },
	{ slug: "amount", module: "components" },
	{ slug: "anchor-heading", module: "docs" },
	{ slug: "announcement-chip", module: "landing" },
	{ slug: "app-shell", module: "app" },
	{ slug: "app-shell-toggle", module: "app" },
	{ slug: "aspect-ratio", module: "components" },
	{ slug: "attachment", module: "chat" },
	{ slug: "author-band", module: "landing" },
	{ slug: "auto-refresh", module: "app" },
	{ slug: "autocomplete", module: "components" },
	{ slug: "avatar", module: "components" },
	{ slug: "badge", module: "components" },
	{ slug: "banner", module: "components" },
	{ slug: "bento", module: "landing" },
	{ slug: "board", module: "app" },
	{ slug: "boarding-pass", module: "travel" },
	{ slug: "breadcrumbs", module: "components" },
	{ slug: "bubble", module: "chat" },
	{ slug: "button", module: "components" },
	{ slug: "calendar", module: "components" },
	{ slug: "callout", module: "docs" },
	{ slug: "car-offer", module: "travel" },
	{ slug: "card", module: "components" },
	{ slug: "carousel", module: "components" },
	{ slug: "cart-drawer", module: "commerce" },
	{ slug: "cart-line", module: "commerce" },
	{ slug: "case-study", module: "landing" },
	{ slug: "character-count", module: "components" },
	{ slug: "changelog-strip", module: "landing" },
	{ slug: "chart", module: "app" },
	{ slug: "check-row", module: "landing" },
	{ slug: "check-runs", module: "app" },
	{ slug: "checkbox", module: "components" },
	{ slug: "checkbox-group", module: "components" },
	{ slug: "checkout-layout", module: "commerce" },
	{ slug: "closing-cta", module: "landing" },
	{ slug: "code-block", module: "docs" },
	{ slug: "code-stage", module: "landing" },
	{ slug: "code-tabs", module: "docs" },
	{ slug: "code-tabs-sync", module: "docs" },
	{ slug: "code-view", module: "app" },
	{ slug: "color-area", module: "color" },
	{ slug: "color-field", module: "color" },
	{ slug: "color-picker", module: "color" },
	{ slug: "color-slider", module: "color" },
	{ slug: "color-swatch", module: "color" },
	{ slug: "color-swatch-picker", module: "color" },
	{ slug: "color-wheel", module: "color" },
	{ slug: "combobox", module: "components" },
	{ slug: "command", module: "components" },
	{ slug: "command-palette", module: "app" },
	{ slug: "composer", module: "chat" },
	{ slug: "composer-submit", module: "chat" },
	{ slug: "composer-format", module: "chat" },
	{ slug: "confirm", module: "components" },
	{ slug: "context-menu", module: "app" },
	{ slug: "contribution-graph", module: "app" },
	{ slug: "contributor-wall", module: "landing" },
	{ slug: "copy-button", module: "docs" },
	{ slug: "countdown", module: "landing" },
	{ slug: "crosshair", module: "landing" },
	{ slug: "cta-group", module: "components" },
	{ slug: "curriculum", module: "landing" },
	{ slug: "danger-zone", module: "app" },
	{ slug: "day-strip", module: "schedule" },
	{ slug: "date-field", module: "components" },
	{ slug: "date-picker", module: "components" },
	{ slug: "date-range-picker", module: "components" },
	{ slug: "description", module: "components" },
	{ slug: "detail-sheet", module: "app" },
	{ slug: "dialog", module: "components" },
	{ slug: "dialog-dismiss", module: "components" },
	{ slug: "diff", module: "app" },
	{ slug: "disclosure", module: "components" },
	{ slug: "docs-feedback", module: "docs" },
	{ slug: "docs-footer", module: "docs" },
	{ slug: "docs-hub", module: "docs" },
	{ slug: "docs-layout", module: "docs" },
	{ slug: "docs-nav", module: "docs" },
	{ slug: "docs-nav-tools", module: "docs" },
	{ slug: "docs-not-found", module: "docs" },
	{ slug: "docs-page-header", module: "docs" },
	{ slug: "docs-pager", module: "docs" },
	{ slug: "drawer", module: "components" },
	{ slug: "drawn-chart", module: "landing" },
	{ slug: "drop-indicator", module: "app" },
	{ slug: "drop-zone", module: "app" },
	{ slug: "editor-layout", module: "app" },
	{ slug: "empty", module: "app" },
	{ slug: "episode-list", module: "video" },
	{ slug: "equalizer", module: "audio" },
	{ slug: "episode-player", module: "landing" },
	{ slug: "event-ticker", module: "landing" },
	{ slug: "facet-filters", module: "commerce" },
	{ slug: "fan-out-diagram", module: "landing" },
	{ slug: "faq-band", module: "landing" },
	{ slug: "fare-calendar", module: "travel" },
	{ slug: "fare-options", module: "travel" },
	{ slug: "feature", module: "landing" },
	{ slug: "feature-band", module: "landing" },
	{ slug: "field-error", module: "components" },
	{ slug: "file-tree", module: "docs" },
	{ slug: "file-trigger", module: "app" },
	{ slug: "filter-bar", module: "app" },
	{ slug: "filter-menu", module: "app" },
	{ slug: "flight-itinerary", module: "travel" },
	{ slug: "flight-option", module: "travel" },
	{ slug: "flight-segment", module: "travel" },
	{ slug: "flow-diagram", module: "landing" },
	{ slug: "form", module: "components" },
	{ slug: "fulfilment-note", module: "commerce" },
	{ slug: "free-busy", module: "schedule" },
	{ slug: "grid-list", module: "app" },
	{ slug: "group", module: "components" },
	{ slug: "header", module: "components" },
	{ slug: "heading", module: "components" },
	{ slug: "heading-scope", module: "components" },
	{ slug: "highlight", module: "components" },
	{ slug: "hover-card", module: "components" },
	{ slug: "icon-well", module: "landing" },
	{ slug: "image-placeholder", module: "components" },
	{ slug: "input", module: "components" },
	{ slug: "install-command", module: "docs" },
	{ slug: "install-tabs", module: "landing" },
	{ slug: "item", module: "components" },
	{ slug: "item-options-dialog", module: "commerce" },
	{ slug: "keyboard", module: "components" },
	{ slug: "keyboard-help", module: "app" },
	{ slug: "label", module: "components" },
	{ slug: "label-chip", module: "components" },
	{ slug: "landing-header", module: "landing" },
	{ slug: "landing-hero", module: "landing" },
	{ slug: "landing-section", module: "landing" },
	{ slug: "ledger", module: "finance" },
	{ slug: "lightbox", module: "components" },
	{ slug: "link", module: "components" },
	{ slug: "link-button", module: "components" },
	{ slug: "listbox", module: "components" },
	{ slug: "log-viewer", module: "app" },
	{ slug: "logo", module: "components" },
	{ slug: "logo-cloud", module: "landing" },
	{ slug: "logo-sentence", module: "landing" },
	{ slug: "map", module: "map" },
	{ slug: "map-canvas", module: "map" },
	{ slug: "marker", module: "chat" },
	{ slug: "marquee", module: "landing" },
	{ slug: "media-tile", module: "audio" },
	{ slug: "media-grid", module: "components" },
	{ slug: "mention-menu", module: "chat" },
	{ slug: "menu", module: "components" },
	{ slug: "menu-item-card", module: "commerce" },
	{ slug: "menubar", module: "app" },
	{ slug: "merge-box", module: "app" },
	{ slug: "message", module: "chat" },
	{ slug: "message-group", module: "chat" },
	{ slug: "message-scroller", module: "chat" },
	{ slug: "meter", module: "components" },
	{ slug: "modal", module: "components" },
	{ slug: "month-view", module: "schedule" },
	{ slug: "motion-loop", module: "landing" },
	{ slug: "nav-link", module: "components" },
	{ slug: "navigation-menu", module: "components" },
	{ slug: "next-steps", module: "docs" },
	{ slug: "number-field", module: "components" },
	{ slug: "optimistic-toggle", module: "app" },
	{ slug: "option-group", module: "commerce" },
	{ slug: "order-summary", module: "commerce" },
	{ slug: "order-tracker", module: "commerce" },
	{ slug: "otp-field", module: "components" },
	{ slug: "overlay-arrow", module: "components" },
	{ slug: "package-savings", module: "travel" },
	{ slug: "page-actions", module: "docs" },
	{ slug: "page-header", module: "app" },
	{ slug: "payment-card", module: "finance" },
	{ slug: "price", module: "commerce" },
	{ slug: "product-card", module: "commerce" },
	{ slug: "product-gallery", module: "commerce" },
	{ slug: "profile-picker", module: "app" },
	{ slug: "pagination", module: "components" },
	{ slug: "phone-fan", module: "landing" },
	{ slug: "phone-frame", module: "landing" },
	{ slug: "plan-notice", module: "docs" },
	{ slug: "player-bar", module: "audio" },
	{ slug: "popover", module: "components" },
	{ slug: "price-breakdown", module: "travel" },
	{ slug: "price-list", module: "landing" },
	{ slug: "pricing-band", module: "landing" },
	{ slug: "product-frame", module: "landing" },
	{ slug: "progress-bar", module: "components" },
	{ slug: "proof-strip", module: "landing" },
	{ slug: "property-list", module: "components" },
	{ slug: "props-table", module: "docs" },
	{ slug: "promo-code", module: "commerce" },
	{ slug: "quantity-stepper", module: "commerce" },
	{ slug: "question-list", module: "commerce" },
	{ slug: "queue-list", module: "audio" },
	{ slug: "radio-group", module: "components" },
	{ slug: "rails", module: "landing" },
	{ slug: "range-calendar", module: "components" },
	{ slug: "range-months", module: "components" },
	{ slug: "rating", module: "components" },
	{ slug: "rating-input", module: "components" },
	{ slug: "rating-breakdown", module: "travel" },
	{ slug: "range-picker", module: "app" },
	{ slug: "reaction-bar", module: "chat" },
	{ slug: "reel-feed", module: "video" },
	{ slug: "relative-time", module: "components" },
	{ slug: "resizable", module: "app" },
	{ slug: "review-card", module: "components" },
	{ slug: "review-thread", module: "app" },
	{ slug: "gantt", module: "app" },
	{ slug: "rotating-text", module: "landing" },
	{ slug: "route-dialog", module: "app" },
	{ slug: "save-bar", module: "app" },
	{ slug: "save-status", module: "app" },
	{ slug: "scroll-area", module: "components" },
	{ slug: "scroll-scene", module: "landing" },
	{ slug: "search-field", module: "components" },
	{ slug: "seat-map", module: "travel" },
	{ slug: "section", module: "components" },
	{ slug: "section-bar", module: "components" },
	{ slug: "segmented-stage", module: "landing" },
	{ slug: "select", module: "components" },
	{ slug: "selection-bar", module: "app" },
	{ slug: "selection-indicator", module: "components" },
	{ slug: "sentinel-row", module: "components" },
	{ slug: "separator", module: "components" },
	{ slug: "sequence-diagram", module: "landing" },
	{ slug: "settings-layout", module: "app" },
	{ slug: "settings-section", module: "app" },
	{ slug: "shipping-estimate", module: "commerce" },
	{ slug: "shared-element", module: "components" },
	{ slug: "sheet", module: "components" },
	{ slug: "shortcut-list", module: "app" },
	{ slug: "sidebar", module: "components" },
	{ slug: "site-footer", module: "landing" },
	{ slug: "site-header", module: "landing" },
	{ slug: "skeleton", module: "app" },
	{ slug: "slider", module: "components" },
	{ slug: "sort-select", module: "commerce" },
	{ slug: "sparkline", module: "app" },
	{ slug: "spinner", module: "components" },
	{ slug: "split", module: "landing" },
	{ slug: "split-view", module: "app" },
	{ slug: "sponsor-wall", module: "landing" },
	{ slug: "stat-card", module: "app" },
	{ slug: "stat-strip", module: "landing" },
	{ slug: "status-dot", module: "components" },
	{ slug: "status-strip", module: "app" },
	{ slug: "step-indicator", module: "components" },
	{ slug: "step-list", module: "landing" },
	{ slug: "steps", module: "docs" },
	{ slug: "story-ring", module: "video" },
	{ slug: "story-viewer", module: "video" },
	{ slug: "switch", module: "components" },
	{ slug: "tabbed-stage", module: "landing" },
	{ slug: "tab-bar", module: "app" },
	{ slug: "table", module: "app" },
	{ slug: "table-of-contents", module: "docs" },
	{ slug: "tabs", module: "components" },
	{ slug: "tag-group", module: "components" },
	{ slug: "testimonial-band", module: "landing" },
	{ slug: "text", module: "components" },
	{ slug: "text-field", module: "components" },
	{ slug: "textarea", module: "components" },
	{ slug: "time-field", module: "components" },
	{ slug: "time-grid", module: "schedule" },
	{ slug: "timeline", module: "components" },
	{ slug: "title-hero", module: "video" },
	{ slug: "toast", module: "app" },
	{ slug: "toasts", module: "app" },
	{ slug: "toggle-button", module: "components" },
	{ slug: "toolbar", module: "app" },
	{ slug: "tooltip", module: "components" },
	{ slug: "track-list", module: "audio" },
	{ slug: "tree", module: "app" },
	{ slug: "trip-timeline", module: "travel" },
	{ slug: "typed-terminal", module: "landing" },
	{ slug: "typeset", module: "components" },
	{ slug: "typing-indicator", module: "chat" },
	{ slug: "ui-label", module: "docs" },
	{ slug: "usage-estimate", module: "landing" },
	{ slug: "variant-picker", module: "commerce" },
	{ slug: "view-options", module: "app" },
	{ slug: "video-card", module: "video" },
	{ slug: "video-player", module: "video" },
	{ slug: "video-shelf", module: "video" },
	{ slug: "year-view", module: "schedule" },
	{ slug: "youtube-embed", module: "components" },
] as const satisfies ReadonlyArray<{ slug: string; module: ModuleKind }>;

/** A soft fallback when a slug has no hand-tuned silhouette yet. */
const FALLBACK: Shape[] = windowScene([
	txt("UI", 80, 58, 14, "ink", { align: "center", font: "semibold" }),
]);

/** The tone a contribution-graph face paints a day of `level` (0 to 4) with. */
function graphTone(level: number): Tone {
	if (level === 0) return "hairline";
	return level >= 3 ? "accent" : "label";
}

/**
 * Hand-tuned interiors that carry the design bar — denser than the module defaults, still
 * inside the shared window / device / docs chrome.
 */
const OVERRIDES: Record<string, Shape[]> = {
	map: windowScene([
		{ kind: "rect", x: 20, y: 27, w: 120, h: 59, r: 4, tone: "label" },
		{
			kind: "path",
			d: "M30 40 L70 32 L112 36 L128 56 L118 78 L76 82 L36 74 L26 56 Z",
			tone: "chrome",
		},
		{ kind: "line", x1: 34, y1: 70, x2: 120, y2: 44, tone: "surface", weight: 2.5 },
		{ kind: "line", x1: 72, y1: 33, x2: 80, y2: 81, tone: "surface", weight: 1.5 },
		{ kind: "circle", cx: 52, cy: 52, r: 6, tone: "accent" },
		txt("2", 52, 54.5, 6, "surface", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 84, y: 54, w: 20, h: 9, r: 4.5, tone: "ink" },
		txt("$240", 94, 60.5, 5.5, "surface", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 96, y: 34, w: 20, h: 9, r: 4.5, tone: "surface", ring: true },
		txt("$95", 106, 40.5, 5.5, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 128, y: 31, w: 8, h: 8, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 128, y: 41, w: 8, h: 8, r: 2, tone: "surface", ring: true },
	]),
	"seat-map": windowScene([
		{ kind: "path", d: "M53 90 L53 46 Q53 27 80 27 Q107 27 107 46 L107 90 Z", tone: "chrome" },
		...[10, 11, 12, 13].flatMap((row, r): Shape[] => {
			let y = 44 + r * 11;
			let tones: Tone[][] = [
				["accent", "surface", "surface", "label", "surface", "surface"],
				["surface", "label", "surface", "surface", "surface", "label"],
				["surface", "surface", "label", "surface", "surface", "surface"],
				["label", "surface", "surface", "surface", "label", "surface"],
			];
			return [
				txt(String(row), 80, y + 5.5, 4.5, "muted", { align: "center" }),
				...[57, 64, 71, 83, 90, 97].map((x, c): Shape => ({
					kind: "rect",
					x,
					y,
					w: 6,
					h: 8,
					r: 2,
					tone: tones[r]?.[c] ?? "surface",
					ring: true,
				})),
			];
		}),
	]),
	"fare-calendar": windowScene([
		txt("March", 80, 34, 7, "ink", { align: "center", font: "semibold" }),
		...Array.from({ length: 21 }, (_, index): Shape[] => {
			let x = 24 + (index % 7) * 16;
			let y = 40 + Math.floor(index / 7) * 16;
			let cheap = index === 2 || index === 9 || index === 16;
			let tone: Tone = cheap ? "accent" : "surface";
			return [
				{ kind: "rect", x, y, w: 14, h: 14, r: 3, tone, ring: true },
				txt(String(index + 1), x + 7, y + 7, 4.5, cheap ? "surface" : "ink", { align: "center" }),
				{
					kind: "line",
					x1: x + 4,
					y1: y + 10.5,
					x2: x + 10,
					y2: y + 10.5,
					tone: cheap ? "surface" : "label",
					weight: 1.2,
				},
			];
		}).flat(),
	]),
	"boarding-pass": windowScene([
		{ kind: "rect", x: 44, y: 27, w: 72, h: 60, r: 5, tone: "surface", ring: true },
		{ kind: "rect", x: 44, y: 27, w: 72, h: 10, r: 5, tone: "accent" },
		{ kind: "rect", x: 44, y: 32, w: 72, h: 5, tone: "accent" },
		txt("MRW", 49, 48, 8, "ink", { font: "semibold" }),
		txt("VLS", 111, 48, 8, "ink", { font: "semibold", align: "end" }),
		{ kind: "line", x1: 73, y1: 45, x2: 87, y2: 45, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 49, y1: 56, x2: 64, y2: 56, tone: "label", weight: 2 },
		{ kind: "line", x1: 72, y1: 56, x2: 84, y2: 56, tone: "label", weight: 2 },
		{ kind: "line", x1: 92, y1: 56, x2: 111, y2: 56, tone: "label", weight: 2 },
		{ kind: "line", x1: 49, y1: 63, x2: 111, y2: 63, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 44, cy: 63, r: 3, tone: "surface" },
		{ kind: "circle", cx: 116, cy: 63, r: 3, tone: "surface" },
		{ kind: "rect", x: 71, y: 67, w: 18, h: 18, r: 1, tone: "ink" },
		...[
			[72, 68],
			[84, 68],
			[72, 80],
		].flatMap(([x = 0, y = 0]): Shape[] => [
			{ kind: "rect", x, y, w: 4, h: 4, tone: "surface" },
			{ kind: "rect", x: x + 1, y: y + 1, w: 2, h: 2, tone: "ink" },
		]),
	]),
	"flight-segment": windowScene([
		{ kind: "rect", x: 24, y: 30, w: 12, h: 12, r: 3, tone: "accent" },
		txt("Larkwing Air", 40, 35, 5.5, "ink", { font: "semibold" }),
		txt("LW 214", 40, 41, 4.5, "muted"),
		txt("22:40", 24, 60, 9, "ink", { font: "semibold" }),
		txt("MRW", 24, 68, 5.5, "muted", { font: "semibold" }),
		txt("7h 25m", 74, 54, 4.5, "muted", { align: "center" }),
		{ kind: "circle", cx: 52, cy: 59, r: 1.6, tone: "hairline" },
		{ kind: "line", x1: 54, y1: 59, x2: 95, y2: 59, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 74, cy: 59, r: 2, tone: "accent" },
		{ kind: "path", d: "M97 56.5 L101 59 L97 61.5 Z", tone: "muted" },
		txt("1 stop · VLS", 74, 66, 4.5, "muted", { align: "center" }),
		txt("06:05", 128, 60, 9, "ink", { align: "end", font: "semibold" }),
		txt("+1", 135, 54, 4.5, "accent", { align: "end" }),
		txt("OSK", 128, 68, 5.5, "muted", { align: "end", font: "semibold" }),
		{ kind: "line", x1: 24, y1: 75, x2: 136, y2: 75, tone: "hairline", weight: 1 },
		txt("Aerion 320neo · Economy", 24, 83, 4.5, "muted"),
	]),
	"flight-itinerary": windowScene([
		txt("Outbound · Fri 14 Mar", 24, 33, 5.5, "ink", { font: "semibold" }),
		txt("1 stop · 15h 20m", 136, 33, 4.5, "muted", { align: "end" }),
		txt("18:10", 24, 46, 7.5, "ink", { font: "semibold" }),
		{ kind: "line", x1: 50, y1: 43.5, x2: 104, y2: 43.5, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 77, cy: 43.5, r: 1.8, tone: "accent" },
		{ kind: "path", d: "M105 41 L109 43.5 L105 46 Z", tone: "muted" },
		txt("09:30", 136, 46, 7.5, "ink", { align: "end", font: "semibold" }),
		txt("Flight details", 24, 56, 4.5, "accent"),
		{ kind: "stroke", d: "M55 53.5 L57 55.5 L59 53.5", tone: "accent", weight: 0.9 },
		{ kind: "line", x1: 24, y1: 61, x2: 136, y2: 61, tone: "hairline", weight: 1 },
		txt("LW 214 · MRW-VLS", 24, 68, 4.5, "ink"),
		{ kind: "rect", x: 24, y: 71, w: 112, h: 7, r: 2, tone: "chrome" },
		txt("10h 05m layover in VLS", 28, 76, 4, "muted"),
		txt("LW 731 · VLS-OSK", 24, 86, 4.5, "ink"),
	]),
	"flight-option": windowScene([
		{ kind: "rect", x: 22, y: 28, w: 116, h: 56, r: 5, tone: "surface", ring: true },
		{ kind: "rect", x: 26, y: 32, w: 20, h: 6, r: 3, tone: "accent" },
		txt("Cheapest", 36, 36.6, 3.6, "surface", { align: "center" }),
		txt("08:40", 26, 48, 6, "ink", { font: "semibold" }),
		{ kind: "line", x1: 45, y1: 46, x2: 74, y2: 46, tone: "hairline", weight: 1 },
		txt("10:55", 94, 48, 6, "ink", { align: "end", font: "semibold" }),
		txt("22:10", 26, 62, 6, "ink", { font: "semibold" }),
		{ kind: "line", x1: 45, y1: 60, x2: 74, y2: 60, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 59.5, cy: 60, r: 1.5, tone: "accent" },
		txt("06:05", 94, 62, 6, "ink", { align: "end", font: "semibold" }),
		{ kind: "line", x1: 100, y1: 30, x2: 100, y2: 82, tone: "hairline", weight: 1 },
		txt("$412", 134, 50, 8, "ink", { align: "end", font: "semibold" }),
		txt("round trip", 134, 56, 3.8, "muted", { align: "end" }),
		{ kind: "rect", x: 108, y: 66, w: 26, h: 9, r: 3, tone: "ink" },
		txt("Select", 121, 72, 4, "surface", { align: "center" }),
	]),
	"fare-options": windowScene(
		(
			[
				["Basic", "$412", 22, false],
				["Standard", "$468", 61, true],
				["Flex", "$544", 100, false],
			] as Array<[string, string, number, boolean]>
		).flatMap(([title, price, x, chosen]): Shape[] => [
			...(chosen
				? [{ kind: "rect", x: x - 1, y: 29, w: 40, h: 58, r: 5, tone: "accent" } as Shape]
				: []),
			{ kind: "rect", x, y: 30, w: 38, h: 56, r: 4, tone: "surface", ring: !chosen },
			txt(title, x + 4, 38, 4.5, "ink", { font: "semibold" }),
			{ kind: "circle", cx: x + 33, cy: 36.5, r: 2.2, tone: chosen ? "accent" : "hairline" },
			txt(price, x + 4, 50, 7, "ink", { font: "semibold" }),
			...[60, 68, 76].flatMap((y, row): Shape[] => [
				{
					kind: "stroke",
					d: `M${x + 4} ${y} L${x + 5.5} ${y + 1.5} L${x + 8} ${y - 1.5}`,
					tone: row < (chosen ? 3 : 1) ? "accent" : "label",
					weight: 0.9,
				},
				{ kind: "line", x1: x + 11, y1: y, x2: x + 31, y2: y, tone: "label", weight: 1.2 },
			]),
		]),
	),
	"car-offer": windowScene([
		{ kind: "rect", x: 22, y: 30, w: 40, h: 28, r: 4, tone: "chrome" },
		{
			kind: "path",
			d: "M26 50 L28 44 L36 43 L41 38 L52 38 L56 44 L59 45 L59 50 Z",
			tone: "accent",
		},
		{ kind: "circle", cx: 33, cy: 50, r: 3, tone: "ink" },
		{ kind: "circle", cx: 52, cy: 50, r: 3, tone: "ink" },
		txt("Compact", 68, 36, 5.5, "ink", { font: "semibold" }),
		txt("Velo C3 or similar", 68, 42, 4, "muted"),
		{ kind: "rect", x: 68, y: 46, w: 16, h: 6, r: 2, tone: "chrome", ring: true },
		{ kind: "rect", x: 86, y: 46, w: 16, h: 6, r: 2, tone: "chrome", ring: true },
		{ kind: "rect", x: 104, y: 46, w: 16, h: 6, r: 2, tone: "chrome", ring: true },
		txt("Tallow Rent · 8.6", 68, 60, 4, "muted"),
		{ kind: "line", x1: 22, y1: 66, x2: 138, y2: 66, tone: "hairline", weight: 1 },
		txt("$38", 22, 78, 8, "ink", { font: "semibold" }),
		txt("/ day", 38, 78, 4, "muted"),
		txt("$266 total", 22, 85, 3.8, "muted"),
		{ kind: "rect", x: 106, y: 71, w: 32, h: 10, r: 3, tone: "ink" },
		txt("View deal", 122, 77.5, 4, "surface", { align: "center" }),
	]),
	"package-savings": windowScene([
		txt("Flight + Hotel + Car", 22, 34, 5, "ink", { font: "semibold" }),
		...(
			[
				["Flights", "$684", 44],
				["5 nights", "$824", 55],
				["Car", "$190", 66],
			] as Array<[string, string, number]>
		).flatMap(([label, price, y]): Shape[] => [
			{ kind: "rect", x: 22, y: y - 5, w: 6, h: 6, r: 1.5, tone: "chrome" },
			txt(label, 31, y, 4.5, "ink"),
			txt(price, 84, y, 4.5, "muted", { align: "end" }),
			{ kind: "line", x1: 72, y1: y - 1.5, x2: 84, y2: y - 1.5, tone: "muted", weight: 0.6 },
		]),
		{ kind: "rect", x: 90, y: 30, w: 48, h: 50, r: 5, tone: "chrome", ring: true },
		{ kind: "rect", x: 94, y: 34, w: 40, h: 7, r: 3.5, tone: "accent" },
		txt("You save $212", 114, 39, 3.8, "surface", { align: "center" }),
		txt("$1,698", 94, 50, 4, "muted"),
		{ kind: "line", x1: 94, y1: 48.5, x2: 107, y2: 48.5, tone: "muted", weight: 0.6 },
		txt("$1,486", 94, 62, 8, "ink", { font: "semibold" }),
		{ kind: "rect", x: 94, y: 67, w: 40, h: 9, r: 3, tone: "ink" },
		txt("Book", 114, 73, 4, "surface", { align: "center" }),
	]),
	"trip-timeline": windowScene([
		txt("Fri 14 Mar", 22, 33, 5.5, "ink", { font: "semibold" }),
		{ kind: "line", x1: 22, y1: 36, x2: 138, y2: 36, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 30, y1: 46, x2: 30, y2: 76, tone: "hairline", weight: 1.2 },
		...(
			[
				["08:40", "LW 214 to Vellis", 46, "accent"],
				["11:30", "Tallow Rent pickup", 61, "label"],
				["15:00", "Hotel Saltmarsh", 76, "label"],
			] as Array<[string, string, number, Tone]>
		).flatMap(([time, title, y, tone]): Shape[] => [
			{ kind: "circle", cx: 30, cy: y, r: 4.5, tone, ring: true },
			txt(title, 39, y - 0.5, 4.8, "ink", { font: "semibold" }),
			txt(time, 39, y + 5, 3.8, "muted"),
		]),
		{ kind: "rect", x: 112, y: 41, w: 24, h: 6, r: 3, tone: "accent" },
		txt("Confirmed", 124, 45.4, 3.4, "surface", { align: "center" }),
	]),
	amount: windowScene([
		txt("Balance", 28, 38, 6, "muted"),
		txt("€12,840", 28, 56, 15, "ink", { font: "semibold" }),
		txt(".56", 100, 56, 8, "ink", { font: "semibold" }),
		{ kind: "line", x1: 28, y1: 64, x2: 132, y2: 64, tone: "hairline", weight: 1 },
		txt("+€2,100.00", 28, 78, 7, "accent", { font: "semibold" }),
		txt("€23.40", 132, 78, 7, "ink", { align: "end" }),
	]),
	ledger: windowScene([
		txt("Today", 26, 36, 6, "muted", { font: "semibold" }),
		txt("−€61.40", 134, 36, 6, "muted", { align: "end" }),
		{ kind: "rect", x: 26, y: 42, w: 12, h: 12, r: 3, tone: "label" },
		txt("Café Lumen", 44, 50, 6.5, "ink", { font: "semibold" }),
		txt("€3.40", 134, 50, 6.5, "ink", { align: "end" }),
		{ kind: "rect", x: 26, y: 58, w: 12, h: 12, r: 3, tone: "accent" },
		txt("Tasca", 44, 66, 6.5, "ink", { font: "semibold" }),
		txt("€58.00", 134, 66, 6.5, "ink", { align: "end" }),
		txt("Yesterday", 26, 80, 6, "muted", { font: "semibold" }),
		txt("+€2,100", 134, 80, 6, "accent", { align: "end" }),
	]),
	"payment-card": windowScene([
		{ kind: "rect", x: 38, y: 30, w: 84, h: 53, r: 6, tone: "accent" },
		txt("Tuppence", 44, 41, 6, "surface", { font: "semibold" }),
		{ kind: "rect", x: 44, y: 49, w: 12, h: 9, r: 2, tone: "label" },
		txt("•••• 4821", 44, 70, 6, "surface"),
		txt("debit", 116, 78, 6, "surface", { align: "end", font: "semibold" }),
	]),
	"step-indicator": windowScene([
		{ kind: "circle", cx: 34, cy: 52, r: 7, tone: "accent" },
		{ kind: "stroke", d: "M30.5 52 L33 54.5 L37.5 49.5", weight: 1.4, tone: "surface" },
		{ kind: "line", x1: 45, y1: 52, x2: 70, y2: 52, tone: "accent", weight: 1.4 },
		{ kind: "circle", cx: 80, cy: 52, r: 7, tone: "accent" },
		txt("2", 80, 55, 7, "surface", { align: "center", font: "semibold" }),
		{ kind: "line", x1: 91, y1: 52, x2: 116, y2: 52, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 126, cy: 52, r: 7, tone: "surface", ring: true },
		txt("Payee", 34, 70, 5.5, "muted", { align: "center" }),
		txt("Amount", 80, 70, 5.5, "ink", { align: "center", font: "semibold" }),
		txt("Review", 126, 70, 5.5, "muted", { align: "center" }),
	]),
	autocomplete: windowScene([
		{ kind: "rect", x: 28, y: 28, w: 104, h: 14, r: 4, tone: "surface", ring: true },
		txt("Lis", 34, 38, 7, "ink"),
		{ kind: "rect", x: 28, y: 46, w: 104, h: 38, r: 6, tone: "surface", ring: true },
		{ kind: "rect", x: 31, y: 49, w: 98, h: 11, r: 3, tone: "accent" },
		{ kind: "circle", cx: 38, cy: 54.5, r: 3, tone: "surface" },
		{ kind: "line", x1: 45, y1: 54.5, x2: 90, y2: 54.5, tone: "surface", weight: 1.4 },
		{ kind: "circle", cx: 38, cy: 67, r: 3, tone: "hairline" },
		{ kind: "line", x1: 45, y1: 67, x2: 100, y2: 67, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 38, cy: 77, r: 3, tone: "hairline" },
		{ kind: "line", x1: 45, y1: 77, x2: 84, y2: 77, tone: "label", weight: 1.4 },
	]),
	lightbox: windowScene([
		{ kind: "rect", x: 16, y: 23, w: 128, h: 67, r: 8, tone: "ink" },
		{ kind: "rect", x: 16, y: 23, w: 128, h: 10, tone: "ink" },
		{ kind: "rect", x: 44, y: 30, w: 72, h: 46, r: 3, tone: "accent" },
		{ kind: "circle", cx: 102, cy: 41, r: 5, tone: "label" },
		{ kind: "path", d: "M44 76 L66 54 L82 68 L94 60 L116 76 Z", tone: "chrome" },
		{ kind: "circle", cx: 28, cy: 53, r: 6, tone: "surface" },
		{ kind: "stroke", d: "M29.5 50 L26.5 53 L29.5 56", tone: "ink", weight: 1.4 },
		{ kind: "circle", cx: 132, cy: 53, r: 6, tone: "surface" },
		{ kind: "stroke", d: "M130.5 50 L133.5 53 L130.5 56", tone: "ink", weight: 1.4 },
		{ kind: "stroke", d: "M133 27 L138 32", tone: "label", weight: 1.2 },
		{ kind: "stroke", d: "M138 27 L133 32", tone: "label", weight: 1.2 },
		txt("2 / 5", 80, 85, 5.5, "label", { align: "center" }),
	]),
	"price-breakdown": windowScene([
		txt("4 nights", 30, 37, 6.5, "ink"),
		txt("$728", 130, 37, 6.5, "ink", { align: "end" }),
		txt("$182 x 4", 30, 44, 5, "muted"),
		txt("Cleaning fee", 30, 54, 6.5, "ink"),
		txt("$45", 130, 54, 6.5, "ink", { align: "end" }),
		txt("Discount", 30, 64, 6.5, "accent"),
		txt("-$73", 130, 64, 6.5, "accent", { align: "end" }),
		{ kind: "line", x1: 30, y1: 70, x2: 130, y2: 70, tone: "hairline", weight: 1 },
		txt("Total", 30, 81, 7.5, "ink", { font: "semibold" }),
		txt("$700", 130, 81, 7.5, "ink", { align: "end", font: "semibold" }),
	]),
	"range-months": windowScene([
		txt("Sep", 24, 34, 7, "ink", { font: "semibold" }),
		txt("Oct", 86, 34, 7, "ink", { font: "semibold" }),
		{ kind: "stroke", d: "M134 30 L138 34 L134 38", weight: 1.4, tone: "muted" },
		...calendarGrid(22, 42, 6, [15, 16, 17, 18, 19]),
		...calendarGrid(84, 42, 6, []),
	]),
	"rating-breakdown": windowScene([
		{
			kind: "path",
			d: "M30 30 L32.1 34.3 L36.8 35 L33.4 38.3 L34.2 43 L30 40.8 L25.8 43 L26.6 38.3 L23.2 35 L27.9 34.3 Z",
			tone: "accent",
		},
		txt("4.86", 40, 42, 12, "ink", { font: "semibold" }),
		txt("128 reviews", 74, 41, 6, "muted"),
		...[0.89, 0.08, 0.02, 0.01, 0].flatMap((share, index): Shape[] => {
			let y = 52 + index * 8;
			return [
				txt(String(5 - index), 28, y + 2, 5.5, "muted", { align: "end" }),
				{ kind: "line", x1: 34, y1: y, x2: 132, y2: y, tone: "label", weight: 3 },
				...(share > 0
					? [
							{
								kind: "line",
								x1: 34,
								y1: y,
								x2: 34 + 98 * share,
								y2: y,
								tone: "ink",
								weight: 3,
							} as Shape,
						]
					: []),
			];
		}),
	]),
	"media-grid": windowScene([
		{ kind: "rect", x: 44, y: 26, w: 24, h: 24, tone: "accent" },
		{ kind: "rect", x: 94, y: 26, w: 24, h: 24, tone: "label" },
		{ kind: "rect", x: 44, y: 51, w: 24, h: 24, tone: "label" },
		{ kind: "rect", x: 69, y: 51, w: 24, h: 24, tone: "label" },
		{ kind: "rect", x: 94, y: 51, w: 24, h: 24, tone: "label" },
		{ kind: "rect", x: 69, y: 26, w: 24, h: 49, tone: "ink" },
		{ kind: "rect", x: 44, y: 76, w: 24, h: 14, tone: "label" },
		{ kind: "rect", x: 94, y: 76, w: 24, h: 14, tone: "label" },
		{ kind: "rect", x: 59, y: 30, w: 6, h: 5, r: 1, tone: "surface" },
		{ kind: "circle", cx: 81, cy: 50, r: 4, tone: "surface" },
	]),
	"map-canvas": windowScene([
		{ kind: "rect", x: 20, y: 27, w: 120, h: 59, r: 4, tone: "chrome" },
		{ kind: "path", d: "M98 27 L140 27 L140 86 L112 86 L104 70 L108 54 L98 40 Z", tone: "label" },
		{ kind: "line", x1: 20, y1: 52, x2: 102, y2: 50, tone: "surface", weight: 2.5 },
		{ kind: "line", x1: 58, y1: 27, x2: 58, y2: 86, tone: "surface", weight: 2.5 },
		{ kind: "line", x1: 20, y1: 72, x2: 104, y2: 66, tone: "surface", weight: 2.5 },
		{ kind: "stroke", d: "M30 80 L58 72 L58 52 L84 46", tone: "accent", weight: 1.6 },
		{ kind: "circle", cx: 58, cy: 62, r: 3, tone: "accent" },
		{ kind: "rect", x: 28, y: 32, w: 20, h: 9, r: 4.5, tone: "surface", ring: true },
		txt("$182", 38, 38.5, 5.5, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 64, y: 56, w: 20, h: 9, r: 4.5, tone: "ink" },
		txt("$95", 74, 62.5, 5.5, "surface", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 82, y: 33, w: 20, h: 9, r: 4.5, tone: "surface", ring: true },
		txt("$240", 92, 39.5, 5.5, "ink", { align: "center", font: "semibold" }),
	]),
	"check-runs": windowScene([
		{ kind: "circle", cx: 34, cy: 36, r: 4, tone: "accent" },
		txt("1 failing, 3 successful", 42, 39, 7, "ink", { font: "semibold" }),
		{ kind: "line", x1: 26, y1: 46, x2: 134, y2: 46, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 34, cy: 54, r: 3, tone: "accent" },
		txt("test (ubuntu)", 42, 57, 6, "ink"),
		txt("Details", 132, 57, 6, "muted", { align: "end" }),
		{ kind: "circle", cx: 34, cy: 66, r: 3, tone: "label" },
		txt("lint", 42, 69, 6, "muted"),
		{ kind: "circle", cx: 34, cy: 78, r: 3, tone: "label" },
		txt("typecheck", 42, 81, 6, "muted"),
	]),
	"code-view": windowScene([
		txt("24 lines · 1.04 KB", 26, 35, 6, "muted", { font: "mono" }),
		{ kind: "line", x1: 16, y1: 40, x2: 144, y2: 40, tone: "hairline", weight: 1 },
		{ kind: "rect", x: 16, y: 52, w: 128, h: 18, tone: "label" },
		...[48, 57, 66, 75, 84].map((y, index) =>
			txt(String(index + 10), 30, y, 6, "muted", { align: "end", font: "mono" }),
		),
		{ kind: "line", x1: 38, y1: 46, x2: 92, y2: 46, tone: "accent", weight: 2 },
		{ kind: "line", x1: 38, y1: 55, x2: 120, y2: 55, tone: "ink", weight: 2 },
		{ kind: "line", x1: 46, y1: 64, x2: 104, y2: 64, tone: "ink", weight: 2 },
		{ kind: "line", x1: 46, y1: 73, x2: 84, y2: 73, tone: "accent", weight: 2 },
		{ kind: "line", x1: 38, y1: 82, x2: 60, y2: 82, tone: "label", weight: 2 },
	]),
	"contribution-graph": windowScene(
		Array.from({ length: 13 * 7 }, (_, index): Shape => {
			let week = Math.floor(index / 7);
			let day = index % 7;
			let level = (week * 7 + day * 3) % 5;
			return {
				kind: "rect",
				x: 27 + week * 8.2,
				y: 32 + day * 7.6,
				w: 6.4,
				h: 6.4,
				r: 1.5,
				tone: graphTone(level),
			};
		}),
	),
	"filter-menu": windowScene([
		{ kind: "rect", x: 30, y: 30, w: 40, h: 12, r: 6, tone: "surface", ring: true },
		txt("main", 50, 39, 6, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 30, y: 46, w: 92, h: 40, r: 6, tone: "surface", ring: true },
		{ kind: "rect", x: 36, y: 51, w: 80, h: 9, r: 4, tone: "label" },
		txt("Find a branch…", 40, 58, 5.5, "muted"),
		txt("main", 40, 70, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 92, y: 64, w: 22, h: 8, r: 4, tone: "label" },
		txt("fix/offsets", 40, 81, 6, "muted"),
	]),
	"log-viewer": windowScene([
		{ kind: "circle", cx: 30, cy: 34, r: 3, tone: "label" },
		txt("Install dependencies", 38, 37, 6, "muted"),
		{ kind: "circle", cx: 30, cy: 46, r: 3, tone: "accent" },
		txt("Run tests", 38, 49, 6, "ink", { font: "semibold" }),
		...[60, 68, 76, 84].map((y, index) =>
			txt(String(index + 1), 34, y, 5.5, "muted", { align: "end", font: "mono" }),
		),
		{ kind: "line", x1: 40, y1: 58, x2: 108, y2: 58, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 40, y1: 66, x2: 92, y2: 66, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 40, y1: 74, x2: 124, y2: 74, tone: "accent", weight: 1.6 },
		{ kind: "line", x1: 40, y1: 82, x2: 100, y2: 82, tone: "accent", weight: 1.6 },
	]),
	"merge-box": windowScene([
		{ kind: "circle", cx: 32, cy: 34, r: 3, tone: "accent" },
		txt("1 approving review", 40, 37, 6, "ink"),
		{ kind: "circle", cx: 32, cy: 47, r: 3, tone: "accent" },
		txt("All checks have passed", 40, 50, 6, "ink"),
		{ kind: "circle", cx: 32, cy: 60, r: 3, tone: "accent" },
		txt("No conflicts", 40, 63, 6, "ink"),
		{ kind: "rect", x: 28, y: 70, w: 60, h: 14, r: 6, tone: "accent" },
		txt("Merge", 58, 79, 6.5, "surface", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 89, y: 70, w: 12, h: 14, r: 6, tone: "accent" },
	]),
	diff: windowScene([
		{ kind: "rect", x: 20, y: 28, w: 120, h: 12, r: 3, tone: "label" },
		{ kind: "rect", x: 26, y: 31, w: 6, h: 6, r: 1.5, tone: "accent" },
		txt("src/lexer/identifier.ts", 36, 37, 6, "ink", { font: "mono" }),
		txt("+9 −4", 134, 37, 6, "muted", { align: "end", font: "mono" }),
		...[48, 56, 64, 72, 80].map((y, index) =>
			txt(String(index + 6), 30, y, 5.5, "muted", { align: "end", font: "mono" }),
		),
		{ kind: "rect", x: 34, y: 51, w: 106, h: 7, tone: "hairline" },
		{ kind: "rect", x: 34, y: 59, w: 106, h: 7, tone: "label" },
		{ kind: "line", x1: 38, y1: 46, x2: 100, y2: 46, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 38, y1: 54.5, x2: 108, y2: 54.5, tone: "muted", weight: 1.6 },
		{ kind: "line", x1: 38, y1: 62.5, x2: 84, y2: 62.5, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 84, y1: 62.5, x2: 116, y2: 62.5, tone: "accent", weight: 2.4 },
		{ kind: "line", x1: 38, y1: 70, x2: 92, y2: 70, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 38, y1: 78, x2: 72, y2: 78, tone: "ink", weight: 1.6 },
	]),
	"review-thread": windowScene([
		{ kind: "rect", x: 22, y: 28, w: 116, h: 60, r: 5, tone: "surface", ring: true },
		{ kind: "circle", cx: 32, cy: 38, r: 4, tone: "label" },
		txt("ana", 40, 40, 6, "ink", { font: "semibold" }),
		txt("commented", 54, 40, 6, "muted"),
		{ kind: "line", x1: 40, y1: 48, x2: 124, y2: 48, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 40, y1: 54, x2: 100, y2: 54, tone: "ink", weight: 1.6 },
		{ kind: "rect", x: 28, y: 61, w: 104, h: 12, r: 3, tone: "hairline" },
		txt("Reply…", 32, 69, 5.5, "muted"),
		{ kind: "rect", x: 104, y: 76, w: 28, h: 8, r: 4, tone: "accent" },
		txt("Reply", 118, 81.5, 5, "surface", { align: "center", font: "semibold" }),
	]),
	button: windowScene([
		{ kind: "rect", x: 52, y: 46, w: 56, h: 20, r: 10, tone: "accent" },
		txt("Save", 80, 59, 9, "surface", { align: "center", font: "semibold" }),
	]),
	"link-button": windowScene([
		{ kind: "rect", x: 44, y: 46, w: 72, h: 20, r: 10, tone: "surface", ring: true },
		txt("Open docs", 80, 59, 8, "ink", { align: "center", font: "semibold" }),
	]),
	"label-chip": windowScene([
		{ kind: "rect", x: 34, y: 38, w: 36, h: 14, r: 7, tone: "accent" },
		txt("bug", 52, 48, 7, "surface", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 74, y: 38, w: 52, h: 14, r: 7, tone: "label" },
		txt("feature", 100, 48, 7, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 50, y: 58, w: 60, h: 14, r: 7, tone: "surface", ring: true },
		{ kind: "circle", cx: 59, cy: 65, r: 3, tone: "accent" },
		txt("design", 66, 68, 7, "ink", { font: "semibold" }),
	]),
	badge: windowScene([
		{ kind: "rect", x: 58, y: 44, w: 44, h: 16, r: 8, tone: "label" },
		txt("Beta", 80, 55, 8, "ink", { align: "center", font: "semibold" }),
	]),
	alert: windowScene([
		{ kind: "rect", x: 32, y: 36, w: 96, h: 36, r: 10, tone: "surface", ring: true },
		{ kind: "circle", cx: 46, cy: 54, r: 6, tone: "accent" },
		txt("Billing paused", 58, 50, 7, "ink", { font: "semibold", maxWidth: 62 }),
		{ kind: "line", x1: 58, y1: 60, x2: 112, y2: 60, tone: "label", weight: 1.3 },
	]),
	banner: windowScene([
		{ kind: "rect", x: 28, y: 38, w: 104, h: 28, r: 8, tone: "accent" },
		txt("New pricing is live", 44, 55, 7, "surface", { font: "semibold", maxWidth: 80 }),
	]),
	form: windowScene([
		txt("Email", 40, 36, 6, "muted"),
		{ kind: "rect", x: 40, y: 40, w: 80, h: 14, r: 6, tone: "surface", ring: true },
		txt("Name", 40, 66, 6, "muted"),
		{ kind: "rect", x: 40, y: 70, w: 80, h: 14, r: 6, tone: "surface", ring: true },
	]),
	dialog: windowScene([
		{ kind: "rect", x: 40, y: 30, w: 80, h: 52, r: 10, tone: "surface", ring: true },
		txt("Confirm", 52, 44, 8, "ink", { font: "semibold" }),
		{ kind: "line", x1: 52, y1: 52, x2: 108, y2: 52, tone: "label", weight: 1.4 },
		{ kind: "rect", x: 52, y: 60, w: 24, h: 12, r: 6, tone: "label" },
		{ kind: "rect", x: 84, y: 60, w: 28, h: 12, r: 6, tone: "accent" },
	]),
	command: windowScene([
		{ kind: "rect", x: 36, y: 28, w: 88, h: 54, r: 10, tone: "surface", ring: true },
		{ kind: "rect", x: 44, y: 36, w: 72, h: 14, r: 6, tone: "label" },
		txt("Search…", 52, 46, 7, "muted", { font: "mono" }),
		{ kind: "line", x1: 48, y1: 60, x2: 108, y2: 60, tone: "ink", weight: 1.4 },
		{ kind: "line", x1: 48, y1: 70, x2: 96, y2: 70, tone: "label", weight: 1.3 },
	]),
	"product-frame": windowScene([
		txt("Monitors", 34, 38, 7, "muted", { font: "mono" }),
		...statusRow(34, 48, "api.beacon.dev", true),
		...statusRow(34, 60, "app.beacon.dev", true),
		...statusRow(34, 72, "eu-west · degraded", false),
	]),
	"phone-frame": deviceScene([
		txt("Today", 80, 28, 8, "ink", { align: "center", font: "semibold" }),
		...phoneRow(58, 38, "Lists", true),
		...phoneRow(58, 54, "Bins", false),
		...phoneRow(58, 70, "Meals", false),
	]),
	"phone-fan": [
		{ kind: "rect", x: 26, y: 20, w: 38, h: 68, r: 9, tone: "ink" },
		{
			kind: "rect",
			x: 29,
			y: 23,
			w: 32,
			h: 62,
			r: 7,
			tone: "surface",
		},
		{ kind: "rect", x: 96, y: 20, w: 38, h: 68, r: 9, tone: "ink" },
		{
			kind: "rect",
			x: 99,
			y: 23,
			w: 32,
			h: 62,
			r: 7,
			tone: "surface",
		},
		{ kind: "rect", x: 52, y: 8, w: 56, h: 84, r: 11, tone: "ink" },
		{
			kind: "rect",
			x: 55,
			y: 11,
			w: 50,
			h: 78,
			r: 9,
			tone: "surface",
		},
		txt("Today", 80, 36, 7, "ink", { align: "center", font: "semibold" }),
		{ kind: "line", x1: 64, y1: 50, x2: 96, y2: 50, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 64, y1: 62, x2: 90, y2: 62, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 64, y1: 74, x2: 84, y2: 74, tone: "label", weight: 1.3 },
	],
	chart: appShell([
		txt("MRR", 58, 36, 6, "muted", { font: "mono", tracking: 1 }),
		txt("$48,210", 58, 50, 12, "ink", { font: "semibold", tracking: -0.4 }),
		...usageBars(58, 58, 78, 26, [38, 44, 41, 52, 49, 58, 55, 63, 60, 71, 68, 77, 74, 86]),
	]),
	board: appShell([
		{ kind: "rect", x: 56, y: 30, w: 24, h: 58, r: 3, tone: "hairline" },
		{ kind: "rect", x: 84, y: 30, w: 24, h: 58, r: 3, tone: "hairline" },
		{ kind: "rect", x: 112, y: 30, w: 24, h: 58, r: 3, tone: "hairline" },
		{ kind: "rect", x: 58, y: 36, w: 20, h: 12, r: 2, tone: "surface" },
		{ kind: "rect", x: 58, y: 51, w: 20, h: 12, r: 2, tone: "surface" },
		{ kind: "rect", x: 86, y: 36, w: 20, h: 12, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 114, y: 36, w: 20, h: 12, r: 2, tone: "surface" },
		{ kind: "rect", x: 114, y: 51, w: 20, h: 12, r: 2, tone: "surface" },
		{ kind: "rect", x: 114, y: 66, w: 20, h: 12, r: 2, tone: "surface" },
		{ kind: "line", x1: 61, y1: 41, x2: 73, y2: 41, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 89, y1: 41, x2: 101, y2: 41, tone: "accent", weight: 1.2 },
		{ kind: "line", x1: 117, y1: 41, x2: 129, y2: 41, tone: "label", weight: 1.2 },
	]),
	gantt: appShell([
		{ kind: "line", x1: 56, y1: 34, x2: 136, y2: 34, tone: "hairline", weight: 1 },
		{ kind: "rect", x: 60, y: 40, w: 40, h: 8, r: 2, tone: "accent" },
		{ kind: "rect", x: 72, y: 54, w: 34, h: 8, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 106, y: 54, w: 14, h: 8, r: 2, tone: "hairline" },
		{ kind: "rect", x: 88, y: 68, w: 42, h: 8, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 64, y: 82, w: 26, h: 8, r: 2, tone: "accent" },
		{ kind: "line", x1: 98, y1: 30, x2: 98, y2: 94, tone: "accent", weight: 1.2 },
		{ kind: "circle", cx: 98, cy: 30, r: 2.4, tone: "accent" },
	]),
	sparkline: appShell([
		txt("p95", 58, 38, 6, "muted", { font: "mono" }),
		txt("142 ms", 58, 52, 11, "ink", { font: "semibold" }),
		...sparkPath(58, 62, 78, 20, [9, 11, 10, 13, 12, 15, 14, 16, 15, 18, 17, 20, 19, 22]),
	]),
	"stat-card": appShell([
		{ kind: "rect", x: 54, y: 32, w: 84, h: 48, r: 8, tone: "surface", ring: true },
		txt("Active seats", 62, 46, 6, "muted", { font: "mono" }),
		txt("64", 62, 64, 16, "ink", { font: "semibold", tracking: -0.6 }),
	]),
	table: appShell([
		...tableRows(54, 30, 86, [
			["Host", "p95"],
			["api.dev", "88"],
			["app.dev", "142"],
			["eu-west", "1.2s"],
		]),
	]),
	switch: windowScene([
		txt("Notifications", 40, 48, 8, "ink", { font: "semibold" }),
		{ kind: "rect", x: 108, y: 42, w: 28, h: 16, r: 8, tone: "accent" },
		{ kind: "circle", cx: 128, cy: 50, r: 6, tone: "surface" },
	]),
	"character-count": windowScene([
		{ kind: "rect", x: 28, y: 30, w: 104, h: 30, r: 8, tone: "surface", ring: true },
		{ kind: "line", x1: 36, y1: 40, x2: 120, y2: 40, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 36, y1: 50, x2: 96, y2: 50, tone: "label", weight: 1.3 },
		{ kind: "circle", cx: 86, cy: 74, r: 7, tone: "hairline" },
		{ kind: "stroke", d: "M86 67 A7 7 0 1 1 79.5 76.5", weight: 2, tone: "accent" },
		txt("14", 86, 77, 6, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 100, y: 66, w: 32, h: 16, r: 8, tone: "accent" },
	]),
	"section-bar": deviceScene([
		{ kind: "rect", x: 56, y: 26, w: 18, h: 8, r: 4, tone: "ink" },
		{ kind: "rect", x: 77, y: 26, w: 16, h: 8, r: 4, tone: "hairline" },
		{ kind: "rect", x: 96, y: 26, w: 12, h: 8, r: 4, tone: "hairline" },
		{ kind: "line", x1: 54, y1: 38, x2: 106, y2: 38, tone: "hairline", weight: 1 },
		txt("Popular", 58, 48, 5, "ink", { font: "semibold" }),
		{ kind: "rect", x: 58, y: 52, w: 44, h: 10, r: 3, tone: "label" },
		{ kind: "rect", x: 58, y: 65, w: 44, h: 10, r: 3, tone: "label" },
		txt("Ramen", 58, 84, 5, "ink", { font: "semibold" }),
	]),
	"day-strip": deviceScene([
		txt("Nov", 62, 30, 7, "ink", { font: "semibold" }),
		{ kind: "rect", x: 58, y: 38, w: 10, h: 16, r: 3, tone: "hairline" },
		{ kind: "rect", x: 70, y: 38, w: 10, h: 16, r: 3, tone: "hairline" },
		{ kind: "rect", x: 82, y: 38, w: 10, h: 16, r: 3, tone: "accent" },
		{ kind: "rect", x: 94, y: 38, w: 10, h: 16, r: 3, tone: "hairline" },
		{ kind: "circle", cx: 75, cy: 50, r: 1.2, tone: "accent" },
		{ kind: "circle", cx: 99, cy: 50, r: 1.2, tone: "accent" },
		{ kind: "line", x1: 60, y1: 66, x2: 100, y2: 66, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 60, y1: 76, x2: 92, y2: 76, tone: "label", weight: 1.4 },
	]),
	"quantity-stepper": windowScene([
		{ kind: "rect", x: 50, y: 48, w: 60, h: 20, r: 10, tone: "hairline" },
		{ kind: "circle", cx: 61, cy: 58, r: 7, tone: "label" },
		txt("2", 80, 61, 8, "ink", { align: "center", font: "semibold" }),
		{ kind: "circle", cx: 99, cy: 58, r: 7, tone: "label" },
		{ kind: "line", x1: 58, y1: 58, x2: 64, y2: 58, tone: "ink", weight: 1.4 },
		{ kind: "line", x1: 96, y1: 58, x2: 102, y2: 58, tone: "ink", weight: 1.4 },
		{ kind: "line", x1: 99, y1: 55, x2: 99, y2: 61, tone: "ink", weight: 1.4 },
	]),
	"option-group": windowScene([
		txt("Tortilla", 34, 34, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 104, y: 29, w: 24, h: 7, r: 3.5, tone: "ink" },
		{ kind: "circle", cx: 38, cy: 48, r: 3, tone: "accent" },
		{ kind: "line", x1: 46, y1: 48, x2: 80, y2: 48, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 38, cy: 60, r: 3, tone: "hairline" },
		{ kind: "line", x1: 46, y1: 60, x2: 74, y2: 60, tone: "label", weight: 1.4 },
		txt("+$0.50", 126, 62, 5, "muted", { align: "end" }),
		{ kind: "rect", x: 35, y: 69, w: 6, h: 6, r: 1.5, tone: "hairline" },
		{ kind: "line", x1: 46, y1: 72, x2: 84, y2: 72, tone: "label", weight: 1.4 },
	]),
	"item-options-dialog": deviceScene([
		{ kind: "rect", x: 52, y: 36, w: 56, h: 18, r: 4, tone: "accent" },
		{ kind: "line", x1: 58, y1: 60, x2: 90, y2: 60, tone: "ink", weight: 1.8 },
		{ kind: "circle", cx: 61, cy: 68, r: 2, tone: "accent" },
		{ kind: "line", x1: 66, y1: 68, x2: 92, y2: 68, tone: "label", weight: 1.2 },
		{ kind: "circle", cx: 61, cy: 75, r: 2, tone: "hairline" },
		{ kind: "line", x1: 66, y1: 75, x2: 88, y2: 75, tone: "label", weight: 1.2 },
		{ kind: "rect", x: 56, y: 82, w: 48, h: 8, r: 4, tone: "accent" },
	]),
	"menu-item-card": windowScene([
		{ kind: "rect", x: 28, y: 34, w: 104, h: 46, r: 6, tone: "surface", ring: true },
		txt("Al pastor trio", 36, 47, 6, "ink", { font: "semibold" }),
		{ kind: "line", x1: 36, y1: 55, x2: 82, y2: 55, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 36, y1: 61, x2: 74, y2: 61, tone: "label", weight: 1.2 },
		txt("$11.50", 36, 72, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 94, y: 40, w: 32, h: 32, r: 5, tone: "accent" },
		{ kind: "circle", cx: 124, cy: 70, r: 5, tone: "surface", ring: true },
	]),
	"cart-line": windowScene([
		{ kind: "rect", x: 30, y: 40, w: 16, h: 16, r: 4, tone: "accent" },
		{ kind: "line", x1: 52, y1: 44, x2: 88, y2: 44, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 52, y1: 51, x2: 80, y2: 51, tone: "label", weight: 1.2 },
		{ kind: "rect", x: 98, y: 42, w: 32, h: 12, r: 6, tone: "hairline" },
		{ kind: "line", x1: 28, y1: 64, x2: 132, y2: 64, tone: "hairline", weight: 1 },
		{ kind: "rect", x: 30, y: 70, w: 16, h: 16, r: 4, tone: "label" },
		{ kind: "line", x1: 52, y1: 75, x2: 82, y2: 75, tone: "ink", weight: 1.6 },
		{ kind: "rect", x: 98, y: 72, w: 32, h: 12, r: 6, tone: "hairline" },
	]),
	price: windowScene([
		txt("$36.00", 34, 52, 12, "ink", { font: "semibold" }),
		txt("$45.00", 84, 51, 7, "muted"),
		{ kind: "line", x1: 83, y1: 48.5, x2: 106, y2: 48.5, tone: "muted", weight: 1 },
		{ kind: "rect", x: 34, y: 60, w: 34, h: 10, r: 5, tone: "accent" },
		txt("Save 20%", 51, 67, 5, "surface", { align: "center", font: "semibold" }),
		{ kind: "line", x1: 34, y1: 80, x2: 96, y2: 80, tone: "label", weight: 1.3 },
	]),
	"product-card": windowScene([
		{ kind: "rect", x: 34, y: 28, w: 40, h: 46, r: 4, tone: "accent" },
		{ kind: "circle", cx: 68, cy: 34, r: 4, tone: "surface", ring: true },
		{ kind: "line", x1: 34, y1: 80, x2: 66, y2: 80, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 34, y1: 86, x2: 54, y2: 86, tone: "label", weight: 1.2 },
		{ kind: "rect", x: 86, y: 28, w: 40, h: 46, r: 4, tone: "label" },
		{ kind: "line", x1: 86, y1: 80, x2: 116, y2: 80, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 86, y1: 86, x2: 104, y2: 86, tone: "label", weight: 1.2 },
	]),
	"variant-picker": windowScene([
		txt("Frame", 32, 34, 6, "ink", { font: "semibold" }),
		{ kind: "circle", cx: 38, cy: 46, r: 6, tone: "accent", ring: true },
		{ kind: "circle", cx: 54, cy: 46, r: 6, tone: "ink" },
		{ kind: "circle", cx: 70, cy: 46, r: 6, tone: "label" },
		{ kind: "line", x1: 65.5, y1: 50.5, x2: 74.5, y2: 41.5, tone: "surface", weight: 1.2 },
		txt("Size", 32, 64, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 32, y: 70, w: 24, h: 11, r: 5.5, tone: "hairline" },
		{ kind: "rect", x: 60, y: 70, w: 24, h: 11, r: 5.5, tone: "accent" },
		{ kind: "rect", x: 88, y: 70, w: 24, h: 11, r: 5.5, tone: "hairline" },
	]),
	"product-gallery": windowScene([
		{ kind: "rect", x: 30, y: 28, w: 14, h: 17, r: 2, tone: "accent" },
		{ kind: "rect", x: 30, y: 48, w: 14, h: 17, r: 2, tone: "label" },
		{ kind: "rect", x: 30, y: 68, w: 14, h: 17, r: 2, tone: "label" },
		{ kind: "rect", x: 50, y: 28, w: 52, h: 57, r: 4, tone: "accent" },
		{ kind: "circle", cx: 94, cy: 77, r: 5, tone: "surface", ring: true },
		{ kind: "line", x1: 108, y1: 34, x2: 130, y2: 34, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 108, y1: 42, x2: 124, y2: 42, tone: "label", weight: 1.2 },
	]),
	"facet-filters": windowScene([
		txt("Colour", 32, 34, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 32, y: 40, w: 6, h: 6, r: 1.5, tone: "accent" },
		{ kind: "line", x1: 44, y1: 43, x2: 74, y2: 43, tone: "label", weight: 1.3 },
		txt("24", 128, 45, 5, "muted", { align: "end" }),
		{ kind: "rect", x: 32, y: 51, w: 6, h: 6, r: 1.5, tone: "hairline" },
		{ kind: "line", x1: 44, y1: 54, x2: 68, y2: 54, tone: "label", weight: 1.3 },
		txt("17", 128, 56, 5, "muted", { align: "end" }),
		{ kind: "line", x1: 30, y1: 64, x2: 130, y2: 64, tone: "hairline", weight: 1 },
		txt("Price", 32, 74, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 32, y: 78, w: 44, h: 9, r: 3, tone: "surface", ring: true },
		{ kind: "rect", x: 82, y: 78, w: 44, h: 9, r: 3, tone: "surface", ring: true },
	]),
	"sort-select": windowScene([
		txt("Sort by", 36, 59, 6, "muted"),
		{ kind: "rect", x: 62, y: 50, w: 62, h: 14, r: 4, tone: "surface", ring: true },
		txt("Newest", 68, 59, 6, "ink"),
		{ kind: "stroke", d: "M112 55.5 L115 58.5 L118 55.5", tone: "muted", weight: 1.2 },
	]),
	"cart-drawer": windowScene([
		{ kind: "rect", x: 92, y: 24, w: 46, h: 68, r: 3, tone: "surface", ring: true },
		txt("Your bag", 97, 34, 5.5, "ink", { font: "semibold" }),
		{ kind: "rect", x: 97, y: 40, w: 10, h: 10, r: 2.5, tone: "accent" },
		{ kind: "line", x1: 111, y1: 43, x2: 130, y2: 43, tone: "ink", weight: 1.3 },
		{ kind: "line", x1: 111, y1: 48, x2: 124, y2: 48, tone: "label", weight: 1 },
		{ kind: "rect", x: 97, y: 55, w: 10, h: 10, r: 2.5, tone: "label" },
		{ kind: "line", x1: 111, y1: 58, x2: 128, y2: 58, tone: "ink", weight: 1.3 },
		{ kind: "rect", x: 97, y: 80, w: 36, h: 8, r: 4, tone: "accent" },
		{ kind: "rect", x: 30, y: 34, w: 12, h: 12, r: 6, tone: "hairline" },
		{ kind: "circle", cx: 42, cy: 34, r: 3.5, tone: "accent" },
	]),
	"promo-code": windowScene([
		txt("Have a promo code?", 32, 38, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 32, y: 45, w: 62, h: 13, r: 4, tone: "surface", ring: true },
		{ kind: "rect", x: 98, y: 45, w: 30, h: 13, r: 4, tone: "hairline" },
		txt("Apply", 113, 54, 5.5, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 32, y: 66, w: 52, h: 11, r: 5.5, tone: "accent" },
		txt("WALLS10", 46, 73.5, 5, "surface", { font: "semibold" }),
	]),
	"shipping-estimate": windowScene([
		txt("Estimate shipping", 32, 34, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 32, y: 40, w: 62, h: 11, r: 3, tone: "surface", ring: true },
		{ kind: "rect", x: 98, y: 40, w: 30, h: 11, r: 3, tone: "hairline" },
		{ kind: "line", x1: 32, y1: 61, x2: 64, y2: 61, tone: "ink", weight: 1.4 },
		txt("£4.95", 128, 63, 5.5, "ink", { align: "end" }),
		{ kind: "line", x1: 30, y1: 69, x2: 130, y2: 69, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 32, y1: 77, x2: 70, y2: 77, tone: "ink", weight: 1.4 },
		txt("£12.00", 128, 79, 5.5, "ink", { align: "end" }),
	]),
	"order-summary": windowScene([
		{ kind: "rect", x: 30, y: 26, w: 100, h: 64, r: 5, tone: "chrome" },
		txt("Order summary", 36, 36, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 36, y: 42, w: 10, h: 10, r: 2.5, tone: "accent" },
		{ kind: "line", x1: 50, y1: 47, x2: 84, y2: 47, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 36, y1: 60, x2: 70, y2: 60, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 106, y1: 60, x2: 124, y2: 60, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 36, y1: 70, x2: 124, y2: 70, tone: "hairline", weight: 1 },
		txt("Total", 36, 81, 6, "ink", { font: "semibold" }),
		txt("€84.15", 124, 81, 6, "ink", { align: "end", font: "semibold" }),
	]),
	"checkout-layout": windowScene([
		{ kind: "circle", cx: 34, cy: 32, r: 3, tone: "accent" },
		{ kind: "line", x1: 38, y1: 32, x2: 50, y2: 32, tone: "accent", weight: 1.2 },
		{ kind: "circle", cx: 54, cy: 32, r: 3, tone: "accent" },
		{ kind: "line", x1: 58, y1: 32, x2: 70, y2: 32, tone: "hairline", weight: 1.2 },
		{ kind: "circle", cx: 74, cy: 32, r: 3, tone: "hairline" },
		{ kind: "rect", x: 30, y: 42, w: 56, h: 9, r: 2.5, tone: "surface", ring: true },
		{ kind: "rect", x: 30, y: 56, w: 56, h: 9, r: 2.5, tone: "surface", ring: true },
		{ kind: "rect", x: 30, y: 74, w: 40, h: 10, r: 3, tone: "accent" },
		{ kind: "rect", x: 94, y: 26, w: 38, h: 62, r: 4, tone: "chrome" },
		{ kind: "line", x1: 100, y1: 36, x2: 124, y2: 36, tone: "ink", weight: 1.4 },
		{ kind: "line", x1: 100, y1: 46, x2: 126, y2: 46, tone: "label", weight: 1.1 },
		{ kind: "line", x1: 100, y1: 54, x2: 120, y2: 54, tone: "label", weight: 1.1 },
		{ kind: "line", x1: 100, y1: 76, x2: 126, y2: 76, tone: "ink", weight: 1.4 },
	]),
	"fulfilment-note": windowScene([
		{
			kind: "stroke",
			d: "M40 40 L40 48 M36.5 45 L40 48.5 L43.5 45 M35 51 L45 51",
			tone: "muted",
			weight: 1.3,
		},
		{ kind: "line", x1: 52, y1: 46, x2: 104, y2: 46, tone: "label", weight: 1.4 },
		{ kind: "rect", x: 34.5, y: 60, w: 8, h: 7, r: 1, tone: "muted" },
		{ kind: "rect", x: 42.5, y: 62, w: 4, h: 5, r: 1, tone: "muted" },
		{ kind: "line", x1: 52, y1: 64, x2: 116, y2: 64, tone: "label", weight: 1.4 },
	]),
	"question-list": windowScene([
		txt("Q:", 32, 38, 6.5, "ink", { font: "semibold" }),
		{ kind: "line", x1: 44, y1: 36, x2: 112, y2: 36, tone: "ink", weight: 1.6 },
		txt("A:", 44, 52, 6, "muted", { font: "semibold" }),
		{ kind: "line", x1: 55, y1: 50, x2: 124, y2: 50, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 55, y1: 57, x2: 96, y2: 57, tone: "label", weight: 1.2 },
		{ kind: "rect", x: 55, y: 61, w: 16, h: 6, r: 3, tone: "accent" },
		{ kind: "line", x1: 30, y1: 73, x2: 130, y2: 73, tone: "hairline", weight: 1 },
		txt("Q:", 32, 85, 6.5, "ink", { font: "semibold" }),
		{ kind: "line", x1: 44, y1: 83, x2: 98, y2: 83, tone: "ink", weight: 1.6 },
	]),
	rating: windowScene(
		[0, 1, 2, 3, 4].map((index): Shape => ({
			kind: "circle",
			cx: 46 + index * 14,
			cy: 58,
			r: 5,
			tone: index < 4 ? "accent" : "hairline",
		})),
	),
	"rating-input": windowScene([
		txt("Your rating", 40, 42, 6, "ink", { font: "semibold" }),
		...[0, 1, 2, 3, 4].map((index): Shape => ({
			kind: "rect",
			x: 40 + index * 17,
			y: 50,
			w: 13,
			h: 13,
			r: 3,
			tone: index < 3 ? "accent" : "hairline",
		})),
	]),
	"review-card": windowScene([
		...[0, 1, 2, 3, 4].map((index): Shape => ({
			kind: "circle",
			cx: 36 + index * 7,
			cy: 34,
			r: 2.6,
			tone: "accent",
		})),
		txt("Better in person", 32, 47, 6, "ink", { font: "semibold" }),
		{ kind: "line", x1: 32, y1: 55, x2: 128, y2: 55, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 32, y1: 62, x2: 110, y2: 62, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 32, y1: 76, x2: 54, y2: 76, tone: "ink", weight: 1.3 },
		{ kind: "line", x1: 60, y1: 76, x2: 82, y2: 76, tone: "muted", weight: 1.1 },
		{ kind: "rect", x: 106, y: 71, w: 22, h: 10, r: 5, tone: "hairline" },
	]),
	"order-tracker": windowScene([
		{ kind: "line", x1: 44, y1: 34, x2: 44, y2: 82, tone: "hairline", weight: 1.6 },
		{ kind: "line", x1: 44, y1: 34, x2: 44, y2: 58, tone: "accent", weight: 1.6 },
		{ kind: "circle", cx: 44, cy: 34, r: 4, tone: "accent" },
		{ kind: "circle", cx: 44, cy: 46, r: 4, tone: "accent" },
		{ kind: "circle", cx: 44, cy: 58, r: 4.5, tone: "surface", ring: true },
		{ kind: "circle", cx: 44, cy: 70, r: 4, tone: "hairline" },
		{ kind: "circle", cx: 44, cy: 82, r: 4, tone: "hairline" },
		{ kind: "line", x1: 54, y1: 34, x2: 92, y2: 34, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 54, y1: 46, x2: 98, y2: 46, tone: "label", weight: 1.3 },
		txt("Being prepared", 54, 60, 6, "ink", { font: "semibold" }),
		{ kind: "line", x1: 54, y1: 70, x2: 88, y2: 70, tone: "hairline", weight: 1.3 },
		{ kind: "line", x1: 54, y1: 82, x2: 80, y2: 82, tone: "hairline", weight: 1.3 },
	]),
	agenda: appShell([
		txt("Wed 18", 58, 36, 7, "ink", { font: "semibold" }),
		{ kind: "circle", cx: 61, cy: 46, r: 2, tone: "accent" },
		{ kind: "line", x1: 67, y1: 46, x2: 128, y2: 46, tone: "label", weight: 1.3 },
		{ kind: "circle", cx: 61, cy: 56, r: 2, tone: "muted" },
		{ kind: "line", x1: 67, y1: 56, x2: 118, y2: 56, tone: "label", weight: 1.3 },
		txt("Thu 19", 58, 72, 7, "ink", { font: "semibold" }),
		{ kind: "circle", cx: 61, cy: 82, r: 2, tone: "accent" },
		{ kind: "line", x1: 67, y1: 82, x2: 124, y2: 82, tone: "label", weight: 1.3 },
	]),
	"free-busy": appShell([
		{ kind: "circle", cx: 60, cy: 40, r: 3, tone: "muted" },
		{ kind: "circle", cx: 60, cy: 56, r: 3, tone: "muted" },
		{ kind: "circle", cx: 60, cy: 72, r: 3, tone: "muted" },
		{ kind: "rect", x: 70, y: 36, w: 18, h: 8, r: 2, tone: "label" },
		{ kind: "rect", x: 112, y: 52, w: 22, h: 8, r: 2, tone: "label" },
		{ kind: "rect", x: 72, y: 68, w: 12, h: 8, r: 2, tone: "label" },
		{ kind: "rect", x: 92, y: 32, w: 16, h: 48, r: 3, tone: "accent", ring: true },
	]),
	"month-view": appShell([
		...[0, 1, 2, 3].flatMap((row) =>
			[0, 1, 2, 3, 4, 5].map((column): Shape => ({
				kind: "rect",
				x: 56 + column * 14,
				y: 32 + row * 15,
				w: 12,
				h: 13,
				r: 2,
				tone: "hairline",
			})),
		),
		{ kind: "rect", x: 70, y: 39, w: 38, h: 3, r: 1.5, tone: "accent" },
		{ kind: "circle", cx: 104, cy: 66, r: 4, tone: "accent" },
		{ kind: "line", x1: 58, y1: 72, x2: 66, y2: 72, tone: "label", weight: 1.2 },
	]),
	"route-dialog": windowScene([
		{ kind: "rect", x: 20, y: 20, w: 120, h: 80, r: 0, tone: "hairline" },
		{ kind: "rect", x: 42, y: 32, w: 76, h: 56, r: 8, tone: "surface", ring: true },
		txt("Edit event", 50, 46, 7, "ink", { font: "semibold" }),
		{ kind: "rect", x: 50, y: 52, w: 60, h: 10, r: 3, tone: "hairline" },
		{ kind: "rect", x: 90, y: 72, w: 20, h: 9, r: 4, tone: "accent" },
	]),
	"time-grid": appShell([
		{ kind: "line", x1: 56, y1: 40, x2: 138, y2: 40, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 82, y1: 30, x2: 82, y2: 94, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 110, y1: 30, x2: 110, y2: 94, tone: "hairline", weight: 1 },
		{ kind: "rect", x: 58, y: 33, w: 50, h: 5, r: 1.5, tone: "accent" },
		{ kind: "rect", x: 58, y: 46, w: 22, h: 18, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 84, y: 48, w: 12, h: 16, r: 2, tone: "accent" },
		{ kind: "rect", x: 97, y: 54, w: 12, h: 14, r: 2, tone: "surface", ring: true },
		{ kind: "rect", x: 112, y: 62, w: 24, h: 20, r: 2, tone: "surface", ring: true },
		{ kind: "line", x1: 82, y1: 74, x2: 110, y2: 74, tone: "accent", weight: 1.4 },
		{ kind: "circle", cx: 82, cy: 74, r: 2, tone: "accent" },
	]),
	"year-view": appShell([
		...[0, 1, 2].flatMap((month) =>
			[0, 1, 2, 3].flatMap((row) =>
				[0, 1, 2, 3, 4].map((column): Shape => ({
					kind: "circle",
					cx: 60 + month * 27 + column * 5,
					cy: 40 + row * 9,
					r: 1.6,
					tone: (month * 7 + row * 3 + column) % 4 === 0 ? "accent" : "hairline",
				})),
			),
		),
		...[0, 1, 2].map((month) =>
			txt(["Sep", "Oct", "Nov"][month] ?? "", 58 + month * 27, 32, 5, "muted"),
		),
		{ kind: "circle", cx: 114, cy: 58, r: 3, tone: "accent" },
	]),
	"tab-bar": deviceScene([
		{ kind: "line", x1: 62, y1: 30, x2: 98, y2: 30, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 62, y1: 40, x2: 92, y2: 40, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 62, y1: 50, x2: 96, y2: 50, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 55, y1: 79, x2: 105, y2: 79, tone: "hairline", weight: 1 },
		{ kind: "circle", cx: 64, cy: 85, r: 2.6, tone: "accent" },
		{ kind: "circle", cx: 75, cy: 85, r: 2.6, tone: "muted" },
		{ kind: "circle", cx: 86, cy: 85, r: 2.6, tone: "muted" },
		{ kind: "circle", cx: 97, cy: 85, r: 2.6, tone: "muted" },
		{ kind: "circle", cx: 89, cy: 82.5, r: 1.6, tone: "accent" },
	]),
	"optimistic-toggle": deviceScene([
		txt("Today", 80, 28, 8, "ink", { align: "center", font: "semibold" }),
		...phoneRow(58, 38, "Oat milk", true),
		...phoneRow(58, 54, "Bins", false),
		...phoneRow(58, 70, "Tacos", false),
	]),
	checkbox: windowScene([
		{ kind: "rect", x: 44, y: 42, w: 16, h: 16, r: 4, tone: "accent" },
		{ kind: "stroke", d: "M48 50 L51 53 L56 46", weight: 1.6, tone: "surface" },
		txt("Include VAT", 68, 53, 8, "ink", { font: "semibold" }),
	]),
	tabs: windowScene([
		txt("Overview", 36, 40, 7, "ink", { font: "semibold" }),
		txt("Usage", 78, 40, 7, "muted"),
		txt("Billing", 110, 40, 7, "muted"),
		{ kind: "line", x1: 34, y1: 46, x2: 70, y2: 46, tone: "accent", weight: 2 },
		{ kind: "line", x1: 34, y1: 52, x2: 126, y2: 52, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 40, y1: 64, x2: 120, y2: 64, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 40, y1: 74, x2: 108, y2: 74, tone: "label", weight: 1.3 },
	]),
	"docs-layout": docsScene(),
	"code-block": docsScene([
		{ kind: "rect", x: 68, y: 48, w: 64, h: 32, r: 6, tone: "ink" },
		{ kind: "line", x1: 76, y1: 58, x2: 118, y2: 58, tone: "muted", weight: 1.3 },
		{ kind: "line", x1: 76, y1: 66, x2: 124, y2: 66, tone: "accent", weight: 1.3 },
		{ kind: "line", x1: 76, y1: 74, x2: 108, y2: 74, tone: "muted", weight: 1.3 },
	]),
	"landing-hero": landingHeroScene(),
	"site-header": windowScene([
		{ kind: "rect", x: 28, y: 34, w: 18, h: 8, r: 3, tone: "accent" },
		{ kind: "line", x1: 56, y1: 38, x2: 72, y2: 38, tone: "muted", weight: 1.3 },
		{ kind: "line", x1: 80, y1: 38, x2: 96, y2: 38, tone: "muted", weight: 1.3 },
		{ kind: "rect", x: 108, y: 32, w: 28, h: 12, r: 6, tone: "accent" },
		{ kind: "line", x1: 28, y1: 52, x2: 132, y2: 52, tone: "hairline", weight: 1 },
		{ kind: "line", x1: 36, y1: 64, x2: 100, y2: 64, tone: "ink", weight: 2 },
		{ kind: "line", x1: 36, y1: 74, x2: 120, y2: 74, tone: "label", weight: 1.4 },
	]),
	message: chatScene(),
	activity: windowScene([
		txt("Thinking", 32, 38, 7, "muted", { font: "semibold" }),
		{ kind: "circle", cx: 36, cy: 52, r: 3, tone: "label" },
		{ kind: "line", x1: 44, y1: 52, x2: 104, y2: 52, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 36, cy: 64, r: 3, tone: "label" },
		{ kind: "line", x1: 44, y1: 64, x2: 92, y2: 64, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 36, cy: 76, r: 3, tone: "accent" },
		{ kind: "line", x1: 44, y1: 76, x2: 112, y2: 76, tone: "accent", weight: 1.4 },
	]),
	"composer-format": windowScene([
		{ kind: "rect", x: 28, y: 34, w: 104, h: 44, r: 12, tone: "surface", ring: true },
		txt("Ship the", 38, 50, 7, "muted"),
		{ kind: "rect", x: 69, y: 43, w: 30, h: 10, r: 2, tone: "label" },
		txt("release", 71, 50, 7, "ink", { font: "semibold" }),
		txt("B", 40, 70, 7, "ink", { font: "semibold" }),
		txt("I", 51, 70, 7, "muted"),
		txt("S", 59, 70, 7, "muted"),
		txt("<>", 68, 70, 6, "muted", { font: "mono" }),
		{ kind: "circle", cx: 120, cy: 67, r: 6, tone: "accent" },
		{
			kind: "stroke",
			d: "M120 70 L120 64 M117 66.5 L120 63.5 L123 66.5",
			weight: 1.4,
			tone: "surface",
		},
	]),
	"mention-menu": windowScene([
		{ kind: "rect", x: 28, y: 28, w: 72, h: 34, r: 6, tone: "surface", ring: true },
		{ kind: "rect", x: 32, y: 32, w: 64, h: 12, r: 4, tone: "label" },
		{ kind: "rect", x: 35, y: 34, w: 8, h: 8, r: 2, tone: "accent" },
		txt("Ana Lima", 47, 40, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 35, y: 48, w: 8, h: 8, r: 2, tone: "muted" },
		txt("Marco Diaz", 47, 54, 6, "muted"),
		{ kind: "rect", x: 28, y: 66, w: 104, h: 18, r: 9, tone: "surface", ring: true },
		txt("Ping @an", 38, 77, 6.5, "ink"),
	]),
	"message-group": windowScene([
		{ kind: "rect", x: 26, y: 30, w: 10, h: 10, r: 3, tone: "accent" },
		txt("Mira Okafor", 41, 34, 6, "ink", { font: "semibold" }),
		txt("10:42", 80, 34, 5, "muted"),
		{ kind: "rect", x: 41, y: 38, w: 80, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 41, y: 45, w: 62, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 22, y: 52, w: 116, h: 14, r: 2, tone: "chrome" },
		txt("10:43", 24, 60, 4.5, "muted"),
		{ kind: "rect", x: 41, y: 56, w: 70, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 100, y: 48, w: 30, h: 9, r: 3, tone: "surface", ring: true },
		{ kind: "rect", x: 26, y: 72, w: 10, h: 10, r: 3, tone: "muted" },
		{ kind: "rect", x: 41, y: 73, w: 30, h: 3, r: 1.5, tone: "ink" },
		{ kind: "rect", x: 41, y: 80, w: 74, h: 3, r: 1.5, tone: "label" },
	]),
	"reaction-bar": windowScene([
		{ kind: "rect", x: 30, y: 34, w: 86, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 30, y: 41, w: 60, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 30, y: 52, w: 24, h: 11, r: 5.5, tone: "chrome", ring: true },
		{ kind: "circle", cx: 37, cy: 57.5, r: 2.5, tone: "accent" },
		txt("4", 44, 60, 5.5, "accent", { font: "semibold" }),
		{ kind: "rect", x: 58, y: 52, w: 22, h: 11, r: 5.5, tone: "surface", ring: true },
		{ kind: "circle", cx: 65, cy: 57.5, r: 2.5, tone: "label" },
		txt("1", 71, 60, 5.5, "muted"),
		{ kind: "rect", x: 84, y: 52, w: 22, h: 11, r: 5.5, tone: "surface", ring: true },
		{ kind: "circle", cx: 91, cy: 57.5, r: 2.5, tone: "label" },
		txt("2", 97, 60, 5.5, "muted"),
		{ kind: "circle", cx: 114, cy: 57.5, r: 5, tone: "surface", ring: true },
	]),
	"typing-indicator": windowScene([
		{ kind: "rect", x: 30, y: 32, w: 70, h: 3, r: 1.5, tone: "label" },
		{ kind: "rect", x: 30, y: 39, w: 50, h: 3, r: 1.5, tone: "label" },
		{ kind: "circle", cx: 33, cy: 58, r: 2.2, tone: "muted" },
		{ kind: "circle", cx: 39, cy: 56, r: 2.2, tone: "accent" },
		{ kind: "circle", cx: 45, cy: 58, r: 2.2, tone: "muted" },
		txt("Mira is typing…", 52, 60, 6, "muted"),
		{ kind: "rect", x: 26, y: 68, w: 108, h: 16, r: 8, tone: "surface", ring: true },
	]),
	composer: windowScene([
		{ kind: "rect", x: 28, y: 40, w: 104, h: 34, r: 14, tone: "surface", ring: true },
		txt("Ask anything", 40, 54, 7, "muted"),
		{ kind: "circle", cx: 118, cy: 64, r: 6, tone: "accent" },
		{
			kind: "stroke",
			d: "M118 67 L118 61 M115 63.5 L118 60.5 L121 63.5",
			weight: 1.4,
			tone: "surface",
		},
	]),
	"composer-submit": windowScene([
		{ kind: "circle", cx: 64, cy: 56, r: 12, tone: "accent" },
		{ kind: "stroke", d: "M64 62 L64 50 M58 55 L64 49 L70 55", weight: 1.8, tone: "surface" },
		{ kind: "circle", cx: 98, cy: 56, r: 12, tone: "ink" },
		{ kind: "rect", x: 94, y: 52, w: 8, h: 8, r: 1.5, tone: "surface" },
	]),
	"color-picker": windowScene([
		{ kind: "rect", x: 36, y: 32, w: 56, h: 48, r: 8, tone: "accent" },
		{ kind: "rect", x: 100, y: 32, w: 10, h: 14, r: 3, tone: "surface", ring: true },
		{ kind: "rect", x: 100, y: 48, w: 10, h: 14, r: 3, tone: "label" },
		{ kind: "rect", x: 100, y: 64, w: 10, h: 16, r: 3, tone: "accent" },
		txt("#7C3AED", 36, 90, 6, "muted", { font: "mono" }),
	]),
	empty: appShell([
		{ kind: "circle", cx: 96, cy: 48, r: 10, tone: "label" },
		txt("No monitors yet", 96, 72, 7, "muted", { align: "center" }),
	]),
	accordion: windowScene([
		{ kind: "rect", x: 36, y: 30, w: 88, h: 16, r: 6, tone: "surface", ring: true },
		{ kind: "stroke", d: "M108 36 L112 40 L116 36", weight: 1.4, tone: "ink" },
		{ kind: "rect", x: 36, y: 50, w: 88, h: 14, r: 6, tone: "label" },
		{ kind: "rect", x: 36, y: 68, w: 88, h: 14, r: 6, tone: "label" },
	]),
	"app-shell": windowScene([
		{
			kind: "line",
			x1: 48,
			y1: WIN.y + WIN.chrome,
			x2: 48,
			y2: WIN.y + WIN.h,
			tone: "hairline",
			weight: 1,
		},
		{ kind: "rect", x: 24, y: WIN.y + WIN.chrome + 8, w: 16, h: 6, r: 3, tone: "accent" },
		{
			kind: "line",
			x1: 24,
			y1: WIN.y + WIN.chrome + 22,
			x2: 40,
			y2: WIN.y + WIN.chrome + 22,
			tone: "label",
			weight: 2.5,
		},
		{
			kind: "line",
			x1: 24,
			y1: WIN.y + WIN.chrome + 34,
			x2: 38,
			y2: WIN.y + WIN.chrome + 34,
			tone: "label",
			weight: 2.5,
		},
		{
			kind: "line",
			x1: 24,
			y1: WIN.y + WIN.chrome + 46,
			x2: 36,
			y2: WIN.y + WIN.chrome + 46,
			tone: "label",
			weight: 2.5,
		},
		{ kind: "rect", x: 56, y: 32, w: 80, h: 48, r: 8, tone: "surface", ring: true },
		txt("Overview", 64, 48, 7, "ink", { font: "semibold" }),
		{ kind: "line", x1: 64, y1: 58, x2: 120, y2: 58, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 64, y1: 68, x2: 108, y2: 68, tone: "label", weight: 1.3 },
	]),
	"app-shell-toggle": windowScene([
		{ kind: "rect", x: 24, y: WIN.y + WIN.chrome + 6, w: 14, h: 10, r: 3, tone: "accent" },
		{
			kind: "line",
			x1: 27,
			y1: WIN.y + WIN.chrome + 9,
			x2: 35,
			y2: WIN.y + WIN.chrome + 9,
			tone: "surface",
			weight: 1.4,
		},
		{
			kind: "line",
			x1: 27,
			y1: WIN.y + WIN.chrome + 12,
			x2: 35,
			y2: WIN.y + WIN.chrome + 12,
			tone: "surface",
			weight: 1.4,
		},
		{
			kind: "line",
			x1: 42,
			y1: WIN.y + WIN.chrome,
			x2: 42,
			y2: WIN.y + WIN.h,
			tone: "hairline",
			weight: 1,
		},
		{ kind: "rect", x: 26, y: WIN.y + WIN.chrome + 24, w: 10, h: 10, r: 3, tone: "label" },
		{ kind: "rect", x: 26, y: WIN.y + WIN.chrome + 38, w: 10, h: 10, r: 3, tone: "label" },
		{ kind: "rect", x: 26, y: WIN.y + WIN.chrome + 52, w: 10, h: 10, r: 3, tone: "label" },
		{ kind: "rect", x: 50, y: 32, w: 86, h: 48, r: 8, tone: "surface", ring: true },
		txt("Collapsed", 58, 52, 7, "muted", { font: "semibold" }),
		{ kind: "line", x1: 58, y1: 62, x2: 120, y2: 62, tone: "label", weight: 1.3 },
	]),
	calendar: windowScene([
		txt("March", 40, 34, 7, "ink", { font: "semibold" }),
		{ kind: "stroke", d: "M112 30 L116 34 L112 38", weight: 1.4, tone: "muted" },
		...calendarGrid(44, 42, 7, [10]),
	]),
	"range-calendar": windowScene([
		txt("Mar 12–18", 40, 34, 7, "ink", { font: "semibold" }),
		...calendarGrid(44, 42, 7, [9, 10, 11, 12, 13]),
	]),
	bento: windowScene([
		{ kind: "rect", x: 28, y: 28, w: 58, h: 52, r: 8, tone: "surface", ring: true },
		{ kind: "rect", x: 36, y: 36, w: 42, h: 16, r: 4, tone: "label" },
		txt("Monitors", 36, 64, 6, "ink", { font: "semibold" }),
		{ kind: "rect", x: 92, y: 28, w: 40, h: 24, r: 8, tone: "surface", ring: true },
		{ kind: "rect", x: 100, y: 34, w: 24, h: 6, r: 2, tone: "accent" },
		{ kind: "rect", x: 92, y: 56, w: 40, h: 24, r: 8, tone: "surface", ring: true },
		{ kind: "line", x1: 100, y1: 66, x2: 122, y2: 66, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 100, y1: 72, x2: 116, y2: 72, tone: "label", weight: 1.3 },
	]),
	input: windowScene([
		txt("Email", 40, 40, 6, "muted"),
		{ kind: "rect", x: 40, y: 46, w: 80, h: 18, r: 8, tone: "surface", ring: true },
		txt("you@acme.dev", 48, 58, 7, "ink", { font: "mono" }),
	]),
	sidebar: appShell([
		{ kind: "rect", x: 54, y: 32, w: 84, h: 48, r: 8, tone: "label" },
		txt("Workspace", 62, 48, 7, "ink", { font: "semibold" }),
		{ kind: "line", x1: 62, y1: 58, x2: 120, y2: 58, tone: "muted", weight: 1.3 },
		{ kind: "line", x1: 62, y1: 68, x2: 108, y2: 68, tone: "muted", weight: 1.3 },
	]),
	avatar: windowScene([
		{ kind: "circle", cx: 80, cy: 46, r: 14, tone: "label", ring: true },
		txt("SX", 80, 50, 8, "ink", { align: "center", font: "semibold" }),
		txt("Sergio X.", 80, 74, 7, "muted", { align: "center" }),
	]),
	"progress-bar": windowScene([
		txt("Uploading", 40, 42, 7, "ink", { font: "semibold" }),
		txt("72%", 120, 42, 7, "muted", { align: "end", font: "mono" }),
		{ kind: "rect", x: 40, y: 52, w: 80, h: 8, r: 4, tone: "label" },
		{ kind: "rect", x: 40, y: 52, w: 58, h: 8, r: 4, tone: "accent" },
	]),
	tooltip: windowScene([
		{ kind: "rect", x: 52, y: 36, w: 56, h: 20, r: 8, tone: "ink" },
		txt("Copied", 80, 49, 7, "surface", { align: "center", font: "semibold" }),
		{ kind: "path", d: "M74 56 L80 62 L86 56 Z", tone: "ink" },
		{ kind: "circle", cx: 80, cy: 74, r: 5, tone: "label" },
	]),
	"episode-list": windowScene([
		txt("1", 30, 46, 9, "muted", { font: "semibold" }),
		{ kind: "rect", x: 40, y: 34, w: 34, h: 19, r: 3, tone: "ink" },
		{ kind: "line", x1: 40, y1: 52, x2: 74, y2: 52, tone: "accent", weight: 2 },
		txt("Last Ferry", 80, 41, 7, "ink", { font: "semibold" }),
		txt("52m", 134, 41, 6, "muted", { align: "end" }),
		{ kind: "line", x1: 80, y1: 48, x2: 128, y2: 48, tone: "label", weight: 1.3 },
		{ kind: "rect", x: 24, y: 58, w: 114, h: 25, r: 5, tone: "label" },
		txt("2", 30, 74, 9, "muted", { font: "semibold" }),
		{ kind: "rect", x: 40, y: 61, w: 34, h: 19, r: 3, tone: "ink" },
		{ kind: "line", x1: 40, y1: 79, x2: 56, y2: 79, tone: "accent", weight: 2 },
		txt("Slack Water", 80, 68, 7, "ink", { font: "semibold" }),
		txt("47m", 134, 68, 6, "muted", { align: "end" }),
		{ kind: "line", x1: 80, y1: 75, x2: 120, y2: 75, tone: "hairline", weight: 1.3 },
	]),
	"video-card": windowScene([
		{ kind: "rect", x: 46, y: 28, w: 68, h: 38, r: 5, tone: "ink" },
		{ kind: "circle", cx: 92, cy: 46, r: 6, tone: "label" },
		{ kind: "rect", x: 50, y: 32, w: 22, h: 7, r: 2, tone: "surface" },
		{ kind: "line", x1: 46, y1: 65, x2: 82, y2: 65, tone: "accent", weight: 2.4 },
		{ kind: "line", x1: 82, y1: 65, x2: 114, y2: 65, tone: "label", weight: 2.4 },
		txt("Tidewater", 46, 77, 8, "ink", { font: "semibold" }),
		txt("S2:E3 · Lee Shore", 46, 86, 6, "muted"),
	]),
	"reel-feed": windowScene([
		{ kind: "rect", x: 60, y: 22, w: 40, h: 68, r: 4, tone: "ink" },
		{ kind: "rect", x: 60, y: 92, w: 40, h: 6, r: 2, tone: "label" },
		{ kind: "circle", cx: 92, cy: 56, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 92, cy: 65, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 92, cy: 74, r: 2.4, tone: "surface" },
		{ kind: "circle", cx: 67, cy: 79, r: 3, tone: "label" },
		{ kind: "line", x1: 73, y1: 79, x2: 85, y2: 79, tone: "surface", weight: 1.6 },
		{ kind: "line", x1: 64, y1: 84, x2: 86, y2: 84, tone: "label", weight: 1.2 },
		{ kind: "line", x1: 60, y1: 89, x2: 74, y2: 89, tone: "accent", weight: 1.6 },
		{ kind: "stroke", d: "M112 48 L116 44 L120 48", tone: "muted", weight: 1.4 },
		{ kind: "stroke", d: "M112 62 L116 66 L120 62", tone: "muted", weight: 1.4 },
	]),
	"story-ring": windowScene([
		{ kind: "circle", cx: 46, cy: 52, r: 13, tone: "accent" },
		{ kind: "circle", cx: 46, cy: 52, r: 11, tone: "surface" },
		{ kind: "circle", cx: 46, cy: 52, r: 9.5, tone: "ink" },
		{ kind: "circle", cx: 80, cy: 52, r: 13, tone: "accent" },
		{ kind: "circle", cx: 80, cy: 52, r: 11, tone: "surface" },
		{ kind: "circle", cx: 80, cy: 52, r: 9.5, tone: "label" },
		{ kind: "circle", cx: 114, cy: 52, r: 12, tone: "hairline" },
		{ kind: "circle", cx: 114, cy: 52, r: 11, tone: "surface" },
		{ kind: "circle", cx: 114, cy: 52, r: 9.5, tone: "label" },
		{ kind: "line", x1: 38, y1: 74, x2: 54, y2: 74, tone: "muted", weight: 1.4 },
		{ kind: "line", x1: 72, y1: 74, x2: 88, y2: 74, tone: "muted", weight: 1.4 },
		{ kind: "line", x1: 106, y1: 74, x2: 122, y2: 74, tone: "muted", weight: 1.4 },
	]),
	"story-viewer": windowScene([
		{ kind: "rect", x: 58, y: 20, w: 44, h: 76, r: 4, tone: "ink" },
		{ kind: "line", x1: 62, y1: 25, x2: 74, y2: 25, tone: "surface", weight: 1.4 },
		{ kind: "line", x1: 75, y1: 25, x2: 87, y2: 25, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 88, y1: 25, x2: 98, y2: 25, tone: "label", weight: 1.4 },
		{ kind: "circle", cx: 65, cy: 32, r: 3, tone: "accent" },
		{ kind: "line", x1: 71, y1: 32, x2: 84, y2: 32, tone: "surface", weight: 1.4 },
		{ kind: "rect", x: 66, y: 56, w: 28, h: 8, r: 2, tone: "surface" },
		{ kind: "rect", x: 62, y: 86, w: 36, h: 6, r: 3, tone: "label" },
		{ kind: "stroke", d: "M48 56 L44 60 L48 64", tone: "muted", weight: 1.4 },
		{ kind: "stroke", d: "M112 56 L116 60 L112 64", tone: "muted", weight: 1.4 },
	]),
	"video-shelf": windowScene([
		txt("Trending now", 26, 38, 8, "ink", { font: "semibold" }),
		txt("See all", 134, 38, 6, "muted", { align: "end" }),
		{ kind: "rect", x: 26, y: 45, w: 38, h: 22, r: 4, tone: "ink" },
		{ kind: "rect", x: 68, y: 45, w: 38, h: 22, r: 4, tone: "ink" },
		{ kind: "rect", x: 110, y: 45, w: 30, h: 22, r: 4, tone: "label" },
		{ kind: "line", x1: 26, y1: 74, x2: 52, y2: 74, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 68, y1: 74, x2: 92, y2: 74, tone: "label", weight: 1.6 },
		{ kind: "circle", cx: 131, cy: 56, r: 6, tone: "surface", ring: true },
		{ kind: "stroke", d: "M129.5 53 L132.5 56 L129.5 59", tone: "ink", weight: 1.4 },
	]),
	equalizer: windowScene([
		{ kind: "rect", x: 58, y: 54, w: 8, h: 26, r: 2, tone: "accent" },
		{ kind: "rect", x: 70, y: 36, w: 8, h: 44, r: 2, tone: "accent" },
		{ kind: "rect", x: 82, y: 46, w: 8, h: 34, r: 2, tone: "accent" },
		{ kind: "rect", x: 94, y: 60, w: 8, h: 20, r: 2, tone: "accent" },
	]),
	"media-tile": windowScene([
		{ kind: "rect", x: 52, y: 22, w: 56, h: 56, r: 5, tone: "ink" },
		{ kind: "circle", cx: 80, cy: 50, r: 12, tone: "label" },
		{ kind: "circle", cx: 99, cy: 69, r: 7, tone: "accent" },
		{ kind: "stroke", d: "M97.5 66 L101.5 69 L97.5 72 Z", tone: "surface", weight: 1.2 },
		txt("Tidelight", 52, 88, 8, "ink", { font: "semibold" }),
		txt("2025 · Lumen Harbor", 52, 97, 6, "muted"),
	]),
	"player-bar": windowScene([
		{ kind: "rect", x: 20, y: 60, w: 16, h: 16, r: 3, tone: "ink" },
		txt("Salt Glass", 40, 67, 6, "ink", { font: "semibold" }),
		txt("Lumen Harbor", 40, 75, 5, "muted"),
		{ kind: "circle", cx: 80, cy: 62, r: 6, tone: "ink" },
		{ kind: "circle", cx: 66, cy: 62, r: 2, tone: "label" },
		{ kind: "circle", cx: 94, cy: 62, r: 2, tone: "label" },
		{ kind: "line", x1: 62, y1: 74, x2: 78, y2: 74, tone: "accent", weight: 1.6 },
		{ kind: "line", x1: 78, y1: 74, x2: 100, y2: 74, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 118, y1: 68, x2: 138, y2: 68, tone: "label", weight: 1.6 },
		{ kind: "line", x1: 118, y1: 68, x2: 130, y2: 68, tone: "ink", weight: 1.6 },
	]),
	"queue-list": windowScene([
		txt("Up next", 36, 34, 8, "ink", { font: "semibold" }),
		{ kind: "rect", x: 36, y: 42, w: 12, h: 12, r: 2, tone: "accent" },
		{ kind: "line", x1: 54, y1: 46, x2: 92, y2: 46, tone: "accent", weight: 1.6 },
		{ kind: "line", x1: 54, y1: 51, x2: 78, y2: 51, tone: "label", weight: 1.3 },
		{ kind: "rect", x: 36, y: 60, w: 12, h: 12, r: 2, tone: "ink" },
		{ kind: "line", x1: 54, y1: 64, x2: 98, y2: 64, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 54, y1: 69, x2: 82, y2: 69, tone: "label", weight: 1.3 },
		{ kind: "rect", x: 36, y: 78, w: 12, h: 12, r: 2, tone: "ink" },
		{ kind: "line", x1: 54, y1: 82, x2: 90, y2: 82, tone: "ink", weight: 1.6 },
		{ kind: "line", x1: 54, y1: 87, x2: 74, y2: 87, tone: "label", weight: 1.3 },
	]),
	"track-list": windowScene([
		txt("#", 26, 34, 5, "muted"),
		txt("TITLE", 38, 34, 5, "muted", { tracking: 0.6 }),
		{ kind: "line", x1: 24, y1: 38, x2: 136, y2: 38, tone: "hairline", weight: 1 },
		txt("1", 27, 50, 6, "muted"),
		{ kind: "line", x1: 38, y1: 48, x2: 84, y2: 48, tone: "ink", weight: 1.6 },
		txt("3:42", 134, 50, 6, "muted", { align: "end" }),
		{ kind: "rect", x: 22, y: 56, w: 116, h: 14, r: 3, tone: "label" },
		{ kind: "rect", x: 25, y: 61, w: 1.6, h: 5, r: 0.5, tone: "accent" },
		{ kind: "rect", x: 27.6, y: 59, w: 1.6, h: 7, r: 0.5, tone: "accent" },
		{ kind: "rect", x: 30.2, y: 62, w: 1.6, h: 4, r: 0.5, tone: "accent" },
		{ kind: "line", x1: 38, y1: 63, x2: 92, y2: 63, tone: "accent", weight: 1.6 },
		txt("2:58", 134, 65, 6, "muted", { align: "end" }),
		txt("3", 27, 80, 6, "muted"),
		{ kind: "line", x1: 38, y1: 78, x2: 78, y2: 78, tone: "ink", weight: 1.6 },
		txt("4:06", 134, 80, 6, "muted", { align: "end" }),
	]),
	"profile-picker": windowScene([
		txt("Who's watching?", 80, 40, 8, "ink", { align: "center", font: "semibold" }),
		{ kind: "rect", x: 33, y: 48, w: 20, h: 20, r: 4, tone: "accent" },
		{ kind: "rect", x: 59, y: 48, w: 20, h: 20, r: 4, tone: "label" },
		{ kind: "rect", x: 85, y: 48, w: 20, h: 20, r: 4, tone: "ink" },
		{ kind: "rect", x: 111, y: 48, w: 20, h: 20, r: 4, tone: "label" },
		txt("Noa", 43, 77, 5, "muted", { align: "center" }),
		txt("Theo", 69, 77, 5, "muted", { align: "center" }),
		txt("Ines", 95, 77, 5, "muted", { align: "center" }),
		txt("Kids", 121, 77, 5, "muted", { align: "center" }),
	]),
	"title-hero": windowScene([
		{ kind: "rect", x: 22, y: 26, w: 116, h: 64, r: 4, tone: "ink" },
		{ kind: "circle", cx: 112, cy: 48, r: 9, tone: "label" },
		txt("ORIGINAL", 30, 50, 4, "accent", { font: "semibold", tracking: 1 }),
		txt("TIDEWATER", 30, 62, 10, "surface", { font: "semibold" }),
		{ kind: "line", x1: 30, y1: 69, x2: 74, y2: 69, tone: "label", weight: 1.3 },
		{ kind: "rect", x: 30, y: 75, w: 22, h: 8, r: 4, tone: "accent" },
		{ kind: "rect", x: 56, y: 75, w: 24, h: 8, r: 4, tone: "label" },
	]),
	toast: appShell([
		{ kind: "rect", x: 58, y: 40, w: 78, h: 28, r: 8, tone: "surface", ring: true },
		{ kind: "circle", cx: 70, cy: 54, r: 4, tone: "accent" },
		txt("Saved", 80, 52, 8, "ink", { font: "semibold" }),
		txt("Just now", 80, 62, 6, "muted"),
	]),
};

/** Catalogue of silhouettes keyed by component slug. */
const FACES: Record<string, Shape[]> = Object.fromEntries(
	CATALOGUE.map((entry) => [
		entry.slug,
		OVERRIDES[entry.slug] ?? sceneFor(entry.slug, entry.module),
	]),
);

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
 * @param fonts - Card faces to set labels in; the Worker loads them when omitted
 */
export async function renderComponentFace(
	slug: string,
	fonts?: SocialCardImage.Fonts,
): Promise<Uint8Array> {
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
				[1, WASH.to],
			],
		}),
	);
	canvas.fillRect(
		0,
		0,
		width,
		height,
		radialGradient({
			center: [width * 0.5, 0],
			radius: [width * 0.7, height * 0.85],
			stops: [
				[0, WASH.glow],
				[0.75, TRANSPARENT],
			],
		}),
	);

	let resolved = fonts ?? (await loadFaceFonts());
	let shapes = FACES[slug] ?? FALLBACK;
	for (let shape of shapes) drawShape(canvas, shape, resolved);

	return canvas.toPNG();
}

/**
 * Loads the social-card faces the Worker already bundles. Dynamic so Vitest can pass fonts
 * without pulling the `.bin` data modules into the face module graph.
 */
async function loadFaceFonts(): Promise<SocialCardImage.Fonts | null> {
	let { socialCardFonts } = await import("~/app/initializers/social-card-fonts");
	let result = socialCardFonts();
	return isFailure(result) ? null : result.data;
}

/** Picks a module-default miniature when no override names the slug. */
function sceneFor(slug: string, module: ModuleKind): Shape[] {
	if (module === "app") return appDefault(slug);
	if (module === "docs") return docsDefault(slug);
	if (module === "landing") return landingDefault(slug);
	if (module === "chat") return chatDefault(slug);
	if (module === "color") return colorDefault(slug);
	return componentDefault(slug);
}

/** Default component miniature: the control staged inside a product window. */
function componentDefault(slug: string): Shape[] {
	if (/(dialog|modal|sheet|drawer|confirm|popover|menu|hover)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 42, y: 32, w: 76, h: 48, r: 10, tone: "surface", ring: true },
			txt(shortLabel(slug), 52, 48, 7, "ink", { font: "semibold", maxWidth: 56 }),
			{ kind: "line", x1: 52, y1: 56, x2: 104, y2: 56, tone: "label", weight: 1.3 },
			{ kind: "rect", x: 52, y: 64, w: 22, h: 10, r: 5, tone: "label" },
			{ kind: "rect", x: 80, y: 64, w: 26, h: 10, r: 5, tone: "accent" },
		]);
	}
	if (/(field|input|search|select|combo|otp|number|date|time|textarea)/.test(slug)) {
		return windowScene([
			txt(shortLabel(slug), 40, 42, 6, "muted"),
			{ kind: "rect", x: 40, y: 48, w: 80, h: 18, r: 8, tone: "surface", ring: true },
			{ kind: "line", x1: 48, y1: 57, x2: 100, y2: 57, tone: "label", weight: 1.4 },
		]);
	}
	if (/(checkbox|radio|switch|toggle|selection)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 44, y: 44, w: 16, h: 16, r: 4, tone: "accent" },
			{ kind: "stroke", d: "M48 52 L51 55 L56 48", weight: 1.5, tone: "surface" },
			txt(shortLabel(slug), 68, 55, 8, "ink", { font: "semibold", maxWidth: 60 }),
		]);
	}
	if (/(tab|accordion|disclosure|pagination|breadcrumb|nav)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 36, y: 34, w: 28, h: 12, r: 6, tone: "accent" },
			{ kind: "rect", x: 68, y: 34, w: 28, h: 12, r: 6, tone: "label" },
			{ kind: "rect", x: 100, y: 34, w: 24, h: 12, r: 6, tone: "label" },
			{ kind: "line", x1: 36, y1: 54, x2: 124, y2: 54, tone: "label", weight: 1.4 },
			{ kind: "line", x1: 36, y1: 66, x2: 112, y2: 66, tone: "label", weight: 1.3 },
			{ kind: "line", x1: 36, y1: 76, x2: 100, y2: 76, tone: "label", weight: 1.3 },
		]);
	}
	if (/(progress|meter|slider|spinner|status-dot)/.test(slug)) {
		return windowScene([
			txt(shortLabel(slug), 40, 42, 7, "ink", { font: "semibold" }),
			{ kind: "rect", x: 40, y: 52, w: 80, h: 8, r: 4, tone: "label" },
			{ kind: "rect", x: 40, y: 52, w: 52, h: 8, r: 4, tone: "accent" },
		]);
	}
	if (/(badge|tag|chip|avatar|logo|keyboard)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 56, y: 42, w: 48, h: 18, r: 9, tone: "label" },
			txt(shortLabel(slug), 80, 54, 8, "ink", { align: "center", font: "semibold" }),
		]);
	}
	if (
		/(card|group|section|header|heading|typeset|text$|description|label$|item|link$)/.test(slug)
	) {
		return windowScene([
			{ kind: "rect", x: 40, y: 30, w: 80, h: 52, r: 10, tone: "surface", ring: true },
			txt(shortLabel(slug), 50, 46, 8, "ink", { font: "semibold", maxWidth: 60 }),
			{ kind: "line", x1: 50, y1: 56, x2: 108, y2: 56, tone: "label", weight: 1.4 },
			{ kind: "line", x1: 50, y1: 66, x2: 96, y2: 66, tone: "label", weight: 1.3 },
		]);
	}
	if (/(calendar|date-picker|range-calendar)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 36, y: 30, w: 88, h: 52, r: 10, tone: "surface", ring: true },
			...calendarGrid(44, 38, 6),
		]);
	}
	if (/(carousel|aspect|image|youtube)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 36, y: 30, w: 88, h: 52, r: 10, tone: "surface", ring: true },
			{ kind: "rect", x: 48, y: 40, w: 64, h: 32, r: 6, tone: "label" },
			{ kind: "circle", cx: 68, cy: 72, r: 2.5, tone: "accent" },
			{ kind: "circle", cx: 80, cy: 72, r: 2.5, tone: "label" },
			{ kind: "circle", cx: 92, cy: 72, r: 2.5, tone: "label" },
		]);
	}
	if (/(alert|banner|callout)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 32, y: 36, w: 96, h: 36, r: 10, tone: "surface", ring: true },
			{ kind: "circle", cx: 46, cy: 54, r: 6, tone: "accent" },
			txt(shortLabel(slug), 58, 50, 7, "ink", { font: "semibold", maxWidth: 62 }),
			{ kind: "line", x1: 58, y1: 60, x2: 112, y2: 60, tone: "label", weight: 1.3 },
		]);
	}
	if (/(cta|form)/.test(slug)) {
		return windowScene([
			txt(shortLabel(slug), 40, 42, 7, "ink", { font: "semibold", maxWidth: 70 }),
			{ kind: "rect", x: 40, y: 52, w: 36, h: 16, r: 8, tone: "accent" },
			{ kind: "rect", x: 82, y: 52, w: 36, h: 16, r: 8, tone: "surface", ring: true },
		]);
	}
	return windowScene([
		{ kind: "rect", x: 44, y: 34, w: 72, h: 40, r: 10, tone: "surface", ring: true },
		txt(shortLabel(slug), 80, 56, 8, "ink", { align: "center", font: "semibold", maxWidth: 56 }),
	]);
}

/** Default app miniature: Keel-style shell with a content beat that fits the slug. */
function appDefault(slug: string): Shape[] {
	if (/(chart|spark|stat)/.test(slug)) {
		return appShell([
			txt(shortLabel(slug).toUpperCase(), 58, 36, 6, "muted", { font: "mono", tracking: 0.8 }),
			txt("$12.4k", 58, 52, 12, "ink", { font: "semibold", tracking: -0.4 }),
			...usageBars(58, 58, 78, 24, [40, 48, 44, 56, 60, 58, 70, 66, 78, 74, 86, 82]),
		]);
	}
	if (/(table|grid|list|tree|filter)/.test(slug)) {
		return appShell([
			...tableRows(54, 30, 86, [
				["Name", "State"],
				["api", "ok"],
				["app", "ok"],
				["jobs", "warn"],
			]),
		]);
	}
	if (/(toast|save|status|toolbar|menu|shortcut|keyboard)/.test(slug)) {
		return appShell([
			{ kind: "rect", x: 58, y: 40, w: 78, h: 26, r: 8, tone: "surface", ring: true },
			{ kind: "circle", cx: 70, cy: 53, r: 4, tone: "accent" },
			txt(shortLabel(slug), 80, 55, 7, "ink", { font: "semibold", maxWidth: 48 }),
		]);
	}
	if (/(empty|drop|danger|detail|sheet)/.test(slug)) {
		return appShell([
			{ kind: "circle", cx: 96, cy: 46, r: 9, tone: "label" },
			txt(shortLabel(slug), 96, 68, 7, "muted", { align: "center", maxWidth: 70 }),
		]);
	}
	if (/(settings|view|split|editor|resizable|page-header)/.test(slug)) {
		return appShell([
			{ kind: "rect", x: 54, y: 30, w: 84, h: 50, r: 8, tone: "surface", ring: true },
			txt(shortLabel(slug), 62, 46, 7, "ink", { font: "semibold", maxWidth: 68 }),
			{ kind: "line", x1: 62, y1: 56, x2: 124, y2: 56, tone: "label", weight: 1.3 },
			{ kind: "line", x1: 62, y1: 66, x2: 112, y2: 66, tone: "label", weight: 1.3 },
		]);
	}
	if (/shell/.test(slug)) {
		return appShell([
			{ kind: "rect", x: 54, y: 30, w: 84, h: 50, r: 8, tone: "surface", ring: true },
			txt(shortLabel(slug), 62, 48, 7, "ink", { font: "semibold", maxWidth: 68 }),
			{ kind: "line", x1: 62, y1: 58, x2: 120, y2: 58, tone: "label", weight: 1.3 },
		]);
	}
	return appShell([
		txt(shortLabel(slug), 58, 42, 8, "ink", { font: "semibold", maxWidth: 70 }),
		{ kind: "line", x1: 58, y1: 52, x2: 130, y2: 52, tone: "label", weight: 1.4 },
		{ kind: "line", x1: 58, y1: 64, x2: 118, y2: 64, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 58, y1: 74, x2: 108, y2: 74, tone: "label", weight: 1.3 },
	]);
}

/** Default docs miniature: sidebar + page column. */
function docsDefault(slug: string): Shape[] {
	if (/(code|install|copy)/.test(slug)) {
		return docsScene([
			{ kind: "rect", x: 68, y: 44, w: 64, h: 36, r: 6, tone: "ink" },
			{ kind: "line", x1: 76, y1: 56, x2: 122, y2: 56, tone: "muted", weight: 1.3 },
			{ kind: "line", x1: 76, y1: 64, x2: 124, y2: 64, tone: "accent", weight: 1.3 },
			{ kind: "line", x1: 76, y1: 72, x2: 108, y2: 72, tone: "muted", weight: 1.3 },
		]);
	}
	if (/(nav|toc|tree|pager|footer|hub|layout)/.test(slug)) {
		return docsScene();
	}
	return docsScene([
		txt(shortLabel(slug), 68, 40, 8, "ink", { font: "semibold", maxWidth: 60 }),
		{ kind: "line", x1: 68, y1: 50, x2: 132, y2: 50, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 68, y1: 60, x2: 124, y2: 60, tone: "label", weight: 1.3 },
		{ kind: "line", x1: 68, y1: 70, x2: 110, y2: 70, tone: "label", weight: 1.3 },
	]);
}

/** Default landing miniature: staged marketing strip inside a product frame. */
function landingDefault(slug: string): Shape[] {
	if (slug === "bento") {
		return windowScene([
			{ kind: "rect", x: 28, y: 28, w: 58, h: 52, r: 8, tone: "surface", ring: true },
			{ kind: "rect", x: 36, y: 36, w: 42, h: 16, r: 4, tone: "label" },
			{ kind: "rect", x: 92, y: 28, w: 40, h: 24, r: 8, tone: "surface", ring: true },
			{ kind: "rect", x: 92, y: 56, w: 40, h: 24, r: 8, tone: "surface", ring: true },
		]);
	}
	if (
		/(hero|header|footer|frame|stage|split|feature|pricing|sponsor|proof|stat|marquee|logo)/.test(
			slug,
		)
	) {
		return landingHeroScene(shortLabel(slug));
	}
	if (/(chart|diagram|flow|sequence|crosshair|drawn)/.test(slug)) {
		return windowScene([
			...usageBars(36, 36, 88, 40, [30, 42, 38, 55, 48, 62, 58, 70, 66, 78, 74, 88]),
		]);
	}
	if (/(code|terminal|install)/.test(slug)) {
		return windowScene([
			{ kind: "rect", x: 36, y: 30, w: 88, h: 48, r: 8, tone: "ink" },
			txt("$ bun add @sdxc/ui", 44, 48, 6, "surface", { font: "mono", maxWidth: 72 }),
			{ kind: "line", x1: 44, y1: 58, x2: 100, y2: 58, tone: "accent", weight: 1.3 },
			{ kind: "line", x1: 44, y1: 66, x2: 88, y2: 66, tone: "muted", weight: 1.3 },
		]);
	}
	return windowScene([
		txt(shortLabel(slug), 40, 42, 8, "ink", { font: "semibold", maxWidth: 80 }),
		{ kind: "line", x1: 40, y1: 52, x2: 120, y2: 52, tone: "label", weight: 1.4 },
		{ kind: "rect", x: 40, y: 62, w: 36, h: 14, r: 7, tone: "accent" },
		{ kind: "rect", x: 82, y: 62, w: 36, h: 14, r: 7, tone: "surface", ring: true },
	]);
}

/** Default chat miniature: stacked bubbles in a pane. */
function chatDefault(slug: string): Shape[] {
	return chatScene(shortLabel(slug));
}

/** Default color miniature: wells and a selected swatch. */
function colorDefault(slug: string): Shape[] {
	return windowScene([
		{ kind: "rect", x: 40, y: 32, w: 40, h: 40, r: 8, tone: "accent" },
		{ kind: "rect", x: 88, y: 32, w: 14, h: 12, r: 3, tone: "surface", ring: true },
		{ kind: "rect", x: 88, y: 46, w: 14, h: 12, r: 3, tone: "label" },
		{ kind: "rect", x: 88, y: 60, w: 14, h: 12, r: 3, tone: "accent" },
		txt(shortLabel(slug), 40, 84, 6, "muted", { font: "mono", maxWidth: 80 }),
	]);
}

/**
 * Wraps interior shapes in ProductFrame window chrome: hairline ring, traffic lights,
 * chrome bar and the raised surface lift.
 */
function windowScene(body: Shape[]): Shape[] {
	let { chrome, h, r, w, x, y } = WIN;
	return [
		{ kind: "rect", x, y, w, h, r, tone: "surface", ring: true },
		{ kind: "rect", x, y, w, h: chrome, r, tone: "chrome" },
		{ kind: "rect", x, y: y + chrome - 4, w, h: 4, tone: "chrome" },
		{ kind: "circle", cx: x + 10, cy: y + chrome / 2, r: 2.2, tone: "label" },
		{ kind: "circle", cx: x + 18, cy: y + chrome / 2, r: 2.2, tone: "label" },
		{ kind: "circle", cx: x + 26, cy: y + chrome / 2, r: 2.2, tone: "label" },
		{ kind: "line", x1: x, y1: y + chrome, x2: x + w, y2: y + chrome, tone: "hairline", weight: 1 },
		...body,
	];
}

/**
 * Keel-style app shell: window chrome, a left rail of nav lines, and the caller's content
 * in the main pane.
 */
function appShell(body: Shape[]): Shape[] {
	let rail = WIN.x + 28;
	return windowScene([
		{
			kind: "line",
			x1: rail,
			y1: WIN.y + WIN.chrome,
			x2: rail,
			y2: WIN.y + WIN.h,
			tone: "hairline",
			weight: 1,
		},
		{ kind: "rect", x: WIN.x + 8, y: WIN.y + WIN.chrome + 8, w: 14, h: 5, r: 2, tone: "accent" },
		{
			kind: "line",
			x1: WIN.x + 8,
			y1: WIN.y + WIN.chrome + 20,
			x2: WIN.x + 20,
			y2: WIN.y + WIN.chrome + 20,
			tone: "label",
			weight: 2.5,
		},
		{
			kind: "line",
			x1: WIN.x + 8,
			y1: WIN.y + WIN.chrome + 30,
			x2: WIN.x + 22,
			y2: WIN.y + WIN.chrome + 30,
			tone: "label",
			weight: 2.5,
		},
		{
			kind: "line",
			x1: WIN.x + 8,
			y1: WIN.y + WIN.chrome + 40,
			x2: WIN.x + 16,
			y2: WIN.y + WIN.chrome + 40,
			tone: "label",
			weight: 2.5,
		},
		...body,
	]);
}

/**
 * Rooftree-style phone: dark bezel, light screen, content inset — used when the component
 * reads as a device surface.
 */
function deviceScene(body: Shape[]): Shape[] {
	let { h, pad, r, w, x, y } = PHONE;
	return [
		{ kind: "rect", x, y, w, h, r, tone: "ink" },
		{
			kind: "rect",
			x: x + pad,
			y: y + pad,
			w: w - pad * 2,
			h: h - pad * 2,
			r: r - 2,
			tone: "surface",
		},
		...body,
	];
}

/**
 * Docs miniature shell: mark + nav rail beside a page column, matching the gallery cards
 * on `/demo`. The rail mark and its label stack, so the word never runs into the divider.
 */
function docsScene(page: Shape[] = []): Shape[] {
	let rail = 58;
	let pageX = 68;
	let base: Shape[] = [
		{ kind: "rect", x: 16, y: 10, w: 128, h: 80, r: 8, tone: "surface", ring: true },
		{ kind: "line", x1: rail, y1: 10, x2: rail, y2: 90, tone: "hairline", weight: 1 },
		{ kind: "rect", x: 26, y: 18, w: 12, h: 12, r: 3, tone: "accent" },
		txt("Docs", 26, 40, 6, "ink", { font: "semibold", maxWidth: 24 }),
		{ kind: "rect", x: 24, y: 50, w: 24, h: 10, r: 4, tone: "label" },
		{ kind: "line", x1: 26, y1: 68, x2: 44, y2: 68, tone: "label", weight: 1.5 },
		{ kind: "line", x1: 26, y1: 78, x2: 40, y2: 78, tone: "label", weight: 1.5 },
	];
	if (page.length === 0) {
		return [
			...base,
			txt("Get started", pageX, 28, 8, "ink", { font: "semibold" }),
			{ kind: "line", x1: pageX, y1: 40, x2: 132, y2: 40, tone: "label", weight: 1.3 },
			{ kind: "line", x1: pageX, y1: 50, x2: 126, y2: 50, tone: "label", weight: 1.3 },
			{ kind: "line", x1: pageX, y1: 60, x2: 118, y2: 60, tone: "label", weight: 1.3 },
			{ kind: "rect", x: pageX, y: 68, w: 60, h: 14, r: 4, tone: "ink" },
		];
	}
	return [...base, ...page];
}

/** Chat pane with two bubbles, optionally titled by the slug. */
function chatScene(label = "Hey"): Shape[] {
	return windowScene([
		{
			kind: "path",
			d: "M36 34 H92 Q100 34 100 42 V50 Q100 58 92 58 H48 L42 64 L42 58 H36 Q28 58 28 50 V42 Q28 34 36 34 Z",
			tone: "label",
		},
		txt(label, 40, 48, 7, "ink", { font: "semibold", maxWidth: 50 }),
		{
			kind: "path",
			d: "M68 66 H124 Q132 66 132 74 V78 Q132 86 124 86 H118 L124 92 L112 86 H68 Q60 86 60 78 V74 Q60 66 68 66 Z",
			tone: "accent",
		},
	]);
}

/** Marketing hero strip: brand mark, headline rules and a CTA pair. */
function landingHeroScene(label = "Ship UI"): Shape[] {
	return windowScene([
		{ kind: "rect", x: 36, y: 30, w: 20, h: 8, r: 3, tone: "accent" },
		txt(label, 36, 52, 10, "ink", { font: "semibold", maxWidth: 88, tracking: -0.3 }),
		{ kind: "line", x1: 36, y1: 60, x2: 110, y2: 60, tone: "label", weight: 1.3 },
		{ kind: "rect", x: 36, y: 68, w: 32, h: 12, r: 6, tone: "accent" },
		{ kind: "rect", x: 74, y: 68, w: 32, h: 12, r: 6, tone: "surface", ring: true },
	]);
}

/**
 * A calendar day grid. `selected` lists day indices (row-major, 0–20) painted accent so a
 * single day and a range read differently.
 */
function calendarGrid(originX = 48, originY = 34, cell = 8, selected: number[] = [10]): Shape[] {
	let selectedSet = new Set(selected);
	let shapes: Shape[] = [];
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 7; col++) {
			let index = row * 7 + col;
			let cx = originX + col * (cell + 2) + cell / 2;
			let cy = originY + row * (cell + 2) + cell / 2;
			shapes.push({
				kind: "circle",
				cx,
				cy,
				r: cell / 2 - 0.5,
				tone: selectedSet.has(index) ? "accent" : "label",
			});
		}
	}
	return shapes;
}

/** Usage bars like Keel's revenue board: last bar solid, the rest tinted. */
function usageBars(x: number, y: number, w: number, h: number, values: number[]): Shape[] {
	let max = Math.max(...values);
	let gap = 2;
	let barW = (w - gap * (values.length - 1)) / values.length;
	return values.map((value, index) => {
		let barH = Math.max(3, (value / max) * h);
		return {
			kind: "rect" as const,
			x: x + index * (barW + gap),
			y: y + h - barH,
			w: barW,
			h: barH,
			r: 1.5,
			tone: index === values.length - 1 ? ("accent" as const) : ("label" as const),
		};
	});
}

/** Sparkline as a series of short accent capsules along a baseline. */
function sparkPath(x: number, y: number, w: number, h: number, values: number[]): Shape[] {
	let max = Math.max(...values);
	let step = w / (values.length - 1);
	let shapes: Shape[] = [
		{ kind: "line", x1: x, y1: y + h, x2: x + w, y2: y + h, tone: "hairline", weight: 1 },
	];
	for (let index = 0; index < values.length - 1; index++) {
		let x1 = x + index * step;
		let y1 = y + h - (values[index]! / max) * h;
		let x2 = x + (index + 1) * step;
		let y2 = y + h - (values[index + 1]! / max) * h;
		shapes.push({ kind: "line", x1, y1, x2, y2, tone: "accent", weight: 1.6 });
	}
	return shapes;
}

/** Compact table rows with a header rule — host / metric pairs. */
function tableRows(x: number, y: number, w: number, rows: Array<[string, string]>): Shape[] {
	let shapes: Shape[] = [];
	let rowH = 12;
	rows.forEach(([left, right], index) => {
		let yy = y + index * rowH;
		if (index === 0) {
			shapes.push(txt(left, x, yy + 8, 6, "muted", { font: "mono" }));
			shapes.push(txt(right, x + w, yy + 8, 6, "muted", { align: "end", font: "mono" }));
			shapes.push({
				kind: "line",
				x1: x,
				y1: yy + 11,
				x2: x + w,
				y2: yy + 11,
				tone: "hairline",
				weight: 1,
			});
			return;
		}
		shapes.push(txt(left, x, yy + 8, 6, "ink", { font: "mono", maxWidth: w * 0.6 }));
		shapes.push(
			txt(right, x + w, yy + 8, 6, index === rows.length - 1 ? "accent" : "muted", {
				align: "end",
				font: "mono",
			}),
		);
	});
	return shapes;
}

/** One status row in a monitors list: a status dot beside a mono host label. */
function statusRow(x: number, y: number, label: string, ok: boolean): Shape[] {
	return [
		{ kind: "circle", cx: x + 3, cy: y - 2, r: 2.5, tone: ok ? "accent" : "label" },
		txt(label, x + 10, y, 6.5, ok ? "ink" : "muted", { font: "mono", maxWidth: 90 }),
	];
}

/** One checklist row inside the Rooftree phone face. */
function phoneRow(x: number, y: number, label: string, done: boolean): Shape[] {
	return [
		{
			kind: "rect",
			x,
			y,
			w: 44,
			h: 12,
			r: 6,
			tone: "label",
		},
		{
			kind: "circle",
			cx: x + 7,
			cy: y + 6,
			r: 3.5,
			tone: done ? "accent" : "surface",
			ring: !done,
		},
		txt(label, x + 14, y + 9, 5.5, done ? "muted" : "ink", { font: "semibold", maxWidth: 28 }),
	];
}

/** A short Title Case label from a slug, capped so it fits a tile. */
function shortLabel(slug: string): string {
	let words = slug.split("-").filter(Boolean);
	let label = words
		.slice(0, 2)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
	return label.length > 14 ? label.slice(0, 13) : label;
}

/** Shorthand for a text shape in design space. */
function txt(
	text: string,
	x: number,
	y: number,
	size: number,
	tone: Tone,
	options: {
		align?: TextShape["align"];
		font?: FaceFont;
		tracking?: number;
		maxWidth?: number;
	} = {},
): TextShape {
	return {
		kind: "text",
		text,
		x,
		y,
		size,
		tone,
		align: options.align,
		font: options.font,
		tracking: options.tracking,
		maxWidth: options.maxWidth,
	};
}

/**
 * Resolves the fill for a material tone so every miniature piece shares one palette.
 *
 * @param tone - The material role on the piece
 */
function paintFor(tone: Tone) {
	if (tone === "surface") return SURFACE;
	if (tone === "chrome") return CHROME;
	if (tone === "label") return LABEL;
	if (tone === "ink") return INK;
	if (tone === "muted") return MUTED;
	if (tone === "hairline") return HAIRLINE;
	return ACCENT;
}

/**
 * Paints one material piece into the canvas, scaled from design space. Surface pieces
 * cast a soft contact shadow and optional hairline ring so chrome lifts off the wash.
 */
function drawShape(
	canvas: Canvas,
	shape: Shape,
	fonts: { regular: Font; semibold: Font; mono: Font } | null,
): void {
	if (shape.kind === "text") {
		drawText(canvas, shape, fonts);
		return;
	}

	let paint = paintFor(shape.tone);

	if (shape.kind === "rect") {
		let x = shape.x * SCALE;
		let y = shape.y * SCALE;
		let w = shape.w * SCALE;
		let h = shape.h * SCALE;
		let r = (shape.r ?? 8) * SCALE;
		if (shape.tone === "surface" || shape.ring) {
			canvas.fillPath(Path.roundedRect(x, y + 1.5 * SCALE, w, h, r), SHADOW);
		}
		if (shape.ring) {
			canvas.fillPath(
				Path.roundedRect(x - SCALE, y - SCALE, w + 2 * SCALE, h + 2 * SCALE, r + SCALE),
				HAIRLINE,
			);
		}
		canvas.fillPath(Path.roundedRect(x, y, w, h, r), paint);
		return;
	}

	if (shape.kind === "circle") {
		let x = (shape.cx - shape.r) * SCALE;
		let y = (shape.cy - shape.r) * SCALE;
		let size = shape.r * 2 * SCALE;
		if (shape.tone === "surface" || shape.ring) {
			canvas.fillPath(Path.roundedRect(x, y + 1.5 * SCALE, size, size, size), SHADOW);
		}
		if (shape.ring) {
			canvas.fillPath(
				Path.roundedRect(
					x - SCALE,
					y - SCALE,
					size + 2 * SCALE,
					size + 2 * SCALE,
					size + 2 * SCALE,
				),
				HAIRLINE,
			);
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

/** Sets a short label with the site's social-card faces when they loaded. */
function drawText(
	canvas: Canvas,
	shape: TextShape,
	fonts: { regular: Font; semibold: Font; mono: Font } | null,
): void {
	if (!fonts) return;
	let face = fonts.regular;
	if (shape.font === "semibold") face = fonts.semibold;
	if (shape.font === "mono") face = fonts.mono;
	canvas.text(shape.text, {
		font: face,
		size: shape.size * SCALE,
		x: shape.x * SCALE,
		y: shape.y * SCALE,
		align: shape.align ?? "start",
		tracking: (shape.tracking ?? 0) * SCALE,
		maxWidth: shape.maxWidth ? shape.maxWidth * SCALE : undefined,
		maxLines: 1,
		paint: paintFor(shape.tone),
	});
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
