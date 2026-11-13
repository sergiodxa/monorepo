/**
 * Checks Hollyhock's behaviour that works with no script, in a real browser: the order form
 * posts where its redirect lands back on the confirmation, the confirmation shows only when
 * the address targets it, the door sign reads the bakery's clock, and the phone sheet closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Hero } from "~/resources/views/demos/bakery/hero";
import { Order, ORDER_ACTION } from "~/resources/views/demos/bakery/order";
import { SiteHeader } from "~/resources/views/demos/bakery/site-chrome";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** A Friday morning on Alder Street, 10 am Chicago time. */
const FRIDAY_MORNING = new Date("2026-11-13T16:00:00Z");

/** Thanksgiving noon, when the bakery is shut all day. */
const THANKSGIVING = new Date("2026-11-26T18:00:00Z");

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", location.pathname + location.search);
	await page.viewport(414, 896);
});

describe("ordering for pickup", () => {
	test("posts every field to the example endpoint, keeping the confirmation's fragment", () => {
		mounted = render(<Order now={FRIDAY_MORNING} />);
		let form = mounted.container.querySelector<HTMLFormElement>('[data-slot="order-form"]')!;

		expect(form.method).toBe("post");
		expect(new URL(form.action).pathname).toBe("/examples/bakery/order");
		expect(new URL(form.action).hash).toBe("#order-placed");
		expect(ORDER_ACTION.endsWith("#order-placed")).toBe(true);

		let data = new FormData(form);
		expect([...data.keys()]).toEqual(
			expect.arrayContaining(["sourdough", "pie", "day", "window", "name", "phone"]),
		);
		expect(data.get("window")).toBe("morning");
	});

	test("offers the next open days, never today or the closed Monday", () => {
		mounted = render(<Order now={FRIDAY_MORNING} />);
		let options = [...mounted.container.querySelectorAll<HTMLOptionElement>("#order-day option")];
		expect(options.map((option) => option.value)).toEqual([
			"2026-11-14",
			"2026-11-15",
			"2026-11-17",
			"2026-11-18",
			"2026-11-19",
		]);
	});

	test("shows the thank-you note only when the address targets it", () => {
		mounted = render(<Order now={FRIDAY_MORNING} />);
		let note = mounted.container.querySelector("#order-placed")!;
		expect(getComputedStyle(note).display).toBe("none");

		location.hash = "order-placed";
		expect(getComputedStyle(note).display).toBe("block");
	});
});

describe("the door sign", () => {
	test("reads open with the closing time on a Friday morning", () => {
		mounted = render(<Hero now={FRIDAY_MORNING} />);
		let sign = mounted.container.querySelector('[data-slot="open-sign"]')!;
		expect(sign.getAttribute("data-state")).toBe("open");
		expect(sign.textContent).toContain("Open now");
		expect(sign.textContent).toContain("closes at 6 pm");
		expect(mounted.container.querySelector('[data-slot="door-sign"]')!.textContent).toBe("OPEN");
	});

	test("names the holiday and turns the drawn sign to closed", () => {
		mounted = render(<Hero now={THANKSGIVING} />);
		let sign = mounted.container.querySelector('[data-slot="open-sign"]')!;
		expect(sign.textContent).toContain("Closed for Thanksgiving");
		expect(sign.textContent).toContain("opens tomorrow at 9 am");
		expect(mounted.container.querySelector('[data-slot="door-sign"]')!.textContent).toBe("CLOSED");
	});
});

describe("the phone sheet", () => {
	test("closes when a link in it is followed", async () => {
		await page.viewport(375, 812);
		mounted = render(<SiteHeader />);
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href]')!;

		sheet.showModal();
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(sheet.open).toBe(false);
	});
});
