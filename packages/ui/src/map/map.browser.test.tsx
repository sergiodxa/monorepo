/**
 * Renders `GeoMap` in a real browser: markers tip onto their Web Mercator point, the island
 * either mounts MapLibre or keeps the server render, `mapLink` lights a row and its marker,
 * a marker's popup opens from its button, and the stage fits a 320px column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ISLAND, ISLAND_CENTER, LABELS } from "../test/map.js";

import { GeoMap } from "./map.js";
import { mapLink, mapLinks } from "./mixins/map-link.js";
import { offsetFrom } from "./utils/mercator.js";

import "../reset.css";
import "../theme.css";

/** MapLibre's worker, served beside its module rather than from the pre-bundled copy. */
const WORKER_URL = new URL(
	"../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
	import.meta.url,
).href;

/** Mounts `node` in a host `width` by `height` pixels and returns the host. */
function mount(node: JSX.Element, width = 800, height = 480): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.height = `${height}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

/** Where a marker's tail tips: the centre of its bottom edge plus the tail. */
function tip(marker: Element): { x: number; y: number } {
	let rect = marker.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.bottom + 6 };
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("GeoMap", () => {
	test("tips a marker at the center onto the stage's middle and others where Mercator says", () => {
		let east: [number, number] = [-31.95, 44.01];
		let host = mount(
			<GeoMap
				id="m1"
				label="Stays"
				center={ISLAND_CENTER}
				zoom={12}
				labels={LABELS}
				workerUrl={WORKER_URL}
			>
				<GeoMap.Marker at={ISLAND_CENTER} label="$120" href="/a" />
				<GeoMap.Marker at={east} label="$240" href="/b" />
			</GeoMap>,
		);
		let stage = find(host, '[data-slot="map"]');
		let box = stage.getBoundingClientRect();
		expect(box.height).toBe(480);
		let [first, second] = [...stage.querySelectorAll('[data-slot="map-marker"]')];
		let middle = tip(first!);
		expect(middle.x).toBeCloseTo(box.left + box.width / 2, 0);
		expect(middle.y).toBeCloseTo(box.top + box.height / 2, 0);

		let [dx, dy] = offsetFrom({ center: ISLAND_CENTER, zoom: 12 }, east);
		let other = tip(second!);
		expect(other.x).toBeCloseTo(box.left + box.width / 2 + dx, 0);
		expect(other.y).toBeCloseTo(box.top + box.height / 2 + dy, 0);
	});

	test("hides the basemap from assistive technology and names the region", () => {
		let host = mount(
			<GeoMap
				id="m2"
				label="Island"
				center={ISLAND_CENTER}
				zoom={11}
				labels={LABELS}
				workerUrl={WORKER_URL}
				basemap={{ kind: "geojson", data: ISLAND }}
			/>,
		);
		let stage = find(host, '[data-slot="map"]');
		expect(stage.getAttribute("role")).toBe("region");
		expect(stage.getAttribute("aria-label")).toBe("Island");
		expect(find(stage, '[data-slot="map-basemap"]').getAttribute("aria-hidden")).toBe("true");
		expect(
			find(stage, '[data-slot="map-basemap"] [data-kind="land"]').getBoundingClientRect().width,
		).toBeGreaterThan(100);
	});

	test("mounts MapLibre in the stage, or keeps the server render without WebGL", async () => {
		let host = mount(
			<GeoMap
				id="m3"
				label="Island"
				center={ISLAND_CENTER}
				zoom={11}
				labels={LABELS}
				workerUrl={WORKER_URL}
				controls={["zoom", "reset", "fullscreen"]}
				basemap={{ kind: "geojson", data: ISLAND, ground: "water" }}
			>
				<GeoMap.Marker at={[-31.95, 43.98]} label="$95" href="/c" />
				<GeoMap.Area form="search" label="Search this area" />
			</GeoMap>,
		);
		let stage = find(host, '[data-slot="map"]');
		await expect.poll(() => stage.dataset.engine, { timeout: 15_000 }).toMatch(/^(live|static)$/);
		let marker = find(stage, '[data-slot="map-marker"]');
		let before = tip(marker);

		if (stage.dataset.engine === "static") {
			expect(stage.querySelector(".maplibregl-canvas")).toBeNull();
			expect(getComputedStyle(find(stage, '[data-slot="map-basemap"]')).visibility).toBe("visible");
			expect(find(stage, '[data-map-control="fullscreen"]').hidden).toBe(true);
			return;
		}

		expect(stage.querySelector("canvas.maplibregl-canvas")).not.toBeNull();
		expect(getComputedStyle(find(stage, '[data-slot="map-basemap"]')).visibility).toBe("hidden");
		expect(find(stage, '[data-map-control="fullscreen"]').hidden).toBe(false);
		expect(find(stage, '[data-slot="map-marker"]')).toBe(marker);
		let after = tip(marker);
		expect(after.x).toBeCloseTo(before.x, 0);
		expect(after.y).toBeCloseTo(before.y, 0);

		let area = find(stage, '[data-slot="map-area"]');
		let bounds = find<HTMLInputElement>(stage, 'input[data-map-area="bounds"]');
		let wide = bounds.value;
		expect(area.hidden).toBe(true);
		await userEvent.click(find(stage, '[data-map-control="zoom-in"]'));
		await expect.poll(() => tip(marker).x - before.x, { timeout: 5_000 }).not.toBeCloseTo(0, 0);
		await expect.poll(() => area.hidden, { timeout: 5_000 }).toBe(false);
		expect(bounds.value).not.toBe(wide);
		expect(find<HTMLInputElement>(stage, 'input[data-map-area="zoom"]').value).toBe("12");
	});

	test("folds a style basemap's credit into its button once the map is live", async () => {
		let style = {
			version: 8,
			sources: { land: { type: "geojson", data: ISLAND, attribution: "Test tiles" } },
			layers: [
				{ id: "sea", type: "background", paint: { "background-color": "#cfe0e8" } },
				{ id: "land", type: "fill", source: "land", paint: { "fill-color": "#eee" } },
			],
		};
		let url = URL.createObjectURL(new Blob([JSON.stringify(style)], { type: "application/json" }));
		let host = mount(
			<GeoMap
				id="m-credit"
				label="Island"
				center={ISLAND_CENTER}
				zoom={11}
				labels={LABELS}
				workerUrl={WORKER_URL}
				basemap={{ kind: "style", light: url, dark: url }}
			/>,
			320,
			480,
		);
		let stage = find(host, '[data-slot="map"]');
		await expect.poll(() => stage.dataset.engine, { timeout: 15_000 }).toMatch(/^(live|static)$/);
		if (stage.dataset.engine === "static") return;
		await expect
			.poll(() => stage.querySelector(".maplibregl-ctrl-attrib"), { timeout: 5_000 })
			.not.toBeNull();
		let attribution = find(stage, ".maplibregl-ctrl-attrib");
		expect(attribution.textContent).toContain("Test tiles");
		expect(attribution.classList.contains("maplibregl-compact-show")).toBe(false);
	});

	test("reclusters in the browser and zooms into a bubble when clicked", async () => {
		let host = mount(
			<GeoMap
				id="m7"
				label="Stays"
				center={ISLAND_CENTER}
				zoom={11}
				labels={LABELS}
				workerUrl={WORKER_URL}
				basemap={{ kind: "geojson", data: ISLAND }}
			>
				<GeoMap.Marker at={[-32, 44]} label="$120" href="/a" mapKey="a" />
				<GeoMap.Marker at={[-31.997, 44.002]} label="$140" href="/b" mapKey="b" />
				<GeoMap.Marker at={[-32.002, 44.001]} label="$95" href="/c" mapKey="c" />
			</GeoMap>,
		);
		let stage = find(host, '[data-slot="map"]');
		let bubbles = () =>
			[...stage.querySelectorAll<HTMLElement>('[data-slot="map-cluster"]')].filter(
				(bubble) => !bubble.hidden,
			);
		expect(bubbles().map((bubble) => bubble.textContent)).toEqual(["3"]);
		await expect.poll(() => stage.dataset.engine, { timeout: 15_000 }).toMatch(/^(live|static)$/);
		if (stage.dataset.engine === "static") return;

		expect(bubbles().map((bubble) => bubble.getAttribute("aria-label"))).toEqual(["3 stays"]);
		let marker = find(stage, '[data-map-key="a"]');
		marker.setAttribute("data-highlighted", "");
		await expect.poll(() => bubbles()[0]?.hasAttribute("data-highlighted")).toBe(true);
		await userEvent.click(bubbles()[0]!);
		await expect.poll(() => bubbles().length, { timeout: 5_000 }).toBe(0);
		expect(stage.querySelectorAll('[data-slot="map-marker"]:not([hidden])')).toHaveLength(3);
	});

	test("lights a listing row and its marker together", async () => {
		let host = mount(
			<div>
				<span hidden mix={[mapLinks()]} />
				<ul>
					<li mix={[mapLink("a")]}>
						<a href="/a">Casa A</a>
					</li>
					<li mix={[mapLink("b")]}>
						<a href="/b">Casa B</a>
					</li>
				</ul>
				<div style={{ height: "320px" }}>
					<GeoMap
						id="m4"
						label="Stays"
						center={ISLAND_CENTER}
						zoom={13}
						labels={LABELS}
						workerUrl={WORKER_URL}
					>
						<GeoMap.Marker at={ISLAND_CENTER} label="$120" href="/a" mapKey="a" />
						<GeoMap.Marker at={[-31.99, 44.002]} label="$140" href="/b" mapKey="b" />
					</GeoMap>
				</div>
			</div>,
		);
		let [row] = [...host.querySelectorAll("li")];
		let [first, second] = [...host.querySelectorAll('[data-slot="map-marker"]')];
		await userEvent.hover(find(row!, "a"));
		expect(first!.hasAttribute("data-highlighted")).toBe(true);
		expect(second!.hasAttribute("data-highlighted")).toBe(false);
		await userEvent.hover(second!);
		expect(first!.hasAttribute("data-highlighted")).toBe(false);
		expect(host.querySelectorAll("li[data-highlighted]")).toHaveLength(1);
	});

	test("opens a marker's popup from its button, anchored above the pin", async () => {
		let host = mount(
			<GeoMap
				id="m5"
				label="Stays"
				center={ISLAND_CENTER}
				zoom={13}
				labels={LABELS}
				workerUrl={WORKER_URL}
			>
				<GeoMap.Marker at={ISLAND_CENTER} label="$120">
					<GeoMap.Popup>
						<p>Casa Azul, sleeps four</p>
					</GeoMap.Popup>
				</GeoMap.Marker>
			</GeoMap>,
		);
		let button = find<HTMLButtonElement>(host, 'button[data-slot="map-marker"]');
		let popup = find(host, '[data-slot="map-popup"]');
		expect(button.getAttribute("popovertarget")).toBe(popup.id);
		expect(popup.matches(":popover-open")).toBe(false);
		await userEvent.click(button);
		expect(popup.matches(":popover-open")).toBe(true);
		expect(popup.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			button.getBoundingClientRect().top,
		);
	});

	test("stays within a 320px column", () => {
		let host = mount(
			<GeoMap
				id="m6"
				label="Stays"
				center={ISLAND_CENTER}
				zoom={11}
				labels={LABELS}
				workerUrl={WORKER_URL}
				basemap={{ kind: "geojson", data: ISLAND }}
			>
				<GeoMap.Marker at={[-31.8, 44]} label="$1,280 per night" />
			</GeoMap>,
			320,
			400,
		);
		expect(host.scrollWidth).toBe(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1024);
	});
});
