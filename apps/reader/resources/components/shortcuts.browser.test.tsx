/**
 * The keys a reader works their queue with, exercised against a real document: the rows
 * the worker sends, the marks hydrated on top of them, and the chrome the rail's own
 * bindings reach into.
 *
 * What is asserted here is the selection model. A page arriving below the rows, a page
 * arriving above them and a row taken away are all answered by asking the document again,
 * so each of those is a test rather than an argument, and every binding presses a control
 * the worker already rendered rather than issuing a request of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { Mock } from "vitest";

import { Sidebar } from "@sdxc/ui";
import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Timeline } from "~/resources/views/timeline";

import ShortcutsIsland, {
	pressShortcutsButton,
	SHORTCUTS_PANEL_ID,
	watchKeys,
	watchRowMarks,
} from "~/resources/components/shortcuts";
import SHORTCUTS_SOURCE from "~/resources/components/shortcuts.tsx?raw";
import { SIDEBAR_ID, SIDEBAR_SEARCH_FIELD_ID } from "~/resources/layouts/app";
import TimelineView from "~/resources/views/timeline";

/**
 * The document shell reads the request's context, which exists only inside the worker. The
 * rows and chrome rendered here never draw it, so it is replaced by a shell that renders
 * nothing and the rest of the layout module keeps its real exports.
 */
vi.mock("~/resources/layouts/document", () => ({ default: () => () => null }));

/** Where the header's sweep posts, which `r` presses the form of. */
const REFRESH_ALL_ACTION = "/feeds/refresh";

/** The copy a list prints, which none of these assertions turn on beyond the two marks. */
const COPY: Timeline.Copy = {
	markRead: "Mark as read",
	markUnread: "Mark as unread",
	read: "Read",
	markFailed: "Could not be marked — try again",
	save: "Save",
	unsave: "Remove from saved",
	saveFailed: "Could not be saved — try again",
	saveFull: "Your saved posts are full",
	saved: "Saved",
	flagged: "Flagged",
	readHere: "Read here",
	newer: "Newer posts",
	older: "Older posts",
	end: "That is everything",
};

/** One post, with whichever of its states the assertion is about. */
function entry(id: string, overrides: Partial<Timeline.Entry> = {}): Timeline.Entry {
	return {
		id,
		title: `Post ${id}`,
		url: `https://example.com/${id}`,
		ping: `/items/${id}/open`,
		readHref: `/reading/x/${id}`,
		source: "Daring Fireball",
		summary: null,
		time: "2h",
		timeLabel: "2 January 2026",
		dateTime: "2026-01-02T12:00:00.000Z",
		isRead: false,
		isSaved: false,
		isFlagged: false,
		...overrides,
	};
}

/** Renders a component the way the worker sends it, as the markup a browser receives. */
async function html(node: ReturnType<typeof TimelineView>): Promise<string> {
	return await new Response(renderToStream(node as never)).text();
}

/** One page of the list, exactly as a controller renders it. */
async function page(ids: string[]): Promise<string> {
	return await html(
		(
			<TimelineView
				entries={ids.map((id) => entry(id))}
				copy={COPY}
				returnTo="/reading"
				cursors={{ next: null, prev: null }}
			/>
		) as never,
	);
}

/**
 * The pieces of the chrome the rail's own bindings reach into, drawn from the same
 * components and the same `id`s the layout draws them from, so a selector that stops
 * matching the app stops matching here too.
 */
function Chrome(handle: Handle<{ current: string }>) {
	return () => (
		<div>
			<aside id={SIDEBAR_ID}>
				<input id={SIDEBAR_SEARCH_FIELD_ID} type="search" name="q" />

				<Sidebar.Nav aria-label="Sections">
					<Sidebar.Item href="/reading" current={handle.props.current === "/reading"}>
						Reading
					</Sidebar.Item>
					<Sidebar.Item href="/reading/one" current={handle.props.current === "/reading/one"}>
						One
					</Sidebar.Item>
					<Sidebar.Item href="/reading/two" current={handle.props.current === "/reading/two"}>
						Two
					</Sidebar.Item>
				</Sidebar.Nav>
			</aside>

			<header>
				<form method="post" action={REFRESH_ALL_ACTION}>
					<button type="submit">Check every feed</button>
				</form>
			</header>

			<button type="button" commandfor={SHORTCUTS_PANEL_ID} command="show-modal">
				Keyboard shortcuts
			</button>
			<dialog id={SHORTCUTS_PANEL_ID}>Shortcuts</dialog>
		</div>
	);
}

/** Every module the runtime is asked to load while these pages hydrate. */
const CLIENT_MODULES: Record<string, () => Promise<unknown>> = {
	"/resources/components/read-toggle.tsx": () => import("~/resources/components/read-toggle"),
	"/resources/components/save-toggle.tsx": () => import("~/resources/components/save-toggle"),
	"/@sdxc/lazy-frame/ui": () => import("@sdxc/lazy-frame/ui"),
	"/resources/components/shortcuts.tsx": () => import("~/resources/components/shortcuts"),
};

/** Brings the page's own islands up, so a row's marks behave as they do in a browser. */
async function hydrate(): Promise<void> {
	let runtime = run({
		async loadModule(moduleUrl, exportName) {
			let load = CLIENT_MODULES[new URL(moduleUrl, "http://localhost").pathname];
			if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);
			return Reflect.get((await load()) as object, exportName) as never;
		},
	});

	await runtime.ready();
}

/** Every row on the page, in the order a reader reads them. */
function rows(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>("li[data-post]"));
}

/** The row holding focus, which is the whole of what the current post is. */
function current(): HTMLElement | null {
	let active = document.activeElement;
	return active instanceof Element ? active.closest<HTMLElement>("li[data-post]") : null;
}

/**
 * Places each row on an imaginary screen, so the assertions about a keystroke pressed with
 * nothing focused can say where the reader is looking whatever size the test's viewport is.
 *
 * @param tops - The top edge of each row, in the order the rows appear.
 */
function placeRows(tops: number[]): void {
	rows().forEach((row, index) => {
		let top = tops[index] ?? 0;
		row.getBoundingClientRect = () => ({ top, bottom: top + 40 }) as DOMRect;
	});
}

/**
 * Presses a key on the browser's own keyboard, so the event lands wherever focus really is
 * and carries the modifiers the reader is holding.
 *
 * @param key - The character the key produces.
 * @param modifier - A key held down for the length of the press.
 */
async function press(key: string, modifier?: "Control" | "Alt" | "Meta"): Promise<void> {
	await userEvent.keyboard(modifier ? `{${modifier}>}${key}{/${modifier}}` : key);
}

/** What the panel's own button was told, so an assertion can say it was pressed. */
let openedPanel: Mock<() => void>;

/** What the live region was told, so an assertion can say what a reader heard. */
let announced: string[];

let bindings: AbortController;

let worker = setupWorker(
	http.post("*/items/:itemId/read", () => new HttpResponse(null, { status: 204 })),
	http.post("*/items/:itemId/save", () => new HttpResponse(null, { status: 204 })),
);

beforeAll(async () => {
	await worker.start({ onUnhandledRequest: "error", quiet: true });
});

afterAll(() => worker.stop());

beforeEach(() => {
	openedPanel = vi.fn();
	announced = [];
	bindings = new AbortController();

	watchKeys(
		{
			searchFieldId: SIDEBAR_SEARCH_FIELD_ID,
			sidebarId: SIDEBAR_ID,
			openPanel: () => {
				openedPanel();
				pressShortcutsButton();
			},
			announce: (text) => announced.push(text),
		},
		bindings.signal,
	);

	watchRowMarks((text) => announced.push(text), bindings.signal);
});

afterEach(() => {
	bindings.abort();
	worker.resetHandlers();
	document.body.innerHTML = "";
});

describe("the keys a queue is worked with", () => {
	test("`j` moves focus down the rows of one page, and `k` back up it", async () => {
		document.body.innerHTML = await page(["a", "b", "c"]);

		rows()[0]!.focus();

		await press("j");
		expect(current()).toBe(rows()[1]);

		await press("j");
		expect(current()).toBe(rows()[2]);

		await press("k");
		expect(current()).toBe(rows()[1]);
	});

	test("`j` on the last row crosses into the first row of a page appended below", async () => {
		document.body.innerHTML = await page(["a", "b"]);

		rows()[1]!.focus();
		document.body.insertAdjacentHTML("beforeend", await page(["c", "d"]));

		await press("j");

		expect(rows()).toHaveLength(4);
		expect(current()).toBe(rows()[2]);
		expect(current()?.querySelector("h2")?.textContent).toContain("Post c");
	});

	test("a page landing above the rows leaves the focused row focused, and `k` walks into it", async () => {
		document.body.innerHTML = await page(["c", "d"]);

		let reading = rows()[0]!;
		reading.focus();

		document.body.insertAdjacentHTML("afterbegin", await page(["a", "b"]));

		expect(current()).toBe(reading);

		await press("k");

		expect(current()?.querySelector("h2")?.textContent).toContain("Post b");
	});

	test("with nothing focused, `j` takes the first row at or below the top of the viewport", async () => {
		document.body.innerHTML = await page(["a", "b", "c", "d"]);
		placeRows([-200, -80, 30, 300]);

		await press("j");

		expect(current()).toBe(rows()[2]);
	});

	test("a focused row taken away leaves `j` recovering to the viewport rather than to row one", async () => {
		document.body.innerHTML = await page(["a", "b", "c", "d"]);
		placeRows([-200, -80, 30, 300]);

		let removed = rows()[1]!;
		removed.focus();
		removed.remove();

		placeRows([-200, 30, 300]);

		await press("j");

		expect(current()).toBe(rows()[1]);
		expect(current()?.querySelector("h2")?.textContent).toContain("Post c");
	});

	test("`j` on the last row with no further page focuses nothing new and moves no scroll", async () => {
		document.body.innerHTML = await page(["a", "b"]);

		let last = rows()[1]!;
		last.focus();

		let scrolled = vi.spyOn(globalThis, "scrollBy").mockImplementation(() => undefined);
		let focused = vi.spyOn(HTMLElement.prototype, "focus");

		await press("j");

		expect(current()).toBe(last);
		expect(focused).not.toHaveBeenCalled();
		expect(scrolled).not.toHaveBeenCalled();

		focused.mockRestore();
		scrolled.mockRestore();
	});
});

describe("the controls a key presses", () => {
	test("`m` submits the focused row's read form, flipping the mark before the request resolves", async () => {
		let held = Promise.withResolvers<Response>();
		worker.use(http.post("*/items/a/read", () => held.promise));

		document.body.innerHTML = await page(["a"]);
		await hydrate();

		rows()[0]!.focus();
		await press("m");

		await Promise.resolve();

		let mark = rows()[0]!.querySelector('form[action$="/read"] button')!;
		expect(mark.getAttribute("aria-label")).toBe(COPY.markUnread);

		held.resolve(new HttpResponse(null, { status: 204 }));
	});

	test("a refused `m` puts the mark back and the row wears the failure label", async () => {
		worker.use(http.post("*/items/a/read", () => new HttpResponse(null, { status: 500 })));

		document.body.innerHTML = await page(["a"]);
		await hydrate();

		rows()[0]!.focus();
		await press("m");

		await vi.waitFor(() => {
			let mark = rows()[0]!.querySelector('form[action$="/read"] button')!;
			expect(mark.getAttribute("aria-label")).toBe(COPY.markFailed);
		});

		expect(announced).toContain(COPY.markFailed);
	});

	test("`s` submits the focused row's save form rather than its read one", async () => {
		document.body.innerHTML = await page(["a"]);
		await hydrate();

		rows()[0]!.focus();
		await press("s");

		await vi.waitFor(() => {
			let mark = rows()[0]!.querySelector('form[action$="/save"] button')!;
			expect(mark.getAttribute("aria-label")).toBe(COPY.unsave);
		});

		let read = rows()[0]!.querySelector('form[action$="/read"] button')!;
		expect(read.getAttribute("aria-label")).toBe(COPY.markRead);
	});

	test("`o` follows the focused row's title, and marks the post read the way a click does", async () => {
		document.body.innerHTML = await page(["a"]);
		await hydrate();

		let title = rows()[0]!.querySelector<HTMLAnchorElement>("a[data-post-title]")!;
		let followed = vi.fn();
		title.addEventListener("click", (event) => {
			event.preventDefault();
			followed();
		});

		rows()[0]!.focus();
		await press("o");

		expect(followed).toHaveBeenCalledOnce();

		await vi.waitFor(() => {
			let mark = rows()[0]!.querySelector('form[action$="/read"] button')!;
			expect(mark.getAttribute("aria-label")).toBe(COPY.markUnread);
		});
	});

	test("`o` on a row whose post has no address does nothing and does not move focus", async () => {
		document.body.innerHTML = await html(
			(
				<TimelineView
					entries={[entry("a", { url: null, ping: null, readHref: null })]}
					copy={COPY}
					returnTo="/reading"
					cursors={{ next: null, prev: null }}
				/>
			) as never,
		);
		await hydrate();

		let row = rows()[0]!;
		row.focus();

		expect(row.querySelector("a[data-post-title]")).toBeNull();

		await press("o");

		expect(current()).toBe(row);
	});

	test("`r` submits the header's check-every-feed form", async () => {
		document.body.innerHTML =
			(await page(["a"])) + (await html((<Chrome current="/reading" />) as never));

		let sweep = document.querySelector<HTMLFormElement>(`form[action="${REFRESH_ALL_ACTION}"]`)!;
		let submitted = vi.spyOn(sweep, "requestSubmit").mockImplementation(() => undefined);

		rows()[0]!.focus();
		await press("r");

		expect(submitted).toHaveBeenCalledOnce();
	});

	test("`J` and `K` walk the sidebar's own links from the one marked as the page being read", async () => {
		document.body.innerHTML = await html((<Chrome current="/reading/one" />) as never);

		let links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(`#${SIDEBAR_ID} nav[data-slot="nav"] a[href]`),
		);
		let clicked: string[] = [];
		for (let link of links) {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				clicked.push(link.getAttribute("href") ?? "");
			});
		}

		await press("J");
		await press("K");

		expect(clicked).toEqual(["/reading/two", "/reading"]);
	});

	test("`/` puts the caret in the sidebar's search box", async () => {
		document.body.innerHTML = await html((<Chrome current="/reading" />) as never);

		await press("/");

		expect(document.activeElement?.id).toBe(SIDEBAR_SEARCH_FIELD_ID);
	});

	test("`?` presses the panel's own button, and the row that was current still is", async () => {
		document.body.innerHTML =
			(await page(["a"])) + (await html((<Chrome current="/reading" />) as never));

		let panel = document.querySelector<HTMLDialogElement>(`dialog#${SHORTCUTS_PANEL_ID}`)!;

		let row = rows()[0]!;
		row.focus();

		await press("?");

		expect(openedPanel).toHaveBeenCalledOnce();
		expect(panel.open).toBe(true);

		panel.close();

		expect(current()).toBe(row);
	});
});

describe("when the bindings stand down", () => {
	test("no binding fires while the target is the sidebar's search box or a field of its own", async () => {
		document.body.innerHTML =
			(await page(["a", "b"])) +
			(await html((<Chrome current="/reading" />) as never)) +
			`<form><input type="url" name="feed" id="follow-field" /></form>`;

		let row = rows()[0]!;
		row.focus();

		for (let id of [SIDEBAR_SEARCH_FIELD_ID, "follow-field"]) {
			let field = document.getElementById(id)!;
			field.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
			field.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));
		}

		expect(current()).toBe(row);
	});

	test("no binding fires with Control, Alt or Meta held, or mid-composition", async () => {
		document.body.innerHTML = await page(["a", "b"]);

		let row = rows()[0]!;
		row.focus();

		await press("j", "Control");
		await press("j", "Alt");
		await press("j", "Meta");

		let composing = new KeyboardEvent("keydown", { key: "j", bubbles: true });
		Object.defineProperty(composing, "isComposing", { value: true });
		row.dispatchEvent(composing);

		expect(current()).toBe(row);

		await press("j");
		expect(current()).toBe(rows()[1]);
	});

	test("Shift is read as the character it produced rather than as a modifier", async () => {
		document.body.innerHTML = await page(["a", "b"]);

		let row = rows()[0]!;
		row.focus();

		await press("J");

		expect(current()).toBe(row);

		await press("j");
		expect(current()).toBe(rows()[1]);
	});
});

describe("the way a reader finds out the keys exist", () => {
	test("renders nothing on the server, and a button carrying the key that opens the panel once it runs", async () => {
		let copy = {
			open: "Keyboard shortcuts",
			description: "Press a key while reading.",
			close: "Close",
			keys: {
				nextPost: "Next post",
				previousPost: "Previous post",
				openPost: "Open the post",
				markRead: "Mark as read or unread",
				savePost: "Save the post",
				checkFeeds: "Check every feed",
				nextFeed: "Next feed",
				previousFeed: "Previous feed",
				search: "Search your posts",
				help: "Show these shortcuts",
			},
		};

		let markup = await html(
			(
				<ShortcutsIsland
					copy={copy}
					searchFieldId={SIDEBAR_SEARCH_FIELD_ID}
					sidebarId={SIDEBAR_ID}
				/>
			) as never,
		);

		document.body.innerHTML = markup;

		/** The worker sends the host and nothing in it: with no script, nothing here applies. */
		expect(document.querySelector("button")).toBeNull();
		expect(document.querySelector("dialog")).toBeNull();

		await hydrate();

		let button = document.querySelector<HTMLButtonElement>(
			`button[commandfor="${SHORTCUTS_PANEL_ID}"]`,
		);
		expect(button?.getAttribute("aria-label")).toBe(copy.open);
		expect(button?.getAttribute("command")).toBe("show-modal");
		expect(button?.querySelector("kbd")?.textContent).toBe("?");

		let panel = document.querySelector<HTMLDialogElement>(`dialog#${SHORTCUTS_PANEL_ID}`);
		expect(panel?.textContent).toContain(copy.keys.nextPost);
		expect(panel?.textContent).toContain(copy.keys.help);

		expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
	});
});

describe("what a binding is allowed to reach for", () => {
	test("every binding resolves its control from the document, naming no frame", async () => {
		let source = SHORTCUTS_SOURCE;

		/**
		 * A frame resolved by name falls back to the whole page when the name is not mounted
		 * and says nothing about having done so, which turns a typo or a race into a full
		 * navigation. No binding is exposed to that, because none of them resolves one.
		 */
		expect(source).not.toMatch(/getNamedFrame|frames\s*\.\s*get|handle\s*\.\s*navigate/);
	});
});
