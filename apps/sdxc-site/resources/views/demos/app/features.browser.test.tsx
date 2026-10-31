/**
 * Lays Rooftree's small-things bento out in a real browser: at a desktop width every
 * colour block leads with an app scene, and the scenes in one row share a top edge and
 * a height so the titles under them line up, and a phone still shows every scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Details } from "~/resources/views/demos/app/features";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts the bento band in a `width`-pixel column and returns that column. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(<Details />, { container: host });
	return host;
}

describe("Rooftree's small-things bento", () => {
	test("leads every cell with a scene the same height as its row's others", () => {
		let host = mount(1280);
		let cells = [...host.querySelectorAll<HTMLElement>('[data-slot="bento-cell"]')];
		expect(cells).toHaveLength(6);

		let rows = new Map<number, DOMRect[]>();
		for (let cell of cells) {
			let media = cell.querySelector<HTMLElement>(':scope > [data-slot="bento-media"]');
			expect(media).not.toBeNull();
			expect(media?.querySelector('[role="img"]')?.getAttribute("aria-label")).toBeTruthy();
			let box = media!.getBoundingClientRect();
			expect(box.height).toBeGreaterThan(0);
			let top = Math.round(cell.getBoundingClientRect().top);
			rows.set(top, [...(rows.get(top) ?? []), box]);
		}

		expect(rows.size).toBe(2);
		for (let boxes of rows.values()) {
			expect(boxes).toHaveLength(3);
			expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
			expect(new Set(boxes.map((box) => Math.round(box.height))).size).toBe(1);
		}
	});

	test("keeps every scene on a phone, inside its cell", () => {
		let host = mount(343);
		let scenes = [...host.querySelectorAll<HTMLElement>('[data-slot="bento-media"]')];
		expect(scenes).toHaveLength(6);
		for (let scene of scenes) {
			expect(scene.getBoundingClientRect().height).toBeGreaterThan(0);
			expect(scene.scrollWidth).toBeLessThanOrEqual(scene.clientWidth);
		}
	});
});
