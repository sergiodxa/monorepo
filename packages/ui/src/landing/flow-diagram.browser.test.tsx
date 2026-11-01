/**
 * Lays out {@link FlowDiagram} in a real browser: one row per step after the trigger,
 * each rail segment ending where the next dot starts however a caption wraps, step code
 * set in mono, the trigger caption clear of the pause toggle on a phone, and runs of
 * different lengths animating on their own keyframes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { FlowDiagram } from "./flow-diagram.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	await page.viewport(414, 896);
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Steps of a sign-in run, the second with a caption long enough to wrap at 280px. */
const STEPS: FlowDiagram.Step[] = [
	{ title: "Sign in", code: 'http.post "/api/sessions"' },
	{ title: "Read the session token the sign-in returned to every later request", detail: "json" },
	{ title: "Check the account", code: "expect account.status 200" },
];

/** Mounts a diagram of `steps` in a 280px column and returns its host. */
function mount(steps: readonly FlowDiagram.Step[] = STEPS): HTMLElement {
	let host = document.createElement("div");
	host.style.cssText = "inline-size: 280px; container-type: inline-size";
	document.body.appendChild(host);
	mounted = render(
		<FlowDiagram
			aria-label="Sign-in check"
			trigger={{ title: "Every 5 minutes", detail: "from 3 regions" }}
			steps={steps}
			outcome="Run passed"
			footnote="Alerts on failure"
		/>,
		{ container: host },
	);
	return host;
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("FlowDiagram", () => {
	test("lists the trigger then every step under the list's name", () => {
		let host = mount();
		let list = host.querySelector("ol")!;
		expect(list.getAttribute("aria-label")).toBe("Sign-in check");
		expect(list.children).toHaveLength(STEPS.length + 1);
		expect(host.textContent).toContain("Run passed");
		expect(host.textContent).toContain("Alerts on failure");
	});

	test("ends each rail segment at the top of the next row's dot", () => {
		let host = mount();
		let rows = [...host.querySelectorAll("ol > li")];
		for (let index = 0; index < rows.length - 1; index++) {
			let rail = rows[index]!.querySelector('[aria-hidden="true"]:not(svg)')!;
			let nextDot = rows[index + 1]!.firstElementChild!;
			expect(Math.round(rail.getBoundingClientRect().bottom)).toBe(
				Math.round(nextDot.getBoundingClientRect().top),
			);
		}
		expect(rows.at(-1)!.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
	});

	test("sets a step's code in the mono face", () => {
		let host = mount();
		let code = host.querySelector("code")!;
		expect(code.textContent).toBe('http.post "/api/sessions"');
		expect(getComputedStyle(code).fontFamily).not.toBe(getComputedStyle(host).fontFamily);
	});

	/**
	 * Swept across phone widths, because whether the caption reaches the toggle depends on
	 * where its words happen to wrap.
	 */
	test("keeps the trigger caption clear of the pause toggle at every phone width", async () => {
		let hits: number[] = [];
		for (let width = 260; width <= 420; width += 4) {
			await page.viewport(width, 700);
			mounted = render(
				<div style={{ padding: "0 16px" }}>
					<FlowDiagram
						aria-label="A flow monitor run, step by step"
						trigger={{ title: "The schedule starts a run", detail: "As often as every 15 minutes" }}
						steps={STEPS}
						outcome="Run passed"
					/>
				</div>,
			);
			let toggle = mounted.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
			let walker = document.createTreeWalker(mounted.$("ol > li")!, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				let range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				if ([...range.getClientRects()].some((line) => overlaps(line, toggle))) hits.push(width);
			}
			mounted.cleanup();
			mounted = undefined;
		}

		expect(hits).toEqual([]);
	});

	test("animates runs of different lengths on separate keyframes", () => {
		let three = mount();
		let two = mount(STEPS.slice(0, 2));
		let firstDot = (root: HTMLElement) =>
			getComputedStyle(root.querySelectorAll("ol > li")[1]!.firstElementChild!).animationName;
		expect(firstDot(three)).not.toBe(firstDot(two));
	});
});
