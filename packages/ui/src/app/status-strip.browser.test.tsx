/**
 * Lays the status strip out in a real browser: 90 bars fit a 320px card without overflow,
 * a period with no data is hatched rather than drawn empty, and a bar's tooltip shows on
 * keyboard focus, aligned so it stays inside the strip near either end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { StatusStrip } from "./status-strip.js";

import "../reset.css";
import "../theme.css";

/** Ninety days, oldest first: mostly up, one outage, one degraded day, a week before monitoring began. */
const DAYS: StatusStrip.Period[] = Array.from({ length: 90 }, (_, index) => {
	let status: StatusStrip.Status = "up";
	if (index < 7) status = "no-data";
	else if (index === 41) status = "down";
	else if (index === 63) status = "degraded";
	return { status, label: `Day ${index + 1}`, value: status === "no-data" ? "No data" : "100%" };
});

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.paddingTop = "3rem";
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The strip's bars, oldest first. */
function bars(host: HTMLElement): HTMLButtonElement[] {
	return [...host.querySelectorAll<HTMLButtonElement>('[data-slot="status-strip-bar"]')];
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("StatusStrip", () => {
	for (let width of [320, 960]) {
		test(`fits all 90 bars in ${width}px without overflowing`, () => {
			let host = mount(
				<StatusStrip
					label="Uptime, last 90 days"
					periods={DAYS}
					start="90 days ago"
					end="Today"
					summary="99.95% uptime"
				/>,
				width,
			);
			let row = host.querySelector<HTMLElement>('[data-slot="status-strip-bars"]')!;

			expect(bars(host)).toHaveLength(90);
			expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1280);
			for (let bar of bars(host)) expect(bar.getBoundingClientRect().width).toBeGreaterThan(1);
			let last = bars(host).at(-1)!.getBoundingClientRect();
			expect(last.right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
		});
	}

	test("hatches a period with no data and tints the others by status", () => {
		let host = mount(<StatusStrip label="Uptime" periods={DAYS} />, 640);
		let [empty] = bars(host);
		let down = bars(host)[41]!;

		expect(getComputedStyle(empty!).backgroundImage).toContain("repeating-linear-gradient");
		expect(getComputedStyle(down).backgroundImage).toBe("none");
		let probe = document.createElement("span");
		probe.style.backgroundColor = "var(--ui-danger-bg-solid)";
		host.appendChild(probe);
		expect(down.dataset.status).toBe("down");
		expect(getComputedStyle(down).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
	});

	test("names each bar by its date and value and groups them under the label", async () => {
		mount(<StatusStrip label="Uptime, last 90 days" periods={DAYS} />, 640);

		await expect
			.element(page.getByRole("group", { name: "Uptime, last 90 days" }))
			.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Day 42, 100%" })).toBeInTheDocument();
	});

	test("shows a bar's tooltip on keyboard focus, kept inside the strip at the edges", async () => {
		let host = mount(<StatusStrip label="Uptime" periods={DAYS} />, 320);
		let first = bars(host)[0]!;
		let tooltip = first.querySelector<HTMLElement>('[data-slot="status-strip-tooltip"]')!;

		expect(getComputedStyle(tooltip).visibility).toBe("hidden");
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(first);
		await expect.poll(() => getComputedStyle(tooltip).visibility).toBe("visible");
		expect(tooltip.textContent).toBe("Day 1No data");
		let strip = host.querySelector('[data-slot="status-strip"]')!.getBoundingClientRect();
		expect(tooltip.getBoundingClientRect().left).toBeGreaterThanOrEqual(strip.left - 0.5);

		let last = bars(host).at(-1)!;
		last.focus();
		let lastTip = last.querySelector<HTMLElement>('[data-slot="status-strip-tooltip"]')!;
		await expect.poll(() => getComputedStyle(lastTip).visibility).toBe("visible");
		expect(lastTip.getBoundingClientRect().right).toBeLessThanOrEqual(strip.right + 0.5);
		expect(lastTip.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			last.getBoundingClientRect().top,
		);
	});
});
