/**
 * Lays the dashboard panel's toolbar out in a real browser at phone and laptop widths: the type
 * tabs and the auto-refresh control never overlap, and the page never scrolls sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import PanelToolbar from "~/resources/views/dashboard/panel-toolbar";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Every toolbar mounted by the running test. */
let mounted: RenderResult[] = [];

afterEach(() => {
	for (let result of mounted.splice(0)) result.cleanup();
	document.body.replaceChildren();
});

/** Four 110px tabs and a refresh control as wide as the dashboard's, the way the panel draws them. */
function mountToolbar(): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	mounted.push(
		render(
			<PanelToolbar
				tabs={
					<div role="tablist" style={{ display: "flex" }}>
						{["HTTP", "DNS", "TCP", "Cron Jobs"].map((label) => (
							<a
								key={label}
								role="tab"
								href={`?tab=${label}`}
								style={{ inlineSize: "110px", flexShrink: 0 }}
							>
								{label}
							</a>
						))}
					</div>
				}
				refresh={
					<button type="button" style={{ inlineSize: "220px" }}>
						Auto-refresh Off · Updated 9:41 AM
					</button>
				}
			/>,
			{ container: host },
		),
	);
	return host;
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("PanelToolbar", () => {
	for (let width of [375, 1440]) {
		test(`keeps the tabs and the refresh control apart at ${width}px`, async () => {
			await page.viewport(width, 800);
			let host = mountToolbar();
			let tabs = host.querySelector<HTMLElement>('[data-slot="panel-tabs"]')!;
			let refresh = host.querySelector<HTMLElement>('[data-slot="panel-refresh"]')!;

			expect(overlaps(tabs.getBoundingClientRect(), refresh.getBoundingClientRect())).toBe(false);
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
		});
	}
});
