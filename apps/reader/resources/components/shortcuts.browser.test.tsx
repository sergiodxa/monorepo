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

import { Sidebar } from "@sdxc/ui";
import { shortcutRegistry } from "@sdxc/ui/app";
import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Shortcuts } from "~/resources/components/shortcuts";
import type { Timeline } from "~/resources/views/timeline";

import ShortcutsIsland, {
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

/** The copy the keys and their sheet print, in the shape the chrome hands the island. */
const SHORTCUTS_COPY: Shortcuts.Copy = {
	open: "Keyboard shortcuts",
	description: "Press a key while reading.",
	close: "Close",
	or: "or",
	noUnread: "No unread posts below",
	groups: { reading: "Reading", feeds: "Feeds", general: "General", other: "More" },
	keys: {
		nextPost: "Next post",
		previousPost: "Previous post",
		nextUnread: "Next unread post",
		openPost: "Open the post",
		markRead: "Mark as read or unread",
		savePost: "Save the post",
		checkFeeds: "Check every feed",
		nextFeed: "Next feed",
		previousFeed: "Previous feed",
		search: "Search your posts",
		goTo: "Go to a feed or folder",
		help: "Show these shortcuts",
	},
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

/**
 * One page of the list, exactly as a controller renders it.
 *
 * @param ids - The posts on the page, in order.
 * @param read - The posts among them already read.
 */
async function page(ids: string[], read: string[] = []): Promise<string> {
	return await html(
		(
			<TimelineView
				entries={ids.map((id) => entry(id, { isRead: read.includes(id) }))}
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
		</div>
	);
}

/** The island as the worker sends it, with the copy the chrome hands it. */
async function island(): Promise<string> {
	return await html(
		(
			<ShortcutsIsland
				copy={SHORTCUTS_COPY}
				searchFieldId={SIDEBAR_SEARCH_FIELD_ID}
				sidebarId={SIDEBAR_ID}
			/>
		) as never,
	);
}

/**
 * What the open sheet shows: each group's heading, and each row's label beside the caps
 * of its keys run together.
 */
function sheet(): { title: string; rows: [string, string][] }[] {
	let panel = document.querySelector<HTMLDialogElement>(`dialog#${SHORTCUTS_PANEL_ID}`)!;
	return Array.from(panel.querySelectorAll('[data-slot="keyboard-help-group"]'), (group) => ({
		title: group.querySelector("h3")?.textContent ?? "",
		rows: Array.from(group.querySelectorAll('[data-slot="shortcut"]'), (row) => [
			row.querySelector("dt")?.textContent ?? "",
			Array.from(row.querySelectorAll("kbd"), (cap) => cap.textContent).join(""),
		]),
	}));
}

/** Every module the runtime is asked to load while these pages hydrate. */
const CLIENT_MODULES: Record<string, () => Promise<unknown>> = {
	"/@sdxc/ui/app/optimistic-toggle": () => import("@sdxc/ui/app/optimistic-toggle"),
	"/resources/components/post-rows.tsx": () => import("~/resources/components/post-rows"),
	"/@sdxc/lazy-frame/ui": () => import("@sdxc/lazy-frame/ui"),
	"/resources/components/shortcuts.tsx": () => import("~/resources/components/shortcuts"),
};

/** The runtime the last {@link hydrate} started, disposed after each test with its islands. */
let runtime: ReturnType<typeof run> | null = null;

/** Brings the page's own islands up, so a row's marks behave as they do in a browser. */
async function hydrate(): Promise<void> {
	runtime = run({
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
	announced = [];
	bindings = new AbortController();

	watchKeys(
		{
			searchFieldId: SIDEBAR_SEARCH_FIELD_ID,
			sidebarId: SIDEBAR_ID,
			copy: SHORTCUTS_COPY,
			announce: (text) => announced.push(text),
		},
		bindings.signal,
	);

	watchRowMarks((text) => announced.push(text), bindings.signal);
});

afterEach(() => {
	runtime?.dispose();
	runtime = null;
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

	test("a refused `m` puts the mark back and the row's mark says it failed", async () => {
		worker.use(http.post("*/items/a/read", () => new HttpResponse(null, { status: 500 })));

		document.body.innerHTML = await page(["a"]);
		await hydrate();

		rows()[0]!.focus();
		await press("m");

		/** The mark's own live region says so, which is what a screen reader hears. */
		await vi.waitFor(() => {
			let form = rows()[0]!.querySelector('form[action$="/read"]')!;
			expect(form.querySelector('[role="status"]')?.textContent).toBe(COPY.markFailed);
			expect(form.querySelector("button")?.getAttribute("aria-pressed")).toBe("false");
		});

		expect(rows()[0]!.hasAttribute("data-read")).toBe(false);
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

	test("`?` opens the generated sheet, and the row that was current still is once it closes", async () => {
		document.body.innerHTML = (await page(["a"])) + (await island());
		await hydrate();

		let panel = document.querySelector<HTMLDialogElement>(`dialog#${SHORTCUTS_PANEL_ID}`)!;

		let row = rows()[0]!;
		row.focus();

		await press("?");

		expect(panel.open).toBe(true);

		await press("{Escape}");

		expect(panel.open).toBe(false);
		expect(current()).toBe(row);
	});
});

describe("what the live region hears", () => {
	test("marks hydrating over the worker's rows say nothing, so a key's outcome is heard at once", async () => {
		document.body.innerHTML = await page(["a", "b", "c"], ["b"]);
		await hydrate();

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(announced).toEqual([]);

		rows()[2]!.focus();
		await press("n");

		expect(announced).toEqual([SHORTCUTS_COPY.noUnread]);
	});
});

describe("`n`, the next unread post", () => {
	test("skips read rows below the current one and focuses the first unread", async () => {
		document.body.innerHTML = await page(["a", "b", "c", "d"], ["b", "c"]);
		await hydrate();

		rows()[0]!.focus();
		await press("n");

		expect(current()).toBe(rows()[3]);
	});

	test("passes over the current row even while it is unread", async () => {
		document.body.innerHTML = await page(["a", "b"]);
		await hydrate();

		rows()[0]!.focus();
		await press("n");

		expect(current()).toBe(rows()[1]);
	});

	test("counts a row marked read a moment ago as read", async () => {
		document.body.innerHTML = await page(["a", "b", "c"]);
		await hydrate();

		rows()[1]!.focus();
		await press("m");

		await vi.waitFor(() => {
			let mark = rows()[1]!.querySelector('form[action$="/read"] button')!;
			expect(mark.getAttribute("aria-label")).toBe(COPY.markUnread);
		});

		rows()[0]!.focus();
		await press("n");

		expect(current()).toBe(rows()[2]);
	});

	test("with nothing focused, starts from the first row at or below the top of the viewport", async () => {
		document.body.innerHTML = await page(["a", "b", "c", "d"], ["c"]);
		placeRows([-200, -80, 30, 300]);

		await press("n");

		expect(current()).toBe(rows()[3]);
	});

	test("with no unread post below, stays on the row and says so", async () => {
		document.body.innerHTML = await page(["a", "b"], ["b"]);

		let row = rows()[0]!;
		row.focus();

		await press("n");

		expect(current()).toBe(row);
		expect(announced).toEqual([SHORTCUTS_COPY.noUnread]);
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
	test("renders nothing on the server, and a button carrying the key that opens the sheet once it runs", async () => {
		document.body.innerHTML = await island();

		/** The worker sends the host and nothing in it: with no script, nothing here applies. */
		expect(document.querySelector("button")).toBeNull();
		expect(document.querySelector("dialog")).toBeNull();

		await hydrate();

		let button = document.querySelector<HTMLButtonElement>(
			`button[commandfor="${SHORTCUTS_PANEL_ID}"]`,
		);
		expect(button?.getAttribute("aria-label")).toBe(SHORTCUTS_COPY.open);
		expect(button?.getAttribute("command")).toBe("show-modal");
		expect(button?.querySelector("kbd")?.textContent).toBe("?");

		expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
	});

	test("the sheet lists every key the island registered, under its group, read from the registry", async () => {
		document.body.innerHTML = await island();
		await hydrate();

		await press("?");

		let { groups, keys } = SHORTCUTS_COPY;
		expect(sheet()).toEqual([
			{
				title: groups.reading,
				rows: [
					[keys.nextPost, "J"],
					[keys.previousPost, "K"],
					[keys.nextUnread, "N"],
					[keys.openPost, "O"],
					[keys.markRead, "M"],
					[keys.savePost, "S"],
				],
			},
			{
				title: groups.feeds,
				rows: [
					[keys.nextFeed, "⇧J"],
					[keys.previousFeed, "⇧K"],
					[keys.checkFeeds, "R"],
				],
			},
			{
				title: groups.general,
				rows: [
					[keys.goTo, expect.stringMatching(/^(⌘|Ctrl)K$/)],
					[keys.search, "/"],
					[keys.help, "?"],
				],
			},
		]);
	});

	test("a key registered after the sheet is drawn joins it, and the palette's ⌘K lists once", async () => {
		document.body.innerHTML = await island();
		await hydrate();

		let later = new AbortController();
		let registry = shortcutRegistry(document);
		registry.register({
			keys: "mod+k",
			label: SHORTCUTS_COPY.keys.goTo,
			run: () => true,
			signal: later.signal,
		});
		registry.register({ keys: "g s", label: "Go to Saved", run: () => true, signal: later.signal });

		await press("?");

		let listed = sheet().flatMap((group) => group.rows.map(([label]) => label));
		expect(listed.filter((label) => label === SHORTCUTS_COPY.keys.goTo)).toHaveLength(1);
		expect(sheet().at(-1)).toEqual({
			title: SHORTCUTS_COPY.groups.other,
			rows: [["Go to Saved", "GS"]],
		});

		later.abort();
	});

	test("the island binds no ⌘K of its own, leaving the key to the palette", async () => {
		document.body.innerHTML = (await page(["a"])) + (await island());
		await hydrate();

		let row = rows()[0]!;
		row.focus();

		let event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
		row.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(current()).toBe(row);
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

describe("what a row does beyond its marks", () => {
	test("following an unread post's title marks it read through its own mark", async () => {
		let posted = vi.fn();
		worker.use(
			http.post("*/items/a/read", async ({ request }) => {
				posted((await request.formData()).get("read"));
				return new HttpResponse(null, { status: 204 });
			}),
		);

		document.body.innerHTML = await page(["a"]);
		await hydrate();

		/** The test stays on this page rather than opening the publisher. */
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		rows()[0]!.querySelector<HTMLAnchorElement>("a[data-post-title]")!.click();

		await vi.waitFor(() => expect(rows()[0]!.hasAttribute("data-read")).toBe(true));
		await vi.waitFor(() => expect(posted).toHaveBeenCalledWith("true"));
		expect(rows()[0]!.querySelector("a[data-post-title]")!.hasAttribute("ping")).toBe(false);
	});

	test("a save refused for want of room says the shelf is full", async () => {
		worker.use(http.post("*/items/a/save", () => new HttpResponse(null, { status: 409 })));

		document.body.innerHTML = await page(["a"]);
		await hydrate();

		rows()[0]!.querySelector<HTMLButtonElement>('form[action$="/save"] button')!.click();

		await vi.waitFor(() => {
			let status = rows()[0]!.querySelector('form[action$="/save"] [role="status"]');
			expect(status?.textContent).toBe(COPY.saveFull);
		});
	});
});
