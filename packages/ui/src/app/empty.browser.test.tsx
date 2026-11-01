/**
 * Lays out each empty-state kind in a real browser: its default icon, tone and frame,
 * the quoted query and request id parts, an icon override, and a compact size that
 * fits a card or table body without overflowing at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Empty } from "./empty.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts `node` in a host `width` pixels wide and returns the empty panel. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host.querySelector<HTMLElement>('[data-slot="empty"]')!;
}

describe("Empty kinds", () => {
	for (let [kind, color, border] of [
		["first-run", "neutral", "dashed"],
		["no-results", "neutral", "none"],
		["cleared", "success", "none"],
		["permission", "neutral", "solid"],
		["error", "danger", "solid"],
	] as const) {
		test(`${kind} leads with its icon in the ${color} tone and a ${border} frame`, () => {
			let panel = mount(
				<Empty kind={kind}>
					<Empty.Title>Nothing here</Empty.Title>
				</Empty>,
			);

			let icon = panel.firstElementChild as HTMLElement;
			expect(icon.dataset.slot).toBe("icon");
			expect(icon.getAttribute("aria-hidden")).toBe("true");
			expect(icon.querySelector("svg")).not.toBeNull();
			expect(panel.dataset.color).toBe(color);

			let style = getComputedStyle(panel);
			if (border === "none") {
				expect(style.borderTopColor).toBe("rgba(0, 0, 0, 0)");
				expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
			} else {
				expect(style.borderTopStyle).toBe(border);
			}
		});
	}

	test("no-results quotes the query and keeps Clear filters as its action", () => {
		let panel = mount(
			<Empty kind="no-results">
				<Empty.Title>No monitors match</Empty.Title>
				<Empty.Description>
					Nothing matched <Empty.Query>status:down region:fra</Empty.Query>.
				</Empty.Description>
				<Empty.Action>
					<a href="?">Clear filters</a>
				</Empty.Action>
			</Empty>,
		);

		let query = panel.querySelector("q")!;
		expect(query.textContent).toBe("status:down region:fra");
		expect(getComputedStyle(query, "::before").content).not.toBe("none");
		expect(panel.querySelector('[data-slot="action"] a')?.textContent).toBe("Clear filters");
	});

	test("error shows a request id that selects whole on one click", () => {
		let panel = mount(
			<Empty kind="error">
				<Empty.Title>Couldn't load incidents</Empty.Title>
				<Empty.RequestId label="Request ID">req_01JD8Z3K</Empty.RequestId>
			</Empty>,
		);

		let id = panel.querySelector('[data-slot="request-id"] code')!;
		expect(panel.querySelector('[data-slot="request-id"]')?.textContent).toBe(
			"Request ID req_01JD8Z3K",
		);
		expect(getComputedStyle(id).userSelect).toBe("all");
	});

	test("takes an icon override, or none at all", () => {
		let custom = mount(
			<Empty kind="first-run" icon={<span data-testid="mark">*</span>}>
				<Empty.Title>Create your first monitor</Empty.Title>
			</Empty>,
		);
		expect(custom.querySelector('[data-slot="icon"] [data-testid="mark"]')).not.toBeNull();

		mounted?.cleanup();
		let bare = mount(
			<Empty kind="first-run" icon={null}>
				<Empty.Title>Create your first monitor</Empty.Title>
			</Empty>,
		);
		expect(bare.querySelector('[data-slot="icon"]')).toBeNull();
	});

	test("lets color override the kind's tone", () => {
		let panel = mount(
			<Empty kind="error" color="warning">
				<Empty.Title>Partial outage</Empty.Title>
			</Empty>,
		);

		expect(panel.dataset.color).toBe("warning");
	});
});

describe("Empty compact size", () => {
	test("tightens padding, icon and title to sit inside a card", () => {
		let regular = mount(
			<Empty kind="cleared">
				<Empty.Title>All caught up</Empty.Title>
			</Empty>,
		);
		let regularHeight = regular.getBoundingClientRect().height;
		let regularTitle = parseFloat(getComputedStyle(regular.querySelector("h1")!).fontSize);
		mounted?.cleanup();

		let compact = mount(
			<Empty kind="cleared" size="compact">
				<Empty.Title>All caught up</Empty.Title>
			</Empty>,
		);

		expect(compact.getBoundingClientRect().height).toBeLessThan(regularHeight);
		expect(getComputedStyle(compact).paddingTop).toBe("16px");
		expect(compact.querySelector('[data-slot="icon"]')!.getBoundingClientRect().height).toBe(32);
		expect(parseFloat(getComputedStyle(compact.querySelector("h1")!).fontSize)).toBeLessThan(
			regularTitle,
		);
	});

	test("fits a 320px column without overflowing", () => {
		let panel = mount(
			<Empty kind="error" size="compact">
				<Empty.Title>Couldn't load checks</Empty.Title>
				<Empty.RequestId label="Request ID">
					req_01JD8Z3K4R7Y2M5N9Q0W1E2T3Y4U5I6O7P8A9S
				</Empty.RequestId>
			</Empty>,
			320,
		);

		expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
		expect(panel.getBoundingClientRect().width).toBeLessThanOrEqual(320);
	});
});
