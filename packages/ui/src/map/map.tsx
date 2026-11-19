/**
 * A geographic map that renders on the server: real longitude and latitude projected with Web
 * Mercator onto a stage, a vector basemap as SVG, markers as links or buttons that cluster when
 * close, popups, routes and zoom links that work without script; an island makes it draggable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	EntryComponent,
	Handle,
	Props as TagProps,
	RemixElement,
	RemixNode,
} from "remix/component";

import { CompassIcon, LocateFixedIcon, MaximizeIcon, MinusIcon, PlusIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce, motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry, Fragment } from "remix/component";

import type { EngineBasemap, EngineProps, EngineSession } from "./engine.js";
import type { MapFeatureCollection } from "./utils/basemap.js";
import type { LngLat, Pixel, View } from "./utils/mercator.js";

import { startEngine } from "./engine.js";
import { mapLink } from "./mixins/map-link.js";
import {
	BASEMAP_PAINT,
	featureKind,
	geometryPath,
	KIND_ORDER,
	placeLabels,
	ROAD_WIDTH,
} from "./utils/basemap.js";
import { clusterLabel, clusterPoints } from "./utils/cluster.js";
import {
	clampZoom,
	formatBounds,
	formatLngLat,
	lngLatAt,
	offsetFrom,
	roundTo,
	viewBounds,
} from "./utils/mercator.js";
import { anchorFor, offsetStyle, routePathData } from "./utils/stage.js";

export type { Bounds, LngLat, View } from "./utils/mercator.js";
export type { FeatureKind, MapFeature, MapFeatureCollection } from "./utils/basemap.js";

/** Controls a map shows when the caller names none. */
const DEFAULT_CONTROLS: GeoMap.Control[] = ["zoom"];

/** Lowest zoom a map reaches when the caller names none. */
const DEFAULT_MIN_ZOOM = 0;

/** Highest zoom a map reaches when the caller names none. */
const DEFAULT_MAX_ZOOM = 20;

/** Distance in pixels under which markers gather into one bubble. */
const DEFAULT_CLUSTER_RADIUS = 44;

/** Stage size in pixels the server assumes when it writes the bounds a search area submits. */
const DEFAULT_VIEWPORT: Pixel = [1024, 768];

/** Zoom steps a cluster's link moves in by. */
const CLUSTER_ZOOM_STEP = 2;

/** Tone a marker paints with when the caller names none. */
const DEFAULT_TONE = "neutral";

/** Height in pixels of the tail under a marker, whose tip sits on the marker's point. */
const PIN_TAIL = 6;

/** Names of the fields a search area fills when the caller names none. */
const DEFAULT_AREA_NAMES = { bounds: "bounds", center: "center", zoom: "zoom" };

/** Prop types for {@link GeoMap} and its parts. */
export namespace GeoMap {
	/** A control the map can show in its top corner. */
	export type Control = "zoom" | "reset" | "locate" | "fullscreen";

	/** Caller-drawn vector land, water, parks, roads and place names from GeoJSON. */
	export interface GeoJSONBasemap {
		kind: "geojson";
		/** Features sorted by `properties.kind`; see `MapFeatureProperties`. */
		data: MapFeatureCollection;
		/**
		 * What the stage shows where no feature is drawn: `water` for an island or a coast
		 * drawn as land polygons in a sea.
		 * @default "land"
		 */
		ground?: "land" | "water";
	}

	/** Tiles from a MapLibre style, such as OpenFreeMap's, drawn once the island loads. */
	export interface StyleBasemap {
		kind: "style";
		/** Style URL for the light theme. */
		light: string;
		/** Style URL for the dark theme; the light style serves both when omitted. */
		dark?: string;
		/** Drawn on the server and without script, under the markers, such as a static image. */
		fallback?: RemixNode;
	}

	/** What the map draws under its markers. */
	export type Basemap = GeoJSONBasemap | StyleBasemap;

	/** Builds a page URL for a view, which turns zoom controls and clusters into links. */
	export interface Navigation {
		href(view: View): string;
	}

	/** Every string the map speaks; the library ships no copy. */
	export interface Labels {
		zoomIn: string;
		zoomOut: string;
		/** The control that returns to the starting view. */
		reset: string;
		/** The control that centres the map on the visitor's location. */
		locate: string;
		fullscreen: string;
		/** A cluster bubble's accessible name, with `{count}` for its markers, such as "{count} stays". */
		cluster: string;
		/** Shown on touch screens when one finger tries to pan, such as "Use two fingers to move the map". */
		gestureHint: string;
	}

	/** Every native `<div>` attribute, plus the view, the basemap and the strings. */
	export interface Props extends Omit<TagProps<"div">, "children" | "id"> {
		/** The stage's id, which the island finds it by. */
		id: string;
		/** The map's accessible name, such as "Stays in Lisbon". */
		label: string;
		/** The point at the middle of the stage. */
		center: LngLat;
		zoom: number;
		/** @default 0 */
		minZoom?: number;
		/** @default 20 */
		maxZoom?: number;
		/** A tinted stage with markers only when omitted. */
		basemap?: Basemap;
		/** @default ["zoom"] */
		controls?: Control[];
		/** Turns zoom controls and clusters into links that work without script. */
		navigation?: Navigation;
		labels: Labels;
		/**
		 * Distance in pixels under which markers gather into one bubble.
		 * @default 44
		 */
		clusterRadius?: number;
		/**
		 * Stage size in pixels assumed on the server for the bounds a search area submits.
		 * @default [1024, 768]
		 */
		viewport?: Pixel;
		/** Where the island loads MapLibre's worker from, such as a bundler's `?url` import. */
		workerUrl?: string;
		/** {@link GeoMap.Marker}, {@link GeoMap.Route} and {@link GeoMap.Area} elements. */
		children?: RemixNode;
	}

	/** What the stage hands its parts. */
	export interface Context {
		id: string;
		view: View;
		minZoom: number;
		maxZoom: number;
		viewport: Pixel;
		/** Keys of markers drawn inside a cluster bubble instead of on their own. */
		clustered: Set<string>;
	}

	/** Every native `<button>` attribute but `children`, plus where the marker sits and what it says. */
	export interface MarkerProps extends Omit<TagProps<"button">, "children" | "mix"> {
		/** Mixins for the marker, which renders as either a link or a button. */
		mix?: TagProps<"span">["mix"];
		at: LngLat;
		/** The pill's content, such as a price; with text it names the marker. */
		label: RemixNode;
		/** Renders the marker as a link; a popup then opens on hover and focus. */
		href?: string;
		/** Lights the marker as if pointed at, such as while its listing is hovered. */
		highlighted?: boolean;
		/** Marks the selected marker: inverted colors, drawn above the rest, never clustered. */
		current?: boolean;
		/** @default "neutral" */
		tone?: "brand" | "neutral";
		/** Record key shared with a listing row, linked through `mapLink`. */
		mapKey?: string;
		/** A {@link GeoMap.Popup}. */
		children?: RemixNode;
	}

	/** What a marker hands its popup. */
	export interface MarkerContext {
		popupId: string;
		anchor: string;
	}

	/** Every native `<div>` attribute; the popup's content is its children. */
	export interface PopupProps extends Omit<TagProps<"div">, "id" | "popover" | "style"> {
		children?: RemixNode;
	}

	/** Every native `<svg>` attribute but its geometry, plus the line the route follows. */
	export interface RouteProps extends Omit<TagProps<"svg">, "children" | "viewBox"> {
		path: LngLat[];
		/**
		 * Share of the route travelled, from 0 to 1, drawn solid; the rest is dashed.
		 * @default 0
		 */
		progress?: number;
		/** {@link GeoMap.RouteMarker} elements. */
		children?: RemixNode;
	}

	/** What a route hands its markers. */
	export interface RouteContext {
		d: string;
		progress: number;
	}

	/** Every native `<g>` attribute, plus where along the route the glyph sits. */
	export interface RouteMarkerProps extends Omit<TagProps<"g">, "children" | "style"> {
		/**
		 * `progress` follows the route's progress and the live `--ui-map-progress` property; a
		 * number is a fixed share.
		 * @default "progress"
		 */
		at?: "progress" | "start" | "end" | number;
		/** SVG glyph centred on the origin; a dot with a halo when omitted. */
		children?: RemixNode;
	}

	/** The form fields a "Search this area" button fills, and its content. */
	export interface AreaProps extends Omit<TagProps<"button">, "children" | "form" | "type"> {
		/** The id of the form the fields and the button belong to. */
		form: string;
		/** The button's content, such as "Search this area". */
		label: RemixNode;
		/**
		 * Field receiving `west,south,east,north`.
		 * @default "bounds"
		 */
		name?: string;
		/**
		 * Field receiving `longitude,latitude` of the middle.
		 * @default "center"
		 */
		centerName?: string;
		/**
		 * Field receiving the zoom.
		 * @default "zoom"
		 */
		zoomName?: string;
	}
}

/** The key a marker is known by in a cluster, from its point and record key. */
function markerKey(at: LngLat, mapKey: string | undefined): string {
	return `${at[0]},${at[1]},${mapKey ?? ""}`;
}

/** True for a Remix element of component `type`. */
function isElementOf(node: unknown, type: unknown): node is RemixElement {
	return typeof node === "object" && node !== null && "type" in node && node.type === type;
}

/**
 * Collects the props of every element of `type` among `node`, looking through arrays and
 * fragments, so the stage can cluster markers before they render.
 */
function collect<P>(node: RemixNode, type: unknown, found: P[] = []): P[] {
	if (Array.isArray(node)) {
		for (let child of node) collect(child, type, found);
		return found;
	}
	if (isElementOf(node, type)) found.push(node.props as P);
	else if (isElementOf(node, Fragment)) collect(node.props.children as RemixNode, type, found);
	return found;
}

/** Reads the stage's context; outside a stage, a world view with nothing clustered. */
function stageOf(handle: Handle<object, object>): GeoMap.Context {
	let context = handle.context.get(GeoMap) as GeoMap.Context | undefined;
	return (
		context ?? {
			id: "",
			view: { center: [0, 0], zoom: 0 },
			minZoom: DEFAULT_MIN_ZOOM,
			maxZoom: DEFAULT_MAX_ZOOM,
			viewport: DEFAULT_VIEWPORT,
			clustered: new Set(),
		}
	);
}

/** Clamps a share to 0–1, reading anything that is not a number as 0. */
function clampShare(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

/** Styles one round control: a 44px target on a raised surface. */
function controlStyle() {
	return [
		raw({
			display: "grid",
			placeItems: "center",
			inlineSize: "2.75rem",
			blockSize: "2.75rem",
			padding: "0",
			border: "0",
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			background: "var(--ui-surface-raised, Canvas)",
			color: "var(--ui-neutral-fg-emphasis, CanvasText)",
			boxShadow: "var(--ui-shadow-ring), 0 2px 6px -2px rgb(0 0 0 / 0.2)",
			cursor: "pointer",
			textDecoration: "none",
			"&[hidden]": { display: "none" },
			"&:hover": { background: "var(--ui-neutral-bg-tint-hover, Canvas)" },
			'&[aria-disabled="true"]': { color: "var(--ui-neutral-fg-muted)", cursor: "default" },
			'&[aria-pressed="true"]': { color: "var(--ui-brand-fg, LinkText)" },
			"@media (forced-colors: active)": { border: "1px solid ButtonText" },
		}),
		when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring, Highlight)" })),
	];
}

/**
 * The map stage: a region at the full size of its parent (20rem tall at least) that draws the
 * basemap as SVG, writes place names, clusters close markers into bubbles and shows the
 * controls, then hands the stage to the island, which mounts MapLibre in it when WebGL works.
 *
 * @example
 * <GeoMap id="stays-map" label="Stays in Lisbon" center={[-9.14, 38.72]} zoom={12} labels={labels} navigation={{ href: (view) => `?zoom=${view.zoom}&center=${view.center}` }}>
 * 	<GeoMap.Marker at={[-9.15, 38.71]} label="$182" href="/stays/1" mapKey="1" />
 * </GeoMap>
 */
export function GeoMap(handle: Handle<GeoMap.Props, GeoMap.Context>) {
	return () => {
		let {
			basemap,
			center,
			children,
			clusterRadius,
			controls,
			id,
			label,
			labels,
			maxZoom,
			minZoom,
			mix,
			navigation,
			viewport,
			workerUrl,
			zoom,
			...rest
		} = handle.props;
		let min = minZoom ?? DEFAULT_MIN_ZOOM;
		let max = maxZoom ?? DEFAULT_MAX_ZOOM;
		let view: View = { center, zoom: clampZoom(zoom, min, max) };
		let radius = clusterRadius ?? DEFAULT_CLUSTER_RADIUS;
		let shown = controls ?? DEFAULT_CONTROLS;

		let markers = collect<GeoMap.MarkerProps>(children, GeoMap.Marker);
		let groups = clusterPoints(
			markers.map((marker) => {
				let [x, y] = offsetFrom(view, marker.at);
				return { x, y, alone: marker.current === true };
			}),
			radius,
		).filter((group) => group.members.length > 1);
		let clustered = new Set(
			groups.flatMap((group) =>
				group.members.map((index) => markerKey(markers[index]!.at, markers[index]!.mapKey)),
			),
		);

		handle.context.set({
			id,
			view,
			minZoom: min,
			maxZoom: max,
			viewport: viewport ?? DEFAULT_VIEWPORT,
			clustered,
		});

		let ground = basemap?.kind === "geojson" && basemap.ground === "water" ? "water" : "land";
		let project = (point: number[]) => offsetFrom(view, [point[0] ?? 0, point[1] ?? 0]);
		let places = basemap?.kind === "geojson" ? placeLabels(basemap.data) : [];

		return (
			<div
				role="region"
				aria-label={label}
				{...rest}
				id={id}
				data-slot="map"
				data-ground={ground}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							isolation: "isolate",
							overflow: "clip",
							inlineSize: "100%",
							minInlineSize: "0",
							blockSize: "100%",
							minBlockSize: "var(--ui-map-min-height, 20rem)",
							borderRadius: "var(--ui-map-radius, 0.75rem)",
							background: BASEMAP_PAINT.land,
							"--ui-map-halo": BASEMAP_PAINT.land,
							'&[data-ground="water"]': {
								background: BASEMAP_PAINT.water,
								"--ui-map-halo": BASEMAP_PAINT.water,
							},
							'&[data-engine="live"] > [data-slot="map-basemap"], &[data-engine="live"] > [data-slot="map-fallback"]':
								{ visibility: "hidden" },
							"&:fullscreen": { borderRadius: "0" },
						}),
					],
					mix,
				)}
			>
				{basemap?.kind === "geojson" ? (
					<svg
						aria-hidden="true"
						focusable="false"
						data-slot="map-basemap"
						width="1"
						height="1"
						mix={[
							raw({
								position: "absolute",
								insetInlineStart: "50%",
								insetBlockStart: "50%",
								overflow: "visible",
								pointerEvents: "none",
							}),
						]}
					>
						{KIND_ORDER.map((kind) => {
							let features = basemap.data.features.filter(
								(feature) => featureKind(feature) === kind,
							);
							if (kind !== "road") {
								let d = features.map((feature) => geometryPath(feature.geometry, project)).join("");
								if (d === "") return null;
								return (
									<path
										d={d}
										fill-rule="evenodd"
										data-kind={kind}
										mix={[raw({ fill: BASEMAP_PAINT[kind], stroke: "none" })]}
									/>
								);
							}
							return [false, true].map((major) => {
								let d = features
									.filter((feature) => (feature.properties?.major === true) === major)
									.map((feature) => geometryPath(feature.geometry, project))
									.join("");
								if (d === "") return null;
								return (
									<path
										d={d}
										data-kind={major ? "road-major" : "road"}
										stroke-width={String(major ? ROAD_WIDTH.major : ROAD_WIDTH.minor)}
										mix={[
											raw({
												fill: "none",
												stroke: BASEMAP_PAINT.road,
												strokeLinecap: "round",
												strokeLinejoin: "round",
											}),
										]}
									/>
								);
							});
						})}
					</svg>
				) : null}
				{basemap?.kind === "style" && basemap.fallback !== undefined ? (
					<div
						aria-hidden="true"
						data-slot="map-fallback"
						mix={[raw({ position: "absolute", inset: "0", pointerEvents: "none" })]}
					>
						{basemap.fallback}
					</div>
				) : null}
				{places.map((place) => {
					let [lng = 0, lat = 0] = place.at;
					return (
						<span
							aria-hidden="true"
							data-slot="map-place"
							data-lng={String(lng)}
							data-lat={String(lat)}
							style={offsetStyle(project(place.at))}
							mix={[
								raw({
									position: "absolute",
									zIndex: "1",
									translate: "-50% -50%",
									fontSize: "0.75rem",
									fontWeight: "600",
									letterSpacing: "0.02em",
									whiteSpace: "nowrap",
									pointerEvents: "none",
									color: BASEMAP_PAINT.label,
									textShadow:
										"0 0 2px var(--ui-map-halo), 0 0 4px var(--ui-map-halo), 0 0 6px var(--ui-map-halo)",
								}),
							]}
						>
							{place.name}
						</span>
					);
				})}
				{children}
				{groups.map((group) => {
					let at = lngLatAt(view, [group.x, group.y]);
					let count = group.members.length;
					let next = clampZoom(view.zoom + CLUSTER_ZOOM_STEP, min, max);
					return (
						<ClusterBubble
							at={at}
							offset={[group.x, group.y]}
							count={count}
							label={clusterLabel(labels.cluster, count)}
							href={navigation?.href({ center: at, zoom: next })}
						/>
					);
				})}
				<ClusterBubble at={center} offset={[0, 0]} count={0} label="" template />
				<div
					data-slot="map-controls"
					mix={[
						raw({
							position: "absolute",
							zIndex: "6",
							insetBlockStart: "0.75rem",
							insetInlineEnd: "0.75rem",
							display: "flex",
							flexDirection: "column",
							gap: "0.375rem",
							"&:not(:has(> :not([hidden])))": { display: "none" },
						}),
					]}
				>
					{shown.includes("zoom") ? (
						<>
							<ZoomControl
								control="zoom-in"
								label={labels.zoomIn}
								view={{ center, zoom: view.zoom + 1 }}
								disabled={view.zoom >= max}
								navigation={navigation}
							>
								<PlusIcon aria-hidden="true" size={18} />
							</ZoomControl>
							<ZoomControl
								control="zoom-out"
								label={labels.zoomOut}
								view={{ center, zoom: view.zoom - 1 }}
								disabled={view.zoom <= min}
								navigation={navigation}
							>
								<MinusIcon aria-hidden="true" size={18} />
							</ZoomControl>
						</>
					) : null}
					{shown.includes("reset") ? (
						<button
							type="button"
							hidden
							aria-label={labels.reset}
							data-map-control="reset"
							mix={controlStyle()}
						>
							<CompassIcon aria-hidden="true" size={18} />
						</button>
					) : null}
					{shown.includes("locate") ? (
						<button
							type="button"
							hidden
							aria-label={labels.locate}
							data-map-control="locate"
							mix={controlStyle()}
						>
							<LocateFixedIcon aria-hidden="true" size={18} />
						</button>
					) : null}
					{shown.includes("fullscreen") ? (
						<button
							type="button"
							hidden
							aria-label={labels.fullscreen}
							aria-pressed="false"
							data-map-control="fullscreen"
							mix={controlStyle()}
						>
							<MaximizeIcon aria-hidden="true" size={18} />
						</button>
					) : null}
				</div>
				<GeoMapEngine
					root={id}
					label={label}
					center={center}
					zoom={view.zoom}
					minZoom={min}
					maxZoom={max}
					clusterRadius={radius}
					clusterLabel={labels.cluster}
					gestureHint={labels.gestureHint}
					workerUrl={workerUrl ?? null}
					basemap={engineBasemap(basemap)}
				/>
			</div>
		);
	};
}

/** The basemap as the island receives it: plain data, with the server-only fallback left out. */
function engineBasemap(basemap: GeoMap.Basemap | undefined): EngineBasemap | null {
	if (basemap === undefined) return null;
	if (basemap.kind === "geojson") return { kind: "geojson", data: basemap.data };
	return { kind: "style", light: basemap.light, dark: basemap.dark ?? basemap.light };
}

/** Props for {@link ZoomControl}. */
interface ZoomControlProps {
	control: "zoom-in" | "zoom-out";
	label: string;
	/** The view the control leads to, which a link carries without script. */
	view: View;
	disabled: boolean;
	navigation: GeoMap.Navigation | undefined;
	children: RemixNode;
}

/**
 * A zoom step: a link to the next view when the map has navigation, so it zooms without
 * script, and otherwise a button the island reveals. At the zoom limit the link has no address.
 */
function ZoomControl(handle: Handle<ZoomControlProps>) {
	return () => {
		let { children, control, disabled, label, navigation, view } = handle.props;
		if (navigation === undefined) {
			return (
				<button
					type="button"
					hidden
					aria-label={label}
					data-map-control={control}
					aria-disabled={disabled ? "true" : undefined}
					mix={controlStyle()}
				>
					{children}
				</button>
			);
		}
		return (
			<a
				href={disabled ? undefined : navigation.href(view)}
				role={disabled ? "link" : undefined}
				aria-label={label}
				aria-disabled={disabled ? "true" : undefined}
				data-map-control={control}
				mix={controlStyle()}
			>
				{children}
			</a>
		);
	};
}

/** Props for {@link ClusterBubble}. */
interface ClusterBubbleProps {
	at: LngLat;
	offset: Pixel;
	count: number;
	label: string;
	/** Makes it a link that zooms in without script. */
	href?: string;
	/** Renders the hidden copy the island clones its own bubbles from. */
	template?: boolean;
}

/**
 * A round bubble counting the markers it stands for: a link to a closer view when the map has
 * navigation, a button the island zooms with otherwise.
 */
function ClusterBubble(handle: Handle<ClusterBubbleProps>) {
	return () => {
		let { at, count, href, label, offset, template = false } = handle.props;
		let shared = {
			"aria-label": template ? undefined : label,
			"data-slot": "map-cluster",
			"data-cluster-template": template ? "" : undefined,
			"data-lng": String(at[0]),
			"data-lat": String(at[1]),
			hidden: template,
			style: offsetStyle(offset),
			mix: [
				raw({
					position: "absolute",
					zIndex: "3",
					display: "grid",
					placeItems: "center",
					minInlineSize: "2.5rem",
					blockSize: "2.5rem",
					paddingInline: "0.5rem",
					border: "0",
					borderRadius: "9999px",
					translate: "-50% -50%",
					font: "inherit",
					fontSize: "0.875rem",
					fontWeight: "700",
					fontVariantNumeric: "tabular-nums",
					textDecoration: "none",
					cursor: "pointer",
					background: "var(--ui-brand-bg-solid, Highlight)",
					color: "var(--ui-brand-fg-on-solid, HighlightText)",
					boxShadow:
						"0 0 0 4px color-mix(in oklab, var(--ui-brand-bg-solid, Highlight) 28%, transparent), 0 2px 8px -2px rgb(0 0 0 / 0.3)",
					"&[hidden]": { display: "none" },
					"&:hover, &[data-highlighted]": {
						zIndex: "4",
						boxShadow:
							"0 0 0 6px color-mix(in oklab, var(--ui-brand-bg-solid, Highlight) 40%, transparent), 0 4px 12px -4px rgb(0 0 0 / 0.35)",
					},
					"@media (forced-colors: active)": { border: "2px solid ButtonText" },
				}),
				when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring, Highlight)" })),
				motionSafe(
					raw({
						transition: "scale 140ms ease-out",
						"&:hover, &[data-highlighted]": { scale: "1.08" },
					}),
				),
			],
		};
		if (href !== undefined) {
			return (
				<a {...shared} href={href}>
					{String(count)}
				</a>
			);
		}
		return (
			<button type="button" {...shared}>
				{template ? null : String(count)}
			</button>
		);
	};
}

/**
 * One marker: a pill whose tail tips onto its point, as a link with `href` or a button
 * otherwise. A {@link GeoMap.Popup} child opens from the button natively, or on hover and focus
 * of a link once the island runs. Inside a cluster it renders `hidden` behind the bubble.
 *
 * @example <GeoMap.Marker at={[-9.15, 38.71]} label="$182" href="/stays/7" mapKey="7" current />
 */
GeoMap.Marker = function GeoMapMarker(handle: Handle<GeoMap.MarkerProps, GeoMap.MarkerContext>) {
	return () => {
		let {
			at,
			children,
			current = false,
			highlighted = false,
			href,
			label,
			mapKey,
			mix,
			tone,
			...rest
		} = handle.props;
		let stage = stageOf(handle);
		let popupId = `${stage.id || "map"}-popup-${handle.id.replace(/[^\w-]/g, "-")}`;
		let anchor = anchorFor(popupId);
		let hasPopup = collect(children, GeoMap.Popup).length > 0;
		handle.context.set({ popupId, anchor });

		let shared = {
			"aria-current": current ? ("true" as const) : undefined,
			"data-slot": "map-marker",
			"data-lng": String(at[0]),
			"data-lat": String(at[1]),
			"data-tone": tone ?? DEFAULT_TONE,
			"data-current": current ? "" : undefined,
			"data-highlighted": highlighted ? "" : undefined,
			"data-map-popup": hasPopup && href !== undefined ? popupId : undefined,
			hidden: stage.clustered.has(markerKey(at, mapKey)),
			style: { ...offsetStyle(offsetFrom(stage.view, at)), anchorName: anchor },
			mix: mergeMix<HTMLElement>(
				[
					raw({
						position: "absolute",
						zIndex: "3",
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
						background: "var(--ui-surface-raised, Canvas)",
						color: "var(--ui-neutral-fg-emphasis, CanvasText)",
						boxShadow: "var(--ui-shadow-ring), 0 2px 6px -3px rgb(0 0 0 / 0.25)",
						"&[hidden]": { display: "none" },
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
							zIndex: "4",
							background: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
						},
						'&[data-tone="brand"][aria-current]': {
							background: "var(--ui-surface-raised, Canvas)",
							color: "var(--ui-brand-fg-emphasis)",
							boxShadow: "0 0 0 2px var(--ui-brand-bg-solid)",
						},
						"&:hover, &:focus-visible, &[data-highlighted]": {
							zIndex: "5",
							boxShadow: "var(--ui-shadow-ring-hover), 0 4px 12px -4px rgb(0 0 0 / 0.3)",
						},
						"&[data-highlighted]:not([aria-current])": {
							background: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
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

		let pin =
			href !== undefined ? (
				<a {...(rest as Omit<TagProps<"a">, "href" | "role">)} {...shared} href={href}>
					{label}
				</a>
			) : (
				<button type="button" popovertarget={hasPopup ? popupId : undefined} {...rest} {...shared}>
					{label}
				</button>
			);
		return (
			<>
				{pin}
				{children}
			</>
		);
	};
};

/**
 * A card a marker opens, anchored above its pin with CSS anchor positioning and flipped below
 * when the top has no room. It is an `auto` popover, so a click outside or Escape closes it.
 *
 * @example <GeoMap.Popup><StayCard stay={stay} /></GeoMap.Popup>
 */
GeoMap.Popup = function GeoMapPopup(handle: Handle<GeoMap.PopupProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let marker = handle.context.get(GeoMap.Marker) as GeoMap.MarkerContext | undefined;
		return (
			<div
				{...rest}
				popover="auto"
				id={marker?.popupId}
				data-slot="map-popup"
				style={{ positionAnchor: marker?.anchor }}
				mix={mergeMix(
					[
						raw({
							inset: "auto",
							margin: "0",
							marginBlock: "0.75rem",
							positionArea: "top",
							positionTryFallbacks: "flip-block",
							inlineSize: "min(18rem, calc(100vw - 2rem))",
							maxBlockSize: "calc(100dvh - 2rem)",
							overflow: "auto",
							padding: "0",
							border: "0",
							borderRadius: "var(--ui-radius-xl, 0.75rem)",
							background: "var(--ui-surface-raised, Canvas)",
							color: "var(--ui-fg, CanvasText)",
							boxShadow: "var(--ui-shadow-stage)",
							"@media (forced-colors: active)": { border: "1px solid CanvasText" },
						}),
						motionSafe(
							raw({
								transition:
									"opacity 140ms ease-out, translate 140ms ease-out, display 140ms allow-discrete, overlay 140ms allow-discrete",
								"&:popover-open": { opacity: "1", translate: "0 0" },
								"@starting-style": { "&:popover-open": { opacity: "0", translate: "0 4px" } },
							}),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/**
 * Draws a route along real coordinates: a light casing, the whole line dashed and the
 * travelled share solid on top. The solid part keeps `pathLength="1"` and a
 * `stroke-dasharray` of `"<share> 2"`, so a live script moves it by rewriting that attribute.
 *
 * @example <GeoMap.Route path={[[-9.16, 38.70], [-9.14, 38.71]]} progress={0.4}><GeoMap.RouteMarker /></GeoMap.Route>
 */
GeoMap.Route = function GeoMapRoute(handle: Handle<GeoMap.RouteProps, GeoMap.RouteContext>) {
	return () => {
		let { children, mix, path, progress, ...rest } = handle.props;
		let stage = stageOf(handle);
		let d = routePathData(path, (point) => offsetFrom(stage.view, point));
		let share = clampShare(progress ?? 0);
		handle.context.set({ d, progress: share });
		let line = {
			fill: "none",
			strokeLinecap: "round",
			strokeLinejoin: "round",
		} as const;
		return (
			<svg
				{...rest}
				aria-hidden="true"
				focusable="false"
				width="1"
				height="1"
				data-slot="map-route"
				data-path={JSON.stringify(path)}
				mix={mergeMix(
					[
						raw({
							position: "absolute",
							zIndex: "2",
							insetInlineStart: "50%",
							insetBlockStart: "50%",
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
							...line,
							stroke: "var(--ui-map-route-casing, var(--ui-surface-raised, Canvas))",
							strokeWidth: "var(--ui-map-route-casing-width, 8)",
						}),
					]}
				/>
				<path
					d={d}
					data-route-part="ahead"
					mix={[
						raw({
							...line,
							stroke: "var(--ui-map-route-color, var(--ui-brand-bg-solid))",
							strokeOpacity: "0.55",
							strokeWidth: "var(--ui-map-route-width, 4)",
							strokeDasharray: "var(--ui-map-route-dash, 2 8)",
						}),
					]}
				/>
				<path
					d={d}
					pathLength="1"
					data-route-part="done"
					stroke-dasharray={`${share} 2`}
					mix={[
						raw({
							...line,
							stroke: "var(--ui-map-route-color, var(--ui-brand-bg-solid))",
							strokeWidth: "var(--ui-map-route-width, 4)",
						}),
					]}
				/>
				{children}
			</svg>
		);
	};
};

/**
 * Places a glyph along its route with CSS motion paths. At `progress` it reads
 * `--ui-map-progress` and carries `data-map-marker`, so a live script moves it with
 * `el.style.setProperty("--ui-map-progress", "0.6")` and it glides there, or jumps under
 * reduced motion. The island keeps its path in step with panning and zooming.
 *
 * @example <GeoMap.RouteMarker at="progress"><circle r="8" /></GeoMap.RouteMarker>
 */
GeoMap.RouteMarker = function GeoMapRouteMarker(handle: Handle<GeoMap.RouteMarkerProps>) {
	return () => {
		let { at = "progress", children, mix, ...rest } = handle.props;
		let route = (handle.context.get(GeoMap.Route) as GeoMap.RouteContext | undefined) ?? {
			d: "",
			progress: 0,
		};
		let share = routeShare(at, route.progress);
		return (
			<g
				{...rest}
				data-slot="map-route-marker"
				data-map-marker={at === "progress" ? "" : undefined}
				style={{
					"--ui-map-progress": String(share),
					offsetPath: `path(${JSON.stringify(route.d)})`,
				}}
				mix={mergeMix(
					[
						raw({
							offsetDistance: "calc(var(--ui-map-progress) * 100%)",
							offsetRotate: "0deg",
							offsetAnchor: "0 0",
						}),
						motionSafe(raw({ transition: "offset-distance 400ms ease-out" })),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				{children ?? (
					<>
						<circle
							r="12"
							fill-opacity="0.22"
							mix={[raw({ fill: "var(--ui-map-marker-color, var(--ui-brand-bg-solid))" })]}
						/>
						<circle
							r="6"
							mix={[
								raw({
									fill: "var(--ui-map-marker-color, var(--ui-brand-bg-solid))",
									stroke: "var(--ui-surface-raised, Canvas)",
									strokeWidth: "2",
								}),
							]}
						/>
					</>
				)}
			</g>
		);
	};
};

/** The share of its route a route marker sits at. */
function routeShare(at: GeoMap.RouteMarkerProps["at"], progress: number): number {
	if (at === "start") return 0;
	if (at === "end") return 1;
	if (typeof at === "number") return clampShare(at);
	return progress;
}

/**
 * A "Search this area" button for a search form: hidden fields carry the bounds, middle and
 * zoom the page was drawn at, and once the visitor pans or zooms, the island rewrites them and
 * reveals the button, which submits the form named by `form`.
 *
 * @example <GeoMap.Area form="stay-search" label="Search this area" />
 */
GeoMap.Area = function GeoMapArea(handle: Handle<GeoMap.AreaProps>) {
	return () => {
		let { centerName, form, label, mix, name, zoomName, ...rest } = handle.props;
		let stage = stageOf(handle);
		let bounds = viewBounds(stage.view, stage.viewport);
		return (
			<>
				<input
					type="hidden"
					form={form}
					name={name ?? DEFAULT_AREA_NAMES.bounds}
					value={formatBounds(bounds)}
					data-map-area="bounds"
				/>
				<input
					type="hidden"
					form={form}
					name={centerName ?? DEFAULT_AREA_NAMES.center}
					value={formatLngLat(stage.view.center)}
					data-map-area="center"
				/>
				<input
					type="hidden"
					form={form}
					name={zoomName ?? DEFAULT_AREA_NAMES.zoom}
					value={String(roundTo(stage.view.zoom, 2))}
					data-map-area="zoom"
				/>
				<button
					{...rest}
					type="submit"
					form={form}
					hidden
					data-slot="map-area"
					mix={mergeMix(
						[
							raw({
								position: "absolute",
								zIndex: "6",
								insetBlockStart: "0.75rem",
								insetInlineStart: "50%",
								translate: "-50% 0",
								display: "inline-flex",
								alignItems: "center",
								minBlockSize: "2.75rem",
								paddingInline: "1rem",
								border: "0",
								borderRadius: "9999px",
								font: "inherit",
								fontSize: "0.875rem",
								fontWeight: "600",
								whiteSpace: "nowrap",
								cursor: "pointer",
								background: "var(--ui-surface-raised, Canvas)",
								color: "var(--ui-neutral-fg-emphasis, CanvasText)",
								boxShadow: "var(--ui-shadow-ring), 0 4px 12px -4px rgb(0 0 0 / 0.3)",
								"&[hidden]": { display: "none" },
								"@media (forced-colors: active)": { border: "1px solid ButtonText" },
							}),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring, Highlight)" }),
							),
						],
						mix,
					)}
				>
					{label}
				</button>
			</>
		);
	};
};

/**
 * The island every map stage renders: it finds the stage by id and hands it to the browser
 * engine, then passes on new props after a re-render such as a frame swap, so the camera
 * follows a server-chosen view. It draws nothing itself.
 */
export const GeoMapEngine: EntryComponent<EngineProps> = clientEntry(
	"@sdxc/ui/map/map#GeoMapEngine",
	function GeoMapEngine(handle: Handle<EngineProps>) {
		let session: EngineSession | undefined;

		handle.queueTask(async () => {
			let stage = document.getElementById(handle.props.root);
			if (stage === null) return;
			let controller = new AbortController();
			handle.signal.addEventListener("abort", () => controller.abort(), { once: true });
			session = await startEngine(stage, { ...handle.props }, controller.signal);
			session?.sync({ ...handle.props });
		});

		return () => {
			handle.queueTask(() => session?.sync({ ...handle.props }));
			return <span hidden data-slot="map-engine" />;
		};
	},
);
