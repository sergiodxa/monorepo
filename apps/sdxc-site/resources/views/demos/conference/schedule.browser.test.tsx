/**
 * Lays Overprint's programme out in a real browser: on a phone the room filter shows one room
 * or both with CSS alone, on a wide screen both rooms sit side by side with the filter gone,
 * and the header's phone sheet closes when one of its section links is followed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import ConferenceHeader from "~/resources/views/demos/conference/header";
import ConferenceSchedule from "~/resources/views/demos/conference/schedule";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the schedule band in a `width`-pixel column and returns that column. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(<ConferenceSchedule />, { container: host });
	return host;
}

/** How many of a room's cells are laid out, and how many are hidden. */
function shown(host: HTMLElement, track: "main" | "side"): number {
	return [...host.querySelectorAll(`[data-track="${track}"]`)].filter(
		(cell) => cell.getClientRects().length > 0,
	).length;
}

/** Picks a room in the filter the way a tap on its label does. */
function pick(host: HTMLElement, value: "both" | "main" | "side") {
	host.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
}

describe("Overprint's programme", () => {
	test("shows both rooms on a phone until the filter picks one", () => {
		let host = mount(343);
		let total = host.querySelectorAll('[data-track="main"]').length;
		expect(total).toBe(7);
		expect(shown(host, "main")).toBe(total);
		expect(shown(host, "side")).toBe(total);

		pick(host, "main");
		expect(shown(host, "main")).toBe(total);
		expect(shown(host, "side")).toBe(0);

		pick(host, "side");
		expect(shown(host, "main")).toBe(0);
		expect(shown(host, "side")).toBe(total);

		pick(host, "both");
		expect(shown(host, "side")).toBe(total);
	});

	test("keeps the shared breaks whichever room is picked", () => {
		let host = mount(343);
		pick(host, "side");
		let lunch = [...host.querySelectorAll("li")].find((row) => row.textContent?.includes("Lunch"));
		expect(lunch?.getClientRects().length).toBeGreaterThan(0);
	});

	test("sets the rooms side by side on a wide screen, with the filter gone", () => {
		let host = mount(1200);
		let filter = host.querySelector("fieldset")!;
		expect(filter.getClientRects()).toHaveLength(0);

		pick(host, "main");
		expect(shown(host, "side")).toBe(7);

		let main = host.querySelector<HTMLElement>("#talk-ines")!.getBoundingClientRect();
		let side = host.querySelector<HTMLElement>("#talk-sanne")!.getBoundingClientRect();
		expect(Math.round(main.top)).toBe(Math.round(side.top));
		expect(side.left).toBeGreaterThan(main.right);
	});

	test("anchors every talk a speaker card links to", () => {
		let host = mount(1200);
		for (let id of ["kwame", "femke", "ines", "sanne", "tomas"]) {
			expect(host.querySelector(`#talk-${id}`)).not.toBeNull();
		}
	});
});

describe("Overprint's header", () => {
	test("closes its phone sheet when a section link is followed", async () => {
		await page.viewport(375, 812);
		mounted = render(<ConferenceHeader />);
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href="#tickets"]')!;

		sheet.showModal();
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

		expect(sheet.open).toBe(false);
	});
});
