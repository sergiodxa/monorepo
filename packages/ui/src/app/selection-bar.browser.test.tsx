/**
 * Drives the selection bar in a real browser against a form of checkable rows: the morph from
 * pagination to bulk actions, the count kept while the bar fades out, Escape clearing the
 * selection before anything else hears it, action keys submitting, and the announcements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { AppRuntime, Handle } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { Frame, run } from "remix/component";
import { renderToStream, renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { SelectionBar, SelectionBarController } from "./selection-bar.js";
import { Table, TableSelection } from "./table.js";

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

/** The rows the server renders on its next answer, read when the frame resolves. */
let served: string[] = [];

/** The runtime hydrating the frame of the re-render tests. */
let app: AppRuntime | undefined;

/** A server-rendered page of posts: a table with selection, its bulk form and the bar. */
function Posts(handle: Handle<{ rows: string[] }>) {
	return () => (
		<div>
			<form id="posts-bulk" method="post" action="/posts/bulk" />
			<div id="posts">
				<Table aria-label="Posts">
					<Table.Header>
						<Table.Row>
							<Table.SelectAll label="Select all posts" />
							<Table.Column>Title</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{handle.props.rows.map((id) => (
							<Table.Row>
								<Table.Select name="post" value={id} form="posts-bulk" label={`Select ${id}`} />
								<Table.Cell>{id}</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</div>
			<SelectionBar
				target="posts"
				form="posts-bulk"
				actions={ACTIONS}
				locale="en-US"
				labels={LABELS}
			/>
		</div>
	);
}

/** Server-renders the posts in a named frame and hydrates it, as a page load would. */
async function serve(rows: string[]): Promise<HTMLElement> {
	served = rows;
	let host = document.createElement("div");
	host.innerHTML = await new Response(
		renderToStream(<Frame name="posts" src="/posts" />, {
			resolveFrame: () => renderToString(<Posts rows={served} />),
		}),
	).text();
	document.body.appendChild(host);
	app = run({
		loadModule: (_url, name) =>
			({ TableSelection, SelectionBarController })[name as "TableSelection"],
		resolveFrame: () => renderToString(<Posts rows={served} />),
	});
	await app.ready();
	return host;
}

/** Re-renders the frame from the server's `rows`, patching the live page in place. */
async function rerender(rows: string[]): Promise<void> {
	served = rows;
	await app?.frames.get("posts")?.reload();
	await settle();
}

/** Which rows are checked, by the record each one holds. */
function checked(host: HTMLElement): string[] {
	return [...host.querySelectorAll<HTMLInputElement>("[data-selection-item]:checked")].map(
		(item) => item.value,
	);
}

describe("SelectionBar after a server re-render", () => {
	afterEach(() => {
		app?.dispose();
		app = undefined;
	});

	test("clears the rows a bulk action submitted once the page re-renders", async () => {
		let host = await serve(["api", "web", "db"]);
		row(host, "api").click();
		row(host, "web").click();
		await settle();
		let form = host.querySelector<HTMLFormElement>("#posts-bulk")!;
		form.addEventListener("submit", (event) => event.preventDefault());
		form.requestSubmit(host.querySelector<HTMLButtonElement>('button[value="pause"]'));

		await rerender(["api", "web", "db"]);

		expect(checked(host)).toEqual([]);
		expect(host.querySelector('tr[aria-selected="true"]')).toBeNull();
		expect(parts(host).bar.dataset.state).toBe("idle");
		expect(host.querySelector<HTMLInputElement>("[data-selection-all]")!.indeterminate).toBe(false);
	});

	test("keeps the checked records across a refresh that moves them to other rows", async () => {
		let host = await serve(["api", "web", "db"]);
		row(host, "web").click();
		await settle();

		await rerender(["new", "api", "web", "db"]);

		expect(checked(host)).toEqual(["web"]);
		expect(row(host, "web").closest("tr")?.getAttribute("aria-selected")).toBe("true");
		expect(row(host, "api").closest("tr")?.hasAttribute("aria-selected")).toBe(false);
		expect(parts(host).bar.dataset.state).toBe("selecting");
		expect(parts(host).count.textContent).toBe("1 selected");
		expect(parts(host).selection.inert).toBe(false);
	});

	test("stays on the selection through a refresh that changes nothing", async () => {
		let host = await serve(["api", "web", "db"]);
		row(host, "api").click();
		await settle();

		await rerender(["api", "web", "db"]);

		expect(checked(host)).toEqual(["api"]);
		expect(row(host, "api").closest("tr")?.getAttribute("aria-selected")).toBe("true");
		expect(parts(host).bar.dataset.state).toBe("selecting");
		expect(parts(host).count.textContent).toBe("1 selected");
		expect(parts(host).pagination.inert).toBe(true);
	});

	test("keeps a bar over plain checkboxes in step with a refresh", async () => {
		mounted = render(
			<div>
				<form id="monitors">
					{["api", "web"].map((id) => (
						<input type="checkbox" data-selection-item name="id" value={id} />
					))}
				</form>
				<SelectionBar target="monitors" locale="en-US" labels={LABELS} />
			</div>,
		);
		let host = mounted.container;
		row(host, "web").click();
		await settle();

		let form = host.querySelector("form")!;
		form.replaceChildren(
			...["new", "api", "web"].map((id) =>
				Object.assign(document.createElement("input"), { type: "checkbox", name: "id", value: id }),
			),
		);
		for (let item of form.children) item.setAttribute("data-selection-item", "");
		parts(host).bar.dataset.state = "idle";
		await settle();

		expect(checked(host)).toEqual(["web"]);
		expect(parts(host).bar.dataset.state).toBe("selecting");
	});

	test("drops a checked record the re-render no longer lists", async () => {
		let host = await serve(["api", "web", "db"]);
		row(host, "db").click();
		await settle();

		await rerender(["api", "web", "queue"]);

		expect(checked(host)).toEqual([]);
		expect(parts(host).bar.dataset.state).toBe("idle");
	});
});
