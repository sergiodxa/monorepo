/**
 * Drives DetailSheet in a real browser: it opens from URL state, leaves the page behind
 * clickable and focusable, closes and steps through records by following its links from
 * Esc, k/j and ↑/↓, takes focus on open, and becomes a bottom sheet on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DetailSheet } from "./detail-sheet.js";

import "../reset.css";
import "../theme.css";

const LABELS: DetailSheet.Labels = {
	close: "Close",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous monitor",
	next: "Next monitor",
	position: "Monitor",
};

/** A monitors page whose `?pane=` query opens one monitor in the sheet. */
function Monitors(handle: { props: { search: string } }) {
	return () => {
		let pane = new URLSearchParams(handle.props.search).get("pane");

		return (
			<main>
				<button type="button" id="behind">
					New monitor
				</button>
				{pane ? (
					<DetailSheet
						id="monitor"
						title={`Monitor ${pane}`}
						description="api.example.com"
						closeHref="#list"
						permalink={`/monitors/${pane}`}
						position={{ index: 3, total: 84, previousHref: "#m-2", nextHref: "#m-4" }}
						footer={<button type="button">Pause</button>}
						labels={LABELS}
					>
						<p>Up for 12 days.</p>
						<button type="button" popovertarget="owner-menu">
							Owner
						</button>
						<div id="owner-menu" popover="auto">
							Pick an owner
						</div>
					</DetailSheet>
				) : null}
			</main>
		);
	};
}

/** Every render of the running test, unmounted after it so no key listener outlives it. */
let mounted: RenderResult[] = [];

/** Renders the page for `search`. */
function mount(search: string): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	mounted.push(render(<Monitors search={search} />, { container: host }));
	return host;
}

/** The sheet's link for `name`: `close`, `previous` or `next`. */
function link(host: HTMLElement, name: string): HTMLAnchorElement {
	return host.querySelector<HTMLAnchorElement>(`[data-detail-sheet-link="${name}"]`)!;
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.replaceChildren();
	history.replaceState(null, "", location.pathname + location.search);
});

describe("DetailSheet", () => {
	test("renders open only when the URL names a record", () => {
		expect(mount("").querySelector('[data-slot="detail-sheet"]')).toBeNull();

		let host = mount("?pane=42");
		let sheet = host.querySelector<HTMLElement>('[data-slot="detail-sheet"]')!;
		expect(sheet.tagName).toBe("ASIDE");
		expect(sheet.getAttribute("aria-labelledby")).toBe("monitor-title");
		expect(document.getElementById("monitor-title")?.textContent).toBe("Monitor 42");
	});

	test("docks to the inline end between 28rem and 36rem wide", () => {
		let sheet = mount("?pane=42").querySelector('[data-slot="detail-sheet-panel"]')!;
		let box = sheet.getBoundingClientRect();

		expect(box.right).toBe(window.innerWidth);
		expect(box.top).toBe(0);
		expect(box.bottom).toBe(window.innerHeight);
		expect(box.width).toBeGreaterThanOrEqual(448);
		expect(box.width).toBeLessThanOrEqual(576);
	});

	test("leaves the page behind clickable and focusable", async () => {
		let host = mount("?pane=42");
		let behind = host.querySelector<HTMLButtonElement>("#behind")!;
		let pressed = 0;
		behind.addEventListener("click", () => pressed++);

		let box = behind.getBoundingClientRect();
		expect(document.elementFromPoint(box.left + 4, box.top + 4)).toBe(behind);
		await userEvent.click(behind);
		expect(pressed).toBe(1);
		behind.focus();
		expect(document.activeElement).toBe(behind);
		expect(document.querySelector("dialog:modal")).toBeNull();
	});

	test("moves focus into the sheet on open", () => {
		let host = mount("?pane=42");
		expect(document.activeElement).toBe(host.querySelector('[data-slot="detail-sheet"]'));
	});

	test("closes through an explicit link back to the list, and on Esc", async () => {
		let host = mount("?pane=42");
		let close = link(host, "close");

		expect(close.getAttribute("href")).toBe("#list");
		expect(close.getAttribute("aria-label")).toBe("Close");
		expect(close.getAttribute("aria-keyshortcuts")).toBe("Escape");

		await userEvent.keyboard("{Escape}");
		expect(location.hash).toBe("#list");
	});

	test("leaves Esc to an open popover inside the sheet", async () => {
		let host = mount("?pane=42");
		host.querySelector<HTMLElement>("#owner-menu")!.showPopover();

		await userEvent.keyboard("{Escape}");
		expect(location.hash).toBe("");
	});

	test("shows n / N and follows the next and previous links from the keyboard", async () => {
		let host = mount("?pane=42");
		let position = host.querySelector('[data-slot="detail-sheet-position"]')!;

		expect(position.textContent).toBe("Monitor 3 / 84");
		expect(link(host, "next").getAttribute("rel")).toBe("next");

		await userEvent.keyboard("j");
		expect(location.hash).toBe("#m-4");
		await userEvent.keyboard("k");
		expect(location.hash).toBe("#m-2");
		await userEvent.keyboard("{ArrowDown}");
		expect(location.hash).toBe("#m-4");
	});

	test("keeps j and k for a field being typed in", async () => {
		let host = mount("?pane=42");
		let field = document.createElement("input");
		host.appendChild(field);
		field.focus();

		await userEvent.keyboard("j");
		expect(location.hash).toBe("");
		expect(field.value).toBe("j");
	});

	test("loads Close, Previous and Next into the frame it names, and leaves a missing link inert", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted.push(
			render(
				<DetailSheet
					id="framed"
					title="Framed"
					closeHref="#list"
					target="sheet"
					position={{ index: 1, total: 2, previousHref: null, nextHref: "#m-2" }}
					labels={LABELS}
				/>,
				{ container: host },
			),
		);

		expect(link(host, "close").getAttribute("data-rmx-target")).toBe("sheet");
		expect(link(host, "next").getAttribute("data-rmx-target")).toBe("sheet");
		expect(link(host, "previous").hasAttribute("data-rmx-target")).toBe(false);
	});

	test("disables the previous link at the first record", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted.push(
			render(
				<DetailSheet
					id="first"
					title="First"
					closeHref="#list"
					position={{ index: 1, total: 2, previousHref: null, nextHref: "#m-2" }}
					labels={LABELS}
				/>,
				{ container: host },
			),
		);
		let previous = link(host, "previous");

		expect(previous.hasAttribute("href")).toBe(false);
		expect(previous.getAttribute("aria-disabled")).toBe("true");
	});

	test("becomes a bottom sheet on a phone without overflowing the page", async () => {
		await page.viewport(375, 812);
		let sheet = mount("?pane=42").querySelector('[data-slot="detail-sheet-panel"]')!;
		let box = sheet.getBoundingClientRect();

		expect(box.left).toBe(0);
		expect(box.width).toBe(375);
		expect(box.bottom).toBe(812);
		expect(box.top).toBeGreaterThan(0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("answers its keys only from inside itself when scoped to the sheet", async () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted.push(
			render(
				<DetailSheet
					id="scoped"
					title="Scoped"
					closeHref="#list"
					keys="sheet"
					position={{ index: 1, total: 2, nextHref: "#m-2" }}
					labels={LABELS}
				/>,
				{ container: host },
			),
		);
		let sheet = host.querySelector<HTMLElement>('[data-slot="detail-sheet"]')!;

		expect(document.activeElement).not.toBe(sheet);
		await userEvent.keyboard("j");
		expect(location.hash).toBe("");

		sheet.focus();
		await userEvent.keyboard("j");
		expect(location.hash).toBe("#m-2");
	});
});
