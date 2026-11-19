/**
 * A drawn map: a stage holding one SVG coordinate space, where caller-drawn art, routes, moving
 * markers and price pins all place by viewBox units. Pins are HTML links or buttons laid over
 * the art, so they stay crisp, focusable and at reading size at any stage width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce, motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { mapLink, mapLinks } from "../mixins/map-link.js";

/** Coordinate space a stage draws in when the caller names none. */
const DEFAULT_VIEW_BOX = "0 0 400 300";

/** Tone a pin paints with when the caller names none. */
const DEFAULT_TONE = "neutral";

/** Share of a route drawn as travelled when the caller names none. */
const DEFAULT_DONE = 0;

/** Height, in pixels, of the tail under a pin, whose tip sits on the pin's point. */
const PIN_TAIL = 6;

/** Prop types for {@link MapCanvas} and its parts. */
export namespace MapCanvas {
	/** Every native `<figure>` attribute, plus the coordinate space and the art drawn in it. */
	export interface Props extends Omit<TagProps<"figure">, "children"> {
		/**
		 * The SVG viewBox every part places by; a non-zero origin crops into one area of the art.
		 * The stage keeps its aspect ratio.
		 * @default "0 0 400 300"
		 */
		viewBox?: string;
		/** SVG children drawn under everything else: land, water, parks, roads. */
		art?: RemixNode;
		/** The map's accessible name, such as "Stays in Lisbon". */
		label: string;
		/** {@link MapCanvas.Route}, {@link MapCanvas.Marker} and {@link MapCanvas.Pin} elements. */
		children?: RemixNode;
	}

	/** The parsed viewBox the stage hands its parts. */
	export interface Context {
		minX: number;
		minY: number;
		width: number;
		height: number;
		viewBox: string;
	}

	/** Every native `<button>` attribute but `children`, plus where the pin sits and what it says. */
	export interface PinProps extends Omit<TagProps<"button">, "children" | "mix"> {
		/** Mixins for the pin, which renders as either a link or a button. */
		mix?: TagProps<"span">["mix"];
		/** Horizontal position in viewBox units. */
		x: number;
		/** Vertical position in viewBox units. */
		y: number;
		/** The pill's content, such as a price or an icon; with text it names the pin. */
		label: RemixNode;
		/** Renders the pin as a link to this address instead of a button. */
		href?: string;
		/** Lights the pin as if pointed at, such as while its listing is hovered. */
		highlighted?: boolean;
		/** Marks the selected pin: inverted colors, drawn above the rest, `aria-current`. */
		current?: boolean;
		/**
		 * Colors of the pill at rest.
		 * @default "neutral"
		 */
		tone?: "brand" | "neutral";
		/** Record key shared with a listing row, linked through `mapLink`. */
		mapKey?: string;
	}

	/** Every native `<svg>` attribute but its geometry, plus the path the route follows. */
	export interface RouteProps extends Omit<TagProps<"svg">, "children" | "viewBox"> {
		/** Path data in viewBox units. */
		d: string;
		/**
		 * Share of the route already travelled, from 0 to 1, drawn solid; the rest is dashed.
		 * @default 0
		 */
		done?: number;
	}

	/** Every native `<svg>` attribute but its geometry, plus where along a path the marker is. */
	export interface MarkerProps extends Omit<TagProps<"svg">, "children" | "viewBox"> {
		/** Path data in viewBox units the marker travels. */
		route: string;
		/** Share of `route` travelled, from 0 to 1. */
		progress: number;
		/** SVG glyph centred on the origin; a dot with a halo when omitted. */
		children?: RemixNode;
	}
}

/**
 * Parses a viewBox into its four numbers, falling back to the default space when the string
 * is malformed or has no area.
 */
function parseViewBox(viewBox: string): MapCanvas.Context {
	let parts = viewBox
		.trim()
		.split(/[\s,]+/)
		.map(Number);
	let [minX = 0, minY = 0, width = 0, height = 0] = parts;
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
		return parseViewBox(DEFAULT_VIEW_BOX);
	}
	if (width <= 0 || height <= 0) return parseViewBox(DEFAULT_VIEW_BOX);
	return { minX, minY, width, height, viewBox: `${minX} ${minY} ${width} ${height}` };
}

/** Clamps a share to the 0–1 range, reading anything that is not a number as 0. */
function clampShare(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

/** Reads the stage's coordinate space, or the default one outside a stage. */
function spaceOf(handle: Handle<object, object>): MapCanvas.Context {
	let context = handle.context.get(MapCanvas) as MapCanvas.Context | undefined;
	return context ?? parseViewBox(DEFAULT_VIEW_BOX);
}

/**
 * Renders the stage at the full width of its parent and at the viewBox's aspect ratio, the
 * art in an `aria-hidden` SVG and its parts over it. Anything drawn past the viewBox is
 * clipped, so the stage never widens the page.
 *
 * @example
 * <MapCanvas label="Stays in Lisbon" art={<rect width="400" height="300" fill="#e8efe3" />}>
 * 	<MapCanvas.Pin x={120} y={80} label="$182" href="/stays/1" mapKey="1" />
 * </MapCanvas>
 */
export function MapCanvas(handle: Handle<MapCanvas.Props, MapCanvas.Context>) {
	return () => {
		let { art, children, label, mix, viewBox, ...rest } = handle.props;
		let space = parseViewBox(viewBox ?? DEFAULT_VIEW_BOX);
		handle.context.set(space);

		return (
			<figure
				aria-label={label}
				{...rest}
				data-slot="map-canvas"
				mix={mergeMix(
					[
						raw({
							position: "relative",
							isolation: "isolate",
							inlineSize: "100%",
							minInlineSize: "0",
							aspectRatio: `${space.width} / ${space.height}`,
							margin: "0",
							overflow: "clip",
							borderRadius: "var(--ui-map-radius, 0.75rem)",
							background: "var(--ui-map-ground, var(--ui-neutral-bg-tint))",
						}),
					],
					mix,
				)}
			>
				<svg
					viewBox={space.viewBox}
					preserveAspectRatio="none"
					aria-hidden="true"
					focusable="false"
					data-slot="map-canvas-art"
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							inlineSize: "100%",
							blockSize: "100%",
							display: "block",
						}),
					]}
				>
					{art}
				</svg>
				{children}
			</figure>
		);
	};
}

/**
 * Draws a route over the art: the travelled share as a solid line, the rest dashed, both over a
 * light casing that keeps the line legible on any art.
 *
 * @example <MapCanvas.Route d="M40 250 C120 200 220 220 330 70" done={0.6} />
 */
MapCanvas.Route = function MapCanvasRoute(handle: Handle<MapCanvas.RouteProps>) {
	return () => {
		let { d, done, mix, ...rest } = handle.props;
		let space = spaceOf(handle);
		let travelled = clampShare(done ?? DEFAULT_DONE);

		return (
			<svg
				{...rest}
				viewBox={space.viewBox}
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
				data-slot="map-canvas-route"
				mix={mergeMix(
					[
						raw({
							position: "absolute",
							inset: "0",
							inlineSize: "100%",
							blockSize: "100%",
							display: "block",
							overflow: "visible",
							pointerEvents: "none",
						}),
					],
					mix,
				)}
			>
				<path
					d={d}
					data-route-part="casing"
					mix={[
						raw({
							fill: "none",
							stroke: "var(--ui-map-route-casing, var(--ui-surface-raised, white))",
							strokeWidth: "var(--ui-map-route-casing-width, 7)",
							strokeLinecap: "round",
							strokeLinejoin: "round",
						}),
					]}
				/>
				<path
					d={d}
					data-route-part="ahead"
					mix={[
						raw({
							fill: "none",
							stroke: "var(--ui-map-route-color, var(--ui-brand-bg-solid))",
							strokeOpacity: "0.55",
							strokeWidth: "var(--ui-map-route-width, 3)",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							strokeDasharray: "var(--ui-map-route-dash, 2 7)",
						}),
					]}
				/>
				{travelled > 0 ? (
					<path
						d={d}
						pathLength="1"
						data-route-part="done"
						stroke-dasharray={`${travelled} 2`}
						mix={[
							raw({
								fill: "none",
								stroke: "var(--ui-map-route-color, var(--ui-brand-bg-solid))",
								strokeWidth: "var(--ui-map-route-width, 3)",
								strokeLinecap: "round",
								strokeLinejoin: "round",
							}),
						]}
					/>
				) : null}
			</svg>
		);
	};
};

/**
 * Places a marker along a path with CSS motion paths, so a new `progress` glides it along the
 * route instead of jumping; under reduced motion it moves straight to the new spot. The glyph
 * group carries `data-map-marker` for scripts that update it live.
 *
 * @example <MapCanvas.Marker route="M40 250 C120 200 220 220 330 70" progress={0.6} />
 */
MapCanvas.Marker = function MapCanvasMarker(handle: Handle<MapCanvas.MarkerProps>) {
	return () => {
		let { children, mix, progress, route, ...rest } = handle.props;
		let space = spaceOf(handle);

		return (
			<svg
				{...rest}
				viewBox={space.viewBox}
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
				data-slot="map-canvas-marker"
				mix={mergeMix(
					[
						raw({
							position: "absolute",
							inset: "0",
							inlineSize: "100%",
							blockSize: "100%",
							display: "block",
							overflow: "visible",
							pointerEvents: "none",
						}),
					],
					mix,
				)}
			>
				<g
					data-map-marker=""
					style={{
						"--ui-map-progress": String(clampShare(progress)),
						offsetPath: `path(${JSON.stringify(route)})`,
					}}
					mix={[
						raw({
							offsetDistance: "calc(var(--ui-map-progress) * 100%)",
							offsetRotate: "0deg",
							offsetAnchor: "0 0",
						}),
						motionSafe(raw({ transition: "offset-distance 400ms ease-out" })),
						motionReduce(raw({ transition: "none" })),
					]}
				>
					{children ?? (
						<>
							<circle
								r="11"
								mix={[raw({ fill: "var(--ui-map-marker-color, var(--ui-brand-bg-solid))" })]}
								fill-opacity="0.22"
							/>
							<circle
								r="5.5"
								mix={[
									raw({
										fill: "var(--ui-map-marker-color, var(--ui-brand-bg-solid))",
										stroke: "var(--ui-surface-raised, white)",
										strokeWidth: "2",
									}),
								]}
							/>
						</>
					)}
				</g>
			</svg>
		);
	};
};

/**
 * One pin: a pill whose tail tips onto its point, as a link with `href` or a button otherwise
 * (pass `popovertarget` or `commandfor` to open a card). Pointing, focus and `data-highlighted`
 * lift it above its neighbours; a point outside the viewBox renders nothing.
 *
 * @example <MapCanvas.Pin x={210} y={140} label="$182" href="/stays/7" mapKey="7" current />
 * @example <MapCanvas.Pin x={90} y={60} label="Casa Rosa" popovertarget="stay-3-card" />
 */
MapCanvas.Pin = function MapCanvasPin(handle: Handle<MapCanvas.PinProps>) {
	return () => {
		let {
			current = false,
			highlighted = false,
			href,
			label,
			mapKey,
			mix,
			tone,
			x,
			y,
			...rest
		} = handle.props;
		let space = spaceOf(handle);
		let left = ((x - space.minX) / space.width) * 100;
		let top = ((y - space.minY) / space.height) * 100;
		if (!(left >= 0 && left <= 100 && top >= 0 && top <= 100)) return null;

		let shared = {
			"aria-current": current ? ("true" as const) : undefined,
			"data-slot": "map-canvas-pin",
			"data-tone": tone ?? DEFAULT_TONE,
			"data-highlighted": highlighted ? "" : undefined,
			style: { left: `${left}%`, top: `${top}%` },
			mix: mergeMix<HTMLElement>(
				[
					raw({
						position: "absolute",
						zIndex: "1",
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						minBlockSize: "1.75rem",
						paddingInline: "0.625rem",
						border: "0",
						borderRadius: "9999px",
						font: "inherit",
						fontSize: "0.8125rem",
						fontWeight: "600",
						lineHeight: "1",
						whiteSpace: "nowrap",
						fontVariantNumeric: "tabular-nums",
						textDecoration: "none",
						cursor: "pointer",
						translate: `-50% calc(-100% - ${PIN_TAIL}px)`,
						transformOrigin: `50% calc(100% + ${PIN_TAIL}px)`,
						background: "var(--ui-surface-raised, white)",
						color: "var(--ui-neutral-fg-emphasis)",
						boxShadow: "var(--ui-shadow-ring)",
						"&::after": {
							content: '""',
							position: "absolute",
							insetBlockStart: "100%",
							insetInlineStart: "50%",
							inlineSize: `${PIN_TAIL * 2}px`,
							blockSize: `${PIN_TAIL}px`,
							translate: "-50% -0.5px",
							clipPath: "polygon(0 0, 100% 0, 50% 100%)",
							background: "inherit",
						},
						'&[data-tone="brand"]': {
							background: "var(--ui-brand-bg-solid)",
							color: "var(--ui-brand-fg-on-solid)",
						},
						"&[aria-current]": {
							zIndex: "2",
							background: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
						},
						'&[data-tone="brand"][aria-current]': {
							background: "var(--ui-surface-raised, white)",
							color: "var(--ui-brand-fg-emphasis)",
							boxShadow: "0 0 0 2px var(--ui-brand-bg-solid)",
						},
						"&:hover, &:focus-visible, &[data-highlighted]": {
							zIndex: "3",
							boxShadow: "var(--ui-shadow-ring-hover), 0 4px 12px -4px rgb(0 0 0 / 0.3)",
						},
						"@media (forced-colors: active)": { border: "1px solid CanvasText" },
					}),
					when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)" })),
					motionSafe(
						raw({
							transition: "scale 140ms ease-out",
							"&:hover, &:focus-visible, &[data-highlighted]": { scale: "1.08" },
						}),
					),
					...(mapKey === undefined ? [] : [mapLink(mapKey)]),
				],
				mix,
			),
		};

		if (href !== undefined) {
			return (
				<a {...(rest as Omit<TagProps<"a">, "href" | "role">)} {...shared} href={href}>
					{label}
				</a>
			);
		}
		return (
			<button type="button" {...rest} {...shared}>
				{label}
			</button>
		);
	};
};

/**
 * Links every row and pin carrying a `mapKey` on the page in one island, so a server-rendered
 * list and its map light each other on hover and focus. Mount it once beside the map.
 *
 * @example <MapCanvasSync />
 */
export const MapCanvasSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/map-canvas#MapCanvasSync",
	function MapCanvasSync() {
		return () => <span hidden mix={[mapLinks()]} />;
	},
);
