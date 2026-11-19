/**
 * Holds the letterbox to its layout in a real browser: the surface keeps its ratio in any box,
 * barred top and bottom in a tall one and left and right in a wide one, takes its height from
 * its width in a box without one, and lets its children size in its own container units.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { css } from "remix/component";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Letterbox } from "./letterbox.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a node in a box of the given size; a box without `height` takes its content's. */
function mount(node: RemixNode, box: { width: number; height?: number }) {
	let container = document.createElement("div");
	container.style.width = `${box.width}px`;
	if (box.height !== undefined) container.style.height = `${box.height}px`;
	document.body.appendChild(container);
	mounted = render(node, { container });
	return mounted;
}

/** The surface's box relative to the frame's. */
function surface(result: RenderResult) {
	let outer = result.$('[data-slot="letterbox"]')!.getBoundingClientRect();
	let inner = result.$('[data-slot="surface"]')!.getBoundingClientRect();
	return {
		left: inner.left - outer.left,
		top: inner.top - outer.top,
		width: inner.width,
		height: inner.height,
	};
}

describe("Letterbox", () => {
	test("bars a 16:9 surface top and bottom in a tall box", () => {
		let result = mount(
			<Letterbox>
				<Letterbox.Surface />
			</Letterbox>,
			{ width: 800, height: 600 },
		);
		expect(surface(result)).toEqual({ left: 0, top: 75, width: 800, height: 450 });
	});

	test("bars the surface left and right in a wide box", () => {
		let result = mount(
			<Letterbox>
				<Letterbox.Surface />
			</Letterbox>,
			{ width: 1000, height: 450 },
		);
		expect(surface(result)).toEqual({ left: 100, top: 0, width: 800, height: 450 });
	});

	test("keeps the ratio it is given", () => {
		let result = mount(
			<Letterbox ratio={4 / 3}>
				<Letterbox.Surface />
			</Letterbox>,
			{ width: 800, height: 300 },
		);
		expect(surface(result)).toEqual({ left: 200, top: 0, width: 400, height: 300 });
	});

	test("takes its height from its width when its box has none", () => {
		let result = mount(
			<Letterbox>
				<Letterbox.Surface />
			</Letterbox>,
			{ width: 640 },
		);
		expect(surface(result)).toEqual({ left: 0, top: 0, width: 640, height: 360 });
	});

	test("sizes its children in the surface's container units", () => {
		let result = mount(
			<Letterbox>
				<Letterbox.Surface>
					<div data-testid="half" mix={css({ inlineSize: "50cqw", blockSize: "10cqh" })} />
				</Letterbox.Surface>
			</Letterbox>,
			{ width: 1000, height: 450 },
		);
		let half = result.$('[data-testid="half"]')!.getBoundingClientRect();
		expect({ width: half.width, height: half.height }).toEqual({ width: 400, height: 45 });
	});

	test("paints the bars in the color `--ui-letterbox-bars` names", () => {
		let result = mount(
			<Letterbox style={{ "--ui-letterbox-bars": "rgb(255, 0, 0)" }}>
				<Letterbox.Surface />
			</Letterbox>,
			{ width: 800, height: 600 },
		);
		expect(getComputedStyle(result.$('[data-slot="letterbox"]')!).backgroundColor).toBe(
			"rgb(255, 0, 0)",
		);
	});
});
