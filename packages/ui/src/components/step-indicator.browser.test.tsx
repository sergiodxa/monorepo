/**
 * Lays out a step indicator in a real browser: an ordered list in a named landmark, the
 * current step marked for assistive tech, done steps that link back, and only the current
 * step's name left visible in a narrow box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { StepIndicator } from "./step-indicator.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a three-step flow on its second step in a host `width` pixels wide. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<StepIndicator label="Transfer steps">
			<StepIndicator.Step number={1} state="complete" href="/transfer">
				Payee
			</StepIndicator.Step>
			<StepIndicator.Step number={2} state="current">
				Amount
			</StepIndicator.Step>
			<StepIndicator.Step number={3} state="upcoming">
				Review
			</StepIndicator.Step>
		</StepIndicator>,
		{ container: host },
	);
	return host;
}

describe("StepIndicator", () => {
	test("lists the steps in a named nav and marks the current one", () => {
		let host = mount(640);
		let nav = host.querySelector("nav")!;
		expect(nav.getAttribute("aria-label")).toBe("Transfer steps");
		let steps = [...nav.querySelectorAll("ol > li")];
		expect(steps.map((step) => step.getAttribute("data-state"))).toEqual([
			"complete",
			"current",
			"upcoming",
		]);
		expect(steps[1]!.getAttribute("aria-current")).toBe("step");
		expect(steps[0]!.querySelector("a")?.getAttribute("href")).toBe("/transfer");
		expect(steps[0]!.querySelector("svg")).not.toBeNull();
		expect(steps[2]!.querySelector("a")).toBeNull();
	});

	test("fills the done and current markers with the theme's brand colour", () => {
		document.documentElement.style.setProperty("--ui-brand-bg-solid", "rgb(200, 80, 40)");
		let host = mount(640);
		let markers = [...host.querySelectorAll<HTMLElement>('[data-slot="step-indicator-marker"]')];
		expect(markers.map((marker) => getComputedStyle(marker).backgroundColor)).toEqual([
			"rgb(200, 80, 40)",
			"rgb(200, 80, 40)",
			"rgba(0, 0, 0, 0)",
		]);
		document.documentElement.removeAttribute("style");
	});

	test("spans its container and fills the lines up to the current step", () => {
		document.documentElement.style.setProperty("--ui-brand-bg-solid", "rgb(200, 80, 40)");
		document.documentElement.style.setProperty("--ui-neutral-border", "rgb(220, 220, 220)");
		let host = mount(640);
		let steps = [...host.querySelectorAll<HTMLElement>("ol > li")];
		let last = steps[2]!.getBoundingClientRect();
		expect(Math.round(last.right)).toBe(Math.round(host.getBoundingClientRect().right));
		let lines = steps.map((step) => getComputedStyle(step, "::before"));
		expect(lines[1]!.backgroundColor).toBe("rgb(200, 80, 40)");
		expect(lines[2]!.backgroundColor).toBe("rgb(220, 220, 220)");
		expect(Number.parseFloat(lines[2]!.width)).toBeGreaterThan(100);
		document.documentElement.removeAttribute("style");
	});

	test("keeps every name visible where the row fits", () => {
		let host = mount(640);
		for (let label of host.querySelectorAll<HTMLElement>('[data-slot="step-indicator-label"]')) {
			expect(label.getBoundingClientRect().width).toBeGreaterThan(10);
		}
	});

	test("keeps only the current name visible in a narrow box, without overflowing", () => {
		let host = mount(280);
		let labels = [...host.querySelectorAll<HTMLElement>('[data-slot="step-indicator-label"]')];
		expect(labels.map((label) => label.getBoundingClientRect().width > 10)).toEqual([
			false,
			true,
			false,
		]);
		expect(labels[0]!.textContent).toBe("Payee");
		let list = host.querySelector("ol")!;
		expect(list.scrollWidth).toBeLessThanOrEqual(280);
	});
});
