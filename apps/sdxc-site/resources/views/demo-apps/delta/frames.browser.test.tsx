/**
 * Holds Delta to working like an app over its real source: the shell and the file tree stay
 * mounted while `main` swaps, the tree follows the open file and keeps its folders open, Back
 * and Forward restore the address, the screen and its scroll, line links cite without adding
 * history, and no screen scrolls sideways on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import { afterAll, beforeAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { readHistory, readTree } from "~/app/services/delta/source";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import delta from "~/resources/views/demo-apps/delta";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Every page Delta draws lives under this path. */
const ROOT = "/demo/apps/delta";

/** Wraps a node in Delta's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(delta.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/** The named frames a mounted screen holds, reached through a probe rendered beside it. */
let frames: Handle["frames"] | undefined;

/** Every frame a mounted screen asked for, by name, in order. */
let requested: string[] = [];

/** Renders nothing and keeps the root's frame handles for the test to reload. */
function FrameProbe(handle: Handle) {
	frames = handle.frames;
	return () => null;
}

/** The page path of an address under Delta, with its query. */
function pageOf(url: URL): string {
	return url.pathname.replace(new RegExp(`^${ROOT}/?`), "");
}

/** The visitor's cookies as the mounted screen's posts set them, name to `name=value`. */
let jar = new Map<string, string>();

/** The `Cookie` header the jar sends. */
function jarHeader(): string | null {
	return jar.size === 0 ? null : [...jar.values()].join("; ");
}

/** Every post a mounted screen sent through a frame, as the page path it posted to. */
let posted: string[] = [];

/**
 * Resolves Delta's named frames as the page route does: a post goes through the app's own
 * `submit`, keeps the cookies it sets, and the frame draws the page its redirect names. Any
 * other frame stays pending.
 */
async function resolveDeltaFrame(
	src: string,
	options?: { target?: string; method?: string; formData?: FormData },
) {
	let target = options?.target;
	if (target === undefined || delta.target === undefined) return new Promise<never>(() => {});
	requested.push(target);
	let url = new URL(src, location.origin);
	if (options?.method?.toLowerCase() === "post" && options.formData) {
		posted.push(pageOf(url));
		let answer = await delta.submit(pageOf(url), options.formData, {
			page: pageOf(url),
			url,
			cookie: jarHeader(),
		});
		if (answer && "body" in answer && answer.frames?.[target] !== undefined) {
			return answer.frames[target];
		}
		if (answer && !("body" in answer)) {
			for (let header of answer.cookies ?? []) {
				let pair = header.split(";")[0] ?? "";
				let name = pair.split("=")[0] ?? "";
				if (/Max-Age=0/.test(header)) jar.delete(name);
				else jar.set(name, pair);
			}
			url = new URL(`${ROOT}/${answer.page}`, location.origin);
			if (answer.toast !== undefined) url.searchParams.set("toast", `${answer.toast}.test`);
		}
	}
	let node = await delta.target(target, { page: pageOf(url), url, cookie: jarHeader() });
	return node ?? new Promise<never>(() => {});
}

/**
 * Mounts one of Delta's screens with `main` answered, as on first paint, at its own address,
 * so the islands read the address a visitor would have.
 *
 * @param screen A page path with its query and hash, as `delta.screens` lists it.
 */
async function mountScreen(screen: string): Promise<HTMLElement> {
	let start = location.href;
	onTestFinished(() => history.replaceState(null, "", start));
	let url = new URL(`${ROOT}/${screen}`, location.origin);
	history.replaceState(null, "", url);
	let rendered = await delta.render({ page: pageOf(url), url, cookie: null });
	requested = [];
	posted = [];
	jar = new Map();
	let mounted = render(
		<>
			{themed(rendered.body)}
			<FrameProbe />
		</>,
		{ frameInit: { resolveFrame: resolveDeltaFrame } },
	);
	onTestFinished(() => mounted.cleanup());
	await settle(() => mounted.container.querySelector("[data-main-screen]") !== null);
	return mounted.container;
}

/** Waits for a condition the page reaches after frames land, failing after a few seconds. */
async function settle(ready: () => boolean = () => true): Promise<void> {
	for (let pass = 0; pass < 200; pass++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		if (ready()) break;
	}
	await new Promise((resolve) => setTimeout(resolve, 30));
}

/**
 * Stands in for the browser runtime's navigation, which a mounted test has no `run()` for:
 * every same-document navigation under Delta reloads `main` at its destination, the way a
 * targeted link does on the page. Back and Forward go through it too.
 */
function interceptNavigations(): void {
	let controller = new AbortController();
	onTestFinished(() => controller.abort());
	navigation.addEventListener(
		"navigate",
		(event) => {
			let url = new URL(event.destination.url);
			if (!url.pathname.startsWith(ROOT) || !event.canIntercept || event.hashChange) return;
			event.intercept({
				focusReset: "manual",
				scroll: "manual",
				async handler() {
					await frames?.get("main")?.reload({ src: `${url.pathname}${url.search}` });
				},
			});
		},
		{ signal: controller.signal },
	);
}

/** The heading of the screen in `main`. */
function heading(root: HTMLElement): string {
	return root.querySelector("[data-main-screen] h1")?.textContent ?? "";
}

/** The panel `main` scrolls in. */
function scroller(root: HTMLElement): HTMLElement {
	return root.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
}

let tree = await readTree();

/** A file in a folder and a file at the root, which every test opens. */
let nested = tree.files.find((file) => file.path.includes("/"))!;
let topLevel = tree.files.find((file) => !file.path.includes("/") && file.path.endsWith(".tsx"))!;

afterAll(async () => {
	await page.viewport(414, 896);
});

describe("Delta works like an app once its script runs", () => {
	test("moving between screens swaps only main, keeping the sidebar, top bar and tree", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta");
		let sidebar = root.querySelector("#delta-sidebar");
		let topbar = root.querySelector('[data-slot="app-shell-topbar"]');
		let files = root.querySelector("#delta-tree");
		sidebar?.setAttribute("data-marker", "kept");

		for (let path of [
			`delta/blob/main/${topLevel.path}`,
			"delta/commits/main",
			"delta/find/main?q=sh",
			"",
			"delta",
		]) {
			await frames!.get("main")!.reload({ src: `${ROOT}/${path}` });
			await settle();
			expect(root.querySelector("#delta-sidebar"), path).toBe(sidebar);
			expect(root.querySelector("#delta-sidebar")?.getAttribute("data-marker"), path).toBe("kept");
			expect(root.querySelector('[data-slot="app-shell-topbar"]'), path).toBe(topbar);
			expect(root.querySelector("#delta-tree"), path).toBe(files);
			expect(root.querySelectorAll("[data-main-screen]"), path).toHaveLength(1);
		}
		expect(requested.every((name) => name === "main")).toBe(true);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("the file pane shows beside code and steps aside for every other screen", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen(`delta/blob/main/${topLevel.path}`);
		let pane = root.querySelector<HTMLElement>("#delta-files")!;

		expect(getComputedStyle(pane).display).not.toBe("none");
		await frames!.get("main")!.reload({ src: `${ROOT}/delta/commits/main` });
		await settle(() => heading(root) === "Commits");
		expect(getComputedStyle(pane).display).toBe("none");
	});

	test("the tree keeps its open folders and follows the open file across swaps", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen(`delta/blob/main/${nested.path}`);
		let folder = root.querySelector<HTMLDetailsElement>("#delta-tree details")!;
		let leaf = (path: string) =>
			root.querySelector<HTMLElement>(`#delta-tree a[data-delta-leaf="${path}"]`)!;

		expect(folder.open).toBe(true);
		expect(leaf(nested.path).getAttribute("aria-current")).toBe("page");

		await frames!.get("main")!.reload({ src: `${ROOT}/delta/blob/main/${topLevel.path}` });
		await settle(() => leaf(topLevel.path).getAttribute("aria-current") === "page");

		expect(root.querySelector("#delta-tree details")).toBe(folder);
		expect(folder.open).toBe(true);
		expect(leaf(topLevel.path).getAttribute("aria-current")).toBe("page");
		expect(leaf(nested.path).hasAttribute("aria-current")).toBe(false);
	});

	test("one entry per file opened, and Back and Forward restore the address, screen and scroll", async () => {
		await page.viewport(1280, 600);
		let root = await mountScreen(`delta/blob/main/${topLevel.path}`);
		interceptNavigations();
		let entries = navigation.entries().length;
		let name = (path: string) => path.split("/").at(-1);

		scroller(root).scrollTop = 400;
		await settle();
		root
			.querySelector<HTMLAnchorElement>(`#delta-tree a[data-delta-leaf="${nested.path}"]`)!
			.click();
		await settle(() => heading(root) === name(nested.path));

		expect(location.pathname).toBe(`${ROOT}/delta/blob/main/${nested.path}`);
		expect(navigation.entries().length).toBe(entries + 1);
		expect(scroller(root).scrollTop).toBe(0);

		await navigation.back().finished;
		await settle(() => heading(root) === name(topLevel.path));
		await settle(() => scroller(root).scrollTop === 400);

		expect(location.pathname).toBe(`${ROOT}/delta/blob/main/${topLevel.path}`);
		expect(heading(root)).toBe(name(topLevel.path));
		expect(scroller(root).scrollTop).toBe(400);

		await navigation.forward().finished;
		await settle(() => heading(root) === name(nested.path));
		expect(location.pathname).toBe(`${ROOT}/delta/blob/main/${nested.path}`);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});

describe("Delta's line links", () => {
	test("a `?L=` range is painted on the first render", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen(`delta/blob/main/${topLevel.path}?L=3-5`);
		let view = root.querySelector<HTMLElement>('[data-slot="code-view"]')!;

		expect(view.getAttribute("data-selection")).toBe("3-5");
		await settle(() => view.querySelector("tr[data-selected]") !== null);
		let painted = [...view.querySelectorAll("tr[data-selected]")].map((row) =>
			row.querySelector("a[data-line-number]")?.getAttribute("data-line-number"),
		);
		expect(painted).toEqual(["3", "4", "5"]);
	});

	test("a click and a shift-click cite a range in the address without adding history", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen(`delta/blob/main/${topLevel.path}`);
		let view = root.querySelector<HTMLElement>('[data-slot="code-view"]')!;
		await settle(() => view.hasAttribute("data-selection-live"));
		let entries = navigation.entries().length;
		let length = history.length;
		let number = (line: number) => view.querySelector<HTMLAnchorElement>(`#L${line}`)!;

		number(10).click();
		expect(location.hash).toBe("#L10");
		number(14).dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }),
		);
		expect(location.hash).toBe("#L10-L14");

		expect(view.querySelectorAll("tr[data-selected]")).toHaveLength(5);
		expect(navigation.entries().length).toBe(entries);
		expect(history.length).toBe(length);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});

describe("Delta on a phone", () => {
	test.each(delta.screens)("screen %j never scrolls sideways at 375px", async (screen) => {
		await page.viewport(375, 812);
		await mountScreen(screen);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("a commit's diffs, split or unified, never scroll the page sideways", async () => {
		await page.viewport(375, 812);
		let commit = (await readHistory()).commits[0];
		if (commit === undefined) return;

		for (let view of ["unified", "split"]) {
			let root = await mountScreen(`delta/commit/${commit.sha}?diff=${view}`);
			expect(root.querySelectorAll('[data-slot="diff-file"]').length, view).toBeGreaterThan(0);
			expect(document.documentElement.scrollWidth, view).toBeLessThanOrEqual(375);
		}
	});

	test("a file trades the tree for a parent link", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen(`delta/blob/main/${nested.path}`);

		expect(getComputedStyle(root.querySelector("#delta-files")!).display).toBe("none");
		let back = [...root.querySelectorAll<HTMLAnchorElement>("[data-main-screen] header a")].find(
			(link) => link.checkVisibility() && link.textContent?.includes("Files"),
		);
		expect(back).toBeDefined();
	});
});

/** Whether the log stream answers as the stream route does, or fails as a dropped one would. */
let streamFails = false;

/** Every background post a toggle sent, as the page path it posted to. */
let toggled: string[] = [];

/**
 * The server behind the page's own fetches: the running job's log as Delta's `stream` answers
 * it, a line at a time with its pauses (or a `503` while `streamFails` holds), and every
 * toggle's background post answered `204`, as the action route answers one.
 */
const WORKER = setupWorker(
	http.post(/\/demo\/apps\/delta\//, ({ request }) => {
		toggled.push(new URL(request.url).pathname.replace(/^\/demo\/apps\/delta\//, ""));
		return new HttpResponse(null, { status: 204 });
	}),
	http.get(/\/demo\/apps\/delta\/streams\//, ({ request }) => {
		let url = new URL(request.url);
		let part = url.pathname.replace(/^\/demo\/apps\/delta\/streams\//, "");
		let stream = streamFails ? null : delta.stream?.(part, { page: part, url, cookie: null });
		if (stream === null || stream === undefined) return new HttpResponse(null, { status: 503 });
		return new HttpResponse(stream.pipeThrough(new TextEncoderStream()), {
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}),
);

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterAll(() => {
	WORKER.stop();
});

describe("Delta's CI", () => {
	test("the runs list, a run and its job swap only main, and Back and Forward walk them again", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/actions");
		interceptNavigations();
		let sidebar = root.querySelector("#delta-sidebar");
		let entries = navigation.entries().length;

		root.querySelector<HTMLAnchorElement>('[data-run="812"] a')!.click();
		await settle(() => location.pathname.endsWith("/runs/812") && heading(root) !== "Actions");
		let title = heading(root);
		root.querySelector<HTMLAnchorElement>('[data-slot="delta-job-graph"] a[data-job="3"]')!.click();
		await settle(() => heading(root) === "Test (1/3)");

		expect(location.pathname).toBe(`${ROOT}/delta/actions/runs/812/job/3`);
		expect(navigation.entries().length).toBe(entries + 2);

		await navigation.back().finished;
		await settle(() => heading(root) === title);
		expect(location.pathname).toBe(`${ROOT}/delta/actions/runs/812`);
		await navigation.back().finished;
		await settle(() => heading(root) === "Actions");
		expect(location.pathname).toBe(`${ROOT}/delta/actions`);
		await navigation.forward().finished;
		await settle(() => heading(root) === title);

		expect(root.querySelector("#delta-sidebar")).toBe(sidebar);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("a failed job opens on its failed step", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/actions/runs/812/job/3");
		let steps = [...root.querySelectorAll<HTMLDetailsElement>("details[data-log-step]")];

		expect(steps.filter((step) => step.open).map((step) => step.dataset["state"])).toEqual([
			"failure",
		]);
	});

	test("a running job appends the lines its log streams and keeps the newest in view", async () => {
		streamFails = false;
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/actions/runs/815/job/4");
		let step = root.querySelector<HTMLElement>("[data-log-stream]")!;
		let body = root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]')!;
		let lines = () => step.querySelectorAll("[data-log-line]").length;
		let drawn = lines();

		await settle(() => lines() >= drawn + 4);

		expect(lines()).toBeGreaterThanOrEqual(drawn + 4);
		expect(body.scrollHeight - body.scrollTop - body.clientHeight).toBeLessThanOrEqual(24);
		expect(step.querySelector<HTMLElement>("[data-log-refresh]")!.hidden).toBe(true);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("a running job whose stream fails offers Refresh, as it does without script", async () => {
		streamFails = true;
		onTestFinished(() => {
			streamFails = false;
		});
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/actions/runs/815/job/4");
		let step = root.querySelector<HTMLElement>("[data-log-stream]")!;

		await settle(() => step.getAttribute("data-stream-end") === "failed");

		let refresh = step.querySelector<HTMLAnchorElement>("[data-log-refresh] a")!;
		expect(refresh.checkVisibility()).toBe(true);
		expect(new URL(refresh.href).pathname).toBe(`${ROOT}/delta/actions/runs/815/job/4`);
	});
});

describe("Delta's inbox", () => {
	/** A row of the inbox by its notification's id. */
	function row(root: HTMLElement, id: string): HTMLElement {
		return root.querySelector<HTMLElement>(`li[data-notification="${id}"]`)!;
	}

	/** The rows still shown in the view. */
	function shown(root: HTMLElement): string[] {
		return [...root.querySelectorAll<HTMLElement>("li[data-notification]")]
			.filter((item) => !item.hidden)
			.map((item) => item.dataset["notification"]!);
	}

	test("Done hides the row at once and posts in the background, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("notifications");
		let entries = navigation.entries().length;
		let address = location.href;
		toggled = [];

		row(root, "ci-812")
			.querySelector<HTMLButtonElement>('[data-inbox-action="done"] button[type=submit]')!
			.click();
		await settle(() => toggled.length > 0);

		expect(row(root, "ci-812").hidden).toBe(true);
		expect(toggled).toEqual(["notifications/ci-812"]);
		expect(location.href).toBe(address);
		expect(navigation.entries().length).toBe(entries);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("e marks the focused row done and keeps the keyboard on the next one", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("notifications");
		let [first, second] = shown(root);
		toggled = [];

		row(root, first!).querySelector<HTMLAnchorElement>("a[data-row-link]")!.focus();
		document.activeElement!.dispatchEvent(
			new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }),
		);
		await settle(() => toggled.length > 0);

		expect(row(root, first!).hidden).toBe(true);
		expect(document.activeElement?.closest("li[data-notification]")).toBe(row(root, second!));
	});

	test("marking the last row done says the inbox is all caught up", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("notifications");
		let cleared = root.querySelector<HTMLElement>("[data-inbox-cleared]")!;

		expect(cleared.checkVisibility()).toBe(false);
		for (let id of shown(root)) {
			row(root, id)
				.querySelector<HTMLButtonElement>('[data-inbox-action="done"] button[type=submit]')!
				.click();
		}
		await settle(() => cleared.checkVisibility());

		expect(shown(root)).toEqual([]);
		expect(cleared.checkVisibility()).toBe(true);
		expect(cleared.textContent).toContain("All caught up");
	});
});

describe("Delta's settings", () => {
	/** The settings the visitor's cookie holds now, as the next page reads them. */
	function savedSettings(): Record<string, unknown> {
		let value = /delta\.settings=([^;]+)/.exec(jarHeader() ?? "")?.[1];
		return value === undefined
			? {}
			: (JSON.parse(decodeURIComponent(value)) as Record<string, unknown>);
	}

	test("Save posts through main and redraws it in place, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/settings/branches");
		let address = location.href;
		let entries = navigation.entries().length;
		let length = history.length;
		let reviews = root.querySelector<HTMLSelectElement>('select[name="reviews"]')!;

		reviews.value = "3";
		reviews.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
		await settle(() => root.querySelector('select[name="reviews"]') !== reviews);

		expect(posted).toEqual(["delta/settings/branches"]);
		expect(savedSettings()["reviews"]).toBe(3);
		expect(root.querySelector('select[name="reviews"]')).not.toBeNull();
		expect(location.href).toBe(address);
		expect(navigation.entries().length).toBe(entries);
		expect(history.length).toBe(length);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("a feature switch saves the moment it flips, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/settings");
		let entries = navigation.entries().length;

		let wiki = root.querySelector<HTMLInputElement>('input[name="wiki"]')!;
		wiki.click();
		await settle(() => root.querySelector('input[name="wiki"]') !== wiki);

		expect(posted).toEqual(["delta/settings"]);
		expect(savedSettings()["wiki"]).toBe(true);
		expect(navigation.entries().length).toBe(entries);
	});

	test("a refused save keeps every character typed and says why, in place", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/settings");
		let name = root.querySelector<HTMLInputElement>('input[name="name"]')!;

		name.value = "my repo";
		name.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
		await settle(() => root.querySelector('input[name="name"][aria-invalid="true"]') !== null);

		expect(posted).toEqual(["delta/settings"]);
		expect(savedSettings()).toEqual({});
		expect(root.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("my repo");
		expect(root.textContent).toContain("without spaces");
	});
});

describe("Delta's issues list", () => {
	test("a tab swaps only main and moves the address, and Back restores the list", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues");
		interceptNavigations();
		let sidebar = root.querySelector("#delta-sidebar")!;
		let index = navigation.currentEntry!.index;
		let closed = [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="filter-bar"] a')].find(
			(link) => link.textContent?.startsWith("Closed"),
		)!;
		closed.click();
		await settle(() => root.querySelector('[data-issue="39"]') !== null);

		expect(new URL(location.href).searchParams.get("q")).toBe("is:closed");
		expect(navigation.currentEntry!.index).toBe(index + 1);
		expect(root.querySelector('[data-issue="54"]')).toBeNull();
		expect(root.querySelector("#delta-sidebar")).toBe(sidebar);

		await navigation.back().finished;
		await settle(() => root.querySelector('[data-issue="54"]') !== null);
		expect(root.querySelector('[data-issue="39"]')).toBeNull();
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("the bulk bar closes the checked issues in place, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues");
		let entries = navigation.entries().length;
		for (let number of ["54", "53"]) {
			root.querySelector<HTMLInputElement>(`input[name="ids"][value="${number}"]`)!.click();
		}
		await settle(
			() => root.querySelector('[data-slot="selection-bar"] button[value="close"]') !== null,
		);
		root
			.querySelector<HTMLButtonElement>('[data-slot="selection-bar"] button[value="close"]')!
			.click();
		await settle(() => root.querySelector('[data-issue="54"]') === null);

		expect(posted).toEqual(["delta/issues"]);
		expect(root.querySelector('[data-issue="53"]')).toBeNull();
		expect(navigation.entries().length).toBe(entries);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("each row links to its issue and posts its checkbox with the bulk form, without script", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues");
		let row = root.querySelector<HTMLElement>('[data-issue="54"]')!;
		let form = root.querySelector<HTMLFormElement>("#delta-issues-bulk")!;

		expect(row.querySelector<HTMLAnchorElement>("a[data-row-link]")!.pathname).toBe(
			`${ROOT}/delta/issues/54`,
		);
		expect(row.querySelector<HTMLInputElement>('input[name="ids"]')!.form).toBe(form);
		expect(form.method).toBe("post");
	});
});

describe("Delta's issue", () => {
	test("a comment posts through main and redraws in place, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues/42");
		let sidebar = root.querySelector("#delta-sidebar")!;
		sidebar.setAttribute("data-marker", "kept");
		let entries = navigation.entries().length;
		let path = location.pathname;
		let box = root.querySelector<HTMLTextAreaElement>("#delta-issue-comment")!;
		box.value = "Quoting by content keeps this honest.";
		root.querySelector<HTMLButtonElement>('button[name="intent"][value="comment"]')!.click();
		await settle(
			() => root.textContent?.includes("Quoting by content keeps this honest.") ?? false,
		);

		expect(posted).toEqual(["delta/issues/42"]);
		expect(location.pathname).toBe(path);
		expect(navigation.entries().length).toBe(entries);
		expect(root.querySelector("#delta-sidebar")?.getAttribute("data-marker")).toBe("kept");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("closing it redraws the state pill and adds a closed event in place", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues/53");
		let entries = navigation.entries().length;
		root.querySelector<HTMLButtonElement>('button[name="intent"][value="close"]')!.click();
		await settle(
			() => root.querySelector('[data-slot="delta-state-pill"][data-state="completed"]') !== null,
		);

		expect(root.querySelector('[data-slot="delta-state-pill"]')?.textContent).toContain("Closed");
		expect(root.textContent).toContain("closed this as completed");
		expect(navigation.entries().length).toBe(entries);
	});

	test("every form posts to the issue's own page, so it works without script", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/issues/42");
		let forms = [...root.querySelectorAll<HTMLFormElement>("[data-main-screen] form[method=post]")];

		expect(forms.length).toBeGreaterThan(3);
		for (let form of forms) {
			expect(new URL(form.action).pathname).toBe(`${ROOT}/delta/issues/42`);
		}
	});
});

describe("Delta's pull request", () => {
	test("merging posts through main and redraws it in place: the pill, a merged event and a toast", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57");
		let sidebar = root.querySelector("#delta-sidebar")!;
		let entries = navigation.entries().length;
		let path = location.pathname;
		root.querySelector<HTMLButtonElement>('#delta-merge button[type="submit"]')!.click();
		await settle(
			() => root.querySelector('[data-slot="delta-state-pill"][data-state="merged"]') !== null,
		);

		expect(posted).toEqual(["delta/pull/57"]);
		expect(root.querySelector("#merged")?.textContent).toContain("merged commit");
		expect(root.querySelector("template[data-main-toast]")?.getAttribute("data-toast")).toContain(
			"Pull request merged",
		);
		expect(location.pathname).toBe(path);
		expect(navigation.entries().length).toBe(entries);
		expect(root.querySelector("#delta-sidebar")).toBe(sidebar);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("merging counts one fewer open pull request on the repository's tab", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57");
		let tab = () =>
			[
				...root.querySelectorAll<HTMLAnchorElement>(
					'[data-main-screen] nav[aria-label="Repository"] a',
				),
			].find(
				(link) =>
					link.pathname === `${ROOT}/delta/pulls` && link.textContent?.includes("Pull requests"),
			);
		expect(tab()?.textContent).toContain("2");
		root.querySelector<HTMLButtonElement>('#delta-merge button[type="submit"]')!.click();
		await settle(
			() => root.querySelector('[data-slot="delta-state-pill"][data-state="merged"]') !== null,
		);

		expect(tab()?.textContent).toContain("1");
		expect(tab()?.textContent).not.toContain("2");
	});

	test("resolving a thread folds it in place, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57");
		let entries = navigation.entries().length;
		let thread = () => root.querySelector<HTMLElement>('[data-thread-id="t-57-large"]')!;
		thread()
			.querySelector<HTMLButtonElement>(
				'button[name="resolved"], form[action*="do=resolve"] button',
			)!
			.click();
		await settle(
			() => thread().textContent?.includes("marked this conversation as resolved") ?? false,
		);

		expect(posted).toEqual(["delta/pull/57"]);
		expect(navigation.entries().length).toBe(entries);
	});

	test("its merge box and thread forms post to the pull request's page, so they work without script", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57");
		let forms = [...root.querySelectorAll<HTMLFormElement>("[data-main-screen] form[method=post]")];

		expect(forms.length).toBeGreaterThan(4);
		for (let form of forms) {
			expect(new URL(form.action).pathname).toBe(`${ROOT}/delta/pull/57`);
		}
	});
});

describe("Delta's pull request files", () => {
	test("Viewed posts through main, collapses the file and counts it, adding no history entry", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57/files");
		let entries = navigation.entries().length;
		let card = () =>
			root.querySelector<HTMLElement>('[data-slot="diff-file"][data-path="data.ts"]')!;
		expect(card().querySelector("details")!.open).toBe(true);
		card().querySelector<HTMLButtonElement>("button[data-delta-viewed]")!.click();
		await settle(() => card().hasAttribute("data-viewed"));

		expect(posted).toEqual(["delta/pull/57/files"]);
		expect(card().querySelector("details")!.open).toBe(false);
		expect(root.querySelector('[data-slot="diff-progress"]')?.textContent).toMatch(/^1 \/ \d+/);
		expect(navigation.entries().length).toBe(entries);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("a line's + opens the comment form under it, and the comment lands as pending in place", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57/files");
		let entries = navigation.entries().length;
		let diff = root.querySelector<HTMLElement>('[data-slot="diff"]')!;
		await settle(() => diff.hasAttribute("data-diff-live"));
		let plus = root.querySelector<HTMLAnchorElement>(
			'[data-slot="diff-file"][data-path="diffs.tsx"] a[data-comment="R34"]',
		)!;
		plus.click();
		await settle(() => root.querySelector("tr[data-delta-draft]") !== null);
		let draft = root.querySelector<HTMLElement>("tr[data-delta-draft]")!;

		expect(draft.querySelector<HTMLInputElement>('input[name="path"]')!.value).toBe("diffs.tsx");
		expect(draft.querySelector<HTMLInputElement>('input[name="end"]')!.value).toBe("34");
		draft.querySelector("textarea")!.value = "Make it 500.";
		draft.querySelector<HTMLButtonElement>('button[value="review"]')!.click();
		await settle(() => root.textContent?.includes("Finish your review (1)") ?? false);

		expect(root.textContent).toContain("Make it 500.");
		expect(navigation.entries().length).toBe(entries);
	});

	test("without script, every + links to the comment form on its own page", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57/files");
		let plus = root.querySelector<HTMLAnchorElement>(
			'[data-slot="diff-file"][data-path="diffs.tsx"] a[data-comment="R34"]',
		)!;
		let target = new URL(plus.href);

		expect(target.pathname).toBe(`${ROOT}/delta/pull/57/files`);
		expect(target.searchParams.get("comment")).toBe("diffs.tsx:R34");
	});

	test("Finish your review opens its dialog, and submitting it posts in place", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("delta/pull/57/files");
		let entries = navigation.entries().length;
		let dialog = root.querySelector<HTMLDialogElement>("#delta-review-dialog")!;
		root.querySelector<HTMLButtonElement>('button[commandfor="delta-review-dialog"]')!.click();
		await settle(() => dialog.open);

		expect(dialog.open).toBe(true);
		dialog.querySelector("textarea")!.value = "Looks good.";
		dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
		await settle(
			() => posted.length > 0 && root.querySelector("template[data-main-toast]") !== null,
		);

		expect(posted).toEqual(["delta/pull/57/files"]);
		expect(navigation.entries().length).toBe(entries);
	});
});
