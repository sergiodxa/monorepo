// @vitest-environment happy-dom

/**
 * The search dialog hydrated in a real document: a page rendered through the app's own
 * renderer, its dialog frame resolved through the router the way the Worker resolves it,
 * then the two islands brought up by the client runtime and typed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";
import { createRouter } from "remix/router";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { SEARCH_DEBOUNCE_MS } from "~/resources/components/search-input";
import { SEARCH_DIALOG_ID, searchShortcut } from "~/resources/components/search-trigger";
import { BlogLayout } from "~/resources/layouts/blog";
import { SEARCH_DIALOG_INPUT_ID, SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

import { createHtmlRenderer } from "../../bootstrap/app";

/** The modules the runtime is asked for while the page hydrates. */
const CLIENT_MODULES: Record<string, () => Promise<unknown>> = {
	"/resources/components/search-trigger.tsx": () => import("~/resources/components/search-trigger"),
	"/resources/components/search-input.tsx": () => import("~/resources/components/search-input"),
};

/** One request the runtime sent for frame content, with the signal it was sent under. */
interface FrameRequest {
	src: string;
	target: string | undefined;
	signal: AbortSignal | undefined;
}

/** Every frame request the runtime made, oldest first. */
let requests: Array<FrameRequest> = [];

/** Queries whose answer waits until the test releases it, keyed by the query text. */
let held = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();

/** The dialog model for a query: one match titled after the text, so a test can tell answers apart. */
function suggestionsFor(query: string): SearchViewModel.Suggestions {
	if (query === "") return { state: "blank", query: "" };
	return {
		state: "results",
		query,
		total: 9,
		items: [
			{
				href: `/articles/${query}`,
				kind: "Article",
				title: [
					{ text: query, match: true },
					{ text: " notes", match: false },
				],
				excerpt: null,
				publishedAt: null,
			},
		],
		seeAll: `/search?q=${query}`,
	};
}

/** A page wearing the blog layout, with the dialog's frame served by the same router. */
function application() {
	let router = createRouter();

	router.get("/", (ctx) =>
		createHtmlRenderer(ctx)(
			() => () => (
				<BlogLayout title="Home" description="Home">
					<main id="page">Page</main>
				</BlogLayout>
			),
			null,
		),
	);

	router.get(routes.searchFrame.href(), async (ctx) => {
		let query = ctx.url.searchParams.get("q") ?? "";
		await held.get(query)?.promise;
		return createHtmlRenderer(ctx)(SearchFrameView, suggestionsFor(query));
	});

	return router;
}

/** Renders the page the way the Worker answers it and loads its body into this document. */
async function loadPage(router: ReturnType<typeof application>): Promise<void> {
	let html = await (await router.fetch(new Request("https://blog.test/"))).text();
	let body = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
	document.body.innerHTML = body
		.slice(body.indexOf(">") + 1)
		.replace(/<script type="module"[^>]*><\/script>/, "");
}

/** Brings the page's islands up, resolving frames through the router as the browser would over the network. */
async function hydrate(router: ReturnType<typeof application>): Promise<void> {
	let runtime = run({
		async loadModule(moduleUrl, exportName) {
			let load = CLIENT_MODULES[new URL(moduleUrl, "https://blog.test").pathname];
			if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);
			return Reflect.get((await load()) as object, exportName) as never;
		},
		async resolveFrame(src, options) {
			requests.push({ src, target: options?.target, signal: options?.signal });
			let headers = new Headers({ accept: "text/html" });
			if (options?.target) headers.set("x-remix-target", options.target);
			return await router.fetch(
				new Request(new URL(src, "https://blog.test"), { headers, signal: options?.signal }),
			);
		},
	});

	await runtime.ready();
}

/** The dialog's search box as the document holds it now. */
function input(): HTMLInputElement {
	let element = document.getElementById(SEARCH_DIALOG_INPUT_ID);
	if (!(element instanceof HTMLInputElement)) throw new Error("The dialog has no search box");
	return element;
}

/** The dialog's live status line. */
function status(): string {
	return document.querySelector(`#${SEARCH_DIALOG_ID} [role="status"]`)?.textContent ?? "";
}

/** Types `text` into the box as a browser would, leaving the caret at its end. */
function type(text: string): void {
	let box = input();
	box.focus();
	box.value = text;
	box.setSelectionRange(text.length, text.length);
	box.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Sends a keystroke from `target` the way a browser does.
 *
 * @returns Whether the page claimed it, which is what keeps the key out of the field.
 */
function press(target: EventTarget, init: KeyboardEventInit): boolean {
	let event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event.defaultPrevented;
}

/** Waits out the debounce, and a moment more for the reload it started to land. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
}

beforeAll(() => {
	/**
	 * This document's stylesheet parser rejects the cascade layer every mixin writes its rule
	 * inside, and a rejected rule takes down the island being drawn with it. Nothing asserted
	 * here reads a style, so the rules are accepted and dropped and the markup is drawn.
	 */
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
});

afterEach(() => {
	requests = [];
	held.clear();
	document.body.innerHTML = "";
});

describe("the search dialog", () => {
	test("is on the page before any script runs, holding a GET form to /search", async () => {
		await loadPage(application());

		let dialog = document.getElementById(SEARCH_DIALOG_ID);
		let form = input().form;

		expect(dialog?.tagName).toBe("DIALOG");
		expect(
			document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")?.textContent,
		).toBe("Search the blog");
		expect(form?.getAttribute("method")).toBe("get");
		expect(form?.getAttribute("action")).toBe(routes.search.href());
		expect(input().name).toBe("q");
		expect(
			document.querySelector(`button[commandfor="${SEARCH_DIALOG_ID}"][command="show-modal"]`),
		).not.toBeNull();
	});

	test("loads the results for what was typed into its own frame, keeping the box as it is", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let box = input();
		let page = document.getElementById("page");
		type("remix");
		await settle();

		expect(requests).toEqual([
			{ src: "/frames/search?q=remix", target: "search", signal: expect.any(AbortSignal) },
		]);
		await vi.waitFor(() => expect(status()).toBe("Top 1 of 9 results"));
		expect(
			document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/articles/remix"] mark`)?.textContent,
		).toBe("remix");
		expect(
			document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/search?q=remix"]`)?.textContent,
		).toBe("See all 9 results →");
		expect(input()).toBe(box);
		expect(document.activeElement).toBe(box);
		expect(box.value).toBe("remix");
		expect(box.selectionStart).toBe(5);
		expect(document.getElementById("page")).toBe(page);
	});

	test("waits for typing to pause before asking for results", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		type("r");
		type("re");
		type("rem");
		await settle();

		expect(requests.map((request) => request.src)).toEqual(["/frames/search?q=rem"]);
	});

	test("drops an answer that is still on its way once newer text is asked for", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let slow = Promise.withResolvers<void>();
		held.set("slow", slow);

		type("slow");
		await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
		type("fast");
		await settle();
		await vi.waitFor(() => expect(status()).toBe("Top 1 of 9 results"));

		slow.resolve();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(requests.map((request) => request.src)).toEqual([
			"/frames/search?q=slow",
			"/frames/search?q=fast",
		]);
		expect(requests[0]?.signal?.aborted).toBe(true);
		expect(document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/articles/fast"]`)).not.toBeNull();
		expect(document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/articles/slow"]`)).toBeNull();
		expect(input().value).toBe("fast");
	});

	test("returns to the bare frame and its hint when the box is cleared", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		type("remix");
		await settle();
		type("   ");
		await settle();

		expect(requests.map((request) => request.src)).toEqual([
			"/frames/search?q=remix",
			"/frames/search",
		]);
		await vi.waitFor(() => expect(status()).toContain("Quote a phrase"));
	});

	test("opens on ⌘K or Ctrl+K from anywhere, and the same keys close it", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		press(document.body, { key: "k", metaKey: true });
		expect(dialog.open).toBe(true);

		press(input(), { key: "k", ctrlKey: true });
		expect(dialog.open).toBe(false);
	});

	test("opens on / outside a field, and leaves a / typed into a field alone", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		let field = document.createElement("textarea");
		document.body.appendChild(field);

		expect(press(field, { key: "/" })).toBe(false);
		expect(dialog.open).toBe(false);

		expect(press(document.body, { key: "/" })).toBe(true);
		expect(dialog.open).toBe(true);
	});
});

describe("searchShortcut", () => {
	test("reads ⌘K and Ctrl+K as a toggle, and nothing else held with K", () => {
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "k", metaKey: true }))).toBe(
			"toggle",
		);
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }))).toBe(
			"toggle",
		);
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "k" }))).toBeNull();
		expect(
			searchShortcut(new KeyboardEvent("keydown", { key: "k", metaKey: true, shiftKey: true })),
		).toBeNull();
		expect(
			searchShortcut(new KeyboardEvent("keydown", { key: "k", metaKey: true, repeat: true })),
		).toBeNull();
	});

	test("reads / as open only away from editable elements", () => {
		let editable = document.createElement("div");
		editable.setAttribute("contenteditable", "");
		document.body.appendChild(editable);

		let fromEditable = new KeyboardEvent("keydown", { key: "/", bubbles: true });
		editable.dispatchEvent(fromEditable);

		let fromPage = new KeyboardEvent("keydown", { key: "/", bubbles: true });
		document.body.dispatchEvent(fromPage);

		expect(searchShortcut(fromEditable)).toBeNull();
		expect(searchShortcut(fromPage)).toBe("open");
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "/", metaKey: true }))).toBeNull();
	});
});
