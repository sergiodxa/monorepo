/**
 * Renders `MapCanvas` in a real browser: pins tip onto their viewBox point at any crop, a route
 * splits into its travelled and dashed parts, a marker sits on the path at any progress, and
 * `mapLink` lights a listing row and its pin together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { mapLink, mapLinks } from "../mixins/map-link.js";

import { MapCanvas } from "./map-canvas.js";

import "../reset.css";
import "../theme.css";

/** A curved route across the default 400 by 300 space. */
const ROUTE = "M40 260 C120 200 220 240 360 60";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 800): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
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

/** Where a pin's tail tips, in viewport pixels: the centre of its bottom edge plus the tail. */
function pinTip(pin: Element): { x: number; y: number } {
	let rect = pin.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.bottom + 6 };
}

/** Where viewBox point (`x`, `y`) lands on screen inside `stage`, given its `viewBox`. */
function stagePoint(stage: Element, viewBox: number[], x: number, y: number) {
	let rect = stage.getBoundingClientRect();
	let [minX = 0, minY = 0, width = 1, height = 1] = viewBox;
	return {
		x: rect.left + ((x - minX) / width) * rect.width,
		y: rect.top + ((y - minY) / height) * rect.height,
	};
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("MapCanvas", () => {
	test("keeps the viewBox's aspect ratio at full width and hides the art", () => {
		let host = mount(
			<MapCanvas label="Stays nearby" art={<rect width="400" height="300" fill="#dde" />} />,
		);
		let stage = find(host, "figure");
		let rect = stage.getBoundingClientRect();
		expect(stage.getAttribute("aria-label")).toBe("Stays nearby");
		expect(rect.width).toBe(800);
		expect(rect.height).toBeCloseTo(600, 0);
		expect(find(stage, "[data-slot=map-canvas-art]").getAttribute("aria-hidden")).toBe("true");
	});

	test("tips each pin onto its point and renders a link when given an address", () => {
		let host = mount(
			<MapCanvas label="Stays">
				<MapCanvas.Pin x={100} y={150} label="$182" href="/stays/1" />
				<MapCanvas.Pin x={300} y={75} label="$95" current />
			</MapCanvas>,
		);
		let stage = find(host, "figure");
		let link = find<HTMLAnchorElement>(stage, "a");
		expect(link.getAttribute("href")).toBe("/stays/1");
		expect(link.textContent).toBe("$182");
		expect(link.style.left).toBe("25%");
		expect(link.style.top).toBe("50%");
		let tip = pinTip(link);
		let point = stagePoint(stage, [0, 0, 400, 300], 100, 150);
		expect(tip.x).toBeCloseTo(point.x, 0);
		expect(tip.y).toBeCloseTo(point.y, 0);

		let button = find<HTMLButtonElement>(stage, "button");
		expect(button.type).toBe("button");
		expect(button.getAttribute("aria-current")).toBe("true");
		expect(Number(getComputedStyle(button).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(link).zIndex),
		);
	});

	test("places parts from a cropped viewBox's origin and drops pins outside it", () => {
		let viewBox = [120, 60, 200, 150];
		let host = mount(
			<MapCanvas label="Old town" viewBox={viewBox.join(" ")}>
				<MapCanvas.Route d="M130 70 L310 200" done={0.5} />
				<MapCanvas.Marker route="M130 70 L310 200" progress={0.5} />
				<MapCanvas.Pin x={220} y={135} label="Inside" />
				<MapCanvas.Pin x={20} y={20} label="Left of the crop" />
				<MapCanvas.Pin x={340} y={100} label="Right of the crop" />
			</MapCanvas>,
			400,
		);
		let stage = find(host, "figure");
		expect(stage.getBoundingClientRect().height).toBeCloseTo(300, 0);
		let pins = [...stage.querySelectorAll("[data-slot=map-canvas-pin]")];
		expect(pins.map((pin) => pin.textContent)).toEqual(["Inside"]);
		let tip = pinTip(pins[0]!);
		let point = stagePoint(stage, viewBox, 220, 135);
		expect(tip.x).toBeCloseTo(point.x, 0);
		expect(tip.y).toBeCloseTo(point.y, 0);

		let marker = find(stage, "[data-map-marker]").getBoundingClientRect();
		let middle = stagePoint(stage, viewBox, 220, 135);
		expect(marker.left + marker.width / 2).toBeCloseTo(middle.x, 0);
		expect(marker.top + marker.height / 2).toBeCloseTo(middle.y, 0);
	});

	test("draws the travelled share solid and the whole route dashed beneath it", () => {
		let host = mount(
			<MapCanvas label="Delivery">
				<MapCanvas.Route d={ROUTE} done={0.4} />
			</MapCanvas>,
		);
		let done = find<SVGPathElement>(host, "[data-route-part=done]");
		let ahead = find<SVGPathElement>(host, "[data-route-part=ahead]");
		expect(done.getAttribute("pathLength")).toBe("1");
		expect(done.getAttribute("stroke-dasharray")).toBe("0.4 2");
		expect(getComputedStyle(ahead).strokeDasharray).not.toBe("none");

		document.body.replaceChildren();
		let fresh = mount(
			<MapCanvas label="Delivery">
				<MapCanvas.Route d={ROUTE} />
			</MapCanvas>,
		);
		expect(fresh.querySelector("[data-route-part=done]")).toBeNull();
	});

	test("sits the marker on the route at its start, middle and end", () => {
		for (let progress of [0, 0.5, 1]) {
			let host = mount(
				<MapCanvas label="Courier">
					<MapCanvas.Route d={ROUTE} />
					<MapCanvas.Marker route={ROUTE} progress={progress} />
				</MapCanvas>,
			);
			let path = find<SVGPathElement>(host, "[data-route-part=ahead]");
			let local = path.getPointAtLength(path.getTotalLength() * progress);
			let screen = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM()!);
			let marker = find(host, "[data-map-marker]").getBoundingClientRect();
			expect(marker.left + marker.width / 2).toBeCloseTo(screen.x, 0);
			expect(marker.top + marker.height / 2).toBeCloseTo(screen.y, 0);
			document.body.replaceChildren();
		}
	});

	test("glides the marker, and moves it at once under reduced motion", async () => {
		let marker = () =>
			find(
				mount(
					<MapCanvas label="Courier">
						<MapCanvas.Marker route={ROUTE} progress={0.3} />
					</MapCanvas>,
				),
				"[data-map-marker]",
			);
		expect(getComputedStyle(marker()).transitionProperty).toBe("offset-distance");
		document.body.replaceChildren();
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		expect(getComputedStyle(marker()).transitionDuration).toBe("0s");
	});

	test("lights a listing row and its pin together while either is hovered", async () => {
		let host = mount(
			<div>
				<ul>
					<li mix={mapLink("stay-7")}>Casa Azul</li>
					<li mix={mapLink("stay-8")}>Casa Verde</li>
				</ul>
				<MapCanvas label="Stays">
					<MapCanvas.Pin x={100} y={100} label="$120" mapKey="stay-7" />
					<MapCanvas.Pin x={300} y={200} label="$90" mapKey="stay-8" />
				</MapCanvas>
			</div>,
		);
		let [row, other] = [...host.querySelectorAll("li")];
		let pin = find(host, '[data-slot=map-canvas-pin][data-map-key="stay-7"]');
		let otherPin = find(host, '[data-slot=map-canvas-pin][data-map-key="stay-8"]');

		await userEvent.hover(row!);
		expect(row!.hasAttribute("data-highlighted")).toBe(true);
		expect(pin.hasAttribute("data-highlighted")).toBe(true);
		expect(otherPin.hasAttribute("data-highlighted")).toBe(false);
		expect(Number(getComputedStyle(pin).zIndex)).toBe(3);
		expect(getComputedStyle(pin).backgroundColor).not.toBe(
			getComputedStyle(otherPin).backgroundColor,
		);

		await userEvent.unhover(row!);
		expect(row!.hasAttribute("data-highlighted")).toBe(false);
		expect(pin.hasAttribute("data-highlighted")).toBe(false);

		await userEvent.hover(otherPin);
		expect(other!.hasAttribute("data-highlighted")).toBe(true);
		await userEvent.unhover(otherPin);
		expect(other!.hasAttribute("data-highlighted")).toBe(false);
	});

	test("lights the listing while its pin holds focus, and clears it when focus leaves", () => {
		let host = mount(
			<div>
				<a href="/stays/7" mix={mapLink("stay-7")}>
					Casa Azul
				</a>
				<MapCanvas label="Stays">
					<MapCanvas.Pin x={100} y={100} label="$120" href="/stays/7" mapKey="stay-7" />
				</MapCanvas>
			</div>,
		);
		let row = find(host, "a:not([data-slot])");
		let pin = find(host, "[data-slot=map-canvas-pin]");
		pin.focus();
		expect(row.hasAttribute("data-highlighted")).toBe(true);
		pin.blur();
		expect(row.hasAttribute("data-highlighted")).toBe(false);
		expect(pin.hasAttribute("data-highlighted")).toBe(false);
	});

	test("links plain server-rendered rows and pins from one document listener", async () => {
		let host = mount(
			<div>
				<span hidden mix={mapLinks()} />
				<p data-map-key="stay-1">
					<a href="/stays/1">Gullwing Cottage</a>
				</p>
				<p data-map-key="stay-2">Dune Hollow</p>
				<b data-map-key="stay-1">$164</b>
				<b data-map-key="stay-2">$139</b>
			</div>,
		);
		let [row, other] = [...host.querySelectorAll("p")];
		let [pin, otherPin] = [...host.querySelectorAll("b")];

		await userEvent.hover(find(row!, "a"));
		expect(row!.hasAttribute("data-highlighted")).toBe(true);
		expect(pin!.hasAttribute("data-highlighted")).toBe(true);
		expect(otherPin!.hasAttribute("data-highlighted")).toBe(false);

		await userEvent.hover(other!);
		expect(pin!.hasAttribute("data-highlighted")).toBe(false);
		expect(otherPin!.hasAttribute("data-highlighted")).toBe(true);

		find(row!, "a").focus();
		expect(pin!.hasAttribute("data-highlighted")).toBe(true);
	});

	test("stays within a 320px column", () => {
		let host = mount(
			<MapCanvas label="Stays">
				<MapCanvas.Pin x={398} y={150} label="$1,280 per night" />
			</MapCanvas>,
			320,
		);
		expect(host.scrollWidth).toBe(320);
	});
});
