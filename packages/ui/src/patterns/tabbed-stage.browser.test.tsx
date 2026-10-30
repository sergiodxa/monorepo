/**
 * Lays a vertical {@link TabbedStage} out in a real browser: the rail and the stage sit side
 * by side at 900px, only the selected panel draws, and choosing another item swaps panels
 * through the radio group alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { TabbedStage } from "./tabbed-stage.js";

/** Mounts a three-item vertical stage in a 900px-wide column attached to the document. */
function mountStage(): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "900px";
	document.body.appendChild(host);
	return render(
		<TabbedStage name="incident" orientation="vertical" aria-label="Incident response">
			<TabbedStage.Item value="detect" label="Detect" description="Probes agree." defaultChecked>
				<p>Detect panel</p>
			</TabbedStage.Item>
			<TabbedStage.Item value="page" label="Page" description="On-call is paged.">
				<p>Page panel</p>
			</TabbedStage.Item>
			<TabbedStage.Item value="resolve" label="Resolve">
				<p>Resolve panel</p>
			</TabbedStage.Item>
		</TabbedStage>,
		{ container: host },
	).container;
}

/** The panel element belonging to the item with `value`. */
function panel(root: HTMLElement, value: string): HTMLElement {
	return root.querySelector<HTMLElement>(
		`[data-value="${value}"] [data-slot="tabbed-stage-panel"]`,
	)!;
}

describe("TabbedStage vertical", () => {
	test("shows the selected panel beside the rail and switches on a label click", async () => {
		let root = mountStage();
		let detect = panel(root, "detect");
		let page = panel(root, "page");

		expect(getComputedStyle(detect).display).toBe("block");
		expect(getComputedStyle(page).display).toBe("none");
		expect(getComputedStyle(detect).position).toBe("sticky");

		let rail = root.querySelector<HTMLElement>('[data-value="detect"] label')!;
		expect(detect.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			rail.getBoundingClientRect().right,
		);

		root.querySelector<HTMLElement>('[data-value="page"] label')!.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(getComputedStyle(detect).display).toBe("none");
		expect(getComputedStyle(page).display).toBe("block");
		let description = root.querySelector<HTMLElement>(
			'[data-value="page"] [data-slot="tabbed-stage-description"]',
		)!;
		expect(getComputedStyle(description).display).toBe("block");
	});
});
