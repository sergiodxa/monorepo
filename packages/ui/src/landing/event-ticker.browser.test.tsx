/**
 * Lays out {@link EventTicker} in a real browser: rows listed newest first under the
 * list's name, a failed check's step in mono on a danger tint, nothing overflowing a 280px
 * column or reaching the pause toggle, separate keyframes per row count, and the finished
 * feed, each `flipTo` row on its final chip only, when motion is reduced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { EventTicker } from "./event-ticker.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult[] = [];

afterEach(async () => {
	await page.viewport(414, 896);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.innerHTML = "";
	document.documentElement.style.removeProperty("--ui-color-danger-50");
});

/** The chip text for every status. */
const LABELS: Record<EventTicker.Status, string> = {
	ok: "Passed",
	warn: "Slow",
	fail: "Failed",
	pending: "Running",
};

/** Checks of a checkout flow, oldest first: one slow, one failing, the newest still running. */
const ROWS: EventTicker.Row[] = [
	{ time: "09:30", label: "Checkout flow", status: "ok", detail: "4 steps in 1.2s" },
	{ time: "09:35", label: "Checkout flow", status: "warn", detail: "Pay step took 3.8s" },
	{
		time: "09:40",
		label: "Checkout flow from the region furthest away from the origin",
		status: "fail",
		code: 'expect status 200, got 502 at "POST /api/pay"',
	},
	{
		time: "09:45",
		label: "Checkout flow",
		status: "pending",
		detail: "Running step 2 of 4",
		flipTo: { status: "ok", detail: "4 steps in 1.1s" },
	},
];

/** Mounts a ticker of `rows` in a column `width` pixels wide and returns its host. */
function mount(rows: readonly EventTicker.Row[] = ROWS, width = 280): HTMLElement {
	let host = document.createElement("div");
	host.style.cssText = `inline-size: ${width}px; container-type: inline-size`;
	document.body.appendChild(host);
	mounted.push(
		render(
			<EventTicker
				aria-label="Recent checks"
				pauseLabel="Pause the feed"
				title="Checkout flow, every 5 minutes"
				rows={rows}
				statusLabels={LABELS}
				footnote="A failure pages the on-call"
			/>,
			{ container: host },
		),
	);
	return host;
}

/** The feed's rows, as read by assistive technology. */
function feedRows(host: HTMLElement): HTMLElement[] {
	return [...host.querySelectorAll<HTMLElement>('ol[aria-label="Recent checks"] > li')];
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Emulates the visitor's motion preference for the rest of the test. */
async function prefersReducedMotion(): Promise<void> {
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-reduced-motion", value: "reduce" }],
	});
}

describe("EventTicker", () => {
	test("lists every row newest first under the list's name", () => {
		let host = mount();
		let rows = feedRows(host);
		expect(rows).toHaveLength(ROWS.length);
		expect(rows.map((row) => row.querySelector("time")!.textContent)).toEqual([
			"09:45",
			"09:40",
			"09:35",
			"09:30",
		]);
		expect(
			host.querySelector('[data-slot="event-ticker-sizer"]')!.getAttribute("aria-hidden"),
		).toBe("true");
		expect(host.textContent).toContain("Checkout flow, every 5 minutes");
		expect(host.textContent).toContain("A failure pages the on-call");
	});

	test("sets a failed row's code in mono on a danger tint", () => {
		let host = mount();
		document.documentElement.style.setProperty("--ui-color-danger-50", "rgb(254, 242, 242)");
		let failed = feedRows(host).find((row) => row.dataset.status === "fail")!;
		let code = failed.querySelector("code")!;
		expect(code.textContent).toBe('expect status 200, got 502 at "POST /api/pay"');
		expect(getComputedStyle(code).fontFamily).not.toBe(getComputedStyle(host).fontFamily);
		expect(getComputedStyle(code).backgroundColor).toBe("rgb(254, 242, 242)");
		let slow = feedRows(host).find((row) => row.dataset.status === "warn")!;
		expect(slow.textContent).toContain("Pay step took 3.8s");
	});

	test("fits a 280px column without overflowing the host", () => {
		let host = mount();
		let hostBox = host.getBoundingClientRect();
		for (let element of host.querySelectorAll("*")) {
			let box = element.getBoundingClientRect();
			if (box.width === 0) continue;
			expect(box.right).toBeLessThanOrEqual(hostBox.right + 0.5);
			expect(box.left).toBeGreaterThanOrEqual(hostBox.left - 0.5);
		}
	});

	/**
	 * Swept across phone widths, because whether a title or the newest row reaches the
	 * toggle depends on where its words happen to wrap.
	 */
	test("keeps every text clear of the pause toggle at every phone width", async () => {
		let hits: number[] = [];
		for (let width = 260; width <= 420; width += 4) {
			await page.viewport(width, 900);
			for (let title of ["Checkout flow, checked every 5 minutes from 3 regions", undefined]) {
				let result = render(
					<div style={{ padding: "0 16px" }}>
						<EventTicker
							aria-label="Recent checks"
							title={title}
							rows={ROWS}
							statusLabels={LABELS}
						/>
					</div>,
				);
				let toggle = result.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
				let surface = result.$('[data-slot="event-ticker"]')!;
				for (let part of surface.querySelectorAll(
					'[data-slot="event-ticker-header"], ol[aria-label]',
				)) {
					let walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
					while (walker.nextNode()) {
						let range = document.createRange();
						range.selectNodeContents(walker.currentNode);
						if ([...range.getClientRects()].some((line) => overlaps(line, toggle)))
							hits.push(width);
					}
				}
				result.cleanup();
			}
		}

		expect(hits).toEqual([]);
	});

	test("opens rows in turn from the oldest and settles to the sizer's height", () => {
		let host = mount();
		let seek = (seconds: number) => {
			for (let animation of host.getAnimations({ subtree: true })) {
				animation.pause();
				animation.currentTime = seconds * 1000;
			}
		};
		let heights = () => feedRows(host).map((row) => Math.round(row.getBoundingClientRect().height));

		seek(1);
		let early = heights();
		expect(early.at(-1)).toBeGreaterThan(0);
		expect(early.slice(0, -1)).toEqual([0, 0, 0]);

		seek(8.5);
		expect(heights().every((height) => height > 0)).toBe(true);
		let live = host.querySelector('ol[aria-label="Recent checks"]')!.getBoundingClientRect();
		let sizer = host.querySelector('[data-slot="event-ticker-sizer"]')!.getBoundingClientRect();
		expect(Math.round(live.height)).toBe(Math.round(sizer.height));
		let [first, final] = feedRows(host)[0]!.querySelectorAll('[data-slot="event-ticker-chip"]');
		expect(getComputedStyle(first!).opacity).toBe("0");
		expect(getComputedStyle(final!).opacity).toBe("1");
	});

	test("animates feeds of different lengths on separate keyframes", () => {
		let four = mount();
		let three = mount(ROWS.slice(0, 3));
		let oldest = (root: HTMLElement) => getComputedStyle(feedRows(root).at(-1)!).animationName;
		expect(oldest(four)).toMatch(/^ui-event-ticker-row-4-0/);
		expect(oldest(four)).not.toBe(oldest(three));
	});

	test("shows the finished feed, each flip on its final chip only, when motion is reduced", async () => {
		await prefersReducedMotion();
		let host = mount();
		let rows = feedRows(host);
		for (let row of rows) {
			expect(getComputedStyle(row).animationName).toBe("none");
			expect(getComputedStyle(row).opacity).toBe("1");
			expect(row.getBoundingClientRect().height).toBeGreaterThan(0);
		}
		for (let element of host.querySelectorAll("*")) {
			expect(getComputedStyle(element).animationName).toBe("none");
		}

		let flipped = rows[0]!;
		let [first, final] = flipped.querySelectorAll<HTMLElement>('[data-slot="event-ticker-chip"]');
		expect(first!.textContent).toBe("Running");
		expect(getComputedStyle(first!).opacity).toBe("0");
		expect(first!.getAttribute("aria-hidden")).toBe("true");
		expect(final!.textContent).toBe("Passed");
		expect(getComputedStyle(final!).opacity).toBe("1");
		expect(flipped.dataset.status).toBe("ok");
		let [before, after] = [...flipped.querySelectorAll<HTMLElement>("span")].filter((span) =>
			["Running step 2 of 4", "4 steps in 1.1s"].includes(span.textContent ?? ""),
		);
		expect(getComputedStyle(before!).opacity).toBe("0");
		expect(getComputedStyle(after!).opacity).toBe("1");
		expect(getComputedStyle(host.querySelector('[data-slot="event-ticker-sizer"]')!).display).toBe(
			"none",
		);
	});
});
