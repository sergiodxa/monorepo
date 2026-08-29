/**
 * Tests for the range slider, asserted over its server pass with
 * `renderToString`. The bug this island exists to fix was a slider whose thumb
 * moved while its readout and its track's colored fill stayed frozen at the
 * initial value, so the assertions here are the things that separate a working
 * slider from that one: the hydration marker and props payload the browser
 * entry needs to find and boot it, the track's fill bar sized from the value it
 * rendered with, and the untouched native input underneath that must submit the
 * same value with scripting off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync } from "node:fs";

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { RangeSlider } from "./range-slider";

/** Renders one slider with every prop set, since the payload assertions read all of them back. */
function render() {
	return renderToString(
		<RangeSlider
			label="Check Interval"
			description="Applied to every monitor in this list."
			name="interval_seconds"
			min={60}
			max={3600}
			step={60}
			scale={60}
			unit="m"
			defaultValue={600}
			rangeLabels={["1m", "60m"]}
		/>,
	);
}

/** The hydration payload the client runtime reads back out of the rendered document. */
async function hydrationData(html: string) {
	let payload = html.match(/<script type="application\/json" id="rmx-data">(.*?)<\/script>/s)?.[1];
	expect(payload).toBeDefined();
	return JSON.parse(payload as string) as {
		h: Record<string, { exportName: string; moduleUrl: string; props: Record<string, unknown> }>;
	};
}

describe("RangeSlider", () => {
	/**
	 * The whole point of the island: rendered as a plain server component, the
	 * `input` listener that advances the value never attaches, so the readout and
	 * the fill bar can only ever show the value the server picked.
	 */
	test("renders as a client entry the browser bootstrap can load", async () => {
		let html = await render();

		expect(html).toContain("<!-- rmx:h:");
		let { h } = await hydrationData(html);
		let entries = Object.values(h);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.exportName).toBe("RangeSlider");
		expect(entries[0]?.moduleUrl).toBe("/resources/components/range-slider.tsx");
	});

	/**
	 * `bootstrap/browser.ts` resolves a client entry by globbing `../resources/**`
	 * and keying on the module URL's pathname, so a URL naming a file that isn't
	 * there throws at hydration time instead of failing any type check.
	 */
	test("names a module the browser bootstrap's resources glob actually covers", async () => {
		let { h } = await hydrationData(await render());
		let moduleUrl = Object.values(h)[0]?.moduleUrl ?? "";

		expect(moduleUrl.startsWith("/resources/")).toBe(true);
		expect(existsSync(new URL(`../..${moduleUrl}`, import.meta.url))).toBe(true);
	});

	/** Every prop the client re-renders from has to survive serialization, or hydration boots a different slider. */
	test("serializes the props the client re-renders the slider from", async () => {
		let { h } = await hydrationData(await render());

		expect(Object.values(h)[0]?.props).toEqual({
			label: "Check Interval",
			description: "Applied to every monitor in this list.",
			name: "interval_seconds",
			min: 60,
			max: 3600,
			step: 60,
			scale: 60,
			unit: "m",
			defaultValue: 600,
			rangeLabels: ["1m", "60m"],
		});
	});

	/**
	 * The fill bar's length rides a custom property the track computes from the
	 * value it renders with — 600 of 60–3600 is 15.25% — so the property is
	 * what links a re-render's new value to the bar's width.
	 */
	test("sizes the track's fill bar from the value it renders with", async () => {
		expect(await render()).toContain("--ui-slider-fill: 15.25%");
	});

	/** The readout reports the value scaled and unit-suffixed for display; the form still submits it in raw seconds. */
	test("reports the value in the unit the label promises", async () => {
		let html = await render();

		expect(html).toContain('<output for="interval_seconds"');
		expect(html).toContain("10m");
	});

	/**
	 * The no-JS baseline: with scripting off the readout and fill go quiet, and
	 * the form has to post exactly what it posted before this island existed.
	 */
	test("keeps a native range input that submits the same value without JavaScript", async () => {
		let input = (await render()).match(/<input [^>]*>/)?.[0] ?? "";

		expect(input).toContain('type="range"');
		expect(input).toContain('name="interval_seconds"');
		expect(input).toContain('value="600"');
		expect(input).toContain('min="60"');
		expect(input).toContain('max="3600"');
		expect(input).toContain('step="60"');
	});
});
