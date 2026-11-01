/**
 * Places {@link Crosshair} in a real browser: each corner centres the mark on that corner of
 * its positioned ancestor, a right-to-left ancestor mirrors the marks, and the mark stays
 * hidden from assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Crosshair } from "./crosshair.js";

/** Corners in the order the mounted box draws them. */
const CORNERS: Crosshair.Corner[] = ["start-start", "start-end", "end-start", "end-end"];

/** Mounts a 200×100 positioned box with a mark on every corner, in `dir`. */
function mountBox(dir: "ltr" | "rtl"): HTMLElement {
	let host = document.createElement("div");
	host.dir = dir;
	host.style.cssText = "position: relative; width: 200px; height: 100px; margin: 40px";
	document.body.appendChild(host);
	render(
		<>
			{CORNERS.map((corner) => (
				<Crosshair key={corner} corner={corner} />
			))}
		</>,
		{ container: host },
	);
	return host;
}

/** Centre of the mark drawn on `corner`, relative to the box. */
function centre(box: HTMLElement, corner: Crosshair.Corner): { x: number; y: number } {
	let origin = box.getBoundingClientRect();
	let mark = box.querySelector(`[data-corner="${corner}"]`)!.getBoundingClientRect();
	return {
		x: mark.left + mark.width / 2 - origin.left,
		y: mark.top + mark.height / 2 - origin.top,
	};
}

describe("Crosshair", () => {
	test("centres a 21px mark on each corner", () => {
		let box = mountBox("ltr");

		expect(centre(box, "start-start")).toEqual({ x: 0, y: 0 });
		expect(centre(box, "start-end")).toEqual({ x: 200, y: 0 });
		expect(centre(box, "end-start")).toEqual({ x: 0, y: 100 });
		expect(centre(box, "end-end")).toEqual({ x: 200, y: 100 });
		let mark = box.querySelector<HTMLElement>('[data-slot="crosshair"]')!;
		expect(mark.getBoundingClientRect().width).toBe(21);
		expect(mark.getAttribute("aria-hidden")).toBe("true");
	});

	test("mirrors the inline corners in a right-to-left box", () => {
		let box = mountBox("rtl");

		expect(centre(box, "start-start")).toEqual({ x: 200, y: 0 });
		expect(centre(box, "start-end")).toEqual({ x: 0, y: 0 });
		expect(centre(box, "end-end")).toEqual({ x: 0, y: 100 });
	});

	test("draws the small mark at 11px", () => {
		let host = document.createElement("div");
		host.style.position = "relative";
		document.body.appendChild(host);
		render(<Crosshair size="sm" />, { container: host });

		expect(host.querySelector('[data-slot="crosshair"]')!.getBoundingClientRect().width).toBe(11);
	});
});
