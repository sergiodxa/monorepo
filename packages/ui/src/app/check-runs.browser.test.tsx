/**
 * Runs the check-run list in a real browser: the summary counts by state with plural copy from
 * labels, the list opens on its own when a run failed, rows sort failures first, each state has
 * its own icon shape, and the pending icon pulses only while motion is allowed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { CheckRuns, checkRunsSummary, sortCheckRuns } from "./check-runs.js";

import "../reset.css";
import "../theme.css";

/** English strings, plural on each count and on the total. */
const LABELS: CheckRuns.Labels = {
	counts: {
		failure: (count) => `${count} failing`,
		pending: (count) => `${count} pending`,
		success: (count) => `${count} successful`,
		skipped: (count) => `${count} skipped`,
		cancelled: (count) => `${count} cancelled`,
	},
	summary: (list, total) => `${list} ${total === 1 ? "check" : "checks"}`,
	states: {
		failure: "Failed",
		pending: "In progress",
		success: "Passed",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	details: "Details",
	empty: "No checks",
};

/** One failing, one pending and 22 passing runs, in the order a CI provider lists them. */
const RUNS: CheckRuns.Run[] = [
	...Array.from({ length: 11 }, (_, index) => ({
		name: `unit (${index})`,
		workflow: "CI",
		state: "success" as const,
		duration: "1m 02s",
		href: `/runs/${index}`,
	})),
	{ name: "lint", workflow: "CI", state: "pending", href: "/runs/lint" },
	...Array.from({ length: 11 }, (_, index) => ({
		name: `e2e (${index})`,
		workflow: "CI",
		state: "success" as const,
		href: `/runs/e2e-${index}`,
	})),
	{ name: "typecheck", workflow: "CI", state: "failure", duration: "48s", href: "/runs/tc" },
];

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The rows' run names, top to bottom. */
function names(host: HTMLElement): string[] {
	return [...host.querySelectorAll('[data-slot="check-run-name"]')].map(
		(node) => node.textContent ?? "",
	);
}

/** Lightness of each palette step, so every tone the theme reads resolves to a real colour. */
const STEPS: Record<number, number> = {
	50: 0.97,
	100: 0.94,
	200: 0.88,
	300: 0.8,
	400: 0.7,
	500: 0.62,
	600: 0.55,
	700: 0.48,
	800: 0.4,
	900: 0.32,
	950: 0.24,
};

/** Hue per tone, as an app's palette would set them. */
const HUES: Record<string, [hue: number, chroma: number]> = {
	brand: [75, 0.13],
	neutral: [75, 0.008],
	success: [150, 0.15],
	warning: [85, 0.16],
	danger: [25, 0.2],
};

beforeEach(async () => {
	await page.viewport(1024, 768);
	for (let [tone, [hue, chroma]] of Object.entries(HUES)) {
		for (let [step, lightness] of Object.entries(STEPS)) {
			document.documentElement.style.setProperty(
				`--ui-color-${tone}-${step}`,
				`oklch(${lightness} ${chroma} ${hue})`,
			);
		}
	}
});

afterEach(async () => {
	document.documentElement.removeAttribute("style");
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("CheckRuns", () => {
	test("counts the runs by state in one sentence, joined in the locale", () => {
		let host = mount(<CheckRuns runs={RUNS} labels={LABELS} locale="en-GB" />);
		let summary = host.querySelector("summary")!;

		expect(summary.textContent).toContain("1 failing, 1 pending and 22 successful checks");
		expect(checkRunsSummary(RUNS, LABELS, "en-US")).toBe(
			"1 failing, 1 pending, and 22 successful checks",
		);
	});

	test("uses the singular for a single run and names an empty list", () => {
		expect(checkRunsSummary([{ name: "ci", state: "success" }], LABELS, "en")).toBe(
			"1 successful check",
		);
		let host = mount(<CheckRuns runs={[]} labels={LABELS} />);
		expect(host.querySelector("summary")!.textContent).toBe("No checks");
		expect(host.querySelector("ul")).toBeNull();
	});

	test("opens when a run failed and stays one line when every run passed", () => {
		let failing = mount(<CheckRuns runs={RUNS} labels={LABELS} />);
		expect(failing.querySelector("details")!.open).toBe(true);
		expect(failing.querySelector("details")!.dataset.state).toBe("failure");

		let passing = mount(
			<CheckRuns runs={RUNS.filter((run) => run.state === "success")} labels={LABELS} />,
		);
		let details = passing.querySelector("details")!;
		expect(details.open).toBe(false);
		expect(details.dataset.state).toBe("success");
		expect(passing.querySelector('[data-slot="check-runs-list"]')!.checkVisibility()).toBe(false);

		passing.querySelector("summary")!.click();
		expect(details.open).toBe(true);
	});

	test("sorts failure, then pending, then success, then skipped and cancelled", () => {
		let runs: CheckRuns.Run[] = [
			{ name: "a", state: "skipped" },
			{ name: "b", state: "success" },
			{ name: "c", state: "cancelled" },
			{ name: "d", state: "pending" },
			{ name: "e", state: "failure" },
			{ name: "f", state: "success" },
		];
		expect(sortCheckRuns(runs).map((run) => run.name)).toEqual(["e", "d", "b", "f", "a", "c"]);

		let host = mount(<CheckRuns runs={runs} labels={LABELS} open />);
		expect(names(host)).toEqual(["e", "d", "b", "f", "a", "c"]);
	});

	test("draws a different shape per state and names it", () => {
		let runs: CheckRuns.Run[] = (
			["failure", "pending", "success", "skipped", "cancelled"] as const
		).map((state) => ({ name: state, state }));
		let host = mount(<CheckRuns runs={runs} labels={LABELS} open />);
		let icons = [...host.querySelectorAll<HTMLElement>('li [data-slot="check-run-icon"]')];

		expect(icons.map((icon) => icon.getAttribute("aria-label"))).toEqual([
			"Failed",
			"In progress",
			"Passed",
			"Skipped",
			"Cancelled",
		]);
		let shapes = icons.map((icon) => icon.querySelector("svg")!.innerHTML);
		expect(new Set(shapes).size).toBe(5);
		let colors = icons.map((icon) => getComputedStyle(icon).color);
		expect(colors[0]).not.toBe(colors[2]);
		expect(colors[1]).not.toBe(colors[2]);
	});

	test("names each Details link after its run and links to the log", () => {
		let host = mount(<CheckRuns runs={RUNS} labels={LABELS} />);
		let link = host.querySelector<HTMLAnchorElement>('[data-slot="check-run-details"]')!;

		expect(link.getAttribute("href")).toBe("/runs/tc");
		expect(link.textContent).toBe("Details typecheck");
		expect(link.querySelector("span")!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
	});

	test("pulses the pending icon, and holds it still under reduced motion", async () => {
		let host = mount(<CheckRuns runs={RUNS} labels={LABELS} />);
		let pending = () => host.querySelector<HTMLElement>('li [data-state="pending"]')!;
		expect(getComputedStyle(pending()).animationName).toBe("ui-check-run-pending");

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		expect(getComputedStyle(pending()).animationName).toBe("none");
	});

	test("fits a 375px phone without scrolling the page sideways", async () => {
		await page.viewport(375, 812);
		let host = mount(
			<CheckRuns
				runs={[
					{
						name: "integration (ubuntu-latest, node 22, a very long matrix label)",
						workflow: "Continuous integration / pull_request",
						state: "failure",
						duration: "12m 40s",
						href: "/runs/1",
					},
				]}
				labels={LABELS}
			/>,
			343,
		);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		let row = host.querySelector<HTMLElement>("li")!;
		expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
	});
});
