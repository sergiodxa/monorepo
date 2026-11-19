/**
 * The browser side of a map stage: loads MapLibre on demand into the server-rendered stage,
 * keeps the same marker, label and route nodes placed as the map pans and zooms, reclusters,
 * and runs the controls and the search area. Without WebGL the server render stays as it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import type { MapFeatureCollection } from "./utils/basemap.js";
import type { LngLat, Pixel } from "./utils/mercator.js";

import { BASEMAP_PAINT, featureKind, linePath, ROAD_WIDTH } from "./utils/basemap.js";
import { clusterLabel, clusterPoints } from "./utils/cluster.js";
import { formatBounds, formatLngLat, roundTo } from "./utils/mercator.js";
import { offsetStyle, readPath } from "./utils/stage.js";

/** How long the island waits for the first frame before it keeps the server render. */
const LOAD_TIMEOUT_MS = 10_000;

/** How long a link marker's popup stays open after the pointer or focus leaves it. */
const POPUP_LINGER_MS = 160;

/** Room in pixels kept around markers when a cluster zooms to fit them. */
const FIT_PADDING = 64;

/** Zoom a located visitor is shown at, at least. */
const LOCATE_ZOOM = 14;

/** The basemap as plain data the browser can draw. */
export type EngineBasemap =
	| { kind: "geojson"; data: MapFeatureCollection }
	| { kind: "style"; light: string; dark: string };

/** What the stage serializes for the browser. */
export interface EngineProps {
	/** The id of the stage element. */
	root: string;
	/** The map's accessible name, given to the canvas. */
	label: string;
	center: LngLat;
	zoom: number;
	minZoom: number;
	maxZoom: number;
	basemap: EngineBasemap | null;
	clusterRadius: number;
	/** A bubble's accessible name, with `{count}` for its markers. */
	clusterLabel: string;
	gestureHint: string;
	workerUrl: string | null;
}

/** True when the browser can create a WebGL context, which MapLibre draws with. */
function webglAvailable(): boolean {
	try {
		let canvas = document.createElement("canvas");
		return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null;
	} catch {
		return false;
	}
}

/** True while the visitor asks for reduced motion, read at the moment a camera moves. */
function reducedMotion(): boolean {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Resolves a CSS color expression, custom properties included, to `rgba()` as MapLibre reads it,
 * by painting it once: the stage's own properties apply, so theme and page overrides follow.
 */
function resolveColor(stage: HTMLElement, expression: string): string {
	let probe = document.createElement("span");
	probe.style.color = expression;
	probe.hidden = true;
	stage.appendChild(probe);
	let computed = getComputedStyle(probe).color;
	probe.remove();
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d", { willReadFrequently: true });
	if (context === null) return computed;
	context.fillStyle = computed;
	context.fillRect(0, 0, 1, 1);
	let [r = 0, g = 0, b = 0, a = 255] = context.getImageData(0, 0, 1, 1).data;
	return `rgba(${r}, ${g}, ${b}, ${roundTo(a / 255, 3)})`;
}

/** True when the stage's page color is dark, which picks a style basemap's dark URL. */
function isDark(stage: HTMLElement): boolean {
	let match = /rgba\((\d+), (\d+), (\d+)/.exec(resolveColor(stage, "var(--ui-bg, Canvas)"));
	if (match === null) return false;
	let [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** The colors a vector basemap paints with, read from the stage. */
function basemapColors(stage: HTMLElement) {
	return {
		land: resolveColor(stage, BASEMAP_PAINT.land),
		water: resolveColor(stage, BASEMAP_PAINT.water),
		park: resolveColor(stage, BASEMAP_PAINT.park),
		road: resolveColor(stage, BASEMAP_PAINT.road),
	};
}

/**
 * A MapLibre style drawing a GeoJSON basemap from one inline source, with no glyphs, sprites
 * or tiles to fetch; place names stay HTML on the stage.
 */
function geojsonStyle(
	data: MapFeatureCollection,
	ground: "land" | "water",
	colors: ReturnType<typeof basemapColors>,
): StyleSpecification {
	let features = data.features.map((feature) => ({
		...feature,
		properties: { ...feature.properties, kind: featureKind(feature) },
	}));
	let fill = (kind: "land" | "park" | "water") => ({
		id: kind,
		type: "fill" as const,
		source: "basemap",
		filter: ["==", ["get", "kind"], kind] as ["==", ["get", string], string],
		paint: { "fill-color": colors[kind], "fill-antialias": true },
	});
	return {
		version: 8,
		sources: {
			basemap: { type: "geojson", data: { type: "FeatureCollection", features } as never },
		},
		layers: [
			{ id: "ground", type: "background", paint: { "background-color": colors[ground] } },
			fill("land"),
			fill("park"),
			fill("water"),
			{
				id: "road",
				type: "line",
				source: "basemap",
				filter: ["==", ["get", "kind"], "road"],
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": colors.road,
					"line-width": [
						"case",
						["==", ["get", "major"], true],
						ROAD_WIDTH.major,
						ROAD_WIDTH.minor,
					],
				},
			},
		],
	};
}

/** A running map, kept in step with the stage until stopped. */
export interface EngineSession {
	/** Applies new props after the stage re-renders, such as a frame swap. */
	sync(props: EngineProps): void;
	stop(): void;
}

/**
 * Opens a link marker's popup on hover and focus and closes it shortly after both leave, and
 * places any popup by script where CSS anchor positioning is missing.
 */
function bindPopups(stage: HTMLElement, signal: AbortSignal): void {
	let timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
	let anchored = CSS.supports("anchor-name: --a");

	/** The popup a marker, or the popup itself, belongs to. */
	function popupOf(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		let popup = target.closest<HTMLElement>('[data-slot="map-popup"]');
		if (popup !== null) return popup;
		let id = target.closest<HTMLElement>("[data-map-popup]")?.dataset.mapPopup;
		return id === undefined ? null : document.getElementById(id);
	}

	/** Opens a popup and cancels a pending close. */
	function open(popup: HTMLElement): void {
		clearTimeout(timers.get(popup));
		if (!popup.matches(":popover-open")) popup.showPopover();
	}

	/** Closes a popup after a short pause unless the pointer or focus comes back. */
	function linger(popup: HTMLElement): void {
		clearTimeout(timers.get(popup));
		timers.set(
			popup,
			setTimeout(() => {
				if (popup.matches(":hover, :focus-within")) return;
				let marker = stage.querySelector(`[data-map-popup="${CSS.escape(popup.id)}"]`);
				if (marker?.matches(":hover, :focus")) return;
				if (popup.matches(":popover-open")) popup.hidePopover();
			}, POPUP_LINGER_MS),
		);
	}

	let options = { signal };
	stage.addEventListener(
		"pointerover",
		(event) => {
			let popup = popupOf(event.target);
			if (popup !== null) open(popup);
		},
		options,
	);
	stage.addEventListener(
		"focusin",
		(event) => {
			let target = event.target;
			if (target instanceof Element && target.closest("[data-map-popup]") === null) return;
			let popup = popupOf(target);
			if (popup !== null) open(popup);
		},
		options,
	);
	for (let type of ["pointerout", "focusout"] as const) {
		stage.addEventListener(
			type,
			(event) => {
				let popup = popupOf(event.target);
				if (popup === null) return;
				if (popupOf(event.relatedTarget) === popup) return;
				linger(popup);
			},
			options,
		);
	}
	if (anchored) return;
	stage.addEventListener(
		"toggle",
		(event) => {
			let popup = event.target;
			if (!(popup instanceof HTMLElement) || popup.dataset.slot !== "map-popup") return;
			if (!popup.matches(":popover-open")) return;
			let marker = stage.querySelector(
				`[data-map-popup="${CSS.escape(popup.id)}"], [popovertarget="${CSS.escape(popup.id)}"]`,
			);
			if (marker === null) return;
			let pin = marker.getBoundingClientRect();
			let card = popup.getBoundingClientRect();
			let left = Math.min(
				Math.max(8, pin.left + pin.width / 2 - card.width / 2),
				innerWidth - card.width - 8,
			);
			let above = pin.top - card.height - 12;
			popup.style.position = "fixed";
			popup.style.left = `${left}px`;
			popup.style.top = `${above >= 8 ? above : pin.bottom + 12}px`;
		},
		{ capture: true, signal },
	);
}

/**
 * Folds the basemap's credit into its (i) button. The engine opens it on load, and on a phone
 * the open line covers whatever floats at the map's foot until the first pan.
 */
function collapseAttribution(container: HTMLElement): void {
	let attribution = container.querySelector(".maplibregl-compact-show");
	if (attribution === null) return;
	attribution.classList.remove("maplibregl-compact-show");
	attribution.setAttribute("open", "");
}

/**
 * Mounts MapLibre into the stage and keeps the stage's HTML parts on the map: markers, labels
 * and bubbles move by `left`/`top`, routes by their path data. Resolves `undefined` when WebGL
 * or the library is unavailable, leaving the server render as it was.
 */
async function startMap(
	stage: HTMLElement,
	first: EngineProps,
	signal: AbortSignal,
): Promise<EngineSession | undefined> {
	if (!webglAvailable()) return undefined;
	let [maplibre] = await Promise.all([
		import("maplibre-gl"),
		import("maplibre-gl/dist/maplibre-gl.css").catch(() => undefined),
	]);
	if (signal.aborted) return undefined;
	if (first.workerUrl !== null) maplibre.setWorkerUrl(first.workerUrl);

	let props = first;
	let applied = { center: first.center, zoom: first.zoom };
	let dark = isDark(stage);
	let ground: "land" | "water" = stage.dataset.ground === "water" ? "water" : "land";
	let container = document.createElement("div");
	container.dataset.slot = "map-engine-canvas";
	container.setAttribute(
		"style",
		"position:absolute;inset:0;z-index:0;opacity:0;pointer-events:none;border-radius:inherit",
	);
	stage.insertBefore(container, stage.firstChild);

	/** The style the basemap draws with in the current theme. */
	function styleFor(basemap: EngineBasemap | null): StyleSpecification | string {
		if (basemap?.kind === "style") return dark ? basemap.dark : basemap.light;
		let colors = basemapColors(stage);
		let data = basemap?.data ?? { type: "FeatureCollection", features: [] };
		return geojsonStyle(data, ground, colors);
	}

	let map: MapLibreMap;
	try {
		map = new maplibre.Map({
			container,
			style: styleFor(props.basemap),
			center: props.center,
			zoom: props.zoom,
			minZoom: props.minZoom,
			maxZoom: props.maxZoom,
			attributionControl: props.basemap?.kind === "style" ? { compact: true } : false,
			cooperativeGestures: matchMedia("(pointer: coarse)").matches,
			dragRotate: false,
			pitchWithRotate: false,
			touchPitch: false,
			fadeDuration: reducedMotion() ? 0 : 300,
			locale: {
				"Map.Title": props.label,
				"CooperativeGesturesHandler.WindowsHelpText": props.gestureHint,
				"CooperativeGesturesHandler.MacHelpText": props.gestureHint,
				"CooperativeGesturesHandler.MobileHelpText": props.gestureHint,
			},
		});
	} catch {
		container.remove();
		return undefined;
	}
	map.touchZoomRotate.disableRotation();
	map.keyboard.disableRotation();

	let live = await new Promise<boolean>((resolve) => {
		let timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
		map.once("idle", () => {
			clearTimeout(timer);
			resolve(true);
		});
		signal.addEventListener("abort", () => resolve(false), { once: true });
	});
	if (!live) {
		map.remove();
		container.remove();
		return undefined;
	}
	collapseAttribution(container);

	let members = new WeakMap<Element, LngLat[]>();
	let quiet = false;
	let frame = 0;
	let located: LngLat | undefined;

	/** Pixels from the stage's middle to a point at the current camera. */
	function offsetOf(point: LngLat): Pixel {
		let projected = map.project(point);
		return [projected.x - stage.clientWidth / 2, projected.y - stage.clientHeight / 2];
	}

	/** Moves a part to `point`. */
	function place(element: HTMLElement, point: LngLat): void {
		let { left, top } = offsetStyle(offsetOf(point));
		element.style.left = left;
		element.style.top = top;
	}

	/** Reads a part's point from its `data-lng`/`data-lat`. */
	function pointOf(element: HTMLElement): LngLat {
		return [Number(element.dataset.lng), Number(element.dataset.lat)];
	}

	/** Lights a bubble while any marker inside it is lit, so a hovered listing finds its spot. */
	function lightBubbles(): void {
		for (let bubble of stage.querySelectorAll<HTMLElement>('[data-slot="map-cluster"]')) {
			let keys = bubble.dataset.keys?.split(" ") ?? [];
			let lit = keys.some(
				(key) =>
					key !== "" &&
					stage.querySelector(
						`[data-slot="map-marker"][data-map-key="${CSS.escape(key)}"][data-highlighted]`,
					) !== null,
			);
			if (lit === bubble.hasAttribute("data-highlighted")) continue;
			if (lit) bubble.setAttribute("data-highlighted", "");
			else bubble.removeAttribute("data-highlighted");
		}
	}

	/** Places every part for the current camera and rebuilds the bubbles. */
	function layout(): void {
		frame = 0;
		for (let element of stage.querySelectorAll<HTMLElement>(
			'[data-slot="map-marker"], [data-slot="map-place"], [data-slot="map-you"]',
		)) {
			place(element, pointOf(element));
		}
		for (let route of stage.querySelectorAll<SVGSVGElement>('[data-slot="map-route"]')) {
			let d = linePath(readPath(route.getAttribute("data-path")), (point) =>
				offsetOf([point[0] ?? 0, point[1] ?? 0]),
			);
			for (let part of route.querySelectorAll("[data-route-part]")) part.setAttribute("d", d);
			for (let marker of route.querySelectorAll<SVGElement>('[data-slot="map-route-marker"]')) {
				marker.style.offsetPath = `path(${JSON.stringify(d)})`;
			}
		}

		let markers = [...stage.querySelectorAll<HTMLElement>('[data-slot="map-marker"]')];
		let groups = clusterPoints(
			markers.map((marker) => {
				let [x, y] = offsetOf(pointOf(marker));
				return { x, y, alone: marker.hasAttribute("data-current") };
			}),
			props.clusterRadius,
		);
		let template = stage.querySelector<HTMLElement>("[data-cluster-template]");
		let pool = [
			...stage.querySelectorAll<HTMLElement>(
				'[data-slot="map-cluster"]:not([data-cluster-template])',
			),
		];
		for (let group of groups) {
			let grouped = group.members.length > 1;
			for (let index of group.members) markers[index]!.hidden = grouped;
			if (!grouped || template === null) continue;
			let bubble = pool.shift() ?? (template.cloneNode(true) as HTMLElement);
			if (!bubble.isConnected) {
				bubble.removeAttribute("data-cluster-template");
				template.parentNode?.insertBefore(bubble, template);
			}
			bubble.hidden = false;
			let points = group.members.map((index) => pointOf(markers[index]!));
			members.set(bubble, points);
			bubble.dataset.keys = group.members
				.map((index) => markers[index]!.dataset.mapKey ?? "")
				.join(" ");
			bubble.textContent = String(group.members.length);
			bubble.setAttribute("aria-label", clusterLabel(props.clusterLabel, group.members.length));
			let { left, top } = offsetStyle([group.x, group.y]);
			bubble.style.left = left;
			bubble.style.top = top;
		}
		for (let unused of pool) unused.remove();
		lightBubbles();

		let zoom = map.getZoom();
		for (let control of stage.querySelectorAll<HTMLElement>("[data-map-control^='zoom-']")) {
			let limit =
				control.dataset.mapControl === "zoom-in" ? zoom >= props.maxZoom : zoom <= props.minZoom;
			if (limit) control.setAttribute("aria-disabled", "true");
			else control.removeAttribute("aria-disabled");
		}
	}

	/** Lays the stage out on the next frame, once per frame however many moves arrive. */
	function schedule(): void {
		if (frame === 0) frame = requestAnimationFrame(layout);
	}

	/** Writes the visible bounds, middle and zoom into the search area's fields. */
	function writeArea(): void {
		let bounds = map.getBounds();
		let center = map.getCenter();
		let values: Record<string, string> = {
			bounds: formatBounds([
				bounds.getWest(),
				bounds.getSouth(),
				bounds.getEast(),
				bounds.getNorth(),
			]),
			center: formatLngLat([center.lng, center.lat]),
			zoom: String(roundTo(map.getZoom(), 2)),
		};
		for (let field of stage.querySelectorAll<HTMLInputElement>("input[data-map-area]")) {
			let value = values[field.dataset.mapArea ?? ""];
			if (value !== undefined) field.value = value;
		}
	}

	/** Moves the camera, without animation under reduced motion. */
	function animate(): { duration?: number; animate?: boolean } {
		return reducedMotion() ? { duration: 0, animate: false } : {};
	}

	map.on("move", schedule);
	map.on("resize", schedule);
	map.on("moveend", () => {
		schedule();
		writeArea();
		if (quiet) {
			quiet = false;
			return;
		}
		for (let button of stage.querySelectorAll<HTMLElement>('[data-slot="map-area"]')) {
			button.hidden = false;
		}
	});

	stage.addEventListener(
		"click",
		(event) => {
			let target = event.target instanceof Element ? event.target : null;
			let bubble = target?.closest<HTMLElement>('[data-slot="map-cluster"]');
			if (bubble) {
				event.preventDefault();
				let points = members.get(bubble) ?? [];
				if (points.length === 0) return;
				let bounds = new maplibre.LngLatBounds(points[0], points[0]);
				for (let point of points) bounds.extend(point);
				map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: props.maxZoom, ...animate() });
				return;
			}
			let control = target?.closest<HTMLElement>("[data-map-control]");
			if (!control) return;
			event.preventDefault();
			if (control.getAttribute("aria-disabled") === "true") return;
			switch (control.dataset.mapControl) {
				case "zoom-in":
					map.zoomIn(animate());
					break;
				case "zoom-out":
					map.zoomOut(animate());
					break;
				case "reset":
					map.easeTo({ center: props.center, zoom: props.zoom, ...animate() });
					break;
				case "locate":
					navigator.geolocation?.getCurrentPosition((position) => {
						located = [position.coords.longitude, position.coords.latitude];
						let dot = stage.querySelector<HTMLElement>('[data-slot="map-you"]');
						if (dot === null) {
							dot = document.createElement("span");
							dot.dataset.slot = "map-you";
							dot.setAttribute("aria-hidden", "true");
							dot.setAttribute(
								"style",
								"position:absolute;z-index:3;inline-size:14px;block-size:14px;translate:-50% -50%;border-radius:50%;background:var(--ui-brand-bg-solid);box-shadow:0 0 0 3px var(--ui-surface-raised, Canvas),0 0 0 8px color-mix(in oklab, var(--ui-brand-bg-solid) 25%, transparent)",
							);
							stage.appendChild(dot);
						}
						dot.dataset.lng = String(located[0]);
						dot.dataset.lat = String(located[1]);
						map.easeTo({
							center: located,
							zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
							...animate(),
						});
					});
					break;
				case "fullscreen":
					if (document.fullscreenElement === stage) void document.exitFullscreen();
					else void stage.requestFullscreen?.();
					break;
			}
		},
		{ signal },
	);
	document.addEventListener(
		"fullscreenchange",
		() => {
			let full = document.fullscreenElement === stage;
			for (let control of stage.querySelectorAll('[data-map-control="fullscreen"]')) {
				control.setAttribute("aria-pressed", full ? "true" : "false");
			}
		},
		{ signal },
	);

	/** Repaints the basemap after the theme changes. */
	function recolor(): void {
		let nowDark = isDark(stage);
		if (props.basemap?.kind === "style") {
			if (nowDark !== dark) {
				dark = nowDark;
				map.setStyle(styleFor(props.basemap));
			}
			return;
		}
		dark = nowDark;
		let colors = basemapColors(stage);
		map.setPaintProperty("ground", "background-color", colors[ground]);
		for (let kind of ["land", "park", "water"] as const) {
			map.setPaintProperty(kind, "fill-color", colors[kind]);
		}
		map.setPaintProperty("road", "line-color", colors.road);
	}

	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor, { signal });
	let themeObserver = new MutationObserver(recolor);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style", "data-theme"],
	});

	let partsObserver = new MutationObserver((records) => {
		let relevant = records.some((record) => {
			if (record.type === "attributes") {
				return record.target instanceof HTMLElement && record.target.dataset.slot !== "map-cluster";
			}
			return [...record.addedNodes, ...record.removedNodes].some(
				(node) =>
					node instanceof HTMLElement &&
					node.dataset.slot !== "map-cluster" &&
					node.dataset.slot !== "map-you",
			);
		});
		if (!relevant) return;
		if (records.every((record) => record.type === "attributes")) lightBubbles();
		else schedule();
	});
	partsObserver.observe(stage, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["data-highlighted"],
	});

	for (let server of stage.querySelectorAll<HTMLElement>(
		'[data-slot="map-cluster"]:not([data-cluster-template])',
	)) {
		server.remove();
	}
	for (let control of stage.querySelectorAll<HTMLElement>("[data-map-control]")) {
		control.hidden = false;
	}
	container.style.opacity = "";
	container.style.pointerEvents = "";
	stage.dataset.engine = "live";
	layout();
	writeArea();

	return {
		sync(next) {
			let previous = props;
			props = next;
			let moved =
				next.center[0] !== applied.center[0] ||
				next.center[1] !== applied.center[1] ||
				next.zoom !== applied.zoom;
			if (moved) {
				applied = { center: next.center, zoom: next.zoom };
				quiet = true;
				map.jumpTo({ center: next.center, zoom: next.zoom });
				for (let button of stage.querySelectorAll<HTMLElement>('[data-slot="map-area"]')) {
					button.hidden = true;
				}
			}
			if (
				next.basemap !== null &&
				JSON.stringify(next.basemap) !== JSON.stringify(previous.basemap)
			) {
				map.setStyle(styleFor(next.basemap));
			}
			schedule();
		},
		stop() {
			if (frame !== 0) cancelAnimationFrame(frame);
			themeObserver.disconnect();
			partsObserver.disconnect();
			map.remove();
			container.remove();
			delete stage.dataset.engine;
		},
	};
}

/**
 * Hydrates a map stage: popups of link markers open on hover and focus, and where WebGL works
 * MapLibre takes over the basemap with drag, wheel, pinch and keyboard panning and zooming
 * (two fingers on touch screens). The stage's `data-engine` reads `live` then, or `static`
 * when the server render stays; everything detaches when `signal` aborts.
 */
export async function startEngine(
	stage: HTMLElement,
	props: EngineProps,
	signal: AbortSignal,
): Promise<EngineSession | undefined> {
	bindPopups(stage, signal);
	stage.dataset.engine = "loading";
	let started = await startMap(stage, props, signal).catch(() => undefined);
	if (signal.aborted) {
		started?.stop();
		return undefined;
	}
	if (started === undefined) {
		stage.dataset.engine = "static";
		return undefined;
	}
	signal.addEventListener("abort", () => started.stop(), { once: true });
	return started;
}
