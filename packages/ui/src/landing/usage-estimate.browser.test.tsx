/**
 * Lays out {@link UsageEstimate} in a real browser: a GET form that needs no script, a bill
 * whose amounts share one right edge with the total, the two side by side on a wide card
 * and stacked on a phone with nothing overflowing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { UsageEstimate } from "./usage-estimate.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Mounts a calculator in a column `width` pixels wide and returns its host. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.inlineSize = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<UsageEstimate
			action="#pricing"
			fields={
				<label>
					Hours a month <input type="number" name="hours" defaultValue="40" />
				</label>
			}
			submitLabel="Estimate"
			billLabel="Estimated monthly bill"
			rows={[
				{ label: "Free hours", detail: "5 h × $0.00", amount: "$0.00" },
				{ label: "Recorded hours", detail: "35 h × $0.36", amount: "$12.60" },
			]}
			total={{ label: "Per month", amount: "$12.60" }}
			footnote="Everyone in the workspace reads the notes free."
		/>,
		{ container: host },
	);
	return host;
}

describe("UsageEstimate", () => {
	test("submits its fields by GET to the action", () => {
		let form = mount(800).querySelector("form")!;
		expect(form.method).toBe("get");
		expect(form.getAttribute("action")).toBe("#pricing");
		expect(form.querySelector('button[type="submit"]')?.textContent).toBe("Estimate");
	});

	test("names the bill and ends every amount on the total's edge", () => {
		let host = mount(800);
		let table = host.querySelector("table")!;
		expect(table.getAttribute("aria-label")).toBe("Estimated monthly bill");
		let edges = [...table.querySelectorAll("td")].map((td) =>
			Math.round(td.getBoundingClientRect().right),
		);
		expect(new Set(edges).size).toBe(1);
	});

	test("sets the form beside the bill on a wide card and above it on a phone", () => {
		let wide = mount(800);
		let [form, bill] = [wide.querySelector("form")!, wide.querySelector("table")!];
		expect(bill.getBoundingClientRect().left).toBeGreaterThan(
			form.getBoundingClientRect().right - 1,
		);
		mounted?.cleanup();
		document.body.innerHTML = "";

		let narrow = mount(320);
		form = narrow.querySelector("form")!;
		bill = narrow.querySelector("table")!;
		expect(bill.getBoundingClientRect().top).toBeGreaterThan(
			form.getBoundingClientRect().bottom - 1,
		);
		expect(narrow.scrollWidth).toBeLessThanOrEqual(320);
	});
});
