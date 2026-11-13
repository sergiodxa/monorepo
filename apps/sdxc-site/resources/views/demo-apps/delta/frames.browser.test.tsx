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
import { render } from "remix/component/test";
import { afterAll, describe, expect, onTestFinished, test } from "vitest";
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

/** Resolves Delta's named frames as the page route does; any other frame stays pending. */
function resolveDeltaFrame(src: string, options?: { target?: string }) {
	let target = options?.target;
	if (target === undefined || delta.target === undefined) return new Promise<never>(() => {});
	requested.push(target);
	let url = new URL(src, location.origin);
	return Promise.resolve(delta.target(target, { page: pageOf(url), url, cookie: null })).then(
		(node) => node ?? new Promise<never>(() => {}),
	);
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
