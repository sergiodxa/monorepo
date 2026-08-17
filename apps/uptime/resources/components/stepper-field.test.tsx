/**
 * Tests for the stepper field, asserted over its server pass with
 * `renderToString`. The bug this component exists to fix was markup that
 * looked perfect and did nothing, so the assertions here are the three
 * things that separate a working stepper from an inert one: the hydration
 * marker and props payload the browser entry needs to find and boot it, the
 * Invoker Commands linking each button to the input the `stepper()` mixin
 * steps, and the untouched native input underneath that must submit the same
 * value with scripting off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync } from "node:fs";

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { StepperField } from "./stepper-field";

/** Renders one field with every prop set, since the payload assertions read all of them back. */
function render() {
	return renderToString(
		<StepperField
			id="tcp-monitor-port"
			name="port"
			label="Port"
			description="The port to connect to."
			decrementLabel="Decrease port"
			incrementLabel="Increase port"
			min={1}
			max={65_535}
			defaultValue={80}
			required
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

describe("StepperField", () => {
	/**
	 * The whole point of the component: a plain server component renders the same
	 * markup and never hydrates, so the marker and its entry are what prove the
	 * buttons get a runtime at all.
	 */
	test("renders as a client entry the browser bootstrap can load", async () => {
		let html = await render();

		expect(html).toContain("<!-- rmx:h:");
		let { h } = await hydrationData(html);
		let entries = Object.values(h);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.exportName).toBe("StepperField");
		expect(entries[0]?.moduleUrl).toBe("/resources/components/stepper-field.tsx");
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

	/** Every prop the client re-renders from has to survive serialization, or hydration boots a different field. */
	test("serializes the props the client re-renders the field from", async () => {
		let { h } = await hydrationData(await render());

		expect(Object.values(h)[0]?.props).toEqual({
			id: "tcp-monitor-port",
			name: "port",
			label: "Port",
			description: "The port to connect to.",
			decrementLabel: "Decrease port",
			incrementLabel: "Increase port",
			min: 1,
			max: 65_535,
			defaultValue: 80,
			required: true,
		});
	});

	/**
	 * `stepper()` reads the direction off each button's own `command` and finds the
	 * input through `commandfor`, so a button missing either is the inert button
	 * this component was written to replace.
	 */
	test("wires each button to the input with its own step command", async () => {
		let html = await render();

		expect(html).toContain('command="--step-down" commandfor="tcp-monitor-port"');
		expect(html).toContain('command="--step-up" commandfor="tcp-monitor-port"');
		expect(html).toContain('id="tcp-monitor-port"');
	});

	/** Both buttons carry a glyph and no text, so the accessible name can only come from the label prop. */
	test("names both buttons for assistive technology", async () => {
		let html = await render();

		expect(html).toContain('aria-label="Decrease port"');
		expect(html).toContain('aria-label="Increase port"');
	});

	/**
	 * The no-JS baseline: with scripting off the buttons go quiet, and the form has
	 * to post exactly what it posted before this component existed.
	 */
	test("keeps a native number input that submits the same value without JavaScript", async () => {
		let input = (await render()).match(/<input [^>]*>/)?.[0] ?? "";

		expect(input).toContain('type="number"');
		expect(input).toContain('name="port"');
		expect(input).toContain('value="80"');
		expect(input).toContain('min="1"');
		expect(input).toContain('max="65535"');
		expect(input).toContain("required");
	});
});
