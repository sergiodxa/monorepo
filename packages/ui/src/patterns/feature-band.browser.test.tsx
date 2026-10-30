/**
 * Lays a split FeatureBand out in a real browser: a short copy column beside tall media
 * shares one grid with its header, the columns centre on each other, and both columns run
 * to the content frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FeatureBand } from "./feature-band.js";

import "../reset.css";
import "../theme.css";

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** A split band with a two-claim copy column beside 600px-tall media, `width` pixels wide. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	hosts.push(host);
	return render(
		<FeatureBand
			layout="split"
			eyebrow="Free chapter"
			title="Read chapter 2 before you buy"
			description="The whole chapter, set the way the book teaches."
			media={<div data-media style={{ blockSize: "600px" }} />}
		>
			<ul>
				<li>One</li>
				<li>Two</li>
			</ul>
		</FeatureBand>,
		{ container: host },
	).container;
}

describe("FeatureBand split", () => {
	for (let width of [1024, 1440]) {
		test(`at ${width}px the header sits in the copy column, centred against the media`, () => {
			let root = mount(width);
			let copy = root.querySelector('[data-slot="split-copy"]')!.getBoundingClientRect();
			let media = root.querySelector('[data-slot="split-media"]')!.getBoundingClientRect();
			let title = root.querySelector("h2")!;
			let titleBox = title.getBoundingClientRect();

			expect(root.querySelector('[data-slot="split-copy"]')!.contains(title)).toBe(true);
			expect(titleBox.right).toBeLessThanOrEqual(copy.right + 1);
			expect(media.left).toBeGreaterThan(copy.right);
			expect(copy.top + copy.height / 2).toBeCloseTo(media.top + media.height / 2, 0);
		});
	}

	test("on a phone the header, copy and media stack in reading order", () => {
		let root = mount(375);
		let title = root.querySelector("h2")!.getBoundingClientRect();
		let claims = root.querySelector("ul")!.getBoundingClientRect();
		let media = root.querySelector("[data-media]")!.getBoundingClientRect();

		expect(title.bottom).toBeLessThanOrEqual(claims.top);
		expect(claims.bottom).toBeLessThanOrEqual(media.top);
	});
});
