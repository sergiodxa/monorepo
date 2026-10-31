/**
 * Lays the flow diagram out in a real browser: on a phone the schedule caption wraps beside
 * the pause toggle pinned to the surface's corner, and every line of it must stay clear of
 * the button; a page passing its own spec lines sees those lines in run order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import FlowDiagram from "~/resources/components/marketing/flow-diagram";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English captions as the home page passes them. */
const LABELS = {
	name: "A flow monitor run, step by step",
	pause: "Pause the animation",
	schedule: "The schedule starts a run",
	scheduleDetail: "As often as every 15 minutes",
	steps: [
		"Sign in",
		"Read the token",
		"Call the endpoint it authorises",
		"Check what comes back",
	] as [string, string, string, string],
	passed: "Run passed",
	alert: "A failed step alerts your team",
};

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("FlowDiagram", () => {
	/**
	 * Swept across phone widths, because whether the caption reaches the toggle depends on where
	 * its words happen to wrap.
	 */
	test("keeps the schedule caption clear of the pause toggle at every phone width", async () => {
		let hits: number[] = [];
		for (let width = 260; width <= 420; width += 4) {
			await page.viewport(width, 700);
			mounted = render(
				<div style={{ padding: "0 16px" }}>
					<FlowDiagram labels={LABELS} />
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

	test("prints the spec lines a page passes, in run order", async () => {
		await page.viewport(1280, 900);
		let code = ["browser.open", "browser.fill", "browser.click", "expect browser.heading"] as const;
		mounted = render(<FlowDiagram labels={LABELS} code={code} />);

		let printed = [...mounted.container.querySelectorAll("ol code")].map(
			(line) => line.textContent,
		);
		expect(printed).toEqual([...code]);
	});
});
