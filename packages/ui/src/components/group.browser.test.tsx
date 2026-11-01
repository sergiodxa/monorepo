/**
 * Lays a group out in a real browser: two controls that bring their own rounding join
 * into one shape, square where they meet and rounded on the cluster's outer corners,
 * whichever of their styles reached the page first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Button } from "./button.js";
import { Group } from "./group.js";
import { Input } from "./input.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts `node` in a 480px host and returns the host. */
function mount(node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "480px";
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host;
}

/** The four logical corner radii of `element`, in pixels. */
function corners(element: Element) {
	let style = getComputedStyle(element);
	return {
		startStart: Number.parseFloat(style.borderStartStartRadius),
		endStart: Number.parseFloat(style.borderEndStartRadius),
		startEnd: Number.parseFloat(style.borderStartEndRadius),
		endEnd: Number.parseFloat(style.borderEndEndRadius),
	};
}

describe("Group", () => {
	test("squares the corners an input and a button share and keeps the outer ones round", () => {
		let host = mount(
			<Group>
				<Input aria-label="API key" readOnly value="sk_live_123" />
				<Button variant="outline" color="neutral">
					Copy
				</Button>
			</Group>,
		);
		let input = corners(host.querySelector("input")!);
		let button = corners(host.querySelector("button")!);

		expect(input.startEnd).toBe(0);
		expect(input.endEnd).toBe(0);
		expect(input.startStart).toBeGreaterThan(0);
		expect(input.endStart).toBeGreaterThan(0);
		expect(button.startStart).toBe(0);
		expect(button.endStart).toBe(0);
		expect(button.startEnd).toBeGreaterThan(0);
		expect(button.endEnd).toBeGreaterThan(0);
	});

	test("squares both sides of a control between two others", () => {
		let host = mount(
			<Group>
				<Button variant="outline" color="neutral">
					Less
				</Button>
				<Input aria-label="Quantity" defaultValue="1" />
				<Button variant="outline" color="neutral">
					More
				</Button>
			</Group>,
		);
		let middle = corners(host.querySelector("input")!);

		expect(Object.values(middle)).toEqual([0, 0, 0, 0]);
	});

	test("keeps the last control's corners round before a trailing prefetch hint", () => {
		let host = mount(
			<Group>
				<Input aria-label="Search" />
				<Button variant="outline" color="neutral">
					Go
				</Button>
				<link rel="prefetch" href="/search" />
			</Group>,
		);
		let button = corners(host.querySelector("button")!);

		expect(button.startEnd).toBeGreaterThan(0);
		expect(button.endEnd).toBeGreaterThan(0);
	});
});
