// @vitest-environment happy-dom

/**
 * The search dialog hydrated in a real document: a page rendered through the app's own
 * renderer, its dialog frame resolved through the router the way the Worker resolves it,
 * then the two islands brought up by the client runtime, typed into, and dismissed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";
import { createRouter } from "remix/router";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { WIDE_SCREEN } from "~/resources/components/nav-pill";
import {
	SEARCH_DEBOUNCE_MS,
	SEARCH_RESULTS_ID,
	SPINNER_DELAY_MS,
} from "~/resources/components/search-box";
import { searchShortcut } from "~/resources/components/search-keys";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import { BlogLayout } from "~/resources/layouts/blog";
import { SEARCH_DIALOG_INPUT_ID, SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

import { htmlRenderer } from "../../bootstrap/app";

/** The modules the runtime is asked for while the page hydrates, by the chunk the manifest names. */
const CLIENT_MODULES: Record<string, () => Promise<unknown>> = {
	"/assets/resources/components/search-box.js": () => import("~/resources/components/search-box"),
};

/** One request the runtime sent for frame content, with the signal it was sent under. */
interface FrameRequest {
	src: string;
	target: string | undefined;
	signal: AbortSignal | undefined;
}

/** The client runtime the current test hydrated, disposed after it so no listener outlives it. */
let runtime: ReturnType<typeof run> | undefined;

/** Every frame request the runtime made, oldest first. */
let requests: Array<FrameRequest> = [];

/** Queries whose answer waits until the test releases it, keyed by the query text. */
let held = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();

/** One match linking to `href`, titled after it. */
function match(href: string, title: string): SearchViewModel.Item {
	return {
		href,
		kind: "article",
		kindLabel: "Article",
		title: [
			{ text: title, match: true },
			{ text: " notes", match: false },
		],
		excerpt: null,
		publishedAt: null,
	};
}

/**
 * The dialog model for a query, titled after the text so a test can tell answers apart: ten
 * matches for text starting with `ten`, one for anything else.
 */
function suggestionsFor(query: string): SearchViewModel.Suggestions {
	if (query === "") return { state: "blank", query: "" };
	let items = query.startsWith("ten")
		? Array.from({ length: 10 }, (_, index) => match(`/articles/ten-${index + 1}`, query))
		: [match(`/articles/${query}`, query)];
	return { state: "results", query, total: 9, items, seeAll: `/search?q=${query}` };
}

/** A page wearing the blog layout, with the dialog's frame served by the same router. */
function application() {
	let router = createRouter({ middleware: htmlRenderer() });

	router.get("/", (ctx) =>
		ctx.render(
			() => () => (
				<BlogLayout title="Home" description="Home">
					<main id="page">Page</main>
				</BlogLayout>
			),
			null,
		),
	);

	router.get(routes.search.href(), (ctx) =>
		ctx.render(
			() => () => (
				<BlogLayout
					title="Search"
					description="Search"
					searchQuery={ctx.url.searchParams.get("q") ?? ""}
				>
					<main id="page">Results</main>
				</BlogLayout>
			),
			null,
		),
	);

	router.get(routes.searchFrame.href(), async (ctx) => {
		let query = ctx.url.searchParams.get("q") ?? "";
		await held.get(query)?.promise;
		return ctx.render(SearchFrameView, suggestionsFor(query));
	});

	return router;
}

/** Renders the page the way the Worker answers it and loads its body into this document. */
async function loadPage(router: ReturnType<typeof application>, path = "/"): Promise<void> {
	let html = await (await router.fetch(new Request(new URL(path, "https://blog.test")))).text();
	let body = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
	document.body.innerHTML = body
		.slice(body.indexOf(">") + 1)
		.replace(/<script type="module"[^>]*><\/script>/, "");
}

/** Brings the page's islands up, resolving frames through the router as the browser would over the network. */
async function hydrate(router: ReturnType<typeof application>): Promise<void> {
	runtime = run({
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

/** Clicks `target` the way a pointer does: pressed and released on it. */
function click(target: Element): void {
	target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** The links a click would have navigated to, captured before the document navigates. */
let followed: Array<string> = [];

/**
 * Records a link click the page left to the browser, and keeps the document where it is.
 * Listening on `window` runs it after every listener on the document, as navigation would.
 */
function captureLinks(event: MouseEvent): void {
	let link = event.target instanceof Element ? event.target.closest("a[href]") : null;
	if (link === null || event.defaultPrevented) return;
	event.preventDefault();
	followed.push(link.getAttribute("href") ?? "");
}

/** Makes the screen match {@link WIDE_SCREEN}, or not, for the rest of the test. */
function screen(wide: boolean): void {
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) =>
			({
				matches: wide && query === WIDE_SCREEN,
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}) as unknown as MediaQueryList,
	);
}

/** The navigation's search trigger. */
function trigger(): HTMLAnchorElement {
	let link = document.querySelector("a[data-search-trigger]");
	if (!(link instanceof HTMLAnchorElement)) throw new Error("The page has no search trigger");
	return link;
}

/** Clicks `target` with the given mouse details, answering whether the page claimed it. */
function clickWith(target: Element, init: MouseEventInit = {}): boolean {
	let event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
	target.dispatchEvent(event);
	return event.defaultPrevented;
}

/** Presses a key `times` times in the box, as a person holding focus there would. */
function pressInBox(key: string, times = 1): Array<boolean> {
	return Array.from({ length: times }, () => press(input(), { key }));
}

/** The row `aria-activedescendant` names, by the link it holds, or `null` for none. */
function chosen(): string | null {
	let id = input().getAttribute("aria-activedescendant");
	if (id === null) return null;
	return document.getElementById(id)?.querySelector("a")?.getAttribute("href") ?? null;
}

/** The links of the rows marked `aria-selected="true"`. */
function selectedRows(): Array<string> {
	return Array.from(document.querySelectorAll('[role="option"][aria-selected="true"] a')).map(
		(link) => link.getAttribute("href") ?? "",
	);
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

beforeEach(() => {
	followed = [];
	window.addEventListener("click", captureLinks);
});

afterEach(() => {
	window.removeEventListener("click", captureLinks);
	vi.mocked(window.matchMedia).mockRestore?.();
	runtime?.dispose();
	runtime = undefined;
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
		expect(dialog?.getAttribute("aria-label")).toBe("Search");
		expect(input().getAttribute("aria-label")).toBe("Search articles, tutorials and the glossary");
		expect(form?.getAttribute("method")).toBe("get");
		expect(form?.getAttribute("action")).toBe(routes.search.href());
		expect(input().name).toBe("q");
		expect(trigger().getAttribute("href")).toBe(routes.search.href());
		expect(trigger().getAttribute("aria-label")).toBe("Search");
		expect(document.getElementById("rmx-data")?.textContent).not.toContain("SearchTrigger");
	});

	test("opens from a plain click on the trigger on a wide screen, in place of /search", async () => {
		screen(true);
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		expect(clickWith(trigger())).toBe(true);
		expect(dialog.open).toBe(true);
		expect(followed).toEqual([]);
	});

	test("leaves the trigger a link to /search on a narrow screen", async () => {
		screen(false);
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		clickWith(trigger());
		expect(dialog.open).toBe(false);
		expect(followed).toEqual(["/search"]);

		press(document.body, { key: "k", metaKey: true });
		expect(dialog.open).toBe(true);
	});

	test("leaves a modified or middle click on the trigger to the browser", async () => {
		screen(true);
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		clickWith(trigger(), { metaKey: true });
		clickWith(trigger(), { button: 1 });
		expect(dialog.open).toBe(false);
		expect(followed).toEqual(["/search", "/search"]);
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

	test("returns to the bare frame, with nothing under the box, when the box is cleared", async () => {
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
		await vi.waitFor(() => expect(status()).toBe(""));
		expect(document.querySelector(`#${SEARCH_RESULTS_ID} ol`)).toBeNull();
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

	test("closes on Escape while the box still holds text", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		dialog.showModal();
		type("remix");

		expect(press(input(), { key: "Escape" })).toBe(true);
		expect(dialog.open).toBe(false);
	});

	test("reopens blank, with no results and nothing still on its way", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		dialog.showModal();
		type("remix");
		await settle();
		await vi.waitFor(() => expect(status()).toBe("Top 1 of 9 results"));

		type("slow");
		dialog.close();
		await settle();

		dialog.showModal();
		expect(input().value).toBe("");
		await vi.waitFor(() => expect(status()).toBe(""));
		expect(document.querySelector(`#${SEARCH_RESULTS_ID} ol`)).toBeNull();
		expect(requests.map((request) => request.src)).toEqual([
			"/frames/search?q=remix",
			"/frames/search",
		]);
	});

	test("reopens on the search page's own query, whatever was typed and abandoned", async () => {
		let router = application();
		await loadPage(router, "/search?q=remix");
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		dialog.showModal();
		type("other");
		await settle();
		dialog.close();
		await settle();

		expect(input().value).toBe("remix");
		await vi.waitFor(() =>
			expect(
				document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/articles/remix"]`),
			).not.toBeNull(),
		);
	});

	test("closes on a click on the backdrop, and stays open for a click inside the panel", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let dialog = document.getElementById(SEARCH_DIALOG_ID) as HTMLDialogElement;
		dialog.showModal();

		click(input());
		expect(dialog.open).toBe(true);

		click(dialog);
		expect(dialog.open).toBe(false);
	});

	test("marks the results busy from the keystroke until they land, and spins only when slow", async () => {
		let router = application();
		await loadPage(router);
		await hydrate(router);

		let slow = Promise.withResolvers<void>();
		held.set("slow", slow);
		let results = () => document.getElementById(SEARCH_RESULTS_ID);
		let spinner = () => document.querySelector(`#${SEARCH_DIALOG_ID} [role="progressbar"]`);

		type("slow");
		expect(results()?.getAttribute("aria-busy")).toBe("true");
		expect(spinner()).toBeNull();

		await new Promise((resolve) => setTimeout(resolve, SPINNER_DELAY_MS + 50));
		expect(spinner()).not.toBeNull();

		slow.resolve();
		await vi.waitFor(() => expect(status()).toBe("Top 1 of 9 results"));
		await vi.waitFor(() => expect(results()?.hasAttribute("aria-busy")).toBe(false));
		expect(spinner()).toBeNull();
	});

	test("opens holding the search page's own query, its results already there", async () => {
		await loadPage(application(), "/search?q=remix");

		expect(input().value).toBe("remix");
		expect(status()).toBe("Top 1 of 9 results");
		expect(document.querySelector(`#${SEARCH_DIALOG_ID} a[href="/articles/remix"]`)).not.toBeNull();
	});
});

describe("the search dialog's keyboard", () => {
	/** Hydrates a page and types `text`, waiting for its results to land. */
	async function searchFor(text: string): Promise<void> {
		let router = application();
		await loadPage(router);
		await hydrate(router);
		type(text);
		await settle();
		await vi.waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("true"));
	}

	test("is a combobox over the result rows, the See all link outside them", async () => {
		await searchFor("ten");

		let listbox = document.getElementById(input().getAttribute("aria-controls") ?? "");
		expect(input().getAttribute("role")).toBe("combobox");
		expect(listbox?.getAttribute("role")).toBe("listbox");
		expect(listbox?.querySelectorAll('[role="option"]')).toHaveLength(10);
		expect(listbox?.querySelector('a[href="/search?q=ten"]')).toBeNull();
	});

	test("Enter follows the only result when nothing is chosen", async () => {
		await searchFor("remix");

		expect(pressInBox("Enter")).toEqual([true]);
		expect(followed).toEqual(["/articles/remix"]);
	});

	test("Enter submits to /search when several results show and none is chosen", async () => {
		await searchFor("ten");

		expect(pressInBox("Enter")).toEqual([false]);
		expect(followed).toEqual([]);
	});

	test("ArrowDown three times then Enter follows the third result", async () => {
		await searchFor("ten");

		pressInBox("ArrowDown", 3);
		await vi.waitFor(() => expect(chosen()).toBe("/articles/ten-3"));
		expect(selectedRows()).toEqual(["/articles/ten-3"]);
		expect(document.activeElement).toBe(input());

		pressInBox("Enter");
		expect(followed).toEqual(["/articles/ten-3"]);
	});

	test("ArrowDown past the last result wraps to the first, never reaching See all", async () => {
		await searchFor("ten");

		pressInBox("ArrowDown", 10);
		await vi.waitFor(() => expect(chosen()).toBe("/articles/ten-10"));

		pressInBox("ArrowDown");
		await vi.waitFor(() => expect(chosen()).toBe("/articles/ten-1"));
		expect(selectedRows()).toEqual(["/articles/ten-1"]);
	});

	test("ArrowUp on the first result returns to the box, and does nothing from the box", async () => {
		await searchFor("ten");

		expect(pressInBox("ArrowUp")).toEqual([false]);
		expect(chosen()).toBeNull();

		pressInBox("ArrowDown");
		await vi.waitFor(() => expect(chosen()).toBe("/articles/ten-1"));

		expect(pressInBox("ArrowUp")).toEqual([true]);
		await vi.waitFor(() => expect(chosen()).toBeNull());
		expect(selectedRows()).toEqual([]);
	});

	test("typing after choosing a row keeps typing into the box, and the new results clear the choice", async () => {
		await searchFor("ten");

		pressInBox("ArrowDown", 5);
		await vi.waitFor(() => expect(chosen()).toBe("/articles/ten-5"));

		type(`${input().value} react router`);
		expect(input().value).toBe("ten react router");
		expect(input().selectionStart).toBe("ten react router".length);

		await settle();
		await vi.waitFor(() => expect(requests.at(-1)?.src).toBe("/frames/search?q=ten+react+router"));
		await vi.waitFor(() => expect(chosen()).toBeNull());
		expect(selectedRows()).toEqual([]);
	});
});

describe("searchShortcut", () => {
	test("reads ⌘K and Ctrl+K as a toggle, and nothing else held with K", () => {
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "k", metaKey: true }), false)).toBe(
			"toggle",
		);
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }), false)).toBe(
			"toggle",
		);
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "k" }), false)).toBeNull();
		expect(
			searchShortcut(
				new KeyboardEvent("keydown", { key: "k", metaKey: true, shiftKey: true }),
				false,
			),
		).toBeNull();
		expect(
			searchShortcut(
				new KeyboardEvent("keydown", { key: "k", metaKey: true, repeat: true }),
				false,
			),
		).toBeNull();
	});

	test("reads Escape as close only while the dialog is open", () => {
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "Escape" }), true)).toBe("close");
		expect(searchShortcut(new KeyboardEvent("keydown", { key: "Escape" }), false)).toBeNull();
	});

	test("reads / as open only away from editable elements", () => {
		let editable = document.createElement("div");
		editable.setAttribute("contenteditable", "");
		document.body.appendChild(editable);

		let fromEditable = new KeyboardEvent("keydown", { key: "/", bubbles: true });
		editable.dispatchEvent(fromEditable);

		let fromPage = new KeyboardEvent("keydown", { key: "/", bubbles: true });
		document.body.dispatchEvent(fromPage);

		expect(searchShortcut(fromEditable, false)).toBeNull();
		expect(searchShortcut(fromPage, false)).toBe("open");
		expect(searchShortcut(fromPage, true)).toBeNull();
		expect(
			searchShortcut(new KeyboardEvent("keydown", { key: "/", metaKey: true }), false),
		).toBeNull();
	});
});
