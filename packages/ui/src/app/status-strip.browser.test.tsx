/**
 * Lays the status strip out in a real browser: 90 bars fit a 320px card without overflow,
 * a period with no data is hatched rather than drawn empty, the bars are one Tab stop the
 * arrows move through, and the focused bar's tooltip stays inside the strip near either end.
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
	return [...host.querySelectorAll<HTMLButtonElement>('[data-slot="status-strip-bars"] > button')];
}

/** A bar's tooltip: the generated box after it, which reads the bar's accessible name. */
function tip(bar: HTMLElement): CSSStyleDeclaration {
	return getComputedStyle(bar, "::after");
}

/**
 * Where a bar's tooltip lands, measured from the bar's offset box plus the tooltip's resolved
 * insets, since a generated box has no client rect of its own.
 */
function tipRect(bar: HTMLElement): { left: number; right: number; bottom: number; width: number } {
	let box = bar.getBoundingClientRect();
	let style = tip(bar);
	let width = Number.parseFloat(style.width);
	let left = box.left + Number.parseFloat(style.left);
	let translate = style.translate === "none" ? 0 : Number.parseFloat(style.translate);
	if (style.translate.endsWith("%")) translate = (translate / 100) * width;
	left += translate;
	return { left, right: left + width, bottom: box.bottom - Number.parseFloat(style.bottom), width };
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

	test("keeps long tooltips from widening a phone-width page until a bar is shown", async () => {
		await page.viewport(320, 640);
		let periods = DAYS.map((day) => ({
			...day,
			value: "99.93% uptime · 1,438 of 1,440 checks passed",
		}));
		let host = mount(<StatusStrip label="Uptime" periods={periods} />, 288);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);

		bars(host)[60]!.focus();
		expect(tip(bars(host)[60]!).display).toBe("block");
		expect(tipRect(bars(host)[60]!).width).toBeLessThanOrEqual(288);
	});

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

	test("names each bar by its date and value inside a toolbar named by the label", async () => {
		mount(<StatusStrip label="Uptime, last 90 days" periods={DAYS} />, 640);

		await expect
			.element(page.getByRole("toolbar", { name: "Uptime, last 90 days" }))
			.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Day 42, 100%" })).toBeInTheDocument();
	});

	test("is one Tab stop, landing on the newest bar", async () => {
		let host = mount(
			<div>
				<button type="button">Before</button>
				<StatusStrip label="Uptime" periods={DAYS} />
				<button type="button">After</button>
			</div>,
			640,
		);
		let [before, after] = [...host.querySelectorAll<HTMLButtonElement>(":scope > div > button")];
		let last = bars(host).at(-1)!;

		expect(bars(host).filter((bar) => bar.tabIndex === 0)).toEqual([last]);
		before!.focus();
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(last);
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(after);
		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		expect(document.activeElement).toBe(last);
	});

	test("moves between bars with the arrows, Home and End, and the Tab stop follows", async () => {
		let host = mount(<StatusStrip label="Uptime" periods={DAYS} />, 640);
		let all = bars(host);
		let stop = () => all.filter((bar) => bar.tabIndex === 0);

		all.at(-1)!.focus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(all[88]);
		expect(stop()).toEqual([all[88]]);
		await userEvent.keyboard("{Home}");
		expect(document.activeElement).toBe(all[0]);
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(all[0]);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(all[1]);
		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(all[89]);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(all[89]);
		expect(stop()).toEqual([all[89]]);
	});

	test("flips the arrows in a right-to-left strip", async () => {
		let host = mount(
			<div dir="rtl">
				<StatusStrip label="Uptime" periods={DAYS} />
			</div>,
			640,
		);
		let all = bars(host);

		all.at(-1)!.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(all[88]);
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(all[89]);
	});

	test("shows the focused bar's tooltip, kept inside the strip at the edges", async () => {
		let host = mount(<StatusStrip label="Uptime" periods={DAYS} />, 320);
		let first = bars(host)[0]!;
		let last = bars(host).at(-1)!;
		let strip = host.querySelector('[data-slot="status-strip"]')!.getBoundingClientRect();

		expect(tip(last).display).toBe("none");
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(last);
		await expect.poll(() => tip(last).display).toBe("block");
		expect(tipRect(last).right).toBeLessThanOrEqual(strip.right + 0.5);
		expect(tipRect(last).bottom).toBeLessThanOrEqual(last.getBoundingClientRect().top);

		await userEvent.keyboard("{Home}");
		expect(document.activeElement).toBe(first);
		await expect.poll(() => tip(first).display).toBe("block");
		expect(tip(last).display).toBe("none");
		expect(tip(first).content).toBe('"Day 1, No data"');
		expect(tipRect(first).left).toBeGreaterThanOrEqual(strip.left - 0.5);
	});

	test("shows the hovered bar's tooltip in the middle of the strip, centred on the bar", async () => {
		let host = mount(<StatusStrip label="Uptime" periods={DAYS} />, 640);
		let middle = bars(host)[45]!;

		await userEvent.hover(middle);
		await expect.poll(() => tip(middle).display).toBe("block");
		expect(tip(bars(host)[44]!).display).toBe("none");
		let box = middle.getBoundingClientRect();
		let centre = (tipRect(middle).left + tipRect(middle).right) / 2;
		expect(Math.abs(centre - (box.left + box.right) / 2)).toBeLessThanOrEqual(1);
	});
});
