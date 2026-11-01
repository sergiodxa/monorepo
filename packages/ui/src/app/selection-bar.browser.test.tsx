/**
 * Drives the selection bar in a real browser against a form of checkable rows: the morph from
 * pagination to bulk actions, the count kept while the bar fades out, Escape clearing the
 * selection before anything else hears it, action keys submitting, and the announcements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { SelectionBar } from "./selection-bar.js";

const LABELS: SelectionBar.Labels = {
	toolbar: "Monitor list",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

const ACTIONS: SelectionBar.Action[] = [
	{ label: "Pause", key: "p", name: "intent", value: "pause" },
	{ label: "Delete", key: "x", name: "intent", value: "delete", danger: true },
];

let mounted: RenderResult | undefined;

/** Mounts three checkable rows in a form and the bar watching them, in a host `width` wide. */
function mount(width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<div>
			<form id="monitors" method="post" action="/monitors/bulk">
				<input type="checkbox" data-selection-all aria-label="Select all" />
				{["api", "web", "db"].map((id) => (
					<label>
						<input type="checkbox" data-selection-item name="id" value={id} />
						{id}
					</label>
				))}
				<input type="search" name="q" aria-label="Search" />
			</form>
			<SelectionBar
				target="monitors"
				pagination={{ summary: "Viewing 1–50 of 1,234", next: "/monitors?page=2" }}
				actions={ACTIONS}
				locale="en-US"
				labels={LABELS}
			/>
		</div>,
		{ container: host },
	);
	return host;
}

/** The bar and its parts, for assertions. */
function parts(host: HTMLElement) {
	let bar = host.querySelector<HTMLElement>('[data-slot="selection-bar"]')!;
	return {
		bar,
		pagination: bar.querySelector<HTMLElement>('[data-slot="selection-bar-pagination"]')!,
		selection: bar.querySelector<HTMLElement>('[data-slot="selection-bar-selection"]')!,
		count: bar.querySelector<HTMLElement>('[data-slot="selection-count"]')!,
		status: bar.querySelector<HTMLElement>('[role="status"]')!,
	};
}

/** The row checkbox for `id`. */
function row(host: HTMLElement, id: string): HTMLInputElement {
	return host.querySelector<HTMLInputElement>(`input[value="${id}"]`)!;
}

/** Lets the bar's coalesced sync run. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
	await page.viewport(1024, 768);
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-reduced-motion", value: "reduce" }],
	});
});

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("SelectionBar", () => {
	test("shows pagination as a toolbar while nothing is selected", async () => {
		let host = mount();
		await settle();
		let { bar, pagination, selection } = parts(host);

		expect(bar.getAttribute("role")).toBe("toolbar");
		expect(bar.getAttribute("aria-label")).toBe("Monitor list");
		expect(bar.dataset.state).toBe("idle");
		expect(pagination.textContent).toContain("Viewing 1–50 of 1,234");
		expect(selection.inert).toBe(true);
		expect(getComputedStyle(selection).visibility).toBe("hidden");
		expect(host.querySelector('[data-slot="selection-bar-next"]')?.getAttribute("href")).toBe(
			"/monitors?page=2",
		);
		expect(
			host.querySelector('[data-slot="selection-bar-prev"]')?.getAttribute("aria-disabled"),
		).toBe("true");
	});

	test("morphs into the selection count and actions once a row is checked", async () => {
		let host = mount();
		let { bar, pagination, selection, count, status } = parts(host);

		await userEvent.click(row(host, "api"));
		await userEvent.click(row(host, "db"));
		await settle();

		expect(bar.dataset.state).toBe("selecting");
		expect(count.textContent).toBe("2 selected");
		expect(status.textContent).toBe("2 selected");
		expect(pagination.inert).toBe(true);
		expect(selection.inert).toBe(false);
		expect(getComputedStyle(selection).visibility).toBe("visible");
		expect(getComputedStyle(pagination).visibility).toBe("hidden");
		let keys = [...selection.querySelectorAll("button[data-selection-key]")].map((button) => [
			button.textContent,
			button.getAttribute("aria-keyshortcuts"),
		]);
		expect(keys).toEqual([
			["PauseP", "P"],
			["DeleteX", "X"],
		]);
	});

	test("keeps the last count while fading out and announces the clear", async () => {
		await cdp().send("Emulation.setEmulatedMedia", { features: [] });
		let host = mount();
		let { bar, selection, count, status } = parts(host);

		await userEvent.click(row(host, "api"));
		await userEvent.click(row(host, "web"));
		await settle();
		await userEvent.click(host.querySelector<HTMLButtonElement>('[data-slot="selection-clear"]')!);
		await settle();

		expect(bar.dataset.state).toBe("idle");
		expect(count.textContent).toBe("2 selected");
		expect(status.textContent).toBe("Selection cleared");
		expect(getComputedStyle(selection).transitionDuration).toContain("0.2s");
	});

	test("turns the morph off under reduced motion", () => {
		let host = mount();
		let { selection, pagination } = parts(host);

		expect(getComputedStyle(selection).transitionDuration).toBe("0s");
		expect(getComputedStyle(pagination).transitionDuration).toBe("0s");
	});

	test("clears the selection on Escape before any later listener hears it", async () => {
		let host = mount();
		let heard = 0;
		let changes = 0;
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") heard++;
		});
		host.querySelector("form")!.addEventListener("change", () => changes++);

		await userEvent.click(row(host, "api"));
		await userEvent.click(row(host, "web"));
		changes = 0;
		await settle();
		await userEvent.keyboard("{Escape}");
		await settle();

		expect(row(host, "api").checked).toBe(false);
		expect(row(host, "web").checked).toBe(false);
		expect(changes).toBe(2);
		expect(parts(host).bar.dataset.state).toBe("idle");
		expect(heard).toBe(0);

		await userEvent.keyboard("{Escape}");
		expect(heard).toBe(1);
	});

	test("clears from the ✕ button and returns focus to the rows", async () => {
		let host = mount();
		await userEvent.click(row(host, "web"));
		await settle();

		await userEvent.click(host.querySelector<HTMLButtonElement>('[data-slot="selection-clear"]')!);

		expect(row(host, "web").checked).toBe(false);
		expect(document.activeElement).toBe(row(host, "api"));
	});

	test("runs an action on its key, posting the checked ids with its intent", async () => {
		let host = mount();
		let sent: { action: string; body: URLSearchParams }[] = [];
		host.querySelector("form")!.addEventListener("submit", (event) => {
			event.preventDefault();
			let submitter = (event as SubmitEvent).submitter as HTMLButtonElement;
			let body = new FormData(event.target as HTMLFormElement, submitter);
			sent.push({
				action: submitter.formMethod,
				body: new URLSearchParams(body as unknown as string[][]),
			});
		});

		await userEvent.keyboard("x");
		expect(sent).toHaveLength(0);

		await userEvent.click(row(host, "api"));
		await userEvent.click(row(host, "db"));
		await settle();
		await userEvent.keyboard("x");

		expect(sent).toHaveLength(1);
		expect(sent[0]?.action).toBe("post");
		expect(sent[0]?.body.getAll("id")).toEqual(["api", "db"]);
		expect(sent[0]?.body.get("intent")).toBe("delete");

		host.querySelector<HTMLInputElement>('input[type="search"]')!.focus();
		await userEvent.keyboard("p");
		expect(sent).toHaveLength(1);
	});

	test("never scrolls the page sideways at 320 while selecting", async () => {
		await page.viewport(320, 700);
		let host = mount(288);
		await userEvent.click(row(host, "api"));
		await settle();

		let box = parts(host).bar.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});
});
